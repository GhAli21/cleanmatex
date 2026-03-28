---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_FINANCE_CORE_RULES_2026_03_28
status: Approved
approved_date: 2026-03-28
owner: HQ Governance (`cleanmatexsaas`)
applies_to: All ERP-Lite tenants
supersedes:
  - ERP_LITE_FINANCE_CORE_RULES_01.md
  - ERP_LITE_FINANCE_CORE_RULES_02.md
---

# ERP-Lite Finance Core Rules

## 1. Purpose

This document defines the non-negotiable financial control layer for ERP-Lite.

It exists to:
- enforce accounting correctness
- preserve auditability
- keep tenant behavior consistent under HQ governance
- make auto-post financially safe
- prevent ambiguous implementation by humans or AI

This document overrides ambiguous finance behavior in planning documents.

---

## 2. Document Hierarchy

Use the ERP-Lite document set in this order:

1. `CROSS_PROJECT_PRD.md`
   Defines business scope and cross-project ownership.
2. `ADR_00x_*.md`
   Defines architecture decisions and governance boundaries.
3. `ERP_LITE_FINANCE_CORE_RULES.md`
   Defines mandatory finance control rules and prohibited behavior.
4. `ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md`
   Defines runtime entities, lifecycles, request contract, and operational behavior.

If two documents appear to conflict:
- finance control rules win over planning language
- runtime contract wins over implementation interpretation

---

## 3. Core Accounting Rules

### 3.1 Double-Entry Integrity

Every journal must satisfy:

```text
Total Debit = Total Credit
```

Violation means posting must fail.

### 3.2 Journal Immutability

Once a journal reaches `POSTED`:
- it cannot be edited
- it cannot be deleted
- it cannot be overwritten
- it cannot be partially rewritten

Corrections are allowed only through:
- reversal journal
- future approved adjustment journal

### 3.3 Idempotent Posting

Each logical posting event must have one canonical idempotency key:

```text
{tenant_org_id}:{txn_event_code}:{source_doc_id}:{posting_version}
```

The system must guarantee:
- the same event does not post twice
- retries do not create duplicate journals
- duplicates either return the existing journal reference or reject execution with a controlled duplicate result

### 3.4 General Ledger as Source of Truth

Financial truth exists in the General Ledger only.

It must not be derived from:
- invoice table totals alone
- payment table totals alone
- UI calculations
- ad hoc report-side math that bypasses posted journals

### 3.5 Deterministic Rule Resolution

Posting rules must resolve deterministically.

If no rule matches, or more than one rule survives deterministic ranking:
- posting must fail
- an exception must be created
- no journal may be committed

---

## 4. Auto-Post Control Rules

### 4.1 Ownership

Auto-post runtime behavior policy is HQ-governed in `cleanmatexsaas`.

Tenant runtime in `cleanmatex` may:
- consume the published policy
- enforce the policy
- expose outcomes and exceptions

Tenant runtime may not redefine core posting behavior outside approved policy boundaries.

### 4.2 Policy Dimensions

Each transaction type must define:
- `auto_post_enabled`
- `blocking_mode`
- `required_success`
- `failure_action`
- `retry_allowed`
- `repost_allowed`

### 4.3 Blocking Behavior

#### `BLOCKING`

If posting fails:
- the business transaction must not complete as successful
- the user or calling process must receive a visible failure outcome

Default v1 blocking transaction types:
- invoice
- payment
- refund

#### `NON_BLOCKING`

If posting fails:
- the business transaction may complete
- the transaction must enter a visible finance exception path
- the failure must appear in the exception queue

### 4.4 Silent Failure Is Prohibited

All posting failures must be:
- logged
- queryable
- visible in runtime operations

Silent finance failure is prohibited.

---

## 5. VAT / Tax v1 Rules

### 5.1 Tax Model

v1 uses:

```text
Tax-Exclusive Model
Net Amount + Tax Amount = Gross Amount
```

### 5.2 Tax Scope

v1 supports:
- simple VAT/tax codes or rates
- tax account mapping
- output VAT separation from revenue
- input VAT readiness where applicable for future extension
- tax visibility in finance reports

v1 does not support:
- multi-jurisdiction tax engines
- exemption workflows
- tax filing workflows
- advanced tax compliance engines

### 5.3 Posting Treatment

Example invoice:

```text
Dr Accounts Receivable   → Gross
Cr Revenue               → Net
Cr VAT Payable           → Tax
```

Example refund:

```text
Dr Revenue               → Net
Dr VAT Payable           → Tax
Cr Cash/Bank             → Gross
```

### 5.4 Rounding

v1 uses:
- rounding to 2 decimal places
- document-level rounding control unless a stricter line-level rule is later approved

Any rounding difference must post to:
- rounding gain account, or
- rounding loss account

### 5.5 Zero-Tax Behavior

