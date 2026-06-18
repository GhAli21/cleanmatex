# 05 — Master Gaps & Bugs

Every finding has a stable ID. Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low.
Format per the brief: Issue / Severity / Current / Expected / Evidence / Impact / Root cause / Fix / Files / Migration? / Tests / Acceptance.

---

## F-00 — `SAVE_TO_CUSTOMER_WALLET` disposition violated audit CHECK — ✅ RESOLVED

- **Severity:** 🔴 Critical → **resolved this session**
- **Current (before):** Audit CHECK `org_fin_overpay_disp_res_chk` omitted `SAVE_TO_CUSTOMER_WALLET`; the disposition service inserted it → whole submit/collect TX rolled back.
- **Expected:** Wallet disposition succeeds; row persists; `overpaid_amount→0`.
- **Evidence:** `0354` CHECK (8 codes), `0368` added catalog row only; `overpayment-disposition.service.ts:120-184`. **Fix `0378` verified live:** FK `org_fin_overpay_disp_res_fk` present + `convalidated=true`, CHECK gone, 0 orphans.
- **Migration:** `0378_overpay_disp_resolution_fk.sql` (applied). **Tests:** `overpayment-disposition.wallet.test.ts` (added). **Acceptance:** met.

---

## F-01 — RLS missing on `org_tax_doc_seq_counters` 🟠 High

- **Current:** `org_*` tenant table (`tenant_org_id uuid NOT NULL`) with `relrowsecurity=false` and **0 policies** — the only finance table without RLS (sweep of 78 tables).
- **Expected:** RLS enabled + `tenant_isolation` (and `service_role`) policies, like every sibling `org_*` table; project rule "RLS on ALL `org_*` tables."
- **Evidence:** MCP `pg_class.relrowsecurity=false`, `pg_policies` count 0; columns confirm `tenant_org_id NOT NULL`. Service `tax-document-sequence.service.ts` always filters by tenant (24-67), so **no live cross-tenant leak verified** — defense-in-depth only.
- **Business impact:** Fiscal/tax document numbering is compliance-sensitive (gap-free, per-tenant). A future query path or direct DB access without a tenant filter could read or advance another tenant's sequence → duplicate/again-used tax document numbers across tenants. Audit/compliance risk.
- **Technical impact:** Removes DB-level isolation guarantee; relies entirely on application discipline.
- **Root cause:** Migration that created the table omitted `ENABLE ROW LEVEL SECURITY` + policies (likely added before the RLS convention sweep, or hand-written).
- **Fix:** New additive migration: `ENABLE ROW LEVEL SECURITY` + tenant_isolation + service_role policies. No data change.
- **Files:** new `supabase/migrations/0379_*.sql`. **Migration:** yes (additive, safe). **Tests:** tenant-isolation test in `__tests__/tenant-isolation/`. **Acceptance:** `relrowsecurity=true`, ≥1 policy; cross-tenant select returns 0 rows under tenant context.

---

## F-02 — B2B statement allocation lacks idempotency 🟡 Medium  *(revised down from High; AR is guarded)*

> **⚠️ CORRECTION (deep-dive re-verify, 2026-06-18):** The original High finding **overstated AR**. `ar-invoice.service.ts` runs allocation through `withIdempotency` (lines 290-343) backed by the central `org_idempotency_keys` table (RLS on; unique `uq_idempotency_key`); `allocateArPaymentTx` (556) passes the key (568) and **short-circuits to the cached response on replay** — AR invoice allocation **IS idempotent**, just via a central-table mechanism rather than an effect-table unique index. Only the **B2B statement** path remains a real gap. Severity downgraded High→Medium. See [22_FOLLOWUP_DEEP_DIVE.md](./22_FOLLOWUP_DEEP_DIVE.md).

