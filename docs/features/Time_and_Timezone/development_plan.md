# Development plan

> Remaining work is planned in [`MASTER_PLAN_v2.md`](./MASTER_PLAN_v2.md) (pack `0.1.43`; decisions D1–D29 and D32–D35 accepted, D30/D31 superseded by D33). Phases 0, 2, 4, and 5 below are done for organization tables; Phases 1, 3, 6, and 7 continue as slices S1–S15 there (S1 done 2026-11-27: `packages/clock`, guard v2; S2 files `0842`/`0843` written 2026-11-27, not applied). New SQL uses the `fn_cmx_dt_*` family (the deployed `fn_ops_zone` stays under it); TypeScript uses `dt*`. Closed operations include `notify`.

Contract: [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md).
Work packages: [`technical_docs/work-packages.md`](./technical_docs/work-packages.md).
Inventory date: 2026-11-24, from `web-admin/prisma/schema.prisma`.

Each phase ends with a review. A later phase does not start by rewriting the previous phase's rows.

## Close-out after every step

A step is one work package, or one batch inside a package (one domain migration, one screen batch, one HQ task). The step is done only after these files match what just landed:

| File | What to write |
|---|---|
| `progress_summary.md` | That step's row moves to Done, or to Written, not applied, when a migration is waiting. Include the date, the files, and what was left on purpose. |
| `current_status.md` | State, next action, and any new risk. |
| `technical_docs/surface-map.md` | The row notes the search date and the hits still open. |
| `CHANGELOG.md` and `version.txt` | One line, and the next `0.1.x-plan` version. |
| `testing_guide_and_scenarios.md` | The manual cases for this step, with the screen, the setup, and the expected clock. |
| This file | The phase is marked done only when every package in it has closed out. |

A migration stays Written, not applied until the user says it was applied. The close-out then records `npm run prisma:pull` from the repo root. Conversation notes do not replace these files.

The same close-out applies to the HQ sibling plan in `cleanmatexsaas` at `docs/features/Time_and_Timezone/`. HQ tasks update that folder. They do not mark a tenant package done.

## Phase 0 — Contract (done)

The rule is canonical. Cursor, Claude, Codex, and Antigravity point at it. Audit-column templates in those instruction files use `timestamptz`.

No application behavior changed in this phase.

## Phase 1 — One clock in code

Build the shared helpers and make new writes obey them. No `ALTER` yet.

- `resolveOperationalTimeZone({ tenantOrgId, operation, scopeId })` using `isValidTimeZone` and an active `sys_timezone_cd` code. The caller passes a closed operation code. A branch-scoped operation reads that branch's `timezone_code`, else the organization `timezone`, else null. A scope with no timezone column names the branch that owns it. A client-supplied zone cannot win. One indexed read per action, filtered by `tenant_org_id`. Request-scoped reuse only. A persisted business date takes one database instant. `pos-session.service.ts` today calls `businessDateForTimezone` with the application clock. That call is in this phase.
- `formatInstant`, `civilDayBounds`, `parseInstant` (reject missing offsets).
- Read and write promised Ready By on `org_orders_mst.ready_by_at`. Actual Ready is `ready_at`. Both are `timestamptz` after `0833`.
- Remove UTC-date fallbacks that call `toISOString().slice(0, 10)` when the zone is missing (`speed-rules.service.ts`, `prepaid-tax.service.ts`, `tax-lines.writer.ts`). Those paths fail closed.
- Pass the operations zone into formatters before the first absolute date paints. `getTenantTimeZone` stays the organization zone only. It is not the branch resolver. UI, reports, print, `cmx-api`, mobile, and HQ format this result or the row snapshot. The SQL twin `fn_ops_zone` is Phase 6 / WP12, in a new migration, and must match this function. Resolve once per action. Join mixed-list zones in one query.

Exit: new code cannot add a naive instant, and Ready By no longer flips after sign-in. The close-out files name WP1 as done. No migration was added.

## Phase 2 — Provenance, then the clocks that are wrong today

Read-only samples before any `USING` clause. On 2026-11-25 both database sessions reported `TimeZone=UTC`. Older naive rows may still hold a Muscat wall clock from when the session was `Asia/Muscat`. The sample decides. Prisma's 2026-11-24 counts (977 `timestamptz`, 488 naive) are the starting inventory. Recount the live catalog at the start of this phase and write both numbers in the provenance note. Then one migration per column group.

Priority:

1. `org_users_mst.locked_until` and `last_failed_login_at` (the 255-minute lockout).
2. `org_ntf_outbox_dtl.scheduled_at` and `next_retry_at`, `org_ntf_campaigns_mst.scheduled_at` (the four-hour-early send).
3. Ready By cutover. `0829` backfilled null twins. `0833` dropped `ready_by` and `ready_by_override`, renamed the promised column to `ready_by_at`, and converted `ready_at` to `timestamptz`. Applied on local and remote.

Campaign job writes that use `now() AT TIME ZONE 'UTC'` into a naive column are evidence, not a blanket conversion rule. Confirm the writer for each column.

