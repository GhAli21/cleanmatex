-- =============================================================================
-- Migration: 0780_ntf_outbox_global_claim.sql
-- Purpose:   I11 WP1: one service-role aggregate and one fair global claim so
--            the HQ worker does not list tenants and call N claim RPCs.
--            Also returns pending manual File Util requests from the heartbeat
--            so a disabled job with an empty queue is one RPC per tick.
-- Affected:  fn_ntf_outbox_due_sum_all, fn_ntf_worker_claim_due_global,
--            fn_ops_worker_job_sync
-- Related:   0756, 0772, 0768. Does not schedule, send, or alter cron.job.
-- Safety:    DRAFT ONLY. Review and apply manually. No new index (D18: explain
--            the due predicate on remote after apply before adding one).
--            anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- One row of counts. Every org_* source is joined on tenant_org_id.
CREATE FUNCTION public.fn_ntf_outbox_due_sum_all(p_as_of TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (
  queued_due BIGINT,
  retry_due BIGINT,
  processing_leased BIGINT,
  acceptance_uncertain BIGINT,
  tenants_with_due BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    count(*) FILTER (
      WHERE o.status = 'QUEUED' AND o.claim_token IS NULL AND o.reconcile_state IS NULL
        AND o.scheduled_at <= p_as_of
    ),
    count(*) FILTER (
      WHERE o.status = 'FAILED_TEMPORARY' AND o.claim_token IS NULL AND o.reconcile_state IS NULL
        AND o.next_retry_at <= p_as_of
    ),
    count(*) FILTER (
      WHERE o.status = 'PROCESSING' AND o.claim_token IS NOT NULL
        AND o.lease_expires_at > p_as_of AND o.reconcile_state IS NULL
    ),
    count(*) FILTER (
      WHERE o.status = 'PROCESSING' AND o.reconcile_state = 'ACCEPTANCE_UNCERTAIN'
    ),
    count(DISTINCT o.tenant_org_id) FILTER (
      WHERE (o.status = 'QUEUED' AND o.claim_token IS NULL AND o.reconcile_state IS NULL AND o.scheduled_at <= p_as_of)
         OR (o.status = 'FAILED_TEMPORARY' AND o.claim_token IS NULL AND o.reconcile_state IS NULL AND o.next_retry_at <= p_as_of)
         OR (o.status = 'PROCESSING' AND o.claim_token IS NOT NULL AND o.lease_expires_at > p_as_of AND o.reconcile_state IS NULL)
         OR (o.status = 'PROCESSING' AND o.reconcile_state = 'ACCEPTANCE_UNCERTAIN')
    )
  FROM public.org_ntf_outbox_dtl o
  JOIN public.org_tenants_mst t
    ON t.id = o.tenant_org_id
   AND t.is_active
   AND t.rec_status = 1
  WHERE o.tenant_org_id = t.id
    AND o.rec_status = 1
    AND o.is_active;
$$;

COMMENT ON FUNCTION public.fn_ntf_outbox_due_sum_all(TIMESTAMPTZ) IS
  'Aggregate notification-outbox counts across active organizations. No recipients or rendered content. Does not claim or send. service_role only.';

-- Fair share: the earliest due row of each organization is preferred before a second row of the same organization.
-- Index candidate after remote EXPLAIN (do not add here): org_ntf_outbox_dtl (tenant_org_id, status, scheduled_at) WHERE claim_token IS NULL AND rec_status = 1 AND is_active.
CREATE FUNCTION public.fn_ntf_worker_claim_due_global(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 25,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  tenant_org_id UUID,
  claim_token UUID,
  channel_code TEXT,
  recipient_address TEXT,
  recipient_user_id UUID,
  rendered_subject TEXT,
  rendered_body TEXT,
  event_code TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  source_entity_type TEXT,
  source_entity_id TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF coalesce(trim(p_worker_id), '') = '' THEN
    RAISE EXCEPTION 'worker identity is required';
  END IF;
  IF p_limit < 1 OR p_limit > 50 OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'claim bounds are invalid';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT o.id,
           row_number() OVER (
             PARTITION BY o.tenant_org_id
             ORDER BY coalesce(o.next_retry_at, o.scheduled_at), o.id
           ) AS fair_rank
    FROM public.org_ntf_outbox_dtl o
    JOIN public.org_tenants_mst t
      ON t.id = o.tenant_org_id AND t.is_active AND t.rec_status = 1
    WHERE o.tenant_org_id = t.id
      AND o.rec_status = 1
      AND o.is_active
      AND o.claim_token IS NULL
      AND o.reconcile_state IS NULL
      AND ((o.status = 'QUEUED' AND o.scheduled_at <= now())
        OR (o.status = 'FAILED_TEMPORARY' AND o.next_retry_at <= now()))
  ),
  chosen AS (
    SELECT d.id
    FROM due d
    ORDER BY d.fair_rank, d.id
    LIMIT p_limit
  ),
  locked AS (
    SELECT o.id
    FROM public.org_ntf_outbox_dtl o
    JOIN chosen c ON c.id = o.id
    WHERE o.tenant_org_id IS NOT NULL
      AND o.claim_token IS NULL
      AND o.rec_status = 1
      AND o.is_active
    FOR UPDATE OF o SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.org_ntf_outbox_dtl AS o
    SET status = 'PROCESSING',
        claim_token = gen_random_uuid(),
        claimed_by = p_worker_id,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    FROM locked AS l
    WHERE o.id = l.id
      AND o.tenant_org_id IS NOT NULL
      AND o.claim_token IS NULL
    RETURNING o.*
  )
  SELECT c.id::UUID, c.tenant_org_id::UUID, c.claim_token::UUID,
    c.channel_code::TEXT, c.recipient_address::TEXT, c.recipient_user_id::UUID,
    c.rendered_subject::TEXT, c.rendered_body::TEXT, c.event_code::TEXT,
    c.retry_count::INTEGER, c.max_retries::INTEGER, c.source_entity_type::TEXT,
    c.source_entity_id::TEXT, c.metadata::JSONB
  FROM claimed AS c;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_worker_claim_due_global(TEXT, INTEGER, INTEGER) IS
  'Service-role global due claim. SKIP LOCKED, at most 50 rows, fair across tenant_org_id. Same lease columns as fn_ntf_worker_claim_due. Does not send or finalize.';

CREATE OR REPLACE FUNCTION public.fn_ops_worker_job_sync(p_job_code text, p_worker text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_cfg    public.sys_ops_job_cf%ROWTYPE;
  v_sched  TEXT;
  v_manual INTEGER;
  v_worker TEXT := left(COALESCE(NULLIF(btrim(p_worker), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active AND kind = 'HQ_WORKER';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'job_code', p_job_code);
  END IF;
  v_sched := COALESCE(v_cfg.schedule, v_cfg.default_schedule);

  SELECT count(*)::INTEGER INTO v_manual
  FROM public.sys_ops_job_req_tr
  WHERE job_code = p_job_code
    AND status = 'REQUESTED'
    AND trigger_type = 'MANUAL'
    AND is_active
    AND rec_status = 1;

  IF v_cfg.applied_at IS NULL OR v_cfg.applied_at < now() - interval '5 minutes'
     OR v_cfg.applied_schedule IS DISTINCT FROM v_sched
     OR v_cfg.applied_enabled IS DISTINCT FROM v_cfg.desired_enabled
     OR v_cfg.applied_by IS DISTINCT FROM v_worker THEN
    UPDATE public.sys_ops_job_cf
       SET applied_schedule = v_sched, applied_enabled = v_cfg.desired_enabled,
           applied_at = now(), applied_by = v_worker
     WHERE job_code = p_job_code;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'job_code', p_job_code,
    'enabled', v_cfg.desired_enabled, 'schedule', v_sched,
    'pending_manual', v_manual);
END;
$function$;

COMMENT ON FUNCTION public.fn_ops_worker_job_sync(text, text) IS
  'HQ worker heartbeat (15-minute tick): desired state plus pending_manual so a disabled job with no Run now skips claim. service_role only.';

REVOKE ALL ON FUNCTION public.fn_ntf_outbox_due_sum_all(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ntf_worker_claim_due_global(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_worker_job_sync(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_outbox_due_sum_all(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_claim_due_global(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_worker_job_sync(text, text) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.fn_ntf_outbox_due_sum_all(timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ntf_outbox_due_sum_all(timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_ntf_worker_claim_due_global(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ntf_worker_claim_due_global(text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0780: public-key roles must not execute the global outbox functions';
  END IF;
END $$;

COMMIT;
