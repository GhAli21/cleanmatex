---
title: Time and Timezone
last_updated: 2026-11-24
owner: CleanMateX Team
---

# Time and Timezone

This document is the canonical rule for every instant, civil date, local
time-of-day, schedule, log timestamp, and audit timestamp in CleanMateX
(`web-admin`, `cmx-api`, workers, SQL functions, and exports).

Cursor loads the short form from `.cursor/rules/time-and-timezone.mdc`.
This file wins when the two differ.

## Rule

Store, transmit, compare, log, schedule, and audit **instants in UTC**.
Convert an instant to a local clock only in the presentation layer, and only
with an explicit IANA zone.

Store a **civil date** or a **local time-of-day** as a calendar fact in a
named place. Assign it once. Do not derive it again from UTC on later reads,
and do not turn it into a UTC instant in storage.

The operations clock is the location's zone, then the organization's zone.
The viewer's laptop zone is not an operations clock.

## Three kinds of time

Classify every value before choosing a type. A value has one kind.

| Kind | Meaning | Stored as | Wire format | Example |
|---|---|---|---|---|
| Instant | A point on the timeline | `timestamptz` | RFC 3339 UTC with `Z` | Payment posted, job fires, lockout ends, `opened_at` |
| Civil date | A calendar day in a named zone | `date` | `YYYY-MM-DD` | POS `business_date`, fiscal day, document date |
| Local time-of-day | A wall-clock time that repeats each day in a named zone | `time` or `HH:mm` in JSON | `HH:mm` or `HH:mm:ss` | Opening hours, cutoff, quiet-hours start |

A promised ready-by is an instant that was **computed** from civil rules
(opening hours, cutoff, holidays in the location zone). Persist the resulting
UTC instant. Keep the zone id that was used when a later reader must explain
the promise.

A duration (lockout length, "try again in N minutes", SLA elapsed) is a
difference of two instants. Compute it from UTC instants. Do not convert
either side to a local wall clock before subtracting.

Locale, `date_format`, `time_format`, and `first_day_of_week` change how a
value is written for a person. They do not change the instant or the civil
date. English and Arabic render the same instant in the same zone; month
names, digits, and clock style follow the locale.

## Which zone

IANA names only (`Asia/Muscat`). Offsets (`+04:00`, `GST`) are not stored on
tenant, branch, schedule, or audit rows. `sys_timezone_cd.utc_offset_hours`
and `utc_offset_string` are catalog display metadata. Conversion uses the
IANA name through `Intl` or PostgreSQL `AT TIME ZONE '<iana>'`. Never add
`utc_offset_hours` to an instant.

| Use | Zone |
|---|---|
| Operations UI, receipts, PDFs, customer messages, reports, order-number day, POS business day, opening hours, quiet hours, ready-by | Location, then organization |
| Infrastructure cron (`pg_cron`, platform cleanup) | UTC, and the operator screen says UTC |
| Personal page before an organization exists | Viewer zone |
| Authoritative server timestamps (`created_at`, `posted_at`, audit `occurred_at`) | UTC instant from the database clock |

Resolution for an operation that belongs to a branch:

1. `org_branches_mst.timezone_code` when it is a valid, active `sys_timezone_cd.code`.
2. Otherwise `org_tenants_mst.timezone` when it is a valid, active catalog code.
3. Otherwise there is no operations zone.

`null` branch `timezone_code` means "inherit the organization". It does not
mean "use the server" or "use the browser".

A missing or invalid operations zone **fails closed**:

- Refuse an operation that must assign a business date, open a POS session,
  number a document, schedule a local send, or compute a ready-by. The error
  tells the user to set the branch or organization zone.
- Do not paint an absolute date. Use a skeleton or an explicit unavailable
  state until the zone is known.
- Do not fall back to `UTC`, `Asia/Muscat`, the database session zone, the
  Node process zone, or the browser zone for that operation.

`getTenantTimeZone` (`web-admin/lib/utils/tenant-timezone.server.ts`) returns
the organization zone only. It is not the branch resolver. `next-intl`'s
viewer fallback is limited to pages that are not operational. Operational
screens pass the resolved operations zone in before the first absolute date
is rendered.

Validate a configured zone with `isValidTimeZone` and require that code in
active `sys_timezone_cd`. A historical snapshot may still be formatted with
`Intl` after the catalog row is deactivated. New writes of a zone
configuration use an active catalog code only.

Do not add a column default for a timezone. Do not rely on the legacy
`org_tenants_mst.timezone` default of `Asia/Muscat`. A create flow persists
the zone the operator or HQ selected.

