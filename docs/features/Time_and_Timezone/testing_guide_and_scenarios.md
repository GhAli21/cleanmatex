# Testing guide and scenarios

Run the cases that the phase actually touches. The full matrix becomes the Phase 6 suite. Each landed batch adds its manual cases here before that batch is called done.

Zone under test: `Asia/Muscat` (UTC+4, no daylight saving) plus one daylight-saving zone (`America/New_York`) for the scheduler cases.

This Windows machine is also `Asia/Muscat`, so a screen that happens to show the laptop hour is not a pass. Use an order whose `ready_by_at` is `06:00Z` (10:00 in Muscat). Then set the laptop zone to UTC and reload. The screen must still show 10:00. Local branches have no `timezone_code`, so a branch clock shows the organization zone until that branch has its own active zone.

## Functional

| ID | Phase | Steps | Expected |
|---|---|---|---|
| T1 | 1 | Open All Orders immediately after sign-in. Read Ready By. Reload. | The hour does not change between first paint and reload. It matches the order screen. |
| T2 | 1 | Branch zone `Africa/Cairo`, organization zone `Asia/Muscat`. Open that branch's order. | Times use Cairo. A branch with no zone uses Muscat. |
| T3 | 1 | Clear both zones. Open a till, save a ready time, create an order. | Each action is refused with a message to set the zone. No hour is shown from the laptop clock. |
| T4 | 2 | Fail login until lockout. Policy is 15 minutes. | The message says 15 minutes. A later login before 15 minutes stays locked. A login after 15 minutes works. |
| T5 | 2 | Schedule a notification for 09:00 at the shop. | The outbox instant is 05:00Z when the zone is `Asia/Muscat`. It does not send at 05:00 Muscat. |
| T6 | 2 | Order with `ready_by_at` at 06:00Z. | List, detail, and receipt show 10:00 in Muscat. |
| T7 | 3 | Print the same order from the list and from the receipt. | The same zone and the same hour. |
| T8 | 3 | List that contains two scopes in two zones, including one winter instant and one summer instant in a daylight-saving zone. | Each row uses its own zone. The label is that row's IANA name plus the abbreviation and offset of the instant on the row. |
| T9 | 1 | Create an order at 21:00Z with zone `Asia/Muscat`. | Business date and the day inside the order number are the next calendar day. |
| T10 | 4 | Change the organization zone after T9. | The issued number and the stored business date stay. New orders use the new zone. |
| T11 | 6 | Create an order when the organization zone is null. | No order number is issued. The error tells the user to set the zone. The HQ timezone is not used. |
| T12 | 6 | Public booking for 17:00 from a phone set to another zone. | The stored instant is 17:00 in the branch zone. |
| T13 | 6 | Order-created SMS, email, and WhatsApp for an order at 23:30 in Muscat. | The message names the Muscat calendar day. |
| T14 | 6 | Download a customer export and an invoice export. | Instant columns end with `Z`. A human export also has the civil date and the zone id. |
| T15 | 6 | Import an FX or other file whose datetime has no zone. | The row is rejected. |
| T16 | 6 | Open the mobile booking schedule and the order tracking screen. | The shop clock is shown. The phone zone does not change the submitted appointment. |
| T17 | 1 | Create an order received at a Cairo branch and fulfilled at a Muscat branch. Send a client zone of `Europe/London`. | Ready-by uses the fulfilment scope. The receiving timestamp uses the receiving scope. The client zone does not replace either. |
| T18 | 1, 6 | Run the closed operation codes through the TypeScript door and, once it exists, through `fn_ops_zone`, with the same tenant, scope, and invalid-zone rows. | Both doors return the same zone or the same refusal. A delivery, invoice, and ledger call resolve the owning branch. The country catalog timezone is not used. |
| T19 | 1, 3 | Open a mixed-branch list and a one-branch save. | The save resolves once. The list query joins the zone and does not call the resolver per row. The filtered instant is not wrapped in `AT TIME ZONE`. |
| T20 | 1 | Open a POS session while the database instant is 21:00Z and the branch zone is `Asia/Muscat`. | The stored business date is the next civil day. The application clock is not the source. |
| T21 | 3 | Open Workboard, Processing, Home Collection, Quality Check, Packing, Assembly, and the Ready list for an order at `06:00Z`. Set the laptop zone to UTC and reload. | Every Ready By label stays 10:00 in Muscat. The first paint and the reload match. |
| T22 | 3 | On Workboard and Processing, compare the Due today badge with the Muscat civil day of `ready_by_at`. Apply the Workboard Due today filter. | The badge and the filter use that civil day. An instant that is today on the laptop and yesterday in Muscat is not due today. Overdue stays an instant comparison. |
| T23 | 3 | Open the processing order, the piece editor, and the simple processing dialog for that same order. | The order Ready By, the item and piece clocks, and the created-at label stay on the fulfilment branch zone. |
| T24 | 3 | Open a delivery route and the delivery proof card for an order. Note Delivered today. | The route created-at uses the route branch zone. The proof times use the order branch zone. Delivered today starts at the organization civil midnight, so 21:00Z counts on the next Muscat day. |
| T25 | 3 | Open the customer list, the loyalty tab, and stored value. Open a campaign and the notification delivery log in Arabic. | Last order, loyalty dates, expiry, and campaign and delivery-log clocks use the organization zone. Arabic uses the Arabic locale. A missing zone leaves the clock blank. |
| T26 | 3 | Open gift cards, a gift-card transaction, promo codes, and promo usage. Open discount rules whose dates are calendar dates. | Gift-card and promo instants use the organization zone. A discount-rule date stays that calendar day. |
| T27 | 3 | Open a cash drawer, a refund, a reconciliation run, and the gift-card liability report. Issue a tax document just after local midnight. | The drawer uses the till branch. The refund uses the order branch. The reconciliation run uses the run branch, and its period stays the civil date. Liability uses the organization zone. The tax-document year is the civil year of that instant in the invoice zone. A missing zone shows no clock and refuses the tax document. |
| T28 | 3 | Clear the organization zone on a development tenant and open one screen from T21 and one from T25. | Those clocks are blank. Due today is not shown. No laptop hour appears. |
| T29 | 3 | With the organization zone `Asia/Muscat` and the laptop set to UTC, open a promo whose `valid_from` is `2026-10-03T20:00:00Z`. Save it unchanged. Issue or sell a gift card and leave the expiry on the suggested 31 December. Then clear the organization zone and try both saves with a time filled in. | The promo fields show `2026-10-04T00:00`. Saving unchanged keeps `20:00Z`. The gift card is valid through that civil day and the list shows 23:59 on 31 December, not 04:00. With no organization zone the save is refused and no laptop hour is stored. |
| T30 | 3 | At 21:00Z, with the organization zone `Asia/Muscat` and the laptop set to UTC, open a new discount rule, a new FX rate, a new tax exemption, a new AR invoice, and a new voucher. Then clear the organization zone and open them again. | Each suggested day is the next Muscat calendar day, not the UTC day. The discount-rule time is that civil time and saves back to the same instant. The FX, tax, invoice, and voucher values stay `YYYY-MM-DD`. With no zone those days are empty and a save is not given the UTC day. |
| T31 | 3 | At 21:00Z on the last UTC day of a month, with the organization zone `Asia/Muscat` and the laptop set to UTC, open ERP Lite Expenses and Purchase Orders. Save an expense and a purchase order on the suggested day. Clear the organization zone and reload. | The suggested day is the next Muscat day. The expense number and the purchase-order number use that month. The expected date stays empty. With no zone the date fields are empty and the page says a date cannot be chosen. |
| T32 | 3 | At 21:00Z on the last UTC day of a month, with the organization zone `Asia/Muscat` and the laptop set to UTC, create a supplier and a cash box. Neither form has a document date. Then clear the organization zone and create another supplier. | The supplier code and the cash-box code use the next Muscat month, not the UTC month. With no zone the save is refused and no code is stored. |
| T33 | 3 | At 21:00Z on the last UTC day of a month, with the organization zone `Asia/Muscat`, set a credit note to expire on the UTC date and another to expire on the Muscat date. Run expiry. Clear the organization zone and run expiry again. | The note that expires on the UTC date is still active, because Muscat is already the next day. The note that expires on the Muscat date is expired. With no zone, neither note expires. |
| T34 | 3 | At 21:00Z on the last UTC day of a month, with the organization zone `Asia/Muscat` and the laptop set to UTC, filter gift-card transactions and the tax report to that UTC date. Export customers. Clear the organization zone and filter again. | The lists include rows whose instant falls on the next Muscat day. The customer file shows that civil day, the `Z` instant, and `Asia/Muscat`. With no zone the filter is refused and the export dates are blank. |
| T35 | 3 | With the laptop set to UTC and the organization zone `Asia/Muscat`, open public booking for a branch, download the product, price-list, and invoice exports, and save a legacy voucher. Clear the organization zone and repeat. | The evening slot starts at 18:00 in Muscat (`14:00Z`). The file names and the voucher date use the Muscat day. With no zone the booking returns no slots, the file name uses `export`, and the voucher save is refused. |
| T36 | 3 | At 21:00Z on the last UTC day of a month, with the organization zone `Asia/Muscat`, issue an invoice due on the UTC date and record a payment that leaves a balance. Clear the zone and issue another. | The first invoice is overdue, because Muscat is already the next day. The invoice with no zone stays open. |
| T37 | 3 | At 21:00Z on the last UTC day of a month, with the laptop set to UTC and the organization zone `Asia/Muscat`, filter the orders summary, payments breakdown, and outbox to that UTC date. Run reconciliation for that date. Redeem a credit note that expires on the UTC date. Clear the zone and repeat. | The lists and the reconciliation include rows whose instant falls on the next Muscat day. The credit note is expired. With no zone the filters and the run are refused, and the note stays active. |
| T38 | 3 | At 21:00Z on the last UTC day of a month, with the laptop set to UTC and the organization zone `Asia/Muscat`, open the orders, payments, invoices, and customers reports for that Muscat day. Open the invoices report for an invoice due on the UTC date. Clear the zone and reload. | The day chart puts the 21:00Z rows on the next Muscat day. The invoice is not overdue until that Muscat day has passed. With no zone the report is refused. |
| T39 | 3 | Save a tax exemption valid from `2026-04-01` with the laptop set to a zone west of UTC. Then submit a datetime instead of a date, and a valid-to before valid-from. | The stored day stays 1 April. The datetime and the reversed range are refused. |
| T40 | 3 | At 21:00Z, with the laptop set to UTC and the organization zone `Asia/Muscat`, open the orders, payments, and customers report tables for a row at 21:00Z. Open cash variance. Clear the zone and reload cash variance. | The table day is the next Muscat day. Cash variance ends on that Muscat day. With no zone the range stays empty and the report does not run. |
| T41 | 3 | At 21:00Z on the last UTC day of a month, with the laptop set to UTC and the organization zone `Asia/Muscat`, open the gift-card liability month-to-date totals. Clear the zone and reload. | Issued and redeemed month-to-date use the next Muscat month. With no zone those two totals stay zero and the outstanding balance still shows. |
| T42 | 3 | At 21:00Z, with the laptop set to UTC and the organization zone `Asia/Muscat`, open the dashboard orders-today and revenue widgets, and the orders list delivered-today count, for an order created at 21:00Z. Clear the zone and reload. | The order counts on the next Muscat day. With no zone those day windows stay empty. |
| T43 | 3 | Set the laptop to `America/Los_Angeles`, the branch zone to `Asia/Muscat`. In New order pick a Ready By of 10:00 Muscat (06:00Z). Open the public tracking link and the order detail tabs (invoices, receipts, payments). Repeat with the laptop on `Asia/Kathmandu`. Clear the branch and organization zone and reload. | Ready By, tracking received / ready-by / timeline, and tab times show 10:00 (Muscat) in both laptop zones; hovering a time shows the zone. With no zone the times show `—`, never the laptop time. |

