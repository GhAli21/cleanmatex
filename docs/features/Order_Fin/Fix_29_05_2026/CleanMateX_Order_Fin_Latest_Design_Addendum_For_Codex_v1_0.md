# CleanMateX Order Fin Latest Design Reference & Implementation Addendum

**Document Type:** Implementation Reference / Gap Checklist  
**Version:** v1.0  
**Status:** Give this to Codex before implementing `Order_Fin_Names_Fix_PLAN.md`  
**Scope:** Latest Order Finance canonical design, missing columns, calculation rules, migration safeguards, and implementation amendments.  
**Date:** 2026-05-30  

---

# 1. Purpose

This document is a direct implementation reference to align the current implementation plan with the latest full Order Fin design.

Use it as an addendum to:

```text
Order_Fin_Names_Fix_PLAN.md
Add_Columns_29_05_2026.md
Fix_Names_29_05_2026.md
CleanMateX_Order_Fin_Calculation_Algorithms_Full_v1_1.md
```

The current plan is approved with amendments. This document lists the missing or must-confirm items before implementation.

---

# 2. Final Implementation Decision

The implementation plan is acceptable, but it must include these additional design decisions before Codex starts:

```text
1. Add financial_calculation_snapshot / hash / trace columns.
2. Add pending / authorized / failed payment summary columns.
3. Add refund source split fields or explicitly defer them.
4. Add refund/credit reopened-due fields or explicitly defer them.
5. Add preview and validation SQL sections to the backfill/repair migration.
6. Clarify subtotal_amount vs items_base_amount.
7. Keep total_paid_amount as the only DB paid column.
8. Do not add compatibility SQL view unless repo/report search proves it is needed.
```

---

# 3. Core Order Fin Rules

## 3.1 Order total rule

```text
total_amount = full sale/service value after commercial discounts, tax, and rounding.
```

It must not subtract:

```text
cash
card
gateway
mobile payment
gift card
wallet
customer advance
credit note
customer credit
loyalty value
pending payments
authorized payments
refunds
```

## 3.2 Settlement rule

```text
outstanding_amount =
  max(
    total_amount
  - total_paid_amount
  - total_credit_applied_amount
  + refund_reopens_due_amount
  + credit_reversal_reopens_due_amount,
    0
  )
```

If reopened-due fields are deferred, temporary v1 formula is:

```text
outstanding_amount =
  max(total_amount - total_paid_amount - total_credit_applied_amount, 0)
```

## 3.3 Gift card rule

```text
Gift card = stored-value credit application.
Gift card ≠ (is not) commercial discount.
Gift card ≠ (is not) real payment.
Gift card must not reduce total_amount.
Gift card must not reduce taxable_amount.
Gift card must not reduce total_tax_amount.
Gift card reduces outstanding_amount only through total_credit_applied_amount.
```

## 3.4 Real payment rule

```text
total_paid_amount = completed/captured/settled ORDER-targeted real payments only.
```

Do not include:

```text
gift card
wallet
customer advance
credit note
customer credit
pending gateway
authorized card
failed payment attempts
```

## 3.5 AR rule

```text
AR invoice exists only for CREDIT_INVOICE / B2B / INVOICE when ar_receivable_amount > 0.
```

No AR invoice for:

```text
PAY_ON_COLLECTION
fully paid cash/card/gateway
fully credit-applied order
PAY_NOW with no receivable
```

## 3.6 PAY_ON_COLLECTION rule

```text
payment_type_code = PAY_ON_COLLECTION:
  pay_on_collection_amount = outstanding_amount
  ar_receivable_amount = 0
  ar_invoice_id = null
```

---

# 4. Required Additions to Migration 0333

The current plan should add the columns from `Add_Columns_29_05_2026.md`, but it must also consider the latest full Order Fin design below.

## 4.1 Add payment lifecycle summary columns

Recommended to add now:

