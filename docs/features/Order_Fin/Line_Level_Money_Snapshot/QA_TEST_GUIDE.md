# QA Test Guide — Line-Level Money Snapshot + Reusable Order Fin View

**For:** the owner / tester, run in the tenant app (`web-admin`) after deploy. Each scenario lists where to go, what to do and what you should see.
**Covers so far:** execution steps 1 and 2b (security and correctness fixes), step 3 (P1-01 sign-off) and step 4 (Reusable View Phase 1 bug fixes, S8). Later phases add sections here.

## Setup

- **Users:** one user **with** `pricing:override` (for example a tenant admin) and one cashier **without** it. Check in Settings › Roles.
- **Customer:** one customer with an active tax exemption (Settings › Tax › Exemptions, customer-level), and one normal customer.
- **Tenant:** a tenant with a VAT tax profile (for example tenant `1111…`, VAT 5% + Municipal 2%).

## S1 — Order financial data uses the session tenant only (BF-09)

1. Sidebar **Orders** → open any order (`/dashboard/orders/{id}`).
2. Open the **Financial** tabs.
3. **Expected:** totals, payments and taxes load as before.
4. **Expected:** a user without `orders:read` cannot open the page, and the financial data request is refused.

## S2 — Old readable tracking links are retired (BF-16)

1. In a browser (not logged in), open `/public/orders/{tenantId}/{orderNo}` for a real order.
2. **Expected:** the tracking page shows "We could not find this order. Please check the link with the laundry shop." in the page language (EN/AR). There is no redirect, and no customer name, phone or amount is shown.
3. Open the receipt's QR link or `/track/{token}` for the same order.
4. **Expected:** the order shows normally, and **Confirm received** works when allowed.

## S3 — Mobile app order detail (BF-16 follow-up)

1. In the customer mobile app, sign in as a customer and open **Orders** → tap an order.
2. **Expected:** the order detail (items, totals) loads.
3. With another customer's order number (testers can call `GET /api/v1/public/customer/orders/{orderNo}?tenantId=…` with the first customer's token):
4. **Expected:** **404**, the same response as for a number that does not exist.

## S4 — Server actions refuse another tenant (BF-20)

Normal screens must keep working:

1. Orders list (`/dashboard/orders`): loads, filters work, stats cards show.
2. Order detail page and full page: load. **Prepare** page (`/dashboard/orders/{id}/prepare`): add an item.
3. New Order: currency shows, the promo code applies, and a new customer's phone country code pre-fills.
4. B2B › Customers › New: the phone country code pre-fills.

**Expected:** every step works. A crafted call with a different tenant id is refused with `TENANT_MISMATCH`; this is covered by automated tests (`__tests__/actions/server-action-tenant-binding.test.ts`).

## S5 — Price override is enforced on the server (PF-01)

1. Log in as the user **with** `pricing:override`. Go to **Orders › New Order** (`/dashboard/orders/new`).
2. Add an item, open its **price override**, set a new price, and enter a reason of at least 10 characters. Complete payment and submit.
3. **Expected:** the order is created at the overridden price.
4. Open the order and check the item (or `org_order_items_dtl` in the DB):
   - `price_override` = the new price
   - `override_reason` = your text
   - `override_by` = your user's `org_users_mst.id`
5. Log in as the cashier **without** `pricing:override`. **Expected:** the override control is not available.
6. (Tester, API) Send `POST /api/v1/orders/submit-order` as the cashier with an item carrying `priceOverride`. **Expected:** **403** `PRICE_OVERRIDE_NOT_PERMITTED`. In the UI the message reads "You do not have permission to use a price override…" (EN) / "ليست لديك صلاحية استخدام تجاوز السعر…" (AR).
7. (Tester, API) The same as the permitted user but with an empty `overrideReason`. **Expected:** **400** `PRICE_OVERRIDE_REASON_REQUIRED`.

## S6 — Tax-exempt customers are not charged VAT (PF-04)

1. **Orders › New Order**, select the **exempt** customer, add items, and open payment.
2. **Expected:** VAT = 0. The total equals the items after discounts (no VAT line), even though the tenant has a VAT rate.
3. Repeat with the **normal** customer. **Expected:** VAT is charged as before.

## S7 — Owner sign-off of today's Create figures (P1-01)

There is no screen to test here. Read [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) §4 and fill its sign-off table §4.4:

- the known defects to fix
- the one-minor-unit float→decimal corrections
- the meaning of the FIXED price type

Engineers can re-run the proof at any time with `cd web-admin && npx jest __tests__/characterization` (expected: 55 pass).

**PF-21 fix (price override in the cart):**

1. In **Orders › New Order**, add an item with a catalog price (for example 30.000) and set a price override (for example 30.300, with a reason).
2. Remove the override. **Expected:** the line shows 30.000 again, and payment and submit succeed.
3. Set the override again, then turn **Express** on. **Expected:** the line keeps your 30.300 (a typed override is never rewritten by the toggle).
4. Remove the override while express is on. **Expected:** the line shows the express price (for example 45.000). Submit succeeds with no totals mismatch.

## S8 — Order financial figures are read from the saved snapshot (step 4: BF-01, 02, 05, 07, 10, 11, 13, 21, 22)

The figures on the order screens must equal the saved order snapshot, including zeros. Nothing is recalculated on the screen.

1. **Ready order shows line totals (BF-21).** Sidebar **Ready** → open an order (`/dashboard/ready/{id}`). **Expected:** each item line shows its real total (for example Shirt ×2 = 3.000), not 0. Print the receipt and the details from the same page. **Expected:** the same line totals.
2. **Voided charge (BF-01).** Open an order with a delivery charge (`/dashboard/orders/{id}`), void the charge (Financial › Charges), and reload. **Expected:** the delivery line shows 0 (the voided row is listed as voided), and the breakdown adds up to the order total.
3. **Overpaid order paid with change (BF-11).** Create an order paid in cash with more than the total, giving change. Open it. **Expected:** Overpaid = 0 and Balance = 0. The over-tendered amount does not reappear as overpaid.
4. **No false "balance mismatch" warning (BF-02).** On any paid or partly paid order, open Financial. **Expected:** no "balance mismatch" warning when the saved balance is correct, including after a refund.
5. **Rounding and pay on collection (BF-05).** On a pay-on-collection order, **Expected:** "Due at collection" equals the order balance from the snapshot.
6. **AR invoices (BF-07).** On a credit-invoice order that has an AR invoice, open the order page. **Expected:** the invoice shown is the one with a balance. On an invoice that covers several orders, the amount shown is this order's share.
7. **Missing order (BF-10, tester, API).** `GET /api/v1/orders/{random-uuid}/financial-summary` as a logged-in user. **Expected:** **404** `ORDER_NOT_FOUND`, with no internal error text.
8. **Overpayment allocated to another order (BF-22).** In payment, allocate an overpayment to another open order of the same customer. Open the target order. **Expected:** its paid amount, balance **and payment status** (for example Paid when fully covered) are updated.

Engineers: `cd web-admin && npx jest __tests__/utils/order-financial-effective-snapshot __tests__/features/orders/map-order-financial-summary-view.test.ts __tests__/api/v1/order-financial-summary.route.test.ts __tests__/api/v1/order-state-line-prices.route.test.ts __tests__/services/customer-receipt-excess-order-allocation.test.ts __tests__/services/invoice-service-order-invoices.test.ts`.

## S9 — Order Edit: order speed and per-line speed (P6-02a/b)

**Before you start:** in HQ, the Edit policy of the order's workflow profile must have rules for `CHANGE_SERVICE_SPEED` on target `ORDER` and on target `ITEM` for the order's status. Without the `ITEM` rule the line speed menu shows disabled with its reason.

1. Create an order with two lines at Standard (sidebar **Orders › New Order**, `/dashboard/orders/new`), then open it and click **Edit**.
2. In the cart, open the speed menu under line 2 and pick **Express**. Line 1 stays at the order speed.
3. Click **Review**. Expected: only line 2 is re-priced (speed premium added), its ready-by moves, the total goes up by line 2's premium. Apply, then reopen: line 2 is Express, line 1 Standard, the order speed is still Standard.
4. Edit again, set the **order** speed to Express. Expected at Review: line 1 moves to Express; line 2 is already Express.
5. Mark one piece of line 1 ready (workflow screen), then Edit and set the order speed back to Standard. Expected: Review refuses with "A line that is already ready keeps its speed…". Set line 1 to Express on its own (it keeps its speed) and the order to Standard: Review is ready, only line 2 moves.
6. Arabic: repeat step 5 in AR; the message is in Arabic and the menu is right-to-left.

## S10 — Order Edit: line price and line discount (P6-02c)

**Before you start:** in HQ, the Edit policy must have rules for `CHANGE_ITEM_PRICE` and `CHANGE_DISCOUNT` on target `ITEM` for the order's status. The tester needs `pricing:override` (line price) and `orders:discount` (line discount).

1. Create an order with two lines (sidebar **Orders › New Order**, `/dashboard/orders/new`), then open it and click **Edit**.
2. On line 1, click the pen, enter a lower price and a reason, and save. Click **Review**. Expected: line 1's unit price and total use the new price, the order total drops by the difference, and the change lists the price and its reason. Apply, then reopen Edit: the pen shows the saved price.
3. Edit again, clear line 1's price (the pen's reset). Expected at Review: line 1 is back at its standard price.
4. On line 2, click the % button, choose **Percent**, enter 10 and a reason. Expected at Review: line 2's net drops by 10%, the change shows "Line discount type: Percent", the value and the reason. Apply.
5. Edit again, open line 2's discount and enter the same values. Expected: Review says there is nothing to change. Then remove the discount: Review shows it removed.
6. Enter an amount discount above line 2's total. Expected: the dialog keeps Apply disabled with the reason; nothing is clamped.
7. Sign in as a user without `orders:discount`: the % button is not shown. Without the HQ `ITEM` rule: the controls show disabled with the reason.
8. Arabic: repeat step 4 in AR; the dialog and the Review lines are in Arabic and right-to-left.

## S11 — Order Edit: custom lines (P6-02d)

**Before you start:** the tester needs `pricing:override`; the Edit policy allows `ADD_ITEM` at the order's status.

1. Create an order with one catalog line and one custom item (sidebar **Orders › New Order**, `/dashboard/orders/new`, **Custom item** button).
2. Open the order and click **Edit**. Expected: the page opens (before this step it refused orders with a custom line); the custom line shows its name and price.
3. Change the custom line's quantity and click **Review**. Expected: it is priced at its entered price times the new quantity; nothing else changes.
4. Click **Custom item**, add "Curtain" at 7.250, and Review. Expected: the new line is added at 7.250 and the change lists it with no catalog product. Apply, then reopen: both custom lines are there.
5. Sign in as a user without `pricing:override`: the **Custom item** button is not shown in Edit.
6. Arabic: repeat step 4 in AR; the dialog and Review are right-to-left.

## S12 — Order Edit: price confirmation (P6-02e)

**Before you start:** the Edit policy allows `ADD_ITEM` at the order's status. Pick a product whose price you can change in its price list.

1. Open an order (sidebar **Orders**, `/dashboard/orders`), click **Edit**, and add that product. Note the price the cart shows.
2. In another tab, change the product's price in the price list and save.
3. Back in Edit, click **Review**. Expected: the new line has a "Prices changed" warning, the row "Price shown in the cart" with the old price, and the unit price with the new one. Other added lines whose price held show no warning and no row.
4. Click **Apply**. Expected: the line is saved at the new price. The stored change keeps both prices (`shownUnitPrice` and `pricePerUnit` in the ADD_ITEM audit snapshot); check them where your history view shows change details.
5. Repeat with a price override on the new line. Expected: no warning (an entered price is the one charged).
6. Stale review: click **Review**, then change the price again in the other tab, then click **Apply**. Expected: Apply is refused as changed; review again.
7. Arabic: repeat step 3 in AR; the warning and row read right-to-left.

## S13 — Order Edit: line controls are saved and listed in the history (P6-02f)

**Before you start:** migration 0664 is applied; the Edit policy allows `CHANGE_SERVICE_SPEED`, `CHANGE_ITEM_PRICE` and `CHANGE_DISCOUNT` on ITEM at the order's status. Before 0664, Apply refused all three.

1. Open an order (sidebar **Orders**, `/dashboard/orders`), click **Edit**, and change one line's speed. Review, then Apply. Expected: saved; reopening shows the line on its new speed and price.
2. Repeat with a line price (with a reason), then with a line discount. Expected: each Apply is saved.
3. Open the order's change history. Expected: each change is listed against its line, with before and after values.
4. Arabic: repeat step 3 in AR.

## S14 — Tax comes from tax profiles only (P6-03)

**Before you start:** migrations 0665 and 0673 applied.

1. Sign in to BlueWave Laundry Co. and open **Settings › Tax Setup** (`/dashboard/settings/tax`). Expected: a default profile "VAT 5%" is listed; no warning.
2. Create an order (`/dashboard/orders/new`) with one item. Expected: VAT 5% on the order, as before.
3. Open **Settings › Finance** (`/dashboard/settings/finance`). Expected: no tax-rate form; a short explanation and an **Open Tax Setup** button that opens Tax Setup.
4. On a test organization, deactivate its default profile in Tax Setup. Expected: the warning "No default tax profile" appears; a new order carries no tax. Reactivate the profile afterwards.
5. Edit an order created before 0665 for BlueWave (if any). Expected: its recorded VAT stays at 5% on Review.
6. Arabic: repeat steps 1 and 3 in AR; the warning and the Finance card read right-to-left.

## S15 — Customer app booking: total and error messages (P6-04)

**Before you start:** the customer app runs against this server (`API_BASE_URL`), signed in with a real customer of a demo organization.

1. Book one item and confirm. Expected: the confirmation card shows "Total: …" in the organization's currency with its decimals (OMR: 3), equal to the order total in web-admin.
2. In web-admin, remove the price of a catalog item (or deactivate it), then book that item in the app. Expected: a clear message (item unavailable, or no price yet), not a generic error.
3. On a test organization with no workflow profile for the service, book. Expected: "Online booking is not available for this laundry right now. Please contact the laundry."
4. Arabic: repeat step 1 in AR; the total line reads right-to-left.

## S16 — Edit re-checks recorded rule and promo discounts (Reusable View P1B-05, P1B-11, P1B-12)

**Before you start:** in **Marketing → Discount Rules** (`/dashboard/marketing/discount-rules`) make an active 10% rule with a minimum order amount (for example 5.000). Create an order above the minimum so the rule is applied.

1. Open the order, choose **Edit**, raise a quantity, then **Review**. Expected: the new total includes 10% of the new base (not the old amount).
   Review shows **Discounts recalculated** with a line such as "Weekday 10%: −0.430 → −0.630".
2. Edit again and lower the quantities so the order falls below the minimum, then **Review**. Expected: a warning line "Weekday 10% removed (was −…): the order is below its minimum amount" and a checkbox "I understand this discount will be removed." Apply is not offered. Tick it, choose **Review again**: Apply is now offered, and applying saves the order without the rule.
3. Promo: in **Marketing → Promotions** (`/dashboard/marketing/promos`) make a promo with a minimum order, use it on a new order, then edit the order below the minimum, acknowledge and apply. Expected: the promo row is gone, and the promo's usage count went down by one.
4. A notes-only edit on the same order: Expected: no re-pricing, the discount stays as it was.
5. Arabic: repeat step 2 in AR. The lines and the checkbox are in Arabic and read right-to-left.
6. Customer app booking with an automatic promo (P1B-12): in **Marketing → Promotions** turn on **Auto apply** for a promo the booking qualifies for, then book from the customer app. Expected: the promo's usage count goes up by one (before the fix it stayed the same), and step 3's edit gives it back.

## S17 — Loyalty points follow the order (Reusable View P1B-15, P1B-10)

**Before you start:** in **Marketing → Loyalty** (`/dashboard/marketing/loyalty`) make sure the program is active, for example 1 point per 1.000. The outbox worker must be running (points are posted a moment after the money change). Check points on **Customers → (customer) → Loyalty** (`/dashboard/customers/<id>`, Loyalty tab).

1. **Paid later (LE-01):** create an order for a customer as Pay on Collection (nothing paid). Expected: no points yet. Collect the full amount later. Expected: the customer earns floor(total × rate) points, one EARN row for the order.
2. **Paid at checkout:** create and fully pay an order. Expected: points earned once (same as before).
3. **Edit up:** edit the paid order to a higher total and collect the difference. Expected: one more EARN row for the difference only. Change the program rate first: the order still uses the rate of its first earn. The new ledger row is traced to the edit (its key starts with `loyalty-ORDER_EDIT-`).
4. **Edit down:** edit a paid order to a lower total (refund or credit the difference). Expected: an ADJUST row takes back the difference.
5. **Refund after spending:** redeem most of the customer's points on another order, then fully refund the first order. Expected: the balance goes to 0, never negative; the ADJUST row shows how many points could not be taken back.
6. **Cancel:** cancel a paid order (Workflow → Cancel). Expected: its points are taken back (balance never below 0).
7. **No double credit:** click Collect twice quickly, or retry the same payment. Expected: points earned once.

## S18 — Speed Pricing rules (P7-01)

Needs migration 0691 applied. Sign in as an organization admin. Sidebar: **Catalog & Pricing › Speed Pricing** (`/dashboard/catalog/speed-pricing`).

1. Open the page. Expect the existing rules, the card with the six rule levels in order, and the filters. Switch to Arabic and check the layout and wording.
2. Click **Add rule**. Speed Express, Applies to All products, Price type Percentage of the price, amount `0.25`, a start date not used yet. Expect the hint "Adds 25% to the normal price". Save. Expect "Rule saved." and the rule in the list.
3. Add the same rule again (same speed, scope, branch and start date). Expect the dialog to stay open with "A rule for this speed, scope and start date already exists", and nothing added.
4. Type `abc` as the amount and save. Expect a message under the field, and that `abc` is still in the field. Change the price type. Expect the amount to clear and the hint under the type to say why.
5. Under **Which rule applies?** pick Express and a product with its own rule, then **Check**. Expect that rule marked **Applies** and any category or organization rule marked **Overridden**. Pick a speed and date with no rule. Expect "No rule applies".
6. Click **Add for a category**, pick a category, a multiplier and a new start date. Expect "N rules created, M skipped", and one product rule per active product in the list. Run it again. Expect 0 created and all skipped.
7. Delete a rule no order used. Expect it gone, and the same scope can be added again. Delete a rule an order was priced with (in a New Order, pick Express for a product using that rule and save the order first). Expect "Orders were priced with this rule, so it cannot be deleted. Deactivate it instead." Click **Deactivate**. Expect the status Inactive, and a new order no longer uses that rule.
8. Create an order at Express for a product whose rule you changed. Expect the new price on the new order, and older orders unchanged.
9. Sign in as a user with `pricing:read` only (for example a viewer). Expect the list and the panel, with no Add, Edit, Deactivate or Delete buttons. Calling `POST /api/v1/catalog/speed-rules` directly answers 403.
10. Open **Catalog & Pricing › Pricing** and a product's price history. Expect no speed-rule rows there. `GET /api/v1/pricing/history?entityType=speed_rule` lists the changes from the steps above, each with who and when.

## S19 — Product speed prices, tax category, import and cards (P7-04)

