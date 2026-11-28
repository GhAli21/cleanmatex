# Changelog

## 0.1.48 — 2026-11-27

- **S7 (no migration).** New `web-admin/lib/clock/api-output.ts`: `toApiInstant` / `withApiInstants` (instants out as `...Z`, offset-less text refused), `exportLocalText` (named zone, `en`, Latin digits, 24h), `exportDateValue`, `exportZoneHeader`, `exportFileDay` (screen-zone civil day, never the device day).
- Exports: `CmxDataGrid` and `DataTable` file names use the screen-zone civil day and write `Date` cells as `Z`; `toCsv` (report CSV) writes `Date` as `Z`; customers export uses `toApiInstant`; price-history CSV has `Changed At (UTC)`, `Changed At (Local)` and `Time Zone` columns.
- D20 second list: catalog price history (`ViewZoneProvider` `price-history`, `CmxViewZoneToggle`), times in the endpoint `clock` zone (fail closed), `<bdi>`.
- Audit (WP17): `CmxAuditInfoCard` (and `CmxAuditColumn` through it) formats instants in the screen clock zone or the viewer zone; `—` without a zone (was the device zone).
- `GET /api/v1/health/clock` (`setup_health:view`, session tenant): Node tz/ICU, app vs `fn_cmx_dt_now()` skew (`CLOCK_DB_SKEW` > 2 s), three recent-rule vectors in SQL and TS (`CLOCK_TZDB_SKEW`), `fn_cmx_dt_health` findings (incl. `CLOCK_FAKE_ENV`), `status`.
- T15: FX import takes civil `rate_date` only (`YYYY-MM-DD`), a datetime row is already rejected; no change.
- Rules: `docs/dev/rules/time-and-timezone.md` gains "Clock program rules in force (S1–S7)"; `.cursor/rules/time-and-timezone.mdc` rules 13–16.
- Guard 224 → 221 (baseline lowered). The user's `0849_setup_health_measured_price.sql` (`updated_at = NOW()`) allowlisted by name; S8 projected `0850`.
- Tests: `clock-s7.test.ts`, `health-clock.route.test.ts`, audit card test (zone + fail closed); 74/74 under `America/Los_Angeles` and `Asia/Kathmandu`.

## 0.1.47 — 2026-11-27

- **S5 closed:** the user applied `0846` (local and remote) and regenerated types and the Prisma schema; `clock_s5_current_date.test.sql` PASS 1–7 (the two `CLOCK_ZONE_MISSING` warnings in section 6 are expected).
- **Slots +2:** the user's `0847_bg_jobs_file_purge.sql` (applied) and `0848_hq_nav_uom_config.sql` took `0847`/`0848`. S8 → `0849`, S9 `0850`, S10 `0851`, S13 `0852`/`0853`, S15 `0854`; a slice takes the next free number when its file is written. Both files use `updated_at = now()` (instants only) and are allowlisted by name in the guard; new migrations write `fn_cmx_dt_now()` or `-- CLOCK-OK: <reason>`.
- **S6 (no migration).** New `web-admin/lib/clock/api-input.ts` (`zInstant`, `zCivilDate`, `zInstantDate`, `zCivilOrInstantDate`, `zCivilStorageDate`, `isCivilDateText`, `isInstantText`, `leadingCivilDate`) used by 22 routes/actions and 8 validation schemas instead of `z.string().datetime()`, `z.coerce.date()` and date regexes (43 → 1 hits; `iso-date.ts` stays, year-bounded).
- `lib/clock/api-clock.server.ts`: `screenClock` / `publicScreenClock` (block or null, never fails the response), `clockErrorResponse` (409 `ZONE_MISMATCH`, 422 `LOCAL_TIME_*`, 400 parse codes, `messageKey`), `assertZoneEcho` (D9), `resolveZonedInput` (typed date + time, `reject` default).
- `clock` block on `GET` orders, order detail (`ready_by`, order branch), cash-drawer trx and variance report, finance orders-summary / payments-breakdown / tax-report, pricing history, public customer orders (public subset). Inventory: `technical_docs/api-clock-inventory.md` (contract test reads it).
- UI: `CmxDstChoice` (earlier/later with offsets, EN/AR, `<bdi>`), `useClockErrorMessage` (API code → `clock.errors.*`).
- Fix: promotion start/end dates from the form were read in the server's zone (`new Date('YYYY-MM-DDT00:00')`); now the organization `accept_order` day (`TIMEZONE_NOT_CONFIGURED` without a zone); an instant needs an offset.
- Tests: new `api-clock.test.ts`, `api-clock-inventory.test.ts`, `clock-ui-s6.test.tsx`; `finance-tax-report.route.test.ts` mocks the zone (2 failures that predated S6) and asserts the block.

## 0.1.46 — 2026-11-27

