# Order Financial Platform — Implementation Status

Last updated: 2026-05-23

## Phase Completion

| Phase | Description | Status |
|---|---|---|
| P0 | Foundation — migrations 0278–0282, constants, types | ✅ Done |
| P1 | Order financial fact tables (charges, taxes, discounts, payments, credit_apps) | ✅ Done |
| P2 | Stored value tables (wallets, advances, credit notes) | ✅ Done |
| P3 | Loyalty tables (accounts, transactions) | ✅ Done |
| P4 | Promotions engine tables | ✅ Done |
| P5 | Tax configuration tables | ✅ Done |
| P6 | Infrastructure (outbox, reconciliation, cash drawer) | ✅ Done |
| P7 | Permissions seed + navigation | ✅ Done |
| P8 | Service layer (10 services) | ✅ Done |
| P9 | API routes (~30 routes) | ✅ Done |
| P10 | Billing UI — cash drawers | ✅ Done |
| P11 | Billing UI — refunds list | ✅ Done |
| P12 | Billing UI — reconciliation | ✅ Done |
| P13 | Marketing UI — promotions list | ✅ Done |
| P14 | Settings UI — tax setup | ✅ Done |
| P15 | Print & export (receipt voucher, session summary) | ✅ Done |
| P16 | Background jobs (pg_cron, outbox worker Edge Function) | ✅ Done |
| P17 | i18n (EN/AR translations for all new keys) | ✅ Done |
| P18 | Testing (126 tests across 16 suites — all green) | ✅ Done |
| P19 | Documentation | ✅ Done |

| BVM-1A | BVM Wiring Phase 1A — order payment, credit application, cash drawer wiring | ✅ Done (2026-05-22) |
| BVM-1B | BVM Wiring Phase 1B — submit-order canonical path + orchestrator integration | ✅ Done (2026-05-23) |

## BVM Wiring Phase 1A — What Was Done

Implemented the full wiring layer that connects posted voucher lines to their operational tables in a single atomic DB transaction.

**Files created:**
- `supabase/migrations/0318_bvm_wiring_phase1a_schema.sql` — schema prerequisites (pending apply)
- `supabase/migrations/0319_bvm_wiring_phase1a_permissions.sql` — 2 new permission codes (pending apply)
- `web-admin/lib/types/voucher-wiring.ts` — full wiring type system
- `web-admin/lib/services/wiring/order-payment-wiring.handler.ts`
- `web-admin/lib/services/wiring/order-credit-application-wiring.handler.ts`
- `web-admin/lib/services/wiring/cash-drawer-wiring.handler.ts`
- `web-admin/lib/services/voucher-wiring.service.ts` — orchestrator with `postAndWireBizVoucher()`, `getVoucherLinkedEffects()`, `getLineLinkedEffect()`
- `web-admin/app/api/v1/finance/vouchers/[voucherId]/linked-effects/route.ts`
- `web-admin/app/api/v1/finance/voucher-lines/[lineId]/linked-effects/route.ts`
- `web-admin/src/features/finance/vouchers/ui/wiring-status-badge.tsx`
- `web-admin/src/features/finance/vouchers/ui/voucher-linked-effects-panel.tsx`
- `web-admin/src/features/finance/vouchers/ui/voucher-post-preview-dialog.tsx`

**Files modified:**
- `web-admin/lib/constants/voucher.ts` — added `ORDER_CREDIT_APPLICATION` to `LINE_ROLE`
- `web-admin/lib/types/voucher.ts` — added fields to `VoucherLineData` and `CreateVoucherLineInput`
- `web-admin/lib/services/order-settlement.service.ts` — added `wiringMode?: boolean` guard
- `web-admin/app/api/v1/finance/vouchers/[voucherId]/post/route.ts` — calls `postAndWireBizVoucher`
- `web-admin/app/actions/finance/voucher-actions.ts` — uses wiring service
- `web-admin/src/features/finance/vouchers/ui/voucher-line-table.tsx` — wiring_status column
- `web-admin/app/dashboard/internal_fin/vouchers/[voucherId]/voucher-detail-client.tsx` — preview dialog + effects panel
- `web-admin/app/dashboard/internal_fin/vouchers/[voucherId]/page.tsx` — fetches linked effects
- `web-admin/messages/en.json` + `ar.json` — wiring/effects i18n keys

**Pending (migrations must be applied before production use):**
- `supabase/migrations/0318_bvm_wiring_phase1a_schema.sql` — adds `credit_application_type`, `fin_voucher_id/trx_line_id` to credit apps table
- `supabase/migrations/0319_bvm_wiring_phase1a_permissions.sql` — seeds `fin_vouchers:wire` and `fin_vouchers:view_effects`

## Known Gaps / Follow-ups

- P9.1 `create-with-payment` multi-leg preview endpoint: deferred to post-launch sprint
- Reconciliation STORED_VALUE_LEDGER check: currently raises as BLOCKER — will refine threshold in first post-launch sprint
- Gift card CURRENCY_MISMATCH enforcement: future phase to support multi-currency redemption
- Outbox worker retry fanout to external webhooks: stub only — connect to event bus in Phase 20
- BVM Wiring Phase 1B: ✅ Complete — `submit-order` canonical path, orchestrator, settlement planner, D9 config columns, ESLint governance (2026-05-23)
- BVM Wiring Phase 2–5: Stored value ledger, invoice collection, expense/outgoing projections, legacy backfill
