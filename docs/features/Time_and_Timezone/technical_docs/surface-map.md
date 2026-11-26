# Surface map

Every row is in scope. A work package is finished only when its row is checked against a fresh file search on the day the work starts. Counts below are the 2026-11-24 starting set, not a promise that no later file exists.

Contract: [`docs/dev/rules/time-and-timezone.md`](../../../dev/rules/time-and-timezone.md).

| # | Surface | What “done” means | Starting evidence | Package |
|---|---|---|---|---|
| 1 | Postgres columns | Every naive instant is classified, proven, and converted, or explicitly left as `date` / `time` | Organization naive timestamps are gone (`0834`–`0839`, OTP in `0841`). `sys_*` and `hq_*` catalog stamps stay naive until the reader list | WP2–WP5, WP7, WP8 |
| 2 | SQL functions, triggers, views | New civil-day work calls `fn_ops_zone` or reads the row snapshot. No function compares a naive timestamp to `now()` or casts an instant without a named IANA zone. List filters compute bounds once | `0670` doc-seq, `0739` holiday check substitutes `UTC`, `0625`/`0630` notifications, `0807`/`0810` job queues, `0715` HQ audit | WP12 |
| 3 | Cron and workers | Fire times are UTC instants. Due means eligible. A claim uses a bounded lease and one idempotency key. A shop-local rule stores civil time plus the zone and a materialized `timestamptz`. `cmx-workers` schedules stay `tz: 'UTC'` | `cmx-workers`, `campaign-jobs.service.ts`, `finance-jobs.service.ts`, `process-outbox`, `process-campaigns`, POS rollover | WP4, WP18 |
| 4 | Document numbers | The day inside a tenant code is the operations-zone civil day. An invalid tenant zone fails the issue. Issued codes are not renumbered | `fn_doc_seq_next` falls back to `hq_general_config.timezone` when the tenant zone is invalid (`0670`) | WP13 |
| 5 | Services | Business rules call the shared resolver, parser, and calendar. No service computes a business day with `slice(0, 10)` or `getHours`. A persisted business date uses one database instant | Named clocks now use a database instant, including prepaid tax and refund reversal. `createTaxDocumentTx` takes the fiscal year from one database instant in the invoice zone. `formatReadyByDate` remains WP6 | WP1 |
| 6 | HTTP API routes | Every route that accepts or returns a date uses the shared parser and returns instants as RFC 3339 `Z` | Campaigns, public booking, orders, delivery routes, promotions, reconciliation, tax exemptions, credit notes, vouchers, price lists, cash drawers | WP10 |
| 7 | Webhooks | Inbound instants have an offset. Outbound instants are `Z` | `hq_ntf_webhook_events`, notification dispatch | WP10 |
| 8 | Server actions | Same parser and zone rules as HTTP routes | `app/actions` for promotions, gift cards, tax, refunds, reconciliation, drivers, cash drawers, loyalty, payment methods | WP11 |
| 9 | Validation | Zod (and the mobile equivalent) distinguish an instant from a civil date from a local time | Write routes and dialogs in row 6 and row 10 | WP10, WP14 |
| 10 | Date pickers and filters | A business-day control submits `YYYY-MM-DD`. A shop appointment submits civil fields. The browser zone is not the converter | Order filters, report filters, processing filters, ready-by picker, promo, gift card, FX rate, voucher, B2B contract, AR invoice, tax setup, ERP Lite expense and PO | WP14 |
| 11 | Pages and screens | Each operational page formats with its documented scope, then the organization zone, after that zone is known. The label uses the offset of the instant being shown | Dashboard pages under `web-admin/app/dashboard`, feature screens under `src/features` | WP6, WP22 |
| 12 | Print, PDF, labels | Same zone as the screen, named in the document header | Order receipt, payment prints, B2B statements, cash-drawer session, label renderer | WP6 |
| 13 | Customer message bodies | The day and clock inside SMS, email, WhatsApp, and in-app text use the operations zone | Ready By uses the fulfilment zone. A missing zone leaves the label empty. A date-only value stays that calendar day | WP15 |
| 14 | Exports and imports | An export of an instant includes `Z`. A human export also includes the civil date and the zone id. An import rejects a datetime with no zone | `customers/export`, `products/export`, `ar/invoices/export`, `pricing/export`, FX import | WP16 |
| 15 | Logs | Log lines are UTC ISO-8601. A civil decision adds the zone id as a field | `web-admin` logger, `cmx-api/src/common/utils/logger.ts`, `cmx-workers/src/log.ts`, `cmx_mobile_apps/.../app_logger.dart` | WP17 |
| 16 | Audit UI | Rows store a UTC instant. The screen formats it with the operations zone | Finance action audit, post audit, delivery log, order edit history | WP6, WP17 |
| 17 | `cmx-api` | The Nest API has its own parser and zone helper, with the same vectors as `web-admin`, and every date route uses them | 2026-11-24 search matched only the logger. The helpers still land | WP19 |
| 18 | Mobile apps | Booking, tracking, and the shared date picker submit civil fields and show the shop clock | `customer_order_booking_screen.dart`, `customer_booking_step3_schedule_vw.dart`, `app_date_time_picker_widget.dart`, `order_booking_service.dart`, `order_tracking_service.dart` | WP20 |
| 19 | HQ readers | HQ's own documents use `hq_general_config.timezone`. A tenant row uses `fn_ops_zone` or the tenant snapshot. Before a tenant column HQ reads is converted, the HQ reader is named. HQ code changes are a sibling pack | `hq_ntf_dispatch_log`, `hq_general_config.timezone`, doc-seq HQ fallback | WP21 |
| 20 | Cache and “today” | A cache key or default that means today includes the civil date and the zone id | Report filters, dashboard widgets, speed-rule “today” | WP1, WP22 |
| 21 | Seeds, fixtures, tests | Tests set an explicit zone. They do not treat the machine zone as the shop zone | `__tests__` next to each package | WP9 |
| 22 | i18n | New errors exist in EN and AR. Locale changes digits and month names only | `web-admin/messages/en`, `web-admin/messages/ar` | WP1 |
| 23 | Settings screens | Organization and branch zone screens stay the only place a zone is chosen. They do not gain a silent default | Existing timezone settings | WP22 |
| 24 | CI | New naive instants, unzoned date parses, offset-less API datetimes, and a private timezone lookup in new SQL fail the check | `web-admin`, `cmx-api`, `cmx-workers`, mobile date parsing, new migrations | WP9 |