Sign in as an organization admin.

1. **Catalog & Pricing › Services**, open a product (`/dashboard/catalog/services/<id>`). Expect no Express price or Express turnaround field, and a **Tax category** select with the hint "Applies to new orders only". Change it to Exempt and save. Create a new order with this product. Expect no tax on the line. Older orders do not change.
2. Below the form, in **Speed pricing**: expect each speed with its price and "Rule: …", or "Same as Standard (no rule)". Compare with **Which rule applies?** on the Speed Pricing screen; both must agree.
3. Click **Add rule**. Expect the product already filled in and not changeable. Save a rule with a new start date. Expect the price and the list to update without a page reload. Click **Edit** on a rule, change the amount, save.
4. Sign in as a user with `products:update` but not `pricing:read`. Expect no Speed pricing section. With `pricing:read` only: the section shows, with no Add or Edit buttons.
5. **Services › New**: expect no speed section and the note that speed prices come after saving.
6. **Inventory › Add item**: expect no express fields, and the Tax category select.
7. **Services › Import**, Advanced template, with this file (use a new code and a real category):
   ```
   product_code,product_name,product_name_ar,category_code,price_regular,price_express,express_multiplier,unit,min_qty,turnaround_hh,turnaround_hh_express,tax_category_code,is_active
   QA-P7-1,QA Shirt,قميص,DRY_CLEAN,2.500,3.000,,piece,1,24,12,STANDARD,true
   ```
   Expect the product created and, in its Speed pricing section, an Express rule at 3.000 with 12 hours.
8. Import rows with these changes, each with a new code. Expect a row error in the screen's language and nothing created: both `price_express` and `express_multiplier`; `turnaround_hh_express` alone; `abc` as the price; `NOPE` as the tax category. As a user without `pricing:create`: a row with an express price is refused, and a row without one imports.
9. **Services › Export**, Advanced. Expect `price_express` or `express_multiplier` filled from each product's rule, and `tax_category_code`.
10. **New Order**: pick Express. Expect each product card to show its Express price with the label "Express price" within a moment. Add one: the cart line shows the same price. Pick a customer on a price list and repeat; pick Standard. Expect the normal price and no label.
11. **Catalog & Pricing › Pricing**, generate a list from default prices. Expect normal prices for every list type.

## S20 — Readers use the line figures (P8-01)

1. In **Catalog & Pricing › Services**, set one product to Exempt and one to Zero rated. Create an order with both, plus a standard-rated product, and add a line discount on the standard one.
2. Open the order's receipt. Each line shows what the customer pays for it, in the currency format.
3. Open **Reports › Financial › Tax**, for today. Expect **Taxable amount by tax category** with Standard, Zero rated and Exempt filled, each equal to that order's lines. Cancel the order and refresh. Expect its amounts gone.
4. Open the order's detail page. Under the discounted line's amount, expect "After discount: …". Open **Ready** for it later: the same note. Switch to Arabic.
5. Open the public tracking link. Expect each item to show its line total. The sum of the items plus charges equals the order total, when no order-wide discount was given.
6. **Dashboard:** top services reflect the discounted amount.

## S21 — General rules, retail and bulk retire

Sign in as an organization admin. Sidebar: **Catalog & Pricing › Speed Pricing** (`/dashboard/catalog/speed-pricing`).

1. Add a rule: Express, All products, Percentage of the price, `0.30`. Under **Which rule applies?** pick a service product with no rule of its own. Expect this rule to apply. Pick a retail item. Expect "No rule applies".
2. New Order at Express: a 10.000 service product shows 13.000. A retail item stays at its normal price and is ready at once.
3. Click **Retire product rules**. Pick Express and a category. Expect a count of the rules. With no general rule for that category or all products, expect the red warning that those products will cost the same as Standard.
4. Apply. Expect "N rules retired", those rules Inactive in the list, and a product from that category now following the general rule. Older orders do not change.
5. Open the dialog again, choose **Restore retired rules**, the same speed and category. Expect the same count, then the rules Active again.
6. As a user without `pricing:bulk`, expect no **Retire product rules** button. Calling `POST /api/v1/catalog/speed-rules/bulk-status` directly answers 403.
7. After migration 0694: expect no product rule with a +0% multiplier from the seed. Retail items keep their price and stay ready at once.

## S22 — Piece level (P9-02)

In HQ: **Tenants › Order Fin Settings › Tax & Pricing**, set **Commercial level** to Piece and save. Reopen: expect Piece still selected.

In HQ, first add Edit policy rules for `CHANGE_SERVICE_SPEED` / `PIECE` and `CHANGE_DISCOUNT` / `PIECE` (new draft, then publish).

1. **Orders › New Order:** add a per-piece product with quantity 2. Give one piece its own speed and a discount. Expect the line to equal the sum of its pieces, and the slowest piece to set the ready time.
2. Add a Fixed price product (for example a suit). Expect no piece money controls: it stays priced on the item.
3. Open that order in **Edit Order**, change a piece's speed. Expect only that piece's price to change.
4. Older orders keep the level they were created with.

## S23 — Preparation

Sidebar: **Preparation**, open a Quick Drop order. Expect **Edit Order** to add or remove items, no Delete button on a line, and the price panel to match the order's stored totals.

## Sign-off

| Scenario | Result | Tester | Date |
|---|---|---|---|
| S1 | | | |
| S2 | | | |
| S3 | | | |
| S4 | | | |
| S5 | | | |
| S6 | | | |
| S7 | | | |
| S8 | | | |
| S9 | | | |
| S10 | | | |
| S11 | | | |
| S12 | | | |
| S13 | | | |
| S14 | | | |
| S15 | | | |
| S16 | | | |
| S17 | | | |

## Financial_Expert_Tester Results — Round 1 (2026-10-23)

**Run:** Preview, tenant Demo Laundry (`11111111-1111-1111-1111-111111111111`), 2026-10-23 ~18:41–18:55 (Asia/Muscat, +04), code at HEAD `b8709378`. Signed in as `admin@demo-laundry.example` (shown as "Admin Demo Lanudry", role `super_admin`, 347 permissions). Code references are under `web-admin/` at `b8709378`. Database checks were read-only `SELECT`s on the Preview (cloud) database. No passwords or password hashes are recorded here.

| # | Result | Evidence |
|---|---|---|
| S1 | **PASS with bugs** | Order `ORD-20261014-0001` (id `10012a76-ca6d-4fd5-ac2c-014a7723d311`) opens at `/dashboard/orders/{id}` and `/full`. Financial figures load and agree: base 6.000, net 6.000, tax 0.420 (CUSTOM "Municipal Fee 2%" 0.120 + VAT "VAT 5%" 0.300), total 6.420 OMR, paid 2.420 (CASH 1.000 + CARD 1.420), balance 4.000, PARTIALLY PAID / PAY ON COLLECTION. Invoices: "No invoices for this order". **Bugs:** (a) Full › Payments shows "Tax (VAT) 0.120 OMR", but 0.120 is the Municipal fee and VAT is 0.300. (b) Raw keys `orders.detailFull.cardBrand` / `orders.detailFull.cardLastFour` are shown. (c) Customer Name is blank on the full page. (d) Console shows **504** on `/api/navigation`, and the app is very slow (tab clicks apply late). Step 4 (user without `orders:read` is refused) was not tried: the only tenant user without broad rights is `viewer@` (U000004), and that user has `orders:read`. |
| S2 | **PASS** | Incognito `/public/orders/1111…/ORD-20261014-0001` shows "Track Your Order / We could not find this order. Please check the link with the laundry shop." There is no redirect and no name, phone or amount. `/track/a8b17690797ab32408f67a69987b1b3d` shows ORD-20261014-0001, Processing, 6.420 OMR, Pending Payment, "Payment due on collection … remaining amount of 4.000 OMR", item Boxer Shorts ×2 6.000. **Not testable:** Arabic (there is no language switcher on either page; see (j)). **Confirm received** is not shown, which is correct because the order is Processing + pay on collection and not delivered (see note under the diagnosis). Observation (k): the token page shows the customer's full name and phone. |
| S3 | **BLOCKED** | Needs the customer mobile app and a customer bearer token for `GET /api/v1/public/customer/orders/{orderNo}?tenantId=…`. Neither was available in this run. |
| S4 | **PARTIAL** | Works: the Orders list loads with 3 orders and stats cards (3 total, 3 pending prep, 3 in progress, 0 ready, 0 out for delivery, 0 delivered today, 3 overdue). Order detail and full pages load. New Order shows currency OMR. Customers › Add Customer (Quick Add) pre-fills +968, and B2B › Customers › New pre-fills +968 (both cancelled, not saved). **Not confirmed:** the status filter exists (Draft…Delivered), but the filter result was not captured. **Blocked:** `/dashboard/orders/{id}/prepare` shows "Cannot Prepare Order - This order is in processing status and cannot be prepared…". All 3 orders are Processing, so there is no order to prepare. **Not found:** there is no promo field on New Order. The promo code is on the payment screen (see (h)), which could not be reached because of the POS block. **Disabled:** the new-customer icon inside the order panel does nothing while POS is locked (see (i)). |
| S5 | **BLOCKED** | POS session `POS-20261016-E2ED9312` (Main Branch 2, business date 2026-10-16, drawer `SES-20261016-0001`, balance 54.250 OMR) is Paused / Stale / Rolled over: "This session was paused because the business day changed, so it cannot be resumed. Close it, then open a new session to keep taking payments." The New Order banner says "Resume the POS session - This POS session is paused. Resume it here before creating an order." Item **Add** does nothing, and the cart stays at "No items added yet", so no order could be built. Sign-in as `operator@demo-laundry.example` / `U000001` failed twice with "Invalid user code, email or password. Please try again." (see the operator finding). The setup premise also fails: no tenant user who can create orders lacks `pricing:override` (see the operator finding). |
| S6 | **BLOCKED** | Settings › Tax › Exemptions › Add has Exemption Type* (CUSTOMER_EXEMPT, PRODUCT_EXEMPT, ZERO_RATED, REDUCED_RATE, OTHER), Certificate No., Service Type, Valid From* (default 2026-10-23) and Valid To. It has **no customer field**, so a customer-level exemption cannot be created in the UI (see (e)). It was not saved. The only exemption row (GOVERNMENT_ENTITY, cert `GOV-OM-2024-001`, valid from 2024-01-01, no expiry, Customer ID "–") has no customer and no service type, so it applies to no order. New Order is also blocked by POS (as in S5). Customer `QA-LLMS Exempt` was created for this scenario (below). |
| S7 | Sign-off ✅ done 2026-10-23 (delegated, §4.4) / PF-21 repro **BLOCKED** | The P1-01 sign-off is recorded in P1_01_CHARACTERIZATION.md §4.4; no owner action. The PF-21 UI repro needs items on New Order, which is blocked by POS (as in S5). |

**Counts:** 7 scenarios. PASS 2 (S1 with 4 bugs, S2), PARTIAL 1 (S4), BLOCKED 3 (S3, S5, S6), NOT RUN 1 (S7; PF-21 repro blocked). New issues: 6 bugs (a, b, c, d, e, f-message), 1 privacy observation (k), and 5 by-design or guide-wording items (g, h, i, j, Confirm received). No orders were created.

**Test data left:** customer **QA-LLMS Exempt**, id `c13cd7cf-7d7a-4bd6-aa47-f19bb7504cbd`, phone `+96897531864`, type `stub` (Demo Laundry). No exemption, order or POS change was saved.

### Diagnosis (read-only, HEAD `b8709378`)

| Id | Finding | Where (file:line) | Cause | Bug / by design | One-line fix |
|---|---|---|---|---|---|
| a | Payments tab "Tax (VAT) 0.120" | `app/dashboard/orders/[id]/full/page.tsx:180-182,197-199`; `app/dashboard/orders/[id]/full/order-details-full-client.tsx:1114-1117`; `messages/en/orders/detail.json:38` | `tax` = `canonicalOtherTaxAmount` (non-VAT taxes = Municipal 0.120), but it is labelled `t.tax` = "Tax (VAT)". The Financial waterfall (`:691-692`) shows VAT and Tax correctly. | **BUG** | Show VAT and Other taxes as separate rows (or the total 0.420), and rename the label to "Other taxes". |
| b | Raw keys `cardBrand` / `cardLastFour` | `src/features/orders/ui/orders-payments-tab-rprt.tsx:42,215,219`; `messages/en/orders/detailFull.json` (and `ar`) | The component uses namespace `orders.detailFull`, which lacks both keys (`cardBrand` exists only in `finance.json:130`). | **BUG** | Add `cardBrand` "Card Brand" and `cardLastFour` "Card Last 4" (EN + AR) to `orders/detailFull.json`. |
| c | Customer Name blank on full page | `lib/db/orders.ts:532-550`; `order-details-full-client.tsx:260,910-911,1242-1243,1661` | The query selects customer `name`/`name2`; the client reads `first_name`/`last_name`, which are not selected. | **BUG** | Render `customer.name` (fallback `name2`). |
| d | 504 on `/api/navigation`, slow app | `app/api/navigation/route.ts:26-27` (`maxDuration = 10`), `:70` (uncapped `get_user_permissions_jh` RPC), `:88` (flags 3 s timeout), `:95-98` (nav 7 s timeout), logs `:35-108` | The steps run in sequence. The worst case is more than 10 s, so Vercel returns 504 before the route's 200 fallback. | **BUG** (perf/infra) | Give the whole route one time budget (timeout the RPC, nav ≤ 4 s), cache navigation per user+tenant, remove the debug logs, and check the Preview DB region and cold start. |
| e | Exemption form has no customer field | `src/features/settings/tax/ui/tax-setup-client.tsx:45-51` (schema), `:323-329` (create call), `:725-766` (dialog); the table shows customer at `:499-502` | The server action (`app/actions/settings/tax-actions.ts:60-62,379-382`) and the API (`app/api/v1/settings/tax/exemptions/route.ts:38-45,51-79`) accept `customerId`, but the UI never sends it. No customer-page exemption UI exists. | **BUG** (UI gap) | Add a customer picker to the dialog and pass `customerId` to `createTaxExemptionAction`. |
| f | Add item does nothing while POS paused; banner says "Resume it here" | `src/features/orders/ui/new-order-content.tsx:89-99` (`orderEntryLocked`), `:980-983` (`inert`), `:553-557` (warning on Submit only), `:953-958` banner → `messages/en/posSessions.json:129-130` | The lock is intended, but clicks in the `inert` area are silently ignored. The banner tells the user to resume a rolled-over session that cannot be resumed. | Block **by design**; message **BUG** | When the session is rolled over, use `flags.rolledOverTitle/Body` (`posSessions.json:225-226`) and toast on clicks in the locked area. |
| g | No Resume on the stale session | `src/features/pos-sessions/model/pos-session-flags.ts:46` (`canResume = PAUSED && !rolledOver`); used at `pos-session-hub.tsx:271`, `pos-sessions-screen.tsx:735` | A rolled-over session must be closed and a new one opened. | **By design** | None (optional: an "Open new session" CTA after Close). |
| h | No promo field on New Order | `src/features/orders/payment/capabilities/registry.ts:141`; `promo-code/promo-code-dialog.tsx`; tag icon `view/capability-action-icons.tsx:28`; `payment-full-view.tsx:1818,1850` | Promo is a payment-screen capability, reached only after adding items and opening payment. | **By design** (guide wording) | Guide S4 step 3: "open payment → Promo code (tag icon)". |
| i | New-customer icon disabled | `order-summary-panel.tsx:256-271` rendered inside the inert wrapper (`new-order-content.tsx:982,1210,1268`); green button = Calculate Ready-By (`:335-339`, disabled with no items) | This follows from the POS lock. The top-bar customer pill (`new-order-top-bar.tsx:150-169`) stays usable and opens the picker (create modal `customer-picker-modal.tsx:791`). | **By design** (consequence of f) | Show a lock hint or tooltip on the inert panel; retest with an open POS session. |
| j | No language switcher on tracking pages | `app/track/[token]/page.tsx:19-20`; `proxy.ts:280-288`; `i18n.ts:15-18` | The locale comes from the `NEXT_LOCALE` cookie (`en`/`ar`) or browser Accept-Language `ar*`. | **By design** (enhancement) | Add an EN/AR toggle that sets `NEXT_LOCALE`. To test Arabic now, set cookie `NEXT_LOCALE=ar` or make Arabic the browser's first language. |
| k | `/track/{token}` shows full name and phone | `lib/services/public-order-tracking.service.ts:457-461`; `src/features/orders/public/order-tracking-page.tsx:430-453` | The token page maps `org_customers_mst.name` and `phone` as-is. | Privacy **observation** (by design today) | Mask the phone (e.g. `+968 ••••1864`) and show only the first name or initial. |
| — | No **Confirm received** | `order-tracking-page.tsx:248-251` | Shown only when ready for pickup (and not pay-on-collection), out for delivery, or delivered. The order is Processing + pay on collection. | **By design** | None; retest with a delivered order. |

**How PF-04 decides exemption** (`lib/services/tax-engine.service.ts:90-123`, `isTaxExempt`; called from `lib/services/order-calculation.service.ts:309-318`): an order is exempt when a row in `org_tax_exemptions_cf` has the same tenant, `is_active = true`, `rec_status = 1`, `valid_from ≤ now`, `valid_to` null or ≥ now, **and** either `customer_id` = the order's customer or `service_type` is one of the order's service categories. Then `calculateTaxDetailed` (`:140-152`) returns `{ lines: [], exempt: true }`, so **all** tax lines are dropped (VAT and the Municipal 2% fee), not only VAT. For S6, "Expected: VAT = 0" means total tax = 0.

**Exemption data (Preview DB):** the tenant has 1 row, id `115237d2-84b4-4643-95aa-c6ee76789658`, GOVERNMENT_ENTITY, cert `GOV-OM-2024-001`, `customer_id` null, `service_type` null, valid from 2024-01-01 00:00 +04, no expiry, active. It matches no order.

**How to set a customer-level exemption today** (the UI cannot do it): call `POST /api/v1/settings/tax/exemptions` as a user with `tax:manage_config` (for example `admin@`), with the CSRF token. Body: `customerId` (uuid of `QA-LLMS Exempt`), `exemptionType` (e.g. `CUSTOMER_EXEMPT`), `certificateNo`, `validFrom` (ISO datetime, required) and optionally `validTo` / `serviceType`. Check it with `GET /api/v1/settings/tax/exemptions?customerId=…`. The other option is an insert into `org_tax_exemptions_cf` by the dev team.

