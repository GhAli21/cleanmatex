---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_2_HQ_GOV_EXEC_PKG_2026_03_28
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Migration Source of Truth)
---

# ERP-Lite Phase 2 HQ Governance Execution Package

## 1. Purpose

This document is the implementation-ready package for `Phase 2: HQ Governance Foundation`.

It defines:

- exact Phase 2 scope
- exact migration group names
- exact governance catalogs to create
- exact package/rule/policy model boundaries
- project-by-project implementation ownership
- the status of current Phase 2 migration drafts

Phase 2 must remain governance foundation only.

## 1.1 Current Status

Current status: `Drafted / review required`

Current implementation note:

- migrations `0179` to `0182` already exist as provisional drafts
- they were created before this execution package was written
- they must be treated as review-pending drafts, not final approved Phase 2 outputs

---

## 2. Phase 2 Boundary

Phase 2 includes:

- HQ account type master schema
- HQ account group schema
- locked v1 event catalog schema and seed set
- v1 usage code catalog schema and seed set
- governance package schema
- mapping rule header/line schema
- HQ auto-post policy schema

Phase 2 does not include:

- tenant COA
- tenant GL
- posting runtime services
- posting logs and exception runtime tables
- report runtime
- expense runtime
- petty cash runtime

---

## 3. Project Ownership

## 3.1 `cleanmatexsaas` (Platform Level HQ)

Phase 2 HQ work:

- govern account types, groups, events, usage codes
- govern package lifecycle
- govern mapping rules
- govern auto-post policy

## 3.2 `cleanmatex` (Migration Source of Truth)

Phase 2 shared DB work:

- create migration files only
- hold shared governance schema
- avoid runtime authoring behavior

## 3.3 Critical Rule

Shared governance schema is created in `cleanmatex`, but operationally owned by `cleanmatexsaas`.

---

## 4. Exact Migration Set

Use these migration files exactly:

1. `0179_erp_lite_phase2_account_governance.sql`
2. `0180_erp_lite_phase2_event_usage.sql`
3. `0181_erp_lite_phase2_gov_rules.sql`
4. `0182_erp_lite_phase2_auto_post_policy.sql`

Implementation rule:

- if any of these drafts need correction, create follow-up migrations instead of editing them after your review/apply decision

---

## 5. Exact Governance Schema Scope

## 5.1 Migration `0179`

Must cover:

- `sys_fin_acc_type_cd`
- `sys_fin_acc_group_cd`

Seed scope:

- v1 account type families only
- only approved governance groups needed for v1 foundations

## 5.2 Migration `0180`

Must cover:

- `sys_fin_evt_cd`
- `sys_fin_usage_code_cd`

Seed scope:

- locked v1 event catalog only
- approved v1 required + optional usage codes only

Do not seed:

- planned v2/v3 event codes
- planned v2/v3 usage codes

## 5.3 Migration `0181`

Must cover:

- `sys_fin_gov_pkg_mst`
- `sys_fin_map_rule_mst`
- `sys_fin_map_rule_dtl`

Seed scope:

- one draft v1 core governance package
- one draft rule header per approved v1 event
- draft rule lines aligned with the approved v1 posting rules catalog

## 5.4 Migration `0182`

Must cover:

- `sys_fin_auto_post_mst`

Seed scope:

- one draft auto-post policy row per locked v1 event
- v1 approved blocking defaults only

---

## 6. Exact Governance Data Rules

### Package rows

- status must not be `PUBLISHED` yet
- compatibility version must exist
- package must track catalog versions

### Rule rows

- must be deterministic by event + package + priority
- must support multi-line entries
- must support conditional account resolution via resolver code

### Policy rows

- must remain HQ-owned
- must capture blocking mode, required success, retry, repost, and failure action

---

## 7. Validation for Phase 2

After Phase 2 drafting:

- validate migration filenames and sequence
- validate table names and index names against repo DB rules
- validate v1 seeds against:
  - [ACCOUNT_USAGE_CODE_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ACCOUNT_USAGE_CODE_CATALOG.md)
  - [V1_POSTING_RULES_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_POSTING_RULES_CATALOG.md)
  - [BLOCKING_POLICY_TABLE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/BLOCKING_POLICY_TABLE.md)

Do not:

- apply migrations
- implement runtime posting against draft governance rows

---

## 8. Immediate Review Outcome Required

You should review and decide one of these outcomes for `0179` to `0182`:

1. `Accept as Phase 2 baseline drafts`
2. `Revise before approval`
3. `Discard and replace with new follow-up migrations`
