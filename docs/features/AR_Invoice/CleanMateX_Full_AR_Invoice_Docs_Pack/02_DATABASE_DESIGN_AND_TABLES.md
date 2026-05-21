# CleanMateX Full AR Invoice — Database Design and Tables

**Document Type:** Database Design  
**Module:** Full AR Invoice / Customer Receivables  
**Version:** v1.0  
**Status:** Ready for Engineering Review

---

# 1. Database Strategy

Use existing `org_invoice_mst` as AR invoice header and add:

```text
org_invoice_lines_dtl
org_invoice_orders_dtl
org_invoice_payments_dtl
org_invoice_adjustments_dtl
org_invoice_status_history_dtl
org_customer_ar_ledger_dtl
```

Optional later:

```text
org_invoice_attachments_dtl
org_invoice_reminders_dtl
org_customer_ar_account_mst
```

---

# 2. Existing `org_invoice_mst` Improvements

## 2.1 Required Meaning

```text
org_invoice_mst = AR invoice header
```

It is not a receipt voucher, payment transaction, pay-on-collection pending slip, or generic order receipt.

## 2.2 Standardize Money Precision

```sql
alter table public.org_invoice_mst
alter column subtotal type numeric(19,4),
alter column discount type numeric(19,4),
alter column tax type numeric(19,4),
alter column total type numeric(19,4),
alter column paid_amount type numeric(19,4);
```

## 2.3 Add Outstanding Amount

```sql
alter table public.org_invoice_mst
add column if not exists outstanding_amount numeric(19,4) not null default 0;
```

## 2.4 Currency Rule

`currency_code` must be required after data cleanup.

```sql
alter table public.org_invoice_mst
alter column currency_code set not null;
```

No hardcoded default. Currency must be resolved from branch currency, tenant default currency, order currency, or customer policy if allowed.

## 2.5 Canonical Statuses

Approved values:

```text
DRAFT
OPEN
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
VOID
PARTIALLY_REFUNDED
REFUNDED
WRITTEN_OFF
DISPUTED
```

After cleaning old data:

```sql
alter table public.org_invoice_mst
add constraint chk_org_invoice_status
check (
  status in (
    'DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE',
    'CANCELLED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED',
    'WRITTEN_OFF', 'DISPUTED'
  )
);
```

## 2.6 Invoice Types

Approved values:

```text
ORDER_CREDIT
B2B_ORDER
B2B_STATEMENT
MANUAL_AR
CREDIT_MEMO
DEBIT_NOTE
PROFORMA
```

Constraint:

```sql
alter table public.org_invoice_mst
add constraint chk_org_invoice_type_cd
check (
  invoice_type_cd in (
    'ORDER_CREDIT', 'B2B_ORDER', 'B2B_STATEMENT', 'MANUAL_AR',
    'CREDIT_MEMO', 'DEBIT_NOTE', 'PROFORMA'
  )
);
```

## 2.7 Amount Sanity

```sql
alter table public.org_invoice_mst
add constraint chk_org_invoice_amounts
check (
  coalesce(subtotal,0) >= 0
  and coalesce(discount,0) >= 0
  and coalesce(tax,0) >= 0
  and coalesce(total,0) >= 0
  and coalesce(paid_amount,0) >= 0
  and coalesce(outstanding_amount,0) >= 0
  and coalesce(vat_amount,0) >= 0
  and coalesce(promo_discount_amount,0) >= 0
  and coalesce(service_charge,0) >= 0
);
```

---

# 3. New Table: `org_invoice_lines_dtl`

Purpose: stores invoice line details for all invoice types.

```sql
create table if not exists public.org_invoice_lines_dtl (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  invoice_id uuid not null,
  line_no integer not null,
  line_type text not null default 'SERVICE',
  source_type text null,
  source_order_id uuid null,
  source_order_item_id uuid null,
  source_charge_id uuid null,
  source_discount_id uuid null,
  source_tax_id uuid null,
  item_code text null,
  service_code text null,
  description text not null,
  description2 text null,
  quantity numeric(19,4) not null default 1,
  unit_price numeric(19,4) not null default 0,
  subtotal_amount numeric(19,4) not null default 0,
  discount_amount numeric(19,4) not null default 0,
  taxable_amount numeric(19,4) not null default 0,
  tax_rate numeric(9,4) null,
  tax_amount numeric(19,4) not null default 0,
  total_amount numeric(19,4) not null default 0,
  currency_code varchar(3) not null,
  currency_ex_rate numeric(18,6) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text null,
  created_info text null,
  updated_at timestamptz null,
  updated_by text null,
  updated_info text null,
  rec_status smallint not null default 1,
  rec_order integer null,
  rec_notes text null,
  is_active boolean not null default true,
  constraint org_invoice_lines_dtl_pkey primary key (id, tenant_org_id),
  constraint fk_invoice_lines_invoice foreign key (invoice_id, tenant_org_id)
    references public.org_invoice_mst (id, tenant_org_id) on delete cascade,
  constraint fk_invoice_lines_order foreign key (source_order_id)
    references public.org_orders_mst (id) on delete set null,
  constraint chk_invoice_line_type check (line_type in (
    'SERVICE','ITEM','ORDER_SUMMARY','CHARGE','DISCOUNT','TAX','DELIVERY',
    'EXPRESS','ROUNDING','MANUAL','CREDIT_MEMO','DEBIT_NOTE'
  )),
  constraint chk_invoice_line_amounts check (
    quantity >= 0 and unit_price >= 0 and subtotal_amount >= 0
    and discount_amount >= 0 and taxable_amount >= 0 and tax_amount >= 0
    and total_amount >= 0
  ),
  constraint uq_invoice_line_no unique (tenant_org_id, invoice_id, line_no)
);

create index if not exists idx_invoice_lines_invoice
on public.org_invoice_lines_dtl (tenant_org_id, invoice_id);

create index if not exists idx_invoice_lines_source_order
on public.org_invoice_lines_dtl (tenant_org_id, source_order_id);
```