**Operator account finding** (`operator@demo-laundry.example` / `U000001`, read-only, no hashes read):
- `org_users_mst` id `29ba98ec-e0e6-401c-9c20-4bb0a5a36d51`, display "Operator Demo 1", role `operator`, active, `rec_status` 1. `locked_until` and `lock_reason` are null, and `pwd_must_change` is false. `failed_login_attempts` = 2, last failure 2026-10-23 18:55:34 +04 (this run). Password last changed 2026-10-09 21:58:07 +04. Last successful login 2026-10-10 11:24:42 +04 (55 logins).
- The Supabase auth user is email-confirmed, has a password, and is not banned or deleted. No recovery email was sent.
- **Conclusion:** the account is valid and **not locked**, and no password reset happened after 2026-10-09. The failures are most likely a wrong or outdated password. Lockout rule (`supabase/migrations/0561_auth_security_hardening.sql:412-414`): 5 failures within 1 hour lock the account for 15 minutes, so avoid more than 2 further tries before 19:55 +04 that day.
- **Permissions:** the `operator` role has 88/88 permissions enabled, including `orders:read` and `pricing:override`. The effective permissions (`get_user_permissions_jh`) include both, plus `orders:create` and `customers:create`.
- **Premise gap for S5:** `pricing:override` is granted by default to admin, branch_manager, cashier, operator, receptionist, super_admin, supervisor and tenant_admin. Effective check: `ahmed@` (cashier), `operator@` and `admin@` all have it. `viewer@` (U000004) has only `orders:read` (no `orders:create`). So **no tenant user can create orders without `pricing:override`**. S5 steps 5–6 need a custom test role (e.g. a copy of cashier without `pricing:override`).

### Tester suggestions — Financial_Expert_Tester

- **FET-LLMS-S1 (P0):** Add a customer picker to the Tax Exemption dialog (e). Without it, PF-04 cannot be set up or tested in the UI.
- **FET-LLMS-S2 (P0):** Fix the `/api/navigation` 504 (d): one time budget, cached navigation, no debug logs. The slowness affects every screen on Preview.
- **FET-LLMS-S3 (P1):** Payments tab tax label (a): show VAT 0.300 and Other taxes 0.120 separately (or total 0.420). The current "Tax (VAT) 0.120" is a misleading financial figure.
- **FET-LLMS-S4 (P1):** Customer Name on the full order page (c): use `name`/`name2`.
- **FET-LLMS-S5 (P1):** New Order with a rolled-over POS session (f): show the rolled-over text ("Close it, then open a new session…") instead of "Resume it here", and give feedback when a locked control is clicked.
- **FET-LLMS-S6 (P1):** Guide: S5 setup needs a custom role without `pricing:override` (no default role that creates orders lacks it). S6 should say "total tax = 0" (exemption removes VAT and the Municipal fee). S4 step 3 should say the promo is on the payment screen.
- **FET-LLMS-S7 (P2):** Add i18n keys `cardBrand` / `cardLastFour` to `orders/detailFull.json` EN + AR (b).
- **FET-LLMS-S8 (P2):** Mask the phone and shorten the name on `/track/{token}` (k), and add an EN/AR toggle on public pages (j).
- **FET-LLMS-S9 (P2):** Seed Preview with at least one Draft/Pending order (for Prepare) and one Delivered order (for Confirm received).

### Retest plan — Round 2 prerequisites

1. **POS:** close `POS-20261016-E2ED9312` (and drawer `SES-20261016-0001`) and open a new session for today. Needed for S4 (new customer, promo), S5, S6 and the PF-21 repro.
2. **Exemption:** create an active customer-level exemption for `QA-LLMS Exempt` (`c13cd7cf-7d7a-4bd6-aa47-f19bb7504cbd`) via the API above, or by a dev insert, until the UI has the field.
3. **Roles:** create a test role or user that can create orders but has **no** `pricing:override` (S5 steps 5–6). Give the tester the correct operator sign-in out of band (never in this file), or use `admin@` for the permitted path.
4. **Orders:** have one Draft/Pending order for `/prepare` (S4) and one Delivered (or out-for-delivery) order with a `/track/{token}` link for **Confirm received** (S2).
5. **Arabic:** set cookie `NEXT_LOCALE=ar` (or browser language Arabic) for the S2 Arabic text and the S5 Arabic error.
6. **Mobile (S3):** customer mobile app build plus a customer bearer token, and a second customer's order number.
7. **API calls (S5 steps 6–7):** an authenticated session with a CSRF token for `POST /api/v1/orders/submit-order`.
8. ✅ S7 sign-off in P1_01_CHARACTERIZATION.md §4.4: done 2026-10-23 (delegated). No owner action.

## Financial_Expert_Tester Results — Round 2 (2026-10-23)

