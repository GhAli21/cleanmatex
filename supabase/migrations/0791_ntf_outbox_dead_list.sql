-- =============================================================================
-- Migration: 0791_ntf_outbox_dead_list.sql
-- Purpose:   I11 WP7. Let an HQ operator review permanent notification failures
--            without recipient, subject, body, error text, or tenant id.
-- Affected:  fn_ntf_outbox_dead_list
-- Related:   0783 counts FAILED_PERMANENT. This lists the same rows, still read-only.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Bounded identity list. The cap is inside the function so a caller cannot raise it.
-- id: outbox identity for support correlation, not a person.
-- channel_code: delivery channel stored on the row.
-- provider_code: provider code, null when the row never selected one.
-- event_code: domain event code, null when the row has none.
-- retry_count: attempts already recorded. Not a request to send again.
-- finalized_at: when the row became terminal, null when that timestamp was never set.
CREATE FUNCTION public.fn_ntf_outbox_dead_list(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  channel_code TEXT,
  provider_code TEXT,
  event_code TEXT,
  retry_count INTEGER,
  finalized_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    o.id,
    o.channel_code,
    o.provider_code,
    o.event_code,
    o.retry_count,
    o.finalized_at
  FROM public.org_ntf_outbox_dtl o
  JOIN public.org_tenants_mst t
    ON t.id = o.tenant_org_id
   AND t.is_active
   AND t.rec_status = 1
  WHERE o.tenant_org_id = t.id
    AND o.rec_status = 1
    AND o.is_active
    AND o.status = 'FAILED_PERMANENT'
  ORDER BY o.finalized_at DESC NULLS LAST, o.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
$$;

COMMENT ON FUNCTION public.fn_ntf_outbox_dead_list(INTEGER) IS
  'Newest 1–50 FAILED_PERMANENT notification outbox rows for HQ review. Returns id, channel_code, provider_code, event_code, retry_count, and finalized_at. Omits recipient, subject, body, error text, metadata, and tenant id. Does not claim, send, or update. service_role only.';

-- Public-key roles must not read even this reduced list.
REVOKE ALL ON FUNCTION public.fn_ntf_outbox_dead_list(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_outbox_dead_list(INTEGER) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.fn_ntf_outbox_dead_list(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ntf_outbox_dead_list(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0791: public-key roles must not execute fn_ntf_outbox_dead_list';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.fn_ntf_outbox_dead_list(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0791: service_role must execute fn_ntf_outbox_dead_list';
  END IF;
END $$;

COMMIT;
