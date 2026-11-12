# Service Speeds & Ready-By Calendar — Status

Plan: [PLAN.md](PLAN.md) (APPROVED 2026-11-07). Migration numbers are not reserved: each new migration takes the latest number in `supabase/migrations/` + 1 at the moment it is written (other sessions write migrations in parallel).

| Phase | State | Notes |
|---|---|---|
| S1 — migration A: speeds, rule turnaround, header FK, cut-off/ready/hours | **Applied** local + remote (owner, 2026-11-07) | `supabase/migrations/0707_service_speeds_cutoff_hours.sql` |
| S1 — migration B: calendar templates, public holidays, `org_holidays_cf`, `calendar_template_code`, Business Calendar nav, seeds | **Applied** local + remote (owner, 2026-11-07) | `supabase/migrations/0711_business_calendar.sql` + `web-admin/config/navigation.ts` key `settings_calendar` |
| S1 gate — Prisma pull + types both repos | **Done** (owner, after 0707 and 0711) | |
| S2 — pure engine (+ HQ code-table field) | **Done** 2026-11-07 | see "S2 — what it does" |
| S3 — loaders, services, APIs | **Done** 2026-11-07 (owner QA after S4 UI) | see "S3 — what it does" |
| S4 — UI, i18n, access, nav | **Done** 2026-11-08 (owner QA: [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)) | see "S4 — what it does" |
| S5 — HQ seeders, onboarding, mobile | **Done** 2026-11-09 (0720 applied by owner) | see "S5 — what it does" |
| S6 — legacy retirement migration | **Done** 2026-11-10 (applied as `0721_retire_category_express_hours`) | see "S6 — what it does" |
| S7 — docs | **Done** 2026-11-10 | README, developer_guide, user_guide (EN/AR), QA_TEST_GUIDE §9–12, CHANGELOG |

## 0707 — what it does

