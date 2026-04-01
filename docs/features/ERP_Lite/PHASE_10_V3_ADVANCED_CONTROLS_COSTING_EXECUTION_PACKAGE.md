---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_10_V3_EXEC_PKG_2026_04_01
status: Complete
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Phase 10 V3 Advanced Controls, Profitability, Costing Execution Package

## 1. Purpose

This document defines the implementation-ready structure for `Phase 10: V3 Advanced Controls + Profitability + Costing`.

## 2. Scope

Phase 10 includes:
- advanced expense workflow
- advanced petty-cash control and reconciliation workflow
- branch profitability outputs
- laundry-specific costing outputs

Phase 10 does not include:
- redefinition of v1/v2 accounting truth
- speculative allocation logic without approved assumptions

## 3. Implementation Rule

Phase 10 is no longer blocked on design approval only.

The governing design pack now exists:
- [V3_SCOPE_AND_DECISION_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V3_SCOPE_AND_DECISION_PACK.md)
- [ADR_008_ADVANCED_EXPENSES_AND_PETTY_CASH_CONTROLS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_008_ADVANCED_EXPENSES_AND_PETTY_CASH_CONTROLS.md)
- [ADR_009_BRANCH_PROFITABILITY_SOURCE_OF_TRUTH.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_009_BRANCH_PROFITABILITY_SOURCE_OF_TRUTH.md)
- [ADR_010_LAUNDRY_SPECIFIC_COSTING_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_010_LAUNDRY_SPECIFIC_COSTING_MODEL.md)

## 4. Data and Reporting Rule

- profitability outputs must distinguish posted finance truth from derived allocation logic
- costing recalculation must be rerunnable and auditable
- no v3 report may bypass v1/v2 source-of-truth finance data

## 5. Current State

Current status:

1. v3 direction is validated
2. v3 decision and ADR pack exists
3. the v3 runtime slice is implemented on top of the applied Phase 10 schema package with audited advanced controls, governed allocation runs, and rerunnable cost runs

## 6. Current Runtime Slice

Implemented now in `cleanmatex`:
- advanced expense approvals and petty-cash reconciliation controls in the Expenses workspace
- allocation-aware Branch P&L based on posted ERP-Lite revenue and expense journals plus the latest posted governed allocation run
- latest posted cost summary and auditable cost-run administration in the Branch P&L workspace
- Phase 10 schema package applied:
  - `0193_erp_lite_phase10_adv_ctrl.sql`
  - `0194_erp_lite_phase10_alloc_prof.sql`
  - `0195_erp_lite_phase10_cost_runs.sql`
