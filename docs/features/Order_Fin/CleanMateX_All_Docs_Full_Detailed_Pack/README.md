<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# CleanMateX Full Documentation Pack

## Purpose

This documentation pack is the source-of-truth foundation for evolving CleanMateX into a production-grade multi-tenant SaaS platform with strong order, financial, accounting, settlement, promotion, tax, loyalty, wallet, gift card, invoice/AR, reconciliation, and audit capabilities.

## Main Principle

The current checkout flow is treated as the stable transactional shell.

The migration strategy is:

```text
expand → dual-write → reconcile → switch-read → retire
```

## Folder Structure

```text
/architecture
/adr
/prd
/database
/api
/finance
/security
/migration
/reconciliation
/testing
/operations
/events
/errors
/ux
/ai-rules
```

## Highest-Priority Reading Order

1. `architecture/SYSTEM_OVERVIEW.md`
2. `architecture/TARGET_ARCHITECTURE.md`
3. `finance/DOMAIN_RULES.md`
4. `finance/FINANCIAL_FORMULAS.md`
5. `architecture/CHECKOUT_RUNTIME_FLOW.md`
6. `database/DB_ORDER_FINANCIAL_MODEL.md`
7. `migration/MIGRATION_STRATEGY.md`
8. `reconciliation/RECONCILIATION_STRATEGY.md`
9. `ai-rules/AI_ASSISTANT_RULES.md`

## Absolute No-Break Rules

```text
Do not rewrite checkout.
Do not remove AMOUNT_MISMATCH.
Do not trust frontend totals.
Do not treat gift card as discount.
Do not treat invoice as payment.
Do not remove legacy fields early.
Do not switch reads before reconciliation passes.
```