```sql
alter table public.org_orders_mst
  add column if not exists pending_payment_amount numeric(19,4) not null default 0,
  add column if not exists authorized_payment_amount numeric(19,4) not null default 0,
  add column if not exists failed_payment_amount numeric(19,4) not null default 0;
```

### Meaning

```text
pending_payment_amount
= ORDER-targeted payments in PENDING / PROCESSING / CAPTURE_PENDING

authorized_payment_amount
= ORDER-targeted payments in AUTHORIZED status

failed_payment_amount
= ORDER-targeted failed/refused/cancelled/expired/voided/reversed attempts
```

### Rule

```text
pending_payment_amount and authorized_payment_amount do not reduce outstanding_amount.
failed_payment_amount is audit only.
```

---

## 4.2 Add refund source split columns

Recommended to add now if refund work is in scope:

```sql
alter table public.org_orders_mst
  add column if not exists real_payment_refunded_amount numeric(19,4) not null default 0,
  add column if not exists stored_value_restored_amount numeric(19,4) not null default 0,
  add column if not exists customer_credit_issued_amount numeric(19,4) not null default 0;
```

### Meaning

```text
real_payment_refunded_amount
= completed cash/card/bank/gateway refund amount

stored_value_restored_amount
= completed amount restored to gift card/wallet/advance

customer_credit_issued_amount
= amount issued as customer credit or credit note
```

### Correct net collection formula

```text
net_collected_amount =
  max(total_paid_amount - real_payment_refunded_amount, 0)
```

Do not subtract gift-card restoration from real cash collection.

### If deferred

If refund source split is not implemented now, write this in the implementation plan:

```text
Refund source split is deferred.
net_collected_amount temporarily uses max(total_paid_amount - refunded_amount, 0).
This is approximate and must be replaced when refund source lineage is implemented.
```

---

## 4.3 Add reopened-due tracking fields

Recommended to add now if refunds/reversals are in scope:

```sql
alter table public.org_orders_mst
  add column if not exists refund_reopens_due_amount numeric(19,4) not null default 0,
  add column if not exists credit_reversal_reopens_due_amount numeric(19,4) not null default 0,
  add column if not exists credit_reversed_amount numeric(19,4) not null default 0;
```

### Meaning

```text
refund_reopens_due_amount
= amount by which a refund intentionally reopens customer due

credit_reversal_reopens_due_amount
= amount by which reversed credit application reopens due

credit_reversed_amount
= total reversed applied credit applications
```

### If deferred

If not implemented now, write:

```text
Refund/credit reversal reopening due is deferred.
Outstanding formula temporarily excludes reopened-due fields.
```

---

## 4.4 Add financial calculation JSONB trace columns

Add now:

```sql
alter table public.org_orders_mst
  add column if not exists financial_calculation_snapshot jsonb null,
  add column if not exists financial_calculation_hash text null,
  add column if not exists financial_calculation_trace_id uuid null;
```

### Rule

```text
Numeric columns = operational truth.
JSONB snapshot = explanation / audit / debug / support / AI trace.
```

Do not use JSONB for primary reporting, filters, KPI dashboards, or sorting.

---

# 5. Recommended Column Comments for Added Columns

