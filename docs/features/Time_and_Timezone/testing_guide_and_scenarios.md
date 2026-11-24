# Testing guide and scenarios

Run the cases that the phase actually touches. The full matrix becomes the Phase 6 suite.

Zone under test: `Asia/Muscat` (UTC+4, no daylight saving) plus one daylight-saving zone (`America/New_York`) for the scheduler cases.

## Functional

| ID | Phase | Steps | Expected |
|---|---|---|---|
| T1 | 1 | Open All Orders immediately after sign-in. Read Ready By. Reload. | The hour does not change between first paint and reload. It matches the order screen. |
| T2 | 1 | Branch zone `Africa/Cairo`, organization zone `Asia/Muscat`. Open that branch's order. | Times use Cairo. A branch with no zone uses Muscat. |
| T3 | 1 | Clear both zones. Open a till, save a ready time, create an order. | Each action is refused with a message to set the zone. No hour is shown from the laptop clock. |
| T4 | 2 | Fail login until lockout. Policy is 15 minutes. | The message says 15 minutes. A later login before 15 minutes stays locked. A login after 15 minutes works. |
| T5 | 2 | Schedule a notification for 09:00 at the shop. | The outbox instant is 05:00Z when the zone is `Asia/Muscat`. It does not send at 05:00 Muscat. |
| T6 | 2 | Order with `ready_by_at_new` at 06:00Z. | List, detail, and receipt show 10:00 in Muscat. |
| T7 | 3 | Print the same order from the list and from the receipt. | The same zone and the same hour. |
| T8 | 3 | List that contains two branches in two zones. | Each row uses its own zone, and the zone abbreviation is visible. |
| T9 | 1 | Create an order at 21:00Z with zone `Asia/Muscat`. | Business date and the day inside the order number are the next calendar day. |
| T10 | 4 | Change the organization zone after T9. | The issued number and the stored business date stay. New orders use the new zone. |
| T11 | 6 | Create an order when the organization zone is null. | No order number is issued. The error tells the user to set the zone. The HQ timezone is not used. |
| T12 | 6 | Public booking for 17:00 from a phone set to another zone. | The stored instant is 17:00 in the branch zone. |
| T13 | 6 | Order-created SMS, email, and WhatsApp for an order at 23:30 in Muscat. | The message names the Muscat calendar day. |
| T14 | 6 | Download a customer export and an invoice export. | Instant columns end with `Z`. A human export also has the civil date and the zone id. |
| T15 | 6 | Import an FX or other file whose datetime has no zone. | The row is rejected. |
| T16 | 6 | Open the mobile booking schedule and the order tracking screen. | The shop clock is shown. The phone zone does not change the submitted appointment. |

## Edge

| ID | Steps | Expected |
|---|---|---|
| E1 | Submit an API datetime with no offset. | Rejected. Nothing is stored. |
| E2 | Submit `YYYY-MM-DD` where an instant is required. | Rejected. |
| E3 | Submit shop time 17:00 from a browser whose zone is not the branch zone. | Stored instant is 17:00 in the branch zone. |
| E4 | Event at the next local midnight. | Excluded from the previous business day's half-open range. |
| E5 | Pick a local time that does not exist in `America/New_York` (spring forward). | The form rejects it. |
| E6 | A computed next fire falls in that gap. | The job advances to the next valid local time and records the adjustment. |
| E7 | A local time that happens twice (fall back). | The earlier offset is stored. |
| E8 | Duration across a daylight-saving change. | The elapsed minutes match the two UTC instants, not the wall-clock subtraction. |

## Failure

| ID | Steps | Expected |
|---|---|---|
| F1 | `ready_by_at_new` is null and `ready_by` has a value, before backfill. | UI shows no Ready By rather than the naive hour. |
| F2 | Provenance sample for a column shows both UTC wall and Muscat wall. | That column is not in the migration. The work package stops. |
| F3 | Report "today" while the zone is missing. | The report does not run against the UTC date. |

## What not to treat as a pass

A green unit test that stubs `Date` without an explicit zone does not prove T1 or T3. Those need the page and the zone resolver.
