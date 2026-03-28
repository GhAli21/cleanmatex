---
status: Superseded Review Artifact
superseded_by: ERP_LITE_FINANCE_CORE_RULES.md
last_updated: 2026-03-28
---

> Superseded review artifact.
> Do not use this file as the canonical finance control document.
> Use [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md) instead.

Below is the **missing control layer** your system needs.
This is the document that upgrades your design from *architecturally strong* → *audit-safe and production-grade*.

---

# 📄 ERP_LITE_FINANCE_CORE_RULES.md

```md
version: v1.0.0
status: REQUIRED_BEFORE_PHASE_0
owner: HQ Governance (cleanmatexsaas)
applies_to: All ERP-Lite tenants
last_updated: 2026-03-28
```

---

# 1. Purpose

This document defines the **non-negotiable financial control rules** governing ERP-Lite.

It ensures:

* accounting integrity
* auditability
* consistency across tenants
* safe auto-posting behavior
* prevention of financial data corruption

This document overrides any ambiguous behavior in PRDs or implementation plans.

---

# 2. Core Principles (Hard Rules)

## 2.1 Double Entry Integrity

Every journal must satisfy:

```text
Total Debit = Total Credit
```

Violation → **posting must fail**

---

## 2.2 Journal Immutability

Once a journal is POSTED:

```text
- It cannot be edited
- It cannot be deleted
- It cannot be overwritten
```

Corrections must be done via:

* reversal entry
* adjustment entry

---

## 2.3 Idempotent Posting (CRITICAL)

Each posting must be uniquely identified by:

```text
idempotency_key =
tenant_org_id + txn_event_code + source_doc_id
```

System must guarantee:

* same event cannot post twice
* retries do not duplicate journals

If duplicate detected:

```text
→ return existing journal OR reject execution
```

---

## 2.4 Source of Truth

Financial truth exists only in:

```text
GL journals
```

NOT in:

* invoices
* payments
* UI calculations

Reports must derive from GL.

---

# 3. Posting Lifecycle Model

## 3.1 Allowed States

```text
DRAFT → POSTED → REVERSED
      ↘ FAILED → RETRY → POSTED
```

---

## 3.2 State Definitions

### DRAFT

* pre-validation or preview
* not committed

### POSTED

* validated and committed
* immutable

### FAILED

* validation or execution error
* must be logged

### REVERSED

* reversed via linked reversal journal

---

## 3.3 Retry Rules

* allowed only for FAILED
* must use same idempotency key
* must log each attempt
* must not create duplicates

---

# 4. Auto-Post Policy Model

## 4.1 Policy Dimensions

Each transaction type must define:

* auto_post_enabled (true/false)
* blocking_mode (BLOCKING / NON_BLOCKING)
* retry_allowed (true/false)
* failure_action

---

## 4.2 Blocking Behavior (MANDATORY DEFINITION)

### BLOCKING

```text
If posting fails:
→ transaction must not complete
→ error returned to user/system
```

Used for:

* invoices
* payments
* refunds

---

### NON-BLOCKING

```text
If posting fails:
→ transaction succeeds
→ marked as FINANCE_EXCEPTION
→ visible in exception queue
```

Used for:

* low-risk operations
* optional entries

---

## 4.3 Failure Visibility

All failures must:

* be logged
* be queryable
* be visible in UI

Silent failure is forbidden.

---

# 5. VAT / Tax v1 Rules

## 5.1 Tax Model

v1 uses:

```text
Tax-Exclusive Model
```

Meaning:

```text
Net Amount + Tax = Gross Amount
```

---

## 5.2 Posting Rules

### Invoice

```text
Dr Accounts Receivable   → Gross
Cr Revenue               → Net
Cr VAT Payable           → Tax
```

---

### Refund

```text
Dr Revenue               → Net
Dr VAT Payable           → Tax
Cr Cash/Bank             → Gross
```

---

## 5.3 Rounding

