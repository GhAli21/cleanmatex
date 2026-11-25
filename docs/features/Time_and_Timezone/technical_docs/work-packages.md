# Work packages

Do the packages in order. A package that says "migration" produces a new SQL file and stops. It does not apply the file.

Rule: [`docs/dev/rules/time-and-timezone.md`](../../../dev/rules/time-and-timezone.md).
Inventory: [`column-inventory.md`](./column-inventory.md).

This pack follows that contract: the operations zone is the feature's documented scope, then the organization; a client zone is an echo; a typed daylight-saving gap or overlap is rejected unless the form captured a choice; a computed gap advances and a computed overlap uses the earlier offset; legacy conversion is expand-and-contract; a naive column is not read as UTC until its sample proves one clock.

## Close-out after every package

A package is not done until `progress_summary.md`, `current_status.md`, and this folder's surface-map row match the work. Add one `CHANGELOG.md` line and bump `version.txt`. A migration is recorded as Written, not applied. After the user applies it, record `npm run prisma:pull`. The HQ sibling plan in `cleanmatexsaas` (`docs/features/Time_and_Timezone/`) closes out in that folder.

The operation codes are a closed list, shared by the TypeScript door and `fn_ops_zone`: `accept_order`, `ready_by`, `pos_session`, `delivery`, `invoice`, `ledger`. A report that shows a stored row reads that row's snapshot. A report limited to one zone says so. Registration is not an operation of either door.

## WP1 — Shared clock (no migration)

**Done when** feature code can resolve a zone, format an instant, and reject a naive datetime without copying `Intl` logic.

- Add `resolveOperationalTimeZone` next to `web-admin/lib/utils/business-date.ts`. The caller passes `tenantOrgId`, one closed operation code, and the scope id. For a branch-scoped operation: branch `timezone_code`, else organization `timezone`, else null. Both must be valid IANA names and active `sys_timezone_cd` codes. The query filters `tenant_org_id` and uses the existing branch and organization keys. One read per action. Reuse the result for the rest of that request only. A TTL must not choose the civil day.
- A scope with no timezone column names the branch that owns the action. Delivery uses the branch of the service location. An invoice or a ledger line uses the issuing branch of that legal or accounting entity. `sys_country_cd.default_timezone_code` is catalog metadata and is not a fallback. A client `timeZone` cannot win. This is the TypeScript door. `fn_ops_zone` in WP12 returns the same answer for the same inputs. Do not add a React context that holds one zone for the session.
- A persisted business date takes one database instant. `pos-session.service.ts` calls `businessDateForTimezone(businessTimezone)` with the application clock. Pass the database instant captured in that transaction. Refresh every other `businessDateForTimezone` caller and apply the same rule.
- Add `parseInstant` that accepts only RFC 3339 with `Z` or a numeric offset.
- Add `formatInstant(value, zone, locale)` and `civilDayBounds(date, zone)` that return a half-open UTC range.
- Keep `getTenantTimeZone` as the organization helper. Layout may keep passing it for non-operational chrome. Operational pages pass the resolver result.
- Delete the UTC fallbacks:
  - `web-admin/lib/services/catalog/speed-rules.service.ts` (`toISOString().slice(0, 10)`)
  - `web-admin/lib/services/lookups/service-speed-lookup.service.ts` (fallback zone `'UTC'`)
  - `web-admin/lib/services/tax/prepaid-tax.service.ts`
  - `web-admin/lib/services/tax/tax-lines.writer.ts`
  - `web-admin/lib/services/tax/tax-explain.service.ts` (`isoDate(now)` when the zone is missing)
- Point Ready By readers at `ready_by_at_new`. Start with the receipt mapper called out in the line-level money QA (`ready-order-types`) and the All Orders list mapper. Search `ready_by` and switch display reads. Leave the column in place.
- i18n keys for "time zone is not set" in `messages/en` and `messages/ar`, reused if an existing key already says that.

**Stop if** a Ready By reader has no `ready_by_at_new` in its query. Add the column to the select. Do not parse `ready_by` to fill the gap.

**Tests:** T1, T2, T3, T6, T9, T18, T19, F1, F3 in the testing guide. Keep the vectors. WP12 runs the same vectors through `fn_ops_zone`.

**Close-out:** WP1 row becomes Done. No migration.

## WP2 — Provenance note for Class A

