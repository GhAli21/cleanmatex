# D-09 — Finance Reconciliation Reports

**Status:** 🟢 Implemented (local) — migration `0384` created, **pending user apply**.
**Date:** 2026-06-20
**Phase:** D-09 (own phase per `23_DECISIONS_ADDENDUM.md`; launch-required reporting workstream).
**Canonical live log:** `Opus_Validation_Report_18_06_2026/24_IMPLEMENTATION_STATUS.md`.

---

## Scope

Four **read-only** reconciliation reports over existing finance tables. **No new DB tables** — the only schema change is one navigation row.

| # | Report | Question it answers | Source |
|---|---|---|---|
| 1 | **Unallocated excess / customer stored-value liability** | How much customer money are we still holding (wallet + advance + active credit notes) that hasn't been allocated? | `org_customer_wallets_mst`, `org_customer_advances_mst`, `org_credit_notes_mst` (balances > 0) |
| 2 | **B2B statement payment reconciliation** | Does each statement's header `paid_amount` match the sum of its payment-detail rows? | `org_b2b_statements_mst` ⋈ `org_b2b_statement_payments_dtl` (mig 0380) |
| 3 | **Overpayment disposition reconciliation** | Per resolution code, how much excess was disposed, and is every disposition tied to an authoritative voucher line (posted) or orphaned? | `org_fin_overpay_disp_dtl` (mig 0354) |
| 4 | **Cash drawer movement reconciliation** | Does each session's recomputed expected (opening + Σ IN − Σ OUT) match the header expected, is the close difference zero, and are all movements voucher-linked? | `org_cash_drawer_sessions_mst` + `org_cash_drawer_movements_dtl` |

**Exception definition (per RECON_REPORT_EPSILON = 0.01):**
- Report 2: `|header_paid − detail_paid| ≥ ε` → exception.
- Report 3: any row with no `voucher_trx_line_id` → orphan (exception).
- Report 4: `|computed_expected − header_expected| ≥ ε`, OR `|difference| ≥ ε`, OR any unlinked movement → exception.

Report 1 is a **point-in-time snapshot** (not date-filtered) — an outstanding liability is outstanding regardless of when it arose.

---

## Architecture

Thin routes → service → typed rows (matches the existing `app/api/v1/finance/reports/*` pattern, e.g. `tax-report`).

| Layer | File |
|---|---|
| Constants | `web-admin/lib/constants/reconciliation-reports.ts` (`RECONCILIATION_REPORT_KEYS`, `EXCESS_LIABILITY_SOURCES`, `RECON_REPORT_EPSILON`) |
| Types | `web-admin/lib/types/reconciliation-report.ts` (row + summary per report) |
| Service | `web-admin/lib/services/reports/finance-reconciliation-report.service.ts` (4 tenant-scoped fns) |
| CSV util | `web-admin/lib/utils/report-csv.ts` (`toCsv`) |
| API | `web-admin/app/api/v1/finance/reports/reconciliation/{excess-liability,b2b-statements,overpayment-disposition,cash-drawer}/route.ts` |
| Page | `web-admin/app/dashboard/reports/reconciliation/page.tsx` |
| UI | `web-admin/src/features/reports/ui/reconciliation-reports-client.tsx` + 4 `reconciliation-*-rprt.tsx` + `reconciliation-format.ts` |
| Nav (FE) | `web-admin/config/navigation.ts` — child `reports_reconciliation` |
| Nav (DB) | `supabase/migrations/0384_nav_fin_reconciliation_reports.sql` |

**Tenant isolation:** every service fn runs inside `withTenantContext(tenantOrgId, …)` and additionally filters every query by `tenant_org_id` explicitly. The B2B and overpayment detail tables have **no Prisma model** (raw-SQL only, by design since 0380/0354), so the explicit `tenant_org_id` WHERE clause is the authoritative isolation boundary — verified live by the DB-integration test (random tenant → 0 rows for all four reports).

---

## API

All routes: `GET`, gated by `requirePermission('finance_reports:view')`, return `{ success, data }` JSON or CSV when `?format=csv`.

| Route | Query params |
|---|---|
| `/api/v1/finance/reports/reconciliation/excess-liability` | `format?` (no date filter — snapshot) |
| `/api/v1/finance/reports/reconciliation/b2b-statements` | `from?`, `to?`, `format?` |
| `/api/v1/finance/reports/reconciliation/overpayment-disposition` | `from?`, `to?`, `branchId?`, `format?` |
| `/api/v1/finance/reports/reconciliation/cash-drawer` | `from?`, `to?`, `branchId?`, `format?` |

Date windows apply to `created_at` (statements, overpayment) / `opened_at` (cash sessions).

---

## Permissions

**Reuses `finance_reports:view`** (decision 2026-06-20). No new permission — reconciliation reports are gated by the same permission as the other financial reports. Already seeded by `0295_financial_navigation`. Migration `0384` therefore seeds **no permission and no role-default rows** — nav entry only.

Roles (match `reports_financial`): `super_admin`, `tenant_admin`, `admin`, `branch_manager`, `viewer`.

## Navigation

- **comp_code:** `reports_reconciliation` · **parent:** `reports` · **path:** `/dashboard/reports/reconciliation` · **icon:** `Scale` · **display_order:** 51.
- Dual-write: `navigation.ts` child + `0384` `sys_components_cd` row (idempotent UPSERT).

## i18n

Namespace `reports.reconciliation.*` (54 keys) added to `web-admin/messages/en.json` + `ar.json`. Nav label uses `navigation.ts` `label`/`label2` (= `Reconciliation` / `التسوية`), matching the `reports_financial` precedent (no `NAV_TRANSLATION_KEY_MAP` entry). `npm run check:i18n` ✅.

## Migrations

| Migration | Purpose | Type | Applied |
|---|---|---|---|
| `0384_nav_fin_reconciliation_reports.sql` | nav row for the reconciliation reports screen (reuses `finance_reports:view`) | additive, idempotent | ❌ pending user apply (local + remote) |

**Next seq after this = 0385.**

## Tests

- `web-admin/__tests__/services/finance-reconciliation-report.service.test.ts` — 6 unit tests (mocked Prisma, `@jest-environment node`): excess bucketing/sort/rollup, B2B delta + reconciled threshold, overpayment posted/orphan rollup, cash-drawer recomputed-expected + exception logic.
- `web-admin/__tests__/db-integration/reconciliation-reports.db.test.ts` — 5 DB-integration tests (real local DB, F-T5 harness gating): raw-SQL validity + shape for all 4 reports, and tenant isolation (ghost tenant → empty).

## Constants / Types

- `RECONCILIATION_REPORT_KEYS`, `EXCESS_LIABILITY_SOURCES`, `RECON_REPORT_EPSILON` (mirrors the engine's `RECONCILIATION_TOLERANCE = 0.01`).
- Row/summary types per report in `lib/types/reconciliation-report.ts`. Resolution codes reuse `OverpaymentResolutionCode` (DB-mirror); credit-note status reuses `CREDIT_NOTE_STATUSES.ACTIVE`; movement directions reuse `MOVEMENT_DIRECTIONS`.

## Not in scope / follow-ups

- Branch filter UI (the API supports `branchId` for reports 3–4; the client currently sends date window only).
- Advanced reporting (drill-through to individual vouchers, scheduled exports) — phased later per D-09.
- Remote/prod apply of `0384` is user-gated.
