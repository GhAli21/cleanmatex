-- =============================================================================
-- Migration: 0785_ntf_quota_rsv_sweep_cron.sql
-- Purpose:   I11 WP5 second handler. Remote production has no ntf-quota-rsv-sweep
--            cron row, and the registry schedule 0 2 */5 * * is not the approved
--            five-minute housekeeping cadence. Restore the fixed SQL command.
--            One tick expires at most 500 stale reservations and purges at most
--            500 settled rows. An overlapping tick returns 0.
-- Affected:  fn_ntf_quota_rsv_sweep(integer), cron.job ntf-quota-rsv-sweep,
--            sys_ops_job_cf row ntf-quota-rsv-sweep
-- Related:   0623 reservation ledger. Does not claim, send, or requeue the outbox.
--            Does not schedule retention, push, or retry jobs.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- A RESERVED row past expires_at no longer counts toward the cap. Marking it keeps
-- the quota screen honest. Settled history older than the purge window is deleted.
-- The return value is rows expired plus rows purged in this tick.
CREATE OR REPLACE FUNCTION public.fn_ntf_quota_rsv_sweep(p_purge_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expired INTEGER := 0;
  v_purged  INTEGER := 0;
  v_days    INTEGER := GREATEST(p_purge_days, 1);
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('fn_ntf_quota_rsv_sweep')) THEN
    RETURN 0;
  END IF;

  UPDATE public.org_ntf_quota_rsv_dtl AS r
  SET status = 'EXPIRED',
      settled_at = now(),
      updated_at = now(),
      updated_info = 'fn_ntf_quota_rsv_sweep'
  FROM (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_quota_rsv_dtl s
    JOIN public.org_tenants_mst t
      ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.status = 'RESERVED'
      AND s.expires_at <= now()
    ORDER BY s.expires_at, s.tenant_org_id, s.id
    LIMIT 500
  ) AS due
  WHERE r.id = due.id
    AND r.tenant_org_id = due.tenant_org_id
    AND r.status = 'RESERVED';
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  DELETE FROM public.org_ntf_quota_rsv_dtl AS r
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_quota_rsv_dtl s
    JOIN public.org_tenants_mst t
      ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.status <> 'RESERVED'
      AND s.settled_at < now() - make_interval(days => v_days)
    ORDER BY s.settled_at, s.tenant_org_id, s.id
    LIMIT 500
  ) AS old
  WHERE r.id = old.id
    AND r.tenant_org_id = old.tenant_org_id
    AND r.status <> 'RESERVED';
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN v_expired + v_purged;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_quota_rsv_sweep(INTEGER) IS
  'Expires at most 500 RESERVED quota rows past expires_at and purges at most 500 settled rows older than p_purge_days (minimum 1). Each org_* predicate includes tenant_org_id. Overlap returns 0. Does not send or requeue. service_role and the function owner only.';

REVOKE ALL ON FUNCTION public.fn_ntf_quota_rsv_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_quota_rsv_sweep(INTEGER) TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-quota-rsv-sweep';

SELECT cron.schedule(
  'ntf-quota-rsv-sweep',
  '*/5 * * * *',
  $$ SELECT public.fn_ntf_quota_rsv_sweep(30) $$
);

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    schedule = CASE WHEN schedule = '0 2 */5 * *' THEN NULL ELSE schedule END,
    default_schedule = '*/5 * * * *',
    notes = '0785 restores the fixed SQL command every 5 minutes. One tick expires at most 500 reservations and purges at most 500 settled rows. The stored 0 2 */5 schedule was not the approved cadence.',
    updated_at = now(),
    updated_info = '0785 ntf-quota-rsv-sweep'
WHERE job_code = 'ntf-quota-rsv-sweep'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'ntf-quota-rsv-sweep'
      AND schedule = '*/5 * * * *'
      AND active
      AND command LIKE '%fn_ntf_quota_rsv_sweep(30)%'
  ) THEN
    RAISE EXCEPTION '0785: ntf-quota-rsv-sweep was not scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'ntf-quota-rsv-sweep'
      AND lifecycle_status = 'ACTIVE'
      AND 'SET_STATE' = ANY (operator_actions)
      AND schedule IS DISTINCT FROM '0 2 */5 * *'
  ) THEN
    RAISE EXCEPTION '0785: ntf-quota-rsv-sweep registry was not corrected';
  END IF;
END $$;

COMMIT;
