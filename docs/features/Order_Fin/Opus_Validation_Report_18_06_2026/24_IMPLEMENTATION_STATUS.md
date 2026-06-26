# 24 — Implementation Status

**Live log. Source of decisions:** [23_DECISIONS_ADDENDUM.md](./23_DECISIONS_ADDENDUM.md).

## Migration apply status (authoritative)

| Question | Answer |
|---|---|
| Order-Fin migrations to date | `0378`–`0384` (0378 wallet-FK · 0379 seq RLS · 0380/0381 B2B detail+FK · 0383 e-invoice flags · 0384 D-09 nav) |
| Applied to **local** dev DB? | ✅ **Yes** — all applied + verified |
| Applied to **remote / prod**? | ✅ **Yes** — all applied (user, through 2026-06-20) |
| Next free migration seq | **0385** |

> Note: "applied" everywhere in this file means **local dev only** unless stated otherwise. Remote/prod apply is a separate, user-gated step.

## Current Phase
**D-12 — third pass (next / starting).** Completed phases (newest first, see dated sections below): Phase 5 frontend/UX verify+harden · D-09 reconciliation reports (mig 0384) · F-05 e-invoicing foundation (0383) · F-T5 DB harness · D-11 re-validation · Phase 1 F-01/F-02/F-04/F-10 (0378–0381).

## Current Status
🟢 **Phases 1 → D-09 + Phase 5 all COMPLETE; migrations 0378–0384 applied LOCAL + REMOTE (through 2026-06-20). D-12 third pass is the next phase.** (Phase-1 detail retained below for history.)
- 1A (F-01) ✅ `org_tax_doc_seq_counters` RLS=true, 2 policies.
- 1B (F-02/F-04) ✅ `org_b2b_statement_payments_dtl` RLS=true, 2 policies, `uq_b2b_stmt_pay_idem` present; service idempotency active. Composite FK applied via 0381 (`uq_b2b_statements_id_tenant` UNIQUE + `fk_b2b_stmt_pay_statement` composite — both verified live).
- 1C (F-10) ✅ collect-payment per-event key (server UUID fallback + UI random suffix).
- Tests: **12/12** Phase-1 pass; tsc (changed) clean; eslint clean.
- **GA-gate items F-01, F-02, F-04, F-10 = DONE + verified.**
- **Next:** **D-12 third pass** — the 43 pre-existing tsc errors, refund-create idempotency, AR reverse/void accounting, `voucher-reversal.service` review, doc-19 🔵 hardening tests (T-3/T-4/T-5/T-7/T-8/T-10). Scope checklist appended at the end of this file.

## Completed Items
- [x] Decisions D-01..D-12 → `23_DECISIONS_ADDENDUM.md`; `20_OPEN_QUESTIONS.md` marked DECIDED
- [x] GA-gate updated (00, 06, 15, 21) — F-03 removed; F-T5/F-05/D-09 added; F-04/F-10 in this batch
- [x] ADR-051 (feature flags deferred) + ADR-052 (e-invoicing launch scope)
- [x] **1A** — migration `0379_tax_doc_seq_counters_rls.sql` (RLS + tenant_isolation + service_role)
- [x] **1B** — migration `0380_b2b_statement_payment_detail.sql` + B2B service idempotency + detail row + handler wiring
- [x] **1C** — collect-payment per-event key (server UUID fallback + UI random suffix)
- [x] Tests added + green; typecheck (changed files) clean; lint clean

## Blocked Items
- E-invoicing (F-05) phase — needs tenant-flag-placement decision ([23 §Open implementation decisions](./23_DECISIONS_ADDENDUM.md) / [ADR-052](../ADR/ADR-052-E-Invoicing-Launch-Scope.md)). Not in this batch.

## Migrations (exist for this batch — all applied LOCAL only, NOT remote/prod)

| Migration | Purpose | Local | Remote/prod | Needs review before remote |
|---|---|---|---|---|
| `0379_tax_doc_seq_counters_rls.sql` | F-01/D-08 — enable RLS on `org_tax_doc_seq_counters` (tenant_isolation + service_role). Additive, idempotent. | ✅ applied + verified | ❌ no | ✅ yes |
| `0380_b2b_statement_payment_detail.sql` | F-04/D-04 — create `org_b2b_statement_payments_dtl`: PK, `amount > 0`, partial idempotency unique `uq_b2b_stmt_pay_idem`, voucher composite FKs, RLS (tenant + service_role). (Its guarded statement FK correctly skipped — see 0381.) Additive. | ✅ applied + verified | ❌ no | ✅ yes |
| `0381_b2b_stmt_pay_statement_fk.sql` | F-04 follow-up — add `uq_b2b_statements_id_tenant` **UNIQUE (id, tenant_org_id)** on `org_b2b_statements_mst`, then `fk_b2b_stmt_pay_statement` **composite FK** `(statement_id, tenant_org_id) → org_b2b_statements_mst(id, tenant_org_id)` `ON UPDATE/DELETE RESTRICT`. Additive, idempotent. | ✅ applied + verified | ❌ no | ✅ yes |

## Services Changed
- `lib/services/b2b-statement-payment.service.ts` — `allocateB2bStatementPaymentTx` now **consumes `idempotencyKey`** (pre-check against detail table → cached no-op on replay) and **writes an audit/detail row** (ON CONFLICT DO NOTHING backstop). New params `voucherTrxLineId`, `branchId`.
- `lib/services/wiring/statement-payment-wiring.handler.ts` — passes `voucherTrxLineId` + `branchId` through.
- `lib/services/order-settlement.service.ts` — collect key default changed from unsafe `${orderId}_collect_${collectedBy}` to per-request `${orderId}_collect_${randomUUID()}` (F-10); prefers client-supplied key.

## APIs Changed
- `collect-payment/route.ts` — unchanged signature (key remains optional); collision now impossible via the service fallback. (Stricter "require key" deferred — non-breaking choice per D-05; UI already sends a per-event key.)

## Frontend Changed
- `src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx` — per-event idempotency key hardened with a random suffix (guards same-ms double-click collisions).

## Tests Added
- `__tests__/services/b2b-statement-payment.idempotency.test.ts` — apply-once + audit row; replay no-op (no double-reduce); balance cap. (3)
- `__tests__/migrations/phase1-order-fin.test.ts` — content/source guards for 0379 RLS, 0380 table/index/RLS, and the 1C collect-key fix. (9)

## Commands Run
- `npx jest` (Phase-1 suite) · `npx tsc --noEmit` (filtered) · `npx eslint` (changed) · `git stash` (to confirm pre-existing tsc errors)

## Test Results
- **Full suite GREEN (2026-06-20): Jest 1386/1386 pass, 136 suites.** Confirms the Phase-1 batch plus the whole web-admin suite.
- **Phase-1 subset: 28/28 pass** — b2b idempotency (3), phase1 content (9), settlement-catalog (11), wallet disposition (5).
- **Stale-test fix (2026-06-20):** financial-schemas.test.ts had a pre-existing stale assertion (rejects when amountToCharge > saleTotal) left over from before the ADR-046 overpayment policy (the schema-level amountToCharge <= saleTotal guard was intentionally removed in commit a4d28c0c, 11-06). Updated the test to assert overpayment is ACCEPTED at the schema (excess routed by settlement services). No schema/runtime change. (Cursor had reworded the doc comment + swapped 0.001 -> SETTLEMENT_MONEY_EPSILON but never fixed the assertion - both kept; assertion now corrected.)
- **Typecheck:** changed files **clean**. ⚠️ 3 **pre-existing** errors confirmed (via `git stash`) in two files I edited, **not introduced by this work**: `statement-payment-wiring.handler.ts:48` (`tx.org_b2b_statements_mst` not on `TransactionClient` — `getLinkedEffect`, untouched) and `order-collect-payment-modal.tsx:111,334` ("Expected 1 arguments, but got 2" — untouched). Logged under Open Risks for the third pass.
- **ESLint:** clean (exit 0).

## Open Risks
- **Pre-existing tsc errors** (above) — not mine; recommend fixing in the third pass (D-12). `getLinkedEffect` B2B effect-lookup would fail at runtime if exercised (model-accessor mismatch) — separate from the posting path fixed here.
- ~~`0380` statement FK guarded/skipped~~ **RESOLVED:** `org_b2b_statements_mst` PK was `(id)` only, so 0380's composite-FK guard correctly skipped; `0381` added `UNIQUE (id, tenant_org_id)` + the composite FK (both verified live).
- F-05 must not be marked complete until tax decomposition is real.

## Next Steps
1. ✅ Done — `0379`, `0380`, `0381` applied + verified on **local**.
2. **Remote/prod apply (user-gated, NOT done):** review `0379`, `0380`, `0381` and apply to remote/prod.
3. ✅ Full `npm test` GREEN (1386/1386) **and** `npm run build` GREEN (exit 0, 240/240 pages) — both 2026-06-20.
4. ✅ **Focused re-validation (D-11) DONE (2026-06-20)** — see the new "Phase 2 — D-11 Focused Re-validation" section below. RLS live on seq counters; B2B detail/idempotency/composite-FK live; D-1/D-2 dup preview clean.
5. Schedule own phases: F-T5 DB harness · F-05 e-invoicing (decide flag placement) · D-09 reconciliation reports · D-12 third pass.