**Run:** Preview, tenant Demo Laundry, 2026-10-23 ~22:20–23:02 (Asia/Muscat, +04). Code at HEAD `3c6c1385` (r1 was `b8709378`; 21 files under `web-admin/` changed). Signed in as `admin@` ("Admin Demo Lanudry"), plus two `operator@` sessions ("Operator Demo 1", role `operator`, signed in on the first try both times; the second at ~22:44 after the owner approved closing the operator's stale session), plus one `viewer@` session at ~23:00–23:01 ("Viewer User Demo1", role `viewer`, account provided by the owner, signed in on the first try). Database checks were read-only `SELECT`s on the Preview (cloud) database. No passwords or password hashes are recorded here. Screenshots are in the tester box at `/workspace/llms/shots/` (`r2_pos_01…07*.png`, `r2_C_A_payment.webp`, `r2_C_B_payment.webp`, `r2_C_C_operator.webp`, `r2_D_01_operator_role.png`, `r2_D_02_op_pos_closed.png`, `r2_D_03_op_pos_opened.png`, `r2_F_01…06_viewer.png`). The r1 text above is kept unchanged. Where r2 differs, the r2 lines below supersede r1.

**POS unblock (owner-approved, ~22:20–22:26):** Drawer "Branch 2 Cash Drawer 2" (`DRW-BR2-002`, `/dashboard/internal_fin/cash-drawers/3fd90675-689b-4320-ab20-7edb4930225a`) session `SES-20261016-0001` was closed at 22:24:47 +04. Before the close, the drawer page showed Opening 0.000 and Expected cash 0.000 (0 payments, 0 movements). The close dialog said "Enter the physical cash count to reconcile this session." Turning on "Count the cash now" showed "Your organization requires counting by denomination. No denomination catalog is configured for this currency — use the total amount instead.", but there was **no total field**, so the session was closed uncounted. Notes: "QA: close stale session for LLMS round 2". Result & Disposition: EXPECTED CASH **54.250 OMR**, COUNTED "Not counted yet", VARIANCE "—", disposition "Left in drawer", then "Confirm Close". POS `POS-20261016-E2ED9312` closed with the toast "POS session closed.". The new POS `POS-20261023-67548A34` (business date 2026-10-23, opened 22:25 +04, Terminal None) showed "POS session opened.". "Open a new cash session" has **no opening-float field** ("The system computes the opening float from this drawer's history"). The toast was "Cash drawer opened and linked to this POS session.". The new drawer session `SES-20261023-0001` opened at 22:25:33 +04 with opening float **54.250** (the owner wanted 0.000, but it cannot be set). `/dashboard/pos` returns "404 This page could not be found." (`r2_pos_01…07`).

- Retest r2 2026-10-23 22:26: S4 **PARTIAL (unchanged)** — New Order **Add** now works after the POS unblock (Bathrobe/Robe 1.800 added; the item grid shows a skeleton for ~10 s). Promo (payment screen), the new-customer icon, the status-filter result and `/prepare` were not retested in r2 (`r2_pos_07_new_order_add_works.png`).
- Retest r2 2026-10-23 22:32: S5 **PARTIAL (step 5 FAIL as written with operator — see 22:48; BLOCKED with viewer — see 23:00)** — Admin path (customer **Jh Test dev21**, `+96896662624`, existing): the reason "short" showed "Reason must be at least 10 characters". With 1.500 (catalog 1.800) and the reason "QA LLMS S5 override reason ok", payment Cash exact and Ready By Oct 24 10:00 AM, the order was submitted at ~22:31:50 as **`ORD-20261023-0002`** (id `7a0b6501-3303-4969-afa9-3e04f9c092f8`). Figures: subtotal 1.500, VAT 5% 0.075, Municipal Fee 2% 0.030, tax 0.105, total **1.605**, paid 1.605 cash, balance 0.000. The **audit is persisted** (DB, read-only): item `168549f6-02c6-49aa-bbdf-492cf6d751b6` has `price_per_unit` 1.500, `price_override` 1.5000, `override_reason` "QA LLMS S5 override reason ok" and `override_by` = admin's `org_users_mst.id`. It is **not visible in the UI**: detail and `/full` show only "Bathrobe/Robe, pending, 1.500 OMR, 1 × 1.500 OMR", Base services 1.500, Tax 0.105, Order total 1.605, Exempt 0.000 (diagnosis r2-a). First step 5 attempt (22:32–22:33) was **BLOCKED**: the operator's own stale `POS-20261010-7D5ACE56` (Paused / Stale / Rolled over, business date 2026-10-10, Main Branch 2, opened Oct 10 2026 11:29 AM, 0 orders) shows "This POS session is paused. Resume it here before creating an order. The order stays on this session's branch.", "The business day changed" and "Resume the POS session before linking a cash drawer.". **Add** is inert, so the override control could not be observed, and nothing was submitted (r2-g); rerun at 22:48 below. Steps 6–7 (API) were **not run**: UI first, tester API access pending (`r2_C_B_payment.webp`, `r2_C_C_operator.webp`).
- Retest r2 2026-10-23 22:48: S5 step 5 **FAIL as written** — The owner approved closing the operator's stale session. As `operator@` ("Role: operator", "Operator Demo 1"), `/dashboard/internal_fin/pos-sessions` showed `POS-20261010-7D5ACE56` Paused / Stale / Rolled over (Main Branch 2, business date 2026-10-10, opened Oct 10 2026 11:29 AM, paused Oct 11 12:00 AM (ROLLOVER), Cash drawer "None"). The operator closed it with the reason "QA: close stale operator session LLMS r2" (toast "POS session closed.", history row Closed). The operator then opened `POS-20261023-64D05160` (Main Branch 2, business date 2026-10-23, opened Oct 23 2026 10:47 PM, Terminal None, toast "POS session opened."). No drawer could be linked: "No counter drawer on this branch is free for you. A drawer with an open session for another user or another branch is not listed." The only Branch 2 counter drawer is held by admin's `SES-20261023-0001` (r2-h). On New Order, Bathrobe/Robe 1.800 was added. The line controls were "Edit notes / pieces", "Override price", "Remove item" and one **unlabeled** icon button (r2-i). "Override price" opens the same "Override Price" dialog: Calculated Price 1.800 OMR, Override Price prefilled 1.8, Reason placeholder "Explain why you are overriding the calculated price...", note "This action requires pricing:override permission". Expected per the guide: "override control is not available" for a user without `pricing:override`. Actual: the operator has the control because the `operator` role holds `pricing:override` (as found in r1). This is a guide-premise failure, not a product defect: the no-permission path needs a custom role without `pricing:override`. Nothing was applied or submitted, and the item was removed (`r2_D_01_operator_role.png`, `r2_D_02_op_pos_closed.png`, `r2_D_03_op_pos_opened.png`).
- Retest r2b 2026-10-23 23:00: S5 step 5 with viewer — **BLOCKED** (viewer can't add items; override visibility not observable) — Signed in as `viewer@` on the first try at 23:00:32: "Welcome back, Viewer User Demo1!", "Role: viewer". Sidebar: Dashboard, Orders, Customer Management, Internal Finance, Config And Settings, Help. `/dashboard/orders/new` opened by URL at 23:00:44 and **rendered fully, with no access denied and no redirect** (r2-j). Branch dropdown "Select branch" (Main Branch 2, Main Branch Name). Red alert "POS session could not be checked" / "Refresh the Session Hub, then start or resume an open POS session before creating an order." The Session Hub auto-opened: "No active POS session" / "No POS session is open. Start one in the Session Hub before creating an order." The only buttons were Refresh, Close panel and Manage sessions; there is **no start action** (r2-k). After selecting Main Branch 2: "Checking POS session…", then the badge "Error" with "Failed to load POS sessions." and Refresh. This is a generic error, not a permission message (r2-k). The grid showed Bathrobe/Robe 1.800 OMR. **Add** did nothing: cart "No items added yet", "2) Order Items (0)", "Submit Order Total 0.000 OMR" disabled (same `orderEntryLocked` lock as r2-g). `/dashboard/internal_fin/pos-sessions` as viewer at 23:01:25 showed "POS Sessions access is not enabled for your user." / "The page requires pos_session:view. If this was just added, refresh permissions or rebuild the user permission cache." (explicit and correct). DB (read-only): viewer has 31 effective permissions, including `orders:read`, but **not** `orders:create`, `pricing:override` or `pos_session:view`. So viewer cannot create orders, and the override-control check cannot be observed. No seeded role holds `orders:create` without `pricing:override` (r2-l). Nothing was created or closed. Admin signed in again at 23:01:44, in English (`r2_F_01_viewer.png` hub with no session, `r2_F_02_viewer.png` checking, `r2_F_03_viewer.png` hub error, `r2_F_04_viewer.png` grid with empty cart, `r2_F_05_viewer.png` cart empty after Add, `r2_F_06_viewer.png` POS Sessions access warning).
- Retest r2 2026-10-23 22:31: S6 **BLOCKED** — There is still no UI to create a customer exemption. The `QA-LLMS Exempt` detail tabs (Profile, Addresses, Order History, Preferences, Stored Value, Loyalty) and its edit form have no tax or exemption field. `/dashboard/settings/tax` › Add Exemption has no customer selector (r1-e is still open). No exemption was created. As expected with no exemption, `QA-LLMS Exempt` was charged VAT: `ORD-20261023-0001` 1.800 / Municipal 0.036 / **VAT 0.090** / total 1.926. The normal customer's figures are correct: `ORD-20261023-0002` 1.500 / 0.030 / **VAT 0.075** / 1.605.
- Retest r2 2026-10-23 22:29: S7-PF-21 **NOT REPRODUCIBLE AS WRITTEN** (S7 owner sign-off still NOT RUN) — Customer `QA-LLMS Exempt`, item Bathrobe/Robe (catalog 1.800). The "Override Price" dialog has "Calculated Price (Read-only)", "Override Price (OMR) *" and "Reason for Override *", the hint "Minimum 10 characters. This will be recorded in the audit trail." and the notes "Price overrides are logged in the audit trail" / "Override applies to this item only" / "Tax will be recalculated based on the override price" / "This action requires pricing:override permission". Setting 1.500 with the reason "QA LLMS PF-21 override test" made the line show "*" and total 1.500. On reopen, Override showed 1.5 with the **reason empty**, and the buttons were only keypad / Cancel / "Apply Override". There is **no remove or clear-override control**, so the PF-21 step "remove the override" cannot be done. Setting 1.800 with the reason "QA LLMS PF-21 revert" restored the price, but **the "*" stayed**. The Ready By picker preselected today 5:00 PM (already past at 22:28) with Apply disabled, so Oct 24 10:00 AM was chosen (r2-e). Submitted Cash exact at 22:28:56 as **`ORD-20261023-0001`** (id `e245eaa5-737b-472a-885e-a93fa48450ab`, Processing, total 1.926). The DB stores the "revert" as an override: `price_override` 1.8000, `override_reason` "QA LLMS PF-21 revert". No order-number confirmation was seen; the form reset, and the order was found via the Orders list (r2-f). The latent reducer defect still exists in code (r2-b) (`r2_C_A_payment.webp`).
- Retest r2 2026-10-23 22:30: Arabic — The language switch works (`dir=rtl`), but the whole Override Price dialog is in English, including "Reason must be at least 10 characters" (r2-c).

**Counts (r2, supersedes r1 counts):** 7 scenarios. PASS 2 (S1 with r1 bugs, S2 — not retested), PARTIAL 2 (S4, S5 — admin path OK; step 5 FAIL as written with operator and BLOCKED with viewer; steps 6–7 not run), BLOCKED 2 (S3, S6), NOT RUN 1 (S7 owner sign-off; PF-21 not reproducible as written). New r2 issues: 10 bugs (a, b, c, d1, d2, e, f, i-a11y, j, k), 1 repeat of r1-f (g), 2 by-design items (d3, h — h is a setup gap), and 1 guide-premise failure (S5 step 5; l: no seeded role fits). Orders created: 2.

**Test data left behind (r2, adds to r1):**
- Orders `ORD-20261023-0001` (id `e245eaa5-737b-472a-885e-a93fa48450ab`, `QA-LLMS Exempt`, 1.926 cash, override row 1.800 "QA LLMS PF-21 revert") and `ORD-20261023-0002` (id `7a0b6501-3303-4969-afa9-3e04f9c092f8`, Jh Test dev21, 1.605 cash, override 1.500).
- Closed: POS `POS-20261016-E2ED9312` and drawer session `SES-20261016-0001` (uncounted, expected 54.250, Left in drawer).
- Opened: POS `POS-20261023-67548A34` and drawer session `SES-20261023-0001` on `DRW-BR2-002`, with opening float **54.250** carried over (not 0.000) plus 3.531 cash from the two orders.
- Operator: the stale `POS-20261010-7D5ACE56` is now **Closed** (between ~22:44 and 22:47 +04, owner-approved, reason "QA: close stale operator session LLMS r2"). The new `POS-20261023-64D05160` (Main Branch 2, opened 22:47 +04) is **Open with no drawer linked**. Message shown: "No counter drawer on this branch is free for you. A drawer with an open session for another user or another branch is not listed." No operator order was submitted.
- Viewer (23:00–23:01): read-only. Nothing was created, opened or closed.
- Existing customer **Jh Test dev21** was used (not created). `QA-LLMS Exempt` (r1) is unchanged.
- No customers or exemptions were created. The browser was left signed in as admin, in English.

### Diagnosis r2 (read-only, HEAD `3c6c1385`)

| Id | Finding | Where (file:line) | Cause | Bug / by design | One-line fix |
|---|---|---|---|---|---|
| r2-a | Override is saved but not shown on order detail or full | Persist: `lib/services/order-service.ts:1538-1541`. Pages pass the item through: `app/dashboard/orders/[id]/page.tsx:206-215`, `full/page.tsx:232-239`. UI: `src/features/orders/ui/order-items-list.tsx:14-29` (type has no override fields), `:112` (renders only qty × `price_per_unit`) | The DB has `price_override`, `override_reason` and `override_by` (`ORD-20261023-0002`), but no detail or full component reads them. | **BUG** (audit visibility) | On the item row and the full page, show "Overridden from {calculated} → {override} — {reason} — by {user}". |
| r2-b | No remove-override control; "*" stays after reverting to catalog; reason not prefilled | `src/features/orders/ui/price-override-modal.tsx:25-31` (props have no reason), `:62,:72` (`setReason('')` on open), `:97-106` (onSave always sends a number), `:254` ("Apply Override" only). `new-order-modals.tsx:308-327` (always sets a price), `:336-343`. `new-order-reducer.ts:423` (`effectivePrice = priceOverride ?? pricePerUnit`), `:429` (overwrites `pricePerUnit`). `summary-cart-item.tsx:238-253` ("*" whenever `priceOverride` is non-null) | PF-21 as written needs a remove step, but the UI cannot clear an override. The latent defect is still there: dispatching `null` would keep the overridden `pricePerUnit`. A "revert" is just another override equal to the catalog price, so the marker and DB override row stay. | **Not reproducible as written**; latent reducer **BUG** + UX **BUG** | Add "Remove override" (dispatch `null`). Have the reducer restore the catalog price (`defaultSellPrice`), treat override == calculated as no override, and prefill the previous reason. |
| r2-c | Override dialog and validation are English in AR | `price-override-modal.tsx:52` (`useTranslations('newOrder')` exists but is unused for these strings), hardcoded at `:82,:86,:90` ("Reason must be at least 10 characters"), `:107,:110` (toasts), `:121-135` (Permission Denied), `:167`, `:230` (hint), `:254` | Literal EN strings. | **BUG** (i18n) | Move the strings to `messages/{en,ar}` `newOrder.priceOverride.*`. |
| r2-d1 | Drawer page Expected cash 0.000 vs close dialog 54.250 | Page: `lib/services/cash-drawer.service.ts:307-323` (`buildLedgerReconciliation`: `openingFloat + finIn + net movements`, from `opening_float_amount`). Close: `lib/services/cash-drawer-ledger/cash-drawer-balance.service.ts:146` (`baseline = openingCounted ?? openingExpected`). View: `src/features/cash-drawers/ui/cash-drawer-overview-screen.tsx:366-373` | DB: `SES-20261016-0001` had `opening_float_amount` 0 and `opening_expected` 0, but `opening_counted` **54.2500**. The page ignores the opening count, and the close uses it. The doc comment at `cash-drawer.service.ts:295-298` claims both match. The 54.250 is an unreconciled +54.250 opening-count variance (the prior session `SES-20261014-0001` closed 65.250, moved to safe). | **BUG** (inconsistent basis) | Use `opening_counted ?? opening_expected` as the baseline in `buildLedgerReconciliation`, and show the opening count and opening variance on the drawer page. |
| r2-d2 | Close requires denomination count but no catalog and no total field | `src/features/cash-drawers/ui/cash-drawer-close-wizard.tsx:254-269` (TOTAL input only when `countMode==='TOTAL_ONLY'`; otherwise just the message), `messages/en/billing.json:208` (`noDenominationCatalog`), `:228`. Server accepts the total fallback: `lib/services/cash-drawer-session.service.ts:79-100` (`assertCountMethodAllowedTx` `:98`). Same pattern: `cash-drawer-ledger-tabs.tsx:360`, `cash-drawer-open-session-dialog.tsx:245`, `cash-drawer-recount-dialog.tsx:197`, `pos-session-connect-drawer-dialog.tsx:193` | The message tells the user to "use the total amount instead", but the UI does not render the total input when the DENOMINATION policy has an empty catalog. | **BUG** (cash count impossible) | When the catalog is empty, set `countMode` to `TOTAL_ONLY` and render the total input, in all 5 dialogs. |
| r2-d3 | New session carried 54.250; no opening-float field | `cash-drawer-balance.service.ts:46-86` (`computeOpeningExpectedTx` carries the previous `closing_basis`); `messages/en/billing.json:198` (`openDescription`) | Disposition "Left in drawer" carries the closing basis (54.250 = uncounted expected) into the next opening. The float is computed by design. | **By design** | To start at 0.000, close with "Moved to safe". The guide or setup note should say so. |
| r2-e | Ready By preselects a past slot; Apply disabled | `src/features/orders/ui/ready-date-picker-modal.tsx:48-49,55` (default today + fixed `'17:00'`), `:78-88` (future-only validation), `:350` (Apply disabled) | The default is not adjusted to now, so after 17:00 the preselected slot is already invalid. | **BUG** (UX) | Default to the next valid slot (next business day 10:00 when today's slots have passed). |
| r2-f | No order-number confirmation after submit | `src/features/orders/hooks/use-order-submission.ts:807` (`setCreatedOrder`) then `:836` (`resetOrder`); `new-order-reducer.ts:607-618` (`RESET_ORDER` → `initialState`, `createdOrderId: null` `:74`); panel `new-order-content.tsx:1211-1230` ("+ Add new order" / "Go to Processing"). Toast is coded at `use-order-submission.ts:825-829` (`workflow.json:734` "Order {orderNo} created successfully") | The reset right after `setCreatedOrder` clears `createdOrderId`, so the post-submit panel with the order link never renders. The toast is transient and was not observed. | **BUG** | Do not call `resetOrder()` at `:836` (`handleAddNewOrder` already resets), or keep `createdOrderId` in `RESET_ORDER`. Show the order number in the panel. |
| r2-g | Operator's stale rolled-over session blocks Add | `new-order-content.tsx:93` (`orderEntryLocked`), `:982` (`inert`); `messages/en/posSessions.json:130` (`pausedBody`), `:184` (`resumeBeforeDrawerLink`) | Same root cause as r1-f, still unfixed at `3c6c1385` (this occurrence was cleared between ~22:44 and 22:47 by closing the session). A rolled-over session cannot be resumed, but the text says "Resume it here", and inert clicks give no feedback. | Block **by design**; message **BUG** (repeat) | As FET-LLMS-S5: rolled-over text plus a toast on locked clicks. |
| r2-h | Second user cannot link a drawer ("No counter drawer on this branch is free for you…") | `src/features/pos-sessions/ui/pos-session-drawer-linker.tsx:78-79` (filter), `:314-329` (`isPosDrawerChoice`: excludes a drawer whose open session belongs to another user, `:326-327`), `:162-165` → `messages/en/posSessions.json:162` (`noEligibleDrawers`) | Each drawer session has one owner. Main Branch 2 has a single counter drawer, held by admin's `SES-20261023-0001`, so the operator's POS session cannot take cash. | **By design** (custody) / setup gap | Seed one counter drawer per cashier on Preview, and offer an inline "Ask owner to close or hand over" hint; the guide setup should say each tester needs a free drawer. |
| r2-i | Unlabeled icon button on the cart line; the other line buttons use only English `title` | `src/features/orders/ui/summary-cart-item.tsx:225-232,266-273,277-284` (icon-only `<button>` with hardcoded EN `title`, no `aria-label`, no i18n). The 4th, unlabeled button is not in this component (it has only these 3); its source was not located from code and needs an element inspect | Icon-only controls have no accessible name, or only an EN tooltip. | **BUG** (a11y / i18n) | Give every icon button a translated `aria-label` (and `title`) from `newOrder` messages (EN + AR). |
| r2-j | `/dashboard/orders/new` renders for `viewer` (no `orders:create`) with no access denied | `app/dashboard/orders/new/page.tsx:9-24` (client shell renders `NewOrderProvider`/`NewOrderScreen` with no guard); `src/features/orders/access/orders-access.ts:26-28` (`NEW_ORDER_ACCESS` has `page: {}`, so no page requirement; only the `priceOverride` action is used, at `new-order-modals.tsx:117`); `proxy.ts:36-40,219-245` (only `ADMIN_ROUTES` are role-gated, no per-route permission). The menu is correct: DB `sys_components_cd` row `orders_new` (`/dashboard/orders/new`) has `main_permission_code` `orders:create`, which is the gate per `lib/services/navigation.service.ts:36-45,205-206` (static `config/navigation.ts:141-147` agrees). Viewer lacks `orders:create`, so **New Order is not in viewer's menu**; the page is reachable only by URL | The route and its access contract have no page requirement. Guarded pages use the pattern `app/dashboard/drivers/page.tsx:12` (`RequireAnyPermission` with `…ACCESS.page.permissions`). | **BUG** (access control, UI; the server still needs `orders:create` to submit) | Set `page: { permissions: ['orders:create'] }` at `orders-access.ts:28` and wrap `page.tsx` in `<RequireAnyPermission permissions={NEW_ORDER_ACCESS.page.permissions ?? []}>`, as `drivers/page.tsx:12` does. |
| r2-k | Session Hub shows "Failed to load POS sessions." instead of a permission message; "Start one in the Session Hub" shown with no start action | API: `app/api/v1/pos-sessions/my-active/route.ts:16-17` (`requirePermission('pos_session:view')`, which returns 403 `{ error: 'Permission denied: pos_session:view' }` per `lib/middleware/require-permission.ts:129-131`). Client: `src/features/pos-sessions/api/pos-session-api.ts:52,61` (throws `PosSessionApiError` with status 403). Hub: `src/features/pos-sessions/ui/pos-session-hub.tsx:409-417` (any `isError` → `messages.loadFailed`), `:608` (badge "Error"), `:435-444` (`banner.none` always shown; the button is hidden by `canOpenPosSession` = `pos_session:open`, `:79,:441-442`); also `pos-session-order-banner.tsx:36`. Copy: `messages/en/posSessions.json:122` (`banner.none`), `:131-132` (`newOrderGate.error*`), `:205` (`messages.loadFailed`) | The hub never checks the 403 or `pos_session:view`; the "start one" copy does not depend on `pos_session:open`. | **BUG** (UX / error mapping) | In `HubBody`, branch on `error.status === 403` or `!useHasPermissionCode('pos_session:view')` and show "requires pos_session:view" text like the POS Sessions page; when `!canOpen`, use a "Ask a user with pos_session:open to start a session" variant instead of `banner.none`. |
| r2-l | Which seeded role lacks `pricing:override` and can create orders | DB (read-only) `sys_auth_role_default_permissions` × `sys_auth_roles`: `orders:create` and `pricing:override` are held together by admin, branch_manager, cashier, operator, receptionist, super_admin, supervisor, tenant_admin (receptionist also lacks `pos_session:view`). No other role has `orders:create`; `viewer` has `orders:read` only. `viewer@` (`org_auth_user_roles` = viewer, 0 direct permissions) via `get_user_permissions_jh`: no `orders:create`, `pricing:override` or `pos_session:view` | `pricing:override` is seeded with `orders:create` on every role that can create orders. | **By design / setup gap** (guide premise) | Add a QA seed role, e.g. `cashier_no_override` = `cashier` minus `pricing:override`, and name it in the guide's S5 step 5. |

### Tester suggestions — Financial_Expert_Tester (r2 additions)

- **FET-LLMS-S10 (P0):** Render the total-amount input when the denomination catalog is empty (`cash-drawer-close-wizard.tsx:254-269` and 4 sibling dialogs). Today a drawer under a DENOMINATION policy cannot be counted at all (r2-d2).
- **FET-LLMS-S11 (P1):** Make the drawer page's Expected cash use `opening_counted ?? opening_expected` (`cash-drawer.service.ts:315-323` vs `cash-drawer-balance.service.ts:146`), and show the opening count and variance. Today it shows 0.000 vs 54.250 at close (r2-d1).
- **FET-LLMS-S12 (P1):** Show the price-override audit (from → to, reason, by) on order detail and full (`order-items-list.tsx:14-29,112`). The data is already persisted (r2-a).
- **FET-LLMS-S13 (P1):** Add a "Remove override" control. The reducer should restore the catalog price (`new-order-reducer.ts:423-429`), override == calculated should mean no override (`summary-cart-item.tsx:238-253`), and the reason should be prefilled (`price-override-modal.tsx:62,72`). Rewrite PF-21 against the new control (r2-b).
- **FET-LLMS-S14 (P1):** Keep the post-submit "Go to order" panel: drop `resetOrder()` at `use-order-submission.ts:836`, or preserve `createdOrderId` in `RESET_ORDER` (r2-f).
- **FET-LLMS-S15 (P2):** Localize the Override Price dialog and its validation (`price-override-modal.tsx:82-254`) in EN and AR (r2-c).
- **FET-LLMS-S16 (P2):** The Ready By picker should default to the next valid slot, not a fixed past 17:00 (`ready-date-picker-modal.tsx:48-55`) (r2-e).
- **FET-LLMS-S17 (P2):** Guide and setup: explain that the opening float is computed, and that "Moved to safe" is needed to start a session at 0.000 (r2-d3). FET-LLMS-S5 (rolled-over message) is still open (r2-g).
- **FET-LLMS-S18 (P1):** One counter drawer per branch blocks a second user's drawer link (`pos-session-drawer-linker.tsx:314-329`). Seed one drawer per cashier on Preview, add a guide setup line, and show who holds the drawer plus a handover or close path in the "No counter drawer… free for you" state (r2-h).
- **FET-LLMS-S19 (P2):** Accessibility: give the cart-line icon buttons translated `aria-label`s (`summary-cart-item.tsx:225-284`) and label the unlabeled 4th line button (r2-i).
- **FET-LLMS-S20 (P1):** Guard New Order by permission: give `NEW_ORDER_ACCESS` the page requirement `orders:create` (`orders-access.ts:28`) and wrap `app/dashboard/orders/new/page.tsx` in `RequireAnyPermission` so `viewer` gets an access-denied screen, not a dead order form (r2-j). The menu entry is already gated by `orders:create`.
- **FET-LLMS-S21 (P2):** Make the Session Hub permission-aware: map the 403 from `my-active` (`pos_session:view`) to a "requires pos_session:view" message like the POS Sessions page, instead of "Failed to load POS sessions." (`pos-session-hub.tsx:409-417`, `pos-session-order-banner.tsx:36`). Show the "Start one in the Session Hub" copy only when the user has `pos_session:open` (`pos-session-hub.tsx:435-444`, `posSessions.json:122`) (r2-k).

### Retest plan — Round 3

1. **S5 steps 5–6 (no-permission path):** a custom role is **still needed**: the 23:00 role check found no seeded role with `orders:create` but without `pricing:override`, and `viewer` cannot create orders (r2-l). Create a custom test role (for example a copy of `cashier` without `pricing:override`, keeping `orders:create`, `pos_session:view`/`open` and `cash_drawer:*`) and a test user on Main Branch 2 with a free counter drawer (FET-LLMS-S18). Expect no "Override price" control, and a server refusal for a crafted override.
2. **S5 steps 6–7 (API):** an authenticated tester session with CSRF for `POST /api/v1/orders/submit-order`. Check the refusal without the permission and with a missing or short reason (`PRICE_OVERRIDE_NOT_PERMITTED` / `PRICE_OVERRIDE_REASON_REQUIRED`).
3. **S6:** once the exemption dialog has a customer picker (FET-LLMS-S1), or once an API or dev-insert exemption for `QA-LLMS Exempt` (`c13cd7cf-7d7a-4bd6-aa47-f19bb7504cbd`) is approved, expect total tax 0.000 on a new order.
4. **S3 mobile:** customer app build, a customer bearer token, and a second customer's order number.
5. **PF-21:** rerun after FET-LLMS-S13 (remove override → catalog price restored, no "*", submit succeeds). Use the dev's rewritten S7 "PF-21 fix (price override in the cart)" steps (F: change at 22:56 +04).
6. **Drawer:** after FET-LLMS-S10/S11, recount and close `SES-20261023-0001` by total, and confirm the page and close figures match. Close or link a drawer for the operator's `POS-20261023-64D05160` as needed.
7. **New Order guard and Session Hub (r2-j, r2-k):** after FET-LLMS-S20/S21, as `viewer` open `/dashboard/orders/new` by URL (expect access denied) and the Session Hub (expect the `pos_session:view` message, no "Start one" copy).

## Financial_Expert_Tester Results — Round 3 (2026-10-23/24)

Run: 23 Oct 23:51 – 24 Oct 00:05 Asia/Muscat (+04). Preview `cmx.cleanmatex.com`, Demo Laundry, admin (super_admin). Session `POS-20261023-67548A34`, drawer `SES-20261023-0001` (Branch 2 Cash Drawer 2). Scope: the dev's rewritten PF-21 steps (S7) and S8.1–S8.8. Guide pulled at 53,515 bytes (23:21:51, SHA `F8974901…`).

**Build note:** repo HEAD is still `3c6c1385` (23 Oct 19:18 +04), the same as Round 2. The PF-21, BF-10 and BF-21 fixes in STATUS.md exist only as **uncommitted** working-tree changes (117 entries, including `new-order-reducer.ts`, `price-override-modal.tsx`, `orders/[id]/state/route.ts`, `orders/[id]/financial-summary/route.ts`, `order-financial-summary.service.ts`). Preview (Vercel) runs a committed build and shows no build or version id, so these fixes are **not deployed**. Rows marked "fix not deployed" need a retest after commit and deploy.

| Step | Verdict | Evidence |
|---|---|---|
| S7 PF-21 step 1 (set override) | PASS | Bathrobe/Robe catalog 1.800 → override 2.100, reason "QA LLMS PF-21 r3 override". Line "Bathrobe/Robe*" 2.100 OMR, dialog "+0.300 OMR (16.7%) increase". |
| S7 PF-21 step 2 (remove override) | FAIL (fix not deployed) | The Override Price dialog has only Close, keypad, Decimal point, Delete last digit, Cancel and Apply Override; there is no remove or reset. The line buttons are Edit notes / pieces, Override price and Remove item. The "*" tooltip "Price overridden: 2.100 OMR" never clears. (r3-b) |
| S7 PF-21 step 3 (Express keeps override) | FAIL (fix not deployed) | With Express on, the line changed from 2.100 to **27.000 OMR** (the Express price) and "*" stayed; the dialog still held 2.1. Expected: keep 2.100. (r3-b) |
| S7 PF-21 step 4 (remove under Express) | NOT TESTABLE | No remove control. Not submitted; item removed and Express turned off. Screens `r3_P1_override_dialog.png`, `r3_P2_express_27.png`. |
| S8.1 BF-21 Ready line totals | FAIL (fix not deployed) | On 4 orders, `/dashboard/ready/{id}` shows every item line at **0.000 OMR**: ORD-20261023-0003 Bathrobe ×1, ORD-20261014-0001 Boxer Shorts ×2 (full page 6.000), ORD-20261009-0001 ×1 (full 3.000), ORD-20261003-0001 ×1 (full 3.000). The footer Total, Paid and Balance are correct. The 80mm receipt and 80mm order-details prints for 0003 also show 0.000. Separate bugs on the same page: customer "Test Customer2 Mohammed Ahmed" instead of "Jh Test dev21" (r3-d); receipt Ready By "Oct 24, 2026, 06:00 AM" for a 10:00 AM order (r3-e); "Loading actions…" never resolves (r3-l). Screens `r3_S8_1_ready_receipt.png`, `r3_S8_1_ready_details.png`, `r3_C_*_ready`. (r3-c) |
| S8.2 BF-01 voided charge | BLOCKED (no data) | financial-summary for all 6 tenant orders: `charges []`, delivery charge 0. A New Order of type "Collection & delivery" has no delivery-charge field in the panel or the payment modal. A "Currency configuration required" modal flashed. Screens `r3_S8_2_new_order_delivery.png`, `r3_S8_2_payment_modal.png`. (r3-j) |
| S8.3 BF-11 overpaid with change | PASS (with notes) | Created ORD-20261023-0003 (`bc103f34-cd9f-40d3-b186-1fb4c686c44a`), Jh Test dev21, 23:54:44: Bathrobe 1.800 + Municipal 0.036 + VAT 0.090, total 1.926. Cash 5.000: change 3.074 rounded to 3.080. Detail: Paid 1.926, Balance 0.000, PAID, Outstanding 0, Pay on collection 0. API `overpaidAmount` 0. Notes: (1) no Overpaid field on screen, so "Overpaid = 0" can only be read from the API (r3-i); (2) Financial Details and Payments & Credits tabs show the same content (r3-i); (3) a red toast "SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER" appeared next to the success toast (r3-g); (4) the receipt rounding block is wrong: "Exact change 3.080", "Rounding loss 0.006", "Change handed out 3.086". It should read exact 3.074 and handed out 3.080 (r3-f). Screen `r3_S8_3_order0003.png`. |
| S8.4 BF-02 no false mismatch | PASS (limited) | No "balance mismatch" text on 0003, ORD-20261023-0002 (1.605 paid in full), 0014, 0009 or ORD-20261003-0001. API `financialMismatchWarningCount` 0 and `financialSnapshotStatus` CURRENT. The after-refund case was not tested (no Refund action on 0003). |
| S8.5 BF-05 pay on collection | PASS on existing orders; new order BLOCKED | "Pay on collection" equals Balance Due, API `outstandingAmount` and `payOnCollectionAmount`: 0014 4.000/4/4, 0009 1.000/1/1, ORD-20261003-0001 2.210/2.21/2.21; rounding adjustment 0. A **new** pay-on-collection order (1.926, "OMR 1.926 will remain unpaid") failed twice with the raw code "SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER [SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER]" and no order was created (r3-g). Screen `r3_S8_5_voucher_error.png`. |
| S8.6 BF-07 AR invoices | BLOCKED (no data) | Invoices list: "Total invoices 0". AR aging: 0 customers. No order uses a credit or invoice plan (3 PAY_IN_ADVANCE, 3 PAY_ON_COLLECTION). (r3-j) |
| S8.7 BF-10 missing order (API) | FAIL (fix not deployed) | `GET /api/v1/orders/3f0c8a2e-1b7d-4e55-9a61-2c4d8e9f7a10/financial-summary` returned **HTTP 500**: `{"success":false,"error":"\nInvalid \`prisma.org_orders_mst.findFirstOrThrow()\` invocation: … No record was found for a query."}`. This leaks Prisma internals; expected 404 `ORDER_NOT_FOUND`. A real order returns 200. (r3-a) |
| S8.8 BF-22 overpayment to another order | BLOCKED (no own target) | Cash 5.000 on a 1.926 cart → "Extra amount to route: OMR 3.074", 7 options. Manual allocate lists only ORD-20261014-0001 (outstanding 4.000), which is not a QA order, so it was not submitted. Screens `r3_S8_8_extra_dialog.png`, `r3_S8_8_manual_alloc.png`. |

**Counts (12 rows):**

| PASS | PASS (limited / with notes) | FAIL | BLOCKED | NOT TESTABLE |
|---|---|---|---|---|
| 1 | 3 (S8.3, S8.4, S8.5 existing) | 4 (PF-21 steps 2–3, S8.1, S8.7) | 3 (S8.2, S8.6, S8.8) + the new-order part of S8.5 | 1 (PF-21 step 4) |

All 4 FAILs are "fix not deployed" (PF-21 steps 2–3, S8.1 line totals, S8.7). They should pass once the working tree is committed and deployed. The other bugs below (r3-d…g, r3-k) are in committed code.

**Other observations (API, read-only):**
- `/full` on ORD-20261014-0001 (Cash 1.000 + Card 1.420) shows Payment method **CARD** only.
- The 0009 `/full` line reads "3.000, 1 × 3.000" with no OMR suffix.
- The `/full` customer Name is blank (r3-k).
- `sourceTotals.headerTaxAmount` 0.12 vs derived tax 0.42, and `headerOutstandingAmount` 6.42 vs derived 4, on ORD-20261014-0001 (ORD-20261009-0001 and ORD-20261003-0001 are similar). The DB header now holds 0.42 / 4.000, so the app is right. `sourceTotals` is the pre-write header image (r3-h).

**Test data:**
- Created **ORD-20261023-0003** (`bc103f34-…`, Processing, Paid 1.926, cash 5.000 tendered, change 3.080).
- No pay-on-collection order was created (submit refused).
- No charges were voided, no allocation was submitted, and no refunds were made.
- An unsubmitted Jh Test dev21 cart may remain in the admin browser.
- POS session and drawer left open.
- Note: `order_no` is unique per tenant only. A row with the same `ORD-20261023-0003` exists on another tenant (Guest, 34.840); filter by `tenant_org_id` when checking.

### Diagnosis r3 (read-only, HEAD `3c6c1385` + working tree)

| # | Finding | Location | Cause | Bug / by-design | One-line fix |
|---|---|---|---|---|---|
| r3-a | BF-10 500 with Prisma text | HEAD `app/api/v1/orders/[id]/financial-summary/route.ts:24-27`, `lib/services/order-financial-summary.service.ts:410` | `findFirstOrThrow` throws; the route returns `err.message` with 500 | Bug, **fixed in working tree only** (route `:31-35` 404 `ORDER_NOT_FOUND`, `:42-45` generic 500; service `findFirst` `:393`, `NotFoundError` `:500`) | Commit and deploy. |
| r3-b | PF-21 no remove; Express rewrites override | HEAD `new-order-reducer.ts` `SET_EXPRESS` ~`:453` always sets `pricePerUnit = defaultExpressSellPrice` | Override not preserved; modal has no reset | Bug, **fixed in working tree only** (`new-order-reducer.ts:438-450`, `:475-485`; `price-override-modal.tsx:32-37,123-124,159`; `new-order-modals.tsx:347,358,470`) | Commit and deploy. |
| r3-c | BF-21 Ready and print lines 0.000 | `app/dashboard/ready/[id]/page.tsx:83`, `print/[type]/page.tsx:65,139` → `/api/v1/orders/{id}/state`; mapper `src/features/orders/model/ready-order-types.ts:122` | HEAD `ORDER_ITEM_STATE_SELECT` (state route ~`:57-77`) does not select `price_per_unit` / `total_price`, so `Number(it.total_price ?? 0)` = 0 | Bug, **fixed in working tree only** (`state/route.ts:65-66`) | Commit and deploy. |
| r3-d | Ready customer "Test Customer2 Mohammed Ahmed" | `ready-order-types.ts:109-113` (`sysCust?.name \|\| cust?.name`); also `lib/db/orders.ts:874-878` | DB: `org_customers_mst.name` and the global `sys_customers_mst.name` hold a legacy name. `display_name` = "Jh Test dev21" is what the order page and list show. Same customer, wrong field | Bug (committed, deployed; not in working tree) | Use `display_name ?? first+last ?? name` in one shared customer-name helper on Ready, print and `/full`. |
| r3-e | Receipt Ready By 06:00 AM instead of 10:00 AM | `ready-order-types.ts:161` `readyBy: raw.ready_by \|\| raw.ready_by_at_new` | `ready_by` is `timestamp without time zone` holding UTC wall time (06:00). It is parsed as local (+04 is lost). `ready_by_at_new` (timestamptz) = 06:00Z = 10:00 +04 is correct | Bug (committed) | Prefer `ready_by_at_new ?? ready_by`. |
| r3-f | Receipt "Exact change 3.080 / handed out 3.086" | `src/features/orders/model/cash-change-rows.ts:43-46`; printed in `order-receipt-print.tsx:223-224` and `order-payments-print-rprt.tsx:132-136` | `change_returned_amount` on the payment row is the **rounded** change (API `changeReturned` 3.08). The builder treats it as exact, then subtracts the adjustment (−0.006) again: 3.080 + 0.006 = 3.086 | Bug (committed; the ledger posting is correct, the print is wrong) | `exactChange = stored + adjustment`, `handedOut = stored` (or persist the exact change separately). |
| r3-g | `SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER` blocks pay-on-collection and shows a raw code | `lib/services/order-submit-orchestrator.service.ts:1076-1077`; legs built at `:353-363`, `:441`; `shouldCreateReceiptVoucher` at `order-settlement-planner.service.ts:212`; UI `src/features/orders/hooks/use-order-submission.ts:592` | A POC-only submit sends one `PAY_ON_COLLECTION` leg. `settlementLegs.length` = 1, but the planner keeps no real or credit leg, so the voucher flag is false and the guard throws. The client prints `json.error` verbatim, with no i18n map. The red toast on the successful cash order points to a second submit or settle request carrying a deferred leg. Confirm with a network trace | Bug (committed; the working-tree diff of the orchestrator only adds `PAYMENT_METHOD_NOT_AVAILABLE`) | Count only non-deferred legs in the guard (`settlementLegs.filter(l => !DEFERRED_METHODS.has(l.method))`) and map the code to a translated message. |
| r3-h | `sourceTotals.header*` ≠ derived while CURRENT and 0 mismatches | `lib/services/order-financial-write.service.ts:443-452` (pre-write read), `:780-786` (`sourceTotals` from that read), `:738-745` (`comparandsForSnapshotWrite`, `:297`), header write `:876-903` | `sourceTotals` is the header as it was **before** this recalculation; the writer then overwrites the header (DB 0014 now tax 0.42, outstanding 4.000). Warnings compare computed vs computed, because the writer is authoritative, so drift is repaired, not flagged | By-design (not a money error); naming misleads | Rename to `preWriteHeader*` (or document it in the API) and optionally emit `HEADER_REPAIRED` when pre-write ≠ derived. |
| r3-i | No Overpaid field; Details and Payments & Credits tabs look the same | `app/dashboard/orders/[id]/order-detail-client.tsx:372-385` (Details = `OrdersFinancialTabRprt` with payments and credit applications; Payments & Credits = `OrderPaymentsCreditsTables`); `map-order-financial-summary-view.ts:204,314` has `overpaidAmount`, but no `order-financial/*` component renders it | Both tabs list the same payment and credit rows; the Overpaid amount is mapped but never shown | UX gap (P2) | Render Overpaid (including 0.000) in the summary cards and make Details show the ledger or breakdown only. |
| r3-j | S8.2 / S8.6 no data | Charges are written only at submit (`settleOrderTx` breakdown, orchestrator `:1079`); the order API only has `charges/[chargeId]/void`. AR invoice requires `CREDIT_INVOICE` policy (`order-submit-orchestrator.service.ts:134-142,391-400`, credit-limit gate) | No tester path to add a delivery charge on Preview; there are no invoice-plan orders | Setup gap | See FET-LLMS-S30. |
| r3-k | `/full` Name blank; payment method CARD only | `lib/db/orders.ts:532-550` (`getOrderById` selects only `name`/`name2` for the customer); `order-details-full-client.tsx:1661` renders `first_name last_name`; `:1757-1760` renders header `payment_method_code` | Fields not selected, so the Name is blank. The header holds a single method code | Bug (P2) | Render the shared display name (r3-d), and list the distinct methods from the payment rows. |
| r3-l | Ready "Loading actions…" never resolves | `src/features/workflow/ui/WorkflowActionBar.tsx:200-207`; `lib/hooks/use-workflow-actions.ts:93-127` (`fetch /api/v1/orders/{id}/available-actions`, `finally setLoading(false)`) | The hook always clears loading in `finally` and its callbacks are memoized, so a permanent skeleton means the `available-actions` request did not settle (8–20 s page renders were seen). Not reproduced in code | Needs repro (network trace) | Add a fetch timeout and an error state; check `available-actions` latency for `screen=ready_release`. |

### Tester suggestions — Financial_Expert_Tester (r3 additions)

- **FET-LLMS-S22 (P0):** Commit and deploy the working-tree fixes for BF-10, BF-21 and PF-21 (r3-a/b/c). Add a visible build id (for example `/api/health` with the commit SHA) so testers can confirm what Preview runs.
- **FET-LLMS-S23 (P0):** Pay-on-collection submit is blocked. Make the `SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER` guard (`order-submit-orchestrator.service.ts:1076`) ignore deferred legs (r3-g).
- **FET-LLMS-S24 (P1):** Never show raw error codes. Map submit error codes to translated EN/AR messages (`use-order-submission.ts:592`), and find the second request that raises the voucher toast on a successful cash order (r3-g).
- **FET-LLMS-S25 (P1):** Fix the receipt cash-change block (`cash-change-rows.ts:43-46`). Exact = stored + adjustment, handed out = stored; expect 3.074 / 0.006 / 3.080 (r3-f).
- **FET-LLMS-S26 (P1):** Use one customer display-name helper (`display_name` first) on Ready, the prints and `/full` (`ready-order-types.ts:109-113`, `lib/db/orders.ts:874-878`, `order-details-full-client.tsx:1661`) (r3-d, r3-k).
- **FET-LLMS-S27 (P1):** Ready By on Ready and prints should use `ready_by_at_new` (timestamptz) first (`ready-order-types.ts:161`) (r3-e).
- **FET-LLMS-S28 (P2):** Show Overpaid (including 0.000) on order detail, and make the Financial Details and Payments & Credits tabs distinct (`order-detail-client.tsx:372-385`) (r3-i).
- **FET-LLMS-S29 (P2):** Rename or document `sourceTotals.header*` as the pre-write header and optionally flag `HEADER_REPAIRED` (`order-financial-write.service.ts:780-786`) (r3-h).
- **FET-LLMS-S30 (P1):** Seed or document Preview data for S8.2 and S8.6. For S8.2: a delivery-fee setting, or one seeded order with a delivery charge row. For S8.6: a customer with a credit limit > 0, plus steps to submit an order with payment method INVOICE (`CREDIT_INVOICE`), and an invoice covering 2 orders (r3-j).
- **FET-LLMS-S31 (P2):** `/full` should list every payment method on mixed orders (`order-details-full-client.tsx:1757-1760`) and always show the currency on line amounts (r3-k).
- **FET-LLMS-S32 (P2):** Ready action bar: add a timeout and an error state to `use-workflow-actions.ts`, and check `available-actions` latency (r3-l).
- **FET-LLMS-S33 (P2):** S8.8 needs an own target. Seed a second open order for the QA customer so allocation can be submitted without touching others' orders.

### Retest plan — Round 4

1. **Precondition:** FET-LLMS-S22 deployed, with the build id matching the commit.
2. Rerun **S7 PF-21 steps 1–4**. Expect a remove control, Express keeping 30.300, and removal under Express giving the Express price, with submit OK.
3. Rerun **S8.1** on ORD-20261023-0003 and ORD-20261014-0001. Expect real line totals on Ready and on both 80mm prints. Also check the customer name (S26), Ready By 10:00 AM (S27), and that the action bar loads (S32).
4. Rerun **S8.7**. Expect 404 `ORDER_NOT_FOUND`.
5. After S23 and S24: create a new pay-on-collection order (**S8.5**) and a cash order with change. Expect no red toast, and receipt exact/loss/handed out of 3.074 / 0.006 / 3.080 (S25).
6. After S30: **S8.2** (void a delivery charge) and **S8.6** (AR invoice, multi-order share).
7. After S33: **S8.8** allocation to the seeded target. Expect paid, balance and payment status updated.
8. Carry-over from Round 3 items 1–4, 6 and 7 (custom role for S5, S5 API, S6 exemption, S3 mobile, drawer, New Order guard), all still open.


## Financial_Expert_Tester Results — 2026-11-07 (Round 4 progress batch 1)

**Run:** Preview `/dashboard/orders/new`, Demo Laundry (`11111111-1111-1111-1111-111111111111`), admin; 2026-11-07 14:26 Asia/Muscat (UTC+4); English, 1920×1072. Returned browser evidence recorded below; no completed submit or server-side/persistence proof claimed. Earlier rounds and owner cells remain unchanged.

| # | Result | Evidence |
|---|---|---|
| S7 | **PARTIAL** | PF-21 cart UI regression **PASS**: Bathrobe Standard baseline subtotal 1.800, tax 0.126, total 1.926 OMR. Override 2.100, reason `QA-20261107 PF21 override retest`: subtotal 2.100, tax 0.147, total 2.247. Reset under Standard restores 1.800. Express preserves the typed 2.100 override. Reset under Express restores 2.250 (premium 0.450), tax 0.158, total 2.408. Characterization/owner sign-off was not newly verified, and completed submit is unproven: Submit Order was disabled; no separate payment-preview control observed. Cause not established. No order submitted. |
| S5 | **PARTIAL** | Override-reason UI validation **PASS**: blank reason displays `Reason is required for price override`; minimum 10 characters noted. Positive cart override exercised as above. Persistence, actor audit, server refusals, negative-role control and completed submit were **NOT RUN** in this batch. |

**Provisional counts (tested parent scenarios only): PASS 0 · FAIL 0 · PARTIAL 2 (S5, S7) · BLOCKED 0.** These counts do not supersede earlier-round counts and do not count substep passes as full scenario passes. All remaining scenarios await this run's evidence.

**Evidence:** screenshots `/workspace/qa-20261107/shots/ll-s7-01-baseline-standard.png` through `/workspace/qa-20261107/shots/ll-s7-10-empty-cart.png` (returned browser evidence series; relevant baseline/override/reset/Express/cleanup states).

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch 1)

- **FET-LLMS-Nov07-S7 (regression result):** PF-21 reset and Express-preserves-override cart behaviors now pass the observed UI checks. Keep automated coverage for Standard reset, Express override preservation and Express reset. This is not a completed-submit pass; characterize the disabled Submit separately before attributing a cause.
- **P3 FET-LLMS-Nov07-S5-Picker:** Existing `Jh Test dev21` Quick Select was selected, but the results area also said `No customers found` despite the customer card. Contradictory empty-state observation only; diagnosis pending. Recommendation: verify which search/result state the empty message describes, then align/hide that message when an applicable result card is present. No source-level cause asserted.

### Test data left behind

No saved customer/order/payment data changes. Item and selected customer cleared; Standard restored; 0 cart items at end (`ll-s7-10-empty-cart.png`). POS and drawer unchanged. No order submitted, payment recorded, policy/role edited or password changed.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch 2)

**Run:** 2026-11-07 14:34 Asia/Muscat (UTC+4), Preview, Demo Laundry LLC (`11111111-1111-1111-1111-111111111111`), admin, EN/AR, 1920×1072. Returned UI evidence; no order/payment/workflow writes, no printing sent. English restored; no dirty draft.

| # | Result | Evidence |
|---|---|---|
| S1 | PARTIAL | Saved financial data loads correctly on two same-tenant orders. Negative orders:read and cross-tenant refusal not tested. |
| S8 | PARTIAL | S8.1 Ready zero-line regression PASS on ORD-20261105-00008 (`0a27746d-5667-4342-999a-055d8ced7d4d`): Shirt line 0.800, tax 0.056 (VAT0.040 + Municipal0.016), total/paid0.856, due0 OMR; Paid / Pay in advance / Reconciled. A4 receipt preview total/paid0.856 due0, closed without printing. S8.4 no false mismatch PASS on observed saved states only; after-refund untested. NEW identity FAIL: list/detail customer Jh Test dev21, but Ready AND receipt Test Customer2 Mohammed Ahmed. S8.1 entire scope remains PARTIAL: other fixtures/print types untested and identity defect present. S8.2/3/5/6/7/8 not executed in this batch. |

Order ORD-20261105-0003 (`cd4ac165-9a37-4b5e-9300-59152ca8e236`): lines0.800 +1.000, tax0.126 (VAT0.090 + Municipal0.036), total1.926, paid0.856, due1.070; Pay in advance / Partially paid / Reconciled. Correct saved figures; do not label this a POC order.

**Evidence:** `shots/ll-s8-01-order00008-detailed-financial.png`, `ll-s8-02-order00008-full.png`, `ll-s8-05-orders-sidebar-list.png`, `ll-s8-06-ready-order00008.png`, `ll-s8-07-ready-order00008-a4-receipt-preview.png`; all under `/workspace/qa-20261107/`. Additional 0003 figures: `shots/reuse-01-order0003-financial-summary.png`, `reuse-02-order0003-financial-details.png`.

**Provisional cumulative parent counts this run:** PARTIAL4 (S1,S5,S7,S8); PASS0/FAIL0/BLOCKED0 at parent level. Identity subcheck FAIL; financial/Ready subcheck passes are not full scenario passes. All other parents NOT RUN.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch 2)
- **P1 candidate FET-LLMS-Nov07-S8-Identity:** Cross-surface customer identity mismatch, exact names above, Ready and receipt versus list/detail on same UUID. Cause unconfirmed; no current source diagnosis available. Verify canonical customer display identity and align Ready/receipt with order detail; add regression coverage. Do not assert a specific field/source cause yet.
- **FET-LLMS-Nov07-S8-Regression:** Ready line and receipt header figures now match saved data on 00008; broaden remaining print/fixture coverage before full S8 signoff.
- **Ancillary FET-LLMS-Nov07-Navigation:** Background HTTP504 `/api/navigation` observed while subject pages still rendered. Record request timing/build on repeat; root cause not established.

