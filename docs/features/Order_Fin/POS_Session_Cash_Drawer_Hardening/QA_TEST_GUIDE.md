# QA Test Guide — Cash Ledger Foundation (CLF)

Owner-runnable scenarios for the cash drawer ledger (ADR-057). Authoritative status: `STATUS.md` (D56).
Last refreshed: 2026-10-03.

## Before you start

- Migrations `0549`, `0550`, `0551` applied on the database you test against; dev server restarted after `npx prisma generate` (a running server keeps the old client).
- Log in as a **tenant admin or branch manager** (needs `cash_drawer:*`, `pos_session:*`, `cash_control:manage`). Use one branch with at least: one TEMPORARY drawer ("Till"), one SAFE drawer, same currency.
- Sidebar paths used below:
  - **Billing → Cash Drawers** → `/dashboard/internal_fin/cash-drawers` (hub); click a drawer for its page.
  - **Billing → Cash Deposit Follow-up** → `/dashboard/internal_fin/cash-drawers/follow-up`.
  - **Billing → POS Sessions** → `/dashboard/internal_fin/pos-sessions`.
  - **Settings → Payments → Cash Control Settings** → `/dashboard/settings/payments/cash-control-settings`.
- Drawer page tabs: **Sessions**, **Ledger**, **Transactions**, **Counts**, **Policy**. Every closed session shows a *Closure* section on its session page.
- Before cleanup: sessions stuck in `CLOSING` (drawers ac312993 / 65546cc7) — finish or force-close them from POS Sessions first, otherwise "open" scenarios on those drawers report `DRAWER_SESSION_ALREADY_OPEN`.
- Expected on every failure: a **translated message** (never a raw code such as `CASH_COUNT_REQUIRED`), in EN and AR.

Legend: ✅ expected result · ❌ must be rejected.

---

## 1. Open session

| # | Steps | Expected |
|---|---|---|
| 1.1 | Till page → **Open Session**. Leave *Count now* **off**, confirm. | ✅ Session opens; opening amount = system-expected (previous close basis + cash since). Counts tab shows no opening count. |
| 1.2 | Close it (§6), then **Open Session** with *Count now* **on**, method *Total*, amount differing from expected by 1. | ✅ Opens; opening count recorded; variance shown with over/short badge; session base = counted value. |
| 1.3 | Open with *Count now* on and the amount **blank**, press confirm. | ❌ Inline message "counted amount required"; nothing saved (no silent zero count). |
| 1.4 | Open again while the session is open. | ❌ `DRAWER_SESSION_ALREADY_OPEN` text, translated. |
| 1.5 | Method *Denomination*, enter note/coin quantities. | ✅ Total = exact sum (check a 3-decimal currency: 0.005 steps). Total mismatch ❌ rejected. |

## 2. Sales, CLOSING, refunds

| # | Steps | Expected |
|---|---|---|
| 2.1 | In New Order / Collect Payment take a **cash** payment for the Till's branch. | ✅ Payment succeeds; Till **Ledger** tab shows one cash-in line with the next ledger sequence number. |
| 2.2 | Take a cash payment with no open session (setting requires one). | ❌ Prompt "open a session"; the entered amounts stay untouched. After opening inline, the payment proceeds. |
| 2.3 | Start the close (§6 step 1 only — stop on the result step) and, in another tab, take a cash payment on that drawer. | ❌ Rejected `DRAWER_SESSION_CLOSING`; nothing is booked. |
| 2.4 | Cash refund of a paid order while the session is open. | ✅ Ledger gets a negative cash line; expected cash drops by the refund. |
| 2.5 | Cash change on a cash payment (tendered > due). | ✅ Rounded change appears as an explicit rounding voucher line; the entered tendered amount is not rewritten. |

## 3. After close

| # | Steps | Expected |
|---|---|---|
| 3.1 | Open the closed session page; check the figures (expected, counted, variance, disposition). | ✅ Figures equal what the close result showed; nothing changes on reload. |
| 3.2 | **Verify after close** (voucher/payment verification on an order paid in that session). | ✅ Allowed; the closed session's numbers do **not** change — the effect lands in the current window. |
| 3.3 | Reverse a cash payment that belonged to the closed session. | ✅ Reversal is a **new line in today's window**; the old session's closing figures stay frozen. |
| 3.4 | Try to edit a posted cash line / closed session figures through any screen. | ❌ No edit control exists; direct API/DB attempts are refused (`CASH_LINE_IMMUTABLE`). |

