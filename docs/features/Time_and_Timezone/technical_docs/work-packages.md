# Work packages

Do the packages in order. A package that says "migration" produces a new SQL file and stops. It does not apply the file.

Rule: [`docs/dev/rules/time-and-timezone.md`](../../../dev/rules/time-and-timezone.md).
Inventory: [`column-inventory.md`](./column-inventory.md).

## WP1 — Shared clock (no migration)

**Done when** feature code can resolve a zone, format an instant, and reject a naive datetime without copying `Intl` logic.

- Add `resolveOperationalTimeZone` next to `web-admin/lib/utils/business-date.ts`. Branch `timezone_code`, else organization `timezone`, else null. Both must be valid IANA names and active `sys_timezone_cd` codes.
- Add `parseInstant` that accepts only RFC 3339 with `Z` or a numeric offset.
- Add `formatInstant(value, zone, locale)` and `civilDayBounds(date, zone)` that return a half-open UTC range.
- Keep `getTenantTimeZone` as the organization helper. Layout may keep passing it for non-operational chrome. Operational pages pass the resolver result.
- Delete the UTC fallbacks:
  - `web-admin/lib/services/catalog/speed-rules.service.ts` (`toISOString().slice(0, 10)`)
  - `web-admin/lib/services/lookups/service-speed-lookup.service.ts` (fallback zone `'UTC'`)
  - `web-admin/lib/services/tax/prepaid-tax.service.ts`
  - `web-admin/lib/services/tax/tax-lines.writer.ts`
- Point Ready By readers at `ready_by_at_new`. Start with the receipt mapper called out in the line-level money QA (`ready-order-types`) and the All Orders list mapper. Search `ready_by` and switch display reads. Leave the column in place.
- i18n keys for "time zone is not set" in `messages/en` and `messages/ar`, reused if an existing key already says that.

**Stop if** a Ready By reader has no `ready_by_at_new` in its query. Add the column to the select. Do not parse `ready_by` to fill the gap.

**Tests:** T1, T2, T3, T6, T9, F1, F3 in the testing guide.

## WP2 — Provenance note for Class A

**Done when** a short note, checked into this folder as `technical_docs/provenance-class-a.md`, states for each Class A column whether sampled values are UTC wall or Muscat wall, with the row ids and the log line used.

Read-only SQL only. Use `supabase_local` or `supabase_remote` as the user directs. Do not `UPDATE`.

Columns: `org_users_mst.locked_until`, `org_users_mst.last_failed_login_at`, `org_ntf_outbox_dtl.scheduled_at`, `org_ntf_outbox_dtl.next_retry_at`, `org_ntf_campaigns_mst.scheduled_at`, and `org_orders_mst.ready_by` where `ready_by_at_new` is null.

Also list the writers. Known writer to inspect: `web-admin/lib/notifications/campaign-jobs.service.ts` (`now() AT TIME ZONE 'UTC'`).

**Stop if** one column contains both shapes. That column leaves this package.

## WP3 — Lockout migration

**Depends on** WP2.

New migration, next sequence number at the time of writing. Convert `org_users_mst.locked_until` and `last_failed_login_at` with the `USING` clause WP2 proved. Comment the provenance. Login duration math subtracts instants. The API returns the remaining minutes from that difference.

**Stop** for review. Do not apply.

**Tests after apply:** T4.

## WP4 — Notification schedule migration

**Depends on** WP2.

New migration for `org_ntf_outbox_dtl.scheduled_at`, `next_retry_at`, and `org_ntf_campaigns_mst.scheduled_at`. Replace `now() AT TIME ZONE 'UTC'` assignments with `now()` once the column is `timestamptz`. Worker comparisons are `scheduled_at <= now()` on `timestamptz` only.

Quiet hours stay civil. The row that leaves the quiet-hours calculation is the UTC instant.

**Stop** for review. Name any HQ worker that reads `hq_ntf_dispatch_log` before touching `dispatched_at` or `failed_at`. Those two are Class B, not this package.

**Tests after apply:** T5.

## WP5 — Ready By backfill

**Depends on** WP2 for rows where `ready_by_at_new` is null.

New migration:

- Backfill `ready_by_at_new` from `ready_by` only where the twin is null, using the proven `USING` interpretation.
- Do not drop `ready_by`.
- Application writes set `ready_by_at_new` only.

A later package drops `ready_by` after a search shows no readers.

**Tests after apply:** T6, T7.

## WP6 — Presentation sweep

**Depends on** WP1.

Replace operational formatting in batches. Suggested order, because these files matched `toLocaleString`, `toLocaleDateString`, `getHours`, `setHours`, or `slice(0, 10)` on 2026-11-24:

1. Orders and print: `order-details-full-client.tsx`, `order-detail-client.tsx`, `order-receipt-print.tsx`, `order-payments-print-rprt.tsx`, `ready-date-picker-modal.tsx`, `ready-by-calculator.ts`.
2. Reports under `src/features/reports/ui/` and `app/dashboard/reports/`.
3. Finance vouchers and `app/dashboard/internal_fin/vouchers/`.
4. Customers, notifications, marketing, delivery, workboard.

Each batch: the screen waits for the operations zone, EN and AR show the same instant, and the print matches the screen.

Do not reformat jhtestui debug viewers except to label them UTC. They are not an operations clock.

**Tests:** T1, T7, T8, E3.

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

## WP8 — Audit stamps

**Depends on** the database `TimeZone` decision in the deploy guide.

Prefix-sized migrations for the 398 `created_at` / `updated_at` columns. Skip a table whose sample mixes UTC wall and Muscat wall.

## WP9 — CI guard

- A script or review check fails when a new migration adds `timestamp without time zone` without the comment `CIVIL:` (allowed only for a documented local wall clock that is not an instant).
- The same check fails on new `toISOString().slice(0, 10)` and unzoned `new Date('YYYY-MM-DD')` under `web-admin`.
- The T and E cases that can run without a browser live next to `business-date` tests.

## Coverage checklist

| Topic | This program |
|---|---|
| Permissions | None new |
| Navigation | None new |
| Settings | Existing organization `timezone` and branch `timezone_code`. No new default |
| Feature flags | None |
| i18n | Missing-zone and rejected-datetime strings, EN and AR |
| API | Reject offset-less instants at the boundary in WP1's parser, then call it from write routes the sweep touches |
| Migrations | WP3, WP4, WP5, WP7, WP8. New files only. Not applied here |
| Constants | IANA codes stay `sys_timezone_cd.code`. Do not add offset constants for conversion |
| Env vars | None. Process `TZ=UTC` is an operations note in the deploy guide |
