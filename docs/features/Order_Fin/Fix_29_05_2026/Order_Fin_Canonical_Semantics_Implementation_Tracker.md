# Order Fin Canonical Semantics Implementation Tracker

## Overview
- Feature: Order Fin canonical semantics rollout
- Locked plan: `Order Fin Canonical Semantics Plan v4`
- Started: 2026-05-30
- Scope: `0333` additive schema, `0334` preview/repair/validation backfill, Prisma/constants/types updates, Order Fin service refactor, tests, and documentation refresh

## Progress

### Step 1. Progress tracker + migrations
- Status: Completed
- Completed:
  - Re-read `CLAUDE.md`, `AGENTS.md`, and the required implementation, database, backend, multitenancy, business-logic, testing, documentation, and code-documentation skills.
  - Re-audited the existing Order Fin write path, summary path, mapper, Prisma models, and relevant tests.
  - Drafted `0333_order_fin_canonical_columns_and_audit_fields.sql`.
  - Drafted `0334_order_fin_backfill_repair_and_validation.sql` with preview sections, conservative repair logic, uppercase payment-status normalization, one batch trace id per run, and rollback notes.
- Next:
  - Update Prisma schema and shared Order Fin constants/types for the canonical fields and warning/status model.
- Risks / notes:
  - Historical `org_order_payments_dtl.payment_status` values are mixed-case across the repo, so both SQL and service code must normalize with `UPPER(...)`.
  - Historical `payment_nature_snapshot` gaps must be handled conservatively; ambiguous rows must warn, not silently count as paid.

### Step 2. Prisma + constants/types
- Status: Completed
- Completed:
  - Added the canonical `org_orders_mst` fields to Prisma, while keeping `net_receivable_amount` explicitly marked as a temporary legacy bridge.
  - Added canonical Order Fin shared constants for snapshot statuses, warning codes, payment lifecycle status buckets, and the frozen AR receivable payment-type set.
  - Added shared Order Fin types for the persisted calculation snapshot payload and canonical header snapshot shape.
- Next:
  - Refactor the calculation, financial-write, summary, and mapper services to use the canonical semantics and explicit temporary fallback paths.
- Risks / notes:
  - `financial_snapshot_status` and warning-code semantics are now centralized, so the service refactor must import them instead of re-declaring local string enums.
  - The discovered AR receivable payment-type set is still intentionally narrow: `CREDIT_INVOICE` only.

### Step 3. Service and mapper refactor
- Status: Completed
- Completed:
  - Refactored `order-calculation.service.ts` so canonical internal sale semantics now expose `saleTotal`, while keeping `finalTotal` as a temporary compatibility alias at the request boundary.
  - Refactored `order-financial-write.service.ts` to persist lifecycle payment summaries, canonical refund splits, `net_collected_amount`, AR-only receivable sizing, conservative ambiguous-payment warnings, calculation snapshot JSON, stable hash, and batch trace id.
  - Refactored `order-financial-summary.service.ts` and the Order Details mapper/model/UI consumers to read canonical columns first and use explicit temporary legacy fallbacks only where the rollout still requires them.
  - Refactored `order-submit-orchestrator.service.ts` so the internal business concept now flows through canonical `saleTotal`, and mismatch reporting now also uses the canonical `saleTotal` key.
  - Updated request-side totals schemas to accept canonical `saleTotal` input and normalize it into the existing `finalTotal` shape for one transition release.
  - Refactored the active `payment-modal-v4.tsx` checkout flow so local total math, remaining-balance calculations, wallet caps, gift-card caps, and submit payload assembly now run on canonical `saleTotal`, while keeping only a preview-response fallback for legacy `finalTotal`.
  - Refactored the legacy modal variants `payment-modal-v3.tsx` and `payment-modal-enhanced-02.tsx` so their local checkout math now also runs on canonical `saleTotal`, while keeping only a preview-response fallback for legacy `finalTotal`.
  - Updated `use-order-submission.ts` so outgoing checkout payloads now send canonical `clientTotals.saleTotal` only.
  - Updated `process-payment.ts` so the server action now consumes normalized schema output and passes canonical `saleTotal` through to the payment service, leaving `finalTotal` as an input-boundary alias only.
  - Removed the remaining live `finalTotal` compatibility layer from the checkout contract: totals schemas now require canonical `saleTotal`, the calculation service no longer returns `finalTotal`, and all payment modal preview consumers now read `saleTotal` directly.
  - Updated the full order detail page serializer to hydrate legacy display fields such as VAT, promo, gift-card, service-charge, receivable, and settlement amounts from canonical `financialData` snapshot/tax/credit rows first.
  - Removed summary-side fallback math for legacy header totals and charges, so `order-financial-summary.service.ts` and `map-order-financial-summary-view.ts` now calculate from canonical snapshot fields first instead of falling back to `subtotal`, `total`, `service_charge`, or `net_receivable_amount`.
  - Reduced the raw snapshot/debug contract by removing temporary legacy alias fields such as `totalRefundedAmount`, `giftCardAppliedAmount`, `netReceivableAmount`, and `vatAmount`; the mapper now derives gift-card warning input from canonical `creditApplications` instead of a legacy header mirror.
  - Fixed the order edit/update path so recalculated legacy header totals now also trigger `recalculateOrderFinancialSnapshotTx`, preventing stale canonical snapshot fields after item or express edits.
  - Centralized AR receivable payment-type checks through `lib/constants/order-financial.ts`, freezing the approved set to `CREDIT_INVOICE` only.
  - Added explicit deprecated-fallback comments at mapper/service boundaries so the `0335` cleanup target is visible in code review.
