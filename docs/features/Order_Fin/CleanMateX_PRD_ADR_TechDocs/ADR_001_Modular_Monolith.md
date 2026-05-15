# ADR-001: Use Modular Monolith Instead of Microservices

## Status

Accepted

---

# Context

CleanMateX currently has:
- one transactional checkout flow
- shared database
- strong relational consistency requirements
- financial operations requiring atomic transactions

Moving directly to microservices would:
- increase operational complexity
- require distributed transactions
- increase reconciliation risk
- slow delivery

---

# Decision

Use:

```text
Modular Monolith
+ Strong Domain Boundaries
+ Outbox Events
+ Ledger-Based Financial Design
```

---

# Consequences

## Positive

- simpler deployment
- easier transactions
- easier debugging
- lower infrastructure cost
- faster delivery
- easier migration

## Negative

- requires discipline to avoid tight coupling
- future extraction boundaries must remain clean

---

# Future Direction

Possible future extraction:
- loyalty
- promotions
- accounting posting
- notifications
