import type { UnitType } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupplierProductResult = {
  productCode: string;
  productName: string;
  /** Price charged by the supplier for this package */
  purchasePrice: number;
  /** Quantity in the package (e.g. 1, 5, 10) */
  purchaseQuantity: number;
  /** Unit of the package quantity */
  purchaseUnit: UnitType;
  /** Whether the product is currently available for ordering */
  isAvailable?: boolean;
  /** Any additional metadata from the supplier API */
  metadata?: Record<string, unknown>;
};

export type SupplierSearchOptions = {
  query?: string;
  limit?: number;
};

export type SupplierAdapterCredentialField = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  required: boolean;
  placeholder?: string;
};

// ─── Abstract Base Adapter ────────────────────────────────────────────────────

/**
 * Every supplier adapter must extend this class and implement the three
 * abstract methods below. Adapters are registered in lib/suppliers/registry.ts
 * and discovered at runtime by adapter key.
 *
 * Credentials are always passed as a plain Record<string, string> – the sync
 * service deserialises them from the database before calling any adapter method.
 * Never persist or log raw credentials.
 */
export abstract class SupplierAdapterBase {
  /** Stable identifier used to reference this adapter in the database. */
  abstract readonly adapterKey: string;

  /** Human-readable name shown in the UI. */
  abstract readonly displayName: string;

  /** Describes the fields required in the credentials JSON so the UI can
   *  render a generic credential form. */
  abstract readonly credentialFields: SupplierAdapterCredentialField[];

  /**
   * Verify that the supplied credentials can reach the supplier API.
   * Returns true on success; throws an Error with a human-readable message on
   * failure.
   */
  abstract testConnection(
    credentials: Record<string, string>
  ): Promise<{ ok: boolean; message: string }>;

  /**
   * Search the supplier's product catalogue.  May return an empty array if the
   * supplier API does not support search, but must not throw.
   */
  abstract searchProducts(
    credentials: Record<string, string>,
    options: SupplierSearchOptions
  ): Promise<SupplierProductResult[]>;

  /**
   * Fetch a single product by its supplier-assigned product code.
   * Returns null when the product cannot be found.
   */
  abstract getProductByCode(
    credentials: Record<string, string>,
    productCode: string
  ): Promise<SupplierProductResult | null>;
}
