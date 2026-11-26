# Progress summary

Inventory date: 2026-11-24.

## Completed

- Canonical rule: `docs/dev/rules/time-and-timezone.md`.
- Short Cursor rule: `.cursor/rules/time-and-timezone.mdc` (`alwaysApply`).
- Pointers in `CLAUDE.md`, `AGENTS.md`, and the database, backend, and frontend skills.
- The same pointers and `timestamptz` audit templates in `.claude`, `.codex`, `.agents`, and the Cursor convention rules that were still showing `TIMESTAMP`.
- This plan pack.
- 2026-11-25 contract alignment: documented scope then organization, split daylight-saving policy, and no UTC assumption before provenance. The short Cursor rule matches that contract.
- 2026-11-25 architecture: one zone policy, a TypeScript door and a SQL door, and the same rule for UI, reports, HQ, mobile, and the hot path. Both doors are still to be built.
- 2026-11-25 plan gap pass: close-out after every package, closed operation codes, scopes that have no timezone column, POS business date, `cmx-api` helpers, and the HQ sibling plan.
- 2026-11-26 `0.1.40-plan`: read-only audit of both repos and [`MASTER_PLAN_v2.md`](./MASTER_PLAN_v2.md). Gaps G1–G15, decisions D1–D24, slices S0–S14. HQ half in `cleanmatexsaas/docs/features/Time_and_Timezone/MASTER_PLAN_v2_HQ.md`.
- 2026-11-26 `0.1.41-plan`: planning finalized after the user's review. Decisions D1–D26 accepted (D25 own SQL clock `fn_cmx_dt_now`/`fn_cmx_dt_clock` with a gated test override; D26 names `fn_cmx_dt_*` / `dt*`). Gaps now G1–G18. Settings moved to config keys and a branch column; country defaults added; health checks `CLOCK_*`; migration slots `0842`–`0851` re-set; slices S0–S15; tests T52–T60 reserved. HQ half `0.1.5-plan`. Documentation only.
- 2026-11-26 `0.1.41b-plan`: adversarial gap review (t136u), documentation only. Fixed: fake-clock gate order; settings foundation re-slotted to S2 (`0843`), later slots `0844` (conditional role zone), `0845` S5, `0846` S8, `0847` S9; per-check health on the setup-health contract; zone validators; `0840`/`0739`/`fn_tenant_general_value` added to S5; `quiet_hours_tz` writers in S8; rollback table; type regeneration; deploy order; coverage matrix; T61–T68. Proposed for the user: D32 (keep `Asia/Muscat` and all `zone.tab` names canonical), D33 (reuse `org_tenants_mst.time_format`/`first_day_of_week` + `hq_general_config`), D34 (`clock.dateFormat`), D35 (orders + `org_order_payments_dtl`). Next: S1.
- 2026-11-27 `0.1.43`: **slice S2 files written, not applied.** `0842_cmx_dt_clock_api.sql` (clock + gate, catalog seed tzdb 2026f/CLDR 49, `notify`, `fn_cmx_dt_*` API, validators, health + `CLOCK` setup-health domain), `0843_cmx_dt_settings.sql` (cut-over columns, CLDR country defaults, readers, business date, `WEEK`, 5 checks); SQL tests 7/7 and vectors 159/159 green on a scratch Postgres (not the user's DB); `notify` in `SQL_DOOR_OPERATIONS`; guard regex fix. `0844` waits for Q1. FY key confirmed (t139u).
- 2026-11-27 `0.1.42`: **slice S1 done.** `packages/clock` (`@cmx/clock`): Temporal adapter (`temporal-polyfill`, one file), `dt*` API, injectable `Clock`, D32 zone helpers, D33 setting resolvers, zod schemas, error codes with EN/AR keys, shared vectors (172 cases) green under two process zones and both adapters; `notify` in the TypeScript operation list only; web-admin and cmx-api wired; guard v2 with per-file baseline in both repos; restored Ready By calculator test; contract docs updated. D32–D35 accepted (t137u); D30/D31 superseded by D33.
- 2026-11-26 `0.1.41a-plan`: planning amendment (t135u). D27 `notify` operation code (quiet hours use it, not `delivery`); D28 `sys_timezone_cd` is the runtime zone catalog (official IANA + CLDR, never `pg_timezone_names` at runtime); D29 country hour-cycle / week-start seeded from Unicode CLDR; D30 `sys_tenant_config_defaults_cd` (corrected spelling; seed `H23` / `SAT` / `00:00`); D31 category `DATETIME`. HQ half `0.1.5a-plan`. Documentation only.

## Beside this program

These are not a clock-program package. They must stay out of the operations door.

- Public registration suggests the browser locale and stores the value the visitor confirms (`registration-browser-defaults.ts`).
- `supabase/migrations/0826_org_locale_defaults_utc_usd_us.sql` was applied by the user on the local and remote databases on 2026-11-25. New-row defaults are US, USD, UTC, and `+1`. Existing organization rows were not rewritten. A null zone still fails closed. `npm run prisma:pull` completed from the local database afterward.

## In progress

Pack version is `0.1.43` (S1 done; S2 files written 2026-11-27, not applied; D32–D35 accepted). The remaining work follows the slices in `MASTER_PLAN_v2.md`; next: the user applies `0842` then `0843`, then S3 (`0.1.44`). Only the user applies migrations. WP1 through WP5, WP7, WP8, WP9, and WP12 through WP15 are done or applied. `0828` through `0841` are applied on local and remote. Promised Ready By is `ready_by_at`. Actual Ready is `ready_at`. Both are `timestamptz`. Organization naive timestamps are gone. `sys_*` and `hq_*` catalog stamps stay naive until WP21. Open packages are WP6, WP10, WP11, WP16, WP17, and WP18 through WP22.

## Package status

Update this table at the close-out of every package. Allowed values: Not started, In progress, Done, Written, not applied, Applied by user.

| Package | Status | Note |
|---|---|---|
| WP1 Shared clock | Done | Named clocks use one database instant. `formatReadyByDate` remains WP6 |
| WP2 Provenance | Done | `technical_docs/provenance-class-a.md`. Local catalog recounted 910 / 495 |
| WP3 Lockout | Applied by user | `0832` is on local and remote. Membership columns are `timestamptz`. The login function returns a real instant |
| WP4 Notification schedule | Applied by user | `0828` is on local and remote. The send-time read no longer casts `AT TIME ZONE 'UTC'` |
| WP5 Ready By backfill & canonicalization | Applied by user | `0829` backfilled null twins; `0833` dropped `ready_by` & `ready_by_override`, renamed `ready_by_at_new` → `ready_by_at`, and upgraded `ready_at` to `timestamptz`. |
| WP6 Presentation | In progress | Order screens, vouchers, reports, reconciliation, the ready-date picker, preparation rounding, cash drawers, refunds, reconciliation runs, gift-card liability, customers, notifications, marketing lists, delivery, pickup, workboard, and the workflow queues use the operations zone. Report days, cash variance, and dashboard today use the organization civil day (`0.1.35-plan`, `0.1.37-plan`, `0.1.39-plan`). A missing zone shows no clock |
| WP7 Domain batches | Applied by user | B1–B5 and the remaining organization event stamps are `timestamptz` (`0835`–`0839`, OTP in `0841`). B6 `sys_*` / `hq_*` catalogs wait for WP21 |
| WP8 Audit stamps | Applied by user | `0834` converts every naive organization `created_at` and `updated_at` as a UTC wall. No naive `deleted_at` remained. Views were recreated in that file. `sys_*` and `hq_*` wait for WP21 |
| WP9 CI guard | Done | `npm run check:clock-contract`. First run passed on 2026-11-25. `0832` still mentions a naive timestamp in a comment, so a fresh run reports that existing file |
| WP10 HTTP and webhooks | In progress | Tax report, price history, price-list dates, campaign schedule, public booking slots, orders summary, payments breakdown, outbox, reconciliation, tax exemptions, and credit-note issue (`0.1.34-plan`). The rest of the route list is still open |
| WP11 Server actions | In progress | Gift-card list filters use the organization civil day (`0.1.33-plan`). Report actions resolve the organization zone (`0.1.35-plan`). Tax exemption dates accept only `YYYY-MM-DD` (`0.1.36-plan`). Gift-card month-to-date uses the organization month (`0.1.38-plan`) |
| WP12 SQL door | Done | The 15 open functions are classified in `technical_docs/sql-clock-inventory.md`. Credit-note expiry and the worker claim are fixed in `0840`. OTP retention compares instants in `0841` |
| WP13 Document numbers | Applied by user | Tenant numbers use `fn_ops_zone` and fail when the zone is missing. Issued numbers were not rewritten |
| WP14 Pickers and filters | Done | Named controls use the operations zone (`0.1.28`–`0.1.31`). The page list is WP22 |
| WP15 Customer message text | Done | `order-event-variables.ts` formats Ready By in the fulfilment zone. A missing zone leaves the label empty. A date-only value stays that calendar day |
| WP16 Exports and imports | In progress | Customer export writes the civil day, the UTC instant, and the zone id. Product, price-list, invoice, and customer download names use the organization civil day (`0.1.33-plan`) |
| WP17 Logs and audit screens | In progress | web-admin, `cmx-api`, `cmx-workers`, and the mobile logger write UTC. Audit screens are still open |
| WP18 Jobs | Not started | Includes `cmx-workers`. Its schedules stay UTC. Shop-local fire times are calculated in the web-admin service |
| WP19 `cmx-api` | Not started | Helpers are required even when the route search is empty |
| WP20 Mobile | Not started | |
| WP21 HQ readers | Not started | Required before converting a `sys_*` or `hq_*` column. HQ screens, APIs, and workers start without this list |
| WP22 Page completeness | Not started | |

## Pending

The table above is the pending list. `0828` through `0841` are applied on local and remote. Organization naive timestamps are gone. Still open: WP6 presentation, WP10 routes, WP11 actions, WP16 imports, WP17 audit screens, WP18 jobs, WP19 `cmx-api`, WP20 mobile, WP21 HQ readers, and WP22 the page list. The live queue is `RESUME_CONTINUATION.md`. Read **Risks while implementing** in that file before editing. Refresh it on every slice. `sys_*` and `hq_*` catalog stamps stay naive until the reader list.

## Counts that define the pending work

| Item | Count |
|---|---|
| `timestamptz` columns in Prisma | 977 |
| Naive `timestamp` columns | 488 |
| Of those, `created_at` or `updated_at` | 398 |
| Other naive columns | 90 (61 distinct names) |

Recount on 2026-11-26 from `web-admin/prisma/schema.prisma`: 1234 `@db.Timestamptz`, 219 `@db.Timestamp` (all on `sys_*` (98 models), `hq_*` (6 models), `sessions`, `one_time_tokens`), 13 `@db.Time`, 128 `@db.Date`. No `org_*` naive column remains. The table above is the 2026-11-24 starting inventory.

`cmx-api` has no matching date-parse sweep beyond its logger. `cmx-workers` schedules are UTC and its handlers call web-admin services. The 2026-11-25 recount on local is 910 `timestamptz` and 495 naive columns. Both sessions reported `TimeZone=UTC`. Audit stamps and other `now()` instants convert as UTC walls. Civil columns stay `date` or `time`.
