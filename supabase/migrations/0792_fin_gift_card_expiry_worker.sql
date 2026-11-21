-- =============================================================================
-- Migration: 0792_fin_gift_card_expiry_worker.sql
-- Purpose:   I11 WP5. Replace the retired gift-card HTTP cron with an HQ worker
--            job. The worker calls the tenant application, which already writes
--            the EXPIRE ledger row and the GL journal. This migration does not
--            expire a card and does not call fin_trigger_job.
-- Affected:  sys_ops_job_cf row fin-gift-card-expiry; cron.job name fin-gift-card-expiry
-- Related:   0779 froze the HTTP job. 0429 registered fin_trigger_job.
-- Safety:    DRAFT ONLY. Review and apply manually. Desired stays off.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Drop a leftover pg_net schedule. An empty result means this database already has none.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-gift-card-expiry';

-- HQ_WORKER requires WORKER_QUEUE (ck_sys_ops_job_cf_kind_mode) and must not offer RESTORE.
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
    notes = '0792 HQ_WORKER. Calls the tenant gift-card expiry service (ledger row plus GL journal). Desired off. FIN_GIFT_CARD_EXPIRY_ENABLED must also be true. Does not use fin_trigger_job.',
    updated_at = now(),
    updated_info = '0792 gift-card expiry worker'
WHERE job_code = 'fin-gift-card-expiry'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-gift-card-expiry') THEN
    RAISE EXCEPTION '0792: fin-gift-card-expiry is still scheduled in pg_cron';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'fin-gift-card-expiry'
      AND lifecycle_status = 'ACTIVE'
      AND kind = 'HQ_WORKER'
      AND completion_mode = 'WORKER_QUEUE'
      AND desired_enabled = false
      AND run_now_allowed = true
      AND superseded_by IS NULL
      AND restore_command IS NULL
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0792: fin-gift-card-expiry was not retargeted to the worker';
  END IF;
END $$;

COMMIT;
