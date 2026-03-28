---
document_id: HQ-TENANT-MATRIX-001
title: HQ vs Tenant Responsibility Matrix — ERP Lite Accounting
version: "1.0"
status: Approved
approved_date: 2026-03-28
last_updated: 2026-03-28
---

# 📊 HQ vs Tenant Responsibility Matrix (Finance Engine)

## 1) High-Level Operating Model

> **HQ governs logic**
> **Tenant owns accounts**
> **Runtime combines both**

---

# 2) Responsibility Matrix

| Component                        | HQ (CleanMateXSaaS)             | Tenant (CleanMateX)              | Notes                                  |
| -------------------------------- | ------------------------------- | -------------------------------- | -------------------------------------- |
| **Account Types**                | ✅ Define & lock                 | ❌ No control                     | Immutable (Asset, Liability, etc.)     |
| **Account Groups / Hierarchy**   | ✅ Define                        | ❌ No control                     | Used for reporting structure           |
| **Event Catalog**                | ✅ Define                        | ❌ No control                     | ORDER_INVOICED, PAYMENT_RECEIVED, etc. |
| **Mapping Rule Logic**           | ✅ Define                        | ❌ Cannot change core logic       | Debit/Credit structure locked          |
| **Mapping Rule Versions**        | ✅ Version & publish             | ❌ No control                     | Full governance                        |
| **Rule Assignment to Tenants**   | ✅ Assign (optional auto-assign) | ❌ Cannot override                | Can be global or selective             |
| **Usage Code Catalog**           | ✅ Define                        | ❌ No control                     | SALES_REVENUE, VAT_OUTPUT, etc.        |
| **Chart of Accounts (COA)**      | ❌ No direct control             | ✅ Full ownership                 | Tenant-specific accounts               |
| **Account Creation**             | ❌                               | ✅                                | Within constraints                     |
| **Usage Code → Account Mapping** | ❌                               | ✅ Required                       | Critical tenant responsibility         |
| **Branch-level Account Mapping** | ❌                               | ✅                                | Optional per tenant                    |
| **Rule Activation**              | ⚠️ Can auto-activate            | ✅ Must validate readiness        | Depends on strategy                    |
| **Posting Engine**               | ✅ Define behavior               | ❌ No logic control               | Runtime service                        |
| **Auto-Post Policy**             | ✅ Define rules                  | ⚠️ Limited override (if allowed) | e.g., enable/disable                   |
| **Exception Handling Policy**    | ✅ Define lifecycle              | ❌ Cannot change model            | Tenant interacts via UI                |
| **Retry/Repost Actions**         | ❌                               | ✅ Execute                        | Based on permissions                   |
| **Journal Entries**              | ❌                               | ✅ Generated automatically        | Immutable after posting                |
| **Journal Editing**              | ❌                               | ❌ Not allowed                    | Only reversal                          |
| **Reversal Rules**               | ✅ Define                        | ❌ Cannot change logic            | Runtime executes                       |
| **Accounting Period Control**    | ⚠️ Define policy                | ✅ Operate periods                | Open/close periods                     |
| **VAT/Tax Rules (v1)**           | ✅ Define model                  | ⚠️ Configure codes               | Simple mapping only                    |
| **Reports (TB, P&L, BS)**        | ✅ Define structure              | ❌ No logic control               | Based on journals                      |
| **AR Aging Logic**               | ✅ Define logic                  | ❌ No logic control               | Tenant views only                      |
| **Governance Publishing**        | ✅ Publish versions              | ❌ Consume only                   | Versioned packages                     |
| **Audit & Logging Model**        | ✅ Define                        | ❌ Cannot alter                   | Mandatory                              |
| **Permissions Model**            | ✅ Define                        | ⚠️ Assign roles                  | RBAC                                   |

---

# 3) Governance vs Runtime Flow

## Step-by-step model

### Step 1 — HQ defines

* Event: `ORDER_SETTLED_CARD`
* Rule:

  * Dr `BANK_CARD_CLEARING`
  * Cr `SALES_REVENUE`
  * Cr `VAT_OUTPUT`

### Step 2 — HQ publishes

* Version: v1
* Assigned to: all tenants or selected tenants

### Step 3 — Tenant configures

Tenant maps:

* `BANK_CARD_CLEARING` → 110210
* `SALES_REVENUE` → 410100
* `VAT_OUTPUT` → 210310

### Step 4 — Tenant activates

* System validates mapping completeness
* Rule becomes usable

### Step 5 — Runtime executes

* Event triggered
* Rule resolved
* Accounts resolved via tenant mapping
* Journal created

---

# 4) Enforcement Rules (Critical)

## HQ enforcement

* Cannot publish invalid rules
* Cannot reference tenant accounts directly
* Must use usage codes / resolution logic
* Must version all rule changes

---

## Tenant enforcement

* Cannot activate rule if:

  * usage codes not mapped
  * required accounts missing
* Cannot edit rule logic
* Cannot post without valid configuration

---

## Runtime enforcement

* Must fail if:

  * no rule found → `RULE_NOT_FOUND`
  * multiple rules → `AMBIGUOUS_RULE`
  * account missing → `ACCOUNT_NOT_FOUND`
* Must log every attempt
* Must enforce idempotency

---

# 5) Publish Model (Enterprise Pattern)

## HQ publishes package

Example:

```text
FINANCE_RULE_PACKAGE_V1
- Event Catalog v1
- Mapping Rules v1
- Usage Codes v1
- Auto-post Policy v1
```

## Tenant receives

Tenant:

* downloads package
* maps accounts
* activates

---

# 6) Two Operating Modes (Choose One)

## Mode A — Fully Managed (Centralized)

HQ:

* assigns rules
* preconfigures mappings (optional)

Tenant:

* minimal involvement

### Use when:

* small tenants
* controlled onboarding

---

## Mode B — Semi-Autonomous (Recommended)

HQ:

* publishes rules

Tenant:

* maps accounts
* activates rules

### Use when:

* scalable SaaS
* multi-region
* diverse accounting setups

---

# 7) Anti-Patterns (Must Avoid)

❌ HQ storing tenant account IDs
❌ Tenant editing debit/credit logic
❌ Hardcoding accounts in code
❌ Posting without mapping validation
❌ Allowing multiple active conflicting rules
❌ Editing posted journals

---

# 8) Final Governance Statement (Put in PRD)

> The finance system operates on a strict separation of concerns:
>
> * HQ defines and governs accounting logic, event structures, and mapping rules.
> * Tenants define and manage their chart of accounts and map system usage codes to their accounts.
> * The runtime engine combines HQ-defined rules with tenant-defined account mappings to generate accounting entries.
>
> No tenant is allowed to alter core accounting logic, and no HQ rule may directly reference tenant-specific accounts.

---

# 9) Final Verdict

Your model is now:

✅ Scalable
✅ Governed
✅ Multi-tenant safe
✅ Finance-compliant
✅ SaaS-ready

---

## Related Documents

- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md) — HQ-governed account type model
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md) — Config-driven mapping engine decisions
- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md) — Canonical finance control rules
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md) — Runtime entity and behavior contracts
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md) — Governance package publishing model
