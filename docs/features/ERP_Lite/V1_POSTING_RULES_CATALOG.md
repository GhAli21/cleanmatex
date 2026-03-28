---
document_id: ERP_LITE_POSTING_RULES_CATALOG_001
title: ERP-Lite Posting Rules Catalog
version: "1.0"
status: Approved
approved_date: 2026-03-28
last_updated: 2026-03-28
author: CleanMateX AI Assistant
owner: HQ Governance (`cleanmatexsaas`)
applies_to: All ERP-Lite tenants
---

# ERP-Lite Posting Rules Catalog

## 1. Purpose

This catalog defines the debit/credit rules for all ERP-Lite transaction events across v1, v2, and v3 scopes.

It is the authoritative reference for:
- HQ rule package authoring (cleanmatexsaas)
- posting engine validation (cleanmatex)
- Finance team review before Phase 1B implementation

> **Gate:** V1 posting rules in §3 must be human-approved before mapping rule configuration begins in Phase 1B. V2 and V3 rules require a separate ADR approval before implementation.

---

## 2. Reading Guide

Each posting rule row describes:

| Column | Meaning |
|---|---|
| `Event Code` | The `txn_event_code` that triggers this journal entry |
| `Journal Description` | Human-readable description of what the journal represents |
| `DR Usage Code` | The usage code for the Debit side |
| `DR Amount Source` | Where the debit amount comes from in the posting payload |
| `CR Usage Code` | The usage code for the Credit side |
| `CR Amount Source` | Where the credit amount comes from in the posting payload |
| `VAT Line?` | Whether a separate VAT journal line is generated |

**Multi-line entries:** Some events generate more than one journal line (e.g. invoice has a net line + a VAT line). Each line is shown as a separate row with the same event code.

**Amount sources** match the canonical payload fields defined in Runtime Domain Contract §6.

---

## 3. V1 Posting Rules

### 3.1 Rules Table

> These 9 events are the complete v1 locked event catalog (Runtime Domain Contract §5).

| Event Code | Journal Description | DR Usage Code | DR Amount | CR Usage Code | CR Amount | VAT Line? |
|---|---|---|---|---|---|---|
| `ORDER_INVOICED` | Invoice — net revenue | `ACCOUNTS_RECEIVABLE` | `gross_amount` | `SALES_REVENUE` | `net_amount` | ✅ Yes |
| `ORDER_INVOICED` | Invoice — VAT line | `ACCOUNTS_RECEIVABLE` | _(included in gross above)_ | `VAT_OUTPUT` | `tax_amount` | _(is the VAT line)_ |
| `ORDER_SETTLED_CASH` | Cash settlement | `CASH_MAIN` | `gross_amount` | `ACCOUNTS_RECEIVABLE` | `gross_amount` | ❌ No |
| `ORDER_SETTLED_CARD` | Card settlement | `BANK_CARD_CLEARING` | `gross_amount` | `ACCOUNTS_RECEIVABLE` | `gross_amount` | ❌ No |
| `ORDER_SETTLED_WALLET` | Wallet settlement | `WALLET_CLEARING` | `gross_amount` | `ACCOUNTS_RECEIVABLE` | `gross_amount` | ❌ No |
| `PAYMENT_RECEIVED` | Standalone payment received | `CASH_MAIN` or `BANK_CARD_CLEARING` | `gross_amount` | `ACCOUNTS_RECEIVABLE` | `gross_amount` | ❌ No |
| `REFUND_ISSUED` | Refund — net reversal | `SALES_REVENUE` | `net_amount` | `ACCOUNTS_RECEIVABLE` | `gross_amount` | ✅ Yes |
| `REFUND_ISSUED` | Refund — VAT reversal | `VAT_OUTPUT` | `tax_amount` | `ACCOUNTS_RECEIVABLE` | _(included in gross above)_ | _(is the VAT reversal line)_ |
| `EXPENSE_RECORDED` | General expense recorded | `EXPENSE_GENERAL` | `gross_amount` | `CASH_MAIN` or `BANK_CARD_CLEARING` | `gross_amount` | ❌ No (v1) |
| `PETTY_CASH_TOPUP` | Petty cash fund topped up | `PETTY_CASH_MAIN` | `gross_amount` | `CASH_MAIN` | `gross_amount` | ❌ No |
| `PETTY_CASH_SPENT` | Petty cash spent | `PETTY_CASH_EXPENSE` | `gross_amount` | `PETTY_CASH_MAIN` | `gross_amount` | ❌ No |

### 3.2 Notes on Specific Rules

**ORDER_INVOICED:** The AR line carries the full `gross_amount` (net + tax). The credit side splits: `SALES_REVENUE` receives `net_amount`, `VAT_OUTPUT` receives `tax_amount`. Total debits = total credits.

**PAYMENT_RECEIVED vs ORDER_SETTLED_*:** `PAYMENT_RECEIVED` is a standalone payment event (e.g. partial payment or payment not tied to a direct settlement flow). ORDER_SETTLED_* events are settlement events triggered by order workflow completion. Both clear the AR balance.

**REFUND_ISSUED:** Reverses the invoice posting. DR side hits revenue and VAT accounts; CR reduces AR (or increases a refund payable if cash has already been returned).

**EXPENSE_RECORDED account source:** The credit account depends on how the expense was paid — cash or card. Rule must use conditional resolution (`PAYMENT_METHOD_MAP` or equivalent).

---

## 4. VAT Line Pattern

