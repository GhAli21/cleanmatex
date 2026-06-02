# Order Fin Canonical Semantics Plan v4

## Summary
- Accepted and locked. This version incorporates the final six implementation constraints you provided.
- Rollout remains staged: `0333` additive schema, `0334` preview/repair/validation backfill, `0335` later legacy drop only after proof.
- `org_orders_mst` remains a denormalized snapshot; detail tables remain the recalculation source of truth.
- No compatibility SQL view unless later repo/report search proves it is necessary.
- Migrations are create-only for review and must not be executed by the agent.

## Key Changes
### 1. Schema and migration decisions
- `0333_order_fin_canonical_columns_and_audit_fields.sql` must add:
  - canonical totals and breakdowns,
  - lifecycle payment columns: `pending_payment_amount`, `authorized_payment_amount`, `failed_payment_amount`,
  - refund split columns: `real_payment_refunded_amount`, `stored_value_restored_amount`, `customer_credit_issued_amount`,
  - reopened-due columns: `refund_reopens_due_amount`, `credit_reversal_reopens_due_amount`, `credit_reversed_amount`,
  - trace/audit columns: `financial_calculation_snapshot`, `financial_calculation_hash`, `financial_calculation_trace_id`,
  - snapshot status columns and full column comments.
- `0334_order_fin_backfill_repair_and_validation.sql` must contain, in order:
  - preview SELECTs,
  - repair CTEs and UPDATEs,
  - post-repair validation SELECTs,
  - rollback notes comments.
- `0334` must be reviewable and re-runnable where practical:
  - no dropping legacy columns,
  - no overwriting legacy columns,
  - no blind gift-card repairs,
  - no trusting polluted legacy totals when detail rows exist.
- `0334` must use one batch trace id per migration run.
- `0335_order_fin_legacy_drop.sql` is blocked until tests, build, and repo-wide `rg` proof all pass.

### 2. Frozen semantic and classification rules
- `net_collected_amount = max(total_paid_amount - real_payment_refunded_amount, 0)` everywhere.
- Completed real-payment statuses are exactly `COMPLETED`, `CAPTURED`, `SETTLED` after uppercase normalization.
- Pending lifecycle statuses are `PENDING`, `PROCESSING`, `CAPTURE_PENDING`.
- Authorized lifecycle status is `AUTHORIZED`.
- Failed lifecycle statuses are `FAILED`, `CANCELLED`, `EXPIRED`, `VOIDED`, `REFUSED`, `REVERSED`.
- In `0334`, if `payment_status` values are historically lowercase or mixed-case, always classify with `UPPER(payment_status)`.
- If `payment_nature_snapshot` is null on historical `org_order_payments_dtl` rows, classify only rows that are clearly real payments from the available fields; otherwise do not count them into `total_paid_amount` and emit `PAYMENT_TARGET_UNCLASSIFIED`.
- Do not silently infer `B2B` or `INVOICE` AR payment type codes. Discover actual persisted codes first, then freeze the approved set in one constants file.
- `financial_calculation_hash` must exclude all volatile fields, including trace id, timestamps, random UUIDs, and batch ids.
- `PAY_ON_COLLECTION` is never AR.

### 3. Repo-specific implementation rules
- `org_order_payments_dtl` is still the order payment fact table, but historical rows with null or ambiguous nature/target classification must be handled conservatively and warned, not assumed safe.
- `org_order_credit_apps_dtl` has no `application_status` today. Current inclusion rule is:
  - `is_active = true`
  - `coalesce(rec_status, 1) = 1`
  - amount from `applied_amount`
- Document future enhancement:
  - if `application_status` is introduced later, canonical applied state must be `APPLIED`.
- `subtotal_amount` and `items_base_amount` are equal in current pricing mode only because extras are already embedded in line totals; document this in code, migration comments, and feature docs.
- Keep all legacy fallback paths visibly marked as temporary and deprecated in code comments, type comments, and mapper/service boundary notes.