## 4. Cash custody movements

| # | Steps | Expected |
|---|---|---|
| 4.1 | Till → **Cash In / Cash Out** → *Cash drop* Till→Safe, amount 5, add notes. | ✅ One transaction, two lines (OUT Till, IN Safe), both with ledger sequence numbers; Transactions tab shows it; both ledgers move by 5. |
| 4.2 | Same drop with Till = Safe. | ❌ Same-drawer refusal. |
| 4.3 | Float issue from Safe to Till. | ✅ Safe −x, Till +x. SAFE cannot be the source of a *cash drop* (❌ rejected). |
| 4.4 | Drawer-to-drawer between two TEMPORARY drawers with notes; then without notes. | ✅ With notes; ❌ without notes. |
| 4.5 | **Driver handover** (to a mobile drawer). | ✅ Posted as custody lines; nothing created or destroyed (lines net to zero). |
| 4.6 | Amount larger than the source balance / zero / negative. | ❌ Rejected inline. |
| 4.7 | Transfer between drawers of different branches. | ❌ Cross-branch refusal. |

## 5. Safe count (count-only)

SAFE drawer page → **Counts** tab → *Record count*, method *Total*, amount = ledger balance + 2.

✅ A count is stored with variance +2; the safe's ledger **chain is unchanged** (no money moved); next close/open starts from the counted basis. Blank amount ❌ rejected.

## 6. Close session (two-step) and dispositions

Open a session, take two cash sales (so expected > 0), then Till page → **Close Session**.

**Step 1 — count.** Toggle *Count now*, enter the counted amount (or denominations) → **Next**.
✅ Session becomes `CLOSING`; the result step reveals expected / counted / variance. With a **blind-close** policy (§8) expected is hidden *until* the count is submitted. Blank amount ❌ rejected inline.

**Step 2 — disposition → Confirm Close**

| # | Disposition | Expected |
|---|---|---|
| 6.1 | **Left in drawer** | ✅ Closes; no custody transaction; next session opens at the closing basis. |
| 6.2 | **Moved to safe** | ✅ Destination = active SAFE of the branch only; one custody transaction Till→Safe; next session opens at 0 (not negative). |
| 6.3 | **Partly removed** (kept amount; notes required) | ✅ Kept stays, remainder moves; kept < 0 or > basis ❌ rejected; blank kept ❌ rejected. Next session opens at kept. |
| 6.4 | **Handed to manager** and **Prepared for deposit** (one close each) | ✅ All cash moves to the branch's PENDING_DEPOSIT drawer (create it with the *Create pending-deposit drawer* button if the branch has none); the session appears in **Cash Deposit Follow-up** (§9). |
| 6.5 | Branch with **no active SAFE** | ✅ Cash-moving options are **disabled** with the reason in the label and a hint under the field; *Left in drawer* still works. |
| 6.6 | *Partly removed* or **Other** with empty notes | ❌ Rejected. *Other* with notes ✅ closes, no cash moves. |
| 6.7 | **Uncounted close**: policy allows no count → toggle *Count now* off | ✅ Closes on expected; closing basis = expected; Counts tab shows no closing count. |
| 6.8 | Variance above the approval threshold | ✅ Closes "pending approval"; **Approve Variance** (session page) with a reason completes it. Same user may approve (no maker≠checker rule; permission is the gate). |
| 6.9 | Close with sales still unposted or two clicks on Confirm | ✅ Idempotent: one close, one transaction. |
| 6.10 | **Force close** (POS Sessions hub → session → Force close, with reason) | ✅ Closes without a count; reason stored; session flagged force-closed. |

After each close, reopen and check §1.1: opening expected = previous basis + cash movements since the cut (no double count of the disposition).

## 7. Post-close update (next day)

Follow-up screen → pick a session from §6.4 → **Update** → status e.g. *Deposited*, add notes.
✅ Status/notes saved; ledger and the closed session's numbers unchanged. A non-closed session ❌ `POST_CLOSE_SESSION_NOT_CLOSED`.

## 8. Policy override / reset

