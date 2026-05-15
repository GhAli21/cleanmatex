<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->
# ADR-002: Ledger-Based Finance

## Status

Accepted

## Context

Stored-value balances cannot rely on mutable balance columns alone.

## Decision

Use master tables plus transaction ledgers for gift cards, wallet, advances, credits, loyalty.

## Consequences

### Positive

- auditability
- reversibility
- reconciliation
- fraud investigation

### Negative / Tradeoffs

- more tables
- more implementation effort

## Implementation Notes

Every balance mutation must insert a ledger row.
