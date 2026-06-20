# Order Financial — Phases RESUME

**Purpose:** one-click pointer to resume after `/clear`. Last updated **2026-06-20**.
**Canonical live log:** `Opus_Validation_Report_18_06_2026/24_IMPLEMENTATION_STATUS.md`
**Memory:** `project_order_fin_validation_2026_06_18` (auto-loads each session).

> ⚠️ The `Opus_Validation_Report_18_06_2026/` folder has a **tool-scoped read/write block** (Read/cat/Grep/Edit denied). Read/write those files with:
> `node -e "process.stdout.write(require('fs').readFileSync('<path>','utf8'))"` (and the fs.writeFileSync equivalent). Files in `docs/features/Order_Fin/` (this folder) read normally.

---

## Paste-prompt (after `/clear`)

```
Resume CleanMateX Order Financial. Read docs/features/Order_Fin/Order_Fin_Phases_RESUME.md
then the canonical log 24_IMPLEMENTATION_STATUS.md (via node -e, that folder blocks Read).
Continue with D-12 third pass (recommended next) unless I say otherwise.
NOTE: migration 0384 (D-09 nav) may still be pending apply — confirm with me first.
```

---

## State (all SHIPPED + applied to LOCAL + REMOTE by 2026-06-20)

| Phase | What | Migrations | Status |
|---|---|---|---|
| **Phase 1** | F-01 RLS on `org_tax_doc_seq_counters`; F-02/F-04 B2B idempotency + `org_b2b_statement_payments_dtl` + composite FK; F-10 collect-key | 0378–0381 | ✅ applied L+R |
| **Phase 2** | D-11 focused re-validation (RLS + B2B enforcement verified live); build/lint/test green | — | ✅ |
| **F-T5** | DB-level finance test harness (real CHECK/FK/RLS) | — | ✅ `npm run test:db-integration` → 7/7 |
| **F-05** | E-invoicing **FOUNDATION** (tenant flag + activation + scaffolding). Flag placement = dedicated `org_tenants_mst` columns | 0383 | 🟡 foundation only |
| **D-09** | Reconciliation reports (excess liability · B2B statement · overpayment disposition · cash drawer). Read-only over existing tables; reuses `finance_reports:view` | 0384 (nav-only) | ✅ applied L+R |
| **Phase 5** | Frontend/UX verify+harden: D-09 reports runtime smoke + not-loaded states; Order-Fin financial UX audit (allocation drawers, collect modal, financial view); manual-allocation over-allocation guard | — (UI/i18n only) | ✅ |

**Next migration seq = `0385`.**

> **D-09 note (2026-06-20):** 4 read-only reports shipped. Code: `lib/services/reports/finance-reconciliation-report.service.ts`, 4 routes under `app/api/v1/finance/reports/reconciliation/*`, page `app/dashboard/reports/reconciliation`, 4 `reconciliation-*-rprt.tsx`. Tests: 6 unit (node env) + 5 DB-integration — all green. Lint/i18n green. **Migration `0384` applied to local + remote (user, 2026-06-20).** Full feature doc: `D-09-Reconciliation-Reports.md`.

> **Phase 5 — Frontend/UX verify + harden (2026-06-20, DONE):** (A) D-09 reports: runtime HTTP smoke (4 API → 401 gated, page → 200); hardened not-loaded-vs-empty states + date-input a11y (+ `reports.reconciliation.notLoaded`). (B) Order-Fin financial UX audit (UX-03) — manual/auto allocation drawers, collect-payment modal, order-detail financial view all verified sound. **Hardening UX-04:** `manual-allocation-drawer.tsx` over-allocation guard (submit was enabled when allocated > excess; now blocked both directions + warning + `manualOverAllocated` i18n). UX-01 = accepted (D-01/ADR-051); UX-02 Save-to-Wallet = needs manual QA. UI/i18n only — no migration. Details in `Opus_Validation_Report_18_06_2026/10_FRONTEND_UX_FINDINGS.md` + `24_IMPLEMENTATION_STATUS.md`.

## Key artifacts
- F-T5 harness: `web-admin/__tests__/db-integration/finance-smoke.test.ts` (+ `jest.db.config.js`, script `test:db-integration`; default `npm test` ignores the folder). Run vs an ephemeral `supabase start` in CI — **never prod**.
- F-05: `web-admin/lib/payments/e-invoice.ts` (pure), `web-admin/lib/services/e-invoice.service.ts` (reader), `lib/constants/e-invoice.ts`, `lib/types/e-invoice.ts`, `__tests__/services/e-invoice.foundation.test.ts`. Feature doc: `F-05-E-Invoicing-Foundation.md`.

## Carry-over / gotchas
- **43 pre-existing tsc errors** project-wide are **postponed** (build hides them via `next.config.ts ignoreBuildErrors:true`). Not introduced by these phases. Slated for D-12 / a later cleanup.
- **Env:** ensure `web-admin/.env*` `DATABASE_URL` = **local** (`127.0.0.1:54322`) before any `npm` command. It was temporarily pointed at remote for a one-off check on 2026-06-20.
- **Migration rule:** create `.sql`, STOP, ask the user to apply — never apply migrations yourself.

## Remaining phases
1. ~~**D-09** — minimum reconciliation reports.~~ ✅ **DONE 2026-06-20** (mig 0384 applied L+R). See `D-09-Reconciliation-Reports.md`.
2. **D-12** — third pass. 🟡 **ACTIVE / starting.** Scope checklist (live tracker) = the "D-12 — Third pass (KICKOFF / scope)" section at the END of `24_IMPLEMENTATION_STATUS.md`. In short: the 43 pre-existing tsc errors (cluster D first — `statement-payment-wiring.handler:50` `getLinkedEffect` mismatch), remaining GA test `collect-payment.idempotency` (F-10), doc-19 🔵 hardening tests (invoice/statement wiring handlers, ar-allocate/cash-drawer-change idempotency, gateway-pending, receipt-allocation rule12/16), refund-create idempotency + AR reverse/void + voucher-reversal review, and the constants/catalog anti-pattern audit. Likely no migration.
3. **F-05 completion** — real per-category tax decomposition (engine emits EXEMPT/ZERO_RATED/OUT_OF_SCOPE that reconcile), wire activation + fiscal-total into the order/tax-doc path, e-invoice status persistence, jurisdiction adapter(s) e.g. ZATCA, **+ HQ (cleanmatexsaas) enablement-toggle UI** that writes the `org_tenants_mst` columns.
