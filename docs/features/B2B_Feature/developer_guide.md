---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature Developer Guide

## Code Structure

- **Services**: `web-admin/lib/services/b2b-contacts.service.ts`, `b2b-contracts.service.ts`, `b2b-statements.service.ts`, `credit-limit.service.ts`
- **Types**: `web-admin/lib/types/b2b.ts`
- **Constants**: `web-admin/lib/constants/b2b.ts`
- **API routes**: `web-admin/app/api/v1/b2b-contacts/`, `b2b-contracts/`, `b2b-statements/`
- **UI**: `web-admin/app/dashboard/b2b/` (layout, customers, contracts, statements)

## Key Flows

1. **B2B customer creation**: Extend customers.service to handle type='b2b' and company fields
2. **Credit limit check**: CreditLimitService.checkCreditLimit() called before order submit
3. **Statement generation**: B2BStatementsService.generate() batches unpaid B2B invoices
4. **Invoice type**: Invoice service sets invoice_type_cd='B2B' when customer is B2B

## Tenant Isolation

All queries must filter by `tenant_org_id`. RLS policies on org_b2b_* tables enforce isolation.

## Feature Flag

B2B nav and APIs gated by `b2b_contracts`. Use RequireFeature on B2B pages.
