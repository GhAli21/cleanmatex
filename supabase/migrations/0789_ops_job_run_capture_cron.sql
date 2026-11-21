-- =============================================================================
-- Migration: 0789_ops_job_run_capture_cron.sql
-- Purpose:   I11 WP5. Remote production has no ops-job-run-capture cron row, and
--            the registry schedule 0 13 */6 * * is not the approved five-minute
--            capture. Restore the fixed SQL command. One tick copies at most
--            1000 finished runs and prunes at most 1000 old rows from each log.
--            An overlapping tick returns 0. The next tick continues.
-- Affected:  fn_ops_job_capture_runs(), cron.job ops-job-run-capture,
--            sys_ops_job_cf row ops-job-run-capture
-- Related:   0610 durable run log, 0768 worker-request prune. Does not send,
--            claim, or requeue. Does not change a notification or finance job.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Copies finished scheduler runs into the durable log before the 14-day
-- cron.job_run_details truncation. Already captured runs are skipped.
CREATE OR REPLACE FUNCTION public.fn_ops_job_capture_runs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
DECLARE
  v_captured INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('fn_ops_job_capture_runs')) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.sys_ops_job_run_dtl (
    job_code, started_at, finished_at, status, message,
    trigger_type, actor, cron_run_id, created_info
  )
  SELECT
    src.job_code,
    src.start_time,
    src.end_time,
    CASE src.status WHEN 'succeeded' THEN 'SUCCESS' ELSE 'FAILED' END,
    left(src.return_message, 1000),
    'SCHEDULE',
    NULL,
    src.runid,
    'fn_ops_job_capture_runs'
  FROM (
    SELECT c.job_code, d.start_time, d.end_time, d.status, d.return_message, d.runid
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
    JOIN public.sys_ops_job_cf c ON c.cron_job_name = j.jobname AND c.kind = 'PG_CRON'
    WHERE d.status IN ('succeeded', 'failed')
      AND d.start_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_ops_job_run_dtl r
        WHERE r.job_code = c.job_code
          AND r.cron_run_id = d.runid
      )
    ORDER BY d.start_time, d.runid
    LIMIT 1000
  ) AS src
  ON CONFLICT (job_code, cron_run_id) WHERE cron_run_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_captured = ROW_COUNT;

  DELETE FROM public.sys_ops_job_run_dtl AS d
  USING (
    SELECT s.id
    FROM public.sys_ops_job_run_dtl s
    WHERE s.started_at < now() - interval '90 days'
    ORDER BY s.started_at, s.id
    LIMIT 1000
  ) AS old
  WHERE d.id = old.id;

  DELETE FROM public.sys_ops_job_req_tr AS q
  USING (
    SELECT s.id
    FROM public.sys_ops_job_req_tr s
    WHERE s.status IN ('DONE', 'FAILED', 'CANCELLED')
      AND s.created_at < now() - interval '90 days'
    ORDER BY s.created_at, s.id
    LIMIT 1000
  ) AS old
  WHERE q.id = old.id;

  RETURN v_captured;
END;
$$;

COMMENT ON FUNCTION public.fn_ops_job_capture_runs() IS
  'Copies at most 1000 finished pg_cron runs of registered PG_CRON jobs into sys_ops_job_run_dtl and prunes at most 1000 run-log rows and 1000 ended worker requests older than 90 days. Overlap returns 0. Does not send or requeue. service_role and the function owner only.';

REVOKE ALL ON FUNCTION public.fn_ops_job_capture_runs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_capture_runs() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ops-job-run-capture';

SELECT cron.schedule(
  'ops-job-run-capture',
  '*/5 * * * *',
  $$ SELECT public.fn_ops_job_capture_runs() $$
);

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    schedule = CASE WHEN schedule = '0 13 */6 * *' THEN NULL ELSE schedule END,
    default_schedule = '*/5 * * * *',
    notes = '0789 restores the fixed SQL command every 5 minutes. One tick copies at most 1000 finished runs and prunes at most 1000 old rows from each log. The stored 0 13 */6 schedule was not the approved cadence.',
    updated_at = now(),
    updated_info = '0789 ops-job-run-capture'
WHERE job_code = 'ops-job-run-capture'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'ops-job-run-capture'
      AND schedule = '*/5 * * * *'
      AND active
      AND command LIKE '%fn_ops_job_capture_runs()%'
  ) THEN
    RAISE EXCEPTION '0789: ops-job-run-capture was not scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'ops-job-run-capture'
      AND lifecycle_status = 'ACTIVE'
      AND 'SET_STATE' = ANY (operator_actions)
      AND schedule IS DISTINCT FROM '0 13 */6 * *'
  ) THEN
    RAISE EXCEPTION '0789: ops-job-run-capture registry was not corrected';
  END IF;
END $$;

COMMIT;