---

# 4. New Table: `org_invoice_orders_dtl`

```sql
create table if not exists public.org_invoice_orders_dtl (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  invoice_id uuid not null,
  order_id uuid not null,
  order_total_amount numeric(19,4) not null default 0,
  invoiced_amount numeric(19,4) not null default 0,
  paid_before_invoice_amount numeric(19,4) not null default 0,
  credit_applied_before_invoice_amount numeric(19,4) not null default 0,
  outstanding_invoiced_amount numeric(19,4) not null default 0,
  allocation_policy text not null default 'REMAINING_ONLY',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text null,
  rec_status smallint not null default 1,
  constraint org_invoice_orders_dtl_pkey primary key (id, tenant_org_id),
  constraint fk_invoice_orders_invoice foreign key (invoice_id, tenant_org_id)
    references public.org_invoice_mst (id, tenant_org_id) on delete cascade,
  constraint fk_invoice_orders_order foreign key (order_id)
    references public.org_orders_mst (id) on delete restrict,
  constraint uq_invoice_orders unique (tenant_org_id, invoice_id, order_id),
  constraint chk_invoice_orders_amounts check (
    order_total_amount >= 0 and invoiced_amount >= 0
    and paid_before_invoice_amount >= 0
    and credit_applied_before_invoice_amount >= 0
    and outstanding_invoiced_amount >= 0
  ),
  constraint chk_invoice_order_allocation_policy check (allocation_policy in (
    'FULL_ORDER','REMAINING_ONLY','CUSTOM_AMOUNT'
  ))
);

create index if not exists idx_invoice_orders_invoice
on public.org_invoice_orders_dtl (tenant_org_id, invoice_id);

create index if not exists idx_invoice_orders_order
on public.org_invoice_orders_dtl (tenant_org_id, order_id);
```

---

# 5. New Table: `org_invoice_payments_dtl`

```sql
create table if not exists public.org_invoice_payments_dtl (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  invoice_id uuid not null,
  customer_id uuid not null,
  receipt_voucher_id uuid null,
  receipt_voucher_trx_line_id uuid null,
  payment_method_code varchar(50) null,
  paid_amount numeric(19,4) not null,
  currency_code varchar(3) not null,
  currency_ex_rate numeric(18,6) not null default 1,
  payment_status text not null default 'COMPLETED',
  paid_at timestamptz null,
  paid_by text null,
  allocation_status text not null default 'ALLOCATED',
  allocation_notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text null,
  rec_status smallint not null default 1,
  constraint org_invoice_payments_dtl_pkey primary key (id, tenant_org_id),
  constraint fk_invoice_payments_invoice foreign key (invoice_id, tenant_org_id)
    references public.org_invoice_mst (id, tenant_org_id) on delete cascade,
  constraint fk_invoice_payments_customer foreign key (customer_id)
    references public.org_customers_mst (id) on delete restrict,
  constraint fk_invoice_payments_method foreign key (payment_method_code)
    references public.sys_payment_method_cd (payment_method_code) on delete restrict,
  constraint fk_invoice_payments_voucher foreign key (receipt_voucher_id)
    references public.org_fin_vouchers_mst (id) on delete set null,
  constraint fk_invoice_payments_voucher_line foreign key (receipt_voucher_trx_line_id)
    references public.org_fin_voucher_trx_lines_dtl (id) on delete set null,
  constraint chk_invoice_payments_amount check (paid_amount > 0),
  constraint chk_invoice_payment_status check (payment_status in (
    'PENDING','PROCESSING','AUTHORIZED','COMPLETED','FAILED','CANCELLED',
    'REFUNDED','PARTIALLY_REFUNDED'
  )),
  constraint chk_invoice_allocation_status check (allocation_status in (
    'ALLOCATED','REVERSED','PARTIALLY_REVERSED','FAILED'
  ))
);

create index if not exists idx_invoice_payments_invoice
on public.org_invoice_payments_dtl (tenant_org_id, invoice_id);

create index if not exists idx_invoice_payments_voucher_line
on public.org_invoice_payments_dtl (tenant_org_id, receipt_voucher_trx_line_id);
```

---

# 6. New Table: `org_invoice_adjustments_dtl`

