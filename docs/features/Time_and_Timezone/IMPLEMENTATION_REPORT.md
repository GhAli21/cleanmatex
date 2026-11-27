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

### S2 follow-up (`0.1.43.1`, 2026-11-27)

- **Applied by the user** to local and remote; types and Prisma regenerated; committed. Vectors 159 PASS.
- **Problem:** `clock_sql_api.test.sql` section 6 raised `CLOCK_TENANT_MISMATCH` (42501) at check 6i. **Cause:** test bug. The test set a JWT `tenant_org_id` claim with a made-up user; the live `current_tenant_id()` (0734/0748) ignores tenant claims and reads the ACTIVE session row, so it returned NULL and the guard correctly refused. **Fix:** section 6 now inserts a session row (`sys_auth_user_sessions_mst`, rolled back) for an unlocked member of tenant A and sets `sub` + `session_id`; asserts `current_tenant_id()` = A first; skips 6i with `NOTE 6` if no such member. The scratch stub now copies the real helper. Scratch: PASS 1–7. No migration change.
- **Expected output:** the four `CMX_FAKE_NOW_IGNORED` warnings (section 1 checks that app roles ignore the override) and `NOTE 2` for America/Coyhaique are expected and not failures.
- **§10 verdict:** Q1/Q7 no role/database zone setting → `0844` not needed (slot stays free; next migration is the next free number). Q6 wrapper = door. Q8 none. Q10 only `CLOCK_CATALOG_UNKNOWN`. Q11 `prod`. Q5: 22 legacy functions use banned clock calls (S4/S14 backlog). Q3, Q13, Q15 results were not recorded; Q10 shows no `CLOCK_ZONE_MISSING`/`CLOCK_ZONE_INVALID`, so Q3/Q15 are clean.
- **America/Coyhaique** (new in IANA 2025b; the Supabase Postgres tzdata is older): **recommendation:** a small forward migration that sets `is_active = false` for active catalog codes missing from `pg_timezone_names` and not stored by any tenant, branch or HQ row, and re-activates them when the server knows them; until then the picker must not offer a zone the database cannot compute. Not written yet; waits for approval.

### S2 follow-up 2 (`0.1.43.2`, 2026-11-27)

- **Problem:** with the real session row, section 6 failed with `permission denied for table sys_timezone_cd` (42501) in `fn_ops_zone`, called by `fn_cmx_dt_zone` as `authenticated`.
- **Cause:** `0745` (S0 lockdown) removed every `sys_*`/`hq_*` privilege from `anon`/`authenticated` and forced RLS without a policy. `fn_ops_zone` (0830) and the 0842 readers `fn_cmx_dt_is_valid_zone`, `fn_cmx_dt_canonical_zone`, `fn_cmx_dt__accept_zone` were `SECURITY INVOKER`, so any signed-in call failed, including the zone triggers on `org_tenants_mst`/`org_branches_mst` for a user-JWT write. My scratch DB did not have the `0745` grants, so the box run missed it. `fn_ops_zone` had this gap since `0830`.
- **Fix choice:** `SECURITY DEFINER` on the four readers, not `GRANT SELECT` to `authenticated`. Reason: `0745` is a deliberate rule (catalogs read only through server code or vetted functions); a definer that returns one zone name or a boolean exposes less than table access; the tenant guard in `fn_ops_zone` still applies; anon still has no execute.
- **File:** `supabase/migrations/0844_cmx_dt_catalog_reader_definer.sql` (precheck 0842 + owner bypasses RLS; `ALTER FUNCTION … SECURITY DEFINER`, owner `postgres`; grants restated; verification block; rollback notes).
- **Other readers checked:** `fn_cmx_dt_settings`/`_cutover`/`_hour_cycle`/`_week_start`/`_date_format`, `fn_cmx_dt_hq_zone`, every `fn_cmx_dt_chk_*` and `fn_shc_clock_*` are already DEFINER (`sys_country_cd`, `hq_general_config`, `org_*`); `fn_cmx_dt__fake_instant` reads `cmx_dt_env_cf` only after the superuser gate; `fn_cmx_dt__catalog_integrity` fires only on catalog writes (service role). No further gap.
- **Test:** 6j checks the catalog readers as `authenticated`. Scratch now mirrors `0745` and org RLS: without `0844` the exact 42501 appears; with it PASS 1–7, vectors 159 PASS, guard exit 0.
- **Not changed, to check:** `Q14` shows anon write grants on 438 tables; an anon insert or update on `org_tenants_mst`/`org_branches_mst` that sets a zone would now fail in the trigger (anon cannot execute `fn_cmx_dt__accept_zone`). Confirm no anon flow writes those tables (signup should run as service role).
- **Slots:** `0844` now holds this fix; nothing else moves. America/Coyhaique: recommended inside `0845` (S5) to avoid renumbering.