* round to 2 decimal places
* rounding difference goes to:

  * rounding gain OR
  * rounding loss account

---

## 5.4 Scope Limitations

v1 does NOT support:

* multi-jurisdiction tax
* tax exemptions logic
* tax filing workflows

---

# 6. Chart of Accounts (COA) Governance

## 6.1 Tenant Permissions

Tenant CAN:

* create accounts under allowed groups
* rename accounts (non-system)
* deactivate unused accounts

---

## 6.2 Tenant Restrictions

Tenant CANNOT:

* create account types
* change account type of an account
* override debit/credit behavior
* delete accounts with transactions
* modify system-required accounts

---

## 6.3 Mandatory System Accounts

Each tenant must have:

* Accounts Receivable
* Revenue
* VAT Payable
* Cash / Bank
* Expense accounts

---

## 6.4 Control Accounts

System must enforce:

* AR account = control account
* AP account (future) = control account

Manual posting to control accounts may be restricted.

---

# 7. Reporting Assumptions (v1)

## 7.1 Accounting Basis

```text
Accrual basis for revenue
```

---

## 7.2 Revenue Recognition

* revenue recognized at invoice posting
* not at payment

---

## 7.3 Expense Recognition

* recognized at entry
* no accrual/deferral engine in v1

---

## 7.4 AR Aging

Derived from:

* invoice postings
* payment postings

Must reconcile with GL.

---

## 7.5 Financial Reports

Must be generated from:

* GL journals only

Includes:

* Trial Balance
* P&L
* Balance Sheet

---

# 8. Posting Validation Rules

Before posting:

## Must validate:

* debit = credit
* accounts exist and active
* account is postable
* tenant ownership
* required dimensions present
* tax code valid if used

---

## Must reject if:

* account inactive
* imbalance detected
* duplicate posting detected
* required field missing

---

# 9. Exception Handling Model

## 9.1 Exception Queue

System must maintain:

* failed postings
* retry status
* error reason
* source document reference

---

## 9.2 Repost Rules

Repost must:

* use same source reference
* create new posting attempt
* preserve audit trail

---

## 9.3 Audit Trail

Every posting attempt must log:

* payload
* rule used
* result
* timestamp
* user/system

---

# 10. Reversal Rules

## 10.1 Reversal Method

Reversal must:

* create new journal
* invert debit/credit

---

## 10.2 Linkage

Reversal journal must reference:

```text
original_journal_id
```

---

## 10.3 Restrictions

* original journal remains unchanged
* reversal must not be partial in v1

---

# 11. Security and Isolation

## 11.1 Tenant Isolation

All finance data must enforce:

```text
tenant_org_id isolation
```

---

## 11.2 RLS Enforcement

Database must enforce:

* tenant-level row access
* no cross-tenant access

---

# 12. Audit Requirements

System must guarantee:

* full traceability
* no silent failures
* no hidden posting logic
* reproducible financial state

---

# 13. Non-Negotiable Constraints

The system MUST NOT:

* allow duplicate postings
* allow editing posted journals
* allow imbalance
* allow hidden posting logic
* allow tenant override of accounting rules

---

# 14. Approval Requirement

This document must be:

* reviewed
* approved
* locked

before:

```text
Phase 0 execution starts
```

---

# 15. Bottom Line

This document defines the **financial integrity layer**.

Without it:

```text
System = Feature-complete but financially unsafe
```

With it:

```text
System = Audit-ready, scalable, enterprise-grade
```

````

---

# Executive Recommendation (Direct)

This is now the **missing 15%** that turns your system into a real ERP core.

### Your position now:

- Architecture ✔️  
- Governance ✔️  
- Execution plan ✔️  
- Control layer ✔️ (just created)

### What to do next:

1. Save this file into:
```text
docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md
````

2. Add to checklist:

```text
[ ] Approve ERP_LITE_FINANCE_CORE_RULES.md
```

3. Do NOT start Phase 0 until approved