- Next:
  - Finish the validation/documentation pass and keep wider reconciliation follow-up items listed for the later cleanup batch.
- Risks / notes:
  - The active checkout contract is now canonical on `saleTotal`; remaining cleanup is centered on legacy order-header field reads/writes rather than the old totals alias.
  - Legacy DB mirror writes still exist in create/update flows and the financial write path, but the summary/debug contract now exposes canonical refunded/AR values instead of the removed raw alias fields.

### Step 4. Tests
- Status: Completed
- Completed:
  - Extended `__tests__/services/order-calculation.service.test.ts` to assert canonical `saleTotal` behavior and gift-card/tax separation.
  - Extended `__tests__/features/orders/map-order-financial-summary-view.test.ts` to assert AR receivable precedence and `netCollectedAmount = totalPaidAmount - realPaymentRefundedAmount`.
  - Added mapper coverage for mixed-case `processing` and `authorized` payment rows so warning classification now matches the uppercase normalization rules enforced in `0334`.
  - Added schema coverage proving both `newOrderPaymentPayloadSchema` and `createWithPaymentRequestSchema` accept canonical `saleTotal` input and normalize it into `finalTotal`.
  - Updated mapper warning logic to normalize mixed/lowercase payment statuses before classifying pending and authorized payment warnings.
- Next:
  - Add broader write-service and reconciliation regression coverage in a later hardening batch.
- Risks / notes:
  - Current focused tests cover the newly changed canonical math and view logic, but they do not yet exhaust every reconciliation edge case from the long-term plan.

