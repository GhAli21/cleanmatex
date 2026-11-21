-- =============================================================================
-- Migration: 0787_ntf_stale_push_subs_cron.sql
-- Purpose:   I11 WP5 fourth handler. Remote production has no
--            ntf-sweep-stale-push-subs cron row. Restore the weekly fixed SQL
--            command. It only marks stale push subscriptions inactive. It does
--            not call a push provider. One tick deactivates at most 1000 rows.
--            An overlapping tick returns 0.
-- Affected:  ntf_sweep_stale_push_subs(), cron.job ntf-sweep-stale-push-subs,
--            sys_ops_job_cf row ntf-sweep-stale-push-subs
-- Related:   0353 original sweep, 0364 table rename. Does not send, claim, or
--            requeue the outbox. Does not schedule outbox retry.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Same stale rule as 0353: repeated failure, or unverified for 90 days.
-- Rows are deactivated, not deleted, so a later successful registration can
-- be distinguished from a token that was never stored.
CREATE OR REPLACE FUNCTION public.ntf_sweep_stale_push_subs()
RETURNS TABLE(deactivated_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('ntf_sweep_stale_push_subs')) THEN
    RETURN QUERY SELECT 0::BIGINT;
    RETURN;
  END IF;

  UPDATE public.org_ntf_push_subs_dtl AS p
  SET is_active = false,
      updated_at = now(),
      updated_by = 'pg_cron:ntf_sweep_stale_push_subs',
      rec_notes = 'Deactivated by stale-subscription sweep: failure_count > 3 or last_verified_at older than 90 days'
  FROM (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_push_subs_dtl s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.is_active = true
      AND (
        s.failure_count > 3
        OR s.last_verified_at < now() - interval '90 days'
        OR (s.last_verified_at IS NULL AND s.created_at < now() - interval '90 days')
      )
    ORDER BY s.created_at, s.tenant_org_id, s.id
    LIMIT 1000
  ) AS due
  WHERE p.id = due.id
    AND p.tenant_org_id = due.tenant_org_id
    AND p.is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;

COMMENT ON FUNCTION public.ntf_sweep_stale_push_subs() IS
  'Deactivates at most 1000 push subscriptions with failure_count > 3 or unverified for 90 days. Does not call a push provider and does not delete the row. Every org_* predicate includes tenant_org_id. Overlap returns 0. service_role and the function owner only.';

REVOKE ALL ON FUNCTION public.ntf_sweep_stale_push_subs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ntf_sweep_stale_push_subs() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-sweep-stale-push-subs';

SELECT cron.schedule(
  'ntf-sweep-stale-push-subs',
  '0 3 * * 0',
  $$ SELECT public.ntf_sweep_stale_push_subs() $$
);

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    default_schedule = '0 3 * * 0',
    notes = '0787 restores the weekly fixed SQL command. One tick deactivates at most 1000 stale push subscriptions. It does not call a push provider.',
    updated_at = now(),
    updated_info = '0787 ntf-sweep-stale-push-subs'
WHERE job_code = 'ntf-sweep-stale-push-subs'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'ntf-sweep-stale-push-subs'
      AND schedule = '0 3 * * 0'
      AND active
      AND command LIKE '%ntf_sweep_stale_push_subs()%'
  ) THEN
    RAISE EXCEPTION '0787: ntf-sweep-stale-push-subs was not scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'ntf-sweep-stale-push-subs'
      AND lifecycle_status = 'ACTIVE'
      AND 'SET_STATE' = ANY (operator_actions)
  ) THEN
    RAISE EXCEPTION '0787: ntf-sweep-stale-push-subs registry was not corrected';
  END IF;
END $$;

COMMIT;
