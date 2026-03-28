---
status: Superseded Review Artifact
superseded_by: ERP_LITE_FINANCE_CORE_RULES.md
last_updated: 2026-03-28
---

> Superseded review artifact.
> Do not use this file as the canonical finance control document.
> Use [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md) instead.

Below is your **production-grade file** — structured, complete, and aligned with your CleanMateX architecture, ADRs, and implementation plans.

---

# 📄 ERP_LITE_FINANCE_CORE_RULES.md


```md
version: v1.0.0
status: REQUIRED_BEFORE_PHASE_0
owner: HQ Governance (cleanmatexsaas)
applies_to: All ERP-Lite tenants
last_updated: 2026-03-28
document_id: ERP_LITE_FINANCE_CORE_RULES_2026_03_28
```

---

# 1. Purpose

This document defines the **mandatory financial control layer** for ERP-Lite.

It ensures:

* accounting correctness
* auditability
* tenant consistency
* safe auto-posting behavior
* prevention of financial data corruption

This document overrides any ambiguity in PRDs, ADRs, or implementation plans.

---

# 2. Core Accounting Principles

## 2.1 Double Entry Integrity

Every journal must satisfy:

```
Total Debit = Total Credit
```

Violation → **posting MUST fail**

---

## 2.2 Journal Immutability

Once a journal reaches `POSTED` status:

* it **cannot be edited**
* it **cannot be deleted**
* it **cannot be overwritten**

Correction methods:

* reversal journal
* adjustment journal

---

## 2.3 Idempotent Posting (CRITICAL)

Each posting must be uniquely identified by:

```
idempotency_key =
tenant_org_id + txn_event_code + source_doc_id
```

System must guarantee:

* no duplicate posting for same event
* retries do not create duplicate journals

If duplicate detected:

* return existing journal OR
* reject execution

---

## 2.4 GL as Single Source of Truth

Financial truth must exist only in:

```
General Ledger (GL)
```

NOT in:

* invoices
* payments
* UI calculations

All reports must derive from GL.

---

# 3. Posting Lifecycle Model

## 3.1 Allowed States

```
DRAFT → POSTED → REVERSED
      ↘ FAILED → RETRY → POSTED
```

---

## 3.2 State Definitions

### DRAFT

* pre-validation / preview
* not persisted as final accounting

### POSTED

* validated and committed
* immutable

### FAILED

* validation or execution failure
* must be logged

### REVERSED

* reversed by linked journal

---

## 3.3 Retry Rules

* only allowed for FAILED
* must reuse idempotency key
* must not duplicate journals
* all attempts must be logged

---

# 4. Auto-Post Policy Model

## 4.1 Policy Dimensions

Each transaction type must define:

* auto_post_enabled
* blocking_mode (BLOCKING / NON_BLOCKING)
* retry_allowed
* failure_action

---

## 4.2 Blocking Mode

### BLOCKING

If posting fails:

* transaction MUST fail
* user/system receives error

Used for:

* invoices
* payments
* refunds

---

### NON-BLOCKING

If posting fails:

* transaction succeeds
* marked as `FINANCE_EXCEPTION`
* visible in exception queue

---

## 4.3 Failure Visibility

System MUST:

* log all failures
* expose failures in UI
* allow querying failures

Silent failure is strictly prohibited.

---

# 5. VAT / Tax v1 Rules

## 5.1 Tax Model

v1 uses:

```
Tax-Exclusive Model
```

```
Net + Tax = Gross
```

---

## 5.2 Invoice Posting

```
Dr Accounts Receivable   → Gross
Cr Revenue               → Net
Cr VAT Payable           → Tax
```

---

## 5.3 Refund Posting

```
Dr Revenue               → Net
Dr VAT Payable           → Tax
Cr Cash/Bank             → Gross
```

---

## 5.4 Rounding Rules

* round to 2 decimals
* difference goes to:

  * rounding gain OR
  * rounding loss account

---

## 5.5 v1 Tax Limitations

Not supported:

* multi-jurisdiction tax
* exemptions logic
* filing workflows
* complex tax scenarios

