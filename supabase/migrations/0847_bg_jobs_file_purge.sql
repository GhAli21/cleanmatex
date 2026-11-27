-- =============================================================================
-- Migration: 0847_bg_jobs_file_purge.sql
-- Purpose:   Background Jobs step 6e - File Util byte purge on cmx-workers
--            (plan docs/features/Background_Jobs/STEP6_PLAN.md 6e; DESIGN.md 5.5, 20.8-20.9).
--
--            Why not pure database (Owner rule, 25 Nov: pg_cron + SQL unless the work has a
--            TypeScript-only effect): stored bytes can only be deleted through the Storage API.
--            SQL cannot remove them, so the deletes run in cmx-workers with the service role.
--
--            Shape: one weekly schedule and ONE queue. A sweep reads up to 200 deleted, unpurged
--            files (fn_file_purge_due), removes their objects with one Storage call per bucket,
--            sets purged_at, and queues the next page after a full batch (up to 50 pages =
--            10,000 files a run). One job per file would cost one Storage call per file.
--              file.purge.weekly  PGBOSS_SCHEDULE  pg-boss cron '47 3 * * 0' (UTC, Sundays)
--              file.purge.sweep   PGBOSS_QUEUE     one batch of up to 200 files
--            Queue policy 'stately': at most one waiting and one running sweep.
--
--            file-util-purge (HQ_WORKER in platform-workers) is superseded; its code goes in step 8.
--            file-util-expire (pg_cron, marks abandoned uploads DELETED) is unchanged.
-- Security:  fn_file_purge_due is closed to PUBLIC, anon and authenticated (service side only).
-- Release:   Everything starts switched off. Switch on in HQ -> Ops -> Jobs (QA_TEST_GUIDE 6.4)
--            after cmx-workers with step 6e is deployed: the queue first, then the schedule.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Due read of the purge sweep: deleted files whose bytes are still stored, oldest first, in
-- active tenants. Uses idx_ofm_purge (deleted_at) WHERE status_code = 'DELETED' AND purged_at IS NULL.
CREATE OR REPLACE FUNCTION public.fn_file_purge_due(p_limit INTEGER DEFAULT 200)
RETURNS TABLE (tenant_org_id UUID, file_id UUID, bucket_code TEXT, object_key TEXT, thumb_object_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT f.tenant_org_id, f.id, f.bucket_code, f.object_key, f.thumb_object_key
  FROM public.org_file_mst f
  JOIN public.org_tenants_mst t
    ON t.id = f.tenant_org_id
   AND t.is_active
   AND t.rec_status = 1
  WHERE f.status_code = 'DELETED'
    AND f.purged_at IS NULL
  ORDER BY f.deleted_at, f.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
$$;

COMMENT ON FUNCTION public.fn_file_purge_due(INTEGER) IS
  'Service-role-only: up to 200 deleted File Util files (status DELETED, purged_at NULL) in active tenants, oldest deletion first, with the storage keys to remove. Read by the file.purge.sweep job (Background Jobs step 6e), which removes the objects and sets purged_at.';
REVOKE ALL ON FUNCTION public.fn_file_purge_due(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_file_purge_due(INTEGER) TO service_role;

-- pg-boss queue. Retries 2, 60 s apart (rows not purged stay for the next run anyway). Expiry
-- 300 s: a batch is a few Storage calls. Jobs kept 7 days. Skips a queue that already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgboss.queue q WHERE q.name = 'file.purge.sweep') THEN
    PERFORM pgboss.create_queue('file.purge.sweep', jsonb_build_object(
      'policy', 'stately',
      'retryLimit', 2,
      'retryDelay', 60,
      'retryBackoff', false,
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
  'file.purge.sweep',
  'File purge: delete stored bytes', 'حذف الملفات: حذف المحتوى المخزّن',
  'Deletes the stored bytes of up to 200 deleted files at a time (one storage call per bucket) and marks them purged. A full batch queues the next one, up to 10,000 files a run.',
  'يحذف المحتوى المخزّن لما يصل إلى 200 ملف محذوف في كل مرة (طلب تخزين واحد لكل حاوية) ويعلّمها كمحذوفة نهائياً. الدفعة الكاملة تضع الدفعة التالية، حتى 10,000 ملف في كل تشغيل.',
  'CLEANUP', 'file_util', NULL, 'PGBOSS_QUEUE',
  NULL, NULL, NULL, false, false, 'PGBOSS',
  '0847_bg_jobs_file_purge.sql',
  'Consumed by cmx-workers (Background Jobs step 6e). Policy stately: one waiting + one running sweep.',
  ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', 700,
  'Migration 0847 - file purge queue'
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
  'file.purge.sweep', 'CMX_WORKERS', 'INTERNAL',
  2, 60, false, NULL,
  300, 30, 604800, 604800, 'dead_letter',
  0, 1, 300,
  700, 'migration', 'Migration 0847 - file purge queue'
)
ON CONFLICT (queue_name) DO NOTHING;

-- The schedule (pg-boss cron, UTC), same time as the HQ_WORKER row it replaces.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, target_job_code, desired_enabled, run_now_allowed,
  completion_mode, source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
)
VALUES (
  'file.purge.weekly',
  'File purge (weekly)', 'حذف الملفات (أسبوعياً)',
  'Starts the file purge every Sunday at 03:47 UTC: the stored bytes of deleted files are removed.',
  'يبدأ حذف الملفات كل يوم أحد الساعة 03:47 بالتوقيت العالمي: يُحذف المحتوى المخزّن للملفات المحذوفة.',
  'CLEANUP', 'file_util', NULL, 'PGBOSS_SCHEDULE', NULL, '47 3 * * 0', NULL, 'file.purge.sweep', false, true,
  'PGBOSS', '0847_bg_jobs_file_purge.sql', 'Applied by cmx-workers as a pg-boss schedule (Background Jobs step 6e).',
  ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'], 'ACTIVE', 705, 'Migration 0847 - file purge schedule'
)
ON CONFLICT (job_code) DO NOTHING;

-- The HQ_WORKER row this replaces: superseded (observe only, off, no manual run).
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    superseded_by    = 'file.purge.weekly',
    operator_actions = ARRAY['OBSERVE'],
    desired_enabled  = false,
    run_now_allowed  = false,
    updated_at       = now(),
    updated_info     = 'Migration 0847 - replaced by a pg-boss schedule'
WHERE job_code = 'file-util-purge'
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgboss.queue WHERE name = 'file.purge.sweep' AND policy = 'stately') THEN
    RAISE EXCEPTION '0847: queue file.purge.sweep is missing or not stately';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_ops_job_cf WHERE job_code = 'file.purge.weekly' AND target_job_code = 'file.purge.sweep') THEN
    RAISE EXCEPTION '0847: schedule file.purge.weekly is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_ops_job_cf WHERE job_code = 'file-util-purge' AND lifecycle_status = 'ACTIVE') THEN
    RAISE EXCEPTION '0847: file-util-purge is still ACTIVE';
  END IF;
END $$;

COMMIT;
