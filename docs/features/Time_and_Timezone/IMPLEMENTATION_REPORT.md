# Implementation report — Clock and Time Zone Manager

The single running report for the code slices of [`MASTER_PLAN_v2.md`](./MASTER_PLAN_v2.md). Each slice adds a section; earlier sections are not rewritten. Times are Asia/Muscat (UTC+4).

---

## S1 — `packages/clock`, guard v2, Temporal adapter (`0.1.42`, 2026-11-27)

**Result:** done. No migration was written or applied; no database was contacted; nothing was committed or pushed.

### Decisions recorded with this slice
- D32–D35 **ACCEPTED** 2026-11-27 (t137u, "yes approve all your recommendations"). D30/D31 **SUPERSEDED by D33** (no `sys_tenant_config_defaults_cd`, no `DATETIME` keys). Updated in `MASTER_PLAN_v2.md`, `MASTER_PLAN_v2_HQ.md`, and the sibling documents listed below.

### What was built
| Area | Files |
|---|---|
| Package `@cmx/clock` 0.1.42 | `packages/clock/` — `package.json`, `README.md`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.cjs`, `scripts/build.mjs`, `scripts/test-tz-matrix.mjs` |
| Temporal adapter (D1) | `packages/clock/src/temporal.ts` — the only import of `temporal-polyfill`; native `globalThis.Temporal` wins when present |
| API | `src/types.ts`, `errors.ts` (12 codes, HTTP status, `clock.errors.*` keys), `clock.ts` (`Clock`, `systemClock`, `fixedClock`, `offsetClock`, `actionClock`, `dtNow`, `dtClock`), `operations.ts` (closed list incl. `notify`; `SQL_DOOR_OPERATIONS`, `assertSqlDoorOperation`), `zones.ts` (D32 canonical ids, `createZoneCatalog`), `parse.ts`, `convert.ts` (`dtAtLocal` with `compatible`/`earlier`/`later`/`reject`, `dtInstantAtZone`, `dtToLocal`, `dtLocalParts`, `dtDayBounds`), `civil.ts` (`dtToday`, `dtTodayOrNull`, `dtTodayIn`, `dtLocalNow`, `dtLocalTime`, `dtCivilAdd`, `dtPeriodKey`), `business-day.ts` (`dtBusinessDate`, `dtBusinessDayBounds`), `settings.ts` (D33 resolvers), `resolve-zone.ts`, `clock-block.ts`, `intl-options.ts`, `format.ts`, `zod.ts` (`@cmx/clock/zod`), `index.ts` |
| Shared vectors | `packages/clock/vectors/time-vectors.v1.json` — 172 cases, 15 kinds (today, localParts, toLocal, atLocal 11 scenarios × 4 modes, dayBounds, periodKey, businessDate, businessDayBounds, civilAdd, zoneValid, catalog, settings, clockBlock, parseInstant, zoneResolution). Expected values from Python `zoneinfo` (tzdata 2026f), not from the code under test |
| Package tests | `packages/clock/__tests__/` — `run-vectors.ts`, `vectors.test.ts` (polyfill + native path), `tz-matrix.test.ts`, `clock.test.ts`, `api.test.ts` |
| web-admin | `lib/utils/clock.ts` (entry), `lib/utils/operational-time.ts` (operation list re-exported from `@cmx/clock`), `messages/en/clock.json`, `messages/ar/clock.json`, `eslint.config.mjs` (ban `temporal-polyfill`, `@js-temporal/*`), `package.json` (`@cmx/clock`, `test:clock-tz`), `__tests__/lib/clock/clock-package.test.ts`, `__tests__/utils/ready-by-calculator.test.ts` (restored, G5) |
| cmx-api | `package.json` (`@cmx/clock`), `src/common/clock/clock.ts`, `src/common/clock/clock.spec.ts` |
| Guard v2 (G4) | `scripts/check-clock-contract.mjs` (replaced), `scripts/clock-contract-baseline.json` (new); HQ copy `cleanmatexsaas/scripts/check-clock-contract.mjs` + its baseline |
| Root / CI | `package.json` (`build:clock`, `test:clock`), `.github/workflows/ci.yml` (paths `packages/clock/**`, guard files, migrations; steps "Clock contract guard" and "Clock tests under two process time zones") |
| Contract | `docs/dev/rules/time-and-timezone.md`, `.cursor/rules/time-and-timezone.mdc` (clock API, new-SQL banned list, D1, D5/D25, D8 grants, D9, D17, R4) |

### Dependencies and lockfile
- New runtime dependency: `temporal-polyfill` **1.0.8** (MIT) in `@cmx/clock` only (brings `temporal-utils` 1.0.4; `temporal-spec` 1.0.1 was already present).
- `package-lock.json`: **+41 lines, nothing removed** — `node_modules/@cmx/clock` link, `packages/clock` entry, `temporal-polyfill`, `temporal-utils`, and `"@cmx/clock": "*"` in `web-admin` and `cmx-api`.
- `npm install` also brought `node_modules/@upstash/*` in line with the existing lockfile (they were in the lock but not installed). No version in the lock changed.
- `@cmx/clock` is built at install time by its `prepare` script (`npm install` / `npm ci`), so CI and fresh clones need no extra step. Manual rebuild: `npm run build:clock`.

### Results (Windows, Node 24.15.0, npm 12.2.2)
| Check | Result |
|---|---|
| `npm run typecheck -w @cmx/clock` | pass |
| `npm test -w @cmx/clock` (TZ=UTC, then TZ=Pacific/Kiritimati) | **369/369 pass** in each zone |
| `npm run test:clock-tz -w web-admin` (clock package test, Ready By test, calendar ready-by test) | **33/33 pass** in each zone |
| `cmx-api`: `jest src/common/clock` | 3/3 pass |
| `cmx-api`: ESLint on the new files | pass (prettier fixed in the new spec only) |
| web-admin `tsc --noEmit` (full) | pass (adding `notify` to the union breaks nothing) |
| web-admin ESLint on touched files | 0 errors; 48 pre-existing `jsdoc/require-param` warnings in `operational-time.ts` functions not changed here |
| web-admin i18n parity | pass |
| `npm run check:clock-contract` (tenant) | **exit 0** with the baseline |
| `node scripts/check-clock-contract.mjs` (HQ) | **exit 0** with the baseline |

**Baseline, tenant (per rule: files / hits):** `ts.instant-getters` 25/103, `ts.iso-slice-date` 34/48, `ts.date-only-literal` 16/45, `ts.tolocale-no-zone` 27/40, `ts.intl-dtf-no-zone` 21/23, `ts.iso-split-date` 4/8, `ts.muscat-literal` 5/5, `ts.resolved-options-zone` 1/1, `dart.datetime-now` 4/5, `dart.to-local` 2/2. Total 280 (web-admin 273, cmx_mobile_apps 7; cmx-api, cmx-workers, packages 0). No hard-rule failures (`0832` allowlisted).

**Baseline, HQ:** `ts.tolocale-no-zone` 22/47, `ts.instant-getters` 13/38, `ts.iso-split-date` 11/29, `ts.iso-slice-date` 20/23, `ts.intl-dtf-no-zone` 19/20, `ts.muscat-literal` 15/18, `ts.date-only-literal` 2/5. Total 180.

### Pre-existing failures (not caused by S1; reported, not fixed)
- `cmx-api` `nest build`: 14 TypeScript errors in `src/common/interceptors/*.ts` — two copies of `rxjs` (`cmx-api/node_modules/rxjs` from 2026-11-23 and the root one) plus `Request` typing. None in the new clock files.
- web-admin full Jest: 29 suites / 30 tests fail of 628 / 5660. Causes seen: `next-intl` ESM not transformed (`SyntaxError: Unexpected token 'export'`), Prisma browser client in jsdom (`sqltag is unable to run in this browser environment`, reached through the existing `operational-zone.server.ts`), auth-guard inventory tests, CSS token tests. None of them imports `@cmx/clock` or the changed lines; `operational-time.test.ts` passes.
- Full `next build` was not run (long; needs Prisma generate). The web-admin import of `@cmx/clock` resolves to the per-module ESM build, so client bundles only get the polyfill when they import a function that uses Temporal.

### Deviations from the plan
1. **Native Temporal is simulated.** Node 24 has no `Temporal`, so the "native adapter" run puts the polyfill's `Temporal` on `globalThis` and exercises the adapter's native branch. A real-native run is added when a runtime ships Temporal.
2. **Built package, not TS source.** `temporal-polyfill` is ESM-only, so `@cmx/clock` ships `dist/` (ESM per module + a CommonJS bundle + `.d.ts`), built by `prepare`. `transpilePackages` is not needed.
3. **`FY` period key convention chosen in S1:** `FY` + the calendar year in which the fiscal year starts (start month 4: 2027-02-10 → `FY2026`). **Needs the user's confirmation**; S2 SQL must match, and existing doc-seq FY keys must be compared before doc-seq uses `fn_cmx_dt_period_key`.
4. `dtToday(clock, zone)` / `dtLocalNow(clock, zone)` take an already-resolved zone; the tenant/operation/scope form is the SQL function and the web-admin server door.
5. The old `operational-time.ts` helpers that share a name with package functions but not their signature (`parseInstant`, `formatInstant`, `formatCivilDate`) are not merged; callers move in S3–S7. No caller changed behaviour.
6. The restored Ready By test re-adds `web-admin/__tests__/utils/ready-by-calculator.test.ts`, which was deleted in the working tree; it now tests `resolveReadyBy` (the old `calculateReadyBy` is retired) and `readyByBlockReason` with an injected clock.
7. HQ: the guard and baseline were added, but HQ `package.json` and CI were not edited (H6 continues).

### For the user
1. Review and commit (nothing was committed). New untracked paths: `packages/clock/`, `scripts/clock-contract-baseline.json`, `web-admin/lib/utils/clock.ts`, `web-admin/messages/{en,ar}/clock.json`, `web-admin/__tests__/lib/clock/`, `cmx-api/src/common/clock/`, and in HQ `scripts/check-clock-contract.mjs`, `scripts/clock-contract-baseline.json`.
2. On another machine: `npm install` (builds `@cmx/clock` through `prepare`); if `dist` is missing, `npm run build:clock`.
3. Confirm the `FY` key convention (deviation 3).
4. Optional: fix the pre-existing `rxjs` duplicate in `cmx-api` so `nest build` and the CI cmx-api job go green.

### Readiness for S2 (`0842`, `0843`)
Ready. The vectors that S2's pgTAP must reproduce exist (`packages/clock/vectors/time-vectors.v1.json`); D32–D35 are accepted; the guard already enforces the new-SQL bans from `0842`, the `REVOKE … anon` rule for `fn_cmx_dt_*`, and the fake-time write ban. `notify` must be added to `fn_ops_zone` and to `SQL_DOOR_OPERATIONS` in the same change. S2 writes migration files only; the user applies them.

### Documents updated for S1
`MASTER_PLAN_v2.md` (header, §8 S1 row Done, dependencies, §11 S1 notes), `current_status.md`, `progress_summary.md`, `RESUME_CONTINUATION.md`, `CHANGELOG.md`, `version.txt` (`0.1.42`), `technical_docs/work-packages.md` (WP1/WP9 status), `testing_guide_and_scenarios.md` (T60 automated; T52/T53 on D33), `README.md`, `development_plan.md`; HQ pack: `MASTER_PLAN_v2_HQ.md`, `progress_summary.md` (H6 in progress), `CHANGELOG.md`, `version.txt` (`0.1.5c`), `README.md`, `development_plan.md`; contract: `docs/dev/rules/time-and-timezone.md`, `.cursor/rules/time-and-timezone.mdc`.

---

## S2 — SQL clock API, zone catalog, settings foundation (`0.1.43`, 2026-11-27)

**Result:** migration files written, **not applied** (D17). No database of the user was contacted; Prisma was not run; nothing was committed or pushed. The files were run on a throw-away Postgres 17.12 (tzdata 2026f) installed on the agent's own machine, with stubs of the tables they touch (`0055`, `0668`, `0675`, `0709`, `0738`, `0830` as written in the repo; `org_*` subsets). That scratch database is not the user's database.

### Decisions recorded with this slice
- `FY` period key = `FY` + the calendar year in which the fiscal year starts (user, t139u). The doc-seq engine already does the same (`0670` `fn_doc_seq_period_key`, `FISCAL_YEAR`: `'FY' || (year - (month < start ? 1 : 0))`), so no alignment is needed; `clock_sql_api.test.sql` 5n compares both when `0670` is present.

### Files
| File | What |
|---|---|
| `supabase/migrations/0842_cmx_dt_clock_api.sql` (new, 2 199 lines) | 43 new functions, 3 replaced (`fn_ops_zone` + `notify`, `fn_tenant_tz_validate`, `fn_hq_gen_cfg_validate`). Clock `fn_cmx_dt_now` / `_clock` (inlinable SQL fast path) + gate `fn_cmx_dt__fake_instant/_now/_clock`; `cmx_dt_env_cf` (one row `prod`, RLS on, no grants). `sys_timezone_cd` + `iana_name`, `is_canonical`, `link_target`, `std/dst_offset_minutes`, `country_codes`, `tzdb_version`, `cldr_version`, FK, CHECK, index; seed of 536 rows (419 canonical: `zone.tab` ∪ `zone1970.tab` ∪ `UTC`; 117 aliases: `backward` links not in `zone.tab` + 17 UTC-family names). CLDR 49 EN/AR names (e.g. "Gulf Standard Time (Muscat)" / "توقيت الخليج (مسقط)"). §5.1 functions without new settings. Validators + new `trg_branches_tz_validate`; `trg_sys_timezone_cd_integrity`. Health: `fn_cmx_dt_health`, 6 `fn_cmx_dt_chk_*`, 6 `fn_shc_clock_*`, domain `CLOCK` (80), 6 registry rows. Verification block; ROLLBACK BODY A–C |
| `supabase/migrations/0843_cmx_dt_settings.sql` (new, 1 144 lines) | 25 new functions, 1 replaced (`fn_cmx_dt_period_key` + `WEEK`). Cut-over columns; CLDR 49 country defaults (249 territories in the seed; only existing `sys_country_cd` rows are updated); resolvers, readers, business date, 5 checks + registry rows; verification; ROLLBACK BODY A |
| `supabase/tests/clock_sql_api.test.sql` (new) | 7 sections: test-clock gate, catalog, zone validators + resolution, civil/instant functions, settings + business date + period keys, grants/isolation, setup health |
| `supabase/tests/clock_vectors.test.sql` (new, generated) | 159 of the 172 shared vectors run against the SQL functions |
| `scripts/gen-clock-vectors-sql.mjs` (new) | Generator for the file above; `--check` fails when it is stale |
| `scripts/check-clock-contract.mjs` (changed) | Exemption regex for `fn_cmx_dt__fake_*` fixed (the S1 pattern expected three underscores, so the time-source bodies were not exempt and the grant rule asked for an anon REVOKE that would break `fn_cmx_dt_now` for anon) |
| `packages/clock/src/operations.ts`, `__tests__/api.test.ts`, `README.md`; `web-admin/__tests__/lib/clock/clock-package.test.ts` (changed) | `SQL_DOOR_OPERATIONS` includes `notify` (same change as `0842`); tests and README follow |
| `technical_docs/s2-seed/gen_seed.py`, `summary.json` (new, docs pack) | The seed script (official tzdb 2026f + CLDR 49 files → SQL values) and its summary, so a later refresh (`0850`) can reproduce the values |

### Apply order (the user)
1. Before: run §10 Q1, Q3, Q4, Q7, Q8, Q15 (read-only) and keep the output. Q15 must list no stored tenant/branch/HQ zone that the seed makes an alias (else `0842` stops with `CLOCK_CATALOG_DEMOTION_BLOCKED` and lists them).
2. Apply `0842_cmx_dt_clock_api.sql`, then `0843_cmx_dt_settings.sql`, in one low-traffic window. Each is one transaction and ends with a verification block that rolls the whole file back on failure.
3. After: Q4, Q6, Q8, Q10, Q11, Q15 again; then `psql … -f supabase/tests/clock_sql_api.test.sql` and `-f supabase/tests/clock_vectors.test.sql` on the **local** database (both roll back).
4. `npm run prisma:pull` (root), regenerate `web-admin/types/database.ts`, and the HQ types (`platform-api/src/database/database.types.ts`, `platform-web/lib/types/database.ts`).
5. Deploy the `@cmx/clock` change (`notify` in `SQL_DOOR_OPERATIONS`) only with or after `0842` on that database.
6. `0844`: only if Q1 shows a non-UTC role or database setting. Send the Q1 output; the agent then writes `0844` (`ALTER ROLE … SET timezone = 'UTC'`).

### Results (scratch Postgres 17.12, tzdata 2026f; box)
| Check | Result |
|---|---|
| `0842` then `0843` on the stub schema with 3 tenants, 3 branches | applied; verification blocks pass (`0842`: 419 canonical, 117 aliases; `0843`: 15 country rows with CLDR defaults) |
| `clock_sql_api.test.sql` | **7/7 sections PASS** |
| `clock_vectors.test.sql` | **159/159 PASS**; a mutated expected value is reported as FAIL with the case id |
| Rollback | ROLLBACK BODY blocks apply cleanly; the full §9.4 sequence (0843 then 0842) leaves no `fn_cmx_dt_*` and `fn_ops_zone` works again |
| Guard `node scripts/check-clock-contract.mjs` with both files | exit 0 |
| `npm test -w @cmx/clock` (TZ=UTC, TZ=Pacific/Kiritimati) | 369/369 each; `tsc --noEmit` pass |
| Benchmark (1 000 000 rows) | `fn_cmx_dt_now()` ≈ `now()` (120–175 ms vs 123–131 ms; inlined). `fn_cmx_dt_today_in` per row 0.7 µs vs 0.3 µs raw; `fn_cmx_dt_today(tenant, …)` per row ≈ 20 µs (zone lookup) — resolve once per query (§5.2) |

### Deviations from the plan
1. **Tests are plain SQL**, not pgTAP (pgTAP is not installed; the repo's `supabase/tests` use `BEGIN … ROLLBACK` scripts). The plan's six test names are sections of `clock_sql_api.test.sql` (mapping in its header).
2. **Extra helpers:** `fn_cmx_dt_day_bounds_in`, `fn_cmx_dt_period_key_in`, `fn_cmx_dt_business_date_in`, `fn_cmx_dt_business_day_bounds_in` (explicit zone, used by the vectors and HQ), `fn_cmx_dt_operations()` (closed list in one place), `fn_cmx_dt_settings(p_tenant, p_branch)` (all four settings with their source in one call, for S3/S6), internal `fn_cmx_dt__accept_zone`, `__guard_scope`, `__guard_tenant_read`, `__shc`, `__resolve_*`, `__check_cutover`, `__fake_instant`, and `fn_branch_tz_validate` + trigger (branch zones had no validator).
3. `fn_cmx_dt_hq_zone()` is SECURITY DEFINER (`hq_general_config` is service-only). The single readers `_hour_cycle` / `_week_start` / `_cutover` / `_date_format` are INVOKER wrappers over the DEFINER `fn_cmx_dt_settings`.
4. The test-clock gate checks `current_user` as well as `session_user`, so `SET ROLE authenticated` in a superuser session is not faked (T66 as written).
5. `fn_cmx_dt_now`, `fn_cmx_dt_clock`, `fn_cmx_dt_to_local` are `LANGUAGE sql` without `SET search_path` so they inline (only `pg_catalog` objects inside). Every plpgsql function pins `search_path`. `fn_cmx_dt_to_local` stays STABLE (§11 row 47).
6. Catalog: new canonical zones unknown to the server's Postgres are inserted **inactive** (none on 17.12/2026f). Alias set includes the 17 UTC-family names (D32 lists 9; the TS `UTC_ZONE_ALIASES` has the same 17). Offsets follow IANA `isdst` (Europe/Dublin and Africa/Casablanca store the summer offset as "standard").
7. CLDR territories without their own `timeData`/`weekData` entry inherit the world value `001` (H23, Monday); `clock_defaults_source` records `[001]`.
8. Setup-health: `info` findings (two of the `CLOCK_CUTOVER_INCONSISTENT` cases) are listed but never make a check FAIL.
9. `0844` not written (needs Q1 from the user's database).

### Open questions for the user (with recommendation)
1. **CLDR 49 differs from the T65 examples in the plan.** CLDR says: `OM` 12-hour, week starts Saturday; `SA` 12-hour, Sunday; `AE` 12-hour, **Monday**; `US` 12-hour, Sunday; `DE` 24-hour, Monday; `MV` 24-hour, Friday; `KW`/`EG` 12-hour, Saturday; `IN` 12-hour, Sunday; `GB` 24-hour, Monday. Effect after S3: an Omani organization whose `time_format` is NULL shows 12-hour times instead of the HQ value. *Recommendation:* keep the official CLDR values (D29: "not from memory"); HQ can edit a country row, and an organization that wants 24-hour sets `time_format = '24h'`. T65 is rewritten to the CLDR values.
2. **`0844`:** send the output of §10 Q1 (and Q7). *Recommendation:* if every role and the database show no `timezone` setting or `UTC`, `0844` is not needed and the slot stays unused.
3. **Dublin/Casablanca offsets** (negative DST): *recommendation:* keep the IANA convention (`std_offset_minutes` = the tzdb "standard" offset); display uses live offsets anyway (G14).
4. **Test style:** *recommendation:* keep plain SQL scripts (no new extension); revisit if pgTAP is added to the repo.

### Readiness for S3 (`ClockProvider`, `0.1.44`)
Ready once the user has applied `0842` and `0843` and regenerated types: S3 reads `fn_cmx_dt_settings` (hour cycle, ISO week start, cut-over, date format with sources), `fn_cmx_dt_zone*`, `fn_cmx_dt_business_date`, and the catalog columns (`is_canonical`, `link_target`, `iana_name`) for the picker snapshot. Before apply, S3 code can be written but not run against the database.

### Documents updated for S2
`MASTER_PLAN_v2.md` (header, §8 S2 row, dependencies, §11 S2 notes), `current_status.md`, `progress_summary.md`, `RESUME_CONTINUATION.md`, `CHANGELOG.md`, `version.txt` (`0.1.43`), `technical_docs/work-packages.md`, `testing_guide_and_scenarios.md` (T52–T54, T59, T61–T66), `README.md`, `development_plan.md`, this report. HQ pack not changed (S2 touches no HQ code; HQ type regeneration is step 4 above).