---

## Phase 2 — D-11 Focused Re-validation + Build Cleanup (2026-06-20)

**Scope decided with user:** run the D-11 re-validation now; **postpone** the broader tsc type-debt cleanup to after the other phases. Build + lint confirmed green.

### Build / lint / type state (whole web-admin)
| Gate | Result |
|---|---|
| `npm run build` | ✅ GREEN — compiled 4.4 min, 240/240 static pages (type validation **skipped** via `next.config.ts` `typescript.ignoreBuildErrors: true`) |
| `npm run lint` (eslint) | ✅ 0 errors (16 JSDoc `@param` warnings in notifications adapters — cosmetic) |
| `tsc --noEmit` (full) | ❌ **43 errors** across ~20 files — pre-existing type-debt the build silently ignores. **POSTPONED** to a later phase per user. |

> The resume note mentioned only "3 pre-existing tsc errors" — that was the subset in the two Phase-1 files. A full `tsc --noEmit` reveals **43** project-wide. Not introduced by Phase 1.

**Deferred type-debt clusters (43):** A. `PaymentMethodCode` union drift (~15: `lib/types/payment.ts:845` + payment-modal-enhanced-02/-v3/-v4); B. voucher line types (5); C. AR receipt/allocation (5: `ArInvoiceDetail.id`, alloc-helper arg, overpayment-resolution-validator); D. Phase-1 carry-over (3: `statement-payment-wiring.handler:50`, `collect-payment-modal:111,337`); E. customer-receipt UI (2); F. pay-extra button variant (1); G. submit-order route discriminated-union (2); H. unrelated domains (9: notifications/push, subscriptions.service, cmx-audit-info-card). Tracked for D-12 / later cleanup phase.

### 1A — RLS on `org_tax_doc_seq_counters` (verified live, LOCAL)
- `relrowsecurity = true`; **2 policies**: `tenant_isolation_org_tax_doc_seq_counters` (USING/CHECK `tenant_org_id = current_tenant_id()`) + `service_role_org_tax_doc_seq_counters` (JWT role).
- App roles `authenticated`/`anon`/`authenticator` have `rolbypassrls = false` → the tenant policy **binds** for app connections.
- `service_role`/`postgres` have `rolbypassrls = true` → the **server-side sequence writer is unaffected** by RLS (resolves the 1A risk note in [16](./16_RECOMMENDED_IMPLEMENTATION_PLAN.md)).
- Supabase **security advisor: table NOT in `rls_disabled_in_public`** → F-01 cleared. (One WARN remains — `pg_graphql_anon_table_exposed`: `anon` has SELECT grant — a pre-existing project-wide pattern mitigated by the row-filtering policy. Optional follow-up: `REVOKE SELECT ... FROM anon`.)
- N/A on LOCAL: row-level cross-tenant leak test + gap-free numbering — table is **empty** (no rows/documents to exercise). Enforcement established structurally (RLS on + correct policies + app roles bind). The RLS change is additive and does not alter numbering logic.

### 1B / F-04 — B2B statement payment detail + idempotency (verified live, LOCAL)
- `org_b2b_statement_payments_dtl`: RLS on; `tenant_isolation` + `service_role` policies; `chk_b2b_stmt_pay_amt` CHECK (amount > 0); composite PK `(id, tenant_org_id)`.
- **`uq_b2b_stmt_pay_idem`** = `UNIQUE (tenant_org_id, idempotency_key) WHERE idempotency_key IS NOT NULL` — the partial idempotency guard, live.
- All 3 FKs **composite + tenant-scoped, no CASCADE**: `fk_b2b_stmt_pay_statement` → `org_b2b_statements_mst(id, tenant_org_id)` RESTRICT/RESTRICT (0381); `fk_b2b_stmt_pay_voucher` + `fk_b2b_stmt_pay_vch_line` → composite, ON DELETE SET NULL.
- `org_b2b_statements_mst.uq_b2b_statements_id_tenant` = `UNIQUE (id, tenant_org_id)` (0381, the composite-FK target).
- **D-1/D-2 dup preview clean:** detail table `total_rows = 0`, `rows_with_key = 0`, `duplicate_idem_groups = 0`. (The unique index already created successfully in 0380 → no violating data at apply time.)
- Replay-leaves-balance-unchanged behavior covered by `b2b-statement-payment.idempotency.test.ts` (3/3) inside the green 1386-test suite.

### Re-validation verdict
🟢 **D-11 PASS (LOCAL).** Both GA-gate DB changes (F-01 RLS, F-04 B2B detail/idempotency/composite-FK) are live and correct on local. Remaining gates: remote/prod apply of 0379/0380/0381 (user-gated); broader tsc type-debt cleanup (postponed); own phases (F-T5, F-05, D-09, D-12).


---

## F-T5 — DB-level finance test harness (2026-06-20)

🟢 **DONE (local).** New Node-environment integration suite runs against the REAL local Supabase DB (migrations applied) and asserts live CHECK/FK/RLS invariants the mocked-Prisma unit tests can never reach — closing the structural seam that let F-00 (the wallet CHECK) ship.

**Files added / changed**
- `web-admin/__tests__/db-integration/finance-smoke.test.ts` — 7 DB-truth tests.
- `web-admin/jest.db.config.js` — node-env jest config, separate from the jsdom unit suite.
- `web-admin/jest.config.js` — default suite now ignores `__tests__/db-integration/`.
- `web-admin/package.json` — `"test:db-integration": "jest --config jest.db.config.js"`.

**Coverage (every write inside a rolled-back tx — nothing persists)**
- **Overpayment catalog/constraint parity (wallet-blocker class):** `sys_fin_overpay_res_cd` holds all V1 codes incl. `SAVE_TO_CUSTOMER_WALLET`; `org_fin_overpay_disp_dtl.resolution_code` is FK-guarded (`org_fin_overpay_disp_res_fk`) with **no** re-introduced hardcoded CHECK — a live 0378 regression lock.
- **F-01 RLS enforcement (T-6):** under a tenant-A JWT (`SET LOCAL ROLE authenticated` + `request.jwt.claims`), a tenant-B `org_tax_doc_seq_counters` row is invisible (own=1, cross=0). Proven non-vacuous — an inverted-expectation sanity run failed with `Received: 0`.
- **F-04 B2B detail (live):** `chk_b2b_stmt_pay_amt` rejects amount<=0 (23514); composite `fk_b2b_stmt_pay_statement` rejects an unknown statement (23503); partial `uq_b2b_stmt_pay_idem` blocks a duplicate (tenant, idempotency_key) (23505); two distinct keys are allowed.

**Design:** Prisma interactive transactions, always rolled back (negative tests reject the tx; positive tests throw a sentinel). Raw SQL bypasses the tenant middleware so tenant context is explicit. A `beforeAll` DB-ping **gates** the suite — skips cleanly when no DB (dev without the stack / CI without a DB), enforces when present. **No new dependencies** (`pg`, `@prisma/client` already present).

**Validation:** `npm run test:db-integration` -> **7/7 pass**. Default `npm test` excludes the folder (0 db-integration tests). New files add **0 lint errors** and **0 tsc errors** (project total unchanged at 43, still postponed).

**Remaining F-T5 hardening (optional, deferred to D-12/later):** the doc-19 🔵 items — wiring-handler unit tests (T-4/T-5), AR-allocate regression-lock (T-3), cash-change idempotency (T-7), gateway-pending exclusion (T-8), allocation fallback matrix (T-10) — plus the constants/catalog anti-pattern audit. The GA-critical T-1/T-6 + B2B/wallet DB-truth are **DONE**.


---

## F-05 — E-invoicing foundation (2026-06-20)

🟡 **Foundation SHIPPED — NOT complete** (ADR-052 honesty guardrail: real per-category decomposition + adapters are tracked follow-ups). Full feature doc: [F-05-E-Invoicing-Foundation.md](../F-05-E-Invoicing-Foundation.md).

**Blocking decision resolved:** tenant-flag placement = **dedicated typed columns on org_tenants_mst** (Approved_By_Jh). Chosen over feature_flags jsonb / HQ-managed setting because it is the only option that DB-enforces "start date set when enabled" and keeps the activation read off any cross-project API on the order hot path.

**Migration:** `0383_einvoice_tenant_enablement.sql` — adds `is_e_invoice_enabled` (bool, default false) + `e_invoice_enabled_start_date` (date) + CHECK `chk_org_tnt_einv_start`. Additive; **applied local + remote** (user, 2026-06-20); verified live on local. (Seq 0382 was already taken by `0382_ntf_templates_full_seed.sql` → next free = 0383. **Next seq now 0384.**)

**Activation rule:** `is_e_invoice_enabled = true AND order_date >= e_invoice_enabled_start_date` (calendar-date granularity). Disabled / pre-start-date orders keep the existing flat-VAT flow unchanged.

