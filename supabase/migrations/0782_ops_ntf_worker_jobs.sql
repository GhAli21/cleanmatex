-- =============================================================================
-- Migration: 0782_ops_ntf_worker_jobs.sql
-- Purpose:   I11 WP3. Register the notification loops on /ops/jobs as HQ_WORKER
--            jobs that stay off. Send still requires NTF_OUTBOX_WORKER_ENABLED.
--            A desired-off job is not WORKER_NOT_SEEN. The heartbeat window is
--            20 minutes because the runner tick is 15 minutes.
-- Affected:  sys_ops_job_cf rows ntf-outbox-dispatch, ntf-outbox-shadow,
--            ntf-outbox-processor.superseded_by; fn_ops_job_list_v2
-- Related:   0768, 0779, 0780. Does not schedule cron, claim, or send.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

-- Desired off. Enable in /ops/jobs does not send until the worker env kill is also true.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system,
  kind, cron_job_name, default_schedule, schedule, desired_enabled, run_now_allowed,
  completion_mode, source_migration, notes, operator_actions, is_active, rec_status, created_info
) VALUES (
  'ntf-outbox-dispatch',
  'Notification outbox dispatch',
  'إرسال صندوق الإشعارات',
  'Safety sweep every 15 minutes, plus Run now. Claims due notification rows and finalizes them only when NTF_OUTBOX_WORKER_ENABLED is true. Does not run in pg_cron.',
  'مسح أمان كل 15 دقيقة، مع تشغيل الآن. يطالب بصفوف الإشعارات المستحقة وينهيها فقط عندما يكون NTF_OUTBOX_WORKER_ENABLED صحيحا. لا يعمل في pg_cron.',
  'OUTBOX', 'ntf', 'dispatch',
  'HQ_WORKER', 'ntf-outbox-dispatch', '7-52/15 * * * *', NULL, false, true,
  'WORKER_QUEUE', '0782',
  'I11 WP3. Desired off. Env kill NTF_OUTBOX_WORKER_ENABLED must also be true before any claim. Replaces ntf-outbox-processor.',
  ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'], true, 1, '0782 seed'
), (
  'ntf-outbox-shadow',
  'Notification outbox shadow',
  'مراقبة صندوق الإشعارات',
  'Read-only aggregate counts on the same 15-minute cadence. No Run now. The read also requires NTF_OUTBOX_SHADOW_ENABLED=true.',
  'أعداد مجمعة للقراءة فقط على نفس إيقاع 15 دقيقة. بدون تشغيل الآن. القراءة تتطلب أيضا NTF_OUTBOX_SHADOW_ENABLED=true.',
  'OUTBOX', 'ntf', 'dispatch',
  'HQ_WORKER', 'ntf-outbox-shadow', '7-52/15 * * * *', NULL, false, false,
  'WORKER_QUEUE', '0782',
  'I11 WP3. Desired off. No send. Counts only when NTF_OUTBOX_SHADOW_ENABLED=true.',
  ARRAY['OBSERVE', 'SET_STATE'], true, 1, '0782 seed'
)
ON CONFLICT (job_code) DO NOTHING;

COMMENT ON COLUMN public.sys_ops_job_cf.applied_at IS
  'HQ_WORKER heartbeat. The runner tick is 15 minutes, so silence under 20 minutes is one in-flight interval. A desired-off job with no Run now is not WORKER_NOT_SEEN.';

UPDATE public.sys_ops_job_cf
SET superseded_by = 'ntf-outbox-dispatch',
    notes = 'I11 WP3 SUPERSEDED. Replacement is ntf-outbox-dispatch (desired off). Do not Enable, Restore, or Run now.',
    updated_info = '0782 superseded_by ntf-outbox-dispatch'
WHERE job_code = 'ntf-outbox-processor'
  AND lifecycle_status = 'SUPERSEDED';

