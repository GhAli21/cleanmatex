# Time and Timezone

**Status:** `0828` through `0833` are applied on the local and remote databases. Version: [`version.txt`](./version.txt).

Bring every instant, civil date, local time-of-day, schedule, log, and audit timestamp in the tenant app up to [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md).

Store, send, compare, log, schedule, and audit instants in UTC. Convert an instant only in the presentation layer, using the feature's documented scope, then the organization zone. Store a business date once, from one database instant. Do not derive it again on read. Do not treat a naive column as UTC until its provenance sample proves that clock.

## Why this is a program, not one migration

On 2026-11-24, `web-admin/prisma/schema.prisma` had:

| Prisma type | Columns |
|---|---|
| `@db.Timestamptz` | 977 |
| `@db.Timestamp` (no zone) | 488 |

Of the 488 naive columns, 398 are `created_at` or `updated_at`. `deleted_at` is the same audit stamp. On 2026-11-26 all 64 `deleted_at` columns are already `timestamptz`. Those three names are one migration (WP8): each naive column uses `USING column AT TIME ZONE 'UTC'`. The session is UTC and the writers store `now()`. Development rows may move. Views, triggers, and functions that block the type change are recreated in that file. `sys_*` and `hq_*` stamps wait for the HQ reader list. The other 90 are event times, schedules, and a few values that may be civil dates. Civil values become `date` or `time`. A live catalog sample on 2026-11-25 counted 905 `timestamptz` and 495 naive columns.

Known failures this program is here to close:

- Notification batch claims compared a naive UTC `scheduled_at` with `now()` in a Muscat session, so a quiet-hours delay fired four hours early.
- `org_users_mst.locked_until` is `timestamp without time zone`. The login path reported a 15-minute lock as 255 minutes.
- Receipts that preferred naive `ready_by` printed 06:00 instead of 10:00. `0833` closed that. Promised Ready By is `ready_by_at`. Actual Ready is `ready_at`. Both are `timestamptz`.
- All Orders painted Ready By in UTC, then repainted it after the tenant zone loaded.

The shape to copy is `org_pos_sessions_mst`: `opened_at timestamptz`, `business_date date`, `business_timezone text`, written together.

## Start here

| You are | Read |
|---|---|
| Anyone (status) | [`current_status.md`](./current_status.md), [`progress_summary.md`](./progress_summary.md) |
| Planner | [`development_plan.md`](./development_plan.md), [`technical_docs/work-packages.md`](./technical_docs/work-packages.md), [`technical_docs/surface-map.md`](./technical_docs/surface-map.md) |
| Developer | [`developer_guide.md`](./developer_guide.md), [`developer_guide_mermaid.md`](./developer_guide_mermaid.md) |
| Staff / admin | [`user_guide.md`](./user_guide.md), [`user_guide_mermaid.md`](./user_guide_mermaid.md) |
| Whoever applies a migration | [`deploy_guide.md`](./deploy_guide.md) |
| QA | [`testing_guide_and_scenarios.md`](./testing_guide_and_scenarios.md) |
| Column list | [`technical_docs/column-inventory.md`](./technical_docs/column-inventory.md) |

## Scope

In scope: every surface in [`technical_docs/surface-map.md`](./technical_docs/surface-map.md). That includes the database, SQL functions, jobs, services, HTTP APIs, webhooks, server actions, pages, screens, date pickers, print, customer message text, exports, logs, `cmx-api`, `cmx-workers`, the mobile apps, and HQ (`platform-web`, `platform-api`, `platform-workers`). Removing `platform-workers` is a separate piece of work, not this plan.

HQ application code is changed in the HQ repo. The sibling plan is `cleanmatexsaas/docs/features/Time_and_Timezone/`. This pack still requires the reader list before a column those readers use is converted. A tenant package that skips a row on the surface map, or skips the close-out in `progress_summary.md`, is incomplete.

## Non-negotiable

- New migrations only. Never edit an applied migration. Never apply a migration from the agent. Never `supabase db reset`.
- Do not add a new naive instant column while this program runs.
- Promised Ready By is `org_orders_mst.ready_by_at`. Actual Ready is `org_orders_mst.ready_at`. Both are `timestamptz`. Do not reintroduce `ready_by` or `ready_by_override`. A null `ready_by_at` shows no clock.
- Do not change historical `business_date` values or issued document numbers.
- A missing operations zone fails closed. `Asia/Muscat`, the browser, the server, `UTC`, and `utc_offset_hours` are not fallbacks.
- The operations zone is the feature's documented scope, then the organization. One policy, two doors: `resolveOperationalTimeZone` in the app and `fn_ops_zone` in SQL. UI, reports, print, `cmx-api`, mobile, and HQ format that result or the row snapshot. Resolve once per action. A client-supplied zone is an echo only. HQ's own documents use the HQ zone. A tenant row shown in HQ uses the tenant zone.
- A typed daylight-saving gap or overlap is rejected unless the form captured earlier or later. A computed gap advances. A computed overlap uses the earlier offset.
- Legacy conversion is expand-and-contract. Readers use a `timestamptz` twin, or show no clock, until provenance names one stored clock.