## S3 — display components, G1 order screens (`0.1.44`, 2026-11-27)

S2 closed first: the user applied `0842`, `0843`, `0844` (local and remote); `clock_sql_api.test.sql` PASS 1–7, vectors 159. S3 has no migration.

- **Components (`web-admin/src/ui/clock`):** `ClockProvider` (block or zone + hourCycle; numbering `latn`), `useClock`, `useInstantFormatter`, `CmxInstant` (`<time dateTime=ISO title=zone><bdi>`), `CmxCivilDate` (tenant `dateFormat`), `CmxLocalTime`, `CmxZoneBadge` (`clock.zone.timesShownIn`). No zone → fallback `—`; the device zone is never used.
- **Server block:** `web-admin/lib/clock/clock-block.server.ts` (`server-only`): one query over `fn_cmx_dt_zone` + `fn_cmx_dt_settings` → `buildClockBlock`; `getPublicClockBlock` strips it to zone, serverNow, hourCycle, dateFormat.
- **G1:** `order-summary-panel.tsx` Ready By date/time via `CmxInstant` in `readyByZone` (from `useReadyByZone` → `getReadyByZone`, wired in `new-order-content.tsx`); `public-order-tracking.service.ts` returns `clock` (`ready_by`, order branch; errors logged, null); `order-tracking-page.tsx` paints received, ready-by and timeline in that zone; both order detail pages wrap in `ClockProvider zone={opsZone}`; invoices, receipts, stock, payments tabs, `order-payments-credits-tables.tsx`, edit-history row time use it.
- **Anon writers (grep):** `tenants.service.ts` `registerTenant` (public `POST /api/v1/tenants/register`) inserted `org_tenants_mst` with `timezone` and the subscription via the anon cookie client; after `0842` the zone trigger (anon cannot execute `fn_cmx_dt__accept_zone`) breaks sign-up. Fixed: tenant/subscription writes and rollback use `createAdminSupabaseClient()`; `auth.signUp` stays on the session client. Other zone writers are server Prisma (branches, business calendar, tax config), authenticated (`updateTenant`, settings profile) or already admin (public booking).
- **Tests (web-admin Jest, each under `TZ=America/Los_Angeles` and `TZ=Asia/Kathmandu`):** `__tests__/lib/clock/clock-ui.test.tsx`, `clock-block.server.test.ts`, `features/orders/order-summary-panel.ergonomics.test.tsx` (+2 G1 cases; also mocks the server action pulled in by `@ui/forms`, a failure that predates S3), `services/tenants.service.register.test.ts`, `services/public-order-tracking.service.test.ts`, `api/public-customer-order-detail.test.ts`: all green. `tsc --noEmit` clean; eslint 0 errors (JSDoc warnings only).
- **Guard:** `order-summary-panel.tsx` −4 (`ts.instant-getters` 3, `ts.tolocale-no-zone` 1); baseline lowered with `--update-baseline`. Bare `toLocaleString()` is not a guard pattern, so the tab fixes do not show in the counts.
- **Moved to S4:** `tax-document-lifecycle-timeline.tsx`, `order-timeline.tsx`, `order-status-lifecycle-tab`, `orders-change-history`, `orders-preferences`, print `*-rprt` files, `order-workspace-screen`, `order-fin-statement`, `use-cash-drawer`, `issue-table-types`, `ready-date-picker-modal` getters, `formatVal` in the edit-history tab. G2 (settings/general zone) stays in S4 per the plan.
- **User steps:** review and commit; run T43; no database step.

## S4 — today cluster, zone picker, viewer-zone toggle (`0.1.45`, 2026-11-27)