```sql
create table if not exists public.org_invoice_adjustments_dtl (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  invoice_id uuid not null,
  adjustment_type text not null,
  direction text not null,
  amount numeric(19,4) not null,
  reason text not null,
  approved_by text null,
  approved_at timestamptz null,
  source_voucher_id uuid null,
  source_voucher_trx_line_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text null,
  rec_status smallint not null default 1,
  constraint org_invoice_adjustments_dtl_pkey primary key (id, tenant_org_id),
  constraint fk_invoice_adjustments_invoice foreign key (invoice_id, tenant_org_id)
    references public.org_invoice_mst (id, tenant_org_id) on delete cascade,
  constraint fk_invoice_adjustments_voucher foreign key (source_voucher_id)
    references public.org_fin_vouchers_mst (id) on delete set null,
  constraint fk_invoice_adjustments_voucher_line foreign key (source_voucher_trx_line_id)
    references public.org_fin_voucher_trx_lines_dtl (id) on delete set null,
  constraint chk_invoice_adjustment_type check (adjustment_type in (
    'WRITE_OFF','ROUNDING','PENALTY','FINANCE_CHARGE','MANUAL_CORRECTION',
    'CREDIT_ADJUSTMENT','DEBIT_ADJUSTMENT'
  )),
  constraint chk_invoice_adjustment_direction check (direction in ('INCREASE','DECREASE')),
  constraint chk_invoice_adjustment_amount check (amount > 0)
);

create index if not exists idx_invoice_adjustments_invoice
on public.org_invoice_adjustments_dtl (tenant_org_id, invoice_id);
```

---

# 7. New Table: `org_invoice_status_history_dtl`

```sql
create table if not exists public.org_invoice_status_history_dtl (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  invoice_id uuid not null,
  old_status text null,
  new_status text not null,
  reason text null,
  changed_at timestamptz not null default now(),
  changed_by text null,
  changed_info text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint org_invoice_status_history_dtl_pkey primary key (id, tenant_org_id),
  constraint fk_invoice_status_history_invoice foreign key (invoice_id, tenant_org_id)
    references public.org_invoice_mst (id, tenant_org_id) on delete cascade
);

create index if not exists idx_invoice_status_history_invoice
on public.org_invoice_status_history_dtl (tenant_org_id, invoice_id, changed_at desc);
```

---

# 8. New Table: `org_customer_ar_ledger_dtl`

```sql
create table if not exists public.org_customer_ar_ledger_dtl (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_id uuid not null,
  ledger_date date not null default current_date,
  movement_type text not null,
  source_type text not null,
  source_id uuid not null,
  invoice_id uuid null,
  voucher_id uuid null,
  voucher_trx_line_id uuid null,
  debit_amount numeric(19,4) not null default 0,
  credit_amount numeric(19,4) not null default 0,
  balance_after_amount numeric(19,4) null,
  currency_code varchar(3) not null,
  currency_ex_rate numeric(18,6) not null default 1,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text null,
  rec_status smallint not null default 1,
  constraint org_customer_ar_ledger_dtl_pkey primary key (id, tenant_org_id),
  constraint fk_ar_ledger_customer foreign key (customer_id)
    references public.org_customers_mst (id) on delete restrict,
  constraint fk_ar_ledger_invoice foreign key (invoice_id, tenant_org_id)
    references public.org_invoice_mst (id, tenant_org_id) on delete set null,
  constraint fk_ar_ledger_voucher foreign key (voucher_id)
    references public.org_fin_vouchers_mst (id) on delete set null,
  constraint fk_ar_ledger_voucher_line foreign key (voucher_trx_line_id)
    references public.org_fin_voucher_trx_lines_dtl (id) on delete set null,
  constraint chk_ar_ledger_movement_type check (movement_type in (
    'INVOICE_ISSUED','INVOICE_PAYMENT','CREDIT_NOTE','DEBIT_NOTE','WRITE_OFF',
    'REFUND','ADJUSTMENT'
  )),
  constraint chk_ar_ledger_amounts check (debit_amount >= 0 and credit_amount >= 0)
);

create index if not exists idx_ar_ledger_customer_date
on public.org_customer_ar_ledger_dtl (tenant_org_id, customer_id, ledger_date desc);

create index if not exists idx_ar_ledger_invoice
on public.org_customer_ar_ledger_dtl (tenant_org_id, invoice_id);
```

---

# 9. Migration Safety Rules

```text
No DROP TABLE.
No DROP COLUMN.
No DROP FUNCTION CASCADE.
Use additive migrations.
Clean old data before adding constraints.
Do not assume all existing status values are uppercase.
Do not enforce NOT NULL currency_code until backfill is complete.
Do not add constraints until existing data passes validation.
```

---

# 10. Required Data Quality Checks Before Constraints

```sql
select status, count(*)
from public.org_invoice_mst
group by status;

select invoice_type_cd, count(*)
from public.org_invoice_mst
group by invoice_type_cd;

select count(*)
from public.org_invoice_mst
where currency_code is null;

select *
from public.org_invoice_mst
where coalesce(paid_amount,0) > coalesce(total,0);
```
