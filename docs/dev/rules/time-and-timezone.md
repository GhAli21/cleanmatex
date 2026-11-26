---
title: Time and Timezone
last_updated: 2026-11-25
owner: CleanMateX Team
---

# Time and Timezone

This document is the canonical rule for every instant, civil date, local
time-of-day, schedule, log timestamp, and audit timestamp in CleanMateX
(`web-admin`, `cmx-api`, workers, SQL functions, and exports).

Cursor loads the short form from `.cursor/rules/time-and-timezone.mdc`.
This file wins when the two differ.

## Rule

Persist, transmit, compare, log, schedule, and audit **instants as UTC timeline
values**. PostgreSQL `timestamptz` represents an instant; it does not retain
the zone originally supplied. Convert an instant for display only in the
presentation layer, with an explicit IANA zone. Trusted server or database
business logic may also convert an instant with an explicit authoritative
IANA zone when it assigns a civil date, resolves a local schedule, calculates
a ready-by promise, or applies another documented business rule.

Store a **civil date** or a **local time-of-day** as a calendar fact in a
named place. Assign it once. Do not derive it again from UTC on later reads,
and do not turn it into a UTC instant in storage.

The operations clock is the feature's documented scope, then the
organization's zone. The viewer's laptop zone is not an operations clock. A
zone sent by the client is an echo for a stale-form check, not the authority.

## Time value shapes

Classify every value before choosing a type. Do not use one shape as a
substitute for another.

| Kind | Meaning | Stored as | Wire format | Example |
|---|---|---|---|---|
| Instant | A point on the timeline | `timestamptz` | RFC 3339 UTC with `Z` | Payment posted, job fires, lockout ends, `opened_at` |
| Civil date | A calendar day in a named zone | `date` | `YYYY-MM-DD` | POS `business_date`, fiscal day, document date |
| Local time-of-day | A wall-clock time that repeats each day in a named zone | `time` or `HH:mm` in JSON | `HH:mm` or `HH:mm:ss` | Opening hours, cutoff, quiet-hours start |
| Local civil date-time | A date and wall-clock time that has not yet been resolved to an instant | Civil fields plus IANA zone until resolved; normally a `timestamptz` after resolution | `{ date, time, timeZone, disambiguation }` | Shop appointment entered as "01:30 in New York" |
| Duration | An elapsed or configured amount of time | Integer unit or `interval`, according to the field contract | Explicit unit or ISO 8601 duration | Lockout length, SLA elapsed, retry delay |

A local civil date-time is not an instant until the server resolves it with
an authoritative IANA zone and an explicit daylight-saving disambiguation
policy. Do not store it as `timestamp without time zone` and later guess the
zone. Persist the original civil fields as well only when the product must
retain the user's rule or intent.

A promised ready-by is an instant that was **computed** from civil rules
(opening hours, cutoff, holidays in the location zone). Persist the resulting
UTC instant. Keep the zone id that was used when a later reader must explain
the promise.

An elapsed duration (lockout length, "try again in N minutes", SLA elapsed)
is a difference of two instants. Compute it from UTC instants. Do not convert
either side to a local wall clock before subtracting. A configured calendar
period such as "one month" is a civil rule, not a fixed elapsed duration.

Locale, `date_format`, `time_format`, and `first_day_of_week` change how a
value is written for a person. They do not change the instant or the civil
date. English and Arabic render the same instant in the same zone; month
names, digits, and clock style follow the locale.

## Which zone

IANA names only (`Asia/Muscat`) are authoritative timezone configuration.
Offsets (`+04:00`) and abbreviations (`GST`) do not replace an IANA zone on
tenant, branch, or schedule rows. `sys_timezone_cd.utc_offset_hours` and
`utc_offset_string` are catalog display metadata. Conversion uses the IANA
name through the shared resolver (`resolveOperationalTimeZone` in the app,
`fn_ops_zone` in SQL) or PostgreSQL `AT TIME ZONE` with a zone that resolver
already returned.
Never add `utc_offset_hours` to an instant. A resolved offset may be stored
beside the instant and IANA zone as immutable legal or audit evidence when a
feature must reproduce exactly what was printed or shown; it is never used
to calculate a future occurrence.

