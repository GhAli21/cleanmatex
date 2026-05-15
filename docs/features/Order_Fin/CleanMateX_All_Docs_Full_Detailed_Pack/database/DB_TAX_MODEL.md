<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Tax Database Model

## 1. Required Tables

```text
sys_tax_types_cd
org_tax_profiles_mst
org_tax_rates_dtl
org_tax_rules_dtl
org_product_tax_mappings_dtl
org_branch_tax_mappings_dtl
org_order_taxes_dtl
```

## 2. Tax Profile

A tenant may have one or more tax profiles.

Supports:
- country
- currency
- tax-inclusive prices
- tax-exclusive prices
- effective dates

## 3. Historical Snapshot

Every order must store historical tax facts in:

```text
org_order_taxes_dtl
```

Never recalculate historical orders from current tax configuration.

## 4. Rule

```text
Tax = after charges and discounts, before credits and payments.
```