```sql
comment on column public.org_orders_mst.pending_payment_amount is
'Canonical Order Fin settlement snapshot. Sum of ORDER-targeted payment attempts in PENDING, PROCESSING, or CAPTURE_PENDING status. Pending payments are visible but do not reduce outstanding_amount and do not count as paid.';

comment on column public.org_orders_mst.authorized_payment_amount is
'Canonical Order Fin settlement snapshot. Sum of ORDER-targeted authorized payment amounts reserved by card/gateway but not captured, settled, or completed. Authorized payments do not reduce outstanding_amount until captured/settled/completed.';

comment on column public.org_orders_mst.failed_payment_amount is
'Canonical Order Fin settlement snapshot. Sum of ORDER-targeted failed, refused, cancelled, expired, voided, or reversed payment attempts. This is audit/history only and does not reduce outstanding_amount.';

comment on column public.org_orders_mst.real_payment_refunded_amount is
'Canonical Order Fin refund snapshot. Completed refund amount returned against real payments such as cash, card, bank, mobile, or gateway. Used to calculate net_collected_amount.';

comment on column public.org_orders_mst.stored_value_restored_amount is
'Canonical Order Fin refund snapshot. Completed amount restored back to stored-value instruments such as gift card, wallet, or customer advance. This does not reduce real cash collection.';

comment on column public.org_orders_mst.customer_credit_issued_amount is
'Canonical Order Fin refund snapshot. Completed amount issued as customer credit or credit note as part of refund/adjustment workflow. This is not a real payment refund.';

comment on column public.org_orders_mst.refund_reopens_due_amount is
'Canonical Order Fin settlement snapshot. Amount by which a completed refund explicitly reopens customer due/outstanding according to approved refund policy. Default is zero unless a refund workflow intentionally reopens due.';

comment on column public.org_orders_mst.credit_reversal_reopens_due_amount is
'Canonical Order Fin settlement snapshot. Amount by which a reversed credit application reopens customer due/outstanding unless the reversed credit is replaced by another settlement source.';

comment on column public.org_orders_mst.credit_reversed_amount is
'Canonical Order Fin settlement snapshot. Sum of previously applied credit applications that were reversed. Reversed credits may reopen due through credit_reversal_reopens_due_amount unless replaced by another settlement source.';

comment on column public.org_orders_mst.financial_calculation_snapshot is
'Versioned JSONB explanation of the latest order financial calculation. Used for audit, debugging, support, AI explanation, and reconciliation trace. Canonical financial reporting must use numeric snapshot columns, not this JSON.';

comment on column public.org_orders_mst.financial_calculation_hash is
'Hash of the latest financial calculation inputs and outputs, including engine version where applicable. Used to detect stale, changed, or inconsistent calculation snapshots.';

comment on column public.org_orders_mst.financial_calculation_trace_id is
'Trace identifier linking the latest financial snapshot calculation to application logs, background jobs, audit events, reconciliation runs, or distributed tracing systems.';
```

---

# 6. Required Amendments to Migration 0334 Backfill/Repair

The current plan correctly says the repair migration should recalculate canonical fields from detail rows and AR rows, not trust polluted header totals.

Add this strict migration structure:

```text
1. Preview SELECT section
2. Repair UPDATE section
3. Post-repair validation SELECT section
4. Rollback notes section
```

## 6.1 Preview SELECT requirements

Before any update, include SELECTs to show affected rows:

```sql
-- Preview gift-card affected rows where header total may be polluted.
select
  o.id,
  o.order_no,
  o.total as legacy_total,
  o.total_amount as canonical_total_amount,
  o.total_paid_amount,
  o.total_credit_applied_amount,
  o.outstanding_amount,
  o.payment_type_code,
  o.payment_status
from public.org_orders_mst o
where coalesce(o.total_credit_applied_amount, 0) > 0
  and (
    coalesce(o.total_amount, 0) = 0
    or coalesce(o.outstanding_amount, 0) <>
       greatest(coalesce(o.total_amount, 0)
              - coalesce(o.total_paid_amount, 0)
              - coalesce(o.total_credit_applied_amount, 0), 0)
  );
```

If legacy `total` is already dropped, preview should use detail recalculation sources instead.

## 6.2 Do not blindly repair all gift-card rows

Forbidden:

```sql
update org_orders_mst
set total_amount = total_amount + gift_card_applied_amount;
```

Reason:

```text
Some rows may already be correct, partially repaired, cancelled, refunded, or not AR-related.
```

## 6.3 Backfill must derive total_amount from detail rows

Preferred source order:

```text
1. Detail rows: items, charges, discounts, taxes, rounding.
2. Existing canonical fields if already populated and verified.
3. Legacy header fields only as fallback and only when not polluted.
```

