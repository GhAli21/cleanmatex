Yes. For **clear Order Fin understanding**, you need a few new canonical columns, but do **not** over-expand `org_orders_mst`. Keep it as a **summary snapshot**, not a ledger table.

Your current table already has many required columns, but it still mixes legacy names like `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `gift_card_applied_amount` with newer fields like `total_charges_amount`, `total_discount_amount`, `total_tax_amount`, `total_credit_applied_amount`, `total_paid_amount`, `net_receivable_amount`, `pay_on_collection_amount`, and `outstanding_amount`. 

# Recommended new / renamed columns

## 1. Sale value columns

Add these for clear sale-value meaning:

```sql
subtotal_amount numeric(19,4) not null default 0,
items_base_amount numeric(19,4) not null default 0,
total_amount numeric(19,4) not null default 0
```

Meaning:

```text
items_base_amount
= item/service final line amounts

subtotal_amount
= base sale subtotal before charges/discount/tax

total_amount
= full sale value after commercial discounts, tax, and rounding
```

`total_amount` replaces ambiguous legacy:

```text
total
```

---

## 2. Extra breakdown columns

Recommended for reporting and UI clarity:

```sql
piece_extra_price_amount numeric(19,4) not null default 0,
preference_extra_price_amount numeric(19,4) not null default 0
```

Even if these are currently included inside `items_base_amount`, keep them as **breakdown fields**.

Rule:

```text
They are informational breakdown fields only while current mode includes extras in item line totals.
Do not add them again to total_charges_amount.
```

---

## 3. Charge breakdown columns

You already have `total_charges_amount`, but for clear UI you should add or standardize:

```sql
service_charge_amount numeric(19,4) not null default 0,
delivery_charge_amount numeric(19,4) not null default 0,
express_charge_amount numeric(19,4) not null default 0,
other_charges_amount numeric(19,4) not null default 0
```

Replace ambiguous legacy:

```text
service_charge
```

with:

```text
service_charge_amount
```

Use:

```text
express
```

not:

```text
rush
```

---

## 4. Tax and discount clarity columns

You already have:

```text
total_discount_amount
total_tax_amount
rounding_adjustment_amount
```

Add:

```sql
taxable_amount numeric(19,4) not null default 0
```

Keep these as canonical:

```sql
total_discount_amount numeric(19,4) not null default 0,
total_tax_amount numeric(19,4) not null default 0,
rounding_adjustment_amount numeric(19,4) not null default 0
```

Do **not** use legacy fields in new code:

```text
discount
promo_discount_amount
tax
vat_amount
```

Canonical meaning:

```text
total_discount_amount = commercial discounts only
total_tax_amount = VAT/tax total from tax detail rows
taxable_amount = taxable base after discount rules
```

---

## 5. Settlement clarity columns

You already have:

```text
total_paid_amount
total_credit_applied_amount
outstanding_amount
change_returned_amount
```

Add:

```sql
refunded_amount numeric(19,4) not null default 0,
net_collected_amount numeric(19,4) not null default 0,
overpaid_amount numeric(19,4) not null default 0
```

Meaning:

```text
total_paid_amount
= completed real payments only

total_credit_applied_amount
= gift card/wallet/advance/credit note/customer credit/loyalty applied

refunded_amount
= completed refunds

net_collected_amount
= total_paid_amount - refunded_amount

outstanding_amount
= total_amount - total_paid_amount - total_credit_applied_amount

