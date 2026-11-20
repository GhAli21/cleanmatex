# API Route Auth Hardening (BF-23 / BF-24 / BF-25) — QA Test Guide

**Status:** [STATUS.md](STATUS.md)
**Plan:** [PLAN.md](PLAN.md)

Owner-runnable scenarios for the session/permission guards added across BF-23 (30+1 routes), BF-24 (45 legacy routes), and BF-25 (shadowed `getAuthContext()` fixes). Each row names the sidebar path and/or URL, what to do, and what should happen.

| # | Who | Steps | Expected |
|---|---|---|---|
| 1 | `viewer` | Catalog → Services (`/dashboard/catalog/services`) | New product, Import and Export buttons are not shown |
| 2 | `viewer` (API) | Call `POST /api/v1/products` from the browser console | 403 `Permission denied: products:create` |
| 3 | `laundry_worker` | Processing (`/dashboard/processing`) → open an order → advance a step, report an issue | Both work; Split controls are hidden |
| 4 | `operator` | Same order with split enabled in tenant settings | Split controls shown and split works |
| 5 | `cashier` | Issues (`/dashboard/issues`) | Issues listed with Solve; resolving works |
| 6 | `admin` (not tenant_admin) | Catalog → Categories | Switches read-only, no Save button |
| 7 | `tenant_admin` | Catalog → Categories → toggle → Save | Saves (previously always failed with 404) |
| 8 | `tenant_admin` | Settings → Workflow Roles (`/dashboard/settings/workflow-roles`) | **Retired 2026-10-30** — menu item and route are gone (see STATUS.md log); skip this scenario |
| 9 | `tenant_admin` | Settings menu | No "Navigation" item; `/dashboard/settings/navigation` returns 404 |
| 10 | any user | Admin revokes the user's session (Users → Sessions), then the user opens a Ready order (`/dashboard/ready/[id]`) | Redirected to login; `GET /api/v1/orders/[id]/state` answers 401 `SESSION_ENDED` |
| 11 | any authenticated user | Catalog → Settings (`/dashboard/settings/catalog` or `/dashboard/settings/categories`), check network tab for `/api/settings/catalog` and `/api/settings/categories` | Request succeeds for a logged-in session; the same request with the session cookie cleared returns 401 (previously it would have silently succeeded via the shared `HQ_SERVICE_TOKEN`) |
| 12 | `admin`/`owner` | Customers (`/dashboard/customers`) → Export, and → merge two duplicate customers | Both work as before; confirm a non-admin role gets 403 on `POST /api/v1/customers/merge` and `GET /api/v1/customers/export` |
| 13 | any tenant user | Create/update a customer address (`/dashboard/customers/[id]` → Addresses tab), and run the customer profile upgrade flow | Both work as before; confirm an unauthenticated request to any `/api/v1/customers/[id]/addresses*` or `/api/v1/customers/[id]/upgrade` route returns 401 |
| 14 | `tenant_admin` on a plan with ERP-Lite enabled | Open any `/dashboard/erp-lite/*` page | Pages gate correctly by the tenant's real feature-flag entitlement (session-derived), not a forgeable claim |

## Notes

- Scenarios 1–10 are from the original BF-23 implementation; 11 covers the BF-24 `settings/catalog`/`categories` session-check fix; 12–14 cover BF-25 (shadowed `getAuthContext()` in customers routes + `feature-flags.service.ts`).
- None of these require a DB migration beyond the already-applied `0660` (BF-23) and `0663` (workflow-roles retirement, owner-applied).

## Financial_Expert_Tester Results