### Test data left behind
None changed; no orders/payments/workflow/printing writes; no dirty draft. POS/drawer unchanged.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch 3: HQ prerequisites)

**Run:** 2026-11-07 14:48 Asia/Muscat (UTC+4), HQ, English1920×1072, visible user System Administrator. Inventory only; no draft/create/clone/publish/role mutation activated. Setup inventory is not a product-test PASS.

| # | Result | Evidence |
|---|---|---|
| S9 / S10 / S13 / S22 prerequisites | BLOCKED (setup only) | Requested effective ITEM/PIECE capability rules are not enabled. No scenario execution or postconfiguration signoff in this batch. |

STANDARD (`f0fc3115-d9f4-4f6d-9350-5a16e4ab3bb6`) PILOT rev3,230/702 rules. More actions offers Clone to new draft, Create draft, Publish; none activated. All five requested Processing pairs simulate DENY `CAPABILITY_POLICY_NOT_ENABLED`: CHANGE_SERVICE_SPEED ITEM/PIECE, CHANGE_DISCOUNT ITEM/PIECE, CHANGE_ITEM_PRICE ITEM. Processing existing15 rules comprise4 WARN and11 REQUIRE_OVERRIDE; ORDER speed Require override; ORDER discount absent; Item price has no ORDER counterpart. Preserve operation/target distinctions; no invented decisions.

