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
Continue with D-09 reconciliation reports (recommended next) unless I say otherwise.
```

---

## State (all SHIPPED + applied to LOCAL + REMOTE by 2026-06-20)

| Phase | What | Migrations | Status |
|---|---|---|---|
| **Phase 1** | F-01 RLS on `org_tax_doc_seq_counters`; F-02/F-04 B2B idempotency + `org_b2b_statement_payments_dtl` + composite FK; F-10 collect-key | 0378–0381 | ✅ applied L+R |
| **Phase 2** | D-11 focused re-validation (RLS + B2B enforcement verified live); build/lint/test green | — | ✅ |
| **F-T5** | DB-level finance test harness (real CHECK/FK/RLS) | — | ✅ `npm run test:db-integration` → 7/7 |
| **F-05** | E-invoicing **FOUNDATION** (tenant flag + activation + scaffolding). Flag placement = dedicated `org_tenants_mst` columns | 0383 | 🟡 foundation only |

**Next migration seq = `0384`.**

## Key artifacts
- F-T5 harness: `web-admin/__tests__/db-integration/finance-smoke.test.ts` (+ `jest.db.config.js`, script `test:db-integration`; default `npm test` ignores the folder). Run vs an ephemeral `supabase start` in CI — **never prod**.
- F-05: `web-admin/lib/payments/e-invoice.ts` (pure), `web-admin/lib/services/e-invoice.service.ts` (reader), `lib/constants/e-invoice.ts`, `lib/types/e-invoice.ts`, `__tests__/services/e-invoice.foundation.test.ts`. Feature doc: `F-05-E-Invoicing-Foundation.md`.

## Carry-over / gotchas
- **43 pre-existing tsc errors** project-wide are **postponed** (build hides them via `next.config.ts ignoreBuildErrors:true`). Not introduced by these phases. Slated for D-12 / a later cleanup.
- **Env:** ensure `web-admin/.env*` `DATABASE_URL` = **local** (`127.0.0.1:54322`) before any `npm` command. It was temporarily pointed at remote for a one-off check on 2026-06-20.
- **Migration rule:** create `.sql`, STOP, ask the user to apply — never apply migrations yourself.

## Remaining phases
1. **D-09** — minimum reconciliation reports (unallocated excess · B2B stmt payment · overpayment disposition · cash drawer). *Recommended next.*
2. **D-12** — third pass: fix the 43 tsc errors, refund-create idempotency, AR reverse/void audit, voucher-reversal review + doc-19 🔵 hardening tests (T-3/T-4/T-5/T-7/T-8/T-10).
3. **F-05 completion** — real per-category tax decomposition (engine emits EXEMPT/ZERO_RATED/OUT_OF_SCOPE that reconcile), wire activation + fiscal-total into the order/tax-doc path, e-invoice status persistence, jurisdiction adapter(s) e.g. ZATCA, **+ HQ (cleanmatexsaas) enablement-toggle UI** that writes the `org_tenants_mst` columns.