---

# 7. Required Service-Layer Amendments

## 7.1 `order-calculation.service.ts`

Refactor:

```text
finalTotal → saleTotal
```

Required comment:

```ts
/**
 * Full sale total after commercial discounts, tax, and rounding.
 * Does not subtract gift card, wallet, advance, credit note,
 * customer credit, loyalty value, pending payments, or real payments.
 */
saleTotal: Decimal;
```

Gift card must remain separate:

```text
giftCardApplied / giftCardCreditAppliedAmount
= stored-value settlement, not pricing discount
```

## 7.2 `order-financial-write.service.ts`

Must calculate:

```text
total_paid_amount =
  completed/captured/settled ORDER-targeted real payments only

pending_payment_amount =
  pending/processing/capture-pending ORDER-targeted payment attempts

authorized_payment_amount =
  authorized ORDER-targeted payment attempts

failed_payment_amount =
  failed/refused/cancelled/expired/voided ORDER-targeted payment attempts

total_credit_applied_amount =
  applied stored-value/customer-credit applications

outstanding_amount =
  max(
    total_amount
  - total_paid_amount
  - total_credit_applied_amount
  + refund_reopens_due_amount
  + credit_reversal_reopens_due_amount,
    0
  )
```

If reopened-due fields are deferred, use v1 formula and document deferral.

## 7.3 `order-submit-orchestrator.service.ts`

Do not use `nonGiftCardCredits`.

Correct logic:

```ts
const settlementOutstandingAmount =
  saleTotal
    .minus(totalCompletedPaymentAmount)
    .minus(totalCreditAppliedAmount)
    .plus(refundReopensDueAmount ?? 0)
    .plus(creditReversalReopensDueAmount ?? 0);
```

AR sizing:

```ts
const arReceivableAmount =
  ['CREDIT_INVOICE', 'B2B', 'INVOICE'].includes(paymentTypeCode)
    ? settlementOutstandingAmount
    : Decimal(0);
```

PAY_ON_COLLECTION sizing:

```ts
const payOnCollectionAmount =
  paymentTypeCode === 'PAY_ON_COLLECTION'
    ? settlementOutstandingAmount
    : Decimal(0);
```

---

# 8. Subtotal vs Items Base Rule

Codex must not treat these as permanently identical without comment.

## Current mode

```text
subtotal_amount = items_base_amount
```

because item final line amounts already include item/piece/preference extras.

## Future mode

If extras become separate charge rows:

```text
items_base_amount = base item/service amount
piece_extra_price_amount = piece extra breakdown
preference_extra_price_amount = preference extra breakdown
total_charges_amount may include piece/preference extras if pricing mode = SEPARATE_CHARGE
```

Add this comment to code and DB docs.

---

# 9. No Compatibility View Unless Needed

The implementation plan should keep its decision:

```text
Do not create a compatibility SQL view now.
```

Only add a compatibility view if repo-wide search finds external SQL/report consumers that cannot be refactored quickly.

Reason:

```text
A compatibility view adds maintenance overhead and may encourage legacy usage.
```

---

# 10. Canonical DB vs TypeScript Names

## 10.1 Paid amount

Do not add DB column:

```text
total_completed_payment_amount
```

Use:

```text
DB: total_paid_amount
TypeScript/API: totalCompletedPaymentAmount
```

## 10.2 Order total

Use:

```text
DB: total_amount
TypeScript/API: orderTotalAmount / saleTotal
```

## 10.3 AR receivable

Use:

```text
DB: ar_receivable_amount
TypeScript/API: arReceivableAmount
```

## 10.4 Credits

Use:

```text
DB: total_credit_applied_amount
TypeScript/API: totalCreditAppliedAmount
```

---

# 11. Required Reconciliation Warnings

The implementation must support at least these warning codes:

