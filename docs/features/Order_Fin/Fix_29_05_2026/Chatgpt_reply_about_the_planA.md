The plan is **mostly correct and implementable**. It matches the final finance decision:

```text
Gift card = stored-value credit application
Gift card ≠ pricing discount
Gift card ≠ real payment
Order total = full sale value after commercial discounts, tax, and rounding
Outstanding = order total - completed real payments - applied credits
```

The plan correctly says `OrderCalculationResult.finalTotal` must stop being “amount due after gift card” and become the full sale total before stored-value settlement, while `giftCardApplied` remains separate. 

# Verdict

```text
Approved with amendments before implementation.
```

Do not implement it exactly as-is until the following points are tightened.

---

# 1. The most important correction

The plan says:

```text
Update order-submit-orchestrator.service.ts so any “corrected outstanding” / AR sizing math subtracts all credit applications, including gift card, from the full sale total.
```

This is correct **only after** `finalTotal` is fixed to full sale total.

Final rule:

```text
ar_invoice_amount =
  full_sale_total
- completed_real_payments_before_invoice
- applied_credit_applications_before_invoice
```

For the example:

```text
full_sale_total = 2.140
cash = 1.000
gift_card = 0.150
AR invoice = 0.990
```

This is the intended business truth.

---

# 2. Do not keep ambiguous field names without documenting them

The plan keeps:

```text
OrderCalculationResult.finalTotal
```

but changes meaning from:

```text
after gift card
```

to:

```text
before stored-value settlement
```

That is acceptable short-term, but risky. Add a code comment directly on the return type/interface:

```ts
/**
 * Full sale total after commercial discounts, tax, and rounding.
 * Does NOT subtract gift cards, wallet, advance, credit notes, or customer credits.
 */
finalTotal: Decimal;
```

Better future rename:

```text
finalTotal → saleTotal
```

But do not rename now if it causes too much blast radius.

---

# 3. Migration/backfill must be carefully scoped

The plan says to restore gift-card-applied amounts into order totals and recompute dependent snapshot columns. 

Good, but the SQL must not update every order with `gift_card_applied_amount > 0` blindly unless you can prove it was affected.

Recommended filter:

```sql
where coalesce(total_credit_applied_amount, 0) > 0
  and coalesce(gift_card_applied_amount, 0) > 0
  and coalesce(total, 0) + coalesce(gift_card_applied_amount, 0) = expected_full_sale_total
```

But because `expected_full_sale_total` may not be stored, a safer repair is:

```text
Only update rows where:
- gift card was applied
- total appears netted by gift card
- AR invoice exists and invoice outstanding supports the corrected math
- or recalculated detail totals confirm the corrected total
```

For this specific order, the repair is clear:

```text
old total = 1.990
gift card = 0.150
correct total = 2.140
paid = 1.000
credit = 0.150
correct outstanding = 0.990
```

But for bulk migration, Codex must either:

```text
A) generate a conservative migration with preview SELECT first
```

or:

```text
B) create a repair script/migration scoped only to confirmed affected rows
```

Do not run a broad update without a preview query.

---

# 4. Preserve AR invoice rows, but validate mismatch

The plan correctly says not to touch AR invoice rows already correct. 

Add this validation query to the migration docs:

```sql
select
  o.id,
  o.order_no,
  o.total as order_total,
  o.total_paid_amount,
  o.total_credit_applied_amount,
  o.outstanding_amount as order_outstanding,
  i.invoice_no,
  i.total as invoice_total,
  i.outstanding_amount as invoice_outstanding
from org_orders_mst o
join org_invoice_mst i
  on i.order_id = o.id
 and i.tenant_org_id = o.tenant_org_id
where o.payment_type_code in ('CREDIT_INVOICE', 'INVOICE', 'B2B')
  and coalesce(o.outstanding_amount, 0) <> coalesce(i.outstanding_amount, 0);
```

This will detect mismatches like:

```text
order outstanding = 0.840
invoice outstanding = 0.990
```

---

# 5. UI rule is good, but should be temporary fallback logic