WF_V2_SIMPLE v4 coverage307 issues, incomplete: missing five pairs at Processing/Preparing and inactive-status issues. Fill deny NOT used. Demo organization assignment is All profiles, no defaults. Starter description says Unassigned despite current assignment (minor stale-description observation).

FULL_PATH (`346dc050-cbbd-48e3-9e86-afebe126f531`) PILOT rev8,260/702, unassigned. Processing Item price explicit Deny, `CAPABILITY_POLICY_NOT_ENABLED`, `orderChange.policy.notEnabled`. Do not replace explicit denial with a presumed allowance or reactivate obsolete tenant PROFILE linkage.

Evidence under `/workspace/qa-20261107/shots/`: `hq-policy-inventory-list.png`, `hq-policy-inventory-standard-processing.png`, `hq-policy-inventory-processing-simulation-deny.png`, `hq-policy-inventory-processing-speed-piece-deny.png`, `hq-policy-inventory-coverage.png`, `hq-policy-inventory-standard-assignment.png`, `hq-policy-inventory-fullpath-item-price-deny.png`.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch 3)
- **FET-LLMS-Nov07-PolicyPrereq:** Draft/publish needs intentional per-status decisions and effective-link verification. Missing-rule deny is correct fail-closed behavior; preserve current ORDER speed override/reason and protected statuses. Coverage gaps are setup evidence, not proof of a resolver defect.
- **P3 FET-LLMS-Nov07-PolicyDescription:** Starter description says Unassigned while Demo All profiles assignment is present. Verify description intended meaning and update stale explanatory copy if warranted; cause unconfirmed.

**Counts:** this batch adds4 BLOCKED parent prerequisites (S9,S10,S13,S22), no PASS; earlier PARTIAL results remain. No policies, roles, orders or payments changed.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch4: responsive financial retest)

**Retest:** 2026-11-07 15:12:44 Asia/Muscat (UTC+4), Demo Laundry/admin, Chrome actual device mode configured360/1024/1440, EN/AR; EN restored at configured1440. Configuration labels are not independently exact viewport measurements: tool1081×1040 versus screenshot1041×1002 makes the1024 evidence measurement PARTIAL. No commercial/workflow/printing writes; only preferences/locale. Prior rounds/observations preserved.

Order0003 UUID `cd4ac165-9a37-4b5e-9300-59152ca8e236`: saved/reference figures total1.926,paid0.856,due1.070 OMR; lines0.800+1.000,tax0.126,Reconciled. Correct statement shows balance-first with at most3 other figures. No POC,paidextra,delivery,discount fixture coverage claimed.

| # | Result | Evidence |
|---|---|---|
| S8 reader consistency retest | PARTIAL overall; workspace subcheck FAIL | Order0003 statement/reference1.926 total/0.856 paid/1.070 due remains correct; workspace header Order total0.000 is inconsistent. Exact workspace route above. Raw key `orders.detail.workspace.paymentPlans.pay_in_advance` displayed. No current code diagnosis. |
| S8.1 identity retest | FAIL identity subcheck; amounts PASS | Independent reload00008 UUID `0a27746d-5667-4342-999a-055d8ced7d4d` confirms detail Jh Test dev21 versus Ready Test Customer2 Mohammed Ahmed. Ready financial amounts remain correct; do not confuse amount regression pass with identity integrity pass. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch4)
- **P1 FET-LLMS-Nov07-WorkspaceTotal:** Subject financial reader shows0.000 on workspace versus saved/reference1.926. Diagnose snapshot display path before assigning cause; align authoritative total and add regression. Evidence `shots/reuse-device-en-1440-workspace-mismatch.png`. — Retest 2026-11-09: not reproduced (own-order editor totals now match 4.783). — Retest r2 2026-11-10 (remote, new deploy, read-only): fix holds (editor Total 4.783, "No money change").
- **P1 candidate FET-LLMS-Nov07-S8-Identity (retest):** Independent loaded screenshots reproduce mismatch: `shots/reuse-device-en-1440-00008-detail-reload-loaded.png` / `reuse-device-en-1440-00008-ready-recheck-loaded.png`. Cause pending; prior finding not overwritten.

**Provisional cumulative Line-Level parent counts unchanged:** PARTIAL4 (S1,S5,S7,S8),BLOCKED4 (S9,S10,S13,S22 prerequisites),NOT RUN15; no parent PASS/FAIL. Workspace and identity subchecks FAIL, recorded explicitly without claiming all S8 executed. No Manual Edit interactions in this batch; no Manual guide appendix justified.

### Test data left behind
No saved data/payments/workflow/printing changes; preferences/locale only, EN restored. Policy clone/publication in progress elsewhere is NOT a completed outcome here.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch5: policy draft attempt)

**Run:** 2026-11-07 15:25 Asia/Muscat (UTC+4), HQ policy prerequisite attempt; returned UI evidence. This is setup, not an Edit scenario PASS.

| # | Result | Evidence |
|---|---|---|
| Requested five ITEM/PIECE capability-rule setup | BLOCKED | Separate Draft created but required operation-target rows absent from editor, no per-cell add observed. No rule changes/publication/assignment completed. |

**Original unchanged:** `f0fc3115-d9f4-4f6d-9350-5a16e4ab3bb6`, `ORDER_CHANGE_STANDARD_V1`, PILOT rev3, read-only. **Leftover separate clone:** `a6f6c2ef-8d69-4ab1-9770-d99e33730b62`, `ORDER_CHANGE_STANDARD_QA_20261107_V1`, name `Standard Order Change 20261107`, DRAFT rev2 (clone rev1, metadata save rev2), unassigned at every scope,230/702 inherited rules. This is a separate policy, NOT a new revision in the original policy lineage.

Owner intent: Allow with warning on editable statuses, preserving explicit DENY. Current active-v4 candidate editable statuses seen: Intake/Preparing/Processing; Awaiting collection and Ready/Delivered/Cancelled retain15 DENY cells; Assembly/QA/Packing inactive. These observations are not permission to alter protected rules or other versions. Five requested rows: CHANGE_SERVICE_SPEED ITEM/PIECE; CHANGE_DISCOUNT ITEM/PIECE; CHANGE_ITEM_PRICE ITEM. They were absent as editable rows; only Fill missing only and Reset suggestions available, neither used. Coverage307 issues incomplete. No new rule saved, Publish/Start pilot not activated, no assignment/default changed.

**Documented method check (read-only existing plan):** Extend_Order_Edit_policy_Plan.md line565 requires HQ matrix to load pairs from catalog, not a fixed13-code list. Lines1388–1390 specify active-status matrix and Smart fill as a proposal only; lines415–417 no automatic ALLOW backfill and money/payment proposals DENY. Lines188–189 document read-only catalog and Smart fill; they do NOT explain Fill missing only versus Reset suggestions preservation semantics, a target-filter repair step, or how to add missing per-cell rows. Therefore no verified safe normal-UI method to expose these five absent rows was established from available docs. Do not use Reset suggestions on assumption it preserves populated cells. Do not clone other profiles while same blocker persists; no internal API/DB-write bypass.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch5)
- **P1 candidate FET-Policy-Nov07-MissingTargetRows:** Editor cannot currently expose requested operation-target rows for this setup attempt. Confirm catalog availability and normal UI filters/target selection through documented UI; if absent, editor should render all active catalog pairs—including the five requested ITEM/PIECE pairs—as independently editable missing cells while preserving populated decisions. Document Fill missing only/Reset suggestions semantics and preview a non-destructive diff. Cause not diagnosed; no source defect asserted beyond observed UI deficiency.

**Evidence** under `/workspace/qa-20261107/shots/`: `hq-standard-draft-original-pilot-readonly.png`, `hq-standard-draft-details-rev2.png`, `hq-standard-draft-unassigned.png`, `hq-standard-draft-wf-v2-simple-v4.png`, `hq-standard-draft-rules-preparing.png`, `hq-standard-draft-deny-cells.png`, `hq-standard-draft-coverage-v4.png`.

### Test data left behind
Separate unassigned DRAFT clone above, rev2, metadata saved. Source policy/rules/links unchanged; no publish/pilot/assignment, order/payment/workflow writes. No other profile cloned in this attempt. Existing subject scenario results remain unchanged; setup BLOCKED tracked separately.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch6: Create preview)

**Run:** 2026-11-07 15:51 Asia/Muscat (UTC+4), Demo admin, Main Branch2, EN1440×985 CSS. Existing POS/drawer untouched. Existing customer Jh Test dev21, Counter/in-branch, one Bathrobe Standard1.800 +tax0.126 =total1.926 OMR.

**Observed prerequisite resolution:** Ready By absent kept Submit disabled in THIS flow; applying Nov8 16:00 Asia/Muscat enabled Ready to submit. No disabled-Submit bug claimed. This establishes the observed-flow explanation only, not a retrospective diagnosis of every earlier disabled state.

**Cart regression PASS:** override2.100 with reason `QA-20261107 override preview` preserved under Express; reset under Express2.250; restoring Standard1.800. Payment modal showed Pay later Applied / Pay on Collection available (as observed labels), not evidence of a saved settlement type. Cash0.500 typed: unsaved preview settled0.500, remaining1.426; Financial summary agrees, closing it preserves typed0.500. No payment/order submitted. Line-discount options inspected then canceled, no discount coverage claimed.

**Evidence** under `/workspace/qa-20261107/shots/`: `create-preview-baseline-cart.png`, `create-preview-readyby-picker.png`, `create-preview-readyby-enabled.png`, `create-preview-override-standard.png`, `create-preview-express-override.png`, `create-preview-express-reset.png`, `create-preview-standard-restored.png`, `create-preview-payment-poc.png`, `create-preview-cash-partial.png`, `create-preview-financial-summary.png`, `create-preview-discount-dialog.png`, `create-preview-final-empty.png`.

| # | Result | Evidence |
|---|---|---|
| S7 PF21 cart retest | PARTIAL parent / cart subchecks PASS | Override/Express/reset pass and payment preview now reachable after applied Ready By. Owner characterization signoff and completed submit/persisted figures remain unproven. |
| S5 permitted override preview | PARTIAL | Typed override/reason and preview observed; persisted actor/reason/server/negative-role coverage not performed. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch6)
- **FET-LLMS-Nov07-S7 (observed prerequisite follow-up):** Explicit future Ready By enables Submit in this Create flow; retain normal required-field gate, no defect attributed. Prior disabled-control uncertainty narrowed only for this observation.

**Counts:** S5/S7 remain PARTIAL, not full saved-submit PASS; prior reader failures/setup blockers unchanged. No saved/AR test passes added.

### Test data left behind
No saved order/payment/customer/workflow changes. Modal canceled and cart discarded:0 items,customer cleared,Standard restored,notes cleared. Ready By remains displayed only as unsaved form state. POS/drawer unchanged. No policy change outcome recorded.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch7: dedicated POC fixture)

**Created:** 2026-11-07 16:02 Asia/Muscat (UTC+4); inspected16:17, Demo Laundry admin/Main Branch2, EN1440×985 CSS. Authoritative detailed fixture ledger: `/workspace/qa-20261107/create-poc-ledger.md` (note caveat below supersedes any unqualified lost-data interpretation).

**Saved dedicated order:** `ORD-20261107-00001`, UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9`, existing Jh Test dev21; Counter(in branch),Standard,Ready By Nov8 16:00 Asia/Muscat. Processing/preparation pending,revision1,Edit access OPEN; no workflow transition/Edit Apply performed.

**Correct persisted money:** Bathrobe override2.100 (baseline1.800), reason entered `QA-20261107 persisted override`; Shirt Ironing Only catalog0.300,10% discount **0.030**,net **0.270** (NOT a0.270 discount). Full Items &extras2.400 minus line discount0.030=subtotal2.370;VAT0.119+Municipal0.047=tax0.166;total2.536 OMR. No charges/delivery. Paid0,credits0,due at collection2.536; explicit Pay later applied/Pay on Collection confirmed,Reconciled/PENDING COLLECTION. Confirmation accepted once,success toast/cart reset; no real payment taken.

**Notes observation, provisional FAIL:** `QA-20261107-CREATE-POC-01` appeared in pre-submit Notes but was absent from saved Notes after reload. Notes Save had been enabled; whether required explicit Save/apply was omitted is NOT isolated. Missing explicit Save is a plausible alternative to a product persistence defect. Do not diagnose lost-data code defect until next controlled note-control check.

**Duplicate-selection boundary:** second identical Bathrobe merged into Create quantity2, then reduced to1 and distinct Shirt selected. Expected Create behavior, not evidence of an Edit duplicate-line targeting failure.

**Evidence** `/workspace/qa-20261107/shots/`: `create-poc-override-dialog.png`, `create-poc-shirt-catalog.png`, `create-poc-pre-submit-panel.png`, `create-poc-payment-poc-zero.png`, `create-poc-confirm-zero-poc.png`, `create-poc-order-created.png`, `create-poc-order-header.png`, `create-poc-items-after-reload.png`, `create-poc-reconciled-after-reload.png`, `create-poc-full-records.png`, `create-poc-edit-status.png`, `create-poc-duplicate-merge.png`.

| # | Result | Evidence |
|---|---|---|
| S8.5 POC zero-payment create | PASS subcheck | Explicit POC saved,paid0/full2.536 due; old SETTLEMENT_LEGS_REQUIRE_RECEIPT_VOUCHER422 did not occur on this creation. No general rounding/other deferred-method claim. |
| S5 permitted override persistence | PARTIAL parent / persisted price PASS | Reload Bathrobe2.100 retained. Entered override reason/actor not exposed in History/Change History/Full records; generic committed-by is not override attribution. Server audit/negative role/refusal paths not proven. |
| S7 PF21 persistence follow-up | PARTIAL parent / persisted price PASS | Previous cart reset/Express behavior passed; saved override now retained. Owner characterization signoff, complete saved-reset/Express cases and audit visibility not all proven. |
| Create line discount persistence | PASS subcheck | Shirt0.300 less0.030=0.270 retained; Full discount0.030. This is not Edit S10/S13 coverage. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch7)
- **FET-LLMS-Nov07-POC-Retest:** Dedicated zero-payment POC creation now passes observed regression; retain exact deferred0-paid fixture for further tests.
- **FET-LLMS-Nov07-OverrideAudit:** Price persistence passes; reason/actor UI attribution still unproven. Verify intended audit surface before claiming absent DB audit.
- **FET-LLMS-Nov07-Notes-Provisional:** Repeat controlled Notes explicit-Save versus unsaved input submission to separate required UI semantics from true persistence loss. Provisional observation FAIL only; cause unresolved.

**Parent counts unchanged:** PARTIAL4(S1,S5,S7,S8),BLOCKED4(S9,S10,S13,S22 prerequisites),NOT RUN15. Added measured leaf checks: POC create PASS,override price persistence PASS,line-discount persistence PASS,audit visibility PARTIAL,notes provisional FAIL. These are not full saved/AR/Edit passes.

### Test data left behind
One dedicated saved order UUID/code above,2.536 OMR unpaid POC,initial processing/pending,revision1 OPEN. No payment/refund/collection/workflow/Edit Apply/print/message made. POS/drawer unchanged. Override reason entered and discount persisted; note absent with explicit-Save caveat. No other new order in this batch.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch8: controlled core Edit)

**Retest r5/core Edit:** 2026-11-07 16:37:44 Asia/Muscat (UTC+4), Demo Laundry/admin, EN1440×985 CSS; AR clean-context check then EN restored. Only dedicated `ORD-20261107-00001` UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9` changed. Detailed returned evidence `/workspace/qa-20261107/man-core-edit-ledger.md`.

| # | Result | Evidence |
|---|---|---|
| S5/S7 preserved override follow-up | PARTIAL parents; persistence subcheck PASS | Quantity Edit kept2.100 override/unit and existing Shirtdiscount.030/net.270. No speed/price/discount operation attempted; no S9/S10/S13 completion implied. |
| History attribution observation | FAIL display subcheck | One successful Change with persisted reason but Applied by Unknown user; DB actor absence not proven. |

Bathrobe quantity1→2 preserves override2.100/unit,line4.200; Shirt.300−discount.030=net.270 retained. Live card new4.783/was2.536/delta+2.247/balance4.783/To collect. Review matches numbers, but Updating persisted>25s and stale after Apply. Independent reload total4.783,tax.313,paid0,credits0,due4.783 POC/Reconciled; processing/preparation pending unchanged.

History exactly1Change#1,2ops,reason `QA-20261107 controlled quantity retest`,source order-edit,revision1→2,workflow version1; Applied by Unknown user. ItemUUID `2e052d4b-0c4e-4f20-a408-c29988ccbc80`; added pieceUUID `db4b929d-e1aa-4e96-8d2c-fd39428f7da6`,piece2/processing/expected. Single Apply click proves only observed single record, NOT lost-response retry or durable idempotency.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch8)
- **P1 candidate FET-LLMS-Nov07-HistoryActor:** Preserve attribution evidence and diagnose canonical display identity; no assumption absent server audit.
- **FET-LLMS-Nov07-CreateNoteClarification:** Edit Show notes has static Save caption, no separate Save button. Earlier Create-note missing result remains provisional; missing explicit Save button is not established cause.