| Use | Zone |
|---|---|
| Operations UI, receipts, PDFs, customer messages, reports, order-number day, POS business day, opening hours, quiet hours, ready-by | The feature's documented scope, then the organization |
| Infrastructure cron (`pg_cron`, platform cleanup) | UTC, and the operator screen says UTC |
| Personal page before an organization exists | Viewer zone |
| Authoritative server timestamps (`created_at`, `posted_at`, audit `occurred_at`) | UTC instant from the database clock |

The authoritative scope depends on the event, not on the current viewer:

- order acceptance: receiving branch
- ready-by promise: fulfilment or processing branch
- POS session and payment: POS branch
- pickup or delivery appointment: service location
- invoice and tax point: issuing legal entity and its documented tax rule
- ledger posting: accounting entity and fiscal-period rule
- cross-branch report: each row's snapshotted scope, or an explicitly selected reporting zone

Every feature that can involve more than one branch or legal entity documents
which scope owns its civil decision. It does not infer that scope from the
viewer's default branch.

Resolution for an operation that belongs to a branch:

1. `org_branches_mst.timezone_code` when it is a valid, active `sys_timezone_cd.code`.
2. Otherwise `org_tenants_mst.timezone` when it is a valid, active catalog code.
3. Otherwise there is no operations zone.

The server-side resolver receives `tenant_org_id`, the authoritative scope id,
and the operation kind. It verifies that the branch or entity belongs to the
tenant and resolves the zone from server-owned configuration. A zone supplied
by a client may be echoed for stale-form detection, but it is never trusted to
assign a business date, number a document, post accounting, or schedule work.

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

Do not deactivate a catalog zone while an active tenant, branch, or schedule
references it. A zone replacement is audited, previews affected future work,
recomputes only unfired derived instants, invalidates affected caches, and
does not rewrite historical rows.

A create flow persists the zone the operator confirmed. Public registration
suggests the browser locale (`registration-browser-defaults.ts`) and stores
the confirmed value. That suggestion is not an operations clock.
`org_tenants_mst.timezone` may default to `UTC` only so an insert that omits
the column still stores a real zone. Readers still fail closed when the value
is null or invalid. They do not substitute that default, or a legacy
`Asia/Muscat` default, at read time.

There is no per-user display zone in the back office. Staff in another
country see the shop's clock, because the receipt, the promise, and the
business day belong to the shop.

## One policy, two doors

One policy answers "which zone applies." Two doors implement it. A screen, a
report, a SQL function, HQ, or a mobile app does not keep a third copy.

| Door | Who calls it | Status |
|---|---|---|
| `resolveOperationalTimeZone({ tenantOrgId, operation, scopeId })` in `web-admin` | Services, route handlers, server actions, report queries issued by the app | To be added beside `business-date.ts`. It does not exist yet |
| `fn_ops_zone(tenant, operation, scope)` in PostgreSQL | SQL functions, triggers, report SQL, and HQ when it reads tenant rows | To be added in a new migration. It does not exist yet |

Both doors take the tenant, the operation, and the scope id. Both confirm
the scope belongs to the tenant. Both return that scope's IANA zone, then
the organization zone. Both return no zone when neither value is a valid
active catalog code. The feature names the scope. The door does not guess it
from the branch on the screen.

Who stores the zone: an administrator, on the organization and branch
settings screens. An empty branch `timezone_code` means inherit the
organization.

When the door runs: at the instant the feature assigns a business day, shows
an operational clock, numbers a document, or schedules local work. The
business record already has the branch or legal entity that owns the action.

After that assignment, readers use the instant, the civil date, and the IANA
zone stored on the row. They do not call the door again for that frozen day.

There is no React context that holds one zone for the session. A till, a
ready-by promise, and a delivery stop on the same page can each have a
different zone. Page chrome before a branch is in play may use
`getTenantTimeZone()`, which is the organization zone only.

### Who formats, and with which zone