The plan says AR receivable display should prefer `arInvoice.outstandingAmount` when an AR invoice exists. 

Correct. But after backend fix, this should not be needed to hide inconsistent data.

Final display rule:

```text
If AR invoice exists:
  show invoice outstanding as AR receivable amount
  if order outstanding differs, show warning

If AR invoice does not exist and payment type is CREDIT_INVOICE:
  show order outstanding as expected receivable amount

Otherwise:
  show 0
```

Add warning:

```text
AR_RECEIVABLE_MISMATCH
```

Message:

```text
Order outstanding does not match AR invoice outstanding. Recalculate order financial snapshot.
```

---

# 6. Add one missing test: tax base must not be reduced by gift card

The test plan covers `finalTotal`, `giftCardApplied`, AR sizing, and snapshot math. 

Add one more:

```text
Gift card must not reduce taxable amount or tax amount.
```

Example:

```text
subtotal = 2.000
tax = 0.140
gift card = 0.150

taxable/tax remains based on sale rules
finalTotal = 2.140
giftCardApplied = 0.150
```

This matters for VAT/ZATCA/GCC compliance.

---

# 7. Add one missing test: partial gift card + no cash + credit invoice

Test:

```text
subtotal = 2.000
tax = 0.140
gift card = 0.150
cash = 0
payment_type = CREDIT_INVOICE

order total = 2.140
credit applied = 0.150
outstanding = 1.990
AR invoice = 1.990
```

This catches the same bug without cash.

---

# 8. Add one missing test: fully covered gift card

Test:

```text
order total = 2.140
gift card = 2.140
cash = 0

total_credit_applied_amount = 2.140
outstanding = 0
no AR invoice
payment_status = PAID
```

This proves gift card can fully settle the order without becoming payment or discount.

---

# 9. Add one missing implementation note: promo discounts remain pricing discounts

The plan says tax, VAT, subtotal, taxable amount, and discount math remain unchanged except removing gift card from pricing. 

Clarify:

```text
Promo/manual/coupon/campaign discounts remain pricing discounts.
Gift card/wallet/advance/credit-note/customer-credit are settlement credits.
```

This avoids accidentally moving promo codes into credit applications.

---

# 10. Recommended amended instruction to Codex

Use this final instruction:

```text
Implement Fix_PLAN.md with these amendments:

1. Gift card must be treated only as stored-value credit application, never as pricing discount.
2. order.total / finalTotal must represent full sale value after commercial discounts, tax, and rounding only.
3. Gift card must not reduce subtotal, taxable amount, tax amount, finalTotal, or order.total.
4. Gift card remains in giftCardApplied, org_order_credit_apps_dtl, and total_credit_applied_amount.
5. outstanding_amount = total_amount - total_paid_amount - total_credit_applied_amount.
6. AR invoice amount for CREDIT_INVOICE = outstanding after real payments and credits.
7. UI should prefer invoice outstanding when AR invoice exists, but also show warning if it differs from order outstanding.
8. Migration must include a preview SELECT and be scoped only to confirmed affected gift-card orders.
9. Do not update AR invoice rows that are already correct.
10. Add regression tests:
   - gift card does not reduce finalTotal
   - gift card does not reduce taxable/tax amount
   - cash + gift card + credit invoice = 0.990 outstanding in the known example
   - gift card-only partial credit invoice
   - gift card fully covers order and creates no AR invoice
```


The plan’s direction is right. The only dangerous area is the **data repair migration**; make that conservative, previewable, and scoped.

Yes. Add these bugs/checks to the plan before Codex starts implementation. The current plan correctly fixes the **gift card double-counting** root cause, but there are adjacent bugs that will appear once `finalTotal` changes semantics. The uploaded plan already says `finalTotal` changes from “sale total after gift card” to “sale total before stored-value settlement,” and that gift card remains separate in `giftCardApplied` / `total_credit_applied_amount`. 

# Add these issues to the plan

## B5 — `order.total` and `org_orders_mst.total` naming is dangerous

Current problem:

```text
org_orders_mst.total
```

