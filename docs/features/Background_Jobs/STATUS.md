# Background Jobs — Status

**Updated:** 23 Nov 2026
**Design:** [DESIGN.md](DESIGN.md), approved by the Owner on 23 Nov 2026 with every fix in §18–§19 and decisions S-D1 to S-D5.
**Open decision:** S-D6, database region. It gates where HQ API and `cmx-workers` run, not the database work in step 1.

## Gates before step 1 (DESIGN §10.1)

| Gate | State |
|---|---|
| S-D1 to S-D5 approved | Done, 23 Nov 2026 |
| S-D6 database region decided, services placed | Open. Owner. Today: database Ohio, HQ API and HQ worker Oregon, Vercel `iad1`. |
| Node 22.12+ pinned on Vercel and Render | Open. Owner, dashboards. |
| Feature docs folder | Done: this folder |

## Steps

| Step | Work | State | Evidence |
|---|---|---|---|
| 0 | Stop silent loss | Done in code, not committed | Order submit and transition use `after()` instead of `void` for notifications. Order-history consumer returns `SKIPPED_ORPHAN` when its insert hits a foreign-key error and the order no longer exists for that tenant. Jest: route suites 18/18, consumer suites 23/23 (two new orphan tests). ESLint on the 7 changed files: 0 errors. `tsc --noEmit` on web-admin: 0 errors. Owner QA: QA_TEST_GUIDE 0.1, 0.2. |
| 1 | Queue foundation — database migration | **Done.** Owner applied local and remote, regenerated types in both repos, pulled Prisma. Remote verified 23 Nov: 3 queues, version 47, 3 catalog rows, no public-role access. | `0807_bg_jobs_queue_foundation.sql`: pg-boss 12.39.0 schema (version 47, generated, self-migration off everywhere), queues `dead_letter` (90-day retention), `fin.domain_event`, `ops.smoke_test`, tables `sys_job_queue_cf` and `org_job_effect_tr`. Validated on a throwaway local database, then dropped: applies in one transaction; queues and retention correct; `anon`/`authenticated` have no access; duplicate effect insert writes 0 rows; pg-boss started with `migrate: false`; a failing smoke job ran 3 times and landed in `dead_letter`. |
| 1b | Registry extension, event catalog, event-code renames | **0808 applied local and remote (23 Nov); web-admin code NOT yet deployed — deploy now.** Remote verified: 34 event types, `fk_odeo_event_type` present, 0 rows with old codes, queues `dead_letter` + `ops.smoke_test`, `ops.smoke_test` flagged `WORKER_NOT_SEEN` (expected). Until the code deploys, live flows that write renamed events (order submit, cash drawer close, loyalty recalc) fail the new foreign key. | `0808_ops_job_registry_event_catalog.sql`: `sys_ops_job_cf` gains `PGBOSS_QUEUE` / `PGBOSS_SCHEDULE`; 0807 tables renamed to `sys_ops_job_queue_cf` (now with runtime settings, 1:1 with the registry) and `org_ops_job_effect_tr`; `fin.domain_event` queue removed; `sys_ops_job_event_types_cd` (34 codes, EN/AR, 33 financial, `GIFT_CARD_REDEEMED` reserved); `sys_ops_job_event_subs_cf` mirrored into `pgboss.subscription` by trigger; 7 event-code renames applied to existing rows and `chk_history_action_type`; FK from `org_domain_events_outbox.event_type` to the catalog; `fn_ops_job_list_v2`, `fn_ops_job_set_state`, `fn_ops_job_run_now` handle the new kinds with unchanged result shapes. **Dry run on local inside a rolled-back transaction**: all checks passed (catalog 34, renames, queue list and drift flags, pause works, schedule and run-now rejected for queues, subscription sync, financial reaction and event cannot be disabled, non-queue reaction target rejected, old code rejected by FK, history rule updated); local verified unchanged afterwards. Code: 15 web-admin files + 11 tests + EN/AR timeline label; order timeline colours moved to theme tone pairs (design review: dark-mode navy-on-navy fixed, light-mode contrast improved). Jest 12 suites / 171 tests pass; `tsc --noEmit` 0 (8 GB heap); ESLint 0; `check:i18n` pass; `check:ui` 0 on the timeline. |
| 2 | Queue foundation — code (`packages/jobs`) | **Done in code, not committed (23 Nov).** Not yet called from any business flow (step 4 wires it). | `packages/jobs` (`@cmx/jobs`, pg-boss pinned 12.39.0): `createJobProducer(prisma)` with `enqueue` (Zod strict ids-only payloads, optional stable job id) and `publish` (event fan-out through `pgboss.subscription`, job id = event id), `claimEffect` for `org_ops_job_effect_tr`. Integration test on local Postgres, 7/7: commit keeps the job, rollback removes it, same id inserted once, non-id payloads rejected, publish fans out once and is a no-op without subscribers, effect claimed once; local left clean. Package `tsc` 0. Web-admin ESLint rule: `pg-boss`/`bullmq` imports banned outside `@cmx/jobs`; `void <call>` and `setInterval` banned in `app/api/**` and `lib/services/**`. The rule found 4 campaign audit inserts that never ran (DESIGN §22 F3), now fixed. Web-admin `eslint . --quiet` 0. Findings F1–F4 in DESIGN §22. |
| 3 | `cmx-workers` service | Planned | Needs S-D6 for its region |
| 4 | Finance reactions, drain the 115 pending events | Planned — **shape depends on DESIGN §20** (event-type catalog, queue per subscription) | — |
| 5 | Notifications | Planned | Needs HQ API in the database region |
| 6 | Sweeps and delayed jobs | Planned | — |
| 7 | HQ `/ops/jobs` screen and alerts | Planned | — |
| 8 | Delete old plumbing | Planned | — |
| 9 | Prove it, 48-hour soak, docs fold | Planned | — |

## Remote facts this work depends on (23 Nov 2026)

- 115 finance domain events `PENDING` since 5 Nov. 22 `DEAD_LETTERED`, all orphans of deleted orders.
- 14 notifications `QUEUED` since 21 Nov.
- Database `max_connections` 60, about 23 used by Supabase services. Database in AWS `us-east-2`.
- Vercel `DATABASE_URL` correct: transaction pooler 6543, `pgbouncer=true`, `connection_limit=2`.
- `NTF_QUEUE_ENABLED=false` on HQ API.
