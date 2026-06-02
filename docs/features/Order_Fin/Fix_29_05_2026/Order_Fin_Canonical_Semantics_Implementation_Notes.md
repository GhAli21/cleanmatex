# Order Fin Canonical Semantics Implementation Notes

## Overview
- Feature: Order Fin canonical semantics rollout
- Locked plan: `Order Fin Canonical Semantics Plan v4`
- Date: 2026-06-02
- Scope delivered in this batch:
  - additive schema via `0333_order_fin_canonical_columns_and_audit_fields.sql`
  - preview/repair/validation backfill via `0334_order_fin_backfill_repair_and_validation.sql`
  - legacy-field drop via applied `0335_order_fin_legacy_field_drop.sql`
  - Prisma/type/constants updates
  - write/read/mapper refactor for canonical header semantics
  - focused regression coverage and validation evidence

## Canonical decisions implemented
- `org_orders_mst` stays a denormalized snapshot; detail rows remain the recalculation source of truth.
- `net_collected_amount = max(total_paid_amount - real_payment_refunded_amount, 0)`.
- `PAY_ON_COLLECTION` never produces AR receivable.
- AR receivable payment-type set is frozen to `CREDIT_INVOICE` only in `web-admin/lib/constants/order-financial.ts`.
- Mixed/lowercase historical payment statuses are normalized with uppercase matching in the backfill and in summary-side warning logic.
- Historical payment rows with missing or ambiguous `payment_nature_snapshot` are handled conservatively and can emit `PAYMENT_TARGET_UNCLASSIFIED`.

## Implemented code areas
- `supabase/migrations/0333_order_fin_canonical_columns_and_audit_fields.sql`
  - Adds canonical totals, lifecycle payment fields, refund splits, reopened-due fields, AR/tax-document snapshot links, and calculation trace fields.
- `supabase/migrations/0334_order_fin_backfill_repair_and_validation.sql`
  - Uses preview sections, repair CTEs, post-validation queries, and rollback notes.
  - Uses one batch trace id per run.
  - Excludes volatile fields from `financial_calculation_hash`.
- `web-admin/prisma/schema.prisma`
  - Adds canonical `org_orders_mst` fields for the rollout phase.
  - After `0335` apply, the dropped legacy `org_orders_mst` financial fields were removed from the Prisma model so the ORM contract now matches the live database.
- `web-admin/lib/db/prisma.ts`
  - Import-time middleware flag checks now use a safe accessor so browser-like test environments can defer middleware setup instead of crashing on Prisma's browser bundle guards.
- `web-admin/__tests__/services/order-service.test.ts`
  - The stale instance-based suite was rewritten to the current static `OrderService` API and now validates `estimateReadyBy`, `splitOrder`, `createIssue`, `resolveIssue`, and `getOrderHistory`.
- `web-admin/lib/constants/order-financial.ts`
  - Adds canonical snapshot statuses, warning codes, lifecycle payment buckets, and frozen AR payment-type checks.
- `web-admin/lib/services/order-financial-write.service.ts`
  - Persists lifecycle amounts, canonical refund splits, warning-driven status, calculation snapshot JSON, stable hash, and batch trace id.
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
  - Uses canonical local `saleTotal` aliases internally and now emits canonical `saleTotal` mismatch reporting.
- `web-admin/lib/validations/new-order-payment-schemas.ts`
  - Uses canonical `saleTotal` as the only active totals contract for checkout and payment-boundary validation.
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx`
  - The active checkout modal now performs wallet caps, remaining-balance math, gift-card limits, outstanding-policy derivation, and submit payload assembly from canonical local `saleTotal`.
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`
  - The legacy v3 modal now performs partial-payment, split-leg, gift-card, and display-total math from canonical local `saleTotal`.
- `web-admin/src/features/orders/ui/payment-modal-enhanced-02.tsx`
  - The enhanced legacy modal now performs partial-payment, split-leg, gift-card, and display-total math from canonical local `saleTotal`.
- `web-admin/src/features/orders/hooks/use-order-submission.ts`
  - Emits canonical `clientTotals.saleTotal` only, so checkout payloads no longer mirror `finalTotal` back to the server.
- `web-admin/app/actions/payments/process-payment.ts`
  - Consumes canonical `saleTotal` directly, so the payment action no longer depends on the old `finalTotal` alias.
- `web-admin/lib/services/order-calculation.service.ts`
  - Returns canonical `saleTotal` only; the temporary `finalTotal` compatibility field has been removed from the calculation result shape.
