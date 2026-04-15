import "server-only";
import { prisma } from "@/lib/db";
import {
  PriceHistorySourceType,
  SupplierSyncMode,
  SupplierSyncStatus,
} from "@/app/generated/prisma/enums";
import { getAdapter } from "@/lib/suppliers/registry";
import { updateIngredient } from "@/lib/services/ingredientService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CredentialStatus = {
  configured: boolean;
  adapterKey: string | null;
  adapterDisplayName: string | null;
  isActive: boolean;
  notes: string | null;
  updatedAt: string | null;
};

export type SyncLogRow = {
  id: string;
  supplierId: string;
  credentialId: string | null;
  status: SupplierSyncStatus;
  triggeredByUserId: string | null;
  triggeredByUserName: string | null;
  startedAt: string;
  finishedAt: string | null;
  totalLinks: number;
  successLinks: number;
  errorLinks: number;
  skippedLinks: number;
  errorSummary: string | null;
  notes: string | null;
  createdAt: string;
};

export type SyncLogEntry = {
  id: string;
  syncLogId: string;
  ingredientSupplierLinkId: string | null;
  ingredientId: string | null;
  message: string;
  level: string;
  createdAt: string;
};

export type SyncLogDetail = SyncLogRow & { logEntries: SyncLogEntry[] };

