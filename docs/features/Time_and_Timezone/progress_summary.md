# Progress summary

Inventory date: 2026-11-24.

## Completed

- Canonical rule: `docs/dev/rules/time-and-timezone.md`.
- Short Cursor rule: `.cursor/rules/time-and-timezone.mdc` (`alwaysApply`).
- Pointers in `CLAUDE.md`, `AGENTS.md`, and the database, backend, and frontend skills.
- The same pointers and `timestamptz` audit templates in `.claude`, `.codex`, `.agents`, and the Cursor convention rules that were still showing `TIMESTAMP`.
- This plan pack.

## In progress

Nothing in application code. No migration file for this program exists yet.

## Pending

- Shared zone resolver and formatters (Phase 1).
- Ready By read-path, lockout, and outbox schedule (Phase 2), after provenance.
- Screen and print sweep, plus customer message text (Phase 3).
- Routes, server actions, SQL functions, document numbers, pickers, exports, logs, `cmx-api`, and mobile (Phase 6).
- The other naive event columns (Phase 4).
- `created_at` / `updated_at` batches (Phase 5).
- CI guard for `web-admin`, `cmx-api`, and new SQL (Phase 7).

## Counts that define the pending work

| Item | Count |
|---|---|
| `timestamptz` columns in Prisma | 977 |
| Naive `timestamp` columns | 488 |
| Of those, `created_at` or `updated_at` | 398 |
| Other naive columns | 90 (61 distinct names) |

`cmx-api` has no matching date-parse sweep beyond its logger. The debt is in `web-admin` and SQL.
