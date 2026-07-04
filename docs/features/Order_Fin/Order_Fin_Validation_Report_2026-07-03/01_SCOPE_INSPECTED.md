# 01 — Scope Inspected

## Method

Code-first inspection (read-only). Every claim marked **confirmed** was verified against actual source, migration SQL, or checked-in status docs with cited line numbers. Claims that depend on runtime data (row counts, live tenant behavior) are marked **inferred** and listed in [04 §Inferred](./04_FINDINGS.md) / [15](./15_OPEN_QUESTIONS.md). No DB queries were executed and no code was changed.

Baseline: `docs/features/Order_Fin/Opus_Validation_Report_18_06_2026/` (25 files) + its remediation log (`24_IMPLEMENTATION_STATUS.md`, closed through D-12 on 2026-06-25) + the Payment Modal v4 program (`Payment_Modal_Review/Payment_Modal_v4_Engine_Architecture.md`, complete 2026-07-03). Items that report verified live-DB state (RLS, constraints) are cited from that baseline rather than re-executed.

## Inspected — core engine and services (`web-admin/lib/services/`)

- `order-financial-write.service.ts` — snapshot recalculation lines 600-870 (payment/credit/refund aggregation, decomposition stubs, warning codes, header status resolution)
- `order-calculation.service.ts` — full pricing math (lines 60-435)
- `order-settlement.service.ts`, `order-settlement-planner.service.ts` — settlement legs, collect-payment, credit application writes
- `order-submit-orchestrator.service.ts` — submit transaction §6-§9 incl. the removed legacy AR tracking block (981-997)
- `order-refund.service.ts` — F-R1/F-R2/F-R3 verification (174-472)
- `order-cancel-service.ts` (30-160) + `workflow-service-enhanced.ts` (290-360) — cancellation financial path
- `payment-service.ts` — `_tr` write sites (1096, 1395, 1793, 2425, 2504), `getPaymentsForOrder` (1265-1305)
- `report-service.ts` — `getPaymentsReport` (240-300)
- `cashup-service.ts` (header + 51), `order-financial-summary.service.ts` (source tables incl. `org_tax_documents_mst:410`), `voucher-service.ts` `_tr` linkage (295-600)
- Reviewed-by-citation (prior pass, unchanged since): voucher posting/reversal/validation, AR invoice service (allocate/reverse/void), b2b-statement-payment, customer-receipt allocation family, overpayment disposition, wiring handlers

## Inspected — API routes (`web-admin/app/api/v1/`)

- Auth-guard sweep across all `orders`, `finance`, `ar`, `b2b*`, `customer-receipts`, `cash-drawers`, `receipts` route files (grep for `requirePermission`/`requireAnyPermission`/`getAuthContext`/bare `createClient`)
- Full read: `orders/[id]/report/payments-rprt/route.ts`
- Import/guard read: `orders/[id]/collect-payment`, `orders/[id]/payments`, `orders/preview-financials`, `finance/reports/reconciliation/*`, `customer-receipts/*`, `finance/vouchers/[voucherId]/lines`
- Permission-code inventory: all `requirePermission('…')` literals across `app/api/v1` (see [08](./08_PERMISSIONS_AND_TENANT_ISOLATION.md))

## Inspected — UI surfaces (`web-admin/app/dashboard/`, `web-admin/src/features/`)

- Order details full view: `app/dashboard/orders/[id]/full/page.tsx` (data fetch, 95-146) + `order-details-full-client.tsx` (tab wiring, 1114-1349)
- Payment Modal v4: architecture doc + file inventory (`src/features/orders/ui/payment-modal-v4.tsx`, `payment-full-view.tsx`, `payment-simple-view.tsx`, `payment-modal/` reusables, engine hooks)
- All 33 `*-rprt.tsx` report/print components (inventory), with source/i18n/RTL spot-reads of `ar-invoice-print-rprt.tsx`, `ar-customer-statement-print-rprt.tsx`, `order-invoices-payments-print-rprt.tsx`
- Collect-payment modal, reconciliation report clients (by citation from prior pass + Phase 5 hardening log)

## Inspected — constants, types, schema

- `lib/constants/payment.ts` (full first 230 lines), `lib/constants/order-financial.ts` (status blocks 453-545), `lib/constants/voucher.ts` (222-236), `lib/constants/permissions/` (directory contents)
- Migrations: `0130` (cancel RPC — financial-reference grep), `0341` (tax documents), ADR-002 vs live write sites; prior-pass verification of `0378`-`0384` accepted as baseline
- `docs/features/Order_Fin/ADR/` (84 files — numbering audit)

## Explicitly NOT inspected (out of scope this pass)

- Live database row counts / production data checks (flagged where they gate severity — FN-01)
- Payment gateway capture/callback lifecycle end-to-end (HYPERPAY/PAYTABS/STRIPE) — no live gateway path exercised; noted as open risk
- `cmx-api/` (NestJS Phase 2) — no order-financial surface shipped there yet; nothing found importing finance write paths
- cleanmatexsaas HQ console (cross-project; e-invoice toggle noted as dependency)
- Promotion/loyalty engine internals (covered by `Promotion_Loyalty_Offline_DeepDive_2026-06-26.md`)
- Mobile/offline POS
