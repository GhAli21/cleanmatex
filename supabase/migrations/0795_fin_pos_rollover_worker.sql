-- =============================================================================
-- Migration: 0795_fin_pos_rollover_worker.sql
-- Purpose:   I11 WP5. Replace the retired POS rollover HTTP cron with an HQ
--            worker job. The worker calls the tenant application, which applies
--            the branch business day and rollover policy. This migration does
--            not change a session and does not call fin_trigger_job.
-- Affected:  sys_ops_job_cf row fin-pos-session-rollover; cron.job name fin-pos-session-rollover
-- Related:   0779 froze the HTTP job. 0558 defined the rollover policy.
-- Safety:    DRAFT ONLY. Review and apply manually. Desired stays off.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Drop a leftover pg_net schedule. An empty result means this database already has none.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-pos-session-rollover';

-- HQ_WORKER requires WORKER_QUEUE and must not offer RESTORE.
-- Desired stays off. Run now is allowed, and the worker still refuses until its env kill is true.
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'ACTIVE',
    kind = 'HQ_WORKER',
    completion_mode = 'WORKER_QUEUE',
    superseded_by = NULL,
    desired_enabled = false,
    run_now_allowed = true,
    operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[],
    schedule = NULL,
    restore_command = NULL,
    notes = '0795 HQ_WORKER. Calls the tenant POS rollover service (branch business day and policy). Desired off. FIN_POS_ROLLOVER_ENABLED must also be true. Does not use fin_trigger_job.',
    updated_at = now(),
    updated_info = '0795 pos rollover worker'
WHERE job_code = 'fin-pos-session-rollover'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-pos-session-rollover') THEN
    RAISE EXCEPTION '0795: fin-pos-session-rollover is still scheduled in pg_cron';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'fin-pos-session-rollover'
      AND lifecycle_status = 'ACTIVE'
      AND kind = 'HQ_WORKER'
      AND completion_mode = 'WORKER_QUEUE'
      AND desired_enabled = false
      AND run_now_allowed = true
      AND superseded_by IS NULL
      AND restore_command IS NULL
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0795: fin-pos-session-rollover was not retargeted to the worker';
  END IF;
END $$;

COMMIT;
