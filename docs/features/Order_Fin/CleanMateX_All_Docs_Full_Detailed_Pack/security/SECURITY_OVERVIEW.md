<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Security Overview

## 1. Required Controls

- authentication
- authorization
- tenant isolation
- CSRF protection
- API validation
- idempotency
- audit logs
- RLS where applicable
- payment data safety
- stored-value fraud controls

## 2. Tenant Isolation

Every tenant-owned query must include:

```text
tenant_org_id
```

## 3. RBAC

Required permission groups:

```text
orders:*
payments:*
refunds:*
promotions:*
giftcards:*
wallet:*
loyalty:*
invoices:*
accounting:*
reconciliation:*
```

## 4. Stored Value Fraud Controls

- rate limit redemption attempts
- lock balances during redemption
- prevent predictable gift card codes
- require idempotency
- audit all balance changes
