<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->
# ADR-004: Outbox Pattern

## Status

Accepted

## Context

Posting and notifications should not run directly from checkout UI calls.

## Decision

Write domain events to an outbox in the same transaction.

## Consequences

### Positive

- reliable async processing
- retry support
- no lost events

### Negative / Tradeoffs

- requires worker process

## Implementation Notes

Posting worker consumes outbox events.
