# Order Fin Canonical Semantics Implementation Plan

## Summary
- Implement this as a staged semantic migration, not a rename-only refactor. `org_orders_mst` remains a denormalized snapshot; detail tables stay the financial source of truth.
- Use additive schema changes first, dual-read/write during refactor, then drop legacy fields only in a later cleanup migration after repo-wide search and validation.
- As of **May 30, 2026**, the next numeric migration is expected to start at `0333_...`.
- Do **not** create or apply migrations via MCP/CLI. Create SQL files only, stop for review, then proceed with code refactor after approval.
- Do **not** add a compatibility SQL view unless a later code search finds an actual external SQL/report consumer. Right now the repo evidence shows the impact is inside `web-admin`.

## Implementation Changes
### 1. Database and snapshot contract
- Create an additive migration `0333_order_fin_canonical_columns_and_comments.sql` to add the canonical snapshot columns on `public.org_orders_mst`, using `DECIMAL(19,4)` for money and `TEXT` for new string/code/status fields to match repo rules.
- Add these canonical columns now: `subtotal_amount`, `items_base_amount`, `total_amount`, `piece_extra_price_amount`, `preference_extra_price_amount`, `service_charge_amount`, `delivery_charge_amount`, `express_charge_amount`, `other_charges_amount`, `taxable_amount`, `refunded_amount`, `net_collected_amount`, `overpaid_amount`, `ar_receivable_amount`, `ar_invoice_id`, `ar_invoice_no`, `ar_invoice_status`, `tax_document_id`, `tax_document_no`, `tax_document_status`, `tax_document_type`, `financial_last_calculated_at`, `financial_last_calculated_by`, `financial_snapshot_status`, `financial_mismatch_warning_count`.
- Keep existing snapshot columns that are already canonical enough: `total_charges_amount`, `total_discount_amount`, `total_tax_amount`, `total_credit_applied_amount`, `total_paid_amount`, `outstanding_amount`, `pay_on_collection_amount`, `change_returned_amount`, `rounding_adjustment_amount`, `financial_engine_version`, `payment_status`.
- Do not rename/drop legacy columns in place. Keep `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `gift_card_applied_amount`, `promo_discount_amount`, `service_charge`, `service_charge_type`, `net_receivable_amount`, `vat_amount` temporarily for fallback only.
- Put full `COMMENT ON COLUMN` statements in the migration for every new canonical column and refresh comments for reused canonical columns where meaning has changed.
- Create a second migration `0334_order_fin_canonical_backfill_and_repair.sql` that recalculates canonical fields from detail rows and AR rows instead of trusting polluted header totals. Fold the gift-card repair logic forward from [0331_fix_gift_card_order_amount_semantics.sql](/f:/jhapp/cleanmatex/supabase/migrations/0331_fix_gift_card_order_amount_semantics.sql:1) so canonical backfill never derives `total_amount` from a header that netted gift card value.
- Backfill rules must be exact:
  - `total_amount` = commercial-sale total after discounts, tax, rounding; never net of credits/payments.
  - `net_collected_amount` = `total_paid_amount - refunded_amount`; do not include credits.
  - `outstanding_amount` = `total_amount - total_paid_amount - total_credit_applied_amount`, then adjusted only by refund reopen-due policy if applicable.
  - `overpaid_amount` = `max(total_paid_amount + total_credit_applied_amount - total_amount, 0)`.
  - `ar_receivable_amount` = `outstanding_amount` only for `CREDIT_INVOICE`/B2B/invoice-like settlement; otherwise `0`.
  - `pay_on_collection_amount` = `outstanding_amount` only for `PAY_ON_COLLECTION`; otherwise `0`.
- Plan a later cleanup migration only after code search passes and tests/build are green; that migration drops the legacy columns and removes fallback reads.

### 2. Prisma, constants, and service-layer semantics
- Update [web-admin/prisma/schema.prisma](/f:/jhapp/cleanmatex/web-admin/prisma/schema.prisma:890) to add the canonical fields and mark legacy fields with deprecation comments instead of removing them immediately.
- Extend [web-admin/lib/constants/order-financial.ts](/f:/jhapp/cleanmatex/web-admin/lib/constants/order-financial.ts:1) with canonical snapshot status constants and any new persisted code strings needed by the new columns.
- Update [web-admin/lib/types/order-financial.ts](/f:/jhapp/cleanmatex/web-admin/lib/types/order-financial.ts:1) and related DTO/view-model types so the canonical names are the primary names everywhere.
- Refactor [web-admin/lib/services/order-calculation.service.ts](/f:/jhapp/cleanmatex/web-admin/lib/services/order-calculation.service.ts:1) so `finalTotal` becomes internal `saleTotal`, while gift card remains stored-value settlement and never changes the sale/tax math. Keep temporary request alias support at the boundary for legacy callers.
- Refactor [web-admin/lib/services/order-submit-orchestrator.service.ts](/f:/jhapp/cleanmatex/web-admin/lib/services/order-submit-orchestrator.service.ts:1), [web-admin/lib/services/order-financial-write.service.ts](/f:/jhapp/cleanmatex/web-admin/lib/services/order-financial-write.service.ts:1), and [web-admin/lib/services/order-service.ts](/f:/jhapp/cleanmatex/web-admin/lib/services/order-service.ts:620) to write both canonical and legacy fields during transition, but calculate from canonical semantics only.
- Correct the hidden semantic bugs already visible in the repo:
  - `netCollectedAmount` must stop counting credits as cash.
  - `sumTaxableAmount` in the mapper must stop summing tax amounts as taxable base and instead use `taxable_amount`.
  - snapshot write logic must stop using `net_receivable_amount = totalAmount - credits`; use AR-only rules via `ar_receivable_amount`.
- Do not add a separate DB column named `total_completed_payment_amount`. Keep `total_paid_amount` in DB and use clearer TypeScript/API names only.

### 3. API, read models, UI, and compatibility
- Refactor [web-admin/lib/services/order-financial-summary.service.ts](/f:/jhapp/cleanmatex/web-admin/lib/services/order-financial-summary.service.ts:1), [web-admin/app/actions/orders/get-order-financial.ts](/f:/jhapp/cleanmatex/web-admin/app/actions/orders/get-order-financial.ts:1), and the `/financial-summary` route to expose canonical snapshot names first.
- Update [web-admin/src/features/orders/model/order-financial-summary-view.ts](/f:/jhapp/cleanmatex/web-admin/src/features/orders/model/order-financial-summary-view.ts:1) and [web-admin/src/features/orders/lib/map-order-financial-summary-view.ts](/f:/jhapp/cleanmatex/web-admin/src/features/orders/lib/map-order-financial-summary-view.ts:1) to use `arReceivableAmount` instead of `invoiceAmount`, keep user-facing labels like “Balance Due” where appropriate, and surface AR/tax-document links from the new denormalized fields.
- Use canonical read behavior in the mapper:
  - prefer canonical DB fields;
  - fall back to legacy fields only while the cleanup migration has not run;
  - emit warnings from `financial_snapshot_status` and mismatch counts where available.
- Refactor the payment modal family and request schemas under `web-admin/src/features/orders/ui/` plus [web-admin/lib/validations/new-order-payment-schemas.ts](/f:/jhapp/cleanmatex/web-admin/lib/validations/new-order-payment-schemas.ts:130) to normalize legacy payload names at the boundary.
- Compatibility rule:
  - accept legacy request names such as `finalTotal` and `giftCardApplied` for one transition release;
  - normalize immediately to canonical service variables;
  - remove those aliases only in the later legacy-cleanup phase after all internal call sites are migrated.
- Only add new i18n keys if the UI needs new labels/warnings/status text; if so, update both `messages/en.json` and `messages/ar.json`, then run `npm run check:i18n`.

### 4. Cleanup, documentation, and progress discipline
- After each execution step, update the implementation tracker in `docs/features/Order_Fin/Fix_29_05_2026/` with status, completed scope, open risks, and next actions. Treat this as mandatory progress logging, not optional notes.
- Refresh/create docs alongside the work:
  - canonical field glossary,
  - migration/backfill notes,
  - API/DTO naming map,
  - legacy-to-canonical rename matrix,
  - test evidence and rollback notes.
- Final documentation step must explicitly use the documentation skill to generate/update the feature implementation doc, pending-work doc, and any finance/order reference docs touched by this rollout.
- The later legacy-drop phase must include a repo-wide `rg` validation pass proving no live code still reads the dropped fields before the cleanup migration is written.

## Public Interfaces and Type Changes
- Canonical internal service names:
  - `saleTotal`
  - `totalCompletedPaymentAmount`
  - `totalCreditAppliedAmount`
  - `outstandingAmount`
  - `arReceivableAmount`
  - `totalCommercialDiscountAmount`
  - `totalTaxAmount`
- Canonical DB snapshot names:
  - keep `total_paid_amount`, `total_credit_applied_amount`, `outstanding_amount`
  - add `total_amount`, `subtotal_amount`, `items_base_amount`, `taxable_amount`, `refunded_amount`, `net_collected_amount`, `overpaid_amount`, `ar_receivable_amount`, and the AR/tax-doc/audit fields
- Canonical read-model/UI names:
  - replace `invoiceAmount` with `arReceivableAmount`
  - replace `netReceivableAmount` with `arReceivableAmount`
  - keep “Balance Due” as a label if it still means `outstandingAmount`
- Request compatibility:
  - checkout/request validators accept legacy aliases for one transition release, but internal service contracts become canonical immediately

## Test Plan
- Extend existing tests first, then add focused new suites where missing.
- Update [web-admin/__tests__/services/order-calculation.service.test.ts](/f:/jhapp/cleanmatex/web-admin/__tests__/services/order-calculation.service.test.ts:1) to assert `saleTotal` semantics, gift-card separation, tax independence, and canonical alias normalization.
- Extend [web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts](/f:/jhapp/cleanmatex/web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts:1) to cover:
  - `arReceivableAmount` precedence from AR invoice,
  - `taxableAmount`,
  - `netCollectedAmount = paid - refunded`,
  - `overpaidAmount`,
  - canonical fallback from legacy fields during transition.
- Add or extend service tests for snapshot write/recalc and settlement planning to cover:
  - gift card increases credits but does not reduce sale total,
  - outstanding formula,
  - AR-only receivable sizing,
  - pay-on-collection sizing,
  - refund reopening behavior,
  - mismatch status/warning count behavior.
- Extend reconciliation tests to assert canonical snapshot values and warning generation after the backfill/recalc changes.
- Run validation in this order for implementation:
  - targeted Jest suites for orders/settlement/reconciliation,
  - `npm run check:i18n` if keys change,
  - `npm run build`.
- Add one final repo-wide search gate before the legacy-drop migration:
  - no remaining live reads/writes of `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `gift_card_applied_amount`, `promo_discount_amount`, `service_charge`, `service_charge_type`, `net_receivable_amount` outside explicitly deprecated compatibility code.

## Assumptions and Defaults
- No third-party or `cmx-api` consumer of these order-financial fields was found in the current repo search, so the rollout can optimize for `web-admin` first.
- We will not change navigation, permissions, or feature flags in this batch unless later implementation introduces a new screen/action that truly requires them.
- We will not change the business meaning of existing detail tables; we are standardizing the snapshot and contracts around them.
- We will not normalize the broader historical `payment_status` lifecycle in this batch beyond what the snapshot writer and reader already require; that is adjacent cleanup, not the main scope.
- We will not execute migrations in this task; SQL files are create-only and reviewed before any run.
