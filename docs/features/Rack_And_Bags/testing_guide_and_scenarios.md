# Rack & Bags Modal — Testing Guide & Scenarios

**Prerequisite:** migration `0497_org_orders_locker_hanging.sql` must be applied to the environment you're testing against first (Supabase local/remote, per your normal migration flow). None of the scenarios below will work until `org_orders_mst.locker_location`, `locker_code`, and `hanging_count` exist.

## Automated coverage already run this session

- `npx eslint . --quiet` — clean, no new warnings.
- `npm run typecheck` (`tsc --noEmit`) — clean.
- `npm run build` — green, all routes compiled.
- `npm run check:i18n` — passed, no new orphans/mismatches.
- Targeted regression sweep: `__tests__/features/workflow`, `__tests__/features/orders`, `__tests__/ui` — 70 suites / 623 tests, all passing.
- New unit tests: `__tests__/ui/cmx-count-picker.test.tsx` (6/6), `__tests__/features/workflow/rack-gate-helpers.test.ts` (4/4).

## Manual scenarios (owner-runnable)

### Scenario 1 — Ready Details: blocked release opens the modal, one click completes it

1. Go to **Ready** (sidebar → Ready) → open any order with status `ready` and **no rack assigned**: `/dashboard/ready/[id]`.
2. Confirm the "Make available for pickup" button is present and a "Rack & Bags" outline button sits below it.
3. Click **Make available for pickup**. The Rack & Bags modal should open (not a failed/blocked click).
4. Enter a Rack value (required), optionally Locker + Code, adjust Bags/Hanging via the chip pickers (try clicking "Custom" on one and typing a number > 7).
5. Click **Submit**. Expect: a "Rack & bags details saved" toast, the modal closes, and — because this was triggered by the blocked release button — the release action fires automatically in the same flow (no second click needed). Expect an "action succeeded" toast and the page to reflect the new status.

### Scenario 2 — Proactive "Rack & Bags" button (no auto-release)

1. Open a `ready` order that **already has a rack assigned** (release button enabled).
2. Click the secondary **Rack & Bags** button (not the release button).
3. Change the Bags/Hanging counts or Locker/Code, Submit.
4. Expect: fields save, a success toast appears, but the order is **not** released — the release button still requires its own separate click. This confirms the proactive button never side-effects a release.

### Scenario 3 — Cross-order conflict banner

1. Pick a customer with at least one other active order that already has a rack or locker assigned (any status other than delivered/closed/cancelled).
2. Open a *different* order for that same customer and click "Rack & Bags" (or trigger it via a blocked action).
3. Expect a yellow warning banner: "Customer has orders on rack(s): {count} B:{bags} H:{hanging}", plus the specific order number(s) listed underneath for manual verification.

### Scenario 4 — Reaches other screens via WorkflowActionBar

1. Open an order on **Processing** or **Packing** (`/dashboard/processing/[id]` or `/dashboard/packing/[id]`) whose next action is blocked *only* by a missing rack.
2. Click that action button. Expect the same Rack & Bags modal to open (proves the fix is cross-cutting, not Ready-only).
3. Submit — expect the action to retry and complete in one click, same as Scenario 1.

### Scenario 5 — Arabic / RTL

1. Switch the app language to **العربية** (top-right language switcher).
2. Repeat Scenario 1. Confirm: dialog title/labels are in Arabic, the Bags/Hanging chip rows render right-to-left, and no English text leaks through (no missing-key fallback).

### Scenario 6 — Tenant isolation (technical/dev check)

1. As a signed-in tenant user, hit `GET /api/v1/orders/<an-order-id-from-a-different-tenant>/rack-bags` directly (e.g. via browser devtools or curl with your session cookie).
2. Expect a 404 (`Order not found`), never another tenant's data.

## Known, intentional behavior (not bugs)

- The Custom count input clamps to its ceiling (100 for Bags; no DB ceiling for Hanging, but the UI still caps to a sane 9999) and reflects the clamped number back in the field.
- Hanging count can be `0` or left as `NULL` in the database — both are valid.
- If the field save succeeds but the automatic release retry fails for an unrelated reason (e.g., a different gate newly blocks it), the fields are still saved — only the release action needs a normal follow-up click.

## Financial_Expert_Tester Results