**Done when** a short note, checked into this folder as `technical_docs/provenance-class-a.md`, states for each Class A column whether sampled values are UTC wall or Muscat wall, with the row ids and the log line used.

Read-only SQL only. Use `supabase_local` or `supabase_remote` as the user directs. Do not `UPDATE`.

Columns: `org_users_mst.locked_until`, `org_users_mst.last_failed_login_at`, `org_ntf_outbox_dtl.scheduled_at`, `org_ntf_outbox_dtl.next_retry_at`, `org_ntf_campaigns_mst.scheduled_at`, and `org_orders_mst.ready_by` where `ready_by_at_new` is null.

Also list the writers. Known writer to inspect: `web-admin/lib/notifications/campaign-jobs.service.ts` (`now() AT TIME ZONE 'UTC'`).

Recount the live catalog in the note. The Prisma file on 2026-11-24 said 977 `timestamptz` and 488 naive columns. A 2026-11-25 catalog sample said 905 and 495. The note records both and which database was sampled. On that date both sessions reported `TimeZone=UTC`. That measurement does not prove a naive column is a UTC wall clock.

**Stop if** one column contains both shapes. That column leaves this package.

**Close-out:** provenance file checked in. WP2 row becomes Done.

## WP3 — Lockout migration

**Depends on** WP2.

New migration, next sequence number at the time of writing. Convert `org_users_mst.locked_until` and `last_failed_login_at` with the `USING` clause WP2 proved. Comment the provenance. Login duration math subtracts instants. The API returns the remaining minutes from that difference.

**Stop** for review. Do not apply.

**Tests after apply:** T4.

**Close-out:** Written, not applied. After the user applies it, record the Prisma pull.

## WP4 — Notification schedule migration

**Depends on** WP2.

New migration for `org_ntf_outbox_dtl.scheduled_at`, `next_retry_at`, and `org_ntf_campaigns_mst.scheduled_at`. Replace `now() AT TIME ZONE 'UTC'` assignments with `now()` once the column is `timestamptz`. Worker comparisons are `scheduled_at <= now()` on `timestamptz` only.

Quiet hours stay civil. The row that leaves the quiet-hours calculation is the UTC instant.

**Stop** for review. Name any HQ worker that reads `hq_ntf_dispatch_log` before touching `dispatched_at` or `failed_at`. Those two are Class B, not this package. Add each named reader to the HQ sibling plan.

**Tests after apply:** T5.

**Close-out:** Written, not applied.

## WP5 — Ready By backfill

**Depends on** WP2 for rows where `ready_by_at_new` is null.

New migration:

- Backfill `ready_by_at_new` from `ready_by` only where the twin is null, using the proven `USING` interpretation.
- Do not drop `ready_by`.
- Application writes set `ready_by_at_new` only.

A later package drops `ready_by` after a search shows no readers.

**Tests after apply:** T6, T7.

**Close-out:** Written, not applied. `ready_by` stays.

## WP6 — Presentation sweep

**Depends on** WP1.

Replace operational formatting in batches. Suggested order, because these files matched `toLocaleString`, `toLocaleDateString`, `getHours`, `setHours`, or `slice(0, 10)` on 2026-11-24:

1. Orders and print: `order-details-full-client.tsx`, `order-detail-client.tsx`, `order-receipt-print.tsx`, `order-payments-print-rprt.tsx`, `ready-date-picker-modal.tsx`, `ready-by-calculator.ts`.
2. Reports under `src/features/reports/ui/` and `app/dashboard/reports/`.
3. Finance vouchers and `app/dashboard/internal_fin/vouchers/`.
4. Customers, notifications, marketing, delivery, workboard.

Each batch: the screen waits for the operations zone, EN and AR show the same instant, and the print matches the screen. A missing zone shows a skeleton and a message through `cmxMessage`, with keys in both languages. A list joins each row's zone in the same query. A day filter uses `civilDayBounds` once and compares a stored date or a bare `timestamptz`. Print roots keep `data-mode="LIGHT"`. Check the changed flow in the browser, including the empty and missing-zone states.

Do not reformat jhtestui debug viewers except to label them UTC. They are not an operations clock.

**Close-out:** name the batches that landed and the screens still open.

**Tests:** T1, T7, T8, E3, T19.

## WP7 — Domain batches for Class B