is being treated as different things in different places:

```text
sale total
amount due
net after gift card
AR base amount
```

That is the real root of many bugs.

Add to plan:

```text
Audit every use of org_orders_mst.total and OrderCalculationResult.finalTotal.

After this fix:
- total / finalTotal = full sale value after commercial discounts, tax, and rounding.
- total / finalTotal must not subtract gift card, wallet, advance, credit note, customer credit, or payment.
```

Recommended longer-term rename:

```text
total → total_amount
finalTotal → saleTotal
```

Do not rename immediately unless Codex can safely update all references.

---

## B6 — `gift_card_applied_amount` legacy column can conflict with `total_credit_applied_amount`

Your table has both:

```text
gift_card_applied_amount
total_credit_applied_amount
```

If both are used in formulas, gift card can be counted twice.

Add rule:

```text
total_credit_applied_amount is canonical.
gift_card_applied_amount is legacy/display/backward compatibility only.
```

Codex must search for:

```text
gift_card_applied_amount
giftCardApplied
total_credit_applied_amount
```

and confirm no formula does:

```text
total_credit_applied_amount + gift_card_applied_amount
```

unless `total_credit_applied_amount` excludes gift card, which it should not.

---

## B7 — `discount`, `promo_discount_amount`, and `total_discount_amount` may double-count promo

Your schema has:

```text
discount
promo_discount_amount
total_discount_amount
```

Bug risk:

```text
total_discount_amount = discount + promo_discount_amount
```

but another mapper may also show or calculate:

```text
discount + promo_discount_amount + total_discount_amount
```

Add to plan:

```text
total_discount_amount is canonical.
discount and promo_discount_amount are legacy/source-specific fields.
UI and snapshots must not add total_discount_amount again with legacy discount columns.
```

Validation query/test:

```text
Order total must use exactly one discount source.
```

---

## B8 — `tax`, `vat_amount`, and `total_tax_amount` may double-count tax

Your schema has:

```text
tax
vat_amount
total_tax_amount
```

For the sample order, Codex found tax detail rows:

```text
0.10 VAT + 0.04 Municipal Fee = 0.140
```

So `total_tax_amount = 0.140` is the canonical field.

Add to plan:

```text
total_tax_amount is canonical.
Do not add tax + vat_amount + total_tax_amount.
Use tax detail rows or total_tax_amount.
```

Required test:

```text
VAT + municipal fee is represented once.
```

---

## B9 — AR card mixes invoice identity from invoice row with amount from order snapshot

Codex found this exact bug:

```text
AR invoice = ARI-000016 from org_invoice_mst
AR receivable amount = order.outstanding_amount
```

That creates mismatched UI:

```text
invoice outstanding = 0.990
order outstanding = 0.840
screen shows invoice identity with wrong amount
```

Add to plan:

```text
If AR invoice exists:
  display AR receivable amount from org_invoice_mst.outstanding_amount.
  if it differs from order.outstanding_amount, show AR_RECEIVABLE_MISMATCH warning.

If no AR invoice exists and payment_type_code = CREDIT_INVOICE:
  display expected AR receivable from order.outstanding_amount.
```

This is not just UI polish. It prevents users from seeing false AR values.

---

## B10 — Backfill may create false changes if it updates all gift-card orders

The migration must not blindly do:

```text
total = total + gift_card_applied_amount
```

for every historical gift-card order.

Some orders may already be correct, partially repaired, cancelled, refunded, or not AR-related.

Add to plan:

```text
Migration must include preview SELECT first.
Migration must only update confirmed affected rows.
Migration must write before/after values into the documentation.
Migration must not update AR invoice rows that already match intended receivable.
```

Recommended preview conditions:

```text
gift card applied > 0
total_credit_applied_amount includes gift card
order total appears netted by gift card
invoice outstanding or recalculated details prove the intended full sale total
```

---

## B11 — `payment_status` may become wrong after recalculation

If you change:

```text
total
outstanding_amount
net_receivable_amount/ar_receivable_amount
```

then `payment_status` can shift.

Example:

