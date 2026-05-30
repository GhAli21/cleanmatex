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
