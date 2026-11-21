-- =============================================================================
-- Migration: 0793_fin_credit_note_expiry_worker.sql
-- Purpose:   I11 WP5. Replace the retired credit-note HTTP cron with an HQ
--            worker job. The worker calls the tenant application, which writes
--            the expiry ledger. This migration does not expire a note and does
--            not call fin_trigger_job.
-- Affected:  sys_ops_job_cf row fin-credit-note-expiry; cron.job name fin-credit-note-expiry
-- Related:   0779 froze the HTTP job. 0792 is the same shape for gift cards.
-- Safety:    DRAFT ONLY. Review and apply manually. Desired stays off.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Drop a leftover pg_net schedule. An empty result means this database already has none.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-credit-note-expiry';

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
    notes = '0793 HQ_WORKER. Calls the tenant credit-note expiry service (ledger). Desired off. FIN_CREDIT_NOTE_EXPIRY_ENABLED must also be true. Does not use fin_trigger_job.',
    updated_at = now(),
    updated_info = '0793 credit-note expiry worker'
WHERE job_code = 'fin-credit-note-expiry'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-credit-note-expiry') THEN
    RAISE EXCEPTION '0793: fin-credit-note-expiry is still scheduled in pg_cron';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'fin-credit-note-expiry'
      AND lifecycle_status = 'ACTIVE'
      AND kind = 'HQ_WORKER'
      AND completion_mode = 'WORKER_QUEUE'
      AND desired_enabled = false
      AND run_now_allowed = true
      AND superseded_by IS NULL
      AND restore_command IS NULL
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0793: fin-credit-note-expiry was not retargeted to the worker';
  END IF;
END $$;

COMMIT;
