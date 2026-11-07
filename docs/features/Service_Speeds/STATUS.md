# Service Speeds & Ready-By Calendar — Status

Plan: [PLAN.md](PLAN.md) (APPROVED 2026-11-07). Migration numbers are not reserved: each new migration takes the latest number in `supabase/migrations/` + 1 at the moment it is written (other sessions write migrations in parallel).

| Phase | State | Notes |
|---|---|---|
| S1 — migration A: speeds, rule turnaround, header FK, cut-off/ready/hours | **Applied** local + remote (owner, 2026-11-07) | `supabase/migrations/0707_service_speeds_cutoff_hours.sql` |
| S1 — migration B: calendar templates, public holidays, `org_holidays_cf`, `calendar_template_code`, Business Calendar nav, seeds | **Applied** local + remote (owner, 2026-11-07) | `supabase/migrations/0711_business_calendar.sql` + `web-admin/config/navigation.ts` key `settings_calendar` |
| S1 gate — Prisma pull + types both repos | **Done** (owner, after 0707 and 0711) | |
| S2 — pure engine (+ HQ code-table field) | **Done** 2026-11-07 | see "S2 — what it does" |
| S3 — loaders, services, APIs | **Done** 2026-11-07 (owner QA after S4 UI) | see "S3 — what it does" |
| S4 — UI, i18n, access, nav | Not started | |
| S5 — HQ seeders, onboarding, mobile | Not started | |
| S6 — legacy retirement migration | Not started | number = latest + 1 when written |
| S7 — docs | Not started | |

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
- `commercial-context.loader.ts` (create, quote, Edit): calendar read once per request in the second read batch; speed ranks (`display_order`, STANDARD always read) → `discountAllowed` (rank < STANDARD); rule unit/days/cut-off passed to ready-by; **`SPEED_NOT_OFFERED`** when a speed has no rule for the item (EXPRESS exempt until S6 converts the legacy category Express hours).
- Header speed (D6): `fastestServiceSpeed` (pure, `speed.ts`) → `headerServiceSpeed` in the line writer; create (`orderSnapshotColumns`) and Edit apply (`EditMoneyColumns.serviceSpeed` → header update) both write it. `org_orders_mst` has **no `is_express` column** (only the order GET route derives `is_express` from `priority`), so that plan line needs no write.
- Speed lookup `GET /api/v1/lookups/service-speeds`: every active speed + description, unit guidance and **`is_offered`** for the session organization (one list, so labels still resolve on old orders; the S4 picker filters on `is_offered` — replaces the plan's `?all=true`).
- Speed rules: schema adds `turnaroundUnit` / `turnaroundDaysSpeed` / `cutoffTimeSpeed`, unit ⇔ value, multiplier > −1, negatives accepted by format; service refuses a discount for a speed not ranked below STANDARD (`DISCOUNT_NOT_ALLOWED`, incl. a product SELL_PRICE below the product price); hours with no unit save as HOURS (older clients).
- Business Calendar: `lib/services/settings/business-calendar.service.ts` + `business-calendar-schemas.ts` + `lib/api/business-calendar-http.ts`; routes `GET/PUT /api/v1/settings/calendar` (`settings:read` / `settings:organization`), `GET/PUT /api/v1/settings/branches/[id]/calendar` (`branches:read` / `branches:settings`, null = organization's), `GET/POST /api/v1/settings/holidays`, `PATCH/DELETE /api/v1/settings/holidays/[id]`. Errors `{ code, messageKey: settings.calendar.errors.<code> }`: `CALENDAR_INVALID_HOURS`, `HOLIDAY_DUPLICATE`, `NOT_FOUND`, `INVALID_REFERENCE`. Holidays are hard-deleted (nothing references them; the unique date index would block re-adding after a soft delete).
- Constants: `SETTINGS_PERMISSIONS.ORGANIZATION`, new `branches-perm.ts` (codes exist in DB — no migration).
- i18n EN/AR: `newOrder.orderSummary.quote.errors.SPEED_NOT_OFFERED`, `orders.edit … pricingError.speedNotOffered`, `catalog.speedPricing.errors.DISCOUNT_NOT_ALLOWED`; `settings.calendar.errors.*` arrive with the S4 page.
- Tests: loader (calendar, NEXT_DAY over weekend + holiday, ECONOMY discount, SPEED_NOT_OFFERED), writer (header speed), speed rules (unit, discount by rank), calendar routes (8) + service (7), speed lookup (2).

**Checks:** jest commercial + services/commercial + order-change apply + api + catalog + settings + lookups green · eslint 0 on touched files · `check:i18n` ✓ · tsc / full eslint / build: see log.
`__tests__/services/order-change/order-change-mutation.service.test.ts` fails at import (`@supabase/ssr` needs URL/key env in jest, via notifications → customers.service) — no file of this step is on that import path.

**Open for S4:** General settings page also edits `business_hours` (same JSON shape) — decide: keep both or link General → Business Calendar. Verify the cart/Edit quote already returns `readyByAt` per line (plan §5 "Ready-by preview").

## Per-step definition of done (checklist applied each step)

| Step | Skills | Audit/RLS | Cmx UI | HQ part | Checks | STATUS | Follow-ups | QA guide |
|---|---|---|---|---|---|---|---|---|
| S1 0707 | database, code-documentation | n/a (columns) | n/a | n/a | applied by owner | ✓ | — | n/a |
| S1 0711 | database, multitenancy, navigation | ✓ full audit + RLS | n/a | n/a | applied by owner | ✓ | ✓ holidays review | after S4 |
| S2 | order-fin, backend | n/a | n/a | ✓ registry | ✓ all | ✓ | ✓ | n/a (no screen yet) |

## Log

- 2026-11-07 — 0707 written → applied by owner.
- 2026-11-07 — 0711 written (0710 taken by a parallel session) → applied by owner; Prisma + types regenerated both repos.
- 2026-11-07 — S2 pure engine + HQ code-table field done; checks green.

## Open items

- Menu link exists before the page (S4) → 404 until S4 ships.
- OM Accession Day (11 Jan) not seeded (not confirmed). HQ to review all `is_estimated` rows.
- Plan said "category" for demo NEXT_DAY/URGENT; mirrored EXPRESS scopes instead (none are category-scoped).
- `DROP CONSTRAINT` lines in applied 0707/0711 do not say `RESTRICT` explicitly (PostgreSQL default is RESTRICT, so behaviour is the same); later migrations write it out.

## Next

S3 — loaders (calendar + holidays + cut-off chain once per request, `discountAllowed` from rank), header writer (fastest line by rank), speed-rule service/schemas, business-calendar service + APIs with route tests.
