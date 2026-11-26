# Class A provenance

Sampled 2026-11-25. Local and remote Postgres sessions report `TimeZone = UTC`. That is the current session. It does not prove how an older naive value was written.

Live catalog on local: 910 `timestamptz` columns and 495 `timestamp without time zone` columns. The Prisma inventory of 2026-11-24 counted 977 and 488. Recount before a later package quotes the catalog.

A column is proven only when one naive value is compared with an external `timestamptz` on the same row. An empty column is not a clock. A naive value equal to another naive value is not a clock.

## Proven

### `org_ntf_outbox_dtl.scheduled_at`

Shape: one clock, UTC wall.

Remote: 63 of 63 rows have `scheduled_at`. 42 of those are within 2 minutes of `finalized_at` (`timestamptz`). 17 have no `finalized_at`. 4 are late sends, not a +04:00 shift:

| id | gap |
|---|---|
| `028b2104-5b98-4464-8eab-fe1dd8c7a4ad` | about 32 hours |
| `d371c1d2-d7df-4243-9d14-1067387bc894` | about 29 minutes |
| `4b368f4f-5d4e-4d13-9717-9f7a71caf8fa` | about 29 minutes |
| `9d0a1aac-f0ff-48ee-897e-32020b616d3d` | about 29 minutes |

Local: 4 rows, all within about 70 ms of naive `created_at`. That pair does not prove a zone. The writer (`adapters/outbox.ts`) stores `new Date().toISOString()`, which is a UTC instant.

Conversion: `USING scheduled_at AT TIME ZONE 'UTC'`.

### `org_ntf_outbox_dtl.next_retry_at`

Remote: 0 of 63 rows. Local: no populated sample. The same outbox writer assigns it from a JavaScript `Date`. An empty column cannot be mis-converted.

Conversion: the same `AT TIME ZONE 'UTC'` expression.

### `org_ntf_campaigns_mst.scheduled_at`

Remote: 0 rows. The campaign API accepts an offset datetime (`z.string().datetime()`). There is no stored value to classify as a second shape.

Conversion: the same `AT TIME ZONE 'UTC'` expression.

## Development decision — 2026-11-26

There are no customer rows. Later instant conversions use `AT TIME ZONE 'UTC'` because the database session is UTC and current writers store UTC walls. A development row written under another session may move. Civil columns stay `date` or `time`. This does not convert a column whose writer still stores a local wall clock.

### `org_users_mst.locked_until`

Local 0 of 8. Remote 0 of 12. `0832` converts the empty column as a UTC wall.

### `org_users_mst.last_failed_login_at`

Remote 1 of 12. Row `4ad9bff0-5dee-4b00-a365-7690cd85c4a5` equals its own naive `updated_at` (`2026-10-09 02:01:09.240574`). `0832` converts that development row as a UTC wall.

### `org_orders_mst.ready_by`

Null twins: local 0 orders, remote 0 of 32. A backfill of `ready_by_at_new IS NULL` changes no current row.

Paired rows: 29 of 32 match `ready_by_at_new` read as a UTC wall. Three rows differ by hours or days and are later edits of one column, not a Muscat population:

| id | ready_by | ready_by_at_new |
|---|---|---|
| `609a5565-d763-4df6-a396-45168a34b2e9` | 2026-11-20 10:00:00 | 2026-11-20 08:00:00+00 |
| `67ca91f5-b43f-4f0d-9eba-e58258cf9e10` | 2026-11-30 11:00:00 | 2026-11-19 13:00:00+00 |
| `c3aa014c-9971-4369-84c7-3879c0dd147f` | 2026-11-27 06:00:00 | 2026-11-18 06:00:00+00 |

`0829` updated a null twin only, so those three promised instants were not overwritten. `0833` kept them on `ready_by_at`, dropped `ready_by` and `ready_by_override`, and converted `ready_at` as a UTC wall.

## HQ

`hq_ntf_dispatch_log.dispatched_at` and `failed_at` were not sampled here. A search of `platform-api` notification jobs found readers of that table (`ntf-status.jobs.ts`, `ntf-delivery.jobs.ts`, `webhook-status.ts`) and no read of those two columns. No HQ column is converted by the tenant migration.
