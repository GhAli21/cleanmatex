-- =============================================================================
-- Migration: 0790_fin_idempotency_cleanup_sql.sql
-- Purpose:   I11 WP5. fin-idempotency-cleanup is active, but its command is
--            SELECT public.fin_trigger_job('idempotency_cleanup'), an HTTP call.
--            Point the same daily schedule at cleanup_expired_idempotency_keys.
--            One tick deletes at most 1000 keys whose own expires_at has passed.
--            An overlapping tick returns 0. No other finance job changes.
-- Affected:  cleanup_expired_idempotency_keys(), cron.job fin-idempotency-cleanup,
--            sys_ops_job_cf row fin-idempotency-cleanup
-- Related:   0429 sanctioned delete. Does not expire gift cards, credit notes,
--            loyalty, ERP postings, or POS sessions. Does not send.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- A key is eligible only after the expiry its own writer stored. A live key,
-- including one whose expires_at is null, is not deleted.
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('cleanup_expired_idempotency_keys')) THEN
    RETURN 0;
  END IF;

  DELETE FROM public.org_idempotency_keys AS k
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_idempotency_keys s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.expires_at IS NOT NULL
      AND s.expires_at < now()
    ORDER BY s.expires_at, s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE k.id = old.id
    AND k.tenant_org_id = old.tenant_org_id
    AND k.expires_at IS NOT NULL
    AND k.expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_idempotency_keys() IS
  'Deletes at most 1000 org_idempotency_keys rows whose expires_at has passed. A null expiry stays. Every org_* predicate includes tenant_org_id. Overlap returns 0. This is the sanctioned deletion path. service_role and the function owner only.';

REVOKE ALL ON FUNCTION public.cleanup_expired_idempotency_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-idempotency-cleanup';

SELECT cron.schedule(
  'fin-idempotency-cleanup',
  '0 3 * * *',
  $$ SELECT public.cleanup_expired_idempotency_keys() $$
);

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    default_schedule = '0 3 * * *',
    restore_command = $cmd$SELECT public.cleanup_expired_idempotency_keys()$cmd$,
    notes = '0790 replaces fin_trigger_job HTTP with the fixed SQL delete. One tick removes at most 1000 keys past their own expires_at. Gift-card, credit-note, loyalty, ERP, and POS jobs stay untouched.',
    updated_at = now(),
    updated_info = '0790 fin-idempotency-cleanup sql'
WHERE job_code = 'fin-idempotency-cleanup'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'fin-idempotency-cleanup'
      AND schedule = '0 3 * * *'
      AND active
      AND command LIKE '%cleanup_expired_idempotency_keys()%'
      AND command NOT LIKE '%fin_trigger_job%'
  ) THEN
    RAISE EXCEPTION '0790: fin-idempotency-cleanup still uses HTTP or was not scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'fin-idempotency-cleanup'
      AND lifecycle_status = 'ACTIVE'
      AND 'SET_STATE' = ANY (operator_actions)
      AND restore_command LIKE '%cleanup_expired_idempotency_keys()%'
  ) THEN
    RAISE EXCEPTION '0790: fin-idempotency-cleanup registry was not corrected';
  END IF;
END $$;

COMMIT;
