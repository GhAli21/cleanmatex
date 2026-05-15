<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->
# ADR-005: Tenant Isolation

## Status

Accepted

## Context

CleanMateX is multi-tenant.

## Decision

All org tables and queries must be tenant-scoped.

## Consequences

### Positive

- security
- predictable data access

### Negative / Tradeoffs

- requires strict query discipline

## Implementation Notes

Use tenant_org_id indexes and guards.
