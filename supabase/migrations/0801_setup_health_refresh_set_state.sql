-- =============================================================================
-- Migration: 0801_setup_health_refresh_set_state.sql
-- Purpose:   I11. Restore the nightly Setup Health refresh when its cron row
--            is missing, and let HQ pause it. The command stays
--            SELECT public.fn_setup_health_refresh_all() at 02:15 UTC.
--            This migration does not run the refresh.
-- Affected:  cron.job name setup-health-refresh; sys_ops_job_cf row setup-health-refresh
-- Related:   0717 created the function and the nightly schedule.
-- Safety:    DRAFT ONLY. Review and apply manually. Run now stays unavailable.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'setup-health-refresh'
      AND btrim(command) IS DISTINCT FROM 'SELECT public.fn_setup_health_refresh_all()'
  ) THEN
    RAISE EXCEPTION '0801: setup-health-refresh command is not the approved function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'setup-health-refresh') THEN
    PERFORM cron.schedule(
      'setup-health-refresh',
      '15 2 * * *',
      'SELECT public.fn_setup_health_refresh_all()'
    );
  END IF;
END $$;

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    run_now_allowed = false,
    desired_enabled = true,
    notes = '0801. Nightly SQL fn_setup_health_refresh_all at 02:15 UTC. SET_STATE pauses or resumes that row. The HQ Setup Health page still refreshes one organization when opened. Run now is not granted.',
    updated_at = now(),
    updated_info = '0801 setup-health set state'
WHERE job_code = 'setup-health-refresh'
  AND rec_status = 1;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM cron.job
    WHERE jobname = 'setup-health-refresh'
      AND schedule = '15 2 * * *'
      AND active
      AND btrim(command) = 'SELECT public.fn_setup_health_refresh_all()'
  ) <> 1 THEN
    RAISE EXCEPTION '0801: setup-health-refresh cron row is missing or changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'setup-health-refresh'
      AND kind = 'PG_CRON'
      AND desired_enabled = true
      AND run_now_allowed = false
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0801: setup-health-refresh was not given SET_STATE';
  END IF;
END $$;

COMMIT;
