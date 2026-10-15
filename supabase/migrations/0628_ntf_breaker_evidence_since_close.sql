-- Notification Hub R14 follow-up: circuit-breaker evidence must start fresh after a circuit closes.
--
-- Defect found by the outage drill (runbook 09): the breaker decides from fn_ntf_provider_health, which counts
-- the whole rolling window (default 10 minutes). When a half-open circuit closes after a successful probe, the
-- failures that opened it are still inside that window, so the very next evaluation (one minute later) sees the
-- same failure rate and opens the circuit again, until the old failures age out. The circuit flaps and real
-- traffic keeps being refused although the provider has recovered.
--
-- Fix: a separate read function used ONLY by the breaker. For a provider whose breaker is CLOSED it counts only
-- commands created at or after the last transition (sys_ntf_prov_ctl_cf.changed_at); a provider that was never
-- touched has no such row and keeps the plain window. fn_ntf_provider_health is NOT changed, so the Operations
-- screen keeps showing the full window.
--
-- Affected: new function fn_ntf_breaker_evidence. No table, column, policy or data change.
-- Related:  0625_ntf_operational_safety.sql, 0626_ntf_provider_health_ignore_refusals.sql
BEGIN;

-- Same result shape as fn_ntf_provider_health so the application can reuse its row mapping.
CREATE OR REPLACE FUNCTION public.fn_ntf_breaker_evidence(p_window_minutes INTEGER DEFAULT 10)
RETURNS TABLE (
  provider_code    TEXT,
  channel_code     TEXT,
  sent_count       INTEGER,
  failed_count     INTEGER,
  last_success_at  TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT d.provider_code,
         d.channel_code,
         count(*) FILTER (WHERE d.status = 'SENT')::INTEGER,
         count(*) FILTER (WHERE (d.status = 'FAILED' AND COALESCE(d.error_code, '') NOT IN ('PROVIDER_PAUSED', 'PROVIDER_DRAINING', 'CIRCUIT_OPEN'))
                             OR (d.status = 'PERMANENT_FAILURE' AND d.error_code IN ('PROVIDER_AUTH_FAILED', 'PROVIDER_REJECTED')))::INTEGER,
         max(d.dispatched_at),
         max(d.failed_at) FILTER (WHERE (d.status = 'FAILED' AND COALESCE(d.error_code, '') NOT IN ('PROVIDER_PAUSED', 'PROVIDER_DRAINING', 'CIRCUIT_OPEN'))
                             OR (d.status = 'PERMANENT_FAILURE' AND d.error_code IN ('PROVIDER_AUTH_FAILED', 'PROVIDER_REJECTED')))
  FROM public.hq_ntf_dispatch_log d
  LEFT JOIN public.sys_ntf_prov_ctl_cf c
    ON c.provider_code = d.provider_code
   AND c.channel_code = d.channel_code
  WHERE d.is_test = false
    AND d.created_at >= now() - make_interval(mins => GREATEST(LEAST(COALESCE(p_window_minutes, 10), 1440), 1))
    -- A closed breaker only judges commands made since its last transition (fresh evidence after a close).
    AND (c.breaker_state IS DISTINCT FROM 'CLOSED' OR c.changed_at IS NULL OR d.created_at >= c.changed_at)
  GROUP BY d.provider_code, d.channel_code;
$$;

COMMENT ON FUNCTION public.fn_ntf_breaker_evidence(INTEGER) IS
  'Evidence the circuit breaker judges (window 1-1440 minutes, default 10): like fn_ntf_provider_health, but for a provider whose breaker is CLOSED only commands created at or after the last transition count, so failures that already opened the circuit cannot reopen it right after a successful probe. Test traffic and our own refusals are ignored.';

-- Executed only by the HQ API with the service role; never by tenants or anonymous callers.
REVOKE ALL ON FUNCTION public.fn_ntf_breaker_evidence(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_breaker_evidence(INTEGER) TO service_role;

COMMIT;
