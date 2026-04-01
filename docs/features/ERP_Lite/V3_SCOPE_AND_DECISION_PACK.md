---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_V3_SCOPE_AND_DECISION_PACK_2026_04_01
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite V3 Scope and Decision Pack

## 1. Purpose

This document freezes the business and implementation boundaries for `v3`.

## 2. v3 Scope

Included:
- advanced expenses workflow
- advanced petty-cash controls and reconciliation
- branch profitability
- laundry-specific costing

Excluded:
- uncontrolled allocation logic
- profitability outputs without approved costing assumptions

## 3. Core Decisions

- branch profitability must distinguish posted finance truth from derived allocations
- costing must be rerunnable and auditable
- advanced expense and petty-cash controls remain on the same governed posting engine

## 4. Required ADR Set

- [ADR_008_ADVANCED_EXPENSES_AND_PETTY_CASH_CONTROLS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_008_ADVANCED_EXPENSES_AND_PETTY_CASH_CONTROLS.md)
- [ADR_009_BRANCH_PROFITABILITY_SOURCE_OF_TRUTH.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_009_BRANCH_PROFITABILITY_SOURCE_OF_TRUTH.md)
- [ADR_010_LAUNDRY_SPECIFIC_COSTING_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_010_LAUNDRY_SPECIFIC_COSTING_MODEL.md)

## 5. Start Gate

v3 coding must not start until:
- Phase 9 is complete and trusted
- the v3 ADR pack is approved
- costing and allocation assumptions are explicitly accepted

