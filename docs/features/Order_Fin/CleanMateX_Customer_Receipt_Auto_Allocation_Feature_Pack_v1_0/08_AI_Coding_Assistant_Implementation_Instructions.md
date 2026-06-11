# AI Coding Assistant Implementation Instructions

## Objective

Implement Customer Receipt Allocation / Auto Allocate Oldest Balances feature using this pack as the target specification.

## Required Workflow

```text
1. Inspect current DB schema.
2. Inspect existing BVM tables and voucher posting services.
3. Inspect existing order payment modal code.
4. Generate migration only for missing tables/columns/seeds.
5. Do not duplicate existing catalog records.
6. Do not add payment_target_type to org_order_payments_dtl.
7. Update constants and validation schemas.
8. Implement services and APIs.
9. Update UI.
10. Add tests.
11. Run build/typecheck/tests.
```

## Database Inspection Queries

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'org_customer_receipt_allocation_policy_cf',
    'org_customer_receipt_allocation_preview_tr',
    'sys_overpayment_resolution_cd',
    'sys_fin_voucher_line_role_cd',
    'org_fin_vouchers_mst',
    'org_fin_voucher_trx_lines_dtl',
    'org_order_payments_dtl',
    'org_invoice_mst'
  );
```

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = '<table_name>'
order by ordinal_position;
```

## Must Not Do

```text
Do not treat wallet/gift card as real payment.
Do not create org_order_payments_dtl for invoice payments.
Do not create org_order_payments_dtl for wallet top-up.
Do not silently accept unallocated excess.
Do not call card/gateway excess "change".
Do not allocate to old order if AR invoice already owns the balance.
Do not post partial allocation if policy disallows partial last target.
```

## Suggested New Files

```text
web-admin/lib/services/customer-receipt-allocation.service.ts
web-admin/lib/services/customer-receipt-allocation-policy.service.ts
web-admin/lib/services/customer-open-balance-query.service.ts
web-admin/lib/services/customer-receipt-posting.service.ts
web-admin/lib/validations/customer-receipt-allocation-schema.ts
web-admin/src/features/orders/ui/payment-modal/allocation/auto-allocation-preview-drawer.tsx
web-admin/src/features/orders/ui/payment-modal/allocation/manual-allocation-drawer.tsx
web-admin/src/features/orders/ui/payment-modal/cards/customer-receipt-allocation-card.tsx
web-admin/src/features/orders/constants/customer-receipt-allocation.constants.ts
```

## Final Acceptance Gate

```text
[ ] Auto allocation preview works.
[ ] Manual allocation works.
[ ] Posting creates one voucher with multiple lines.
[ ] Effects are posted to correct tables.
[ ] Cash drawer movement equals retained cash.
[ ] Invoice payment does not create order payment row.
[ ] Wallet top-up creates wallet ledger, not order payment.
[ ] Customer advance creates liability.
[ ] Unallocated excess blocks submit.
[ ] Tests pass.
[ ] Build passes.
```
