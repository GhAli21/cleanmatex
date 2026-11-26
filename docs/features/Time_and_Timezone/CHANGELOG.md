# Changelog

## 0.1.26-plan — 2026-11-26

- Cash drawers format in the till's branch zone. Refund and reconciliation clocks use that row's branch, then the organization. Gift-card liability uses the organization zone. A tax document fiscal year is the civil year of one database instant in the invoice zone. A missing zone shows no clock and the tax document is refused.

## 0.1.25-plan — 2026-11-26

- `0833` is the Ready By cutover. `ready_by` and `ready_by_override` are dropped. `ready_by_at_new` is renamed to `ready_by_at` (promised Ready By). `ready_at` is `timestamptz` (actual Ready). Readers and writers use those two columns.

## 0.1.24-plan — 2026-11-26

- Removing `platform-workers` is a separate piece of work. This plan does not remove it. H4 still corrects the clocks in the jobs that run there.

## 0.1.23-plan — 2026-11-26

- A package is production-ready only when the database, services, APIs, workers, and screens for that clock change together, in this repo and in HQ when the surface is HQ.

## 0.1.22-plan — 2026-11-26

- `cmx-workers` is in WP17 and WP18. Its schedules stay UTC. HQ screens, APIs, and workers start without the reader list. That list is still required before a `sys_*` or `hq_*` column is converted.

## 0.1.21-plan — 2026-11-26

- WP8 also covers `deleted_at`. The local catalog has 64 of those columns and every one is already `timestamptz`, so the migration leaves them. A naive `deleted_at` converts in the same file as `created_at` and `updated_at`.

## 0.1.20-plan — 2026-11-26

- WP8 is one migration for every tenant `created_at` and `updated_at`. Each converts as a UTC wall. Views, triggers, and functions that block the type change are recreated in that file. `sys_*` and `hq_*` stamps wait for the HQ reader list.

## 0.1.19-plan — 2026-11-26

- Development rows may be rewritten. Instants convert as UTC walls because the database session is UTC. Civil values stay dates or times.
- `0832_lockout_timestamptz.sql` is applied on the local and remote databases. It converts the membership lock columns and makes `record_login_attempt` return a real instant. `attack_locked_until` was already `timestamptz`. Prisma was pulled from the local database afterward.

## 0.1.18-plan — 2026-11-26

- Ready-by hour rounding uses the operations zone when the caller passes one. Preparation completion rounds in the fulfilment branch zone and refuses to calculate when that zone is missing. A missing received time uses one database instant. Callers that omit the zone still round on the machine clock.

## 0.1.17-plan — 2026-11-26

- The ready-date picker stores the selected civil day and time in the fulfilment branch zone. Today, the minimum day, and the preview use that zone. A missing zone cannot be applied. Hour rounding inside the ready-by calculator still uses the machine clock.

## 0.1.16-plan — 2026-11-26

- Reconciliation report windows use the organization civil day. The last-activity date uses that zone. A missing zone does not query with this machine’s date. The ready-date picker and the calculator’s hour rounding still use the machine clock.

## 0.1.15-plan — 2026-11-26

- Orders, payments, invoices, revenue, and customer reports take their default range and day bounds from the organization civil day. A missing zone does not fall back to this machine. Export and print dates use that same zone. The ready-date picker and the calculator’s hour rounding still use the machine clock.

## 0.1.14-plan — 2026-11-26

- The ready-by calculator label stays empty until the caller passes the operations zone. The voucher list uses each voucher’s branch zone when the civil voucher date is empty. Order voucher tabs and the financial report date column use that same zone. The financial report’s default range is the organization civil day. Hour rounding inside the calculator, the ready-date picker, and the other report screens still use the machine zone.

## 0.1.13-plan — 2026-11-26

- Order detail, the full order view, the receipt, and the payments print format received, Ready By, and payment instants with the order branch zone, otherwise the organization zone. A civil date stays the calendar string. A naive timestamp and a missing zone stay empty. The ready-by calculator, the ready-date picker, reports, and vouchers still use the machine zone.

## 0.1.12-plan — 2026-11-25

- The orders list and the customer order history format Ready By and the received instant with the order branch zone, otherwise the organization zone. A missing zone leaves the cell empty. `formatReadyByDate` remains on the ready-by calculator.

## 0.1.11-plan — 2026-11-25

- Applied `0828` and `0829` on the local and remote databases. Outbox and campaign schedule columns are `timestamptz`. The Ready By backfill updated 0 rows. `request.service.ts` reads those columns as instants.
- `0828` drops and recreates `trg_ntf_obx_due_ntf` around the type change. The trigger only notifies.
- Applied `0830_fn_ops_zone.sql` and `0831_doc_seq_and_setup_health_zone.sql` on both databases. Tenant document numbers fail closed when the organization zone is missing. The express setup-health check no longer substitutes UTC.
- `npm run check:clock-contract` guards migrations from `0832` onward and freezes the current `toISOString().slice(0, 10)` files. The first run passed.

## 0.1.10-plan — 2026-11-25

- WP5 writers now persist Ready By on `ready_by_at_new` only: order create, order change, preparation completion, and order split. The edit context and the apply before-snapshot read that twin. `ready_by` stays.
- `0829_ready_by_twin_backfill.sql` fills a null twin from `ready_by` as a UTC wall and does not rewrite a row that already has a twin. Written, not applied. The 2026-11-25 sample had no null twins.

## 0.1.9-plan — 2026-11-25

- WP1 closed. Advance receipts, gift-card sales, and refund tax reversal take the tax day from one database instant and the invoice branch zone.
- WP2 closed. Provenance is in `technical_docs/provenance-class-a.md`. Outbox `scheduled_at` is a UTC wall. Lockout columns and the three divergent Ready By rows are not converted.
- WP4 migration `0828_ntf_schedule_timestamptz.sql` is written and not applied. `request.service.ts` still casts `AT TIME ZONE 'UTC'` and must drop that cast in the deploy that applies `0828`.

## 0.1.8-plan — 2026-11-25

- A checkout quote takes one database instant. The tax lines written from that quote store the same instant, so the tax point and the priced civil day come from one clock.
- Issuing a tax document stores `issued_at` and the finalized tax point from one database instant inside that transaction.

## 0.1.7-plan — 2026-11-25

- A live ready-by calendar preview reads one database instant. Tests still pass the instant they want to simulate.
- An order-created message formats Ready By in the fulfilment branch zone. A missing or invalid zone leaves that label empty. A date-only value stays that calendar day.

## 0.1.6-plan — 2026-11-25

- Ready By display reads use `ready_by_at_new` only. A null twin shows no clock. The receipt, All Orders list and its overdue sort, order detail, workflow lists, workboard, public tracking and booking, labels, the processing modal, and the dashboard overdue and on-time counts follow that rule.
- Order-change writes, the edit form, and order split still persist `ready_by`. That cutover stays in WP5. `ready_by` is not dropped.

## 0.1.5-plan — 2026-11-25

- Started WP1. `resolveOperationalTimeZone` reads the owning branch, then the organization, and returns no zone when neither is an active catalog code. Delivery, invoice, and ledger pass that branch id. They do not have a timezone column of their own.
- Speed rules, service-speed lookup, prepaid tax, tax lines, and the default VAT rate no longer substitute the UTC date. A POS open and the rollover sweep take the civil day from a database instant.
- Ready By display readers were outstanding at this version. 0.1.6-plan switches them.

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