- `sys_service_speed_cd`: + `default_turnaround_unit` (guidance, CHECK HOURS/WORKING_DAYS); upsert 5 speeds ECONOMY 1, STANDARD 2, NEXT_DAY 3, EXPRESS 4 «مستعجل», URGENT 5 «طارئ» with EN/AR descriptions.
- `org_orders_mst`: drop `oc_order_speed_ck`; add `fk_oom_service_speed` (existing 8 rows are STANDARD/EXPRESS, verified remote 2026-11-07).
- `org_speed_price_rules_cf`: + `turnaround_unit`, `turnaround_days_speed`, `cutoff_time_speed`; backfill 96 rows → `HOURS` where hours set; CHECK unit⇔value; days ≥ 0; multiplier/fixed amount may be negative only for ECONOMY (multiplier > −1).
- `org_tenants_mst`: + `order_cutoff_time`, `ready_time` (no defaults; backfilled from the country template in migration B); CHECK on `business_hours` keys.
- `org_branches_mst`: + `order_cutoff_time`, `ready_time`, `business_hours` (NULL = organization's); same CHECK.

## Decisions taken during implementation

- SELL_PRICE stays ≥ 0 in the DB: "below standard" needs the product price, so the ECONOMY-only rule is enforced in the app (S3 `speed-rule-schemas.ts`).
- STANDARD reordered to `display_order` 2 (was 1) and EXPRESS to 4 (was 2) — rank is relative, consumers sort by it.
- Tenant cut-off / ready time / business hours backfill moved to migration B (needs the templates it creates).
- No index on `org_orders_mst.service_speed` for the FK: platform speed codes are never deleted/renamed.

## 0711 — what it does

- `sys_calendar_templates_mst`: 15 country templates + `GENERIC`. Weekend = official weekend (GCC/EG Fri–Sat, AE and western/CN/JP Sat–Sun, IN/PK Sun). Starter hours 08:00–20:00 on working days, cut-off 11:00, ready 18:00.
- `sys_public_holidays_cf`: 2026 + 2027 for OM, SA, AE, BH, QA, KW, one row per day, `source_ref` per row. Fixed-date holidays set by law → `is_estimated = false`. **Every Islamic holiday → `is_estimated = true`** (only secondary sources found, and they disagree by 1–2 days). OM National Day sources disagree (18 / 20 / 25 Nov) → seeded 20–21 Nov, estimated.
- `org_tenants_mst.calendar_template_code` (FK) backfilled by `country`; cut-off / ready / hours filled only where NULL (existing demo hours kept).
- `org_holidays_cf`: RLS, composite branch FK `(branch_id, tenant_org_id)` ON DELETE CASCADE, UNIQUE NULLS NOT DISTINCT (tenant, branch, date), CHECK closed ⇔ no times / open ⇔ open < close.
- Demo: NEXT_DAY (+25%, 1 working day) and URGENT (+100%, 3 h) mirrored at every active EXPRESS rule scope (product-scoped + one tenant-wide; no category-scoped EXPRESS rules exist); tenant-wide ECONOMY −10% / 5 working days per organization; holidays: 2027-01-02 closure + "open on National Day 10:00–14:00".
- Nav: `settings_calendar` → `/dashboard/settings/calendar`, gate `settings:read` (save via `settings:organization` / `branches:settings`, both exist).

## S2 — what it does

- `web-admin/lib/commercial/calendar.ts` (new, pure, no dependency): `resolveCalendar` (branch → organization per field; public holidays closed, organization then branch rows override), Intl time-zone math (DST safe), `countingStart` (after cut-off → next opening), `addWorkingMinutes`, `addWorkingDays` (Nth working day at the ready time, capped at closing).
- `ready-by.ts`: optional `calendar` input; rule `WORKING_DAYS` / cut-off; without a calendar → clock hours + note `CALENDAR_NOT_CONFIGURED`. `resolveTurnaround` unchanged.
- `speed.ts`: rule turnaround fields in the result; `discountAllowed` (S3 sets it from rank < STANDARD — no per-speed constant); negative premium / SELL_PRICE below standard only when allowed, else held at 0 with a warning; floor keeps unit and line ≥ 0 with `SPEED_DISCOUNT_EXCEEDS_PRICE` (no silent money change).
- `lib/constants/commercial.ts`: `TURNAROUND_UNITS`.
- HQ `code-tables.registry.ts` (service-speeds): `ECONOMY` protected, `default_turnaround_unit` select field + list column.
- Tests: `__tests__/commercial/calendar-ready-by.test.ts` (new); loader RECORDED builder + writer fixture get the new null fields.

**Checks:** web-admin `npx eslint . --quiet` 0 · tsc clean on touched files · jest `__tests__/commercial` 184 ✓, `__tests__/services/commercial` 75 ✓ · `npm run check:i18n` ✓ · `npm run build` ✓ · HQ eslint clean on the registry, HQ jest products-items-config 52 ✓ (HQ `tsc` has 65 errors, all in older test files, none in the registry).

**Behaviour change to know:** when an organization has a calendar, product/category turnaround hours count as **working hours** inside opening hours (not clock hours).

## S3 — what it does

- `lib/services/commercial/calendar-facts.ts` (new): reads tenant/branch calendar columns + holidays (400-day window from the ready-by start's local date; public holidays of branch `country` → tenant `country`) and resolves them. Shared by the order loader and the Business Calendar service.
- `commercial-context.loader.ts` (create, quote, Edit): calendar read once per request in the second read batch; speed ranks (`display_order`, STANDARD always read) → `discountAllowed` (rank < STANDARD); rule unit/days/cut-off passed to ready-by; **`SPEED_NOT_OFFERED`** when a speed has no rule for the item (EXPRESS exempt until S6; removed in S6).
- Header speed (D6): `fastestServiceSpeed` (pure, `speed.ts`) → `headerServiceSpeed` in the line writer; create (`orderSnapshotColumns`) and Edit apply (`EditMoneyColumns.serviceSpeed` → header update) both write it. Split: a sub-order takes the fastest speed of the lines and pieces it receives (`subOrderServiceSpeed` in `order-split.service.ts`), not the parent's. `org_orders_mst` has **no `is_express` column** (only the order GET route derives `is_express` from `priority`), so that plan line needs no write.
- Speed lookup `GET /api/v1/lookups/service-speeds`: every active speed + description, unit guidance and **`is_offered`** for the session organization (one list, so labels still resolve on old orders; the S4 picker filters on `is_offered` — replaces the plan's `?all=true`).
- Speed rules: schema adds `turnaroundUnit` / `turnaroundDaysSpeed` / `cutoffTimeSpeed`, unit ⇔ value, multiplier > −1, negatives accepted by format; service refuses a discount for a speed not ranked below STANDARD (`DISCOUNT_NOT_ALLOWED`, incl. a product SELL_PRICE below the product price); hours with no unit save as HOURS (older clients).
- Business Calendar: `lib/services/settings/business-calendar.service.ts` + `business-calendar-schemas.ts` + `lib/api/business-calendar-http.ts`; routes `GET/PUT /api/v1/settings/calendar` (`settings:read` / `settings:organization`), `GET/PUT /api/v1/settings/branches/[id]/calendar` (`branches:read` / `branches:settings`, null = organization's), `GET/POST /api/v1/settings/holidays`, `PATCH/DELETE /api/v1/settings/holidays/[id]`. Errors `{ code, messageKey: settings.calendar.errors.<code> }`: `CALENDAR_INVALID_HOURS`, `HOLIDAY_DUPLICATE`, `NOT_FOUND`, `INVALID_REFERENCE`. Holidays are hard-deleted (nothing references them; the unique date index would block re-adding after a soft delete).
- Constants: `SETTINGS_PERMISSIONS.ORGANIZATION`, new `branches-perm.ts` (codes exist in DB — no migration).
- i18n EN/AR: `newOrder.orderSummary.quote.errors.SPEED_NOT_OFFERED`, `orders.edit … pricingError.speedNotOffered`, `catalog.speedPricing.errors.DISCOUNT_NOT_ALLOWED`; `settings.calendar.errors.*` arrive with the S4 page.
- Tests: loader (calendar, NEXT_DAY over weekend + holiday, ECONOMY discount, SPEED_NOT_OFFERED), writer (header speed), speed rules (unit, discount by rank), calendar routes (8) + service (7), speed lookup (2).

**Checks:** jest commercial + services/commercial + order-change apply + api + catalog + settings + lookups green · eslint 0 on touched files · `check:i18n` ✓ · full `npx eslint . --quiet` 0 · `npm run build` ✓ (started before the split change; split is covered by eslint, tsc and its jest suite) · tsc: 1 error, in `__tests__/features/pos-sessions/pos-session-order-banner.test.tsx`, not touched by this step · jest order-split 13 ✓.
`__tests__/services/order-change/order-change-mutation.service.test.ts` fails at import (`@supabase/ssr` needs URL/key env in jest, via notifications → customers.service) — no file of this step is on that import path.

**Closed in S4:** General links to Business Calendar; the quote already returns `readyByAt` per line and order, so no preview endpoint was added.

## S4 — what it does

- **Business Calendar** page `/dashboard/settings/calendar` (`src/features/settings/calendar/`): tabs Organization, Branches (per-field "use the organization's"), Holidays (own + public, add/edit/delete, short day, "we open this day"). Tab and branch live in the URL; Branch settings links to it. Contract `SETTINGS_SETTINGS_CALENDAR_ACCESS`.
- **General settings no longer edits hours** (decided: one editor). It links to Business Calendar; `PUT /settings/general` treats `businessHours` as optional and leaves the column alone when absent. `BusinessHoursEditor.tsx` removed.
- **Speed menu** (`ServiceSpeedSelect`): lists offered speeds, keeps a speed already on the order or line. In New Order, opening the order or line menu quotes each speed through the normal cart quote (`useSpeedOptionPreviews`, on demand, cached 30 s) and shows the total and promised ready time; a speed with no rule for the cart is disabled with the reason. `CmxSelectDropdown` gained `onOpenChange` (additive). The quote response adds `timezone`.
- **Preview shows the total at each speed, not "+amount"**: the client does no money arithmetic.
- **Speed Pricing**: unit, working days, per-speed cut-off, discount hints (only for a speed ranked below Standard), "x% off" in the list, typical-speeds card. Activate/deactivate now keeps the new fields.
- Edit review shows speed names from the lookup. Glossary: `cutoff_time`, `ready_time`, `working_day`.
- Setup Health checks `CAL_NO_BUSINESS_HOURS` / `SPEED_NO_RULES` are owned by that feature (0709).

**Not in S4:** no price preview in Order Edit (Review re-prices) or on a piece's own speed menu. The time field cannot enter `24:00`, which the API accepts.

**Checks:** full `npx eslint . --quiet` 0 · `npm run build` ✓ · tsc: only the older `pos-session-order-banner.test.tsx` error · `check:i18n` ✓ · jest `__tests__/features/orders` 658 ✓ (after two test mocks), `services/commercial`, catalog, lookups, settings, calendar routes ✓ · `check:ui-access-contract --route=/dashboard/settings/calendar --wire` PASS. `check:platform-info-inventories` still fails on 6 nav-drift items from other features (none is Service Speeds). Not opened in a browser: owner QA.

## S5 — what it does

- **0720**: `seed_product_speed_rules` writes the `HOURS` unit (it was refused by the 0707 CHECK, so seeding rules with hours failed) and adds organization-wide NEXT_DAY / EXPRESS / URGENT samples for a speed with no rule at all.
- **HQ onboarding**: `TenantsService.create` copies the country's calendar template (else `GENERIC`) into the new organization. No template readable → created without hours; Setup Health reports it.
- **HQ Products & Items Config › Calendars**: `calendar-templates` and `public-holidays` in the code-table engine (new field types `time`, `date`, `weekHours`; `generatedKey`). Turning off Estimated is "mark confirmed"; a moved date is edited on the row.
- **Customer app**: `GET /public/customer/booking` returns `serviceSpeeds` (offered only); the schedule step shows them when more than one is offered and sends `serviceSpeed`; `SPEED_NOT_OFFERED` has its own EN/AR message.

- **HQ tenant workspace › Calendar** (added 2026-11-10, plan §1): read-only `GET /tenants/:id/calendar?year=` (tenants module, `HqIdentityGuard` like the other tenant reads; every `org_*` read filters `tenant_org_id`) and `/tenants/[id]/calendar` page: organization hours (reuses `PicWeekHoursControl` disabled), cut-off, ready time, template, branch overrides ("Organization's" when null), own and public holidays per year. Editing stays in the tenant app.

**Not done (decided 2026-11-10):** picking a calendar from a starter package (the create request carries no package; country template already covers it). Customer-app per-speed price/ready-time before booking needs a public customer quote API: a separate piece of work, in `followups_by_user.md`. Public holidays in the HQ view use the organization's country, not each branch's.

**Checks:** HQ API jest products-items-config + tenants create ✓ (registry 40) · HQ API `tsc` no errors outside older spec files · HQ web eslint on the feature, `check:i18n`, build ✓ · `flutter analyze` booking + packages clean · customer_app tests 1 failure: `customer_login_entry_screen_test` ("Send verification code"), not touched by this step.

## S6 — what it does

- Code no longer reads `sys_service_category_cd.turnaround_hh_express` in either repo. A speed rule with no hours now falls back to the category's standard hours.
- The EXPRESS exemption is gone: with no rule, EXPRESS is `SPEED_NOT_OFFERED` and not listed.
- **0721** (written as 0723, renamed to 0721 before applying) moves the legacy hours into category-scoped EXPRESS rules with a 0 premium (no price change), then drops the column. Skips organizations with an active all-products EXPRESS rule.
- **To know:** a 0-premium category rule outranks an all-products EXPRESS rule added later; change or remove it on Speed Pricing.

**Checks:** jest commercial, services/commercial, lookups 210 ✓ · `tsc`: only the tax session's in-progress `tax-explain.service.ts` and the older pos-session test.

## Per-step definition of done (checklist applied each step)

| Step | Skills | Audit/RLS | Cmx UI | HQ part | Checks | STATUS | Follow-ups | QA guide |
|---|---|---|---|---|---|---|---|---|
| S1 0707 | database, code-documentation | n/a (columns) | n/a | n/a | applied by owner | ✓ | — | n/a |
| S1 0711 | database, multitenancy, navigation | ✓ full audit + RLS | n/a | n/a | applied by owner | ✓ | ✓ holidays review | after S4 |
| S2 | order-fin, backend | n/a | n/a | ✓ registry | ✓ all | ✓ | ✓ | n/a (no screen yet) |
| S3 | order-fin, backend, multitenancy, i18n | n/a (no table) | n/a | n/a (no HQ part in S3) | ✓ see S3 checks | ✓ | ✓ | after S4 |
| S4 | frontend, i18n, rebuild-ui-access-contract, inventories | n/a | ✓ Cmx only | n/a (no HQ part in S4) | ✓ see S4 checks | ✓ | ✓ | ✓ QA_TEST_GUIDE.md |

## Log

- 2026-11-07 — 0707 written → applied by owner.
- 2026-11-07 — 0711 written (0710 taken by a parallel session) → applied by owner; Prisma + types regenerated both repos.
- 2026-11-07 — S2 pure engine + HQ code-table field done; checks green.
- 2026-11-10 — 0721 verified on remote (column gone; 21 category Express rules in 3 organizations; every organization has an active Express rule; Prisma already pulled). S6 + S7 done. Tenant full `eslint . --quiet` 0 and `npm run build` ✓. Program complete; owner QA + commit left.
- 2026-11-10 — HQ tenant-workspace Calendar view added (S5 gap closed): HQ web tsc/eslint/check:i18n ✓, HQ API tsc clean outside older specs, tenants jest 17 ✓.
- 2026-11-12 — Closing checks: HQ API `tenants.service.get-calendar.spec.ts` added (tenant filter on every org_* read, year bounds, not-found, no-country, sub-read failure) — 4 ✓; HQ web `npm run build` ✓. No engineering left; owner F4 (commit) + F5 (QA) close the plan.
- 2026-11-09 — S5 done after 0720 applied; S6 code done, 0723 written (0721 taken by a parallel session); STOP for owner to apply.
- 2026-11-08 — 0720 written (0719 taken by a parallel session; seeder unit fix + NEXT_DAY/EXPRESS/URGENT samples); STOP for owner to apply.
- 2026-11-08 — S4 done: Business Calendar, speed menu previews, Speed Pricing fields, General links to the calendar; checks in the S4 section.
- 2026-11-08 — S3 closed: full eslint 0, build ✓, tsc 1 unrelated error. Inventories rebuilt; the new API routes reach the inventory through the S4 page contract (`apiDependencies`). `check:access-contracts` fails on nav drift: 1 item is this feature (`/dashboard/settings/calendar`, closed by S4), 6 belong to other work (delivery ×2, catalog/preferences, settings roles/permissions/payments).

## Open items

- OM Accession Day (11 Jan) not seeded (not confirmed). HQ to review all `is_estimated` rows.
- Plan said "category" for demo NEXT_DAY/URGENT; mirrored EXPRESS scopes instead (none are category-scoped).
- `DROP CONSTRAINT` lines in applied 0707/0711 do not say `RESTRICT` explicitly (PostgreSQL default is RESTRICT, so behaviour is the same); later migrations write it out.

## Next

Engineering done. Owner: QA ([QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)), F7 decision, commit ([followups_by_user.md](followups_by_user.md)).
- 2026-11-12 — Fix (found by Tax M4b test run): a retail item in an Express order threw `SPEED_NOT_OFFERED` (an all-products rule never reaches a retail item). `requireOffered` now lets a retail item keep its normal price. The 2 loader tests that still expected the old EXPRESS exemption were updated (EXPRESS with no rule is refused). QA: Tax QA guide #31f.
