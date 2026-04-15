import type { UnitType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScraperProductResult = {
  productCode: string | null;
  productName: string;
  /** Price charged by the supplier for this package */
  purchasePrice: number;
  /** Quantity in the package (e.g. 1, 5, 10) */
  purchaseQuantity: number;
  /** Unit of the package quantity */
  purchaseUnit: UnitType;
  /** Whether the product is currently available */
  isAvailable?: boolean;
  /** Raw page text or any additional metadata captured during scrape */
  metadata?: Record<string, unknown>;
};

export type ScraperAdapterCredentialField = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  required: boolean;
  placeholder?: string;
  hint?: string;
};

// ─── Abstract Base Adapter ────────────────────────────────────────────────────

/**
 * Every scraper adapter must extend this class.  Scraper adapters use
 * browser automation (Playwright) to access supplier websites that require
 * login.  Adapters are registered in lib/suppliers/scrapers/registry.ts.
 *
 * Browser lifecycle:
 *   - Each adapter method is responsible for launching and closing its own
 *     browser context, or may inherit from PlaywrightScraperBase which
 *     provides shared launch/close helpers.
 *   - Adapters must never persist raw credentials beyond the duration of a
 *     single method call.
 *
 * Credentials are always passed as a plain Record<string, string>. They are
 * deserialised from the database by the scraper sync service.
 *
 * Required credential fields are described by `credentialFields` so the UI
 * can render a generic form.  At minimum, include loginUrl, username, and
 * password fields.
 */
export abstract class ScraperAdapterBase {
  /** Stable identifier used to reference this adapter in the database. */
  abstract readonly adapterKey: string;

  /** Human-readable name shown in the UI. */
  abstract readonly displayName: string;

  /**
   * Describes the credential fields required by this adapter so the UI can
   * render a generic credential form.
   */
  abstract readonly credentialFields: ScraperAdapterCredentialField[];

  /**
   * Verify that the supplied credentials can authenticate with the supplier
   * website.  Should attempt a real login if possible.
   * Returns { ok: true } on success, or { ok: false, message } on failure.
   */
  abstract testLogin(
    credentials: Record<string, string>
  ): Promise<{ ok: boolean; message: string }>;

  /**
   * Navigate to a specific product URL and extract pricing information.
   * Returns null when the product page cannot be found or parsed.
   *
   * This is the primary method used by the sync service for SCRAPER_READY
   * links that have a `supplierProductUrl` set.
   */
  abstract scrapeProductPrice(
    credentials: Record<string, string>,
    productUrl: string
  ): Promise<ScraperProductResult | null>;

  /**
   * Search the supplier website for products matching `query`.
   * Returns an empty array if search is not supported.
   *
   * Used by the scraper search UI to help admins discover product URLs.
   */
  abstract searchProducts(
    credentials: Record<string, string>,
    query: string,
    limit?: number
  ): Promise<ScraperProductResult[]>;
}
