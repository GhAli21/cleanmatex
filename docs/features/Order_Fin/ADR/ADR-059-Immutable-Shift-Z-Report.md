# ADR-059: Immutable Shift Z-Report and Live X-Report

- Status: Accepted
- Date: 2026-10-03
- Owners: Order Fin / POS
- Related:
  - [ADR-054 — User-Owned POS Sessions](./ADR-054-User-Owned-POS-Sessions.md)
  - [ADR-057 — Two-Domain Cash Ledger](./ADR-057-Two-Domain-Cash-Ledger.md)
  - `POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md` D2, migration `0559`

## Context

A POS session's figures are always computable from its posted voucher lines, but a figure that is
recomputed later is not a record: a late correction, a reversal booked after the fact or a changed
setting can move a closed shift's numbers, and nothing proves what the cashier was shown at close.

## Decision

1. **Two reports, one builder.** The **X-report** is the shift's figures *now*, computed on demand and
   never stored. The **Z-report** is the same figures frozen when the shift ends. Both come from
   `buildPosShiftSnapshot` (sales/refunds/voucher roll-up per currency, cash that hit the drawer, net
   cash-change rounding, and the linked drawer session's balances, variance decision and per-cashier cash
   attribution), so they can never disagree about what a shift contains.
2. **Frozen inside the closing transaction.** When `shift_z_report_required` is on (default), close,
   force-close and the rollover force-close generate the Z-report in the same database transaction, so a
   closed session cannot exist without its artifact. Tenants that do not auto-generate can generate one on
   demand for a finished session; the report states when it was generated.
3. **Immutable and verifiable.** One row per POS session (`org_pos_shift_z_rpt_tr`, unique per tenant and
   session) holds a versioned JSON snapshot. Its SHA-256 `snapshot_hash` is computed by the database from
   the stored JSON (the application can neither skip it nor supply a different value), UPDATE and DELETE
   are blocked by trigger, and reads re-verify the hash and show the result.
4. **Money stays exact.** Every amount is a fixed-point string straight from a `::text` aggregate; the
   print layouts (80 mm and A4) format strings, never floats. Dates print in the branch timezone the
   business date was computed in.
5. **Access.** `pos_session:report_z` for the Z-report, `pos_session:view` for the X-report; both limited to
   the owner's session or `pos_session:view_all`, and to the actor's branches.

## Consequences

- The snapshot layout is versioned (`snapshot_version`); additive fields (such as the cash attribution) do
  not require a new version, and old reports stay readable.
- A Z-report is never edited to fix an error; a correction is a new posting visible in the next X/Z and in
  the voucher ledger, which is the audit trail.
