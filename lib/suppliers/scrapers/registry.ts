import type { ScraperAdapterBase } from "./base";
import { DemoScraperAdapter } from "./demo";

// ─── Scraper adapter registry ─────────────────────────────────────────────────

/**
 * Add new scraper adapters here.  Each adapter is instantiated once and cached
 * for the lifetime of the process.
 *
 * Real Playwright-based adapters should extend ScraperAdapterBase and live in
 * this directory alongside demo.ts.  They are registered here just like the
 * demo adapter.
 */
const SCRAPERS: ScraperAdapterBase[] = [new DemoScraperAdapter()];

const registry = new Map<string, ScraperAdapterBase>(
  SCRAPERS.map((a) => [a.adapterKey, a])
);

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns all registered scraper adapters (for populating the UI dropdown). */
export function listScraperAdapters(): Array<{
  adapterKey: string;
  displayName: string;
}> {
  return SCRAPERS.map((a) => ({
    adapterKey: a.adapterKey,
    displayName: a.displayName,
  }));
}

/** Returns the scraper adapter for the given key, or null if not registered. */
export function getScraperAdapter(
  adapterKey: string
): ScraperAdapterBase | null {
  return registry.get(adapterKey) ?? null;
}