- `web-admin/lib/services/order-financial-summary.service.ts`
  - Summary snapshot math no longer falls back to legacy header totals/charges such as `subtotal`, `total`, `service_charge`, or `net_receivable_amount`.
  - The raw snapshot contract now exposes canonical `refundedAmount` and `arReceivableAmount` directly instead of temporary alias fields like `totalRefundedAmount` and `netReceivableAmount`.
- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`
  - The mapper now derives summary amounts from canonical snapshot fields and no longer depends on legacy header fallback reads for service charge or receivable calculations.
  - Gift-card warning input is now derived from canonical `creditApplications` rows rather than `gift_card_applied_amount`.
- `web-admin/lib/services/order-service.ts`
  - Refreshes the canonical financial snapshot after order edits that recalculate totals, preventing stale `subtotal_amount` / `total_amount` / status fields after edit flows.
  - The legacy Supabase `createOrder` flow now also refreshes the canonical snapshot before returning, so later canonical readers no longer need order-header VAT/gift-card mirrors just to survive first-load timing.
  - No longer writes legacy `vat_amount` or `gift_card_applied_amount` mirrors during order creation/update.
- `web-admin/app/dashboard/orders/[id]/full/page.tsx`
  - Serializes full-detail order financial fields from canonical snapshot, tax rows, and credit-application rows first so the large legacy UI can render accurate values without reintroducing header drift.
  - No longer forwards order-header `vat_amount`, `gift_card_applied_amount`, or `service_charge_type` as required display inputs.
- `web-admin/lib/utils/order-financial-snapshot.ts`
  - Centralizes canonical-first order-header snapshot reads so routes, pages, and older services stop re-implementing different legacy fallback formulas.
  - No longer falls back to `net_receivable_amount`; AR display now expects canonical `ar_receivable_amount`.
- `web-admin/app/api/v1/orders/[id]/route.ts`
  - The order detail/edit API now serializes financial totals from canonical order snapshot columns first instead of reading `subtotal`, `discount`, `tax`, `total`, and `paid_amount` directly.
- `web-admin/app/api/v1/orders/[id]/state/route.ts`
  - Ready/handover payment-summary responses now derive total, paid, and remaining values from canonical order snapshot columns.
- `web-admin/app/api/v1/public/orders/[tenantId]/[orderNo]/route.ts`
  - Public order tracking totals now read canonical snapshot values first.
- `web-admin/app/api/v1/public/customer/orders/route.ts`
  - Public customer order-list totals now read canonical order totals first.
- `web-admin/app/api/v1/orders/route.ts`
  - Order-list responses now alias `subtotal_amount`, `total_tax_amount`, `total_amount`, and `total_paid_amount` into the existing list payload shape, removing direct DB dependence on `subtotal`, `tax`, `total`, and `paid_amount`.
- `web-admin/app/api/v1/preparation/route.ts`
  - Preparation-list responses now alias canonical order totals into the existing payload shape instead of selecting legacy order-header total fields.
- `web-admin/lib/db/orders.ts`
  - The older order DAL now seeds and recalculates canonical order-header fields (`subtotal_amount`, `items_base_amount`, `total_tax_amount`, `total_amount`, `total_paid_amount`, `outstanding_amount`) instead of writing the legacy sale/payment columns directly.
  - Compatibility aliases returned from the DAL are now derived from canonical columns only, so older callers can keep their object shape without keeping the dropped DB columns alive.
- `web-admin/lib/services/dashboard.service.ts`
  - Dashboard revenue queries now alias `total_amount` instead of selecting the legacy `total` column from `org_orders_mst`.
- `web-admin/lib/services/customers.service.ts`
  - Customer spend summaries now alias `total_amount` instead of selecting the legacy `total` column from `org_orders_mst`.
- `web-admin/app/dashboard/ready/page.tsx`
  - Ready-screen cards now use canonical total/outstanding values to normalize payment state.
- `web-admin/lib/services/payment-service.ts`
  - Legacy payment-service order balance updates now read canonical order totals first and mirror `total_paid_amount` / `outstanding_amount` when they mutate the order header.
  - Canonical `sale_total` is now the primary service input; `final_total` remains only as a deprecated fallback bridge inside the service/input type.
  - Invoice creation parity now derives service charge, VAT, and gift-card settlement values from canonical order snapshot/tax/credit data rather than direct legacy order-header mirrors.
- `web-admin/lib/services/ar-invoice.service.ts`
  - Order-linked AR invoice sizing and invoice-order linkage now prefer canonical order snapshot values (`total_amount`, `total_paid_amount`, `ar_receivable_amount`) over legacy order-header math.
- `web-admin/lib/services/order-financial-write.service.ts`
  - No longer writes the deprecated `net_receivable_amount` mirror during canonical snapshot recalculation; canonical persistence now relies on `ar_receivable_amount`.
  - No longer reads `gift_card_applied_amount` from the order header for repair/warning logic; canonical credit-application rows are now the source.
- `web-admin/lib/services/order-financial-summary.service.ts`
  - Prefers canonical columns first and uses documented temporary fallback reads only during the rollout window.
- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`
  - Uses canonical taxable/net-collected/AR-receivable semantics and centralized warning codes.
