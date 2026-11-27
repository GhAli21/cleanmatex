# Work packages

Live queue: [`../RESUME_CONTINUATION.md`](../RESUME_CONTINUATION.md). Read **Risks while implementing** in that file before editing. Refresh that file at the end of every slice. Current version is `0.1.47` (S1–S5 done, `0842`–`0846` applied; S6 done in code). The next step is S7 in [`../MASTER_PLAN_v2.md`](../MASTER_PLAN_v2.md), which maps the open packages to slices (WP6→S3/S4/S14, WP10/WP11→S6, WP16/WP17→S7, WP18→S8, WP19→S11, WP20→S12, WP21→S13, WP22→S14). Do not start again at WP1. Do not treat a route or screen named below as still open until you check `CHANGELOG.md`. `0828` through `0841` are already applied. Do not edit them. Only the user applies migrations (D17): the agent writes the SQL file and stops, as the "write the SQL and stop" line below says. SQL names in the master plan use `fn_cmx_dt_*` (the deployed `fn_ops_zone` is wrapped by `fn_cmx_dt_zone`); a package below that says `fn_ops_*` for new work means that family. `RESUME_CONTINUATION.md` wins when they disagree.

Do the packages in order. A package that says "migration" produces a new SQL file and stops. It does not apply the file.

Rule: [`docs/dev/rules/time-and-timezone.md`](../../../dev/rules/time-and-timezone.md).
Inventory: [`column-inventory.md`](./column-inventory.md).

This pack follows that contract: the operations zone is the feature's documented scope, then the organization; a client zone is an echo; a typed daylight-saving gap or overlap is rejected unless the form captured a choice; a computed gap advances and a computed overlap uses the earlier offset. Development rows may be rewritten. A naive instant whose writer stores `now()` converts as a UTC wall. A civil value stays `date` or `time`. A column that is still naive is shown with no clock.

## Close-out after every package

A package is not done until `progress_summary.md`, `current_status.md`, and this folder's surface-map row match the work. Add the manual cases for that step to `testing_guide_and_scenarios.md`. Add one `CHANGELOG.md` line and bump `version.txt`. A migration is recorded as Written, not applied. After the user applies it, record `npm run prisma:pull`. The HQ sibling plan in `cleanmatexsaas` (`docs/features/Time_and_Timezone/`) closes out in that folder.

## Production gate

A package is production-ready only when every layer that owns that clock changes in the same pass. One layer left behind is a gap.

| Layer | What the pass includes |
|---|---|
| Database | A new migration when a column, view, trigger, or function changes. Tenant migrations stay in this repo. `org_*` reads and writes filter `tenant_org_id` in the statement. |
| Services | Writers store the same clock the column now holds. One zone resolution per action. A list joins its zones in one query. Features do not copy `Intl` or `AT TIME ZONE`. |
| APIs, webhooks, server actions | An instant is RFC 3339 with an offset and is returned with `Z`. A civil date is `YYYY-MM-DD`. A client zone is an echo. |
| Workers | `cmx-workers` schedules stay UTC. A shop-local fire time is derived in the web-admin service. HQ jobs in `platform-workers` follow the sibling plan. Removing that app is a separate piece of work, not this plan. |
| Screens, print, messages | The operations zone, EN and AR, and no clock when the zone is missing. Feedback uses `cmxMessage`. Controls are Cmx components. |
| Both repos | A tenant surface stays in `cleanmatex` (`web-admin`, `cmx-api`, `cmx-workers`, mobile). An HQ surface (`platform-web`, `platform-api`, `platform-workers`) is changed in `cleanmatexsaas` and closed out there. |

Tests cover the clock rule that changed. A test sets an explicit zone. The machine zone is not the shop zone. A cache key or a default of today includes the civil date and the zone id.

The operation codes are a closed list, shared by the TypeScript door and `fn_ops_zone`: `accept_order`, `ready_by`, `pos_session`, `delivery`, `invoice`, `ledger`, `notify` (D27; quiet hours and notification scheduling use `notify`). A report that shows a stored row reads that row's snapshot. A report limited to one zone says so. Registration is not an operation of either door.