No migration. Slots S5–S15 moved +1 first (user, t145u): the user's `0845_fix_get_user_tenants_last_login_timestamptz.sql` holds `0845`, so S5 = `0846` (with America/Coyhaique), S8 `0847`, S9 `0848`, S10 `0849`, S13 `0850`/`0851`, S15 `0852`.

- **New (`web-admin`):** `src/ui/clock/use-device-zone.ts` (`useSyncExternalStore`, server snapshot null; the only device-zone read, display only), `view-zone.tsx` (`ViewZoneProvider`, `useViewZone`, `CmxViewZoneToggle`), `cmx-zone-notice.tsx`, `cmx-time-zone-select.tsx`; `lib/services/timezone-catalog.service.ts` (`listActiveTimeZones`, `canonicalActiveZone`); `app/api/v1/public/timezones/route.ts`.
- **`ClockProvider`:** nested providers inherit hourCycle, weekStart, dateFormat, numbering and serverNow (businessDate only for the same zone); `useClockCivilToday()`, `useDateValueFormatter()` (civil `YYYY-MM-DD` stays that day).
- **G2:** settings general route and tenant register route validate with `canonicalActiveZone` → 400 `INVALID_TIME_ZONE`; the canonical name is stored; the six-zone lists are removed; both pages use `CmxTimeZoneSelect` (settings default `''`, not `UTC`).
- **G7:** user preferences no longer show a zone; strings removed (EN/AR).
- **G8:** `getTenantClockBlock` (cached) feeds a root `ClockProvider` in `app/layout.tsx`; orders page shows `CmxZoneNotice`. Limitation: next-intl still receives `undefined` when no zone, so a screen that formats through next-intl instead of `@ui/clock` can fall back to the runtime zone; `@ui/clock` components show `—`. Remaining next-intl formatters are tracked by the guard (S14).
- **G12:** dunning, FX import and resolver, product-import express rules use `operationalCivilToday` and fail closed; usage tracking is explicit UTC; tax dialogs and review use the clock day.
- **D20:** orders list only (Ready By). The second list moves to S7.
- **S3 leftovers:** done (timeline, lifecycle tab, change history, preferences, prints, workspace, fin statement, cash drawer, issue tables, edit history, ready-date picker, public tracking provider).
- **Kept:** `GET /api/v1/lookups/timezones` unchanged (the branch business-day card reads `utc_offset_string`; recommend moving that card to `CmxTimeZoneSelect` in S9).
- **Tests (each under `TZ=America/Los_Angeles` and `TZ=Asia/Kathmandu`):** new `clock-ui-s4.test.tsx`, `timezone-catalog.service.test.ts`; updated dunning, FX import, FX resolver (+3), catalog import express, orders-simple-table mocks. All pass except one pre-existing orders-simple-table case ("has no page-size selector": the table now has a rows-per-page selector; not clock work, left as is). `tsc` exit 0; eslint on touched files 0 errors.
- **Guard:** 276 → 226 (−50); baseline lowered. Bare `toLocaleString()` not added: it is also number formatting and needs a seed mode → S14.
- **User steps:** review and commit; run T44 and T56; no database step.
- **Readiness for S5 (`0846`):** ready; file only, the user applies.

## S5 — `CURRENT_DATE` replacement, G21, G22 (`0.1.46`, 2026-11-27)

File only; the user applies. Latest migration was `0845` before writing and at the end.

