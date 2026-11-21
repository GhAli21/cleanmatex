-- =============================================================================
-- Migration: 0799_tax_kit_update_set_state.sql
-- Purpose:   I11 WP5. Let HQ pause and resume the existing tax-kit SQL job.
--            The command stays SELECT public.fn_tax_kit_update_all() at 02:05.
--            Remote is missing that cron row; this restores it only when absent
--            and leaves a correct row unchanged. Run now stays unavailable.
-- Affected:  cron.job name tax-kit-update; sys_ops_job_cf row tax-kit-update
-- Related:   0726 created the job. 0755 recorded it as observe-only.
-- Safety:    DRAFT ONLY. Review and apply manually. Does not change tax rules.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- A wrong command must not be overwritten. A missing row is the remote gap.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'tax-kit-update'
      AND btrim(command) IS DISTINCT FROM 'SELECT public.fn_tax_kit_update_all()'
  ) THEN
    RAISE EXCEPTION '0799: tax-kit-update command is not the approved function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tax-kit-update') THEN
    PERFORM cron.schedule(
      'tax-kit-update',
      '5 2 * * *',
      'SELECT public.fn_tax_kit_update_all()'
    );
  END IF;
END $$;

-- SET_STATE can pause or resume the existing cron row. It cannot run an arbitrary command.
UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    run_now_allowed = false,
    desired_enabled = true,
    notes = '0799. Nightly SQL fn_tax_kit_update_all at 02:05. SET_STATE pauses or resumes that row. Run now is not granted. The command is not fin_trigger_job.',
    updated_at = now(),
    updated_info = '0799 tax-kit set state'
WHERE job_code = 'tax-kit-update'
  AND rec_status = 1;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM cron.job
    WHERE jobname = 'tax-kit-update'
      AND schedule = '5 2 * * *'
      AND active
      AND btrim(command) = 'SELECT public.fn_tax_kit_update_all()'
  ) <> 1 THEN
    RAISE EXCEPTION '0799: tax-kit-update cron row is missing or changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'tax-kit-update'
      AND kind = 'PG_CRON'
      AND desired_enabled = true
      AND run_now_allowed = false
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0799: tax-kit-update was not given SET_STATE';
  END IF;
END $$;

COMMIT;