## Edge

| ID | Steps | Expected |
|---|---|---|
| E1 | Submit an API datetime with no offset. | Rejected. Nothing is stored. |
| E2 | Submit `YYYY-MM-DD` where an instant is required. | Rejected. |
| E3 | Submit shop time 17:00 from a browser whose zone is not the branch zone. | Stored instant is 17:00 in the branch zone. |
| E4 | Event at the next local midnight. | Excluded from the previous business day's half-open range. |
| E5 | Pick a local time that does not exist in `America/New_York` (spring forward). | The form rejects it. |
| E6 | A computed next fire falls in that gap. | The job advances to the next valid local time and records the adjustment. |
| E7a | A computed next fire falls in a fall-back overlap. | The earlier offset is stored and the choice is recorded. |
| E7b | A person types that ambiguous local time and does not pick earlier or later. | The form rejects it. |
| E7c | A person picks later on that same overlap. | The later offset is stored. |
| E8 | Duration across a daylight-saving change. | The elapsed minutes match the two UTC instants, not the wall-clock subtraction. |

## Failure

| ID | Steps | Expected |
|---|---|---|
| F1 | `ready_by_at` is null. | UI shows no Ready By. |
| F2 | Provenance sample for a column shows both UTC wall and Muscat wall. | That column is not in the migration. The work package stops. |
| F3 | Report "today" while the zone is missing. | The report does not run against the UTC date. |
| F4 | Complete public registration from a browser in `America/Chicago`. | The confirmed zone is stored on the organization. The operations door does not read the browser on the next order. |