- **S5 `0846_cmx_dt_replace_current_date.sql` (written, not applied).** Re-reads 27 live definitions, checks every rule's match count (stops on drift, nothing changed), rewrites `CURRENT_DATE`/`now()::date`/`now()` to `fn_cmx_dt_*`, re-executes; owner, grants, security, volatility, config kept. Needs PG 15+.
- G3: strict tenant day for seeds, templates, tax kit apply/update, price lookup (`p_effective_date DEFAULT NULL`); `COALESCE(today_or_null, col)` for six health checks and two finance views; HQ zone for tax-kit catalog and `sys_bill_*`; cash-drawer numbers via `fn_cmx_dt_period_key`; `get_order_number_prefix` explicit UTC.
- G21: `fn_tenant_general_value` `timezone` is tenant-only. G22: credit-note expiry returns `ZONE_MISSING` / reports `zone_missing` instead of silently skipping (and no longer expires a note when `is_due` is null).
- `org_speed_price_rules_cf.effective_from` default dropped. Unknown, unused catalog zones (America/Coyhaique) `is_active=false`; reactivation rule in the file header.
- New: `supabase/tests/clock_s5_current_date.test.sql`, `technical_docs/s5/0846_preimage.sql` (exact rollback).
- TS: speed-rules date text via `prismaDateToCivil`; loyalty-expiry idempotency key via `dtTodayIn('UTC', at)`; stored-value tests mock `operationalCivilToday` (3 stale failures fixed), +`ZONE_MISSING`, +missing-zone case. Guard 226 → 224.

## 0.1.45 — 2026-11-27

- **Slots +1 (user, t145u):** `0845` is the user's `0845_fix_get_user_tenants_last_login_timestamptz.sql`. S5 → `0846` (includes America/Coyhaique), S8 `0847`, S9 `0848`, S10 `0849`, S13 `0850`/`0851`, S15 `0852`. Older entries keep their old numbers.
- **S4 (no migration).** G2: `CmxTimeZoneSelect` (catalog list, search, live offset) in Settings → General and tenant registration; new public `GET /api/v1/public/timezones`; `timezone-catalog.service.ts` `canonicalActiveZone` (via `fn_cmx_dt_canonical_zone` + `fn_cmx_dt_is_valid_zone`) in the settings and register routes → 400 `INVALID_TIME_ZONE`, canonical name stored; the six-zone allowlists are gone.
- G7: per-user zone removed from user preferences (and its strings).
- G8: root layout wraps the app in `ClockProvider` from `getTenantClockBlock` (cached); `CmxZoneNotice` when no zone; nested providers inherit settings.
- G12: `dunning` (no zone → warn, no statements), FX import/resolver (`OperationalZoneMissingError`; same currency needs no zone), product import express rules (`TIMEZONE_NOT_CONFIGURED`), usage tracking explicit UTC; tax dialogs and review use `useClockCivilToday()`.
- D20: `useDeviceZone` (one allowlisted read), `ViewZoneProvider` (URL `tz=` + localStorage), `CmxViewZoneToggle` on the orders list (Ready By column). The second list moves to S7.
- S3 leftovers: tax lifecycle timeline, order timeline, status lifecycle tab, change history, preferences, prints, workspace, financial statement, cash drawer, issue tables, edit history, ready-date picker; public tracking page wrapped in `ClockProvider`.
- Guard 276 → 226 (−50); baseline lowered. Bare `toLocaleString()` not added (also number formatting; needs a seed mode) → S14.
- Tests: new `clock-ui-s4.test.tsx`, `timezone-catalog.service.test.ts`; zone mocks in dunning, FX, catalog tests.

## 0.1.44 — 2026-11-27

- **S2 closed:** the user applied `0842`, `0843`, `0844` (local and remote); `clock_sql_api.test.sql` PASS 1–7, vectors 159.
- **S3 (no migration):** `src/ui/clock` (`ClockProvider`, `useClock`, `useInstantFormatter`, `CmxInstant`, `CmxCivilDate`, `CmxLocalTime`, `CmxZoneBadge`); fail closed (no zone → `—`, never the device zone); Latin digits, Gregorian calendar, `<bdi>` for RTL.
- `lib/clock/clock-block.server.ts`: screen/public `clock` block from `fn_cmx_dt_zone` + `fn_cmx_dt_settings` (server only).
- G1: new-order Ready By in the fulfilment-branch zone (`useReadyByZone` → `readyByZone` prop); public tracking API returns `clock` and the page paints received / ready-by / timeline in the shop zone; order detail pages wrap in `ClockProvider` (`ready_by` zone); invoices, receipts, stock, payments, payments/credits tables, edit-history row times use it.
- Anon finding fixed: `registerTenant` (public `POST /api/v1/tenants/register`) wrote `org_tenants_mst` (with `timezone`) and the subscription through the anon cookie client; since `0842` the zone trigger refuses anon. Writes now use the service-role client; `auth.signUp` stays on the session client.
- Guard: `order-summary-panel.tsx` −4 (instant getters 3, `toLocaleTimeString` 1); baseline lowered.
- Tests: new `__tests__/lib/clock/clock-ui.test.tsx`, `clock-block.server.test.ts`; G1 cases in `order-summary-panel.ergonomics.test.tsx` (also fixed a pre-existing suite failure from the `@ui/forms` server-action import); register test asserts admin writes.
- Remaining G1 screens moved to S4: `tax-document-lifecycle-timeline.tsx`, `order-timeline.tsx`, `order-status-lifecycle-tab`, `orders-change-history`, `orders-preferences`, print `*-rprt` files, `order-workspace-screen`, `order-fin-statement`, `use-cash-drawer`, `issue-table-types`, `ready-date-picker-modal` getters, `formatVal` in the edit-history tab.

