# Service Speeds — QA Test Guide

For the owner, on a demo organization (for example `demo-laundry`). Apply the steps in order; each ends with what you should see. Check Arabic (RTL) on the Business Calendar at least once.

## 1. Business Calendar — organization

Sidebar: **Settings › Business Calendar** (`/dashboard/settings/calendar`).

1. On **Organization**, change one day's closing time and press Save → "Calendar saved"; reload → the time is kept.
2. Set a closing time before the opening time and Save → an error under that day, nothing saved.
3. Switch every day off and Save → "Open at least one day".
4. Press **Copy to open days** on one row → all open days take those hours; closed days stay closed.
5. Sign in as a user with `settings:read` only → the page opens, fields are read-only, no Save.

## 2. Business Calendar — branch

1. **Settings › Branches**, pick a branch, press **Branch calendar** → the calendar opens on that branch.
2. Turn off "Use the organization's opening hours", change a day, Save; reload → the branch keeps its own hours.
3. Turn the switch back on and Save → the branch shows the organization's hours again.

## 3. Holidays

Tab **Holidays**.

1. The list shows the country's public holidays; those not confirmed say "(estimated)".
2. **Add holiday** closed all day for a future date → it appears in the list.
3. Add a second holiday on the same date and branch → "This date already has a holiday for the same branch."
4. On a public holiday press **We open this day**, enter hours, Save → an Organization row appears for that date.
5. Delete a holiday → it asks first, then it is gone.

## 4. General settings

`/dashboard/settings/general` no longer edits hours. It links to Business Calendar. Save another field → the hours do not change.

## 5. Speed Pricing

Sidebar: **Catalog › Speed Pricing** (`/dashboard/catalog/speed-pricing`).

1. The page shows the "Typical speeds" card.
2. **Add rule**, speed Next Day, counted in **Working days**, value 1, Save → saved.
3. Deactivate then activate that rule → working days and cut-off are still on it when you edit it.
4. Add a rule for **Economy** with multiplier `-0.10` → the hint says "Takes 10% off"; the list shows "10% off".
5. Try `-0.10` on **Express** → refused: only a speed below Standard can cost less.

## 6. New Order

Sidebar: **New Order** (`/dashboard/orders/new`).

1. Add an item and open the **Speed** menu → only offered speeds, slowest first, each with the total and "Ready …".
2. A speed with no rule for the items in the cart is greyed out with "Not available for the items in this cart".
3. Create an order at Next Day on a Thursday (Fri–Sat weekend) → ready date skips the weekend.
4. Drop off after the cut-off → the promise starts from the next working day.
5. Order with one Standard and one Express line → the order shows Express.

## 7. Order Edit

Open an order, **Edit** → the speed menu lists offered speeds (no price previews here; Review re-prices). Change a line's speed, Review → the change shows the speed's name, including Next Day or Urgent.

## 8. Split

Split the Standard lines out of an order that also has an Express line → the sub-order shows Standard.

## 9. Express needs a rule (after 0721)

1. **Catalog › Speed Pricing** lists category Express rules created by the migration (premium 0, hours = the old category Express hours).
2. New order on a product in such a category at **Express** → same price as before, ready-by from those hours.
3. Deactivate every Express rule reaching a product → Express is greyed out for it; ordering it anyway is refused ("not available").

## 10. HQ — Calendars (Products & Items Config)

HQ (`cleanmatexsaas`) › **Products & Items Config** › **Calendars**.

1. **Calendar templates**: open `OM`, change a day's hours, Save → kept on reload. A closing time before opening → refused.
2. **Public holidays**: filter OM, open an estimated row, turn off **Estimated**, Save → the tenant app's holiday list no longer says "(estimated)" for that date.
3. Add a holiday with a date already used for that country and code → refused as duplicate.

## 11. HQ — new organization and workspace Calendar

1. HQ › Tenants › create an organization in Saudi Arabia → in the tenant app, **Business Calendar** shows the SA template hours, cut-off and ready time.
2. HQ › Tenants › open that organization › **Calendar** → the same hours, branch rows say "Organization's", holidays per year with **Previous year / Next year**.
3. Switch HQ to Arabic → labels in Arabic, times and dates left-to-right.

## 12. Customer app — speed choice

1. Organization offers Standard and Express → booking step **Schedule** shows "How fast do you need it?" with both; Standard selected by default.
2. Choose Express, finish booking → the order in the tenant app shows Express and the Express price.
3. Organization offers only Standard → the speed section is hidden.
4. Remove the Express rule while the app is open, then submit with Express → "This speed is not available for one of your items. Choose another speed."
## 13. Review fixes (2026-11-13)

Run after 0739 is applied. English first, then repeat the starred ones in Arabic.

