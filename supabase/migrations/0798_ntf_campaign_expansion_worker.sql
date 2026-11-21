-- =============================================================================
-- Migration: 0798_ntf_campaign_expansion_worker.sql
-- Purpose:   I11 WP5. Replace the retired every-minute campaign HTTP cron with
--            an HQ worker job on the 15-minute sweep. The worker calls the
--            tenant application, which keeps the 10-campaign and 50-target
--            limits, consent, quiet hours, templates, and per-target
--            idempotency. This migration does not expand a campaign and does
--            not call ntf_trigger_*.
-- Affected:  sys_ops_job_cf row ntf-campaign-scheduler; cron.job name ntf-campaign-scheduler
-- Related:   0779 froze the HTTP job. D10 sets the worker tick at 15 minutes.
-- Safety:    DRAFT ONLY. Review and apply manually. Desired stays off.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Drop a leftover pg_net schedule. An empty result means this database already has none.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-campaign-scheduler';

-- The old default was every minute. The worker reads the registry every 15 minutes.
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'ACTIVE',
    kind = 'HQ_WORKER',
    completion_mode = 'WORKER_QUEUE',
    default_schedule = '13-58/15 * * * *',
    superseded_by = NULL,
    desired_enabled = false,
    run_now_allowed = true,
    operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[],
    schedule = NULL,
    restore_command = NULL,
    notes = '0798 HQ_WORKER. Calls the tenant campaign expansion (10 campaigns, 50 targets, consent, quiet hours, idempotency). Desired off. NTF_CAMPAIGN_EXPANSION_ENABLED must also be true. Does not send by itself; external channels are queued on the notification outbox.',
    updated_at = now(),
    updated_info = '0798 campaign expansion worker'
WHERE job_code = 'ntf-campaign-scheduler'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ntf-campaign-scheduler') THEN
    RAISE EXCEPTION '0798: ntf-campaign-scheduler is still scheduled in pg_cron';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'ntf-campaign-scheduler'
      AND lifecycle_status = 'ACTIVE'
      AND kind = 'HQ_WORKER'
      AND completion_mode = 'WORKER_QUEUE'
      AND default_schedule = '13-58/15 * * * *'
      AND desired_enabled = false
      AND run_now_allowed = true
      AND superseded_by IS NULL
      AND restore_command IS NULL
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0798: ntf-campaign-scheduler was not retargeted to the worker';
  END IF;
END $$;

COMMIT;