## 0.1.43.2 — 2026-11-27

- Re-run of `clock_sql_api.test.sql` (with the 0.1.43.1 session row) found a **real bug**: `permission denied for table sys_timezone_cd` (42501) for a signed-in user, from `fn_cmx_dt_zone` → `fn_ops_zone`.
- Cause: `fn_ops_zone` (0830, kept in 0842) and the 0842 catalog readers `fn_cmx_dt_is_valid_zone`, `fn_cmx_dt_canonical_zone`, `fn_cmx_dt__accept_zone` were `SECURITY INVOKER`, but `0745` closed every `sys_*` table to `anon`/`authenticated` (no grant, forced RLS, no policy). Same gap for the zone triggers on `org_tenants_mst`/`org_branches_mst` when a user JWT writes. `fn_ops_zone` had this gap since `0830`.
- Fix: new migration `0844_cmx_dt_catalog_reader_definer.sql`: the four readers become `SECURITY DEFINER` (owner `postgres`, search_path already pinned, tenant guard unchanged, grants unchanged: no anon). `0745` stays intact (no SELECT grant on `sys_timezone_cd`). Rollback notes in the header.
- Test: section 6 adds 6j (catalog readers as `authenticated`). Scratch DB now mirrors `0745` grants and RLS: before `0844` it reproduces the 42501, after it PASS 1–7; vectors 159 PASS.
- Slot `0844` (reserved for the role-zone fix, not needed) now holds this fix; no other slot moves.

## 0.1.43.1 — 2026-11-27

- User applied `0842`/`0843` (local and remote), regenerated types and Prisma, recorded §10 results. `clock_vectors.test.sql`: 159 PASS. `clock_sql_api.test.sql` stopped at section 6 with `CLOCK_TENANT_MISMATCH`.
- Cause: a **test bug**. Section 6 set a JWT `tenant_org_id` claim, but the live `current_tenant_id()` (0734/0748) ignores JWT tenant claims and reads the caller's ACTIVE row in `sys_auth_user_sessions_mst`. The functions behaved correctly (fail closed). The scratch stub had copied the old claim-based helper, so the box run missed it.
- Fix (test file only, no migration): section 6 opens a session row for an unlocked member of tenant A inside the rolled-back test, checks `current_tenant_id()` = A, then runs 6f–6i; 6i is skipped with `NOTE 6` if tenant A has no unlocked member. Scratch stub now mirrors the real helper. Whole file: PASS 1–7.
- §10 verdict: no role or database time zone setting (Q1/Q7) → `0844` role-zone migration **not needed**; Q8 no rows; Q6 wrapper = door; Q10 only `CLOCK_CATALOG_UNKNOWN` (America/Coyhaique, server tzdata older than the catalog); Q5 lists 22 legacy functions with banned clock calls (S4/S14 backlog, guard baseline); Q11 `prod`.

## 0.1.43 — 2026-11-27

- Slice S2 of `MASTER_PLAN_v2.md`: **migration files written, not applied** (D17). No database of the user was contacted, nothing committed or pushed. Files were run on a throw-away Postgres 17.12 (tzdata 2026f) on the agent's own machine with stubs of the needed tables.
- `supabase/migrations/0842_cmx_dt_clock_api.sql`: own clock `fn_cmx_dt_now()` / `fn_cmx_dt_clock()` with the gated test override (`cmx.fake_now` honoured only when the owner-only `cmx_dt_env_cf.env = 'test'` and session and current user are `postgres`/superuser; D25, T66); `sys_timezone_cd` extended (8 columns, FK, CHECK) and seeded from IANA tzdb 2026f + CLDR 49 names (419 canonical zones per D32 + 117 inactive aliases incl. the 17-name UTC family; no stored zone may be demoted — preflight); `notify` added to `fn_ops_zone` (D27); the `fn_cmx_dt_*` API of §5.1 that needs no new setting; zone validators (tenant, HQ, new branch trigger) accept canonical active zones only and store an alias as its canonical name (G20); catalog integrity trigger; health aggregator `fn_cmx_dt_health` + 6 `fn_cmx_dt_chk_*` + 6 `fn_shc_clock_*`; setup-health domain `CLOCK` with EN/AR rows.
- `supabase/migrations/0843_cmx_dt_settings.sql`: cut-over columns (`org_branches_mst`, `org_tenants_mst`, `hq_general_config`, 00:00–11:59), `sys_country_cd.default_hour_cycle` / `default_week_start` / `cldr_version` / `clock_defaults_source` seeded from CLDR 49 for the existing country rows; pure resolvers + DEFINER readers `fn_cmx_dt_settings`, `_hour_cycle`, `_week_start`, `_cutover`, `_date_format` (D33, D34); `fn_cmx_dt_business_date(_in)`, `_business_day_bounds(_in)`; `fn_cmx_dt_period_key` gains `WEEK`; 5 more health checks.
- `0844` not written: it is only needed if §10 Q1 shows a non-UTC role or database, and Q1 needs the user's database. The slot stays free.
- Tests: `supabase/tests/clock_sql_api.test.sql` (7 sections, plain SQL) and `supabase/tests/clock_vectors.test.sql` generated by the new `scripts/gen-clock-vectors-sql.mjs` from the shared vectors (159 of 172 run in SQL). Both green on the scratch database.
- `@cmx/clock`: `SQL_DOOR_OPERATIONS` now includes `notify` (same change as `0842`); tests and README updated. web-admin clock test updated.
- Guard: `scripts/check-clock-contract.mjs` exemption regex fixed for `fn_cmx_dt__fake_*` (two underscores); guard exits 0 on `0842`/`0843`.
- FY period key: `FY` + start year confirmed by the user (t139u); identical to the doc-seq rule in `0670` (`fn_doc_seq_period_key`), so no alignment is needed.

