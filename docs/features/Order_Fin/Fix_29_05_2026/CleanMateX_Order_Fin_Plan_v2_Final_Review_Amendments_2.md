# CleanMateX Order Fin Plan v2 — Final Review and Implementation Amendments

**Document Type:** Implementation Review Addendum  
**Version:** v1.0  
**Status:** Approved with Minor Final Amendments  
**Scope:** Final review of `Order Fin Canonical Semantics Plan v2` before Codex implementation  
**Date:** 2026-05-30  

---

# 1. Final Verdict

The updated plan is much better and now aligns with the latest Order Fin addendum.

```text
APPROVED — with minor final amendments before coding.
```

The plan correctly includes the major missing items:

```text
lifecycle payment columns
refund split fields
reopened-due fields
JSONB calculation trace
preview / repair / validation structure for 0334
no compatibility SQL view unless proven needed
```

It also correctly keeps:

```text
org_orders_mst = denormalized financial snapshot
detail tables = recalculation source of truth
```

---

# 2. What Is Now Correct

The plan correctly locks these migration decisions:

```text
0333 = additive canonical schema + comments
0334 = preview / repair / validation
0335 = later legacy drop only after proof
```

It also correctly adds:

```text
pending_payment_amount
authorized_payment_amount
failed_payment_amount

real_payment_refunded_amount
stored_value_restored_amount
customer_credit_issued_amount

refund_reopens_due_amount
credit_reversal_reopens_due_amount
credit_reversed_amount

financial_calculation_snapshot
financial_calculation_hash
financial_calculation_trace_id
```

This now aligns with the full production Order Fin calculation model.

---

# 3. Final Amendments Before Implementation

## Amendment 1 — Use the correct `net_collected_amount` formula everywhere

The correct formula is:

```text
net_collected_amount =
  max(total_paid_amount - real_payment_refunded_amount, 0)
```

Do **not** use this older formula anymore:

```text
net_collected_amount = total_paid_amount - refunded_amount
```

Reason:

```text
refunded_amount may include gift card restoration, wallet restoration, customer credit issuance, or credit note issuance.
Those are not real cash/bank/gateway refunds and must not reduce net cash collection.
```

---

## Amendment 2 — Freeze completed real-payment statuses

The completed real-payment statuses must be exactly:

```text
COMPLETED
CAPTURED
SETTLED
```

Backfill and service logic must normalize case:

```sql
upper(payment_status) in ('COMPLETED', 'CAPTURED', 'SETTLED')
```

Only those statuses increase:

```text
total_paid_amount
```

---

## Amendment 3 — Freeze applied credit application status

Applied credit applications must use:

```text
application_status = 'APPLIED'
```

and active rows only.

Recommended condition:

```sql
upper(application_status) = 'APPLIED'
and coalesce(rec_status, 1) = 1
```

If the repo uses other actual status values, Codex must discover them and map them explicitly, but the canonical target status is:

```text
APPLIED
```

---

## Amendment 4 — Only ORDER-targeted payments affect order paid amount

Rule:

```text
Only ORDER-targeted payments affect order total_paid_amount.
```

If `payment_target_type` exists:

```sql
payment_target_type = 'ORDER'
```

If `payment_target_type` does **not** exist yet, document this temporary assumption:

```text
TEMPORARY ASSUMPTION:
Existing org_order_payments_dtl rows are ORDER-targeted unless proven otherwise.
```

This prevents future bugs when `INVOICE_PAYMENT` is introduced.

---

## Amendment 5 — Freeze AR payment type codes in one constants file

The plan says AR payment type logic should include:

```text
CREDIT_INVOICE plus repo-confirmed B2B/invoice-equivalent codes
```

After repo discovery, freeze them in one constants file.

Recommended constant:

```ts
export const AR_PAYMENT_TYPE_CODES = [
  'CREDIT_INVOICE',
  'B2B',
  'INVOICE',
] as const;
```

If the repo uses different actual codes, map them explicitly in the same constants file.

Do not scatter string checks across services.

---

## Amendment 6 — Add `PAYMENT_TARGET_UNCLASSIFIED` warning code

The plan already includes:

```text
REFUND_SOURCE_UNCLASSIFIED
```

Keep that as mandatory.

Add one more warning code:

```text
PAYMENT_TARGET_UNCLASSIFIED
```

Reason:

```text
If a payment row cannot be safely classified as ORDER vs AR_INVOICE later, the system must not silently count it into order total_paid_amount.
```

---