1. **Settings → Payments → Cash Control Settings**: set tenant policy (e.g. *Count required at close = on*, *Blind close = on*).
2. Till page → **Policy** tab: override *Count required* = off for this drawer.
   ✅ The field shows the **drawer value with the inherited tenant value beside it**; saving is audited.
3. Close a session on that drawer → the count step is skippable (§6.7). On another drawer it is still required (❌ blank rejected).
4. **Reset to inherited** on the Policy tab.
   ✅ Field returns to the tenant value; the count is required again.
5. A user without `cash_control:manage` sees the Policy tab read-only (no save button).

## 9. Follow-up screen

**Cash Deposit Follow-up**: filter by *Post-close status*, columns Session / Drawer / Branch / Closed / Sent to deposit / Status / Notes.
✅ Only sessions whose cash went to pending deposit appear; filter works; empty state "Nothing to follow up" when none.

## 10. Permissions & isolation spot-checks

| # | Check | Expected |
|---|---|---|
| 10.1 | User without `cash_drawer:open_session` | Open button hidden; direct API call → 403. |
| 10.2 | User without `cash_drawer:record_movement` | Cash In/Out hidden. |
| 10.3 | User without `cash_drawer:close_session` | Close button hidden. |
| 10.4 | Log in as a user of **another tenant** | Sees none of this tenant's drawers; direct URL of a foreign drawer → not found. |
| 10.5 | Same-tenant user from another branch | **Known gap** — branch scoping is Wave B3; not expected to be blocked yet. |

## 11. Language, layout, device

Repeat §1.2, §6.2 and §6.5 in **Arabic**: RTL layout, glossary term **درج النقد** for the drawer cash, no truncated labels, error messages in Arabic. Repeat §6 on a **tablet** viewport (wizard fits, buttons reachable, number pad works). *(Pixel-level RTL/tablet is manual-only; no automated test covers it.)*

## 12. HQ Delete Orders (0551)

HQ console → Tenant → Maintenance → **Delete Orders** → *Preview* on a demo tenant.
✅ Preview returns counts (no `malformed array literal`); a tenant with cash drawer history is reported as blocked with a readable reason.

## 13. POS session per screen (B1 + 0554/0557)

Setting: **Settings → Payments → Cash Control Settings → POS Session Controls** — one selector per screen: *order entry*, *later payment collection*, *wallet / advance / gift-card sales*, *cash refunds*, *customer account receipts*, *manual finance vouchers*. Modes: **Required for any payment** · **Required for cash payments only** · **Optional — linked when one is open**. Defaults: order entry = required for cash, everything else = optional. Cash always also needs an open **cash drawer** session (a separate rule, not configurable here). Needs migrations `0554` and `0557` applied.

| # | Steps | Expected |
|---|---|---|
| 13.1 | Close your POS session (POS Sessions). Open an order with a balance → **Collect payment**, cash, press collect (later collection is *optional* by default). | ✅ Succeeds, unlinked to a POS session (the cash lands in your open drawer session). |
| 13.2 | Set *later payment collection* to **Required for cash payments only**, save, repeat 13.1. | ❌ Rejected with "Open a POS session before taking this payment" and an **Open POS session** button; the typed amount is untouched. |
| 13.3 | Press **Open POS session**, then collect again. | ✅ Session opens, the second attempt succeeds and the payment is linked to that session (POS Sessions → summary). |
| 13.4 | Same screen set to **Required for cash payments only**, no session, collect by **card**. | ✅ Succeeds. Switch to **Required for any payment** → ❌ rejected like 13.2. |
| 13.5 | With *order entry* = required for cash and no session: New Order → pay cash. | ✅ The existing flow opens a session first, then submits. Set *order entry* to **Optional** → submits without opening one. |
| 13.6 | Leave *later collection*, *wallet sales* and *cash refunds* **Optional**; with no POS session, collect a later cash payment, top up a wallet with cash, process a cash refund. | ✅ All succeed (each needs an open drawer session for the cash). Set one to **Required…** → only that screen refuses. |
| 13.7 | Pause your session, collect cash on a *Required* screen. | ❌ Rejected like 13.2; opening/resuming is offered. |
| 13.8 | A cash refund *request* (pending approval) with no session, even when *cash refunds* is Required. | ✅ Accepted — only **processing** (cash leaves the drawer) is gated. |
| 13.10 | Customers → receive payment (customer account receipt) with *customer account receipts* set to **Required…** and no session → Post. | ❌ Translated message + **Open POS session** button; after opening, press Post again → ✅. |
| 13.11 | Finance → Vouchers → a draft voucher with a cash line → Post with *manual finance vouchers* set to **Required…** and no session. | ❌ Dialog shows the translated message + **Open POS session**; after opening and posting, the voucher lines carry your session. A voucher with no payment line posts regardless. |
| 13.9 | Override one screen for a single branch or user (scope selector), leave the tenant value. | ✅ That branch/user follows the override; others keep the tenant value. |