| Surface | Zone it uses |
|---|---|
| Tenant web screen for one action | The door's result for that action's scope, passed in before the first absolute time paints |
| Mixed-branch list, report, or print | Each row's snapshotted zone, joined in the same query. A report the user limited to one reporting zone uses that chosen zone and says so |
| Accounting and tax reports | The civil date stored at posting. They do not recompute it from `posted_at` |
| Print and PDF | The same zone as the screen, named in the document header |
| SMS, email, WhatsApp | The zone of that event. A missing zone omits the clock |
| Export | The instant in UTC, plus the civil date and the zone id |
| `cmx-api` and public booking | The same door as web-admin. Responses emit instants as UTC with `Z` and include the zone id when the caller must format a shop clock |
| Mobile booking, tracking, and the shared picker | Civil date and local time go up. The phone zone is an echo. The shop clock comes back from the API |
| Jobs and the outbox | The worker compares the stored UTC `next_run_at` to `now()`. The zone was applied when that instant was calculated |
| Webhooks | An inbound instant includes an offset. An outbound instant is `Z` |
| Logs | UTC. A civil decision also records the zone id and the civil date |
| HQ UI and HQ API, for HQ's own work | `hq_general_config.timezone` for HQ and SYS documents. Platform cron is UTC, and the HQ screen says UTC |
| HQ UI and HQ API, for a tenant's shop | The tenant door, or the snapshot on the tenant row. The HQ operator's laptop and the HQ config zone do not replace the tenant zone |
| Registration | The browser suggestion the visitor confirms. Stored as the organization zone |

HQ application code lives in `cleanmatexsaas`. It calls `fn_ops_zone` or
reads the snapshot. It does not grow a second copy of the scope rules. Name
every HQ reader before converting a column those readers use.

Tenant document numbering fails closed when the tenant zone is missing. It
does not substitute the HQ zone. SYS and HQ document types keep the HQ clock.
`fn_doc_seq_next` still substitutes the HQ zone today. The setup-health
holiday check still substitutes `UTC`. Both wait for a new migration.

### Performance

Resolve once per action. That is one indexed read of the scope and the
organization.

| Path | Fast shape |
|---|---|
| Save, issue, or schedule | One door call. The transaction writes the instant, the civil date, and the zone together |
| List and report filter | Compare a stored `date` or a bare `timestamptz`. Compute the UTC bounds of the civil day once, then use the index |
| Later read of an issued row | Read the snapshot. A later zone edit does not rewrite the row |
| One-branch screen | Resolve once per request and pass the IANA name down. `Intl` formats in the presentation layer |
| Mixed-branch list | Join each row's zone in the same statement. Do not call the door once per row |
| Due job | Compare `next_run_at` to `now()` |
| Same scope again in one request | Reuse the resolved zone for the rest of that request only |

A TTL cache must not answer which civil day a new action belongs to. The day
is the snapshot on the row, or a fresh resolution. Request-scoped reuse does
not cross tenants and does not outlive the request.

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

PostgreSQL `now()` / `transaction_timestamp()` is the transaction-start
instant. That is desirable when all facts in one transaction need one clock.
Worker claim transactions stay short. Use `clock_timestamp()` only when the
feature explicitly needs the changing wall clock during a long statement or
transaction; do not mix the two clocks accidentally.

When a persisted instant and a civil date derived from it are written
together, capture one database instant and derive both values from it in the
same transaction. Do not calculate the civil date from application
`new Date()` while PostgreSQL independently supplies the persisted instant.

## Storage

New columns:

| Kind | PostgreSQL | Prisma |
|---|---|---|
| Instant | `timestamptz` | `@db.Timestamptz(6)` |
| Civil date | `date` | `@db.Date` |
| Local time-of-day | `time` | `@db.Time(6)` |
| IANA zone | `TEXT` | `String` (no `@db.VarChar`) |

Prisma maps PostgreSQL `date` and `time` through JavaScript `Date` values.
Those objects are persistence adapters, not domain instants. Repository and
service boundaries expose a civil date as `YYYY-MM-DD` and a local time as
`HH:mm` or `HH:mm:ss`; they do not serialize a Prisma `Date` directly or pass
it through an instant formatter.

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