**Code added:**
- `prisma/schema.prisma` — org_tenants_mst gains the two fields (client regenerated).
- `lib/constants/e-invoice.ts` — `TAX_CATEGORY` (STANDARD/EXEMPT/ZERO_RATED/OUT_OF_SCOPE), `E_INVOICE_STATUS` (scaffolding, not yet persisted).
- `lib/types/e-invoice.ts` — enablement, activation, `TaxCategoryDecomposition`, `FiscalTotalCheck`.
- `lib/payments/e-invoice.ts` (pure) — `isEInvoiceActive`, `validateFiscalTotal`, `buildFoundationTaxDecomposition` (V1 STANDARD passthrough).
- `lib/services/e-invoice.service.ts` (server) — `resolveEInvoiceActivation` (mirrors `resolveTaxPricingMode`).
- `__tests__/services/e-invoice.foundation.test.ts` — 12 pure tests.

**Validation:** F-05 unit tests **12/12**; typecheck **0 new errors** (project total unchanged at 43); lint **0 errors**; migration verified live.

**Cross-project follow-up:** cleanmatexsaas HQ tenant-management must surface the enablement toggle + start-date picker that WRITE these columns (cleanmatex only reads them).

**NOT complete until:** real per-category tax decomposition (engine emits buckets that reconcile) + wiring into order/tax-document path + e-invoice status persistence + jurisdiction adapter(s) + HQ toggle UI.



---

## D-09 — Reconciliation reports (2026-06-20)

🟢 **Implemented (local). Migration `0384` created — NOT applied (user-gated, local + remote).** Four read-only reconciliation reports over existing finance tables (no new tables). Full feature doc: [D-09-Reconciliation-Reports.md](../D-09-Reconciliation-Reports.md).

**Reports (all tenant-scoped via `withTenantContext` + explicit `tenant_org_id` WHERE):**
- **1. Unallocated excess / customer stored-value liability** — wallet + advance + active credit-note balances > 0 (point-in-time snapshot, not date-filtered). Prisma.
- **2. B2B statement payment recon** — header `paid_amount` vs Σ `org_b2b_statement_payments_dtl` (mig 0380) per statement; `|delta| ≥ 0.01` = exception. Raw SQL (no Prisma model).
- **3. Overpayment disposition recon** — `org_fin_overpay_disp_dtl` (mig 0354) grouped by resolution code + currency; posted (has `voucher_trx_line_id`) vs orphan (no voucher line = exception). Raw SQL.
- **4. Cash drawer movement recon** — per session: opening + Σ IN − Σ OUT (recomputed expected) vs header expected, close difference, count of movements with no `fin_voucher` backlink. Prisma + raw-SQL movement aggregate.

**Permission DECISION (user, 2026-06-20):** REUSE `finance_reports:view` (already seeded by 0295). So `0384_nav_fin_reconciliation_reports.sql` is **nav-only** — no new permission, no role-default rows; one `sys_components_cd` row (`reports_reconciliation` under `reports`, roles = super_admin/tenant_admin/admin/branch_manager/viewer, path `/dashboard/reports/reconciliation`). Dual-write: `config/navigation.ts` child added.

**Files added:** `lib/constants/reconciliation-reports.ts`, `lib/types/reconciliation-report.ts`, `lib/services/reports/finance-reconciliation-report.service.ts`, `lib/utils/report-csv.ts`, 4 routes under `app/api/v1/finance/reports/reconciliation/*`, `app/dashboard/reports/reconciliation/page.tsx`, `src/features/reports/ui/reconciliation-reports-client.tsx` + 4 `reconciliation-*-rprt.tsx` + `reconciliation-format.ts`. i18n: `reports.reconciliation.*` (54 keys) EN+AR.

**Validation:** unit tests **6/6** (`finance-reconciliation-report.service.test.ts`, node env — Prisma.sql needs the node build); DB-integration **5/5** (`reconciliation-reports.db.test.ts` — raw-SQL validity + shape for all 4 + tenant isolation: ghost tenant → 0 rows). `npm run check:i18n` ✅; ESLint (new files) **0 errors**; tsc — **0 new errors** (project total unchanged at 43, still postponed). Build: see below.

**Migration apply (user-gated, NOT done):** review + apply `0384` to local + remote. **Next seq after 0384 = 0385.**

**Not in scope:** branch-filter UI (API supports `branchId` on reports 3–4; client sends date window only); advanced/drill-through reporting (phased later per D-09).


---

## Phase 5 — Frontend / UX verification + hardening (2026-06-20)

🟢 **DONE.** Two parts (user: "Both, D-09 first").

### Part A — D-09 reconciliation reports UX (verify + harden)
- **Runtime smoke** (dev server :3007, unauth): all 4 API routes → **401** (routed + permission-gated, not 404/500); page `/dashboard/reports/reconciliation` → **200** (server page + edited client/components compiled clean in dev); CSV path also auth-gated. Combined with the DB-integration tests (real tenant) this verifies wiring end-to-end.
- **Hardening:** the 4 `reconciliation-*-rprt.tsx` now distinguish **not-loaded** (`data === null` → `notLoaded` prompt) from **loaded-but-empty** (was previously conflated — the default Excess tab showed "no balances" before it had even queried). Date inputs in the client got `aria-label`s. New i18n key `reports.reconciliation.notLoaded` (EN/AR).

### Part B — Order-Fin Phase 5 financial UX audit (UX-03)
Reviewed the surfaces not opened in the original pass — see [10_FRONTEND_UX_FINDINGS.md](./10_FRONTEND_UX_FINDINGS.md) "Phase 5" section. Verdict 🟢: manual + auto allocation drawers, collect-payment modal (later-collection), and order-detail financial view all meet preview-before-post / submit-disabled-until-resolved / canonical-field-separation / EN-AR / RTL / RBAC criteria.
- **Hardening (UX-04):** `manual-allocation-drawer.tsx` allowed **over-allocation** (`remaining = max(0, excess − allocated)` → typing more than the excess still enabled submit). Added `isOverAllocated` guard (submit disabled both directions + rose warning + `handleSubmit` backstop), new i18n key `newOrder.payment.extraReceipt.allocation.manualOverAllocated` (EN/AR).
- **UX-01** feature-flag gating = accepted per **D-01 / ADR-051** (not actionable). **UX-02** Save-to-Wallet (fixed by 0378) = needs **manual QA** only.

### Validation
`npm run check:i18n` ✅ · ESLint (changed files) **0** · production build green · tsc unchanged (43 pre-existing, 0 new). No new migration (UI/i18n only). **Next seq still 0385.**


---

## D-12 — Third pass (KICKOFF / scope) — 2026-06-20

🟡 **NOT STARTED — scope locked, this is the active phase.** Source: [23 D-12](./23_DECISIONS_ADDENDUM.md), [19](./19_TESTS_TO_ADD_OR_REWRITE.md), [22](./22_FOLLOWUP_DEEP_DIVE.md), Phase-2 tsc-cluster note above. No GA blockers remain; D-12 is hardening + type-debt + remaining ❓ closure.

### Scope checklist
**1. Type-debt — the 43 pre-existing tsc errors** (build hides them via `next.config.ts ignoreBuildErrors:true`). Clusters (Phase-2 note): A. `PaymentMethodCode` union drift (~15: `lib/types/payment.ts:845` + payment-modal-enhanced-02/-v3/-v4); B. voucher line types (5); C. AR receipt/allocation (5); D. Phase-1 carry-over (3: `statement-payment-wiring.handler:50`, `collect-payment-modal:111,337`); E. customer-receipt UI (2); F. pay-extra button variant (1); G. submit-order route discriminated-union (2); H. unrelated domains (9: notifications/push, subscriptions.service, cmx-audit-info-card).
- [x] Resolve cluster D first (DONE 2026-06-20).
- [x] Then A–C, E–H. Target: `tsc --noEmit` → 0. **DONE 2026-06-25 — tsc now 0** (cluster A closed by retiring legacy modals v3/enhanced-02 → `*.tsx.bak` + v4 typed-helper fix).

**2. Remaining GA-class test**
- [x] `__tests__/db-integration/collect-payment.idempotency.test.ts` (F-10) — DONE 2026-06-25 — two sequential partial collections (same cashier) both succeed + sum; explicit-key replay dedupes.

**3. doc-19 🔵 hardening tests**
- [x] `invoice-payment-wiring.handler.test.ts` (F-T2 / rule 7) — DONE 2026-06-25 (linkage regression lock)
- [x] `statement-payment-wiring.handler.test.ts` (F-T2 / rule 8) — DONE (pairs with cluster-D fix)
- [x] `ar-allocate.idempotency.test.ts` (F-02) — DONE 2026-06-25 (DB-integration; + D-12 linkage lock)
- [x] `cash-drawer-change.idempotency.test.ts` (F-07) — DONE 2026-06-25 (mock handler; CASH_IN line-anchor guard)
- [x] `order-financial-write.gateway-pending.test.ts` (rule 19/20) — DONE 2026-06-25 (buildWarningCodes pending/authorized)
- [x] extend `customer-receipt-allocation.service.test.ts` (rule 12) — DONE 2026-06-25 (zero/partial/cap edge cases)
- [x] `customer-receipt-allocation.fallback.test.ts` (rule 16) — DONE 2026-06-25 (fallback-destination matrix)

