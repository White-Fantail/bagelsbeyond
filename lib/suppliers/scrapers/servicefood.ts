import { chromium } from "playwright";
import { UnitType } from "@/app/generated/prisma/enums";
import type {
  ScraperAdapterCredentialField,
  ScraperProductResult,
} from "./base";
import { ScraperAdapterBase } from "./base";
import { parsePrice, inferUnit } from "./scraper-utils";

// ─── ServiceFood Scraper ──────────────────────────────────────────────────────

/**
 * Scraper adapter for ServiceFood New Zealand (servicefood.co.nz).
 *
 * Credentials required:
 *   - loginUrl   : ServiceFood login page, e.g. "https://www.servicefood.co.nz/login"
 *   - username   : Your ServiceFood account email / username
 *   - password   : Your ServiceFood account password
 *
 * Product URLs for scrapeProductPrice should be the full ServiceFood product
 * page URL, e.g. "https://www.servicefood.co.nz/products/12345".
 *
 * NOTE: CSS selectors were derived from the ServiceFood NZ website as of the
 * implementation date.  If ServiceFood updates their front-end the selectors
 * may need to be adjusted.
 */
export class ServiceFoodScraperAdapter extends ScraperAdapterBase {
  readonly adapterKey = "servicefood-nz";
  readonly displayName = "ServiceFood NZ";

  readonly credentialFields: ScraperAdapterCredentialField[] = [
    {
      key: "loginUrl",
      label: "Login URL",
      type: "url",
      required: true,
      placeholder: "https://www.servicefood.co.nz/login",
      hint: "Leave as default unless ServiceFood changes their login page URL.",
    },
    {
      key: "username",
      label: "Username / Email",
      type: "text",
      required: true,
      placeholder: "you@example.com",
    },
    {
      key: "password",
      label: "Password",
      type: "password",
      required: true,
    },
  ];

  // ── Internal: launch a logged-in browser context ──────────────────────────

