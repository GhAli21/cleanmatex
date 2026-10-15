-- Notification Hub R14 follow-up: provider health must ignore our own refusals.
--
-- When a provider is paused, draining or its circuit is open, the HQ dispatcher answers the command with a
-- temporary FAILED status and the error code PROVIDER_PAUSED, PROVIDER_DRAINING or CIRCUIT_OPEN, without
-- calling the provider (so the caller retries later). Those rows are not evidence about the provider's
-- health: counted as failures they would keep an open circuit open and reopen a half-open one forever.
-- fn_ntf_provider_health (0625) is replaced with the same signature and result, ignoring those codes.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_ntf_provider_health(p_window_minutes INTEGER DEFAULT 10)
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
  WHERE d.is_test = false
    AND d.created_at >= now() - make_interval(mins => GREATEST(LEAST(COALESCE(p_window_minutes, 10), 1440), 1))
  GROUP BY d.provider_code, d.channel_code;
$$;

COMMENT ON FUNCTION public.fn_ntf_provider_health(INTEGER) IS
  'Rolling provider health from the HQ dispatch log (window 1-1440 minutes, default 10): sent and failed counts per provider and channel. Failures are temporary failures and provider-caused permanent failures; refusals of our own (quota, not configured, PROVIDER_PAUSED, PROVIDER_DRAINING, CIRCUIT_OPEN) and test traffic are ignored.';
REVOKE ALL ON FUNCTION public.fn_ntf_provider_health(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_provider_health(INTEGER) TO service_role;

COMMIT;
