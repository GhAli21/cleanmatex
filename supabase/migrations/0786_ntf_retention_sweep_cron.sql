-- =============================================================================
-- Migration: 0786_ntf_retention_sweep_cron.sql
-- Purpose:   I11 WP5 third handler. Remote production has no ntf-retention-sweep
--            cron row. Restore the daily fixed SQL command. One tick deletes at
--            most 1000 rows from each retention table, children before parents,
--            and only rows the existing contract already treats as terminal.
--            An overlapping tick returns 0. The next day continues the backlog.
-- Affected:  fn_ntf_retention_sweep(integer), cron.job ntf-retention-sweep,
--            sys_ops_job_cf row ntf-retention-sweep
-- Related:   0609 purge list, 0623 usage-apply order, 0629 fn_ntf_retention_run
--            reads ntf.retention.days. Does not send, claim, or requeue.
--            Does not schedule push cleanup or outbox retry.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Retention window stays 30-3650, the same range fn_ntf_retention_run accepts.
-- Queued, processing, and temporary failures are not in the status list, so a
-- live or uncertain delivery is never deleted. A parent stays while a child
-- foreign key still points at it; a later tick removes the parent.
CREATE OR REPLACE FUNCTION public.fn_ntf_retention_sweep(p_retention_days INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff  TIMESTAMPTZ;
  v_deleted INTEGER := 0;
  v_n       INTEGER := 0;
BEGIN
  IF p_retention_days IS NULL OR p_retention_days < 30 OR p_retention_days > 3650 THEN
    RAISE EXCEPTION 'fn_ntf_retention_sweep retention days must be from 30 to 3650';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('fn_ntf_retention_sweep')) THEN
    RETURN 0;
  END IF;

  v_cutoff := now() - make_interval(days => p_retention_days);

  DELETE FROM public.org_ntf_receipts_tr AS r
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_receipts_tr s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.received_at < v_cutoff
    ORDER BY s.received_at, s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE r.id = old.id
    AND r.tenant_org_id = old.tenant_org_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_deleted := v_deleted + v_n;

  DELETE FROM public.org_ntf_delivery_log_dtl AS d
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_delivery_log_dtl s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.logged_at < v_cutoff
      AND s.attempt_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_ntf_receipts_tr rc
        WHERE rc.tenant_org_id = s.tenant_org_id
          AND rc.attempt_id = s.attempt_id
      )
    ORDER BY s.logged_at, s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE d.id = old.id
    AND d.tenant_org_id = old.tenant_org_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_deleted := v_deleted + v_n;

  DELETE FROM public.org_ntf_usage_apply_evt AS e
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_usage_apply_evt s
    JOIN public.hq_ntf_dispatch_log d
      ON d.idempotency_key = s.idempotency_key
     AND d.tenant_org_id = s.tenant_org_id
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND d.tenant_org_id = s.tenant_org_id
      AND d.status IN ('SENT', 'PERMANENT_FAILURE')
      AND COALESCE(d.dispatched_at, d.failed_at, d.created_at) < v_cutoff
    ORDER BY s.created_at, s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE e.id = old.id
    AND e.tenant_org_id = old.tenant_org_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_deleted := v_deleted + v_n;

  DELETE FROM public.hq_ntf_dispatch_log AS d
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.hq_ntf_dispatch_log s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.status IN ('SENT', 'PERMANENT_FAILURE')
      AND COALESCE(s.dispatched_at, s.failed_at, s.created_at) < v_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_ntf_usage_apply_evt e
        WHERE e.tenant_org_id = s.tenant_org_id
          AND e.idempotency_key = s.idempotency_key
      )
    ORDER BY COALESCE(s.dispatched_at, s.failed_at, s.created_at), s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE d.id = old.id
    AND d.tenant_org_id = old.tenant_org_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_deleted := v_deleted + v_n;

  DELETE FROM public.org_ntf_outbox_dtl AS o
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_outbox_dtl s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.status IN ('SENT', 'DELIVERED', 'READ', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED')
      AND COALESCE(s.finalized_at, s.delivered_at, s.created_at) < v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.org_ntf_delivery_log_dtl l
        WHERE l.tenant_org_id = s.tenant_org_id AND l.outbox_id = s.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.org_ntf_receipts_tr rc
        WHERE rc.tenant_org_id = s.tenant_org_id AND rc.delivery_id = s.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.org_ntf_camp_targets_dtl c
        WHERE c.tenant_org_id = s.tenant_org_id AND c.outbox_id = s.id
      )
    ORDER BY COALESCE(s.finalized_at, s.delivered_at, s.created_at), s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE o.id = old.id
    AND o.tenant_org_id = old.tenant_org_id
    AND o.status IN ('SENT', 'DELIVERED', 'READ', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_deleted := v_deleted + v_n;

  DELETE FROM public.org_ntf_inbox_mst AS i
  USING (
    SELECT s.id, s.tenant_org_id
    FROM public.org_ntf_inbox_mst s
    JOIN public.org_tenants_mst t ON t.id = s.tenant_org_id
    WHERE s.tenant_org_id = t.id
      AND s.created_at < v_cutoff
      AND (s.is_read = true OR (s.expires_at IS NOT NULL AND s.expires_at < now()))
      AND NOT EXISTS (
        SELECT 1 FROM public.org_ntf_outbox_dtl o
        WHERE o.tenant_org_id = s.tenant_org_id AND o.inbox_id = s.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.org_ntf_camp_targets_dtl c
        WHERE c.tenant_org_id = s.tenant_org_id AND c.inbox_id = s.id
      )
    ORDER BY s.created_at, s.tenant_org_id, s.id
    LIMIT 1000
  ) AS old
  WHERE i.id = old.id
    AND i.tenant_org_id = old.tenant_org_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_deleted := v_deleted + v_n;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) IS
  'Deletes at most 1000 rows per table of terminal notification history older than p_retention_days (30-3650). Children go before parents; a referenced parent waits. Queued, processing, and temporary failures stay. Every org_* predicate includes tenant_org_id. Overlap returns 0. Does not send or requeue. service_role and the function owner only.';

REVOKE ALL ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-retention-sweep';

-- fn_ntf_retention_run reads ntf.retention.days. The cron command does not hardcode the window.
SELECT cron.schedule(
  'ntf-retention-sweep',
  '0 4 * * *',
  $$ SELECT public.fn_ntf_retention_run() $$
);

UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE', 'SET_STATE']::TEXT[],
    default_schedule = '0 4 * * *',
    notes = '0786 restores the daily fixed SQL command. fn_ntf_retention_run reads ntf.retention.days. One tick deletes at most 1000 rows per table, children first. Live and uncertain deliveries are not deleted.',
    updated_at = now(),
    updated_info = '0786 ntf-retention-sweep'
WHERE job_code = 'ntf-retention-sweep'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'ntf-retention-sweep'
      AND schedule = '0 4 * * *'
      AND active
      AND command LIKE '%fn_ntf_retention_run()%'
  ) THEN
    RAISE EXCEPTION '0786: ntf-retention-sweep was not scheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'ntf-retention-sweep'
      AND lifecycle_status = 'ACTIVE'
      AND 'SET_STATE' = ANY (operator_actions)
  ) THEN
    RAISE EXCEPTION '0786: ntf-retention-sweep registry was not corrected';
  END IF;
END $$;

COMMIT;