## 14. Branch scoping and assigned drawers (B3)

Needs migration `0555` applied. A **cashier** is branch-scoped (home branch + any granted branch); roles holding *View cash drawers across branches* (admin, branch manager, finance manager, accountant, operator…) see every branch. Use two users in two branches.

| # | Steps | Expected |
|---|---|---|
| 14.1 | Sign in as a cashier of Branch A → **Finance → Cash Drawers**. | Only Branch A drawers are listed (hub, overview, follow-up, transactions). |
| 14.2 | Paste the URL of a Branch B drawer (`/dashboard/internal_fin/cash-drawers/<id>`) or one of its sessions. | The page cannot load it — "You don't have access to this branch's cash drawers." (HTTP 403 `DRAWER_BRANCH_FORBIDDEN`). |
| 14.3 | Same cashier → **POS Sessions** hub. | Own sessions plus other users' sessions of Branch A only; filters list Branch A values only. |
| 14.4 | As an admin → open the same Branch B drawer and a Branch B POS session. | ✅ Loads (all-branch role). |
| 14.5 | **Cash Drawers → [drawer] → Policy tab**: set *Drawer assignment* to **Assigned cashier only**, assign the drawer to user X. As user Y (cashier, same branch) try Open session / Cash in / Close. | ❌ "This cash drawer is assigned to another user…" for each; X can do all three. |
| 14.6 | As a branch manager or admin (holds *operate any drawer*) on that drawer. | ✅ Allowed (supervisor override). |
| 14.7 | Customer receipt or POS payment in cash into that drawer as user Y. | ❌ Same refusal; the payment is not recorded. |
| 14.8 | Grant user Y a second branch (resource grant) and reload. | Y now also sees that branch's drawers. |

## 15. Cash refund rounding, recount and force close

| # | Steps | Expected |
|---|---|---|
| 15.1 | **Billing → Refunds** → a CASH refund of an amount that is not on the cash increment (e.g. 10.003 OMR with a 0.005 increment) → **Process**. | The dialog says "Cash to hand out: 10.005 OMR. The refund stays 10.003 OMR; the 0.002 OMR difference is recorded as cash rounding." (who absorbs it follows *Cash-change rounding* in Cash Control Settings). The typed refund amount is not changed. |
| 15.2 | Confirm, then open the drawer session page → closure / movements. | The refund voucher is the exact 10.003; a separate *Cash refund rounding* voucher for 0.002 sits in the same session, and the expected cash equals what is physically counted. |
| 15.3 | A session stuck in **CLOSING** (count taken, never finalized) → open it from the drawer's Sessions tab. As a user with *approve variance*: **Recount**. | A dialog shows expected / previous count / variance; enter a new count (total or by denomination) → "Recount recorded". The old count stays in the closure history; the variance is recomputed. A user without the permission sees no button. |
| 15.4 | Same stuck session, as a user with *force close POS session*: **Force close**. | A dialog with a warning, a mandatory reason and the per-currency disposition form (same as the normal close). Submitting closes the session as FORCE_CLOSED with the reason shown on the page. |
| 15.5 | An **OPEN** session abandoned by a cashier → session page → **Force close**. | Same dialog; works without a count (expected cash comes from the ledger). |
| 15.6 | A CLOSED session. | Neither button appears. |

## 16. Business-day rollover, shift reports, variance decisions

Needs migrations `0558`, `0559`, `0560` applied. Rollover runs every 15 minutes; to test sooner, run the job from **Finance → Outbox → Jobs → POS Session Rollover → Run now**.

