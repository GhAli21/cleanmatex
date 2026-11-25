-- =============================================================================
-- Migration: 0825_bg_jobs_fin_erp_retry.sql
-- Purpose:   Background Jobs step 6c - ERP posting retry by design
--            (plan docs/features/Background_Jobs/STEP6_PLAN.md 6c; DESIGN.md 5.5, 20.8-20.9).
--
--            Why not pure database (Owner rule, 25 Nov: pg_cron + SQL unless the work has a
--            TypeScript-only effect): a retry replays the stored posting request through the
--            TypeScript ERP-Lite posting engine (rule resolution, account checks, journal and
--            snapshot writes). There is no SQL copy of the engine.
--
--            Why no sweep: the engine itself queues ONE delayed job when a posting fails with
--            SYSTEM_ERROR (the only plausibly transient type), at the moment the exception is
--            written. Nothing polls the exception table on a schedule.
--              fin.erp_post.retry  PGBOSS_QUEUE  one exception: replay its posting log once
--            Delays 5 min after attempt 1, 15 min after attempt 2; no automatic job after
--            attempt 3 (ERP_LITE_AUTO_RETRY in web-admin lib/constants/erp-lite-posting.ts).
--            Job id = exception id, so one exception gets at most one automatic retry.
--            When the failed posting ran inside a business transaction, the job is written in
--            that transaction: a rolled-back sale or redemption never gets a journal later.
--            Polling 300 s: rare work, so idle cost is one fetch per 5 minutes.
--
--            fin-erp-posting-retry (HQ_WORKER, off, never ran on remote) is superseded. Its
--            reader list_retryable_posting_exceptions() stays until step 8 removes the old
--            finance jobs code (it filtered status OPEN; the engine writes NEW).
-- Security:  No new functions. Registry rows are service-side only (existing grants).
-- Release:   The queue starts switched off; jobs sent meanwhile wait (kept 7 days). Switch on
--            in HQ -> Ops -> Jobs (QA_TEST_GUIDE 6.3) after cmx-workers and web-admin with
--            step 6c are deployed.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- pg-boss queue. Retries 2, 60 s then 120 s (only for a crash before the engine ran, such as a
-- lost database connection; a posting that fails again is a new exception with its own job).
-- Jobs kept 7 days, so a job sent while the queue is off still runs once it is switched on.
-- Skips a queue that already exists, so a re-run is harmless.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgboss.queue q WHERE q.name = 'fin.erp_post.retry') THEN
    PERFORM pgboss.create_queue('fin.erp_post.retry', jsonb_build_object(
      'policy', 'standard',
      'retryLimit', 2,
      'retryDelay', 60,
      'retryBackoff', true,
      'retryDelayMax', 600,
      'expireInSeconds', 300,
      'heartbeatSeconds', 30,
      'retentionSeconds', 604800,
      'deleteAfterSeconds', 604800,
      'deadLetter', 'dead_letter'
    ));
  END IF;
END $$;

-- Registry row of the queue (switch on/off in HQ; cmx-workers consumes it).
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
)
VALUES (
  'fin.erp_post.retry',
  'ERP posting retry: one exception', 'إعادة محاولة الترحيل إلى ERP: استثناء واحد',
  'Retries one accounting posting that failed with a system error, a few minutes after the failure (at most 3 attempts in all). On success the exception is marked retried; skips an exception someone already resolved, ignored or retried.',
  'يعيد محاولة ترحيل محاسبي واحد فشل بخطأ في النظام بعد دقائق من الفشل (3 محاولات كحد أقصى). عند النجاح يُعلَّم الاستثناء كمُعاد المحاولة؛ ويتجاوز الاستثناء الذي سبق أن عالجه أحد أو تجاهله أو أعاد محاولته.',
  'RETRY', 'fin', 'erp', 'PGBOSS_QUEUE',
  NULL, NULL, NULL, false, false, 'PGBOSS',
  '0825_bg_jobs_fin_erp_retry.sql',
  'Consumed by cmx-workers (Background Jobs step 6c). Sent by the ERP-Lite posting engine on a SYSTEM_ERROR failure; no schedule.',
  ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', 620,
  'Migration 0825 - erp posting retry queue'
)
ON CONFLICT (job_code) DO NOTHING;

-- Queue details the worker applies (DESIGN 20.8). Values mirror the pgboss.create_queue call above.
INSERT INTO public.sys_ops_job_queue_cf (
  queue_name, consumer_app, effect_class,
  retry_limit, retry_delay_s, retry_backoff, retry_delay_max_s,
  expire_s, heartbeat_s, retention_s, delete_after_s, dead_letter_queue,
  default_priority, local_concurrency, polling_s,
  rec_order, created_by, created_info
)
VALUES (
  'fin.erp_post.retry', 'CMX_WORKERS', 'INTERNAL',
  2, 60, true, 600,
  300, 30, 604800, 604800, 'dead_letter',
  0, 1, 300,
  620, 'migration', 'Migration 0825 - erp posting retry queue'
)
ON CONFLICT (queue_name) DO NOTHING;

-- The HQ_WORKER row this replaces: superseded (observe only, off, no manual run).
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    superseded_by    = 'fin.erp_post.retry',
    operator_actions = ARRAY['OBSERVE'],
    desired_enabled  = false,
    run_now_allowed  = false,
    updated_at       = now(),
    updated_info     = 'Migration 0825 - replaced by a pg-boss queue fed by the posting engine'
WHERE job_code = 'fin-erp-posting-retry'
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgboss.queue WHERE name = 'fin.erp_post.retry' AND policy = 'standard') THEN
    RAISE EXCEPTION '0825: queue fin.erp_post.retry is missing or not standard';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_ops_job_queue_cf WHERE queue_name = 'fin.erp_post.retry' AND consumer_app = 'CMX_WORKERS') THEN
    RAISE EXCEPTION '0825: fin.erp_post.retry is not registered for cmx-workers';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_ops_job_cf WHERE job_code = 'fin-erp-posting-retry' AND lifecycle_status = 'ACTIVE') THEN
    RAISE EXCEPTION '0825: fin-erp-posting-retry is still ACTIVE';
  END IF;
END $$;

COMMIT;
