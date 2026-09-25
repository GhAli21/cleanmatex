# Cash Drawer Guide — Session Lifecycle, Variance, Force-Close

> **2026-09-25 — architecture change approved, not yet implemented.** The cash-drawer model is being replaced by the two-domain cash ledger of [ADR-057](../ADR/ADR-057-Two-Domain-Cash-Ledger.md). Part A below describes the **target architecture**; Part B describes the **current behaviour (until CLF ships)**. Full design, schema and work items: [POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B](../POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md) (package CLF, STATUS rows D29–D31).

---

# Part A — Target architecture (ADR-057)

**Target architecture — approved 2026-09-25 (ADR-057), implementation pending in package CLF (releases R1 Ledger → R2 Sessions → R3 Retirement).** Nothing in Part A exists in code or in the database yet.

## A1. Principles

1. **Period cutoff** — an event is recorded when it happens, with the facts at that moment. A closed session is never changed; a correction is a new entry now.
2. **A drawer session is a reconciliation window** over one drawer. It never affects finance outside its boundary.
3. **Every financial cash event is a voucher.** Custody events are operational, not financial.
4. **One physical event = one record.** No mirror rows.

## A2. Two domains

| | Finance | Custody |
|---|---|---|
| Records | money changing ownership / obligation | physical cash changing place |
| Examples | customer cash receipts, cash refunds, reversals, stored-value funding, customer-account receipts, cash in / cash out, over/short | session open / close, counts and denominations, float issue, drops, drawer-to-drawer, driver handover, close disposition, after-close deposit marking |
| Stored in | `org_fin_voucher_trx_lines_dtl` (existing, new cash columns) | `org_cash_drawer_trx_mst` / `org_cash_drawer_trx_dtl` (new) |
| Invariant | posted lines immutable; corrections are reversal lines | lines sum to zero per currency — custody only moves cash |

Custody reads finance and never writes it. The GL keeps one cash-on-hand account per branch and currency; drawers are operational detail below it. All vouchers — including petty cash — work **without ERP-Lite** (ERP-Lite is optional; tenants may use an external ERP).

## A3. The drawer ledger

A drawer's ledger = its recognised cash voucher lines + its drawer-transaction lines, ordered by a **per-drawer ledger sequence** (`org_cash_drawers_mst.ledger_seq`) allocated under a row lock on the drawer (`SELECT … FOR UPDATE`). One drawer serialises its postings — acceptable, one drawer is one till.

Window formulas (per currency):

```
opening_expected(S) = closing_basis(prev) + Σ ledger (prev.close_seq, S.open_seq]
session_base(S)     = opening_counted(S) ?? opening_expected(S)
closing_expected(S) = session_base(S)     + Σ ledger (S.open_seq, S.close_seq]
closing_basis(S)    = closing_counted(S)  ?? closing_expected(S)
```

- Cash arriving between sessions has no session and lands in the next window. **No recovery sessions and no continuous sessions.**
- Count-only drawers (`requires_session = false`, e.g. safes) use the same chain with counts as checkpoints.
- A reversed original stays in its own window; the reversal line lands in the window current at reversal time. `line_status` is never filtered.
- When an opening count is entered, the cashier is accountable from that count; opening variance is recognised separately.

## A4. The central gate

`stampCashLinesTx` / `recognizeCashLineTx` in `lib/services/cash-drawer-ledger/` are the **only** writers of the drawer stamp on voucher lines (`cash_drawer_id`, `cash_ledger_seq`, `cash_recognized_at/_by`, `cash_effect_code`). The gate runs inside voucher posting (`postAndWireBizVoucherInTx`), so every cash-method voucher line of any role lands in its drawer — no per-role handler.

| Rule | Behaviour |
|---|---|
| Not cash-family / `NEUTRAL` | no stamp |
| Method `requires_cash_drawer = false` | `UNTRACKED` (reported as "cash outside drawers") |
| Payment not completed | `PENDING`; recognised later by `recognizeCashLineTx` (e.g. B30 VERIFY) |
| Integrity (drawer missing / inactive / other branch / type capability / currency) | rejected with a stable error code |
| Session `OPEN` | stamped into that session |
| Session `CLOSING`, interactive | rejected `DRAWER_SESSION_CLOSING` |
| No session, interactive, `requires_session = true` | rejected `CASH_DRAWER_SESSION_NOT_OPEN` |
| Deferred events (late verify, reversal) or `requires_session = false` | stamped with no session — lands in the next window |

The decision function (`cash-drawer-ledger-policy.ts`) is pure.

## A5. Session lifecycle — two-step close

| Step | Status | What happens |
|---|---|---|
| Open | `OPEN` | lock drawer, `open_ledger_seq` recorded, opening expected computed; optional opening count (total or denominations) |
| Count | `CLOSING` | exact sequence cut frozen (`close_ledger_seq`); optional closing count; result revealed (blind-close aware); variance reason if required. Interactive cash on the drawer is refused while `CLOSING` |
| Recount (optional) | `CLOSING` | holder of `cash_drawer:approve_variance` replaces the closing count |
| Finalize | `CLOSED` | **mandatory disposition**; cash-moving dispositions post a drawer transaction to a named destination drawer |
| Force-close | `FORCE_CLOSED` | supervisor, reason mandatory, same disposition rules |

