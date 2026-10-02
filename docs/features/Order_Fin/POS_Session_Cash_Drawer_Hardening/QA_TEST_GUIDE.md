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

---

## Report back

For any ❌ that was accepted, or ✅ that failed: scenario number, the drawer/session id, a screenshot, and the browser console / dev-server log line. The ledger tab's sequence numbers are the quickest way to show what was booked.