### 4. Service and API refactor
- Refactor `order-calculation.service.ts` so internal canonical naming is `saleTotal`, with legacy `finalTotal` accepted only at boundaries for one transition release.
- Refactor `order-financial-write.service.ts` to calculate:
  - lifecycle payment summaries,
  - refund splits,
  - canonical outstanding,
  - AR-only receivable,
  - pay-on-collection amount,
  - warning-driven snapshot status,
  - stable hash payload,
  - JSONB calculation trace.
- Refactor `order-submit-orchestrator.service.ts` to centralize AR payment type checks through one constants file after repo discovery.
- Refactor `order-financial-summary.service.ts`, DTOs, mapper, and UI models to prefer canonical fields first and use legacy fallback only explicitly and temporarily.
- Keep `total_paid_amount` as the only DB paid column. Do not add `total_completed_payment_amount`.
- Add mandatory warning codes:
  - `ORDER_TOTAL_COMPONENT_MISMATCH`
  - `DISCOUNT_TOTAL_MISMATCH`
  - `TAX_TOTAL_MISMATCH`
  - `OUTSTANDING_MISMATCH`
  - `PENDING_PAYMENT_COUNTED_AS_PAID`
  - `AUTHORIZED_PAYMENT_COUNTED_AS_PAID`
  - `GIFT_CARD_DOUBLE_COUNTED`
  - `CREDIT_APPLICATION_COUNTED_AS_DISCOUNT`
  - `AR_RECEIVABLE_MISMATCH`
  - `TAX_DOCUMENT_TOTAL_MISMATCH`
  - `LEGACY_FIELD_USED_IN_SUMMARY`
  - `REFUND_SOURCE_UNCLASSIFIED`
  - `PAYMENT_TARGET_UNCLASSIFIED`

## Test Plan
- Extend existing calculation, mapper, settlement, reconciliation, and refund-related suites first.
- Required assertions:
  - gift card does not reduce `saleTotal` or `total_amount`,
  - gift card increases `total_credit_applied_amount` only,
  - only `COMPLETED`/`CAPTURED`/`SETTLED` raise `total_paid_amount`,
  - mixed/lowercase historical payment statuses are normalized with uppercase matching,
  - pending and authorized payments do not reduce outstanding,
  - failed payments do not reduce outstanding,
  - ambiguous historical payment rows emit `PAYMENT_TARGET_UNCLASSIFIED` and are excluded from paid totals,
  - `net_collected_amount` uses `real_payment_refunded_amount`, not `refunded_amount`,
  - AR receivable uses only discovered/frozen AR payment type codes,
  - `PAY_ON_COLLECTION` never creates AR receivable,
  - mapper prefers AR invoice outstanding when invoice exists,
  - `financial_snapshot_status = MISMATCH` when warnings exist,
  - legacy fields are used only in explicit temporary fallback paths.
- Validation order during implementation:
  1. targeted Jest suites,
  2. `npm run check:i18n` only if labels change,
  3. `npm run build`,
  4. repo-wide `rg` legacy-field search before drafting `0335`.

## Progress and Documentation
- After each implementation step, update the tracker in `docs/features/Order_Fin/Fix_29_05_2026/` with progress, risks, and next step.
- Final documentation step must use the documentation skill to update:
  - canonical glossary,
  - migration/backfill notes,
  - API/DTO naming map,
  - legacy-to-canonical matrix,
  - pending-work log,
  - validation evidence.
- Documentation must explicitly call out:
  - uppercase normalization in `0334`,
  - conservative handling of ambiguous historical payment rows,
  - final discovered AR payment code set,
  - deprecated fallback removal plan.

## Assumptions
- No third-party or `cmx-api` consumer was found for these order-financial fields, so this rollout can optimize for `web-admin`.
- Reopened-due columns are added now, but unless implementation finds explicit current business signals, their backfill stays `0` and the snapshot records that no reopen-due policy was inferred.
- Historical ambiguous payment rows are treated conservatively: exclude from paid totals, warn, and require later cleanup instead of silently guessing.
