<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Database Order Financial Model

## 1. Core Tables

```text
org_orders_mst
org_order_items_dtl
org_order_item_pieces_dtl
org_order_preferences_dtl
```

## 2. Financial Fact Tables

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
org_order_financial_audit_log
```

## 3. Stored Value Tables

```text
org_gift_cards_mst
org_gift_card_txn_dtl
org_wallet_accounts_mst
org_wallet_txn_dtl
org_customer_advances_mst
org_customer_advance_txn_dtl
org_customer_credits_mst
org_customer_credit_txn_dtl
org_loyalty_accounts_mst
org_loyalty_txn_dtl
```

## 4. Summary vs Detail

`org_orders_mst` is a summary snapshot.

Source-of-truth detail tables:
- charges
- discounts
- taxes
- credit applications
- payments
- ledgers

## 5. Tenant Rule

Every `org_*` table must include:

```text
tenant_org_id
```

## 6. Index Standards

Recommended indexes:
- `(tenant_org_id, order_id)`
- `(tenant_org_id, customer_id)`
- `(tenant_org_id, branch_id)`
- `(tenant_org_id, created_at desc)`

## 7. Money Data Type

Use:

```text
numeric(19,4)
```