- **Current:** `b2b-statement-payment.service.ts` accepts `idempotencyKey` and **never uses it** (param declared 33-41, unused in `allocateB2bStatementPaymentTx` 50-111); it mutates `org_b2b_statements_mst.paid_amount/balance_amount` in place with `FOR UPDATE` but **no replay guard** (no `withIdempotency`, no detail row). By contrast AR uses `org_idempotency_keys`, and order/wallet/advance/credit-note each carry an idempotency unique index. The voucher-line `wiring_status` guard is the only backstop for B2B.
- **Expected:** The B2B statement allocation effect is idempotent — a retry/replay cannot double-reduce the balance. (AR already meets this via `withIdempotency`/`org_idempotency_keys`; **no AR change is recommended.**)
- **Evidence:** `b2b-statement-payment.service.ts` full read — `idempotencyKey` declared (33-41) and **unused** in `allocateB2bStatementPaymentTx` (50-111); `org_b2b_statements_mst` mutated in place. AR contrast verified: `ar-invoice.service.ts:290-343` (`withIdempotency`) + `org_idempotency_keys` (live: RLS on, unique `uq_idempotency_key`).
- **Business impact:** On a retried B2B statement allocation (network retry, double click, partial-failure replay), the statement balance could be reduced twice → statement understated → AR/B2B reconciliation breaks. **AR is not affected.**
- **Technical impact:** For B2B, idempotency relies solely on the voucher-line `wiring_status` guard; if the line is re-wired or the allocation is invoked outside that guard, there is no second line of defense.
- **Root cause:** The B2B statement path was built without adopting **either** finance idempotency mechanism (effect-table partial unique index, used by order/wallet/advance/CN; **or** the central `org_idempotency_keys` cache, used by AR).
- **Fix:** Make `allocateB2bStatementPaymentTx` idempotent — simplest is to wrap it in the **existing** `withIdempotency`/`org_idempotency_keys` mechanism (reuse the AR pattern; consume the key it already receives), optionally plus a `org_b2b_statement_payments_dtl` detail row for audit symmetry (F-04). **Do NOT add an AR index/migration** — AR is already idempotent.
- **Files:** `b2b-statement-payment.service.ts` (+ optional new detail table migration for F-04). **Migration:** optional (only if adding the detail table). **Tests:** "double-post same B2B key → single application." **Acceptance:** replaying the same B2B allocation key leaves the statement balance unchanged after the first apply.

---

## F-03 — Feature flags `overpayment_disposition_v1` / `customer_receipt_allocation_v1` are unwired 🟡 Medium

- **Current:** Both flags are seeded (migrations `0376`/`0377`) but the literal strings appear **nowhere** in `web-admin` (grep: no matches across app/lib/src). No server gate, no UI gate.
- **Expected:** Per ADR-047, `overpayment_disposition_v1` "gates UI panel and server validation until rollout complete"; the allocation feature pack implies `customer_receipt_allocation_v1` gates the allocation UI/API.
- **Evidence:** `Grep 'overpayment_disposition_v1|customer_receipt_allocation_v1'` over `web-admin` → no matches; `customer-receipts/allocation/post/route.ts` checks permission but not a flag.
- **Business impact:** No kill-switch / staged rollout for finance-critical features. If a regression appears in production, ops cannot disable the feature per-tenant without a code deploy. Permission gating exists (stronger access control) but is not a rollout toggle.
- **Technical impact:** Dead seed data; ADR contradiction.
- **Root cause:** Flag definitions shipped; enforcement deferred and never implemented.
- **Fix:** Either (a) wire the flag checks into the allocation/overpayment routes + UI panels (consume via HQ feature-flag API per integration contract), or (b) explicitly retire the flags and update ADR-047 to "permission-gated only." Decide with product.
- **Files:** allocation/overpayment routes, payment-modal V4, ADR-047. **Migration:** no (unless retiring seeds). **Tests:** flag-off hides UI + 403/feature-disabled from API. **Acceptance:** flag state demonstrably toggles behavior, or ADR updated to drop the requirement.

---

## F-04 — B2B statement payment has no dedicated detail/audit table 🟡 Medium

