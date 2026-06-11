# Migration Generation Instructions v1.1

## Objective
Generate production-safe migration/code updates for CleanMateX payment, settlement, voucher, overpayment, and customer receipt allocation catalogs.

## Critical Rules
```text
1. Do not blindly execute the reference SQL.
2. Inspect current schema and data first.
3. Preserve existing data.
4. Do not duplicate tables, columns, or seed rows.
5. Do not add payment_target_type to org_order_payments_dtl.
6. Keep org_order_payments_dtl order-only.
7. Use org_fin_voucher_trx_lines_dtl.target_type and target_id for generic allocation targeting.
8. Add missing catalog tables, comments, constraints, indexes, and seeds idempotently.
```

## Required v1.1 Additions
```text
1. sys_fin_voucher_source_type_cd
2. sys_customer_receipt_allocation_mode_cd
3. sys_customer_receipt_fallback_destination_cd
4. org_customer_receipt_allocation_policy_cf
5. sys_overpayment_resolution_cd rows:
   - ALLOCATE_TO_CUSTOMER_BALANCES
   - AUTO_ALLOCATE_TO_CUSTOMER_BALANCES
6. sys_fin_voucher_target_type_cd row:
   - CUSTOMER_CREDIT
7. voucher source type rows:
   - CUSTOMER_RECEIPT
   - ACCOUNT_RECEIPT
   - POS_OVERPAYMENT_ALLOCATION
   - CUSTOMER_ACCOUNT_PAYMENT
   - ORDER_PAYMENT_MODAL
```

## Inspection Queries
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'sys_payment_method_cd','org_payment_methods_cf','sys_fin_direction_cd',
    'sys_fin_voucher_line_type_cd','sys_fin_voucher_line_role_cd',
    'sys_fin_voucher_target_type_cd','sys_fin_voucher_source_type_cd',
    'sys_credit_application_type_cd','sys_credit_application_status_cd',
    'sys_remaining_balance_policy_cd','sys_overpayment_resolution_cd',
    'sys_customer_receipt_allocation_mode_cd','sys_customer_receipt_fallback_destination_cd',
    'org_customer_receipt_allocation_policy_cf','sys_payment_status_cd',
    'sys_refund_source_type_cd','sys_tax_document_type_cd','sys_tax_document_status_cd'
  );
```

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = '<table_name>'
order by ordinal_position;
```

```sql
select conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on c.conrelid = t.oid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = '<table_name>';
```

## Existing Table Patch Strategy
If table exists, use:
```sql
alter table public.<table>
add column if not exists <column> <type>;
```

For constraints, do not drop blindly. Inspect existing constraint first. Add a new constraint with a unique name only when safe.

## Must Not Do
```text
Do not treat gift card/wallet/customer credit as real payment methods.
Do not create org_order_payments_dtl for invoice payments.
Do not create org_order_payments_dtl for wallet top-up.
Do not silently post excess without explicit allocation/fallback.
Do not allocate to old order if AR invoice already owns the balance.
```