Parent counts remain PARTIAL4/BLOCKED4/NOT RUN15; successful qty Apply is not a line-control/policy setup pass.

**Evidence** `/workspace/qa-20261107/shots/`: `man-core-baseline.png`, `man-core-note-review.png`, `man-core-note-discarded.png`, `man-core-quantity-staged.png`, `man-core-quantity-review-required.png`, `man-core-review-reason-required.png`, `man-core-review-reason-entered.png`, `man-core-review-ready.png`, `man-core-post-apply-balance.png`, `man-core-change-history.png`, `man-core-final-items.png`, `man-core-ar-context.png`, `man-core-final-en.png`.

### Test data left behind / current fixture state
Dedicated order now revision2,total4.783/tax.313/paid0/due4.783 OMR,POC,processing/pending,OPEN; Bathrobeqty2 atoverride2.100 and Shirtqty1 net.270;3pieces;one change/twoops/above reason. Note-only draft discarded. No other order/policy/payment/collection/refund/workflow/print/message changes. Final independent EN detail, no dirty draft. Original Create ledger remains historical baseline, not current total.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch12: independent tenant reads)

**Run:**17:17–17:25:33 Asia/Muscat (UTC+4),Demo admin,CSS1920×1072,EN/AR→EN;under10min. Full ledger `/workspace/qa-20261107/linelevel-independent-ledger.md`. No money/workflow/printing/tax/catalog/settings/role/policy/session writes;blankforms canceled. Final ownReady route.

| # | Result | Evidence |
|---|---|---|
| S14 | PARTIAL | Demo Finance has tax-profile guidance/no legacytaxrateform; defaultVAT5%+Municipal2% Active,no warning. OpenTaxSetup link click stayed onFinance,normal directTaxroute worked. ARcardRTL/Arabicguidance but Finance Settings titleEN; Tax Setup/title/columns/controlsEnglish/mixed. NOT full S14/BlueWave/historicaltax/no-defaultmutation pass. |
| S18 | PARTIAL | Six-level precedence/filters/rulesvisible;Express WinterCoat checkerAllproducts/allbranches+25%Applies,product-specificinactive;no active specific-vslower comparison. EconomycheckerApplies,visible+10% versus accessibility`+-10%` not resolved. BlankAddform inspected,canceled;no duplicate/abcvalidation/save/history/RBAC tested. |
| S19 | BLOCKED UIaccess | `/dashboard/catalog/services`: Catalog Services / Access not granted / `You need the admin:manage permission to view Catalog & Pricing. Ask your tenant admin to grant it.` No producttax/speed/New fields seen;no accesswidening/retry. |
| S20 | PARTIAL parent / detailReady netline subchecks PASS | Ownrev3,total4.783,tax.313,paid0,due4.783 POC. Bathrobe2×2.100=4.200;Shirtgross.300,discount.030,Afterdiscount.270 matchdetailReady. ReadyNotyetavailableforpickup,workflowunchanged,nozeroLine. No mixedtaxfixture/taxreport/cancel/tracking/dashboard test. Customerdisplaydiscrepancy alsoobserved;ledgerdoesnottranscribeexactnewfixturelabels,so nonamesinvented. |
| S21 | PARTIAL | Retireorrestoreproductrules dialogEconomy/Allcategories says `No active product rules match.` Retirerulesdisabled,canceled. No retire/restore/global30%rule/retail/RBAC/zero-seedcompletecoverage. |

**Exact S14Financeguidance:** `Tax rates are set as tax profiles in Tax Setup. Each order is taxed by the default profiles that apply to it; with no profile, no tax is charged.` Profilesreadunchanged VAT5%/Municipal2%defaultactive with disabledDeactivate. BlueWave notvisited.

**S18precedence:** Productonebranch→Productallbranches→Categoryonebranch→Categoryallbranches→Allproductsonebranch→Allproductsallbranches. Table1–5of52; observedinactiveExpressproductrules WinterCoat/Stockings/Hosiery/Poncho/LabCoat. BlankAddform is NOT duplicatevalidation evidence.

**Own financial reference:** Items&extras4.500−discount.030+VAT.224+Municipal.089=4.783;tax.313. Revision3/twoorderchanges unchanged. DetailReady lineandsummaryconsistent,no mismatchwarning observed.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch12)
- **P2 candidate FET-LLMS-Nov07-TaxNavigation:** Finance OpenTaxSetup clickleftpageinplace;normaldirectrouteworks. Recheck exactlink behavior beforecauseclaim;S14navigationcomponentnotpassed.
- **P2 FET-LLMS-Nov07-TaxAR:** Finance Settings titleEnglish,Tax Setup headings/controlsEnglishormixedinAR. Capture/translate actualUIstrings;profilenamesalonecanbeauthoreddata,notautomaticallytranslationdefect.
- **FET-LLMS-Nov07-S19Access:** admin:manageUIgate blocksproductcoverage;resolveviaauthorizedtenantadminprocess,notAPI/DBbypass. Currentaccountlabeldoesnotproveneededpermission.
- **P1 candidate FET-LLMS-Nov07-S20Identity:** Ownnewfixture detailReady labels differ. Exactnamesarenottranscribedinreturnedledger;retain screenshotsasprimaryevidence,nospecificlabelclaimorrootcause.

**Evidence** `/workspace/qa-20261107/shots/`: `ll-independent-s14-finance-en.png`,`ll-independent-s14-tax-en.png`,`ll-independent-s14-finance-ar.png`,`ll-independent-s14-tax-ar.png`,`ll-independent-s18-speed-pricing-en.png`,`ll-independent-s18-checker-express-wintercoat.png`,`ll-independent-s18-add-rule-form-en.png`,`ll-independent-s21-retire-dialog-en.png`,`ll-independent-s20-order-items.png`,`ll-independent-s20-order-financial-summary.png`,`ll-independent-s20-ready-detail.png`.

**Current23parent counts:** PARTIAL8(S1,S5,S7,S8,S14,S18,S20,S21),BLOCKED5(S9,S10,S13,S19,S22),NOT RUN10(S2,S3,S4,S6,S11,S12,S15,S16,S17,S23);no fullparentPASS/FAIL. Explicitfinancial/identity/localization leafoutcomesremainseparate.

### Test data left behind
No changes. Ownfixturelastverifiedrev3,total/due4.783,tax.313,paid0,POCprocessing/pending;twoChanges;Readyreads didnotmoveworkflow. POS/drawerunchanged;ENrestored,nodirtyforms.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch13: custom draft and limited loyalty read)

**Run:**17:26–17:32:41 Asia/Muscat (UTC+4),Demo admin,EN1920×1072CSS;within10min. Authoritative `/workspace/qa-20261107/public-fin-customitem-ledger.md`. OwnORD-20261107-00001/UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9`,revision3,processing/pending,total/due4.783,paid0,POC. No savedchanges.

| # | Result | Evidence |
|---|---|---|
| S11 | PARTIAL parent; custom draft subcheck PASS | CustomitemopensAddCustomItem;`QA-20261107 Custom Curtain`,price7.250,qty1 retained in draft/Review. ProposedAdditem+Addpiece;Needsanoverride/CAPABILITY_POLICY_OVERRIDE_REQUIRED,Reasonfield/Reviewasksforreason. No reason/Reviewagain/Apply. Cancel+Discard restoresrev3/0dirty/4.783,nocustomline. No committedcustomlineqty/reopen/negativepermission/AR pass. |
| S17 | PARTIAL limited read | FullFinancialRecords `Loyalty: None`;Total4.783/Paid0/Credits0/Due4.783,existing2Changes. No programactive/rate/outbox or customerledger attribution proof;no earn/delta/refund/cancel/redemption/idempotency outcome claimed. |

**Customquote:** helper `Charged at the price you enter. Speed premiums from the category still apply, and the line is taxed as a standard service.` Newtotal12.540,Was4.783,increase7.757,balance12.540;Reviewcurrent4.783/estimated12.5400,tax.820,OUTSTANDING. AdditemCustomCurtain andAddpieceNewpiece bothqty1/unit7.250,line7.250,serviceWASH_AND_IRON. Updatingremainedvisible (earlierlivecardfindingretained,no new precise durationclaim). Discardtoast `Changes were discarded.` Draft7.250 preservation is NOTdatabasepersistence.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch13)
- **FET-LLMS-Nov07-S11Preview:** Preserve customenteredprice/draftReview/discardregression;fullS11needscontrolledcommittedcustomfixture,not justpreview.
- **FET-LLMS-Nov07-S17EvidenceBoundary:** FullRecordsLoyaltyNoneislimitedorderdisplayonly;verifyactiveprogram/customerorderattributionbeforeclaimnoEARNunpaidcase.

**Evidence** `/workspace/qa-20261107/shots/custom-item-review.png`,`public-fin-full-records.png`. PubliclinkcopycontrolwasactivatedwithoutvisibleURL/toast;clipboardpastewasNOTtested,so NOappFAIL/definiteblock/severityclaim. NextnormalCtrl+V privatecontextpending;noURL/tokenread/copiedtoreport. Reusablepublicstatementevidencedeferreduntilactualpageopened. MAN011viewportcheckNOTRUN.

**Updated23parents:** PARTIAL10(S1,S5,S7,S8,S11,S14,S17,S18,S20,S21),BLOCKED5(S9,S10,S13,S19,S22),NOT RUN8(S2,S3,S4,S6,S12,S15,S16,S23). No fullparentPASS/FAIL.

### Test data left behind
No newrecords/payment/workflow/settings/policy/role/print/message. Customdraftdiscarded;ownrev3,total/due4.783,paid0,2Changes,ENcleandetail,nocustomitem. OriginalCreate-noteprovisionalfindingunresolved.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch14: reviewed read-only diagnosis)

**Supportingreadmethod:**2026-11-07 17:35:04–17:36:05 and17:37:26 Asia/Muscat(UTC+4),remoteDBviaestablisheduser-machinepsql;serverdefault_transaction_read_only=on verified,statementtimeout20s,onlyminimalcatalog/tenant-orderSELECTs. Credentialvaluesneverprinted/copied,sessionsecretcleared. No source/APIinspection,DBmutations or policy/role/taxwrites. Parentreviewed supporting `/workspace/qa-20261107/db-diagnosis.md`;sanitizedqueryresults`db-diagnosis-data1/2/3.txt`and`db-diagnosis-workspace.txt`. This adds diagnosiscontext,notnewUIrun/changedverdict.

### Tester suggestions / supporting evidence — customer display inconsistency
**FET-Nov07-CustomerDisplay-Clarification:** Both own`cce8a46e-a8f4-4346-8ca1-790182d1e1d9` andolder`0a27746d-5667-4342-999a-055d8ced7d4d` reference samecorrecttenantorgcustomer`264a0321-daac-4e88-a17f-d423134c7fad`,sameDemo1111tenant;globalrelationshipresolves. Ordercustomer_name snapshot andorgdisplay_name `Jh Test dev21`;orglegacyname/globaldisplay_name/globalname `Test Customer2 Mohammed Ahmed`. Olddetailmatchesordersnapshot/orgdisplay;Ready/receiptmatcheslegacy/globalname. CurrentUIinconsistencyFAILremainsvalid,butNOTproofwrongcustomerUUID/cross-tenantleak. DBshowsnamefielddivergence,NOTwhichUIpath/fieldisread. Ownfixturehasidenticalstorednamedivergence;exactcurrentUIcrosscheckseparate.
One-linefixrecommendation: renderoneconsistenttenant-facingdisplayidentitycontract acrossdetail/Ready/receipt,verifyrenderpathbeforechoosingfallback;noDBcustomerbulkoverwrite orassertedcodefilecause.

### Supporting evidence — actual workspace failure order storage
At17:37:26 readonlySELECTspecifically`cd4ac165-9a37-4b5e-9300-59152ca8e236`/Demo confirmsrevision2,CURRENT,subtotal1.8000,discount0,tax0.1260,total_amount1.9260,paid0.8560,due1.0700. Nested`financial_calculation_snapshot.derivedTotals` matches1.926/1.8/0/.126/.856/1.07. Thus actualearlierworkspaceheader0.000 conflictswithnonzerosavedcanonicaldataonSAMEorder;notjusta cross-ordercomparison. NoUIcodecauseproved. Recommendationworkspaceconsumesauthoritativesavedfinancialsnapshotconsistentlyandshowsunavailableinsteadofinventedzero,afterverifyingactualmapping.
Ownrevision3storedtotal4.783,tax.313,paid0,due4.783;older00008stored.856/tax.056/paid.856/due0;theirderivedtotalsandnonzerolinesconsistent. Threeordersnowseparatelyverified;no assumptionworkspaceonownfixturewasretested.

### Notes / unchanged data boundary
Currentowninternal_notes`QA-20261107-STALE-A-COMMIT`persisted;customer_notesempty. CannotrecoverunwrittenCreate-notehistoryorresolveoriginalCreateabsencefromcurrentEditnote. OriginalCreatefindingremainsprovisional,separateflow. No changesmade:ownlastverifiedrevision3,total/due4.783,tax.313,paid0,2Changes;priorUIverdictsandtestcountsunchanged.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch15: public tracking and small Edit subset)

**Follow-up:**17:33–17:41:29 Asia/Muscat(UTC+4),Demo admin,ownrev3ordercce8a46e-a8f4-4346-8ca1-790182d1e1d9;EN,final1920×1072CSS. ActualChromeUIincognito/clipboardpaste/device-toolbarused;noShellclipboard/API. Authoritativeupdated`/workspace/qa-20261107/public-fin-customitem-ledger.md`. No savedchanges;existingcustomdraftalreadyloggednotdoublecounted.

| # | Result | Evidence |
|---|---|---|
| S2 | PARTIAL | Validtokenpageworks;retiredreadableURL/no-redirect/ENARandeligibleConfirmreceivednotyettested. No wholeS2PASS. |

**Copy/publicroute subchecks PASS:** No toast is not failure. NormalCtrl+Vincognitoaddressbarconfirmedcopied`https://cmx.cleanmatex.com/track/[redacted]`;authorizedexistingtokenloadedanonymousCleanMateX/TrackYourOrder. No token/contactvaluesretainedinQAtext/screenshots. Signed-incontextrestoredafterincognitoclosed.
**Financialamounts PASS onthisfixture:** Items&extras4.500,discount−.030,tax+.313,total4.783,paid0,balance/due4.783;POCnoticeProcessing/remaining4.783consistent. TaxinclusivelinefiguresBathrobe4.494/Shirt.289sum4.783. No paid/creditentries;Charges/Credits/paymentmethodrowsnotdisplayed.
**Privacy limited PASS:** no staffwarnings/UUID/paymentreferencesobserved. Trackingpagealsohasnormalorder/status/timing/item/customersections;thesearenotautomaticallyfinancial-blockleakageorcrosscustomerdata. Guide10saysfinancialstatementshowscategoriesandNothingelse;availableguidetextdoesNOTexplicitlyrequireeveryzeroCharges/CreditsroworpermethodrowswhennoPayments. ThereforemissingzerorowsisP2contract-clarificationcandidate,NOTconfirmedfinancialgap/privacyFAIL. Do notadopttheledger'sunqualifiedwhole-pagefinancial-fields-onlyfailureinterpretation. Needstatement-boundaryandnonzerofixturebeforestrictminimizationconclusion.
Evidence`/workspace/qa-20261107/shots/public-fin-link-control.png`,`public-fin-statement.png`,`public-fin-balance.png`privacycropped.

### Tester suggestions — Financial_Expert_Tester(batch15)
- **FET-LLMS-Nov07-S2Token:** Copyworkswithouttoast;continuereadable-linkretirementseparately,no unsupportedcopyFAIL.

### Test data left behind
None;ownrev3,total/due4.783,tax.313,paid0,processing/pending,twoChanges;customdraftdiscarded(noadditionalcustomattemptcount). ENcleandetail,incognitoclosed,desktoprestored. No messages/linksend/revoke/payment/workflow/printing/policy/settings.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch19: S4/S6/S23 forms and fixture preflight)

**Run:** 18:08:32–18:17:31 Asia/Muscat (UTC+4), 8m59s. Demo tenant, English, 1440 CSS px. Authoritative ledger: `/workspace/qa-20261107/linelevel-s4-s6-s23-ledger.md`. No customer data entered; no order/customer/tax/preparation state saved or advanced. Earlier results and recommendations retained unchanged.

| # | Result | Evidence |
|---|---|---|
| S4 | PARTIAL | Orders list readable: Total Orders9 / Pending Prep8 / In Progress8 / Ready0 / Out for Delivery0 / Delivered Today0 / Overdue6; example OMR4.783. Status options Draft, Intake, Preparation, Processing, Ready, Ready for Pickup, Out for Delivery, Delivered; prep status/priority/order type/physical intake filters present. Filter-result correctness not demonstrated. New Order empty0pieces/0bags, no items, disabled Submit, catalog OMR3dp; no cart/payment/promo opened in this batch. Picker search name/phone/email had no distinct Quick Add or dedicated phone input. Side-panel Edit opened blank Edit Customer (required First Name/Phone, +968, optional email); Cancel, no Save. This does NOT prove a customer-create path or identity-lock violation in New Order. B2B Customers→New required Company Name/Phone and +968 selector, optional email; exited unsaved. Full S4 contract, Prepare add-item and crafted cross-tenant rejection not proved here. |
| S6 | BLOCKED — prior blocker retested | Config And Settings→Tax Setup→Tax Exemptions→Add: type/certificate/service/validity, no customer selector. Existing row Customer ID and Service Type both —; no active customer-linked fixture established. Cancelled. Missing fixture and UI association capability prevent exempt-customer calculation; zero VAT/total tax NOT proved, no normal-vs-exempt comparison staged. Prior blocked evidence preserved; no new source/DB diagnosis. |
| S23 | BLOCKED prerequisite | Orders submenu exposed Workboard and Processing, no separate Preparation link. Workboard Preparation0 / Processing8 / All8. No eligible Preparation/QuickDrop fixture; no Edit route/add/remove/no Delete/stored price-panel checks performed. This is not a Ready-page/full scenario PASS. Processing list read only. |

**Evidence:** `/workspace/qa-20261107/shots/ll-forms-orders-filters.png`, `ll-forms-orders-stats.png`, `ll-forms-orders-money.png`, `ll-forms-neworder-empty.png`, `ll-forms-neworder-customer-phone.png`, `ll-forms-b2b-customer-phone.png`, `ll-forms-tax-exemption-add.png`, `ll-preparation-workboard-queue.png` (all under shots).

### Tester suggestions — Financial_Expert_Tester (batch19)
- **P2 FET-LLMS-Nov07-S4-EntrySemantics:** Clearly distinguish customer create/Quick Add from empty Edit Customer in New Order; +968 field presence is verified but create/save validation remains untested. Avoid treating New Order as locked Edit identity context.
- **P1 FET-LLMS-Nov07-S6-AssociationRetest:** Existing customer-exemption selector gap remains observable. Provide supported customer association UI or owner-provisioned active customer-linked exemption fixture before claiming customer-specific zero tax; no forced DB setup.
- **P3 FET-LLMS-Nov07-S23-FixtureGate:** Provide a dedicated eligible Preparation/QuickDrop order before Edit/add/remove/no-Delete and stored-total checks; Workboard count0 is prerequisite evidence, not a product-failure diagnosis.

