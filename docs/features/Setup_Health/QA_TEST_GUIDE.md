# Setup Health — QA Test Guide

Owner-runnable checks. Plan: [PLAN.md](PLAN.md) · Status: [STATUS.md](STATUS.md)

## Tenant app (`cleanmatex`, web-admin)

| # | Who | Path | Do | Expect |
|---|---|---|---|---|
| T1 | Admin / tenant_admin | Sidebar › Config And Settings › **Setup Health** (`/dashboard/setup-health`) | Open the page | Checks grouped by area (Business calendar, Service speeds, Accounting…); each has a status badge and a plain-words "why it matters" |
| T2 | Admin | same | Look at a "Needs attention" row with a fix screen you can open (e.g. *Only Standard speed is offered*) | **Fix** button → opens `/dashboard/catalog/speed-pricing` |
| T3 | User without the fix permission (e.g. no `settings:organization`) | same | Look at *Business hours are not set* when it fails | No Fix button; text "Your provider sets this up. Please contact support." |
| T4 | Cashier / operator | Sidebar | Look for Setup Health | Not in the menu; opening `/dashboard/setup-health` directly is refused |
| T5 | Admin | Dashboard home (`/dashboard`) | Look under the alerts | "Setup health" tile with blocker / warning / info counts; click → Setup Health page. Hidden for cashiers |
| T6 | Admin | Setup Health | Fix a problem in another tab (e.g. add a speed rule), come back to this tab | The list refreshes on focus and the row turns OK |
| T7 | Any user | Any dashboard page | Only after Tax M8 adds `TAX_SETUP_NOT_CONFIRMED`: leave tax setup unconfirmed | Red banner at the top "Setup problem…" listing the blocker; no close button; it can collapse for the current browser session and returns in a new session; "Open Setup Health" link only for admins |
| T8 | Admin, Arabic | Switch language to Arabic | Repeat T1, T5 | Arabic names/descriptions, mirrored layout, check codes stay left-to-right |
| T9 | Admin | Setup Health | Organization with ERP-Lite readiness flag **off** | *Accounting is not ready* row is not shown |
| T10 | `/dashboard/setup-health` | A viewer or operator account (no Setup Health permission) | Open the URL directly | A skeleton, then "You don't have access to Setup Health" with a lock icon and a hint to ask an administrator; never a blank page. Arabic: "ليس لديك صلاحية الوصول إلى صحة الإعداد" (retest of T3/T4) |
| T11 | `/dashboard/setup-health` | An organization with ERP-Lite off but the readiness flag on (the demo organization) | Open the screen and the home tile | No "Accounting is not ready" row, and the tile does not count it (retest of T9) |
| T12 | `/dashboard/setup-health`, an organization with a passing check | Business hours set | Look at the passing rows | Titles say the good state ("Business hours are set", "Tax setup is confirmed"), not the problem; Arabic matches (retest of "OK rows describe the problem") |
| T13 | Dashboard home tile | An organization with 1 blocker and 1 warning, then 2 and 2 | Read the tile | "1 blocker · 1 warning · 0 info", "2 blockers · 2 warnings · 0 info"; Arabic uses the right dual/plural forms |
| T14 | Sidebar, Arabic (needs 0740 applied) | Any admin | Switch to Arabic | Dashboard, Orders, Catalog & Pricing, Help, Drivers & Routes, Invoices, Add-ons and Assembly show in Arabic (Catalog & Pricing reads "الترميزات والتسعير", the owner's wording in 0740); the item is "Assembly", not "AssemblyJh". "JWT Test" stays in the menu: the owner left its retirement out of 0740 |
| T15 | Top bar | Any signed-in user | Choose Sign out | Lands on `/login` with no "Your session has expired" banner (retest of FET-SH-Nov12-SignOutSaysExpired; the double sign-out race is fixed, a browser run is still needed) |
| T16 | Dashboard, first load | Admin and viewer | Hard reload and time the banner and the Setup Health screen | Compare with the earlier 8–10 s: the screen and banner no longer wait for fix-permission lookups they do not use. Record the new times in the log |

## HQ (`cleanmatexsaas`, platform-web)

| # | Who | Path | Do | Expect |
|---|---|---|---|---|
| H1 | HQ user with `tenant_setup_health:view` (TECH_ADMIN, SUPPORT, BUSINESS_ADMIN, ANALYST, SUPER_ADMIN) | Tenant Organizations › open an organization › Tenant workspace › **Setup Health** (right after Overview) | Open | Four counters (Blockers, Warnings, Info, Could not check), checks grouped by area, check code shown under each row |
| H2 | same | same | Click **Fix** on *Business hours are not set* | Opens the organization's **Branches** page in HQ |
| H3 | same | same | Click **Fix** on *Accounting is not ready* | Opens **ERP Lite governance › Tenants** |
| H4 | same | same | Click **Recheck** | Results reload (checks run live) |
| H5 | HQ user without `tenant_setup_health:view` | same URL | Open | Error box "Could not load setup health" (API answers 403) |
| H7 | same as H1 | An Omani demo organization (after 0716) | Look under Business calendar | *Public holiday dates are not confirmed yet* (Info, no Fix button). Not shown in the tenant app |
| H6 | same as H1, Arabic | same | Switch to Arabic | Arabic text, mirrored layout |
| H8 | HQ sidebar › Tenant Organizations — `/tenants` | Demo organization `11111111-…` (has 1 warning on remote) | Look at the **Setup** column; hover it; click it | Amber "1 warning"; organizations with no blocker or warning show green "OK"; hover shows the last check date; click opens that organization's Setup Health. In Arabic: "تحذير واحد", "سليم", mirrored |
| H9 | same as H8 | same | **Setup Health** filter › *Blockers or warnings*, then *Has blockers*, then **Clear filters** | First: only organizations with a warning or blocker, with the total matching; the URL has `setupHealth=needs_attention`. Second: empty until Tax M8 adds blocker checks. Clear: full list |
| H10 | Organization › Setup Health, then `/tenants` | An organization with the business-hours warning | Add business hours in the tenant app, open its HQ Setup Health page, go back to the list | The warning is gone from the page and the list shows OK (the list updates only after that page is opened, or after the 02:15 UTC job) |
| H11 | `/tenants` › an Omani organization › Setup Health (needs 0724 applied) | "Public holiday dates are not confirmed yet" (AR "مواعيد العطل الرسمية غير مؤكدة بعد") shows Fail | Click **Fix** on that row, mark the estimated dates confirmed (clear *Estimated*) in the Public holidays list, go back and click **Recheck** | Fix opens `/products-items-config/public-holidays`; after recheck the row is OK |
| H12 | HQ sidebar › Tenant Organizations — `/tenants` | Any | Click **Run Setup Checks** in the page header; leave *All active organizations* and *All checks*; **Run checks** | Results list every active organization with badges and the failing checks by name; the line above says "The Setup column in the list was updated."; after **Close** the Setup column and its hover date are current. Arabic: "تشغيل فحوصات الإعداد", mirrored |
| H13 | same, a row's **⋯** menu | An organization that has changed setup since its last check | **Check Setup** | Dialog opens with that organization already chosen (*Selected organizations*); **Run checks** shows only it; its Setup column updates |
| H14 | same dialog | Two or more organizations | *Selected organizations* › pick several with the picker, remove one with × | Chips with names (Arabic name in Arabic); the picker excludes already-chosen ones; **Run checks** stays disabled while none is chosen |
| H15 | same dialog | — | *Selected checks* › tick one check, then an area box | Area box selects/unselects all its checks (dash when some); note says the Setup column is not changed; Run disabled until one check is ticked; after the run "The Setup column in the list was not changed (partial run)" and the list is unchanged |
| H16 | same dialog, results | An organization shown with a blocker | Click **Open Setup Health** on its row | Opens that organization's Setup Health page; counts match the dialog |
| H17 | same dialog | A user without `tenant_setup_health:view` (H5 user) | Open the dialog and run | The run fails with "The run failed. Try again."; nothing changes |
| H18 | Organization › Tax kit, in two tabs | A tax kit waiting for confirmation | In the tenant app (other tab) confirm the tax setup; return to the HQ Tax kit tab and navigate away and back | The Tax kit page shows the new status at once (no cached copy), and Setup Health agrees with it (retest of FET-SH-Nov13-HqHealthInconsistent) |
| H19 | HQ `/tenants` with a filter that matches few organizations | More than one page of organizations, page 2 open | Choose *Has blockers* (or a status) so fewer results remain | The list jumps to the last page that exists; no "Showing 6 to 4 of 4" or "Page 2 of 1" |
| H20 | Any HQ list or page with the **Audit History** button, Arabic | — | Open the page in Arabic; click the button; open the drawer | Button and drawer read in Arabic: "سجل التدقيق", filter placeholder, Inspect/Diff, Close, footer link |
| H21 | HQ sign-in page | A browser with a saved password | Click the email field, then the password field | The saved email goes into the email field and the password into the password field; neither gets the other's text (retest of FET-SH-Nov12-LoginAutocomplete; not reproduced without a browser) |

## Automated checks (already run)

- `web-admin`: `npx jest __tests__/services/setup-health.service.test.ts __tests__/api/setup-health.route.test.ts __tests__/features/setup-health`
- `web-admin` DB (local Supabase): `npm run test:db-integration -- __tests__/db-integration/setup-health.db.test.ts`
- `platform-api`: `npx jest src/modules/tenant-setup-health src/modules/tenants/__tests__/tenants.service.find-all.spec.ts`
## Financial_Expert_Tester Results

Round 1 observe: 2026-11-12 23:51–2026-11-13 00:08 Asia/Muscat, Demo Laundry admin / viewer / operator on [cmx.cleanmatex.com](https://cmx.cleanmatex.com) and HQ SAAS Admin on [hqsaas.cleanmatex.com](https://hqsaas.cleanmatex.com). Remote only. No writes (no Recheck that completed, no Fix writes, no role changes, no holiday confirm). Retest r1 02:10–02:13 after a deploy: HQ Setup Health still empty. Retest r2 04:55–04:59 after a later deploy: HQ Setup Health and sidebar URLs **FIXED**, with a new inconsistent-counters finding. Tenant Setup Health after the owner’s tax-confirm deploy (05:04) showed 0 blockers · 2 warnings (banner gone). Jest skipped (remote-only). Mutate (T6, H10) and high-impact (H11 confirm holidays) not approved, not run while the owner was away. H5 still needs a limited HQ user (asked once; admin roles not changed).

Recount: **PASS 6 · FAIL 3 · PARTIAL 3 · BLOCKED 3 · NOT RUN 2** on the first observe; after r2, H1 is PASS (was FAIL) with a new P0, H4 untested after the load fix (Recheck was enabled, not clicked), H7 observe PASS (Info row visible). See Retest lines.

| # | Result | Evidence |
|---|---|---|
| T1 | PASS | 23:51. `/dashboard/setup-health`. Subtitle "What is missing or wrong in your setup, why it matters, and where to fix it." Refresh present. Areas Tax, Business calendar, Service speeds, Accounting (ERP-Lite). Each check: badge + plain-words why; no raw check codes. First load ~8–10s skeleton. FET: OK rows still titled as the failure (e.g. "Business hours are not set" + OK). |
| T2 | PARTIAL | Speed check already OK, no Fix (expected Fix → `/dashboard/catalog/speed-pricing`). Direct URL: "Typical speeds" card present; 52 rules, active Economy All products 10% off. Accounting Fix → `/dashboard/erp-lite/readiness`: "This ERP-Lite module is not enabled." FET: speed OK is likely from the Economy rule while the wording is about faster speeds. |
| T3 | PARTIAL | 23:57–00:00. Viewer "Viewer User Demo1". Setup Health not in the menu (Config And Settings only "Currencies & FX"). Direct `/dashboard/setup-health` keeps the URL and heading but the body is empty except the banner after >14s — no rows, no "Your provider sets this up. Please contact support.", no denied message. Banner ~10s late, no "Open Setup Health." Tile absent (PASS for hidden-for-non-admin). Business-hours failing case is a remote adaptation (admin session had hours OK). |
| T4 | FAIL | Operator "Operator Demo 1". Not in the menu (PASS for that). Direct open is **not** refused: same blank page as the viewer, no 403. Guide expects refusal. |
| T5 | PASS | Admin tile "1 blockers · 1 warnings · 0 info" (wrong plurals); click opens Setup Health. Tile absent for viewer and operator. After owner tax-confirm deploy (05:04): tile "0 blockers · 2 warnings · 0 info." |
| T6 | NOT RUN | Mutate (add a speed rule and return). Not approved. |
| T7 | PASS | Banner "Setup problem: some features will not work correctly • Orders are not taxed: tax setup is not confirmed." No close; chevron collapses; "Open Setup Health" for admin only (absent for viewer/operator). **Retest r2 05:04:** banner gone after tax was confirmed as part of the owner deploy — not a separate code retest of the "Review tax setup" link. |
| T8 | PASS (minor leftovers) | RTL; title "صحة الإعداد"; areas الضريبة / تقويم العمل / سرعات الخدمة / المحاسبة (ERP-Lite); badges سليم / يحتاج إلى انتباه / مانع / تحذير / لا ينطبق. Tile "1 موانع · 1 تحذيرات · 0 معلومات." Leftover EN: top-bar "Setup Health"/"Dashboard"; sidebar Dashboard, Orders, Catalog & Pricing, Help, JWT Test. ERP-Lite stays LTR. Switched back to English. |
| T9 | FAIL | "Accounting is not ready" shown as Needs attention + Warning with Fix, but the Fix page says ERP-Lite is not enabled. Guide: hide the row when the readiness flag is off. This is the admin tile's "1 warning" (later "2 warnings" after tax confirm). |
| H1 | FAIL, then **PASS** (new issue) | 00:02–00:08 FAIL: `/en/tenants/11111111-1111-1111-1111-111111111111/setup-health` header + Recheck only; no counters/checks/codes/error after ~1.5 min and hard reload. Silent empty (graceful-failure fail). Sidebar `/en/tenants/undefined/tax-kit`. Breadcrumb raw UUID. Org Overview at the same UUID **does** load. Isolation untestable. **Retest r1 02:10–02:12 STILL BROKEN** (~2 min, Recheck spinning/disabled). **Retest r2 04:58 FIXED:** loaded ~10s. Counters BLOCKERS 1, WARNINGS 1, INFO 1, COULD NOT CHECK 0. "Orders are not taxed: tax setup is not confirmed" Blocker; TAX_REG_NO_MISSING Not applicable; TAX_KIT_FACT_UNVERIFIED OK; CAL_HOLIDAYS_ESTIMATED Info, 3 items; ERP_LITE_NOT_READY "Accounting is not ready" Warning. Recheck enabled, not clicked. **NEW 04:59:** opening the same page from the sidebar showed BLOCKERS 0, TAX_SETUP_NOT_CONFIRMED "OK", TAX_REG_NO_MISSING "OK" instead of N/A, while Tax kit still said "Waiting for confirmation." Only navigation in between. FET-SH-Nov13-HqHealthInconsistent (P0). |
| H2 | BLOCKED | No *Business hours are not set* row (hours already OK on the tenant — remote adaptation). Not re-tried after H1 loaded (hours still OK). |
| H3 | BLOCKED on first pass | No Accounting Fix to click while the page was empty. After r2 the ERP_LITE_NOT_READY Warning with Fix was visible; Fix was not clicked (leftover observe). |
| H4 | FAIL, then untested after fix | Recheck 00:06 spun 20s–2 min, still empty. r1: Recheck spinning/disabled. r2: Recheck enabled; not clicked (would only refresh). |
| H5 | BLOCKED | Needs an HQ user without `tenant_setup_health:view`. Asked once. Admin roles not changed. |
| H6 | PARTIAL | First pass: `/ar/…/setup-health` RTL, "صحة الإعداد", "إعادة الفحص"; results still empty. Leftover EN: breadcrumb UUID, "CleanMateX HQ." Not fully re-run after r2 (page now loads with data). Switched back to English. |
| H7 | BLOCKED, then **PASS** (observe) | First pass: no holiday row (empty page). **Retest r2:** CAL_HOLIDAYS_ESTIMATED Info, 3 items, as expected for an Omani org (Info, HQ only). H11 Fix/confirm not run (high-impact). |
| H8 | PASS | `/en/tenants`. Demo Laundry LLC (`11111111-…`): Setup column "1 blocker" + "1 warning"; hover "Checked Nov 12, 2026." Qatar Laundry Demo 4, Demo Saudi Riyadh Dry Clean, BlueWave Laundry Co.: each "1 blocker." No green OK present to check. Click → real UUID Setup Health. Arabic: "مانع واحد", "تحذير واحد." Leftover EN: "Audit History", placeholders `[status]`, `[s_current_plan]`. |
| H9 | PASS | "Blockers or warnings" applies immediately: `?setupHealth=needs_attention`, 4 orgs. "Has blockers": `?setupHealth=has_blockers`, also 4. Actual button "Reset Filters." FET: pagination "Showing 6 to 4 of 4" / "Page 2 of 1" (AR "عرض 6 إلى 4 من 4", "الصفحة 2 من 1"). Filter applies without pressing Apply, though "Apply Filters" is also present. |
| H10 | NOT RUN | Mutate (add business hours). Hours already OK on Demo; would need another org. Not approved. |
| H11 | NOT RUN (observe of the Info row only) | Confirming estimated public holidays is high-impact. Not done. |

**Test data left behind:** none from FET. Language left English. Filters cleared on first HQ pass. Tax confirmation (tenant banner gone, HQ counters changed) was the owner's deploy, not FET.

### Financial_Expert_Tester suggestions

- **P0 FET-SH-Nov12-HqSetupHealthEmpty:** HQ tenant Setup Health never loaded (silent empty page, Recheck spun, sidebar `/tenants/undefined/…`, raw UUID breadcrumb). **Retest r2 04:58 FIXED** (not reproduced). Keep for history.
- **P0 FET-SH-Nov13-HqHealthInconsistent (new r2):** At 04:58 Setup Health showed 1 blocker (tax not confirmed). At 04:59 the same page via the sidebar showed BLOCKERS 0 and tax "OK", while Tax kit still said "Waiting for confirmation." Only navigation in between. Results must be consistent and must not mark an unconfirmed setup OK.
- **P1 FET-SH-Nov12-ErpLiteRowShown:** T9 — "Accounting is not ready" is shown (and counts as a warning) when ERP-Lite is not enabled. Hide the row when the readiness flag is off.
- **P1 FET-SH-Nov12-DirectUrlNotRefused:** T4 — operator (and viewer) can open `/dashboard/setup-health` directly; blank page instead of a refusal / 403.
- **P1 FET-SH-Nov12-ViewerBlankPage:** T3 — viewer sees heading + banner only; no rows and no "Your provider sets this up" message. Confusing empty state.
- **P2 FET-SH-Nov12-OkTitlesDescribeProblem:** OK rows still use the failure title (e.g. "Business hours are not set").
- **P2 FET-SH-Nov12-SpeedCheckOkOnEconomy:** Speed check is OK from an Economy rule; the wording is about faster speeds.
- **P2 FET-SH-Nov12-JwtTestInSidebar:** "JWT Test" appears in the production tenant sidebar.
- **P2 FET-SH-Nov12-HqTenantsPagination:** "Showing 6 to 4 of 4" / "Page 2 of 1."
- **P3 FET-SH-Nov12-TilePlurals:** "1 blockers · 1 warnings" and AR "1 موانع · 1 تحذيرات."
- **P3 FET-SH-Nov12-AdminNameTypo:** "Admin Demo Lanudry."
- **P3 FET-SH-Nov12-ArabicNavEnglish:** several nav labels stay English in Arabic mode.
- **P3 FET-SH-Nov12-LoginAutocomplete:** sign-in autocomplete garbles the email (and can put characters into the password field) on cmx and hqsaas. Seen on every pass, including after deploys.
- **P3 FET-SH-Nov12-SetupHealthSlowLoad:** tenant Setup Health first load ~8–10s.
- **P3 FET-SH-Nov12-SignOutSaysExpired:** voluntary sign-out goes to `/login?reason=session_expired` with "Your session has expired."
- **P3 FET-SH-Nov12-ViewerBannerLate:** viewer banner ~10s late.
- **P3 FET-SH-Nov12-HqFilterPlaceholders:** `[status]`, `[s_current_plan]`.
- **P3 FET-SH-Nov12-HqFilterAppliesImmediately:** filter applies without Apply Filters.
- **P3 FET-SH-Nov12-HqArabicLeftovers:** "Audit History", "CleanMateX HQ" title prefix, raw IDs.