The current POS rule defines `business_date` as the calendar date in the
resolved branch zone, with a midnight boundary. This is an explicit product
rule, not a universal ERP assumption. If CleanMateX later supports a
non-midnight operational-day start, that policy is versioned and snapshotted
separately; do not silently change the meaning of existing `business_date`
rows.

When a system action assigns the business day, write all three in the same
transaction:

- the instant (`timestamptz`)
- `business_date` = the calendar date of that instant in the operations zone
- `timezone_code` = the IANA name used

For a persisted bundle, prefer one SQL statement that captures the database
instant and derives the civil date from it. `businessDateForTimezone`
(`web-admin/lib/utils/business-date.ts`) is valid when its caller supplies the
authoritative instant explicitly; its default application clock is not valid
for assigning a persisted event's business date. After commit, the instant,
civil date, and snapshotted zone are immutable. Changing the organization or
branch zone later does not update them, does not renumber issued document
codes, and does not move a closed fiscal day.

A user-chosen document date (a backdated note, a selected business day) is
stored as the chosen `date`, validated against the product rule, and is not
overwritten from the server clock. The row still stores the server instant of
the entry as a separate column.

Ledger `posted_at` stays an instant. The accounting date stays a civil date.
Reports and closes read the civil date. They do not recompute it from
`posted_at` on read.

Do not assume that calendar date, POS business date, document date,
accounting date, and tax-point date are interchangeable. The owning domain
defines and validates each one. Posted financial facts are corrected with a
reversal or adjustment, not by mutating their historical date context.

Day-based human codes (`ORD-20261105-0002` and the rest of
`sys_doc_seq_type_cd`) use the operations-zone civil date frozen at issue
time.

Opening hours, cutoff (`org_branches_mst.order_cutoff_time`), ready time
(`ready_time`), and quiet-hours windows stay local time-of-day in the
operations zone. Working-calendar math goes through
`web-admin/lib/commercial/calendar.ts`, which takes an explicit zone.

## SQL conversions

`AT TIME ZONE` is easy to invert. Prefer the following reviewed shapes and
parameterize dynamic zones; never concatenate a zone into SQL.

Civil date of an instant. The left side is `timestamptz`. The result is a
wall clock, then a `date`. Do not store that wall clock back into an instant
column.

```sql
(occurred_at AT TIME ZONE business_timezone)::date
```

Half-open UTC range of a requested civil day. Resolve the bounds once from
the requested date and already validated authoritative zone, then compare the
bare indexed instant. `business_date::timestamp` is midnight with no zone;
`AT TIME ZONE` interprets that midnight in the named zone and yields
`timestamptz`.

```sql
WITH bounds AS (
  SELECT
    ($1::date::timestamp AT TIME ZONE $2::text) AS start_at,
    (($1::date + 1)::timestamp AT TIME ZONE $2::text) AS end_at
)
SELECT event.*
FROM public.org_event_mst AS event
CROSS JOIN bounds
WHERE event.tenant_org_id = $3::uuid
  AND event.occurred_at >= bounds.start_at
  AND event.occurred_at < bounds.end_at;
```

`$2` is resolved and validated by the server. `$3` is always the authenticated
tenant. Replace the illustrative table with the real tenant-scoped table and
keep `tenant_org_id` visible in every `org_*` query and join.

Forbidden in SQL:

