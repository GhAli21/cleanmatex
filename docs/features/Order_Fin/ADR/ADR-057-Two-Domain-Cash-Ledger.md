# ADR-057: Two-Domain Cash Ledger (Finance Vouchers + Drawer Transactions)

- Status: Accepted — design approved 2026-09-25; **implementation pending** (package CLF)
- Date: 2026-09-25
- Owners: Order Fin / POS
- Supersedes: ADR-032 (Cash Drawer Effects) — the "wiring handlers write mirror cash movements" model
- Amends: ADR-054 (User-Owned POS Sessions), ADR-056 (Cash-Control Settings)
- Related:
  - `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md` §4B (package CLF — full design, schema, work items)
  - `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/STATUS.md` D22, D29, D30, D31

## Context

Before this decision, a drawer's expected cash was computed from the **current status** of payment rows plus "manual" rows in `org_cash_drawer_movements_dtl`, and every cash payment also wrote a **mirror** movement row through a wiring handler. Pre-plan checks on 2026-09-25 found:

- A cash payment landing while a close runs was excluded from the close but stayed attached to the closed session (D22). No payment, refund or stored-value path took any drawer lock.
- Reversing or verifying a payment after close changed the numbers of an already-closed session, because totals were recomputed from live status.
- Six cash paths wrote cash with no voucher line (customer-account receipts, B30 VERIFY, B10 REVERSE, manual movements, legacy open/close, record-only refunds).
- Mirror rows duplicated voucher lines (two records of one fact), and the change row was subtracted twice if both were summed.
- Drawer policy columns (`requires_session`, `opening_float_required`, `drawer_type`) and every cash-control setting were stored but never enforced.

## Decision

### Principles

1. **Period cutoff.** An event is recorded when it happens, with the facts at that moment. A closed session is never changed; a correction is a new entry now.
2. **A drawer session is a reconciliation window** over one drawer. It never affects finance outside its boundary.
3. **Every financial transaction is a voucher.** Custody events are operational, not financial.
4. **One physical event = one record.** No mirrors.

### Two domains

| | Finance | Custody |
|---|---|---|
| Records | money changing ownership / obligation | physical cash changing place |
| Examples | customer cash receipts, refunds, reversals, stored-value funding, customer-account receipts, cash in / cash out (expense, supplier, petty cash, pay-in), over/short | session open / close, counts and denominations, float issue, drops, drawer↔drawer, driver handover, close disposition, after-close deposit marking |
| Stored in | `org_fin_voucher_trx_lines_dtl` | `org_cash_drawer_trx_mst` / `org_cash_drawer_trx_dtl` |
| Invariant | posted lines immutable; corrections are reversal lines | lines sum to zero per currency — custody moves cash, never creates or destroys it |

Custody reads finance and never writes it. Over/short is the one meeting point: the close emits an event and finance creates the voucher. The GL holds one cash-on-hand account per branch and currency; drawers are operational detail below it. Petty cash and all other finance vouchers work **without ERP-Lite** (ERP-Lite is optional; tenants may use an external ERP).

### The drawer ledger

A drawer's ledger = its recognised cash voucher lines ∪ its drawer transaction lines, ordered by a **per-drawer ledger sequence** assigned under a row lock on `org_cash_drawers_mst`.

```
opening_expected(S) = closing_basis(prev) + Σ ledger (prev.close_seq, S.open_seq]
session_base(S)     = opening_counted(S) ?? opening_expected(S)
closing_expected(S) = session_base(S)     + Σ ledger (S.open_seq, S.close_seq]
closing_basis(S)    = closing_counted(S)  ?? closing_expected(S)
```

Per currency. Cash arriving between sessions has no session and lands in the next window. Count-only drawers (`requires_session = false`, e.g. safes) use the same chain with counts as checkpoints. No auto-recovery or continuous sessions.

### Central gate

One public API (`stampCashLinesTx` / `recognizeCashLineTx`, `lib/services/cash-drawer-ledger/`) is the only writer of the drawer stamp on voucher lines. It runs inside voucher posting, so every cash voucher line of any role lands in its drawer. Its decision function is pure; it enforces drawer-type capabilities (e.g. a safe never takes customer cash), branch, currency and session rules; interactive cash is refused while no session is open or while the session is closing; deferred events (late verify, reversal) are never refused on session state.

### Sessions

Two-step close — *count* (freezes the sequence cut, optional count, reveals the result) → *finalize* (mandatory disposition). Counts and denominations are optional; an uncounted close is flagged. Dispositions that move cash post a drawer transaction to a named destination drawer; every branch has exactly one `PENDING_DEPOSIT` drawer. After close, an optional status + notes (with actor, time and change log) records deposit follow-up.

### Configuration

Drawer types are `sys_cash_drawer_type_cd` with hard capabilities and overridable defaults. Drawer policy flags live in `org_fin_cash_ctrl_stng_cf` at DRAWER scope (resolution DRAWER → USER → BRANCH → TENANT → type default → constant default). No maker ≠ checker anywhere: holding the permission is the only approval gate, the same user may approve.

## Consequences

- **Retired:** `org_cash_drawer_movements_dtl`, `sys_cash_drawer_movement_type_cd`, `cash-drawer-cash-facts.ts`, `cash_drawer_mvt_id`, the three mirror wiring handlers, the session header money columns (moved to `org_cash_drawer_ses_bal_dtl`), `cash_drop_requires_dest`, the planned `org_cash_sess_curr_dtl`.
- **Closed by design:** D22 payment-during-close, post-close mutation of closed sessions, cross-session reversal accounting, the double-subtracted change, cash paths without vouchers.
- **Cost:** postings on one drawer serialise on its row (one drawer = one till, acceptable); a large one-time rewiring of cash writers and readers (15 writer items), delivered in three releases.
- **Rejected alternatives:** SERIALIZABLE isolation (only detects conflicts when both sides are SERIALIZABLE; seq-scan predicate locks caused false conflicts); per-call-site advisory locks in 15+ files; a time-based close cut (`now()` is transaction-start time and loses late-committing payments); auto-opened recovery sessions (made obsolete by the ledger sequence).
