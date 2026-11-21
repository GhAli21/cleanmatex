-- =============================================================================
-- Migration: 0803_cleanup_cron_run_details_set_state.sql
-- Purpose:   I11. Let HQ pause the truncate of cron.job_run_details.
--            Local has no cron row. Remote already runs
--            TRUNCATE TABLE cron.job_run_details at 01:00 UTC, with line
--            breaks around the statement. This creates the row only when it
--            is missing and does not reschedule or rewrite an existing one.
--            The registry default 30 3 */14 * * is the old seed. Production
--            runs daily, and this migration does not change that.
-- Affected:  cron.job name cleanup-cron-job-run-details;
--            sys_ops_job_cf row cleanup-cron-job-run-details
-- Safety:    DRAFT ONLY. Review and apply manually. Does not truncate.
--            Run now stays unavailable.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-cron-job-run-details'
      AND btrim(regexp_replace(command, '[[:space:]]+', ' ', 'g'))
          IS DISTINCT FROM 'TRUNCATE TABLE cron.job_run_details;'
  ) THEN
    RAISE EXCEPTION '0803: cleanup-cron-job-run-details command is not the approved truncate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-job-run-details') THEN
    PERFORM cron.schedule(
      'cleanup-cron-job-run-details',
      '0 1 * * *',
      'TRUNCATE TABLE cron.job_run_details;'
    );
  END IF;
END $$;

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    run_now_allowed = false,
    desired_enabled = true,
    notes = '0803. Truncates cron.job_run_details. The live schedule is 01:00 UTC daily. SET_STATE pauses or resumes that row. This migration does not truncate and does not reschedule an existing row. Run now is not granted.',
    updated_at = now(),
    updated_info = '0803 cron run details set state'
WHERE job_code = 'cleanup-cron-job-run-details'
  AND rec_status = 1;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM cron.job
    WHERE jobname = 'cleanup-cron-job-run-details'
      AND schedule = '0 1 * * *'
      AND active
      AND btrim(regexp_replace(command, '[[:space:]]+', ' ', 'g')) = 'TRUNCATE TABLE cron.job_run_details;'
  ) <> 1 THEN
    RAISE EXCEPTION '0803: cleanup-cron-job-run-details cron row is missing or changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'cleanup-cron-job-run-details'
      AND kind = 'PG_CRON'
      AND desired_enabled = true
      AND run_now_allowed = false
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0803: cleanup-cron-job-run-details was not given SET_STATE';
  END IF;
END $$;

COMMIT;
