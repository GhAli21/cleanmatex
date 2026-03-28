---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_001
status: Approved
approved_date: 2026-03-28
---

# ADR-001: Account Type Governance Model

## Status

Approved

## Context

ERP-Lite needs a stable accounting governance layer that tenants cannot distort in incompatible ways.

If tenants can define custom account types or override debit/credit semantics, then:

- reports become inconsistent
- posting logic becomes fragile
- reconciliation logic becomes harder
- governance across tenants collapses

## Decision

Account types will be:

- HQ-governed
- platform-level master definitions
- standards-compliant
- immutable from tenant perspective

Tenant COA will be:

- tenant-owned
- policy-constrained
- based on HQ-defined account types

The system will not allow:

- custom account types per tenant
- tenant override of debit/credit behavior

## Decision Details

Account types are the governance layer of accounting. They are:

- HQ-governed master definitions
- input to posting and mapping validation
- the controlled bridge from transactions to finance reports

Tenant finance setup is limited to governed use of those definitions.

### Tenant may

- create tenant-owned accounts under allowed governed structures
- rename non-system accounts
- deactivate unused non-system accounts
- map approved usage codes to tenant-owned accounts

### Tenant may not

- create custom account types
- alter natural debit/credit semantics
- change governed account-type meaning
- delete accounts with posted transactions
- directly modify system-linked finance control accounts outside approved setup flows

## Operational Constraints

- HQ governance is implemented in `cleanmatexsaas`
- tenant chart of accounts runtime is implemented in `cleanmatex`
- tenant runtime must validate account-type compatibility when account mappings are assigned
- report structures and posting validation must rely on governed account-type families, not tenant-invented categories

## Non-Goals

This ADR does not define:

- the full tenant COA screen flow
- journal runtime behavior
- tax calculation behavior
- procurement or AP design

## Related Documents

- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

## Consequences

Positive:

- consistent accounting semantics
- safer mapping governance
- cleaner report model
- better SaaS governance

Tradeoff:

- less tenant flexibility
- more governance design work in HQ

## Implementation Consequences

- `cleanmatexsaas` must own account-type definition, version control, and publication
- `cleanmatex` must treat account types as consumed governance data, not tenant-editable master data
- account creation and mapping setup must enforce governed type compatibility
- finance reports must group and interpret accounts through governed account-type families

## Approval Dependencies

This ADR should be considered fully approved only together with:

- finance core rules approval
- runtime domain contract approval
- governance publication contract approval

## Approval Notes

Decision confirmed: HQ-governed account types with tenant COA constrained by policy is the correct model for a multi-tenant SaaS accounting layer. The separation of HQ-defined account type families from tenant-owned accounts is critical for consistent report semantics across all tenants. No unresolved contradictions identified against FCR, Runtime Domain Contract, or Governance Publication Contract. Approved together with ADR-002, ADR-003, ADR-004, ERP_LITE_FINANCE_CORE_RULES, ERP_LITE_RUNTIME_DOMAIN_CONTRACT, and ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT as a full v1.0 approval pass. — by Claude Sonnet 4.6