If a document is zero-tax:
- tax amount must resolve to zero
- no non-zero tax line may be posted
- revenue must not be distorted by placeholder tax entries

---

## 6. Chart of Accounts Governance

### 6.1 Tenant Permissions

Tenant may:
- create accounts under allowed governed structures
- rename non-system accounts
- deactivate unused non-system accounts
- map HQ-defined usage codes to tenant-owned accounts

### 6.2 Tenant Restrictions

Tenant may not:
- create account types
- change an account's governed account type outside approved rules
- override natural debit/credit behavior
- delete accounts with transactions
- modify system-required or system-linked accounts directly
- edit posted journals

### 6.3 Mandatory System-Linked Accounts

Each tenant must have configured accounts for at least:
- Accounts Receivable
- Revenue
- VAT Payable
- Cash and/or Bank
- Expense accounts
- Petty cash if petty cash is enabled

### 6.4 Control Accounts

The system must enforce:
- AR as a control account
- AP as a future control account

Manual posting to control accounts may be restricted by policy.

---

## 7. Reporting Assumptions

### 7.1 Accounting Basis

v1 uses:

```text
Accrual basis for revenue
```

### 7.2 Revenue Recognition

Revenue is recognized at invoice posting, not at payment.

### 7.3 Expense Recognition

Expenses are recognized at approved entry/posting in v1.

v1 does not include:
- advanced accruals
- deferrals
- period-end adjustment engine

### 7.4 AR Aging

AR aging must be derived from finance-controlled logic based on posted invoice and payment effects and must reconcile to GL and control-account behavior.

### 7.5 Report Source of Truth

- Trial Balance → GL journals only
- Profit and Loss → GL journals only
- Balance Sheet → GL journals only
- AR Aging → finance-controlled receivables logic that reconciles to GL/control-account outputs

### 7.6 Opening Balances

Go-live into ERP-Lite requires controlled opening balances where historical balances must be carried forward.

Opening balance treatment must be:
- explicitly approved
- auditable
- posted in a controlled opening-balance process

---

## 8. Posting Validation Rules

Before posting, the system must validate:
- debit equals credit
- account exists
- account belongs to tenant
- account is active
- account is postable
- required source fields are present
- required dimensions are present if configured
- tax code is valid if tax is used
- posting period is open
- idempotency key is valid

Posting must be rejected if:
- imbalance exists
- duplicate posting is detected
- account is inactive
- account is not postable
- required field is missing
- required usage mapping is missing
- posting period is closed

---

## 9. Exception, Retry, and Repost Rules

### 9.1 Exception Visibility

Failed postings must appear in an exception queue with:
- error reason
- source reference
- retry/repost status
- audit trace to the posting attempt

### 9.2 Retry

Retry means:
- same logical event
- same idempotency key
- new attempt recorded in audit history
- no duplicate journal creation

### 9.3 Repost

Repost means:
- controlled new execution after a fix, configuration correction, or policy-aligned remediation
- same business source reference remains linked
- new posting attempt is created and logged
- full audit history is preserved

### 9.4 Authorization

Retry and repost must be permission-controlled and fully auditable.

---

## 10. Reversal Rules

Reversal must:
- create a new journal
- invert debit/credit effect
- reference the original journal

v1 restrictions:
- no partial reversal
- original journal remains unchanged
- reversal still requires valid posting controls and an open accounting period unless a future controlled override is approved

---

## 11. Security and Isolation

All runtime finance data must:
- include `tenant_org_id`
- enforce tenant isolation
- follow RLS in `cleanmatex`
- avoid cross-tenant exposure

Cross-tenant governance behavior belongs only to the HQ side in `cleanmatexsaas`.

---

## 12. AI Implementation Guardrails

AI-generated implementation must not:
- invent new event codes
- invent new status values
- bypass tenant isolation
- hardcode posting logic in UI
- infer missing governance behavior
- override control rules for convenience

If a required behavior is not defined here or in the runtime contract, implementation must pause for clarification instead of inventing logic.

---

## 13. Approval Requirement

This document must be:
- reviewed
- approved
- locked

before:
- Phase 0 implementation starts

---

## Approval Notes

Document reviewed and approved as the canonical finance control layer for ERP-Lite v1. Key decisions confirmed: (1) 4-part idempotency key (`tenant_org_id + source_module + source_ref_id + event_type`) is the approved format — aligns with Runtime Domain Contract §8; (2) BLOCKING is the default mode for invoice, payment, and refund transactions — any deviation is a policy exception requiring explicit approval; (3) zero-tax behavior must not generate incorrect VAT journal lines — this is a validation rule, not optional; (4) accrual basis accounting with revenue recognized at invoice creation is the approved reporting assumption for v1; (5) opening balances are manual-entry only for v1 — no automated migration tooling in scope. AI guardrails in §12 are binding implementation constraints. — by Claude Sonnet 4.6

