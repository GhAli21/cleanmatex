<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Rounding Rules

## 1. Purpose

Rounding must be deterministic and configurable by currency and context.

## 2. Rounding Contexts

```text
CASH
CARD
INVOICE
TAX
DISPLAY
```

## 3. Rounding Config Table

```text
sys_currency_rounding_rules_cd
```

Fields:
- currency_code
- rounding_context
- rounding_mode
- rounding_increment
- decimal_places
- is_active
- effective_from
- effective_to

## 4. Cash Change

Cash payment may include:

```text
tendered_amount
change_returned_amount
```

Card/bank/gateway payments should not return cash change.

## 5. Rule

Rounding adjustment must be stored separately:

```text
rounding_adjustment_amount
```

Never silently hide rounding inside discounts or charges.