1. **Holiday 24:00** — Holidays › Add › "We open this day", 10:00 and close 23:59 saves. 24:00 cannot be typed. API check: `POST /api/v1/settings/holidays` with `closeTime: "24:00"` answers 400, not 500.
2. **Impossible date** — API `holidayDate: "2027-02-30"` answers 400; nothing is saved on 2 March.
3. **Unsaved changes** — Organization tab: change a time, open Holidays, come back: the change is still there. Branches tab: change a time, pick another branch: a "Discard your changes?" dialog appears; Cancel keeps both the branch and the edit.*
4. **Warnings** — set cut-off 07:00 with opening 08:00: "cut-off is at or before opening"; cut-off 20:00 with closing 20:00: "never applies"; ready time 22:00: "outside the opening hours". Saving is still allowed.*
5. **Overridden holiday** — add "We open this day" for a public holiday: the public row now says "Overridden by your own day" and has no button.*
6. **No public data** — Year 2028 shows "No public holiday dates are loaded for OM in 2028".
7. **Branches without `branches:read`** — a role with `settings:read` only sees no Branches tab.
8. **Branch with a demo id** (`22222222-…`) — opens its calendar (it answered 400 before).
9. **Speed menu** — New Order: the top-bar Speed menu shows total and "Ready Tue, Nov 17, 3:00 PM" per speed, like the summary menu; a speed that only some items have shows "Some items only".*
10. **Speed Pricing** — bulk fixed price 8 over a category with a product priced 10: the message names how many products were left out. Open a rule that priced an order, change its speed: "Orders were priced with this rule…". A rule with 61 working days or 501 hours is refused.
11. **Setup Health** — Demo Laundry LLC passes `SPEED_NO_EXPRESS`; the three organizations with Express only for some products fail it ("Express is not offered for every item"), fix link opens Speed Pricing. HQ: an organization whose country has no holidays 90 days ahead fails `CAL_HOLIDAYS_MISSING`.
12. **HQ** — template editor has no weekend field, the list shows `weekend_days` after save; a duplicate public-holiday date shows the error on the Date field; the tenant Calendar year buttons stop at 2000 and 2100; a stored `24:00` closing shows as text.
13. **Customer app** — book with a scheduled pickup: the confirmation shows "Expected ready: <date and time in your language>", not the pickup slot. Customers of an organization with Express only for some items are not offered Express. If a speed is refused at submit, the app returns to the speed step.*

## 14. Preview, template, concurrent saves, HQ confirm (2026-11-14)

1. **Preview card** — Business Calendar › Organization: the card "If an order is placed now" lists Standard (example 24 h item) and each speed that has an organization-wide rule, with a date and time in the organization's zone, and "Open now" / "Closed now". Change the cut-off and Save: the card refreshes. Branches tab: pick a branch, the card shows that branch's times.*
2. **No hours** — an organization with no hours shows "Set the opening hours…" instead of times.
3. **Template** — Organization tab: "Fill from the Oman template" fills hours, cut-off and ready time; nothing is saved until Save; leaving the tab keeps the filled values.*
4. **Two people** — open the Organization tab in two browsers; save a change in the first, then save a different change in the second: the second shows "Someone else changed this calendar…" and the form now holds the first person's values.*
5. **Speed Pricing hint** — add or edit a rule: under "Cut-off time for this speed" the help text ends with "Organization cut-off: 11:00." A user without `settings:read` sees no hint and no error.
6. **HQ confirm** — Products & Items Config › Public holidays, filter a country: choose a year and "Mark OM dates confirmed", confirm: the message gives the count; the estimated badges for that country and year disappear; the audit log has one entry. A second run says "Nothing to confirm".

## Financial_Expert_Tester Results