- **`supabase/migrations/0846_cmx_dt_replace_current_date.sql`:** reads 27 live definitions (25 functions, 2 views), checks each of 36 rules matches the expected number of times, stops before any change on drift, rewrites and re-executes (owner, grants, `SECURITY`, volatility, `search_path` kept). Then: G21, G22, comments, speed default dropped, unknown-zone deactivation, verification block (attributes and ACLs unchanged, no banned calls, health checks run for every active tenant, views selectable), live scan WARNINGs for anything left. Needs PG 15+.
- **Objects:** `get_order_number_prefix` (UTC, no caller), `sys_bill_generate_invoice_number`, `sys_bill_update_invoice_amount_due` (HQ zone), `seed_tenant_erp_lite_defaults`, `resolve_fin_tpl_for_tnt`, `apply_fin_tpl_for_tnt` (ledger, strict), `fn_expire_credit_notes` (ledger or null), `generate_cash_drawer_sess_no`, `generate_cash_drawer_trx_no` (`period_key` `pos_session` DAY), `seed_product_speed_rules` (strict), `fn_shc_speed_no_rules`, `fn_shc_cal_holidays_estimated`, `fn_shc_cal_holidays_missing`, `fn_shc_tax_doc_type_no_rule`, `fn_shc_tax_exemption_expired`, `fn_shc_tax_kit_update_pending` (COALESCE / or null), `fn_tax_kit_apply`, `fn_tax_kit_update` (invoice, strict), `fn_tax_kit_update_all`, `fn_tax_kit_version_publish`, `fn_tax_kit_version_clone` (HQ zone), `get_product_price` (`p_effective_date DEFAULT NULL`, strict when null), `vw_fin_missing_required_usage`, `vw_fin_coa_explorer` (per-row tenant, COALESCE), `fn_fin_credit_note_expire_one`, `fn_fin_credit_note_expiry_run` (G22), `fn_tenant_general_value` (G21).
- **Other files:** `supabase/tests/clock_s5_current_date.test.sql` (postgres, one transaction, rolled back; fake clock 2026-03-01T11:00Z, tenant on Pacific/Kiritimati = 2026-03-02); `technical_docs/s5/0846_preimage.sql` (prints the current definitions for an exact rollback). TS: `speed-rules.service.ts` (`prismaDateToCivil`), `finance-expiry-jobs.service.ts` (`dtTodayIn('UTC', at)`), `stored-value.service.ts` (doc), `stored-value.service.test.ts` (`operationalCivilToday` mocked: fixes 3 failures that predated S5; `ZONE_MISSING`; missing-zone case).
- **Results (scratch PG 17, Supabase roles, 0745 grants, RLS):** 0846 applies; a second run and an injected drift both stop with nothing changed; S5 test PASS 1–7 (also `PGTZ=Asia/Kathmandu`); regression `clock_sql_api.test.sql` PASS 1–7, vectors 159; preimage restores the old bodies. Jest 68/68 under `TZ=America/Los_Angeles` and `TZ=Asia/Kathmandu`; `tsc` 0; eslint 0 errors.
- **Guard:** 226 → 224 (−2); baseline lowered. `0846` passes the SQL bans.
- **Risks:** strict functions now raise `TIMEZONE_NOT_CONFIGURED` for a tenant without a zone (seeds, template apply, tax-kit apply, price lookup, cash-drawer numbers); health checks report OK instead of NA when the zone is missing; `prisma:pull` drops `@default` on `effective_from` (writers supply it; check db fixtures); a remote body that differs from the files stops the migration (send the message).
- **User steps:** (1) run `0846_preimage.sql`, keep the output; (2) `npx supabase db push --local --include-all --yes`, then `npx supabase db push --include-all --yes`; (3) run `clock_s5_current_date.test.sql` as postgres; (4) `npm run prisma:pull` and regenerate types; (5) T45, T67.
- **Readiness for S6:** ready after `0846` is applied (no migration in S6).
- **Applied (t148u, 2026-11-27):** the user applied `0846` (and their own `0847_bg_jobs_file_purge.sql`) on local and remote, regenerated types (both repos) and the Prisma schema. `clock_s5_current_date.test.sql`: PASS 1–7; section 6 printed the expected `CLOCK_ZONE_MISSING` warnings (one note skipped, one organization counted). S5 is closed.

## S6 — API time input, `clock` block, clock errors (`0.1.47`, 2026-11-27)

No migration. Before starting: migrations on disk ended at `0848` (`0847_bg_jobs_file_purge.sql` applied by the user; `0848_hq_nav_uom_config.sql` new, not ours). Both use `updated_at = now()` (instants, no civil day) and failed the guard's new-SQL ban; they are allowlisted by name with a reason (recommendation: new migrations write `public.fn_cmx_dt_now()` or mark the line `-- CLOCK-OK: <reason>`). Slots moved +2: S8 `0849`, S9 `0850`, S10 `0851`, S13 `0852`/`0853`, S15 `0854`; a slice now takes the next free number when its file is written.