- **Current:** B2B statement allocation mutates `org_b2b_statements_mst` master fields in place; the only per-payment record is the BVM voucher line (`STATEMENT_PAYMENT`/`B2B_STATEMENT`). AR invoices, by contrast, get a row in `org_invoice_payments_dtl` (allocation_no, amounts, links).
- **Expected:** Symmetric audit: a `org_b2b_statement_payments_dtl` (or reuse of a generic allocation table) recording each statement payment with amount, voucher link, idempotency key — so statement history is queryable without reconstructing from voucher lines.
- **Evidence:** `b2b-statement-payment.service.ts` (no detail insert); AR has `org_invoice_payments_dtl`.
- **Impact:** Reconciliation/audit of B2B statement payments is harder; no granular reversal target; couples idempotency (F-02) to the missing table.
- **Root cause:** Statement allocation implemented as a master-only mutation.
- **Fix:** Add a statement-payment detail table (with idempotency unique index) and write a row per allocation; or document that the voucher line is the canonical audit and add the idempotency guard there.
- **Files:** new migration + `b2b-statement-payment.service.ts`. **Migration:** yes. **Tests:** statement payment creates a detail row; reversal supported. **Acceptance:** statement payment history queryable from a detail table with idempotency.

---

## F-05 — Tax-base decomposition stubbed (exempt/zero-rated/out-of-scope) 🟠 High (for GCC e-invoicing)

- **Current:** `non_taxable/exempt/zero_rated/out_of_scope` amounts are hardcoded `0` in recalc (order-financial-write.service.ts:685-688). Tax-document fiscal-total comparand is not read; the mismatch warning is intentionally suppressed (820-824, returns `false`).
- **Expected (for GCC/ZATCA-style e-invoicing):** Per-category taxable-base breakdown and a stored fiscal total on the tax document that the order total is reconciled against.
- **Evidence:** code comments at 680-688 and 815-824 explicitly mark this as "Phase 5" / "until that table ships."
- **Business impact:** Flat single-rate VAT is correct today; multi-category tax (exempt/zero-rated/out-of-scope) and e-invoicing compliance are **not** representable. A tax authority requiring category breakdown cannot be satisfied.
- **Technical impact:** Read model + snapshot JSON + UI breakdown are wired for the values but always emit zeros; tax-document/AR reconciliation warning is a no-op.
- **Root cause:** Deferred scope; tax engine emits only a single `taxable_amount`.
- **Fix:** Implement tax-category decomposition in the tax engine + populate the buckets; store fiscal total on `org_tax_documents_mst` and reconcile. Multi-phase.
- **Files:** tax engine, write svc, tax-document write svc, UI breakdown. **Migration:** likely (fiscal total column / tax doc lines). **Tests:** mixed exempt/zero-rated order → correct buckets + reconciliation. **Acceptance:** category buckets sum to taxable base; tax-document total reconciles to order total.

---

## F-06 — ADR-047 status/vocabulary behind the code 🟡 Medium (doc)

- **Current:** ADR-047 shows "Proposed — pending Approved_By_Jh" with an unchecked approval box and uses old vocabulary (`RETURN_CHANGE`, `TO_WALLET`, `TO_ADVANCE`, `TO_CREDIT_NOTE`). Code uses catalog vocabulary (`RETURN_CASH_CHANGE`, `SAVE_TO_CUSTOMER_WALLET`, `SAVE_AS_CUSTOMER_ADVANCE`, `SAVE_AS_CUSTOMER_CREDIT`); the plan marks all phases complete.
- **Expected:** ADR reflects accepted status + final vocabulary; doc and code agree.
- **Evidence:** ADR-047 lines 3-4/60-68/235 vs `settlement-catalog.ts` + `0357` seeds.
- **Impact:** A maintainer following the ADR would use wrong codes; status implies the feature isn't live when it is.
- **Fix:** Update ADR-047 to Accepted; map old→new vocabulary; note `0378` FK decision.
- **Files:** ADR-047. **Migration:** no. **Tests:** n/a. **Acceptance:** ADR matches catalog + code.

---

## F-07 — Cash-drawer CASH_OUT (change) rows lack per-line idempotency 🔵 Low

- **Current:** `uq_cd_mov_vch_line` covers `CASH_IN`/`CASH_SALE` (has `fin_voucher_trx_line_id`); the `CASH_OUT` change row is created **without** `fin_voucher_trx_line_id` (cash-drawer-wiring.handler.ts:93-112), so it has no unique guard.
- **Expected:** Change-out movement is also replay-safe.
- **Evidence:** handler + index sweep.
- **Impact:** Within a single TX, `CASH_SALE` create fails first on replay (protected), so duplication needs an out-of-band re-invocation — low likelihood. If it happens, drawer over-reports change-out → reconciliation variance.
- **Fix:** Add a deterministic idempotency key/index for change-out (e.g., partial unique on `(fin_voucher_id, movement_type='CASH_OUT', order_payment_id)`), or attach the line id.
- **Files:** migration + handler. **Migration:** yes (index). **Tests:** replay leaves one CASH_OUT. **Acceptance:** no duplicate change rows on replay.

