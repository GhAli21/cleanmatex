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

## Automated checks (already run)

- `web-admin`: `npx jest __tests__/services/setup-health.service.test.ts __tests__/api/setup-health.route.test.ts __tests__/features/setup-health`
- `web-admin` DB (local Supabase): `npm run test:db-integration -- __tests__/db-integration/setup-health.db.test.ts`
- `platform-api`: `npx jest src/modules/tenant-setup-health`