- `supabase/migrations/0335_order_fin_legacy_field_drop.sql`
  - Applied as the final cleanup migration to drop the retired `org_orders_mst` legacy financial mirrors after readiness validation and human review.

## Validation evidence
- User confirmation:
  - `0333` and `0334` were applied successfully after the SQL fixes.
  - `0335` was applied successfully after readiness review.
  - generated DB types were refreshed after migration apply.
- Automated checks run in `web-admin`:
  - `npm test -- --runTestsByPath __tests__/services/order-calculation.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts`
  - `npm test -- --runTestsByPath __tests__/services/order-calculation.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/validations/financial-schemas.test.ts`
  - `npm test -- --runTestsByPath __tests__/validations/financial-schemas.test.ts __tests__/validations/b2b-create-with-payment-schema.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/services/order-calculation.service.test.ts`
  - `npm test -- --runTestsByPath __tests__/services/order-calculation.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/validations/financial-schemas.test.ts __tests__/integration/checkout-multi-payment.test.ts __tests__/services/ar-invoice.service.test.ts`
  - `npm test -- --runTestsByPath __tests__/services/payment-service.test.ts __tests__/services/order-calculation.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/validations/financial-schemas.test.ts __tests__/integration/checkout-multi-payment.test.ts __tests__/services/ar-invoice.service.test.ts`
  - `npm test -- --runTestsByPath __tests__/services/ar-invoice.service.test.ts __tests__/services/payment-service.test.ts __tests__/services/order-calculation.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/validations/financial-schemas.test.ts __tests__/integration/checkout-multi-payment.test.ts`
  - `npm test -- --runTestsByPath __tests__/validations/financial-schemas.test.ts __tests__/validations/payment-leg-schema.test.ts`
  - `npm test -- --runTestsByPath __tests__/services/ar-invoice.service.test.ts __tests__/services/payment-service.test.ts __tests__/services/order-calculation.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/integration/checkout-multi-payment.test.ts`
  - `npm test -- --runTestsByPath __tests__/services/order-service.test.ts`
  - `npx prisma generate`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
- Result summary:
  - focused tests passed
  - typecheck passed
  - production build passed
  - lint passed with existing repo-wide warnings only and no new errors
  - the only post-`0335` regression was a stale validation test using a past-dated CHECK `checkDate`; it was aligned to the active schema rule and the post-apply test run is now green
  - the previously stale `order-service.test.ts` suite now passes after aligning it to the current static service surface and import-safe test environment

## Temporary compatibility and deprecated fallbacks
- Request/validation boundaries now use canonical `saleTotal` directly.
- Payment service boundaries now use canonical `sale_total` directly, with a deprecated `final_total` fallback kept only for transition safety.
- Submit-order mismatch payloads now use the canonical `saleTotal` key.
- All current payment modal variants now prefer canonical `saleTotal` locally and send canonical payload totals.
- The summary read path now uses canonical snapshot totals directly; the debug contract has also been reduced to canonical refunded and AR values instead of legacy raw aliases.
- `net_receivable_amount` remains a legacy fallback read path only; the canonical writer no longer mirrors new values into it.
- Order-header `vat_amount`, `gift_card_applied_amount`, and `service_charge_type` are no longer required by the active full-detail order UI.

## Legacy-drop readiness snapshot
- Readiness audit: `Order_Fin_Legacy_Field_Readiness_Audit.md`
- Current status:
  - runtime reads and writes now use canonical `org_orders_mst` financial columns or compatibility aliases backed by canonical columns
  - `0335_order_fin_legacy_field_drop.sql` has been applied successfully
  - remaining legacy names in runtime objects are compatibility aliases only; they no longer require the dropped DB columns to exist

## SQL fixes captured during implementation
- `0334` invoice aggregation was changed away from `MAX(uuid)` and now uses deterministic `DISTINCT ON` selection.
- `0334` repair CTE aliases were adjusted to avoid the ambiguous `legacy_total_amount` reference error.

## Deferred follow-up after `0335` apply
- Extend reconciliation and write-service regression coverage beyond the focused suites updated in this batch.
- Optionally rename remaining application-level compatibility aliases (`total`, `paid_amount`, `subtotal`, `tax`) in response/view-model contracts where downstream consumers can safely absorb a breaking rename.