## 0.1.42 — 2026-11-27

- Slice S1 of `MASTER_PLAN_v2.md` (no migration; nothing applied; no database contacted). Decisions D32–D35 recorded as ACCEPTED (t137u); D30/D31 marked superseded by D33 (settings come from `org_tenants_mst.time_format` / `first_day_of_week`, `sys_country_cd.default_hour_cycle`, `hq_general_config`).
- New workspace package `packages/clock` (`@cmx/clock` 0.1.42): Temporal adapter over `temporal-polyfill` 1.0.8 (MIT) in `src/temporal.ts` only (native `globalThis.Temporal` wins); `dt*` API mirroring `fn_cmx_dt_*` (`dtNow`, `dtClock`, `dtToday`, `dtTodayOrNull`, `dtTodayIn`, `dtLocalNow`, `dtLocalTime`, `dtAtLocal` with `compatible`/`earlier`/`later`/`reject`, `dtInstantAtZone`, `dtToLocal`, `dtLocalParts`, `dtDayBounds`, `dtBusinessDate`, `dtBusinessDayBounds`, `dtPeriodKey`, `dtCivilAdd`); injectable `Clock` (`systemClock`, `fixedClock`, `offsetClock`, `actionClock`); D32 canonical-zone helpers and catalog; D33 setting resolvers; `ClockBlock`; formatting with explicit zone; zod schemas (`@cmx/clock/zod`); 12 error codes with HTTP status and `clock.errors.*` keys.
- Closed operation list now includes `notify` (D27) in TypeScript; `SQL_DOOR_OPERATIONS` / `assertSqlDoorOperation` keep it away from the deployed `fn_ops_zone` until `0842`. web-admin `operational-time.ts` re-exports the list from `@cmx/clock`.
- Shared vectors `packages/clock/vectors/time-vectors.v1.json` (172 cases, 15 kinds; expected values from an independent tz implementation). Jest runs them under `TZ=UTC` and `TZ=Pacific/Kiritimati`, and under the polyfill and the native-path adapter (T60).
- web-admin: `@cmx/clock` dependency, `lib/utils/clock.ts`, `messages/{en,ar}/clock.json`, ESLint ban on `temporal-polyfill` / `@js-temporal/*` outside the package, `test:clock-tz` script, clock tests, and the restored Ready By calculator test (`__tests__/utils/ready-by-calculator.test.ts`, on `resolveReadyBy` + `readyByBlockReason`; G5). cmx-api: `@cmx/clock` dependency and `src/common/clock/clock.ts` + spec.
- Guard v2 (`scripts/check-clock-contract.mjs`, G4): `0832` allowlisted by name; new-SQL clock bans from `0842` (D25); fake-time writes in migrations banned; `REVOKE … anon` required for `fn_cmx_dt_*`; Temporal confinement; per-file ratchet baseline `scripts/clock-contract-baseline.json` for TS and Dart patterns (tenant: 273 web-admin + 7 mobile hits). The same script and an HQ baseline were added to `cleanmatexsaas/scripts`. CI runs the guard and `npm run test:clock`.
- Contract update: `docs/dev/rules/time-and-timezone.md` and `.cursor/rules/time-and-timezone.mdc` (clock API, new-SQL banned list, D1, D5/D25, D8 grants, D9, D17, R4).
- `package-lock.json`: +41 lines (`@cmx/clock` workspace link, `temporal-polyfill` 1.0.8, `temporal-utils` 1.0.4, dependency lines in `web-admin` and `cmx-api`).

## 0.1.41b-plan — 2026-11-26

