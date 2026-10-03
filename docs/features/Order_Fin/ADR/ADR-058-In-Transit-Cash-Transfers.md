# ADR-058: In-Transit Cash Transfers (Two-Leg Custody)

- Status: Accepted
- Date: 2026-10-03
- Owners: Order Fin / Cash Drawer
- Related:
  - [ADR-057 — Two-Domain Cash Ledger](./ADR-057-Two-Domain-Cash-Ledger.md)
  - `POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md` D1-4, migration `0562`

## Context

ADR-057 moves cash between drawers with a **custody transaction**: one balanced posting (source OUT,
destination IN) that cannot create or destroy cash. That is exactly right when the same person moves the
cash. It is wrong when somebody else carries it (counter → safe by a runner, branch safe → another place
in the branch): between the two events the cash is neither in the source nor yet in the destination, and a
single atomic posting hides that. Counts taken in that window were wrong in one drawer or the other.

## Decision

1. **Two legs with a visible middle.** *Send* moves cash from the source drawer into the branch's
   `IN_TRANSIT` holder drawer (`TRANSIT_SEND`). *Receive* moves it from the holder to the destination
   (`TRANSIT_RECEIVE`); *cancel* moves it back to the source with a mandatory reason (`TRANSIT_CANCEL`).
   Each leg is an ordinary balanced custody transaction through the existing ledger, so drawer sequences,
   balances, the "custody never creates or destroys cash" trigger and the close-window cut apply unchanged.
2. **The holder's balance is the cash on the road.** `IN_TRANSIT` is a system-managed drawer type, one per
   branch and currency (a drawer holds one currency), created on first use by
   `ensure_branch_transit_drawer()`. Users never create, edit, count or pick it.
3. **One row per transfer** (`org_cash_drawer_transit_tr`) links the legs and records who sent, who
   received or cancelled, and when. It is forward-only: only an open transfer can be settled, exactly once
   (row lock + unique settle link + trigger); the sent facts never change; nothing is deleted.
4. **Destination validated at send.** Same branch and currency, active, and a type that can receive — cash
   is never sent where it could not arrive. A destination deactivated meanwhile is handled by cancel.
5. **Undo is cancel, not reversal.** `REVERSAL` does not list `IN_TRANSIT`, and the reversal service refuses
   a transit leg (`CASH_TRANSIT_USE_CANCEL`), so a reversal can never leave the transfer record
   contradicting the ledger.
6. **Permission is the only gate; no maker≠checker.** Send and cancel need `cash_drawer:transfer`, receive
   needs `cash_drawer:receive_transfer`; the sender may receive their own transfer. Branch scope applies to
   every route. A counting difference on arrival is the destination's own count and variance — the transfer
   always moves exactly the amount sent.

## Consequences

- No new permission and no change to existing custody types; two new catalog rows' worth of behaviour.
- A drawer overview now includes the system `IN_TRANSIT` holders; they are badged as system drawers.
- Partial receipt (receive less than sent) is intentionally out of scope: a shortage is a variance at the
  destination, which already has an approval/rejection workflow (C3).
