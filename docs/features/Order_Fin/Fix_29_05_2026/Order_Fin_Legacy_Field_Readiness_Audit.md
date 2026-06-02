# Order Fin Legacy Field Readiness Audit

## Purpose
- Capture the remaining live usage of legacy Order Fin names and fields around the `0335` legacy-drop phase.
- Record the readiness outcome and the final post-apply status.

## Audit date
- 2026-06-02

## Audit scope
- `web-admin/lib/services`
- `web-admin/lib/validations`
- `web-admin/src/features/orders`
- `web-admin/app` order-fin consumers
- focused tests tied to the canonical rollout

## Findings

### 1. Intentional temporary compatibility bridges
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
  - uses canonical local `saleTotal` variables internally
  - now emits mismatch payloads on the canonical `saleTotal` key
- `web-admin/app/actions/payments/process-payment.ts`
  - now passes canonical `saleTotal` directly into the payment service
- `web-admin/lib/services/order-financial-summary.service.ts`
  - canonical snapshot math no longer falls back to `subtotal`, `total`, `service_charge`, or `net_receivable_amount`
  - raw snapshot/debug output now exposes canonical refunded and AR values instead of temporary alias fields such as `totalRefundedAmount` and `netReceivableAmount`
- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`
  - canonical summary mapping no longer falls back to legacy header service-charge or receivable values
  - now derives gift-card mismatch warnings from canonical `creditApplications` rows instead of a legacy snapshot alias

### 2. Checkout totals contract status
- `finalTotal` is no longer an active checkout contract blocker.
- Current pattern:
  - all current modal variants now prefer canonical local `saleTotal`
  - outbound checkout payloads now send canonical totals only
  - calculation, submit-order, and process-payment paths now operate on canonical `saleTotal`

### 3. Legacy mirror writes still intentionally present
- `web-admin/lib/services/order-service.ts`
  - create/update flows now write canonical order-header fields instead of the dropped legacy sale/payment columns
- `web-admin/lib/services/order-financial-write.service.ts`
  - no longer reads `gift_card_applied_amount`; canonical credit-application rows now drive gift-card repair/warning logic
  - no longer persists `net_receivable_amount`
- Important fix completed in this batch:
  - order edits that recalculate totals now also trigger `recalculateOrderFinancialSnapshotTx`
  - this removes stale canonical snapshot drift from the edit flow
  - the legacy Supabase `createOrder` flow now also refreshes the canonical snapshot before returning
- `web-admin/app/dashboard/orders/[id]/full/page.tsx`
  - now serializes VAT, promo, gift-card, service-charge, receivable, and settlement values from canonical financial rows first
  - no longer needs order-header `vat_amount`, `gift_card_applied_amount`, or `service_charge_type`
- `web-admin/app/dashboard/orders/[id]/page.tsx`
  - now prefers canonical snapshot fields for subtotal, discount, tax, total, paid, pay-on-collection, service-charge, and receivable values
  - still serializes compatibility aliases for the current client contract, but those aliases now come from canonical snapshot/tax/credit data
- `web-admin/app/api/v1/orders/route.ts`
  - now aliases canonical snapshot columns into the legacy list payload shape instead of selecting dropped DB columns directly
- `web-admin/app/api/v1/preparation/route.ts`
  - now aliases canonical snapshot columns into the preparation-list payload shape instead of selecting dropped DB columns directly
- `web-admin/lib/db/orders.ts`
  - older DAL helpers now write canonical snapshot columns and return compatibility aliases derived from canonical values only
- `web-admin/lib/services/dashboard.service.ts`
  - now aliases `total_amount` for dashboard revenue aggregation instead of selecting legacy `total`
- `web-admin/lib/services/customers.service.ts`
  - now aliases `total_amount` for customer spend summaries instead of selecting legacy `total`
- `web-admin/lib/services/payment-service.ts`
  - no longer sizes active order payment status and remaining balances from raw `order.total` / `order.paid_amount`
  - now prefers canonical `sale_total`; `final_total` survives only as a deprecated fallback bridge inside the service/input type
  - invoice creation parity now derives service charge, VAT, and gift-card settlement values from canonical order snapshot/tax/credit data instead of legacy order-header mirrors
- `web-admin/lib/services/ar-invoice.service.ts`
  - no longer sizes order-linked AR receivables from raw `order.total` / `order.paid_amount` / `order.outstanding_amount`
  - still keeps parity-oriented invoice header fields such as `gift_card_applied_amount` for reporting compatibility
- `web-admin/app/api/v1/orders/[id]/route.ts`
  - now serializes canonical order totals first
- `web-admin/app/api/v1/orders/[id]/state/route.ts`
  - now serializes canonical payment summary totals first
- `web-admin/app/api/v1/public/orders/[tenantId]/[orderNo]/route.ts`
  - now serializes canonical order totals first
- `web-admin/app/api/v1/public/customer/orders/route.ts`
  - now serializes canonical order-list totals first
- `web-admin/app/dashboard/ready/page.tsx`
  - now derives displayed total and remaining values from canonical order snapshot columns

### 4. Readiness outcome
- Repo search, targeted tests, typecheck, build, and lint evidence now support drafting `0335`.
- Remaining runtime names such as `total`, `paid_amount`, `subtotal`, and `tax` are compatibility aliases backed by canonical columns, not direct dependencies on the dropped `org_orders_mst` fields.
- The drafted cleanup migration is:
  - `supabase/migrations/0335_order_fin_legacy_field_drop.sql`

## Safe-to-drop status
- `0335` readiness: `YES`

## Post-apply status
- `0335` has been applied successfully.
- DB-backed types were regenerated after apply.
- Post-apply validation is green:
  - targeted Jest suites
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
- The only post-apply gap was a stale validation test that still used a past-dated CHECK `checkDate`; the test was updated to match the active schema rule and the suite is now green.

## Final status
- Legacy-drop rollout status: `COMPLETE`
- Remaining legacy names in runtime objects are compatibility aliases only; they no longer rely on the dropped `org_orders_mst` columns.