- Adversarial gap review of the final plan against the live code and migrations (t136u). Documentation only: no code or migration changed, nothing applied, no database contacted. Findings and fixes are rows 18–49 of `MASTER_PLAN_v2.md` §11; new gaps G19–G26.
- High: fake-clock gate order (owner-only table read only after the `session_user` test, no permission error for app roles); settings foundation re-slotted into S2 (`0843`) because S3/S6 need `hourCycle`/`weekStart`/`businessDate`; the D28 seed rule would have demoted `Asia/Muscat` (a tzdb `backward` link since 2022) and failed Omani tenants closed; hour cycle, week start and date format already live on `org_tenants_mst` / `hq_general_config` (`0668`).
- Proposed decisions for the user: D32 canonical zone set (ECMA-402 primary identifiers: `zone.tab` + `zone1970.tab` + `UTC`), D33 reuse the `0668` columns instead of new extra-config keys and a new defaults table, D34 `dateFormat` in the `clock` block, D35 `business_date` on `org_orders_mst` and `org_order_payments_dtl`. They block writing `0842`/`0843`, not S1.
- New slots: `0842` S2, `0843` S2 (settings foundation), `0844` S2 only if a role is not UTC, `0845` S5, `0846` S8, `0847` S9, `0848` S10, `0849`/`0850` S13, `0851` after soak.
- Also added: per-check health design on the setup-health registry contract (`fn_shc_clock_*`, domain `CLOCK`, `BLOCKER/WARNING/INFO`), zone validators replaced in `0842`, `0840`/`0739`/`fn_tenant_general_value` added to the S5 list, `quiet_hours_tz` writers listed for S8, per-migration rollback table (§9.4), type-regeneration list, cross-repo deploy order and `notify` rule, function-to-test matrix (§7.13.1), manual cases T61–T68, i18n keys, verification queries Q12–Q16. Next slice remains S1 (`0.1.42-plan`). HQ half is `0.1.5b-plan`.

## 0.1.41a-plan — 2026-11-26

- Planning amendment after t135u, documentation only: no code or migration changed, nothing applied, no database contacted. New accepted decisions: D27 adds the `notify` operation code (quiet hours and notification scheduling use it, not `delivery`; any area that needs its own zone rule gets its own code; SQL allowed-list change is in `0842`); D28 extends `sys_timezone_cd` so it is the only runtime zone catalog (official IANA tzdb + CLDR names; `pg_timezone_names` is a health sync check only; new columns `iana_name`, `is_canonical`, `link_target`, `std_offset_minutes`, `dst_offset_minutes`, `country_codes`, `tzdb_version`, `cldr_version` — existing `name`/`name2`, `uses_dst`, `display_order`, and `code` are reused); D29 seeds `sys_country_cd` hour-cycle and week-start from official Unicode CLDR `timeData` and `weekData` and records the CLDR version; D30 adds `sys_tenant_config_defaults_cd` (corrected spelling of `sys_defults_tenants_config_cd`) seeded with `HOUR_CYCLE=H23`, `WEEK_START=SAT`, `BUSINESS_DAY_CUTOVER=00:00`, and removes hard-coded fallback constants; D31 adds extra-config category `DATETIME` ("Date & Time" / "التاريخ والوقت") for those three keys.
- Migration slot numbers are unchanged: `0842` now also extends the timezone catalog and adds `notify`; `0846` now also creates the defaults table, the `DATETIME` keys, and the CLDR country seed; `0850` is the later tzdb/CLDR refresh. Next slice remains S1 (`0.1.42-plan`). HQ half is `0.1.5a-plan`.

## 0.1.41-plan — 2026-11-26

- Planning finalized, documentation only: no code or migration changed, nothing applied, no database contacted. Decisions D1–D24 are accepted with amendments: Temporal through the free `temporal-polyfill` confined to one adapter file in `packages/clock` with a removal plan (D1); database role zone as a read-only check and a migration only if a role differs, plus a permanent health check (D4); `business_day_cutover` on `org_branches_mst` with the tenant default and the hour cycle and week start as config keys in `sys_tenant_extra_config_cf`, and country defaults in `sys_country_cd` (D6, D7, D13); display-only viewer-zone toggle with exports that state their zone (D9, D20); quiet hours use the `delivery` zone and `quiet_hours_tz` is no longer read and is dropped later (D15); IANA-only zones validated against `pg_timezone_names` (D16); only the user applies migrations (D17); the API `clock` block `{ zone, businessDate, serverNow, hourCycle, weekStart, tzdbVersion }` (D21). New: D25 own SQL clock `fn_cmx_dt_now()` / `fn_cmx_dt_clock()` with a test-only override that is ignored in production; D26 names `fn_cmx_dt_*` and `dt*` (the deployed `fn_ops_zone` stays).
- Consistency pass: settings no longer assumed to be columns on `org_tenants_mst`; DEFINER readers for the closed config catalog; `notify` operation replaced by `delivery`; fake-clock gating by an owner-only environment table; IANA validation covers abbreviations and `Etc/GMT±N`; migration slots re-set to `0842`–`0851` in slice order; gaps G16–G18 added; master plan §11 lists all 13 findings.
- Removed from `RESUME_CONTINUATION.md` and `work-packages.md` the wording that allowed the agent to apply migrations.
- Slice versions moved by one: S1 is `0.1.42-plan`. Tests T52–T60 reserved. HQ half is `0.1.5-plan`.

## 0.1.40-plan — 2026-11-26