  /**
   * Launches a Chromium browser, navigates to the login page, submits the
   * credentials and returns { browser, page } on success.
   *
   * The caller is responsible for calling `browser.close()`.
   */
  private async launchAndLogin(credentials: Record<string, string>) {
    const { loginUrl, username, password } = credentials;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
      await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

      // Fill in credentials — selectors match ServiceFood NZ login form
      await page.fill(
        'input[name="email"], input[name="Email"], input[type="email"], #email, #Email',
        username
      );
      await page.fill(
        'input[name="password"], input[name="Password"], input[type="password"], #password, #Password',
        password
      );
      await page.click(
        'button[type="submit"], input[type="submit"], .login-btn, .btn-login, [data-testid="login-submit"]'
      );

      // Wait for navigation after form submission
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });

      // Detect login failure: remaining on the login URL or error message visible
      const currentUrl = page.url();
      const isStillOnLogin =
        currentUrl.includes("/login") ||
        currentUrl.includes("/account/login") ||
        currentUrl.includes("/sign-in");
      const hasErrorMsg = await page
        .locator('.error, .alert-danger, .alert-error, [class*="error"], [class*="invalid"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (isStillOnLogin || hasErrorMsg) {
        await browser.close();
        return { browser: null, page: null, error: "Login failed — check username and password." };
      }

      return { browser, page, error: null };
    } catch (err) {
      await browser.close();
      return { browser: null, page: null, error: String(err) };
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async testLogin(
    credentials: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    if (!credentials.loginUrl || !credentials.username || !credentials.password) {
      return { ok: false, message: "loginUrl, username, and password are required." };
    }

    const { browser, error } = await this.launchAndLogin(credentials);
    if (error || !browser) {
      return { ok: false, message: error ?? "Unknown login error." };
    }
    await browser.close();
    return { ok: true, message: "Logged in to ServiceFood NZ successfully." };
  }

  async scrapeProductPrice(
    credentials: Record<string, string>,
    productUrl: string
  ): Promise<ScraperProductResult | null> {
    const { browser, page, error } = await this.launchAndLogin(credentials);
    if (error || !browser || !page) return null;

    try {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

      // ── Product name ────────────────────────────────────────────────────────
      const productName = await page
        .locator(
          'h1.product-title, h1.product-name, .product-detail h1, [data-testid="product-name"], h1'
        )
        .first()
        .innerText()
        .catch(() => null);

      if (!productName) return null;

      // ── Price ───────────────────────────────────────────────────────────────
      const priceRaw = await page
        .locator(
          '.product-price, .price, [data-testid="product-price"], .unit-price, ' +
          '[class*="price"]:not([class*="was"]):not([class*="original"])'
        )
        .first()
        .innerText()
        .catch(() => null);

      if (!priceRaw) return null;
      const purchasePrice = parsePrice(priceRaw);
      if (isNaN(purchasePrice) || purchasePrice <= 0) return null;

      // ── Package size / unit ─────────────────────────────────────────────────
      // Try to find a pack-size string such as "10 kg" or "1 each"
      const packRaw = await page
        .locator(
          '.pack-size, .product-pack, [data-testid="pack-size"], ' +
          '[class*="pack"], [class*="size"], .product-unit'
        )
        .first()
        .innerText()
        .catch(() => null);

      let purchaseQuantity = 1;
      let purchaseUnit: UnitType = UnitType.EACH;

      if (packRaw) {
        const match = packRaw.match(/([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)/);
        if (match) {
          purchaseQuantity = parseFloat(match[1]);
          purchaseUnit = inferUnit(match[2]);
        }
      }

      // ── Product code ────────────────────────────────────────────────────────
      const productCode = await page
        .locator(
          '[data-testid="product-code"], .product-code, .sku, [class*="sku"], [class*="product-code"]'
        )
        .first()
        .innerText()
        .catch(() => null);

      // ── Availability ────────────────────────────────────────────────────────
      const isUnavailable = await page
        .locator('.out-of-stock, [data-testid="out-of-stock"], [class*="unavailable"]')
        .first()
        .isVisible()
        .catch(() => false);

      return {
        productCode: productCode?.replace(/[^a-zA-Z0-9-_]/g, "").trim() ?? null,
        productName: productName.trim(),
        purchasePrice,
        purchaseQuantity,
        purchaseUnit,
        isAvailable: !isUnavailable,
        metadata: { sourceUrl: productUrl, rawPackSize: packRaw ?? undefined },
      };
    } catch {
      return null;
    } finally {
      await browser.close();
    }
  }

  async searchProducts(
    credentials: Record<string, string>,
    query: string,
    limit = 20
  ): Promise<ScraperProductResult[]> {
    const { browser, page, error } = await this.launchAndLogin(credentials);
    if (error || !browser || !page) return [];

    try {
      const baseUrl = new URL(credentials.loginUrl).origin;
      const searchUrl = `${baseUrl}/products?search=${encodeURIComponent(query)}`;

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

      // Wait for product listing to appear
      await page
        .waitForSelector(
          '.product-list-item, .product-card, [data-testid="product-card"], .product-item',
          { timeout: 15_000 }
        )
        .catch(() => null);

      // Collect product links from search results
      const productLinks = await page
        .locator(
          '.product-list-item a, .product-card a, [data-testid="product-card"] a, .product-item a'
        )
        .evaluateAll((anchors) =>
          (anchors as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean)
        );

      // Deduplicate and limit
      const uniqueLinks = [...new Set(productLinks)].slice(0, limit);

      // Scrape all product pages in parallel; ignore individual failures
      const settled = await Promise.allSettled(
        uniqueLinks.map((link) => this.scrapeProductPrice(credentials, link))
      );

      const results: ScraperProductResult[] = settled
        .filter(
          (r): r is PromiseFulfilledResult<ScraperProductResult> =>
            r.status === "fulfilled" && r.value !== null
        )
        .map((r) => r.value);

      return results;
    } catch {
      return [];
    } finally {
      await browser.close();
    }
  }
}