- Counts and denominations are **optional**; an uncounted close is flagged. Count tables: `org_cash_drawer_cnt_mst` (types `OPENING`, `SPOT`, `CLOSING`, `RECOUNT`) and `org_cash_drawer_cnt_denom_dtl` (denominations from `sys_currency_denominations_cd`).
- Session money moves to the per-currency snapshot `org_cash_drawer_ses_bal_dtl` (opening/closing expected, counted, variance, basis), immutable once the session is closed.
- No "cancel back to OPEN" from `CLOSING`.

### Close dispositions (`sys_cash_drawer_ses_disp_cd`)

| Code | Moves cash | Destination | Notes |
|---|---|---|---|
| `LEFT_IN_DRAWER` | no | — | |
| `MOVED_TO_SAFE` | all | `SAFE` | |
| `HANDED_TO_MANAGER` | all | `PENDING_DEPOSIT` | |
| `PREPARED_FOR_DEPOSIT` | all | `PENDING_DEPOSIT` | |
| `PARTIAL_REMOVED` | part | any drawer that can receive dispositions | notes + kept amount required (typed by the user, never prefilled) |
| `OTHER` | no | — | notes required |
| `LEGACY` | — | — | not selectable; backfill of pre-CLF closed sessions |

### After close (optional)

A status from `sys_cash_drawer_ses_post_cd` (`IN_TRANSIT`, `DEPOSITED_TO_BANK`, `HANDED_TO_HQ`, `OTHER`) plus notes, recorded with actor and time; every change is appended to `org_cash_drawer_ses_post_tr`. Permission `cash_drawer:post_close_update`. A follow-up screen lists closed sessions whose cash went to `PENDING_DEPOSIT`.

## A6. Over/short

The close (or the variance approval, when approval is pending) emits `CASH_DRAWER_OVER_SHORT`; finance creates an `ADJUSTMENT_VOUCHER` with a `CASH_OVER_SHORT` line, idempotent per session, currency and opening/closing. The over/short line carries no payment method, so it never enters the drawer ledger.

## A7. Drawer types (`sys_cash_drawer_type_cd`)

Hard capabilities never come from settings; `*_default` columns can be overridden by settings.

| Type | Customer cash in | Customer cash out | Disposition destination | Requires session (default) |
|---|---|---|---|---|
| `COUNTER` | yes | yes | no | yes |
| `TEMPORARY` | yes | yes | no | yes |
| `DRIVER_BAG` | yes | no | no | no (until a driver app exists) |
| `SAFE` | no | no | yes | no |
| `PENDING_DEPOSIT` | no | no | yes | no |

All types can be a drawer-transaction source and destination. Opening/closing count required defaults are `false` for every type.

## A8. Pending-deposit drawer — exactly one per branch

- Identified by `drawer_type = 'PENDING_DEPOSIT'`; one per branch enforced by a partial unique index.
- Created by the idempotent function `ensure_branch_pd_drawer(p_tenant_org_id, p_branch_id)` — code `PD-<branch_code>`, currency = the tenant's configured currency (raises a clear error if none).
- Called from: an `AFTER INSERT` trigger on `org_branches_mst`; the HQ tenant-maintenance action (cleanmatexsaas); a **"Create pending-deposit drawer"** button (shown only when missing) on `/dashboard/tenant-admin/branches`, the *Cash drawers* tab of `/dashboard/settings/payments`, and `/dashboard/settings/payments/cash-control-settings`; and the backfill.
- All buttons call one API, `POST /api/v1/cash-drawers/pending-deposit/ensure` → `{ created, drawerId }`; a second click is a no-op.
- Cannot be deactivated while it holds a non-zero balance; its type cannot be changed.

## A9. Drawer transactions (custody)

`org_cash_drawer_trx_mst` / `_dtl`, numbered `CDT-YYYYMMDD-NNNN`. Types (`sys_cash_drawer_trx_type_cd`): `FLOAT_ISSUE`, `CASH_DROP`, `DRAWER_TO_DRAWER`, `DRIVER_HANDOVER`, `DEPOSIT_PREP` (user-selectable), `CLOSE_DISPOSITION`, `REVERSAL` (system). Every transaction has at least two lines on different drawers in the same branch and nets to zero per currency (deferred constraint trigger). Rows are immutable; corrections are reversal transactions. Single-phase in CLF.

## A10. Cash in / Cash out (finance vouchers)

A drawer-screen dialog (permission `cash_drawer:record_movement`) creates and posts a voucher; the gate puts the cash on the drawer.

