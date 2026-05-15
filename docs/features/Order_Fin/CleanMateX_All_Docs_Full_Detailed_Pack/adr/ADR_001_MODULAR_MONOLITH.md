<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->
# ADR-001: Modular Monolith

## Status

Accepted

## Context

CleanMateX requires strong transactional consistency across order, settlement, invoice, and ledger operations.

## Decision

Use a modular monolith with strict domain boundaries.

## Consequences

### Positive

- simpler transactions
- simpler deployment
- lower operational complexity

### Negative / Tradeoffs

- requires discipline to maintain module boundaries

## Implementation Notes

Extract services later only when scale forces it.
