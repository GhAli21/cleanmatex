---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_009
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-009: Branch Profitability Source of Truth Model

## Status

Draft

## Context

V3 branch profitability can become misleading unless the truth model is fixed before coding.

## Decision

- profitability outputs must explicitly separate posted finance truth from derived allocation logic
- branch profitability is built from posted revenue/cost truth plus governed allocations
- no profitability report may hide whether a value is direct-posted or allocated

## Operational Constraints

- branch profitability totals must reconcile back to finance totals
- derived allocations must be rerunnable and auditable