### Round 1 — 2026-11-17 (remote; all scenarios BLOCKED)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals) and HQ `https://hqsaas.cleanmatex.com` (Incognito). Run window 2026-11-17 ~04:40–09:20 Asia/Muscat (UTC+4). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes. Read-only `SELECT`s only where stated. Jest skipped.
**Accounts by role (no passwords; see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault):** Demo Laundry admin `admin@demo-laundry.example` (shows role `super_admin`); operator `operator@demo-laundry.example`; viewer `viewer@demo-laundry.example`; HQ System Administrator `admin@cleanmatex.com`. No shared password was changed.
**Deploy caveats (2026-11-17):** (1) S0 privilege-lockdown migrations 0745–0749 were applied ~04:00–05:15; during that window New Order broke (403 `fn_stng_resolve_all_settings`, 400 `/api/v1/categories`, 500 `/api/v1/lookups/service-speeds`, "Failed to fetch customers", empty sidebar) and it was working again by ~05:38. (2) From ~05:00 Processing shows the raw error `permission denied for table sys_order_sources_cd` and an empty queue (regression; blocks Ready/Delivery/prints). (3) From ~07:00 All Orders fails with `Invalid prisma.org_orders_mst.findMany() invocation: The column org_orders_mst.photo_urls does not exist in the current database`, order detail pages show "Order not found" and New Order submit returns `ORDER_SUBMIT_FAILED`, after migration `0751_file_util_drop_photo_url_columns` dropped the column while the deployed app still reads it (still failing at 08:44). Rows that needed an order after ~07:00 are BLOCKED for that reason.
**Why nothing ran:** every scenario needs an order in `ready` (or Processing/Packing with a rack-blocked action). No QA order could reach Ready today: Processing showed `permission denied for table sys_order_sources_cd` from ~05:00 (queue empty, Start Preparation refused "Current status: Processing", `/dashboard/ready/{id}` "Order not found", `/dashboard/ready` once "Unexpected token '<' … is not valid JSON"), and from ~07:00 all order pages failed with `The column org_orders_mst.photo_urls does not exist in the current database` after migration `0751_file_util_drop_photo_url_columns`. The Ready list was empty ("No orders in the Ready area"). Migration `0497` (rack fields) was not checked separately. Evidence: Q3/Q4 ledgers `/workspace/qa-20261117/backlog/obs/B2-Q3.md`, `B6-Q4.md`, `B9-Q11.md` on the tester box. Jest list above was not re-run.

**Recount (Round 1 2026-11-17, rows in the table below):** PASS 0 · FAIL 0 · PARTIAL 0 · BLOCKED 5 · NOT RUN 1.

| # | Verdict | Evidence |
|---|---|---|
| Scenario 1 — Ready Details modal + auto-release | BLOCKED | No `ready` order without a rack (Ready list empty; Processing grant error, then `photo_urls`). |
| Scenario 2 — Proactive Rack & Bags button | BLOCKED | No `ready` order with a rack. |
| Scenario 3 — Cross-order conflict banner | BLOCKED | Needs two active racked orders for one customer; none reachable. |
| Scenario 4 — WorkflowActionBar on Processing/Packing | BLOCKED | Processing queue empty with raw `permission denied for table sys_order_sources_cd`; `/dashboard/processing/{id}` "Order not found". |
| Scenario 5 — Arabic / RTL | BLOCKED | Depends on Scenario 1. |
| Scenario 6 — Cross-tenant GET rack-bags | NOT RUN | API/devtools check (UI-only scope); no other-tenant probing. |

### Tester suggestions — Financial_Expert_Tester (Round 1 2026-11-17)
- **P0 FET-RACK-Nov17-NoReadyPath:** Orders cannot reach Ready on cmx: Processing denies `sys_order_sources_cd` (S0 lockdown) and order pages fail on the dropped `photo_urls` column. Fix both, then re-run this guide with one disposable QA order moved to Ready.
- **P3 FET-RACK-Nov17-FixtureNote:** Add a short fixture recipe to the guide (how to get a `ready` order with / without a rack, and a customer with a second racked order) so the scenarios can be run without DB edits.

### Blocked
- Scenarios 1–5 (no Ready / Processing order reachable; see above). Scenario 6 is API-only.