```text
old outstanding = 0.000 → PAID
new outstanding = 0.150 → PARTIALLY_PAID
```

Add to plan:

```text
Recalculate payment_status after correcting total/outstanding.
```

Rules:

```text
outstanding = 0 → PAID
paid/credits > 0 and outstanding > 0 → PARTIALLY_PAID
paid/credits = 0 and PAY_ON_COLLECTION → PENDING_COLLECTION
paid/credits = 0 and CREDIT_INVOICE → INVOICED / UNPAID depending current enum
```

Do not leave old status untouched if amount changes.

---

## B12 — `net_receivable_amount` naming is still confusing

The plan keeps `net_receivable_amount`.

Given the ADR and our decision, this should mean:

```text
AR receivable amount only
```

Add to plan:

```text
Document net_receivable_amount as AR receivable amount.
Recommended future rename: net_receivable_amount → ar_receivable_amount.
```

For now:

```text
payment_type_code = CREDIT_INVOICE/B2B/INVOICE → net_receivable_amount = outstanding_amount
PAY_ON_COLLECTION/cash/card/gateway → net_receivable_amount = 0
```

---

## B13 — Gift card should not reduce taxable amount or tax document total

This is important for GCC/VAT/ZATCA.

Add explicit rule:

```text
Gift card is settlement value, not a tax discount.
It must not reduce taxable_amount.
It must not reduce total_tax_amount.
It must not reduce future tax_document.total_amount.
```

Commercial discounts can reduce taxable amount if policy allows. Gift card cannot.

---

## B14 — Refund logic may assume old gift-card-as-discount behavior

Codex should search refund services for assumptions like:

```text
refund base = order.total after gift card
gift card refund as discount reversal
```

Add to plan:

```text
Audit refund calculation paths.
If order was settled partly by gift card, refund must decide whether to:
- refund cash/card portion
- restore gift card balance
- create customer credit
```

Do not include full refund refactor now, but add a guard test if existing refund code touches `giftCardApplied`.

---

## B15 — Reports and dashboards may use legacy fields

Any report using:

```text
total
paid_amount
gift_card_applied_amount
discount
tax
vat_amount
```

may produce wrong numbers after the semantic fix.

Add scope:

```text
Search and update financial reports/read models to canonical fields:
- total_amount/full sale total
- total_paid_amount
- total_credit_applied_amount
- outstanding_amount
- total_discount_amount
- total_tax_amount
```

At minimum, add a known-risk note if not fixed now.

---

# Add this section to the plan

Use this as a direct addendum for Codex:

```text
Additional bugs/risks to include:

B5. Audit org_orders_mst.total and OrderCalculationResult.finalTotal usage. They must mean full sale total before stored-value settlement.
B6. Prevent gift_card_applied_amount + total_credit_applied_amount double counting. total_credit_applied_amount is canonical.
B7. Prevent discount double counting between discount, promo_discount_amount, and total_discount_amount.
B8. Prevent tax double counting between tax, vat_amount, and total_tax_amount.
B9. AR receivable UI must use invoice outstanding when invoice exists and show mismatch warning if order outstanding differs.
B10. Backfill migration must be previewable and scoped only to confirmed affected rows.
B11. Recalculate payment_status after amount repair.
B12. Document net_receivable_amount as AR receivable amount; future rename to ar_receivable_amount.
B13. Gift card must not reduce taxable amount, tax amount, or future tax document total.
B14. Audit refund paths for gift-card-as-discount assumptions.
B15. Audit reports/dashboards using legacy financial fields.
```

# Priority

Implement in this priority order:

```text
1. B5/B6/B13 — core semantic correctness
2. Gift card calculation fix
3. Order snapshot recalculation
4. B9 — AR UI display fix
5. B10/B11 — migration and payment status repair
6. B7/B8 — discount/tax double-count guard
7. B14/B15 — refund/report audits
```

Final verdict:

```text
Yes, add these to the plan before implementation.
The biggest hidden risks are tax/discount double-counting, legacy gift_card_applied_amount conflict, and unsafe bulk migration.
```