## What not to treat as a pass

A green unit test that stubs `Date` without an explicit zone does not prove T1 or T3. Those need the page and the zone resolver.

## Reserved for MASTER_PLAN_v2 slices

Each case is written in full when its slice lands (see `MASTER_PLAN_v2.md` §7.13). T43–T51 were reserved on 2026-11-26 at `0.1.40-plan`; T61–T68 were added at `0.1.41b-plan` by the gap review; T52–T60 were added at `0.1.41-plan` when planning was finalized, and T52/T53/T58/T59 were adjusted at `0.1.41a-plan`.

| ID | Slice | Case |
|---|---|---|
| T43 | S3 | New-order Ready By panel and public order tracking show the branch clock with the browser in another zone |
| T44 | S4 | Settings → General saves `UTC` and a non-GCC zone (e.g. `America/Sao_Paulo`) from the picker; an alias saves as its canonical name; a typed bad value is refused (`INVALID_TIME_ZONE`). Registration shows the same picker. With no tenant zone, the orders list shows "Time zone not configured" and times show `—` |
| T45 | S5 (**passed by the user 2026-11-27**) | SQL "today" at 21:00Z for a Muscat tenant in setup health, price lookup, and tax checks (automated: `supabase/tests/clock_s5_current_date.test.sql`, PASS 1–7; manual: setup health shows no false "expired" for that tenant after 21:00Z) |
| T46 | S6 | Typed appointment in a daylight-saving gap and overlap (`America/New_York`) asks earlier or later (automated: `api-clock.test.ts`, `clock-ui-s6.test.tsx`; `resolveZonedInput` + `CmxDstChoice`. Manual once a typed-appointment screen uses them, S9) |
| T47 | S8 | Hourly tenant sweep acts once per local day for a Los Angeles and a Muscat tenant |
| T48 | S9 | Business-day cut-over `04:00`: POS business date at 02:00 local is the previous day |
| T49 | S10 | Zone change refused while a POS session is open; later allowed; issued numbers and business dates unchanged |
| T50 | S12 | Mobile booking with the phone in another zone submits the shop's civil date and time |
| T51 | S13 | HQ tenant list shows each tenant's zone; HQ invoice uses the HQ zone |
| T52 | S2 (SQL: SQL written 2026-11-27 (`0842`/`0843`, not applied); automated in `supabase/tests/clock_sql_api.test.sql` §5, green on scratch), S9 (UI) | Hour cycle and week start (D33): a tenant value in `org_tenants_mst.time_format` / `first_day_of_week` wins; with no tenant value the country default (`sys_country_cd`, CLDR) is used; a country with no default shows `CLOCK_SETTING_UNRESOLVED` and then uses `hq_general_config.time_format` / `first_day_of_week`; EN and AR |
| T53 | S2 (SQL: §5 of the same file, green on scratch), S9 (UI) | Cut-over resolves branch → tenant → `hq_general_config.business_day_cutover` (`00:00`) (D33); a branch value of `12:00` is refused; `CLOCK_CUTOVER_INVALID` and `CLOCK_CUTOVER_INCONSISTENT` appear in setup health when seeded |
| T54 | S2 — SQL written 2026-11-27 (`0842`/`0843`, not applied); automated in `supabase/tests/clock_sql_api.test.sql` §1, green on scratch; run it on the local DB after apply | Fake clock: `cmx.fake_now` is honored only when the environment table says `test` and the session is `postgres`/superuser; ignored for `authenticated`, `anon`, `service_role`; production results equal `now()` and `clock_timestamp()` |
| T55 | S2, S7, S9, S13 | `fn_cmx_dt_health` findings appear in tenant setup health, the HQ ops-health card, and `GET /api/v1/health/clock` |
| T56 | S4, S7 | Viewer-zone toggle (S4: orders list, Ready By column; `?tz=device` survives reload): default branch zone; "My device zone" re-renders instants only; day filters and grouping do not change; export names the zone; badge shows when zones differ |
| T57 | S6 | Every screen endpoint returns a correct `clock` block (`zone`, `businessDate`, `serverNow`, `hourCycle`, `weekStart`, `tzdbVersion`); a write with a different client zone gets `409 ZONE_MISMATCH`. Endpoints: `technical_docs/api-clock-inventory.md` (contract test `api-clock-inventory.test.ts`). |
| T58 | S8 | Quiet hours for a Muscat and a Los Angeles tenant use their `notify` zone; the next send is computed with `fn_cmx_dt_at_local`, including a daylight-saving day; `quiet_hours_tz` is not read |
| T59 | S2 (SQL: §2/§3 of `clock_sql_api.test.sql` and the `zoneValid`/`catalog` vectors in `clock_vectors.test.sql`), S4 | IANA validation via `sys_timezone_cd` accepts `Asia/Muscat` and `UTC`, normalizes a `backward` alias to the canonical name, and rejects `GST`, `EST`, `+04:00`, `Etc/GMT-4`, `posix/Asia/Muscat` in SQL, TypeScript, and the settings screen |
| T60 | S1 — **automated, green 2026-11-27** | `temporal-polyfill` is imported only in `packages/clock/src/temporal.ts`; polyfill and native adapters give identical vector results. Run: `npm test -w @cmx/clock` (vectors under the polyfill and the native path, `TZ=UTC` and `TZ=Pacific/Kiritimati`), `npm run test:clock-tz -w web-admin`, `npm run check:clock-contract` (exit 0). Pass: all green; adding `import 'temporal-polyfill'` to any other file fails ESLint and the guard |
| T61 | S2 (`0842` preflight `CLOCK_CATALOG_DEMOTION_BLOCKED` + verification block; Q15 after apply) | An Omani tenant keeps `Asia/Muscat` after `0842`; the picker lists it under Oman; `Asia/Dubai` is never substituted |
| T62 | S2 (SQL: §3, validators for tenant, branch and HQ), S4 | Saving `Asia/Calcutta` stores `Asia/Kolkata`; saving `EST` or `GMT+4` is refused in tenant settings, the branch card, and HQ |
| T63 | S2 (SQL: §3 and `zoneResolution` vectors; `SQL_DOOR_OPERATIONS` includes `notify` from this change on), S8 | `notify` and `delivery` resolve different branch scopes for one campaign; no caller uses `notify` before `0842` is applied |
| T64 | S2 (SQL: §7; UI check after apply) | Setup health shows the `CLOCK` group in EN/AR with fix links; platform clock checks appear only in HQ |
| T65 | S2 (after apply: `SELECT code, default_hour_cycle, default_week_start, cldr_version FROM sys_country_cd WHERE code IN (…)`) | CLDR 49 seed spot check: week start (0 = Sunday … 6 = Saturday) `OM` 6, `SA` 0, `AE` 1, `US` 0, `DE` 1, `MV` 5, `KW` 6, `IN` 0; hour cycle `US` H12, `OM` H12, `SA` H12, `AE` H12, `DE` H23, `GB` H23; `cldr_version = '49'`. (The 0.1.41b examples `OM` H23 and `AE`/`SA` Saturday were not CLDR; open question in `IMPLEMENTATION_REPORT.md` S2.) |
| T66 | S2 — SQL written 2026-11-27 (`0842`/`0843`, not applied); automated in `supabase/tests/clock_sql_api.test.sql` §1 (`SET ROLE authenticated` / `anon`: real time, WARNING only), green on scratch | Fake clock as `authenticated` with `cmx.fake_now` set returns the real time and raises no permission error |
| T67 | S5 (**SQL part passed 2026-11-27**, section 6) | Credit-note expiry for a tenant without a zone is skipped and reported, not silently "not due" (`fn_fin_credit_note_expiry_run` returns `zone_missing`; single expiry returns `CREDIT_NOTE_ZONE_MISSING`) |
| T68 | S8 | Quiet-hours settings save without `quiet_hours_tz`; existing rows still load |
