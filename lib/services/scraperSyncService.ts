import "server-only";
import { prisma } from "@/lib/db";
import {
  PriceHistorySourceType,
  SupplierSyncMode,
  SupplierSyncStatus,
} from "@/app/generated/prisma/enums";
import { getScraperAdapter, listScraperAdapters } from "@/lib/suppliers/scrapers/registry";
import { updateIngredient } from "@/lib/services/ingredientService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScraperCredentialStatus = {
  configured: boolean;
  adapterKey: string | null;
  adapterDisplayName: string | null;
  isActive: boolean;
  notes: string | null;
  updatedAt: string | null;
};

export type ScraperSyncResult = {
  syncLogId: string;
  status: SupplierSyncStatus;
  totalLinks: number;
  successLinks: number;
  errorLinks: number;
  skippedLinks: number;
  errorSummary: string | null;
};

// ─── Credential management ────────────────────────────────────────────────────

/**
 * Returns the scraper credential status for a supplier without exposing the
 * actual credential values.
 */
export async function getScraperCredentialStatus(
  supplierId: string
): Promise<ScraperCredentialStatus> {
  const cred = await prisma.supplierScraperCredential.findUnique({
    where: { supplierId },
  });

  if (!cred) {
    return {
      configured: false,
      adapterKey: null,
      adapterDisplayName: null,
      isActive: false,
      notes: null,
      updatedAt: null,
    };
  }

  const adapter = getScraperAdapter(cred.adapterKey);

  return {
    configured: true,
    adapterKey: cred.adapterKey,
    adapterDisplayName: adapter?.displayName ?? cred.adapterKey,
    isActive: cred.isActive,
    notes: cred.notes,
    updatedAt: cred.updatedAt.toISOString(),
  };
}

/**
 * Upserts scraper credentials for a supplier.  The credentials object is
 * JSON-serialised before storage and never returned to callers.
 */
export async function upsertScraperCredentials(
  supplierId: string,
  adapterKey: string,
  credentials: Record<string, string>,
  notes?: string | null
): Promise<ScraperCredentialStatus> {
  const credentialsJson = JSON.stringify(credentials);

  await prisma.supplierScraperCredential.upsert({
    where: { supplierId },
    create: {
      supplierId,
      adapterKey,
      credentials: credentialsJson,
      isActive: true,
      notes: notes ?? null,
    },
    update: {
      adapterKey,
      credentials: credentialsJson,
      isActive: true,
      notes: notes ?? null,
    },
  });

  return getScraperCredentialStatus(supplierId);
}

/**
 * Removes the scraper credentials for a supplier.
 */
export async function deleteScraperCredentials(supplierId: string): Promise<void> {
  await prisma.supplierScraperCredential.deleteMany({ where: { supplierId } });
}

/**
 * Tests scraper login using the stored credentials.
 */
export async function testScraperCredentials(
  supplierId: string
): Promise<{ ok: boolean; message: string }> {
  const cred = await prisma.supplierScraperCredential.findUnique({
    where: { supplierId },
  });
  if (!cred) return { ok: false, message: "No scraper credentials configured" };
  if (!cred.isActive) return { ok: false, message: "Scraper credentials are disabled" };

  const adapter = getScraperAdapter(cred.adapterKey);
  if (!adapter) {
    return {
      ok: false,
      message: `Unknown scraper adapter "${cred.adapterKey}". Contact your administrator.`,
    };
  }

  let rawCreds: Record<string, string>;
  try {
    rawCreds = JSON.parse(cred.credentials) as Record<string, string>;
  } catch {
    return { ok: false, message: "Stored scraper credentials are corrupted" };
  }

  return adapter.testLogin(rawCreds);
}

/** Lists all registered scraper adapters. */
export { listScraperAdapters };

// ─── Product search ───────────────────────────────────────────────────────────

export async function searchScraperProducts(
  supplierId: string,
  query: string,
  limit?: number
) {
  const cred = await prisma.supplierScraperCredential.findUnique({
    where: { supplierId },
  });
  if (!cred || !cred.isActive) {
    throw new Error("No active scraper credentials configured for this supplier");
  }

  const adapter = getScraperAdapter(cred.adapterKey);
  if (!adapter) {
    throw new Error(`Scraper adapter "${cred.adapterKey}" is not registered`);
  }

  let rawCreds: Record<string, string>;
  try {
    rawCreds = JSON.parse(cred.credentials) as Record<string, string>;
  } catch {
    throw new Error("Stored scraper credentials are corrupted");
  }

  return adapter.searchProducts(rawCreds, query, limit);
}