- `occurred_at::date`, `date_trunc('day', occurred_at)`, or `DATE(occurred_at)` as a business day. Those follow the session zone and yield the UTC date when the session is UTC.
- Comparing `timestamp without time zone` to `now()`. `now()` is coerced through the session zone. This is the bug that released notification batches four hours early and that reported a 15-minute lockout as 255 minutes while the database session was `Asia/Muscat`.
- Casting a naive timestamp with `AT TIME ZONE 'Asia/Muscat'` or `AT TIME ZONE 'UTC'` before a provenance sample has proven one stored clock for the rows being converted. A comment that names the clock is written only after that sample. The comment is not itself the proof.
- `SECURITY DEFINER` functions that cast between `timestamp` and `timestamptz` without an explicit zone. Prefer `timestamptz` end to end. A function that must set a zone sets `TIME ZONE 'UTC'` on the function and still names the IANA zone at each civil conversion. `SECURITY DEFINER` also requires a safe fixed `search_path`, tenant authorization inside the function or an explicitly documented service-role global scope, revoked default `PUBLIC` execution, and explicit grants to the intended role.

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
that the server will apply. For an authoritative operation the server resolves
that zone from the owned branch or entity; a client does not choose it. The
client does not convert the local time.

The API does not return a pre-formatted absolute date as the source of truth.
A rendered receipt or PDF string is presentation and is labeled as such; the
structured instant or civil date is still present.

A date-time the operator enters for the shop ("ready at 17:00") is submitted
as civil fields. The server applies the authoritative operations zone and an
explicit disambiguation policy, then stores one UTC instant. The browser zone
does not take part. The transport shape is explicit:

```json
{
  "date": "2026-11-01",
  "time": "01:30",
  "timeZone": "America/New_York",
  "disambiguation": "earlier"
}
```

For tenant operations, `timeZone` is returned or echoed for clarity and stale
configuration detection. The server verifies it against authoritative
configuration before use.

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

The durable source of truth for a civil schedule includes the local date or
recurrence rule, local time, IANA zone, disambiguation policy, and rule
version. `next_run_at` is a derived eligibility instant, not the complete
schedule definition.

Unsent materialized instants are derived. When the operations zone or the
civil rule changes, recompute unclaimed and unsent `scheduled_at` from the
rule. A rule or zone change does not race an already claimed occurrence.
Fired, sent, and historical rows stay as they were.

`next_run_at <= now()` establishes eligibility only; it does not guarantee
exactly-once execution. A production worker atomically claims work with a
bounded lease, records attempt state, and uses a unique idempotency key for
each logical occurrence. Provider submission is treated as at-least-once
unless the provider contract proves a stronger guarantee. At minimum retain
`claimed_at`, `lease_expires_at`, `attempt_count`, the logical occurrence or
idempotency key, rule version, and final outcome.

Daylight-saving and other offset changes use one shared resolver. The mode
depends on who chose the local time.

A person typed the local time:

- A time that does not exist (spring forward): reject it and ask for a valid time.
- A time that happens twice (fall back): reject it unless the form captured `earlier` or `later`, or the domain contract already declares that choice. Store the UTC instant for the chosen offset.

A schedule computed the local time:

- The next fire falls in a gap: advance to the next valid local time, store that UTC instant, and record the adjustment on the job row or in the UTC log.
- The next fire falls in an overlap: use the earlier offset, store that UTC instant, and record that the earlier offset was chosen.

The resolver returns both the instant and whether it was exact, gap-adjusted,
or overlap-disambiguated. Do not implement this with `utc_offset_hours`, raw
`Intl` formatting alone, or an untested direct `AT TIME ZONE` conversion.

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

On a single-scope screen, show the zone once in the page context. In a
list that can contain more than one operations zone, format each row with
that row's zone and show a label taken from the instant being shown. An
abbreviation alone is not sufficient because values such as `CST` and `IST`
identify more than one zone, and the same IANA zone changes abbreviation
and offset across the year. A summer instant in `America/Chicago` is
`America/Chicago — CDT (UTC-05:00)`. A winter instant in that zone is
`America/Chicago — CST (UTC-06:00)`. `Asia/Muscat` stays
`Asia/Muscat — UTC+04:00`.

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

Logs are UTC ISO-8601. Put `tenant_org_id` on the line. Where applicable add
`branch_id`, authoritative scope type/id, correlation id, execution id, and
actor or service identity. When the line is about a civil decision, add the
zone id and civil date as structured fields. Do not write the message itself
in local time or include unnecessary customer data.

Audit and domain event rows:

- `occurred_at timestamptz` from the database clock
- `timezone_code` when the action used an operations zone
- `business_date` when the action assigned or changed a civil date