```text
ORDER_TOTAL_COMPONENT_MISMATCH
DISCOUNT_TOTAL_MISMATCH
TAX_TOTAL_MISMATCH
OUTSTANDING_MISMATCH
PENDING_PAYMENT_COUNTED_AS_PAID
AUTHORIZED_PAYMENT_COUNTED_AS_PAID
GIFT_CARD_DOUBLE_COUNTED
CREDIT_APPLICATION_COUNTED_AS_DISCOUNT
AR_RECEIVABLE_MISMATCH
TAX_DOCUMENT_TOTAL_MISMATCH
LEGACY_FIELD_USED_IN_SUMMARY
```

These should update:

```text
financial_snapshot_status
financial_mismatch_warning_count
financial_calculation_snapshot.warnings
```

---

# 12. Implementation Order for Codex

Use this exact order:

```text
1. Create 0333 additive canonical columns + comments.
2. Add payment lifecycle and JSONB trace columns in 0333 or separate 0335.
3. Update Prisma schema with canonical fields and deprecation comments.
4. Create 0334 backfill/repair SQL with preview SELECT, update, post-validation SELECT, rollback notes.
5. Refactor order-calculation.service.ts: finalTotal → saleTotal.
6. Refactor order-submit-orchestrator.service.ts.
7. Refactor order-financial-write.service.ts.
8. Refactor order-service.ts and financial-summary services.
9. Update DTO/read-model/UI mapper to canonical names first.
10. Keep legacy fallback for one transition release.
11. Implement reconciliation warning generation.
12. Add/update tests.
13. Run targeted Jest suites.
14. Run i18n check only if UI labels changed.
15. Run build.
16. Do not write legacy-drop migration until repo-wide search proves no live reads/writes remain.
```

---

# 13. Required Test Additions

Add tests for:

```text
Gift card does not reduce saleTotal / total_amount.
Gift card increases totalCreditAppliedAmount.
Outstanding = total - completed payments - applied credits.
Pending gateway does not reduce outstanding.
Authorized payment does not reduce outstanding.
Failed payment does not reduce outstanding.
AR receivable uses AR-only rules.
PAY_ON_COLLECTION does not create AR receivable.
Taxable amount is not reduced by gift card.
total_tax_amount is not tax + vat + totalTax duplicated.
net_collected_amount does not treat credits as cash.
AR receivable display prefers invoice outstanding when invoice exists.
financial_snapshot_status becomes MISMATCH when warnings exist.
legacy fields are not used by financial summary mapper except temporary fallback.
```

---

# 14. Final Codex Instruction

```text
Implement Order_Fin_Names_Fix_PLAN.md, Add_Columns_29_05_2026.md, and Fix_Names_29_05_2026.md using this addendum as the latest Order Fin design reference.

The plan is approved only after applying these amendments:
- add financial_calculation_snapshot/hash/trace columns;
- add pending/authorized/failed payment columns or explicitly defer them;
- add refund source split fields or explicitly defer them;
- add refund/credit reopened-due fields or explicitly defer them;
- add preview and post-validation SELECTs in 0334 repair migration;
- clarify subtotal_amount vs items_base_amount;
- keep total_paid_amount as the DB canonical paid field;
- do not add total_completed_payment_amount as DB column;
- do not create compatibility SQL view unless repo/report search proves it is needed.

Numeric canonical columns are the operational truth.
financial_calculation_snapshot JSONB is explanation/audit/debug only.
```

---

# 15. Final Approval Gate

Implementation may start only when:

```text
[ ] 0333 includes all approved canonical columns and comments.
[ ] 0334 includes preview SELECTs before repair UPDATEs.
[ ] Prisma schema has canonical fields and legacy deprecation comments.
[ ] No new total_completed_payment_amount DB column is added.
[ ] Gift card is not treated as discount or payment.
[ ] Pending/authorized payments are not counted as paid.
[ ] AR receivable is AR-only.
[ ] PAY_ON_COLLECTION is not AR.
[ ] Reconciliation warnings are implemented.
```
