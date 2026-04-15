import { UnitType } from "@/app/generated/prisma/enums";
import type {
  ScraperAdapterCredentialField,
  ScraperProductResult,
} from "./base";
import { ScraperAdapterBase } from "./base";

// ─── Demo product catalogue ───────────────────────────────────────────────────

const DEMO_PRODUCTS: ScraperProductResult[] = [
  {
    productCode: "SCRAPER-FLOUR-001",
    productName: "High Grade Flour 25kg",
    purchasePrice: 44.95,
    purchaseQuantity: 25,
    purchaseUnit: UnitType.KG,
    isAvailable: true,
  },
  {
    productCode: "SCRAPER-SUGAR-001",
    productName: "Caster Sugar 10kg",
    purchasePrice: 19.5,
    purchaseQuantity: 10,
    purchaseUnit: UnitType.KG,
    isAvailable: true,
  },
  {
    productCode: "SCRAPER-YEAST-001",
    productName: "Dried Yeast 500g",
    purchasePrice: 9.2,
    purchaseQuantity: 500,
    purchaseUnit: UnitType.G,
    isAvailable: true,
  },
  {
    productCode: "SCRAPER-SALT-001",
    productName: "Fine Salt 2kg",
    purchasePrice: 4.5,
    purchaseQuantity: 2,
    purchaseUnit: UnitType.KG,
    isAvailable: true,
  },
  {
    productCode: "SCRAPER-OIL-001",
    productName: "Vegetable Oil 5L",
    purchasePrice: 15.75,
    purchaseQuantity: 5,
    purchaseUnit: UnitType.L,
    isAvailable: false,
  },
];

// ─── Demo Scraper ─────────────────────────────────────────────────────────────

/**
 * A demo scraper adapter that returns in-memory mock data without launching a
 * real browser.  Use this to validate the end-to-end scraper sync flow.
 *
 * Required credentials:
 *   - loginUrl:  any non-empty string (use "https://demo.example.com/login")
 *   - username:  any non-empty string (use "demo")
 *   - password:  any non-empty string (use "demo")
 *
 * Product URLs for scrapeProductPrice should be one of:
 *   https://demo.example.com/products/<productCode>
 * where productCode is one of: SCRAPER-FLOUR-001, SCRAPER-SUGAR-001, etc.
 */
export class DemoScraperAdapter extends ScraperAdapterBase {
  readonly adapterKey = "demo-scraper";
  readonly displayName = "Demo Scraper (Test)";

  readonly credentialFields: ScraperAdapterCredentialField[] = [
    {
      key: "loginUrl",
      label: "Login URL",
      type: "url",
      required: true,
      placeholder: "https://demo.example.com/login",
      hint: 'Use "https://demo.example.com/login" for the test catalogue',
    },
    {
      key: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "demo",
    },
    {
      key: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "demo",
    },
  ];

  async testLogin(
    credentials: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    if (!credentials.loginUrl || !credentials.username || !credentials.password) {
      return { ok: false, message: "loginUrl, username, and password are required" };
    }
    if (credentials.username !== "demo" || credentials.password !== "demo") {
      return {
        ok: false,
        message: 'Invalid credentials. Use username "demo" and password "demo".',
      };
    }
    return { ok: true, message: "Logged in to Demo Scraper successfully" };
  }

  async scrapeProductPrice(
    credentials: Record<string, string>,
    productUrl: string
  ): Promise<ScraperProductResult | null> {
    const { ok } = await this.testLogin(credentials);
    if (!ok) return null;

    // Extract product code from URL: https://demo.example.com/products/<code>
    const match = productUrl.match(/\/products\/([^/?#]+)/i);
    if (!match) return null;
    const code = decodeURIComponent(match[1]).toUpperCase();

    return (
      DEMO_PRODUCTS.find((p) => p.productCode?.toUpperCase() === code) ?? null
    );
  }

  async searchProducts(
    credentials: Record<string, string>,
    query: string,
    limit = 20
  ): Promise<ScraperProductResult[]> {
    const { ok } = await this.testLogin(credentials);
    if (!ok) return [];

    const q = query.toLowerCase().trim();
    const filtered = q
      ? DEMO_PRODUCTS.filter(
          (p) =>
            p.productName.toLowerCase().includes(q) ||
            (p.productCode ?? "").toLowerCase().includes(q)
        )
      : DEMO_PRODUCTS;

    return filtered.slice(0, limit);
  }
}