Do not store a second local timestamp as another source of truth. "What the
cashier saw" is rendered on read from the instant plus the snapshotted zone,
or read from the snapshotted civil date. An IANA database update cannot move
a frozen `business_date`, but it can change the historical local rendering of
some instants. Where exact legal reproduction matters, also retain the
resolved offset or rendered evidence as a non-authoritative snapshot.

## Application code

Allowed:

- `toISOString()` to transmit an instant
- `new Date(rfc3339WithOffset)` to parse an instant, then store UTC
- `isValidTimeZone` and `businessDateForTimezone` for civil dates
- `Intl.DateTimeFormat` with an explicit `timeZone` option
- Calendar helpers in `web-admin/lib/commercial/calendar.ts` with the resolved zone
- The shared civil date-time resolver with an explicit DST disambiguation mode

Forbidden:

- `new Date('2026-11-24')` and `new Date('2026-11-24 17:00:00')` (no offset; ECMAScript treats the date-only form as UTC midnight and the space form as implementation-defined)
- `toISOString().slice(0, 10)` as a business date (that is the UTC date)
- `getHours`, `getDate`, `getDay`, `setHours`, `setDate` for anything a person sees or for a business-day boundary. Those follow the process zone. Process UTC does not make them the operations zone.
- Formatting an absolute date when the operations zone is still unknown
- Building a day range with local midnight on the server
- Reading a legacy naive instant when a `timestamptz` twin exists. Readers use the `timestamptz` column (for example `ready_by_at`, not legacy `ready_by`).
- Using `businessDateForTimezone` without an explicit authoritative instant to assign a persisted event's civil date
- Using a generic local-to-instant helper for operator-entered DST gap or overlap input unless it detects and applies the declared disambiguation policy

Start and end of an operations day are computed in the operations zone, then
converted to a UTC half-open range `[start, nextStart)`.

For the current POS rule, the operations-day boundary is local midnight. A
future non-midnight boundary must be a named, versioned domain policy; it is
not implemented by shifting UTC midnight.

## Legacy columns

Existing `timestamp without time zone` instant columns are defects. Do not
copy them. Do not add a new reader, writer, or index on one in unrelated
work.

When a task has to touch such a column:

- Prefer the `timestamptz` twin if one exists. Readers use the twin. A null twin shows no clock. Do not parse the naive column to fill the gap.
- A conversion of stored data is its own reviewed migration. Do not rewrite
  historical rows from an unrelated change.
- Until the provenance sample below has proven one stored clock for the rows
  being read, do not treat the naive value as a UTC wall clock, a Muscat wall
  clock, or any other clock. A comment that names a clock is allowed only
  after that sample. Matching the current session zone is not that proof.

This rule does not authorize a bulk migration by itself.

Every legacy conversion follows an expand-and-contract rollout:

1. Inventory the column and every reader, writer, index, function, export, and integration.
2. Prove whether historical values are UTC wall clocks, server-local, browser-local, or mixed; record confidence and exceptions.
3. Add the correctly typed column without removing the source.
4. Dual-write from one authoritative instant and compare results.
5. Backfill in bounded, restartable batches, retaining ambiguous rows for review instead of guessing.
6. Reconcile counts, boundary samples, DST cases, and tenant-level anomalies.
7. Cut readers over, then stop the legacy writer.
8. Retain an observed rollback path; remove the legacy column only in a later reviewed migration.