## WP1 — Shared clock (no migration)

**Done when** feature code can resolve a zone, format an instant, and reject a naive datetime without copying `Intl` logic.

- Add `resolveOperationalTimeZone` next to `web-admin/lib/utils/business-date.ts`. The caller passes `tenantOrgId`, one closed operation code, and the scope id. For a branch-scoped operation: branch `timezone_code`, else organization `timezone`, else null. Both must be valid IANA names and active `sys_timezone_cd` codes. The query filters `tenant_org_id` and uses the existing branch and organization keys. One read per action. Reuse the result for the rest of that request only. A TTL must not choose the civil day.
- The scope id is the owning branch. Delivery uses the branch on the route or slot. An invoice uses `org_invoice_mst.branch_id`. A ledger journal uses `org_fin_journal_mst.branch_id`. A notification uses the branch the notification is for (the customer's or order's branch, or the campaign's branch). The customer ledger follows the invoice. Those tables store the place, and the branch stores the zone. `sys_country_cd.default_timezone_code` is catalog metadata and is not a fallback. A client `timeZone` cannot win. This is the TypeScript door in `operational-zone.server.ts`. `fn_ops_zone` in WP12 returns the same answer for the same inputs. Do not add a React context that holds one zone for the session. When the document is issued, freeze that zone on the row the way a POS session freezes `business_timezone`.
- A persisted business date takes one database instant. POS open, the rollover sweep, a live `previewReadyTimes` call, `quoteCheckout`, the tax lines written from that quote, tax-document issue, advance receipts, gift-card sales, and refund reversal read that instant. `createTaxDocumentTx` takes the fiscal year from one database instant in the invoice zone (`0.1.26-plan`). Order create, order change, split, and preparation completion persist `ready_by_at`. `formatReadyByDate` stays empty without a zone (WP6).
- Add `parseInstant` that accepts only RFC 3339 with `Z` or a numeric offset.
- Add `formatInstant(value, zone, locale)` and `civilDayBounds(date, zone)` that return a half-open UTC range.
- Keep `getTenantTimeZone` as the organization helper. Layout may keep passing it for non-operational chrome. Operational pages pass the resolver result.
- Delete the UTC fallbacks:
  - `web-admin/lib/services/catalog/speed-rules.service.ts` (`toISOString().slice(0, 10)`)
  - `web-admin/lib/services/lookups/service-speed-lookup.service.ts` (fallback zone `'UTC'`)
  - `web-admin/lib/services/tax/prepaid-tax.service.ts`
  - `web-admin/lib/services/tax/tax-lines.writer.ts`
  - `web-admin/lib/services/tax/tax-explain.service.ts` (`isoDate(now)` when the zone is missing)
- Ready By readers and writers use `ready_by_at`. Display reads landed in 0.1.6-plan. `0833` dropped `ready_by` and `ready_by_override` and renamed `ready_by_at_new` to `ready_by_at`. Actual Ready is `ready_at`.
- i18n keys for "time zone is not set" in `messages/en` and `messages/ar`, reused if an existing key already says that.

**Stop if** a Ready By reader selects a column other than `ready_by_at`. Add that column to the select. A null `ready_by_at` shows no clock. Sort keys `ready_by` and `ready_by_at_new` are aliases that order by `ready_by_at`. They are not columns.

**Tests:** T1, T2, T3, T6, T9, T18, T19, F1, F3 in the testing guide. Keep the vectors. WP12 runs the same vectors through `fn_ops_zone`.

**Close-out:** WP1 row becomes Done. No migration.

**S1 (2026-11-27):** the shared clock now lives in `packages/clock` (`@cmx/clock`, web-admin entry `@/lib/utils/clock`). The older helpers in `operational-time.ts` keep working until their callers move (S3–S7).

**S2 (2026-11-27):** the SQL side of the same vectors is `supabase/tests/clock_vectors.test.sql`, generated by `node scripts/gen-clock-vectors-sql.mjs` (`--check` in CI-style runs). It runs against the `fn_cmx_dt_*` functions of `0842`/`0843` once the user has applied them; `fn_ops_zone` is reached through `fn_cmx_dt_zone` (`zoneResolution` vectors).

## WP2 — Provenance note for Class A

**Done when** a short note, checked into this folder as `technical_docs/provenance-class-a.md`, states for each Class A column whether sampled values are UTC wall or Muscat wall, with the row ids and the log line used.

Read-only SQL only. Use `supabase_local` or `supabase_remote` as the user directs. Do not `UPDATE`.

Columns sampled before `0833`: `org_users_mst.locked_until`, `org_users_mst.last_failed_login_at`, `org_ntf_outbox_dtl.scheduled_at`, `org_ntf_outbox_dtl.next_retry_at`, `org_ntf_campaigns_mst.scheduled_at`, and `org_orders_mst.ready_by` where `ready_by_at_new` was null. `ready_by` and `ready_by_override` are dropped. The promised column is `ready_by_at`.

Also list the writers. Known writer to inspect: `web-admin/lib/notifications/campaign-jobs.service.ts` (`now() AT TIME ZONE 'UTC'`).

Recount the live catalog in the note. The Prisma file on 2026-11-24 said 977 `timestamptz` and 488 naive columns. A 2026-11-25 catalog sample said 905 and 495. The note records both and which database was sampled. On that date both sessions reported `TimeZone=UTC`. That measurement does not prove a naive column is a UTC wall clock.

**Stop if** one column contains both shapes. That column leaves this package.

**Close-out:** provenance file checked in. WP2 row becomes Done.

## WP3 — Lockout migration

**Depends on** WP2.

`0832_lockout_timestamptz.sql` converts `org_users_mst.locked_until` and `last_failed_login_at` as UTC walls and makes `record_login_attempt` return `timestamptz`. Applied on local and remote. `attack_locked_until` was already `timestamptz`.

**Stop** for review. Do not apply.

**Tests after apply:** T4.

**Close-out:** Written, not applied. After the user applies it, record the Prisma pull.

## WP4 — Notification schedule migration

**Depends on** WP2.

New migration for `org_ntf_outbox_dtl.scheduled_at`, `next_retry_at`, and `org_ntf_campaigns_mst.scheduled_at`. Replace `now() AT TIME ZONE 'UTC'` assignments with `now()` once the column is `timestamptz`. Worker comparisons are `scheduled_at <= now()` on `timestamptz` only.

Quiet hours stay civil. The row that leaves the quiet-hours calculation is the UTC instant.

**Stop** for review. Name any HQ worker that reads `hq_ntf_dispatch_log` before touching `dispatched_at` or `failed_at`. Those two are Class B, not this package. Add each named reader to the HQ sibling plan.

Written as `0828_ntf_schedule_timestamptz.sql` from the 2026-11-25 provenance note. `request.service.ts` still casts `AT TIME ZONE 'UTC'` so a Muscat Node process keeps reading the naive column correctly until the migration is applied. Remove that cast in the same deploy. The campaign `AT TIME ZONE 'UTC'` writes are `started_at`, `updated_at`, and `processed_at`, which are not this package. HQ readers named in the sibling progress: `ntf-status.jobs.ts`, `ntf-delivery.jobs.ts`, `webhook-status.ts`. They do not read `dispatched_at` or `failed_at`.

**Tests after apply:** T5.

**Close-out:** Written, not applied.

## WP5 — Ready By canonical columns

Applied on local and remote.

`0829_ready_by_twin_backfill.sql` updated a null `ready_by_at_new` only, as a UTC wall, and changed 0 rows. The three divergent promised instants were not overwritten.

`0833_orders_ready_columns_canonical.sql` then:

- Backfilled any remaining null `ready_by_at_new` from `ready_by` as a UTC wall.
- Dropped `ready_by` and `ready_by_override` with `RESTRICT`, and dropped `idx_orders_ready_by`.
- Renamed `ready_by_at_new` to `ready_by_at` and `idx_orders_ready_by_new` to `idx_orders_ready_by_at`. `ready_by_at` is the promised Ready By instant.
- Converted `ready_at` to `timestamptz` with `USING ready_at AT TIME ZONE 'UTC'`. `ready_at` is the actual Ready instant.

Order, item, and piece rows use those two names. Application writes persist `ready_by_at`. A null promised instant shows no clock. List sort keys `ready_by` and `ready_by_at_new` order by `ready_by_at`.

**Tests after apply:** T6, T7.

## WP6 — Presentation sweep

**Depends on** WP1.

Replace operational formatting in batches. Suggested order, because these files matched `toLocaleString`, `toLocaleDateString`, `getHours`, `setHours`, or `slice(0, 10)` on 2026-11-24:

1. Orders and print: order detail, the full order view, the receipt, the payments print, the order voucher tab, the ready-date picker, and preparation ready-by rounding use the branch zone (`0.1.18-plan`). `formatReadyByDate` stays empty without a zone. A caller that omits the zone still rounds on the machine clock.
2. Reports under `src/features/reports/ui/` and `app/dashboard/reports/`. The orders, payments, invoices, revenue, customer, and reconciliation reports now use the organization civil day (`0.1.16-plan`).
3. Finance vouchers and `app/dashboard/internal_fin/vouchers/`.
4. Cash drawers use the till branch (`0.1.26-plan`). Refund timestamps and reconciliation run instants use that row's branch, then the organization. Reconciliation periods stay civil dates. Gift-card liability uses the organization zone. A tax-document fiscal year is the civil year of one database instant in the invoice zone.
5. Customers, notifications, marketing lists, delivery, pickup, workboard, and the workflow queues use the operations zone (`0.1.27-plan`). "Due today" is the civil day in the fulfilment branch zone. Discount-rule validity is an instant and is entered in WP14.

Each batch: the screen waits for the operations zone, EN and AR show the same instant, and the print matches the screen. A missing zone shows a skeleton and a message through `cmxMessage`, with keys in both languages. A list joins each row's zone in the same query. A day filter uses `civilDayBounds` once and compares a stored date or a bare `timestamptz`. Print roots keep `data-mode="LIGHT"`. Check the changed flow in the browser, including the empty and missing-zone states.

Do not reformat jhtestui debug viewers except to label them UTC. They are not an operations clock.

**Close-out:** name the batches that landed and the screens still open. Add the manual cases to `testing_guide_and_scenarios.md`.

**Tests:** T1, T7, T8, E3, T19.

## WP7 — Domain batches for Class B

**Depends on** WP3 and WP4 being applied, so the dangerous clocks are already real instants.

One migration per domain, each with its own provenance note:

| Batch | Tables |
|---|---|
| B1 Orders | `org_orders_mst` event stamps other than the Ready pair (`paid_at`, `delivered_at`, `received_at`, `prepared_at`, `credit_limit_override_at`). `ready_by_at` and `ready_at` are already `timestamptz`. `ready_by` and `ready_by_override` are dropped. |
| B2 Notifications | remaining `org_ntf_*` stamps (`sent_at`, `read_at`, `logged_at`, `performed_at`, `paused_at`, `delivered_at`) |
| B3 Delivery and assembly | `org_dlv_*`, `org_asm_*`, `org_qa_decisions_tr`, `org_pck_*` |
| B4 Finance | `org_fin_*`, `org_invoice_mst` after `handed_to_date` is classified |
| B5 Subscriptions and OTP | `org_pln_subscriptions_mst`, `sys_otp_codes` |
| B6 Platform catalogs | `sys_*` and `hq_*` stamps, only after HQ readers are named |

`s_date`, `handed_to_date`, `effective_from`, `effective_until`, `effective_to`, `scheduled_time`, `estimated_arrival`, and `actual_time` are classified in the migration comment as instant or civil. Civil values become `date` or `time`, not `timestamptz`.

B1 through B5, and the remaining organization event stamps, are applied (`0835`–`0839`, OTP in `0841`). `s_date`, `handed_to_date`, delivery stop times, and feature-flag effective instants are instants. B6 waits for the HQ reader list.

## WP8 — Audit stamps

**Depends on** the database `TimeZone` decision in the deploy guide. Both sessions were UTC on 2026-11-25. Development rows may move.

One migration for every naive `created_at`, `updated_at`, and `deleted_at`. The starting inventory has 398 `created_at` and `updated_at` columns (200 and 198). On 2026-11-26 the local catalog has 64 `deleted_at` columns and every one is already `timestamptz`, so the migration does not alter those. A naive `deleted_at` found at write time converts in this same file. Convert each naive stamp with `USING column AT TIME ZONE 'UTC'`. The session is UTC and the writers store `now()`.

The same file drops and recreates every view, trigger, and function that blocks the type change. A blocked table does not become a second migration.

Leave out:

- A column that is a civil day or a time of day. Those stay `date` or `time`.
- `sys_*` and `hq_*` stamps. They wait for `technical_docs/hq-readers.md` (WP21).

Applied on local and remote as `0834_org_audit_stamps_timestamptz.sql`. Views that read the stamps were recreated in that file. `anon` and `authenticated` are not granted. Prisma is pulled from the local database after apply.

## WP9 — CI guard

- A script or review check fails when a new migration adds `timestamp without time zone` without the comment `CIVIL:` (allowed only for a documented local wall clock that is not an instant).
- The same check fails on new `toISOString().slice(0, 10)` and unzoned `new Date('YYYY-MM-DD')` under `web-admin`, `cmx-api`, `cmx-workers`, and the mobile date parser.
- The same check fails when a new SQL function reads `org_tenants_mst.timezone` or `org_branches_mst.timezone_code` except `fn_ops_zone`.
- The T and E cases that can run without a browser live next to `business-date` tests, including the two-door vectors.

**Close-out:** name the script path and the first green run.

**Status (S1, 2026-11-27):** guard v2 is `scripts/check-clock-contract.mjs` with the per-file baseline `scripts/clock-contract-baseline.json` (`npm run check:clock-contract`). First green run with the baseline: 2026-11-27 in `cleanmatex` (tenant profile) and `cleanmatexsaas` (HQ profile). CI runs it in the web-admin job. The baseline only goes down (S4, S14). S2: the exemption pattern for `fn_cmx_dt__fake_*` was fixed (two underscores); the guard exits 0 with `0842`/`0843` present.

## WP10 — HTTP APIs, webhooks, and Zod

> **S6 (`0.1.47`, 2026-11-27):** route, action and schema time input moved to `web-admin/lib/clock/api-input.ts` (fresh search: 43 hits → 1, `lib/validations/iso-date.ts`); `clock` block per `api-clock-inventory.md`. Webhooks and `toApiInstant` response serialization: see S7/S11 in the master plan.

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

> **S6 (`0.1.47`):** promotions, gift cards, discount rules, promo codes and report actions use `api-input`; promotions-actions no longer reads a typed day in the server's zone. Loyalty, refunds, drivers, cash drawers, payment methods and terminals had no date parse in the fresh search.

Same contract as WP10 for `web-admin/app/actions`. The 2026-11-24 start set includes promotions, gift cards, discount rules, loyalty, tax, refunds, reconciliation, drivers, cash drawers, payment methods, and terminals.

**Done when** a fresh search of `app/actions` finds no action that builds a business date or an instant outside the shared helpers.

**Close-out:** list the actions changed.

## WP12 — SQL functions, triggers, views, and cron

Search `supabase/migrations` and the live catalog (read-only) for functions and triggers that compare a `timestamp without time zone` to `now()`, cast an instant without an IANA zone, or call `AT TIME ZONE` with a session zone. Starting files: `0625`, `0630`, `0670`, `0807`, `0810`, `0715`, `0739`.

Add `fn_ops_zone(tenant, operation, scope)` in a new migration. It is the SQL door and matches `resolveOperationalTimeZone`: the same closed operation codes, scope zone, then organization zone, and no zone when both are missing or invalid. It checks the scope belongs to the tenant and filters every `org_*` read by `tenant_org_id`. It is one indexed read. Comment the function and its arguments. Grant it only to the roles that already call tenant SQL functions. Do not grant `anon` or `authenticated`. A new zone argument is `TEXT`.

Existing functions that look up a timezone themselves are pointed at this function, or they read the snapshot on the row, in a later new migration. Known callers to replace: `fn_doc_seq_next` (HQ fallback, WP13) and the setup-health holiday check in `0739` (substitutes `UTC`). Do not call `fn_ops_zone` once per row of a list. Compute civil-day bounds once and compare the bare instant.

Each hit is either already correct, fixed in a new migration, or listed with a reason it is civil. Do not edit an applied migration.

**Done when** the function list is in `technical_docs/sql-clock-inventory.md` and every open hit has a new migration waiting for review. T18 passes against the function with the same vectors as the TypeScript door.

**Close-out:** Done. The inventory file classifies every former open function. `0840` and `0841` are applied on local and remote.

## WP13 — Document numbers

`fn_doc_seq_next` in `0670_doc_seq_engine_fns.sql` uses the tenant timezone and, when that value is null or invalid, substitutes `hq_general_config.timezone`. A new migration replaces that fallback with a failure for tenant-scoped types. SYS and HQ types keep the HQ clock. Issued numbers are not rewritten. Callers in services must pass a real instant, not a naive wall clock.

**Tests:** T9, T11.

**Close-out:** Written, not applied. Issued numbers were not rewritten.

## WP14 — Date pickers, filters, and dialogs

Refresh the picker list. Starting screens: order filters, report filters, processing filters, ready-by picker, promo and gift-card dialogs, FX rate dialog, voucher dialogs, B2B contract dialog, AR invoice wizard, tax setup, ERP Lite expenses and PO, reconciliation filters.

Classify each control. A day filter submits `YYYY-MM-DD`. An appointment submits civil date and time. The server converts. The control does not send the result of the browser's `Date`. A typed gap or overlap is rejected unless the form captured earlier or later. Check the changed controls in the browser.

Promo validity (`promo-form-dialog`) displays and saves `datetime-local` as civil time in the organization zone (`0.1.28-plan`). Gift-card issue and sell default the expiry to 31 December of that civil year and store the last millisecond of the chosen day. A missing zone blocks the save. Manual check is T29.

Discount-rule validity is the same kind of instant (`0.1.29-plan`). The FX rate date, tax-exemption dates, AR invoice dates, and the new voucher date are civil dates. Their default is the operations-zone civil day. A missing zone leaves that day empty. Manual check is T30. Order, report, processing, and reconciliation filters already submit `YYYY-MM-DD` from the control. B2B contract dates start empty. The ready-by picker already uses the fulfilment branch zone.

ERP Lite expense, cash transaction, cash reconciliation, and purchase-order dates default to the organization civil day (`0.1.30-plan`). The number month is that civil date. The expected date stays empty. Manual check is T31. A cashbox, supplier, bank account, cost component, and an allocation rule with no effective date take their month from one database instant in the organization zone (`0.1.31-plan`). A missing zone refuses the save. Manual check is T32.

**Close-out:** name the controls changed and any control left as civil on purpose. Add the manual cases to `testing_guide_and_scenarios.md`.

## WP15 — Customer message text

`web-admin/lib/notifications/order-event-variables.ts` formats Ready By with `toLocaleDateString`. With no valid zone it uses the server zone. Templates for SMS, email, WhatsApp, and in-app text take the operations zone into that formatter. A missing zone omits the clock rather than printing the server's day. `delivery-policy.ts` remains the quiet-hours civil rule. The outbox instant stays WP4. EN and AR templates both change.

**Close-out:** Done. `buildOrderCreatedNotificationVariables` takes the fulfilment zone. A missing zone leaves `estimated_ready_at` empty. Submit-order passes that zone. The existing notification tests cover Muscat, Los Angeles, and a missing zone.

## WP16 — Exports and imports

Refresh export and import routes. Starting routes: `app/api/v1/customers/export`, `products/export`, `ar/invoices/export`, `pricing/export`, and the FX import tab. An instant column is RFC 3339 `Z`. A human-facing export also has the civil date and the zone id. An import row with a datetime and no zone is rejected.

**Close-out:** name the routes and one sample file that was rejected.

## WP17 — Logs and audit screens

Log formatters in `web-admin`, `cmx-api/src/common/utils/logger.ts`, `cmx-workers/src/log.ts`, and `cmx_mobile_apps/packages/mobile_core/lib/src/app_logger.dart` write UTC ISO-8601. A line about a civil decision adds the zone id. Audit screens format the stored instant with the operations zone. They do not display the naive column when a `timestamptz` twin exists. Log lines stay free of customer payloads.

**Close-out:** name the four loggers and the audit screens.

## WP18 — Jobs besides the notification outbox

`finance-jobs.service.ts`, the POS session rollover, and the background-job claim functions from `0807` and `0810` compare `timestamptz` to `now()` for eligibility only. A worker claims a due row with a bounded lease and one idempotency key per logical occurrence. A job defined as local time stores the civil rule, the IANA zone, and a derived UTC fire time. A computed gap advances. A computed overlap uses the earlier offset. Operator screens that show a UTC cron say UTC. The zone is applied when `next_run_at` is calculated, not inside the due-row scan.

`cmx-workers` is the tenant queue consumer in this repo. Its pg-boss schedules stay `tz: 'UTC'`. Its handlers call the web-admin services above and do not compute a shop day. A shop-local job keeps the civil rule in the service and still fires the worker on the derived UTC instant. `packages/jobs` `startAfter` is an instant. HQ jobs stay in the sibling plan (`platform-workers`), not in this package. Removing `platform-workers` is a separate piece of work. This plan does not remove it.

**Close-out:** name the jobs and whether each change is code or a new migration.

## WP19 — `cmx-api`

Search `cmx-api/src` again at the start of the package. The 2026-11-24 search matched the logger only. Add a parser and a zone helper in `cmx-api` that follow WP10 and the closed operation codes. They do not import `web-admin`. The WP1 vectors run here too. Any controller, DTO, or service that accepts or returns a date uses those helpers. An empty route search does not finish the package by itself. The helpers still land, and the search result is written down.

**Close-out:** name the helper files and the search result.

## WP20 — Mobile apps

`cmx_mobile_apps` booking, tracking, and `app_date_time_picker_widget.dart` submit civil fields for a shop appointment and display instants in the shop zone returned by the API. The phone does not compute the shop's civil day. A missing zone shows no clock. Customer-facing strings stay in the app's EN and AR catalogs.

**Close-out:** name the screens and the API fields they read.

## WP21 — HQ readers

Before WP7 batch B6, and before the `sys_*` / `hq_*` part of WP8, write `technical_docs/hq-readers.md`. Each row names the table, the column, and the HQ file or job in `platform-web`, `platform-api`, or `platform-workers`. Converting that column waits until the list is reviewed. HQ screens, APIs, and workers do not wait for the list. Those behavior changes are the sibling plan at `cleanmatexsaas/docs/features/Time_and_Timezone/` (H0, H2–H5). This tenant pack does not edit that repo's application code. `cmx-workers` is tenant WP18, not an HQ reader.

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
| `cmx-workers` | WP17, WP18. Tenant queues. Schedules stay UTC. Shop-local fire times are calculated in the web-admin service |
| Mobile apps | WP20 |
| HQ (`platform-web`, `platform-api`, `platform-workers`) | WP21 for column readers, then `cleanmatexsaas/docs/features/Time_and_Timezone/` for screens, APIs, and workers. Screens do not wait for the reader list. Removing `platform-workers` is a separate piece of work, not this plan |
| Performance | WP1, WP6, WP12, WP18. One resolution per action. Join a mixed list. Filter a bare instant |
| Plan status | Close-out after every package, in `progress_summary.md`, `current_status.md`, and the surface map |
| Columns and migrations | WP3, WP4, WP5, WP7, WP8, WP12, WP13. New files only. Not applied here |
| Constants | IANA codes stay `sys_timezone_cd.code` |
| Env vars | None. Process `TZ=UTC` is an operations note in the deploy guide |
| CI | WP9. It covers `web-admin`, `cmx-api`, `cmx-workers`, mobile date parsing, and new SQL |

The surface map is [`surface-map.md`](./surface-map.md). A package that does not refresh its row on that map is not done.
