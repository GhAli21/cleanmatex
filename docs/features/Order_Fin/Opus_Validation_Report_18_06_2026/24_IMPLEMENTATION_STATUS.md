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
- [ ] Resolve cluster D first (it overlaps the known runtime risk: `getLinkedEffect` B2B model-accessor mismatch in `statement-payment-wiring.handler.ts`).
- [ ] Then A–C, E–H. Target: `tsc --noEmit` → 0 (or a documented, justified residue).

**2. Remaining GA-class test**
- [ ] `__tests__/services/collect-payment.idempotency.test.ts` (F-10) — two sequential partial collections (same cashier) both succeed + sum; explicit-key replay dedupes.

**3. doc-19 🔵 hardening tests**
- [ ] `invoice-payment-wiring.handler.test.ts` (F-T2 / rule 7)
- [ ] `statement-payment-wiring.handler.test.ts` (F-T2 / rule 8) — pairs with cluster-D fix
- [ ] `ar-allocate.idempotency.test.ts` (F-02 — lock the AR mechanism)
- [ ] `cash-drawer-change.idempotency.test.ts` (F-07)
- [ ] `order-financial-write.gateway-pending.test.ts` (rule 19/20)
- [ ] extend `customer-receipt-allocation.service.test.ts` (rule 12)
- [ ] `customer-receipt-allocation.fallback.test.ts` (rule 16)

**4. Remaining ❓ correctness review (deferred items)**
- [ ] Refund-create idempotency + reverse-allocation accounting.
- [ ] `voucher-reversal.service` unwind correctness (order-payment + cash + stored-value).
- [ ] AR reverse/void accounting.

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
