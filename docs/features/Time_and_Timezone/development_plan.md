# Development plan

Contract: [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md).
Work packages: [`technical_docs/work-packages.md`](./technical_docs/work-packages.md).
Inventory date: 2026-11-24, from `web-admin/prisma/schema.prisma`.

Each phase ends with a review. A later phase does not start by rewriting the previous phase's rows.

## Phase 0 — Contract (done)

The rule is canonical. Cursor, Claude, Codex, and Antigravity point at it. Audit-column templates in those instruction files use `timestamptz`.

No application behavior changed in this phase.

## Phase 1 — One clock in code

Build the shared helpers and make new writes obey them. No `ALTER` yet.

- `resolveOperationalTimeZone(branch, organization)` using `isValidTimeZone` and an active `sys_timezone_cd` code.
- `formatInstant`, `civilDayBounds`, `parseInstant` (reject missing offsets).
- Stop new readers of `org_orders_mst.ready_by`. Read `ready_by_at_new`.
- Remove UTC-date fallbacks that call `toISOString().slice(0, 10)` when the zone is missing (`speed-rules.service.ts`, `prepaid-tax.service.ts`, `tax-lines.writer.ts`). Those paths fail closed.
- Pass the operations zone into formatters before the first absolute date paints. `getTenantTimeZone` stays the organization zone only. It is not the branch resolver.

Exit: new code cannot add a naive instant, and Ready By no longer flips after sign-in.

## Phase 2 — Provenance, then the clocks that are wrong today

Read-only samples before any `USING` clause. Then one migration per column group.

Priority:

1. `org_users_mst.locked_until` and `last_failed_login_at` (the 255-minute lockout).
2. `org_ntf_outbox_dtl.scheduled_at` and `next_retry_at`, `org_ntf_campaigns_mst.scheduled_at` (the four-hour-early send).
3. `org_orders_mst.ready_by` backfill into `ready_by_at_new` where the twin is null, then stop writes to `ready_by`.

Campaign job writes that use `now() AT TIME ZONE 'UTC'` into a naive column are evidence, not a blanket conversion rule. Confirm the writer for each column.

Exit: lockout duration is 15 minutes when the policy is 15 minutes. A quiet-hours send fires at the UTC instant that was stored. Ready By matches `ready_by_at_new` on screen, receipt, and list.

## Phase 3 — Presentation sweep

Replace operational `toLocaleString`, `toLocaleDateString`, `getHours` / `setHours`, and `toISOString().slice(0, 10)` used as a business date. The 2026-11-24 search hit those calls across orders, reports, finance, customers, notifications, and print.

Do it by feature, with the shared formatter. Locale still controls digits and month names. The zone controls the clock and the calendar day.

Exit: a list and its print use the same zone. A mixed-branch list shows each row's zone abbreviation.

## Phase 4 — The other 90 naive event columns

Classify each name in [`technical_docs/column-inventory.md`](./technical_docs/column-inventory.md):

- instant stored as UTC wall
- instant stored as session wall (`Asia/Muscat` while that was the database zone)
- civil date or local time-of-day that must become `date` or `time`, not `timestamptz`

Convert one domain per migration: orders, notifications, delivery, finance, subscriptions, assembly. Dual-read when a screen is in production. Do not drop the old column in the same migration that adds the new one.

## Phase 5 — Audit stamps

398 `created_at` / `updated_at` columns are still `@db.Timestamp`. They are last. Sample writers per table family. Many were filled by `now()` under a Muscat session; others were filled from a UTC ISO string. Mixed provenance inside one column is a stop: split the backfill, do not average the two interpretations.

## Phase 6 — Every other surface

The column and screen work is not the whole program. [`technical_docs/surface-map.md`](./technical_docs/surface-map.md) is the list. Each row has a package. A package starts by refreshing that row's file list, then changes every hit.

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

Phase 3 and the read-only parts of Phase 6 can overlap Phase 2. Phase 4 does not overlap Phase 2 on the same column. Phase 6's document-number change is a new function migration and does not renumber issued codes. HQ application code stays in the HQ repo. This plan still blocks a tenant conversion until the HQ reader list exists.

## Explicitly not in this plan

- Applying migrations.
- `supabase db reset`.
- Editing applied migration files.
- Renumbering issued orders.
- Rewriting frozen `business_date` values.
- A per-user display zone in the back office.
- Editing HQ source during a tenant work package. The required HQ artifact is the reader list, then a sibling pack.