- Plan only, no code or migration change. Added `MASTER_PLAN_v2.md`: five kinds of time (instant, civil date, local time, zoned appointment, duration), the SQL time API on top of `fn_ops_zone` (`fn_ops_today`, `fn_ops_local_time`, `fn_ops_at_local`, `fn_ops_day_bounds`, `fn_ops_local_parts`, `fn_ops_period_key`, `fn_ops_business_date`, …) with an injectable `p_at`, Temporal-style daylight-saving choices, the shared `packages/clock` helpers and test vectors for SQL, TypeScript, Dart, and HQ, the ratchet CI guard, audit gaps G1–G15 with fixes, decisions D1–D24, and slices S0–S14 with provisional migration slots from `0842`. The HQ half is `cleanmatexsaas/docs/features/Time_and_Timezone/MASTER_PLAN_v2_HQ.md`. Manual cases T43–T51 are reserved in the testing guide.

## 0.1.39-plan — 2026-11-26

- Dashboard today, month-to-date, and trailing windows use the organization civil day. A missing zone leaves those windows empty. Order-list delivered-today uses the same day. Manual check is T42.

## 0.1.38-plan — 2026-11-26

- Gift-card month-to-date issued and redeemed totals start at the first civil day of the organization month. A missing zone leaves those two totals at zero. Manual check is T41.

## 0.1.37-plan — 2026-11-26

- Orders, payments, and customer report tables show the organization civil day of each instant. The invoice due date stays the stored civil day. The cash-variance range defaults to that organization day, and a missing zone leaves the range empty. Manual check is T40.

## 0.1.36-plan — 2026-11-26

- Tax exemption valid-from and valid-to accept only `YYYY-MM-DD` and are stored as that civil day. A later end date is required when both dates are set. Manual check is T39.

## 0.1.35-plan — 2026-11-26

- Orders, payments, invoices, revenue, and customer report day buckets use the organization civil day. Invoice overdue and aging compare that civil day with the stored due date. A missing zone refuses the report. Manual check is T38.

## 0.1.34-plan — 2026-11-26

- The orders summary, payments breakdown, and outbox list filter a civil day in the operations zone. The end of that day is the next midnight. Reconciliation stores the typed dates and searches instants inside those shop days. Its run number uses that civil year. Credit-note spend and expiry use the organization civil day, and a missing zone does not expire a note. Tax-exemption and credit-note dates accept only `YYYY-MM-DD`. Manual check is T37.

## 0.1.33-plan — 2026-11-26

- Gift-card list filters use the organization civil day. The end of the chosen day is that zone's next midnight, and a missing zone refuses the filter. The customer export writes the civil day, the UTC instant, and the zone id. The tax report and the price-history filter use that civil day against the stored instant. Price-list dates accept only `YYYY-MM-DD`. A campaign schedule accepts only an instant with an offset. Public booking sample slots use the delivery zone of the branch. Export file names and the legacy voucher date use the organization civil day. An invoice becomes overdue only after the due date in the invoice branch's civil day. A missing zone leaves it open. Log lines in web-admin, the workers, the API, and the mobile app stay UTC. Manual checks are T34 and T35.

## 0.1.32-plan — 2026-11-26

- Every remaining organization naive timestamp is now `timestamptz`. Audit stamps (`created_at`, `updated_at`) and event stamps convert as UTC walls. `s_date`, `handed_to_date`, delivery stop times, and feature-flag effective instants are instants. `sys_otp_codes` stamps convert in the same pass. `sys_*` and `hq_*` catalog stamps stay naive until the HQ reader list. Credit-note expiry uses the organization civil day, and a missing zone does not expire the note. The notification claim returns `scheduled_at` as an instant. Applied on the local and remote databases as `0834` through `0841`. Manual check is T33.

## 0.1.31-plan — 2026-11-26

- An ERP Lite human code takes its month from the document's civil date when the document has one. A code with no document date (cashbox, supplier, bank account, cost component, and an allocation rule with no effective date) takes the month from one database instant in the organization zone. A missing zone refuses the save. Manual check is T32.

## 0.1.30-plan — 2026-11-26

- ERP Lite expense, cash transaction, cash reconciliation, and purchase-order dates default to the organization civil day. The document number month comes from that civil date. A missing zone leaves the day empty. The expected delivery date stays blank until someone chooses it. Manual check is T31.

## 0.1.29-plan — 2026-11-26

- Discount-rule validity is an instant. The form shows and saves it in the organization zone, and the list shows that clock. A tax exemption, an FX rate date, an AR invoice date, and a new voucher date stay civil dates. Their default day is the operations-zone civil day, not the UTC date. A missing zone leaves the day empty. Order, report, processing, and reconciliation date filters already submit the calendar day from the control. Manual check is T30.

## 0.1.28-plan — 2026-11-26

- Promo validity is entered and saved as civil time in the organization zone. A gift-card expiry date defaults to 31 December of that civil year and is stored as the last millisecond of the chosen day, so the card stays valid through that day and the list still shows that day. A missing zone blocks the save. Manual check is T29 in `testing_guide_and_scenarios.md`.

## 0.1.27-plan — 2026-11-26