- **New:** `web-admin/lib/clock/api-input.ts` (Zod and text checks over `@cmx/clock` parsers: `zInstant`, `zCivilDate`, `zInstantDate`, `zCivilOrInstantDate`, `zCivilStorageDate`, `isCivilDateText`, `isInstantText`, `leadingCivilDate`); `web-admin/lib/clock/api-clock.server.ts` (`screenClock`, `publicScreenClock`, `clockErrorResponse`, `assertZoneEcho`, `resolveZonedInput`); `src/ui/clock/cmx-dst-choice.tsx`, `use-clock-error-message.ts` (exported from `@ui/clock`); `technical_docs/api-clock-inventory.md`.
- **Input (WP10/WP11):** fresh search of `app/api`, `app/actions`, `lib/validations` for `z.string().datetime()`, `z.coerce.date()`, date regexes and `Date.parse`: 43 hits → 1 (`lib/validations/iso-date.ts`, year-bounded validator, kept). Routes: promotions (2), booking, campaigns (2), delivery routes, preparation complete, cash-drawer variance report, finance outbox / payments-breakdown / orders-summary / tax-report, pricing history. Actions: gift cards, discount rules, promo codes, promotions, reports. Schemas: cash-drawer list, tax, new-order payment, AR invoice, order change, edit order, POS session, order list. `z.coerce.date()` became `zInstantDate` (instants) or `zCivilOrInstantDate` (filters: a civil day keeps the old UTC-midnight value; a wall time without an offset is now refused instead of read in the server zone); a `Date` from a server action still passes.
- **Bug fixed:** `promotions-actions.ts` read a typed start/end day as `new Date('YYYY-MM-DDT00:00:00.000')` (server zone). Now the organization `accept_order` day (`civilDayBounds`; end = last millisecond); no zone → `TIMEZONE_NOT_CONFIGURED`; an instant needs an offset.
- **`clock` block (D21, D34):** 9 endpoints added (orders list, order detail with the order branch `ready_by` zone, cash-drawer trx and variance report, three finance reports, pricing history, public customer orders with the public subset) plus the S3 public tracking endpoint, listed in `api-clock-inventory.md`; a contract test reads the table. The block is top-level next to `data`; a block that cannot be built is null and logged.
- **Errors (§5.4):** `clockErrorResponse` gives 409 `ZONE_MISMATCH`, 422 `LOCAL_TIME_NONEXISTENT` / `LOCAL_TIME_AMBIGUOUS` / `TIMEZONE_NOT_CONFIGURED`, 400 parse codes, with `messageKey`; internal codes carry no details. `useClockErrorMessage` maps a response code to the EN/AR `clock.errors.*` text (strings existed since S1). `resolveZonedInput` applies the D9 echo and `reject` by default; `CmxDstChoice` offers earlier/later with offsets.
- **Not done in S6 (moved):** no screen sends a typed `{ date, time, zone }` appointment yet, so `resolveZonedInput` / `CmxDstChoice` are not wired into a form; the first user is the S9 Date & Time / cut-over work (T46 manual then). Response `toApiInstant` serialization and webhooks → S7/S11. More screen endpoints join the inventory as their screens are touched (S7 exports, S9).
- **Tests (each under `TZ=America/Los_Angeles` and `TZ=Asia/Kathmandu`):** `__tests__/lib/clock` 53/53 (new `api-clock.test.ts`, `api-clock-inventory.test.ts`, `clock-ui-s6.test.tsx`); 32 suites that import the changed routes and schemas: 312 tests, all pass except pre-existing failures not caused by S6: `b2b-create-with-payment-schema` (non-UUID promo id case), `payment-leg-detail-fields` and `split-tender-dialog` (suite fails to load: `Request is not defined` via `@ui/forms`). `finance-tax-report.route.test.ts` failed before S6 (zone read not mocked); it now mocks the zone and asserts the block. `tsc` 0 errors; eslint 0 errors on touched files.
- **Guard:** 224 → 224 (no ratchet pattern touched); `0847`/`0848` allowlisted, exits 0.
- **User steps:** review and commit; T57 (open orders list / a finance report, check `clock`); no database step.
- **Readiness for S7:** ready (no migration).
