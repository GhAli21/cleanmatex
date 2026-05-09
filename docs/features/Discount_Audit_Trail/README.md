# Order Discount Audit Trail

**Feature:** `org_ord_discounts_dtl` — per-source discount line audit table  
**Implemented:** 2026-05-09  
**Migrations:** 0254 (table), 0255 (backfill)

## Overview

Each order may have up to N discount lines (one per source), stored in `org_ord_discounts_dtl`. Multiple rows of the same `source_type` are valid (stacking rules). Rows are never deleted — cancellations set `is_voided = true`.

## Source Types

| `source_type`   | Description |
|----------------|-------------|
| `MANUAL`        | Operator-entered flat or percentage discount |
| `DISCOUNT_RULE` | Applied by a discount rule (future: automated) |
| `PROMO_CODE`    | Customer promo code |
| `GIFT_CARD`     | Gift card redemption |

## DB Table: `org_ord_discounts_dtl`

- Tenant-scoped: composite FK `(order_id, tenant_org_id)` → `org_orders_mst`
- RLS: `current_tenant_id()` function (matches migration 0166 pattern)
- Index on `(tenant_org_id, order_id)`, `(tenant_org_id, source_type)`, `(tenant_org_id, order_id, source_type)`
- `applied_seq` — monotonically increasing per order across multiple insertion calls

## Insertion Points

| Flow | Module | Type |
|------|--------|------|
| create-with-payment | `app/api/v1/orders/create-with-payment/route.ts` | Prisma tx |
| OrderService.createOrder | `lib/services/order-service.ts` | Best-effort, no tx |
| Payment service (single invoice) | `lib/services/payment-service.ts` | Prisma tx |
| Payment service (FIFO) | `lib/services/payment-service.ts` | Prisma tx |

## Cancellation / Voiding

`voidDiscountLinesTx(tx, params)` sets `is_voided=true` on all active lines for the order. Called in `lib/services/order-cancel-service.ts` inside the cancel transaction.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/orders/[id]/discounts` | Client-side fetch for print pages |
| `GET /api/v1/orders/[id]/report/invoices-payments-rprt` | Includes `discountLines` in response |
| `GET /api/v1/orders/[id]/report/payments-rprt` | Includes `discountLines` in response |

## Client Modules

| File | Purpose |
|------|---------|
| `lib/db/order-discounts.ts` | Server-only DB functions (Prisma) |
| `lib/db/order-discounts-types.ts` | Client-safe types + `sourceLabel()` pure fn |
| `lib/constants/discount-source-type.ts` | `DISCOUNT_SOURCE_TYPE` and `DISCOUNT_CALC_TYPE` constants |

> **Important:** Client components (`'use client'`) must import `OrderDiscountLine` and `sourceLabel` from `order-discounts-types`, not from `order-discounts` (which pulls in server-side Prisma).

## UI Components

| Component | Location |
|-----------|----------|
| `OrderDiscountBreakdown` | `src/features/orders/ui/order-discount-breakdown.tsx` — order detail page |
| `OrderReceiptPrint` | `src/features/orders/ui/order-receipt-print.tsx` — thermal/A4 receipt |
| `OrderDetailsPrint` | `src/features/orders/ui/order-details-print.tsx` — A4 details print |

## i18n Keys Added

Under `orders.detail`:

```json
"discountBreakdown": "Discount Breakdown",
"discountManual": "Manual",
"discountRule": "Rule",
"discountPromo": "Promo",
"discountGiftCard": "Gift Card",
"discountTypePercent": "Percent",
"discountTypeFixed": "Fixed"
```

## Backfill (Migration 0255)

Backfills existing orders from `org_orders_mst` fields:

1. `MANUAL` — when `discount > 0` and no promo/gift card on the order  
2. `PROMO_CODE` — when `promo_discount_amount > 0`  
3. `GIFT_CARD` — when `gift_card_discount_amount > 0`  

Idempotent — skips orders/sources that already have a row. Orders with a manual discount AND promo/gift are not backfilled for the manual part (best-effort limitation noted in migration comments).

## Permissions

No new RBAC permissions required — discount audit lines are read-only for all roles that can view orders.
