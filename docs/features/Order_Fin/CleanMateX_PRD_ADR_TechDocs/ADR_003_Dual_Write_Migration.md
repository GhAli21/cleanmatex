# ADR-003: Use Expand → Dual-Write → Reconcile → Switch-Read Migration

## Status

Accepted

---

# Context

Current checkout flow is stable and production-safe.

A rewrite introduces:
- financial regression risk
- checkout downtime
- reconciliation problems
- unstable releases

---

# Decision

Migration strategy:

```text
expand
→ dual-write
→ reconcile
→ switch-read
→ retire
```

---

# Rules

## Expand

Add new tables/columns first.

## Dual-Write

Write old and new structures simultaneously.

## Reconcile

Verify summaries vs details vs ledgers.

## Switch-Read

Enable feature-flagged read source switching.

## Retire

Remove legacy logic only after proof.

---

# Consequences

## Positive

- safer rollout
- rollback capability
- reduced regression risk

## Negative

- temporary duplicate writes
- temporary duplicated logic