### Round 1 — 2026-11-17 (remote; admin, operator, viewer)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals) and HQ `https://hqsaas.cleanmatex.com` (Incognito). Run window 2026-11-17 ~04:40–09:20 Asia/Muscat (UTC+4). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes. Read-only `SELECT`s only where stated. Jest skipped.
**Accounts by role (no passwords; see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault):** Demo Laundry admin `admin@demo-laundry.example` (shows role `super_admin`); operator `operator@demo-laundry.example`; viewer `viewer@demo-laundry.example`; HQ System Administrator `admin@cleanmatex.com`. No shared password was changed.
**Deploy caveats (2026-11-17):** (1) S0 privilege-lockdown migrations 0745–0749 were applied ~04:00–05:15; during that window New Order broke (403 `fn_stng_resolve_all_settings`, 400 `/api/v1/categories`, 500 `/api/v1/lookups/service-speeds`, "Failed to fetch customers", empty sidebar) and it was working again by ~05:38. (2) From ~05:00 Processing shows the raw error `permission denied for table sys_order_sources_cd` and an empty queue (regression; blocks Ready/Delivery/prints). (3) From ~07:00 All Orders fails with `Invalid prisma.org_orders_mst.findMany() invocation: The column org_orders_mst.photo_urls does not exist in the current database`, order detail pages show "Order not found" and New Order submit returns `ORDER_SUBMIT_FAILED`, after migration `0751_file_util_drop_photo_url_columns` dropped the column while the deployed app still reads it (still failing at 08:44). Rows that needed an order after ~07:00 are BLOCKED for that reason.
**Roles available on Team Members (~09:08):** `admin@demo-laundry.example` = super_admin (there is **no** plain `admin` or `tenant_admin` account); operator; viewer; `ahmed@demo-laundry.example` "Ahmed Mohd" = cashier (no confirmed credentials); no `laundry_worker` account. None created or changed. Viewer and operator signed in once each in Incognito (both succeeded). Console/network API checks (rows 2, 11, 12, 13) were not run — UI only. Run 09:08–09:20. Source ledger on the tester box: `/workspace/qa-20261117/backlog/obs/B12-Q16-Q6.md`.

**Recount (Round 1 2026-11-17, rows in the table below):** PASS 4 · FAIL 2 · PARTIAL 2 · BLOCKED 5 · NOT RUN 1.

| # | Verdict | Evidence |
|---|---|---|
| 1 viewer Services | PASS | 09:12 viewer `/dashboard/catalog/services` → "Access not granted — need admin:manage permission to view Catalog & Pricing"; no New / Import / Export visible (stronger than expected). |
| 2 viewer POST products | PARTIAL | Console POST not run. UI: viewer sees Add Customer (dialog opened, cancelled), Export CSV, and Customer → Addresses → Add Address (added "QA B12 viewer temp", no 403, then deleted). `products:create` 403 not exercised. |
| 3 laundry_worker Processing | BLOCKED | No laundry_worker account; Processing broken (`sys_order_sources_cd`), order pages `photo_urls`. |
| 4 operator Split | BLOCKED | Needs an order (order pages broken). |
| 5 cashier Issues | BLOCKED | Cashier exists but no confirmed credentials; orders broken. |
| 6 admin Categories read-only | BLOCKED | No plain `admin` account. As super_admin `/dashboard/catalog/categories` shows editable switches + "Save Categories"; viewer sees "Access not granted". |
| 7 tenant_admin toggle + Save | FAIL | Done as super_admin (no tenant_admin): "Leather Care" off→on → Save Categories → red "Failed to reset categories"; reload: still OFF (nothing saved). |
| 8 Workflow Roles | NOT RUN | Retired 2026-10-30 (skip per guide). |
| 9 No Navigation item | PASS | Settings menu: General, All Settings, User Preferences, Team Members, Roles & Permissions, Permissions, Branding, Finance, Payment Setup, Workflows, Setup Health, Tenant Settings, Branch Settings, Business Calendar, Currencies & FX, Tax Setup, Cash Control, Security & Sessions, POS Settings, Labels & Tags — no Navigation; `/dashboard/settings/navigation` → 404. |
| 10 Revoked session → Ready | BLOCKED | Needs a disposable signed-in user and a Ready order (neither available). |
| 11 Catalog settings auth | PARTIAL | `/dashboard/settings/catalog` and `/dashboard/settings/categories` → 404 even as admin, so the "loads when signed in" half cannot be shown. Nearest `/dashboard/catalog/categories` loads signed in; unauthenticated Incognito → `/login?redirect=%2Fdashboard%2Fcatalog%2Fcategories` (09:10). Network 401 not checked. |
| 12 Customers Export / merge | FAIL | Admin (super_admin) Export CSV → "Insufficient permissions. Only admins can export customer data." (no file). Operator and viewer both **see** Export CSV (09:13, 09:19). No Merge control for viewer/operator with 2 selected; admin merge not tried; nothing merged. |
| 13 Address add / delete | PASS | 09:10 admin added "QA B12 temp" (QA Street 1 / QA Area / Muscat) on Jh Test dev21 (page shows "Jh Test Customer") → listed → deleted; only "My house" remains. Profile upgrade flow not exercised; unauthenticated 401 not checked. |
| 14 ERP-Lite gating | PASS (gating) | No ERP-Lite menu; `/dashboard/erp-lite` → "This ERP-Lite module is not enabled — plan or published platform policy does not enable this area"; `/dashboard/erp-lite/accounts` 404. Enabled case not testable on Demo. |

