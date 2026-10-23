# QA Test Guide — Line-Level Money Snapshot + Reusable Order Fin View

**For:** the owner / tester, run in the tenant app (`web-admin`) after deploy. Each scenario lists where to go, what to do and what you should see.
**Covers so far:** execution steps 1 and 2b (security and correctness fixes) and step 3 (P1-01 sign-off). Later phases add sections here.

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

**Reproduce PF-21 in the UI** (known defect, expected to fail today):

1. In **Orders › New Order**, add an item and set a price override.
2. Remove the override.
3. **Today:** the line keeps the overridden price, and submit fails with a totals mismatch. **After the fix:** the catalog price comes back.

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
| S7 | **NOT RUN** (owner sign-off) / PF-21 repro **BLOCKED** | The P1-01 sign-off is for the owner (P1_01_CHARACTERIZATION.md §4.4); the tester did not run it. The PF-21 UI repro needs items on New Order, which is blocked by POS (as in S5). |

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
8. **Owner:** S7 sign-off in P1_01_CHARACTERIZATION.md §4.4 stays with the owner.