There is no per-user display zone in the back office. Staff in another
country see the location's clock, because the receipt, the promise, and the
business day belong to the shop.

## Clocks

These are UTC:

- PostgreSQL `TimeZone` for the database and for roles the app uses
- `TZ` on Node, workers, and containers
- Log pipelines and queue payloads
- The comparison clock inside workers (`next_run_at <= now()`)

Session UTC is defense in depth. Correctness still comes from `timestamptz`
and from naming the IANA zone at every conversion. A function that is right
only while the session happens to be UTC is wrong.

Authoritative instants are taken from the database clock (`now()` on a
`timestamptz` column or an explicit `timestamptz` assignment). The browser
clock, the laptop timezone, and `Date.now()` on a request handler are not
`created_at`, `posted_at`, or audit time. A device-observed instant, when a
feature truly has one, is a separate column, arrives as RFC 3339, and is
stored beside the server `received_at`. It never replaces the server instant.

## Storage

New columns:

| Kind | PostgreSQL | Prisma |
|---|---|---|
| Instant | `timestamptz` | `@db.Timestamptz(6)` |
| Civil date | `date` | `@db.Date` |
| Local time-of-day | `time` | `@db.Time(6)` |
| IANA zone | `TEXT` | `String` (no `@db.VarChar`) |

`timestamp without time zone` / Prisma `@db.Timestamp` is not a legal type
for a new instant. That includes `created_at`, `updated_at`, `scheduled_at`,
`locked_until`, `ready_by`, and every "when did this happen" column.

`COMMENT ON` every time column with its kind and, for a civil value, which
zone column interprets it. Examples:

- `occurred_at`: Instant (UTC). Assigned from the database clock.
- `business_date`: Civil date in `business_timezone` at the time it was assigned. Immutable.
- `opens_at`: Local time-of-day in the location zone. Not an instant.

The reference shape is `org_pos_sessions_mst`: `opened_at timestamptz`,
`business_date date`, `business_timezone text`, written together.

When a system action assigns the business day, write all three in the same
transaction:

- the instant (`timestamptz`)
- `business_date` = the calendar date of that instant in the operations zone
- `timezone_code` = the IANA name used

