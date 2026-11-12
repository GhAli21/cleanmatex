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
