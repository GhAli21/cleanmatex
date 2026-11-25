# Current status

**State:** Plan accepted as the working program. Clock-program implementation has not started. Every package updates this file, `progress_summary.md`, and the surface map before it is called done.

**Blocker:** None for Phase 1. Phase 2 is blocked on a read-only provenance sample per column. Do not write the `USING` clause before that sample. HQ column conversion is blocked on `technical_docs/hq-readers.md`.

## Risks

| Risk | What happens | Control |
|---|---|---|
| One conversion clause for every naive column | Historical rows move by the session offset (four hours in Muscat) | Provenance per column. Separate migrations. |
| Dropping `ready_by` immediately | Old readers and reports go blank | Read the twin first. Backfill null twins. Drop in a later migration. |
| Browser zone as a fallback | The Ready By flip returns | Fail closed. Skeleton until the operations zone is known. |
| Reading a naive column as UTC before the sample | Historical rows move by four hours | Use the `timestamptz` twin, or show no clock, until provenance names one clock |
| Treating the current UTC session as proof that old naive values are UTC | Historical rows can still be Muscat wall clocks | Provenance per column. On 2026-11-25 both sessions were UTC. That fact does not convert a column. |
| Rewriting `business_date` during a zone edit | Closed days and issued order numbers move | The rule freezes them. Tests cover a later zone edit. |
| Local and remote column widths differ after `0826` | Prisma now follows the local catalog: `country` and `country_code` are `varchar(100)`, `currency` is `varchar(10)`, `language` is `varchar(10)`. Remote is still `varchar(2)`, `varchar(3)`, and `varchar(5)`. Local `updated_at` has no default. Remote still defaults it to `CURRENT_TIMESTAMP` | Defaults match on both. Widths were already different before `0826`. Do not treat the pulled schema as a remote type change. |

## Next action

Phase 1 in [`technical_docs/work-packages.md`](./technical_docs/work-packages.md): shared helpers, Ready By readers, and removal of the UTC-date fallback. No migration in that phase. The surface map is the completeness check for every later package.

## Evidence already on record

- Background jobs F15: naive `scheduled_at` compared with `now()` under `Asia/Muscat`.
- User session QA: lockout text said 255 minutes. `org_users_mst.locked_until` is `@db.Timestamp(6)`.
- Line-level money snapshot QA: `ready_by` printed 06:00; `ready_by_at_new` is the 10:00 Muscat instant.
- `fn_doc_seq_next` substitutes the HQ timezone when the tenant zone is missing or invalid. Tenant numbering will fail closed. That fix is a new migration, not an edit of `0670`.
- Customer message text in `order-event-variables.ts` formats Ready By with `toLocaleDateString` and can fall through to the server zone.
- `pos-session.service.ts` assigns the POS business date with `businessDateForTimezone` and the application clock. Phase 1 passes a database instant.
- `tax-explain.service.ts` falls back to `isoDate(now)` when the organization zone is missing. Phase 1 fails closed.
- `sys_country_cd.default_timezone_code` is catalog metadata. It is not an operations fallback.
- Public registration and migration `0826` sit beside this program. Neither one is the operations clock. `0826` was applied on the local and remote databases on 2026-11-25. Prisma was pulled from the local database.