**4. Remaining ❓ correctness review (deferred items)**
- [x] Refund-create idempotency + reverse-allocation accounting — REVIEWED 2026-06-25 (findings F-R1/F-R2/F-R3; AR reverse-allocation CLEAN).
- [x] `voucher-reversal.service` unwind correctness — REVIEWED 2026-06-25 (CLEAN; double-reverse blocked by transition table).
- [x] AR reverse/void accounting — REVIEWED 2026-06-25 (CLEAN; withIdempotency + reversed_at/approval guards).

**5. Anti-pattern audit (across the suite)**
- [ ] Find other `*constants*`/`*catalog*` tests asserting only shape/uniqueness (the F-T1 false-positive class) → convert to real DB/migration parity.

### Out of scope for D-12 (own later phases)
- F-05 tax decomposition completion; promotion/loyalty engine correctness; gateway capture/callback; mobile/offline POS.

### Notes
- Likely **no migration** (type fixes + tests). If any fix needs a DB change, next seq = **0385**.
- Each cluster/test lands incrementally; this checklist is the live tracker — tick items as they complete.


### D-12 progress log
- **2026-06-20 — Cluster D DONE (tsc 43 → 39).** Fixed: `statement-payment-wiring.handler.ts` `getLinkedEffect` — `org_b2b_statements_mst` has no Prisma model (raw-SQL only), so `tx.org_b2b_statements_mst.findFirst` was both a tsc error AND a runtime crash had it been exercised; replaced with `tx.$queryRaw`. Fixed the `formatMoneyWithCode(value, currencyCode)` 2-arg calls (1-arg fn; 2nd arg was a runtime no-op) in `order-collect-payment-modal.tsx` (×2) and `customer-account-receipt-client.tsx` (×1). Added `__tests__/services/statement-payment-wiring.handler.test.ts` (7 tests, green) — covers canHandle/validate/wire + a **regression lock** for the raw-SQL `getLinkedEffect`. ESLint clean.
  - Remaining **39** by cluster: **A** PaymentMethodCode union drift ~16 (payment-modal-v3 7, -enhanced-02 6, -v4 1, v4-credit-note-picker 1, payment.ts 1); **H** unrelated 9 (cmx-audit-info-card 4, push.ts 3, subscriptions.service 2); **B** voucher line types 5 (add-line-dialog 2, voucher-edit-dialog 1, voucher-biz.service 1, new-voucher-client 1); **C** AR receipt/allocation ~5 (customer-receipt-excess-executor 2, overpayment-resolution-validator 1, customer-account-receipt-client 1, + invoice-payment-wiring.handler 2 = missing `unapplied_credit_amount` arg + `ArInvoiceDetail.id` mismatch); **G** submit-order route 2; **F** pay-extra button variant 1.
  - Checklist items ticked: §1 cluster D; §3 `statement-payment-wiring.handler.test.ts`.

- **2026-06-20 — Cluster A partial (tsc 39 → 36).** Applied the 3 **safe, unambiguous** root-cause fixes: (1) `PAYMENT_METHOD_ICONS` (`lib/types/payment.ts`) was `Record<PaymentMethodCode,string>` missing `PAY_ON_DELIVERY` + `PAYMENT_GATEWAY` keys → added. (2) `payment-validate-button.tsx` `variant="default"` → `"primary"` (not a valid LoadingButton variant). (3) `payment-modal-v4-credit-note-picker.tsx` `formatMoneyAmountWithCode(.., { currencyCode })` missing required `decimalPlaces` → pulled from `useTenantCurrency()`. ESLint clean; no new errors.
  - **REMAINING cluster A = 14 union-drift errors** (payment-modal-v3 ×7, -enhanced-02 ×6, -v4 ×1; all 3 modals are live, imported by `new-order-modals.tsx`). Root: code assigns a value typed `PaymentMethodCode` (12 members incl. gateway codes HYPERPAY/PAYTABS/STRIPE) to a leg `method` field typed by `canonicalPaymentMethodCodeSchema` (`new-order-payment-schemas.ts`), which **deliberately excludes** HYPERPAY/PAYTABS/STRIPE. `normalizePaymentMethodCode` only maps legacy aliases — it does NOT fold gateway codes into PAYMENT_GATEWAY. **This is a DOMAIN QUESTION, not a cosmetic cast** → ⚠️ NEEDS DECISION before fixing: *Are HYPERPAY/PAYTABS/STRIPE valid checkout-leg method values, or do gateway payments always use method=`PAYMENT_GATEWAY` with the provider in a separate field?* If valid → widen the leg schema enum (also fixes a latent runtime validation **rejection** of gateway legs). If not → narrow the source type (config `payment_method_code` → leg-method type) so the gateway codes can't flow into a leg. Deferred until answered; a blind `as` cast would hide the question.
  - **Phase total: tsc 43 → 36** (cluster D 3 + customer-receipt 1 + cluster A 3). Tests: +1 suite (statement-payment-wiring.handler, 7/7).

- **2026-06-20 — Cluster A union-drift POSTPONED (user decision).** All PAYMENT_GATEWAY-related work (the HYPERPAY/PAYTABS/STRIPE leg-method question + the 14 union-drift errors in payment-modal-v3/-enhanced-02/-v4 that depend on it) is **deferred to a later phase** per user. Do NOT cast/force these — they need the gateway-method domain decision first (see the previous entry). Remaining tsc after this stays at **36** until that phase. Continuing D-12 with the non-gateway clusters (C/B/G) + doc-19 hardening tests.

- **2026-06-20 — Cluster C partial (tsc 36 → 34).** Root-caused the AR-allocate input drift: `AllocateArPaymentInput` was `z.infer` (= z.output) of `allocateArPaymentSchema`, which made the `.default(0)` field `unapplied_credit_amount` **required**; but the AR allocate services consume the raw input and the producer **derives** unappliedCreditAmount itself (input value is never read). Changed to **`z.input`** → fixes the missing-field error in BOTH `invoice-payment-wiring.handler.ts` and `customer-receipt-excess-executor.service.ts`. Safe: the type's only consumers are 2 function params; 4 of the 6 `allocateArPaymentTx` callers ignore the return anyway.
  - **DEFERRED (2 errors, documented): `allocation.id` on `ArInvoiceDetail`** (`invoice-payment-wiring.handler.ts:45`, `customer-receipt-excess-executor.service.ts:172`). `allocateArPaymentTx` returns `getArInvoiceDetail()` (the INVOICE, no `id`) via `withIdempotency` which yields `.data`; the producer's `resourceId` (= the `org_invoice_payments_dtl` row id) is cached but NOT returned. So both call sites read `.id` → **undefined at runtime** = a **latent audit/linkage gap** (wired-effect ref / overpayment `target_ref` set to undefined), NOT a money error (the allocation row is still created correctly). **Recommended fix (own change):** have `allocateArPaymentTx` return the allocation row id (e.g. `{ allocationPaymentId, invoice }`) — 4/6 callers ignore the return so blast radius is small, but it changes the AR idempotency `response_cache` shape, so it deserves a focused, tested change rather than being rushed. The paired doc-19 test `invoice-payment-wiring.handler.test.ts` is deferred WITH this fix (testing `wire` now would lock the undefined-id behavior).
  - **Phase total: tsc 43 → 34** (D 3 + customer-receipt 1 + A-safe 3 + C-safe 2). Tests: +1 suite (statement-payment-wiring, 7/7).

