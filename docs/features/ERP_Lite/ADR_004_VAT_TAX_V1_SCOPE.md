---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_004
status: Approved
approved_date: 2026-03-28
---

# ADR-004: VAT / Tax v1 Scope

## Status

Approved

## Context

ERP-Lite v1 needs enough tax behavior to support correct accounting for common VAT/tax use cases, especially in GCC markets.

However, full tax compliance depth would significantly expand scope.

## Decision

v1 will include simple VAT/tax support only.

Included:

- tax code or rate setup
- tax account mapping
- tax-aware invoice posting
- tax-aware refund handling
- tax visibility in reports

Excluded:

- advanced jurisdiction logic
- filing workflows
- compliance engine
- complex tax exception frameworks

## Decision Details

v1 tax behavior is intentionally narrow and finance-safe.

The approved v1 operating model is:

- tax-exclusive pricing model
- tax separated from revenue in posting output
- refund reverses prior tax effect consistently
- simple code/rate-driven behavior only

### Minimum operating rules

v1 must define and enforce:

- tax-exclusive treatment
- rounding behavior
- zero-tax behavior
- tax visibility in finance outputs

### Explicit exclusions

v1 does not include:

- multi-jurisdiction tax engine
- tax filing engine
- advanced exemption logic
- advanced withholding/compliance framework

## Operational Constraints

- tax behavior must remain aligned with governed finance rules
- runtime must not invent tax behavior outside approved model
- reports must show tax without distorting revenue
- tax logic must remain simple enough for v1 while still preserving accounting correctness

## Non-Goals

This ADR does not define:

- statutory filing workflows
- advanced localization by tax authority
- AP tax design in later phases

## Related Documents

- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

## Consequences

Positive:

- enough tax correctness for v1 accounting usefulness
- avoids major compliance scope explosion

Tradeoff:

- advanced tax needs still require later work or external support

## Implementation Consequences

- invoice and refund posting must carry explicit tax effect according to approved v1 model
- tax configuration must resolve to governed account mappings
- zero-tax scenarios must not create incorrect tax journal effects
- finance reports must expose tax with correct separation from revenue

## Approval Dependencies

This ADR should be considered fully approved only together with:

- finance core rules approval
- runtime domain contract approval

## Approval Notes

Decision confirmed: simple VAT-only scope for v1 is the correct scoping call for a GCC-first laundry SaaS platform. Key points locked: (1) tax-exclusive pricing model is the approved approach — tax is separated from revenue in posting output; (2) zero-tax behavior must not produce incorrect journal effects — this must be validated during Phase 6 implementation; (3) the explicit exclusion list (multi-jurisdiction, filing workflows, compliance engine, advanced exemptions) is binding — any future expansion requires a new ADR; (4) FCR §5 governs all detailed VAT runtime rules and takes precedence over this ADR for implementation detail. Approved together with the full v1.0 canonical document pack. — by Claude Sonnet 4.6
