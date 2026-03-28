---
document_id: ERP_LITE_ACCOUNT_USAGE_CODE_CATALOG_001
title: ERP-Lite Account Usage Code Catalog
version: "1.0"
status: Approved
approved_date: 2026-03-28
last_updated: 2026-03-28
author: CleanMateX AI Assistant
owner: HQ Governance (`cleanmatexsaas`)
applies_to: All ERP-Lite tenants
---

# ERP-Lite Account Usage Code Catalog

## 1. Purpose

This catalog defines all account usage codes for ERP-Lite across v1, v2, and v3 scopes.

Usage codes are the bridge between HQ-governed mapping rules and tenant-owned chart of accounts. A usage code identifies the **semantic role** of an account in the posting engine without referencing a specific tenant account ID.

This catalog is the authoritative reference for:
- mapping rule authoring (cleanmatexsaas)
- posting engine account resolution (cleanmatex)
- tenant account setup and validation

---

## 2. How Usage Codes Work

When HQ authors a mapping rule, it references usage codes — not tenant account IDs.

At runtime, the posting engine resolves each usage code to a concrete tenant account by looking up the tenant's account mapping table. This allows one HQ rule package to serve all tenants regardless of their specific COA structure.

**Activation rule:** A tenant cannot activate a governance rule package unless all required usage codes listed in §3 are mapped to valid, active, postable tenant accounts.

---

## 3. V1 Required Usage Codes

The following usage codes are **required** for ERP-Lite v1 go-live. All must be mapped before a rule package can be activated.

| Usage Code | Display Name | Account Type Family | Normal Balance | Required | HQ-Governed |
|---|---|---|---|---|---|
| `SALES_REVENUE` | Sales Revenue | Revenue | Credit | ✅ Yes | ✅ Yes |
| `VAT_OUTPUT` | Output VAT (Sales Tax Payable) | Liability | Credit | ✅ Yes | ✅ Yes |
| `VAT_INPUT` | Input VAT (Purchases Tax Recoverable) | Asset | Debit | ✅ Yes | ✅ Yes |
| `ACCOUNTS_RECEIVABLE` | Accounts Receivable | Asset | Debit | ✅ Yes | ✅ Yes |
| `CASH_MAIN` | Cash — Main (Cash Register) | Asset | Debit | ✅ Yes | ✅ Yes |
| `BANK_CARD_CLEARING` | Bank Card Clearing (POS Settlements) | Asset | Debit | ✅ Yes | ✅ Yes |
| `PETTY_CASH_MAIN` | Petty Cash — Main | Asset | Debit | ✅ Yes | ✅ Yes |

> **Source:** Runtime Domain Contract §4.4, HQ vs Tenant Responsibility Matrix §3

---

## 4. V1 Optional Usage Codes

The following usage codes may be mapped if the tenant's COA and operations require them. They are not blocking for package activation but must be mapped if referenced by any active rule.

| Usage Code | Display Name | Account Type Family | Normal Balance | HQ-Governed | Notes |
|---|---|---|---|---|---|
| `WALLET_CLEARING` | Customer Wallet Clearing | Liability | Credit | ✅ Yes | Required if ORDER_SETTLED_WALLET is used |
| `REFUND_PAYABLE` | Refund Payable | Liability | Credit | ✅ Yes | Required if REFUND_ISSUED event is active |
| `EXPENSE_GENERAL` | General Operating Expense | Expense | Debit | ✅ Yes | Required if EXPENSE_RECORDED event is active |
| `PETTY_CASH_EXPENSE` | Petty Cash Expense | Expense | Debit | ✅ Yes | Required if PETTY_CASH_SPENT event is active |
| `ROUNDING_ADJUSTMENT` | Rounding Adjustment | Income/Expense | Either | ✅ Yes | Required if rounding amount is non-zero |

---

## 5. V2 Planned Usage Codes

> **Status: Planned — not locked for implementation.**
> These codes are anticipated for v2 scope based on ROADMAP_TASK_BY_TASK.md. Each must be formally locked in a v2 ADR or controlled scope document before implementation begins.

| Usage Code | Display Name | Account Type Family | Normal Balance | Notes |
|---|---|---|---|---|
| `DISCOUNT_EXPENSE` | Sales Discount Expense | Expense | Debit | Required if order-level or item-level discounts generate a separate accounting line |
| `LOYALTY_LIABILITY` | Customer Loyalty Points Liability | Liability | Credit | Required if loyalty points redeemed generate a financial obligation |
| `DELIVERY_REVENUE` | Delivery Fee Revenue | Revenue | Credit | Required if delivery charges are recognized as separate revenue |
| `TIPS_INCOME` | Tips / Gratuity Income | Revenue | Credit | Required if tips collected are posted as income |
| `ADVANCE_PAYMENT_RECEIVED` | Customer Advance / Deposit Received | Liability | Credit | Required if customer prepayments are accepted and held as a liability until applied |
| `SERVICE_FEE_REVENUE` | Service Fee Revenue | Revenue | Credit | Required if platform-level service fees are invoiced to tenants and require a distinct revenue line |

> **Gate:** V2 usage codes require a v2 ADR approval and updated rule package version before tenants can map or use them.

---

## 6. V3 Planned Usage Codes

> **Status: Planned — subject to v3 scope confirmation.**
> These codes are anticipated for advanced v3 features. They are speculative until v3 scope is formally locked. A separate ADR is required before implementation.

| Usage Code | Display Name | Account Type Family | Normal Balance | Notes |
|---|---|---|---|---|
| `DEFERRED_REVENUE` | Deferred Revenue | Liability | Credit | Required if revenue recognition is deferred beyond invoice date (e.g. subscription or package deals) |
| `ADVANCE_PAYMENT_LIABILITY` | Advance Payment Liability (long-term) | Liability | Credit | Required if advance payments require distinction from short-term customer deposits |
| `INTERCOMPANY_RECEIVABLE` | Intercompany Receivable | Asset | Debit | Required only if multi-branch or multi-entity transactions are in scope for v3 |
| `INTERCOMPANY_PAYABLE` | Intercompany Payable | Liability | Credit | Counterpart to INTERCOMPANY_RECEIVABLE |
| `SUBSCRIPTION_REVENUE` | Subscription / Package Revenue | Revenue | Credit | Required if time-based subscription billing is introduced |
| `COST_OF_SALES` | Cost of Sales | Cost | Debit | Required if inventory-linked COGS posting is introduced in v3 |

> **Gate:** V3 usage codes require a dedicated v3 scope document and ADR before any implementation. Do not implement without explicit written approval.

---

## 7. Activation Rule

A tenant **cannot activate** a governance rule package until:

1. All **required** usage codes in §3 are mapped to valid tenant accounts
2. All usage codes referenced by any **active rule line** in the package are mapped
3. All mapped accounts are: active, postable, and correctly typed for the expected account type family

The posting engine must validate mapping completeness at activation time and reject incomplete setups.

---

## 8. Related Documents

- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md) — §4.4 Usage Code list, §11 Account Resolution Contract
- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md) — §6.3 Mandatory system-linked accounts
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md) — Account type governance model
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md) — Mapping engine and usage code resolution rules
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md) — HQ vs tenant account ownership split
- [V1_POSTING_RULES_CATALOG.md](V1_POSTING_RULES_CATALOG.md) — How usage codes are used in posting rules
- [ROADMAP_TASK_BY_TASK.md](ROADMAP_TASK_BY_TASK.md) — Phase roadmap that informed v2/v3 planned codes