- **2026-06-25 — Type-debt clusters B/C/G/H CLEARED + AR `.id` linkage own-change (tsc 34 → 14).** All remaining NON-postponed tsc errors fixed; the 14 that remain are exclusively the user-postponed gateway-union **cluster A** (payment-modal-v3 ×7, -enhanced-02 ×6, -v4 ×1). Full suite **1422 pass + 1 todo / 141 suites**, eslint 0 on changed files, no regressions.
  - **Root-cause discovery (explains earlier narrowing puzzles):** project `tsconfig.json` has **`strict: false`** → `strictNullChecks` off. Consequences observed: (a) `string | null` collapses to `string` in error displays (the missing `| null`); (b) **boolean-discriminant narrowing does not engage** — `if (x.conflict) return` / `x.conflict ? :` do NOT narrow `{conflict:false}|{conflict:true}`. Fixes chose narrowing forms that work under non-strict.
  - **Cluster B (voucher line types, 5):** 3 new `LINE_ROLE`s (`STATEMENT_PAYMENT`, `STATEMENT_CREDIT_APPLICATION`, `CUSTOMER_CREDIT_ISSUE`) were missing from the two exhaustive `Record<LineRole,…>` maps in `add-line-dialog.tsx` → added, mirroring siblings (STATEMENT_PAYMENT≈INVOICE_PAYMENT=RECEIPT/IN; STATEMENT_CREDIT_APPLICATION≈ORDER_CREDIT_APPLICATION=ADJUSTMENT/NEUTRAL; CUSTOMER_CREDIT_ISSUE≈CUSTOMER_CREDIT_RECEIPT=RECEIPT/IN). `VoucherLineData.payment_status` (required) was missing at 3 construction sites → `voucher-biz.service.ts` maps `l.payment_status ?? null` (real DB column), the two optimistic-UI placeholders (`new-voucher-client.tsx`, `voucher-edit-dialog.tsx`) set `payment_status: null` (server refreshes the canonical row).
  - **Cluster G (submit-order, 2):** `stakeIdempotencyHash` returns a `{conflict:false;resourceId}|{conflict:true;existingHash}` union; under non-strict the `conflict` guard did not narrow. Fixed with **`'resourceId' in stakedRecord`** property-presence narrowing (works regardless of strict mode).
  - **Cluster H (unrelated domains, 9):** `push.ts` ×3 — JSON `subscription_data` (`Record<string,unknown>`) cast to provider shapes via the established `as unknown as` bridge (matches `in-app.ts`). `subscriptions.service.ts` ×2 — renewal job used non-existent columns; corrected to `plan_code` (getPlan takes plan_code) and `current_period_end` (DB-mirror). `cmx-audit-info-card.tsx` ×4 — actor rows legitimately carry an `AuditActor` through the row `value` slot (resolved at render via `as AuditActor`); introduced `AuditRowValue = ReactNode|Date|AuditActor|null|undefined`, widened the 4 spots (RenderableAuditRow.value, buildRow.explicitValue, renderRowValue, isValueEmpty), made `fallbackId` narrowing explicit (typeof ternary), and cast the generic-branch return (`value as ReactNode`).
  - **Cluster C (AR receipt/allocation, 4):** `customer-account-receipt-client.tsx` — `useHasPermission('customers:receipt_allocate')` (2-arg fn) → `useHasPermissionCode('customers:receipt_allocate')` (single-code variant; preserves the exact permission-code literal). `overpayment-resolution-validator.service.ts` — removed a dead comparison against `VOID_OR_REFUND_EXCESS` (not a member of `OverpaymentResolutionInput`; rejected upstream by the schema), keeping the live `RESTORE_STORED_VALUE` block (behavior-preserving).
  - **Cluster C — AR `.id` linkage OWN-CHANGE (the previously-deferred 2 errors):** `allocateArPaymentTx` returned the **invoice detail** (no usable row id), so `invoice-payment-wiring.handler.wire` read `allocation.id`→undefined and `customer-receipt-excess-executor` set `targetRef`→undefined: a **latent audit/linkage gap** (wired-effect ref / overpayment `target_ref` undefined at runtime; NOT a money error — the allocation row was still created). Fix: added **`withIdempotencyResource<T>`** (returns `{resourceId,data}`; reads `resource_id` from the cached row on replay) and made `withIdempotency<T>` delegate to it (**zero change** for the 4 callers that ignore the return: ar-credit:333, payment-service:406/620/1404). `allocateArPaymentTx` now returns **`{ allocationPaymentId, invoice }`**. Consumers: `wire` returns `allocationPaymentId` (the `org_invoice_payments_dtl` row id) and **throws if null**; excess-executor sets `targetRef = allocation.allocationPaymentId`.
  - **Paired doc-19 test added:** `__tests__/services/invoice-payment-wiring.handler.test.ts` (7 tests — canHandle/validate/wire/getLinkedEffect + a **linkage regression lock**: `wire` throws when no allocation-payment row id is returned, pinning it can't regress to the invoice id). Green alongside `statement-payment-wiring.handler.test.ts` (14/14 combined).
  - **Checklist ticks:** §1 clusters B, C (incl. the `.id` linkage), G, H; §3 `invoice-payment-wiring.handler.test.ts`. **Phase total: tsc 43 → 14** (all 14 = postponed cluster A).
  - **Inventory note:** the `useHasPermission`→`useHasPermissionCode` edit keeps the same permission code/file/line 59 (the extractor recognizes both forms — `extract-permissions.ts` lines 121/128/134), so the inventory entry id is stable; only the cosmetic `via` metadata could refresh. Recommend `Mode: refresh · surface=page · route=/dashboard/customers/account-receipt` at the next convenient inventory rebuild (user runs those as dedicated commits).
  - **No migration** (type fixes + tests only). **Next seq still 0385.**
  - **Remaining D-12 (next session):** §2 `collect-payment.idempotency` (F-10, GA-class) — belongs in the **DB-integration harness** (settleOrderTx write path; a mock-only unit test would be the §5 shape-only anti-pattern); §3 other doc-19 tests (ar-allocate, cash-drawer-change, gateway-pending, customer-receipt extend/fallback); §4 refund/voucher-reversal/AR-reverse correctness review; §5 anti-pattern audit; **cluster A** gateway-union still blocked on the gateway-method domain decision.

- **2026-06-25 (later) — Cluster A gateway union-drift CLOSED (tsc 14 → 0). ✅ D-12 §1 type-debt COMPLETE.**
  **User decision (this session):** retire the two legacy payment modals instead of fixing them. Only `payment-modal-v4.tsx` is maintained going forward; `payment-modal-v3.tsx` and `payment-modal-enhanced-02.tsx` were **renamed to `*.tsx.bak`** (excluded from the tsconfig `**/*.tsx` glob → no longer type-checked or built). Their gateway-union edits were reverted before renaming (true backups of last working state).
  **Gateway-method domain decision:** PAYMENT_GATEWAY + provider field — HYPERPAY/PAYTABS/STRIPE are provider identifiers, never leg `method` values. Added to `lib/validations/new-order-payment-schemas.ts`: type `SettlementMethodCode = Exclude<PaymentMethodCode, gateway-providers>` + helper `toCanonicalLegMethod(code): SettlementMethodCode` (delegates to the existing runtime `normalizePaymentMethodCode`, which already folds the 3 provider codes → PAYMENT_GATEWAY; only the **return type** is tightened). Applied at the single v4 site (`setValue('paymentMethod', …)`). NO Zod schema change, NO migration.
  **Selector collapse:** `new-order-modals.tsx` dropped the two retired dynamic imports + the version branch; `ActivePaymentModal` is now always `PaymentModalV4` (legacy stored version codes fall back to V4). `order-summary-panel.tsx` demo-tenant version dropdown reduced to the single V4 option + label simplified. The `usePaymentModalVersion` hook + `PAYMENT_MODAL_VERSIONS` enum are left intact (stored settings still coerce safely; `payment-modal-version.test.ts` unchanged and green).
  **Validation:** `tsc --noEmit` → **0 errors** (was 14); eslint 0 on the 4 changed files; full `npm test` → **1423 pass / 141 suites**. **Phase total: tsc 43 → 0.** No migration. Next seq still 0385.
  **Checklist tick:** §1 (all 8 type-debt clusters now resolved — cluster A closed by retiring the two legacy modals + the v4 typed-helper fix). **D-12 §1 type-debt fully closed.**

- **2026-06-25 (later) — §2 collect-payment.idempotency GA-class test DONE.** Added `__tests__/db-integration/collect-payment.idempotency.test.ts` (3 tests, DB-level, rolled back, DB-gated).
  **Design note (important):** `collectPaymentTx` is NOT directly testable in the rollback harness — it opens its OWN `prisma.$transaction` (commits) and reads tenant settings via the Supabase SSR `createClient()` (no request context in node). Its idempotency semantics live entirely in the keyed sub-op `executeOverpaymentDispositionTx(tx,…)`, which IS rollback-composable and is the exact locus of the old F-10 collision (stable `${orderId}_collect_${collectedBy}` key shared across distinct collection events → second event silently deduped). The suite exercises that real DB path: (1) **distinct keys → two independent disposition rows that sum** (proves two collection events both apply — the F-10 fix), (2) **same-key replay → one row, second call returns the existing id** (genuine retry dedupes), (3) **different resolution codes under one base key stay distinct** (per-line key `${key}_op_${code}_${idx}` composition).
  **Validation:** `npm run test:db-integration` → **15/15** (7 finance-smoke + 5 reconciliation + 3 new); eslint 0; tsc unaffected (0). No migration.
  **Checklist tick:** §2 collect-payment.idempotency. **Note for §4:** the plain (non-overpayment) collection path has NO row-level idempotency guard — a genuine retry of a plain partial collection with the same explicit key would insert a second `org_order_payments_dtl` row (potential double-apply). Flagged for the §4 correctness review.

- **2026-06-25 (later) — §3 doc-19 hardening tests DONE (5 artifacts, +21 unit / +2 db-integration).**
  - `__tests__/db-integration/ar-allocate.idempotency.test.ts` (2, DB-level) — `allocateArPaymentTx`: same key → ONE allocation + **same allocationPaymentId** (D-12 linkage lock) + paid moved once; distinct keys → two allocations + paid reflects both. Harness note: the fn writes via the external tx but its final return reads the invoice on a NON-tx reader, so the bare invoice+customer seed is COMMITTED (reader finds it) while the allocation runs in a rolled-back tx; only the 2 seed rows are deleted in `finally`.
  - `__tests__/services/cash-drawer-change.idempotency.test.ts` (9, mock handler — matches invoice/statement handler precedent) — CASH_IN carries `fin_voucher_trx_line_id` (the `uq_cd_mov_vch_line` anchor / DB idempotency guard); CASH_OUT change is written WITHOUT it (separate movement, no collision); no-change → only CASH_IN; session-not-OPEN throws; getLinkedEffect re-reads by the line anchor.
  - `__tests__/services/order-financial-write.gateway-pending.test.ts` (4, pure) — `buildWarningCodes`: pending (gateway) amount → PENDING_PAYMENT_COUNTED_AS_PAID; authorized → AUTHORIZED_PAYMENT_COUNTED_AS_PAID; fully-COMPLETED → neither; mixed cash+gateway surfaced via the pending warning (pending legs are summed to pendingPaymentAmount, never totalPaidAmount).
  - `customer-receipt-allocation.service.test.ts` EXTENDED (+3) — zero-outstanding target skipped → full excess to fallback; one target + remainder → fallback advance; `max_targets_per_allocation` cap respected, uncovered remainder → fallback.
  - `__tests__/services/customer-receipt-allocation.fallback.test.ts` (5, pure) — fallback-destination matrix: CUSTOMER_ADVANCE / CUSTOMER_CREDIT / WALLET_TOPUP / RETURN_CHANGE(→advance default) / BLOCK_AND_REQUIRE_MANUAL_ACTION(→blocked, no line, BLOCKED warning).
  - **§4 finding surfaced here:** the `allow_partial_last_target=false` guard in `runAutoAllocationAlgorithm` is UNREACHABLE — `isLastWithRemainder` (allocAmount<outstanding ⇒ remaining<outstanding) contradicts the same `if`'s `remaining > target.outstandingAmount`. No test locks the dead branch; carried into §4 review.
  - **Validation:** full `npm test` → **1444 pass / 144 suites** (was 1423/141); `npm run test:db-integration` → **17 / 4 suites** (was 15/3); eslint 0 on all 5 files; `tsc --noEmit` → **0** (cleared a stale incremental-cache false count). No migration.
  - **Checklist ticks:** §3 ar-allocate.idempotency, cash-drawer-change.idempotency, order-financial-write.gateway-pending, customer-receipt extend, customer-receipt-allocation.fallback. **All §3 doc-19 tests complete.**

- **2026-06-25 (later) — §4 correctness review DONE (read-only; findings below).**
  **CLEAN (no change needed):**
  - **`voucher-reversal.service.reverseBizVoucher`** — locks the original FOR UPDATE; `validateStatusTransition(status, REVERSED)` blocks double-reverse because `ALLOWED_TRANSITIONS[REVERSED] = []` (already locked by `voucher-validation.test.ts` "blocks REVERSED → POSTED"); creates opposite-direction mirror lines (`reversed_line_id` linkage), marks original lines + header REVERSED, writes audit log + outbox. Sound. (Unwind of cash/stored-value happens when the mirror voucher is wired — staged correctly as NOT_WIRED.)
  - **`ar-invoice.service.reverseArPaymentAllocationTx`** — `withIdempotency` keyed dedupe + explicit `allocation.reversed_at` guard (throws "already reversed"); correctly subtracts `allocated_amount` from invoice paid/outstanding, recomputes status, writes status-history + reversing ledger entry. Exemplary.
  - **`ar-invoice.service.voidArInvoice`** — approval-gated (`approval_action_cd === APPROVE_VOID`), `withIdempotency`, sets status VOID + outstanding 0 + VOID ledger credit for prior outstanding + status-history + outbox. Re-void is harmless (outstanding already 0 ⇒ no duplicate ledger). Sound.
  **FINDINGS (money path — flagged, NOT auto-fixed; sensitivity per CLAUDE.md):**
  - **F-R1 (refund idempotency NOT enforced):** `order-refund.initiateRefund` *stores* `idempotency_key` but never looks it up before INSERT, so a retry with the same key creates a SECOND `org_order_refunds_dtl` row. The balance guard only sums `refund_status='PROCESSED'` refunds, so two rapid pre-processing calls can BOTH pass `refundableBalance`/`remainingForPayment` and both create rows → over-refund once processed. The column clearly intends dedupe (mirrors AR `withIdempotency`). **Recommended:** look up an existing refund by `(tenant_org_id, idempotency_key)` at the top of the tx and return it if present.
  - **F-R2 (refund process double-issue):** `order-refund.processRefund` reads the refund via `findFirstOrThrow(status='APPROVED')` with NO `FOR UPDATE`, and issues WALLET top-up / CREDIT_NOTE WITHOUT an idempotency key. Concurrent or retried processing can double-issue stored value. **Recommended:** `SELECT … FOR UPDATE` the refund row (or status-CAS on the APPROVED→PROCESSED update) + pass an idempotency key into `topUpWalletTx`/`issueCreditNote`.
  - **F-R3 (refund_no race):** `refund_no` is built from `count(*)+1` (not concurrency-safe, weak sequence). **Recommended:** use the scoped-sequence helper (as AR allocation does via `nextScopedSequence`).
  - **F-AA1 (dead branch, from §3):** `runAutoAllocationAlgorithm` `allow_partial_last_target=false` guard is unreachable (`allocAmount<outstanding ⇒ remaining<outstanding` contradicts the same `if`'s `remaining > outstanding`). Behavior-preserving cleanup candidate; no money impact.
  **Decision pending (user):** whether to fix F-R1/F-R2/F-R3 in this program (money path) or file as a separate hardening ticket. No code changed in §4.
  **Checklist ticks:** §4 refund review, voucher-reversal review, AR reverse/void review (all reviewed; refund findings documented).

- **2026-06-25 (later) — §4 refund fixes APPLIED (user-approved: F-R1 + F-R2; F-R3 deferred).**
  - **F-R1 (initiateRefund idempotent replay):** discovered a DB unique index **`uq_refund_idempotency (tenant_org_id, idempotency_key)` already exists** — so duplicate rows were already DB-prevented; the real gap was a keyed retry throwing a raw unique-violation + rolling back the tx. Added a top-of-tx lookup that returns the existing refund on a key hit (graceful replay, no INSERT). No migration needed.
  - **F-R2 (processRefund concurrency + idempotency):** added a `SELECT … FOR UPDATE` lock on the refund row (`WHERE refund_status = 'APPROVED'`) before any stored-value issue — serializes concurrent processing; the loser sees the row no longer APPROVED and aborts. Switched the credit-note path from the non-tx `issueCreditNote` (separate transaction, no idempotency) to **`issueCreditNoteTx(tx, { … idempotencyKey: refund-<id>-cn })`** — now atomic with the refund update + skip-on-existing. Wallet path relies on the lock (`topUpWalletTx` has no idempotency param — documented inline).
  - **F-R3 (refund_no `count(*)+1` race):** DEFERRED per user.
  - **Tests:** extended `refund.service.test.ts` (+5: F-R1 replay / no-match, F-R2 lock-abort / credit-note-key / wallet-after-lock) and repaired `refund-flow.test.ts` integration mock (`$queryRaw` + `issueCreditNoteTx`). The raw FOR UPDATE SQL was validated against the live DB (rolled back).
  - **Validation:** full `npm test` → **1449 / 144 suites**; `npm run test:db-integration` → **17 / 4**; eslint 0; tsc 0. No migration (the unique index pre-existed).

- **2026-06-25 (later) — §5 anti-pattern audit DONE → ✅ D-12 CLOSED.**
  - **Audit result:** the F-T1 anti-pattern class (constants/catalog tests asserting only shape/uniqueness) had exactly ONE historical instance — the overpayment catalog test — and it was ALREADY remediated to migration-DDL parity in a prior phase (`settlement-catalog.test.ts`, see its inline note about the F-00 wallet blocker). The broad grep hits (reducers, helpers, warning-codes) are legitimate domain-logic shape assertions on NON-DB-backed constants, not anti-patterns.
  - **Hardening added:** `__tests__/db-integration/settlement-catalog.parity.test.ts` (2 tests) — BIDIRECTIONAL exact parity between the TS `as const` catalogs and their live `sys_*_cd` tables: `OVERPAYMENT_RESOLUTIONS` ↔ `sys_fin_overpay_res_cd` (9 codes) and `CUSTOMER_RECEIPT_ALLOCATION_MODES` ↔ `sys_fin_rcpt_alloc_mode_cd` (4 modes). Catches drift in EITHER direction (DB code with no TS member, or TS member with no DB row) — stronger than finance-smoke's superset check and the migration-text parity. This is the canonical "shape → real DB parity" conversion.
  - **Validation:** `npm run test:db-integration` → **19 / 5 suites** (added settlement-catalog.parity); eslint 0; tsc 0.
  - **Checklist tick:** §5 anti-pattern audit.

### ✅ D-12 (third pass) — COMPLETE (2026-06-25)

All five D-12 work-streams are closed:
- **§1 type-debt:** `tsc --noEmit` **0 errors** (43 → 0). Final cluster A closed by retiring legacy payment modals v3/enhanced-02 (`*.tsx.bak`) + the v4 `toCanonicalLegMethod`/`SettlementMethodCode` fix.
- **§2 GA-class test:** `collect-payment.idempotency` (DB-integration, via the keyed `executeOverpaymentDispositionTx`).
- **§3 doc-19 hardening:** ar-allocate.idempotency (DB), cash-drawer-change.idempotency (handler), order-financial-write.gateway-pending (pure), customer-receipt extend + fallback matrix.
- **§4 correctness review:** voucher-reversal + AR reverse/void CLEAN; refund findings F-R1 + F-R2 FIXED (idempotent replay + FOR UPDATE lock + tx-composed idempotent credit-note); F-R3 + the unreachable-branch finding documented & deferred.
- **§5 anti-pattern audit:** one historical instance already remediated; added bidirectional live-DB catalog parity.

**Totals:** full `npm test` **1449 / 144 suites**; `npm run test:db-integration` **19 / 5 suites**; eslint 0; tsc 0. **No migration was needed for D-12** (the refund unique index pre-existed). Next free migration seq still **0385**.
**Deferred (documented):** F-R3 refund_no sequence race; the unreachable `allow_partial_last_target=false` branch in `runAutoAllocationAlgorithm`.

- **2026-06-25 (later) — F-05 §6 real tax decomposition DONE.**
  - Pure engine in lib/payments/e-invoice.ts: buildTaxDecomposition(bases) emits STANDARD/EXEMPT/ZERO_RATED/OUT_OF_SCOPE from their own bases (clamps negatives/NaN); reconcileTaxDecomposition(decomp, expectedBase) is the decomposition-side fiscal check. buildFoundationTaxDecomposition now delegates (identical shape for STANDARD-only).
  - Service: resolveOrderTaxDecomposition(client, tenantId, orderId) reads the per-category base columns the recalc maintains on org_orders_mst (taxable/exempt/zero_rated/out_of_scope), gated by resolveEInvoiceActivation (order created_at = order date). Not active → zeroed buckets, flat-VAT flow unchanged.
  - Tests: e-invoice.foundation.test.ts +6 (real decomposition + reconcile + delegation); new DB-integration e-invoice-decomposition.db.test.ts (2): ENABLED+mixed-category → faithful buckets reconcile; DISABLED → zeroed (both rolled back, tenant flag flipped in-tx).
  - Validation: full npm test 1455/144; db-integration 21/6; eslint 0; tsc 0. No migration (reads existing columns).
  - **Seq correction:** migration 0385 is ALREADY taken (0385_permissions_help_platform_inventories.sql) — RESUME stale. Next free seq = **0386** (used by §7 e-invoice status column).

- **2026-06-25 (later) — F-05 §7 e-invoice status persistence DONE (mig 0386 APPLIED L+R by user).**
  - Migration supabase/migrations/0386_einvoice_status_column.sql: adds org_tax_documents_mst.e_invoice_status text NOT NULL DEFAULT NOT_APPLICABLE + CHECK chk_tax_doc_einv_status (7 codes mirroring E_INVOICE_STATUS). Additive, no rewrite; applied LOCAL + REMOTE by user.
  - prisma/schema.prisma: e_invoice_status field added to org_tax_documents_mst; client regenerated.
  - Pure helper resolveInitialEInvoiceStatus(active) in lib/payments/e-invoice.ts (active ? PENDING : NOT_APPLICABLE).
  - Wiring: createTaxDocumentTx (tax-document-write.service) reads the order created_at + resolveEInvoiceActivation and stamps e_invoice_status on create. Later transitions (GENERATED/REPORTED/CLEARED/FAILED/CANCELLED) are jurisdiction-adapter driven (Phase 8 / future).
  - Tests: e-invoice.foundation.test.ts +2 (resolveInitialEInvoiceStatus); new DB-integration tax-document-einvoice-status.db.test.ts (3): ENABLED→PENDING, DISABLED→NOT_APPLICABLE, live CHECK rejects out-of-catalog value.
  - Validation: full npm test 1457/144; db-integration 24/7; eslint 0; tsc 0.
  - **Next free migration seq = 0387.**

- **2026-06-25 (later) — F-05 §8 ZATCA jurisdiction adapter DONE.**
  - lib/payments/adapters/zatca.adapter.ts (pure, no server-only/DB): ZATCA_TAX_CATEGORY_CODES (STANDARD/EXEMPT/ZERO_RATED/OUT_OF_SCOPE → S/E/Z/O) + buildZatcaDocument(decomposition, ctx) → per-category S/E/Z/O lines (standard rate on S only; 0 on E/Z/O), reconciled totals (totalWithTax = taxable + tax), identity fields. Document SHAPE only; live submission/clearance (Phase 2 API, signing/QR/XML) is a tracked follow-up.
  - Tests: zatca.adapter.test.ts (7): code mapping, standard-only, mixed, zero-base omission, totals reconcile, identity fields, rounding.
  - Validation: full npm test 1464/145; db-integration 24/7; eslint 0; tsc 0; i18n parity OK.
  - **F-05 is now COMPLETE in cleanmatex** (only cross-project HQ toggle UI + live ZATCA submission remain). See F-05-E-Invoicing-Foundation.md COMPLETION section.

---

## PROGRAM COMPLETE (2026-06-25)

All remaining Order-Fin work finished in one plan-mode run (9 phases). D-12 third pass CLOSED + F-05 e-invoicing COMPLETE in cleanmatex.

**Final validation gates (all green):**
- tsc --noEmit: **0 errors** (43 -> 0)
- full npm test: **1464 pass / 145 suites**
- npm run test:db-integration: **24 pass / 7 suites**
- eslint: **0** errors on changed files
- npm run check:i18n: **parity OK**
- npm run build: **GREEN** (compiled, all pages)

**Migrations this program:** 0386 only (e_invoice_status), applied LOCAL + REMOTE by user. D-12 needed none. **Next free seq = 0387** (NOTE: 0385 was already taken by 0385_permissions_help_platform_inventories.sql; RESUME pointer was stale).

**Remaining (out of program):** HQ enablement-toggle UI in cleanmatexsaas (cross-project); live ZATCA submission/clearance; deferred F-R3 (refund_no race) + unreachable allow_partial_last_target branch; process gates (finance sign-off, soak).


## Deferred minor fixes — DONE (2026-06-26)

Closed the two carry-over items left after PROGRAM COMPLETE:

- **F-R3 (refund_no concurrency race):** `order-refund.service.ts` replaced the racy `org_order_refunds_dtl.count()+1` with the atomic `fn_next_fin_doc_no(tenant, 'REFUND')` (row-level FOR UPDATE lock) — same mechanism AR invoices use. New constant `REFUND_DOC_TYPE_CODE` in `lib/constants/order-financial.ts`. **Migration 0387_refund_doc_seq_numbering.sql** seeds (upserts) the per-tenant REFUND sequence with prefix `REF-`, padding 6, and last_no back-filled to the current max issued refund number (GREATEST guard, idempotent). Applied LOCAL + REMOTE. Verified: REFUND seq rows present, prefix `REF-`, padding 6.
- **allow_partial_last_target dead branch:** `customer-receipt-allocation.service.ts` — removed the contradictory `remaining > target.outstandingAmount` clause that made the guard unreachable (it negated `allocAmount < outstanding`). The `false` policy now correctly stops before part-paying the last target and routes the remainder to fallback; the default `true` (DB default) path is unchanged.

**Tests:** +3 regression tests in `customer-receipt-allocation.service.test.ts` (false→fallback, false-with-coverable-targets, true→partial) replacing the old "unreachable" NOTE; `refund.service.test.ts` + `refund-flow.test.ts` switched to `@jest-environment node` (the `Prisma.sql` tag throws under the jsdom Prisma build) and now assert the number is minted via $queryRaw with no `count()` call.

**Validation:** affected suites green (refund 19/19 incl. allocation; refund-flow 5/5); eslint 0 on changed files; `tsc --noEmit` = 1 error total and it is the unrelated in-flight `@features/marketing/access/marketing-access` deletion vs `page-access-registry.ts` import (UI-access-contract refactor in the working tree), NOT introduced here. **Next free migration seq = 0388.**


## Minor findings F-06 / F-08 / F-09 + gateway review — DONE (2026-06-26)

Closed the remaining low-risk lettered findings and completed the gateway capture/callback exploratory review.

- **F-09 (audit columns):** **migration 0388_tax_doc_seq_counters_audit_cols.sql** adds the missing standard audit columns to `org_tax_doc_seq_counters` — `created_info / updated_info / rec_status (def 1) / rec_order / rec_notes / is_active (def true)`. Additive (ADD COLUMN IF NOT EXISTS), no rewrite, no behavior change (the FOR UPDATE allocator does not read them). prisma/schema.prisma model synced. F-01 RLS already shipped in 0379, so the table now fully matches convention. **Create-only — STOP for user apply.**
- **F-06 (ADR-047 doc drift):** `ADR/ADR-047-Overpayment-Disposition.md` status flipped Proposed → **Accepted** + approval box checked; added an **Amendment (2026-06-26)** mapping the original working vocabulary (RETURN_CHANGE / TO_WALLET / TO_ADVANCE / TO_CREDIT_NOTE) to the shipped catalog codes (RETURN_CASH_CHANGE / SAVE_TO_CUSTOMER_WALLET / SAVE_AS_CUSTOMER_ADVANCE / SAVE_AS_CUSTOMER_CREDIT) and noting the 0378 FK replaced the per-value CHECK. Doc now agrees with code.
- **F-08 (naming drift):** added an **Object naming map** section to `technical_docs/tech_settlement_catalogs.md` documenting voucher full-word table vs `sys_fin_vch_*` abbrev vs `*_vch_trx_ln_*` constraint fragments, and the post-0360 `org_fin_overpay_disp_dtl` rename (legacy `org_order_overpay_disp_dtl_*` constraint prefixes left as-is). Per the finding: **no live objects renamed** — documentation only.

**Gateway capture/callback review (exploratory ❓ item) — CLOSED, no bug:** there is **no automated gateway webhook/callback route** in the project (file search across app/ + lib/ returns none — by design). PAYMENT_GATEWAY legs are created in **PENDING** with `gateway_code` + `gateway_reference`, then settled by a **manual back-office assurance step** `verifyPaymentTx` (order-settlement.service.ts) exposed at `POST /api/v1/orders/[id]/payments/[paymentId]/verify`, permission-gated `orders:verify_payment`. That path is sound: composite-tenant WHERE, row `FOR UPDATE` lock, idempotent no-op on already-COMPLETED, rejects terminal states, recalcs the header snapshot + emits `PAYMENT_VERIFIED` outbox in-tx. **Conclusion:** the "callback" is a human verification action, not an async webhook. Live online-gateway (HYPERPAY/PAYTABS/STRIPE) webhook/auto-capture integration is **future work** — same class as live ZATCA submission — not a defect in the current model. **No code change.**

**Validation:** doc + migration only (F-06/F-08 docs, F-09 additive migration + prisma model). No test/runtime change from the gateway review. **Next free migration seq = 0389.**


## Exploratory deep-dives + 0388 applied — DONE (2026-06-26)

- **Migration 0388 (F-09 audit cols) APPLIED LOCAL + REMOTE** by user; types regenerated. Verified all 6 columns present (rec_status smallint def 1, is_active bool def true, created_info/updated_info/rec_notes text, rec_order int). **Next free seq = 0389.**

**Promotion / loyalty deep-dive (report ❓ item) — DONE.** Full review in Promotion_Loyalty_Offline_DeepDive_2026-06-26.md.
- **Promotions:** the LIVE order path is `discount-service.ts` (`applyPromoCodeTx` — FOR UPDATE + **in-lock max_uses re-check** + `reversePromoUsageTx` unwind) — **sound**. `promotion-engine.service.ts`.`applyPromotionTx` is a **dead, weaker duplicate** (no live callers; no in-lock cap re-check; no idempotency_key) → **PR-1** recommend consolidation (documented, not auto-applied — tested module + live validate route). **PR-2** (Low): `uq_promo_usage_idempotency` exists but apply doesnt set the key — safe today via the submit `withIdempotency` envelope.
- **Loyalty:** `redeemPointsTx` sound (idempotency-skip + FOR UPDATE). Gift cards sound (FOR UPDATE + key skip on redeem/credit). **LOY-1 FIXED:** `processEarnPoints` lacked the graceful idempotency-skip — a re-delivered LOYALTY_EARN (at-least-once outbox) hit `uq_loyalty_txn_idempotency`, threw, rolled back the worker tx and could WEDGE the event in a retry loop. Added the same top-of-fn findFirst skip `redeemPointsTx` uses (returns existing row, lets worker complete). Code-only, no migration. +2 regression tests; loyalty suite 14/14; eslint 0.

**Mobile/offline POS deep-dive (report ❓ item) — CLOSED, nothing to fix.** No offline POS / offline financial-write capability exists: `public/sw.js` is **push-notifications only** (no cache/background-sync/IndexedDB queue); `message-queue.ts` is an in-memory toast queue. All order/payment writes are synchronous server-authoritative Prisma tx. The report concern (offline financial safety) is moot — there is no offline flow. Future offline-POS requirements (idempotent replay, cap/balance conflict resolution on sync, drawer reconciliation, server-authoritative doc numbering) listed in the deep-dive doc.

**Process-gates guide GENERATED:** `Process_Gates_Guide.md` — repeatable runbook for the two non-code GA gates (Finance sign-off: 8 reconciliations + sample matrix + exit criteria; Soak: ≥2-week pilot incl. month-end + drawer-close, daily monitor signals, abort/rollback + exit criteria, sign-off log).

**Validation:** loyalty 14/14; eslint 0 on changed files; tsc unchanged (still only the unrelated in-flight marketing-access error). Docs only otherwise. **Next free seq = 0389.**


## Promo/loyalty findings PR-1 / PR-2 / adjustPointsTx — FIXED (2026-06-26)

Closed the three documented deep-dive findings (all code-only, no migration):

- **PR-1 (dead weaker applyPromotionTx):** promotion-engine.service.applyPromotionTx now DELEGATES to discount-service.applyPromoCodeTx (the canonical hardened path: in-lock max_uses re-check + idempotency key + reversal) and is tagged @deprecated — the two can no longer drift. Its test asserts the delegation contract; applyPromoCodeTx internals stay covered by discount-service.test.ts. The two validatePromoCode (checkout vs marketing-admin preview) have different contracts — kept both, cross-documented; full merge deferred (API-shape change).
- **PR-2 (unleveraged promo idempotency_key):** applyPromoCodeTx now derives idempotency_key = orderId:promoCodeId, runs a post-FOR-UPDATE findFirst skip (concurrent applies for the same order serialise → second skips, no double increment), and writes the key — uq_promo_usage_idempotency (mig 0288) is now the hard DB backstop. Regression test added (skip-on-existing).
- **adjustPointsTx non-deterministic key:** added optional idempotencyKey param (caller request-id → graceful replay skip); when omitted generates adj-<acct>-<crypto.randomUUID()> instead of Date.now() (removes same-ms collision risk on uq_loyalty_txn_idempotency). +2 loyalty tests.

**Validation:** discount-service + promotion-engine + loyalty suites 34/34; integration create-with-payment-promo-gift + order-cancel + order-submit 23/23 (added findFirst to the promo-usage tx mock); eslint 0; tsc 0. No migration. Full review doc: Promotion_Loyalty_Offline_DeepDive_2026-06-26.md. **Next free seq = 0389.**


## validatePromoCode merge (best-practice, no gaps) — DONE (2026-06-26)

Fully merged the two validatePromoCode functions into one canonical evaluator + fixed three latent bugs it surfaced. Code-only, no migration.

- **Single source of truth:** new evaluatePromoCode(params) in discount-service.ts (authoritative module). Both validatePromoCode are now thin adapters: checkout → ValidatePromoCodeResult, marketing-admin preview (promotion-engine) → PromoValidation. The preview can no longer disagree with what checkout accepts.
- **Bug 1 (percentage=0 in marketing preview):** the preview compared lower-case discount_type (real DB storage: percentage/fixed_amount) to upper-case PROMO_TYPES.PERCENTAGE → always 0 for percentage promos. Unified discount calc is now CASE-INSENSITIVE (both calculatePromoDiscount and the retained calculatePromotionDiscount).
- **Bug 2 (max-order mislabel):** the max_order_amount rejection returned errorCode MIN_ORDER_NOT_MET. Added MAX_ORDER_EXCEEDED to the ValidatePromoCodeResult union and the evaluator emits it.
- **Bug 3 (per-customer cap counted voided):** the per-customer usage count now excludes voided_at rows (reversed promos no longer count against the limit).
- **Consistency:** marketing path now uses the same strict liveness filter (is_active AND is_enabled AND rec_status=1), upper-cases the code on lookup, and uses the atomic current_uses counter for the global cap. createPromotion now stores promo_code upper-cased and discount_type lower-cased (matches lookup + column convention + mapPromoCodeToType lowercase expectation).

**Tests:** new 16-case evaluatePromoCode suite in discount-service.test.ts (casing regression, all error codes incl. MAX_ORDER_EXCEEDED, voided-usage exclusion, code upper-casing); promotion-engine validate tests rewritten as adapter/delegation tests. discount+promotion-engine 32/32; integration+cancel+submit+loyalty+validate-promo 37/37; eslint 0; tsc 0. No migration. **Next free seq = 0389.**
