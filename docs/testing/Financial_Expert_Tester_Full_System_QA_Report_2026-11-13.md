# Financial_Expert_Tester — Full-system first-use QA report

**Date:** 2026-11-13, Asia/Muscat  
**Tester:** Financial_Expert_Tester  
**Mode:** Observe-only on the deployed apps. No Save, Apply, Confirm, Publish, Pay, Assign, Create, or Delete. Mutate-and-restore and high-impact steps were not approved and were not run.  
**Apps:** [Tenant](https://cmx.cleanmatex.com) (Demo Laundry LLC, OMR, 3 decimals) and [HQ](https://hqsaas.cleanmatex.com).  
**How this was run:** Walked the live product as a new user from sign-in through every sidebar area and settings sub-page — not only the three feature guides tested earlier the same day. Operator and viewer walks are in §4 (06:26–06:34).

This is a **new file**. It does not replace the FET Results already appended to the feature guides. Those remain the scenario-level evidence:

- `F:\jhapp\cleanmatex\docs\features\Service_Speeds\QA_TEST_GUIDE.md` — 16,324 B, 05:15:48, SHA `0C18D7F8A00A700B7F2F53C83432100065F7448BADFB77DA09C489EBCA51EA3B`
- `F:\jhapp\cleanmatex\docs\features\Setup_Health\QA_TEST_GUIDE.md` — 15,030 B, 05:16:58, SHA `4BF021623EBFB40F88B5E413F5914B1BF4DF0BAB5E2255E16BFC71B4E77716FA`
- `F:\jhapp\cleanmatex\docs\features\Tax_Config\QA_TEST_GUIDE.md` — 31,258 B, 05:15:48, SHA `B46B2B7AF39D7BC68E3194D542191396C8869A429BDA42B9B4855BEB60E02296` (merged onto the owner's 02:54 copy, including `#31l`–`#31v`)

Working notes and screenshots: `/workspace/qa-20261113/system-tour-tenant.md`, `system-tour-hq.md`, `system-tour-roles.md`, and `shots/system-tour-*`.

---

## 1. Executive summary

A new Demo Laundry admin can sign in and see a "Getting Started" list, but the product does not yet feel trustworthy or easy to start with. Headline numbers disagree with the lists underneath them (on both the tenant and HQ). Several staff pages fail silently (redirects, stuck loaders, blank bodies). A debug "JWT Test" page is in the production tenant sidebar. HQ says 15 scheduled jobs have drifted, including session sweep and expiry/posting jobs.

Demo Laundry tax is **Active** and prices are **Including tax** from the owner's 13 Nov deploy (not from FET). The tenant kit is still Oman VAT **v1**; HQ kits are **v2** from 2026-11-14. ERP-Lite is not enabled. The tenant still shows **0 orders** in the orders list (Subscription and notifications suggest otherwise — see P1 below).

**Highest priority to fix (P0 / P1):**

| ID | Where | What |
|---|---|---|
| FET-SYS-Nov13-JWTDebugInProd | Tenant sidebar | "JWT Test" exposes the Supabase project URL, user UUID, and token timing on a production tenant. Remove it from production. |
| FET-SYS-Nov13-HqKpiCountsMismatch | HQ Dashboard / Console | "4 organizations / 0 active · 0 trial" while the list is 1 Active + 3 Trial. "Platform Roles 0" and "Document Sequences 0" while those pages list 7+ roles and 51 sequence types. Active Subscriptions is a dash. |
| FET-SYS-Nov13-HqBillingZeros | HQ Billing | Every subscription status is 0 and MRR/ARR are OMR 0.000, while the dashboard says "1 paying" and Demo is ENTERPRISE Active. |
| FET-SYS-Nov13-HqScheduledJobsDrift | HQ Ops Health | Platform health is Failing: 15 scheduled jobs drifted (session sweep, credit-note expiry, ERP posting retry, gift-card and loyalty expiry, and others). |
| FET-SYS-Nov13-HqSubExpiredActive | HQ Demo subscription | Shown **Active**, but end date is 4/12/2026, 0 days remaining, plan limits 0/0/0 on an "Unlimited" Enterprise plan. |
| FET-SYS-Nov13-HqSetupHealthTaxOk / FET-SH-Nov13-HqHealthInconsistent | HQ Setup Health | Row title "Orders are not taxed: tax setup is not confirmed" with a green **OK** badge; body still says tax is not charged. Tenant tax was confirmed today. Counters also disagreed by navigation earlier (1 blocker, then 0). |
| FET-SYS-Nov13-UsersRedirect | Tenant Team Members | "All Users" (`/dashboard/users`) silently sends the super_admin to `/dashboard?error=insufficient_permissions` with no message. Settings › Team Members works. |
| FET-SYS-Nov13-PrefsStuck | Tenant Settings | User preferences stays on "Loading preferences..." for more than 8.5 s, on every visit. |
| FET-SYS-Nov13-ReceiptNoCurrency | Tenant receipts | "No currency is configured for this business" and Payment Setup "Tenant currency" is blank, although OMR is used everywhere else. This blocks recording receipts. |
| FET-SYS-Nov13-OrdersCountMismatch | Tenant | Orders list and dashboard show 0 orders; Subscription shows "Orders 5" this period; notifications list many `order.created` events from 5–7 days ago. |
| FET-SH-Nov12-DirectUrlNotRefused / ViewerBlankPage | Tenant roles | Operator and viewer can open Setup Health and Tax by URL and get a blank page instead of a clear refusal. (Role walk in §4.) |
| FET-SYS-Nov13-HqOmTaxKitCzechSource / FET-TX-Nov13-OmGiftCardFactVsRule | HQ Tax Kits | OM VAT v2 is Verified, but the official source is a Czech MFA PDF (`mzv.gov.cz`). Gift-card fact says "At sale" while the rule says tax is charged when used. |
| FET-SYS-Nov13-Op01 | Tenant, as operator | Operator can open `/dashboard/settings/users` by URL: full staff list with emails and roles, and an active **Invite User** button (not clicked). Access-control gap. |
| FET-SYS-Nov13-Op02 | Tenant, as operator | New Order is a dead end. POS session `POS-20261023-64D05160` has been paused/stale/rolled over since 23 Oct. Two banners contradict: "Resume it here" vs "cannot be resumed — close it and open a new session." Adding a Blouse and Select Customer silently do nothing, so the operator cannot take a first order. Opening a new POS session would be a write — not done. |
| FET-SYS-Nov13-Vw01 | Tenant, as viewer | Viewer can open `/dashboard/settings/users` (Invite User shown, list "No data available") and `/dashboard/orders/new` even though New Order is hidden from the menu. The page says "POS session could not be checked," not that the viewer cannot create orders. |

---

## 2. Tenant app — first-use walk (admin), 05:34–05:41

Already signed in as Demo admin (`admin@demo-laundry.example`, role `super_admin`), plan Enterprise. First dashboard load ~10 s. Welcome: "Admin Demo Lanudry" (typo in the user name). Alerts: "No alerts / All systems are running smoothly." Setup Health tile: "0 blockers · 2 warnings." KPI tiles all 0. Getting Started offers add a customer, create an order, and configure pricing, plus a raw line "Authentication system is active."

**Sidebar (no Reports and no ERP-Lite item):** Dashboard, Orders, Customer Management, Team Members, B2B, Catalog & Pricing, Internal Finance, Tenant Admin, Marketing, Settings, Config And Settings, Help, JWT Test. About 75 pages were opened once. Accounting is only reachable as a Setup Health warning (Fix not clicked). Tax return was reachable earlier today at `/dashboard/reports/tax-return` — there is still no Reports nav entry.

### What works
- New Order catalog is usable: branches, categories, speeds, and 3-decimal prices on item cards. Economy and Standard now show a price and Ready time (from the earlier Retest r2); Next day / Express / Urgent still do not.
- Business Calendar, Tax Setup (Active, Oman VAT v1, "Tax is on", Including tax), Speed Pricing explanation, and most empty states on order queues are clear.
- Cart was emptied. Nothing was submitted.

### First-use friction
- Thirteen sidebar groups, including deep finance (Outbox, Dunning, Cycles) and a developer JWT page, are a lot for a shop admin's first day. Getting Started does not point at the Setup Health warnings.
- Several tables have headers and no empty-state message (Stored Value, Active Sessions, Promo Codes, Variance Approvals). Pricing says "No price lists found" with no next step.
- Many settings are "managed by platform" or "not in plan" even on Enterprise.
- Money is not consistently 3 decimals: catalog "2.8", vouchers "54.25OMR", AR "0.0000", B2B credit "100".
- Dashboard "Active Customers 0" while the customer list has several people.
- Delivery says there are no orders, but shows three route cards with "Invalid Date".
- Catalog pages flash "Access not granted … admin:manage" before they load.
- Branch Settings shows Arabic-only names in the English UI; New Order shows English names ("Main Branch 2").
- New AR Invoice asks for raw Customer ID, Branch ID, and Currency Code instead of pickers.
- Notifications are raw (`New notification: order.created`); the add-ons heading is the i18n key `catalog.addons`; discount rules show JSON; subscription limits show `-1`.

### Tax on the New Order cart
Earlier Retest r2 (05:03) showed **Tax (included) 0.144 OMR** on a 2.200 Blouse (7% inclusive: 2.200 × 0.07 / 1.07), which matches VAT 5% + Municipal 2% with prices including tax. The 05:39 system tour reported **Tax 0.154 / Total 2.354** (7% exclusive). The saved New Order screenshot does **not** include the totals panel (right side was cropped), so 0.154 is not independently verified from that image. If both readings are real, the cart flipped from inclusive to exclusive in the same morning — that would be P1 and should be re-checked with the totals visible. Setup Health on the tenant at 05:04 had 0 blockers after the owner confirm; the tour also reported a "not confirmed" Setup Health line — treat as the known "OK rows still use the failure title" problem unless a re-open shows a real blocker.

Review still shows **"Municipal Fee 2% 2%"** and worked examples that omit the 2% fee (FET-TX-Nov13-MunicipalFeeDuplicate, ExamplesOmit2pct).

---

## 3. HQ — first-use walk, 05:42–05:46 and 06:19–06:30

Opened every HQ sidebar item and every Demo Laundry workspace tab, observe-only. Already signed in as HQ SAAS Admin.

### What works
- Tax Kits list loads (the doubled `/api/hq/v1/hq/v1/…` path from earlier today is **fixed**). OM/SA/AE/BH are Version 2, in force 2026-11-14, Verified. NO_VAT v1 is Verified. A **6th kit**, Generic VAT (`GENERIC_VAT` v1, from 2000-01-01, "Needs checking"), is on page 2.
- Tenant Calendar for Demo loads and matches the tenant hours (fixed on Retest r2). Sidebar links use real UUIDs (the `/tenants/undefined/…` path is fixed).
- Many hubs (notifications, workflows, order-change config, starter packages, auth config) are complete enough to browse.

### First-use friction
- The dashboard first shows "—", "0", and "No organizations found", then fills in. A new admin's first reading is "empty platform." Billing takes about 5 s with no skeleton.
- Headline KPIs disagree across Dashboard, Billing, HQ Console, and the tenants list — that undermines every number on the platform.
- Calendar templates and public holidays **do exist** at `/en/products-items-config/calendar-templates` and `/en/products-items-config/public-holidays` (opened in the Service Speeds HQ observe at 00:14–00:19). The later HQ tour did not find them from the sidebar or from a Ctrl+K search for "holiday," and guessed routes 404'd. This is a **discoverability** problem, not a missing feature. Starter packages already refer to "Oman calendar."
- Inline "Deactivate" (including on the signed-in admin), Maintenance "Fix / Rebuild All," and Subscription "Stop" have no visible warning copy. Whether they confirm was not tested.
- Plans are priced in **USD** while the platform currency and MRR are **OMR**. The Free Trial plan says 14 days; General Config default trial is 30 days.
- Demo Details says "Total users 0" and "Orders 0" while the Users tab lists 4 users.
- Tenant Settings still said "Loading settings..." after about 6 s.
- Breadcrumbs still show the raw UUID with spaces instead of "Demo Laundry LLC."

---

## 4. Operator and viewer — first-use walk, 06:26–06:34

Both accounts signed in on the first attempt. Operator landed as "Operator Demo 1" in ~6.6 s; viewer as "Viewer User Demo1" in ~9.7 s. After the viewer signed in, Chrome showed its own "password found in a data breach" dialog (a browser warning, not an app defect). Both signed out cleanly (no "session expired" message this time). Carts stayed empty. Nothing was saved.

**Operator sidebar:** Dashboard, Help, full Orders including New Order, Customers, Speed Pricing and Service Preferences, a large Internal Finance set (invoices, AR, POS Sessions, vouchers), Marketing (promos, gift cards, discount rules), and view-only Cash Control / POS Settings. No B2B, Reports, JWT Test, or Currencies & FX.

**Viewer sidebar:** Dashboard, Help, Orders **without** New Order in the menu (the direct URL still works), Customers, Speed Pricing and Service Preferences, Cash Drawers only from Finance, and — oddly — **Currencies & FX**, which the operator does not see. No Internal Finance invoices, no Marketing, no Settings for POS.

Getting Started is the same for both, including "Add your first customer" and "Create your first order," which the viewer cannot do. The dashboard still says "Active Customers 0" while the customer list has people.

### Access control (direct URLs)

| URL | Operator | Viewer |
|---|---|---|
| `/dashboard/setup-health` | Title only, empty body, no refusal | Same |
| `/dashboard/settings/tax` | Title only, empty body | Same |
| `/dashboard/settings/calendar` | Title only, empty body | Same |
| `/dashboard/settings/users` | **Full staff list**, emails and roles, **Invite User** active, row menus (not clicked) | Page opens, Invite User shown (looks disabled), list "No data available" |
| `/dashboard/users` | Silent redirect to `/dashboard?error=insufficient_permissions`, no on-screen message | Same |
| `/dashboard/reports/tax-return` | Generic Reports page, not a tax return and not a denial | Same |
| `/dashboard/orders/new` | In the menu | Hidden from the menu, **URL works** |

This is worse than a blank Setup Health page: the operator can see every teammate's email and is offered Invite User. That should be an admin-only screen, or at least a clear denial.

### New Order as staff

- **Operator:** Session Hub opens by itself on a session paused since 23 Oct (`POS-20261023-64D05160`). The two banners disagree ("Resume it here before creating an order" vs "the business day changed, so it cannot be resumed — close it, then open a new session"). After closing the panel, "+ Add" on a 2.200 OMR Blouse and Select Customer did nothing — no item, no message, so no Tax/Total line. The operator's first meaningful action is blocked. Opening or closing a POS session would be a write and was not done.
- **Viewer:** First "No products available," then "POS session could not be checked • Refresh the Session Hub…" and "Please select a branch before submitting the order." The viewer is never told that this role cannot create orders. The Orders and Processing pages still show "+ New Order," and Customers shows "Add Customer."

### Other role friction
- Delivery "Invalid Date" empty route cards (same as admin).
- Raw UUIDs under customer names; New AR Invoice raw ID fields (operator).
- Demo "PAYMENT MODAL VERSION" selector visible to the operator.
- Slow first Orders load 7.6 s; sign-in 6.6–9.7 s.


---

## 5. Recommendations (prioritised)

Fix these first. Each item is a concrete product change. Evidence is in the tour reports and, for the three feature guides, in the FET Results already on F:.

### P0 / P1 — correctness, trust, and exposure

1. **Remove or gate "JWT Test"** so it never appears on a production tenant. It shows infrastructure URLs and token metadata.
2. **Make HQ KPIs and Billing counts match the lists.** Organizations 4 should read 1 active · 3 trial (or whatever the list really is). Billing must not show all zeros when Demo is a paying Enterprise org. HQ Console "Roles 0 / Sequences 0" must match the actual 7+ roles and 51 sequences. A cold load should not flash "No organizations found."
3. **Investigate the 15 drifted scheduled jobs** on HQ Ops Health (session sweep, credit-note / gift-card / loyalty expiry, ERP posting retry). If they are really not running, expiry and posting will silently fail.
4. **Correct the Demo subscription record:** Active with an end date of 4/12/2026, 0 days remaining, and 0/0/0 limits on an Unlimited plan is not a state a customer should see.
5. **Setup Health copy and counters:** an OK check must not keep the failure title ("Orders are not taxed…", "Business hours are not set", "Only Standard speed is offered"). HQ counters must not change just because the page was opened from the sidebar. Body text must not say tax is unconfirmed when the tenant is Active.
6. **Tenant Team Members › All Users:** a super_admin should not be bounced to the dashboard with a hidden `error=insufficient_permissions`. Show the list, or a visible "you can't open this" message. Use the same permission as Settings › Team Members, which already works.
7. **User preferences** must load or fail with a plain-language error, not spin past 8 seconds.
8. **Tenant currency** must flow into Payment Setup and Account Receipt. "No currency is configured" is wrong for an OMR org and blocks receipts.
9. **Orders 0 vs Subscription "Orders 5" vs `order.created` notifications.** Either show those orders or explain why they are hidden (branch, date, or a leftover counter). Do not leave three different truths.
10. **Refuse direct URLs clearly** for operator and viewer (Setup Health, Tax, Calendar). A blank page is not a 403. **Do not let the operator open Team Members** (`/dashboard/settings/users`) with the full email list and an active Invite User button. The viewer should not reach New Order by URL; if they do, say that the role cannot create orders — not "POS session could not be checked."
10a. **Unstick the operator's New Order path.** The POS session from 23 Oct is paused/rolled over; the two banners contradict each other; Add item silently does nothing. Give one clear action (close the old session and open a new one — with a confirmation — or take the order without a stale session). Opening a session is a write and was not done in this pass.
11. **OM VAT v2:** point Official source at an Omani authority, not `mzv.gov.cz`. Align the gift-card fact ("At sale") with the `GIFT_CARD → VAT_OOS` rule text ("tax when used").
12. **New Order Speed menu:** show a total and Ready time for Next day, Express, and Urgent (they have active all-products rules), and grey speeds that are not available. The toolbar menu is still names only. Standard "Ready Tue 3:00 PM" did not match the org ready time 18:00 (Economy correctly showed 6:00 PM). Main Branch Name calendar still returns HTTP 400.

### P2 — friction a new user will feel on day one

- Delivery ghost routes with "Invalid Date" under an empty state.
- Catalog "Access not granted" flash before the page loads.
- Inconsistent money decimals (must be 3 dp for OMR).
- Dashboard Active Customers 0.
- HQ tenants pagination: "Showing 6 to 4 of 4 / Page 2 of 1."
- HQ raw role keys (`tenants.users.roles.super_admin`).
- Plans in USD on an OMR platform; 14-day vs 30-day trial mismatch.
- HQ Demo Details "0 users" vs 4 on the Users tab.
- Make calendar templates and public holidays easy to find from HQ search and from Setup Health (they already live under Products & Items Config).
- Visible confirmations on Deactivate / Stop / Rebuild All.
- Municipal Fee "2% 2%" and Review examples that omit the 2% fee (live cart did include it at 05:03).
- No "Review tax setup" link on the unconfirmed banner (only "Open Setup Health"); untestable after confirm.
- Arabic RTL cutoff on Tax Overview; leftover English in Arabic nav.

### P3 — polish

- Raw keys and codes: `catalog.addons`, `REQUIRED_FOR_CASH`, `order.created`, subscription `-1`, UUIDs in customer and "Ran by" columns, DB table names on HQ cards, `[status]` / `[s_current_plan]` / `[all_fields]`.
- Empty tables without a message; Pricing with no guidance.
- "Lanudry" typo; Arabic category typo "المميوين"; US date format; Permissions "0 System / 349 Custom" looking reversed.
- Demo "PAYMENT MODAL VERSION" switch and developer helper text on Ready.
- New AR Invoice raw ID fields.
- Language menu does not close with Escape.
- "JWT Test" and "Platform Inventories" in tenant Help; Analytics "Coming Soon" still in the HQ nav.
- Sign-in autocomplete garbles the email on both apps (seen on every pass). Voluntary sign-out can say "Your session has expired."
- OM National Day 20–21 Nov 2026 still Estimated (confirming is high-impact — not done).
- QA leftover category "QA 20261107 Category"; some garments filed under ALTERATION.

---

## 6. What was not run

- **Mutate-and-restore** and **high-impact** (tax confirm, kit or policy publish, create an organization, Pay, confirm public holidays, change the OM calendar template, deactivate every Express rule, New draft on a tax kit). Asked once earlier; no yes was given; not started while the owner was away.
- **Creating an order** — Demo still shows 0 orders in the list, so Order Edit, split, invoices, refunds, and VAT-return-with-data stay blocked.
- **ERP-Lite purchases, expenses, AP journals** — module not enabled on Demo (Setup Health warning). The tenant has no Accounting sidebar item.
- **Customer app** — URL asked once, not supplied.
- **Limited HQ user** (no `tenant_setup_health:view`) — asked once, not supplied. Admin roles were not changed.
- **Jest / local suites** — skipped (remote-only).

**Leftovers from FET:** none. Carts emptied, no drafts, language English. Demo Laundry tax Active, prices Including tax, and Review "Rows you changed were kept" (`OUT_ADVANCE`, `OUT_DELIVERY`, `OUT_GOODS`, `OUT_LAUNDRY`, `OUT_ANY`) are from the owner's 13 Nov deploy, not FET. Org registration 10001 was not changed.

---

## 7. Other QA guides (inventory, not re-run in this file)

All `QA_TEST_GUIDE.md` and Manual UI guides found under the two docs trees, 13 Nov morning:

| Feature | Path | Last write | FET Results already in the file? |
|---|---|---|---|
| Service Speeds | `F:\jhapp\cleanmatex\docs\features\Service_Speeds\QA_TEST_GUIDE.md` | 2026-11-13 05:15 | Yes (this morning) |
| Setup Health | `…\Setup_Health\QA_TEST_GUIDE.md` | 2026-11-13 05:16 | Yes (this morning) |
| Tax Config | `…\Tax_Config\QA_TEST_GUIDE.md` | 2026-11-13 05:15 | Yes (this morning) |
| Line-Level Money Snapshot | `…\Line_Level_Money_Snapshot\QA_TEST_GUIDE.md` | 2026-11-10 14:42 | Yes (Retest r2) |
| Order Edit V2 Manual UI | `…\Order_Edit_V2\…_Manual_UI_Test_Guide.md` | 2026-11-10 14:42 | Yes (Retest r2) |
| Reusable Order Fin View | `…\Reusable_Order_Fin_View\QA_TEST_GUIDE.md` | 2026-11-07 19:01 | Yes |
| Human-Friendly Codes | `…\Human_Friendly_Codes\QA_TEST_GUIDE.md` | 2026-11-07 10:52 | Yes |
| HQ Products / Items Config | `F:\jhapp\cleanmatexsaas\docs\features\Products_Items_Config\QA_TEST_GUIDE.md` | 2026-11-09 16:22 | Yes |
| Edit Policy Page Redesign | `F:\jhapp\cleanmatexsaas\docs\features\Order_Edit_V2\Edit_Policy_Page_Redesign\QA_TEST_GUIDE.md` | 2026-10-28 07:46 | Yes |
| Platform Operations Console | `…\Platform_Operations_Console\qa_test_guide.md` | 2026-10-22 20:28 | Yes |
| POS Session Cash Drawer | `…\POS_Session_Cash_Drawer_Hardening\QA_TEST_GUIDE.md` | 2026-10-10 07:45 | Yes |
| User Session Lifecycle | `…\User_Session_Lifecycle\QA_TEST_GUIDE.md` | 2026-10-09 10:08 | Yes |
| Tenants & Users | `…\Tenants_Users\QA_TEST_GUIDE.md` | 2026-11-13 04:38 | **No** — guide updated this morning, not scenario-run as a guide |
| API Route Auth Hardening | `…\API_Route_Auth_Hardening\QA_TEST_GUIDE.md` | 2026-10-30 19:54 | No |
| Remediation Work Packages | `…\Remediation_Work_Packages\QA_TEST_GUIDE.md` | 2026-10-09 02:54 | No |

This first-use walk covers the live product surfaces those guides describe, but it is **not** a scenario-by-scenario retest of Line-Level, Order Edit, POS, or User Session. Open items from the 10 Nov Retest r2 (unknown user, editable customer fields, AR raw codes, and others) are still in those guides and were not the focus of this file.

Many other feature folders have no QA_TEST_GUIDE (ERP-Lite, Gift Cards, Promotions, B2B, RBAC, Payment Config, and others). Those areas were opened in the tour where they appear in the sidebar.

---

## 8. Suggested next steps when you are back

1. Work the P1 list in §5, starting with JWT Test, HQ KPIs/Billing, drifted jobs, and the expired-but-Active Demo subscription.
2. If you want mutate scenarios (create a disposable order, restore settings) or high-impact ones, say yes once — they were not run.
3. If you want the Tenants & Users guide (updated 04:38) and API Auth guide run as formal scenarios, say so; they have no FET Results yet.
4. A customer-app URL and a limited HQ user would unblock the last observe leftovers.

No passwords are in this file.
