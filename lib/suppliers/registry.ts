import type { SupplierAdapterBase } from "./adapters/base";
import { DemoSupplierAdapter } from "./adapters/demo";

// ─── Adapter registry ─────────────────────────────────────────────────────────

/**
 * Add new adapters here.  Each adapter is instantiated once and cached for the
 * lifetime of the process.
 */
const ADAPTERS: SupplierAdapterBase[] = [new DemoSupplierAdapter()];

const registry = new Map<string, SupplierAdapterBase>(
  ADAPTERS.map((a) => [a.adapterKey, a])
);

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns all registered adapters (for populating the UI dropdown). */
export function listAdapters(): Array<{
  adapterKey: string;
  displayName: string;
}> {
  return ADAPTERS.map((a) => ({
    adapterKey: a.adapterKey,
    displayName: a.displayName,
  }));
}

/** Returns the adapter for the given key, or null if not registered. */
export function getAdapter(adapterKey: string): SupplierAdapterBase | null {
  return registry.get(adapterKey) ?? null;
}
