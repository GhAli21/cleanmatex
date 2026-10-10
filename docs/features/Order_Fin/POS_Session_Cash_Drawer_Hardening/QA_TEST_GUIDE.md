# QA Test Guide — Cash Ledger Foundation (CLF)

Owner-runnable scenarios for the cash drawer ledger (ADR-057) and the program built on it: §1–§12 the ledger, §13–§17 policy, rollover, reports, in-transit and denominations, §18 catalog labels / Z-report archive / POS-session permissions, §19 the POS Settings page. Authoritative status: `STATUS.md` (D56–D70).
Last refreshed: 2026-10-09 (migrations through **0587** applied).

## Before you start

- Migrations `0549`, `0550`, `0551` applied on the database you test against; dev server restarted after `npx prisma generate` (a running server keeps the old client).
- Log in as a **tenant admin or branch manager** (needs `cash_drawer:*`, `pos_session:*`, `cash_control:manage`). Use one branch with at least: one TEMPORARY drawer ("Till"), one SAFE drawer, same currency.
- Sidebar paths used below:
  - **Billing → Cash Drawers** → `/dashboard/internal_fin/cash-drawers` (hub); click a drawer for its page.
  - **Billing → Cash Deposit Follow-up** → `/dashboard/internal_fin/cash-drawers/follow-up`.
  - **Billing → POS Sessions** → `/dashboard/internal_fin/pos-sessions`.
  - **Settings → Cash Control Settings** → `/dashboard/settings/payments/cash-control-settings` (drawer close, custody, cash-change rounding, denominations, pending-deposit status).
  - **Settings → POS Settings** → `/dashboard/settings/pos-settings` (POS-session requirement per screen, rollover, stale hours, Z-report required).
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

1. **Settings → Cash Control Settings**: set tenant policy (e.g. *Count required at close = on*, *Blind close = on*).
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

