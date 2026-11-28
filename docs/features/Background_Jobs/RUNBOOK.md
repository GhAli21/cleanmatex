# Background Jobs — Operations Runbook

**Written:** 28 Nov 2026, after steps 0–8 and step 7 code. It replaces the I11 runbook in `docs/pending_to_production/16_11_2026/` (that one describes `platform-workers`, which is gone).
**Design:** [DESIGN.md](DESIGN.md). **Owner QA:** [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md). **State of work:** [STATUS.md](STATUS.md).

## 1. What runs where

| Work | Runs in | Started by |
|---|---|---|
| Finance reactions (order history, loyalty earn, order-change confirm, cash over/short, ...) | **cmx-workers** (Render Background Worker, same region as the database) | `emitEventTx` publishes the event in the business transaction; pg-boss fans it out to one queue per reaction |
| Gift card / loyalty expiry, POS rollover, ERP posting retry, file purge, notification orchestration and campaigns | **cmx-workers** | pg-boss schedules (`PGBOSS_SCHEDULE` rows) or a job queued in the business transaction |
| Notification delivery, provider reconcile, provider status apply | **HQ API** (`platform-api`, queue consumer) | `ntf.orchestrate` / webhooks queue the jobs |
| Credit note expiry, idempotency cleanup, retention, quota, session sweeps, setup health, run-history capture, ... | **pg_cron** inside Postgres (pure SQL) | cron schedule |
| Per-Organization "run now" (gift cards, credit notes, loyalty, ERP retry all) | web-admin request, for that Organization only | a person on the domain screen (6g) |

One job registry: `sys_ops_job_cf` (+ `sys_ops_job_queue_cf` for queue settings). Both consumers read it every 30 s, start or pause queues to match `desired_enabled`, and write `applied_*` back. **HQ → Ops → Jobs** is the one screen.

## 2. Everyday operations (HQ → Ops → Jobs)

| I want to | Do |
|---|---|
| See if anything is wrong | Look at the alert banner at the top. No banner = all four rules quiet. |
| Switch a job or queue on / off | Jobs tab switch, or Queues tab Pause / Resume. Applied within ~30 s; waiting jobs stay queued. |
| Run a scheduled job now | Jobs tab → Run now (pg-boss schedules and pg_cron jobs that allow it). The run appears in its history. |
| See what a queue did | Queues tab → Recent jobs: the last 20 jobs with the result counts or error message. |
| Handle failed jobs | Dead letters tab: read the error. **Redrive** when the cause is fixed (sends the job again; handlers are idempotent). **Delete** when the work no longer applies (deleted record, demo data). |
| Check the workers | Workers tab: `cmx-workers` and `hq-api` Running, heartbeat < 1 min. |

Permissions: `hq_ops:read` to see, `hq_ops:manage_jobs` for every action; every action is in HQ audit.

## 3. Alerts (DESIGN §8.2)

HQ API checks `fn_ops_job_alerts()` every 60 s and sends each new condition to Sentry once (tag `ops_alert`, fingerprint rule + subject). Owner: one Sentry alert rule "tag `ops_alert` exists → email".

| Alert | Means | First steps |
|---|---|---|
| `READY_TOO_OLD <queue>` | The oldest ready job waited longer than the queue's threshold (notifications 2 min, campaigns 15 min, finance/files 1 h) | Workers tab: is the consumer running? Queues tab: is the queue paused, or is `Running` stuck at its concurrency? A paused queue does not alert. |
| `DEAD_LETTER <queue>` | A job used up its retries in the last 15 minutes | Dead letters tab → read the error → fix the cause → Redrive, or Delete if the work no longer applies. |
| `WORKER_SILENT cmx-workers / hq-api` | No heartbeat for 2 minutes from a consumer that has switched-on queues | Render: is the service up, restarting, out of memory? Logs: start errors (`registry sync failed`, TLS, pg-boss version mismatch). |
| `NTF_UNCERTAIN ntf.outbox` | A provider accepted-or-not answer is unknown for over an hour | `ntf.reconcile` resolves these; check it is on and the provider status webhook is reaching HQ API. |