Exit: lockout duration is 15 minutes when the policy is 15 minutes. A quiet-hours send fires at the UTC instant that was stored. Ready By on screen, receipt, and list is `ready_by_at`. `0828` through `0833` are applied on local and remote.

## Phase 3 — Presentation sweep

Replace operational `toLocaleString`, `toLocaleDateString`, `getHours` / `setHours`, and `toISOString().slice(0, 10)` used as a business date. The 2026-11-24 search hit those calls across orders, reports, finance, customers, notifications, and print.

Do it by feature, with the shared formatter. Locale still controls digits and month names. The zone controls the clock and the calendar day.

Exit: a list and its print use the same zone. A mixed-scope list labels each row with that row's IANA zone and the abbreviation and offset of the instant on the row. A day filter compares a stored date or a bare instant after the bounds are computed once. The close-out names the batches that landed.

## Phase 4 — The other 90 naive event columns

Classify each name in [`technical_docs/column-inventory.md`](./technical_docs/column-inventory.md):

- instant stored as UTC wall
- instant stored as session wall (`Asia/Muscat` while that was the database zone)
- civil date or local time-of-day that must become `date` or `time`, not `timestamptz`

Convert one domain per migration: orders, notifications, delivery, finance, subscriptions, assembly. Each migration follows expand-and-contract: add the twin, dual-write, backfill only rows with one proven clock, move readers, and drop the old column in a later migration. Do not drop the old column in the same migration that adds the new one. Do not assume the naive values are UTC wall clocks.

## Phase 5 — Audit stamps

398 `created_at` / `updated_at` columns are still `@db.Timestamp`. `deleted_at` is the same kind of stamp: on 2026-11-26 all 64 are already `timestamptz`. They are one migration. Each naive column becomes `timestamptz` with `USING column AT TIME ZONE 'UTC'`, because the session is UTC and the writers store `now()`. An already-`timestamptz` `deleted_at` stays as it is. Development rows may move. The same file recreates every view, trigger, and function that blocks the type change. `sys_*` and `hq_*` stamps wait for the HQ reader list.

## Phase 6 — Every other surface

The column and screen work is not the whole program. [`technical_docs/surface-map.md`](./technical_docs/surface-map.md) is the list. Each row has a package. A package starts by refreshing that row's file list, then changes every hit.

`fn_ops_zone` is the SQL door. It matches the TypeScript door, filters by `tenant_org_id`, and is one indexed read. List SQL does not call it per row. New functions follow the database rules: comments, `TEXT` for a new zone column, and no grant to `anon` or `authenticated`.

`cmx-api` gets the same parser and the same test vectors even when a fresh search finds no date route beyond the logger. It does not import `web-admin`.

HQ work is the sibling plan in `cleanmatexsaas`. It starts after the tenant reader list exists. HQ's own documents use `hq_general_config.timezone`. A tenant row uses the tenant snapshot or `fn_ops_zone`. Platform cron says UTC.

Included here, not left as a follow-up:

- HTTP routes, webhooks, and Zod inputs.
- Server actions.
- SQL functions, triggers, views, and cron, including the document-number function that today falls back to the HQ timezone.
- Date pickers and filter bars.
- The date and clock written inside SMS, email, WhatsApp, and in-app text.
- CSV and other exports and imports.
- Logs in `web-admin`, `cmx-api`, and the mobile apps.
- `cmx-api` as its own pass.
- Flutter booking, tracking, and the shared date picker.
- A named list of HQ readers before any column those readers use is converted.

## Phase 7 — Guard

A check that fails CI when a new migration adds `timestamp without time zone` for an instant, and when feature code adds `toISOString().slice(0, 10)` or an unzoned `Date` parse for a business date. The same check covers `web-admin`, `cmx-api`, and new SQL functions. The test list in the rule becomes a permanent suite.

## Sequence

```text
Phase 0 contract
    -> Phase 1 helpers and read-path
        -> Phase 2 provenance + lockout + outbox + ready-by
            -> Phase 3 screens, prints, and customer message text
                -> Phase 6 routes, actions, SQL, jobs, exports, logs, API, mobile
                    -> Phase 4 domain column batches
                        -> Phase 5 audit stamps
                            -> Phase 7 CI guard
```

Phase 3 and the read-only parts of Phase 6 can overlap Phase 2. Phase 4 does not overlap Phase 2 on the same column. Phase 6's document-number change is a new function migration and does not renumber issued codes. HQ application code stays in the HQ repo. This plan still blocks a tenant conversion until the HQ reader list exists. Each package closes out before its phase is marked done.

## Explicitly not in this plan

- Applying migrations.
- `supabase db reset`.
- Editing applied migration files.
- Renumbering issued orders.
- Rewriting frozen `business_date` values.
- A per-user display zone in the back office.
- Editing HQ source during a tenant work package. The required HQ artifact is the reader list, then the sibling plan in `cleanmatexsaas`.
- Calling a package done without updating `progress_summary.md`, `current_status.md`, and the surface map.
