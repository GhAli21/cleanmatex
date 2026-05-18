# Changelog — Order Financial Platform

## 2026-05-18

### Documentation
- Created full P19 documentation suite (README, developer_guide, current_status, progress_summary, technical_docs, Order_Fin_Docs)

### Tests
- 126 tests across 16 suites — all passing
- Integration tests: refund-flow, gift-card-redemption, checkout-multi-payment, reconciliation-run
- Unit tests: tax-engine, loyalty, outbox, stored-value, cash-drawer, refund, reconciliation, promotion-engine, order-calculation, settlement
- E2E stubs: cash-drawer, stored-value, promotions, tax-setup, reconciliation
- Validation tests: financial-schemas, financial-tenant-isolation

## 2026-05-15

### UI Pages (P10–P14)
- `app/dashboard/billing/cash-drawers/` — cash drawer list + detail + session print
- `app/dashboard/billing/refunds/` — refunds list
- `app/dashboard/billing/reconciliation/` — reconciliation list + detail
- `app/dashboard/marketing/promotions/` — promotions list
- `app/dashboard/settings/tax/` — tax profiles + exemptions

### Print & Export (P15)
- `app/dashboard/billing/payments/[id]/print/receipt-voucher/` — receipt voucher print
- `app/dashboard/billing/cash-drawers/[drawerId]/session/[sessionId]/print/` — session summary print

### Background Jobs (P16)
- `supabase/migrations/0296_pg_cron_jobs.sql` — pg_cron schedule for outbox worker
- `supabase/functions/outbox-worker/index.ts` — Edge Function

### i18n (P17)
- Added ~200 translation keys to `messages/en.json` and `messages/ar.json`

## 2026-05-14

### API Routes (P9)
- Cash drawers: open/close session, cash movement, session summary
- Customers: wallet top-up, wallet ledger, advance issue, advance ledger, credit note issue, credit notes list, loyalty, stored-value hub
- Orders: refund initiation, refund list, refund approval, payment collection
- Finance: reconciliation runs, reconciliation issues, financial reports (orders summary, payments breakdown, tax report)
- Gift cards: balance lookup, ledger
- Loyalty: config, tiers
- Marketing: promotions CRUD, promo validation
- Settings: payment methods, terminals, tax profiles, tax exemptions

### Services (P8)
- `lib/services/order-settlement.service.ts` — multi-leg atomic settlement
- `lib/services/order-refund.service.ts` — 3-step refund lifecycle
- `lib/services/stored-value.service.ts` — wallet, advance, credit note ops
- `lib/services/loyalty.service.ts` — earn/redeem points
- `lib/services/promotion-engine.service.ts` — discount calculation + usage tracking
- `lib/services/tax-engine.service.ts` — profile-based tax with exemptions
- `lib/services/reconciliation.service.ts` — 7-check financial reconciliation
- `lib/services/cash-drawer.service.ts` — session lifecycle + movement recording
- `lib/services/outbox.service.ts` — domain event append + batch claim
- `lib/services/order-calculation.service.ts` — server-side totals calculation

## 2026-05-07 – 2026-05-14

### Migrations (P0–P7)
- `0278` — rename org_order_discounts_dtl
- `0279` — sys financial lookup tables (payment nature, credit application types, etc.)
- `0280` — org_order_charges_dtl
- `0281` — org_order_taxes_dtl
- `0282` — org_orders_mst financial snapshot columns
- `0283` — harden credit_apps + refunds
- `0284` — org_customer_wallets_mst + org_wallet_txn_dtl
- `0285` — org_customer_advances_mst + org_advance_txn_dtl
- `0286` — org_credit_notes_mst + org_credit_note_txn_dtl
- `0287` — org_loyalty_accounts_mst + org_loyalty_txn_dtl
- `0288` — extend promotions tables (stacking, usage limits)
- `0289` — org_tax_profiles_cf + org_tax_exemptions_cf
- `0290` — currency rounding config
- `0291` — payment config seed (payment methods, cash payment nature)
- `0292` — org_domain_events_outbox (idempotency + retry)
- `0293` — org_reconciliation_runs_mst + org_reconciliation_issues_dtl
- `0294` — financial permissions seed
- `0295` — financial navigation (sys_components_cd)
- `0296` — pg_cron jobs

### Constants & Types
- `lib/constants/order-financial.ts` — all financial enums + status codes
- `lib/types/order-financial.ts` — FinancialBreakdownSnapshot, SettlementOption, ResolvedSettlementLeg, etc.