overpaid_amount
= max(total_paid_amount + total_credit_applied_amount - total_amount, 0)
```

---

## 6. AR receivable clarity

Rename:

```text
net_receivable_amount
```

to:

```sql
ar_receivable_amount numeric(19,4) not null default 0
```

Meaning:

```text
AR receivable amount only.
Used only for CREDIT_INVOICE / B2B / INVOICE.
```

Rules:

```text
PAY_ON_COLLECTION → ar_receivable_amount = 0
Fully paid cash/card/mobile/gateway → ar_receivable_amount = 0
CREDIT_INVOICE/B2B/INVOICE → ar_receivable_amount = outstanding_amount
```

Add relation/display fields:

```sql
ar_invoice_id uuid null,
ar_invoice_no text null,
ar_invoice_status varchar(50) null
```

---

## 7. Pay-on-collection clarity

You already have:

```text
pay_on_collection_amount
```

Keep it.

Meaning:

```text
Operational retail collection amount.
Not AR.
Not invoice.
```

Rule:

```text
PAY_ON_COLLECTION → pay_on_collection_amount = outstanding_amount
otherwise → 0
```

---

## 8. Tax document future links

Because `org_invoice_mst` is AR-only and Tax Documents are separate, add optional future links:

```sql
tax_document_id uuid null,
tax_document_no text null,
tax_document_status varchar(50) null,
tax_document_type varchar(50) null
```

Meaning:

```text
Fiscal/tax/ZATCA/UAE document reference.
Not AR invoice.
Does not create AR ledger debit.
```

---

## 9. Financial recalculation/audit columns

You already have:

```text
financial_engine_version
```

Add:

```sql
financial_last_calculated_at timestamptz null,
financial_last_calculated_by uuid null,
financial_snapshot_status varchar(30) not null default 'CURRENT',
financial_mismatch_warning_count integer not null default 0
```

Recommended statuses:

```text
CURRENT
STALE
MISMATCH
RECALCULATION_REQUIRED
LOCKED
```

This helps detect problems like:

```text
order outstanding != AR invoice outstanding
order total does not match components
gift card double counted
```

---

# Final recommended canonical columns to add now

Use this practical list:

```sql
alter table public.org_orders_mst
  add column if not exists subtotal_amount numeric(19,4) not null default 0,
  add column if not exists items_base_amount numeric(19,4) not null default 0,
  add column if not exists total_amount numeric(19,4) not null default 0,

  add column if not exists piece_extra_price_amount numeric(19,4) not null default 0,
  add column if not exists preference_extra_price_amount numeric(19,4) not null default 0,

  add column if not exists service_charge_amount numeric(19,4) not null default 0,
  add column if not exists delivery_charge_amount numeric(19,4) not null default 0,
  add column if not exists express_charge_amount numeric(19,4) not null default 0,
  add column if not exists other_charges_amount numeric(19,4) not null default 0,

  add column if not exists taxable_amount numeric(19,4) not null default 0,

  add column if not exists refunded_amount numeric(19,4) not null default 0,
  add column if not exists net_collected_amount numeric(19,4) not null default 0,
  add column if not exists overpaid_amount numeric(19,4) not null default 0,

  add column if not exists ar_receivable_amount numeric(19,4) not null default 0,
  add column if not exists ar_invoice_id uuid null,
  add column if not exists ar_invoice_no text null,
  add column if not exists ar_invoice_status varchar(50) null,

  add column if not exists tax_document_id uuid null,
  add column if not exists tax_document_no text null,
  add column if not exists tax_document_status varchar(50) null,
  add column if not exists tax_document_type varchar(50) null,

  add column if not exists financial_last_calculated_at timestamptz null,
  add column if not exists financial_last_calculated_by uuid null,
  add column if not exists financial_snapshot_status varchar(30) not null default 'CURRENT',
  add column if not exists financial_mismatch_warning_count integer not null default 0;
  
