---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_006
status: Draft
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ADR-006: Bank Reconciliation Model

## Status

Draft

## Context

V2 requires bank statement import, matching, and reconciliation without breaking v1 journal truth.

## Decision

- bank reconciliation is import-first with manual assist, not manual-only
- imported statement lines are tenant runtime records in `cleanmatex`
- reconciliation matches are auditable, reversible, and must not mutate source statement lines destructively
- bank posting semantics remain HQ-governed through approved event families and packages

## Operational Constraints

- raw source traceability must be preserved for every imported statement line
- duplicate import prevention is mandatory
- reconciliation status must not replace GL truth; it supplements it

## Related Documents

- [V2_SCOPE_AND_DECISION_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V2_SCOPE_AND_DECISION_PACK.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

