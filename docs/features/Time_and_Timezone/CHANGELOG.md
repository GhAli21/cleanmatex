# Changelog

## 0.1.4-plan — 2026-11-25

- Recorded migration `0826` as applied on the local and remote databases. New-row defaults are US, USD, and UTC. Existing organization rows stay as they were. Prisma was pulled from the local database.

## 0.1.3-plan — 2026-11-25

- Every work package now closes out in `progress_summary.md`, `current_status.md`, and the surface map. A migration stays Written, not applied until the user applies it.
- Closed the plan gaps: one operation-code list, scopes that have no timezone column, the POS business date, the tax-explain UTC fallback, `cmx-api` helpers even when no date route exists, CI across the apps and new SQL, and the HQ sibling plan.
- Recorded the 2026-11-25 session measurement: both databases reported UTC. That measurement does not convert old naive rows. Registration and migration `0826` stay beside the clock program.

## 0.1.2-plan — 2026-11-25

- Recorded one zone policy with two doors: `resolveOperationalTimeZone` in the app and `fn_ops_zone` in SQL. Neither function exists yet.
- UI, reports, print, `cmx-api`, mobile, webhooks, and HQ format that result or the row snapshot. HQ's own documents keep the HQ zone. A tenant row shown in HQ uses the tenant zone.
- Recorded the fast path: resolve once per action, join mixed-list zones in one query, compare a stored date or a bare instant, and limit reuse to the current request.
- Public registration may suggest the browser locale. That suggestion is stored only after the visitor confirms it, and it is not an operations clock.

## 0.1.1-plan — 2026-11-25

- Aligned this pack with the revised time rule.
- The operations zone is the feature's documented scope, then the organization. A client-supplied zone is an echo.
- A typed daylight-saving gap or overlap is rejected unless the form captured a choice. A computed gap advances. A computed overlap uses the earlier offset.
- Legacy conversion is expand-and-contract. A naive column is not read as a UTC wall clock until its provenance sample proves one stored clock.
- Zone labels use the abbreviation and offset of the instant being shown.

## 0.1.0-plan — 2026-11-24

- Added the implementation pack for the time and timezone rule.
- Recorded the Prisma inventory: 977 `timestamptz` columns, 488 naive `timestamp` columns (398 audit, 90 other).
- Extended the program to every surface: SQL functions, document numbers, HTTP routes, webhooks, server actions, date pickers, pages, customer message text, exports, logs, `cmx-api`, mobile apps, and a required HQ reader list.
- Recorded two defects the first plan did not package: `fn_doc_seq_next` falls back to the HQ timezone, and order-notification text formats Ready By with `toLocaleDateString`.
- Required a provenance sample before any `USING col AT TIME ZONE` conversion.
