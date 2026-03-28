---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_APPROVAL_CHECKLIST_FOR_PHASE_0_2026_03_28
status: Approved
approved_date: 2026-03-28
---

# Approval Checklist for Phase 0

## 1. Purpose

This checklist is the minimum approval gate required before starting Phase 0 of ERP-Lite implementation planning and shell setup.

Use this document to approve item by item.

---

## 2. Required Approval Items

### 2.1 Cross-Project Product Approval

- [ ] Approve [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

Meaning:

- ERP-Lite is a cross-project feature
- `cleanmatexsaas` owns HQ governance
- `cleanmatex` owns tenant runtime
- v1/v2/v3 direction is accepted

---

### 2.2 Account Type Governance Approval

- [ ] Approve [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)

Meaning:

- account types are HQ-governed
- tenants cannot create custom account types
- tenants cannot override debit/credit behavior
- tenant COA is tenant-owned but policy-constrained

---

### 2.3 Posting Engine and Mapping Governance Approval

- [ ] Approve [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md)

Meaning:

- posting uses a config-driven engine
- mappings support conditions
- mappings support multi-line entries
- mappings are versioned
- every execution is auditable
- mapping logic is never hardcoded in UI

---

### 2.4 Auto-Post Policy Approval

- [ ] Approve [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)

Meaning:

- auto-post is policy-driven per transaction type
- auto-post runtime behavior configuration is platform-level
- failed postings must be visible
- retry/repost is required
- blocking vs non-blocking behavior must be supported

---

### 2.5 VAT / Tax v1 Approval

- [ ] Approve [ADR_004_VAT_TAX_V1_SCOPE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_004_VAT_TAX_V1_SCOPE.md)

Meaning:

- v1 includes simple VAT/tax support
- v1 does not include full tax compliance or filing

---

### 2.6 V1 Scope Approval

- [ ] Approve [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)

Meaning:

- v1 includes:
  - COA
  - GL
  - posting engine
  - auto-post
  - exception/repost
  - simple VAT/tax
  - AR aging
  - trial balance
  - P&L
  - balance sheet
  - basic expenses
  - basic petty cash

---

### 2.7 Project Split Approval

- [ ] Approve [CLEANMATEX_RUNTIME_IMPLEMENTATION_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CLEANMATEX_RUNTIME_IMPLEMENTATION_PLAN.md)
- [ ] Approve [CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md)

Meaning:

- runtime and governance work are separated correctly
- auto-post policy governance remains HQ-owned
- runtime only executes policy

---

### 2.8 Execution Model Approval

- [ ] Approve [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)
- [ ] Approve [ROADMAP_TASK_BY_TASK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ROADMAP_TASK_BY_TASK.md)

Meaning:

- AI-assisted delivery model is accepted
- human review gates are accepted
- task-by-task phased execution is accepted

---

### 2.9 Operational Freeze Items Before Phase 0

- [ ] Approve [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ ] Approve [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

Meaning:

- finance control rules are frozen
- runtime entity and lifecycle contract is frozen
- v1 event catalog is frozen
- posting, retry, repost, and exception behavior is frozen
- report source-of-truth assumptions are frozen

### 2.10 Operational Freeze Checklist

- [ ] source transaction event catalog is approved
- [ ] minimum v1 posting rules are approved
- [ ] immutable journal policy is approved
- [ ] exception status lifecycle is approved
- [ ] tenant COA constraints are approved
- [ ] VAT v1 handling model is approved
- [ ] reporting basis and source-of-truth rules are approved

If any of the above remain open, implementation should not start.

---

## 3. Minimum Approval Set to Start Phase 0

If you want the smallest set required to begin Phase 0 checklist creation, approve at least these:

- [ ] Cross-project PRD
- [ ] ADR-001
- [ ] ADR-002
- [ ] ADR-003
- [ ] ADR-004
- [ ] ERP_LITE_FINANCE_CORE_RULES
- [ ] ERP_LITE_RUNTIME_DOMAIN_CONTRACT

This is enough to start Phase 0 checklist drafting.

---

## 4. Do Not Start Phase 0 If Any of These Are Still Open

- [ ] ownership of account types is unclear
- [ ] ownership of auto-post policy is unclear
- [ ] tenant customization boundaries are unclear
- [ ] VAT/tax v1 inclusion is unclear
- [ ] v1 expenses/petty cash inclusion is unclear
- [ ] retry/repost requirement is unclear
- [ ] runtime domain contract is not approved
- [ ] finance core rules are not approved
- [ ] event catalog is not frozen
- [ ] reporting source-of-truth rules are not frozen

If any of the above remain unresolved, Phase 0 should be paused.

---

## 5. Approval Result

### Option A: Full Approval

- [x] Full approval granted for all items above

Meaning:

- Phase 0 checklist creation can start immediately

### Option B: Partial Approval

- [ ] Partial approval granted

Required note:

- list exactly which items are approved
- list exactly which items need revision

### Option C: Not Approved Yet

- [ ] Not approved yet

Required note:

- list blocking concerns

---

## 6. Recorded Approval Note

Approval recorded on `2026-03-28`.

Decision:

- ERP-Lite v1.0 planning and architecture pack is approved
- Phase 0 checklist creation can start immediately
- approval applies to the canonical approval pack only
