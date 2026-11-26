# Current status

**State:** `0828` through `0833` are applied on the local and remote databases. `org_orders_mst` now uses canonical `ready_by_at` and `ready_at` (`timestamptz`), with legacy `ready_by` and `ready_by_override` dropped. Tenant document numbers and the express setup-health day use `fn_ops_zone`. Membership lock columns and the login-attempt result are `timestamptz`.

**Blocker:** `0832` and `0833` are applied on the local and remote databases. Development rows may be rewritten. Later instant columns convert as UTC walls because the session is UTC. Civil columns stay `date` or `time`. HQ column conversion stays blocked on `technical_docs/hq-readers.md`.

## Risks

| Risk | What happens | Control |
|---|---|---|
| One conversion clause for the audit stamps | A development row written under another session moves by four hours | Accepted. WP8 is one migration, `USING column AT TIME ZONE 'UTC'`. The other 90 event columns stay one domain per migration. |
| Reintroducing `ready_by` | A screen can print the old naive hour again | `0833` dropped `ready_by` and `ready_by_override`. Readers use `ready_by_at`. A null promised instant shows no clock. |
| Browser zone as a fallback | The Ready By flip returns | Fail closed. Skeleton until the operations zone is known. |
| Reading a naive column as UTC before the sample | Historical rows move by four hours | Use the `timestamptz` twin, or show no clock, until provenance names one clock |
| Treating the current UTC session as proof that old naive values are UTC | A development row written as a Muscat wall moves by four hours | Accepted for audit stamps and for other instants whose writer stores `now()`. Civil columns stay `date` or `time`. |
| Rewriting `business_date` during a zone edit | Closed days and issued order numbers move | The rule freezes them. Tests cover a later zone edit. |
| Local and remote column widths differ after `0826` | Prisma now follows the local catalog: `country` and `country_code` are `varchar(100)`, `currency` is `varchar(10)`, `language` is `varchar(10)`. Remote is still `varchar(2)`, `varchar(3)`, and `varchar(5)`. Local `updated_at` has no default. Remote still defaults it to `CURRENT_TIMESTAMP` | Defaults match on both. Widths were already different before `0826`. Do not treat the pulled schema as a remote type change. |

## Next action

Continue the presentation sweep. Cash drawers use the till's branch zone. Refund and reconciliation clocks use the order or run branch, then the organization. Gift-card liability uses the organization zone. A tax document's fiscal year comes from one database instant in the invoice zone. Customers, notifications, marketing, delivery, and workboard screens still format with the machine clock. `cmx-workers` is in WP18. HQ screens start in the sibling plan. `sys_*` and `hq_*` column conversion waits for the reader list.

## Evidence already on record

- Background jobs F15: naive `scheduled_at` compared with `now()` under `Asia/Muscat`.
- User session QA: lockout text said 255 minutes. `org_users_mst.locked_until` is `@db.Timestamp(6)`.
- Line-level money snapshot QA: naive `ready_by` printed 06:00 while the promised instant was 10:00 in Muscat. `0833` dropped `ready_by` and `ready_by_override`, renamed the promised column to `ready_by_at`, and made `ready_at` `timestamptz`. A null `ready_by_at` shows no clock. `formatReadyByDate` stays empty without a zone.
- `fn_doc_seq_next` substitutes the HQ timezone when the tenant zone is missing or invalid. Tenant numbering will fail closed. That fix is a new migration, not an edit of `0670`.
- Customer message text formats a Ready By instant in the fulfilment branch zone. A missing zone leaves the label empty. A date-only value stays that calendar day. Approved template wording in the database is unchanged.
- Opening a POS session now stores `opened_at` from `clock_timestamp()` and derives the business date from that instant. The rollover sweep uses one database instant when the caller does not inject one.
- `tax-explain.service.ts` throws `OperationalZoneMissingError` when the organization zone is missing. Public booking bootstrap calls that path.
- `sys_country_cd.default_timezone_code` is catalog metadata. It is not an operations fallback.
- Public registration and migration `0826` sit beside this program. Neither one is the operations clock. `0826` was applied on the local and remote databases on 2026-11-25. Prisma was pulled from the local database.
- Provenance on 2026-11-25: outbox `scheduled_at` matches `finalized_at` as a UTC wall, including four late sends that are not a +04:00 population. `next_retry_at` and campaign `scheduled_at` had no stored rows. `locked_until` is empty. One `last_failed_login_at` equals its own naive `updated_at`. Ready By null twins were zero. 29 of 32 paired rows matched the promised instant as a UTC wall. Three rows differed and were not overwritten. `0833` kept those three on `ready_by_at` and dropped `ready_by`.
- `0828`, `0829`, `0830`, and `0831` were applied on the local and remote databases on 2026-11-25. The Ready By backfill updated 0 rows. `fn_ops_zone` matches the stored organization zone on both databases.