// ─── Sync execution ───────────────────────────────────────────────────────────

/**
 * Executes a full scraper sync for a supplier.  Finds all active
 * IngredientSupplierLinks with syncMode = SCRAPER_READY and a
 * supplierProductUrl (or supplierProductCode as fallback for search-based
 * scraping), then fetches pricing via the scraper adapter and applies updates
 * through the existing ingredient pricing pipeline.
 */
export async function executeScraperSync(
  supplierId: string,
  triggeredByUserId?: string | null
): Promise<ScraperSyncResult> {
  const cred = await prisma.supplierScraperCredential.findUnique({
    where: { supplierId },
  });
  if (!cred || !cred.isActive) {
    throw new Error("No active scraper credentials configured for this supplier");
  }

  const adapter = getScraperAdapter(cred.adapterKey);
  if (!adapter) {
    throw new Error(`Scraper adapter "${cred.adapterKey}" is not registered`);
  }

  let rawCreds: Record<string, string>;
  try {
    rawCreds = JSON.parse(cred.credentials) as Record<string, string>;
  } catch {
    throw new Error("Stored scraper credentials are corrupted");
  }

  // Verify login before starting the sync
  const loginCheck = await adapter.testLogin(rawCreds);
  if (!loginCheck.ok) {
    throw new Error(`Scraper login failed: ${loginCheck.message}`);
  }

  // Create the sync log in RUNNING state
  const syncLog = await prisma.supplierSyncLog.create({
    data: {
      supplierId,
      scraperCredentialId: cred.id,
      status: SupplierSyncStatus.RUNNING,
      triggeredByUserId: triggeredByUserId ?? null,
      startedAt: new Date(),
    },
  });

  // Find all SCRAPER_READY links with a product URL or product code
  const links = await prisma.ingredientSupplierLink.findMany({
    where: {
      supplierId,
      isActive: true,
      syncMode: SupplierSyncMode.SCRAPER_READY,
      OR: [
        { supplierProductUrl: { not: null } },
        { supplierProductCode: { not: null } },
      ],
    },
    include: {
      ingredient: {
        select: {
          id: true,
          name: true,
          purchaseUnit: true,
          purchaseQuantity: true,
          taxIncluded: true,
          yieldPercent: true,
        },
      },
    },
  });

  let successLinks = 0;
  let errorLinks = 0;
  let skippedLinks = 0;
  const errors: string[] = [];

  const logEntries: Array<{
    syncLogId: string;
    ingredientSupplierLinkId: string | null;
    ingredientId: string | null;
    message: string;
    level: string;
  }> = [];

  for (const link of links) {
    const productUrl = link.supplierProductUrl;
    const productCode = link.supplierProductCode;

    try {
      let product = null;

      if (productUrl) {
        // Primary: scrape by direct product URL
        product = await adapter.scrapeProductPrice(rawCreds, productUrl);
      } else if (productCode) {
        // Fallback: search by product code and take the first result
        const results = await adapter.searchProducts(rawCreds, productCode, 1);
        product = results[0] ?? null;
      }

      if (!product) {
        skippedLinks++;
        const identifier = productUrl ?? productCode ?? link.id;
        logEntries.push({
          syncLogId: syncLog.id,
          ingredientSupplierLinkId: link.id,
          ingredientId: link.ingredientId,
          message: `Product not found on supplier website (${identifier}) — skipped`,
          level: "warning",
        });

        await prisma.ingredientSupplierLink.update({
          where: { id: link.id },
          data: { lastCheckedAt: new Date(), lastSyncStatus: "not_found" },
        });
        continue;
      }

      if (product.isAvailable === false) {
        skippedLinks++;
        logEntries.push({
          syncLogId: syncLog.id,
          ingredientSupplierLinkId: link.id,
          ingredientId: link.ingredientId,
          message: `Product "${product.productName}" is currently unavailable on the website — skipped`,
          level: "warning",
        });

        await prisma.ingredientSupplierLink.update({
          where: { id: link.id },
          data: { lastCheckedAt: new Date(), lastSyncStatus: "unavailable" },
        });
        continue;
      }

      // Apply the pricing update using the existing pipeline
      await updateIngredient(link.ingredientId, {
        purchasePrice: product.purchasePrice,
        purchaseQuantity: product.purchaseQuantity,
        purchaseUnit: product.purchaseUnit,
        sourceType: PriceHistorySourceType.SCRAPER_SYNC,
        changeNote: `Scraper sync from supplier (${adapter.displayName}) — product: ${product.productName}`,
        createdByUserId: triggeredByUserId ?? null,
        ingredientSupplierLinkId: link.id,
      });

      await prisma.ingredientSupplierLink.update({
        where: { id: link.id },
        data: { lastCheckedAt: new Date(), lastSyncStatus: "ok" },
      });

      successLinks++;
      logEntries.push({
        syncLogId: syncLog.id,
        ingredientSupplierLinkId: link.id,
        ingredientId: link.ingredientId,
        message: `Updated "${link.ingredient.name}" — price: $${product.purchasePrice} / ${product.purchaseQuantity} ${product.purchaseUnit}`,
        level: "info",
      });
    } catch (err) {
      errorLinks++;
      const message = err instanceof Error ? err.message : "Unknown error during scrape";
      errors.push(`Link ${link.id} (${link.ingredient.name}): ${message}`);

      logEntries.push({
        syncLogId: syncLog.id,
        ingredientSupplierLinkId: link.id,
        ingredientId: link.ingredientId,
        message: `Failed to scrape "${link.ingredient.name}": ${message}`,
        level: "error",
      });

      await prisma.ingredientSupplierLink.update({
        where: { id: link.id },
        data: { lastCheckedAt: new Date(), lastSyncStatus: "error" },
      });
    }
  }

  if (links.length === 0) {
    logEntries.push({
      syncLogId: syncLog.id,
      ingredientSupplierLinkId: null,
      ingredientId: null,
      message:
        "No scraper-ready supplier links found (set syncMode to SCRAPER_READY and add a product URL or product code to each link)",
      level: "warning",
    });
  }

  // Persist log entries
  if (logEntries.length > 0) {
    await prisma.supplierSyncLogEntry.createMany({ data: logEntries });
  }

  const finalStatus =
    errorLinks === 0 && links.length > 0
      ? SupplierSyncStatus.SUCCESS
      : errorLinks > 0 && successLinks > 0
        ? SupplierSyncStatus.PARTIAL
        : errorLinks > 0
          ? SupplierSyncStatus.FAILED
          : SupplierSyncStatus.SUCCESS;

  const errorSummary = errors.length > 0 ? errors.slice(0, 5).join("; ") : null;

  await prisma.supplierSyncLog.update({
    where: { id: syncLog.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      totalLinks: links.length,
      successLinks,
      errorLinks,
      skippedLinks,
      errorSummary,
    },
  });

  return {
    syncLogId: syncLog.id,
    status: finalStatus,
    totalLinks: links.length,
    successLinks,
    errorLinks,
    skippedLinks,
    errorSummary,
  };
}

