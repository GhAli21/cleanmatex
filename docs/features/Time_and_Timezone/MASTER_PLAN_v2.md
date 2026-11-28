# Master plan v2 — Clock and Time Zone Manager (whole SaaS)

**Pack version:** `0.1.48` (2026-11-27). **Status:** S1 DONE (`0.1.42`); **S2 DONE** (`0842`–`0844` applied by the user, local and remote, 2026-11-27; tests PASS); **S3 DONE in code (`0.1.44`, no migration)**; **S4 DONE in code (`0.1.45`, no migration)**; **S5 DONE (`0.1.46`): `0846` applied by the user (local and remote, 2026-11-27; `clock_s5_current_date.test.sql` PASS 1–7).** **S6 DONE in code (`0.1.47`, no migration).** **S7 DONE in code (`0.1.48`, no migration):** exports name the zone (`lib/clock/api-output.ts`: `toApiInstant`, `exportLocalText`, `exportZoneHeader`, `exportFileDay`), audit card in the screen/viewer zone, `GET /api/v1/health/clock`, D20 toggle on catalog price history (second list), rules doc `docs/dev/rules/time-and-timezone.md` + `.cursor/rules/time-and-timezone.mdc` updated for S1–S7; guard 224 → 221. See [`IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md). Migration slots moved +1 at `0.1.45` (S5 = `0846`). **Next: S8 (jobs, quiet hours; migration = next free number, projected `0850`).** Slots moved +2 at `0.1.47` (user migrations `0847`, `0848`). Slots moved +1 again at `0.1.48`: the user's `0849_setup_health_measured_price.sql` took `0849`, so S8 is projected at `0850` (S9 `0851`, S10 `0852`, S13 `0853`/`0854`, S15 `0855`); each slice still takes the next free number when its file is written. Planning FINAL, then an adversarial gap review against the live code and migrations (t136u, §11 rows 18–49). Decisions D1–D29 are ACCEPTED (2026-11-26); **D32–D35 ACCEPTED (2026-11-27, t137u)**; **D30 and D31 are SUPERSEDED by D33**. `FY` period key = `FY` + start year (user, t139u; same as doc-seq `0670`). Only the user applies migrations; the agent never contacted the user's database.
**Supersedes for the remaining work:** the "Continue in this order" list in [`RESUME_CONTINUATION.md`](./RESUME_CONTINUATION.md) and the open rows of [`technical_docs/work-packages.md`](./technical_docs/work-packages.md). Those files keep their history, rules, and close-out tests. Where they disagree with this file about *what comes next*, this file wins. Where this file is silent, the contract [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md) wins.
**HQ half:** `cleanmatexsaas/docs/features/Time_and_Timezone/MASTER_PLAN_v2_HQ.md`.

Audit basis: read-only audit on 2026-11-26 (`0.1.39-plan` state) of `cleanmatex` (web-admin, cmx-api, cmx-workers, packages, cmx_mobile_apps, supabase/migrations up to `0841`) and `cleanmatexsaas` (platform-api, platform-web, platform-workers).

---

## 0. How to read this file

| Section | What it gives you |
|---|---|
| 1 | The target model in one page: the five time types, the zone policy, and the rules |
| 2 | What changed versus the earlier design, and why |
| 3 | Audit gaps G1–G26 (G19–G26 found by the 0.1.41b review), each with its fix |
| 4 | Decisions D1–D29 and D32–D35 ACCEPTED (D32–D35 on 2026-11-27, t137u); D30/D31 SUPERSEDED by D33 |
| 5 | The SQL time API `fn_cmx_dt_*` (clock functions, signatures, volatility, grants, health checks, errors) |
| 6 | The TypeScript, Dart, and API contract that mirrors it |
| 7 | Layer-by-layer plan: database, data, Prisma and types, services, APIs, Zod, frontend, pages, jobs, cmx-api, mobile, HQ, CI, tests, i18n, observability, security, docs |
| 8 | Slice order with migration slots and acceptance criteria |
| 9 | Rollout, risks, rollback |
| 10 | Verification queries (read-only) |
| 11 | Consistency pass log (rows 1–17) and the 0.1.41b adversarial review findings with their fixes (rows 18–49) |

---

## 1. Target model

### 1.1 Five kinds of time. Never mix them.

| Kind | Meaning | Postgres | Prisma | TypeScript type | API wire format | Dart |
|---|---|---|---|---|---|---|
| **Instant** | A moment that happened or will happen, the same everywhere | `timestamptz` | `DateTime @db.Timestamptz(6)` | `Instant` (a `Date`, branded) | RFC 3339 UTC with `Z`, millisecond precision: `2026-11-26T18:06:00.000Z` | `DateTime` (UTC) |
| **Civil date** | A calendar day on a wall calendar (due date, business date, holiday, effective-from) | `date` | `DateTime @db.Date` | `CivilDate` (branded `YYYY-MM-DD` string) | `YYYY-MM-DD` | `CivilDate` value class |
| **Local time of day** | A wall-clock time with no date (opening hours, cut-off, quiet hours) | `time` (no zone) | `DateTime @db.Time(6)` | `LocalTime` (branded `HH:mm` or `HH:mm:ss`) | `HH:mm` | `LocalTime` value class |
| **Zoned appointment** | A local date and time *at a place* (Ready By "tomorrow 18:00 at this branch", pickup slot) | stored as the **instant** plus the zone snapshot (`*_at timestamptz` + `*_tz text` when the zone must be frozen) | `DateTime @db.Timestamptz` + `String` | input `{ date: CivilDate, time: LocalTime, disambiguation? }`, output `Instant` + `zone` | input `{ "date": "2026-11-27", "time": "18:00" }`; output instant `Z` + `"zone"` | input civil fields, output instant |
| **Duration** | A length of time (SLA, lockout, turnaround) | `integer` minutes or seconds column (`*_min`, `*_sec`); `interval` only inside SQL | `Int` | `number` (minutes) | integer minutes field `*_minutes` | `Duration` |

A zone is an IANA id (`Asia/Muscat`), validated against active `sys_timezone_cd.code` **and** the runtime tz database. A UTC offset (`+04:00`, `utc_offset_hours`) is never a zone.

### 1.2 Zone policy (unchanged in spirit, made explicit)

1. **Storage is UTC.** Every instant is `timestamptz`. The database session `TimeZone` is `UTC` on every role (defence in depth: no code may depend on it, see D4).
2. **One policy, three doors that must agree.** SQL `fn_cmx_dt_zone` (a wrapper over the deployed `fn_ops_zone`), TypeScript `resolveOperationalTimeZone` (server), and the zone returned by the API to clients (browser, mobile, cmx-api consumers). All three run the same shared vectors (§7.13).
3. **Resolution order:** feature scope (branch `timezone_code`, if active) → organization `org_tenants_mst.timezone` (if active) → **null**. Null fails closed: no clock is shown, a civil decision is refused with `TIMEZONE_NOT_CONFIGURED`.
4. **Never a fallback:** browser zone, server/process zone, `UTC`, `Asia/Muscat`, the HQ zone, `sys_country_cd.default_timezone_code`, `utc_offset_hours`, `quiet_hours_tz` (see G13).
5. **Closed operation codes:** `accept_order`, `ready_by`, `pos_session`, `delivery`, `invoice`, `ledger`, **`notify`** (D27). **Any area that needs its own zone rule gets its own operation code.** Adding one is a migration (the allowed list in `fn_ops_zone` / `fn_cmx_dt_zone`), a TypeScript change, and a vector.
6. **Resolve once per action.** A list joins zones in the same query. Never call `fn_cmx_dt_zone` per row.
7. **A civil decision is frozen at write time.** It stores the civil value and, where the decision must survive a zone change, the zone snapshot (`business_date` + `business_timezone`). Past civil values are never re-derived.
8. **A client zone is an echo.** If an appointment request carries `zone` and it differs from the server's zone, the server answers `409 ZONE_MISMATCH` (the page is stale), never silently converts (refinement, see D9).
9. **HQ has its own clock** (`hq_general_config.timezone`) for HQ and SYS documents only. A tenant row inside HQ uses the tenant's zone. Platform cron is UTC and says so.

### 1.3 Banned in tenant code (enforced by CI, §7.12)

| Layer | Banned | Use instead |
|---|---|---|
| SQL | `CURRENT_DATE`, `CURRENT_TIME`, `LOCALTIME`, `LOCALTIMESTAMP`, `now()::date`, `now()::time`, `extract(hour/dow/day/month/year from now())`, `date_trunc(..., now())` without `AT TIME ZONE <resolved zone>`, `to_char(now(), …)` for a civil token, `DEFAULT CURRENT_DATE` on an `org_*` column, `SET TIME ZONE`. **From `0842` on, in new SQL: `now()`, `clock_timestamp()`, `statement_timestamp()`, `transaction_timestamp()`, `current_timestamp`, and a direct call to `fn_ops_zone`** (D25, D26; existing column `DEFAULT now()` stay) | `fn_cmx_dt_now`, `fn_cmx_dt_clock`, `fn_cmx_dt_today`, `fn_cmx_dt_local_parts`, `fn_cmx_dt_period_key`, `fn_cmx_dt_business_date`, `fn_cmx_dt_zone`, or an explicit `p_at timestamptz` argument converted with a resolved zone |
| TS (server and client) | `toISOString().slice(0,10)` / `.split('T')[0]` as "today", `new Date('YYYY-MM-DD')`, `toLocale*String()` without `timeZone`, `getHours/getDate/getDay/getMonth/getFullYear/setHours` on an instant, `Intl.DateTimeFormat` without `timeZone`, `resolvedOptions().timeZone` as a business zone, literal `'Asia/Muscat'` outside catalogs/tests/stories, any import of `temporal-polyfill` or use of the `Temporal` global outside `packages/clock/src/temporal.ts` (D1), `Intl.DateTimeFormat().resolvedOptions().timeZone` anywhere except the single `useDeviceZone` hook (D20) | `@cmx/clock` helpers (§6), display components (§7.7) |
| Dart | `DateTime.now()` for a shop day, `DateTime.parse` of an offset-less string, `.toLocal()` for shop display | `ShopClock` (§7.11) |

Allowed on purpose and marked with `-- CLOCK-OK: <reason>` / `// clock-ok: <reason>`: platform-wide UTC days (`fn_ntf_quota_reserve` quota day, `loyaltyExpiryJobId`), civil-date unpacking of a `@db.Date`, export file names that say UTC, debug viewers labelled UTC.

---

## 2. Refinements versus the earlier design

| # | Earlier | Refined (world-class practice) | Why |
|---|---|---|---|
| R1 | `fn_ops_zone` + ad-hoc `AT TIME ZONE` in each function | A **SQL time API** `fn_cmx_dt_*` (D26: `now`, `clock`, `zone`, `today`, `local_now`, `local_time`, `to_local`, `at_local`, `local_parts`, `day_bounds`, `period_key`, `business_date`, `civil_add`, …) built on `fn_ops_zone` (kept) through the thin wrapper `fn_cmx_dt_zone`. Every function takes `p_at timestamptz DEFAULT fn_cmx_dt_now()` | One place for the rule. `p_at` and the test-only fake clock (D25) make every function deterministic and testable |
| R2 | "One database instant (`clock_timestamp()`)" | **Transaction instant** `fn_cmx_dt_now()` (equal to `now()` in production) is the instant of an action (identical for every statement in that transaction). `fn_cmx_dt_clock()` (equal to `clock_timestamp()`) only for elapsed-time measurement and long loops. Existing `clock_timestamp()` writes stay until touched (D5, D25) | Two statements in one action can otherwise straddle midnight and disagree |
| R3 | Helpers only in `web-admin/lib/utils` | A workspace package **`packages/clock`** (`@cmx/clock`): pure TS, no Next/Prisma imports, used by web-admin, cmx-api, cmx-workers. HQ vendors a pinned copy with a checksum check (D2) | cmx-api must not import web-admin; duplication drifts |
| R4 | Ad-hoc DST rule text | **Temporal-compatible disambiguation**: `compatible` (gap → later, overlap → earlier; used for computed times), `earlier`, `later`, `reject` (default for typed input). Error codes `LOCAL_TIME_NONEXISTENT`, `LOCAL_TIME_AMBIGUOUS` | Same vocabulary as TC39 Temporal, so a later swap to native Temporal is mechanical |
| R5 | No library decision | **Temporal through the free `temporal-polyfill` (MIT)**, confined to one adapter file in `packages/clock` (D1). Native `Temporal` is used when the runtime has it. A removal plan is part of the docs: when browsers and Node LTS ship Temporal, the adapter switches to native and the dependency is deleted. Display formatting stays on `Intl` with explicit options. Civil-date arithmetic is on `YYYY-MM-DD` values. Mobile adds Dart `timezone` (D3) | Correct zone math (DST gaps/overlaps) from a standard API with no tzdb copy of our own; the polyfill is replaceable by design |
| R6 | Untracked tz database versions | **tzdb skew control**: conversions that decide money, numbering, or expiry happen on the server (SQL or Node). A health check compares Postgres, Node (`process.versions.tz`), and Dart `timezone` against vectors that encode recent rule changes; a mismatch raises an ops alert | Zone rules change several times a year; three runtimes update at different times |
| R7 | Calendar day only | **Business day with a cut-over time**: `org_branches_mst.business_day_cutover time NULL`, tenant default key `BUSINESS_DAY_CUTOVER` in `sys_tenant_extra_config_cf`; resolution branch → tenant → `00:00`; used by POS, cash, and "today" reports. Null everywhere keeps today's behaviour (D6) | Laundries and POS shifts that run past midnight |
| R8 | Week and fiscal implicit | **Week start** (config key `WEEK_START`, country default `sys_country_cd.default_week_start`) and **fiscal year** (`fiscal_year_start_month`, already present) are tenant settings read by `fn_cmx_dt_period_key` and the TS mirror (D7). **Hour cycle** (`HOUR_CYCLE`, country default) the same way (D13) | Gulf weeks start Saturday or Sunday, not ISO Monday; 12h/24h differs by country |
| R9 | Zone change undefined | **Zone-change policy**: forward-only, audited in `org_tz_change_tr`, confirmation dialog listing effects, future schedules re-materialized, frozen civil values untouched, open POS sessions must be closed first (D10) | A tenant moving zones mid-life must not move issued numbers, closed days, or fire jobs at the wrong hour |
| R10 | Reports compute days ad hoc | **Report rule**: filter by a half-open UTC range computed once from the civil range (`fn_cmx_dt_day_bounds` / `dtDayBounds`), then aggregate with `date_trunc(..., col AT TIME ZONE v_zone)` using **one** zone per query. Hot tables get a stored `business_date` (D11) instead of expression indexes | `AT TIME ZONE` on a per-tenant zone cannot be indexed; a range scan on `(tenant_org_id, created_at)` can |
| R11 | API rule text | **Typed API contract**: Zod 4 primitives (`zInstant`, `zCivilDate`, `zLocalTime`, `zZoneId`, `zZonedInput`, `zCivilRange`), OpenAPI `format` + `x-cmx-clock`, a response `clock` block `{ zone, businessDate, serverNow, hourCycle, weekStart, tzdbVersion }` (D21), and fixed error codes | Every route, action, DTO, and mobile model shares the same shapes |
| R12 | Display ad hoc | **Display components** `CmxInstant`, `CmxCivilDate`, `CmxLocalTime`, `CmxZoneBadge`, `CmxRelativeTime`, and pickers that emit civil fields; a `ClockProvider` per screen scope; `<time dateTime="…Z">` for accessibility | One way to paint a clock; SSR and client agree; no hydration flip |
| R13 | i18n digits unspecified | **Explicit `calendar: 'gregory'`** (an `ar-SA` formatter defaults to the Islamic Umm al-Qura calendar), explicit numbering system per tenant (default Latin, D12), explicit `hourCycle` (D13) | Avoids a Hijri date or Arabic-Indic digits appearing by accident on a receipt |
| R14 | Manual "set the laptop to UTC" checks | **Automated zone matrix**: Jest runs twice with `TZ=UTC` and `TZ=Pacific/Kiritimati` (+14); Playwright projects with `timezoneId` `America/Los_Angeles` and `Asia/Kathmandu` and `locale` `en`/`ar` | Proves the machine zone is never the shop zone |
| R15 | Guard frozen list | **Ratchet guard**: per-pattern baseline counts in `scripts/clock-contract-baseline.json` that may only go down, file markers for intentional uses, both repos, SQL and Dart | Stops regressions without blocking work on legacy files |
| R16 | Tenant jobs at a UTC hour | **Tenant-local scheduling**: civil rule + derived `next_run_at timestamptz`; daily sweeps run hourly and act per tenant when that tenant's local boundary passed, with idempotency key `job:tenant:civilDate` | A 02:00 UTC sweep is 18:00 the previous day in Los Angeles |

---

## 3. Audit gaps and fixes

| ID | Gap (evidence) | Fix | Slice |
|---|---|---|---|
| G1 | New-order Ready By uses the browser clock (`src/features/orders/ui/order-summary-panel.tsx` ~415–430: `getFullYear()`, `toLocaleTimeString`). Public `src/features/orders/public/order-tracking-page.tsx` formats `receivedAt`, `readyBy`, `doneAt` with bare `toLocaleString()`. Order tabs (`orders-*-tab-rprt.tsx`, `order-payments-credits-tables.tsx`, `tax-document-lifecycle-timeline.tsx`, `order-timeline.tsx`, `orders-edit-history-tab-rprt.tsx`) do the same | Replace with `CmxInstant` / `formatInstantOrEmpty` in the fulfilment-branch zone (`ready_by`) or the order branch (`accept_order`/`invoice`). Public tracking API returns `clock: { zone }` resolved server-side; the page never uses the device zone | S3 |
| G2 | Settings → General: `app/api/v1/settings/general/route.ts` allows only 6 GCC zones (`z.enum`), page offers `UTC`, `0826` defaults new organizations to `UTC` → a UTC tenant cannot save | Validate `timezone` against active `sys_timezone_cd` (server); page and registration load the same catalog with search; `UTC` allowed as an explicit choice only | S4 |
| G3 | 18 live SQL definitions still use `CURRENT_DATE`/`LOCALTIME`/`now()::date` (static scan, §7.1.3) plus `org_speed_price_rules_cf.effective_from DEFAULT CURRENT_DATE` | Migration `0846` rewrites each with the SQL time API; tenant columns drop the default (writer supplies the civil date); platform-wide ones keep UTC with `CLOCK-OK` | S5 |
| G4 | `check:clock-contract` exits 1 (comment in `0832`), frozen list of 40 files, misses `.split('T')[0]`, `toLocale*`, `Intl` without zone, `Asia/Muscat`, `cmx-workers`, Dart, SQL clock calls, the HQ repo | Guard v2 (§7.12): `0832` allowlisted by name, ratchet baseline, new patterns, both repos, Dart, SQL | S1 |
| G5 | No SQL tests for `fn_ops_zone`; `web-admin/__tests__/utils/ready-by-calculator.test.ts` deleted | Shared vectors → generated pgTAP file; restore a calculator test on the new API | S1, S2 |
| G6 | `0830` grants `fn_ops_zone` to `authenticated`; rule says not to | Keep the grant (tenant guard raises `OPS_ZONE_TENANT_MISMATCH`); explicit `service_role`; `anon` revoked; the new wrapper `fn_cmx_dt_zone` and the whole family use the same grants. Update the rule text (D8) | S1 docs, S2 SQL |
| G7 | `user-preferences-screen.tsx` saves `user.timezone` that nothing reads; per-user zone is out of scope | Remove the field and its message keys; ignore stored values (D14) | S4 |
| G8 | `getTenantTimeZone` returns `undefined` → next-intl formats in the viewer's zone | Operational pages render inside `ClockProvider` with an explicit zone; with no zone they show a skeleton and `reports.timezoneNotConfigured`; layout chrome passes the organization zone or formats nothing time-bearing | S4 |
| G9 | No record that the database/role `TimeZone` is UTC; `0810` comment says Asia/Muscat | Read-only check in S2 (§10 Q1: `SHOW timezone` and `pg_db_role_setting` for `postgres`, `authenticator`, `authenticated`, `service_role`, `anon`); a migration only if a role differs (the user applies it); pgTAP asserts `current_setting('TimeZone') = 'UTC'` for `authenticated` and `service_role` sessions; permanent health check `CLOCK_ROLE_TZ_UTC` (D4) | S2 |
| G10 | Stale docs: counts 977/488 (live Prisma 1234 tz / 219 naive), README "0828–0833", plan Phases 4–5 read as pending, WP13 "Written, not applied" | Refreshed in this step (README, progress, status) and in S1 for the rest | S0, S1 |
| G11 | HQ zone fallbacks: `platform-web/components/providers.tsx`, `platform-web/i18n/request.ts` (env → `Asia/Muscat`); `platform-api` doc-seq `FALLBACK_TZ = 'Asia/Muscat'` (2 services); `tenants.service.ts` defaults tenant zone to Muscat (3 places); tenant wizard default; 36 UTC-date slices in platform-api | HQ plan H2/H3/H5 (`MASTER_PLAN_v2_HQ.md`) | S13 |
| G12 | Business "today" from the machine clock: `dunning.service.ts:190`, `catalog.service.ts:813`, `fx/fx-import.service.ts:90`, `fx/fx-rate-resolver.service.ts:83`, tax dialogs (`tax-code-dialog`, `tax-explain-dialog`, `tax-review-screen`, `tax-rule-dialog`), `usage-tracking.service.ts` month bounds | `operationalCivilToday` / `useCivilTodayDefault` with the right operation; `usage-tracking` is a platform metric → explicit UTC with `clock-ok` | S4 |
| G13 | `org_ntf_settings_cf.quiet_hours_tz` is a second zone source | Quiet hours keep local `time` values; the zone is `fn_cmx_dt_zone(tenant,'notify', branch)` (D27); the worker computes the next send with `fn_cmx_dt_at_local`; code stops reading the column in S8 and a later migration (`0854`) drops it (D15) | S8 |
| G14 | `sys_timezone_cd.utc_offset_hours`, `uses_dst`, `dst_*_rule` are static metadata; a DST zone shows a wrong offset if read | Never compute with them; UI shows the live offset from `Intl` (`timeZoneName: 'shortOffset'`); live UI offset comes from `Intl` (`timeZoneName: 'shortOffset'`), never from the static offset columns; `fn_cmx_dt_is_valid_zone` reads `sys_timezone_cd` only (D28); health `CLOCK_CATALOG_UNKNOWN` compares the catalog to `pg_timezone_names` as a sync check, not a runtime path; catalog extend in `0842`, refresh in `0853` | S2, S13 |
| G15 | `0807` job queue `singleton_on timestamp without time zone` (pg-boss style), outside the guard | Classify: internal queue bucket, compared only with values written by the same function in UTC session → mark `CLOCK-OK` in the inventory; do not convert unless pg-boss is upgraded | S8 |
| G16 | No permanent health surface for the clock (zone missing or invalid, cut-over, role zone, fake clock, tzdb skew); the setup-health holiday check substitutes `UTC` | `fn_cmx_dt_health` (§5.3) surfaced in the tenant setup-health registry, HQ ops-health, and `/api/v1/health/clock` | S2, S7, S9, S13 |
| G17 | SQL reads `now()` / `clock_timestamp()` directly: no deterministic test clock, and nothing stops new code from doing so | Own clock functions with a gated test override (D25) and the guard ban for new SQL (§7.12) | S1, S2 |
| G18 | Business-day cut-over has no home; hour cycle and week start were believed to have none (**corrected by G24: they already exist on `org_tenants_mst` / `hq_general_config` since `0668`**): `sys_tenant_extra_config_cf` is a key-value catalog (closed to anon/authenticated), `sys_country_cd` has no defaults for them | Per D33: existing `0668` columns for hour cycle and week start, cut-over columns on branch, tenant and `hq_general_config`, country defaults seeded from CLDR (D29), platform values in `hq_general_config`; DEFINER readers (D6, D7, D13, §7.1.5) | S2 (SQL foundation, `0843`), S9 (UI) |
| G19 | Canonical-zone rule wrong for country zones: tzdb turned `Asia/Muscat`, `Asia/Kuwait`, `Asia/Bahrain`, `Asia/Aden`, `Europe/Oslo`, … into `backward` links; `0675` seeded only `zone1970.tab` (+ `UTC`), which omits them; `0055` had already seeded `Asia/Muscat`, `Asia/Kuwait`, `Asia/Bahrain` as active rows, and demo and older tenants store `Asia/Muscat`. The 0.1.41a rule "canonical = `zone1970.tab`, aliases from `backward`, inactive" would make `Asia/Muscat` an inactive alias: `fn_ops_zone` then returns null for Omani tenants (fail closed) and normalization would rewrite Oman to `Asia/Dubai` | D32 (ACCEPTED 2026-11-27): canonical = ECMA-402 primary identifiers (every `zone.tab` name, every `zone1970.tab` name, and `UTC`); a `backward` link is an alias only when its name is not in `zone.tab`; the UTC family maps to `UTC`; single-word and abbreviation links are not seeded | S2 |
| G20 | Existing zone validators accept non-IANA names: `fn_tenant_tz_validate` (trigger `trg_tenants_tz_validate` on `org_tenants_mst`) and `fn_hq_gen_cfg_validate` (`hq_general_config`) from `0668` only test `now() AT TIME ZONE x`, which accepts `EST`, `GMT+4`-style names and `posix/…`; `org_tenants_mst.timezone` has no FK; the branch FK (`0558`) accepts any catalog row, including alias rows once they exist | `0842` replaces both function bodies (same names, triggers kept) so only canonical active catalog codes are stored and an alias is normalized to `iana_name` first (SQL text `HQ_CONFIG_BAD_TIMEZONE` kept, mapped to API `INVALID_TIME_ZONE`), and adds `trg_branches_tz_validate` on `org_branches_mst.timezone_code`. Old values are not re-tested; health reports them (`CLOCK_ZONE_NONCANONICAL`) | S2 |
| G21 | `fn_tenant_general_value(p_tenant, 'timezone')` (`0668`, DEFINER) returns `COALESCE(tenant.timezone, hq_general_config.timezone)`: an HQ-zone fallback for a tenant, banned by §1.2 | `0846` (S5): the `timezone` key returns the tenant value only (null when unset); callers (HQ doc-seq preview, HG2) show `TIMEZONE_NOT_CONFIGURED`. Read the callers first; previous body in `-- ROLLBACK BODY` | S5 |
| G22 | `0840` credit-note expiry compares with `now() AT TIME ZONE public.fn_ops_zone(...)`: a missing zone makes the predicate null, so the note is silently never due. `0831` doc-seq and setup-health call `fn_ops_zone` directly | `0846` (S5): rewrite the two `0840` predicates with `fn_cmx_dt_today_or_null` and an explicit "zone missing → skip and report `CLOCK_ZONE_MISSING`". The `0831` callers are correct and stay; they move to `fn_cmx_dt_*` when next touched | S5 |
| G23 | `quiet_hours_tz` is also **written**: `app/api/v1/notifications/settings/route.ts` (PATCH body), `lib/notifications/settings-service.ts`, `src/features/notifications/ui/notification-settings-page.tsx`, generated `types/database.ts`, the cmx-workers bundle, and `__tests__/notifications/settings-service-hq-dispatch-scope.test.ts`. Dropping the column with a writer left breaks saves | S8 removes readers **and writers** in web-admin and cmx-workers plus their tests; `0854` only after the user regenerated types in both repos and `CLOCK_QUIET_TZ_LEGACY` is clean | S8, S15 |
| G24 | Hour cycle, week start and date format already have homes: `org_tenants_mst.time_format` (`24h`/`12h`), `first_day_of_week` (0 = Sun … 6 = Sat), `date_format`; NULL inherits `hq_general_config` (NOT NULL platform values); resolved by `fn_tenant_general_value`; edited in HQ (general-config screen, tenant locale tab). D7/D13/D30/D31 would have added a second source of truth | D33 (ACCEPTED 2026-11-27): reuse these columns, add only the CLDR country defaults and the cut-over columns, no extra-config keys and no new defaults table | S2 |
| G25 | Tenant `date_format` (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`) is not used by any planned clock component or the `clock` block | D34 (ACCEPTED 2026-11-27): `clock.dateFormat`; `CmxCivilDate` / `CmxInstant` numeric style honour it; text styles stay on `Intl` | S2 (reader), S3 (UI) |
| G26 | Dependency inversion: S3 `ClockProvider` and the S6 `clock` block need `hourCycle`, `weekStart`, `businessDate`, but their SQL readers were planned for S9, and no constant is allowed in between (D30, now D33) | Settings foundation moved into S2 as `0843`; the conditional role-zone file becomes `0844`; S5 `0846`, S8 `0849`, S9 `0850` (business-date columns + cut-over UI); S10–S15 unchanged (§7.1, §8) | S2 |

Raw migration surface at audit time (counts include legitimate uses; the guard baseline records them per file): web-admin non-test `new Date()` 564/219 files, `Date.now()` 213, UTC-date slices 52/34, date-specific `toLocale*` 69, `getHours`-family 57/21, `Asia/Muscat` 15 (4 functional); cmx-api and cmx-workers only logger/ids; mobile `DateTime.now()` 5, `DateTime.parse` 7, `toLocal()` 2, pickers 2, no `timezone` package; HQ platform-api `new Date()` 451/116 and UTC slices 36, platform-web `toLocale*` 103/55 and `Asia/Muscat` 14, platform-workers 10.

---

## 4. Decisions — FINAL

All decisions are **ACCEPTED (2026-11-26)** by the user (messages t131u–t133u). Amendments from the review are folded in. Changing one later needs a new decision row, not an edit of the old one. **D32–D35 were proposed by the 0.1.41b review and ACCEPTED as recommended on 2026-11-27 (t137u).** D33 supersedes the storage parts of D6, D7, D13 and the whole of D30 and D31; those rows stay for history and are marked SUPERSEDED. Where an older row and D33 disagree, D33 wins.

| ID | Decision | Final text | Status |
|---|---|---|---|
| D1 | Date library for TS | **Temporal through the free `temporal-polyfill` (MIT)**, imported **only** in `packages/clock/src/temporal.ts` (one adapter; ESLint `no-restricted-imports` and the guard fail any other import of `temporal-polyfill` or any use of the `Temporal` global). The adapter uses native `globalThis.Temporal` when present and the polyfill otherwise; the shared vectors prove both give the same answers. Do not assume native Temporal in Node 24. Display formatting still goes through `Intl.DateTimeFormat` with explicit options. **Removal plan:** a quarterly check (calendar item in `current_status.md`); when every browser in the supported browserslist and the Node LTS in use ship Temporal unflagged, switch the adapter to native, delete the dependency, run the vectors, and record it in the changelog. Mobile uses the Dart `timezone` package (D3) | ACCEPTED |
| D2 | Sharing helpers across repos | Workspace package `packages/clock` (`@cmx/clock`) in the tenant repo; HQ vendors a pinned copy with a `CHECKSUM` file; HQ CI compares the checksum and runs the same vectors. A private registry is a later option | ACCEPTED |
| D3 | Mobile tz engine | Dart `timezone` (`latest_10y`) plus API-supplied zone and ready-made local labels (`local: { date, time }`) for critical labels such as Ready By | ACCEPTED |
| D4 | Database session zone | **S2 read-only check:** `SHOW timezone;` and `pg_db_role_setting` for `postgres`, `authenticator`, `authenticated`, `service_role`, `anon`, plus the database-level setting (Q1 in §10). **Only if a role or the database differs,** migration `0844` with `ALTER ROLE <role> SET timezone = 'UTC'` / `ALTER DATABASE … SET timezone = 'UTC'`; the user applies it. A **permanent health check** (`CLOCK_ROLE_TZ_UTC`, §5.3) keeps reporting it. Code never depends on the session zone | ACCEPTED |
| D5 | `now()` versus `clock_timestamp()` | **Our own clock functions** `fn_cmx_dt_now()` (the fixed transaction time, same as `now()`) and `fn_cmx_dt_clock()` (the moving time, same as `clock_timestamp()`); full contract in D25. One action stamps every row with the same `fn_cmx_dt_now()`; `fn_cmx_dt_clock()` is only for elapsed-time measurement and long loops. Existing `clock_timestamp()` writers (POS `opened_at`, `readDatabaseInstant`, `civilYearMonthToken`) stay until touched, then move to `dtNow` | ACCEPTED |
| D6 | Business-day cut-over | **`org_branches_mst.business_day_cutover time NULL`** (null means inherit). Tenant default **`org_tenants_mst.business_day_cutover time NULL`**, platform value **`hq_general_config.business_day_cutover time NOT NULL DEFAULT '00:00'`** (D33). Allowed range: `00:00`–`11:59`. **Health checks:** `CLOCK_CUTOVER_INVALID` and `CLOCK_CUTOVER_INCONSISTENT` (§5.3). **Resolution:** branch → tenant → `hq_general_config` (D33) | ACCEPTED (storage amended by D33; the D30/D31 storage is superseded) |
| D7 | Week start | Tenant setting **`org_tenants_mst.first_day_of_week`** (existing since `0668`, `0` = Sun … `6` = Sat, NULL inherits) → country default `sys_country_cd.default_week_start` (`smallint` 0–6, added in S2 `0843`, seeded from CLDR, D29; Friday = 5 allowed) → **`hq_general_config.first_day_of_week`** (platform value, NOT NULL) per D33. Wire value in `clock.weekStart` is the ISO weekday number (Mon=1 … Sun=7). No hard-coded constant | ACCEPTED (storage amended by D33; the D30/D31 storage is superseded) |
| D8 | `fn_ops_zone` grants | Keep `authenticated` with the tenant guard (`OPS_ZONE_TENANT_MISMATCH`), explicit `service_role`; jobs (`postgres` / pg_cron, `service_role`, SECURITY DEFINER owners) pass the tenant explicitly and are never blocked; `anon` never. Update the rule text. `fn_ops_zone` stays deployed; all new SQL calls `fn_cmx_dt_zone` (D26) | ACCEPTED |
| D9 | Client-sent zone | **Writes only.** If the client sends a zone and it differs from the server's resolved zone, the write is rejected with `409 ZONE_MISMATCH`; clients may omit it. Viewing is separate (D20) | ACCEPTED |
| D10 | Zone change mid-life | Forward-only, audited in `org_tz_change_tr`; confirmation dialog lists effects; refused while a POS session is open on an affected branch; future schedules re-materialized; issued numbers, `business_date`, closed periods untouched | ACCEPTED |
| D11 | Local-day performance | Stored `business_date date` + `business_timezone text` on `org_orders_mst` and the payments table (expand now, readers move, no drop) | ACCEPTED |
| D12 | Digits | Latin digits (`numberingSystem: 'latn'`) in both locales; tenant override only if asked. This matches the existing `NUMBERS_AND_DATES` catalog default `LATN` | ACCEPTED |
| D13 | 12h / 24h | Tenant setting **`org_tenants_mst.time_format`** (existing since `0668`, `24h`/`12h`, NULL inherits) → **`sys_country_cd.default_hour_cycle`** (new nullable column added in S2 `0843` with a CHECK of `H12`/`H23`, **seeded from Unicode CLDR, D29**, editable by HQ) → **`hq_general_config.time_format`** (platform value, NOT NULL) per D33. No hard-coded country list in code. A NULL tenant value with no country default raises health `CLOCK_SETTING_UNRESOLVED` (warning; resolution still succeeds from `hq_general_config`) | ACCEPTED (storage amended by D33; the D30/D31 storage is superseded) |
| D14 | Per-user time zone | Removed (G7); stored values ignored | ACCEPTED |
| D15 | `quiet_hours_tz` | **Removed.** Quiet hours stay as two local `time` values (`quiet_hours_start/end`). The worker computes the next allowed send with **`fn_cmx_dt_at_local`** (`compatible`). **Stop reading the column now (S8); drop it in a later migration (`0854`) after the soak** and health check `CLOCK_QUIET_TZ_LEGACY` is clean. **The operation code is `notify`, not `delivery` (D27).** | ACCEPTED (amended by D27) |
| D16 | Zone catalog | **IANA names only** (no offsets, no abbreviations such as `GST`/`EST`, no `Etc/GMT±N`, no `posix/` or `right/` prefixes). Catalog `sys_timezone_cd` holds the official list with a curated `is_active` flag. Health `CLOCK_ZONE_INVALID` flags stored zones that are not a valid catalog code or not active. **Runtime validation and the extra catalog columns are in D28** (`fn_cmx_dt_is_valid_zone` reads this table, not `pg_timezone_names`) | ACCEPTED (runtime source amended by D28) |
| D17 | Who applies migrations | **Only the user applies migrations.** The agent writes files, never applies them, never runs `db push`. `RESUME_CONTINUATION.md`, `work-packages.md`, and the status files are updated and the old "allowed to apply" and "suspended" notes are removed | ACCEPTED |
| D18 | `sys_*` / `hq_*` stamps | Reader list (WP21) first, then one migration deployed with the HQ readers; `sessions` and `one_time_tokens` are classified and left alone if auth-owned | ACCEPTED |
| D19 | Tenant-local jobs | Civil rule + derived `next_run_at timestamptz`; pg_cron and pg-boss stay UTC | ACCEPTED |
| D20 | Viewer zone | **Display-only toggle "Show times in: Branch zone / My device zone"** on chosen reports and lists (first set: orders list, orders/payments/customers reports, outbox, audit screens, delivery log). Default is the branch zone. Day filters, bucketing, and grouping always stay in the operations zone; only instants in cells are re-rendered; civil dates are never converted. Exports state the zone used (`display_zone` column or header line; instant columns stay `Z`). The **zone badge** shows whenever the two zones differ at that instant, or a list mixes zones. The device zone is read in exactly one hook (`useDeviceZone`, guard-allowlisted) | ACCEPTED (merged with the earlier D20) |
| D21 | API `clock` block | Every screen endpoint returns `clock: { zone, businessDate, serverNow, hourCycle, weekStart, tzdbVersion }` (§6.3). Zod `zClockBlock`, OpenAPI schema `ClockBlock`, mobile model `ClockBlock` | ACCEPTED (amended: fields) |
| D22 | HQ billing periods | Subscription periods as instants (UTC); invoice dates as HQ-zone civil dates | ACCEPTED |
| D23 | Feature flags | None for correctness fixes; one flag `clock.business_day_cutover` only to expose the cut-over UI | ACCEPTED |
| D24 | Reports after a zone change | Current zone, rows with a snapshot keep theirs, the report header names the zone | ACCEPTED |
| D25 | **Our own SQL clock** (new) | `fn_cmx_dt_now()` returns the fixed transaction time and `fn_cmx_dt_clock()` the moving time. **Production results equal `now()` and `clock_timestamp()`.** Both honor a **test-only session override `cmx.fake_now`**, which is ignored in production (gating in §5.0). **Existing column `DEFAULT now()` stay unchanged** (no mass DDL, and every DDL triggers a PostgREST schema reload). **New tables, functions, triggers, and defaults from `0842` on must use ours**, enforced by the guard (§7.12). TS mirror: `dtNow(clock)`, `dtClock(clock)` | ACCEPTED |
| D26 | **Naming** (new) | Family prefix **`fn_cmx_dt_*`** ("cmx date-time"). `fn_cmx_dt_zone` is a thin wrapper over the existing deployed `fn_ops_zone`, which stays. TS mirrors use the `dt` prefix: `dtNow`, `dtClock`, `dtZone`, `dtToday`, `dtLocalTime`, `dtLocalNow`, `dtAtLocal`, `dtToLocal`, `dtLocalParts`, `dtDayBounds`, `dtPeriodKey`, `dtBusinessDate`, `dtCivilAdd`. The one-to-one table is §5.1 | ACCEPTED |
| D27 | **`notify` operation code** (new) | Add **`notify`** to the closed operation list used by `fn_ops_zone` / `fn_cmx_dt_zone` / `resolveOperationalTimeZone` / the shared vectors. **Quiet hours and notification scheduling use `notify`, not `delivery`.** The scope is the branch the notification is for (the customer's or order's branch, or the campaign's branch when it has one); a null scope reads the organization zone. **Policy: any area that needs its own zone rule gets its own operation code** (a migration that updates the allowed list, a TypeScript change, and a vector). The SQL allowed-list change is in `0842` (S2), because `fn_ops_zone` is already deployed in `0830`; the TypeScript list and vectors are updated in S1 so they already agree when S2 is applied | ACCEPTED (2026-11-26, t135u) |
| D28 | **`sys_timezone_cd` is the runtime zone catalog** (new) | The app and SQL **never read `pg_timezone_names` at runtime**. `fn_cmx_dt_is_valid_zone` and the TypeScript `isValidZoneId` read `sys_timezone_cd` (and a generated or cached snapshot of it in `@cmx/clock`). Inspected live shape (Prisma + `0055` + seed `0675`, which already loaded canonical `zone1970.tab` on 2026-10-30 and deliberately left aliases out of the picker): `code` (PK, the IANA id), `name`/`name2` (EN/AR, today just the IANA id), `description`/`description2`, `display_order`, `icon`, `color`, `utc_offset_hours`/`utc_offset_minutes`/`utc_offset_string` (a snapshot at `2026-10-30T12:00:00Z`), `uses_dst`, `dst_start_rule`/`dst_end_rule`, `region`, `country_code` (primary, varchar 2), `is_default`, `is_system`, `is_active`, `metadata` (already has `countries[]`, coordinates, source), audit columns. **Do not add duplicate columns** for names, DST flag, or sort order: `name`/`name2` are the EN/AR labels (refreshed from CLDR), `uses_dst` is "observes DST", `display_order` is sort order, and `code` is the IANA identifier. **Columns to add in `0842`:** `iana_name text NOT NULL` (always the canonical IANA name: equal to `code` on a canonical row, equal to `link_target` on an alias), `is_canonical boolean NOT NULL DEFAULT true`, `link_target text NULL` (FK to `sys_timezone_cd.code`, required when not canonical), `std_offset_minutes int NOT NULL`, `dst_offset_minutes int NOT NULL` (equal to std when the zone does not observe DST), `country_codes text[]` (full `zone1970.tab` country list; `country_code` stays the primary / first country), `tzdb_version text NOT NULL`, `cldr_version text NULL` (version of the names). The picker and stored tenant/branch/HQ zones accept **canonical + active** rows only; alias rows exist so validation can recognize and **normalize** a legacy or imported alias to `iana_name` before storage. Seed / refresh from the official IANA tzdb (`zone1970.tab` + `backward`) plus CLDR timezone display names (en, ar). A trigger enforces the IANA name shape and the alias link (it does **not** call `fn_cmx_dt_is_valid_zone`, which would be circular). Health `CLOCK_CATALOG_UNKNOWN` / `CLOCK_TZDB_SKEW` compare the catalog to `pg_timezone_names` as a **sync check only**. `utc_offset_*` stay informational (G14); money and civil decisions never use them | ACCEPTED (2026-11-26, t135u) |
| D29 | **Country clock defaults from CLDR** (new) | `sys_country_cd.default_hour_cycle` and `default_week_start` (added in `0843`) are **seeded from official Unicode CLDR supplemental data**, not from memory and not from a hand-maintained list: `timeData` preferred hour cycle (`h`/`hB`/`bh` → `H12`; `H`/`Hb`/`k` → `H23`) and `weekData` `firstDay` (`sun`/`mon`/`sat`/`fri` → `SUN`/`MON`/`SAT`/`FRI`). Source files: the CLDR release's `common/supplemental/supplementalData.xml` (published at [cldr.unicode.org](https://cldr.unicode.org) / the Unicode CLDR GitHub). Each country row records `cldr_version` and `clock_defaults_source` (for example `CLDR 46 supplemental/timeData+weekData`). The exact CLDR release number is the current official release at the moment `0843` is written and is recorded in the migration comment and on the rows. HQ can edit a value afterwards; the source columns stay so a later refresh can show the diff | ACCEPTED (2026-11-26, t135u) |
| D30 | ~~**Platform fallback catalog `sys_tenant_config_defaults_cd`** (new)~~ **SUPERSEDED by D33 (2026-11-27)**: the table is not created; `hq_general_config` is the platform fallback store. Kept for history | Create a new catalog table for last-resort tenant-config values so **no hard-coded constants** remain in SQL or in `@cmx/clock`. The user wrote `sys_defults_tenants_config_cd`; the plan uses the corrected spelling **`sys_tenant_config_defaults_cd`** (catalog convention `sys_*_cd`). Seed: `HOUR_CYCLE=H23`, `WEEK_START=SAT`, `BUSINESS_DAY_CUTOVER=00:00`. **Resolution order, everywhere:** branch (cut-over column only) → tenant extra-config → country default (hour cycle and week start; cut-over has no country column) → this defaults table. TypeScript reads the same resolved values from the API `clock` block and, where a raw default is needed, from a small config payload or generated snapshot of this table — never from a constant in source. Health `CLOCK_DEFAULTS_MISSING` fails if a required key is absent from the table | SUPERSEDED by D33 (accepted 2026-11-26, t135u; superseded 2026-11-27, t137u) |
| D31 | ~~**Config category `DATETIME`** (new)~~ **SUPERSEDED by D33 (2026-11-27)**: no extra-config keys are added; the labels "Date & Time" / "التاريخ والوقت" become the section title in Settings → General and the HQ tenant locale tab. Kept for history | A **category** is the settings-screen group: `sys_tenant_extra_config_cf.category_code` (UPPER_SNAKE_CASE text; existing groups from `0775` are `NUMBERS_AND_DATES`, `TABLES_AND_DENSITY`, `POS_ERGONOMICS`, `ACCESSIBILITY`; there is no separate category table for extra-config — `sys_stng_categories_cd` belongs to a different settings family). Keys that share a category appear together in one section of the tenant extra-config screen. Add category **`DATETIME`**, labels EN **"Date & Time"** / AR **"التاريخ والوقت"**, and put `BUSINESS_DAY_CUTOVER`, `HOUR_CYCLE`, and `WEEK_START` in it so they are not mixed with numeral script (`NUMBERS_AND_DATES` stays for `NUMBER_SCRIPT`, `DATE_DIGITS`, and related keys). The tenant settings UI shows a "Date & Time" section for these three | SUPERSEDED by D33 (accepted 2026-11-26, t135u; superseded 2026-11-27, t137u) |
| D32 | **Canonical zone set** (0.1.41b review; amends the D28 seed rule; fixes G19) | `is_canonical = true` for: every name in IANA `zone.tab` (one or more per country, so `Asia/Muscat`, `Asia/Kuwait`, `Asia/Bahrain`, `Asia/Aden` stay distinct), every name in `zone1970.tab`, and `UTC` (ECMA-402 / Temporal "primary identifier" rule: links are not merged across country codes). Aliases (`is_canonical = false`, `is_active = false`, `link_target` = canonical) only for `backward` links whose name is **not** in `zone.tab`, e.g. `Asia/Calcutta` → `Asia/Kolkata`, `Europe/Kiev` → `Europe/Kyiv`, `US/Eastern` → `America/New_York`, `Asia/Katmandu` → `Asia/Kathmandu`. UTC family `Etc/UTC`, `Etc/UCT`, `Etc/Universal`, `Etc/Zulu`, `Etc/GMT`, `GMT`, `UCT`, `Universal`, `Zulu` → `UTC`. Single-word and abbreviation links (`Japan`, `GB`, `EST`, `EST5EDT`, …) are not seeded, so they stay invalid input (D16). Existing `0055` rows (`Asia/Muscat`, `Asia/Kuwait`, `Asia/Bahrain`, …) remain canonical and active. Browser `resolvedOptions().timeZone` may return legacy ICU names (`Asia/Calcutta`); `useDeviceZone` normalizes through the catalog snapshot. Without it Omani tenants would lose their zone when `0842` is applied | ACCEPTED (2026-11-27, t137u) |
| D33 | **Settings homes reuse `0668`** (0.1.41b review; supersedes the storage parts of D6, D7, D13 and all of D30, D31; fixes G24) | Hour cycle: `org_tenants_mst.time_format` (NULL inherits) → `sys_country_cd.default_hour_cycle` (new, CLDR, D29) → `hq_general_config.time_format` (platform value, NOT NULL). Week start: `org_tenants_mst.first_day_of_week` → `sys_country_cd.default_week_start` (new, `smallint` 0–6 like the existing columns; CLDR `fri` = 5) → `hq_general_config.first_day_of_week`. Cut-over: `org_branches_mst.business_day_cutover` → new `org_tenants_mst.business_day_cutover time NULL` → new `hq_general_config.business_day_cutover time NOT NULL DEFAULT '00:00'`. `hq_general_config` is the platform fallback store D30 asked for (one row, validated, audited, HQ screen exists), so `sys_tenant_config_defaults_cd` and the three `DATETIME` extra-config keys are **not** created; "Date & Time" / "التاريخ والوقت" (D31 labels) becomes the section title in tenant Settings → General and in the HQ tenant locale tab. Readers `fn_cmx_dt_hour_cycle` / `_week_start` / `_cutover` add the country step; `fn_tenant_general_value` keeps its tenant → HQ meaning for current callers. Wire: `24h` → `h23`, `12h` → `h12`; week `0..6` → ISO `CASE dow WHEN 0 THEN 7 ELSE dow END`. Effect: a tenant whose column is NULL moves from the HQ value to its country's CLDR value (what t131u asked for). One source of truth, no new table, HQ screens already exist | ACCEPTED (2026-11-27, t137u) |
| D34 | **`dateFormat` in the `clock` block** (0.1.41b review; extends D21; fixes G25) | `clock.dateFormat` ∈ `YYYY-MM-DD` / `DD/MM/YYYY` / `MM/DD/YYYY`, resolved tenant → `hq_general_config` (existing `fn_tenant_general_value('date_format')`). Numeric date style in `CmxCivilDate` / `CmxInstant` and exports honour it; `medium`/`long` text styles stay on `Intl` (locale month names, `calendar: 'gregory'`, D12 digits). The setting exists, HQ edits it, and before this nothing read it | ACCEPTED (2026-11-27, t137u) |
| D35 | **`business_date` tables** (0.1.41b review; resolves "the payments table" in D11) | `org_orders_mst`: operation `accept_order`, scope `branch_id`, instant = insert `fn_cmx_dt_now()` (backfill from `created_at`). `org_order_payments_dtl`: operation `invoice`, scope `branch_id`, instant `COALESCE(paid_at, created_at)`, set once when `paid_at` is first set. `org_invoice_payments_dtl` (AR applications) is excluded; AR reports use invoice civil dates | ACCEPTED (2026-11-27, t137u) | PROPOSED |

## 5. SQL time API (`fn_cmx_dt_*`)

Conventions for every function: `public` schema, commented (function and arguments), `REVOKE ALL … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated, service_role` (exception: `fn_cmx_dt_now`, `fn_cmx_dt_clock` and their internal gate helper are also granted to `anon`, because column defaults and triggers on tables an `anon` path may write evaluate them with the caller's rights; they return only the time; review row 22). `SECURITY INVOKER` with `SET search_path = pg_catalog, public, pg_temp` unless the table below says `DEFINER` (only the setting and health readers, because `sys_tenant_extra_config_cf` is closed to `anon` and `authenticated` by `0775`; DEFINER functions repeat the tenant guard of `fn_ops_zone` and filter `tenant_org_id` in the statement). A missing zone raises `TIMEZONE_NOT_CONFIGURED` (`ERRCODE 'P0001'`, `HINT` names the tenant and operation) unless the name ends in `_or_null`. Argument order is `(p_tenant, p_operation, p_scope, …, p_at)`. Every time-reading function takes `p_at timestamptz DEFAULT fn_cmx_dt_now()`, so tests can pass an instant or set `cmx.fake_now`.

### 5.0 Clock functions and the test override (D5, D25)

| Function | Returns | Volatility | Production behaviour |
|---|---|---|---|
| `fn_cmx_dt_now()` | `timestamptz` | STABLE | `now()` |
| `fn_cmx_dt_clock()` | `timestamptz` | VOLATILE | `clock_timestamp()` |

Fast path: `fn_cmx_dt_now()` is `LANGUAGE sql STABLE`: `SELECT CASE WHEN coalesce(current_setting('cmx.fake_now', true), '') = '' THEN pg_catalog.now() ELSE public.fn_cmx_dt__fake_now() END`, so the planner can inline it and production pays one `current_setting` call. The gate lives in the internal plpgsql helper `fn_cmx_dt__fake_now()` (and `fn_cmx_dt__fake_clock()`), reached only when the setting is present. S2 acceptance includes a micro-benchmark, target no worse than twice the cost of `now()` over one million calls.

**Override gate.** A custom setting such as `cmx.fake_now` cannot be locked in Postgres: any session may `SET` it. So the helpers **ignore it unless both gates pass, checked in this order** (the order matters: app roles must never reach the table read, because `cmx_dt_env_cf` is owner-only and an INVOKER read by `authenticated` would raise `permission denied`, review row 18):
1. `session_user` is `postgres` or a superuser (`pg_roles.rolsuper`, readable by every role). Through PostgREST the session user is `authenticator`, so app traffic stops here.
2. Only then: `public.cmx_dt_env_cf.env = 'test'`. This is a one-row table created in `0842` with `env = 'prod'`, owner-only (`REVOKE ALL` from every role, RLS on with no policy); the owner (`postgres`) can read it, so no `SECURITY DEFINER` is needed. Only the pgTAP harness flips it, inside a transaction that rolls back, as the owner. No migration, seed, or remote script may write `'test'` (guard check).

If either gate fails the function returns the real time and emits `WARNING 'CMX_FAKE_NOW_IGNORED'`. `authenticated`, `anon`, `service_role`, and `authenticator` can set the setting but it has no effect. Under the override `fn_cmx_dt_now()` returns the fake instant for the whole transaction, and `fn_cmx_dt_clock()` returns the fake instant plus the real time elapsed since the transaction started (it still moves). Health check `CLOCK_FAKE_ENV` fails if `env <> 'prod'` on any non-local database.

### 5.1 Function list and TypeScript mirror

| SQL function | Returns | Volatility | TS mirror (`@cmx/clock`) | Purpose |
|---|---|---|---|---|
| `fn_cmx_dt_now()` / `fn_cmx_dt_clock()` | `timestamptz` | STABLE / VOLATILE | `dtNow(clock)` / `dtClock(clock)` | §5.0 |
| `fn_ops_zone(p_tenant, p_operation, p_scope)` | `text` or null | STABLE | `resolveOperationalTimeZone` | **Existing (`0830`), unchanged, stays.** Not called by new SQL directly |
| `fn_cmx_dt_zone(p_tenant uuid, p_operation text, p_scope uuid DEFAULT NULL)` | `text` or null | STABLE | `dtZone` | Thin wrapper over `fn_ops_zone`. Unlike `fn_ops_zone` (which returns null for an unknown code), it raises `CLOCK_UNKNOWN_OPERATION` (`22023`) for a code outside the closed list, so a typo is not reported as `TIMEZONE_NOT_CONFIGURED` (review row 25). `fn_ops_zone` itself stays unchanged apart from `notify` |
| `fn_cmx_dt_zone_required(p_tenant, p_operation, p_scope DEFAULT NULL)` | `text` | STABLE | `dtZoneRequired` | Raises when null |
| `fn_cmx_dt_hq_zone()` | `text` | STABLE | `dtHqZone` | `hq_general_config.timezone`; raises when null. HQ and SYS documents only |
| `fn_cmx_dt_is_valid_zone(p_zone text)` | `boolean` | STABLE | `isValidZoneId` | D28: true when the code is a canonical **active** row, or an alias whose `link_target` is canonical and active. Optional companion `fn_cmx_dt_canonical_zone(p_zone)` returns `iana_name` or null. TypeScript mirrors read a snapshot of the same table, never `pg_timezone_names` |
| `fn_cmx_dt_today(p_tenant, p_operation, p_scope DEFAULT NULL, p_at DEFAULT fn_cmx_dt_now())` | `date` | STABLE | `dtToday` | Replaces `CURRENT_DATE` |
| `fn_cmx_dt_today_or_null(...)` | `date` or null | STABLE | `dtTodayOrNull` | Health checks that must not raise |
| `fn_cmx_dt_today_in(p_zone text, p_at DEFAULT fn_cmx_dt_now())` | `date` | STABLE | `dtTodayIn` | Explicit zone (HQ, snapshots) |
| `fn_cmx_dt_local_now(p_tenant, p_operation, p_scope DEFAULT NULL, p_at DEFAULT fn_cmx_dt_now())` | `timestamp` (local wall) | STABLE | `dtLocalNow` | Display and cut-off comparisons; never stored |
| `fn_cmx_dt_local_time(p_tenant, p_operation, p_scope DEFAULT NULL, p_at DEFAULT fn_cmx_dt_now())` | `time` | STABLE | `dtLocalTime` | "Is the shop open now", cut-offs, quiet hours |
| `fn_cmx_dt_to_local(p_instant timestamptz, p_zone text)` | `timestamp` | STABLE (IMMUTABLE only if `pg_proc` says the zone conversion is, verified in S2) | `dtToLocal` | Pure conversion with an explicit zone |
| `fn_cmx_dt_at_local(p_tenant, p_operation, p_scope, p_date date, p_time time, p_disambiguation text DEFAULT 'reject')` | `timestamptz` | STABLE | `dtAtLocal` | Local date and time at the shop to an instant; `p_disambiguation` ∈ `compatible`, `earlier`, `later`, `reject`; `reject` raises `LOCAL_TIME_NONEXISTENT` / `LOCAL_TIME_AMBIGUOUS` |
| `fn_cmx_dt_instant_at_zone(p_zone text, p_date date, p_time time, p_disambiguation text DEFAULT 'reject')` | `timestamptz` | STABLE | `dtInstantAtZone` | Same with an explicit zone |
| `fn_cmx_dt_day_bounds(p_tenant, p_operation, p_scope, p_from date, p_to_exclusive date)` | `TABLE(start_at, end_at timestamptz)` | STABLE | `dtDayBounds` | Half-open UTC range of local days (23h/25h days, midnight-gap zones start at the first valid instant) |
| `fn_cmx_dt_local_parts(p_instant timestamptz, p_zone text)` | `TABLE(local_date date, local_time time, iso_dow smallint, hour smallint, minute smallint, utc_offset_min int)` | STABLE | `dtLocalParts` | Reports by hour or weekday, business-hours rules |
| `fn_cmx_dt_business_date(p_tenant, p_operation, p_scope DEFAULT NULL, p_at DEFAULT fn_cmx_dt_now())` | `date` | STABLE | `dtBusinessDate` | `((p_at AT TIME ZONE zone) - cutover)::date`: computed on the local wall clock, so a DST day needs no special case (a cut-over inside a DST gap or overlap still splits the day at that wall time). Created in `0843` (S2); before it is applied the business date is `dtToday` |
| `fn_cmx_dt_business_day_bounds(p_tenant, p_operation, p_scope, p_from date, p_to_exclusive date)` | `TABLE(start_at, end_at timestamptz)` | STABLE | `dtBusinessDayBounds` | Half-open UTC range from (`p_from`, cut-over) to (`p_to_exclusive`, cut-over), each with `compatible`; for tables without a stored `business_date`. `0843` (review row 27) |
| `fn_cmx_dt_period_key(p_tenant, p_operation, p_scope, p_grain text, p_at DEFAULT fn_cmx_dt_now())` | `text` | STABLE | `dtPeriodKey` | `DAY` (`YYYYMMDD`), `MONTH` (`YYYYMM`), `YEAR` (`YYYY`), `FY` (`FY2026` from `fiscal_year_start_month`); `WEEK` is added in `0843`: key `W` + the civil date of the first day of that week, `WYYYYMMDD` (e.g. `W20261121` for a Saturday-start week). ISO `YYYY-Www` is not used, because it is ambiguous when the week does not start on Monday (review row 26). A change of week start changes the key of the current week; the settings screen warns, and doc-seq does not offer a weekly reset in this program. Tenant doc-seq period keys call it |
| `fn_cmx_dt_civil_add(p_date date, p_n int, p_unit text)` | `date` | IMMUTABLE | `dtCivilAdd` | `DAY`, `MONTH` with end-of-month clamp, `YEAR` |
| `fn_cmx_dt_cutover(p_tenant, p_branch DEFAULT NULL)` | `time` | STABLE, DEFINER | `dtCutover` | `org_branches_mst.business_day_cutover` → `org_tenants_mst.business_day_cutover` → `hq_general_config.business_day_cutover` (`0843`, D33) |
| `fn_cmx_dt_hour_cycle(p_tenant)` / `fn_cmx_dt_week_start(p_tenant)` | `text` / `smallint` | STABLE, DEFINER | `dtHourCycle` / `dtWeekStart` | `org_tenants_mst.time_format` / `first_day_of_week` (NULL skips) → country default (CLDR, D29) → `hq_general_config` (`0843`, D33). No hard-coded constant. Returns the wire value (`h12`/`h23`, ISO 1–7) |
| `fn_cmx_dt_health(p_tenant uuid DEFAULT NULL)` | `TABLE(check_code, severity, tenant_org_id, branch_id, detail)` | STABLE, DEFINER, `service_role` only | health endpoints | §5.3. **Aggregator only:** it unions one function per check, `fn_cmx_dt_chk_<code>()`, so a later migration adds a check by adding a function and a registry row, never by replacing the aggregator body (no check lost between migrations, review row 23) |
| `fn_cmx_dt_date_format(p_tenant)` | `text` | STABLE, DEFINER | `dtDateFormat` | D34: tenant → `hq_general_config` via `fn_tenant_general_value('date_format')` (`0843`) |

### 5.2 Rules for callers
- List queries read the zone once into a variable (or join the tenant/branch zone in one CTE) and then use `fn_cmx_dt_to_local(col, v_zone)` or a precomputed range. Never call `fn_cmx_dt_today(...)` per row.
- New SQL never calls `fn_ops_zone` directly and never uses `now()`, `clock_timestamp()`, `statement_timestamp()`, `transaction_timestamp()`, or `current_timestamp`; it calls `fn_cmx_dt_*` (guard, §7.12).
- Platform-wide UTC logic uses `fn_cmx_dt_now()` with a `-- CLOCK-OK: UTC platform day` comment.

### 5.3 Health checks (permanent)

`fn_cmx_dt_health()` returns one row per finding (platform view, `service_role` only). It is surfaced in three places: the **tenant setup-health registry**, the **HQ ops-health module** (platform checks and a roll-up across tenants), and `GET /api/v1/health/clock`. **Registry shape (read live `0709`/`0739`, review row 24):** tenant-facing checks are separate functions `fn_shc_clock_<check>(p_tenant uuid, p_branch uuid) RETURNS jsonb` (`{status: OK|FAIL|NA, count, sample_ids, details}`, plpgsql, STABLE, `SECURITY INVOKER`, `PERFORM fn_shc_guard_tenant(p_tenant)` first, every `org_*` read filtered by `tenant_org_id`), calling the DEFINER readers where the catalog is closed. Registry rows in `sys_setup_health_check_cd` under a new domain row `CLOCK` (EN "Date & time", AR "التاريخ والوقت") with `name`/`name2`, `description`/`description2`, `ok_name`/`ok_name2`, `fix_route`, `fix_permission`, `fn_name`. Severity words map to the registry vocabulary: error → `BLOCKER`, warning → `WARNING`, info → `INFO`; `shows_banner` only for `CLOCK_ZONE_MISSING` and `CLOCK_ZONE_INVALID`; platform checks (`CLOCK_ROLE_TZ_UTC`, `CLOCK_CATALOG_UNKNOWN`, `CLOCK_FAKE_ENV`, `CLOCK_DEFAULTS_MISSING`) are `is_hq_only = true`. The nightly `setup-health-refresh` job picks the new rows up without change.

| Code | Severity | Checks | Added in |
|---|---|---|---|
| `CLOCK_ROLE_TZ_UTC` | error | `postgres`, `authenticator`, `authenticated`, `service_role`, `anon` and the database have no non-UTC `timezone` setting; `current_setting('TimeZone') = 'UTC'` | `0842` |
| `CLOCK_ZONE_MISSING` | error | A tenant has no usable operations zone | `0842` |
| `CLOCK_ZONE_INVALID` | error | A stored tenant or branch zone is not valid IANA (`fn_cmx_dt_is_valid_zone`) or not an active `sys_timezone_cd` code; `hq_general_config.timezone` invalid | `0842` |
| `CLOCK_CATALOG_UNKNOWN` | error | An active canonical `sys_timezone_cd.iana_name` is missing from `pg_timezone_names` (one direction only: `pg_timezone_names` does not say which names are canonical, so the reverse test cannot be done in SQL; the refresh script in `0853` compares against the tzdb files instead) | `0842` |
| `CLOCK_ZONE_NONCANONICAL` | warning | A stored tenant, branch or HQ zone is an alias or a legacy row (`is_canonical = false`); fix: save the canonical name (the S2 triggers normalize on the next change) | `0842` |
| `CLOCK_COUNTRY_UNKNOWN` | warning | `org_tenants_mst.country` is not a `sys_country_cd.code`; the country step of hour-cycle / week-start resolution is skipped | `0843` |
| `CLOCK_FAKE_ENV` | error | `cmx_dt_env_cf.env <> 'prod'`, or `cmx.fake_now` set in a non-test session | `0842` |
| `CLOCK_CUTOVER_INVALID` | error | A branch cut-over is outside `00:00`–`11:59`, or the tenant `BUSINESS_DAY_CUTOVER` is not `HH:mm` | `0843` |
| `CLOCK_CUTOVER_INCONSISTENT` | warning | A branch override exists on a branch without a resolvable zone; branches of one tenant disagree by more than 6 hours (info); a branch override exists while the tenant has no default (info) | `0843` |
| `CLOCK_SETTING_UNRESOLVED` | warning | `org_tenants_mst.time_format` or `first_day_of_week` is NULL and the tenant's country has no default (resolution still succeeds from `hq_general_config`, D33) | `0843` |
| `CLOCK_DEFAULTS_MISSING` | error | The `hq_general_config` row is missing, so the platform values for hour cycle, week start, date format and cut-over cannot be read (D33; the columns themselves are NOT NULL) | `0843` |
| `CLOCK_QUIET_TZ_LEGACY` | info | `org_ntf_settings_cf.quiet_hours_tz` is still set and differs from the resolved zone | `0849` |
| `CLOCK_TZDB_SKEW` | warning | Postgres, the app server (`process.versions.tz`), and Dart vector results disagree on a recent-rule vector | app check, S7 |

### 5.4 Error vocabulary (SQL, TS, API, Dart, i18n keys)

| Code | HTTP | EN / AR message key |
|---|---|---|
| `TIMEZONE_NOT_CONFIGURED` | 422 | `clock.errors.timezoneNotConfigured` (reuses `reports.timezoneNotConfigured` text) |
| `LOCAL_TIME_NONEXISTENT` | 422 | `clock.errors.localTimeNonexistent` ("This time does not exist on that day because the clocks change. Choose another time.") |
| `LOCAL_TIME_AMBIGUOUS` | 422 | `clock.errors.localTimeAmbiguous` (offers earlier/later) |
| `INSTANT_OFFSET_REQUIRED` | 400 | `clock.errors.instantOffsetRequired` |
| `INVALID_CIVIL_DATE` / `INVALID_LOCAL_TIME` | 400 | `clock.errors.invalidCivilDate` / `clock.errors.invalidLocalTime` |
| `ZONE_MISMATCH` | 409 | `clock.errors.zoneMismatch` ("The shop time zone changed. Reload and try again.") |
| `INVALID_TIME_ZONE` | 400 | `clock.errors.invalidTimeZone` |
| `OPS_ZONE_TENANT_MISMATCH` | 403 | generic forbidden |
| `CLOCK_SETTING_INVALID` | 400 | `clock.errors.settingInvalid` (cut-over outside `00:00`–`11:59`, unknown hour cycle or week start) |
| `CLOCK_UNKNOWN_OPERATION` | 500 (programming error, logged) | none (never shown; generic error) |
| `ZONE_CHANGE_BLOCKED_OPEN_SESSION` | 409 | `clock.errors.zoneChangeBlockedOpenSession` ("Close the open POS sessions on this branch before changing its time zone.") |
| `HQ_CONFIG_BAD_TIMEZONE` (existing SQL text from `0668`) | 400 | mapped to `INVALID_TIME_ZONE` |

---

## 6. TypeScript, API, and Dart mirror

### 6.1 `packages/clock` (`@cmx/clock`)

```text
packages/clock/
  src/temporal.ts       THE ONLY file that imports `temporal-polyfill` (D1); picks native globalThis.Temporal when present
  src/types.ts          Instant, CivilDate, LocalTime, ZoneId (branded), Disambiguation, ClockErrorCode, HourCycle, WeekStart
  src/clock.ts          interface Clock { now(): Instant }; systemClock; fixedClock(at); offsetClock(base, ms); dtNow(clock), dtClock(clock)
  src/parse.ts          parseInstant (offset required), parseCivilDate, parseLocalTime, parseZoneId, isValidZoneId (D16 rule)
  src/convert.ts        dtLocalParts(instant, zone), dtToLocal, dtAtLocal(date, time, zone, disambiguation), dtInstantAtZone, dtDayBounds(from, toExclusive, zone)
  src/civil.ts          dtToday(clock, zone), dtTodayIn, dtCivilAdd(date, n, unit), compareCivil, isoWeekKey, dtPeriodKey(instant, zone, grain, opts), dtLocalNow, dtLocalTime
  src/business-day.ts   dtBusinessDate(instant, zone, cutover: LocalTime)
  src/settings.ts       resolveHourCycle(tenant, country, defaults), resolveWeekStart(tenant, country, defaults), resolveCutover(branch, tenant, platform), resolveDateFormat(tenant, platform); platform values come from `hq_general_config` (D33, via the API `clock` block or a server read), never from source constants
  src/clock-block.ts    ClockBlock type, zClockBlock, buildClockBlock(input), tzdbVersion() (runtime tz database version)
  src/format.ts         formatInstant(instant, zone, locale, style), formatCivilDate, formatLocalTime, zoneLabel(zone, instant, locale)
  src/intl-options.ts   buildIntlOptions({ locale, zone, calendar:'gregory', numberingSystem, hourCycle })
  src/zod.ts            zInstant, zCivilDate, zLocalTime, zZoneId, zZonedInput, zCivilRange, zDisambiguation, zClockBlock
  src/errors.ts         ClockError(code, details)
  vectors/time-vectors.v1.json   shared cases (§7.13)
  __tests__/vectors.test.ts      runs against the polyfill adapter and, when present, native Temporal
```

`web-admin/lib/utils/operational-time.ts` becomes a thin re-export plus web-only helpers; its 24 existing exports keep their names (no caller churn). `operational-zone.server.ts` stays in web-admin (Prisma) and adds `dtTodayFor(tenant, op, branch, clock)` and `dtBusinessDateFor(...)`. The public API of `@cmx/clock` exposes our branded types only; no `Temporal.*` object crosses the package boundary.

One-to-one names (D26): `fn_cmx_dt_now` ↔ `dtNow`, `fn_cmx_dt_clock` ↔ `dtClock`, `fn_cmx_dt_zone` ↔ `dtZone` (over `resolveOperationalTimeZone`), `fn_cmx_dt_today` ↔ `dtToday`, `fn_cmx_dt_local_now` ↔ `dtLocalNow`, `fn_cmx_dt_local_time` ↔ `dtLocalTime`, `fn_cmx_dt_at_local` ↔ `dtAtLocal`, `fn_cmx_dt_to_local` ↔ `dtToLocal`, `fn_cmx_dt_local_parts` ↔ `dtLocalParts`, `fn_cmx_dt_day_bounds` ↔ `dtDayBounds`, `fn_cmx_dt_period_key` ↔ `dtPeriodKey`, `fn_cmx_dt_business_date` ↔ `dtBusinessDate`, `fn_cmx_dt_civil_add` ↔ `dtCivilAdd`. Mobile (Dart) mirrors the same names in lowerCamelCase (`dtToday`, …).

### 6.2 Injectable clock

Services take a `Clock` (default `systemClock`) through their context object; route handlers and actions create one per request. Tests use `fixedClock('2026-11-26T21:00:00.000Z')`. SQL functions take `p_at`. A persisted civil decision uses the database transaction instant (`fn_cmx_dt_now()`) read once (`readDatabaseInstant` → renamed `readActionInstant`, same behaviour) or computes inside SQL. `dtNow(clock)` is the TS mirror of `fn_cmx_dt_now()`; `systemClock` is used only at the request boundary.

### 6.3 API contract

| Field kind | Request | Response |
|---|---|---|
| Instant | RFC 3339 **with** offset (`Z` or `±hh:mm`); offset-less rejected (`INSTANT_OFFSET_REQUIRED`) | Always `Z`, milliseconds |
| Civil date | `YYYY-MM-DD` only | `YYYY-MM-DD` |
| Local time | `HH:mm` (seconds optional) | `HH:mm` |
| Zoned appointment | `{ date, time, disambiguation?, zone? }` (`zone` echo, D9: a differing zone gives `409 ZONE_MISMATCH`) | `{ at: Instant, zone }` and, for labels, `local: { date, time }` |
| Range filter | `from` (civil, inclusive), `to` (civil, inclusive in the UI, sent as `toExclusive` after `shiftCivilDate(+1)`) or instants `fromAt`/`toAt` half-open | echo of the resolved UTC bounds in `meta.range` |
| Duration | integer `*_minutes` | same |
| Zone | IANA id (valid per D16) | IANA id |

**`clock` block (D21).** Every screen endpoint that returns shop instants adds:

```json
"clock": {
  "zone": "Asia/Muscat",
  "businessDate": "2026-11-26",
  "serverNow": "2026-11-26T18:06:00.000Z",
  "hourCycle": "h23",
  "weekStart": 6,
  "tzdbVersion": "2026a"
}
```

| Field | Type | Meaning |
|---|---|---|
| `zone` | `ZoneId` or `null` | The resolved operations zone for this screen's scope. `null` = not configured; the client shows no clock |
| `businessDate` | `CivilDate` or `null` | Business date at `serverNow` in that zone with the cut-over applied; `null` when `zone` is null (the 0.1.41a table said `dtBusinessDate` here by mistake; the JSON key is `businessDate`) |
| `serverNow` | `Instant` (`Z`) | The server's instant for this response; clients compute their offset from it (`useServerNow`) |
| `hourCycle` | `'h12'` or `'h23'` | Tenant setting, else country default (CLDR), else the platform value `hq_general_config.time_format` (D33). Stored values `H12`/`H23` or `12h`/`24h` are mapped to the `Intl` values `h12`/`h23` in one place (`buildClockBlock`) |
| `weekStart` | integer 1–7 (ISO weekday, Mon=1, Sat=6, Sun=7) | `org_tenants_mst.first_day_of_week`, else country default (CLDR), else `hq_general_config.first_day_of_week` (D7, D29, D33) |
| `tzdbVersion` | string | Version of the tz database the **app server runtime** used (Node `process.versions.tz`); the SQL side is compared in health, not in the block |

Defined once as `zClockBlock` (Zod), `ClockBlock` (OpenAPI component and Dart model) and built by `buildClockBlock` in `@cmx/clock`; a contract test asserts every screen endpoint in the inventory returns it. The public (anon) tracking endpoint returns only `zone`, `serverNow`, `hourCycle` and `dateFormat`: display preferences, not tenant data; §7.16 says the same. The block includes `dateFormat` (D34, accepted). The list of screen endpoints that must return the block is `technical_docs/api-clock-inventory.md` (written in S6; the contract test reads it).

OpenAPI (cmx-api Swagger and platform-api): `type: string, format: date-time, pattern: …Z$` for instants; `format: date`; `format: time` plus `x-cmx-clock: instant|civil-date|local-time|zone`.

### 6.4 Dart (`cmx_mobile_apps/packages/mobile_core/lib/src/clock/`)

`Instant` (wraps UTC `DateTime`), `CivilDate`, `LocalTime`, `ZonedInput`, `ShopClock(zone)` using `package:timezone` (`latest_10y`, initialised once in `mobile_core`), `formatInstant(instant, zone, locale)`, `dtAtLocal(...)` with the same disambiguation enum, JSON converters (`@JsonKey` helpers), and a test that loads the same `time-vectors.v1.json` (copied by a script with checksum).

---

## 7. Layer plan

### 7.1 Database

All migration files are written by the agent and applied **only by the user** (D17). Batch DDL: one file per slice where possible (each DDL triggers a PostgREST schema-cache reload). Slot numbers below were checked against the repository on 2026-11-26 (latest existing file `0841_otp_stamps_timestamptz.sql`) and are re-checked when each file is created and again at close-out. A number that is not needed (the conditional `0844`) stays unused; a gap does not disturb the Supabase CLI order. **Batch rule:** each slice applies its files together in one low-traffic window.

#### 7.1.1 Clock API and zone catalog — migration `0842_cmx_dt_clock_api.sql` (S2)
One file for the slice (batched DDL; each DDL triggers a PostgREST schema-cache reload). In this order inside the file:

1. **Extend `sys_timezone_cd` (D28, seed rule D32 once accepted).** Add `iana_name`, `is_canonical`, `link_target`, `std_offset_minutes`, `dst_offset_minutes`, `country_codes`, `tzdb_version`, `cldr_version` **as nullable columns first**, backfill, then `SET NOT NULL` where D28 says NOT NULL (order matters: `ADD COLUMN … NOT NULL` without a default fails on existing rows). Do not add `name_en`/`name_ar`, `observes_dst`, or a second sort column (`name`/`name2`, `uses_dst`, `display_order` exist). Backfill every existing row (`0055` + `0675`): `is_canonical = true`, `iana_name = code`, `country_codes` from `metadata->'countries'` (else `ARRAY[country_code]`), offsets and versions from the official tzdb used by this file. Upsert per D32: canonical names from `zone.tab` + `zone1970.tab` + `UTC`; aliases only for `backward` links not in `zone.tab`, plus the UTC family → `UTC`; alias rows copy the target's `utc_offset_hours`/`minutes`/`string` (NOT NULL columns), `is_active = false`, `is_system = true`. Refresh `name`/`name2` from CLDR English and Arabic exemplar-city / metazone names. Never deactivate or demote a code that is stored on a tenant, branch or HQ row (the file checks before each change and raises if one would be demoted). Record the IANA tzdb and CLDR versions in the migration comment.
2. **Add `notify` to the closed list (D27).** Replace the deployed `fn_ops_zone` (`0830`) body so the allowed operations are `accept_order`, `ready_by`, `pos_session`, `delivery`, `invoice`, `ledger`, `notify`. Keep grants, the tenant guard, and the resolution order unchanged. The previous body is stored in a `-- ROLLBACK BODY` comment.
3. **Clock API.** Create `cmx_dt_env_cf` (one row, `env = 'prod'`, owner-only, RLS on, no policy) and the §5.0 clock functions with the override gate. Create the §5.1 functions that need no new setting: `fn_cmx_dt_zone` (wrapper, so it inherits `notify`), `_zone_required`, `_hq_zone`, `_is_valid_zone` and `_canonical_zone` (**read `sys_timezone_cd` only**), `_today`, `_today_or_null`, `_today_in`, `_local_now`, `_local_time`, `_to_local`, `_at_local`, `_instant_at_zone`, `_day_bounds`, `_local_parts`, `_civil_add`, `_period_key` (grains `DAY`/`MONTH`/`YEAR`/`FY`), and `fn_cmx_dt_health` (aggregator) with one `fn_cmx_dt_chk_*` per check marked `0842` in §5.3, plus the tenant-facing `fn_shc_clock_*` functions, the `CLOCK` domain row and registry rows (§5.3). Comments, grants (§5 conventions).
3b. **Zone validators (G20).** `CREATE OR REPLACE` the bodies of `fn_tenant_tz_validate` and `fn_hq_gen_cfg_validate` (triggers and names kept): a new or changed zone must be a canonical active catalog code; an alias is replaced by its `iana_name` before storage; anything else raises `HQ_CONFIG_BAD_TIMEZONE` (`22023`). Add `trg_branches_tz_validate` (`BEFORE INSERT OR UPDATE OF timezone_code ON org_branches_mst`, same rule, new or changed values only). Previous bodies in `-- ROLLBACK BODY`. The `0851` zone-change trigger must sort after these (`trg_tz_change_*` > `trg_*_tz_validate`, both `BEFORE`) so it logs the normalized value.
4. **Catalog integrity trigger** (insert or update only): `code`/`iana_name` match the IANA shape (`Area/Place` or `UTC`; exception: alias rows with `link_target = 'UTC'` may use the single-token UTC-family names listed in D32); reject abbreviations, offsets, `posix/`/`right/`/`Etc/GMT±N`; an alias must have `link_target` pointing at a canonical row; `iana_name` must equal `code` when canonical and `link_target` when not. The trigger does **not** call `fn_cmx_dt_is_valid_zone` (that function reads this table). Q4 and Q8 are run read-only before apply, and again in the migration's verification block.
5. `fn_cmx_dt_business_date`, the settings readers and the `WEEK` grain are **not** in this file; they are in `0843`, applied in the same S2 window.
6. pgTAP: `supabase/tests/clock_sql_api.test.sql` (generated from vectors, §7.13, including `notify` and alias normalization), `clock_grants_safety.test.sql` (anon denied; authenticated other tenant raises; service_role allowed; search_path pinned; DEFINER functions listed and justified), `clock_fake_now_gate.test.sql` (override honored only when both gates pass; ignored for `authenticated`/`anon`/`service_role` even if `env` were `'test'`; production results equal `now()` and `clock_timestamp()`; `env` back to `'prod'` after rollback), `clock_catalog.test.sql` (canonical accept incl. `Asia/Muscat`, alias normalize `Asia/Calcutta` → `Asia/Kolkata` and `Etc/UTC` → `UTC`, abbreviation reject, picker excludes aliases, a stored code is never demoted), `clock_zone_validators.test.sql` (tenant, branch and HQ triggers accept canonical, normalize alias, reject `EST`/`GMT+4`/`posix/…`, ignore unrelated updates), `clock_health_registry.test.sql` (every `CLOCK_*` registry row names an existing function; each function returns the `0709` JSON shape).

#### 7.1.2 Session zone — `0844_app_roles_timezone_utc.sql`, only if needed (D4; S2)
S2 first runs Q1 (read-only, in §10): `SHOW timezone;` and `pg_db_role_setting` for `postgres`, `authenticator`, `authenticated`, `service_role`, `anon`, plus the database-level row. If every one is UTC or unset (unset inherits the database, which Supabase sets to UTC), **no file is written**. If any differs, `0844` contains `ALTER ROLE <role> SET timezone = 'UTC'` / `ALTER DATABASE … SET timezone = 'UTC'` only for the differing ones; the user confirms the role names and applies it. The check stays alive as `CLOCK_ROLE_TZ_UTC`.

#### 7.1.3 `CURRENT_DATE` replacement — migration `0846_cmx_dt_replace_current_date.sql` (S5)
Live definitions found by static scan (latest file that defines each). S5 starts by re-reading each body from the live catalog (`pg_get_functiondef`, read-only) and extends the scan to `to_char(now(),…)`, `date_trunc(…, now())`, and `::date` on `timestamptz` columns.

| Object | Latest file | Scope | Replacement |
|---|---|---|---|
| `get_order_number_prefix` | 0012 | tenant | check if still called; if dead, drop in a later migration; else `fn_cmx_dt_period_key(..,'accept_order',..,'DAY')` |
| `sys_bill_generate_invoice_number` | 0041 | HQ | `fn_cmx_dt_today_in(fn_cmx_dt_hq_zone())`; `CLOCK-OK` if UTC is the contract |
| `get_product_price_with_tax`, `get_product_price` | 0084, 0814 | tenant | `p_effective_date date DEFAULT NULL` → `COALESCE(p_effective_date, fn_cmx_dt_today(p_tenant,'accept_order',p_branch))` |
| `resolve_fin_tpl_for_tnt` | 0201 | tenant | `fn_cmx_dt_today(p_tenant,'ledger',NULL)` |
| `vw_fin_missing_required_usage`, `vw_fin_coa_explorer` | 0215, 0834 | tenant views | join a zone CTE per tenant: `fn_cmx_dt_today_or_null(t.id,'ledger',NULL)`; expired when null → not expired |
| `generate_session_no`, `generate_cash_drawer_sess_no`, `generate_cash_drawer_trx_no` | 0270, 0519, 0527 | tenant numbering | `fn_cmx_dt_period_key(.., 'pos_session', branch, ..)`; issued numbers untouched |
| `fn_expire_credit_notes` | 0296 | tenant | superseded by `0840` expiry functions? verify; if unused, unschedule/drop |
| `fn_shc_speed_no_rules` | 0709 | tenant health | `fn_cmx_dt_today_or_null` |
| `fn_shc_tax_exemption_expired`, `fn_shc_tax_kit_update_pending`, `fn_shc_tax_doc_type_no_rule` | 0726 | tenant health | `fn_cmx_dt_today_or_null(tenant,'invoice',NULL)` |
| `fn_tax_kit_version_publish`, `fn_tax_kit_update`, `fn_tax_kit_update_all` | 0726 | platform (kits are HQ catalogs) | `fn_cmx_dt_today_in(fn_cmx_dt_hq_zone())`, or `CLOCK-OK` UTC with comment; kit effective dates are civil HQ dates |
| `org_speed_price_rules_cf.effective_from DEFAULT CURRENT_DATE` | 0640 | tenant column | `ALTER COLUMN … DROP DEFAULT`; writer supplies the civil date (`speed-rules.service.ts`) |
| `fn_shc_cal_holidays_missing` | 0739 | tenant health | verify its body (G16 says the holiday check substitutes `UTC`); use `fn_cmx_dt_today_or_null(p_tenant,'accept_order',p_branch)` and return `NA` when null |
| credit-note expiry predicates (`… < (now() AT TIME ZONE fn_ops_zone(…,'ledger',NULL))::date`, two places) | 0840 | tenant | `fn_cmx_dt_today_or_null(tenant,'ledger',NULL)`; zone missing → skip the tenant and report `CLOCK_ZONE_MISSING` (G22) |
| `fn_tenant_general_value` key `timezone` | 0668 | tenant/HQ | return the tenant value only (no HQ fallback, G21); other keys unchanged; callers listed in the file header |
| `fn_doc_seq_next_by_row`, `fn_shc_speed_no_express` | 0831 | tenant | correct already (`fn_ops_zone`, fail closed); `CLOCK-OK: legacy door` until next touched |
| `hq_*`: `0521` rounding rules, `0534` plan prices `DEFAULT CURRENT_DATE` | HQ | HQ | HQ plan (H2) |

Replacement bodies use only `fn_cmx_dt_*` (no `now()`), and the previous body is kept in a `-- ROLLBACK BODY` comment.

**As built (`0.1.46`).** `0846` does not paste bodies. It reads each live definition (`pg_get_functiondef` / `pg_get_viewdef`), checks that every replacement rule matches the expected number of times, and stops with "0846 stopped, live definitions differ" before changing anything if one does not (drift). Then it rewrites with `regexp_replace` and re-executes, so owner, grants, `SECURITY`, volatility and `search_path` stay as they are. Needs PostgreSQL 15+ (`regexp_count`). Rollback: `technical_docs/s5/0846_preimage.sql` (run before applying, keep its output) replaces the `-- ROLLBACK BODY` comments.
- **27 objects:** the list above plus `sys_bill_update_invoice_amount_due`, `seed_tenant_erp_lite_defaults`, `apply_fin_tpl_for_tnt`, `seed_product_speed_rules`, `fn_shc_cal_holidays_estimated`, `fn_tax_kit_apply`, `fn_tax_kit_version_clone` (found by the extended scan). `generate_session_no` (dropped in `0519`) and `get_product_price_with_tax` (dropped in `0700`) no longer exist. `fn_doc_seq_next_by_row` / `fn_shc_speed_no_express` unchanged.
- **Day rules:** operational writers and seeds use strict `fn_cmx_dt_today` (raise `TIMEZONE_NOT_CONFIGURED`); health checks and the two views use `COALESCE(fn_cmx_dt_today_or_null(..), <column>)`, so a missing zone keeps date windows open; HQ kits and `sys_bill_*` use the HQ zone; `get_order_number_prefix` (no caller) is explicit UTC; cash-drawer numbers use `fn_cmx_dt_period_key(..,'pos_session',NULL,'DAY')`; `now()` → `fn_cmx_dt_now()`.
- **G21:** `fn_tenant_general_value(tenant,'timezone')` returns the tenant value only; `p_tenant_id IS NULL` still returns the HQ value.
- **G22:** `fn_fin_credit_note_expire_one` returns `ZONE_MISSING` (WARNING `CLOCK_ZONE_MISSING`) for a due-only call without a zone; this also fixes a null `is_due` that fell through and expired the note. `fn_fin_credit_note_expiry_run` skips those tenants and reports `zone_missing`.
- **Also:** `org_speed_price_rules_cf.effective_from` default dropped; active catalog zones missing from `pg_timezone_names` and unused are set `is_active=false` (`metadata.deactivated_by='0846'`); a used one stays active with a WARNING. Reactivate by setting `is_active=true` once the server tzdata knows the zone.

#### 7.1.4 Notification schedule — migration `0849_cmx_dt_notification_quiet_hours.sql` (S8)
Cron changes for hourly tenant sweeps, the `next_run_at timestamptz` columns the sweeps need, and the `CLOCK_QUIET_TZ_LEGACY` health check (as `fn_cmx_dt_chk_quiet_tz_legacy` + registry row). It does **not** drop `org_ntf_settings_cf.quiet_hours_tz`: in S8 the code stops reading **and writing** it (G23: `app/api/v1/notifications/settings/route.ts`, `lib/notifications/settings-service.ts`, `src/features/notifications/ui/notification-settings-page.tsx`, cmx-workers notification code, their tests), and the column is dropped in `0854`.

#### 7.1.5 Settings foundation (S2) and business date (S9) — migrations `0843` and `0850`
- `0843_cmx_dt_settings_foundation.sql` (**S2**, same window as `0842`; review row 19). Content per **D33 and D34 (accepted 2026-11-27)**:
  - `org_branches_mst.business_day_cutover time NULL` with `CHECK (business_day_cutover IS NULL OR business_day_cutover < '12:00')` (D6); `org_tenants_mst.business_day_cutover time NULL` (same check); `hq_general_config.business_day_cutover time NOT NULL DEFAULT '00:00'` (same check).
  - `sys_country_cd.default_hour_cycle text NULL CHECK (… IN ('H12','H23'))`, `default_week_start smallint NULL CHECK (… BETWEEN 0 AND 6)` (same encoding as `org_tenants_mst.first_day_of_week`), `cldr_version text NULL`, `clock_defaults_source text NULL`; **seeded from official Unicode CLDR** `timeData` + `weekData` for every country in the table (D29); rows missing from CLDR stay null (health `CLOCK_SETTING_UNRESOLVED`).
  - DEFINER readers with the tenant guard and pinned `search_path`: `fn_cmx_dt_hour_cycle`, `fn_cmx_dt_week_start`, `fn_cmx_dt_cutover` (branch → tenant → country where it applies → `hq_general_config`), `fn_cmx_dt_date_format` (D34), `fn_cmx_dt_business_date`, `fn_cmx_dt_business_day_bounds`, `fn_cmx_dt_period_key` gains `WEEK`; checks `CLOCK_CUTOVER_INVALID`, `CLOCK_CUTOVER_INCONSISTENT`, `CLOCK_SETTING_UNRESOLVED`, `CLOCK_COUNTRY_UNKNOWN` as new `fn_cmx_dt_chk_*` / `fn_shc_clock_*` functions + registry rows (the aggregator is not replaced).
  - The cut-over is stored from S2 but not editable in the tenant UI until S9 (flag `clock.business_day_cutover`, D23); HQ can set it.
- `0850_orders_payments_business_date.sql` (**S9**, expand; tables per D35): `business_date date NULL` and `business_timezone text NULL` on `org_orders_mst` and `org_order_payments_dtl`; a `BEFORE INSERT` trigger (and, for payments, `BEFORE UPDATE OF paid_at` when `business_date` is still null) fills them **only when the writer left them null**, using `fn_cmx_dt_zone(..., 'accept_order' / 'invoice', branch_id)` (the `_or_null` form: a missing zone leaves both null and never blocks an order; `CLOCK_ZONE_MISSING` reports it) and `fn_cmx_dt_cutover`; values are never recomputed afterwards (frozen civil decision). Dev rows backfilled from `created_at` / `COALESCE(paid_at, created_at)` with the current zone (counted, logged); indexes `(tenant_org_id, business_date)` (plain `CREATE INDEX` inside the batch: small tables today; switch to a separate `CONCURRENTLY` file if a table exceeds ~1M rows at write time). The trigger functions are `SECURITY DEFINER` with the tenant guard skipped for the row's own tenant, so `authenticated` and service inserts both work. Enables the tenant cut-over UI (flag on per tenant). Readers move in S9; nothing is dropped.

#### 7.1.6 Zone change log — migration `0851_org_tz_change_log.sql` (S10)
`org_tz_change_tr (id, tenant_org_id, branch_id NULL, old_zone, new_zone, changed_at timestamptz DEFAULT fn_cmx_dt_now(), changed_by, reason, effects jsonb)`, append-only, RLS by tenant; trigger on `org_tenants_mst.timezone` and `org_branches_mst.timezone_code`; refuses the change while an open `org_pos_sessions_mst` exists on an affected branch (`ZONE_CHANGE_BLOCKED_OPEN_SESSION`).

#### 7.1.7 `sys_*` / `hq_*` stamps and zone-catalog refresh — `0852` and `0853` (S13)
- `0852_sys_hq_stamps_timestamptz.sql`: one file, `USING col AT TIME ZONE 'UTC'`, recreates blocking views and functions, includes `hq_ntf_dispatch_log.dispatched_at/failed_at`, `hq_ntf_webhook_events.processed_at`, `sys_bill_*` event stamps, `sys_code_*`; `fn_hq_audit_before_insert` / `fn_verify_hq_audit_integrity` canonicalisation updated in the same file so existing hashes still verify (hash uses `to_char(col AT TIME ZONE 'UTC', …)`, the same text). Deployed in the same window as the HQ readers (D18).
- `0853_sys_timezone_catalog_refresh.sql` (D16, D28): a later **tzdb / CLDR refresh**, not the initial extend (that is in `0842`). Re-read the official IANA tzdb and CLDR names, upsert new canonical zones and aliases, refresh offsets and display names and version columns, never deactivate a code in use, and run the catalog-vs-`pg_timezone_names` sync check. The HQ timezone-catalog screen (H9) can trigger the same comparison.

#### 7.1.8 Later cleanup — `0854_drop_quiet_hours_tz.sql` (after the S8 soak)
Drops `org_ntf_settings_cf.quiet_hours_tz` once `CLOCK_QUIET_TZ_LEGACY` has been clean on the remote database for the agreed soak window and no code or generated type reads the column.

**Slot table (re-slotted at 0.1.41b, review row 19):** `0842` S2 (catalog extend + D32 seed + `notify` + clock API + zone validators + health registry) · `0843` S2 (settings foundation: cut-over columns, CLDR country defaults, readers, business date, `WEEK`, date format) · `0844` S2 only if Q1 shows a non-UTC role/database (else unused) · `0846` S5 · `0847` S8 · `0848` S9 (orders/payments `business_date`, cut-over UI enable) · `0849` S10 · `0850`, `0851` S13 (`0851` is the later tzdb/CLDR refresh) · `0852` after soak. S1, S3, S4, S6, S7, S11, S12, S14 have no migration. **Re-slotted +1 at `0.1.45` (user, t145u):** `0845` is taken by the user's `0845_fix_get_user_tenants_last_login_timestamptz.sql`, so S5 → `0846` (also deactivates America/Coyhaique), S8 → `0847`, S9 → `0848`, S10 → `0849`, S13 → `0850`/`0851`, S15 → `0852`. **Re-slotted +2 at `0.1.47` (t148u):** the user's own `0847_bg_jobs_file_purge.sql` (applied) and `0848_hq_nav_uom_config.sql` hold `0847`/`0848`, so S8 → `0849`, S9 → `0850`, S10 → `0851`, S13 → `0852`/`0853`, S15 → `0854`. From now on each slice takes **the next free number at the moment its file is written** (checked again at the end); the numbers above are projections. **Re-slotted +1 at `0.1.48`:** the user's `0849_setup_health_measured_price.sql` holds `0849` (allowlisted in the guard: `updated_at = NOW()`), so S8 → `0850`, S9 → `0851`, S10 → `0852`, S13 → `0853`/`0854`, S15 → `0855`.

### 7.2 Data backfill and verification
- Every conversion or backfill migration prints counts (`RAISE NOTICE`) and has a verification block that fails the migration if a post-condition breaks (e.g. no `org_*` naive column remains; no business_date null after backfill).
- Read-only verification queries live in §10 and run before and after each apply; results are pasted into the slice's close-out.
- Development data may move by the UTC-wall rule (accepted). The three kept Ready By rows stay untouched.

### 7.3 Prisma and generated types
- After each apply the user runs `npm run prisma:pull` (root), keeping the post-pull patches (relations `?`, required `tenant_org_id`, `cmx_effective_permissions @ignore`, local varchar widths).
- Mappers at the boundary (`packages/clock` + `web-admin/lib/mappers/clock-mappers.ts`): `@db.Date` → `prismaDateToCivil` (UTC midnight → `YYYY-MM-DD`); `@db.Time` → `prismaTimeToLocal` (`1970-01-01THH:mm:ssZ` → `HH:mm`); writes `civilToPrismaDate('2026-11-27')` = `new Date('2026-11-27T00:00:00.000Z')`, `localToPrismaTime('18:00')`.
- Supabase-js returns `timestamptz` as `+00:00` strings: `normalizeInstantString` in mappers → `Z`.
- `$queryRaw` results: instants are `Date`; civil `date` columns are `Date` at UTC midnight → same mapper.
- Generated DB types (`platform-api/src/database/database.types.ts`, any web-admin supabase types) stay `string`; DTO mappers brand them.
- **Regeneration after every apply (the user runs these; the agent never does, D17):** tenant repo `npm run prisma:pull` and the web-admin Supabase types file `web-admin/types/database.ts`; HQ repo `platform-api/src/database/database.types.ts` and `platform-web/lib/types/database.ts` (`supabase gen types`). A slice is not closed until the regenerated files are committed by the user and `tsc` passes in both repos. `0854` requires the regenerated types to have lost `quiet_hours_tz` first.
- New SQL defaults show in Prisma as `@default(dbgenerated("fn_cmx_dt_now()"))`; keep them (do not hand-edit to `now()`).
- Lint rule (S6): DTO types for API responses may not expose raw `Date` for civil fields.

### 7.4 Backend services and queries
- Every service that makes a civil decision calls one zone resolver per action (`resolveOperationalTimeZone` or a list join) and the shared helpers; no service formats for display.
- Query pattern for "today" / a day filter: compute `[start,end)` once with `dtDayBounds`, filter `created_at >= start AND created_at < end` on an index `(tenant_org_id, created_at)`.
- Aggregation by local day/hour: SQL with one zone variable; never per-row zone lookups; mixed-branch reports group by `(branch zone, local day)` with the zone joined in one CTE.
- Named fixes: G12 list; `speed-rules.service.ts` and `prepaid-tax.service.ts` fail-closed paths stay; `pos-session.service.ts` uses `fn_cmx_dt_business_date` after D6 (S9); `usage-tracking.service.ts` explicit UTC (`clock-ok`).
- Caching: any cache key involving "today" includes `civilDate` and `zone` (`today:${tenant}:${zone}:${date}`).

### 7.5 API routes, endpoints, and server actions
- Remaining WP10 routes: `app/api/v1/orders/route.ts`, `orders/[id]/route.ts`, `orders/[id]/state/route.ts`, `public/customer/orders/route.ts`, `delivery/routes/route.ts`, `notifications/campaigns/route.ts` (create), `app/api/notifications/process-outbox`, `process-campaigns`, `marketing/promotions/*`, `finance/vouchers/route.ts`, `cash-drawers/trx/route.ts`, `cash-drawers/variance-report/route.ts`, plus every route a fresh search finds parsing a date outside `@cmx/clock`.
- Remaining WP11 actions: promotions, loyalty, refunds, drivers, cash drawers, payment methods, terminals.
- Public endpoints (anon): zone resolved server-side with the service client and returned as `clock.zone`; never call `fn_ops_zone` as `anon`.
- Response serialization: one `toApiInstant()` in a shared response helper; route tests assert `Z`.
- Webhooks inbound: offset required; outbound: `Z`.
- **Done when** a fresh search of `app/api` and `app/actions` finds no date parse outside `@cmx/clock` (guard pattern).

### 7.6 Zod and schema types
`zInstant = z.iso.datetime({ offset: true, precision: -1 }).transform(toInstant)`; `zCivilDate = z.iso.date().brand<'CivilDate'>()`; `zLocalTime = z.iso.time({ precision: -1 })` limited to `HH:mm(:ss)?`; `zZoneId = z.string().refine(isValidTimeZone)` (server also checks the catalog); `zZonedInput = z.object({ date: zCivilDate, time: zLocalTime, disambiguation: zDisambiguation.default('reject'), zone: zZoneId.optional() })`; `zCivilRange` with `from <= to`. Route schemas import these; no local regexes. cmx-api uses class-validator decorators that call the same parsers (`@IsInstant()`, `@IsCivilDate()`, `@IsLocalTime()`).

### 7.7 Frontend helpers, hooks, and components
- `ClockProvider` (`web-admin/src/ui/clock/clock-provider.tsx`): `{ zone, locale, calendar: 'gregory', numberingSystem, hourCycle, weekStart, businessDate, serverOffsetMs }` (filled from the response `clock` block, D21). Server components pass the resolved zone; client components read it. A null zone renders children with `zone=null` → components show the skeleton/empty state.
- Hooks: `useClock()`, `useCivilToday()` (exists: `use-civil-today.ts`), `useServerNow()` (server-offset-corrected now, offset measured from the response `Date` header to neutralise a wrong device clock), `useZoneLabel()`.
- Display components (`web-admin/src/ui/clock/`): `CmxInstant` (renders `<time dateTime="…Z">`, title shows the IANA zone and offset), `CmxCivilDate`, `CmxLocalTime`, `CmxZoneBadge`, `CmxRelativeTime` (`Intl.RelativeTimeFormat`, uses `useServerNow`), `CmxDuration`.
- Pickers (wrap existing Cmx inputs): `CmxCivilDatePicker` → `CivilDate`; `CmxLocalTimePicker` → `LocalTime`; `CmxZonedDateTimePicker` → `{date,time}` and, on a DST gap/overlap reported by the server or computed with `dtAtLocal`, an inline choice (earlier/later) instead of a silent shift; `CmxCivilRangePicker` → inclusive UI, half-open request.
- **Viewer-zone toggle (D20):** `CmxViewZoneToggle` ("Show times in: Branch zone / My device zone") with `ViewZoneProvider` and `useViewZone()`; state in the URL (`tz=branch|device`) and remembered per screen; default branch. It changes only how instants in cells are rendered. Filters, day buckets, and grouping stay in the operations zone; civil dates and local times are never converted. The device zone comes from one hook, `useDeviceZone` (the only allowlisted `resolvedOptions().timeZone`). `CmxZoneBadge` appears when the two zones differ at that instant, or when a list mixes zones. Exports and print name the zone used (`display_zone` column or header line; instant columns stay `Z`). First screens: orders list, orders/payments/customers reports, outbox, audit screens, delivery log (S4 builds the component, S4/S7 apply it).
- Print roots receive the zone explicitly and print it in the header ("Times shown in Asia/Muscat (GMT+4)").
- Hydration: SSR and client both format with the explicit zone; never render a clock before the zone is known.
- Accessibility: `<time>` elements, `aria-describedby` for the zone badge, picker error text announced (`role="alert"`), keyboard-operable disambiguation choice, axe checks in Storybook/Playwright.
- UI rules: Cmx components, `cmxMessage` feedback, EN/AR, RTL (`<bdi dir="ltr">` for digits/time), `npm run check:ui` clean on touched files.

### 7.8 Pages, screens, and mappers
- WP22 inventory `technical_docs/page-clock-inventory.md`: all 173 `app/dashboard/**/page.tsx` + feature screens; columns: page, clock kinds shown, scope/operation, current helper, status (migrated / exception with reason), test ID.
- Priority clusters (69 date-specific `toLocale*` hits): orders (16 files incl. G1), b2b (`contracts`, `customers/[id]`, `statements`, `statements/[id]` — civil dates shown via `new Date(x).toLocaleDateString()` → `CmxCivilDate`), reports (`reports/print/page.tsx` 13 hits, layout, orders, payments), internal_fin vouchers detail (9), preparation, users, billing, erp-lite, finance, payment-config, catalog.
- Screen mappers convert API shapes to view models once (`toOrderClockVm`), so components never parse strings.
- Settings: General (G2 catalog select with search and live offset), Branch business day card (cut-over D6, zone; the card already edits `timezone_code`), Settings → General **Date & Time** section (D33: the existing `time_format`, `first_day_of_week` and `date_format` fields plus the new tenant cut-over, with EN/AR labels and the inherited value shown as "Country default ({value})" / platform value when the tenant field is empty), Business calendar (opening hours `HH:mm`, holidays civil dates), Notifications (quiet hours in the shop zone, shown read-only, no zone field, G13), Zone change dialog (D10 effects list), User preferences (remove zone, G7).
- jhtestui debug viewers: label UTC only.

### 7.9 Jobs and workers (cmx-workers, pg_cron, web-admin job services)
- pg_cron entries stay UTC (`fin-gift-card-expiry 0 2 * * *`, `fin-credit-note-expiry 5 2 * * *`, `setup-health-refresh 15 2 * * *`, `tax-kit-update 5 2 * * *`, `ntf-*`, `file-util-expire`, `fin-erp-posting-retry`). Daily tenant sweeps move to **hourly** with per-tenant idempotency (`job:${code}:${tenant}:${civilDate}`) and act only when the tenant's local `fn_cmx_dt_today` (or business date after S9) advanced (R16). Platform sweeps (retention, quota, file expiry) stay UTC with `CLOCK-OK`.
- cmx-workers `schedules.ts` keeps `tz: 'UTC'`; handlers call web-admin services that do the civil logic.
- Tenant-local recurring rules (statement cycles `org_ar_stmt_cycles_mst.day_of_week`, campaign recurrence, POS rollover): store the civil rule + derived `next_run_at timestamptz`; recompute on rule change and on zone change (D10); computed gap → later, overlap → earlier (`compatible`).
- Due checks compare `timestamptz` with `now()`; leases bounded; one idempotency key per logical occurrence.
- Quiet hours (G13, D15, D27): notification code takes the zone from `dtZone(tenant, 'notify', branch)`, converts `now` to shop local time, keeps `quiet_hours_start/end` as `time`, handles a window that crosses midnight, and computes the next allowed instant with `dtAtLocal(date, quietEnd, zone, 'compatible')` (SQL side: `fn_cmx_dt_at_local`). The code stops reading `quiet_hours_tz` in S8; the column is dropped in `0854` after the soak. A tenant with no zone sends nothing in quiet-hours-sensitive channels and raises `clock.zone_missing{operation=notify}`.
- `0807` `singleton_on`: documented `CLOCK-OK` (G15).

### 7.10 cmx-api (Nest)
- Depend on `@cmx/clock`; `ClockModule` provides `Clock` (system/fixed) and `ZoneService` (calls `fn_cmx_dt_zone` with the tenant from the auth context, request-scoped cache) and `ClockBlockService` (builds the `clock` block, D21).
- Global `ClassSerializerInterceptor` extension: `Date` → `Z` string; DTO decorators from §7.6; Swagger `x-cmx-clock`.
- Logger already UTC; add `tenantZone` field when a civil decision is logged.
- Tests: vectors suite + an e2e route test proving offset-less instants are rejected.

### 7.11 Mobile (cmx_mobile_apps)
- `mobile_core` gets the Dart clock (§6.4) and `timezone` dependency; `intl` `DateFormat` with explicit locale; numbering per D12.
- Screens: `customer_order_booking_screen.dart`, `customer_booking_step3_schedule_vw.dart` (submit `{date,time}` civil fields, show slots in shop zone from API, DST choice), `app_date_time_picker_widget.dart` (emits civil fields, never `DateTime` in device zone), `order_tracking_service.dart` / `order_booking_service.dart` (parse `Z` instants, read `clock.zone`), driver/staff app lists (shop zone label when device differs).
- Logger (`app_logger.dart`) stays UTC.
- Tests: Dart vectors, golden tests in `ar` and `en` with device zone forced to `America/Los_Angeles`.

### 7.12 CI guard v2 (`scripts/check-clock-contract.mjs`)
- Scopes: `web-admin`, `cmx-api`, `cmx-workers`, `packages`, `cmx_mobile_apps`, `supabase/migrations` (files ≥ `0842` strict; older files only via allowlist entries; the strict set bans `now()`, `clock_timestamp()` and friends outside the bodies of `fn_cmx_dt_now`/`fn_cmx_dt_clock`, D25), and an identical script in `cleanmatexsaas` (`scripts/check-clock-contract.mjs`) for platform-api/web/workers.
- Patterns: §1.3 table. File-level allow marker `clock-ok:` / `CLOCK-OK:` with a reason; `0832` allowlisted by file name (G4).
- Ratchet: `scripts/clock-contract-baseline.json` stores `{ pattern: { file: count } }`; CI fails when a count rises or a new file appears; `--update-baseline` only lowers counts.
- Also checks: new migrations do not read `org_tenants_mst.timezone` / `org_branches_mst.timezone_code` outside `fn_ops_zone`, `fn_cmx_dt_zone`, and the zone-change trigger (`0851`); new SQL does not call `fn_ops_zone` directly; no migration or seed writes `env = 'test'` into `cmx_dt_env_cf` or sets `cmx.fake_now` outside `supabase/tests`; `temporal-polyfill` is imported only in `packages/clock/src/temporal.ts`; `resolvedOptions().timeZone` appears only in `useDeviceZone`; every `fn_cmx_dt_*` has `REVOKE … anon`; vectors file checksum equals the vendored copies (HQ, mobile).
- Wired into root `npm run check:clock-contract`, the web-admin pre-push/CI script, and HQ CI.
- Exceptions the guard knows by name: `fn_cmx_dt_now`, `fn_cmx_dt_clock` and the `fn_cmx_dt__fake_*` helpers may be granted to `anon` (§5); every other `fn_cmx_dt_*` must `REVOKE … anon`. `fn_tenant_tz_validate` / `fn_hq_gen_cfg_validate` / `0851` are the only allowed SQL readers of stored zone columns besides `fn_ops_zone` and `fn_cmx_dt_zone`.

### 7.13 Tests
- **Shared vectors** `packages/clock/vectors/time-vectors.v1.json`. Zones: `UTC`, `Asia/Muscat`, `Asia/Riyadh`, `Asia/Kathmandu` (+05:45), `Asia/Tehran`, `Europe/London`, `America/New_York`, `America/Santiago` (DST at midnight: local midnight does not exist on the spring day), `Australia/Lord_Howe` (30-minute DST), `Pacific/Kiritimati` (+14), `Pacific/Pago_Pago` (−11), `Africa/Cairo` (DST reintroduced 2023). Case kinds: `today`, `dtDayBounds` (23h/25h days, midnight gap), `dtAtLocal` × {compatible, earlier, later, reject} on gap and overlap, `localParts`, `dtPeriodKey` (DAY/MONTH/YEAR/WEEK with week start, FY with start month), `dtBusinessDate` with cut-over `04:00`, `zone validity` (accept `Asia/Muscat`, `UTC`; reject `GST`, `EST`, `+04:00`, `Etc/GMT-4`, `posix/Asia/Muscat`), `settings resolution` (tenant column → country → `hq_general_config` for hour cycle and week start; branch → tenant → `hq_general_config` (`00:00` default) for cut-over; never a source constant, D33), `catalog` (`Asia/Muscat` canonical, `Asia/Calcutta` and `Etc/UTC` normalize, `Japan`/`EST` invalid), `WEEK` keys for SAT/SUN/MON/FRI starts across a year boundary, business date with cut-over on a DST day (`America/New_York`, cut-over `02:30`), `clock block` shape, `dtCivilAdd` month-end clamp, `parseInstant` rejections, `zone resolution` (branch active / branch inactive / org only / both missing / unknown operation, `notify` vs `delivery` distinct scopes).
- **Runners:** Jest in `packages/clock` and web-admin (twice: `TZ=UTC` and `TZ=Pacific/Kiritimati`); pgTAP generated by `scripts/gen-clock-vectors-sql.mjs` → `supabase/tests/clock_vectors.test.sql` (CI checks it is up to date); Dart `mobile_core` test; HQ Jest with the vendored copy.
- **Unit:** services with `fixedClock`; restore the Ready By calculator test (G5).
- **SQL safety:** grants, tenant guard, `TimeZone` = UTC, no `org_*` naive columns, every `fn_cmx_dt_*` comment present, fake-clock gate (§5.0), DEFINER functions listed and justified.
- **e2e (Playwright `web-admin/playwright.config.ts`):** projects `{ timezoneId: 'America/Los_Angeles', locale: 'en' }` and `{ timezoneId: 'Asia/Kathmandu', locale: 'ar' }` covering T1, T6, T21, T42, and the new cases below; a missing-zone tenant fixture (T28).
- **a11y:** axe on pickers, zone badge, and disambiguation prompt; keyboard-only path.
- **Manual cases to add to `testing_guide_and_scenarios.md`** as each slice lands: T43 Ready By on new-order panel and public tracking (S3); T44 Settings save with `UTC` and a non-GCC zone (S4); T45 SQL "today" at 21:00Z for a Muscat tenant via health checks and price lookup (S5); T46 DST gap/overlap typed appointment in `America/New_York` (S6); T47 hourly tenant sweep fires once per local day for Los Angeles and Muscat tenants (S8); T48 cut-over `04:00` POS business date at 02:00 local (S9); T49 zone change blocked with open POS session, then allowed, issued numbers unchanged (S10); T50 mobile booking with device in another zone (S12); T51 HQ tenant list shows each tenant's zone, HQ invoice in HQ zone (S13). Added at finalization: T52 hour cycle and week start resolve tenant column → country default (CLDR) → `hq_general_config`, EN/AR (S9); T53 cut-over resolves branch → tenant → `hq_general_config` (`00:00`) and the two cut-over health checks fire correctly (S9); T54 fake clock: override honored only in the test gate, ignored for `authenticated`/`anon`/`service_role`, production results equal `now()`/`clock_timestamp()` (S2); T55 `fn_cmx_dt_health` shows in the setup-health registry, HQ ops-health, and `/api/v1/health/clock` (S2, S7, S9, S13); T56 viewer-zone toggle: default branch, device option, export states the zone, badge when zones differ (S4, S7); T57 every screen endpoint returns a correct `clock` block (S6); T58 quiet hours for a Muscat and a Los Angeles tenant use their `notify` zone and next send is computed with `fn_cmx_dt_at_local`, including a DST day (S8); T59 IANA validation (via `sys_timezone_cd`) accepts `Asia/Muscat` and `UTC`, normalizes a `backward` alias to the canonical name, and rejects abbreviations, offsets, and `Etc/GMT±N` in SQL, TS, and the settings screen (S2, S4); T60 `temporal-polyfill` is imported only in the adapter, and polyfill and native adapters give identical vector results (S1).
- **Review additions (0.1.41b):** T61 Omani tenant keeps `Asia/Muscat` after `0842`, picker lists it under Oman, `Asia/Dubai` is not substituted (S2); T62 saving `Asia/Calcutta` stores `Asia/Kolkata`, saving `EST` or `GMT+4` is refused in tenant settings, branch card and HQ (S2, S4); T63 `notify` and `delivery` resolve different branch scopes for one campaign; `notify` before `0842` is applied is never called (S2, S8); T64 setup-health shows the `CLOCK` domain in EN/AR with fix links, platform checks only in HQ (S2); T65 CLDR seed spot check: `OM`, `SA`, `AE` week start SAT, `US` SUN, `DE` MON, `MV` FRI; `US` hour cycle H12, `OM`/`DE` H23 (exact values read from the CLDR release used) (S2); T66 fake clock as `authenticated` with `cmx.fake_now` set returns the real time and no permission error (S2); T67 credit-note expiry for a tenant without a zone is skipped and reported, not silently "not due" (S5); T68 quiet-hours settings save without `quiet_hours_tz`, old rows still load (S8).

#### 7.13.1 Function-to-test coverage matrix

| Function | pgTAP file | TS / Dart mirror test | Manual |
|---|---|---|---|
| `fn_cmx_dt_now`, `fn_cmx_dt_clock`, `fn_cmx_dt__fake_*` | `clock_fake_now_gate`, `clock_grants_safety` | `clock.test.ts` (`fixedClock`) | T54, T66 |
| `fn_cmx_dt_zone`, `_zone_required`, `fn_ops_zone` (`notify`) | `clock_vectors` (zone resolution), `clock_grants_safety` | `operational-zone.test.ts` | T63 |
| `fn_cmx_dt_hq_zone` | `clock_vectors` | HQ `hq-clock.service.spec.ts` | T51 |
| `fn_cmx_dt_is_valid_zone`, `_canonical_zone`, zone validators | `clock_catalog`, `clock_zone_validators` | `parse.test.ts` (`isValidZoneId`) | T59, T61, T62 |
| `_today`, `_today_or_null`, `_today_in`, `_local_now`, `_local_time` | `clock_vectors` | `civil.test.ts`; Dart `shop_clock_test.dart` | T45 |
| `_to_local`, `_local_parts`, `_at_local`, `_instant_at_zone` | `clock_vectors` (gap/overlap × 4 modes) | `convert.test.ts`; Dart | T46 |
| `_day_bounds`, `_business_day_bounds` | `clock_vectors` | `convert.test.ts` | T48 |
| `_period_key` (incl. `WEEK`, `FY`) | `clock_vectors` | `civil.test.ts` | T52 |
| `_civil_add` | `clock_vectors` | `civil.test.ts` | — |
| `_business_date`, `_cutover` | `clock_vectors`, `clock_settings` | `business-day.test.ts` | T48, T53 |
| `_hour_cycle`, `_week_start`, `_date_format` | `clock_settings`, `clock_grants_safety` | `settings.test.ts` | T52, T65 |
| `fn_cmx_dt_health`, `fn_cmx_dt_chk_*`, `fn_shc_clock_*` | `clock_health_registry` | `/health/clock` route test; HQ card test | T55, T64 |
| `0850` business-date triggers | `orders_business_date.test.sql` | reports service tests | T48 |
| `0851` zone-change trigger | `tz_change_log.test.sql` | dialog test | T49 |

### 7.14 i18n (EN/AR)
- New namespace `clock` in `web-admin/messages/en|ar/clock.json` (errors §5.4, zone badge text, disambiguation prompt, "Times shown in {zone} ({offset})", zone-change dialog, cut-over labels, viewer-zone toggle and export zone statement, hour-cycle and week-start option labels). Search existing keys first; reuse `reports.timezoneNotConfigured`.
- Formatting: `buildIntlOptions` always sets `timeZone`, `calendar: 'gregory'`, `numberingSystem` (D12), `hourCycle` (D13, from the `clock` block). Arabic month names come from `Intl`; digits per D12; zone names shown as IANA id plus `shortOffset` (`GMT+4` / `غرينتش+٤` only if Arabic-Indic digits are chosen).
- RTL: times and dates inside `<bdi dir="ltr">`; ranges use `Intl.DateTimeFormat.formatRange`.
- Mobile catalogs (`mobile_l10n`) get the same keys; HQ `platform-web/messages/en|ar` gets the HQ subset.
- Keys added by the review: `clock.errors.zoneChangeBlockedOpenSession`; Settings → General **Date & Time** section (`settings.general.dateTime.title`, `.hourCycle`, `.hourCycleAuto` ("Country default ({value})"), `.h12`, `.h23`, `.weekStart`, `.weekStartAuto`, `.sat`/`.sun`/`.mon`/`.fri`, `.cutover`, `.cutoverHelp`, `.dateFormat`) in EN/AR; setup-health `CLOCK` domain and check titles live in the registry rows (`name`/`name2`, `ok_name`/`ok_name2`), with matching app constants; HQ `platform-web/messages/en|ar`: tenant locale tab Date & Time fields, general-config cut-over field, timezone-catalog screen (canonical/alias, link target, tzdb/CLDR versions), country defaults columns.

### 7.15 Observability
- Logs: UTC ISO-8601 `Z` everywhere (already true for the four loggers); civil decisions add `{ tenantZone, civilDate, operation }`; never log customer payloads.
- Metrics/counters (logger events, later Datadog/Sentry tags): `clock.zone_missing{operation}`, `clock.local_time_rejected{reason}`, `clock.zone_mismatch`, `clock.tzdb_skew`.
- Health endpoint `GET /api/v1/health/clock` (internal): Node `process.versions.tz`, ICU version, Postgres vector check result (calls `fn_cmx_dt_instant_at_zone` on 3 recent-rule vectors), server time vs DB `fn_cmx_dt_now()` skew, and the `fn_cmx_dt_health()` findings (§5.3) including `CLOCK_TZDB_SKEW`.

### 7.16 Security
- All `fn_cmx_dt_*` are `SECURITY INVOKER` with a pinned `search_path` and no `anon`, **except**: the setting readers, the cut-over reader, the business-date trigger functions (`0850`) and the health aggregator/checks that read closed tables (`SECURITY DEFINER`, tenant guard, listed in the grants test); and `fn_cmx_dt_now` / `fn_cmx_dt_clock` / `fn_cmx_dt__fake_*`, which are INVOKER but also granted to `anon` (time only). The fake-clock gate needs no DEFINER (§5.0 gate order). Tenant guard via `fn_ops_zone`; RLS unchanged.
- `cmx.fake_now` is a user-settable setting, so security rests on the two gates in §5.0, not on the setting. `cmx_dt_env_cf` has no grants and no RLS policy; health reports `env <> 'prod'`.
- Zone strings validated against the catalog before use; SQL takes them as parameters (no string concatenation in dynamic SQL).
- Public endpoints return only the zone id and display preferences (`hourCycle`, `dateFormat`) and `serverNow`; never other tenant settings.
- `org_tz_change_tr` is append-only (no UPDATE/DELETE grants), RLS by tenant.

### 7.17 Documentation
- This file is the plan. Each slice closes out in: `version.txt`, `CHANGELOG.md`, `progress_summary.md`, `current_status.md`, `RESUME_CONTINUATION.md`, `testing_guide_and_scenarios.md`, the surface map row, and this file's slice table (§8).
- Developer guide gains "How to show a time", "How to accept a time", "How to compute today" with the components and Zod primitives; user guide gains the zone-change and cut-over explanation (EN/AR screenshots later).
- Contract update (`docs/dev/rules/time-and-timezone.md`, `.cursor/rules/time-and-timezone.mdc`): the SQL time API `fn_cmx_dt_*`, the banned list (incl. new-SQL `now()`), D1 (polyfill confinement), D5/D25, D8, D9, D17 (only the user applies migrations), R4 vocabulary.
- New technical docs: `technical_docs/page-clock-inventory.md` (WP22), `technical_docs/hq-readers.md` (WP21), `technical_docs/clock-api-reference.md` (generated from `packages/clock` TSDoc and SQL comments), `technical_docs/api-clock-inventory.md` (S6: every screen endpoint that must return the `clock` block, its operation and scope; read by the contract test).

---

## 8. Slice order

Each slice: one clock change end-to-end, tests, docs close-out, next pack version. Migration files are written by the agent and **applied by the user** (D17). Slot numbers are re-checked at write time.

| Slice | Version | Content | Migration | Acceptance |
|---|---|---|---|---|
| S0 | 0.1.40-plan | Master plan v2; README/status/progress refreshed (G10 part) | none | Done |
| S0b | 0.1.41-plan | Planning finalized: D1–D26 accepted, names `fn_cmx_dt_*` / `dt*`, config-key settings, health checks, slots re-set | none | Done (2026-11-26) |
| S0c | 0.1.41a-plan | Planning amendment (t135u): `notify` operation (D27), `sys_timezone_cd` extended as the runtime catalog (D28), CLDR country defaults (D29), `sys_tenant_config_defaults_cd` (D30), category `DATETIME` (D31); both superseded by D33 on 2026-11-27 | none | Done (2026-11-26) |
| S0d | 0.1.41b-plan | Adversarial gap review (t136u): G19–G26, D32–D35 proposed (accepted 2026-11-27), settings foundation re-slotted into S2 (`0843`), per-check health design, rollback table, type regeneration, coverage matrix, T61–T68 | none | Done (2026-11-26); D32–D35 ACCEPTED 2026-11-27 (t137u) |
| S1 | 0.1.42 | `packages/clock` (types, Clock, parse, convert, civil, format, zod, vectors) with the **Temporal adapter** (`temporal-polyfill`, D1, lint rule, removal plan in the docs), `dt*` names, closed operation list including **`notify`** (D27), web-admin re-exports, Jest TZ matrix, guard v2 with baseline + `0832` allowlist (G4) and the new bans (D25), restore Ready By calculator test (G5), contract docs update (G6 text, banned list, SQL API names, D17) | none | **Done (2026-11-27).** T60; guard exits 0 with baseline; vectors green under both `TZ` and under native/polyfill adapter; no caller changed behaviour. Evidence and deviations: `IMPLEMENTATION_REPORT.md` |
| S2 | 0.1.43 | SQL API (§5) incl. own clock and override gate (D25), **`sys_timezone_cd` extend + official IANA/CLDR seed (D28, D32)**, **`notify` added to `fn_ops_zone` (D27)**, zone validators (G20), health aggregator + per-check functions + setup-health `CLOCK` domain (§5.3), **settings foundation** (cut-over columns, CLDR country defaults, readers, business date, `WEEK`, date format; D6, D7, D13, D29, D33, D34), grants, generated pgTAP, **read-only role-zone check (D4)**, live-offset rule (G14). Decisions D32–D35 accepted 2026-11-27 | `0842`, `0843` (+ `0844` only if Q1 shows a non-UTC role/database) | T54, T59, T61–T66; pgTAP green locally after the user applies; TS and SQL vectors identical; fake-now gate tests green; micro-benchmark recorded; Q15 shows no stored zone demoted. **Files written 2026-11-27, not applied:** `0842` + `0843`; `clock_sql_api.test.sql` 7/7 and `clock_vectors.test.sql` 159/159 green on a scratch Postgres 17.12 (not the user's DB); tests are plain SQL (no pgTAP). **DONE 2026-11-27:** the user applied `0842`, `0843` and `0844` (`0844` = DEFINER catalog readers, a real 42501 fix; the role-zone file was not needed, Q1/Q7 clean). Evidence: `IMPLEMENTATION_REPORT.md` |
| S3 | 0.1.44 | Display components + `ClockProvider` (incl. `hourCycle`, `weekStart`); G1 order screens, order tabs, public tracking `clock` block | none | T43; Playwright LA/Kathmandu projects show 10:00 for `06:00Z` Muscat order. **DONE in code 2026-11-27:** Jest under `TZ=America/Los_Angeles` and `Asia/Kathmandu` green; T43 manual and Playwright pending. Moved to S4: `tax-document-lifecycle-timeline.tsx`, `order-timeline.tsx`, `order-status-lifecycle-tab`, `orders-change-history`, `orders-preferences`, print `*-rprt` files, `order-workspace-screen`, `order-fin-statement`, `use-cash-drawer`, `issue-table-types`, `ready-date-picker-modal` getters, `formatVal` in the edit-history tab |
| S4 — **DONE in code 0.1.45** | 0.1.45 | G12 "today" cluster, G2 zone catalog in settings/registration (IANA validation), G7 remove per-user zone, G8 operational pages fail closed, viewer-zone hook and toggle component (D20) on the first two lists (done: orders list; the second list moves to S7) | none | T44, T56 (first lists); guard baseline lowered for touched files |
| S5 — **DONE, applied by the user 2026-11-27** | 0.1.46 | G3 `CURRENT_DATE` replacement list (§7.1.3) using `fn_cmx_dt_*`; America/Coyhaique `is_active = false` (missing from server tzdata) | `0846` | T45; static + live scan finds no tenant use of banned calls |
| S6 — **DONE in code 2026-11-27** | 0.1.47 | Zod primitives in all remaining WP10 routes and WP11 actions; API `clock` block `zClockBlock` on screen endpoints (D21); `409 ZONE_MISMATCH` on writes (D9); pickers with DST choice | none | T46, T57; `app/api` + `app/actions` search clean |
| S7 — **DONE in code 2026-11-27** | 0.1.48 | WP16 exports/imports (FX import rejects offset-less; exports state their zone, D20), WP17 audit screens, observability fields, `/health/clock` incl. `CLOCK_TZDB_SKEW`, viewer-zone toggle on the remaining chosen reports (done: `api-output.ts` export/response helpers, Date cells `Z` in grids and report CSV, civil-day export file names, price-history CSV UTC/local/zone, audit card zone, `/api/v1/health/clock` with `CLOCK_TZDB_SKEW` / `CLOCK_DB_SKEW`, D20 on price history; FX import already civil-date only) | none | T14, T15, T55, T56 (rest) automated |
| S8 | 0.1.49-plan | WP18 jobs: hourly tenant sweeps with idempotency, tenant-local `next_run_at`, quiet hours via **`notify` zone** + `dtAtLocal` (D27), code stops reading `quiet_hours_tz` (D15), G15 classified | `0849` | T47, T58 |
| S9 | 0.1.50-plan | D6/D11/D23/D35: cut-over UI (branch card + tenant Date & Time section behind `clock.business_day_cutover`), hour-cycle / week-start / date-format fields in Settings → General (Date & Time), orders/payments `business_date` (expand + readers), POS uses `fn_cmx_dt_business_date` | `0850` | T48, T52, T53; reports by business day use the stored column |
| S10 | 0.1.51-plan | D10 zone-change policy: log table, trigger, dialog, reschedule | `0851` | T49 |
| S11 | 0.1.52-plan | WP19 cmx-api `ClockModule`, DTO decorators, Swagger `ClockBlock` | none | vectors + e2e in cmx-api |
| S12 | 0.1.53-plan | WP20 mobile clock, booking/tracking/picker, `ClockBlock` model | none | T50; Dart vectors |
| S13 | 0.1.54-plan + HQ | WP21 `hq-readers.md`; HQ H0–H10 (G11, G16); `sys_*`/`hq_*` stamps; catalog refresh (D16) | `0852`, `0853` | T51; HQ vectors; no `Asia/Muscat` fallback in HQ |
| S14 | 0.1.55-plan | WP22 page inventory complete, Playwright matrix in CI, a11y, guard baseline at zero for operational code; Phase 7 closed; schedule `0854` after the soak | none (`0854` after soak) | Every operational page migrated or excepted in writing |
| S15 | follows soak | Drop `quiet_hours_tz` | `0854` | `CLOCK_QUIET_TZ_LEGACY` clean; no reader |

Dependencies: S1 → everything (no database dependency; S1 can start now). S2 needs S1 (vectors; done 2026-11-27) and D32–D35 (accepted 2026-11-27). S2 applied → S3, S4, S5, S6, S8, S9, S10 (S3/S6 read `hourCycle`/`weekStart`/`businessDate` from the `0843` readers; S4 validates zones against the `0842` canonical catalog). S3 and S4 can run in parallel after S2. S13 HQ screens may start after S1 for display work; HQ catalog screens (H9) after S2. **S1 done (2026-11-27). S2 files written (2026-11-27, `0.1.43`). Next step: the user applies `0842` then `0843`; then S3 and S4.**

## 9. Rollout, risks, rollback

### 9.1 Rollout
- Deploy order per slice: migration (user applies, local then remote) → `prisma:pull` → web-admin/cmx-api/workers → HQ (when touched) → mobile store release last (old apps keep working because APIs only add fields; offset-less requests from old apps are tolerated **only** on endpoints that already accepted them, with a deprecation log, until the mobile release adoption reaches the agreed threshold).
- Apply during low traffic and in one batch per slice (the Disk IO incident of 2026-11-26: every DDL triggers a PostgREST schema-cache reload; avoid dashboard one-off DDL).
- Feature flag only for exposing the cut-over setting (D23).
- **Cross-repo order for one slice:** (1) the user applies the tenant migration(s) locally, runs pgTAP, then remote; (2) the user regenerates types (§7.3) in both repos; (3) web-admin, cmx-api, cmx-workers deploy; (4) HQ platform-api + platform-web deploy (only when the slice touches HQ); (5) mobile store release last. HQ code never relies on a column before step (1) is done remotely.
- **`notify` rule:** no TS or SQL caller passes `notify` to a database door until `0842` is applied remotely (before that `fn_ops_zone` returns null for it). S1 only adds it to the TS list and vectors; S8 is the first real caller.
- **Feature flags:** `clock.business_day_cutover` (D23) gates only the tenant cut-over UI. Everything else ships unflagged (correctness). The flag key is registered in the existing feature-flag catalog in S9; with the flag off, a stored cut-over still applies (HQ may set it).

### 9.2 Risks

| Risk | Control |
|---|---|
| tzdb skew between Postgres, Node, browsers, and Dart after a government changes rules | Server-side decisions; `/health/clock`; vectors with recent changes; upgrade runtimes on tzdata releases |
| DST gap/overlap silently shifts a typed appointment | `reject` default + explicit user choice; tests in `America/New_York` and `America/Santiago` |
| A function replacement changes a money or tax decision near midnight | Vectors at 20:00–23:59Z for +04:00 tenants; compare old/new results on staging data before apply |
| Machine zone equals shop zone on the dev laptop | Jest and Playwright zone matrix |
| Per-row zone calls slow lists | Guard pattern + review rule; one CTE join |
| HQ and tenant stamps converted at different times | One migration + same deploy window (D18) |
| Migration storms on a Micro instance | Batched DDL, low traffic, one apply per slice |
| Old mobile apps | Additive APIs; tolerance window logged |
| Test override used in production | Two gates (env table + role), env table closed to all roles, health `CLOCK_FAKE_ENV`, guard bans writes of `'test'` outside tests |
| Polyfill bug or removal pain | One adapter, vectors against polyfill and native, quarterly removal check (D1) |
| Tenant hour cycle or week start NULL with no country default | Health `CLOCK_SETTING_UNRESOLVED`; resolution continues to `hq_general_config` (D33); `CLOCK_DEFAULTS_MISSING` if that row is missing |

### 9.3 Rollback
- Code: revert the slice deploy; helpers are additive.
- SQL functions: each replacement migration stores the previous body in a comment block `-- ROLLBACK BODY` so a forward migration can restore it; never edit an applied file.
- Columns: expand-only in S9; drops happen in a later migration after readers moved (`quiet_hours_tz` in `0854`).
- Data conversions: forward migration only if a conversion is proven wrong; dev data movement is accepted.

#### 9.4 Rollback per migration (forward fixes only; never edit an applied file)

| File | What a rollback migration does | Data at risk |
|---|---|---|
| `0842` | Restore `fn_ops_zone`, `fn_tenant_tz_validate`, `fn_hq_gen_cfg_validate` from `-- ROLLBACK BODY`; drop `trg_branches_tz_validate`, the `fn_cmx_dt_*` functions, `cmx_dt_env_cf`, the `CLOCK` registry rows/domain; leave the new `sys_timezone_cd` columns and alias rows (harmless, inactive) | none (normalized zone values stay valid canonical names) |
| `0843` | Drop the readers and checks; keep the new nullable columns (or drop them in a later file once no reader exists) | cut-over values entered in HQ |
| `0844` | `ALTER ROLE … RESET timezone` for the roles it changed | none |
| `0846` | Restore each replaced body from `-- ROLLBACK BODY`; re-add the dropped `DEFAULT CURRENT_DATE` only if a writer still relies on it | none |
| `0849` | Restore the previous cron schedules (`cron.schedule` with the old expressions recorded in the file header); keep `next_run_at` columns | none |
| `0850` | Drop the two triggers; keep the columns and indexes (expand-only) | none |
| `0851` | Drop the zone-change trigger; keep the log table (audit history) | none |
| `0852` | Not reversible in place (column type change); a forward fix converts back with `AT TIME ZONE 'UTC'` and restores the hash canonicalisation | audit hash verification must be re-run |
| `0853` | Re-run the previous seed values (the file stores the prior versions) | none |
| `0854` | Re-add `quiet_hours_tz text NULL` (values are gone; they were unused) | the dropped values |

---

## 10. Verification queries (read-only, run by the user or with explicit approval)

```sql
-- Q1 session and role zones
SHOW timezone;
SELECT r.rolname, s.setconfig
FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
WHERE array_to_string(s.setconfig, ',') ILIKE '%timezone%';

-- Q2 no naive org_* instants remain
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND data_type = 'timestamp without time zone' AND table_name LIKE 'org\_%';

-- Q3 tenants and branches without a usable zone
SELECT t.id, t.timezone FROM org_tenants_mst t
LEFT JOIN sys_timezone_cd z ON z.code = t.timezone AND z.is_active
WHERE z.code IS NULL;
SELECT b.tenant_org_id, b.id, b.timezone_code FROM org_branches_mst b
LEFT JOIN sys_timezone_cd z ON z.code = b.timezone_code AND z.is_active
WHERE b.timezone_code IS NOT NULL AND z.code IS NULL;

-- Q4 catalog codes unknown to Postgres
SELECT c.code FROM sys_timezone_cd c
LEFT JOIN pg_timezone_names n ON n.name = c.code
WHERE c.is_active AND n.name IS NULL;
-- Result:
-- America/Coyhaique

-- Q5 live functions still using banned clock calls
SELECT p.proname FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
WHERE ns.nspname = 'public' AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~* '(current_date|localtimestamp|localtime|now\(\)\s*::\s*(date|time))';
-- Result :
apply_fin_tpl_for_tnt
fn_tax_kit_update
fn_shc_speed_no_rules
generate_cash_drawer_trx_no
fn_tax_kit_apply
fn_shc_tax_exemption_expired
seed_product_speed_rules
generate_cash_drawer_sess_no
fn_shc_tax_kit_update_pending
fn_tax_kit_version_publish
fn_tax_kit_update_all
fn_tax_kit_version_clone
fn_shc_cal_holidays_missing
get_product_price
seed_tenant_erp_lite_defaults
sys_bill_generate_invoice_number
sys_bill_update_invoice_amount_due
get_order_number_prefix
fn_shc_cal_holidays_estimated
fn_shc_tax_doc_type_no_rule
resolve_fin_tpl_for_tnt
fn_expire_credit_notes


-- Q6 zone door parity sample (after 0842): the wrapper must equal the deployed door
SELECT t.id, public.fn_ops_zone(t.id, 'accept_order', NULL) AS door,
       public.fn_cmx_dt_zone(t.id, 'accept_order', NULL) AS wrapper
FROM org_tenants_mst t LIMIT 20;
-- Yes the wrapper is equal the deployed door

-- Q7 role and database zone settings in detail (D4; read-only)
SELECT coalesce(r.rolname, '(database default)') AS role_name, d.datname, s.setconfig
FROM pg_db_role_setting s
LEFT JOIN pg_roles r ON r.oid = s.setrole
LEFT JOIN pg_database d ON d.oid = s.setdatabase
WHERE array_to_string(s.setconfig, ',') ILIKE '%timezone%';
SELECT rolname FROM pg_roles WHERE rolname IN ('postgres','authenticator','authenticated','service_role','anon');
--Result:
rolname
authenticated
anon
service_role
authenticator
postgres


-- Q8 stored zones that are not canonical IANA names (D16)
SELECT 'tenant' AS kind, id::text, timezone AS zone FROM org_tenants_mst
WHERE timezone IS NOT NULL AND (timezone !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$' AND timezone <> 'UTC' OR timezone ~ '^(posix|right)/|^Etc/GMT[+-]')
UNION ALL
SELECT 'branch', id::text, timezone_code FROM org_branches_mst
WHERE timezone_code IS NOT NULL AND (timezone_code !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$' AND timezone_code <> 'UTC' OR timezone_code ~ '^(posix|right)/|^Etc/GMT[+-]')
UNION ALL
SELECT 'catalog', code, code FROM sys_timezone_cd
WHERE is_active AND (code !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$' AND code <> 'UTC' OR code ~ '^(posix|right)/|^Etc/GMT[+-]');
-- Success. No rows returned

-- Q9 clock settings (D33): platform values and tenants that inherit (after 0843 the cut-over column exists)
SELECT time_format, first_day_of_week, date_format, timezone FROM hq_general_config;
SELECT count(*) FILTER (WHERE time_format IS NULL) AS hour_cycle_inherit, count(*) FILTER (WHERE first_day_of_week IS NULL) AS week_start_inherit FROM org_tenants_mst;
-- Result
hour_cycle_inherit,week_start_inherit
2,2

-- Q10 health roll-up (after 0842; service_role or postgres)
SELECT check_code, severity, count(*) FROM public.fn_cmx_dt_health(NULL) GROUP BY 1, 2 ORDER BY 2, 1;
-- 
check_code,severity,count
CLOCK_CATALOG_UNKNOWN,error,1


-- Q11 test override must be off everywhere (after 0842)
SELECT env FROM public.cmx_dt_env_cf;
prod

-- Q12 platform fallbacks already stored (0668): HQ time format, first day of week, date format, zone
SELECT time_format, first_day_of_week, date_format, timezone, default_country_code FROM public.hq_general_config;

-- Q13 tenant settings already stored (0668 columns) and tenant countries unknown to the catalog
SELECT count(*) FILTER (WHERE time_format IS NOT NULL) AS tf, count(*) FILTER (WHERE first_day_of_week IS NOT NULL) AS fdow,
       count(*) FILTER (WHERE date_format IS NOT NULL) AS df, count(*) AS tenants FROM public.org_tenants_mst;
SELECT t.id, t.country FROM public.org_tenants_mst t LEFT JOIN public.sys_country_cd c ON c.code = t.country WHERE c.code IS NULL;

-- Q14 tables an anon path can write (defaults/triggers there must not need non-anon functions)
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public' AND privilege_type IN ('INSERT','UPDATE');
-- 438 rows

-- Q15 stored zones by catalog class (before and after 0842: nothing stored may become non-canonical or inactive)
SELECT 'tenant' AS kind, t.timezone AS zone, count(*) FROM public.org_tenants_mst t GROUP BY 1, 2
UNION ALL SELECT 'branch', b.timezone_code, count(*) FROM public.org_branches_mst b WHERE b.timezone_code IS NOT NULL GROUP BY 1, 2
UNION ALL SELECT 'hq', h.timezone, 1 FROM public.hq_general_config h ORDER BY 1, 3 DESC;

-- Q16 who calls fn_tenant_general_value with the timezone key (before 0846)
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND pg_get_functiondef(p.oid) ILIKE '%fn_tenant_general_value%';
-- Before 0846
proname
fn_cmx_dt_period_key
fn_tenant_general_value

```

**Migration slots after S2 (`0.1.43.2`):** `0844` = `0844_cmx_dt_catalog_reader_definer.sql` (catalog readers as `SECURITY DEFINER`; the role-zone fix it was reserved for is not needed). `0845`–`0851` unchanged. America/Coyhaique: recommended to fold into `0845` (S5) so nothing renumbers; a separate migration would take `0845` and move S5–S15 slots up by one. *(Superseded at `0.1.45`: the user's own `0845` took the slot; S5 is `0846` and includes Coyhaique, later slots +1.)*

**Verdict (agent, 2026-11-27, `0.1.43.1`):** Q1/Q7 show no role or database zone setting, so the role-zone `0844` is not needed. Q6 parity holds, Q8 is clean, Q11 is `prod`. Q4/Q10: America/Coyhaique is unknown to the server tzdata (recommendation in `IMPLEMENTATION_REPORT.md`). Q5: 22 legacy functions are the S4/S14 backlog.

---

## 11. Consistency pass log (2026-11-26: planning finalization rows 1–17; adversarial review 0.1.41b rows 18–49)

Inconsistencies found in the first draft (`0.1.40-plan`) while finalizing, and how each was fixed in this version and in the sibling documents.

| # | Found | Fix |
|---|---|---|
| 1 | The draft put `business_day_cutover` and `week_start_dow` as columns on `org_tenants_mst`. The tenant settings catalog is actually the key-value pair `sys_tenant_extra_config_cf` (catalog) + `org_tenant_extra_config_cf` (per-tenant, RLS) | Settings are config keys `BUSINESS_DAY_CUTOVER`, `HOUR_CYCLE`, `WEEK_START`; only the branch cut-over is a column (D6, D7, D13, §7.1.5) |
| 2 | `sys_tenant_extra_config_cf` is closed to `anon` and `authenticated` (`0775`), so an `INVOKER` reader would fail for app users | Readers are `SECURITY DEFINER` with the tenant guard; recorded as the only exception to the INVOKER rule (§5, §7.16) |
| 3 | `sys_country_cd` has no hour-cycle or week-start default, yet D13 relied on a per-country default | Columns `default_hour_cycle`, `default_week_start` added in `0847` (G18) |
| 4 | The first final plan named a `notify` operation that did not exist, so quiet hours were assigned to `delivery` | Superseded by D27 (t135u): `notify` is added to the closed list in `0842`, and quiet hours / notification scheduling use it |
| 5 | Migration slots were provisional and partly unnumbered: S8 had no slot while S9–S13 used `0846`–`0850`, §7.1.4 listed `0848` before `0847`, and the optional role-zone file was `0843` while the catalog refresh sat after the stamps | Re-slotted `0842`–`0852` strictly by slice (§7.1, §8) |
| 6 | The response block carried `zoneSource`; D21 as accepted lists six other fields | Block is `{ zone, businessDate, serverNow, hourCycle, weekStart, tzdbVersion }`; `tzdbVersion` is the app runtime's (SQL tz data cannot be read as a version number; compared in health instead) |
| 7 | A custom setting cannot be permission-restricted, so "impossible to set in production" cannot rely on the setting | Two-gate design: owner-only `cmx_dt_env_cf` + `postgres`/superuser session; others can set it but it is ignored (§5.0) |
| 8 | `pg_timezone_names` also lists abbreviations (`EST`, `GMT+4`-style, `Etc/GMT-4`, `posix/…`); "validated against `pg_timezone_names`" alone would accept them | D16 rule adds the canonical-name test; TS mirror `isValidZoneId`; Q8 |
| 9 | `RESUME_CONTINUATION.md` and `work-packages.md` still said migrations may be applied by the agent, and a "suspended" note existed | Removed; D17 stated everywhere (only the user applies) |
| 10 | Old function and TS names (`fn_ops_today`, `todayIn`, …) in the plan, vectors list, guard, and HQ plan | All renamed to `fn_cmx_dt_*` / `dt*` (D26); `fn_ops_zone` kept as the deployed door |
| 11 | No health surface existed for the clock, and fake-time safety had no check | `fn_cmx_dt_health` and `CLOCK_*` checks (§5.3, G16, G17) |
| 12 | Plan said "no new runtime dependency" (R5) while D1 now accepts the polyfill | R5 and the guard rewritten; confinement and removal plan (D1) |
| 13 | Latest migration re-checked: `0841_otp_stamps_timestamptz.sql` | Slots start at `0842` |
| 14 | Runtime validation was specified against `pg_timezone_names`, which also lists abbreviations and is the wrong long-term source of truth | D28: `sys_timezone_cd` is extended and is the only runtime source; `pg_timezone_names` is a health sync check |
| 15 | Last-resort hour cycle / week start were hard-coded constants (`H23`, `SAT`) | D30: `sys_tenant_config_defaults_cd` (spelling corrected from the user's `sys_defults_tenants_config_cd`); superseded by D33 (`hq_general_config`) |
| 16 | Country defaults had no official seed source | D29: Unicode CLDR `timeData` + `weekData`, version recorded per row |
| 17 | The three new config keys had no settings-screen group | D31: category `DATETIME` ("Date & Time" / "التاريخ والوقت"). A category is the `category_code` grouping on `sys_tenant_extra_config_cf`; superseded by D33 (labels reused as a section title) |
| 18 | **High.** The fake-clock gate read the owner-only `cmx_dt_env_cf` from an INVOKER function: every `authenticated` call with `cmx.fake_now` set (anyone can set it) would raise `permission denied` instead of being ignored | Gate order fixed: `session_user` / superuser test first, table read only for the owner; `fn_cmx_dt_now` is an inlinable SQL fast path; T66 (§5.0) |
| 19 | **High.** Dependency inversion: S3/S6 need `hourCycle`, `weekStart`, `businessDate`, but the readers were in S9 (`0847`); D30 forbids a constant in between | Settings foundation moved into S2 as `0843`; role-zone `0844` (conditional); S5 `0846`, S8 `0847`, S9 `0848`; S10–S15 unchanged (G26, §7.1, §8, RESUME table) |
| 20 | **High.** D28 seed rule would demote `Asia/Muscat` (and `Asia/Kuwait`, `Asia/Bahrain`, …) to an inactive alias of another country's zone; `fn_ops_zone` would then fail closed for those tenants (evidence: `0675` source is `zone1970.tab`; `0055` seeded the GCC rows; demo tenants use `Asia/Muscat`) | D32 proposed (ECMA-402 primary identifiers); `0842` refuses to demote a stored code; Q15; T61 (G19) |
| 21 | **High.** Hour cycle, week start and date format already exist on `org_tenants_mst` / `hq_general_config` with a DEFINER resolver and HQ editors (`0668`); the plan's extra-config keys and new defaults table would duplicate them | D33 ACCEPTED 2026-11-27 (reuse; add country CLDR defaults and cut-over columns only); D30/D31 superseded, no fallback path (G24) |
| 22 | **Medium.** Column defaults and triggers evaluate functions with the caller's rights; an `anon`-writable table with `DEFAULT fn_cmx_dt_now()` would fail if `anon` lacked EXECUTE | `fn_cmx_dt_now`/`_clock`/gate helpers also granted to `anon` (time only); Q14 lists anon-writable tables; guard knows the exception (§5, §7.12, §7.16) |
| 23 | **Medium.** `fn_cmx_dt_health` was re-created by several migrations, so a later file could drop an earlier check | Aggregator + one `fn_cmx_dt_chk_*` per check; later files add functions and registry rows only (§5.1, §5.3) |
| 24 | **Medium.** Setup-health contract not followed: registry severities are `BLOCKER/WARNING/INFO`, checks are `fn_shc_*(uuid, uuid) → jsonb` INVOKER with `fn_shc_guard_tenant`; the plan said "error/warning/info" and one DEFINER function | Tenant checks as `fn_shc_clock_*` under new domain `CLOCK`; severity mapping; platform checks `is_hq_only`; T64 (§5.3) |
| 25 | **Medium.** `fn_ops_zone` returns null for an unknown operation, so a typo would surface as `TIMEZONE_NOT_CONFIGURED` | `fn_cmx_dt_zone` raises `CLOCK_UNKNOWN_OPERATION`; `fn_ops_zone` unchanged (backward compatible); §5.4 |
| 26 | **Medium.** `WEEK` key `YYYY-Www` is ISO week numbering and ambiguous for SAT/SUN/FRI starts | Key `WYYYYMMDD` (week-start civil date); vectors across a year boundary; doc-seq has no weekly reset in this program (§5.1) |
| 27 | **Medium.** No business-day bounds with cut-over; DST behaviour of the cut-over undefined | `fn_cmx_dt_business_day_bounds` / `dtBusinessDayBounds`; business date computed on local wall time; DST vector (§5.1, §7.13) |
| 28 | **Medium.** Existing tenant and HQ zone validators (`0668`) accept abbreviations and offsets; tenant zone has no FK; branch FK will accept alias rows | `0842` replaces both bodies (canonical active only, alias normalized), adds the branch trigger; T62 (G20, §7.1.1 item 3b) |
| 29 | **Medium.** `fn_tenant_general_value('timezone')` falls back to the HQ zone for a tenant | `0846` returns the tenant value only; Q16 lists callers (G21) |
| 30 | **Medium.** `0840` expiry predicates compare with `AT TIME ZONE fn_ops_zone(...)`; a missing zone silently means "never due" | Added to the `0846` list with `fn_cmx_dt_today_or_null` + explicit skip/report; T67 (G22) |
| 31 | **Medium.** S8 only stopped *reading* `quiet_hours_tz`; the settings route, service and page still *write* it | Writers listed and removed in S8; `0852` after type regeneration; T68 (G23) |
| 32 | **Medium.** "The payments table" (D11) was ambiguous: two payment tables exist (`org_order_payments_dtl` with `paid_at`, `org_invoice_payments_dtl` with `applied_at`) | D35 ACCEPTED 2026-11-27: orders + `org_order_payments_dtl` (`COALESCE(paid_at, created_at)`); AR applications excluded |
| 33 | **Medium.** `0848` trigger behaviour on a missing zone was undefined (raising would block order creation for a zone-less tenant) | `_or_null` zone, both columns stay null, health reports it; fill only when the writer left them null; never recomputed; DEFINER trigger function (§7.1.5) |
| 34 | **Medium.** `ADD COLUMN … NOT NULL` for `iana_name` etc. would fail on existing rows; alias rows must satisfy NOT NULL `utc_offset_hours` | Add nullable → backfill → `SET NOT NULL`; aliases copy the target's offset columns (§7.1.1 item 1) |
| 35 | **Medium.** No per-migration rollback guidance | §9.4 table |
| 36 | **Medium.** Generated-types regeneration was only `prisma:pull`; `web-admin/types/database.ts`, HQ `database.types.ts` (api + web) were not named | §7.3 regeneration list; slice not closed until `tsc` passes in both repos |
| 37 | **Medium.** No cross-repo apply/deploy order and no rule for first use of `notify` | §9.1 cross-repo order, `notify` rule, flag scope |
| 38 | **Medium.** `CLOCK_CATALOG_UNKNOWN` claimed a reverse test that SQL cannot do (`pg_timezone_names` has no canonical flag) | One-direction check in SQL; reverse comparison in the `0851` refresh script (§5.3) |
| 39 | **Low.** §6.3 field table said `dtBusinessDate`; the JSON key is `businessDate` | Fixed |
| 40 | **Low.** §7.16 said public endpoints return only the zone id while §6.3 returns `serverNow` and `hourCycle` | Aligned: zone + display preferences + `serverNow` |
| 41 | **Low.** Vectors text still said "tenant → country → constant", contradicting D30 | Fixed to "platform fallback row" (§7.13) |
| 42 | **Low.** `ZONE_CHANGE_BLOCKED_OPEN_SESSION` (§7.1.6) and `HQ_CONFIG_BAD_TIMEZONE` (`0668`) missing from the error vocabulary | Added to §5.4 with i18n key / mapping |
| 43 | **Low.** `fn_cmx_dt_setting` (DEFINER) would read any key of the closed catalog | Limited to the three clock keys; not created under D33 (§5.1) |
| 44 | **Low.** No function-to-test matrix; manual cases missing for catalog normalization, setup-health, CLDR seed, DEFINER/gate, expiry skip, quiet-hours save | §7.13.1 matrix; T61–T68 |
| 45 | **Low.** i18n list lacked the Date & Time section keys, setup-health `CLOCK` texts and HQ catalog screens | §7.14 additions |
| 46 | **Low.** No API endpoint inventory for the `clock` block contract test | `technical_docs/api-clock-inventory.md` in S6 (§7.17) |
| 47 | **Low.** Volatility note: Postgres marks `timezone(text, timestamptz)` IMMUTABLE, but tzdb updates change results; an IMMUTABLE wrapper could be constant-folded into an index or a cached plan | Keep `STABLE` for every zone-dependent function; only `fn_cmx_dt_civil_add` is IMMUTABLE (§5.1 rule stands; the S2 "verify `pg_proc`" note is resolved: stay STABLE) |
| 48 | **Low.** Browser and Node ICU may report legacy names (`Asia/Calcutta`) for the device zone | `useDeviceZone` normalizes through the catalog snapshot (D32) |
| 49 | **Info (verified, no change).** `fn_ops_zone` (`0830`): plpgsql, STABLE, INVOKER, `search_path = pg_catalog, public, auth, pg_temp`, closed list of six codes, tenant guard `OPS_ZONE_TENANT_MISMATCH` when `auth.uid()` is set, `REVOKE … PUBLIC, anon`, `GRANT … authenticated, service_role`; adding `notify` with `CREATE OR REPLACE` keeps grants and is backward compatible. `org_branches_mst.timezone_code` (FK `fk_branch_timezone`), `org_tenants_mst.country` is ISO 3166-1 alpha-2 (`0826` comment; settings route `z.enum(ALLOWED_COUNTRIES)`), `sys_tenant_extra_config_cf.category_code` exists (CHECK UPPER_SNAKE), latest migration still `0841` | none |

**S1 implementation notes (2026-11-27).** (a) `FY` period key = `FY` + the calendar year in which the fiscal year **starts** (start month 4, date 2027-02-10 → `FY2026`); the S2 SQL `fn_cmx_dt_period_key` must produce the same key (vectors `periodKey`), and existing doc-seq FY keys must be checked against it before doc-seq calls the new function. (b) Node 24 has no native `Temporal`, so the "native adapter" vector run installs the polyfill's `Temporal` as `globalThis.Temporal` and runs the adapter's native path; a run on a real native Temporal is added when a runtime ships it. (c) `temporal-polyfill` is ESM-only, so `@cmx/clock` ships a built `dist` (ESM per module for web-admin/workers; a CommonJS bundle with the polyfill inlined for cmx-api and Jest), built by the workspace `prepare` script on `npm install`/`npm ci`. (d) `dtToday(clock, zone)` and `dtLocalNow(clock, zone)` take the zone already resolved by the door; the tenant/operation/scope form stays in SQL (`fn_cmx_dt_today`) and the web-admin server door.

**S2 implementation notes (2026-11-27).** (a) `0842`/`0843` written as files and run only on a scratch Postgres 17.12 (tzdata 2026f) on the agent's machine; the user applies them. (b) Seed: tzdb 2026f + CLDR 49; 419 canonical zones, 117 inactive aliases (incl. 17 UTC-family names), CLDR EN/AR names; 249 CLDR territories for the country defaults (only existing `sys_country_cd` rows updated). (c) CLDR 49 differs from the T65 examples: `OM` H12/Saturday, `SA` H12/Sunday, `AE` H12/**Monday**, `US` H12/Sunday, `DE` H23/Monday, `MV` H23/Friday; T65 now uses these values; open question to the user whether to keep them (recommended) or have HQ edit rows. (d) Deviations (plain-SQL tests instead of pgTAP, extra `_in` helpers and `fn_cmx_dt_settings`, DEFINER `fn_cmx_dt_hq_zone`, gate also checks `current_user`, `info` findings never fail a setup-health check, guard regex fix for `fn_cmx_dt__fake_*`) are listed in `IMPLEMENTATION_REPORT.md`. (e) `fn_cmx_dt_to_local` stays STABLE (row 47). (f) `0844` waits for the user's Q1 output.

Still open (none blocks S2): the polyfill removal cadence (proposal: quarterly, D1); the soak window before `0854` (proposal: 14 days clean). Resolved by the review: setup-health registry shape (§5.3, from live `0709`/`0739`); tenant country column (`org_tenants_mst.country`, ISO-2 per `0826`; `CLOCK_COUNTRY_UNKNOWN` covers bad rows); fake-clock permission path; payments table (D35). D32–D35 accepted 2026-11-27 (t137u).
