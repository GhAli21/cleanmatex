---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_010
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-010: Laundry-Specific Costing Model

## Status

Draft

## Context

V3 costing is the main ERP-Lite differentiator, but it is also the highest risk area for arbitrary logic.

## Decision

- costing is based on approved allocation bases and explicit cost components
- costing must be rerunnable after configuration changes
- costing outputs must remain traceable back to posted finance truth and governed allocation rules

## Operational Constraints

- no hidden heuristics in report queries
- no profitability release before costing assumptions are approved as credible