- Queue, workboard, processing, pickup, and delivery clocks use the row's branch zone. "Due today" is that branch's civil day. Customer, notification, and marketing labels use the organization zone. Discount-rule dates stay civil dates. A missing zone shows no clock. Promo validity entry and the gift-card expiry-year default stay with the picker work. Manual checks are T21–T28 in `testing_guide_and_scenarios.md`.

## 0.1.26-plan — 2026-11-26

- Cash drawers format in the till's branch zone. Refund and reconciliation clocks use that row's branch, then the organization. Gift-card liability uses the organization zone. A tax document fiscal year is the civil year of one database instant in the invoice zone. A missing zone shows no clock and the tax document is refused.

## 0.1.25-plan — 2026-11-26

- `0833` is the Ready By cutover. `ready_by` and `ready_by_override` are dropped. `ready_by_at_new` is renamed to `ready_by_at` (promised Ready By). `ready_at` is `timestamptz` (actual Ready). Readers and writers use those two columns.

## 0.1.24-plan — 2026-11-26

- Removing `platform-workers` is a separate piece of work. This plan does not remove it. H4 still corrects the clocks in the jobs that run there.

## 0.1.23-plan — 2026-11-26

- A package is production-ready only when the database, services, APIs, workers, and screens for that clock change together, in this repo and in HQ when the surface is HQ.

## 0.1.22-plan — 2026-11-26

- `cmx-workers` is in WP17 and WP18. Its schedules stay UTC. HQ screens, APIs, and workers start without the reader list. That list is still required before a `sys_*` or `hq_*` column is converted.

## 0.1.21-plan — 2026-11-26

- WP8 also covers `deleted_at`. The local catalog has 64 of those columns and every one is already `timestamptz`, so the migration leaves them. A naive `deleted_at` converts in the same file as `created_at` and `updated_at`.

## 0.1.20-plan — 2026-11-26

- WP8 is one migration for every tenant `created_at` and `updated_at`. Each converts as a UTC wall. Views, triggers, and functions that block the type change are recreated in that file. `sys_*` and `hq_*` stamps wait for the HQ reader list.

## 0.1.19-plan — 2026-11-26

- Development rows may be rewritten. Instants convert as UTC walls because the database session is UTC. Civil values stay dates or times.
- `0832_lockout_timestamptz.sql` is applied on the local and remote databases. It converts the membership lock columns and makes `record_login_attempt` return a real instant. `attack_locked_until` was already `timestamptz`. Prisma was pulled from the local database afterward.

## 0.1.18-plan — 2026-11-26

- Ready-by hour rounding uses the operations zone when the caller passes one. Preparation completion rounds in the fulfilment branch zone and refuses to calculate when that zone is missing. A missing received time uses one database instant. Callers that omit the zone still round on the machine clock.

## 0.1.17-plan — 2026-11-26

- The ready-date picker stores the selected civil day and time in the fulfilment branch zone. Today, the minimum day, and the preview use that zone. A missing zone cannot be applied. Hour rounding inside the ready-by calculator still uses the machine clock.

## 0.1.16-plan — 2026-11-26

- Reconciliation report windows use the organization civil day. The last-activity date uses that zone. A missing zone does not query with this machine’s date. The ready-date picker and the calculator’s hour rounding still use the machine clock.

## 0.1.15-plan — 2026-11-26

- Orders, payments, invoices, revenue, and customer reports take their default range and day bounds from the organization civil day. A missing zone does not fall back to this machine. Export and print dates use that same zone. The ready-date picker and the calculator’s hour rounding still use the machine clock.

## 0.1.14-plan — 2026-11-26

- The ready-by calculator label stays empty until the caller passes the operations zone. The voucher list uses each voucher’s branch zone when the civil voucher date is empty. Order voucher tabs and the financial report date column use that same zone. The financial report’s default range is the organization civil day. Hour rounding inside the calculator, the ready-date picker, and the other report screens still use the machine zone.

## 0.1.13-plan — 2026-11-26

- Order detail, the full order view, the receipt, and the payments print format received, Ready By, and payment instants with the order branch zone, otherwise the organization zone. A civil date stays the calendar string. A naive timestamp and a missing zone stay empty. The ready-by calculator, the ready-date picker, reports, and vouchers still use the machine zone.

## 0.1.12-plan — 2026-11-25

- The orders list and the customer order history format Ready By and the received instant with the order branch zone, otherwise the organization zone. A missing zone leaves the cell empty. `formatReadyByDate` remains on the ready-by calculator.

## 0.1.11-plan — 2026-11-25

- Applied `0828` and `0829` on the local and remote databases. Outbox and campaign schedule columns are `timestamptz`. The Ready By backfill updated 0 rows. `request.service.ts` reads those columns as instants.
- `0828` drops and recreates `trg_ntf_obx_due_ntf` around the type change. The trigger only notifies.
- Applied `0830_fn_ops_zone.sql` and `0831_doc_seq_and_setup_health_zone.sql` on both databases. Tenant document numbers fail closed when the organization zone is missing. The express setup-health check no longer substitutes UTC.
- `npm run check:clock-contract` guards migrations from `0832` onward and freezes the current `toISOString().slice(0, 10)` files. The first run passed.

