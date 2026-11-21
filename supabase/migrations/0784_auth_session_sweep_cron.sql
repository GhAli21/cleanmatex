-- =============================================================================
-- Migration: 0784_auth_session_sweep_cron.sql
-- Purpose:   I11 WP5 first handler. Remote production has no auth-session-sweep
--            cron row, and the registry schedule */500 is not a valid minute
--            field. Restore the fixed SQL command every 5 minutes.
--            One tick ends at most 500 expired sessions and purges at most 500
--            ENDED rows older than the retention window. A second overlapping
--            tick returns 0 and leaves the backlog for the next tick.
-- Affected:  fn_auth_sessions_sweep(integer), cron.job auth-session-sweep,
--            sys_ops_job_cf row auth-session-sweep
-- Related:   0575 function, 0576 original schedule, 0734 current body.
--            Sessions live in sys_auth_user_sessions_mst (global). A pending
--            picker has no organization, so this function does not filter
--            tenant_org_id. It does not send, post a ledger, or call HTTP.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Ends expired live sessions, then deletes old ENDED history.
-- The return value counts sessions ended in this tick, not rows purged.
-- A retention below 1 day is refused so a bad argument cannot wipe recent history.
CREATE OR REPLACE FUNCTION public.fn_auth_sessions_sweep(p_retention_days INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_sid   UUID;
  v_why   TEXT;
  v_count INTEGER := 0;
BEGIN
  IF p_retention_days IS NULL OR p_retention_days < 1 THEN
    RAISE EXCEPTION 'fn_auth_sessions_sweep retention days must be at least 1';
  END IF;

  -- One sweep at a time. The lock dies with this transaction.
  IF NOT pg_try_advisory_xact_lock(hashtext('fn_auth_sessions_sweep')) THEN
    RETURN 0;
  END IF;

  FOR v_sid, v_why IN
    SELECT s.auth_session_id,
           CASE
             WHEN s.status = 'PENDING' THEN 'ABSOLUTE_TIMEOUT'
             WHEN s.expires_at <= now() THEN 'ABSOLUTE_TIMEOUT'
             WHEN s.idle_timeout_sec > 0
                  AND s.last_activity_at + make_interval(secs => s.idle_timeout_sec) <= now() THEN 'IDLE_TIMEOUT'
             ELSE 'SECURITY'
           END
    FROM public.sys_auth_user_sessions_mst s
    WHERE (
        s.status = 'ACTIVE'
        AND (
          s.expires_at <= now()
          OR (s.idle_timeout_sec > 0 AND s.last_activity_at + make_interval(secs => s.idle_timeout_sec) <= now())
          OR NOT EXISTS (SELECT 1 FROM auth.sessions a WHERE a.id = s.auth_session_id)
        )
      )
      OR (s.status = 'PENDING' AND s.expires_at <= now())
    ORDER BY s.expires_at, s.auth_session_id
    LIMIT 500
  LOOP
    IF public.fn_auth_session_end_internal(v_sid, v_why, NULL) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  DELETE FROM public.sys_auth_user_sessions_mst AS d
  USING (
    SELECT s.ctid
    FROM public.sys_auth_user_sessions_mst s
    WHERE s.status = 'ENDED'
      AND s.ended_at < now() - make_interval(days => p_retention_days)
    ORDER BY s.ended_at, s.auth_session_id
    LIMIT 500
  ) AS old
  WHERE d.ctid = old.ctid;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fn_auth_sessions_sweep(INTEGER) IS
  'Ends at most 500 expired ACTIVE sessions or abandoned PENDING pickers, then purges at most 500 ENDED rows older than p_retention_days. Overlap returns 0. A pending row is not treated as a missing Supabase session. Global sys_ table: no tenant filter. service_role and the function owner only.';

-- pg_cron runs as the function owner. API roles cannot call it.
REVOKE ALL ON FUNCTION public.fn_auth_sessions_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auth_sessions_sweep(INTEGER) TO service_role;

-- Replace any previous schedule with this name. Remote has none; local has the old body.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auth-session-sweep';

SELECT cron.schedule(
  'auth-session-sweep',
  '*/5 * * * *',
  $$ SELECT public.fn_auth_sessions_sweep(180) $$
);

-- Clear only the known invalid override. A different operator schedule is left in place
-- so this migration does not hide a later decision. SET_STATE lets HQ pause the job.
UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    schedule = CASE WHEN schedule = '*/500 * * * *' THEN NULL ELSE schedule END,
    default_schedule = '*/5 * * * *',
    notes = '0784 restores the fixed SQL command every 5 minutes. One tick ends at most 500 sessions and purges at most 500 old ENDED rows. The stored */500 schedule was invalid.',
    updated_at = now(),
    updated_info = '0784 auth-session-sweep'
WHERE job_code = 'auth-session-sweep'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'auth-session-sweep'
      AND schedule = '*/5 * * * *'
      AND active
      AND command LIKE '%fn_auth_sessions_sweep(180)%'
  ) THEN
    RAISE EXCEPTION '0784: auth-session-sweep was not scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'auth-session-sweep'
      AND lifecycle_status = 'ACTIVE'
      AND 'SET_STATE' = ANY (operator_actions)
      AND schedule IS DISTINCT FROM '*/500 * * * *'
  ) THEN
    RAISE EXCEPTION '0784: auth-session-sweep registry was not corrected';
  END IF;
END $$;

COMMIT;