**Depends on** WP3 and WP4 being applied, so the dangerous clocks are already real instants.

One migration per domain, each with its own provenance note:

| Batch | Tables |
|---|---|
| B1 Orders | `org_orders_mst` event stamps other than `ready_by` (`paid_at`, `delivered_at`, `received_at`, `ready_at`, `prepared_at`, `ready_by_override`, `credit_limit_override_at`) |
| B2 Notifications | remaining `org_ntf_*` stamps (`sent_at`, `read_at`, `logged_at`, `performed_at`, `paused_at`, `delivered_at`) |
| B3 Delivery and assembly | `org_dlv_*`, `org_asm_*`, `org_qa_decisions_tr`, `org_pck_*` |
| B4 Finance | `org_fin_*`, `org_invoice_mst` after `handed_to_date` is classified |
| B5 Subscriptions and OTP | `org_pln_subscriptions_mst`, `sys_otp_codes` |
| B6 Platform catalogs | `sys_*` and `hq_*` stamps, only after HQ readers are named |

`s_date`, `handed_to_date`, `effective_from`, `effective_until`, `effective_to`, `scheduled_time`, `estimated_arrival`, and `actual_time` are classified in the migration comment as instant or civil. Civil values become `date` or `time`, not `timestamptz`.

Each batch closes out on its own. B6 waits for the HQ reader list and the sibling plan's note that those readers are ready.

## WP8 — Audit stamps

**Depends on** the database `TimeZone` decision in the deploy guide.

Prefix-sized migrations for the 398 `created_at` / `updated_at` columns. Skip a table whose sample mixes UTC wall and Muscat wall. Close out each prefix as Written, not applied.

## WP9 — CI guard

- A script or review check fails when a new migration adds `timestamp without time zone` without the comment `CIVIL:` (allowed only for a documented local wall clock that is not an instant).
- The same check fails on new `toISOString().slice(0, 10)` and unzoned `new Date('YYYY-MM-DD')` under `web-admin`, `cmx-api`, and the mobile date parser.
- The same check fails when a new SQL function reads `org_tenants_mst.timezone` or `org_branches_mst.timezone_code` except `fn_ops_zone`.
- The T and E cases that can run without a browser live next to `business-date` tests, including the two-door vectors.

**Close-out:** name the script path and the first green run.

## WP10 — HTTP APIs, webhooks, and Zod

**Depends on** the parser from WP1.

Refresh the route list, then change every hit. The 2026-11-24 start set includes:

- `app/api/v1/orders/route.ts`, `orders/[id]/route.ts`, `orders/[id]/state/route.ts`
- `app/api/v1/public/customer/booking/route.ts` and `public/customer/orders/route.ts`
- `app/api/v1/delivery/routes/route.ts`
- `app/api/v1/notifications/campaigns/route.ts` and `campaigns/[id]/status/route.ts`
- `app/api/notifications/process-outbox/route.ts` and `process-campaigns/route.ts`
- `app/api/v1/marketing/promotions/route.ts` and `promotions/[promoId]/route.ts`
- `app/api/v1/finance/vouchers/route.ts` and `finance/reconciliation/runs/route.ts`
- `app/api/v1/settings/tax/exemptions/route.ts`
- `app/api/v1/customers/[id]/credit-note/issue/route.ts`
- `app/api/v1/price-lists/route.ts`, `price-lists/[id]/route.ts`, `pricing/history/route.ts`
- `app/api/v1/cash-drawers/trx/route.ts` and `variance-report/route.ts`

An instant field accepts only RFC 3339 with an offset and is stored as UTC. A civil date accepts only `YYYY-MM-DD`. A shop appointment accepts civil fields and is converted with the route's documented scope, then the organization zone. A client-supplied zone does not replace that scope. Responses emit instants with `Z`. Webhook bodies follow the same two shapes. Zod schemas live next to those routes and reject the other shapes. A typed daylight-saving gap or overlap is rejected unless the payload carries the captured earlier or later choice.

**Done when** a fresh search of `web-admin/app/api` finds no write route that parses a date outside the shared parser.

**Close-out:** list the routes changed and any route left with a written reason.

## WP11 — Server actions

Same contract as WP10 for `web-admin/app/actions`. The 2026-11-24 start set includes promotions, gift cards, discount rules, loyalty, tax, refunds, reconciliation, drivers, cash drawers, payment methods, and terminals.