## Known defects the map must not lose

- `fn_doc_seq_next` substitutes the HQ timezone when the tenant timezone is null or invalid. Tenant numbering fails closed instead. SYS and HQ document types keep the HQ clock.
- The setup-health holiday check in `0739` substitutes `UTC` when the organization zone is missing or invalid. It will call `fn_ops_zone` and fail closed instead.
- `formatReadyByLabel` formats an instant in the operations zone. With no valid zone the label is empty. A date-only value stays that calendar day. Approved notification template text is still the stored wording.
- `getTenantTimeZone` is the organization zone. Operational pages resolve the feature's documented scope, then the organization. Layout must not be treated as that scope clock.
- Public booking (`app/api/v1/public/customer/booking/route.ts`) accepts a customer appointment. The server applies the documented scope. A zone sent by the phone is an echo only.
- Development rows may be rewritten. A naive instant whose writer stores `now()` converts with `USING column AT TIME ZONE 'UTC'`. A civil value stays `date` or `time`. `sys_*` and `hq_*` stamps wait for the HQ reader list. Readers of a column that is still naive show no clock.
- Opening a POS session stores `opened_at` from `clock_timestamp()` and derives the business date from that instant.
- `tax-explain.service.ts` throws when the organization zone is missing.
- Ready By readers and writers use canonical `ready_by_at` (`timestamptz`, renamed from `ready_by_at_new` in `0833`), and actual Ready uses `ready_at` (`timestamptz`). Order screens, the receipt, the payments print, the voucher list, the financial report date, the ready-date picker, and preparation ready-by rounding use the operations zone. A missing zone or a naive timestamp shows no clock. `formatReadyByDate` stays empty without a zone. A caller that omits the zone still rounds on the machine clock.
- `sys_country_cd.default_timezone_code` is not an operations zone. A scope with no timezone column names the branch that owns the action.