Use `businessDateForTimezone` (`web-admin/lib/utils/business-date.ts`) or the
SQL expression in [SQL conversions](#sql-conversions). After commit, those
three are immutable. Changing the organization or branch zone later does not
update them, does not renumber issued document codes, and does not move a
closed fiscal day.

A user-chosen document date (a backdated note, a selected business day) is
stored as the chosen `date`, validated against the product rule, and is not
overwritten from the server clock. The row still stores the server instant of
the entry as a separate column.

Ledger `posted_at` stays an instant. The accounting date stays a civil date.
Reports and closes read the civil date. They do not recompute it from
`posted_at` on read.

Day-based human codes (`ORD-20261105-0002` and the rest of
`sys_doc_seq_type_cd`) use the operations-zone civil date frozen at issue
time.

Opening hours, cutoff (`org_branches_mst.order_cutoff_time`), ready time
(`ready_time`), and quiet-hours windows stay local time-of-day in the
operations zone. Working-calendar math goes through
`web-admin/lib/commercial/calendar.ts`, which takes an explicit zone.

## SQL conversions

`AT TIME ZONE` is easy to invert. Use only these two shapes.

Civil date of an instant. The left side is `timestamptz`. The result is a
wall clock, then a `date`. Do not store that wall clock back into an instant
column.

```sql
(occurred_at AT TIME ZONE business_timezone)::date
```

Half-open UTC range of a civil day. `business_date::timestamp` is midnight
with no zone; `AT TIME ZONE business_timezone` interprets that midnight in
the named zone and yields `timestamptz`.

```sql
occurred_at >= (business_date::timestamp AT TIME ZONE business_timezone)
AND occurred_at <  ((business_date + 1)::timestamp AT TIME ZONE business_timezone)
```

Forbidden in SQL:

- `occurred_at::date`, `date_trunc('day', occurred_at)`, or `DATE(occurred_at)` as a business day. Those follow the session zone and yield the UTC date when the session is UTC.
- Comparing `timestamp without time zone` to `now()`. `now()` is coerced through the session zone. This is the bug that released notification batches four hours early and that reported a 15-minute lockout as 255 minutes while the database session was `Asia/Muscat`.
- Casting a naive UTC wall clock with `AT TIME ZONE 'Asia/Muscat'` or `AT TIME ZONE 'UTC'` without a column comment that states which zone the naive value already is.
- `SECURITY DEFINER` functions that cast between `timestamp` and `timestamptz` without an explicit zone. Prefer `timestamptz` end to end. A function that must set a zone sets `TIME ZONE 'UTC'` on the function and still names the IANA zone at each civil conversion.

Index the access path you actually filter:

- Tenant-first btree on `business_date` for day lists and closes.
- Tenant-first btree on the `timestamptz` for instant ranges and job claims.
- Do not wrap the indexed instant in `AT TIME ZONE` inside the predicate. Compute the UTC bounds once and compare the bare column.

## API, server actions, workers, webhooks

Instants in JSON, server-action payloads, queue bodies, and webhooks:

- Shape: `2026-11-24T03:36:00.000Z` (RFC 3339, `Z` only on output).
- Accept an input that carries `Z` or an explicit numeric offset, then normalize to UTC before any business logic.
- Reject a datetime that has no offset. Reject `YYYY-MM-DD` where an instant is required. Reject a bare time where a date is required.

Civil dates travel as `YYYY-MM-DD`. The field's contract states that it is
the operations-zone business date (or a user-chosen document date). It is not
midnight UTC.

Local time-of-day travels as `HH:mm` or `HH:mm:ss` together with the zone
that the server will apply. The client does not convert it.

The API does not return a pre-formatted absolute date as the source of truth.
A rendered receipt or PDF string is presentation and is labeled as such; the
structured instant or civil date is still present.

A date-time the operator enters for the shop ("ready at 17:00") is submitted
as civil fields. The server applies the operations zone and stores one UTC
instant. The browser zone does not take part.

CSV and other imports: an instant column is RFC 3339 UTC, or a civil datetime
plus a timezone column. Reject the row when neither is true. Exports that
humans read include the UTC instant and, when the screen is about a business
day, the civil date and the zone id. A local datetime with no zone is not an
export format.

Sort and cursor-paginate by the instant or by the civil date, never by a
formatted string. Cache keys that mean "today" include the civil date and the
zone id.

## Schedules

| Schedule means | Source of truth | What the worker compares |
|---|---|---|
| "At this moment" or "every N minutes" | `timestamptz` | `next_run_at <= now()` |
| "09:00 at this shop", quiet hours, opening | local time-of-day + IANA zone | a materialized `next_run_at timestamptz` |
| Platform cron | UTC cron expression | UTC, and the UI says UTC |

Materialize the next fire in the operations zone, store that UTC instant, and
let the worker compare instants only. After a fire, compute the following
fire in the zone and store UTC again.

Unsent materialized instants are derived. When the operations zone or the
civil rule changes, recompute unsent `scheduled_at` from the rule. Fired,
sent, and historical rows stay as they were.

Daylight-saving and other offset gaps:

- A person picked a local time that does not exist (spring forward): reject it and ask for a valid time.
- A computed next fire falls in a gap: advance to the next valid local time, store that UTC instant, and record the adjustment on the job row or in the UTC log.
- A local time happens twice (fall back): use the earlier offset, store the resulting UTC instant.

Do not implement this with `utc_offset_hours`.

## UI

One formatting path. Feature code does not call `Date#toLocaleString`,
`toLocaleDateString`, `date-fns` `format`, or `dayjs` without an explicit
zone. Format with `Intl.DateTimeFormat` / `next-intl`, passing the operations
zone.

The server resolves the zone and supplies it before the first absolute date
paints. A loading skeleton is the waiting state. The first paint and every
later paint use the same zone. This is the rule that prevents a Ready By
value from appearing in UTC and then jumping four hours after the tenant zone
loads.

On a single-location screen, show the zone once in the page context. In a
list that can contain more than one operations zone, format each row with
that row's zone and show the zone abbreviation on the row.

Relative phrases ("5 minutes ago") are allowed and need no zone. Absolute
clock times use the operations zone.

Date pickers for a business day submit `YYYY-MM-DD`. Time pickers submit
`HH:mm`. Date-time pickers for a shop appointment submit civil fields. None
of them submit the result of `new Date()` local getters.

Print and PDF roots format with the same operations zone used on screen and
name that zone in the document header.

Customer-visible text (notification, receipt, WhatsApp, email) uses the
operations-zone calendar day of the relevant instant. An order created at
23:30 in Muscat names that local day, including when UTC is still the
previous date.

## Logs and audit

Logs are UTC ISO-8601. Put `tenant_org_id` on the line. When the line is
about a civil decision, add the zone id and the civil date as fields. Do not
write the message itself in local time.

Audit and domain event rows:

- `occurred_at timestamptz` from the database clock
- `timezone_code` when the action used an operations zone
- `business_date` when the action assigned or changed a civil date

Do not store a second local timestamp as another source of truth. "What the
cashier saw" is rendered on read from the instant plus the snapshotted zone,
or read from the snapshotted civil date. An IANA database update cannot move
a frozen `business_date`.

## Application code

Allowed:

- `toISOString()` to transmit an instant
- `new Date(rfc3339WithOffset)` to parse an instant, then store UTC
- `isValidTimeZone` and `businessDateForTimezone` for civil dates
- `Intl.DateTimeFormat` with an explicit `timeZone` option
- Calendar helpers in `web-admin/lib/commercial/calendar.ts` with the resolved zone

Forbidden:

- `new Date('2026-11-24')` and `new Date('2026-11-24 17:00:00')` (no offset; ECMAScript treats the date-only form as UTC midnight and the space form as implementation-defined)
- `toISOString().slice(0, 10)` as a business date (that is the UTC date)
- `getHours`, `getDate`, `getDay`, `setHours`, `setDate` for anything a person sees or for a business-day boundary. Those follow the process zone. Process UTC does not make them the operations zone.
- Formatting an absolute date when the operations zone is still unknown
- Building a day range with local midnight on the server
- Reading a legacy naive instant when a `timestamptz` twin exists. Readers use the `timestamptz` column (for example `ready_by_at_new`, not `ready_by`).

Start and end of an operations day are computed in the operations zone, then
converted to a UTC half-open range `[start, nextStart)`.

## Legacy columns

Existing `timestamp without time zone` instant columns are defects. Do not
copy them. Do not add a new reader, writer, or index on one in unrelated
work.

When a task has to touch such a column:

- Prefer the `timestamptz` twin if one exists.
- A conversion of stored data is its own reviewed migration. Do not rewrite
  historical rows from an unrelated change.
- Until that migration exists, a comment at the read site states that the
  naive value is a UTC wall clock, and the comparison or parse uses an
  explicit UTC interpretation. Matching the current session zone is not an
  interpretation.

This rule does not authorize a bulk migration by itself.

## Tests

Touching storage, conversion, scheduling, formatting, or business-day
assignment includes tests for the cases that apply:

| Case | Assert |
|---|---|
| Instant at 21:00Z with zone `Asia/Muscat` | Civil date is the next calendar day (`2026-10-03T21:00:00Z` → `2026-10-04`) |
| Same instant, two zones | Two different local clocks; one stored UTC value |
| "09:00" in `Asia/Muscat` | Stored and fired at `05:00Z` |
| Half-open day range | An event at the next local midnight is excluded |
| Missing zone | The business-date operation is refused; the UI does not paint an absolute date |
| Client in another zone | A submitted "17:00" shop time still converts with the location zone |
| Zone edited later | Existing `business_date`, document numbers, and fired jobs stay |
| Duration | 15 minutes of lockout displays as 15 minutes |
| Daylight-saving gap | Picked local time is rejected; computed next fire advances and records it |
| Daylight-saving overlap | The earlier offset wins |
| Naive datetime payload | API rejects it |
| `occurred_at::date` | Not used as a business-day filter |

A Gulf tenant with no daylight saving does not remove the daylight-saving
tests. The product will gain a tenant whose zone has one.

## Review checklist

- The value's kind is instant, civil date, or local time-of-day, and the column type matches.
- Instants are `timestamptz` and leave the process as RFC 3339 with `Z`.
- Civil dates are assigned once with the operations zone and a snapshotted zone id.
- No conversion uses `utc_offset_hours`, a hardcoded `+04:00`, or `Asia/Muscat` as a fallback.
- SQL comparisons and casts name an IANA zone. Predicates stay sargable.
- The UI waits for the operations zone and formats only there.
- Schedules the shop thinks of in local time are stored as a civil rule plus a UTC fire time.
- Logs are UTC. Audit rows store the instant and, for a civil decision, the zone and the date.
- Durations subtract instants.
- Legacy naive instant columns are not extended.

## Related code

- `web-admin/lib/utils/business-date.ts` — `isValidTimeZone`, `businessDateForTimezone`
- `web-admin/lib/utils/tenant-timezone.server.ts` — organization zone for display
- `web-admin/lib/commercial/calendar.ts` — working-calendar math with an explicit zone
- `org_tenants_mst.timezone` — organization IANA zone
- `org_branches_mst.timezone_code` — optional location override (`sys_timezone_cd`)
- `org_pos_sessions_mst.opened_at`, `.business_date`, `.business_timezone` — reference shape
- `sys_timezone_cd` — allowed IANA codes; offset columns are not for conversion

The implementation and migration program is `docs/features/Time_and_Timezone/`. This rule is the contract. That pack is the sequence for bringing existing columns and screens up to it. A column is not converted until its stored clock is identified.
