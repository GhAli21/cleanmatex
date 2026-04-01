---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_008
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-008: Advanced Expenses and Petty Cash Controls

## Status

Draft

## Context

V3 extends the v1 basic expenses and petty-cash flows into approval, custodian, reconciliation, and exception workflows.

## Decision

- advanced controls extend the existing v1 document model, not a parallel subsystem
- custodian, approval, reconciliation, and exception states must remain auditable
- posting stays on the governed posting engine

## Operational Constraints

- advanced controls must not break v1 expense and petty-cash traceability
- reconciliation outcomes must be reversible with full audit

