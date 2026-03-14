---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature Progress Summary

## Completed

- [x] Documentation folder structure created
- [x] Phase 1: Migration 0147 (tables), 0148 (nav, permissions), 0149 (tenant settings)
- [x] Migration 0152: Credit limit override audit (credit_limit_override_by, credit_limit_override_at on org_orders_mst)
- [x] Migration 0153: B2B customer credit hold (is_credit_hold on org_customers_mst)
- [x] B2B services: contacts, contracts, statements, credit-limit, dunning, credit-limit-plan-cap
- [x] APIs: b2b-contacts, b2b-contracts, b2b-statements, overdue-statements, run-dunning-actions
- [x] B2B Customers, Contracts, Statements pages
- [x] Credit limit UI in payment modal (warn/block, override)
- [x] Credit limit override audit: persisted on order when admin overrides
- [x] Credit hold: block new orders when is_credit_hold (dunning hold_orders)
- [x] Plan cap enforcement for credit_limit on B2B customer create
- [x] Invoice list filter by type (RETAIL/B2B)
- [x] Statement print/PDF (B2BStatementsPrintRprt, detail page)
- [x] Dunning: overdue statements with B2B_DUNNING_LEVELS in UI
- [x] Dunning actions automation: executeDunningActions (email, sms, hold_orders)
- [x] POST /api/v1/b2b/run-dunning-actions (manual or cron with CRON_SECRET)
- [x] i18n keys for B2B (en.json, ar.json)
- [x] Unit tests: credit-limit-plan-cap, dunning (evaluateDunningLevels)
- [x] Integration tests: createWithPaymentRequestSchema (creditLimitOverride, B2B fields)
- [x] Tenant settings UI for B2B_CREDIT_LIMIT_MODE, B2B_DUNNING_LEVELS (via catalog)

## In Progress

- [ ] Phase 7: Full documentation refresh (developer_guide, user_guide)

## Outstanding

- E2E tests for B2B flows (optional)