### Tester suggestions — Financial_Expert_Tester (Round 1 2026-11-17)
- **P1 FET-AUTH-Nov17-SuperAdminExportDenied:** super_admin gets "Only admins can export customer data", while operator and viewer are shown the Export button. Treat super_admin as admin in the export check and hide Export for roles without the permission.
- **P1 FET-AUTH-Nov17-CategoriesSaveFails:** Save Categories fails with "Failed to reset categories" (row 7's "previously 404" fix not visible). Also super_admin sees editable switches; confirm intended.
- **P2 FET-AUTH-Nov17-ViewerCanWriteCustomers:** Viewer can open Add Customer and add/delete customer addresses. Row 13 allows "any tenant user" for addresses, but confirm the viewer role should create customers.
- **P2 FET-AUTH-Nov17-CatalogSettingsRoutes404:** Guide row 11 URLs `/dashboard/settings/catalog` and `/dashboard/settings/categories` are 404; update the guide or restore the routes.
- **P3 FET-AUTH-Nov17-RoleFixtures:** Demo has no plain admin, tenant_admin or laundry_worker account, and the cashier has no shared credentials, so rows 3, 5, 6, 7 cannot be run as written. Add these test accounts.
- **P3 FET-AUTH-Nov17-JwtTestPage:** `/dashboard/jhtestui` (JWT debug page) is reachable in production (also "JWT Test" in the sidebar).

### Blocked
- 3, 4, 5, 10 (orders broken; missing laundry_worker / cashier credentials / disposable session), 6 (no plain admin account).

### Test data left behind
- None: both temporary addresses deleted (only "My house" remains on Jh Test dev21); Leather Care unchanged (Save failed). Operator Incognito session left signed in on the tester box.

### Retest r1 2026-11-19 (remote; order-dependent rows #3, #4, #10 still BLOCKED)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals), Demo Laundry admin account (shows role `super_admin`; no passwords or test contact details are recorded here — see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes; Jest skipped. Run window 2026-11-19 ~04:00–05:00 Asia/Muscat (UTC+4). This is the retest of the order-dependent rows from the 17-Nov backlog after the `photo_urls` fix. Source ledgers on the tester box: `/workspace/qa-20261119/retest/obs/A.md` (existing QA orders), `B.md` (New Order), `C.md` (Order Edit / collect), `D.md` (POS / cash drawer); screenshots `/workspace/qa-20261119/retest/shots/` (file names cited below). Original steps, earlier rounds and Dev notes above are unchanged.
**Fixed since 17-Nov:** the `photo_urls` P0 (FET-HFC-Nov17-PhotoUrlsColumnDropped) — All Orders list, order detail, `/full` and `/workspace` load again (no `photo_urls` banner, no "Order not found"), and New Order submit works for cash and Pay on Collection orders (no `ORDER_SUBMIT_FAILED`, no 422).
**Still blocked platform-wide:** `/dashboard/processing` still shows the red banner "permission denied for table sys_order_sources_cd" and "No orders in processing queue" (re-observed 2026-11-19 after the `photo_urls` fix; ledger `/workspace/qa-20261119/obs/U-pr0102.md`, shot `PR02-4-processing`). Every QA order therefore stays at Processing / preparation Pending, so Ready, Delivery, Split and rack rows cannot be reached.
**Why only these rows:** only rows #3, #4 and #10 were blocked by the broken order pages on 17-Nov. The `photo_urls` break is fixed, but they still need a Processing / Ready order and Processing returns `permission denied for table sys_order_sources_cd` ("No orders in processing queue", re-observed 2026-11-19). No new role accounts exist (still no `laundry_worker`, plain `admin` or credentialed cashier), and none was created or changed. Rows above are unchanged.

**Recount (this retest, 3 rows): PASS 0 / FAIL 0 / PARTIAL 0 / BLOCKED 3 / NOT RUN 0.**

| # | Verdict | Evidence |
|---|---|---|
| 3 laundry_worker Processing | BLOCKED | No `laundry_worker` account; Processing still fails with `permission denied for table sys_order_sources_cd`. |
| 4 operator Split | BLOCKED | Split is reached from Processing → row → Simple processing → Split; the Processing queue is empty behind the same error. |
| 10 Revoked session → Ready | BLOCKED | Needs a disposable signed-in user and a Ready order; Ready unreachable. |

Prior findings, Retest r1 2026-11-19: **FET-AUTH-Nov17-*** not rechecked (no roles/fixtures changed). Order-detail pages now open for admin, so rows 4 and 5 are no longer blocked by `photo_urls` — row 4 is blocked only by Processing, row 5 also still lacks cashier credentials.

### Tester suggestions — Financial_Expert_Tester (Retest r1 2026-11-19)
- **P1 FET-AUTH-Nov19-ProcessingGrantBlocksRoleChecks:** The Processing grant error (`sys_order_sources_cd`) also blocks the role checks for #3 and #4 and shows a raw database message to every role. Grant SELECT (or read through a definer function) and show a plain error; then re-run #3/#4/#10 with a `laundry_worker`, an operator and a disposable user.

### Blocked
- #3, #4, #10: Processing grant error; also no `laundry_worker` account and no disposable signed-in user.

### Test data left behind
- None from this guide.

## Financial_Expert_Tester Results — Retest r2 2026-11-20 (post-deploy observe pass)

**Retest r5 (2026-11-20 21:55–22:31 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: owner t160u — new evening deploy; redo all QA files, not only UIDS and File_Util. This round is an **observe-only** post-deploy pass: owner approval for writes is still pending, so write-gated rows are **NOT RUN (awaiting approval)**. Nothing was saved, applied, paid, published, assigned, or confirmed. Appearance and language were restored. Earlier rounds above are untouched.

Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch) and HQ https://hqsaas.cleanmatex.com (Incognito). Accounts used: Demo Laundry admin `admin@demo-laundry.example`, operator `operator@demo-laundry.example` (`U000001`), viewer `viewer@demo-laundry.example`; HQ SAAS Admin `admin@cleanmatex.com`. Credentials: see `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` — none recorded here. Real mouse and keyboard; no direct API calls; no page scripts that change data; no Jest. Hard-reload (Ctrl+Shift+R) after the deploy. Screenshots: `C:\Users\JHNLP\qa-20261120\r5\shots\`.

API Route Auth Hardening (Q16) rows below were run on cmx Demo admin (22:19–22:26 Asia/Muscat) and viewer (22:27–22:30). Viewer Quick Add was opened and cancelled; no customer was created; Export was refused by the app. Parent scenario counts are unchanged.

| # | Result | Evidence |
|---|---|---|
| 11 | FAIL | 22:19–22:26 Asia/Muscat. `https://cmx.cleanmatex.com/dashboard/settings/catalog` and `/dashboard/settings/categories` still show "404 This page could not be found." Still broken (FET-AUTH-Nov17-CatalogSettingsRoutes404). |
| 12 | FAIL | Customers Export CSV as super_admin still shows "Insufficient permissions. Only admins can export customer data." Still broken (FET-AUTH-Nov17-SuperAdminExportDenied / FET-UIDS-Nov19-CustomerExportDenied). |
| 2 | FAIL | 22:30 Asia/Muscat. Viewer still sees "Export CSV" and "Add Customer"; Quick Add dialog opens (cancelled, no customer created). Still broken (FET-AUTH-Nov17-ViewerCanWriteCustomers). Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b5-Q16-2.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b5-Q16-2-dialog.png`. |

**Prior findings — Retest r2 2026-11-20**

- **FET-AUTH-Nov17-CatalogSettingsRoutes404** — **STILL BROKEN.** #11.
- **FET-AUTH-Nov17-SuperAdminExportDenied** — **STILL BROKEN.** #12.
- **FET-AUTH-Nov17-ViewerCanWriteCustomers** — **STILL BROKEN.** #2.

**r5 tally for the rows above (parent counts unchanged):** FAIL 3 (11, 12, 2).

**Rows not run in r5:** remaining role-fixture, cashier, category-save, and session-revoke rows (need confirmed cashier credentials, a tenant_admin fixture, or writes; awaiting approval). Workflow Roles remains retired/skip per the guide.

**Test data left behind:** nothing new was created in r5. Shared leftover from earlier rounds (unchanged): `ORD-20261119-00006` is READY on rack QA-A1, paid 1.070 OMR cash, with 3 photos including `qa_photo2.jpg` (note "QA r4 note"). Appearance and language were restored. No branding, settings, users, or other orders were changed.

**Retest plan:** Recheck #11 when catalog/categories settings routes are restored. Recheck #12 after export authorization includes super_admin. Recheck #2 after viewer loses Export/Add Customer. Ask once for fixture accounts before the remaining role rows.
