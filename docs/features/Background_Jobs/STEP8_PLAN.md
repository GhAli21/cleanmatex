# Step 8 — Delete the old background plumbing

Status (28 Nov 2026): **8a, 8b and 8c done in code, not committed. 0857 applied by the Owner on local + remote and verified. 8d (Render service, env vars, `platform-workers/` folder) is Owner work.** **28 Nov: Owner applied 0857 on local + remote, regenerated types (both repos, 1.9 MB each, identical) and pulled Prisma (`sys_fin_job_run_log` gone). Verified on remote: 45 registry rows, 0 SUPERSEDED, kinds PG_CRON / PGBOSS_QUEUE / PGBOSS_SCHEDULE only, no function mentions HQ_WORKER, the 11 old functions and the run log are gone, the 4 `fn_ntf_worker_*` functions ntf.deliver uses are kept, `finance_jobs:*` gone from permissions and the cache, 0 notifications QUEUED (25 SKIPPED), `fn_ops_job_list_v2()` returns 45.** 

Every job now runs on pg-boss (cmx-workers for tenant work, HQ API queue consumer for notifications) or on pg_cron. Step 8 removes what the old design left behind, in both repos and the database. Scope comes from [DESIGN.md](DESIGN.md) §10.2 step 8 and every "goes in step 8" note in STEP5_PLAN / STEP6_PLAN.

## Inventory (checked on remote, 27–28 Nov)