**Cumulative current-run 23-parent counts:** PASS0 / FAIL0 / PARTIAL12 / BLOCKED7 / NOT RUN4. NOT RUN: S3, S12, S15, S16. BLOCKED: S6, S9, S10, S13, S19, S22, S23. PARTIAL: S1,S2,S4,S5,S7,S8,S11,S14,S17,S18,S20,S21. These are parent coverage statuses, not erasure of earlier leaf failures or prior rounds.

### Test data left behind
No persistent changes or new fixtures. Forms cancelled/exited; own order `cce8a46e-a8f4-4346-8ca1-790182d1e1d9` restored clean EN1440px, revision3, Bathrobeqty2, total/due4.783 OMR, tax.313, paid0. No workflow/payment/preparation action. Existing fixture inventory unchanged.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch20: customer-app and price-drift environment preflight)

**Environment preflight only — 2026-11-07 Asia/Muscat (UTC+4).** No customer-app UI attempt, sign-in, OTP, service startup, source/API/SCM access or mutation. Narrow user-machine scan of `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` (33 lines): documented environment hosts only `https://cmx.cleanmatex.com` (line6) and `https://hqsaas.cleanmatex.com` (line18). No customer/mobile/Android/iOS/Flutter/Expo/TestFlight/APK/IPA reference found by metadata scan; no customer-app login entry identified. The credentials document was NOT copied; no account/contact/credential values emitted or requested. Memory and available QA notes supplied no genuine customer-app address/build. Existing QA rounds already record missing customer mobile build. This establishes missing access inputs for this run, NOT that no customer application exists. Tenant web-admin at phone width and public tracking are not customer-app substitutes.

| # | Result | Evidence |
|---|---|---|
| S3 | BLOCKED — environment inputs | No documented installable customer mobile build/openable customer-app URL, target platform/device setup or confirmed test environment supplied. Prior missing-build blocker retained; no mobile Orders detail/bearer-isolation test attempted. Need owner-provided genuine build/entry, backend mapping and authorized customer test-session path; do not paste bearer tokens into notes. |
| S15 | BLOCKED — environment inputs | Guide requires customer app against this server via API_BASE_URL and real demo customer. No documented customer-app build/entry/backend configuration identified; no booking/confirmation/error/Arabic checks attempted. Separate disposable missing-price/unavailable-workflow fixtures also needed before negative tests; no shared catalog changes authorized here. |
| S12 | BLOCKED — normal UI fixture setup | Guide requires ADD_ITEM at target status and a product with editable price list, then deliberate price drift before Review/Apply. Existing actual Catalog Services refusal at `/dashboard/catalog/services`: `Access not granted` / `You need the admin:manage permission to view Catalog & Pricing. Ask your tenant admin to grant it.` (linelevel-independent-ledger.md). Current account cannot establish price-drift fixture through that normal UI. Need authorized catalog manager and isolated editable product/price list with original values captured, plus ADD_ITEM policy prerequisite. No DB price write, role widening, fake Review or Apply claimed. |

### Tester suggestions — Financial_Expert_Tester (batch20)
- **P2 FET-LLMS-Nov07-CustomerAppInputs:** Document customer-app distribution/openable URL, platform/device instructions and backend/environment mapping separately from secret login details; provide authorized customer session entry without putting credentials/tokens in QA notes. Re-run S3/S15 only after genuine access inputs exist.
- **P2 FET-LLMS-Nov07-S12DriftFixture:** Provision designated normal-UI catalog manager and disposable mutable price fixture; verify ADD_ITEM policy before controlled drift, retain/restore original price only under explicit mutation scope. Current permission denial is prerequisite evidence, not a price-confirmation defect.

**Cumulative 23-parent counts:** PASS0 / FAIL0 / PARTIAL12 / BLOCKED10 / NOT RUN1 (S16). Newly classified S3/S12/S15 are environment/setup BLOCKED, not app FAIL. Earlier S4 PARTIAL / S6 BLOCKED and all earlier text remain untouched; leaf financial/localization failures remain valid.

### Test data left behind
None created/changed. Own order unchanged rev3/Bathrobeqty2/total4.783/tax.313/paid0/due4.783 OMR. No actor/order/customer/settings/policy or workflow changes.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch22: recorded discount/promo prerequisite inventory)

**Run:**2026-11-07 18:26:55–18:35:13 Asia/Muscat(UTC+4),8m18s; Demo tenant admin, EN desktop. Full authoritative `/workspace/qa-20261107/ll-promo-ar-edge.md` read. This batch completed read-only inventory, NOT the missing financial behavioral tests. No rules/promos/invoices/payments/tax documents/snapshots created, saved, disabled, issued, posted, collected, cancelled or deleted. Previous findings preserved unchanged.

| # | Result | Evidence |
|---|---|---|
| S16 | BLOCKED — suitable recorded-rule/promo fixture absent; inventory completed | Marketing Discount Rules and Promo Codes accessible. No qualifying order with recorded automatic rule/promo established. Own .030 Line Discount is manual Shirt discount, NOT an applied promo/rule fixture. Thus no quantity-based recalculation, below-minimum removal/acknowledgment, usage-count change, notes-only recorded-discount retention, Arabic removal or auto-promo booking proved. Missing fixture is not PASS or product FAIL. Customer-app booking also retains separate environment prerequisite. |

**Observed UI:** `/dashboard/marketing/discount-rules` had LLOYALTY2_DISCOUNT2/LLOYALTY_DISCOUNT1, both active but displayed Disabled; minitems1, minimum amounts5/3, stack-with-promoYes and different stack-with-other-rules. Create Rule preview showed code/name/rule type/discount type/value/priority/minimums/validity/stacking/Enabled; no customer/product selector or scope field observed. Cancelled with no Save; no claim customer-specific rule saved or isolated product-scoped setup available.

`/dashboard/marketing/promos` had typed and auto-apply promos, All/Active/Expired filters and code/name/type/value/maxuses/validity/Enabled/actions columns. Create preview code optional for auto-only; discount/maxdiscount, usage/percustomer limits, min/maxamount, Applicable Categories(comma-separated,empty=all), Applicable Customer Groups,validity/stacking/Enabled/Auto-apply. Scope is category/group, no individual-customer/product selector observed; no fields changed or Save. Existing promos present does not prove applied fixture/usage semantics.

**Own order read:**4.783 OMR due, paid0, manual Line Discount.030; no Promo entry, AR invoiceNone, AR receivable0. No re-evaluation attempted on unsuitable fixture.

### Tester suggestions — Financial_Expert_Tester(batch22)
- **P2 FET-LLMS-Nov07-S16Fixture:** Provide designated recorded minimum-rule and promo orders with original usage counts and controlled category/customer-group scope before tests. Do not enable broad rules or interpret manual line discount as automatic promo evidence. Customer-specific scoping was not exposed in observed form; no source cause inferred.

Evidence under `/workspace/qa-20261107/shots/`: `ll-promo-rules-list.webp`, `ll-promo-rule-form.webp`, `ll-promo-codes-list.webp`, `ll-promo-code-form-top.webp`, `ll-promo-code-form-limits.webp`, `reuse-edge-own-financial-summary.png`.

**Cumulative23parents:** PASS0 / FAIL0 / PARTIAL12 / BLOCKED11 / NOT RUN0. BLOCKED:S3,S6,S9,S10,S12,S13,S15,S16,S19,S22,S23. PARTIAL:S1,S2,S4,S5,S7,S8,S11,S14,S17,S18,S20,S21. NOT RUN0 means every parent now has evidence or explicit prerequisite classification, NOT complete behavioral coverage; earlier leaf FAILs remain.

### Test data left behind
No saved changes. Own `cce8a46e-a8f4-4346-8ca1-790182d1e1d9` remains rev3, manualdiscount.030,total/due4.783,tax.313,paid0 OMR. EN own-order detail restored, no form/modal. No actor/customer/workflow changes.


## Financial_Expert_Tester Results — 2026-11-07 (FINAL reconciliation: INCOMPLETE)

**INCOMPLETE — NO OVERALL PASS.** Original requested QA pass stopped after the completed evidence below; no further testing. Parent PARTIAL/BLOCKED/NOT RUN are unresolved coverage, and NOT RUN0 never means all subchecks passed. Earlier rounds/leaf FAILs remain unchanged. This is own final reconciliation, not an edit of author requirements or other editors' results. No source/spec additions or execution.

**Final parent counts:** PASS 0 / FAIL 0 / PARTIAL 12 / BLOCKED 11 / NOT RUN 0.

**FAIL IDs:** none
**PARTIAL IDs:** S1, S2, S4, S5, S7, S8, S11, S14, S17, S18, S20, S21
**BLOCKED IDs:** S3, S6, S9, S10, S12, S13, S15, S16, S19, S22, S23
**NOT RUN IDs:** none

### Qualified unresolved findings / recommendations
- P1 FET-FINAL-LL: Workspace header0.000 vs saved1.926 is financial display inconsistency; actual-order read-only DB confirmed nonzero storage, UI path cause unproven. Use server snapshot consistently. — Retest 2026-11-09: workspace 0.000 not reproduced on own order; new notes-only Estimated-total mismatch tracked as FET-LLMS-Nov09-NotesOnlyEstTotal. — Retest r2 2026-11-10 (remote, new deploy, read-only): workspace/editor 4.783 fix holds ("No money change"). Residual notes-only OUTSTANDING tracked as FET-LLMS-Nov10-NoChangeOutstanding.
- P1 FET-FINAL-Identity: detail/Ready labels disagree for same valid tenant customer; different stored display-name fields explain available data, NOT proven wrong customer/cross-tenant leak. Align tenant display contract, no DB overwrite.
- P2 FET-FINAL-LLPrereqs: Customer app, customer exemption, normal Catalog admin:manage/price fixture, missing ITEM/PIECE policy controls, automatic-rule/promo, QuickDrop and special fixtures remain required. Own notes-only Edit persistence does not resolve provisional original Create-note absence/save semantics.
### Test data left behind
Own cce8a46e-a8f4-4346-8ca1-790182d1e1d9 / ORD-20261107-00001 rev3,2Changes/3ops,Bathrobeqty2 at2.100,Shirt.300−.030=.270,total4.783,tax.313,paid0,due4.783,POCprocessing/pending; saved A note retained, unsaved drafts discarded. Unassigned/unpublished draft a6f6c2ef-8d69-4ab1-9770-d99e33730b62 rev2 unchanged; source policy unchanged, roles not granted due denied access. No latest extra records/messages/printing/password changes.


## Financial_Expert_Tester Results — 2026-11-08 (remote-only policy/access retest and parity adaptation)

**Remote UI evidence:**2026-11-08 16:36:02–16:41:06 Asia/Muscat(UTC+4),HQ System Administrator; full `hq-policy-role-retest.md` read. No toggles/fill/reset/save/publish/assignment/grant/account change. REMOTE ONLY per user direction: tenant `https://cmx.cleanmatex.com`, HQ `https://hqsaas.cleanmatex.com`; no more localhost/listener checks or service actions. cmx is tenant web-admin, NOT a newly supplied customer mobile app.

| # | Result | Evidence |
|---|---|---|
| S9/S10/S13/S22 prerequisite retest | BLOCKED missing Item/Piece rows; no new behavior PASS | Five target pairs absent on existing source/clone; saved speed/discount/price/history/piece paths not exercised. Existing Order speed override is not line-scope proof. |
Source actual `/en/order-change-config/edit-policies/f0fc3115-d9f4-4f6d-9350-5a16e4ab3bb6`:ORDER_CHANGE_STANDARD_V1 Pilotrev3,230/702. Processing15rules,4Allow with warning/11Require override/0Deny. CHANGE_SERVICE_SPEED Order=Require override, reason/orders:edit_override; NOT a substitute for Item/Piece. All five requested pairs still absent: CHANGE_SERVICE_SPEED Item/Piece, CHANGE_DISCOUNT Item/Piece, CHANGE_ITEM_PRICE Item. No row means no decision combobox/per-row disabled reason; no exposed per-cell add. Smart fill note only adds missing cells, NOT activated or validated as safe pair-add mechanism.
Existing clone actual `/en/order-change-config/edit-policies/a6f6c2ef-8d69-4ab1-9770-d99e33730b62`:ORDER_CHANGE_STANDARD_QA_20261107_V1 Draftrev2/230of702,unassigned/unpublished per current description; Processing same15/4WARN/11override/0DENY, same five pairs absent. Fill missing only/Reset suggestions NOT used; no new clone/type or protected decision changes. Source Pilot badge/list vs adjacent `Unassigned Draft starter matrix. HQ must review, promote, and assign it before any tenant can use it.` is qualified descriptive UX inconsistency, NOT proven lifecycle/backend resolution bug. No current tenant-side parity tested in this evidence.
### Tester suggestions — Financial_Expert_Tester(Nov8 remote policy)
- **P2 FET-LLMS-Nov08-LinePairs:** Expose a supported normal-UI authoring method for all requested operation-target rows without overwriting explicit denials. Smart-fill text alone does not establish correct five-pair additions; no fill/publish authorized here.
- **P3 FET-LLMS-Nov08-PolicyDescription:** Reconcile source Pilot status and stale draft-starter description; verify intended text before declaring lifecycle defect.
Parent counts unchanged PARTIAL12/BLOCKED11; full workstream incomplete.

### Test data left behind
None created/changed by this retest. Existing source Pilotrev3 and clone Draftrev2 preserved; no publish/assignment/grant. Order last-known Nov7 state is NOT independently verified by HQ-only retest. Final clean EN policy list; no messages/printing/password changes.


## Financial_Expert_Tester Results — Retest 2026-11-09 (remote, read-only, no Apply)

**Remote UI evidence:** 2026-11-09 16:21–16:32 Asia/Muscat(UTC+4), tenant `https://cmx.cleanmatex.com` Demo Laundry admin; own order ORD-20261107-00001. No Apply; drafts discarded; order still 4.783 OMR / 2 changes. Source ledger `/workspace/qa-20261109/tenant-editor-recheck.md`. Defect rechecks + one new financial finding — parent scenario counts unchanged.

| # | Result | Evidence |
|---|---|---|
| Workspace / editor totals match | PASS — prior 0.000 defect not reproduced | Editor Total 4.783 OMR; Order Items 4.500; Financial Details items +4.500, discount −0.030, tax +0.313, total 4.783, due 4.783. Prior workspace header 0.000 vs saved total not reproduced on this order. References **FET-LLMS-Nov07-WorkspaceTotal** / **FET-FINAL-LL**. |
| Notes-only Review Estimated total | FAIL (new P1) | Customer-notes-only draft (Before None → After QA-20261109-REASON-CHECK): Review Estimated total **4.830** vs Current **4.783** (+0.047); Financial result **OUTSTANDING**. Notes-only change must not shift estimated total. See **FET-LLMS-Nov09-NotesOnlyEstTotal**. |

### Tester suggestions — Financial_Expert_Tester (Nov9 line-level / editor money)
- **P1 FET-LLMS-Nov09-NotesOnlyEstTotal:** A notes-only change shows Estimated total 4.830 vs Current 4.783 with financial result OUTSTANDING. Keep notes-only Review financially neutral (estimated == current; no OUTSTANDING from notes alone); diagnose preview/calculation path. Evidence in `/workspace/qa-20261109/tenant-editor-recheck.md` and shots sand-subagent-8addfd1b-*. — Retest r2 2026-11-10 (remote, new deploy, read-only): amount FIXED (Estimated 4.7830 equals Current 4.783) but residual PARTIAL — 4-decimal display and Financial result OUTSTANDING with no money change. Residual tracked as FET-LLMS-Nov10-NoChangeOutstanding.
- Prior **FET-LLMS-Nov07-WorkspaceTotal** and **FET-FINAL-LL** annotated in place: workspace 0.000 not reproduced on own order.

**Parent counts unchanged:** PARTIAL12 / BLOCKED11. Defect recheck + new finding only — no author scenario newly fully satisfied. Overall workstream remains INCOMPLETE.

### Test data left behind
Nothing persisted. Drafts discarded; order ORD-20261107-00001 unchanged at Revision 3 / total 4.783 OMR / 2 changes. No Apply/payment/workflow/password changes; no messages/printing. Screens under `/workspace/qa-20261109/shots/` (sand-subagent-8addfd1b-*).

## Financial_Expert_Tester Results — Retest r2 2026-11-10 (remote, new deploy, read-only)

**Remote UI evidence:** 2026-11-10 ~14:30 Asia/Muscat(UTC+4), tenant `https://cmx.cleanmatex.com` Demo Laundry admin; own order ORD-20261107-00001. No Apply; drafts discarded; order still 4.783 OMR / 2 changes / rev3. Source ledger `/workspace/qa-20261110/tenant-editor-retest.md`. Defect rechecks + residual financial finding — parent scenario counts unchanged.

| # | Result | Evidence |
|---|---|---|
| Workspace / editor totals match | PASS — prior fix holds | Editor workspace total 4.783; "No money change". No stuck "Updating…". Prior workspace header 0.000 vs saved total still not reproduced. References **FET-LLMS-Nov07-WorkspaceTotal** / **FET-FINAL-LL**. |
| Notes-only Review Estimated total | PARTIAL — amount FIXED, residual remains | Customer-notes-only draft: Current 4.783; Estimated **4.7830** (equals 4.783; no longer 4.830). Financial result still **OUTSTANDING** despite no money change. 4-decimal Estimated display. See **FET-LLMS-Nov09-NotesOnlyEstTotal** and residual **FET-LLMS-Nov10-NoChangeOutstanding**. |
| No-change financial result | FAIL (new P2 residual) | Notes-only Review (no money change) still marks Financial result OUTSTANDING and shows Estimated as 4.7830 vs Current 4.783. A financially neutral change should not be outstanding. See **FET-LLMS-Nov10-NoChangeOutstanding**. |

### Tester suggestions — Financial_Expert_Tester (Nov10 line-level / editor money)
- **P2 FET-LLMS-Nov10-NoChangeOutstanding:** Notes-only Review is now amount-neutral (Estimated 4.7830 equals Current 4.783) but still shows Financial result OUTSTANDING and a 4-decimal estimated total. Keep a no-money-change Review financially settled (no OUTSTANDING) and format Estimated with the same 3-decimal OMR scale as Current. Evidence in `/workspace/qa-20261110/tenant-editor-retest.md` and shots under `/workspace/qa-20261110/shots/`.
- Prior **FET-LLMS-Nov09-NotesOnlyEstTotal** annotated in place: amount FIXED (4.7830 = 4.783) but residual PARTIAL (4-decimal display + OUTSTANDING with no money change).
- Prior **FET-LLMS-Nov07-WorkspaceTotal** and **FET-FINAL-LL** annotated in place: workspace/editor 4.783 fix holds ("No money change").

**Parent counts unchanged:** PARTIAL12 / BLOCKED11. Defect recheck + residual finding only — no author scenario newly fully satisfied. Overall workstream remains INCOMPLETE.

### Test data left behind
Nothing applied/saved. Drafts discarded; order ORD-20261107-00001 still 4.783 OMR, 2 changes, rev3. No passwords changed. No Apply/payment/workflow changes; no messages/printing. Screens under `/workspace/qa-20261110/shots/`.
