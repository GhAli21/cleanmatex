# Resume continuation — clock program

Last refreshed: 2026-11-27, at pack `0.1.48` (S7 done in code, no migration; user `0849` took that slot, S8 projected `0850`; S1 done; S2 done, `0842`–`0844` applied; S3, S4 done in code; S5 done, `0846` applied by the user; S6 done in code, no migration; slots moved +1 at `0.1.45` and +2 at `0.1.47` because the user's `0845`, `0847`, `0848` took those numbers; next slice takes the next free number when its file is written). Refresh this file at the end of every slice. A slice is not done while this file still names the old version, the old next step, or a route that the slice just finished. Read **Risks while implementing** before editing.

Read this file first. It wins over `technical_docs/work-packages.md` when they disagree. Then read `progress_summary.md` and `current_status.md`. Use `work-packages.md` only for the close-out test of the package you are in. The rule text is `docs/dev/rules/time-and-timezone.md`. Pack version is `0.1.47` (`version.txt`). S2 is applied and green. S3 is in code: use `@ui/clock` (`ClockProvider`, `CmxInstant`, `useInstantFormatter`) and `lib/clock/clock-block.server.ts`; never format an instant without a server-resolved zone. S4 is in code: zone pickers use `CmxTimeZoneSelect` + `canonicalActiveZone`; client "today" uses `useClockCivilToday()`; server "today" uses `operationalCivilToday` and fails closed; D20 toggle `ViewZoneProvider`/`CmxViewZoneToggle`. **Next: S5 (`0.1.46`, migration `0846`)**. *(Previous: S4 (`0.1.45`))*, including the G1 leftovers listed in `MASTER_PLAN_v2.md` (S3 row). Do not edit changelog headings `0.1.32` through `0.1.44`.

**Master plan v2, final (2026-11-26, amended t135u, reviewed t136u).** [`MASTER_PLAN_v2.md`](./MASTER_PLAN_v2.md) (`0.1.41b-plan`) is the queue for the remaining work: slices S1–S15 replace the "Continue in this order" list below, which stays as history and as the file list for S4 and S6. The rules and risks in this file still apply. Decisions D1–D29 and D32–D35 are **accepted** (D32–D35 on 2026-11-27, t137u); D30/D31 are **superseded by D33**. S1 is **done** (`0.1.42`); S2 is **done** (`0842`–`0844` applied by the user); S3 is **done in code** (`0.1.44`); see `IMPLEMENTATION_REPORT.md`. **Only the user applies migrations (D17):** the agent writes the file, says its slot, and stops; the agent never runs `db push` and never runs Prisma commands. The old "applying a new migration is allowed" wording is removed. Names: SQL `fn_cmx_dt_*`, TypeScript `dt*` (the deployed `fn_ops_zone` stays; `fn_cmx_dt_zone` wraps it). Temporal comes from `temporal-polyfill`, imported only in `packages/clock/src/temporal.ts`.

## Final plan summary (2026-11-26)

Decisions D1–D29 and D32–D35 are accepted (D30/D31 superseded by D33); details are in the master plan §4. In one place:

- **Library:** Temporal via free `temporal-polyfill`, imported only in `packages/clock/src/temporal.ts`; removal plan when browsers and Node LTS ship Temporal. Mobile: Dart `timezone`.
- **SQL names:** `fn_cmx_dt_now()` (fixed transaction time), `fn_cmx_dt_clock()` (moving time), `fn_cmx_dt_zone` (wrapper over deployed `fn_ops_zone`), `_today`, `_local_time`, `_local_now`, `_at_local`, `_to_local`, `_local_parts`, `_day_bounds`, `_period_key`, `_business_date`, and the rest of §5.1. TS: `dtNow`, `dtClock`, `dtZone`, `dtToday`, `dtLocalTime`, `dtAtLocal`, `dtToLocal`, `dtLocalParts`, `dtDayBounds`, `dtPeriodKey`, `dtBusinessDate`. Closed operations include **`notify`** (D27).
- **Own clock:** equal to `now()` / `clock_timestamp()` in production; a test-only override `cmx.fake_now` is ignored unless the owner-only `cmx_dt_env_cf` says `test` and the session is `postgres`/superuser. Existing column `DEFAULT now()` stay; new SQL must use ours (guard).
- **Settings (D33):** hour cycle `org_tenants_mst.time_format` → `sys_country_cd.default_hour_cycle` (CLDR) → `hq_general_config.time_format`; week start `org_tenants_mst.first_day_of_week` → country → HQ (ISO on the wire); cut-over branch → tenant → `hq_general_config.business_day_cutover` (`00:00`); date format tenant → HQ (D34). No `sys_tenant_config_defaults_cd`, no `DATETIME` keys. TypeScript resolvers: `resolveHourCycle`, `resolveWeekStart`, `resolveCutover`, `resolveDateFormat` in `@cmx/clock`.
- **Review 0.1.41b (accepted 2026-11-27):** D32 keeps `Asia/Muscat` and every `zone.tab` name canonical (the 0.1.41a seed rule would have demoted it); D33 reuses `org_tenants_mst.time_format` / `first_day_of_week` and `hq_general_config` (they exist since `0668`) instead of new extra-config keys and `sys_tenant_config_defaults_cd`; D34 adds `clock.dateFormat`; D35 names the payment table. The settings foundation moved from S9 to S2 (`0843`).
- **Zones:** IANA only. Runtime validation reads **`sys_timezone_cd`** (extended in `0842` from official IANA tzdb + CLDR names; aliases normalize to the canonical name). `pg_timezone_names` is a health sync check only. Database role zone is a read-only check in S2 with a migration only if a role differs; permanent health checks `CLOCK_*` (`fn_cmx_dt_health`).
- **Viewing:** display-only toggle "Branch zone / My device zone" on chosen reports and lists; writes with a different client zone get `409 ZONE_MISMATCH`.
- **API:** every screen endpoint returns `clock: { zone, businessDate, serverNow, hourCycle, weekStart, tzdbVersion }`.
- **Quiet hours:** `quiet_hours_tz` is no longer read (S8) and is dropped later (`0854`); the zone is the **`notify`** zone (D27).

| Slice | Pack version | Migration slot | Manual cases |
|---|---|---|---|
| S1 `packages/clock`, guard v2, Temporal adapter — **done 2026-11-27** | 0.1.42 | none | T60 |
| S2 SQL clock API, timezone catalog extend, `notify`, zone validators, health, **settings foundation**, role-zone check — **DONE, applied by the user 2026-11-27** | 0.1.43 | `0842`, `0843`, `0844` (DEFINER catalog readers); D32–D35 accepted | T54, T59, T61–T66 |
| S3 display components, order screens — **DONE in code 2026-11-27** | 0.1.44 | none | T43 |
| S4 "today" cluster, zone catalog, viewer-zone toggle — **DONE in code 2026-11-27** | 0.1.45 | none | T44, T56 |
| S5 `CURRENT_DATE` replacement — **DONE, applied by the user 2026-11-27** | 0.1.46 | `0846` | T45, T67 |
| S6 Zod primitives, `clock` block, 409 on writes — **DONE in code 2026-11-27** | 0.1.47 | none | T46, T57 |
| S7 exports, audit, `/health/clock` — **DONE in code 2026-11-27** | 0.1.48 | none | T14, T15, T55, T56 |
| S8 jobs, quiet hours (`notify` zone) | 0.1.49-plan | next free (`0850`) | T47, T58 |
| S9 cut-over UI, Date & Time settings fields, `business_date` on orders/payments | 0.1.50-plan | next free (`0851`) | T48, T52, T53 |
| S10 zone-change policy | 0.1.51-plan | next free (`0852`) | T49 |
| S11 cmx-api | 0.1.52-plan | none | vectors, e2e |
| S12 mobile | 0.1.53-plan | none | T50 |
| S13 HQ + `sys_*`/`hq_*` stamps + tzdb/CLDR catalog refresh | 0.1.54-plan | `0852`, `0853` | T51 |
| S14 page inventory, CI matrix | 0.1.55-plan | none | |
| S15 drop `quiet_hours_tz` after soak | later | `0854` | |

Latest existing migration when this was written: `0841_otp_stamps_timestamptz.sql`. Re-check before creating a file.

## Risks while implementing

The design is finished. The remaining work is a sweep. These are the ways that sweep ships a wrong clock. Read this section before each slice.

| Risk | What goes wrong | What to do |
|---|---|---|
| The same call means two things | `toISOString().slice(0, 10)` on a `@db.Date` is the civil day. The same call on `new Date()` as “today” is the UTC day. In Asia/Muscat that moves the shop day by four hours | Leave a civil-date unpack. Change a business “today”. Search the changelog before editing a file named in an older slice |
| The laptop zone matches the shop | This machine and the local tenants are Asia/Muscat, and branch `timezone_code` is null. A screen that shows the laptop hour can still be wrong | Pass only with `ready_by_at` `06:00Z` showing 10:00, then with the laptop set to UTC and the screen still showing 10:00 |
| A civil day formatted as an instant | `formatInstant` on `…T00:00:00.000Z` in Muscat prints the previous day. Invoice due dates are the usual case | Use `prismaDateToCivil`, `civilDateInputValue`, or `ReportCivilDay` |
| A shop-day instant treated as UTC midnight | Report screens already send `civilRangeQuery` ISO strings. Parsing them as UTC midnights moves the range | `parseFilters` already accepts an offset instant or `YYYY-MM-DD`. Leave that path |
| A fallback zone | Browser, server, `UTC`, `Asia/Muscat`, or `utc_offset_hours` brings back the Ready By hour bug. A client `timeZone` is an echo | Missing zone: no clock, empty window, or `reports.timezoneNotConfigured`. Closed dashboard windows use `9999-01-01T00:00:00.000Z` |
| `new Date()` stored as a civil decision | A document number or a persisted business day moves when the process zone changes | One database instant (`fn_cmx_dt_now()` in new code; an existing `clock_timestamp()` writer stays until touched), the civil date, and the IANA zone, in one transaction. A live filter may convert the current instant in the operations zone |
| An applied migration edited | Local and remote history diverge. The clock check fails on the comment inside `0832` | New SQL file only. Leave `0826` and `0828` through `0841`. Do not add a `CIVIL:` marker to hide the `0832` comment |
| The package list taken as the queue | `work-packages.md` still says start at WP1, write SQL and stop, and names routes that later slices already fixed | This file is the queue. Search the code and `CHANGELOG.md` before changing a named route |
| `sys_*` or `hq_*` converted in the same slice as the reader list | Catalog readers in this app and in HQ break together | WP21 writes `technical_docs/hq-readers.md` and stops |
| The server zone helper imported by the dashboard | `dashboard.service.ts` runs in the browser | Widgets pass `timeZone` from `useDashboardZone` |
| A green test that stubs `Date` | It never proves the shop day | Add the next manual case (S1 adds T60; T43 comes with S3). T21–T42 are written and were not run in a signed-in browser |
| The three kept Ready By rows overwritten | Those promised instants were intentionally left divergent | Leave `609a5565-d763-4df6-a396-45168a34b2e9`, `67ca91f5-b43f-4f0d-9eba-e58258cf9e10`, and `c3aa014c-9971-4369-84c7-3879c0dd147f` |
| A half-open end copied onto an inclusive check | Reconciliation still uses `lte` against `inclusiveEndOfCivilDay`. Changing it drops or adds the last millisecond of the civil day | Keep that `lte`. Outbox `filters.to` stays the exclusive end |
| Generated argument order used for `fn_ops_zone` | Generated TypeScript sorts arguments alphabetically. The function order is `(p_tenant, p_operation, p_scope)` | Call them in the SQL order |
| A UI file touched and left dirty | `npm run check:ui` fails the whole file, including problems that were already there. Hex colors and raw `<button>` fail. A `*-rprt` file may keep a raw `<table>` | Clean the file you touch |
| Prisma pull “cleaned up” | Relation arrays, an optional `tenant_org_id`, or varchar widths copied from remote change the schema for unrelated reasons | Pull once after a new apply. Keep `?` relations, required `tenant_org_id`, and the local varchar widths. Restore `cmx_effective_permissions` `@ignore` |

## Wrong work

Do not do any of these:

- Do not start again at WP1, and do not redo a slice named in `CHANGELOG.md`.
- Do not edit `0826` or `0828` through `0841`. Do not edit `0832` to silence the clock check.
- Do not convert a `sys_*` or `hq_*` column. Write `technical_docs/hq-readers.md` first and stop.
- Do not remove `platform-workers`.
- Do not edit HQ application code from this repo. The HQ doc pack (`cleanmatexsaas/docs/features/Time_and_Timezone`) is at `0.1.5-plan`; change it only when a slice's HQ task says so.
- Do not commit or push.
- Do not run `supabase db reset`.
- `work-packages.md` says a migration is written and not applied. That is still right: **only the user applies migrations (D17).** Write the new file, give its slot, and stop. Never run `db push`. This file wins.
- `AGENTS.md` says wait for approval before editing. The user already said to continue until the open packages are finished.
- A list in `work-packages.md` is the original 2026-11-24 set. Some of those routes are already fixed. Search the code and the changelog before changing one.

This repo is the tenant app, `F:\jhapp\cleanmatex`. HQ (the SaaS Backoffice) is `F:\jhapp\cleanmatexsaas`. Do not edit HQ application code from this repo. The HQ clock pack is `0.1.5b-plan`. Edit it only for the HQ task of the slice you are in.

The user said: continue until the open packages are finished and update plan progress and status on every slice. Since planning was finalized (D17, 2026-11-26) the user applies migration files himself; the agent writes them and stops. Refresh this file on every slice.

## What each slice must update

Before a slice is called done, update all six:

1. `version.txt` — next version only (`0.1.42-plan` for S1, then `0.1.43-plan`, …)
2. `CHANGELOG.md` — a new heading at the top. Do not rewrite an older heading.
3. `progress_summary.md` — the package row, the “In progress” paragraph, and the “Pending” paragraph
4. `current_status.md` — the “Next action” paragraph
5. `testing_guide_and_scenarios.md` — the next manual case (S1: `T60`; S2: `T54`, `T59`; S3: `T43`; see the reserved table)
6. `RESUME_CONTINUATION.md` — the “Last refreshed” line, the current version, the next slice, the landed table, and the continue list. Remove a file from the continue list once that slice finishes it. Move the next concrete files to item 1.

## How to work

- One clock change at a time. Database, service, API, and screen for that clock move together.
- `org_*` queries filter `tenant_org_id` in the query itself.
- New UI uses Cmx components and `cmxMessage`. Text is EN and AR. Search existing message keys before adding one.
- After a UI edit, `cd web-admin && npm run check:ui` must show 0 errors on the changed files. A file you touch must be clean, including problems that were already there. Files named `*-rprt` may keep a raw `<table>`.
- Lint the changed files with `npx eslint <files> --quiet`. Run a targeted Jest file when one exists. Do not run the full suite.
- Authenticated browser checks T21–T42 were written and not run in a signed-in browser. A full `web-admin` `npm run build` was not run for these slices. Say so when you finish a slice.
- Do not commit or push unless the user asks.
- Do not `supabase db reset`. Do not edit an applied migration. Applied clock files that must stay unchanged: `0826`, `0828` through `0841`.
- **The agent does not apply migrations (D17).** Write the new file, state its slot (`0842`–`0854`, see the master plan §7.1), and stop. The user applies it: from the repo root `npx supabase db push --local --include-all --yes`, then `npx supabase db push --include-all --yes` for the linked remote (`--include-all` is required; never print remote credentials). After the user applies, the user runs `npm run prisma:pull` once; the agent does not run Prisma commands. Do not turn Prisma `?` relations into `[]`. Do not make `tenant_org_id` optional. Do not "fix" local versus remote varchar widths. The post-pull patch restores `cmx_effective_permissions` `@ignore`.
- `npm run check:clock-contract` fails on the existing comment inside `0832_lockout_timestamptz.sql`. Do not edit `0832`. Do not add a `CIVIL:` marker to hide that comment.

## Clock rules that keep getting broken

- An instant is `timestamptz` and RFC 3339 with `Z`. A civil date is `YYYY-MM-DD`. A local time is `HH:mm`.
- Convert an instant only in the UI, after the operations zone is known.
- The zone is the feature scope, then the organization. A branch zone is `org_branches_mst.timezone_code` only when that code is an active `sys_timezone_cd`. Otherwise the organization zone. If both are missing, the result is null.
- A missing zone fails closed. Do not fall back to the browser, the server, `UTC`, `Asia/Muscat`, or `utc_offset_hours`.
- A client-supplied zone is an echo. It does not choose the clock.
- A persisted civil day comes from one database instant (`fn_cmx_dt_now()` in new code), not `new Date()`. New SQL never calls `now()`, `clock_timestamp()` or `fn_ops_zone` directly (D25, D26).
- A column that is still naive is shown with no clock.
- This laptop and the local tenants are `Asia/Muscat`. Local branches have a null `timezone_code`, so a branch clock shows the organization zone. A screen that matches the laptop hour is not a pass. Use `ready_by_at` `06:00Z`. It must show 10:00 in Muscat. Set the laptop to UTC and reload. It must still show 10:00.

Closed operation codes: `accept_order` (receiving branch), `ready_by` (fulfilment branch), `pos_session` (till branch), `delivery` (service location), `invoice` (order branch), `ledger` (run branch, or the organization when there is no branch). A null branch id reads the organization zone only. SQL argument order is `(p_tenant uuid, p_operation text, p_scope uuid)`. Generated TypeScript lists those arguments alphabetically. Do not call them in that generated order.

Helpers already exist. Use them. Do not write a second formatter.

- `web-admin/lib/utils/operational-time.ts` — `parseInstant`, `civilDateInZone`, `civilDayBounds`, `civilRangeQuery`, `civilInstantRange`, `shiftCivilDate`, `prismaDateToCivil`, `civilDateInputValue`, `formatCivilDate`, `formatInstantOrEmpty`, `inclusiveEndOfCivilDay`
- `web-admin/lib/utils/operational-zone.server.ts` — `resolveOperationalTimeZone`, `resolveOrganizationTimeZone`, `operationalCivilToday`, `readDatabaseInstant`, `OperationalZoneMissingError`
- Client: `useOperationalZones`, `useCivilTodayDefault`, `useReportsClock`, `ReportInstantDay`, `ReportCivilDay`, `useDashboardZone`

`dashboard.service.ts` runs in the browser. It must not import `operational-zone.server`. Widgets pass `timeZone` from `useDashboardZone` (`accept_order`, no branch). A missing zone uses the closed instant `9999-01-01T00:00:00.000Z`, so today, month-to-date, and trailing windows stay empty.

## Do not redo, and do not “fix” these on purpose

- `ready_by` and `ready_by_override` are dropped. Promised Ready By is `ready_by_at`. Actual Ready is `ready_at` (`timestamptz`). A null `ready_by_at` shows no clock. List sort keys `ready_by` and `ready_by_at_new` order by `ready_by_at`. They are not columns.
- Three promised instants were kept and must not be overwritten: `609a5565-d763-4df6-a396-45168a34b2e9`, `67ca91f5-b43f-4f0d-9eba-e58258cf9e10`, `c3aa014c-9971-4369-84c7-3879c0dd147f`.
- Organization `timestamp without time zone` columns are gone (`0834`–`0841`, local and remote). `sys_*` and `hq_*` catalog stamps stay naive until `technical_docs/hq-readers.md` exists. That file does not exist. Write the reader list in WP21 and stop. Do not convert those columns in the same slice.
- Removing `platform-workers` is out of scope. Do not design or start that removal.
- `loyaltyExpiryJobId` uses `toISOString().slice(0, 10)` on purpose: one job per account per UTC day. Leave it.
- `isRealIsoDate` and `nextCivilDate` use a UTC date slice on purpose. Leave them.
- Report screens already send ISO instants from `civilRangeQuery`. `parseFilters` accepts an offset instant or `YYYY-MM-DD`. Do not treat those ISO strings as UTC midnights.
- Invoice `due_date` and other `@db.Date` values are civil days. Display them with `prismaDateToCivil` / `ReportCivilDay`. Formatting them as instants in Muscat moves the day backward.
- Discount-rule and promo `valid_from` / `valid_to` are instants. Tax-exemption dates, credit-note `expires_at`, and price-list dates are `@db.Date`. Store a typed `YYYY-MM-DD` as `new Date(`${day}T00:00:00.000Z`)`.
- Credit-note expiry uses the organization ledger civil day. A missing zone does not expire the note.
- Half-open ranges use `gte` start and `lt` next midnight. Reconciliation checks still use `lte` against `inclusiveEndOfCivilDay`. Outbox `filters.to` is the exclusive end.
- User-facing zone refusal reuses `reports.timezoneNotConfigured`. New finance HTTP routes return `422` with `{ success: false, error: 'TIMEZONE_NOT_CONFIGURED' }`. The tax-report route still returns an English sentence. The financial reports client treats HTTP 422 as the translated message. Do not change that tax-report sentence unless you also keep the client behavior.

## Already landed through 0.1.39

Done or applied: WP1–WP5, WP7–WP9, WP12–WP15. In progress: WP6, WP10, WP11, WP16, WP17. Not started: WP18–WP22.

Recent slices, so they are not repeated:

| Version | What landed |
|---|---|
| 0.1.33 | Gift-card filters, customer export, tax report, price history, price-list dates, campaign offset, public booking slots, export names, legacy voucher date, invoice overdue. T34–T36 |
| 0.1.34 | Orders summary, payments breakdown, outbox, reconciliation, credit-note spend and expiry, tax-exemption and credit-note `YYYY-MM-DD`. T37 |
| 0.1.35 | Report day buckets and invoice aging. T38 |
| 0.1.36 | Tax exemption action stores civil dates. T39 |
| 0.1.37 | Report table days and cash-variance default range. T40 |
| 0.1.38 | Gift-card month-to-date. T41 |
| 0.1.39 | Dashboard today, month-to-date, trailing windows, and order-list delivered-today. T42 |
| 0.1.40-plan | Audit and master plan v2 (documentation only) |
| 0.1.41-plan | Planning final: D1–D26 accepted, names, config-key settings, health checks, slots `0842`–`0851`. Documentation only |
| 0.1.41a-plan | Planning amendment: D27 `notify`, D28 timezone catalog as runtime source, D29 CLDR country defaults, D30 `sys_tenant_config_defaults_cd`, D31 `DATETIME`. Documentation only |
| 0.1.41b-plan | Adversarial gap review (t136u): G19–G26, D32–D35 proposed, settings foundation re-slotted to S2 (`0843`), slots `0842`–`0851` re-set, rollback table, coverage matrix, T61–T68. Documentation only |
| 0.1.42 | S1: `packages/clock` (`@cmx/clock`), shared vectors, `notify` in TS only, guard v2 + baseline (both repos), restored Ready By test, contract docs; D32–D35 accepted. T60 |
| 0.1.43 | S2 files (not applied): `0842` clock API + catalog + `notify` + validators + health, `0843` settings foundation; SQL tests + vector generator; `notify` in `SQL_DOOR_OPERATIONS`; guard regex fix. T54, T59, T61–T66 (SQL) |
| 0.1.48 | S7: `api-output.ts` (`toApiInstant`, export helpers), Date cells `Z` in grids/report CSV, civil-day export names, price-history CSV + D20 toggle (second list), audit card zone, `GET /api/v1/health/clock`; rules doc S1–S7; guard 224 → 221; user `0849` allowlisted. T14, T15, T55, T56 |
| 0.1.47 | S5 applied (`0846`). S6: `api-input` Zod/parse helpers on routes, actions and schemas; `clock` block on 10 screen endpoints + inventory contract test; `clockErrorResponse`, `resolveZonedInput`, `CmxDstChoice`, `useClockErrorMessage`; promotions day in the organization zone; slots +2 (S8 = `0849`). T46, T57 |
| 0.1.46 | S5: `0846` (27 SQL definitions → `fn_cmx_dt_*`, drift check, G21, G22, speed default, unknown-zone deactivation), preimage rollback script, S5 SQL test; guard 226 → 224. T45, T67 |
| 0.1.45 | S4: G12 today cluster, G2 zone picker + catalog validation (settings, registration), G7 per-user zone removed, G8 root `ClockProvider` + notice, D20 toggle on orders list, S3 leftovers; guard 276 → 226. Slots S5–S15 +1 (S5 = `0846`). T44, T56 |
| 0.1.44 | S2 applied (`0842`–`0844`). S3: `@ui/clock` components + `ClockProvider`, server `clock` block, G1 Ready By / public tracking / order tabs, registration writes via service role. T43 |

## Continue in this order

1. WP6 leftovers that still build “today” with `setHours`, `getFullYear()` on `new Date()`, or `toISOString().slice(0, 10)` as a business day. Start with one cluster: `assembly-service.ts`, `finance-money-position.service.ts`, `dunning.service.ts`, `customers.service.ts` month start, and the tax screens `tax-review-screen.tsx`, `tax-explain-dialog.tsx`, `tax-code-dialog.tsx`. A `@db.Date` read through `toISOString().slice(0, 10)` is the UTC calendar day of that date column. Leave those reads when they are only unpacking a civil date.
2. WP10 remaining write routes named in `technical_docs/work-packages.md`: orders, delivery routes, notification campaigns and processors, promotions, vouchers, cash-drawer transaction and variance report. An instant field accepts only an offset. A civil date accepts only `YYYY-MM-DD`.
3. WP11 remaining actions: promotions, loyalty, refunds, drivers, cash drawers, payment methods, terminals. Promo and discount-rule actions that already store `instantFromDatetimeLocal` are instants. Do not turn them into civil dates.
4. WP16: the FX import rejects a datetime that has no zone.
5. WP17: finance, delivery, and order audit screens format the stored instant with the operations zone.
6. WP18: finance jobs, POS rollover, and the `0807` / `0810` claim functions compare a `timestamptz` to `now()`. Shop-local fire times are calculated in the web-admin service. `cmx-workers` schedules stay UTC. Do not change `loyaltyExpiryJobId`.
7. WP19: add a parser and a zone helper in `cmx-api` that do not import `web-admin`. Point any date-bearing controller at them.
8. WP20: mobile booking, tracking, and the date picker show the shop zone returned by the API and submit civil fields. A missing zone shows no clock.
9. WP21: write `technical_docs/hq-readers.md`. Stop there. Conversion of `sys_*` / `hq_*` waits until that list is reviewed.
10. WP22: write `technical_docs/page-clock-inventory.md`. Every dashboard page that shows a date is either migrated or has a written exception.

Manual checks T21–T42 stay in the testing guide. T43–T68 are reserved there; write each in full when its slice lands. A green unit test that stubs `Date` without a zone does not pass those cases.
