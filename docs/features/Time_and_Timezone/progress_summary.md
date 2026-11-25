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

No clock-program package is in progress.

## Package status

Update this table at the close-out of every package. Allowed values: Not started, In progress, Done, Written, not applied, Applied by user.

| Package | Status | Note |
|---|---|---|
| WP1 Shared clock | Not started | |
| WP2 Provenance | Not started | Recount the live catalog here |
| WP3 Lockout | Not started | |
| WP4 Notification schedule | Not started | |
| WP5 Ready By backfill | Not started | |
| WP6 Presentation | Not started | |
| WP7 Domain batches | Not started | Close out each batch |
| WP8 Audit stamps | Not started | Close out each prefix |
| WP9 CI guard | Not started | |
| WP10 HTTP and webhooks | Not started | |
| WP11 Server actions | Not started | |
| WP12 SQL door | Not started | |
| WP13 Document numbers | Not started | |
| WP14 Pickers and filters | Not started | |
| WP15 Customer message text | Not started | |
| WP16 Exports and imports | Not started | |
| WP17 Logs and audit screens | Not started | |
| WP18 Jobs | Not started | |
| WP19 `cmx-api` | Not started | Helpers are required even when the route search is empty |
| WP20 Mobile | Not started | |
| WP21 HQ readers | Not started | Unblocks the sibling plan |
| WP22 Page completeness | Not started | |

## Pending

The table above is the pending list. Phase 1 is WP1. Phase 2 is WP2 through WP5 and starts only after the provenance note.

## Counts that define the pending work

| Item | Count |
|---|---|
| `timestamptz` columns in Prisma | 977 |
| Naive `timestamp` columns | 488 |
| Of those, `created_at` or `updated_at` | 398 |
| Other naive columns | 90 (61 distinct names) |

`cmx-api` has no matching date-parse sweep beyond its logger. The debt is in `web-admin` and SQL. A 2026-11-25 live catalog sample counted 905 `timestamptz` and 495 naive columns. Both sessions reported `TimeZone=UTC` that day. WP2 records a fresh count before any `USING` clause. The Prisma counts stay the starting inventory until then.
