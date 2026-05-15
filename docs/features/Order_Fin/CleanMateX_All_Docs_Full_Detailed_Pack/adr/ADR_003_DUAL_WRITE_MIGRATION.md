<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->
# ADR-003: Dual-Write Migration

## Status

Accepted

## Context

Current checkout is stable and cannot be replaced in one release.

## Decision

Use expand → dual-write → reconcile → switch-read → retire.

## Consequences

### Positive

- safe rollout
- fallback ability
- proof before switch

### Negative / Tradeoffs

- temporary duplicated logic

## Implementation Notes

Use feature flags and reconciliation.
