# Step 7 — HQ Ops Jobs on the queue, and alerts

Status (28 Nov 2026): **Step 7 done in code (28 Nov, not committed): 0858 applied by the Owner (local + remote) and verified; 7b HQ API and 7c HQ web built.** HQ → Ops → Jobs is now one workspace with tabs Jobs / Queues / Dead letters / Workers and an alert banner (`?tab=` deep links). HQ API: `GET /ops/jobs/queues`, `/queues/:queue/recent`, `/dead-letters`, `/workers`, `/alerts`; `POST /ops/jobs/dead-letters/redrive|delete` (ids or a whole source queue, max 100, `hq_ops:manage_jobs`, audited); alert poller every 60 s → Sentry once per condition (tag `ops_alert`); HQ API's pg-boss instance named `hq-api`; notification outbox views moved to `ntf.deliver`. Checks: HQ API tests 89/89 (8 new), HQ web ops-jobs tests 52/52 (6 new), tsc 0 (HQ API: 1 unrelated general-config spec), ESLint 0, HQ check:i18n passed (opsJobs.json over the 20 KB soft limit; the split tool keeps one file, hard limit 30 KB not near). Earlier: **7a done in code: `supabase/migrations/0858_bg_jobs_ops_queue_views.sql` written, dry-run on local rolled back (28 queues, functions run, `anon` cannot execute), waits for the Owner. 7b–7d next.** Scope: [DESIGN.md](DESIGN.md) §8.1–8.2, plus the items left for step 7 in STEP6_PLAN (per-run results of pg-boss jobs, failed jobs of every queue, run history of schedule ticks).

## What exists today (checked 28 Nov)

| Piece | State |
|---|---|
| HQ → Ops → Jobs (`/ops/jobs`, HQ web) | One registry table (all 45 jobs): switch on/off, schedule edit, Run now, run history (`sys_ops_job_run_dtl`: pg_cron runs and schedule Run now), audit, notification outbox snapshot and notification dead letters (outbox rows `FAILED_PERMANENT`). |
| Queue numbers | pg-boss keeps them itself in `pgboss.queue` (queued, ready, active, deferred, failed, total, `ready_oldest_seconds`, `monitor_on`), refreshed by the cmx-workers supervisor about every minute. Not shown anywhere. |
| Dead letters | `pgboss.job` rows in queue `dead_letter` with `source_name`, `source_id`, `source_retry_count`, `source_output` (error) and the original ids-only payload. Remote: 6 (5 × `ORDER_CHANGE_APPLIED_ROW_MISSING`, 23 Nov). Not shown anywhere. |
| Workers | `pgboss.instance`: one row per process start, heartbeat every 30 s. cmx-workers names itself; **HQ API's instance has no name** (fixed in 7b). Old rows of replaced processes stay with `stopped_on` empty. |
| Per-run results | Handlers return counts (`{"purged":1,"failed":0}`) in `pgboss.job.output`; kept 7 days. Not shown anywhere. |
| Permissions | `hq_ops:read` (view), `hq_ops:manage_jobs` (every action, audited). Reused, no new permission. |
| Alerting | Sentry is installed in HQ API. No queue alerts. |

## Design

All reads come from the database (pure SQL, Owner rule), through service-role functions that return counts, queue names, ids and error text only: no payload values, recipients, amounts or bodies.

