---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_005
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-005: Supplier and AP Governance Model

## Status

Draft

## Context

V2 introduces supplier master and AP lifecycle on top of the existing governed finance foundation.

## Decision

- supplier master is tenant-owned runtime data in `cleanmatex`
- AP posting semantics are HQ-governed through event, usage-code, and package publication in `cleanmatexsaas`
- supplier/account relationships may be tenant-configured only within governed account-type constraints

## Operational Constraints

- payable control behavior must remain GL-traceable
- AP aging must reconcile to posted payable balance behavior
- supplier-specific posting must never bypass governed usage mappings

## Related Documents

- [V2_SCOPE_AND_DECISION_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V2_SCOPE_AND_DECISION_PACK.md)
- [V2_V3_READINESS_ASSESSMENT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V2_V3_READINESS_ASSESSMENT.md)

