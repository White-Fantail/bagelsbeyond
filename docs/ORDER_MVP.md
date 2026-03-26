# Phase 6 — Customer Order MVP (예약 픽업 주문)

## Scope

This phase implements **Reservation Pickup Orders** for logged-in customers.

| Feature | Status |
|---|---|
| Product listing with options | ✅ |
| localStorage cart | ✅ |
| Checkout with server-side price recalculation | ✅ |
| Pickup date/time slot selection | ✅ |
| Order creation with snapshot storage | ✅ |
| Customer order history & detail | ✅ |
| Customer order cancellation (limited) | ✅ |
| Admin/Staff order list + status management | ✅ |
| `reservedQty` update on order create/cancel | ✅ |
| Auto payment / online payment | ❌ Out of scope |
| POS order push (Loyverse) | ❌ Out of scope (structure ready) |
| Real-time inventory decrement | ❌ Out of scope |
| Delivery orders | ❌ Out of scope |
| Guest checkout | ❌ Out of scope |
| Coupon / promotions | ❌ Out of scope |

---

## Page Routes

| Path | Access | Description |
|---|---|---|
| `/order` | Any logged-in user | Product listing |
| `/order/cart` | Any logged-in user | Cart review |
| `/order/checkout` | Any logged-in user | Checkout form |
| `/order/success/[orderNumber]` | Owner only | Order confirmation |
| `/account/orders` | Owner only | My order list |
| `/account/orders/[orderNumber]` | Owner only | My order detail + cancel |
| `/admin/orders` | STAFF or ADMIN | All orders list + filter |
| `/admin/orders/[orderNumber]` | STAFF or ADMIN | Order detail + status change |

---

## Cart / Checkout Flow

1. Customer browses `/order` — products fetched server-side (isActive=true)
2. Customer selects options and quantity → clicks "장바구니 담기"
3. Cart stored in `localStorage` under key `beyond_cart`
4. Customer reviews cart at `/order/cart`
5. Customer proceeds to `/order/checkout`:
   - Selects pickup date (min: next business day, Mon–Sat)
   - Selects pickup time slot (08:00–17:00 in 30-min increments)
   - Adds optional note
6. On submit, `createOrderAction` server action is called:
   - All product/option IDs are re-validated against DB
   - All prices are **recalculated server-side** (client values ignored)
   - Order + items + options are created in a DB transaction
   - `DailyInventory.reservedQty` is incremented per product per pickup date
7. On success → redirect to `/order/success/[orderNumber]` + cart cleared

---

## Server Recalculation Policy

**Client prices are never trusted.** At checkout:

- `unitPrice = Product.basePrice + sum(selected ProductOption.priceDelta)`
- `lineTotal = unitPrice × quantity` (rounded to 2 decimal places)
- `totalAmount = sum(lineTotal)` (no discount in this phase)
- All snapshots stored: `productNameSnapshot`, `unitPriceSnapshot`, `optionGroupNameSnapshot`, `optionNameSnapshot`, `priceDeltaSnapshot`

This ensures past orders remain accurate even if products/prices change later.

---

## Order Status Flow

```
DRAFT → PENDING → CONFIRMED → PREPARING → READY → COMPLETED
                                                  ↗
                          CANCELLED ←────────────
```

- **DRAFT**: Not yet submitted (unused in this phase)
- **PENDING**: Order submitted, awaiting staff confirmation
- **CONFIRMED**: Staff has confirmed the order
- **PREPARING**: Order is being prepared
- **READY**: Ready for customer pickup
- **COMPLETED**: Customer has picked up and paid
- **CANCELLED**: Order cancelled (by customer or staff)

### Transition Rules

- Staff/Admin: can move forward (PENDING→CONFIRMED→…) or cancel from any non-completed state
- Customer: can only cancel (PENDING or CONFIRMED), not within 2 hours of pickup time

---

## Cancellation Policy

### Customer cancellation
- Allowed when: `status === PENDING || status === CONFIRMED`
- Blocked when: pickup is within 2 hours of current time
- Action: sets `status = CANCELLED`, rolls back `DailyInventory.reservedQty`

### Admin/Staff cancellation
- Allowed from any status except COMPLETED or already CANCELLED
- Action: sets `status = CANCELLED`, rolls back `DailyInventory.reservedQty`

---

## reservedQty Reflection Policy

| Event | Action |
|---|---|
| Order created (PENDING) | `DailyInventory.reservedQty += item.quantity` per product per pickupDate |
| Order cancelled | `DailyInventory.reservedQty -= item.quantity` (minimum 0) per product per pickupDate |

- Only **main Product** quantities are reflected (not option-level items)
- If no `DailyInventory` exists for that product+date, it is **created** with `reservedQty = quantity`
- `isSoldOut` on `DailyInventory` can be set manually by admin to block further orders at the product listing UI level
- Full oversell prevention (atomic stock locking) is **not yet implemented** in this phase

---

## Access Control

| Action | Required Role |
|---|---|
| Browse products & place orders | Any authenticated user (CUSTOMER, STAFF, ADMIN) |
| View own orders | Authenticated user (own orders only — server enforced) |
| Cancel own order | Authenticated user (own orders only, conditions apply) |
| View all orders | STAFF or ADMIN |
| Change order status | STAFF or ADMIN |

Server validation is applied at every route and action — UI-level hiding alone is not relied upon.

---

## Pickup Slot Configuration

Time slots are defined as constants in `lib/order/pickup-slots.ts`:

```ts
export const PICKUP_TIME_SLOTS = ["08:00", "08:30", ..., "17:00"];
export const BUSINESS_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
```

To make slots admin-configurable in a future phase:
1. Add a `PickupSlotConfig` Prisma model
2. Replace the constants with a DB query in the checkout page
3. Add a `/admin/settings/pickup-slots` management UI

---

## POS Integration Readiness

- All orders created with `source = INTERNAL`
- `ExternalOrderMap` model is already in the schema and related to `Order`
- Admin order detail page includes a POS sync status placeholder
- `createOrderAction` is isolated — a future `pushOrderToPOS(orderId)` function can be called after order creation without modifying the core logic

---

## Local Setup

```bash
# Install dependencies
npm install

# Run DB migrations (no schema changes in this phase)
npx prisma migrate dev

# Seed sample products + inventory
npm run db:seed

# Start dev server
npm run dev
```

Test accounts (default password: `Dev@12345!`):
- `customer@example.com` (CUSTOMER) — place orders
- `staff@example.com` (STAFF) — manage orders
- `admin@example.com` (ADMIN) — full access

---

## Recommended Next Steps

1. **POS Order Push** — implement `pushOrderToPOS()` service that creates a Loyverse receipt after order confirmation, attaching the result to `ExternalOrderMap`
2. **Subscription Orders** — reuse the `Order` domain with `source = SUBSCRIPTION` and automated weekly order generation
3. **Online Payment Integration** — add Stripe or similar; set `paymentStatus = PAID` on webhook confirmation