| Part | What |
|---|---|
| **7a** migration | `sys_ops_job_queue_cf.alert_ready_age_s` (typed per-queue threshold: notifications 120 s, finance and files 3,600 s, smoke test none). Functions: `fn_ops_queue_stats()` (registry + `pgboss.queue` + dead letters per source queue), `fn_ops_queue_recent(queue, limit)` (last jobs with state, attempts, times, result or error text), `fn_ops_dead_letter_list(source, limit)`, `fn_ops_worker_list()` (latest instance per process name, stale flag), `fn_ops_job_alerts()` (the four rules below, current state). |
| **7b** HQ API | `GET /ops/jobs/queues`, `/ops/jobs/queues/:queue/recent`, `/ops/jobs/dead-letters`, `/ops/jobs/workers`, `/ops/jobs/alerts`; `POST /ops/jobs/dead-letters/redrive` (ids or a whole source queue: sends a new job with the same ids-only payload to the source queue, then deletes the dead letter; handlers are idempotent) and `POST /ops/jobs/dead-letters/delete`; both `hq_ops:manage_jobs`, audited, max 100 a call. Pause / resume stays the existing switch (`desired_enabled`). HQ API pg-boss instance gets the name `hq-api`. Alert poller every 60 s: a new alert goes to Sentry once (fingerprint = rule + subject) and again only after it cleared. |
| **7c** HQ web | `/ops/jobs` gets tabs: **Jobs** (today's table), **Queues** (numbers per queue, oldest waiting, dead letters, paused state; switch; "Recent jobs" dialog with results), **Dead letters** (source queue, error, attempts, age; redrive one / selected / a queue, delete, with confirm), **Workers** (process, version, started, last heartbeat, queues worked). An alert banner on top when any rule is active. EN/AR, RTL, Cmx components. |
| **7d** | Tests (functions on local, API unit tests, screen tests), QA section 7, docs. |

### The four alerts (DESIGN §8.2)

1. **Waiting too long:** a queue's oldest ready job is older than its `alert_ready_age_s`.
2. **Dead letters:** a job reached the dead-letter queue in the last 15 minutes (subject = source queue).
3. **Worker silent:** the newest instance of `cmx-workers` or `hq-api` has no heartbeat for more than 2 minutes (or none exists).
4. **Notification uncertain:** an outbox row has been `ACCEPTANCE_UNCERTAIN` for more than 1 hour (count only).

Delivery: Sentry (installed in HQ API). The Owner adds a Sentry alert rule that emails on these events (tag `ops_alert`).

### Decisions taken (engineering, no Owner input needed)

- Redrive sends a **new** job instead of reviving the failed one: it uses pg-boss's public `send` only, works after the failed copy was deleted by retention, and every handler is idempotent (effects claimed once).
- Thresholds live in a typed column on the queue detail table, not in general settings.
- Numbers come from pg-boss's own monitor (refreshed about every minute), not from counting `pgboss.job` on every page load.

## Built (28 Nov)

| Part | Files |
|---|---|
| 7a | `supabase/migrations/0858_bg_jobs_ops_queue_views.sql` (applied local + remote by the Owner) |
| 7b HQ API | `platform-api/src/modules/ops-jobs/`: `ops-jobs.controller.ts` (6 routes), `ops-jobs.service.ts` (list + redrive/delete, audit `ops_job.dead_letter_redrive` / `_delete`), `ops-jobs.repository.ts` (5 RPCs), `ops-jobs.types.ts`, `ops-jobs.dto.ts` (`DeadLetterActionDto`), new `ops-job-alerts.service.ts` (poller, `OPS_ALERTS_ENABLED=false` turns it off), `ops-jobs.module.ts` (imports `QueueConsumerModule`); `queue-consumer/queue-consumer.service.ts` (`instanceName`, `redriveDeadLetters`, `deleteDeadLetters`, `deadLetterIdsOf`); spec `__tests__/ops-jobs.queues.spec.ts` (8 tests) |
| 7c HQ web | `app/ops/jobs/page.tsx` → `OpsJobsWorkspace`; `src/features/ops-jobs/ui/`: `ops-jobs-workspace.tsx`, `ops-alerts-banner.tsx`, `ops-queues-tab.tsx`, `ops-queue-recent-dialog.tsx`, `ops-dead-letters-tab.tsx`, `ops-workers-tab.tsx`, `ops-format.ts`; `ops-jobs-screen.tsx` (`embedded` prop); `ops-job-outbox-snapshot.tsx` (`ntf.deliver`); api, hooks, model; `messages/{en,ar}/opsJobs.json` (workspace, queues, deadLetters, workers, alerts, duration); test `__tests__/features/ops-jobs/ops-queue-tabs.test.tsx` (6 tests) |

**Owner after deploy (HQ API + HQ web):** add a Sentry alert rule "event tag `ops_alert` exists → email"; until HQ API is deployed with the instance name, the banner shows "hq-api: no heartbeat" (expected). Redrive the 6 old dead letters only after checking them: the 5 `ORDER_CHANGE_APPLIED_ROW_MISSING` belong to deleted demo orders (Delete is the right action), the 1 POS rollover sweep from 24 Nov failed on a bug fixed since (Redrive or Delete; the next sweep covers it anyway).
