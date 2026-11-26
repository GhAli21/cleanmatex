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

## Beside this program

These are not a clock-program package. They must stay out of the operations door.

- Public registration suggests the browser locale and stores the value the visitor confirms (`registration-browser-defaults.ts`).
- `supabase/migrations/0826_org_locale_defaults_utc_usd_us.sql` was applied by the user on the local and remote databases on 2026-11-25. New-row defaults are US, USD, UTC, and `+1`. Existing organization rows were not rewritten. A null zone still fails closed. `npm run prisma:pull` completed from the local database afterward.

## In progress

WP1, WP2, WP3, and WP5 are done. `0828` through `0833` are applied on local and remote. Promised Ready By is `ready_by_at`. Actual Ready is `ready_at`. Both are `timestamptz`. Membership lock columns are `timestamptz`. Presentation and the remaining naive columns stay open. Dev rows may be rewritten as UTC walls. Civil columns stay dates or times.

## Package status

Update this table at the close-out of every package. Allowed values: Not started, In progress, Done, Written, not applied, Applied by user.

| Package | Status | Note |
|---|---|---|
| WP1 Shared clock | Done | Named clocks use one database instant. `formatReadyByDate` remains WP6 |
| WP2 Provenance | Done | `technical_docs/provenance-class-a.md`. Local catalog recounted 910 / 495 |
| WP3 Lockout | Applied by user | `0832` is on local and remote. Membership columns are `timestamptz`. The login function returns a real instant |
| WP4 Notification schedule | Applied by user | `0828` is on local and remote. The send-time read no longer casts `AT TIME ZONE 'UTC'` |
| WP5 Ready By backfill & canonicalization | Applied by user | `0829` backfilled null twins; `0833` dropped `ready_by` & `ready_by_override`, renamed `ready_by_at_new` → `ready_by_at`, and upgraded `ready_at` to `timestamptz`. |
| WP6 Presentation | In progress | Order screens, vouchers, reports, reconciliation, the ready-date picker, preparation rounding, cash drawers, refunds, reconciliation runs, and gift-card liability use the operations zone. A missing zone shows no clock. Customers, notifications, marketing, delivery, and workboard screens still use the machine zone |
| WP7 Domain batches | Not started | Close out each batch |
| WP8 Audit stamps | Not started | One migration for every naive tenant `created_at`, `updated_at`, and `deleted_at`, as UTC walls. The 64 `deleted_at` columns are already `timestamptz`. Dependents are recreated in that file. `sys_*` and `hq_*` wait for WP21 |
| WP9 CI guard | Done | `npm run check:clock-contract`. First run passed on 2026-11-25 |
| WP10 HTTP and webhooks | Not started | |
| WP11 Server actions | Not started | |
| WP12 SQL door | In progress | `fn_ops_zone` is applied. `technical_docs/sql-clock-inventory.md` lists 15 functions still to classify |
| WP13 Document numbers | Applied by user | Tenant numbers use `fn_ops_zone` and fail when the zone is missing. Issued numbers were not rewritten |
| WP14 Pickers and filters | Not started | |
| WP15 Customer message text | Not started | |
| WP16 Exports and imports | Not started | |
| WP17 Logs and audit screens | Not started | |
| WP18 Jobs | Not started | Includes `cmx-workers`. Its schedules stay UTC. Shop-local fire times are calculated in the web-admin service |
| WP19 `cmx-api` | Not started | Helpers are required even when the route search is empty |
| WP20 Mobile | Not started | |
| WP21 HQ readers | Not started | Required before converting a `sys_*` or `hq_*` column. HQ screens, APIs, and workers start without this list |
| WP22 Page completeness | Not started | |

## Pending

The table above is the pending list. `0828` through `0833` are applied on local and remote. WP6 presentation is next. Later instant columns convert as UTC walls. Civil columns stay `date` or `time`.

## Counts that define the pending work

| Item | Count |
|---|---|
| `timestamptz` columns in Prisma | 977 |
| Naive `timestamp` columns | 488 |
| Of those, `created_at` or `updated_at` | 398 |
| Other naive columns | 90 (61 distinct names) |

`cmx-api` has no matching date-parse sweep beyond its logger. `cmx-workers` schedules are UTC and its handlers call web-admin services. The 2026-11-25 recount on local is 910 `timestamptz` and 495 naive columns. Both sessions reported `TimeZone=UTC`. Audit stamps and other `now()` instants convert as UTC walls. Civil columns stay `date` or `time`.
