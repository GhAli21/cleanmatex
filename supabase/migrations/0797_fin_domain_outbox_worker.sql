-- =============================================================================
-- Migration: 0797_fin_domain_outbox_worker.sql
-- Purpose:   I11 WP5. Replace the retired every-minute finance-outbox HTTP cron
--            with an HQ worker job on the 15-minute sweep. The worker calls the
--            tenant application, which claims domain events and runs the
--            existing handlers. This migration does not claim an event and does
--            not call fin_trigger_job. It does not send a notification.
-- Affected:  sys_ops_job_cf row fin-outbox-processor; cron.job name fin-outbox-processor
-- Related:   0779 froze the HTTP job. D10 sets the worker tick at 15 minutes.
-- Safety:    DRAFT ONLY. Review and apply manually. Desired stays off.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Drop a leftover pg_net schedule. An empty result means this database already has none.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-outbox-processor';

-- The old default was every minute. The worker reads the registry every 15 minutes,
-- so the stored schedule matches that sweep instead of implying a one-minute poll.
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'ACTIVE',
    kind = 'HQ_WORKER',
    completion_mode = 'WORKER_QUEUE',
    default_schedule = '11-56/15 * * * *',
    superseded_by = NULL,
    desired_enabled = false,
    run_now_allowed = true,
    operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[],
    schedule = NULL,
    restore_command = NULL,
    notes = '0797 HQ_WORKER. Calls the tenant finance-domain outbox consumer (order history, loyalty earn, cash over/short, order-change). One batch of 50. Desired off. FIN_DOMAIN_OUTBOX_ENABLED must also be true. Does not use fin_trigger_job and does not send notifications.',
    updated_at = now(),
    updated_info = '0797 finance domain outbox worker'
WHERE job_code = 'fin-outbox-processor'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-outbox-processor') THEN
    RAISE EXCEPTION '0797: fin-outbox-processor is still scheduled in pg_cron';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'fin-outbox-processor'
      AND lifecycle_status = 'ACTIVE'
      AND kind = 'HQ_WORKER'
      AND completion_mode = 'WORKER_QUEUE'
      AND default_schedule = '11-56/15 * * * *'
      AND desired_enabled = false
      AND run_now_allowed = true
      AND superseded_by IS NULL
      AND restore_command IS NULL
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0797: fin-outbox-processor was not retargeted to the worker';
  END IF;
END $$;

COMMIT;