When a VAT line is generated, the posting engine produces **two journal lines** for the same event:

```text
Line 1 (Net):  DR ACCOUNTS_RECEIVABLE  gross_amount
               CR SALES_REVENUE        net_amount

Line 2 (VAT):  CR VAT_OUTPUT           tax_amount
```

Total DR = `gross_amount` = `net_amount + tax_amount` = Total CR. Journal is balanced.

> **Source:** FCR §5 (VAT / Tax v1 Rules), ADR-004 (Tax-Exclusive Model)

---

## 5. Zero-Tax Behavior

When `tax_amount = 0`:

- **No VAT journal line is generated**
- The posting engine must not create a zero-amount VAT line
- The `ACCOUNTS_RECEIVABLE` debit and `SALES_REVENUE` credit both equal `net_amount` (= `gross_amount` when tax = 0)

> **Source:** FCR §5.5 — Zero-Tax Behavior

---

## 6. V2 Planned Posting Rules

> **Status: Planned — not locked for implementation.**
> Anticipated for v2 scope. Each event requires a v2 ADR approval and updated governance package before implementation. DR/CR sketches below are indicative only.

| Event Code | Journal Description | DR Usage Code | CR Usage Code | VAT Line? | Notes |
|---|---|---|---|---|---|
| `DISCOUNT_APPLIED` | Order-level discount posted as expense | `DISCOUNT_EXPENSE` | `ACCOUNTS_RECEIVABLE` | ❌ No | Only if discounts reduce AR rather than net revenue |
| `LOYALTY_POINTS_REDEEMED` | Loyalty points redemption | `LOYALTY_LIABILITY` | `ACCOUNTS_RECEIVABLE` | ❌ No | Reduces AR by redemption value; liability was pre-accrued at earn time |
| `DELIVERY_CHARGE_INVOICED` | Delivery fee invoiced | `ACCOUNTS_RECEIVABLE` | `DELIVERY_REVENUE` | ✅ TBD | VAT treatment on delivery fees depends on tax jurisdiction rules — requires v2 ADR |
| `TIP_COLLECTED` | Gratuity collected | `CASH_MAIN` or `BANK_CARD_CLEARING` | `TIPS_INCOME` | ❌ No (v2 assumption) | Tips typically pass-through to staff; accounting treatment must be confirmed |
| `ADVANCE_PAYMENT_RECEIVED` | Customer advance / deposit received | `CASH_MAIN` or `BANK_CARD_CLEARING` | `ADVANCE_PAYMENT_RECEIVED` | ❌ No | Liability until applied to invoice; application event reduces liability and AR |

> **Gate:** All v2 posting rules require a v2 ADR and governance package version increment before Phase 2 mapping configuration.

---

## 7. V3 Planned Posting Rules

> **Status: Planned — subject to v3 scope confirmation.**
> Highly speculative until v3 scope is formally locked. A dedicated v3 ADR is required for each event. Do not implement without explicit written approval.

| Event Code | Journal Description | DR Usage Code | CR Usage Code | VAT Line? | Notes |
|---|---|---|---|---|---|
| `ADVANCE_PAYMENT_APPLIED` | Advance applied to invoice | `ADVANCE_PAYMENT_RECEIVED` | `ACCOUNTS_RECEIVABLE` | ❌ No | Clears the advance liability and reduces AR net of advance |
| `INTERCOMPANY_CHARGE` | Intercompany charge between branches/entities | `INTERCOMPANY_RECEIVABLE` | `INTERCOMPANY_PAYABLE` | TBD | Only relevant if multi-entity/multi-branch accounting is in v3 scope |
| `SUBSCRIPTION_INVOICED` | Subscription period invoiced | `ACCOUNTS_RECEIVABLE` | `DEFERRED_REVENUE` or `SUBSCRIPTION_REVENUE` | TBD | Depends on revenue recognition model — deferred vs immediate |
| `COGS_RECORDED` | Cost of sales recognized at fulfillment | `COST_OF_SALES` | Inventory or Accrued Cost account | ❌ No | Only relevant if inventory-linked COGS posting is in v3 scope |

> **Gate:** All v3 posting rules require a separate v3 scope document and ADR. No placeholder DB rows or mapping rules should be created without approval.

---

## 8. Approval Note

- V1 posting rules in §3 are approved as part of the v1.0 canonical document pack (2026-03-28)
- V1 rules must be reviewed by the project owner before mapping rule configuration begins in Phase 1B
- V2 and V3 entries in §6 and §7 are planning guides only — each requires a separate ADR approval before any rule authoring or DB configuration

---

## 9. Related Documents

- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md) — §5 Event catalog, §6 Posting request contract, §10 Amount resolution
- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md) — §5 VAT rules, §3 Core accounting rules
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md) — Mapping engine decision
- [ADR_004_VAT_TAX_V1_SCOPE.md](ADR_004_VAT_TAX_V1_SCOPE.md) — VAT v1 scope decision
- [ACCOUNT_USAGE_CODE_CATALOG.md](ACCOUNT_USAGE_CODE_CATALOG.md) — All usage codes referenced in this catalog
- [BLOCKING_POLICY_TABLE.md](BLOCKING_POLICY_TABLE.md) — Blocking/non-blocking policy per event
- [HQ_TENANT_RESPONSIBILITY_MATRIX.md](HQ_TENANT_RESPONSIBILITY_MATRIX.md) — Responsibility split for posting rules
