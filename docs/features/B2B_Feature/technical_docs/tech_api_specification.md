---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature API Specification

## B2B Contacts

- `GET /api/v1/b2b-contacts?customerId=...` — list contacts for customer
- `POST /api/v1/b2b-contacts` — create contact
- `GET /api/v1/b2b-contacts/:id` — get contact
- `PATCH /api/v1/b2b-contacts/:id` — update contact
- `DELETE /api/v1/b2b-contacts/:id` — soft delete

## B2B Contracts

- `GET /api/v1/b2b-contracts` — list (filter by customerId)
- `POST /api/v1/b2b-contracts` — create
- `GET /api/v1/b2b-contracts/:id` — get
- `PATCH /api/v1/b2b-contracts/:id` — update
- `DELETE /api/v1/b2b-contracts/:id` — soft delete

## B2B Statements

- `GET /api/v1/b2b-statements` — list
- `POST /api/v1/b2b-statements/generate` — generate statement (batch unpaid invoices)
- `GET /api/v1/b2b-statements/:id` — get
- `PATCH /api/v1/b2b-statements/:id` — update (e.g. issue)

## Response Shape

`{ data?, error?, success }` — HTTP 200, 201, 400, 403, 404, 500

## Error Codes

- `B2B_CREDIT_EXCEEDED`
- `B2B_CONTRACT_NOT_FOUND`
- `B2B_CUSTOMER_REQUIRED`

## Permission

All routes require `b2b.*` permission; feature flag `b2b_contracts` must be enabled.
