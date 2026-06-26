# Order Financial — Process Gates Guide (Finance Sign-off + Soak)

**Date:** 2026-06-26
**Purpose:** the two **non-code** gates that stand between "engineering complete" and
"GA / production-trusted" for the Order Financial platform. All code/migration GA-gate items
are closed (see `Order_Fin_Phases_RESUME.md`); these are the human/operational gates the
validation report ([21_FINAL_RECOMMENDATION.md](./Opus_Validation_Report_18_06_2026/21_FINAL_RECOMMENDATION.md),
[15_PRODUCTION_READINESS_CHECKLIST.md](./Opus_Validation_Report_18_06_2026/15_PRODUCTION_READINESS_CHECKLIST.md))
requires before declaring the platform production-trusted.

> These gates are **owner actions**, not engineering tasks. This guide makes them repeatable.

---

## Gate 1 — Finance sign-off

**Goal:** an accountable finance owner confirms, against real (staging or pilot) data, that the
money math and the audit trail are correct and reconcilable — *before* wide rollout.

**Owner:** Finance lead (`Approved_By_Jh` or delegate). **Support:** Engineering (read-only queries,
the D-09 reconciliation reports).

### What to verify (each must reconcile to zero / expected)

1. **Money-layer separation** — for a sample of ≥20 orders spanning the matrix below, confirm the
   three layers are never conflated: **Applied** (settles balance) vs **Collected** (tendered) vs
   **Excess** (routed via disposition). Order-detail financial view + tax/receipt prints.
2. **Overpayment disposition** — every order with excess has disposition rows that **sum to the
   excess**, and `overpaid_amount = 0` once fully routed. Use the **Overpayment Disposition
   reconciliation report** (D-09); zero orphan / no-voucher-link rows.
3. **Refunds** — refund amount never exceeds refundable balance; credit-note / wallet refunds issue
   exactly once; `refund_no` is unique and sequential (now atomic via `fn_next_fin_doc_no`, mig 0387).
4. **AR (receivables)** — allocation, reverse, and void each leave invoice paid/outstanding correct;
   AR ledger entries balance. Spot-check reverse + void.
5. **B2B statements** — statement payments reconcile to the detail table; replay does not
   double-reduce a balance (idempotency). **B2B statement reconciliation report** (D-09).
6. **Cash drawer** — opening + IN − OUT = expected = counted (within tolerance); no unlinked
   movements. **Cash drawer reconciliation report** (D-09).
7. **Stored-value liability** — wallet + advance + active credit-note balances tie out.
   **Unallocated-excess / liability report** (D-09).
8. **Tax / e-invoice** — VAT totals correct; for e-invoice-enabled tenants the per-category
   decomposition reconciles and `e_invoice_status` is stamped (see F-05). Live ZATCA submission is
   out of scope (tracked separately).

### Sample matrix (minimum coverage)

Cash exact · cash over-tender + change · non-cash over-collection → wallet/advance/credit ·
split disposition (part change + part wallet) · walk-in (no customer) · gift card + promo + loyalty
redeem on one order · partial collection (later) · refund (cash / wallet / credit-note) ·
AR allocation + reverse · B2B statement payment · multi-currency order.

### Exit criteria
- All eight reconciliations balance (or variances explained + accepted).
- Sign-off recorded (date, name, data set used) — append to this file's **Sign-off log** below
  and check the box in [ADR-047 Approval](./ADR/ADR-047-Overpayment-Disposition.md) if not already.
- Any defect found → fix + re-run the affected reconciliation before sign-off.

---

## Gate 2 — Soak

**Goal:** run the platform under **real but bounded** load for a fixed window to surface
issues that only appear with volume/concurrency (idempotency replays, outbox lag, drawer
variances) before unbounded rollout.

**Owner:** Engineering + Ops, with Finance watching the daily reconciliation.

### Setup
- **Environment:** production or a production-mirror with real tenants (pilot cohort), **not**
  synthetic load only. Start with 1–3 pilot branches.
- **Duration:** **minimum 2 weeks** of active trading (must include at least one month-end /
  statement cycle and one full cash-drawer close cycle).
- **Migrations:** confirm all Order-Fin migrations applied LOCAL + REMOTE (next free seq is the
  source of truth in `Order_Fin_Phases_RESUME.md`). Latest: 0386 (e-invoice status), 0387 (refund
  numbering), 0388 (seq-counter audit cols).

### What to monitor (daily)
| Signal | Healthy | Where |
|---|---|---|
| Finance route error rate | flat / near-zero | app logs / APM |
| Reconciliation variances (all 4 D-09 reports) | zero or explained | D-09 reports |
| Idempotency replays double-applying | **none** | unique-violation logs; spot-check sums |
| Outbox lag / dead-letters (loyalty earn, history, notifications) | draining, no wedged events | `org_domain_events_outbox` backlog |
| Cash-drawer variance at close | within tolerance | drawer recon report |
| Refund / disposition orphans | none | overpayment + refund queries |
| `overpaid_amount` retained without disposition | none on new orders | order snapshot query |

### Abort / rollback criteria (stop rollout, investigate)
- Any **money discrepancy** that does not reconcile (drawer, AR, B2B, stored-value).
- A confirmed **double-apply** (payment, refund, disposition, loyalty, gift card).
- Outbox events **wedged** in a retry loop (e.g. the LOY-1 class — now fixed) or growing backlog.
- Cross-tenant data visible in any finance surface (RLS regression).

### Exit criteria
- Full soak window completed including a month-end and a drawer-close cycle.
- All monitored signals healthy for the final ≥3 consecutive trading days.
- Zero open money discrepancies; any incidents fixed + re-soaked for the affected area.
- Engineering + Finance jointly sign the **Soak completion** entry below → proceed to wide rollout.

---

## Sign-off log

| Gate | Date | Owner | Data set / window | Result | Notes |
|---|---|---|---|---|---|
| Finance sign-off | _pending_ | | | | |
| Soak completion | _pending_ | | | | |

---

## Related
- `Order_Fin_Phases_RESUME.md` — program status + next migration seq.
- `Opus_Validation_Report_18_06_2026/15_PRODUCTION_READINESS_CHECKLIST.md` — full GA checklist.
- `D-09-Reconciliation-Reports.md` — the four reconciliation reports used in both gates.
- `F-05-E-Invoicing-Foundation.md` — tax/e-invoice scope (live ZATCA submission is separate).