**Done when** a fresh search of `app/actions` finds no action that builds a business date or an instant outside the shared helpers.

**Close-out:** list the actions changed.

## WP12 — SQL functions, triggers, views, and cron

Search `supabase/migrations` and the live catalog (read-only) for functions and triggers that compare a `timestamp without time zone` to `now()`, cast an instant without an IANA zone, or call `AT TIME ZONE` with a session zone. Starting files: `0625`, `0630`, `0670`, `0807`, `0810`, `0715`, `0739`.

Add `fn_ops_zone(tenant, operation, scope)` in a new migration. It is the SQL door and matches `resolveOperationalTimeZone`: the same closed operation codes, scope zone, then organization zone, and no zone when both are missing or invalid. It checks the scope belongs to the tenant and filters every `org_*` read by `tenant_org_id`. It is one indexed read. Comment the function and its arguments. Grant it only to the roles that already call tenant SQL functions. Do not grant `anon` or `authenticated`. A new zone argument is `TEXT`.

Existing functions that look up a timezone themselves are pointed at this function, or they read the snapshot on the row, in a later new migration. Known callers to replace: `fn_doc_seq_next` (HQ fallback, WP13) and the setup-health holiday check in `0739` (substitutes `UTC`). Do not call `fn_ops_zone` once per row of a list. Compute civil-day bounds once and compare the bare instant.

Each hit is either already correct, fixed in a new migration, or listed with a reason it is civil. Do not edit an applied migration.

**Done when** the function list is in `technical_docs/sql-clock-inventory.md` and every open hit has a new migration waiting for review. T18 passes against the function with the same vectors as the TypeScript door.

**Close-out:** Written, not applied. The inventory file is checked in.

## WP13 — Document numbers

`fn_doc_seq_next` in `0670_doc_seq_engine_fns.sql` uses the tenant timezone and, when that value is null or invalid, substitutes `hq_general_config.timezone`. A new migration replaces that fallback with a failure for tenant-scoped types. SYS and HQ types keep the HQ clock. Issued numbers are not rewritten. Callers in services must pass a real instant, not a naive wall clock.

**Tests:** T9, T11.

**Close-out:** Written, not applied. Issued numbers were not rewritten.

## WP14 — Date pickers, filters, and dialogs

Refresh the picker list. Starting screens: order filters, report filters, processing filters, ready-by picker, promo and gift-card dialogs, FX rate dialog, voucher dialogs, B2B contract dialog, AR invoice wizard, tax setup, ERP Lite expenses and PO, reconciliation filters.

Classify each control. A day filter submits `YYYY-MM-DD`. An appointment submits civil date and time. The server converts. The control does not send the result of the browser's `Date`. A typed gap or overlap is rejected unless the form captured earlier or later. Check the changed controls in the browser.

**Close-out:** name the controls changed and any control left as civil on purpose.

## WP15 — Customer message text

`web-admin/lib/notifications/order-event-variables.ts` formats Ready By with `toLocaleDateString`. With no valid zone it uses the server zone. Templates for SMS, email, WhatsApp, and in-app text take the operations zone into that formatter. A missing zone omits the clock rather than printing the server's day. `delivery-policy.ts` remains the quiet-hours civil rule. The outbox instant stays WP4. EN and AR templates both change.

**Close-out:** name the templates and the missing-zone sample.

## WP16 — Exports and imports

Refresh export and import routes. Starting routes: `app/api/v1/customers/export`, `products/export`, `ar/invoices/export`, `pricing/export`, and the FX import tab. An instant column is RFC 3339 `Z`. A human-facing export also has the civil date and the zone id. An import row with a datetime and no zone is rejected.

**Close-out:** name the routes and one sample file that was rejected.

## WP17 — Logs and audit screens

Log formatters in `web-admin`, `cmx-api/src/common/utils/logger.ts`, and `cmx_mobile_apps/packages/mobile_core/lib/src/app_logger.dart` write UTC ISO-8601. A line about a civil decision adds the zone id. Audit screens format the stored instant with the operations zone. They do not display the naive column when a `timestamptz` twin exists. Log lines stay free of customer payloads.

**Close-out:** name the three loggers and the audit screens.

## WP18 — Jobs besides the notification outbox

