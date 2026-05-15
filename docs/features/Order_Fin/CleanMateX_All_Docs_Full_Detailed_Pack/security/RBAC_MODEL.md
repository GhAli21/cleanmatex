<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# RBAC Model

## Permissions

```text
orders:create
orders:update
orders:confirm
orders:void
orders:close

order_pieces:update_status
order_pieces:mark_rejected
order_pieces:assign_rack

order_preferences:create
order_preferences:confirm
order_preferences:override_price

settlement:take_cash
settlement:take_card
settlement:apply_gift_card
settlement:apply_wallet
settlement:apply_customer_credit
settlement:refund

invoice:create
invoice:void

finance:post
finance:view_audit
reconciliation:run
```

## Rule

UI visibility is not security. Backend must enforce permissions.