// ─── Sync log queries ─────────────────────────────────────────────────────────

export async function listScraperSyncLogs(
  supplierId: string,
  limit = 20
) {
  const rows = await prisma.supplierSyncLog.findMany({
    where: {
      supplierId,
      scraperCredentialId: { not: null },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      triggeredByUser: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    supplierId: r.supplierId,
    scraperCredentialId: r.scraperCredentialId,
    status: r.status,
    triggeredByUserId: r.triggeredByUserId,
    triggeredByUserName: r.triggeredByUser?.name ?? null,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    totalLinks: r.totalLinks,
    successLinks: r.successLinks,
    errorLinks: r.errorLinks,
    skippedLinks: r.skippedLinks,
    errorSummary: r.errorSummary,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getScraperSyncLogDetail(syncLogId: string) {
  const row = await prisma.supplierSyncLog.findUnique({
    where: { id: syncLogId },
    include: {
      triggeredByUser: { select: { name: true } },
      logEntries: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    supplierId: row.supplierId,
    scraperCredentialId: row.scraperCredentialId,
    status: row.status,
    triggeredByUserId: row.triggeredByUserId,
    triggeredByUserName: row.triggeredByUser?.name ?? null,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    totalLinks: row.totalLinks,
    successLinks: row.successLinks,
    errorLinks: row.errorLinks,
    skippedLinks: row.skippedLinks,
    errorSummary: row.errorSummary,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    logEntries: row.logEntries.map((e) => ({
      id: e.id,
      syncLogId: e.syncLogId,
      ingredientSupplierLinkId: e.ingredientSupplierLinkId,
      ingredientId: e.ingredientId,
      message: e.message,
      level: e.level,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
