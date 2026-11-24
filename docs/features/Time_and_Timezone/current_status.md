# Current status

**State:** Plan accepted as the working program. Implementation has not started.

**Blocker:** None for Phase 1. Phase 2 is blocked on a read-only provenance sample per column. Do not write the `USING` clause before that sample.

## Risks

| Risk | What happens | Control |
|---|---|---|
| One conversion clause for every naive column | Historical rows move by the session offset (four hours in Muscat) | Provenance per column. Separate migrations. |
| Dropping `ready_by` immediately | Old readers and reports go blank | Read the twin first. Backfill null twins. Drop in a later migration. |
| Browser zone as a fallback | The Ready By flip returns | Fail closed. Skeleton until the operations zone is known. |
| Database `TimeZone` left at `Asia/Muscat` | `now()` assigned into a naive column keeps writing Muscat wall | Session UTC is defense in depth. New columns are `timestamptz`, so the session cannot change the stored instant. |
| Rewriting `business_date` during a zone edit | Closed days and issued order numbers move | The rule freezes them. Tests cover a later zone edit. |

## Next action

Phase 1 in [`technical_docs/work-packages.md`](./technical_docs/work-packages.md): shared helpers, Ready By readers, and removal of the UTC-date fallback. No migration in that phase. The surface map is the completeness check for every later package.

## Evidence already on record

- Background jobs F15: naive `scheduled_at` compared with `now()` under `Asia/Muscat`.
- User session QA: lockout text said 255 minutes. `org_users_mst.locked_until` is `@db.Timestamp(6)`.
- Line-level money snapshot QA: `ready_by` printed 06:00; `ready_by_at_new` is the 10:00 Muscat instant.
- `fn_doc_seq_next` substitutes the HQ timezone when the tenant zone is missing or invalid. Tenant numbering will fail closed. That fix is a new migration, not an edit of `0670`.
- Customer message text in `order-event-variables.ts` formats Ready By with `toLocaleDateString` and can fall through to the server zone.