| # | Steps | Expected |
|---|---|---|
| 16.1 | **Settings → Branch Settings** → pick a branch → **Business day** card. Choose a timezone → Save. | "Branch timezone updated"; the card says "In effect now: <zone>". Choosing *Same as the organization* shows the organization's zone. A user without *update settings* sees it disabled. |
| 16.2 | Cash Control Settings: *Session rollover* = **Pause at rollover**. Leave a POS session open across the branch midnight (or change the session's business date in the DB to yesterday), then run the job. | The session becomes **PAUSED** with a *Rolled over* badge; a notice explains the business day changed. **Resume is not offered**; calling resume returns "paused because the business day changed". Close it, then open a new session. |
| 16.3 | Same with **Force close at rollover** and *no* drawer session linked. | The session is **FORCE_CLOSED** (*Auto-closed* badge); its timeline shows "Force-Closed at Rollover" by the system. |
| 16.4 | Same with **Force close at rollover** but the session's drawer session still **open**. | The session is only **paused** (cash is never abandoned); the timeline event notes the drawer blocked the close. |
| 16.5 | A session open longer than *Stale after (hours)*. | *Stale* badge once; the cashier and branch supervisors get an in-app notification. Running the job again does not repeat it. |
| 16.6 | Remove a branch's and the organization's timezone (DB) and try to open a POS session. | Refused: "No timezone is set for this branch or organization…" — it never silently uses another zone. |
| 16.7 | **POS Sessions** → a session row → **Shift report**. | Open session: live **X-report** (sales by tender, refunds, cash in/out/net, change rounding, drawer session). Figures match the session summary. |
| 16.8 | Close the drawer session, then close the POS session (with *Require Z-report* on). Open the **Shift report** again. | The **Z-report** (number `Z-<session no>`) shows the frozen figures and "Integrity verified". Toggle *Live figures (X)* — it says these are not the frozen report. **Print 80mm / Print A4** open a clean print preview. |
| 16.9 | Turn *Require Z-report* off, close a session, open its report. | A warning "No Z-report for this shift yet" and a **Generate Z-report** button; after generating, the report states when it was generated. |
| 16.10 | A drawer session closed with a variance beyond its threshold → **Finance → Cash Drawers → [drawer] → session**. | Banner "Supervisor approval…" with **Reject Variance** and **Approve Variance**. Reject needs a reason; afterwards a red "Variance rejected by … — under investigation" banner; Approve is no longer possible ("already rejected"). The user who closed it may decide it (no maker≠checker). |
| 16.11 | Open `/dashboard/internal_fin/cash-drawers/variance-approvals` (user with *approve variance*). | Pending list with per-currency variance, expected vs counted, Approve / Reject / Review; filter Rejected / Approved / All. A cashier of another branch's sessions never appear. |
| 16.12 | **Reports → Cash Variance by Cashier** → pick a date range. | One row per cashier and currency: sessions, short/over, net, average, absolute total, short-share badge, pending/rejected counts. Print opens an A4 preview. Different currencies are separate rows. |

## 17. In-transit cash, denominations, count policy, attribution

Needs migration `0562` applied. Use a branch with a counter drawer and a safe in the same currency.

| # | Steps | Expected |
|---|---|---|
| 17.1 | **Finance → Cash In Transit** → **Send cash** → From: the counter drawer, To: the safe, amount `4.250`, a note → Send. | "Cash sent in transit (CDT-…)". The row is *In transit*. The counter drawer's expected cash dropped by 4.250; the safe has not gained it yet. A system drawer "In transit (OMR)" appears in the drawer list, badged *System drawer*. |
| 17.2 | In the dialog, type `abc`, `-1`, `1.23456`. | Inline message under the amount; **Send** stays disabled. What you typed is never changed. |
| 17.3 | Pick a driver-bag drawer as destination. | It is not offered (only drawers the transfer can reach). |
| 17.4 | On the in-transit row → **Receive** → confirm. | Status *Received*; the safe now holds 4.250; the in-transit holder is back to zero. Receive again from another tab → "already received or cancelled". |
| 17.5 | Send another, then **Cancel** with no reason → button disabled; with a reason → *Cancelled*, the cash is back in the counter drawer, the reason shows in the Settled column. |
| 17.6 | The user who sent it opens **Receive**. | Allowed (permission is the only gate). A user without *receive transfer* sees no Receive button. |
| 17.7 | **Cash Drawers → Transactions**: try to reverse the transit transaction. | Refused: "cannot be reversed — cancel the transfer instead". |
| 17.8 | **Settings → Payments → Cash control settings → Counted denominations** → OMR → switch off a coin → **Save**. | "Denominations saved". Open a drawer count / close wizard → that coin is no longer in the grid. Old counts that used it still show it. Re-enable and Save → back. |
| 17.9 | Same card: move a row up/down → Save. | The counting grid follows your order. **Reset to HQ defaults** → Save restores HQ order. |
| 17.10 | Cash control settings: *Closing count mode* = **Denominations**. Close a drawer. | The wizard says "Your organization requires counting by denomination" and offers only the grid; a bare total is not possible. *Total only* → only the total field; *Optional* → the method select. |
| 17.11 | Switch off **every** OMR denomination, close a drawer with *Denominations* policy. | The wizard falls back to the total field (nothing to count with) and the close succeeds. |
| 17.12 | Cash control settings: *Shared session mode* = **Exclusive**. Two cashiers try to link their POS sessions to the same open drawer session. | The second link is refused: "…already in use by another POS session, and sharing … is turned off". With **Shared** both link. |
| 17.13 | A drawer session shared by two cashiers → session page → **Cash by POS session**. | One row per POS session (cash in / out / net / lines); cash with no POS session shows as "No POS session" on its own line. The same table is on the Z-report of each of those shifts. |
| 17.14 | **Reports → Reconciliation → Cash drawer**: a session counted 4 baisa short on OMR. | Flagged as an exception (before, the flat 0.01 tolerance hid it); a 4-fils difference on a 2-decimal currency is not flagged. |

---

## 18. Labels, Z-report archive, POS-session permissions (D69)

> Apply migration **0578** first for 18.8–18.10. Everything else works without it.

| # | Do this | Expect |
|---|---|---|
| 18.1 | Switch the UI to **Arabic**. Open **Finance → POS Sessions**, the events dialog of a session that went through a rollover. | Event, status and drawer-status columns show Arabic names (e.g. an event for the rollover pause), never `ROLLOVER_PAUSE` / `FORCE_CLOSED`. English shows English names. |
| 18.2 | POS Sessions → filter **Status**. | The options are the catalog names (Open / Paused / Closed / Force-closed), in your language. |
| 18.3 | **Cash drawers** → any drawer → a **Pending deposit** or **In-transit** drawer. | The type badge reads its catalog name, not the raw code. |
| 18.4 | A drawer session in **Closing** state (close wizard started, not finished). | The status chip reads "Closing" (amber), not a raw code. |
| 18.5 | Send an in-transit transfer, then open the source drawer → **Transactions** tab. | The leg shows "Transit send" (catalog name) — no `billing.cashDrawers.tabs.trx.types…` key text. |
| 18.6 | **HQ console → System Codes → Cash & POS Catalogs** → Drawer Types → COUNTER → change the English name → Save. Reload web-admin (or wait 10 min). | The new name appears on the drawer type badge. Restore it afterwards. |
| 18.7 | POS Sessions → **Z-report archive** button (needs `pos_session:report_z`). | Lists closed shifts, newest business day first: report no., business date, branch, cashier, sales per currency, drawer variance (red when non-zero, "Variance pending" while undecided), closed time, **Verified**. A rollover-closed shift carries "Auto-closed". |
| 18.8 | Archive filters: search a report no. / cashier name; pick a branch; set a date range with *from* later than *to*. | List narrows; the invalid range shows an inline error and does not query. **Clear filters** resets. Click a report no. → opens that shift's report. |
| 18.9 | As a **cashier** (no `pos_session:view_all`): open the archive. | Only the cashier's own shifts. As a branch manager: every cashier's shifts in the branch scope. |
| 18.10 | After applying **0578**, sign in as **viewer**, **driver**, **laundry worker** and **B2B customer**. | No POS Sessions menu item; the page and its APIs answer "permission denied". **Cashier / operator** can still open, pause, close their own shift but cannot force-close or see other cashiers; **branch manager / supervisor / finance manager** can force-close and see all. |
| 18.11 | Rollover job raises a stale-session notice. | Only supervisors / managers (holders of `pos_session:force_close`) and the session owner are notified — not every user. |

---

## Report back

For any ❌ that was accepted, or ✅ that failed: scenario number, the drawer/session id, a screenshot, and the browser console / dev-server log line. The ledger tab's sequence numbers are the quickest way to show what was booked.
