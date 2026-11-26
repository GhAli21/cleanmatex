# @cmx/clock

The one TypeScript home of CleanMateX date and time rules: the mirror of the SQL family
`fn_cmx_dt_*`. Plan: `docs/features/Time_and_Timezone/MASTER_PLAN_v2.md` §6. Rules:
`docs/dev/rules/time-and-timezone.md`.

## Use

```ts
import { systemClock, fixedClock, dtToday, dtAtLocal, dtBusinessDate, formatInstant, ClockError } from '@cmx/clock';
import { zCivilDate, zZonedInput, zClockBlock } from '@cmx/clock/zod';

const today = dtToday(clock, zone);                         // fn_cmx_dt_today; missing zone → TIMEZONE_NOT_CONFIGURED
const at = dtAtLocal('2026-11-27', '18:00', zone);          // typed input: gap/overlap → LOCAL_TIME_NONEXISTENT / _AMBIGUOUS
const label = formatInstant(at, zone, locale, { style: 'datetime', hourCycle: block.hourCycle });
```

Services take a `Clock` (`systemClock` at the request boundary, `fixedClock(...)` in tests,
`actionClock()` for one stable instant per action).

| SQL | TypeScript |
|---|---|
| `fn_cmx_dt_now` / `fn_cmx_dt_clock` | `dtNow` / `dtClock` |
| `fn_cmx_dt_zone` | `resolveOperationalTimeZone` (web-admin server) + `selectZoneFromCandidates` |
| `fn_cmx_dt_today` / `_today_or_null` / `_today_in` | `dtToday` / `dtTodayOrNull` / `dtTodayIn` |
| `fn_cmx_dt_local_now` / `_local_time` | `dtLocalNow` / `dtLocalTime` |
| `fn_cmx_dt_at_local` / `_instant_at_zone` | `dtAtLocal` / `dtInstantAtZone` |
| `fn_cmx_dt_to_local` / `_local_parts` | `dtToLocal` / `dtLocalParts` |
| `fn_cmx_dt_day_bounds` / `_business_day_bounds` | `dtDayBounds` / `dtBusinessDayBounds` |
| `fn_cmx_dt_period_key` | `dtPeriodKey` (`DAY`, `WEEK` = `W`+week-start date, `MONTH`, `YEAR`, `FY` = `FY`+start year) |
| `fn_cmx_dt_business_date` | `dtBusinessDate` |
| `fn_cmx_dt_civil_add` | `dtCivilAdd` |
| `fn_cmx_dt_is_valid_zone` / `_canonical_zone` | `isValidZoneId` / `canonicalZoneId` (+ `createZoneCatalog` over `sys_timezone_cd`) |
| `fn_cmx_dt_hour_cycle` / `_week_start` / `_cutover` / `_date_format` | `resolveHourCycle` / `resolveWeekStart` / `resolveCutover` / `resolveDateFormat` (D33) |

## Operation codes

`OPERATIONAL_ZONE_OPERATIONS` includes `notify` (D27). `SQL_DOOR_OPERATIONS` is what `fn_ops_zone` /
`fn_cmx_dt_zone` accept; since S2 (migration `0842`) it is the same list, `notify` included, and equals
`fn_cmx_dt_operations()` in SQL. Deploy only to a database where `0842` is applied. Call
`assertSqlDoorOperation(op)` before any RPC to the SQL door.

## SQL mirror (S2)

Migrations `0842_cmx_dt_clock_api.sql` and `0843_cmx_dt_settings.sql` add the `fn_cmx_dt_*` SQL API.
`node scripts/gen-clock-vectors-sql.mjs` turns `vectors/time-vectors.v1.json` into
`supabase/tests/clock_vectors.test.sql`, so the SQL functions are checked against the same vectors
(`--check` fails when the SQL file is stale).

## Temporal (D1)

`src/temporal.ts` is the only file that imports `temporal-polyfill` (MIT) or reads the `Temporal`
global; native `globalThis.Temporal` wins when present. ESLint and `npm run check:clock-contract`
fail any other use. No `Temporal.*` object leaves the package.
**Removal plan:** quarterly check; when every supported browser and the Node LTS in use ship
Temporal unflagged, make the adapter native-only, drop the dependency, run the vectors, log it.

## Build and test

- `npm run build -w @cmx/clock` (also runs on `npm install` through `prepare`):
  `dist/esm/*.js` (ESM per module, tree-shakeable; web-admin, workers),
  `dist/index.cjs` + `dist/zod.cjs` (CommonJS with the polyfill inlined; cmx-api, Jest),
  `dist/types/*.d.ts`.
- `npm test -w @cmx/clock` builds, then runs Jest twice: `TZ=UTC` and `TZ=Pacific/Kiritimati`.
- `vectors/time-vectors.v1.json` is the shared vector file (Jest here and in web-admin; pgTAP,
  Dart and HQ copies later). Expected values come from an independent tz implementation. Never
  edit an expected value to make a runner pass.
