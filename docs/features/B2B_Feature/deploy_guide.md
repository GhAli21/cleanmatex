---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature Deploy Guide

## Prerequisites

- Feature flag `b2b_contracts` enabled for tenant
- Plan supports `credit_limits` (PRO, ENTERPRISE)
- For dunning email: `RESEND_API_KEY` (optional; logs in dev if not set)
- For dunning SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (optional)
- For cron dunning: `CRON_SECRET` (optional)

## Migrations (Apply in Order)

1. `0147_b2b_customers_contracts_contacts.sql` — B2B schema
2. `0148_b2b_navigation_and_permissions.sql` — Nav and permissions
3. `0149_b2b_tenant_settings.sql` — B2B_CREDIT_LIMIT_MODE, B2B_DUNNING_LEVELS
4. `0152_b2b_credit_limit_override_audit.sql` — credit_limit_override_by/at on org_orders_mst
5. `0153_b2b_customer_credit_hold.sql` — is_credit_hold on org_customers_mst

## Post-Migration

1. Run `npx prisma generate` in web-admin
2. Verify RLS policies on new tables

## Deployment Steps

1. Deploy code with B2B services and UI
2. Apply migrations (user applies manually; do not auto-apply)
3. Enable `b2b_contracts` for tenant(s) in HQ/settings
4. Add B2B permissions to roles (b2b_customers, b2b_contacts, b2b_contracts, b2b_statements)
5. Add B2B navigation items (gated by feature flag)

## Dunning Cron (Optional)

To run dunning actions on a schedule:

```
POST /api/v1/b2b/run-dunning-actions
Headers:
  x-cron-secret: <CRON_SECRET>
  x-tenant-id: <tenant-uuid>
```

Configure cron (e.g. Vercel Cron, GitHub Actions) to call this endpoint daily.

## Rollback

If needed, rollback migrations only if no production B2B data exists. Migrations 0152/0153 add nullable columns; dropping them is safe if no override/hold data.