`finance-jobs.service.ts`, the POS session rollover, and the background-job claim functions from `0807` and `0810` compare `timestamptz` to `now()` for eligibility only. A worker claims a due row with a bounded lease and one idempotency key per logical occurrence. A job defined as local time stores the civil rule, the IANA zone, and a derived UTC fire time. A computed gap advances. A computed overlap uses the earlier offset. Operator screens that show a UTC cron say UTC. The zone is applied when `next_run_at` is calculated, not inside the due-row scan.

**Close-out:** name the jobs and whether each change is code or a new migration.

## WP19 — `cmx-api`

Search `cmx-api/src` again at the start of the package. The 2026-11-24 search matched the logger only. Add a parser and a zone helper in `cmx-api` that follow WP10 and the closed operation codes. They do not import `web-admin`. The WP1 vectors run here too. Any controller, DTO, or service that accepts or returns a date uses those helpers. An empty route search does not finish the package by itself. The helpers still land, and the search result is written down.

**Close-out:** name the helper files and the search result.

## WP20 — Mobile apps

`cmx_mobile_apps` booking, tracking, and `app_date_time_picker_widget.dart` submit civil fields for a shop appointment and display instants in the shop zone returned by the API. The phone does not compute the shop's civil day. A missing zone shows no clock. Customer-facing strings stay in the app's EN and AR catalogs.

**Close-out:** name the screens and the API fields they read.

## WP21 — HQ readers

Before WP7 batch B6, and before any other column a platform worker reads, write `technical_docs/hq-readers.md`. Each row names the table, the column, and the HQ file or job in `platform-web`, `platform-api`, or `platform-workers`. Converting that column waits until the list is reviewed. HQ behavior changes are the sibling plan at `cleanmatexsaas/docs/features/Time_and_Timezone/`. This tenant pack does not edit that repo's application code.

**Close-out:** the reader list is checked in. The sibling plan's status says the list is ready.

## WP22 — Page completeness

Build the page list from `web-admin/app/dashboard/**/page.tsx` and the feature screens those pages render. Every page that shows a date is either on the WP6 list or marked as chrome that uses the organization zone on purpose. Operational pages pass `resolveOperationalTimeZone`. Settings pages that edit `org_tenants_mst.timezone` and `org_branches_mst.timezone_code` keep requiring an explicit choice. A cache key or a default of "today" includes the civil date and the zone id.

**Done when** the page list is checked in as `technical_docs/page-clock-inventory.md` and every operational page is either migrated or has a written exception. Public registration stays a browser suggestion the visitor confirms. It is not an operations clock.

**Close-out:** the inventory is checked in, with the exception count.

## Coverage checklist

| Topic | Package |
|---|---|
| Permissions | None new |
| Navigation | None new |
| Settings screens | WP22. Existing zone fields stay an explicit choice. Public registration may suggest the browser locale and stores the confirmed value. `0826` is applied on local and remote and defaults a new organization row to `UTC`. Readers still fail closed when the zone is null |
| Feature flags | None |
| i18n | WP1, WP15, WP20. EN and AR |
| HTTP API and webhooks | WP10 |
| Server actions | WP11 |
| Services | WP1, WP4, WP15, WP18 |
| SQL functions, triggers, views, cron | WP12, WP13, WP18 |
| Document numbers | WP13 |
| Date pickers and filters | WP14 |
| Pages, screens, print | WP6, WP22 |
| Customer message text | WP15 |
| Exports and imports | WP16 |
| Logs and audit UI | WP17 |
| `cmx-api` | WP19 |
| Mobile apps | WP20 |
| HQ readers | WP21, then `cleanmatexsaas/docs/features/Time_and_Timezone/` |
| Performance | WP1, WP6, WP12, WP18. One resolution per action. Join a mixed list. Filter a bare instant |
| Plan status | Close-out after every package, in `progress_summary.md`, `current_status.md`, and the surface map |
| Columns and migrations | WP3, WP4, WP5, WP7, WP8, WP12, WP13. New files only. Not applied here |
| Constants | IANA codes stay `sys_timezone_cd.code` |
| Env vars | None. Process `TZ=UTC` is an operations note in the deploy guide |
| CI | WP9. It covers `web-admin`, `cmx-api`, mobile date parsing, and new SQL |

The surface map is [`surface-map.md`](./surface-map.md). A package that does not refresh its row on that map is not done.
