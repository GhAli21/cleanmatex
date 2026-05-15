<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# API Idempotency

## 1. Purpose

Prevent duplicate financial mutations from retries or double-clicks.

## 2. Required For

- create order
- capture payment
- apply gift card
- apply wallet
- apply customer credit
- apply advance
- refund
- invoice creation
- accounting posting

## 3. Storage

```text
org_idempotency_keys_log
```

Fields:
- tenant_org_id
- idempotency_key
- request_hash
- response_payload
- status
- created_at
- expires_at

## 4. Behavior

If same key and same request:
- return original response

If same key and different request:
- return `IDEMPOTENCY_CONFLICT`
