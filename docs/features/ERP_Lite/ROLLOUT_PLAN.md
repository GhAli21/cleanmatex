---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_ROLLOUT_PLAN_2026_03_28
status: Approved
approved_date: 2026-03-28
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Rollout Plan

## 1. Purpose

This document defines the rollout sequence for ERP-Lite using the current canonical approval pack and the approved v1/v2/v3 scope.

It is a rollout and milestone document, not the detailed task tracker.

Use it together with:

- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)
- [ROADMAP_TASK_BY_TASK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ROADMAP_TASK_BY_TASK.md)

---

## 2. Rollout Principles

- do not start coding before operational approval gates are satisfied
- do not build tenant runtime against mutable draft governance rules
- do not release reports before source-of-truth rules are frozen
- do not expand into v2 or v3 until v1 runtime behavior is trusted
- use AI heavily for drafting and scaffolding, but require human approval at finance-critical gates

---

## 3. Phase Summary

| Phase | Focus | Duration | Dependency Marker | Cannot Start Before |
|---|---|---:|---|---|
| 0 | Decision and approval freeze | 1 week | Review-blocked | canonical pack reviewed |
| 1 | Platform enablement and shells | 1-2 weeks | Parallel | Phase 0 approval gate |
| 2 | Governance + runtime finance foundation | 4-6 weeks | HQ-first | Phase 1 exit + control docs approved |
| 3 | Posting engine + core auto-post | 5-7 weeks | HQ-first | published governance model ready |
| 4 | v1 reports + expenses + petty cash | 5-6 weeks | Runtime-first | posting engine and source-of-truth validated |
| 5 | Pilot and hardening | 2 weeks | Parallel | complete v1 scope available |
| 6 | v2 treasury + suppliers + AP/PO | 6-10 weeks | HQ-first | v1 trusted in pilot |
| 7 | v3 advanced controls + profitability + costing | 6-10 weeks | Runtime-first | v2 stable |

---

## 4. Phase Details

### Phase 0: Decision and Approval Freeze

Goal:
- approve the canonical pack
- freeze scope, finance control rules, runtime contract, and governance publication model

Exit criteria:
- approval checklist accepted
- no unresolved contradictions across canonical documents

### Phase 1: Platform Enablement and Shells

Goal:
- prepare flags, permissions, settings, navigation, and route shells

Exit criteria:
- ERP-Lite shell is gated correctly
- no finance logic implemented yet

### Phase 2: Governance + Runtime Finance Foundation

Goal:
- define publishable governance model in HQ
- draft finance schema and runtime object model

Exit criteria:
- governance package model is defined
- finance schema package is ready for review
- runtime model aligns with approved contract

### Phase 3: Posting Engine + Core Auto-Post

Goal:
- implement governed posting path
- connect invoice, payment, and refund auto-post

Exit criteria:
- deterministic posting works
- duplicate posting is prevented
- failures produce visible exceptions

### Phase 4: v1 Reports + Expenses + Petty Cash

Goal:
- deliver v1 reporting and basic operational finance controls

Exit criteria:
- trial balance, P&L, balance sheet, and AR aging align with approved source-of-truth model
- basic expense and petty cash flows post through GL

### Phase 5: Pilot and Hardening

Goal:
- validate v1 in controlled tenant scenarios

Exit criteria:
- finance reviewer or business owner accepts tested outputs
- critical defects resolved or explicitly deferred

### Phase 6: v2 Treasury + Suppliers + AP/PO

Goal:
- add bank reconciliation, suppliers, AP, and purchase orders

Exit criteria:
- v2 scope operates on the same governed finance foundation without introducing parallel finance logic

### Phase 7: v3 Advanced Controls + Profitability + Costing

Goal:
- add advanced expense controls, advanced petty cash controls, branch profitability, and laundry-specific costing

Exit criteria:
- profitability and costing outputs are accepted as business-credible

---

## 5. Milestones

| Milestone | After Phase | Success Criteria |
|---|---|---|
| M0: Canonical Approval | Phase 0 | Canonical pack approved or approved with explicit bounded revisions |
| M1: Shell Ready | Phase 1 | ERP-Lite shell, flags, permissions, settings, and navigation are ready |
| M2: Foundation Ready | Phase 2 | Governance publication model and finance schema package are ready |
| M3: Core Posting Live | Phase 3 | Invoices, payments, and refunds post correctly with governed policy |
| M4: v1 Finance Live | Phase 4 | Reports, expenses, and petty cash operate on approved GL truth |
| M5: v1 Pilot Accepted | Phase 5 | Pilot tenants validate core behavior |
| M6: v2 Live | Phase 6 | Treasury and procurement layers operate on the same controlled foundation |
| M7: v3 Live | Phase 7 | Advanced control and profitability layer is available |

---

## 6. Explicitly Out of Scope for This Rollout

This rollout does not include:

- payroll
- fixed assets
- multi-company consolidation
- advanced statutory compliance engine
- full treasury suite beyond approved v2 scope

If any of these are reconsidered later, they require separate scope approval.