| Direction | Voucher type | Line role | Use |
|---|---|---|---|
| Out | `PAYMENT_VOUCHER` | `EXPENSE_PAYMENT` | small expense from the till |
| Out | `PAYMENT_VOUCHER` | `SUPPLIER_PAYMENT` | supplier paid in cash |
| Out | `PAYMENT_VOUCHER` | `PETTY_CASH_ISSUE` | cash handed to a petty-cash holder |
| In | `RECEIPT_VOUCHER` | `PETTY_CASH_RETURN` | unspent petty cash returned |
| In | `RECEIPT_VOUCHER` | `CASH_PAY_IN` (new) | owner/manager brings outside cash in |

Petty cash does **not** depend on ERP-Lite; linking to an ERP-Lite cashbox is an optional later reference.

## A11. Settings and approvals

- Drawer policy flags move from `org_cash_drawers_mst` to `org_fin_cash_ctrl_stng_cf` at **DRAWER** scope: new columns `requires_session`, `opening_count_required`, `closing_count_required`. `cash_drop_requires_dest` is retired.
- Resolution: DRAWER → USER → BRANCH → TENANT → drawer-type default → constant default. `getCashControlSettingsWithSource` returns each value with its source for the drawer *Policy* tab.
- **No maker ≠ checker.** Variance approval, recount, force-close and post-close update are gated only by their permission; the same user may perform both steps.

## A12. What gets retired (R3)

`org_cash_drawer_movements_dtl`, `sys_cash_drawer_movement_type_cd`, `cash-drawer-cash-facts.ts`, voucher-line `cash_drawer_mvt_id`, the three mirror wiring handlers (`cash-drawer-wiring.handler.ts`, `stored-value-cash-drawer-wiring.handler.ts`, `order-refund-cash-drawer-wiring.handler.ts`), the session header money columns (moved to `org_cash_drawer_ses_bal_dtl`), `cash_drop_requires_dest`, drawer columns `requires_session` / `opening_float_required`, the manual-movement dialog and `cash-movement` / `close-session` routes, and the planned `org_cash_sess_curr_dtl` (never built).

---

# Part B — Current behaviour (until CLF ships)

## Session Lifecycle

```
Drawer (org_cash_drawers_cf)
  │
  ├── openSession() → creates OPEN session
  │     - requires no existing OPEN session for drawer
  │     - records opening_balance
  │
  ├── recordMovement() → appends movement rows
  │     - CASH_IN: adds to expected balance
  │     - CASH_OUT: subtracts from expected balance
  │     - OPENING_BALANCE: initial count record
  │     - CLOSING_COUNT: pre-close count record (does not close session)
  │
  └── closeSession() → moves to CLOSED
        - fetches all CASH payments via org_order_payments_dtl in session window
        - computes: expectedBalance = openingBalance + cashIn - cashOut + cashPayments
        - computes: variance = closingBalance - expectedBalance
        - records variance; does NOT reject close even if variance != 0
```

Mirror rows: each cash voucher line also writes a row in `org_cash_drawer_movements_dtl` through a wiring handler; expected cash is derived via `cash-drawer-cash-facts.ts`.

## Variance Handling

A variance is recorded but does not block the session close. The cashier provides the physical count (`closingBalance`) and the system computes the expected amount from the payment audit trail.

Negative variance (short): drawer has less cash than expected — possible theft or error.
Positive variance (over): drawer has more cash — possible change error or unreported cash-in.

Variances exceeding the tenant's threshold are flagged by reconciliation check `CASH_DRAWER_VARIANCE`. Optional variance approval is gated only by `cash_drawer:approve_variance`; the closer may approve their own variance.

## Force-Close

If a session is stuck OPEN (e.g. cashier didn't close before shift end), a manager can force-close:

```typescript
closeSession(tenantId, drawerId, { closedBy, closingBalance, forceClose: true })
```

Force-closed sessions are marked `status='FORCE_CLOSED'` for audit trail visibility.

## Multiple Drawers

A branch can have multiple drawers (e.g. counter 1, counter 2). Each drawer is independent. Payments are linked to a session via `cash_drawer_session_id` on `org_order_payments_dtl` (only when `requiresCashDrawer=true` on the payment method).

## Permissions

- `billing.cash-drawers.manage` — required for open/close/movement operations
- Staff assigned to a drawer can only see their own session summary

## Integration with Settlement

When a CASH payment method has `requiresCashDrawer=true`, the settlement service links the payment row to the current open session:

```typescript
cash_drawer_session_id: opt.requiresCashDrawer ? (cashDrawerSessionId ?? null) : null,
```

The `cashDrawerSessionId` is passed by the client when creating an order with payment. (Target: the client passes the drawer; the gate resolves the session inside the transaction.)

---

## Cash Up module retired (Remediation 2026-07 Phase 5)

The legacy Cash Up screen (`/dashboard/internal_fin/cashup`) computed expected cash from the dropped legacy payments ledger and was removed (nav migration `0394`). Cash truth = drawer sessions + movements on this guide's model, reconciled via the D-09 cash-drawer reconciliation report (`/dashboard/reports/reconciliation`). Target: cash truth = the drawer ledger (Part A3).
