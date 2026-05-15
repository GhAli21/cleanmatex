<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Promotion Database Model

## 1. Naming Decision

Promotions are tenant-owned.

Use:

```text
org_promotions_mst
org_promotion_rules_dtl
org_promotion_eligibility_dtl
org_promotion_rewards_dtl
org_promotion_limits_dtl
org_promotion_exclusions_dtl
```

Use `sys_*` only for static code types.

## 2. Supported Promotion Results

| Result | Storage |
|---|---|
| Percent discount | `org_order_discounts_dtl` |
| Fixed discount | `org_order_discounts_dtl` |
| Free delivery | discount against delivery charge |
| Free item | item row marked free |
| Wallet cashback | `org_wallet_txn_dtl` |
| Gift card bonus | `org_gift_card_txn_dtl` |
| Loyalty points | `org_loyalty_txn_dtl` |
| Customer credit | `org_customer_credit_txn_dtl` |

## 3. Required Controls

- eligibility rules
- branch limits
- customer limits
- date windows
- usage limits
- budget limits
- stacking policy
- priority
- audit trail
