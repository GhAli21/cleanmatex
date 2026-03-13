---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature Deploy Guide

## Prerequisites

- Feature flag `b2b_contracts` enabled for tenant
- Plan supports `credit_limits` (PRO, ENTERPRISE)

## Migration

1. Apply migration `0147_b2b_customers_contracts_contacts.sql` manually
2. Run `npx prisma db pull` or `prisma generate` per project setup
3. Verify RLS policies on new tables

## Deployment Steps

1. Deploy code with B2B services and UI
2. Enable `b2b_contracts` for tenant(s) in HQ/settings
3. Add B2B permissions to roles
4. Add B2B navigation items (gated by feature flag)

## Rollback

If needed, rollback migration only if no production B2B data exists. Use optional `0147_b2b_rollback.sql`.