### Step 5. Validation + docs refresh
- Status: Completed
- Completed:
  - User confirmed `0333` and `0334` were applied successfully after the SQL fixes for UUID invoice aggregation and ambiguous legacy aliases.
  - Regenerated Prisma/client-backed types through the normal build flow.
  - Ran targeted Jest suites, `npm run typecheck`, `npm run build`, and `npm run lint`.
  - Added implementation notes documenting canonical semantics, validation evidence, temporary fallbacks, deferred cleanup items, and a dedicated legacy-field readiness audit.
  - Reduced the checkout naming gap by moving the active payment modal and submission hook onto canonical `saleTotal` math and canonical outbound totals payloads.
  - Reduced the gap further by moving the older modal variants onto canonical local `saleTotal` math as well, then removed the remaining preview-response fallbacks and totals-schema aliases so the active checkout contract no longer depends on `finalTotal`.
  - Re-ran hardening after the final cleanup pass: `process-payment.ts` now consumes normalized schema output, and the full-detail order page now serializes canonical financial values before rendering.
  - Added `web-admin/lib/utils/order-financial-snapshot.ts` so routes, pages, and services read canonical order snapshot columns first through one shared precedence helper.
  - Updated internal and public order routes/pages (`/api/v1/orders/[id]`, `/api/v1/orders/[id]/state`, `/api/v1/public/orders/[tenantId]/[orderNo]`, `/api/v1/public/customer/orders`, `/dashboard/orders/[id]`, `/dashboard/orders/[id]/full`, `/dashboard/ready`) to prefer canonical order snapshot columns over legacy header totals.
  - Hardened `payment-service.ts` so its active order-balance updates now size payment status/remaining amounts from canonical order totals and keep `total_paid_amount` / `outstanding_amount` mirrors aligned when the legacy service path still runs.
  - Promoted canonical `sale_total` into the `payment-service.ts` contract, keeping `final_total` only as a deprecated fallback bridge inside the service/input type.
  - Hardened `ar-invoice.service.ts` so order-linked invoice sizing and invoice-order linkage now prefer canonical order snapshot amounts (`total_amount`, `total_paid_amount`, `ar_receivable_amount`) instead of legacy order-header totals.
  - Removed the canonical writer’s `net_receivable_amount` mirror write, so new recalculations persist `ar_receivable_amount` only.
  - Added a non-transactional `recalculateOrderFinancialSnapshot(...)` wrapper and wired it into the legacy Supabase `createOrder` flow, so canonical snapshot columns are now refreshed before the order-create path returns.
  - Removed legacy `vat_amount` and `gift_card_applied_amount` mirror writes from `order-service.ts`; create/update flows now depend on canonical snapshot recalculation instead of pushing those deprecated header mirrors forward.
  - Refactored `order-financial-write.service.ts` so gift-card repair and warning detection now derive from canonical credit-application rows instead of `org_orders_mst.gift_card_applied_amount`.
  - Refactored `payment-service.ts:createInvoiceForOrder()` so invoice parity fields now use canonical service-charge, VAT-tax-row, and gift-card-credit aggregates instead of direct reads from legacy order-header mirrors.
  - Removed the remaining full-detail UI dependency on order-header `vat_amount`, `gift_card_applied_amount`, and `service_charge_type`; the screen now derives those displays from canonical tax/credit rows or drops the deprecated type-only row entirely.
  - Removed the remaining runtime `org_orders_mst` legacy field reads/writes from the older DAL, list APIs, preparation route, customer spend summaries, and dashboard revenue queries by switching those flows to canonical columns or canonical aliases backed by canonical columns.
  - Removed the remaining `promo_discount_amount` order-header mirror write and replaced the last full-detail promo fallback with canonical discount-row derivation only.
  - Drafted `0335_order_fin_legacy_field_drop.sql` as the deferred cleanup migration after the final repo search and validation evidence confirmed runtime readiness.
  - User confirmed `0335_order_fin_legacy_field_drop.sql` was applied successfully and DB-backed types were refreshed afterward.
  - Closed the final post-`0335` validation gap by updating the stale CHECK-leg schema test to use a non-past `checkDate`, matching the active validation rule already enforced by `paymentLegSchema`.
  - Removed the dropped legacy `org_orders_mst` financial fields from `web-admin/prisma/schema.prisma` and regenerated Prisma Client so the ORM model now matches the post-`0335` database contract.
  - Hardened `web-admin/lib/db/prisma.ts` so middleware setup safely defers in browser-like test environments without crashing on import-time property access.
  - Replaced the stale `__tests__/services/order-service.test.ts` suite with a current-surface version that covers the static `OrderService` methods still present today (`estimateReadyBy`, `splitOrder`, `createIssue`, `resolveIssue`, `getOrderHistory`).
  - Re-ran the post-`0335` gates successfully: targeted Jest suites, `npm run typecheck`, `npm run build`, and `npm run lint`.
- Next:
  - No further implementation steps remain in this rollout batch.
- Risks / notes:
  - `npm run lint` passes with existing repo-wide warnings only; no new lint errors were introduced by this rollout.
  - `next build` still reports its normal `Skipping validation of types` message, so `npm run typecheck` remains the authoritative TS validation step.
  - Finance-focused regression validation now also includes `__tests__/services/ar-invoice.service.test.ts`, which stayed green after the canonical receivable-sizing cleanup.
  - Remaining uses of names like `total`, `paid_amount`, or `subtotal` inside runtime payloads are now compatibility aliases backed by canonical columns, not direct dependencies on the dropped `org_orders_mst` fields.
  - The final post-apply test fix was in validation only; no runtime Order Fin semantics changed after `0335` was applied.

## Locked Decisions
- `org_orders_mst` remains a denormalized snapshot, not a ledger.
- `total_paid_amount` stays the only canonical DB paid-total column.
- `net_collected_amount = max(total_paid_amount - real_payment_refunded_amount, 0)`.
- `PAY_ON_COLLECTION` is never AR.
- AR payment type codes must be discovered first, then frozen in one constants file.
- Legacy fallback reads/writes must stay visibly temporary and deprecated until `0335`.

## Validation Gates
1. Create-only SQL migrations; do not execute them.
2. Targeted Jest suites.
3. `npm run check:i18n` only if labels/messages change.
4. `npm run build`.
5. Repo-wide legacy-field search before drafting `0335`.
