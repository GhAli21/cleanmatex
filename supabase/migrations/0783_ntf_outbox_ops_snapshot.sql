-- =============================================================================
-- Migration: 0783_ntf_outbox_ops_snapshot.sql
-- Purpose:   I11 WP3. One aggregate row for the Job Manager notification jobs:
--            due, retry, oldest due age, leased, acceptance-uncertain, dead letter.
--            No recipient, body, or tenant id.
-- Affected:  fn_ntf_outbox_ops_snapshot
-- Related:   0780 due counts. Does not claim, send, or change a job row.
-- Safety:    DRAFT ONLY. Review and apply manually. anon/authenticated are not granted.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- One row. Every org_* source is joined on tenant_org_id. Empty backlog returns zeros and a null age.
CREATE FUNCTION public.fn_ntf_outbox_ops_snapshot(p_as_of TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (
  queued_due BIGINT,
  retry_due BIGINT,
  oldest_due_seconds BIGINT,
  processing_leased BIGINT,
  acceptance_uncertain BIGINT,
  failed_permanent BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    count(*) FILTER (WHERE s.bucket = 'queued'),
    count(*) FILTER (WHERE s.bucket = 'retry'),
    CASE
      WHEN min(s.due_at) IS NULL THEN NULL
      ELSE GREATEST(floor(extract(epoch FROM (p_as_of - min(s.due_at))))::bigint, 0)
    END,
    count(*) FILTER (WHERE s.bucket = 'leased'),
    count(*) FILTER (WHERE s.bucket = 'uncertain'),
    count(*) FILTER (WHERE s.bucket = 'dead')
  FROM (
    SELECT
      CASE
        WHEN o.status = 'QUEUED'
         AND o.claim_token IS NULL
         AND o.reconcile_state IS NULL
         AND o.scheduled_at <= p_as_of THEN 'queued'
        WHEN o.status = 'FAILED_TEMPORARY'
         AND o.claim_token IS NULL
         AND o.reconcile_state IS NULL
         AND o.next_retry_at <= p_as_of THEN 'retry'
        WHEN o.status = 'PROCESSING'
         AND o.claim_token IS NOT NULL
         AND o.lease_expires_at > p_as_of
         AND o.reconcile_state IS NULL THEN 'leased'
        WHEN o.status = 'PROCESSING'
         AND o.reconcile_state = 'ACCEPTANCE_UNCERTAIN' THEN 'uncertain'
        WHEN o.status = 'FAILED_PERMANENT' THEN 'dead'
        ELSE NULL
      END AS bucket,
      CASE
        WHEN o.status = 'QUEUED'
         AND o.claim_token IS NULL
         AND o.reconcile_state IS NULL
         AND o.scheduled_at <= p_as_of THEN o.scheduled_at
        WHEN o.status = 'FAILED_TEMPORARY'
         AND o.claim_token IS NULL
         AND o.reconcile_state IS NULL
         AND o.next_retry_at <= p_as_of THEN o.next_retry_at
        ELSE NULL
      END AS due_at
    FROM public.org_ntf_outbox_dtl o
    JOIN public.org_tenants_mst t
      ON t.id = o.tenant_org_id
     AND t.is_active
     AND t.rec_status = 1
    WHERE o.tenant_org_id = t.id
      AND o.rec_status = 1
      AND o.is_active
  ) s;
$$;

COMMENT ON FUNCTION public.fn_ntf_outbox_ops_snapshot(TIMESTAMPTZ) IS
  'Job Manager counts for the notification outbox: due, retry, oldest due age in seconds, leased, acceptance-uncertain, and FAILED_PERMANENT. No recipient, body, or tenant id. Does not claim or send. service_role only.';

REVOKE ALL ON FUNCTION public.fn_ntf_outbox_ops_snapshot(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_outbox_ops_snapshot(TIMESTAMPTZ) TO service_role;

COMMIT;