-- Same return shape as 0779. Desired-off jobs no longer look like a dead worker.
CREATE OR REPLACE FUNCTION public.fn_ops_job_list_v2()
 RETURNS TABLE(
   job_code text, name text, name2 text, description text, description2 text,
   category text, module text, sub_system text, kind text, cron_job_name text,
   default_schedule text, schedule_override text, effective_schedule text,
   actual_schedule text, actual_active boolean, desired_enabled boolean,
   cron_jobid bigint, command_present boolean, run_now_allowed boolean,
   completion_mode text, source_migration text, notes text, is_active boolean,
   operator_actions text[], drift_flags text[],
   last_run_at timestamp with time zone, last_run_status text, last_run_message text,
   last_run_source text, last_run_trigger text, last_run_actor text,
   lifecycle_status text, superseded_by text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
  SELECT
    c.job_code, c.name, c.name2, c.description, c.description2,
    c.category, c.module, c.sub_system, c.kind, c.cron_job_name,
    c.default_schedule, c.schedule, COALESCE(c.schedule, c.default_schedule),
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_schedule ELSE j.schedule END,
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_enabled ELSE j.active END,
    c.desired_enabled, j.jobid,
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_at IS NOT NULL
         ELSE COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false) END,
    c.run_now_allowed, c.completion_mode, c.source_migration, c.notes, c.is_active,
    c.operator_actions,
    CASE WHEN c.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
      ARRAY['SUPERSEDED']::text[]
    WHEN c.kind = 'HQ_WORKER' THEN
      ARRAY_REMOVE(ARRAY[
        CASE WHEN (
               c.desired_enabled
               OR EXISTS (
                 SELECT 1 FROM public.sys_ops_job_req_tr q
                 WHERE q.job_code = c.job_code
                   AND q.status = 'REQUESTED'
                   AND q.trigger_type = 'MANUAL'
                   AND q.is_active
                   AND q.rec_status = 1
               )
             )
             AND (c.applied_at IS NULL OR c.applied_at < now() - interval '20 minutes')
             THEN 'WORKER_NOT_SEEN' END,
        CASE WHEN c.applied_at IS NOT NULL
               AND c.applied_schedule IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
             THEN 'SCHEDULE_DRIFT' END,
        CASE WHEN c.applied_at IS NOT NULL AND c.applied_enabled IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END
      ], NULL)
    ELSE
      ARRAY_REMOVE(ARRAY[
        CASE WHEN j.jobid IS NULL THEN 'MISSING_IN_CRON' END,
        CASE WHEN j.jobid IS NOT NULL
               AND btrim(j.schedule) IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
             THEN 'SCHEDULE_DRIFT' END,
        CASE WHEN j.jobid IS NOT NULL AND j.active IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END
      ], NULL)
    END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.started_at ELSE cr.run_at END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.status ELSE cr.run_status END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.message ELSE cr.run_message END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN 'OPS_LOG' WHEN cr.run_at IS NOT NULL THEN 'CRON' END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.trigger_type WHEN cr.run_at IS NOT NULL THEN 'SCHEDULE' END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.actor END,
    c.lifecycle_status,
    c.superseded_by
  FROM public.sys_ops_job_cf c
  LEFT JOIN cron.job j ON j.jobname = c.cron_job_name AND c.kind = 'PG_CRON'
  LEFT JOIN LATERAL (
    SELECT d.start_time AS run_at,
           CASE d.status WHEN 'succeeded' THEN 'SUCCESS' WHEN 'failed' THEN 'FAILED' ELSE 'RUNNING' END AS run_status,
           left(d.return_message, 1000) AS run_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid AND d.start_time IS NOT NULL
    ORDER BY d.start_time DESC
    LIMIT 1
  ) cr ON true
  LEFT JOIN LATERAL (
    SELECT r.started_at, r.status, r.message, r.trigger_type, r.actor
    FROM public.sys_ops_job_run_dtl r
    WHERE r.job_code = c.job_code
    ORDER BY r.started_at DESC
    LIMIT 1
  ) orr ON true
  WHERE c.rec_status = 1
  ORDER BY c.module, c.job_code;
$function$;

COMMENT ON FUNCTION public.fn_ops_job_list_v2() IS
  'Job Manager list. SUPERSEDED/RETIRED drift is SUPERSEDED. HQ_WORKER WORKER_NOT_SEEN applies when the job is desired-on or has Run now waiting, and the heartbeat is older than 20 minutes. service_role only.';

REVOKE ALL ON FUNCTION public.fn_ops_job_list_v2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_list_v2() TO service_role;

COMMIT;
