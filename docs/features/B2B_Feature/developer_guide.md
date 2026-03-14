---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature Developer Guide

## Code Structure

- **Services**: `web-admin/lib/services/b2b-contacts.service.ts`, `b2b-contracts.service.ts`, `b2b-statements.service.ts`, `credit-limit.service.ts`, `dunning.service.ts`, `credit-limit-plan-cap.service.ts`
- **Types**: `web-admin/lib/types/b2b.ts`
- **Constants**: `web-admin/lib/constants/b2b.ts`
- **API routes**: `web-admin/app/api/v1/b2b-contacts/`, `b2b-contracts/`, `b2b-statements/`, `b2b/overdue-statements/`, `b2b/run-dunning-actions/`
- **UI**: `web-admin/app/dashboard/b2b/` (layout, customers, contracts, statements)

## Key Flows

1. **B2B customer creation**: Extend customers.service to handle type='b2b' and company fields; credit_limit capped by plan
2. **Credit limit check**: `credit-limit.service.checkCreditLimit()` called before order submit; blocks when `is_credit_hold`
3. **Credit limit override**: When admin overrides (warn mode), `credit_limit_override_by` and `credit_limit_override_at` stored on order
4. **Statement generation**: B2BStatementsService.generate() batches unpaid B2B invoices
5. **Invoice type**: Invoice service sets invoice_type_cd='B2B' when customer is B2B
6. **Dunning actions**: `dunning.service.executeDunningActions()` sends email/SMS, sets `is_credit_hold` per B2B_DUNNING_LEVELS

## Dunning Automation

- **Manual**: POST `/api/v1/b2b/run-dunning-actions` (requires `b2b_statements:create`)
- **Cron**: Same route with `x-cron-secret: CRON_SECRET` and `x-tenant-id: <tenant-uuid>`
- **Actions**: `email` (Resend), `sms` (Twilio), `hold_orders` (sets `is_credit_hold` on customer)

## Migrations

- **0152**: `credit_limit_override_by`, `credit_limit_override_at` on org_orders_mst
- **0153**: `is_credit_hold` on org_customers_mst

## Tenant Isolation

All queries must filter by `tenant_org_id`. RLS policies on org_b2b_* tables enforce isolation.

## Feature Flag

B2B nav and APIs gated by `b2b_contracts`. Use RequireFeature on B2B pages.
