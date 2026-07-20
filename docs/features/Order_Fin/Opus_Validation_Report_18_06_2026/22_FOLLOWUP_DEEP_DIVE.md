# 22 — Follow-up Deep Dive (re-verify of ❓ items)

This pass re-verified the items the first pass explicitly marked **❓ not verified**, per the mandate "do not assume previous reports are complete." It produced **one material correction** (F-02), **one new finding** (F-10), and several confirmations.

> **STALE-CLAIM CORRECTION (B29 doc sweep, 2026-07-19):** the Confirmations table below marks "Refund accounting structure" ✅ sound, citing `refund_source_type` classification as "verified earlier in `classifyRefunds`." The frozen [Authoritative Report §13/§21](../../../Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md) (2026-07-15) found this column was never actually persisted by the service — the irony this correction file itself warns about ("do not assume previous reports are complete") applied to this very row. Fixed by [B01](../Remediation_Work_Packages/B01_Refund_Lineage_And_Reopen_Due.md) on 2026-07-18. The F-10 collect-payment idempotency finding just above remains an accurate, still-open gap (superseded in scope by [B05](../Remediation_Work_Packages/B05_Later_Collection_Idempotency.md)).

## Material correction

### ✅ AR invoice allocation **IS** idempotent — F-02 was over-claimed
- **First-pass claim (wrong for AR):** "AR + B2B allocation lack DB-level idempotency."
- **Truth:** AR allocation runs through a `withIdempotency` wrapper (`ar-invoice.service.ts:290-343`) backed by the central `org_idempotency_keys` table — verified live: `rls=true`, `policies=1`, unique constraint `uq_idempotency_key`. The wrapper looks up `(tenant_org_id, key, resource_type)` (304-310), **returns the cached `response_cache` on hit** (312-314), else runs the producer and upserts (316-340). `allocateArPaymentTx` (556) passes `key: input.idempotency_key` (568). Replaying the same key **cannot double-apply**.
- **Net effect:** F-02 narrows to **B2B statement only** and drops **High → Medium**. AR was using a *different but valid* idempotency mechanism (central table) than the effect-table unique-index pattern I searched for — the index sweep missed it because the guard lives in `org_idempotency_keys`, not on `org_invoice_payments_dtl`.
- **Lesson:** there are **two** idempotency mechanisms in the finance layer: (1) effect-table partial unique indexes (order-payment, wallet, advance, credit-note, cash-in, overpay-disp, preview), and (2) the central `org_idempotency_keys` cache (AR invoice flows). Both are legitimate. **B2B uses neither.**

## New finding

### 🟡 F-10 — `collectPaymentTx` default idempotency key not event-unique
`collect-payment/route.ts:19` makes `idempotencyKey` optional; `order-settlement.service.ts:604` defaults it to `` `${orderId}_collect_${collectedBy}` `` — identical across repeated collections of the same order by the same cashier. Detail + risk in [05 §F-10](./05_GAPS_AND_BUGS.md#f-10--collectpaymenttx-default-idempotency-key-is-not-event-unique--medium-verify). **Not fully traced** end-to-end; flagged for verification.

## Confirmations (❓ → resolved)

| Item | Outcome | Evidence |
|---|---|---|
| AR allocate idempotency | ✅ present | `withIdempotency` + `org_idempotency_keys` |
| `org_idempotency_keys` infra | ✅ real, RLS, unique | MCP: `rls=true`, `uq_idempotency_key` |
| Refund accounting structure | ✅ sound | `order-refund.service.ts`: prior-refund aggregation prevents over-refund (207/245), voucher links (33-34), recalc snapshot (447), `refund_source_type` classification (verified earlier in `classifyRefunds`) |
| collect-payment route guards | ✅ CSRF + permission `orders:collect_payment` + Zod | `collect-payment/route.ts:32-42` |
| collect-payment overpayment reuse | ✅ same disposition/allocation services | `order-settlement.service.ts:856-887` |
| i18n EN/AR parity | ✅ PASS | `node scripts/check-i18n-parity.js` → "matching keys", exit 0 |
| collect-payment error mapping | 🟡 coarse | all errors → 422 (less granular than submit-order's per-code mapping); cosmetic |
| collect-payment feature flag | 🔴 none | consistent with F-03 |

## Still ❓ not verified (need a further pass)

These were **not** opened even in this deep dive; they remain genuine unknowns (not assumed-good):

1. **Refund create idempotency** — over-refund prevention exists, but whether a duplicate refund *request* is deduped (idempotency key on `org_order_refunds_dtl`) was not traced. **To verify:** read `order-refund.service.ts:200-320`.
2. **AR reverse-allocation accounting** (`reverseArPaymentAllocation`, ar-invoice.service.ts ~1300+) — ledger reversal correctness. **To verify:** read the reverse path + AR ledger movements.
3. **`voucher-reversal.service` / void** — does reversing a voucher correctly unwind order-payment + cash-drawer + stored-value effects? **To verify:** read `voucher-reversal.service.ts`.
4. **Cash drawer session lifecycle** — open/close, expected-vs-counted, Z-report/over-short reconciliation. **To verify:** `cash-drawer.service.ts` + session close flow.
5. **Promotion engine + loyalty** — `promotion-engine.service.ts`, `loyalty.service.ts` exist; correctness/stacking/abuse not reviewed. **To verify:** read both + their tests.
6. **Gateway capture/callback lifecycle** — PENDING→CAPTURED transition, webhook idempotency (`org_idempotency_keys`?), failed-capture handling. **To verify:** gateway callback route + capture service.
7. **Allocation drawers UX** (`auto-allocation-preview-drawer.tsx`, `manual-allocation-drawer.tsx`) — preview-before-post, submit-disabled-until-resolved. **To verify:** open both components.
8. **Mobile/offline POS resilience** — out of scope of files inspected; the brief lists it. **To verify:** identify the mobile/PWA payment path if any.

## Revised severity rollup (post-deep-dive)

- Critical (open): **0**
- High: **2** (F-01 RLS, F-05 tax decomposition)
- Medium: **6** (F-02 B2B, F-03 flags, F-04 B2B detail, F-06 ADR drift, F-10 collect key, F-T5 DB tests)
- Low: **5** (F-07, F-08, F-09, F-T2, F-T3)
- Verdict unchanged: **🟡 PARTIALLY VALID — production-ready after critical fixes.** GA gate is now lighter (F-02 is B2B-only Medium).
