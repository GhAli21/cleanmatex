---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_007
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-007: Purchase Order to AP Posting Boundaries

## Status

Draft

## Context

V2 introduces PO and AP together, and their posting boundaries must be explicit to avoid duplicate or premature finance posting.

## Decision

- PO is operational control first and does not create payable GL impact by itself in v2 unless explicitly extended later
- AP invoice is the first payable-recognition point in v2
- AP payment settles the payable balance and is the cash/bank outflow point

## Operational Constraints

- PO to AP linkage must preserve source references
- AP invoice posting must remain the payable truth point
- AP payment allocation must reconcile to AP open balance and later bank matching

## Related Documents

- [V2_SCOPE_AND_DECISION_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V2_SCOPE_AND_DECISION_PACK.md)
- [ADR_005_SUPPLIER_AP_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_005_SUPPLIER_AP_GOVERNANCE_MODEL.md)

