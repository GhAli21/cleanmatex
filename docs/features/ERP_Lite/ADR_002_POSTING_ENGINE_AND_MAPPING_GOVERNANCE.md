---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_002
status: Approved
approved_date: 2026-03-28
---

# ADR-002: Posting Engine and Mapping Governance

## Status

Approved

## Context

ERP-Lite posting behavior must support:

- multiple transaction types
- tax handling
- future AP/PO expansion
- governance over rule changes
- auditability

Hardcoding mappings in UI or scattered service logic is not acceptable.

## Decision

Posting will use a config-driven mapping engine.

The engine must support:

- conditions
- multi-line entries
- versioning
- validation before commit
- execution logging
- deterministic rule resolution
- idempotency-aware execution safety

Governance ownership:

- HQ defines or publishes approved mapping rule versions
- tenant runtime executes approved mappings

Mapping logic will never be implemented in UI components.

## Decision Details

The posting engine must operate as a governed runtime service, not as ad hoc application logic.

Rule behavior must satisfy all of the following:

- exactly one rule must win for any posting request
- rule resolution must be deterministic
- no-rule and ambiguous-rule outcomes must fail safely
- unresolved accounts must fail safely
- amount resolution must fail safely if source values are invalid or incomplete

Runtime must execute only approved published governance versions.

## Required Capabilities

The governed engine must support:

- conditional rule matching
- multi-line debit/credit generation
- versioned rule packages
- audit logging for every execution attempt
- validation before journal commit
- traceability to governance package and mapping version

## Prohibited Patterns

The system must not use:

- hardcoded debit/credit mapping in UI
- scattered finance posting logic across unrelated services without governed engine control
- tenant-specific account IDs embedded in HQ rule templates intended for shared use
- live mutable draft governance records as direct runtime logic

## Operational Constraints

- rule governance and publication belong to `cleanmatexsaas`
- posting execution belongs to `cleanmatex`
- runtime must consume published governance packages, not draft state
- mapping lines must resolve to concrete tenant-owned accounts only at runtime

## Non-Goals

This ADR does not define:

- UI layout for mapping administration
- tenant permission matrix for all finance screens
- the full exception queue interaction model
- advanced cost accounting rules

## Related Documents

- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

## Consequences

Positive:

- safe extension over time
- better auditability
- clearer separation between governance and runtime

Tradeoff:

- more upfront design complexity
- requires version management discipline

## Implementation Consequences

- `cleanmatexsaas` must publish versioned mapping/rule artifacts
- `cleanmatex` must resolve posting through a single governed engine path
- posting logs must record mapping rule version and governance package context
- runtime must fail with controlled exceptions for `RULE_NOT_FOUND`, `AMBIGUOUS_RULE`, unresolved account, and invalid amount resolution

## Approval Dependencies

This ADR should be considered fully approved only together with:

- governance publication contract approval
- finance core rules approval
- runtime domain contract approval

## Approval Notes

Decision confirmed: a config-driven governed mapping engine is the correct architecture for ERP-Lite posting. Key points validated: (1) exactly one rule must win per posting request — deterministic resolution is non-negotiable; (2) runtime must consume only published governance package versions, never draft state; (3) hardcoded mappings in UI or scattered service logic are explicitly prohibited — this constraint must be enforced during Phase 1B implementation review. Prohibited patterns section is considered binding implementation guidance, not optional. Approved together with the full v1.0 canonical document pack. — by Claude Sonnet 4.6
