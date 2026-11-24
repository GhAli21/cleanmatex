# Developer guide

Read [`docs/dev/rules/time-and-timezone.md`](../../dev/rules/time-and-timezone.md) before editing a date. This guide is how to land that rule in the current code.

## What already exists

| Piece | Role | Limit |
|---|---|---|
| `web-admin/lib/utils/business-date.ts` | `isValidTimeZone`, `businessDateForTimezone` | Does not resolve branch then organization |
| `web-admin/lib/utils/tenant-timezone.server.ts` | Organization zone for `next-intl` | Not the branch clock. `undefined` lets the viewer zone through |
| `web-admin/app/layout.tsx` | Passes `getTenantTimeZone()` into providers | Organization only |
| `web-admin/lib/commercial/calendar.ts` | Working-calendar math with an explicit zone | Keep it. Do not open-code a second calendar |
| `org_pos_sessions_mst` | `opened_at`, `business_date`, `business_timezone` | The write shape for a new business day |
| `sys_timezone_cd` | Allowed IANA codes | `utc_offset_hours` is display metadata |

`getTenantTimeZone` stays. Add a resolver beside it. Do not make the organization helper silently start returning a branch zone, or every screen that meant "organization" changes meaning.

## Resolver

```text
branch timezone_code if valid and active in sys_timezone_cd
else organization timezone if valid and active
else null
```

Callers that assign a business date, a ready-by, a document number, or a local schedule stop when the result is null. Callers that format an absolute operational date render a skeleton, not a UTC clock.

## Read path that is safe before any migration

`org_orders_mst.ready_by` is `@db.Timestamp(6)`. `ready_by_at_new` is `@db.Timestamptz(6)`. Every display, print, notification, and report reads `ready_by_at_new` first. A null twin is an empty Ready By until Phase 2 backfills it. Do not parse `ready_by` as local time.

## Writes that are wrong today

`web-admin/lib/notifications/campaign-jobs.service.ts` assigns `now() AT TIME ZONE 'UTC'` into campaign timestamps. That expression yields `timestamp without time zone` (UTC wall). It is only correct while every reader treats that column as a UTC wall clock. Phase 2 replaces those columns with `timestamptz` and assigns `now()`.

`speed-rules.service.ts`, `prepaid-tax.service.ts`, and `tax-lines.writer.ts` fall back to `toISOString().slice(0, 10)` when the zone is missing. That is the UTC date. Phase 1 deletes the fallback.

`service-speed-lookup.service.ts` falls back to `'UTC'` inside `businessDateForTimezone`. Phase 1 fails closed instead.

## API

Accept an instant only as RFC 3339 with `Z` or a numeric offset. Normalize to UTC in the service before business logic. Reject a date-only string where an instant is required. Civil dates stay `YYYY-MM-DD`. Shop appointments ("ready at 17:00") arrive as civil fields. The server applies the operations zone.

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

Pick one, and record which, in the migration comment:

```sql
-- Naive value is a UTC wall clock (app wrote a UTC ISO string, or now() AT TIME ZONE 'UTC'):
ALTER TABLE org_example ALTER COLUMN col TYPE timestamptz USING col AT TIME ZONE 'UTC';

-- Naive value is Muscat wall (column was filled by now() while TimeZone was Asia/Muscat):
ALTER TABLE org_example ALTER COLUMN col TYPE timestamptz USING col AT TIME ZONE 'Asia/Muscat';
```

If a sample shows both shapes in one column, stop. Do not convert that column in the batch.

After the user applies the migration, regenerate Prisma with `npm run prisma:pull` from the repo root. Do not hand-edit `schema.prisma` to pretend the pull happened.

## i18n

New errors (missing zone, rejected naive datetime, nonexistent local time) need keys in `web-admin/messages/en/**` and `web-admin/messages/ar/**`. Reuse an existing key when the wording already matches. Pass the resolved string through `cmxMessage` when the failure is transient feedback.

## Permissions, navigation, flags

No new permission and no new navigation entry. The organization and branch zone screens already exist. This program does not add a feature flag. Failing closed when the zone is missing is the behavior, including where a zone was previously defaulted.