## 0.1.10-plan — 2026-11-25

- WP5 writers now persist Ready By on `ready_by_at_new` only: order create, order change, preparation completion, and order split. The edit context and the apply before-snapshot read that twin. `ready_by` stays.
- `0829_ready_by_twin_backfill.sql` fills a null twin from `ready_by` as a UTC wall and does not rewrite a row that already has a twin. Written, not applied. The 2026-11-25 sample had no null twins.

## 0.1.9-plan — 2026-11-25

- WP1 closed. Advance receipts, gift-card sales, and refund tax reversal take the tax day from one database instant and the invoice branch zone.
- WP2 closed. Provenance is in `technical_docs/provenance-class-a.md`. Outbox `scheduled_at` is a UTC wall. Lockout columns and the three divergent Ready By rows are not converted.
- WP4 migration `0828_ntf_schedule_timestamptz.sql` is written and not applied. `request.service.ts` still casts `AT TIME ZONE 'UTC'` and must drop that cast in the deploy that applies `0828`.

## 0.1.8-plan — 2026-11-25

- A checkout quote takes one database instant. The tax lines written from that quote store the same instant, so the tax point and the priced civil day come from one clock.
- Issuing a tax document stores `issued_at` and the finalized tax point from one database instant inside that transaction.

## 0.1.7-plan — 2026-11-25

- A live ready-by calendar preview reads one database instant. Tests still pass the instant they want to simulate.
- An order-created message formats Ready By in the fulfilment branch zone. A missing or invalid zone leaves that label empty. A date-only value stays that calendar day.

## 0.1.6-plan — 2026-11-25

- Ready By display reads use `ready_by_at_new` only. A null twin shows no clock. The receipt, All Orders list and its overdue sort, order detail, workflow lists, workboard, public tracking and booking, labels, the processing modal, and the dashboard overdue and on-time counts follow that rule.
- Order-change writes, the edit form, and order split still persist `ready_by`. That cutover stays in WP5. `ready_by` is not dropped.

## 0.1.5-plan — 2026-11-25

- Started WP1. `resolveOperationalTimeZone` reads the owning branch, then the organization, and returns no zone when neither is an active catalog code. Delivery, invoice, and ledger pass that branch id. They do not have a timezone column of their own.
- Speed rules, service-speed lookup, prepaid tax, tax lines, and the default VAT rate no longer substitute the UTC date. A POS open and the rollover sweep take the civil day from a database instant.
- Ready By display readers were outstanding at this version. 0.1.6-plan switches them.

## 0.1.4-plan — 2026-11-25

- Recorded migration `0826` as applied on the local and remote databases. New-row defaults are US, USD, and UTC. Existing organization rows stay as they were. Prisma was pulled from the local database.

## 0.1.3-plan — 2026-11-25

- Every work package now closes out in `progress_summary.md`, `current_status.md`, and the surface map. A migration stays Written, not applied until the user applies it.
- Closed the plan gaps: one operation-code list, scopes that have no timezone column, the POS business date, the tax-explain UTC fallback, `cmx-api` helpers even when no date route exists, CI across the apps and new SQL, and the HQ sibling plan.
- Recorded the 2026-11-25 session measurement: both databases reported UTC. That measurement does not convert old naive rows. Registration and migration `0826` stay beside the clock program.

## 0.1.2-plan — 2026-11-25

- Recorded one zone policy with two doors: `resolveOperationalTimeZone` in the app and `fn_ops_zone` in SQL. Neither function exists yet.
- UI, reports, print, `cmx-api`, mobile, webhooks, and HQ format that result or the row snapshot. HQ's own documents keep the HQ zone. A tenant row shown in HQ uses the tenant zone.
- Recorded the fast path: resolve once per action, join mixed-list zones in one query, compare a stored date or a bare instant, and limit reuse to the current request.
- Public registration may suggest the browser locale. That suggestion is stored only after the visitor confirms it, and it is not an operations clock.

## 0.1.1-plan — 2026-11-25

- Aligned this pack with the revised time rule.
- The operations zone is the feature's documented scope, then the organization. A client-supplied zone is an echo.
- A typed daylight-saving gap or overlap is rejected unless the form captured a choice. A computed gap advances. A computed overlap uses the earlier offset.
- Legacy conversion is expand-and-contract. A naive column is not read as a UTC wall clock until its provenance sample proves one stored clock.
- Zone labels use the abbreviation and offset of the instant being shown.

## 0.1.0-plan — 2026-11-24

- Added the implementation pack for the time and timezone rule.
- Recorded the Prisma inventory: 977 `timestamptz` columns, 488 naive `timestamp` columns (398 audit, 90 other).
- Extended the program to every surface: SQL functions, document numbers, HTTP routes, webhooks, server actions, date pickers, pages, customer message text, exports, logs, `cmx-api`, mobile apps, and a required HQ reader list.
- Recorded two defects the first plan did not package: `fn_doc_seq_next` falls back to the HQ timezone, and order-notification text formats Ready By with `toLocaleDateString`.
- Required a provenance sample before any `USING col AT TIME ZONE` conversion.
