# HQ Job Manager — operator guide

**Where:** HQ Platform Web → sidebar **Operations → Jobs** (`/ops/jobs`).
**Needs:** `hq_ops:read` to view; `hq_ops:manage_jobs` to change anything. SUPER_ADMIN has both through `*`; assign them to other HQ roles on the HQ roles screen.

## What you see per job
- **Intended vs actual:** the registry stores what the job *should* be (schedule, enabled); the badge compares it with live `pg_cron`.
  - `SCHEDULE_DRIFT` — live schedule differs from intended.
  - `STATE_DRIFT` — live active/inactive differs from intended.
  - `MISSING_IN_CRON` — registered but no cron job exists.
- **Last real status:** latest of pg_cron's own history and the durable run log (`sys_ops_job_run_dtl`, kept 90 days; pg_cron's own table is wiped every 14 days).

## Actions
| Action | Effect | Notes |
|---|---|---|
| Enable / Disable | `cron.alter_job(active)` + records intended state | Asks for confirmation |
| Edit schedule | `cron.alter_job(schedule)` | Exactly 5 numeric cron fields; setting it equal to the default clears the override |
| Run now | Executes the command already stored in `pg_cron` once; logs a MANUAL run | Disabled for jobs that delete data. `DISPATCHED` = request handed to the async HTTP worker; it does **not** prove the work finished |
| Run history | Durable log, newest first | |

The UI/API can never edit or supply a job's SQL command; commands change only through migrations.

## Fixing the known drift
Open `/ops/jobs`, filter **drift only**, then enable the inactive jobs you want running and set `ntf-outbox-processor` / `ntf-campaign-scheduler` / `fin-outbox-processor` back to `* * * * *`. Before enabling HTTP-trigger jobs, confirm the runtime config they need (`app.next_js_base_url`, `app.outbox_secret_key`, or the `sys_*_runtime_cf` rows) is set, otherwise they only log a warning. Investigate `ntf-reconcile-outbox` (last run failed) first.

## Adding a job later
Any migration that schedules a pg_cron job must also insert a `sys_ops_job_cf` row (see the seed in 0610), otherwise the job is invisible here.