Setting: **Settings → POS Settings → Session requirement** — one selector per screen: *order entry*, *later payment collection*, *wallet / advance / gift-card sales*, *cash refunds*, *customer account receipts*, *manual finance vouchers*. Modes: **Required for any payment** · **Required for cash payments only** · **Optional — linked when one is open**. Defaults: order entry = required for cash, everything else = optional. Cash always also needs an open **cash drawer** session (a separate rule, not configurable here). Needs migrations `0554` and `0557` applied.

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
| 16.2 | **POS Settings → Shift lifecycle**: *Session rollover* = **Pause at rollover**. Leave a POS session open across the branch midnight (or change the session's business date in the DB to yesterday), then run the job. | The session becomes **PAUSED** with a *Rolled over* badge; a notice explains the business day changed. **Resume is not offered**; calling resume returns "paused because the business day changed". Close it, then open a new session. |
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
| 17.8 | **Settings → Cash Control Settings → Counted denominations** → OMR → switch off a coin → **Save**. | "Denominations saved". Open a drawer count / close wizard → that coin is no longer in the grid. Old counts that used it still show it. Re-enable and Save → back. |
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

## 19. POS Settings page (D70)

> Apply migration **0587** first for 19.1 (menu entry). The URL works without it.

| # | Do this | Expect |
|---|---|---|
| 19.1 | **Settings** menu. | A new **POS Settings** item sits right after **Cash Control Settings**. |
| 19.2 | Open **POS Settings** (`/dashboard/settings/pos-settings`). | Two tabs: **Session requirement** (six per-screen selectors) and **Shift lifecycle** (rollover mode, stale hours, Z-report required). Opening `?tab=lifecycle` lands on the second tab. |
| 19.3 | Change one selector on each tab. | An amber dot appears on both tabs; the footer says "2 unsaved changes". Save writes both in one request; the dots clear; a success message shows. **Discard changes** restores the saved values. |
| 19.4 | Open **Cash Control Settings**. | No POS-session card any more; drawer close, custody, cash-change rounding, denominations and pending-deposit status are all still there and save as before. |
| 19.5 | Change a value on POS Settings, then reload Cash Control Settings. | The value is unaffected there; saving one page never touches the other page's fields. |
| 19.6 | Sign in with `cash_control:view` only. | Both pages open read-only with a "View only" notice; tabs still switch; no Save/Discard bar. |
| 19.7 | Switch to Arabic. | Page title "إعدادات نقطة البيع", tab names and descriptions are Arabic and the layout is right-to-left. |

---

## Report back

For any ❌ that was accepted, or ✅ that failed: scenario number, the drawer/session id, a screenshot, and the browser console / dev-server log line. The ledger tab's sequence numbers are the quickest way to show what was booked.

---

## Financial_Expert_Tester Results — Preview manual QA, 2026-10-09 (Asia/Muscat)

Context: manual QA on Preview as Demo Laundry `super_admin` (U000003) via the UI only; tenant currency OMR with 3 decimals. Run 10:05–~10:45 (Asia/Muscat) in batches A–C; the owner stopped the run at ~10:45 while batch C (create QA drawers) was mid-way, so many scenarios were not reached. Root causes below come from a separate read-only code/DB diagnosis (`/workspace/pos/diagnosis-1.txt`). The guide has no Result columns, so results are listed here by scenario id. Legend: PASS / FAIL / PARTIAL / BLOCKED / NOT RUN.

| # | Result | Evidence |
|---|---|---|
| 19.1 | PASS | POS Settings page loads. |
| 19.2 | PASS | Six selectors present; lifecycle shows PAUSE_AT_ROLLOVER, stale 12 h, Z-report required ON. |
| 19.3 | PASS | Footer shows "1 unsaved change" / "2 unsaved changes"; Discard restores saved values. |
| 19.4 | PASS | Behaves as the guide expects. |
| 19.7 | PARTIAL | Page content is Arabic and RTL, but the top-bar title and the browser document title stay English (FET-POS-S10). |
| 1.1 | PASS | DRIVER-01, Count now toggled OFF, SES-20261009-0003 opened (opening 0.000); "Session opened successfully." A stale "Enter the counted amount." toast lingered beside it (FET-POS-S8). The guide says Count now OFF, but the dialog defaults to ON (FET-POS-S9). No TEMPORARY Till existed at the time, so DRIVER-01 was used as the stand-in (FET-POS-S12). |
| 1.2 | PASS | Substitute on DRIVER-01: denominations 2 x 5 OMR + 3 x 0.100 = 10.300 OMR; toast "Session opened. Opening count variance: 10.300 OMR."; Counts tab Opening Expected 0.000, Counted 10.300, badge "Over +10.300 OMR". |
| 1.3 | PARTIAL | Empty counted amount gives the toast "Enter the counted amount." instead of an inline field error, and not the guide's wording (FET-POS-S8). |
| 1.4 | PASS (by absence) | With a session open, the Open button is replaced by Cash In/Out + Close; a second open cannot be started. |
| 1.5 | PASS | 3-decimal sum = 10.300 OMR; verified only on the DRIVER-01 substitute because DRW-BR2-002 fails to load (see 5). |
| 4.1 / 4.3 | FAIL | Cash drop DRAWER-01 -> SAFE-01, 0.500: "Failed to post the transfer", twice, nothing posted. Likely cause: SAFE-01 has a stuck CLOSING session (SES-000018) and/or the broken drawer data (FET-POS-S2, S6). The UI gives no specific reason (FET-POS-S3). |
| 4.2 | PASS (by absence) | The same drawer is not offered as a destination. |
| 4.4 / 4.7 | BLOCKED | DRIVER-01 offers only Float issue / Driver handover; Branch-2 drawers are not offered as destinations. |
| 4.6 | PARTIAL | Amount 0 -> toast "Amount must be greater than zero"; amount -1 keeps the dialog open; amount above balance (5) -> the same generic "Failed to post the transfer", no balance-specific message (FET-POS-S3). |
| 5 | BLOCKED | SAFE-01 detail: "Failed to load cash drawer data." 4 of 4 tries (DRW-BR2-001/002 intermittently). Root cause: ledger rows from migration 0549 have performer `'migration_0549'` (not a UUID); `audit-actor.service.ts` L49-53 / L74-78 pass it into UUID `.in()` filters and throw (FET-POS-S2). Pages also take 12-15 s (FET-POS-S11). |
| 6.1 | PASS | Count OFF + "Left in drawer": DRIVER-01 SES-20261009-0003 closed 10:23; expected 0.000; no custody transaction. A stale "Failed to close session." toast was visible (FET-POS-S8). |
| 6.2 - 6.4 | BLOCKED | Transfers to SAFE-01 fail and there is no safe in Branch 2. |
| 6.5 | BLOCKED | Depends on a working transfer destination. |
| 6.6 | PASS | "Notes are required for this disposition." and "Select a destination drawer for this disposition." (not fully confirmed). |
| 6.7 | PASS | Uncounted close = the 6.1 run. |
| 6.9 | PASS | Double-click Confirm gave one record, SES-20261009-0004, closed 10:31, expected 10.300. The second click showed an extra "Failed to close session." toast (FET-POS-S8). |
| 6 (count ON) / 17.10 / 17.11 | FAIL | DRIVER-01 close with denomination counting required: "Your organization requires counting by denomination. No denomination catalog is configured for this currency — use the total amount instead." No amount field is shown; Next -> "Failed to close session." Yet the Open dialog for the same currency lists 11 denominations (FET-POS-S4). |
| 1.1 after close (reopen basis) | PARTIAL / FAIL (owner to confirm) | After the uncounted close of SES-0004 (expected 10.300), SES-20261009-0005 reopened with opening 0.000. The guide says opening = previous close basis + cash since. DB check: SES-0005 ses_bal opening_expected 0.0000 (FET-POS-S5). |
| 9, 13.x, 2.x (POS Sessions) | BLOCKED + FAIL | `/api/v1/pos-sessions` and `/my-active` return HTTP 422; the list is empty with no error shown. "POS session opened." toast, yet "My active POS session" says none and the Session Hub shows "Failed to load POS sessions". New Order: "POS session could not be checked", "+ Add" adds no items, Submit disabled. Root cause: `pos-session.service.ts` L282 and L1473 filter `o.is_active`, a column that does not exist on `org_orders_mst` (FET-POS-S1). |
| 15.3 / 15.4 | NOT RUN | DRAWER-01 SES-20261009-0001 went to CLOSING when Next was clicked on the close wizard; its expected moved 1.000 -> 63.250 with no ledger line to explain it (FET-POS-S6). |
| §3, §7, §8, §9-§12 (other than above), §14, §16, §17 (other than 17.10/17.11), §18 | NOT RUN / BLOCKED | Run stopped by the owner at ~10:45; several are also blocked by the POS Sessions 422 and SAFE-01 load failure. One summary row per section, not detailed. |

Row count: 25 scenario rows. Tally: PASS 13 (11 PASS + 2 PASS by absence), PARTIAL 4 (including the reopen-basis row, which may be FAIL pending owner confirmation), FAIL 2, BLOCKED 4, BLOCKED + FAIL 1 (POS Sessions), NOT RUN 2 (15.3/15.4 and the summary row).

### Test data left behind (read-only DB check at ~10:47, Asia/Muscat)

QA drawers created by the tester in Demo Laundry (Batch C), none existed before 10:35:
- `QA-TILL-1` (TEMPORARY, id f051e006) created 10:35:34. Sessions: SES-20261009-0006 FORCE_CLOSED 10:37 -> 10:44; SES-20261009-0007 opened 10:45:42, status CLOSING (updated 10:47:09), opening counted 6.055.
- `QA-SAFE-1` (SAFE, id 28520137) created 10:35:58. No sessions.
- `QA-TILL-2` (TEMPORARY, id bd051b01) created 10:36:07. No sessions.
- Transactions since 10:38: CDT-20261009-0001 FLOAT_ISSUE 20.000 QA-SAFE-1 -> QA-TILL-1 (10:38:34); -0002 CASH_DROP 5.000 TILL-1 -> SAFE-1 (10:38:56); -0003 DRAWER_TO_DRAWER 3.000 TILL-1 -> TILL-2 (10:39:14); -0004 DRAWER_TO_DRAWER 999.000 TILL-1 -> TILL-2 (10:39:36); -0005 DRAWER_TO_DRAWER 999.000 TILL-2 -> TILL-1 (10:40:06); -0006 CLOSE_DISPOSITION 13.000 TILL-1 -> SAFE-1 (10:44:43); -0007 FLOAT_ISSUE 10.000 SAFE-1 -> TILL-1 (10:46:08). One ledger line: CASH_PAY_IN 1.000 on QA-TILL-1 (10:42:34). Note the two 999.000 transfers posted, which looks unusual when the till's balance was far lower: verify whether over-balance transfers between counters are meant to be allowed (FET-POS-S3).
- Orders created since 10:30: 0.
- Drawer sessions from the earlier batches: DRIVER-01 SES-20261009-0003 CLOSED (10:23), -0004 CLOSED (10:31), -0005 OPEN (opened 10:31:31, left open).

Final state of all Demo drawers and live sessions: DRAWER-01 SES-20261009-0001 CLOSING (stuck since 10:25 via the wizard); DRW-BR2-001 SES-20261009-0002 OPEN; DRW-BR2-002 none; DRIVER-01 SES-20261009-0005 OPEN; SAFE-01 SES-000018 CLOSING (stuck since 2026-09-17); PD-22222222 / PD-597139C9 none; QA-TILL-1 SES-20261009-0007 CLOSING; QA-SAFE-1 and QA-TILL-2 none.

POS session opened by the tester at ~10:3x: no new `org_pos_sessions_mst` row exists after 07:43 (the only OPEN rows are POS-20261009-7C9F8D81, admin, opened 04:38, and POS-20261009-0034595A, ahmed, opened 07:43). The "POS session opened." toast for Main Branch Name most likely returned the admin's existing OPEN session POS-20261009-7C9F8D81, whose linked drawer session (DRAWER-01 SES-20261009-0001) is now CLOSING.

### Tester suggestions — Financial_Expert_Tester (FET-POS)

P0
1. **FET-POS-S1 (P0)** Financial_Expert_Tester / FET-POS-S1: POS Sessions list and my-active always return 422 and the New Order screen cannot use a session. Delete `AND COALESCE(o.is_active, TRUE) = TRUE` at `lib/services/pos-session.service.ts` L282 and L1473 (`org_orders_mst` has no `is_active`; regression from commit 723fed47) and add a DB-backed test that runs both queries. Evidence: sections 9/13/2 above, `column o.is_active does not exist`.

P1
2. **FET-POS-S2 (P1)** Financial_Expert_Tester / FET-POS-S2: drawer detail fails for SAFE-01 and intermittently DRW-BR2-001/002 because ledger performers from migration 0549 are the text `'migration_0549'`. Filter actor ids to UUIDs before the `.in()` calls at `lib/services/audit-actor.service.ts` L49-53 and L74-78 (show the raw string for non-UUIDs), or data-fix the rows. Also log the error in the `catch` of `app/dashboard/internal_fin/cash-drawers/[drawerId]/page.tsx` (L39-55) instead of showing only the generic "Failed to load cash drawer data." (scenario 5).
3. **FET-POS-S3 (P1)** Financial_Expert_Tester / FET-POS-S3: a failed transfer must say why, in a translated message (e.g. "destination drawer has a session in CLOSING / is not open", "amount exceeds the available balance"). Today DRAWER-01 -> SAFE-01 0.500 and an over-balance 5 both give the generic "Failed to post the transfer" (4.1/4.3/4.6). Also confirm whether the two 999.000 counter-to-counter transfers (CDT-0004/0005) should have been allowed.
4. **FET-POS-S4 (P1)** Financial_Expert_Tester / FET-POS-S4: closing count says "No denomination catalog is configured for this currency" while the Open dialog shows 11 denominations for the same OMR currency, and the wizard then offers no amount field. Fix the catalog lookup in the close flow, or fall back to the total-amount field as the message itself promises (guide 17.11).
5. **FET-POS-S5 (P1)** Financial_Expert_Tester / FET-POS-S5: reopening after an uncounted close gives opening 0.000 although the previous session's expected was 10.300 (DRIVER-01 SES-0004 -> SES-0005). Confirm the intended opening basis (guide 1.1: previous close basis + cash since) and fix or update the guide. Needs owner confirmation.

P2
6. **FET-POS-S6 (P2)** Financial_Expert_Tester / FET-POS-S6: stuck CLOSING sessions (SAFE-01 SES-000018 since 2026-09-17; DRAWER-01 SES-20261009-0001; later QA-TILL-1 SES-20261009-0007) need a recount / force-close path that works even when the drawer page fails to load. Clicking Next in the close wizard puts the session in CLOSING with no way back; add an explicit warning and a Cancel-close action. Also explain DRAWER-01's expected jumping 1.000 -> 63.250 with no ledger line, and the inconsistency that POS session POS-20261009-7C9F8D81 is OPEN while its drawer session is CLOSING.
7. **FET-POS-S7 (P2)** Financial_Expert_Tester / FET-POS-S7: unexpected errors should return HTTP 500 and must not leak raw SQL text (`app/api/v1/pos-sessions/_response.ts` L31-32). The POS Sessions page shows an empty table with no error message when the API fails; show an error state.
8. **FET-POS-S8 (P2)** Financial_Expert_Tester / FET-POS-S8: validation is toast-only and stale toasts linger ("Enter the counted amount." beside "Session opened successfully."; "Failed to close session." after a successful double-click close). Make validation inline and clear toasts on new actions; guard against double-submit.
9. **FET-POS-S9 (P2)** Financial_Expert_Tester / FET-POS-S9: "Count now" defaults ON while guide 1.1 implies a default of off; confirm the intended default. Cash In/Out opens with the Amount prefilled "0".
10. **FET-POS-S10 (P2)** Financial_Expert_Tester / FET-POS-S10: in Arabic, the top-bar title and the browser document title on POS Settings stay English (19.7).
11. **FET-POS-S11 (P2)** Financial_Expert_Tester / FET-POS-S11: drawer detail pages take 12-15 s to load. The SQL itself runs in milliseconds; investigate the sequential Prisma/Supabase round-trips, cold starts and the connection pool.

P3
12. **FET-POS-S12 (P3)** Financial_Expert_Tester / FET-POS-S12: the Demo tenant had no TEMPORARY "Till"; add seed data. Add to "Before you start" that a Till is created under Settings -> Payments -> Cash Drawers -> Add (type Temporary). Clarify guide line 17: drawers ac312993 and 65546cc7 are in different tenants (65546cc7 = Demo SAFE-01, ac312993 = Saudi tenant DRAWER-01).
