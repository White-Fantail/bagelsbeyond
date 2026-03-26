# Modifier Sync Guide

This document explains the Loyverse Modifier sync architecture, why it works the way it does, and what operators can expect from the `/admin/modifiers` management screen.

---

## Why modifier options must be synced (not just groups)

Loyverse exposes modifiers as **groups** (e.g. "Bagel Type") each containing **options** (e.g. Plain, Sesame, Blueberry, Everything). The group name alone is not enough to:

- Track inventory per-option (e.g. how many Plain bagels are left today)
- Push orders back to Loyverse with the correct modifier IDs
- Enforce read-only protection on the exact names from the POS source

Syncing only groups but not options means:
- Inventory tracking is impossible (you don't know *which* option was ordered)
- Order push to Loyverse fails (modifier option IDs are unknown)
- Operators would need to manually re-enter every option name — error-prone

**The sync must capture group + all sub-options in a single pass.**

---

## Modifier as a shared inventory unit

Modifier options with `tracksInventory = true` represent **shared, cross-product inventory**.

Example: "Plain Bagel" is an option in the "Bagel Type" group. It may be used by:
- The *Classic Bagel* product
- The *Cream Cheese Bagel* product
- The *Bagel Sandwich* product

Because all these products draw from the same underlying bagel stock, reserving qty for any one of them must reduce the *same* `DailyOptionInventory` row. If inventory were tracked per-product, you'd need to manually coordinate three separate quantities — defeating the purpose.

**The `DailyOptionInventory` table has a unique constraint on `(optionId, date)` — one row per option per day regardless of how many products reference it.**

---

## Sync architecture

### Two-phase sync

| Phase | Trigger | What happens |
|-------|---------|--------------|
| **Full catalog sync** | `/admin/integrations/loyverse` → "카탈로그 sync" | Fetches all Loyverse items + modifiers. For each item, upserts Product + ProductOptionGroup + ProductOption + ExternalOptionGroupMap + ExternalOptionMap |
| **Modifier-only sync** | `/admin/modifiers` → "🔄 Loyverse Modifier 동기화" | Fetches modifiers only. Stores raw data in `LoyverseModifierSyncLog`. For groups that **already have** an `ExternalOptionGroupMap`, also upserts group names + options + ExternalOptionMap |

### What "modifier-only sync" does and does not do

**Does:**
- Refresh group names in case they were renamed in Loyverse
- Add/update options and their prices for already-mapped groups
- Create `ExternalOptionMap` records so each option has its Loyverse ID

**Does not:**
- Create new `ProductOptionGroup` records (requires a product to attach to)
- Create new `ExternalOptionGroupMap` records for groups that have never been seen before

New modifier groups first appear in the system when a full catalog sync runs (because groups must be attached to at least one product to exist in the internal schema).

---

## Read-only policy for Loyverse-synced fields

When a modifier group or option originates from Loyverse (`source = LOYVERSE`), the following fields are **overwritten on every sync** and therefore **must not be edited internally**:

| Field | Reason |
|-------|--------|
| `ProductOptionGroup.name` | Loyverse group name is the source of truth |
| `ProductOption.name` | Loyverse option name is the source of truth |
| `ProductOption.priceDelta` | Loyverse modifier price is the source of truth |
| `ExternalOptionGroupMap.externalOptionGroupId` | Immutable external identifier |
| `ExternalOptionMap.externalOptionId` | Immutable external identifier |

The UI enforces this:
- The `/admin/modifiers/[id]` edit form shows these fields as read-only text (not inputs)
- A "🔒 Loyverse 원본 (수정 불가)" badge is displayed
- The `PATCH /api/admin/modifiers/[id]` endpoint rejects attempts to update `name` or `priceDelta` for Loyverse-sourced options

**Editable internal fields (always safe to change):**

| Field | Purpose |
|-------|---------|
| `tracksInventory` | Whether to track daily option inventory for this option |
| `isActive` | Show/hide from ordering UI |
| `sortOrder` | Display order within the group |
| `sku` | Internal SKU / reference code |

---

## `/admin/modifiers` management screen

The Modifier management screen is the single place to:

1. **See all modifier groups and their options** — groups are shown with expandable rows. Click any group row or the ▶ button to reveal its options.
2. **Check sync status** — each group shows its Loyverse mapping (external group ID + last sync timestamp).
3. **Check inventory status** — options with `tracksInventory = true` show today's `reservedQty` and `isSoldOut` inline.
4. **Jump to inventory management** — click "재고 →" next to any tracked option, or the "재고 관리 →" button in the header.
5. **Trigger a modifier refresh** — the sync button re-fetches Loyverse modifiers and updates known groups + options.
6. **Filter/search** — URL-query-param-based filters survive page refresh.

### Filters available

| Filter | Description |
|--------|-------------|
| 이름 검색 | Searches option names (substring, case-insensitive) |
| 그룹 | Narrow to a specific modifier group |
| 출처 | `LOYVERSE` / `내부` / `ALL` |
| 재고추적 | `YES` / `NO` / `ALL` |
| 활성 | `ACTIVE` / `INACTIVE` / `ALL` |

---

## Shared modifier inventory — visual summary

```
Bagel Type (modifier group)
├── Plain Bagel      ← tracksInventory = true → DailyOptionInventory (optionId=plain, date=today)
├── Sesame Bagel     ← tracksInventory = true → DailyOptionInventory (optionId=sesame, date=today)
├── Blueberry Bagel  ← tracksInventory = true → DailyOptionInventory ...
└── Everything Bagel ← tracksInventory = true → DailyOptionInventory ...

Products using "Bagel Type":
  - Classic Bagel           ──┐
  - Cream Cheese Bagel      ──┤── all draw from the SAME DailyOptionInventory rows
  - Bagel Sandwich          ──┘
```

Reserving qty for "Plain Bagel" in a *Classic Bagel* order and in a *Cream Cheese Bagel* order both increment the **same** `DailyOptionInventory.reservedQty` row. Inventory is tracked at the option level, not per product.

---

## Current implementation scope

- [x] Full catalog sync upserts ProductOptionGroup + ProductOption + ExternalOptionGroupMap + ExternalOptionMap
- [x] Modifier-only sync updates known groups/options and creates ExternalOptionMap records
- [x] `/admin/modifiers` shows group-first view with expandable option rows
- [x] Source badges (Loyverse / 내부) shown at group and option level
- [x] tracksInventory badge + today's inventory status shown per option
- [x] Read-only enforcement for Loyverse-sourced fields (UI + API)
- [x] Modifier refresh button shows Loyverse count + internal DB update count

## Remaining improvement points

1. **New modifier groups not yet attached to any product** — currently these only appear after a full catalog sync. A dedicated "import standalone modifier group" flow (choosing which product to attach to) would let operators bring in new Loyverse groups without waiting for a product sync.

2. **Sold-out override per option** — allow operators to manually mark an option as sold out (without touching DailyOptionInventory) for fast response to unexpected stockouts.

3. **Modifier group → Product assignment UI** — a screen to add/remove a modifier group from additional products (via ProductOptionGroupAssignment) without re-running a full sync.
