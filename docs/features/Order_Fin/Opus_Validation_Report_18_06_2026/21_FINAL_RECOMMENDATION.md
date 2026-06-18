# 21 — Final Recommendation

## Is it production-ready?

**Not yet — but close.** Classification: **Production-ready after critical fixes.** No open runtime blocker remains (the wallet CHECK blocker is fixed and verified). The Order Financial core — calculation, real-payment/credit separation, BVM wiring, AR-invoice-wins, single-transaction posting, submit idempotency — is **production-grade and, in places, ahead of its documentation**. What stands between "now" and "GA" is a small, well-bounded set of hardening items.

## What must be fixed first (GA gate)

1. **F-01 — Enable RLS on `org_tax_doc_seq_counters`.** One additive migration. Closes the only multi-tenant isolation hole and the project-rule violation. (No live leak verified, but non-negotiable for a fiscal table.)
2. **F-02 — B2B statement allocation idempotency** *(corrected: AR is already idempotent via the central `org_idempotency_keys` cache).* The one allocation path where a **retry can corrupt a balance** (double-reduce a B2B statement). Fix by reusing the existing `withIdempotency` mechanism — **no AR change, no AR migration/index.**
3. **F-10 — collect-payment idempotency key.** Require a per-event key (small code change) so genuine sequential collections by the same cashier don't collide.
4. **Tests T-1, T-2, T-6.** A DB-level harness + B2B idempotency + RLS tests. Without T-1, the *next* drift ships as silently as the wallet blocker did.

## What can wait (with explicit risk acceptance)

- **F-03 (feature flags unwired)** — permission gating already protects access; the missing piece is a rollout kill-switch. Decide: wire or retire. Not balance-affecting.
- **F-05 (tax-category decomposition / e-invoicing)** — defer **only if** launch scope is single-rate VAT without e-invoicing. If a GCC tax authority / ZATCA-style mandate is in scope, this becomes a Phase-1 blocker.
- **F-07 (cash-out change idempotency), F-08/F-09 (naming/audit cols)** — low risk; bundle into DB hardening.
- **F-06 (ADR-047 drift)** — doc-only; update alongside the fixes.

## Should coding start?

**Yes — scoped to Phase 1 only** (F-01 + F-02 + their tests), exactly as the prior wallet fix was handled: create migrations for review, do not auto-apply, add tests, stop for sign-off. Do **not** begin Phase 4-7 work until Phase 1 is reviewed.

## Should another validation pass happen after fixes?

**Yes — a focused one**, not a full re-audit. After Phase 1: re-verify (a) RLS on the seq table live, (b) B2B replay leaves the statement balance unchanged (previews D-1/D-2), (c) the new tests fail when the invariant is broken. Plus close the ❓ items still open: AR reverse/void accounting, `voucher-reversal.service`, allocation drawers UX, refund-create idempotency, promotions/loyalty, gateway callbacks. *(collect-payment route + i18n parity were verified this pass.)*

## Shortest safe path to production-ready

```
1. Migration 0379  — RLS on org_tax_doc_seq_counters                 (F-01)
2. Service edit    — b2b-statement-payment uses withIdempotency       (F-02; NO migration)
3. (optional) 0380 — org_b2b_statement_payments_dtl detail table      (F-04)
4. Code edit       — collect-payment requires per-event key           (F-10)
5. Tests           — T-1 (DB harness), T-2 (B2B), T-6 (RLS), F-10, T-4/T-5
6. Verify live     — RLS + B2B replay previews; run full npm test + build
7. Decide scope    — F-03 (flags) and F-05 (tax) → wire / retire / accept-defer
8. Verify ❓ items  — AR reverse/void, drawers, refund-create idempotency
9. Focused re-validation pass
```
**No AR migration/index** — AR allocation is already idempotent (`org_idempotency_keys`). Phases 1-5 are small and bounded; the long pole is **F-05** *iff* e-invoicing is in launch scope.

## Biggest hidden risk

**The test architecture cannot see database truth.** Every finance service test mocks the Prisma `tx`, so **no CHECK, FK, or RLS invariant is exercised in CI**. The wallet blocker (F-00) shipped behind a green "mirror" test that asserted array uniqueness instead of DB parity. Until a DB-level harness exists (T-1), any future catalog/constraint/RLS drift — including the B2B idempotency guard you're about to add — can regress silently. **Fixing the test seam (T-1) is the highest-leverage action in this report**, above any single feature fix, because it converts "we think it's correct" into "CI proves it."

## Bottom line

- **Verdict:** 🟡 PARTIALLY VALID.
- **Open critical blockers:** 0.
- **GA gate:** F-01 (RLS), F-02 (**B2B-only** idempotency), F-10 (collect key) (+ T-1/T-2/T-6).
- **Confidence:** High on the core financial correctness **and AR allocation idempotency** (both verified first-hand against live DB); Medium on **B2B** allocation robustness (the one idempotency gap); items marked ❓ are genuinely unverified, not assumed-good.