### Test data left behind
- None from this guide. (Run-wide QA orders `ORD-20261117-00001..00006` sit at Processing; see Q3/Q4/Q7 guides.)

### Retest r1 2026-11-19 (remote; all scenarios still BLOCKED)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals), Demo Laundry admin account (shows role `super_admin`; no passwords or test contact details are recorded here — see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes; Jest skipped. Run window 2026-11-19 ~04:00–05:00 Asia/Muscat (UTC+4). This is the retest of the order-dependent rows from the 17-Nov backlog after the `photo_urls` fix. Source ledgers on the tester box: `/workspace/qa-20261119/retest/obs/A.md` (existing QA orders), `B.md` (New Order), `C.md` (Order Edit / collect), `D.md` (POS / cash drawer); screenshots `/workspace/qa-20261119/retest/shots/` (file names cited below). Original steps, earlier rounds and Dev notes above are unchanged.
**Fixed since 17-Nov:** the `photo_urls` P0 (FET-HFC-Nov17-PhotoUrlsColumnDropped) — All Orders list, order detail, `/full` and `/workspace` load again (no `photo_urls` banner, no "Order not found"), and New Order submit works for cash and Pay on Collection orders (no `ORDER_SUBMIT_FAILED`, no 422).
**Still blocked platform-wide:** `/dashboard/processing` still shows the red banner "permission denied for table sys_order_sources_cd" and "No orders in processing queue" (re-observed 2026-11-19 after the `photo_urls` fix; ledger `/workspace/qa-20261119/obs/U-pr0102.md`, shot `PR02-4-processing`). Every QA order therefore stays at Processing / preparation Pending, so Ready, Delivery, Split and rack rows cannot be reached.
**Why nothing ran:** every scenario needs an order in `ready` (or Processing/Packing with a rack-blocked action). Half of the 17-Nov blocker is fixed — the `photo_urls` break (order pages) is gone — but orders still cannot reach Ready: `/dashboard/processing` shows "permission denied for table sys_order_sources_cd" and "No orders in processing queue" (re-observed 2026-11-19), so the new QA orders `ORD-20261119-00001..00004` and `ORD-20261117-00001..00006` all stay at Processing / preparation Pending. Migration `0497` (rack fields) was not checked. Rows above are unchanged.

**Recount (this retest, 6 rows): PASS 0 / FAIL 0 / PARTIAL 0 / BLOCKED 5 / NOT RUN 1.**

| # | Verdict | Evidence |
|---|---|---|
| Scenario 1 — Ready Details modal + auto-release | BLOCKED | No `ready` order; Processing error `permission denied for table sys_order_sources_cd`. |
| Scenario 2 — Proactive Rack & Bags button | BLOCKED | No `ready` order with a rack. |
| Scenario 3 — Cross-order conflict banner | BLOCKED | Needs two racked orders for one customer; none can reach Ready. |
| Scenario 4 — WorkflowActionBar on Processing/Packing | BLOCKED | Processing queue empty with the raw error. |
| Scenario 5 — Arabic / RTL | BLOCKED | Depends on Scenario 1. |
| Scenario 6 — Cross-tenant GET rack-bags | NOT RUN | API / devtools check (UI-only scope). |

Prior findings, Retest r1 2026-11-19: **FET-RACK-Nov17-NoReadyPath (P0) PARTLY FIXED:** the order-page / `photo_urls` half is fixed; the Processing `sys_order_sources_cd` half is still open, so there is still no path to Ready. **FET-RACK-Nov17-FixtureNote** unchanged.

### Tester suggestions — Financial_Expert_Tester (Retest r1 2026-11-19)
- **P0 FET-RACK-Nov19-ProcessingGrantStillBlocksReady:** Grant SELECT on `sys_order_sources_cd` to the app role (or read it through a definer function) and show a plain error on Processing; until then Ready, Packing, Delivery, Split and rack scenarios cannot run. This is the single remaining blocker for Q3 RV-05/07, Q4 S8/S9, Q8 §8, Q11 S4/S14, Q15 and Q16 #3/#4/#10.

### Blocked
- Scenarios 1–5: no `ready` order is reachable (Processing grant error).

### Test data left behind
- None from this guide. QA orders are listed in the Q3/Q4 guides; all sit at Processing.
