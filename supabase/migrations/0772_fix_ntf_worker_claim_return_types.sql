-- ============================================================================
-- Migration: 0772_fix_ntf_worker_claim_return_types.sql
-- Purpose:   Correct the Render notification-claim RPC row contract after
--            production proved source_entity_id is TEXT, not UUID.
-- Safety:    This changes no outbox data by itself. The existing tenant-scoped
--            candidate predicate, row locking, lease update, and grants remain
--            unchanged. Explicit casts prevent PostgreSQL from rejecting a CTE
--            projection whose inferred type differs from RETURNS TABLE. RESTRICT
--            prevents an unnoticed database dependent from being dropped.
-- ============================================================================

BEGIN;

-- The previous RETURNS TABLE declaration used UUID for source_entity_id while
-- org_ntf_outbox_dtl stores it as TEXT. PostgreSQL cannot replace a function
-- return type in place, so RESTRICT makes unexpected dependencies a safe stop.
DROP FUNCTION IF EXISTS public.fn_ntf_worker_claim_due(UUID, TEXT, INTEGER, INTEGER) RESTRICT;

CREATE FUNCTION public.fn_ntf_worker_claim_due(
  p_tenant_org_id UUID,
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
  IF p_tenant_org_id IS NULL OR coalesce(trim(p_worker_id), '') = '' THEN
    RAISE EXCEPTION 'tenant and worker identity are required';
  END IF;
  IF p_limit < 1 OR p_limit > 50 OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'claim bounds are invalid';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.org_ntf_outbox_dtl AS o
    WHERE o.tenant_org_id = p_tenant_org_id
      AND o.rec_status = 1
      AND o.is_active
      AND o.claim_token IS NULL
      AND o.reconcile_state IS NULL
      AND ((o.status = 'QUEUED' AND o.scheduled_at <= now())
        OR (o.status = 'FAILED_TEMPORARY' AND o.next_retry_at <= now()))
    ORDER BY coalesce(o.next_retry_at, o.scheduled_at), o.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.org_ntf_outbox_dtl AS o
    SET status = 'PROCESSING',
        claim_token = gen_random_uuid(),
        claimed_by = p_worker_id,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    FROM candidates AS c
    WHERE o.id = c.id
      AND o.tenant_org_id = p_tenant_org_id
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

COMMENT ON FUNCTION public.fn_ntf_worker_claim_due(UUID, TEXT, INTEGER, INTEGER) IS
  'Service-role-only tenant-scoped due notification claim for Render. Atomically acquires canonical leases with SKIP LOCKED and explicitly projects the declared return contract so PostgreSQL cannot reject inferred CTE types.';

-- Retain the private service-role-only execution boundary after replacing the function body.
REVOKE ALL ON FUNCTION public.fn_ntf_worker_claim_due(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_claim_due(UUID, TEXT, INTEGER, INTEGER) TO service_role;

COMMIT;
