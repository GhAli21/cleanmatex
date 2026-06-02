# Order Fin Canonical Semantics Plan v2

## Summary
- This replaces `Order_Fin_Names_Fix_PLAN.md` and incorporates `CleanMateX_Order_Fin_Latest_Design_Addendum_For_Codex_v1_0.md`.
- Implement this as a staged semantic migration: additive schema first, deterministic backfill/repair second, code refactor with dual-read/write third, legacy drop only after repo-wide proof.
- Use `0333_order_fin_canonical_columns_and_audit_fields.sql` for all additive snapshot fields and comments, `0334_order_fin_backfill_repair_and_validation.sql` for preview/repair/validation, and reserve `0335_order_fin_legacy_field_drop.sql` for the later cleanup phase only.
- `org_orders_mst` remains a denormalized financial snapshot. Detail tables remain the source of truth for recalculation, reconciliation, and repair.
- No compatibility SQL view will be created unless a later repo/report search proves an external SQL consumer cannot be migrated quickly.

## Schema and Migration Design
### 0333 additive schema
- Add these canonical core fields now: `subtotal_amount`, `items_base_amount`, `total_amount`, `piece_extra_price_amount`, `preference_extra_price_amount`, `service_charge_amount`, `delivery_charge_amount`, `express_charge_amount`, `other_charges_amount`, `taxable_amount`, `refunded_amount`, `net_collected_amount`, `overpaid_amount`, `ar_receivable_amount`, `ar_invoice_id`, `ar_invoice_no`, `ar_invoice_status`, `tax_document_id`, `tax_document_no`, `tax_document_status`, `tax_document_type`, `financial_last_calculated_at`, `financial_last_calculated_by`, `financial_snapshot_status`, `financial_mismatch_warning_count`.
- Add lifecycle summary fields in the same migration: `pending_payment_amount`, `authorized_payment_amount`, `failed_payment_amount`.
- Add refund split fields in the same migration: `real_payment_refunded_amount`, `stored_value_restored_amount`, `customer_credit_issued_amount`.
- Add reopened-due fields in the same migration with `default 0`: `refund_reopens_due_amount`, `credit_reversal_reopens_due_amount`, `credit_reversed_amount`.
- Add audit/trace fields in the same migration: `financial_calculation_snapshot jsonb`, `financial_calculation_hash text`, `financial_calculation_trace_id uuid`.
- Keep existing useful snapshot fields: `total_charges_amount`, `total_discount_amount`, `total_tax_amount`, `total_credit_applied_amount`, `total_paid_amount`, `outstanding_amount`, `pay_on_collection_amount`, `change_returned_amount`, `rounding_adjustment_amount`, `financial_engine_version`, `payment_status`.
- Keep legacy fields for one transition release only: `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `gift_card_applied_amount`, `promo_discount_amount`, `service_charge`, `service_charge_type`, `net_receivable_amount`, `vat_amount`.
- Use full `COMMENT ON COLUMN` coverage for every new field and refresh comments on reused snapshot fields whose meaning is now stricter.
- `subtotal_amount` and `items_base_amount` will both be written in current pricing mode, with explicit comments/docs that they are equal today only because extras are already embedded in line totals.

### 0334 backfill and repair
- Structure the migration in this exact order: preview SELECTs, repair CTEs/UPDATEs, post-repair validation SELECTs, rollback notes comments.
- Derive `total_amount` from detail rows first: item totals plus charge totals minus discount totals plus tax totals plus rounding. Use legacy header fields only as a last fallback when the row is provably unpolluted.
- Fold the 0331 gift-card semantic repair into 0334 logic so gift-card orders never backfill `total_amount` from a legacy total that netted stored value.
- Backfill `pending_payment_amount` from `org_order_payments_dtl` statuses normalized to uppercase in `('PENDING','PROCESSING','CAPTURE_PENDING')`.
- Backfill `authorized_payment_amount` from statuses normalized to uppercase in `('AUTHORIZED')`.
- Backfill `failed_payment_amount` from statuses normalized to uppercase in `('FAILED','CANCELLED','EXPIRED','VOIDED','REFUSED','REVERSED')`.
- Backfill `total_paid_amount` from completed/captured/settled real-payment rows only; do not count credit applications.
- Backfill `total_credit_applied_amount` from active credit application rows only.
- Backfill refund split fields with deterministic classification only:
  - `real_payment_refunded_amount`: processed refunds linked to an original real-payment row, or refund methods `CASH` / `ORIGINAL_METHOD` where the source is a real payment.
  - `stored_value_restored_amount`: processed refunds tied to wallet/stored-value restoration, including refunds with `refund_method_code = 'WALLET'` or metadata/original credit application showing stored-value restoration.
  - `customer_credit_issued_amount`: processed refunds with `refund_method_code = 'CREDIT_NOTE'` or source lineage that resolves to customer-credit issuance.
- Backfill `refunded_amount` as the total processed refund amount across all refund destinations.
- Backfill reopened-due fields as zero in this batch unless a refund or reversal row explicitly proves reopen-due behavior. Current business behavior in this repo does not justify inferred reopen-due amounts.
- Compute `net_collected_amount` as `max(total_paid_amount - real_payment_refunded_amount, 0)`.
- Compute `outstanding_amount` as `max(total_amount - total_paid_amount - total_credit_applied_amount + refund_reopens_due_amount + credit_reversal_reopens_due_amount, 0)`.
- Compute `overpaid_amount` as `max(total_paid_amount + total_credit_applied_amount - total_amount, 0)`.
- Compute `ar_receivable_amount` only for receivable payment types. In this batch the allowed set is `CREDIT_INVOICE` plus any repo-confirmed B2B/invoice-equivalent codes discovered during implementation; otherwise `0`.
- Compute `pay_on_collection_amount` only when `payment_type_code = 'PAY_ON_COLLECTION'`; otherwise `0`.
- Populate `financial_calculation_snapshot` with a versioned JSON object containing engine version, source totals, derived totals, warning codes, fallback usage flags, and lineage notes.
- Populate `financial_calculation_hash` from a stable canonical JSON serialization of the snapshot payload.
- Populate `financial_calculation_trace_id` with a fresh UUID per recalculation batch/write.
- Set `financial_snapshot_status` as:
  - `CURRENT` when no warnings and no fallback ambiguity exist.
  - `MISMATCH` when warning/error reconciliation findings exist.
  - `RECALCULATION_REQUIRED` when legacy fallback or unclassified refund lineage is used.
  - `STALE` and `LOCKED` remain reserved but are not set automatically in this batch.
- 0335 will only be written after search, tests, and build prove no active reads/writes remain for the legacy fields.

## Service, API, and UI Refactor
### Calculation and write path
- Refactor `web-admin/lib/services/order-calculation.service.ts` so the internal canonical concept is `saleTotal`; keep request alias support for `finalTotal` at the boundary for one transition release.
- Keep gift card as stored-value settlement only. It must never reduce `saleTotal`, `total_amount`, `taxable_amount`, or `total_tax_amount`.
- Refactor `web-admin/lib/services/order-submit-orchestrator.service.ts` to use canonical variable names: `saleTotal`, `totalCompletedPaymentAmount`, `totalCreditAppliedAmount`, `settlementOutstandingAmount`, `arReceivableAmount`, `payOnCollectionAmount`.
- Refactor `web-admin/lib/services/order-financial-write.service.ts` to aggregate payment lifecycle amounts and canonical refund splits from fact rows, then persist both canonical fields and temporary legacy mirrors.
- Refactor `web-admin/lib/services/order-service.ts` so newly created/updated orders write canonical fields as primary and legacy fields as compatibility mirrors only during the transition window.

### Read models and compatibility
- Refactor `web-admin/lib/services/order-financial-summary.service.ts` to read canonical columns first and use legacy fields only as temporary fallback.
- Refactor `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts` and related models so `invoiceAmount` becomes `arReceivableAmount`, `netReceivableAmount` becomes `arReceivableAmount`, and `taxableAmount` comes from `taxable_amount` instead of summing tax lines.
- Keep user-facing labels like “Balance Due” when they still mean `outstandingAmount`; only internal/API/type names become canonical.
- Refactor request schemas and payment modals to accept legacy names like `finalTotal` and `giftCardApplied` for one transition release, normalize immediately to canonical names, and remove aliases only during the later legacy-drop phase.
- Do not add any DB column named `total_completed_payment_amount`. DB stays on `total_paid_amount`; TypeScript/API may expose `totalCompletedPaymentAmount`.

### Reconciliation and warnings
- Implement at least these warning codes in the financial snapshot/reconciliation path: `ORDER_TOTAL_COMPONENT_MISMATCH`, `DISCOUNT_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`, `OUTSTANDING_MISMATCH`, `PENDING_PAYMENT_COUNTED_AS_PAID`, `AUTHORIZED_PAYMENT_COUNTED_AS_PAID`, `GIFT_CARD_DOUBLE_COUNTED`, `CREDIT_APPLICATION_COUNTED_AS_DISCOUNT`, `AR_RECEIVABLE_MISMATCH`, `TAX_DOCUMENT_TOTAL_MISMATCH`, `LEGACY_FIELD_USED_IN_SUMMARY`.
- Add one implementation warning for conservative backfill safety: `REFUND_SOURCE_UNCLASSIFIED`.
- Warning codes must update `financial_snapshot_status`, `financial_mismatch_warning_count`, and `financial_calculation_snapshot.warnings`.

## Validation, Progress Tracking, and Documentation
- After each implementation step, update the feature progress tracker in `docs/features/Order_Fin/Fix_29_05_2026/` with status, completed work, open risks, and next step.
- The execution order must be:
  1. Create 0333 additive schema and comments.
  2. Update Prisma schema with canonical fields and deprecation comments.
  3. Create 0334 preview/repair/validation migration.
  4. Refactor calculation service.
  5. Refactor orchestrator and snapshot writer.
  6. Refactor order service and read-model services.
  7. Refactor DTOs, mapper, and UI consumers.
  8. Implement reconciliation warning generation.
  9. Update tests.
  10. Run targeted Jest suites.
  11. Run `npm run check:i18n` only if labels change.
  12. Run `npm run build`.
  13. Perform repo-wide search for legacy field usage.
  14. Only then draft 0335 legacy-drop migration.
- Extend existing test suites first, especially the calculation, settlement planner, settlement service, mapper, reconciliation, and order-financial tests.
- Required test coverage includes:
  - gift card does not reduce sale total;
  - gift card increases credits only;
  - pending and authorized payments do not reduce outstanding;
  - failed payments do not reduce outstanding;
  - `net_collected_amount` excludes credits and only uses real-payment refunds;
  - `ar_receivable_amount` follows AR-only rules;
  - `PAY_ON_COLLECTION` never creates AR receivable;
  - mapper prefers invoice outstanding for AR display;
  - `financial_snapshot_status` becomes `MISMATCH` when warnings exist;
  - legacy fields are used only in explicit fallback paths.
- Final documentation step must use the documentation skill to update the implementation doc, glossary, migration notes, rename matrix, pending-work log, and validation evidence.

## Assumptions and Defaults
- The addendum is accepted with these defaults locked in: lifecycle summary columns added now, refund split columns added now, reopened-due columns added now but backfilled as zero unless explicitly proven, JSONB trace columns added now, compatibility SQL view not added.
- `CURRENT`, `MISMATCH`, and `RECALCULATION_REQUIRED` are the actively used snapshot statuses in this batch; `STALE` and `LOCKED` are reserved for future flows.
- `subtotal_amount` and `items_base_amount` are intentionally written equal in the current pricing mode and documented as such, not treated as permanently identical design concepts.
- No navigation, permission, or feature-flag changes are part of this batch unless implementation reveals a truly new screen or access path.
- Migrations remain create-only for review; they are not executed by the agent.
