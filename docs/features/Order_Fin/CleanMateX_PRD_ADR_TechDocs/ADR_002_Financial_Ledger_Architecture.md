# ADR-002: Use Ledger-Based Stored Value Architecture

## Status

Accepted

---

# Context

Gift cards, wallet balances, advances, and customer credits cannot safely rely on mutable balance columns alone.

Risks:
- race conditions
- reconciliation failure
- refund inconsistency
- missing auditability

---

# Decision

Every stored-value system must use:

```text
Master Account
+ Transaction Ledger
+ Credit Application Rows
```

Examples:

```text
org_gift_cards_mst
org_gift_card_txn_dtl

org_wallet_accounts_mst
org_wallet_txn_dtl
```

---

# Rules

- every mutation creates ledger rows
- balances are derived or safely updated
- redemption uses row locking
- idempotency required

---

# Consequences

## Positive

- auditability
- reversibility
- safer concurrency
- reconciliation support

## Negative

- more tables
- more implementation effort