---

## F-08 — Naming drift across voucher objects 🔵 Low (cosmetic)

- **Current:** table `org_fin_voucher_trx_lines_dtl` (full word) vs catalogs `sys_fin_vch_*` (abbrev) vs constraint names `*_vch_trx_ln_*`; audit table constraints carry old `org_order_overpay_disp_dtl_*` prefixes (post-0360 rename residue).
- **Impact:** Cognitive friction; no functional effect; **no duplicate tables** (rule satisfied).
- **Fix:** Document the mapping in `tech_settlement_catalogs.md`; do not rename live objects.

---

## F-09 — `org_tax_doc_seq_counters` missing standard audit columns 🔵 Low

- **Current:** has `created_at/by`, `updated_at/by` but lacks `created_info/updated_info/rec_status/rec_order/rec_notes/is_active`.
- **Impact:** Minor convention deviation; acceptable for a counter table.
- **Fix:** Optional; align if/when touched for F-01.

---

## F-10 — `collectPaymentTx` default idempotency key is not event-unique 🟡 Medium (verify)

- **Current:** `collect-payment/route.ts` makes `idempotencyKey` **optional** (line 19). `collectPaymentTx` (order-settlement.service.ts:593) defaults it to `` `${orderId}_collect_${collectedBy}` `` (line 604) when omitted — the **same key for every collection of an order by the same cashier**. The key flows into `executeOverpaymentDispositionTx` (856-866) and allocation.
- **Expected:** Each collection *event* has a unique idempotency key, so (a) a retried request dedupes but (b) two **legitimate** sequential partial collections by the same cashier are **not** mistaken for a replay.
- **Evidence:** `collect-payment/route.ts:19`; `order-settlement.service.ts:604,856-887`. Whether this causes a real defect depends on how `collectPaymentTx` consumes the key end-to-end (voucher-line keys, disposition idempotency index `uq_fin_overpay_disp_idempotency_simple` which is keyed on `(tenant, idempotency_key, resolution_code)`). **Not fully traced** — the per-leg voucher idempotency key derivation inside `collectPaymentTx` was not read.
- **Business impact (if real):** A second genuine partial payment on the same order by the same cashier could be silently dropped/deduped, **or** an overpayment-disposition row could collide on the shared key. Either understates collected cash → drawer/AR mismatch.
- **Technical impact:** Idempotency key collision across distinct events.
- **Root cause:** Default key derived from stable identifiers (order+user) rather than a per-request token.
- **Fix:** Require a client-generated `idempotencyKey` per collection event (as `submit-order` does), or default to a time/uuid-bearing key. Add a test for "two sequential partial collections succeed and sum correctly."
- **Files:** `collect-payment/route.ts`, `order-settlement.service.ts`. **Migration:** no. **Tests:** sequential-partial-collection test; replay-same-explicit-key test. **Acceptance:** distinct collections never collide; true replays dedupe.

---

## Test findings (detail in [11](./11_TEST_COVERAGE_FINDINGS.md))

- **F-T1 — ✅ Resolved:** `settlement-catalog.test.ts` "mirror" test asserted only array uniqueness (false-positive that let F-00 ship). Rewritten this session to real catalog + migration-DDL parity.
- **F-T2 🔵:** No tests for `invoice-payment-wiring.handler` / `statement-payment-wiring.handler`.
- **F-T3 🟡:** No idempotency/double-apply test for AR allocation or B2B statement (ties to F-02).
- **F-T4 🔵:** No test for cash CASH_OUT change idempotency (F-07).
- **F-T5 🟡:** No DB-level/integration test harness — all service tests mock the Prisma `tx`, so CHECK/FK/RLS enforcement is never exercised in CI. This is the structural reason F-00 shipped.
