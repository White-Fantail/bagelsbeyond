/**
 * Loyverse Catalog Sync Orchestration
 *
 * Combines Phase A (mirror sync) and Phase B (canonical auto-mapping)
 * into a single idempotent operation.
 *
 * Usage:
 *   const summary = await syncAndAutoMapLoyverseCatalog(adapter);
 */

import type { LoyverseAdapter } from "../adapters/pos/loyverse";
import { syncLoyverseCatalog, type MirrorSyncSummary } from "./catalog-sync";
import { autoMapLoyverseCatalogToCanonical, type CanonicalMappingSummary } from "../../catalog/auto-map-loyverse";

export interface CatalogSyncOrchestrationResult {
  mirror_sync_summary: MirrorSyncSummary;
  canonical_mapping_summary: CanonicalMappingSummary;
  warnings: string[];
  errors: string[];
}

export async function syncAndAutoMapLoyverseCatalog(
  adapter: LoyverseAdapter
): Promise<CatalogSyncOrchestrationResult> {
  const errors: string[] = [];

  // Phase A — mirror sync
  let mirrorSummary: MirrorSyncSummary;
  try {
    mirrorSummary = await syncLoyverseCatalog(adapter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Mirror sync failed: ${msg}`);
    mirrorSummary = {
      categories_upserted: 0,
      modifier_groups_upserted: 0,
      modifier_options_upserted: 0,
      payment_types_upserted: 0,
      items_upserted: 0,
      variants_upserted: 0,
      component_links_synced: 0,
      item_tax_links_synced: 0,
      item_modifier_links_synced: 0,
      variant_store_rows_synced: 0,
      warnings: [],
      errors: [msg],
    };
  }

  // Phase B — auto-map to canonical
  let canonicalSummary: CanonicalMappingSummary;
  try {
    canonicalSummary = await autoMapLoyverseCatalogToCanonical();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Canonical auto-map failed: ${msg}`);
    canonicalSummary = {
      categories_mapped: 0,
      modifier_groups_mapped: 0,
      modifier_options_mapped: 0,
      items_mapped: 0,
      variants_mapped: 0,
      item_modifier_group_links_created: 0,
      warnings: [],
    };
  }

  return {
    mirror_sync_summary: mirrorSummary,
    canonical_mapping_summary: canonicalSummary,
    warnings: [...mirrorSummary.warnings, ...canonicalSummary.warnings],
    errors: [...(mirrorSummary.errors ?? []), ...errors],
  };
}