export type SyncResult = {
  syncLogId: string;
  status: SupplierSyncStatus;
  totalLinks: number;
  successLinks: number;
  errorLinks: number;
  skippedLinks: number;
  errorSummary: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSyncLogRow(r: {
  id: string;
  supplierId: string;
  credentialId: string | null;
  status: SupplierSyncStatus;
  triggeredByUserId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  totalLinks: number;
  successLinks: number;
  errorLinks: number;
  skippedLinks: number;
  errorSummary: string | null;
  notes: string | null;
  createdAt: Date;
  triggeredByUser?: { name: string } | null;
}): SyncLogRow {
  return {
    id: r.id,
    supplierId: r.supplierId,
    credentialId: r.credentialId,
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
  };
}

// ─── Credential management ────────────────────────────────────────────────────

/**
 * Returns the credential status for a supplier without exposing the actual
 * credential values.
 */
export async function getCredentialStatus(
  supplierId: string
): Promise<CredentialStatus> {
  const cred = await prisma.supplierApiCredential.findUnique({
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

  const adapter = getAdapter(cred.adapterKey);

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
 * Upserts API credentials for a supplier.  The credentials object is
 * JSON-serialised before storage and never returned to callers after this
 * point.
 */
export async function upsertCredentials(
  supplierId: string,
  adapterKey: string,
  credentials: Record<string, string>,
  notes?: string | null
): Promise<CredentialStatus> {
  const credentialsJson = JSON.stringify(credentials);

  await prisma.supplierApiCredential.upsert({
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

  return getCredentialStatus(supplierId);
}

/**
 * Removes the API credentials for a supplier.
 */
export async function deleteCredentials(supplierId: string): Promise<void> {
  await prisma.supplierApiCredential.deleteMany({ where: { supplierId } });
}

/**
 * Tests connectivity using the stored credentials.  Returns ok: true on
 * success or ok: false with a message on failure.
 */
export async function testCredentials(
  supplierId: string
): Promise<{ ok: boolean; message: string }> {
  const cred = await prisma.supplierApiCredential.findUnique({
    where: { supplierId },
  });
  if (!cred) return { ok: false, message: "No credentials configured" };
  if (!cred.isActive) return { ok: false, message: "Credentials are disabled" };

  const adapter = getAdapter(cred.adapterKey);
  if (!adapter) {
    return {
      ok: false,
      message: `Unknown adapter "${cred.adapterKey}". Contact your administrator.`,
    };
  }

  let rawCreds: Record<string, string>;
  try {
    rawCreds = JSON.parse(cred.credentials) as Record<string, string>;
  } catch {
    return { ok: false, message: "Stored credentials are corrupted" };
  }

  return adapter.testConnection(rawCreds);
}

// ─── Product search ───────────────────────────────────────────────────────────

export async function searchSupplierProducts(
  supplierId: string,
  query: string,
  limit?: number
) {
  const cred = await prisma.supplierApiCredential.findUnique({
    where: { supplierId },
  });
  if (!cred || !cred.isActive) {
    throw new Error("No active credentials configured for this supplier");
  }

  const adapter = getAdapter(cred.adapterKey);
  if (!adapter) {
    throw new Error(`Adapter "${cred.adapterKey}" is not registered`);
  }

  let rawCreds: Record<string, string>;
  try {
    rawCreds = JSON.parse(cred.credentials) as Record<string, string>;
  } catch {
    throw new Error("Stored credentials are corrupted");
  }

  return adapter.searchProducts(rawCreds, { query, limit });
}

// ─── Sync execution ───────────────────────────────────────────────────────────

/**
 * Executes a full API sync for a supplier.  Finds all active
 * IngredientSupplierLinks with syncMode = API_READY and a supplierProductCode,
 * fetches current pricing from the supplier API, and applies updates via the
 * existing ingredient pricing update pipeline.
 *
 * Returns a SyncResult with counts and the sync log id.
 */
export async function executeSuppilerSync(
  supplierId: string,
  triggeredByUserId?: string | null
): Promise<SyncResult> {
  const cred = await prisma.supplierApiCredential.findUnique({
    where: { supplierId },
  });
  if (!cred || !cred.isActive) {
    throw new Error("No active credentials configured for this supplier");
  }

  const adapter = getAdapter(cred.adapterKey);
  if (!adapter) {
    throw new Error(`Adapter "${cred.adapterKey}" is not registered`);
  }

  let rawCreds: Record<string, string>;
  try {
    rawCreds = JSON.parse(cred.credentials) as Record<string, string>;
  } catch {
    throw new Error("Stored credentials are corrupted");
  }

  // Create the sync log in RUNNING state
  const syncLog = await prisma.supplierSyncLog.create({
    data: {
      supplierId,
      credentialId: cred.id,
      status: SupplierSyncStatus.RUNNING,
      triggeredByUserId: triggeredByUserId ?? null,
      startedAt: new Date(),
    },
  });

  // Find all API-ready links with a product code
  const links = await prisma.ingredientSupplierLink.findMany({
    where: {
      supplierId,
      isActive: true,
      syncMode: SupplierSyncMode.API_READY,
      supplierProductCode: { not: null },
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
    const productCode = link.supplierProductCode!;

    try {
      const product = await adapter.getProductByCode(rawCreds, productCode);

      if (!product) {
        skippedLinks++;
        logEntries.push({
          syncLogId: syncLog.id,
          ingredientSupplierLinkId: link.id,
          ingredientId: link.ingredientId,
          message: `Product code "${productCode}" not found in supplier catalogue — skipped`,
          level: "warning",
        });

        await prisma.ingredientSupplierLink.update({
          where: { id: link.id },
          data: {
            lastCheckedAt: new Date(),
            lastSyncStatus: "not_found",
          },
        });
        continue;
      }

      if (product.isAvailable === false) {
        skippedLinks++;
        logEntries.push({
          syncLogId: syncLog.id,
          ingredientSupplierLinkId: link.id,
          ingredientId: link.ingredientId,
          message: `Product "${product.productName}" is currently unavailable — skipped`,
          level: "warning",
        });

        await prisma.ingredientSupplierLink.update({
          where: { id: link.id },
          data: {
            lastCheckedAt: new Date(),
            lastSyncStatus: "unavailable",
          },
        });
        continue;
      }

      // Apply the pricing update using the existing pipeline
      await updateIngredient(link.ingredientId, {
        purchasePrice: product.purchasePrice,
        purchaseQuantity: product.purchaseQuantity,
        purchaseUnit: product.purchaseUnit,
        sourceType: PriceHistorySourceType.API_SYNC,
        changeNote: `API sync from supplier (${adapter.displayName}) — product: ${product.productName}`,
        createdByUserId: triggeredByUserId ?? null,
        ingredientSupplierLinkId: link.id,
      });

      await prisma.ingredientSupplierLink.update({
        where: { id: link.id },
        data: {
          lastCheckedAt: new Date(),
          lastSyncStatus: "ok",
        },
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
      const message =
        err instanceof Error ? err.message : "Unknown error during sync";
      errors.push(`Link ${link.id} (${link.ingredient.name}): ${message}`);

      logEntries.push({
        syncLogId: syncLog.id,
        ingredientSupplierLinkId: link.id,
        ingredientId: link.ingredientId,
        message: `Failed to sync "${link.ingredient.name}": ${message}`,
        level: "error",
      });

      await prisma.ingredientSupplierLink.update({
        where: { id: link.id },
        data: {
          lastCheckedAt: new Date(),
          lastSyncStatus: "error",
        },
      });
    }
  }

  if (links.length === 0) {
    logEntries.push({
      syncLogId: syncLog.id,
      ingredientSupplierLinkId: null,
      ingredientId: null,
      message:
        "No API-ready supplier links found (set syncMode to API_READY and add a supplier product code to each link)",
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

  const errorSummary =
    errors.length > 0 ? errors.slice(0, 5).join("; ") : null;

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

export async function listSyncLogs(
  supplierId: string,
  limit = 20
): Promise<SyncLogRow[]> {
  const rows = await prisma.supplierSyncLog.findMany({
    where: { supplierId },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      triggeredByUser: { select: { name: true } },
    },
  });
  return rows.map(toSyncLogRow);
}

export async function getSyncLogDetail(
  syncLogId: string
): Promise<SyncLogDetail | null> {
  const row = await prisma.supplierSyncLog.findUnique({
    where: { id: syncLogId },
    include: {
      triggeredByUser: { select: { name: true } },
      logEntries: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;

  const base = toSyncLogRow(row);
  return {
    ...base,
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
