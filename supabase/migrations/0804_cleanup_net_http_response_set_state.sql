-- =============================================================================
-- Migration: 0804_cleanup_net_http_response_set_state.sql
-- Purpose:   I11. Let HQ pause the truncate of net._http_response.
--            Local has no cron row. Remote already runs
--            TRUNCATE TABLE net._http_response at 01:30 UTC, with line
--            breaks around the statement. This creates the row only when it
--            is missing and does not reschedule or rewrite an existing one.
--            The registry default 0 3 */14 * * is the old seed. Production
--            runs daily, and this migration does not change that.
-- Affected:  cron.job name cleanup-net-http-response;
--            sys_ops_job_cf row cleanup-net-http-response
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
    WHERE jobname = 'cleanup-net-http-response'
      AND btrim(regexp_replace(command, '[[:space:]]+', ' ', 'g'))
          IS DISTINCT FROM 'TRUNCATE TABLE net._http_response;'
  ) THEN
    RAISE EXCEPTION '0804: cleanup-net-http-response command is not the approved truncate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-net-http-response') THEN
    PERFORM cron.schedule(
      'cleanup-net-http-response',
      '30 1 * * *',
      'TRUNCATE TABLE net._http_response;'
    );
  END IF;
END $$;

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    run_now_allowed = false,
    desired_enabled = true,
    notes = '0804. Truncates net._http_response. The live schedule is 01:30 UTC daily. SET_STATE pauses or resumes that row. This migration does not truncate and does not reschedule an existing row. Run now is not granted.',
    updated_at = now(),
    updated_info = '0804 net http response set state'
WHERE job_code = 'cleanup-net-http-response'
  AND rec_status = 1;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM cron.job
    WHERE jobname = 'cleanup-net-http-response'
      AND schedule = '30 1 * * *'
      AND active
      AND btrim(regexp_replace(command, '[[:space:]]+', ' ', 'g')) = 'TRUNCATE TABLE net._http_response;'
  ) <> 1 THEN
    RAISE EXCEPTION '0804: cleanup-net-http-response cron row is missing or changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'cleanup-net-http-response'
      AND kind = 'PG_CRON'
      AND desired_enabled = true
      AND run_now_allowed = false
      AND operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[]
  ) THEN
    RAISE EXCEPTION '0804: cleanup-net-http-response was not given SET_STATE';
  END IF;
END $$;

COMMIT;
