-- =============================================================================
-- Migration: 0788_ntf_outbox_retry_superseded.sql
-- Purpose:   I11 WP5. Do not restore ntf-outbox-retry. Its command sets every
--            due FAILED_TEMPORARY row back to QUEUED. fn_ntf_worker_claim_due_global
--            already claims those rows when next_retry_at is due, the claim token
--            is empty, and reconcile_state is empty. A second writer would race
--            dispatch. Mark the registry row SUPERSEDED by ntf-outbox-dispatch
--            and remove any cron row. Do not requeue.
-- Affected:  sys_ops_job_cf row ntf-outbox-retry, cron.job name ntf-outbox-retry
-- Related:   0780 global claim. Does not enable delivery. Does not schedule
--            reconciliation. Does not change an outbox row.
-- Safety:    DRAFT ONLY. Review and apply manually.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- The stored command is a generic requeue. Drop the schedule if a database still has it.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-outbox-retry';

-- SUPERSEDED rows must be observe-only and desired off (ck_sys_ops_job_cf_life_ops).
-- restore_command is cleared so a direct restore cannot run the old UPDATE.
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    superseded_by = 'ntf-outbox-dispatch',
    desired_enabled = false,
    run_now_allowed = false,
    operator_actions = ARRAY['OBSERVE']::TEXT[],
    schedule = CASE WHEN schedule = '30 4 */2 * *' THEN NULL ELSE schedule END,
    restore_command = NULL,
    notes = '0788 SUPERSEDED. Due FAILED_TEMPORARY rows are claimed by fn_ntf_worker_claim_due_global. Do not set them back to QUEUED. A row with no next_retry_at stays for exact-token reconciliation.',
    updated_at = now(),
    updated_info = '0788 ntf-outbox-retry superseded'
WHERE job_code = 'ntf-outbox-retry'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ntf-outbox-retry') THEN
    RAISE EXCEPTION '0788: ntf-outbox-retry is still scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'ntf-outbox-retry'
      AND lifecycle_status = 'SUPERSEDED'
      AND superseded_by = 'ntf-outbox-dispatch'
      AND desired_enabled = false
      AND operator_actions = ARRAY['OBSERVE']::TEXT[]
      AND restore_command IS NULL
  ) THEN
    RAISE EXCEPTION '0788: ntf-outbox-retry was not superseded';
  END IF;
END $$;

COMMIT;
