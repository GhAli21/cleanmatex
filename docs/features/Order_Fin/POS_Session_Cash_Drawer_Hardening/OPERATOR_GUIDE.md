# POS Sessions & Cash Drawers — Operator Guide

Written for: branch managers, supervisors, cashiers and finance staff who run the day. For the owner-run
test scenarios see [QA_TEST_GUIDE.md](./QA_TEST_GUIDE.md); for the rules behind this guide see the ADRs
([054](../ADR/ADR-054-User-Owned-POS-Sessions.md), [057](../ADR/ADR-057-Two-Domain-Cash-Ledger.md),
[058](../ADR/ADR-058-In-Transit-Cash-Transfers.md), [059](../ADR/ADR-059-Immutable-Shift-Z-Report.md)).

## 1. Two different things

- A **POS session** is *your shift*: who was working, in which branch, on which business day. Payments,
  refunds and vouchers are attributed to it. Each person has at most one live session.
- A **cash drawer session** is *the physical till*: opening count, the cash that moved, the closing count.
  Several cashiers can share one (unless your organization switched sharing off).

Closing your shift never moves cash; counting the drawer never ends your shift. Close the drawer first,
then the POS session.

## 2. Which screens need a POS session

Your administrator decides, per screen (Settings → Payments → Cash control settings): order entry,
collecting a later payment, wallet/advance/gift-card sales, cash refunds, customer receipts, manual
vouchers. Each is *required*, *required for cash* or *optional*. When a screen needs one and you have none,
it offers to open it right there. Cash always needs an open **drawer** session regardless.

## 3. Opening a drawer

Open from Finance → Cash Drawers (or from the Session hub). The expected opening cash is computed from the
drawer's history; you only record what you physically counted. Depending on policy you count by
**denomination**, by **total**, or you choose — the screen only offers what is allowed. A drawer assigned to
one cashier can be opened only by that cashier or a supervisor with *operate any drawer*.

## 4. Closing a drawer (count → disposition)

1. **Count.** With *blind close* on you count before the system figure is shown. The count freezes the
   cut: from this moment no new cash can be taken on the drawer.
2. **Disposition.** Say where the closing cash goes (left in the drawer, moved to the safe, handed to a
   manager, prepared for deposit). Nothing is left undecided.
3. **Variance.** A difference inside the tolerance is accepted. Beyond it you give a reason; beyond the
   approval threshold the session is closed but marked *pending approval* until a supervisor decides it.

A session stuck in *closing* can be **recounted** (supervisor with *approve variance*) or **force-closed**
(*force close POS session*) from the session page. Both keep the earlier counts on record.

## 5. Variance decisions

Finance → **Cash Variance Approvals** lists drawer sessions over their threshold. A supervisor can
**approve** (the variance is accepted) or **reject** (not accepted — it needs investigation) with a reason.
The decision is final and recorded with who and when. The person who closed the session may decide it:
permission is the only gate. **Reports → Cash Variance by Cashier** shows, per cashier and currency, how many
closes, the net and average variance, and how often the errors are shortages — a high short share points to
a pattern, not a one-off miss.

## 6. Moving cash

- **Between drawers in one go** (cash drop, float issue, drawer to drawer): Cash Drawers → the drawer →
  Transactions.
- **When someone carries it**: Finance → **Cash In Transit** → *Send cash*. The cash leaves the source now
  and sits "in transit". At the destination press **Receive**; if it never arrives, **Cancel** (a reason is
  required) and it returns to the source. A transfer is settled once. You cannot reverse a transit leg —
  cancel it.

## 7. End of day

- **Business day.** It belongs to the branch (Settings → Branch Settings → Business day). A session still
  open when the branch day ends is **paused** (or force-closed if your policy says so and its drawer holds
  no cash) and shows *Rolled over*. It cannot be resumed: close it and open a new one so nothing is booked
  into yesterday.
- **Stale sessions.** One open for longer than the configured hours gets a *Stale* badge and a
  notification to you and your supervisor.
- **Shift report.** POS Sessions → *Shift report*: the live **X-report** while the shift runs; the **Z-report**
  is frozen when it closes (number `Z-<session no>`, with an integrity line). Print on 80 mm or A4. If your
  organization does not auto-generate the Z-report, press *Generate Z-report* after closing.

## 8. When something looks wrong

| You see | Meaning | What to do |
|---|---|---|
| "No timezone is set for this branch…" | Neither the branch nor the organization has a timezone | Ask an administrator to set the branch timezone |
| "…paused because the business day changed" | Rollover acted on your session | Close it, open a new one |
| "This cash drawer is assigned to another user" | Assigned-only drawer | Use your drawer or ask a supervisor |
| "…already in use by another POS session" | Sharing is off for this drawer | Use another drawer session or ask a supervisor |
| "This way of counting is not allowed…" | The count policy fixes how you count | Use the method the screen offers |
| *Pending approval* on a session | Variance over the threshold | A supervisor decides it in Cash Variance Approvals |
