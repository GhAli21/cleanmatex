# Changelog

## 0.1.0-plan — 2026-11-24

- Added the implementation pack for the time and timezone rule.
- Recorded the Prisma inventory: 977 `timestamptz` columns, 488 naive `timestamp` columns (398 audit, 90 other).
- Extended the program to every surface: SQL functions, document numbers, HTTP routes, webhooks, server actions, date pickers, pages, customer message text, exports, logs, `cmx-api`, mobile apps, and a required HQ reader list.
- Recorded two defects the first plan did not package: `fn_doc_seq_next` falls back to the HQ timezone, and order-notification text formats Ready By with `toLocaleDateString`.
- Required a provenance sample before any `USING col AT TIME ZONE` conversion.
