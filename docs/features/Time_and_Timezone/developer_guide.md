# Developer guide

Read [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md) before editing a date. This guide is how to land that rule in the current code.

## What already exists

| Piece | Role | Limit |
|---|---|---|
| `web-admin/lib/utils/business-date.ts` | `isValidTimeZone`, `businessDateForTimezone` | Does not resolve the feature's documented scope. Its default clock must not assign a persisted business date |
| `web-admin/lib/utils/tenant-timezone.server.ts` | Organization zone for `next-intl` | Not the branch clock. `undefined` lets the viewer zone through |
| `web-admin/app/layout.tsx` | Passes `getTenantTimeZone()` into providers | Organization only |
| `web-admin/lib/commercial/calendar.ts` | Working-calendar math with an explicit zone | Keep it. Do not open-code a second calendar |
| `org_pos_sessions_mst` | `opened_at`, `business_date`, `business_timezone` | The write shape for a new business day |
| `sys_timezone_cd` | Allowed IANA codes | `utc_offset_hours` is display metadata |

`getTenantTimeZone` stays. Add a resolver beside it. Do not make the organization helper silently start returning a branch zone, or every screen that meant "organization" changes meaning.

Every other layer is a required package, not a later idea. The checklist is [`technical_docs/surface-map.md`](./technical_docs/surface-map.md): SQL functions, document numbers, HTTP routes, webhooks, server actions, Zod, date pickers, pages, print, customer message text, exports, logs, `cmx-api`, mobile, and the HQ reader list.

## Resolver

The server receives `tenant_org_id`, the scope id, and the operation kind. It checks that the scope belongs to the tenant. A client-supplied `timeZone` is compared only as a stale-form echo.

The operation code is one of `accept_order`, `ready_by`, `pos_session`, `delivery`, `invoice`, or `ledger`. Each feature documents which scope owns the civil decision: receiving branch, fulfilment branch, the till's branch, the branch of the service location, or the issuing branch of the legal or accounting entity. Those last scopes have no timezone column of their own. `sys_country_cd.default_timezone_code` is not a fallback. A branch-scoped operation then resolves:

```text
branch timezone_code if valid and active in sys_timezone_cd
else organization timezone if valid and active
else null
```

Callers that assign a business date, a ready-by, a document number, or a local schedule stop when the result is null. Callers that format an absolute operational date render a skeleton, not a UTC clock. A persisted civil date comes from one database instant, not from `businessDateForTimezone()` with its default application clock.

The same answer in SQL is `fn_ops_zone(tenant, operation, scope)`. It is added in a new migration under WP12. Until that function exists, a new SQL function must not grow its own timezone lookup. `fn_doc_seq_next` still falls back to the HQ zone, and the setup-health holiday check in `0739` still substitutes `UTC`. Those wait for new migrations.

UI, reports, print, `cmx-api`, mobile, and HQ format a zone this door returned, or the zone snapshot on the row. They do not resolve one of their own. HQ's own documents use `hq_general_config.timezone`. A tenant row shown in HQ uses the tenant zone. Public registration (`registration-browser-defaults.ts`) only suggests a browser locale. The visitor confirms it, and it is stored as the organization zone.

Resolve once per action. A list joins each row's zone in the same query. A day filter compares a stored `date` or a bare `timestamptz` after the UTC bounds are computed once. Reuse a resolved zone for the rest of that request only. A TTL must not decide which civil day a new action belongs to.

## Read path that is safe before any migration

`org_orders_mst.ready_by` is `@db.Timestamp(6)`. `ready_by_at_new` is `@db.Timestamptz(6)`. Every display, print, notification, and report reads `ready_by_at_new` first. A null twin is an empty Ready By until Phase 2 backfills it. Do not parse `ready_by` as local time.

## Writes that are wrong today

`web-admin/lib/notifications/campaign-jobs.service.ts` assigns `now() AT TIME ZONE 'UTC'` into campaign timestamps. That expression yields `timestamp without time zone`. It is evidence that those writes intended a UTC wall. It is not proof that every historical row is UTC, and it is not a license to read the column as UTC. Phase 2 replaces those columns with `timestamptz` and assigns `now()` after the provenance sample.

`speed-rules.service.ts`, `prepaid-tax.service.ts`, and `tax-lines.writer.ts` fall back to `toISOString().slice(0, 10)` when the zone is missing. That is the UTC date. Phase 1 deletes the fallback.

`service-speed-lookup.service.ts` falls back to `'UTC'` inside `businessDateForTimezone`. Phase 1 fails closed instead.

## API

Accept an instant only as RFC 3339 with `Z` or a numeric offset. Normalize to UTC in the service before business logic. Reject a date-only string where an instant is required. Civil dates stay `YYYY-MM-DD`. Shop appointments ("ready at 17:00") arrive as civil fields. The server resolves them with the documented scope. A typed daylight-saving gap or overlap is rejected unless the form captured earlier or later. A computed gap advances. A computed overlap uses the earlier offset.

## SQL

Civil date of an instant:

```sql
(occurred_at AT TIME ZONE business_timezone)::date
```

Half-open UTC range of a stored civil day:

```sql
occurred_at >= (business_date::timestamp AT TIME ZONE business_timezone)
AND occurred_at <  ((business_date + 1)::timestamp AT TIME ZONE business_timezone)
```

`occurred_at::date` is not a business day.

## Conversion, when a migration is actually written

Follow the expand-and-contract steps in the rule. Do not read the naive column as UTC while the sample is unfinished. Readers use the `timestamptz` twin, or show no clock.

1. Prove one stored clock for the rows being converted.
2. Add the `timestamptz` twin. Do not drop the source.
3. Dual-write from one authoritative instant.
4. Backfill in bounded batches with the `USING` clause the sample proved. Keep mixed rows out of the batch.
5. Move readers, then stop the legacy writer.
6. Drop the old column only in a later reviewed migration.

The backfill clause is one of these, and only after step 1:

```sql
-- Proven: app wrote a UTC ISO string, or now() AT TIME ZONE 'UTC'. Sample rows listed in the migration.
ALTER TABLE org_example ALTER COLUMN col TYPE timestamptz USING col AT TIME ZONE 'UTC';

-- Proven: column was filled by now() while the session TimeZone was Asia/Muscat. Sample rows listed in the migration.
ALTER TABLE org_example ALTER COLUMN col TYPE timestamptz USING col AT TIME ZONE 'Asia/Muscat';
```

If a sample shows both shapes in one column, or does not prove one clock, stop. Do not convert that column in the batch. A comment that asserts a clock is written only after the sample.

After the user applies the migration, regenerate Prisma with `npm run prisma:pull` from the repo root. Do not hand-edit `schema.prisma` to pretend the pull happened.

## i18n

New errors (missing zone, rejected naive datetime, nonexistent local time) need keys in `web-admin/messages/en/**` and `web-admin/messages/ar/**`. Reuse an existing key when the wording already matches. Pass the resolved string through `cmxMessage` when the failure is transient feedback.

## Permissions, navigation, flags

No new permission and no new navigation entry. The organization and branch zone screens already exist. This program does not add a feature flag. Failing closed when the zone is missing is the behavior, including where a zone was previously defaulted.