```

# Columns you should deprecate later

After code refactor and backfill, remove or stop using:

```text
subtotal
discount
tax
total
paid_amount
vat_amount
gift_card_applied_amount
promo_discount_amount
service_charge
service_charge_type
net_receivable_amount
```

Do not drop them immediately until all services/UI/reports are migrated.

# Strong recommendation

Add the new columns now, but drop legacy columns later.

Implementation order:

```text
1. Add canonical columns.
2. Backfill canonical columns.
3. Refactor services/UI/API to use canonical columns.
4. Fix gift card double-counting.
5. Add reconciliation warnings.
6. Run reports/tests.
7. Drop legacy columns in a later migration.
```

This gives you clear Order Fin semantics without breaking existing code in one risky migration.


-- Column Comments
 
-- =========================================================
-- 1. SALE VALUE / ORDER VALUE COLUMNS
-- =========================================================

comment on column public.org_orders_mst.subtotal_amount is
'Canonical Order Fin field. Base sale subtotal before additional charges, commercial discounts, tax, and rounding. In the current implementation this may equal items_base_amount. Does not include payments, gift cards, wallet, customer advance, credit note, customer credit, refunds, or pending payments. Replaces ambiguous legacy subtotal.';

comment on column public.org_orders_mst.items_base_amount is
'Canonical Order Fin field. Sum of active order item/service final line amounts in order currency. In the current pricing mode, this may already include piece extra prices, preference extra prices, and item-level add-ons. This is part of order value, not settlement.';

comment on column public.org_orders_mst.total_amount is
'Canonical Order Fin field. Full final sale/service amount after commercial discounts, tax, and rounding, before payments and stored-value credits. Must not subtract cash, card, gateway, gift card, wallet, customer advance, credit note, customer credit, loyalty value, refunds, or pending payments. Replaces ambiguous legacy total.';


-- =========================================================
-- 2. EXTRA PRICE BREAKDOWN COLUMNS
-- =========================================================

comment on column public.org_orders_mst.piece_extra_price_amount is
'Canonical Order Fin breakdown field. Sum of active piece-level extra prices for the order. If piece extras are already included in items_base_amount, this field is informational/audit only and must not be added again to total_charges_amount.';

comment on column public.org_orders_mst.preference_extra_price_amount is
'Canonical Order Fin breakdown field. Sum of active preference-level extra prices for the order. If preference extras are already included in items_base_amount, this field is informational/audit only and must not be added again to total_charges_amount.';


-- =========================================================
-- 3. CHARGE BREAKDOWN COLUMNS
-- =========================================================

comment on column public.org_orders_mst.service_charge_amount is
'Canonical Order Fin field. Total service charge amount applied to the order in order currency. This is part of order value and contributes to total_charges_amount. Replaces ambiguous legacy service_charge.';

comment on column public.org_orders_mst.delivery_charge_amount is
'Canonical Order Fin field. Total delivery charge amount applied to the order in order currency. This is part of order value and contributes to total_charges_amount.';

comment on column public.org_orders_mst.express_charge_amount is
'Canonical Order Fin field. Total express or urgent-service charge amount applied to the order in order currency. Use express naming, not rush. This is part of order value and contributes to total_charges_amount.';

comment on column public.org_orders_mst.other_charges_amount is
'Canonical Order Fin field. Total other/manual/system charges applied to the order in order currency, excluding service, delivery, express, piece extra, and preference extra amounts when those have dedicated breakdown fields.';

comment on column public.org_orders_mst.total_charges_amount is
'Canonical Order Fin field. Total charge amount included in sale calculation. Current mode: service_charge_amount + delivery_charge_amount + express_charge_amount + other_charges_amount because piece/preference extras may already be included in items_base_amount. Separate-charge mode may also include piece_extra_price_amount and preference_extra_price_amount.';


-- =========================================================
-- 4. DISCOUNT / TAX / ROUNDING COLUMNS
-- =========================================================

comment on column public.org_orders_mst.total_discount_amount is
'Canonical Order Fin field. Total commercial discount amount applied to the order in order currency. Includes line, manual, promo code, coupon, campaign, and rule discounts. Excludes gift card, wallet, customer advance, credit note, customer credit, loyalty stored value, and all settlement credits.';

comment on column public.org_orders_mst.taxable_amount is
'Canonical Order Fin field. Taxable base amount calculated by the tax engine after commercial discount allocation and tax policy rules. Stored-value credits such as gift card, wallet, advance, credit note, and customer credit must not reduce taxable_amount.';

comment on column public.org_orders_mst.total_tax_amount is
'Canonical Order Fin field. Total tax amount from active order tax detail rows, such as VAT and municipal fees. Do not add legacy tax or vat_amount values to this field. Stored-value credits must not reduce total_tax_amount.';

comment on column public.org_orders_mst.rounding_adjustment_amount is
'Canonical Order Fin field. Rounding difference applied according to tenant/currency rounding policy. Can be positive, zero, or negative. Used in total_amount calculation.';


-- =========================================================
-- 5. SETTLEMENT COLUMNS
-- =========================================================

comment on column public.org_orders_mst.total_paid_amount is
'Canonical Order Fin field. Sum of completed/captured/settled ORDER-targeted real payments only. Includes confirmed cash, card, bank, check, mobile payment, and gateway payments. Excludes gift card, wallet, customer advance, credit note, customer credit, loyalty value, pending payments, authorized payments, and failed payments.';

comment on column public.org_orders_mst.total_credit_applied_amount is
'Canonical Order Fin field. Sum of APPLIED stored-value/customer-credit applications. Includes gift card, wallet, customer advance, credit note, customer credit, loyalty value, and manual credit. These are settlement credits, not commercial discounts and not real payments.';

comment on column public.org_orders_mst.refunded_amount is
'Canonical Order Fin field. Total completed refund, restoration, or customer-credit issuance amount related to the order. For real cash/bank collection reporting, use a source-specific refund field if available.';

comment on column public.org_orders_mst.net_collected_amount is
'Canonical Order Fin field. Net real payment collection after refunds. Recommended formula: total_paid_amount minus real payment refunds. If only refunded_amount exists, temporary formula may be max(total_paid_amount - refunded_amount, 0), but source-specific refund split is more accurate.';

comment on column public.org_orders_mst.outstanding_amount is
'Canonical Order Fin field. Remaining unsettled amount after completed real payments and applied credits. Recommended formula: max(total_amount - total_paid_amount - total_credit_applied_amount, 0), plus reopened-due adjustments if refund or credit reversal policies require them.';

comment on column public.org_orders_mst.overpaid_amount is
'Canonical Order Fin field. Excess completed payments and applied credits above total_amount. Recommended formula: max(total_paid_amount + total_credit_applied_amount - total_amount, 0), adjusted for reopened-due policies if applicable.';

comment on column public.org_orders_mst.change_returned_amount is
'Canonical Order Fin field. Cash change returned to the customer. Change returned is not a payment. total_paid_amount should include only the cash amount retained/allocated to the order, not total cash tendered.';


-- =========================================================
-- 6. AR RECEIVABLE / PAY-ON-COLLECTION COLUMNS
-- =========================================================

comment on column public.org_orders_mst.ar_receivable_amount is
'Canonical Order Fin field. Amount belonging to Accounts Receivable only for CREDIT_INVOICE, B2B, or INVOICE payment types. Must be zero for PAY_ON_COLLECTION and fully paid cash/card/mobile/gateway orders. Replaces ambiguous net_receivable_amount.';

comment on column public.org_orders_mst.ar_invoice_id is
'Optional link to the AR receivable invoice created for this order when payment_type_code is CREDIT_INVOICE, B2B, or INVOICE and ar_receivable_amount is greater than zero. Must be null for PAY_ON_COLLECTION and fully paid non-AR orders.';

comment on column public.org_orders_mst.ar_invoice_no is
'Denormalized display copy of the linked AR invoice number. Used for fast UI display only. Authoritative AR invoice data remains in the AR invoice table.';

comment on column public.org_orders_mst.ar_invoice_status is
'Denormalized display copy of the linked AR invoice status, such as OPEN, OVERDUE, PAID, PARTIALLY_PAID, or CANCELLED. Authoritative status remains in the AR invoice table.';

comment on column public.org_orders_mst.pay_on_collection_amount is
'Canonical Order Fin field. Operational retail amount to be collected at pickup or delivery when payment_type_code is PAY_ON_COLLECTION. This is not AR, not an invoice, and does not create AR ledger debit.';


-- =========================================================
-- 7. TAX DOCUMENT LINK COLUMNS
-- =========================================================

comment on column public.org_orders_mst.tax_document_id is
'Optional link to the fiscal/tax/e-invoicing document generated for this order. This is separate from AR invoice and does not create AR ledger debit.';

comment on column public.org_orders_mst.tax_document_no is
'Denormalized display copy of the linked tax/fiscal document number. Used for fast UI display only. Authoritative tax document data remains in the tax document table.';

comment on column public.org_orders_mst.tax_document_status is
'Denormalized display copy of the linked tax/fiscal document status, such as DRAFT, ISSUED, REPORTED, CLEARED, FAILED, CANCELLED, CREDITED, or DEBITED. Authoritative status remains in the tax document table.';

comment on column public.org_orders_mst.tax_document_type is
'Denormalized display copy of the linked tax/fiscal document type, such as SIMPLIFIED_TAX_INVOICE, STANDARD_TAX_INVOICE, CREDIT_NOTE, DEBIT_NOTE, or PROFORMA. Tax document total should equal order total_amount, not AR receivable amount.';


-- =========================================================
-- 8. FINANCIAL RECALCULATION / AUDIT COLUMNS
-- =========================================================

comment on column public.org_orders_mst.financial_engine_version is
'Version number of the Order Finance calculation engine used to produce the latest financial snapshot. Increment when calculation rules change materially.';

comment on column public.org_orders_mst.financial_last_calculated_at is
'Timestamp when the canonical Order Finance snapshot was last recalculated. Updated only by the financial recalculation service or approved repair job.';

comment on column public.org_orders_mst.financial_last_calculated_by is
'User or system actor UUID that last recalculated the canonical Order Finance snapshot. Null may indicate automated system calculation where actor is not available.';

comment on column public.org_orders_mst.financial_snapshot_status is
'Status of the current financial snapshot. Recommended values: CURRENT, STALE, MISMATCH, RECALCULATION_REQUIRED, LOCKED. MISMATCH means reconciliation warnings exist.';

comment on column public.org_orders_mst.financial_mismatch_warning_count is
'Number of active financial reconciliation warnings detected during the latest calculation, such as order total mismatch, AR receivable mismatch, tax mismatch, gift card double-counting, or pending payment counted as paid.';


-- =========================================================
-- 9. COLUMN FROM FIX_NAMES FILE — OPTIONAL WARNING
-- =========================================================
-- The Fix_Names file mentions total_completed_payment_amount,
-- but the safer decision is NOT to add this as a DB column if
-- total_paid_amount already exists. Use total_paid_amount in DB
-- and totalCompletedPaymentAmount in TypeScript/API DTOs.