The rollout monitors invalid zones, rejected naive payloads, old/new column
divergence, gap/overlap adjustments, late jobs, expired claims, duplicate
logical occurrences, and tenant-specific error rates.

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
| Client in another zone | A submitted "17:00" shop time still converts with the documented scope's zone |
| Zone edited later | Existing `business_date`, document numbers, and fired jobs stay |
| Duration | 15 minutes of lockout displays as 15 minutes |
| Daylight-saving gap | Picked local time is rejected; computed next fire advances and records it |
| Daylight-saving overlap, computed | The earlier offset is stored and the choice is recorded |
| Daylight-saving overlap, typed | Rejected unless the form or the domain contract chose earlier or later |
| Naive datetime payload | API rejects it |
| `occurred_at::date` | Not used as a business-day filter |
| Non-hour zone | `Asia/Kathmandu` preserves its 45-minute offset |
| Non-hour DST transition | `Australia/Lord_Howe` resolves a 30-minute gap/overlap by policy |
| Short and long local days | UTC bounds cover the complete 23-hour or 25-hour civil day |
| Database session not UTC | Explicit-zone conversions and instant comparisons remain correct |
| Prisma civil values | `date` and `time` serialize without a browser-zone shift |
| Database/application midnight race | The persisted instant and derived civil date come from one database clock |
| Parallel worker claims | One logical occurrence is claimed once; retries reuse its idempotency key |
| Worker crash after provider submission | Recovery does not create an untracked second logical occurrence |
| Tenant boundary | A client cannot use another tenant's branch or supplied zone |
| Legacy dual-write | New and legacy values reconcile, with ambiguous rows reported rather than guessed |

A Gulf tenant with no daylight saving does not remove the daylight-saving
tests. The product will gain a tenant whose zone has one.

## Review checklist

- The value uses one documented time shape, and its column type and API representation match that shape.
- Instants are `timestamptz` and leave the process as RFC 3339 with `Z`.
- Civil dates are assigned once with the operations zone and a snapshotted zone id.
- Persisted instant/civil-date bundles derive from one captured database instant.
- No conversion uses `utc_offset_hours`, a hardcoded `+04:00`, or `Asia/Muscat` as a fallback.
- SQL comparisons and casts name an IANA zone. Predicates stay sargable. A new lookup calls `fn_ops_zone` or the TypeScript door. It does not grow a private timezone query.
- The authoritative scope is the feature's documented scope, then the organization. The server verifies that scope belongs to the tenant. The client does not choose the zone.
- Lists and reports join the zone or read the snapshot. They do not call the resolver once per row, and they do not wrap the filtered instant in `AT TIME ZONE`.
- HQ tenant rows use the tenant zone. HQ-only rows use the HQ zone. Mobile and public booking send civil fields and show the shop clock the API returns.
- The UI waits for the operations zone and formats only there.
- Schedules the shop thinks of in local time are stored as a civil rule plus a UTC fire time.
- A typed daylight-saving gap or overlap is rejected unless the form captured a choice. A computed gap advances. A computed overlap uses the earlier offset.
- Due jobs are atomically claimed and idempotent; `next_run_at` alone is not a delivery guarantee.
- Logs are UTC. Audit rows store the instant and, for a civil decision, the zone and the date.
- Durations subtract instants.
- Prisma `date` and `time` values leave service boundaries as civil strings, not serialized instants.
- Legacy naive instant columns are not extended.

## Related code

- `web-admin/lib/utils/business-date.ts` — `isValidTimeZone`, `businessDateForTimezone`. The operations door `resolveOperationalTimeZone` is added beside this file. It is not there yet
- `web-admin/lib/utils/registration-browser-defaults.ts` — browser suggestion for public registration only
- `web-admin/lib/utils/tenant-timezone.server.ts` — organization zone for display chrome
- `fn_ops_zone` — the SQL door. It is not created yet. New SQL must not grow a private timezone lookup while waiting for it
- `web-admin/lib/commercial/calendar.ts` — working-calendar math with an explicit zone
- `org_tenants_mst.timezone` — organization IANA zone
- `org_branches_mst.timezone_code` — optional location override (`sys_timezone_cd`)
- `org_pos_sessions_mst.opened_at`, `.business_date`, `.business_timezone` — reference shape
- `sys_timezone_cd` — allowed IANA codes; offset columns are not for conversion

These references identify related code; they do not certify that every current
caller conforms to this contract. The implementation and migration program is
`docs/features/Time_and_Timezone/`. This rule is the contract. That pack owns
the gap ledger, implementation sequence, rollout evidence, and reconciliation
results for bringing existing columns and screens up to it. A column is not
converted until its stored clock is identified.