Round 1 observe: 2026-11-13 00:09–00:19 Asia/Muscat, Demo Laundry admin on [cmx.cleanmatex.com](https://cmx.cleanmatex.com) and HQ SAAS Admin on [hqsaas.cleanmatex.com](https://hqsaas.cleanmatex.com). Remote only. No writes (no calendar/holiday/rule Save, no order created; a New Order cart item was added then removed). Retest r1 02:10–02:17 after a deploy (nothing fixed). Retest r2 04:55–05:05 after a later deploy (HQ Calendar and sidebar fixed; Speed menu partly fixed). Tax became Active as part of that owner deploy (FET did not Confirm). Customer-app URL still unknown (§12 BLOCKED). Mutate and high-impact steps were not approved and were not run while the owner was away.

Recount (observe + retests; parent guide step counts unchanged): **PASS 6 · FAIL 1 · PARTIAL 4 · BLOCKED 3 · NOT RUN (mutate / high-impact / missing URL) remaining.** See the table. After r2, §6 is PARTIAL (was FAIL) and §11.2 is PASS (was FAIL).

| # | Result | Evidence |
|---|---|---|
| §1 Organization calendar (observe) | PASS | 00:09–00:13. `/dashboard/settings/calendar`. TZ Asia/Muscat. Sunday Closed; Mon–Fri 08:00 AM–06:00 PM, each with "Copy to open days"; Saturday 09:00 AM–02:00 PM. Cut-off 11:00 AM ("Orders received after this time count from the next working day. Empty = no cut-off."). Ready 06:00 PM ("When orders promised in working days are ready. Empty = closing time."). Save present, not used. Arabic: RTL (تقويم العمل, المنشأة / الفروع / الإجازات, ساعات العمل, يفتح / يغلق, مغلق); times still "08:00 AM" LTR. Leftover EN: header "Business Calendar", sidebar Dashboard / Orders / Catalog & Pricing / B2B. Tax banner was present at this time (tax not touched). |
| §1.1–1.4 | NOT RUN | Mutate (change hours, closing before opening, all days off, Copy to open days). Not approved. |
| §1.5 viewer `settings:read` | NOT RUN | Observe leftover; not completed in this round. |
| §2 Branch calendar (observe) | PARTIAL | **Main Branch Name** (`22222222-2222-2222-2222-222222222222`): "Could not load the calendar. Refresh the page to try again." Console HTTP 400 on `GET /api/v1/settings/branches/22222222-2222-2222-2222-222222222222/calendar`. **Retest r1 02:13–02:17 STILL BROKEN** (same text, 2× HTTP 400). **Retest r2 05:02 STILL BROKEN** (same text; console had no errors on that pass). **Main Branch 2** (`597139c9-633c-43f5-b25f-9012a70893b4`): still PASS all three rounds — "Use the organization's opening hours / cut-off / ready time" all ON, hours match org, fields greyed. Cut-off/ready still shown as 24-hour "11:00" / "18:00" next to 12-hour fields (FET-SS-Nov13-BranchTimeFormatMix). a11y: hours box accessible name "Opens" repeated six times. Save present, not used. §2.2–2.3 mutate NOT RUN. |
| §3.1 Holidays list | PASS | 2026, 12 holidays, 5 per page. Every row: "Public holiday (estimated)", "Closed all day", "All branches", "We open this day". No organization overrides. Jan 16 Isra and Mi'raj; Mar 20–22 Eid al-Fitr; May 26 Arafat Day; May 27–29 Eid al-Adha; Jun 16 Islamic New Year; Aug 26 Prophet's Birthday; Nov 20–21 National Day. §3.2–3.5 mutate NOT RUN (add/open/delete; confirming estimated dates is high-impact). |
| §4 General settings | PASS | Hours no longer edited here. "Opening hours are now set on the Business Calendar page, with cut-off time, ready time and holidays." "Open Business Calendar" → `/dashboard/settings/calendar`. Nothing saved. |
| §5.1 Speed Pricing display | PASS | "Typical speeds (a starting point)" card: Economy 4–7 working days −10 to −20%; Standard 2–3 working days Base; Next day Next working day +20 to +30%; Express same day before cut-off +50%; Urgent 2–4 working hours +100%. 52 rules. **Active (4):** Economy All products "10% off" from 2026-11-07; Express All products "+25%" from 2026-11-05; Next day All products "+25%" from 2026-11-07; Urgent All products "+100%" from 2026-11-07. **Inactive (48):** Express product rules, "Sell price X OMR" from 2026-10-24 (e.g. Winter Coat 67.500). One product name Arabic in EN UI: "ملابس سباحة (قطعة واحدة)". OMR 3 decimals. No cut-off/hours column. "Which rule applies?" defaulted to 11/12/2026 while local date was already 13 Nov (possible UTC date). §5.2–5.5 mutate NOT RUN. |
| §6 New Order Speed menu | FAIL, then **PARTIAL** | 00:13 FAIL: Main Branch 2, 1 Blouse 2.200 OMR; both Speed menus listed Economy, Standard (✓), Next day, Express, Urgent, slowest first — no totals, no "Ready …", nothing greyed "Not available for the items in this cart." Item removed; no order. **Retest r1 02:17 STILL BROKEN**, Ready By empty. **Retest r2 05:03 PARTIAL:** right-panel menu now "Economy — OMR 1.980 · Ready Thu 6:00 PM" and "Standard ✓ — OMR 2.200 · Ready Tue 3:00 PM"; Next day, Express, Urgent still have no price or time and are not greyed. Toolbar Speed menu still names only, no prices/times. Ready By still empty. Cart (tax now Active from owner deploy) "Subtotal 2.200 OMR / Tax (included) 0.144 OMR" (7% inclusive: 2.200 × 0.07 / 1.07). Standard "Tue 3:00 PM" does not match org ready 18:00 (Economy correctly 6:00 PM). Item removed; no order. §6.3–6.5 create-order NOT RUN. |
| §7 Order Edit | BLOCKED | All three looks: `/dashboard/orders` Total Orders 0, "No orders found", "Create your first order". Creating an order was not approved. Last checked 05:05. |
| §8 Split | NOT RUN | Needs an order (mutate). |
| §9.1 Category Express rules (0721) | PARTIAL | No category-scoped Express rules (premium 0). Express is product-scoped or the All-products +25% rule. STATUS documents that 0721 skips organizations that already have an active all-products EXPRESS rule — this org has Express All products +25% from 2026-11-05. Data/adaptation, not a missing migration. §9.2–9.3 (order / deactivate every Express) NOT RUN — latter is high-impact. |
| §10.1 OM calendar template (observe) | PASS | 00:14–00:19. `/en/products-items-config/calendar-templates`. 16 country calendars, all active. OM: "Oman calendar" / "تقويم عُمان", weekend "fri,sat", cut-off 11:00:00, ready 18:00:00, Active. Detail `/en/products-items-config/calendar-templates/OM` (~3s skeleton). Hours: Sun–Thu 08:00 AM–08:00 PM; Fri Closed; Sat Closed. Cut-off 11:00 AM, Ready 06:00 PM. Save Changes greyed out; no fields touched. Tenant Demo Laundry hours are customized from this template. Searching "OM" also returns United Kingdom. Mutate (change hours / invalid close) NOT RUN. |
| §10.2 OM public holidays (observe) | PASS (data concern) | `/en/products-items-config/public-holidays` filtered Oman: 24 rows, all Estimated = Yes, all Active. 2026 National Day 11-20 and 11-21 still Estimated (a week before the date at the first observe). Islamic holidays estimated as expected. View filters only; Estimated not cleared (high-impact). §10.3 add-duplicate NOT RUN. |
| §11.1 Create Saudi org | NOT RUN | High-impact. |
| §11.2 HQ Demo Laundry Calendar | FAIL, then **PASS** | 00:16–00:19 FAIL: `/en/tenants/11111111-1111-1111-1111-111111111111/calendar` header only, empty body, Reload spinning/disabled, no error. Breadcrumb raw UUID. Sidebar Calendar → `/en/tenants/undefined/calendar`. **Retest r1 02:13 STILL BROKEN.** **Retest r2 04:58 FIXED:** page loaded, Reload enabled. Hours match tenant: started from calendar OM, Asia/Muscat, cut-off 11:00, ready 18:00; Sun Closed; Mon–Fri 08:00 AM–06:00 PM; Sat 09:00 AM–02:00 PM. Both "Main Branch 2" and "Main Branch Name" "Uses the organization's opening hours" (TZ, cut-off, ready all "Organization's"). Holidays 2026: org none; 12 OM public, all Estimated, through National Day 20–21 Nov. Nothing saved. |
| §11.3 HQ Arabic Calendar | PARTIAL | 00:19: `/ar/tenants/1111…/calendar` RTL; تقويم العمل, إعادة التحميل; leftover EN Ctrl+K and tab title. Times/dates LTR untestable because the body was still empty. UUID digit groups reversed in the breadcrumb. Switched back to English. Not re-run after r2 (page now loads). |
| §12 Customer app | BLOCKED | Customer-app URL not provided. Asked once. |

**Test data left behind:** none from FET. Cart emptied. Tax confirmation on Demo Laundry was part of the owner's 13 Nov deploy, not FET. Language left English.

### Financial_Expert_Tester suggestions

- **P1 FET-SS-Nov13-BranchCalendar400:** Main Branch Name (`22222222-…`) `GET /api/v1/settings/branches/…/calendar` returns 400 and the UI says "Could not load the calendar. Refresh the page to try again." Still broken on Retest r2 05:02. Return a plain-language reason (and fix the 400). HQ later showed this branch as using organization hours, so the HQ view and the tenant API disagree on loadability.
- **P1 FET-SS-Nov13-SpeedMenuNoPreview:** New Order Speed menu should show a total and "Ready …" for every offered speed, and grey out speeds that are not available. After Retest r2 05:03 the right-hand menu does this only for Economy and Standard; Next day, Express and Urgent still have no preview and are not greyed (those speeds have active all-products rules). The toolbar Speed menu is still names only. Ready By stays empty.
- **P2 FET-SS-Nov13-StandardReadyNotClosing (new r2):** Standard showed "Ready Tue 3:00 PM" while the organization's ready time is 18:00 (Economy correctly "Thu 6:00 PM").
- **P0 FET-SS-Nov13-HqWorkspaceCalendarEmpty:** HQ tenant Calendar stayed empty with Reload disabled (silent failure). **Retest r2 04:58 FIXED** (not reproduced). Keep the finding for history.
- **P0 FET-SS-Nov13-HqSidebarUndefined:** Sidebar Calendar (and Tax kit / Setup Health in the same family) went to `/en/tenants/undefined/…`. **Retest r2 FIXED** (real UUID URLs).
- **P2 FET-SS-Nov13-HqBreadcrumbRawUuid:** Breadcrumb still "11111111 1111 1111 1111 111111111111" (spaces, not "Demo Laundry LLC") on Retest r2. In Arabic (r1) the digit groups appeared reversed. Still broken.
- **P2 FET-SS-Nov13-HqOrgCountsZeroActive:** Dashboard "TOTAL ORGANIZATIONS 4 / 0 active · 0 trial" while the list shows Demo Laundry LLC as ENTERPRISE Active and three orgs as Trial. Also "MRR OMR 0 / 1 paying organizations." Still broken at 04:56.
- **P2 FET-SS-Nov13-NationalDayStillEstimated:** OM National Day 20–21 Nov 2026 still Estimated as of 00:19. Confirming is high-impact — not done.
- **P3 FET-SS-Nov13-BranchTimeFormatMix:** Branch calendar inherited cut-off/ready shown as "11:00" / "18:00" (24-hour) next to 12-hour hour fields. Still broken r2.
- **P3 FET-SS-Nov13-OpensAriaRepeat:** Hours box accessible name is "Opens" repeated six times.
- **P3 FET-SS-Nov13-RuleAppliesDateUtc:** "Which rule applies?" defaulted to 11/12/2026 on 13 Nov local.
- **P3 FET-SS-Nov13-ArabicProductInEnList:** "ملابس سباحة (قطعة واحدة)" in the English Speed Pricing list.
- **P3 FET-SS-Nov13-0721SkippedDemo:** No category Express rules on this org; consistent with 0721 skipping orgs that have an active all-products EXPRESS rule.
- **P3 FET-SS-Nov13-OmSearchMatchesGB:** HQ template search "OM" also returns United Kingdom.

### Financial_Expert_Tester Results — Retest r3 2026-11-17 (remote; approved mutate-and-restore on Demo settings)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals) and HQ `https://hqsaas.cleanmatex.com` (Incognito). Run window 2026-11-17 ~04:40–09:20 Asia/Muscat (UTC+4). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes. Read-only `SELECT`s only where stated. Jest skipped.
**Accounts by role (no passwords; see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault):** Demo Laundry admin `admin@demo-laundry.example` (shows role `super_admin`); operator `operator@demo-laundry.example`; viewer `viewer@demo-laundry.example`; HQ System Administrator `admin@cleanmatex.com`. No shared password was changed.
**Deploy caveats (2026-11-17):** (1) S0 privilege-lockdown migrations 0745–0749 were applied ~04:00–05:15; during that window New Order broke (403 `fn_stng_resolve_all_settings`, 400 `/api/v1/categories`, 500 `/api/v1/lookups/service-speeds`, "Failed to fetch customers", empty sidebar) and it was working again by ~05:38. (2) From ~05:00 Processing shows the raw error `permission denied for table sys_order_sources_cd` and an empty queue (regression; blocks Ready/Delivery/prints). (3) From ~07:00 All Orders fails with `Invalid prisma.org_orders_mst.findMany() invocation: The column org_orders_mst.photo_urls does not exist in the current database`, order detail pages show "Order not found" and New Order submit returns `ORDER_SUBMIT_FAILED`, after migration `0751_file_util_drop_photo_url_columns` dropped the column while the deployed app still reads it (still failing at 08:44). Rows that needed an order after ~07:00 are BLOCKED for that reason.
**Approved writes used:** calendar hours/holiday/speed-rule changes on Demo, each restored or left inactive (ledger below). Not done (not approved): confirming official holidays, deactivating every Express rule, HQ Estimated edits, a new Saudi org. Source ledgers on the tester box: `/workspace/qa-20261117/backlog/obs/B1.md` Part B (observe, 03:41–03:52) and `B11-settings.md` (writes, 08:45–09:04); Speed rule add/deactivate also in `B6-Q4.md`. §13, §14 and F9 are covered for the first time. Rows above are unchanged.

**Recount (Retest r3 2026-11-17, rows in the table below):** PASS 20 · FAIL 1 · PARTIAL 2 · BLOCKED 3 · NOT RUN 8.

| # | Verdict | Evidence |
|---|---|---|
| §1.1 Save hours | PASS | 08:46–08:47 Monday close 18:00→17:00 saved, reload 17:00; restored 18:00 and saved. |
| §1.2 Close before open | PASS | 08:47 Monday 08:00–07:00 → "Enter both times; closing must be after opening."; nothing saved. |
| §1.3 All days off | PASS | 09:04 all days off + Save → "Open at least one day."; nothing saved; pattern restored. |
| §1.4 Copy to open days | PASS | 08:47 Monday 09:00–17:00 → Copy to open days → Mon–Sat 09:00–17:00, Sunday closed; original restored, saved, reload verified. |
| §1.5 Viewer read-only | FAIL | 08:56–08:57 viewer (Incognito) Business Calendar: page header only, main area blank after retry/reload — no tabs, fields or Save to check. |
| §2 Main Branch Name load | PASS (FIXED) | 03:45 `/dashboard/settings/calendar?tab=branches&branch=22222222-…`: renders after ~5s (no 400); inherits org hours, cut-off 11:00, ready 18:00. |
| §2.2–2.3 Own hours | PASS | 08:48–08:50 org-hours off, Monday close 17:00 saved/reloaded; org hours back on and saved; branch ends on inherited values. |
| §3.2–3.3, §3.5 Holidays | PASS | 08:50–08:52 added QA-20261117 on 2026-12-03 (all branches, closed all day); duplicate same date → "This date already has a holiday for the same branch."; delete confirmed, "Holiday deleted". |
| §3.4 Override official holiday | NOT RUN | Not approved (no public-holiday override/confirm). |
| §5.1 Speed Pricing display | PASS | Typical speeds card; "Showing 1 - 10 of 52/53"; OMR 3 decimals; QA Express +25% (2026-11-17) found under Inactive. |
| §5.2–5.3 Add / deactivate rule | PASS | 08:52–08:55 QA Next day / all products / +20%, 1 working day, cut-off 10:00: deactivated, reactivated, edited (WORKING_DAYS, 1, 10:00); left Inactive. (Also Express +25% add/duplicate/validation/deactivate PASS at ~06:15 — Q4 S18.) |
| §5.4 Economy discount | PASS | QA Economy −0.10 → "Takes 10% off the normal price", list "10% off"; left Inactive. |
| §5.5 Faster speed cannot discount | PASS | Express −0.10 → "Only a speed slower than Standard (Economy) can lower the price. Use a value of 0 or more for this speed."; not saved. |
| §6 / F9 Speed menu preview | PASS (FIXED, settled) | 03:43–03:49 New Order, Main Branch 2, Blouse 2.200: both menus list all five with price + Ready — Economy OMR 2.119 · Wed Nov 25 6:00 PM; Standard 2.354 · Fri Nov 27 10:00 AM; Next day 2.943 · Wed Nov 18 6:00 PM; Express 2.943 · Tue Nov 17 2:00 PM; Urgent 4.708 · Tue Nov 17 11:00 AM. Top-bar menu shows names only on first open until the summary menu loads quotes. Not submitted. |
| §6.3–6.5, §7, §8 | BLOCKED | Order create/edit/split: after ~07:00 submit returns `ORDER_SUBMIT_FAILED` and order pages fail (`photo_urls`). |
| §9.3, §10.2, §11.1, §14.6 | NOT RUN | Not approved (deactivate all Express; HQ Estimated / confirm; new Saudi org; HQ confirm). |
| §13.1 Holiday 24:00 | NOT RUN | Not exercised. |
| §13.2 Impossible date | NOT RUN | API POST check (UI only). |
| §13.3 Unsaved changes | PASS | 08:55–08:57 unsaved Monday 17:00 kept across Holidays→Organization tabs; branch switch → "Discard your changes?"; Cancel kept the edit, Confirm discarded. |
| §13.4 Calendar warnings | PASS (unsaved) | 08:57 cut-off 07:00 → "The cut-off is at or before opening…"; cut-off 20:00 / ready 22:00 → cut-off never applies / ready outside hours; restored, no Save. |
| §13.5 Overridden holiday | NOT RUN | Needs an org override of a public holiday (not approved). |
| §13.6 No public data | PASS | 03:47 2028: "No public holiday dates are loaded for OM in 2028. Ask the platform team to add them; until then ready times ignore public holidays." |
| §13.7 `branches:read` role | BLOCKED | No such test user. |
| §13.8 Branch 400 | PASS (FIXED) | See §2. |
| §13.9 Speed quotes / partial coverage / Arabic | PARTIAL | Quotes PASS (see §6). Mixed draft (Bathrobe, Pants, Business Shirt) showed no "Some items only" label — case not reproduced. Arabic 03:51: speeds "اقتصادي / عادي / اليوم التالي / مستعجل / طارئ", OMR 3 decimals, localized ready times; "New Order", order type/source, payment modal heading, product names English. |
| §13.10 Rule validation | PARTIAL | Number validation and duplicate refusal PASS (Q4 S18); bulk fixed-price, repricing warning, 61-day/501-hour limits NOT RUN. |
| §13.11 Setup Health speed check | PASS | "Other speeds are offered" OK; "Express is offered for every item" OK. |
| §13.12 HQ items | NOT RUN | HQ not exercised for §13.12. |
| §13.13 Customer app | BLOCKED | No customer-app URL. |
| §14.1 Preview card | PASS | 03:45 "If an order is placed now": Closed now, counting from Tue Nov 17 8:00 AM, five speeds with Ready times; 08:57 Open now with updated times. |
| §14.2 No-hours state | NOT RUN | Demo has hours; no other org in scope. |
| §14.3 Oman template fill | PASS (discarded) | 08:58 Sun–Thu 08:00–20:00, Fri/Sat closed, 11:00/18:00; kept across tabs; never saved; original reloaded. |
| §14.4 Concurrent saves | NOT RUN | Needs two saved writes; discard-only scope. |
| §14.5 Cut-off hint | PASS | Speed-rule editor: "Optional. Orders received later count from the next working day. Empty = the branch's cut-off. Organization cut-off: 11:00." |

Prior findings, Retest r3 2026-11-17: **FET-SS-Nov13-BranchCalendar400 FIXED** (Main Branch Name loads; own-hours save works). **FET-SS-Nov13-SpeedMenuNoPreview FIXED** in settled state (all five priced with Ready; first-open names-only caveat). **FET-SS-Nov13-StandardReadyNotClosing — changed:** Standard now "Fri Nov 27 10:00 AM" in New Order (see new finding). **FET-SS-Nov13-BranchTimeFormatMix STILL BROKEN** (12-hour hours vs 24-hour "11:00 / 18:00").

### Financial_Expert_Tester suggestions — Retest r3 2026-11-17
- **P1 FET-SS-Nov17-ViewerCalendarBlank:** Viewer Business Calendar body is blank (no read-only view, no message). Same family as Tax Setup viewer blank.
- **P2 FET-SS-Nov17-StandardSlowerThanEconomy:** New Order quotes Standard "Ready Fri, Nov 27, 10:00 AM" — later than Economy "Wed, Nov 25, 6:00 PM" — while the calendar preview says Standard (24 working hours) "Thu, Nov 19, 12:00 PM". New Order and preview disagree, and Standard should not be slower than Economy.
- **P3 FET-SS-Nov17-TopbarSpeedMenuEmptyFirstOpen:** Top-bar Speed menu shows names only until the summary menu loads quotes.
- **P3 FET-SS-Nov17-ArabicNewOrderLeftovers:** In Arabic, "New Order", order type/source labels, payment-modal heading and product names stay English.

### Blocked
- §6.3–6.5, §7, §8 (orders broken from ~07:00); §13.7 (no `branches:read` user); §13.13 (customer app).

### Test data left behind
- Org calendar restored and reloaded: Sun closed; Mon–Fri 08:00–18:00; Sat 09:00–14:00; cut-off 11:00; ready 18:00. Main Branch Name back on organization hours. Holiday QA-20261117 deleted.
- Speed rules left **inactive**: QA-20261117 Express +25% (from 2026-11-17), QA Next day +20% (1 working day, cut-off 10:00), QA Economy −0.10. Express −0.10 never saved.

### Financial_Expert_Tester Results — Retest r4 2026-11-19 (remote; New Order and Edit on QA orders)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals), Demo Laundry admin account (shows role `super_admin`; no passwords or test contact details are recorded here — see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes; Jest skipped. Run window 2026-11-19 ~04:00–05:00 Asia/Muscat (UTC+4). This is the retest of the order-dependent rows from the 17-Nov backlog after the `photo_urls` fix. Source ledgers on the tester box: `/workspace/qa-20261119/retest/obs/A.md` (existing QA orders), `B.md` (New Order), `C.md` (Order Edit / collect), `D.md` (POS / cash drawer); screenshots `/workspace/qa-20261119/retest/shots/` (file names cited below). Original steps, earlier rounds and Dev notes above are unchanged.
**Fixed since 17-Nov:** the `photo_urls` P0 (FET-HFC-Nov17-PhotoUrlsColumnDropped) — All Orders list, order detail, `/full` and `/workspace` load again (no `photo_urls` banner, no "Order not found"), and New Order submit works for cash and Pay on Collection orders (no `ORDER_SUBMIT_FAILED`, no 422).
**Still blocked platform-wide:** `/dashboard/processing` still shows the red banner "permission denied for table sys_order_sources_cd" and "No orders in processing queue" (re-observed 2026-11-19 after the `photo_urls` fix; ledger `/workspace/qa-20261119/obs/U-pr0102.md`, shot `PR02-4-processing`). Every QA order therefore stays at Processing / preparation Pending, so Ready, Delivery, Split and rack rows cannot be reached.
**Writes used (approved 2026-11-19):** new QA orders `ORD-20261119-00001` and `-00002` (cash) and `-00003` / `-00004` (Pay on Collection), edit on `-00003`. **Not run:** §6.4 (needs an order after the 11:00 cut-off; it was ~04:00–05:00 Muscat), §9.3 (deactivate every Express rule — needs a separate owner OK). Today is Thursday 2026-11-19. Source ledger on the tester box: `/workspace/qa-20261119/retest/obs/B.md` and `C.md`. Rows above are unchanged.

**Recount (this retest, 7 rows): PASS 0 / FAIL 2 / PARTIAL 1 / BLOCKED 2 / NOT RUN 2.**

| # | Verdict | Evidence |
|---|---|---|
| §6.3 Next day skips the weekend | FAIL | Ordered on Thursday Nov 19: speed menu "Next day OMR 2.943 · Ready Mon Nov 23 6:00 PM" (Blouse 2.200, also for the Pants line "Next day 1.338 Ready Mon Nov 23 6:00 PM"). Demo calendar: Sunday closed, Saturday 09:00–14:00, Mon–Fri 08:00–18:00, so Friday Nov 20 is a working day and the expected result is Friday (or at latest Saturday), not Monday. Shots `B-O3-speed-dropdown-dates`, `B-O3-line-speed-dropdown`. |
| §6.4 After cut-off | NOT RUN | Needs an order placed after 11:00 Muscat; not run in the 04:00–05:00 window. |
| §6.5 Standard + Express lines → order shows Express | FAIL | `ORD-20261119-00002`: Pants set to Express (line price 1.250, "incl. Express +0.250 OMR"), Blouse left on "Order speed (Standard)": the order-level Speed select still shows "Standard" (an "Apply to all lines" button appeared); the created order has no speed/priority field anywhere (Order Master Data: none; Financial Summary shows "Express premium (included) 0.250 OMR"). Total 3.692 (Subtotal 3.450 + tax 0.242). Shots `B-O3-lines-std-express`, `B-O3-detail`. |
| §7 Edit: speed menu / change a line's speed | BLOCKED | Edit page on `-00003`: "Service speed for Blouse/Pants/Curtain" combobox disabled, tooltip "The service speed cannot be changed on this order."; inline "Change service speed: needs an override before it can be saved." |
| §8 Split keeps lines' speed | BLOCKED | Split is reached only via Processing, which still fails with `permission denied for table sys_order_sources_cd`. |
| §9.2 Express price / ready-by | PARTIAL | Express on one Blouse (2.200): card and cart 2.750 ("incl. Express +0.550 OMR"), tax 0.193, total 2.943 — same price as 17-Nov (Express +25%); menu "Express OMR 2.943 · Ready Thu Nov 19 2:00 PM". No Express-only order was submitted (the Express POC order with a custom item failed with "Some products have invalid IDs…"); the failed attempt used Ready By 2:00 PM (the Express quote), while the mixed Standard + Express order `-00002` was submitted with the picker default 5:00 PM. Shot `B-O1-express-cards`. |
| §9.3 Deactivate every Express rule | NOT RUN | High-impact (org-wide rule change); needs a separate owner OK. |

Other observations this run (New Order, Main Branch 2): speed menu for one Blouse — Economy 2.119 Ready Fri Nov 27 6:00 PM; **Standard 2.354 Ready Mon Nov 30 3:00 PM**; Next day 2.943 Ready Mon Nov 23 6:00 PM; Express 2.943 Ready Thu Nov 19 2:00 PM; Urgent 4.708 Ready Thu Nov 19 11:00 AM. Per-line menu for Pants: Standard 1.070 Ready **Thu Nov 26 4:00 PM**. The order-level Ready By picker enables Sundays (22, 29) and defaults to 5:00 PM today. Adding a custom line in Edit moved Ready By from Nov 19 5:00 PM to Nov 30 3:00 PM (Q4 FET-LLMS-Nov19-ReadyByJumpsOnEdit).

Prior findings, Retest r4 2026-11-19: **FET-SS-Nov17-StandardSlowerThanEconomy STILL BROKEN** (Standard Mon Nov 30 is later than Economy Fri Nov 27; the Pants line says Standard Thu Nov 26, so the order menu and the line menu disagree). **FET-SS-Nov17-TopbarSpeedMenuEmptyFirstOpen** not rechecked. **FET-SS-Nov13-BranchTimeFormatMix** not rechecked.

### Financial_Expert_Tester suggestions — Retest r4 2026-11-19
- **P1 FET-SS-Nov19-NextDaySkipsFriSat:** "Next day" ordered on Thursday is promised for Monday (skips open Friday and Saturday) — both in the order speed menu and the line menu. Check the Next-day rule's "working days" count and the calendar the quote uses (Saturday 09–14 open, only Sunday closed); the 17-Nov Tue-ordered quote was Wed, so the Thursday case suggests a Fri/Sat weekend assumption.
- **P1 FET-SS-Nov19-MixedLinesOrderSpeedStandard:** An order with a Standard line and an Express line keeps order-level speed "Standard" and the saved order carries no speed/priority at all, so the shop cannot see it contains an Express line. Derive the order priority from the fastest line (guide §6.5) and show it on the order header and list.
- **P2 FET-SS-Nov19-StandardQuoteInconsistent:** Standard is quoted Mon Nov 30 3:00 PM for the order (later than Economy Fri Nov 27) and Thu Nov 26 4:00 PM for one line; the two menus must come from the same quote, and Standard should not be slower than Economy (carry-over of FET-SS-Nov17-StandardSlowerThanEconomy).
- **P2 FET-SS-Nov19-ReadyByNotFromSpeed:** Ready By defaults to 5:00 PM today whatever speed is chosen, and the picker enables closed days (Sundays 22 and 29). Pre-fill it from the speed quote and grey out closed days; the Express quote was Thu 2:00 PM but the mixed order `-00002` was submitted with 5:00 PM.
- **P3 FET-SS-Nov19-NextDayPriceEqualsExpress:** Next day and Express show the same price (Blouse 2.750 / total 2.943); card text flickers between "Next day price is shown in the cart" and "Next day price". Confirm the rule values (both +25%?) or fix the quote.

### Blocked
- §7 and §8: line speed is locked on the edit page ("cannot be changed on this order") and Split needs Processing (`sys_order_sources_cd`).

### Test data left behind
- `ORD-20261119-00002` (3.692 cash, Standard + Express lines) is the order for §6.3/§6.5; `ORD-20261119-00001`, `-00003`, `-00004` are described in the Q3/Q4 guides. No speed rules, calendar hours or holidays were changed; the three QA speed rules from 17-Nov remain **inactive**.

## Financial_Expert_Tester Results — Retest r5 2026-11-20 (post-deploy observe pass)

**Retest r5 (2026-11-20 21:55–22:31 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: owner t160u — new evening deploy; redo all QA files, not only UIDS and File_Util. This round is an **observe-only** post-deploy pass: owner approval for writes is still pending, so write-gated rows are **NOT RUN (awaiting approval)**. Nothing was saved, applied, paid, published, assigned, or confirmed. Appearance and language were restored. Earlier rounds above are untouched.

Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch) and HQ https://hqsaas.cleanmatex.com (Incognito). Accounts used: Demo Laundry admin `admin@demo-laundry.example`, operator `operator@demo-laundry.example` (`U000001`), viewer `viewer@demo-laundry.example`; HQ SAAS Admin `admin@cleanmatex.com`. Credentials: see `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` — none recorded here. Real mouse and keyboard; no direct API calls; no page scripts that change data; no Jest. Hard-reload (Ctrl+Shift+R) after the deploy. Screenshots: `C:\Users\JHNLP\qa-20261120\r5\shots\`.

Service Speeds (Q8) rows below were run on cmx Demo admin, 22:27–22:30 Asia/Muscat. A new-order cart was opened for §6.3 and emptied; no order was created. Parent scenario counts are unchanged.

| # | Result | Evidence |
|---|---|---|
| §2 | PASS (FIXED) | 22:27 Asia/Muscat. Admin `https://cmx.cleanmatex.com/dashboard/settings/calendar?tab=branches&branch=22222222-2222-2222-2222-222222222222` shows "Business Calendar", Sun "Closed", Mon–Fri 08:00–06:00, cut-off 11:00, ready 18:00, preview "Closed now / Counting starts: Mon, Nov 23, 8:00 AM". The prior branch-calendar load failure is **not reproduced** (FET-SS-Nov13-BranchCalendar400 **FIXED**). Note: weekday hours display "08:00–06:00" (closing appears before opening; "06:00" is likely 18:00 — see new finding). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b5-Q8-2.png`. |
| §6.3 | PASS (FIXED) with notes | 22:27 Asia/Muscat, Friday. New order, Blouse speed menu: Economy "Ready Sat, Nov 28, 2:00 PM"; Standard "Ready Tue, Dec 1, 3:00 PM"; Next day "OMR 2.943 · Ready Tue, Nov 24, 6:00 PM"; Express "Ready Mon, Nov 23, 2:00 PM"; Urgent "Ready Mon, Nov 23, 11:00 AM". Speed previews now appear (FET-SS-Nov13-SpeedMenuNoPreview **FIXED** / not reproduced). Notes: Fri hours show 08:00–06:00 yet counting jumps to Monday; the order screen used disabled branch "Main Branch 2" vs calendar "Main Branch Name"; cart "Ready By" field stays empty (FET-SS-Nov19-ReadyByNotFromSpeed still open); toast "Item removed from the order." stayed on screen and blocked user-menu clicks until reload. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b5-Q8-6.3.png`. |

**Prior findings — Retest r5 2026-11-20**

- **FET-SS-Nov13-BranchCalendar400** — **FIXED.** Branch calendar loads with hours and a preview.
- **FET-SS-Nov13-SpeedMenuNoPreview** — **FIXED.** Speed menu shows ready dates and the Next-day price.
- **FET-SS-Nov19-ReadyByNotFromSpeed** — **STILL OPEN.** Cart "Ready By" stays empty after a speed is shown in the menu.
- **FET-SS-Nov13-BranchTimeFormatMix** — **STILL OPEN / tightened** by the 08:00–06:00 display (see new finding).

**New findings — Financial_Expert_Tester, Retest r5 2026-11-20**

- **P2 FET-SS-Nov20-FridayHoursShows0600:** Branch calendar lists Mon–Fri as 08:00–06:00, which reads as closing before opening. "06:00" is likely 18:00 shown in 12-hour digits without AM/PM (ready time on the same page is 18:00). Suggested fix: format all branch hours in one consistent 12- or 24-hour pattern, including AM/PM if 12-hour. Code location not checked.
- **P2 FET-SS-Nov20-StuckToastBlocksMenu:** After removing the Blouse, toast "Item removed from the order." stayed on screen and intercepted user-menu clicks until a reload. Suggested fix: auto-dismiss the toast and do not block pointer events on the user menu. Code location not checked.
- **P3 FET-SS-Nov20-NewOrderBranchMismatch:** New Order used disabled branch "Main Branch 2" while the calendar under test is "Main Branch Name". Suggested fix: default New Order to the same active branch the calendar/preview uses, and do not silently select a disabled branch. Code location not checked.

**r5 tally for the rows above (parent counts unchanged):** PASS 2 (§2, §6.3) with notes.

**Rows not run in r5:** remaining speed-rule, HQ calendar, Arabic leftovers, and write-gated holiday/rule rows (awaiting approval / not in this observe batch).

**Test data left behind:** nothing new was created in r5. Shared leftover from earlier rounds (unchanged): `ORD-20261119-00006` is READY on rack QA-A1, paid 1.070 OMR cash, with 3 photos including `qa_photo2.jpg` (note "QA r4 note"). Appearance and language were restored. No branding, settings, users, or other orders were changed.

**Retest plan:** Recheck hour formatting and the cart Ready By field after the next calendar/speeds fix. After approval, keep rule/holiday writes on a disposable QA branch.