| Old piece | Where | Replaced by | Part |
|---|---|---|---|
| `lib/services/finance-jobs.service.ts` + test | web-admin | 6a–6c jobs, 6g run now | 8a |
| `/api/finance/jobs/{gift-card,credit-note,loyalty-points}-expiry`, `erp-posting-retry`, `pos-session-rollover`, `/api/finance/process-jobs` (Bearer `FINANCE_OUTBOX_SECRET`) | web-admin | same | 8a |
| `CRON_SECRET` path of `POST /api/v1/b2b/run-dunning-actions` (no caller) | web-admin | staff-only route (6d postponed) | 8a |
| `platform-workers` workspace (BullMQ + database loops: notifications, finance, file purge) | HQ repo | step 5, 6a–6c, 6e | 8b (folder deletion: Owner, see below) |
| `BackgroundExecutionModule` (in-process host, idle unless `PLATFORM_BG_ENABLED`) + `.env.example` lines | HQ API | — | 8b |
| `HQ_WORKER` kind / `WORKER_QUEUE` mode in HQ Ops Jobs types, screen, labels, tests | HQ API + HQ web | `PGBOSS_QUEUE` / `PGBOSS_SCHEDULE` / `PGBOSS` | 8b |
| 12 retired registry rows (10 SUPERSEDED + `ntf-outbox-dispatch` / `ntf-outbox-shadow`, never on) + their run history / requests | database | — | 8c |
| `HQ_WORKER` in 4 registry constraints and 3 shared functions (`fn_ops_job_list_v2`, `fn_ops_job_run_now`, `fn_ops_job_set_state`) | database | — | 8c |
| `fn_ops_job_claim`, `fn_ops_job_request_slot`, `fn_ops_worker_job_sync`; `fn_ntf_worker_claim_due`, `_due_global`, `_canary`; `claim_outbox_batch`, `fin_trigger_job`, `fin_trigger_outbox_proc`, `fin_list_job_schedules`, `list_retryable_posting_exceptions` | database | — | 8c |
| `sys_fin_job_run_log` (≈2,600 rows of the old hub's history) | database | HQ run history | 8c |
| Permissions `finance_jobs:view` / `finance_jobs:run` (8 role rows, 6 cached user grants on remote) | database | 6g permissions | 8c |
| 17 notifications `QUEUED` since 21–23 Nov with no `ntf.deliver` job (written before the queue release) | database | — (marked SKIPPED) | 8c |
| Oregon Render `platform-workers` service; env switches `PLATFORM_BG_ENABLED`, `PLATFORM_BG_DB_URL`, `PLATFORM_WORKER_LOOPS_ENABLED`, `NTF_OUTBOX_WORKER_ENABLED`, `FINANCE_OUTBOX_SECRET`, `CRON_SECRET` | Render / Vercel | — | 8d (Owner) |

**Kept on purpose:** `fn_ntf_worker_claim_one`, `_finalize_claim`, `_mark_uncertain`, `_reconcile_claim` (HQ API `ntf.deliver` uses them); `sys_ops_job_req_tr`, `fn_ops_job_sched_claim_manual`, `fn_ops_job_finish`, `fn_ops_job_capture_runs` (pg-boss Run now and pg_cron run history); pg_cron `cleanup-net-http-response`; the `HQ_WORKERS` app name in HQ Config (a label list for config keys, not the job kind).

## 8a — Tenant code (done in code, 28 Nov)

Deleted: `lib/services/finance-jobs.service.ts`, `__tests__/services/finance-jobs.service.test.ts`, `app/api/finance/jobs/*` (5 routes), `app/api/finance/process-jobs/route.ts` (the `app/api/finance` folder is now empty and gone). `run-dunning-actions`: session + `b2b_statements:create` only. Auth-guard test: exemption for the deleted dispatcher removed. ERP exceptions service comment points at the 6c automatic retry.

Checks: ESLint 0 on the changed files. `api-route-auth-guard.test.ts`: the stale-exemption check passes; 2 failures are about other sessions' routes (file-util, branding settings, choose-tenant), not this change.

## 8b — HQ code (done in code, 28 Nov)

- Deleted `platform-api/src/modules/background-execution/` (module, service, listen supervisor, executor registry, tenant-jobs list, file purge claim, specs) and its import in `app.module.ts`; `.env.example` lines for `PLATFORM_BG_*`.
- Ops Jobs (HQ API + HQ web): kinds `PG_CRON | PGBOSS_QUEUE | PGBOSS_SCHEDULE`, completion `SYNC | ASYNC_HTTP | PGBOSS`. Screen: the "HQ worker" figure becomes "Queues" (filters `PGBOSS_QUEUE`); the runner filter lists Queue and Queue schedule; Run now on a schedule explains "the worker sends the job within about 30 seconds". EN/AR labels added for `PGBOSS_QUEUE`, `PGBOSS_SCHEDULE`, `PGBOSS` (they were missing, so pg-boss rows showed raw keys).
- HQ File Util health: "last bytes removed" now says the weekly file purge job (cmx-workers), EN/AR.
- Clock-contract script: `platform-workers` removed from its code roots and baseline.
- **Not done:** deleting the `platform-workers/` folder (64 tracked files) was blocked by the session's permission rules. Owner: delete the folder (`git rm -r platform-workers` in cleanmatexsaas). Nothing imports it.

Checks: HQ web ops-jobs tests 46/46 (worker fixture moved to a pg-boss schedule). HQ API and HQ web `tsc`: see STATUS.

## 8c — Migration 0857 (written, dry-run OK, waits for the Owner)

`supabase/migrations/0857_bg_jobs_retire_old_plumbing.sql`, one transaction:

1. Deletes the 12 retired registry rows with their run history and run requests (guards: none is a schedule target, queue, subscription, or switched on).
2. Removes kind `HQ_WORKER`: four constraints rewritten; the three shared functions re-created from their live bodies (local = remote, md5 checked) with only the `HQ_WORKER` branches removed.
3. Drops the 11 functions listed above.
4. Drops `sys_fin_job_run_log`.
5. Deletes `finance_jobs:view` / `finance_jobs:run` (role defaults and user grants cascade) and rebuilds the permission cache of users who held them.
6. Marks unclaimed `QUEUED` notifications that have no `ntf.deliver` job as `SKIPPED` (`skip_reason = NOT_SENT_BEFORE_QUEUE_RELEASE`).

Dry-run on local, rolled back: 45 registry rows left, no function mentions `HQ_WORKER`, dropped functions and table gone, no `finance_jobs` permission, no `QUEUED` row left, `fn_ops_job_list_v2()` returns all 45 rows. On remote it will delete 12 of 57 rows and skip 17 notifications.

**Release order:** commit and deploy web-admin, HQ API and HQ web with 8a/8b first (the old routes and module stop calling the dropped functions) → apply 0857 on local, then remote → regenerate types (both repos) with `scripts/dev/gen-types.ps1` and pull Prisma (`sys_fin_job_run_log` leaves the schema) → QA 8.

## 8d — Owner (Render, Vercel, repo)

- Delete the Oregon Render service `platform-workers` (it is suspended).
- Remove env vars: HQ API `PLATFORM_BG_ENABLED`, `PLATFORM_BG_DB_URL`; web-admin (Vercel) `FINANCE_OUTBOX_SECRET`, `CRON_SECRET` (no code reads them now; keep any other app's copy until checked); platform-workers' own vars go with the service.
- Delete the `platform-workers/` folder in cleanmatexsaas (blocked for the assistant).
