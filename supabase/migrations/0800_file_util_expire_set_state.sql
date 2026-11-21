-- =============================================================================
-- Migration: 0800_file_util_expire_set_state.sql
-- Purpose:   I11. Restore the hourly abandoned-upload expiry when its cron row
--            is missing, and let HQ pause it. The command stays
--            SELECT public.fn_file_util_expire_pending(). Stored bytes stay
--            with file-util-purge. Run now stays unavailable.
-- Affected:  cron.job name file-util-expire; sys_ops_job_cf row file-util-expire
-- Related:   0744 created the function and the hourly schedule.
-- Safety:    DRAFT ONLY. Review and apply manually. Does not delete storage bytes.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'file-util-expire'
      AND btrim(command) IS DISTINCT FROM 'SELECT public.fn_file_util_expire_pending()'
  ) THEN
    RAISE EXCEPTION '0800: file-util-expire command is not the approved function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'file-util-expire') THEN
    PERFORM cron.schedule(
      'file-util-expire',
      '17 * * * *',
      'SELECT public.fn_file_util_expire_pending()'
    );
  END IF;
END $$;

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    run_now_allowed = false,
    desired_enabled = true,
    notes = '0800. Hourly SQL fn_file_util_expire_pending at minute 17. SET_STATE pauses or resumes that row. It marks abandoned PENDING rows only. file-util-purge still deletes stored bytes.',
    updated_at = now(),
    updated_info = '0800 file-util-expire set state'
WHERE job_code = 'file-util-expire'
  AND rec_status = 1;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM cron.job
    WHERE jobname = 'file-util-expire'
      AND schedule = '17 * * * *'
      AND active
      AND btrim(command) = 'SELECT public.fn_file_util_expire_pending()'
  ) <> 1 THEN
    RAISE EXCEPTION '0800: file-util-expire cron row is missing or changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'file-util-expire'
      AND kind = 'PG_CRON'
      AND desired_enabled = true
      AND run_now_allowed = false
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0800: file-util-expire was not given SET_STATE';
  END IF;
END $$;

COMMIT;
