# Time and Timezone

**Status:** Plan only. No schema has been converted by this pack. Version: [`version.txt`](./version.txt).

Bring every instant, civil date, local time-of-day, schedule, log, and audit timestamp in the tenant app up to [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md).

Store, send, compare, log, schedule, and audit instants in UTC. Convert an instant only in the presentation layer, and only with the branch zone, else the organization zone. Store a business date once. Do not derive it again on read.

## Why this is a program, not one migration

On 2026-11-24, `web-admin/prisma/schema.prisma` has:

| Prisma type | Columns |
|---|---|
| `@db.Timestamptz` | 977 |
| `@db.Timestamp` (no zone) | 488 |

Of the 488 naive columns, 398 are `created_at` or `updated_at`. The other 90 are event times, schedules, and a few values that may be civil dates stored in the wrong type. The database session has been observed as `Asia/Muscat`. A single `USING col AT TIME ZONE 'UTC'` across all of them would move any Muscat wall-clock row by four hours. Provenance comes before `ALTER`.

Known failures this program is here to close:

- Notification batch claims compared a naive UTC `scheduled_at` with `now()` in a Muscat session, so a quiet-hours delay fired four hours early.
- `org_users_mst.locked_until` is `timestamp without time zone`. The login path reported a 15-minute lock as 255 minutes.
- `org_orders_mst.ready_by` is a naive timestamp. `ready_by_at_new` is `timestamptz`. Receipts that prefer `ready_by` print 06:00 instead of 10:00.
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

In scope: every surface in [`technical_docs/surface-map.md`](./technical_docs/surface-map.md). That includes the database, SQL functions, jobs, services, HTTP APIs, webhooks, server actions, pages, screens, date pickers, print, customer message text, exports, logs, `cmx-api`, and the mobile apps.

HQ application code is changed in the HQ repo. This pack still requires the reader list before a column those readers use is converted. A tenant package that skips a row on the surface map is incomplete.

## Non-negotiable

- New migrations only. Never edit an applied migration. Never apply a migration from the agent. Never `supabase db reset`.
- Do not add a new naive instant column while this program runs.
- Do not drop `ready_by` until every reader uses `ready_by_at_new` and a backfill is proven.
- Do not change historical `business_date` values or issued document numbers.
- A missing operations zone fails closed. `Asia/Muscat`, the browser, and `utc_offset_hours` are not fallbacks.
