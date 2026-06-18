# 00 — Executive Summary

## Verdict

🟡 **PARTIALLY VALID**

**Classification:** **Production-ready after critical fixes.** (Not "blocked" — no open runtime blocker. Not "production-ready now" — HIGH items remain.)

## Why this verdict

The Order Financial core is genuinely strong and, in several areas, **ahead of its own documentation**:

- **Financial truth engine is correct.** `recalculateOrderFinancialSnapshotTx` ([order-financial-write.service.ts](../../../web-admin/lib/services/order-financial-write.service.ts)) counts `total_paid` only from COMPLETED/CAPTURED/SETTLED **real** payment rows (line 721 + `isClearlyRealPaymentRow`), counts only APPLIED credits (689-692), excludes pending/authorized from outstanding (722-723), and computes `overpaid_amount` as **unresolved** excess only — gross minus change minus disposed (767-774). Rules 13/14/19/20/21/22/23 hold.
- **Real-payment vs stored-value separation is enforced at every layer.** `org_order_payments_dtl` is ORDER-only (`payment_target_type` was deliberately dropped in `0337`); stored value never writes payment rows; the order-payment wiring handler hard-asserts `target_type='ORDER' AND target_id=order_id`.
- **BVM wiring is clean and symmetric for the core paths.** Invoice payments → `org_invoice_payments_dtl` via AR allocate; statement payments → `org_b2b_statements_mst`; cash → drawer movements; none cross-write `org_order_payments_dtl`.
- **Submit is a single atomic transaction with production-grade idempotency** (stake-before-orchestrator, payload-hash conflict detection, heal/unstake recovery) — [submit-order/route.ts](../../../web-admin/app/api/v1/orders/submit-order/route.ts).
- **Idempotency unique indexes** exist on order-payments, voucher lines, wallet, advance, credit-note, cash-in, overpay-disposition, and allocation previews.

The prior **critical blocker is closed**: `SAVE_TO_CUSTOMER_WALLET` disposition used to violate the audit CHECK and roll back the whole submit. Migration **`0378`** replaced the hardcoded CHECK with an FK to `sys_fin_overpay_res_cd` — **verified live** (`org_fin_overpay_disp_res_fk` present + `convalidated=true`; `org_fin_overpay_disp_res_chk` gone; 0 orphan rows).

What keeps it from "production-ready now" is a small set of **HIGH** items plus medium hardening:

## Blocker / finding counts

| Severity | Count | IDs |
|---|---|---|
| 🔴 Critical / blocker (open) | **0** | — (F-00 resolved this session via `0378`) |
| 🟠 High | **2** | F-01 (RLS gap), F-05 (tax-base decomposition / e-invoicing) |
| 🟡 Medium | **6** | F-02 (B2B allocation idempotency — *revised down*; AR is guarded), F-03 (feature flags unwired), F-04 (B2B no detail table), F-06 (ADR-047 drift), F-10 (collect-payment key not event-unique), F-T5 (no DB-level test harness) |
| 🔵 Low / cosmetic | **5** | F-07 (cash-out change idempotency), F-08 (naming), F-09 (counter audit cols), F-T2/F-T3 (missing wiring/idempotency tests) |
| ✅ Resolved / corrected this session | **3** | F-00 (wallet blocker fixed), F-T1 (false-positive test fixed), **F-02-AR (over-claim corrected — AR idempotency confirmed present)** |

> **Deep-dive correction (re-verify pass):** the original High "AR+B2B lack idempotency" was **half wrong** — AR allocation IS idempotent (`withIdempotency` + `org_idempotency_keys`). See [22_FOLLOWUP_DEEP_DIVE.md](./22_FOLLOWUP_DEEP_DIVE.md). Net: one fewer High finding; verdict unchanged.

## Top findings (read these first)

1. **F-01 (HIGH) — RLS missing on `org_tax_doc_seq_counters`.** An `org_*` tenant table (has `tenant_org_id NOT NULL`) with **RLS disabled and 0 policies** — the only finance table without RLS. The sequence service always filters by tenant, so no live leak is verified, but the DB safety net for **fiscal/tax document numbering** is absent and it violates the project's own hard rule. → [07](./07_DATABASE_FINDINGS.md).
2. **F-02 (MED — revised from High) — B2B statement allocation idempotency gap.** *Correction from the first pass:* **AR is fine** — `ar-invoice.service.ts` allocation uses `withIdempotency` + the central `org_idempotency_keys` table and short-circuits on replay. Only `b2b-statement-payment.service` ignores its `idempotencyKey` and mutates the statement master in place with no replay guard → retry can double-reduce a B2B statement balance. → [08](./08_BACKEND_API_FINDINGS.md) / [22](./22_FOLLOWUP_DEEP_DIVE.md).
3. **F-03 (MED) — Feature flags are dead seed data.** `overpayment_disposition_v1` and `customer_receipt_allocation_v1` exist (migrations 0376/0377) but appear **nowhere** in `web-admin` — no server or UI gate. ADR-047 explicitly said the flag "gates UI panel and server validation." No kill-switch exists. → [08](./08_BACKEND_API_FINDINGS.md) / [14](./14_DOCS_AND_ADR_ALIGNMENT.md).
4. **F-05 (HIGH for GCC compliance) — Tax-base decomposition stubbed.** `non_taxable/exempt/zero_rated/out_of_scope` are hardcoded to `0` in recalc (order-financial-write.service.ts:685-688) and the tax-document fiscal-total comparand is not read (warning suppressed, 820-824). Fine for flat-VAT today; a gap for ZATCA/e-invoicing readiness. Deferred "Phase 5" but not tracked as a compliance risk. → [07](./07_DATABASE_FINDINGS.md).

## Production-ready definition — current status

Of the 25 production-ready criteria the brief lists, the implementation **meets ~20** outright (financial correctness, payment/credit separation, no silent unresolved excess, no AR misuse, no pending-counted-as-paid, single-transaction posting, idempotency, BVM targeting). It **misses or partially misses**: #4 (no DB drift — now fixed by 0378), #21 (RLS — F-01), #19 (allocation audit — F-04/F-02 partial), #8 (DB-level integration tests — F-T5), #10/#11 (undocumented behavior / flag gating — F-03/F-06), #17 (tax-document fiscal totals — F-05).

## The call

Ship-blockers: **none open.** GA gate finalized in [23 — Decisions Addendum](./23_DECISIONS_ADDENDUM.md): **this batch** closes F-01 (RLS), F-02+F-04 (B2B idempotency+detail), F-10 (collect key); **own decided phases** cover F-T5 (DB harness), F-05 (e-invoicing foundation, now in launch scope), and D-09 (reconciliation reports). **F-03 (feature flags) is removed from the gate** — deferred for V1, features always-on, RBAC controls access (D-01). A focused re-validation after Phase 1 is required (D-11).

→ Detailed path in [16](./16_RECOMMENDED_IMPLEMENTATION_PLAN.md) and [21](./21_FINAL_RECOMMENDATION.md).