## Amendment 7 — Exclude volatile fields from `financial_calculation_hash`

The plan says:

```text
financial_calculation_hash should come from stable canonical JSON serialization.
```

Correct.

Add this rule:

```text
Do not include financial_calculation_trace_id or calculatedAt in the hash payload.
```

Otherwise every recalculation gets a different hash even when financial inputs and outputs are unchanged.

The hash should include stable data such as:

```text
engine version
source row ids
source updated_at/version fields if available
calculated numeric outputs
warning codes
stable policy inputs
```

Do not include volatile fields such as:

```text
trace id
calculatedAt timestamp
random batch id
runtime log id
```

---

## Amendment 8 — Define trace ID policy for `0334`

For the `0334` repair/backfill migration, choose and document one trace policy.

Recommended:

```text
Use one batch trace id for all rows updated in the same migration run.
```

Reason:

```text
It makes support and migration review easier.
```

Alternative allowed:

```text
Generate one UUID per row.
```

But one batch trace id is cleaner for a migration repair run.

---

## Amendment 9 — Make `0334` safely reviewable and re-runnable

The `0334` migration must:

```text
include preview SELECTs before repair UPDATEs
include post-repair validation SELECTs
include rollback notes as comments
not drop legacy columns
not overwrite legacy columns
be safe to review before execution
be safe to re-run where practical
```

Forbidden in `0334`:

```text
dropping legacy columns
blindly adding gift_card_applied_amount to total_amount
trusting polluted legacy total when detail rows exist
silently classifying unknown refunds/payments without warnings
```

---

## Amendment 10 — Hard gate before `0335` legacy drop

The legacy-drop migration `0335` must not be drafted until all are true:

```text
targeted tests pass
npm run build passes
repo-wide rg proves no live usage of legacy fields outside migrations/deprecated comments
financial summary mapper no longer depends on legacy fields except explicit temporary fallback
all compatibility aliases have a removal plan
```

Legacy fields to search:

```text
subtotal
discount
tax
total
paid_amount
gift_card_applied_amount
promo_discount_amount
service_charge
service_charge_type
net_receivable_amount
vat_amount
```

---

# 4. Final Codex Instruction Block

Give Codex this exact amendment block:

```text
Final amendments before implementation:

1. Use net_collected_amount = max(total_paid_amount - real_payment_refunded_amount, 0) everywhere.
2. Completed real-payment statuses are exactly COMPLETED, CAPTURED, SETTLED after upper-case normalization.
3. Applied credits must use application_status = APPLIED and active rows only.
4. Only ORDER-targeted payments affect order total_paid_amount. If payment_target_type does not exist yet, document current org_order_payments_dtl rows as temporarily ORDER-targeted.
5. Freeze AR payment type codes in one constants file after repo discovery.
6. Add PAYMENT_TARGET_UNCLASSIFIED warning code.
7. financial_calculation_hash must exclude volatile fields such as trace id and calculatedAt.
8. For 0334, choose one trace-id policy and document it; recommended: one batch trace id per migration run.
9. 0334 must not drop or overwrite legacy columns and should be safely reviewable/re-runnable.
10. 0335 legacy drop is blocked until tests, build, and repo-wide search pass.
```

---

# 5. Final Implementation Approval

This updated plan is ready to implement after the amendments above.

The core architecture is now correct:

```text
canonical columns added now
legacy kept temporarily
backfill from detail rows
gift card not netted from total
pending / authorized / failed payment separated
refund split added
AR-only receivable
PAY_ON_COLLECTION not AR
JSONB calculation trace added
reconciliation warnings added
legacy drop delayed
```

---

# 6. Final Approval Gate

Implementation may start when:

```text
[ ] 0333 includes all approved canonical columns and comments.
[ ] 0334 includes preview SELECTs before repair UPDATEs.
[ ] 0334 includes post-repair validation SELECTs.
[ ] 0334 includes rollback notes.
[ ] Prisma schema has canonical fields and legacy deprecation comments.
[ ] No total_completed_payment_amount DB column is added.
[ ] Gift card is not treated as discount or payment.
[ ] Pending/authorized payments are not counted as paid.
[ ] AR receivable is AR-only.
[ ] PAY_ON_COLLECTION is not AR.
[ ] PAYMENT_TARGET_UNCLASSIFIED warning is added.
[ ] financial_calculation_hash excludes volatile fields.
[ ] Reconciliation warnings are implemented.
[ ] 0335 is blocked until tests, build, and repo-wide legacy field search pass.
```