Thresholds live in `sys_ops_job_queue_cf.alert_ready_age_s` (a migration changes them). `OPS_ALERTS_ENABLED=false` on HQ API turns the poller off.

## 4. Environment

**cmx-workers** (Render Background Worker, database region, Node ≥ 22.12):

| Variable | Notes |
|---|---|
| `JOBS_DATABASE_URL` | Session pooler or direct Postgres (pg-boss needs session features), not the 6543 transaction pooler |
| `JOBS_DATABASE_CA_CERT` | Supabase CA (TLS verified); omit only for local |
| `JOBS_DB_POOL_MAX` | 2–10, default 4 |
| `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Used by the bundled web-admin services |
| `WORKER_ENABLED` | `false` stops all fetching (the one switch, DESIGN §8.3) |
| `REGISTRY_POLL_SECONDS` | default 30 |
| `WORKER_INSTANCE_NAME` | default `cmx-workers`; the alert looks for this name |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | final-attempt failures go to Sentry |

**HQ API** queue consumer: `JOBS_DATABASE_URL`, `JOBS_DATABASE_CA_CERT`, `JOBS_DB_POOL_MAX`, `JOBS_INSTANCE_NAME` (default `hq-api`), `REGISTRY_POLL_SECONDS`, `OPS_ALERTS_ENABLED`. Unset `JOBS_DATABASE_URL` = HQ API consumes nothing (notification delivery off) and dead-letter actions answer 503.

**Retired (step 8, remove where still set):** `PLATFORM_BG_ENABLED`, `PLATFORM_BG_DB_URL`, `PLATFORM_WORKER_LOOPS_ENABLED`, `NTF_OUTBOX_WORKER_ENABLED`, `FINANCE_OUTBOX_SECRET`, `CRON_SECRET`.

## 5. Deploys

- Every process runs pg-boss with `migrate: false`; the schema comes only from repo migrations. A version mismatch stops the worker at start (visible as WORKER_SILENT).
- On SIGTERM a worker stops fetching, lets running jobs finish up to 30 s, then exits. Rolling deploys are safe: pg-boss locks jobs and schedules across instances.
- Order for a change that adds a queue: migration (queue + registry row, switched off) → deploy the consumer that has the handler → switch the queue on in HQ. A queue switched on with no handler deployed simply waits (and alerts after its threshold).
- **cmx-workers bundle:** it bundles web-admin services. A web-admin import that needs Next.js-only runtime (for example React `cache`) must have a stub in `cmx-workers/build.mjs`; `npm test --workspace=cmx-workers` catches a bundle that does not load.

## 6. Upgrading pg-boss

1. New migration from pg-boss's `getMigrationPlans` for the new version (the Owner applies it).
2. Deploy the same pinned version in web-admin (producer), cmx-workers and HQ API together.
3. Workers → versions show the new version for both processes.

## 7. Incidents

| Symptom | Check | Fix |
|---|---|---|
| Notifications not sent | Queues: `ntf.orchestrate` (cmx-workers) and `ntf.deliver` (HQ API) on? Workers: `hq-api` running? Dead letters for `ntf.*`? | Start the consumer / switch on; redrive after fixing provider settings |
| Order history or loyalty not updated after an order | Queues: the `fin.<event>.<reaction>` queue; Recent jobs for errors | Fix and redrive; reactions are effect-claimed once per event |
| A job keeps failing the same way | Recent jobs / Dead letters error text; Sentry event with queue tag | Fix the cause first; redrive only then |
| Everything stopped | Workers silent; Render service; database reachable | `WORKER_ENABLED` true? Recent deploy? Roll back the deploy |
| Need to stop all background work now | — | `WORKER_ENABLED=false` on cmx-workers and/or unset `JOBS_DATABASE_URL` on HQ API, redeploy; jobs wait in the queue |
