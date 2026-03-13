---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature Testing Scenarios

## Unit Tests

- CreditLimitService: under limit, over limit, zero limit
- B2BStatementsService.generate: empty invoices, multiple invoices
- B2BContactsService: one primary per customer enforcement

## Integration Tests

- Order creation with B2B customer + credit check
- Invoice creation sets invoice_type_cd B2B
- Statement generation links invoices

## E2E Tests

- Create B2B customer → add contact → create order → generate statement → record payment

## Tenant Isolation

- API with tenant A token cannot access tenant B B2B data
