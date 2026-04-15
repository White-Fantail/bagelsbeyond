import { UnitType } from "@/app/generated/prisma/enums";
import type {
  SupplierAdapterCredentialField,
  SupplierProductResult,
  SupplierSearchOptions,
} from "./base";
import { SupplierAdapterBase } from "./base";

// ─── Demo product catalogue ───────────────────────────────────────────────────

const DEMO_PRODUCTS: SupplierProductResult[] = [
  {
    productCode: "DEMO-FLOUR-001",
    productName: "High Grade Flour 25kg",
    purchasePrice: 42.5,
    purchaseQuantity: 25,
    purchaseUnit: UnitType.KG,
    isAvailable: true,
  },
  {
    productCode: "DEMO-SUGAR-001",
    productName: "Caster Sugar 10kg",
    purchasePrice: 18.9,
    purchaseQuantity: 10,
    purchaseUnit: UnitType.KG,
    isAvailable: true,
  },
  {
    productCode: "DEMO-YEAST-001",
    productName: "Dried Yeast 500g",
    purchasePrice: 8.75,
    purchaseQuantity: 500,
    purchaseUnit: UnitType.G,
    isAvailable: true,
  },
  {
    productCode: "DEMO-SALT-001",
    productName: "Fine Salt 2kg",
    purchasePrice: 4.2,
    purchaseQuantity: 2,
    purchaseUnit: UnitType.KG,
    isAvailable: true,
  },
  {
    productCode: "DEMO-OIL-001",
    productName: "Vegetable Oil 5L",
    purchasePrice: 14.0,
    purchaseQuantity: 5,
    purchaseUnit: UnitType.L,
    isAvailable: false,
  },
];

// ─── Demo Adapter ─────────────────────────────────────────────────────────────

/**
 * A demo adapter that returns in-memory mock data.  Use this to validate the
 * end-to-end API sync flow without connecting to a real supplier.
 *
 * Required credentials:
 *   - apiKey: any non-empty string (use "demo" for convenience)
 */
export class DemoSupplierAdapter extends SupplierAdapterBase {
  readonly adapterKey = "demo";
  readonly displayName = "Demo Supplier (Test)";

  readonly credentialFields: SupplierAdapterCredentialField[] = [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      placeholder: 'Enter "demo" to use the test catalogue',
    },
  ];

  async testConnection(
    credentials: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    if (!credentials.apiKey) {
      return { ok: false, message: "API key is required" };
    }
    if (credentials.apiKey !== "demo") {
      return {
        ok: false,
        message: 'Invalid API key. Use "demo" for the test catalogue.',
      };
    }
    return { ok: true, message: "Connected to Demo Supplier successfully" };
  }

  async searchProducts(
    credentials: Record<string, string>,
    options: SupplierSearchOptions
  ): Promise<SupplierProductResult[]> {
    const { ok } = await this.testConnection(credentials);
    if (!ok) return [];

    const query = (options.query ?? "").toLowerCase().trim();
    const limit = options.limit ?? 20;

    const filtered = query
      ? DEMO_PRODUCTS.filter(
          (p) =>
            p.productName.toLowerCase().includes(query) ||
            p.productCode.toLowerCase().includes(query)
        )
      : DEMO_PRODUCTS;

    return filtered.slice(0, limit);
  }

  async getProductByCode(
    credentials: Record<string, string>,
    productCode: string
  ): Promise<SupplierProductResult | null> {
    const { ok } = await this.testConnection(credentials);
    if (!ok) return null;

    return (
      DEMO_PRODUCTS.find(
        (p) => p.productCode.toLowerCase() === productCode.toLowerCase()
      ) ?? null
    );
  }
}
