# 24 — Implementation Status

**Live log. Source of decisions:** [23_DECISIONS_ADDENDUM.md](./23_DECISIONS_ADDENDUM.md).

## Migration apply status (authoritative)

| Question | Answer |
|---|---|
| Migrations that exist for this batch | `0379`, `0380`, `0381` |
| Applied to **local** dev DB? | ✅ **Yes** — all three, applied + verified live (2026-06-19) |
| Applied to **remote / prod**? | ❌ **No** — none applied to remote/prod |
| Still require user review before remote/prod | **All three** (`0379`, `0380`, `0381`) |

> Note: "applied" everywhere in this file means **local dev only** unless stated otherwise. Remote/prod apply is a separate, user-gated step.

## Current Phase
Tight Phase 1 (approved scope): **1A (F-01 RLS) · 1B (F-02/F-04 B2B) · 1C (F-10 collect-key)**. F-T5, F-05, D-09 = own subsequent phases (decided, not this batch).

## Current Status
🟢 **Phase 1 COMPLETE, APPLIED + VERIFIED locally (2026-06-19). Migrations 0379, 0380, 0381 all applied.**
- 1A (F-01) ✅ `org_tax_doc_seq_counters` RLS=true, 2 policies.
- 1B (F-02/F-04) ✅ `org_b2b_statement_payments_dtl` RLS=true, 2 policies, `uq_b2b_stmt_pay_idem` present; service idempotency active. Composite FK applied via 0381 (`uq_b2b_statements_id_tenant` UNIQUE + `fk_b2b_stmt_pay_statement` composite — both verified live).
- 1C (F-10) ✅ collect-payment per-event key (server UUID fallback + UI random suffix).
- Tests: **12/12** Phase-1 pass; tsc (changed) clean; eslint clean.
- **GA-gate items F-01, F-02, F-04, F-10 = DONE + verified.**
- **Next:** focused re-validation (D-11), then own phases — F-T5 (DB harness), F-05 (e-invoicing — needs tenant-flag-placement decision), D-09 (reconciliation reports), D-12 (third pass incl. 2 pre-existing tsc errors).

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

