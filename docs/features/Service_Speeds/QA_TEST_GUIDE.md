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