---

# 6. Chart of Accounts Governance

## 6.1 Tenant Permissions

Tenant CAN:

* create accounts under allowed groups
* rename non-system accounts
* deactivate unused accounts

---

## 6.2 Tenant Restrictions

Tenant CANNOT:

* create account types
* modify account type behavior
* delete accounts with transactions
* modify system-required accounts

---

## 6.3 Mandatory Accounts

Each tenant must have:

* Accounts Receivable
* Revenue
* VAT Payable
* Cash / Bank
* Expense accounts

---

## 6.4 Control Accounts

System must enforce:

* AR as control account
* AP (future) as control account

Manual posting may be restricted.

---

# 7. Reporting Assumptions (v1)

## 7.1 Accounting Basis

```
Accrual basis (for revenue)
```

---

## 7.2 Revenue Recognition

* recognized at invoice
* not at payment

---

## 7.3 Expense Recognition

* recognized at entry
* no accrual/deferral engine in v1

---

## 7.4 AR Aging

Derived from:

* invoices
* payments

Must reconcile with GL.

---

## 7.5 Financial Reports

All reports must use GL:

* Trial Balance
* P&L
* Balance Sheet

---

# 8. Posting Validation Rules

## Must validate before posting:

* debit = credit
* account exists and active
* account is postable
* tenant ownership
* required fields present
* tax code valid

---

## Must reject if:

* imbalance exists
* duplicate posting detected
* inactive account used
* required field missing

---

# 9. Exception Handling Model

## 9.1 Exception Queue

System must track:

* failed postings
* retry status
* error reason
* source reference

---

## 9.2 Repost Rules

Repost must:

* reuse source reference
* create new attempt
* maintain audit history

---

## 9.3 Audit Logging

Each attempt must log:

* payload
* mapping rule
* result
* timestamp
* user/system

---

# 10. Reversal Rules

## 10.1 Method

Reversal must:

* create new journal
* invert debit/credit

---

## 10.2 Link

Reversal must reference:

```
original_journal_id
```

---

## 10.3 Restrictions

* original journal remains unchanged
* no partial reversal in v1

---

# 11. Security and Isolation

## 11.1 Tenant Isolation

All finance data must include:

```
tenant_org_id
```

---

## 11.2 RLS Enforcement

Database must enforce:

* tenant-level access
* no cross-tenant data exposure

---

# 12. Audit Requirements

System must ensure:

* full traceability
* no silent failures
* deterministic results
* reproducible financial state

---

# 13. Non-Negotiable Constraints

System MUST NOT:

* allow duplicate posting
* allow editing posted journals
* allow imbalance
* allow hidden logic
* allow tenant override of accounting rules

---

# 14. Approval Requirement

This document MUST be:

* reviewed
* approved
* locked

before:

```
Phase 0 execution
```

---

# 15. Final Statement

Without this control layer:

```
System = Feature-rich but financially unsafe
```

With this control layer:

```
System = Audit-ready, scalable ERP foundation
```

```

---

# Strategic Recommendation (Direct)

You now have:

- PRD ✔️  
- ADRs ✔️  
- Implementation plan ✔️  
- Governance split ✔️  
- **Finance control layer ✔️ (this file)**  

### You are ready for:

👉 **Phase 0 — ONLY after formal approval of this file**

---

# Next High-Impact Move

If you want to go from *correct* → *elite level*:

I recommend next:

### 1. DB-Level Enforcement Layer
- constraints
- triggers
- check rules (debit=credit, immutability)

### 2. Posting Engine Guard Middleware
- centralized validation
- idempotency enforcement
- audit injection

### 3. Finance Test Pack
- edge cases:
  - partial payments
  - duplicate retries
  - refund after settlement
  - tax rounding

---

If you want, I can generate:

👉 Full **PostgreSQL constraints + triggers package**  
👉 Full **NestJS finance middleware layer**  
👉 Full **edge-case test scenarios suite**

That’s the final step to make this system **enterprise-grade (SAP-level discipline)**.
```
