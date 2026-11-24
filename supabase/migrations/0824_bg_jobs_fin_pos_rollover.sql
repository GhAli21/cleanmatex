-- =============================================================================
-- Migration: 0824_bg_jobs_fin_pos_rollover.sql
-- Purpose:   Background Jobs step 6b - POS session rollover on cmx-workers
--            (plan docs/features/Background_Jobs/STEP6_PLAN.md 6b; DESIGN.md 5.5, 20.8-20.9).
--
--            Why not pure database (Owner rule, 25 Nov: pg_cron + SQL unless the work has a
--            TypeScript-only effect): every effect of this job is TypeScript-only. A force-close
--            freezes the shift Z-report (pos-shift-report.service snapshot builder) in the same
--            transaction, the policy comes from the cash-control settings chain (drawer / user /
--            branch / tenant / type default), and the operator and supervisors are notified.
--
--            Shape: one schedule and ONE queue, no item queue. The sweep
--            (runPosSessionRolloverSweep) already locks and re-checks each session in its own
--            transaction, skips a session a person closed, and is safe to run twice; a session that
--            failed is simply found again on the next 15-minute tick. One queue = one poller.
--              fin.pos_rollover.every_15m  PGBOSS_SCHEDULE  pg-boss cron '*/15 * * * *' (UTC)
--              fin.pos_rollover.sweep      PGBOSS_QUEUE     one sweep over every live session
--            Queue policy 'stately': at most one waiting and one running sweep, so a slow sweep
--            never stacks ticks. Polling 300 s: a tick starts within 5 minutes; idle cost is one
--            fetch per 5 minutes.
--
--            fin-pos-session-rollover (HQ_WORKER, off, never ran on remote) is superseded.
-- Security:  No new functions. Registry rows are service-side only (existing grants).
-- Release:   Everything starts switched off. Switch on in HQ -> Ops -> Jobs (QA_TEST_GUIDE 6.2)
--            after cmx-workers with step 6b is deployed: the queue first, then the schedule.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- pg-boss queue. Retries: 2, 60 s apart (the next tick re-runs the sweep anyway). Expiry 900 s
-- = one tick, so a hung sweep is released before the following one. Jobs kept 1 day (96 a day).
-- Skips a queue that already exists, so a re-run is harmless.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgboss.queue q WHERE q.name = 'fin.pos_rollover.sweep') THEN
    PERFORM pgboss.create_queue('fin.pos_rollover.sweep', jsonb_build_object(
      'policy', 'stately',
      'retryLimit', 2,
      'retryDelay', 60,
      'retryBackoff', false,
      'expireInSeconds', 900,
      'heartbeatSeconds', 30,
      'retentionSeconds', 86400,
      'deleteAfterSeconds', 86400,
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
  'fin.pos_rollover.sweep',
  'POS session rollover: sweep', 'ترحيل جلسات نقطة البيع: فحص الجلسات',
  'Checks every open or paused POS session. When the branch business day has ended, pauses or force-closes the session per the cash-control policy (force-close also freezes the shift Z-report); flags sessions open longer than the stale limit. Notifies the operator and supervisors.',
  'يفحص كل جلسة نقطة بيع مفتوحة أو متوقفة. عند انتهاء يوم العمل في الفرع يوقف الجلسة أو يغلقها إجبارياً حسب سياسة النقد (الإغلاق الإجباري يثبّت تقرير Z للوردية)، ويعلّم الجلسات المفتوحة أطول من الحد. يُشعر المشغّل والمشرفين.',
  'ROLLOVER', 'fin', 'pos', 'PGBOSS_QUEUE',
  NULL, NULL, NULL, false, false, 'PGBOSS',
  '0824_bg_jobs_fin_pos_rollover.sql',
  'Consumed by cmx-workers (Background Jobs step 6b). Policy stately: one waiting + one running sweep.',
  ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', 600,
  'Migration 0824 - pos rollover queue'
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
  'fin.pos_rollover.sweep', 'CMX_WORKERS', 'INTERNAL',
  2, 60, false, NULL,
  900, 30, 86400, 86400, 'dead_letter',
  0, 1, 300,
  600, 'migration', 'Migration 0824 - pos rollover queue'
)
ON CONFLICT (queue_name) DO NOTHING;

-- The schedule (pg-boss cron, UTC), same cadence as the HQ_WORKER row it replaces.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, target_job_code, desired_enabled, run_now_allowed,
  completion_mode, source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
)
VALUES (
  'fin.pos_rollover.every_15m',
  'POS session rollover (every 15 minutes)', 'ترحيل جلسات نقطة البيع (كل 15 دقيقة)',
  'Starts the POS session rollover sweep every 15 minutes. Each branch''s business day is read in that branch''s time zone.',
  'يبدأ فحص ترحيل جلسات نقطة البيع كل 15 دقيقة. يُقرأ يوم العمل لكل فرع بالمنطقة الزمنية للفرع.',
  'ROLLOVER', 'fin', 'pos', 'PGBOSS_SCHEDULE', NULL, '*/15 * * * *', NULL, 'fin.pos_rollover.sweep', false, true,
  'PGBOSS', '0824_bg_jobs_fin_pos_rollover.sql', 'Applied by cmx-workers as a pg-boss schedule (Background Jobs step 6b).',
  ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'], 'ACTIVE', 605, 'Migration 0824 - pos rollover schedule'
)
ON CONFLICT (job_code) DO NOTHING;

-- The HQ_WORKER row this replaces: superseded (observe only, off, no manual run).
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    superseded_by    = 'fin.pos_rollover.every_15m',
    operator_actions = ARRAY['OBSERVE'],
    desired_enabled  = false,
    run_now_allowed  = false,
    updated_at       = now(),
    updated_info     = 'Migration 0824 - replaced by a pg-boss schedule'
WHERE job_code = 'fin-pos-session-rollover'
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgboss.queue WHERE name = 'fin.pos_rollover.sweep' AND policy = 'stately') THEN
    RAISE EXCEPTION '0824: queue fin.pos_rollover.sweep is missing or not stately';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_ops_job_cf WHERE job_code = 'fin-pos-session-rollover' AND lifecycle_status = 'ACTIVE') THEN
    RAISE EXCEPTION '0824: fin-pos-session-rollover is still ACTIVE';
  END IF;
END $$;

COMMIT;
