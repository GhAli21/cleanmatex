-- =============================================================================
-- Migration: 0756_ntf_worker_shadow_metrics.sql
-- Status:    DRAFT ONLY. Review and apply manually; this migration is never run
--            by an agent.
-- Purpose:   I11 Phase 2.2 shadow telemetry for the future Render notification
--            worker. Exposes only aggregate tenant-scoped outbox readiness and
--            claim-risk counts; it does not claim, send, retry, schedule, or
--            expose recipients, rendered content, provider credentials, or keys.
-- Safety:    The worker must call this once per active tenant. Every query on
--            org_ntf_outbox_dtl visibly filters the supplied tenant_org_id.
--            No pg_cron, pg_net, BullMQ, or external-provider call is made.
-- Reversal:  DROP FUNCTION public.fn_ntf_outbox_due_sum(UUID, TIMESTAMPTZ)
--            RESTRICT only after the shadow worker consumer is retired.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Returns bounded operational facts for one tenant. The caller supplies a single
-- consistent timestamp so queued/retry due counts are comparable in one probe run.
CREATE OR REPLACE FUNCTION public.fn_ntf_outbox_due_sum(
  p_tenant_org_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  queued_due BIGINT,
  retry_due BIGINT,
  processing_leased BIGINT,
  acceptance_uncertain BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    count(*) FILTER (
      WHERE o.status = 'QUEUED'
        AND o.claim_token IS NULL
        AND o.reconcile_state IS NULL
        AND o.scheduled_at <= p_as_of
    ) AS queued_due,
    count(*) FILTER (
      WHERE o.status = 'FAILED_TEMPORARY'
        AND o.claim_token IS NULL
        AND o.reconcile_state IS NULL
        AND o.next_retry_at <= p_as_of
    ) AS retry_due,
    count(*) FILTER (
      WHERE o.status = 'PROCESSING'
        AND o.claim_token IS NOT NULL
        AND o.lease_expires_at > p_as_of
        AND o.reconcile_state IS NULL
    ) AS processing_leased,
    count(*) FILTER (
      WHERE o.status = 'PROCESSING'
        AND o.reconcile_state = 'ACCEPTANCE_UNCERTAIN'
    ) AS acceptance_uncertain
  FROM public.org_ntf_outbox_dtl o
  WHERE o.tenant_org_id = p_tenant_org_id
    AND o.rec_status = 1
    AND o.is_active;
$$;

COMMENT ON FUNCTION public.fn_ntf_outbox_due_sum(UUID, TIMESTAMPTZ) IS
  'Returns aggregate due, leased, and acceptance-uncertain notification outbox counts for one explicit tenant. Used only for worker shadow telemetry; does not claim, send, retry, or expose delivery content.';

-- Public-schema SECURITY DEFINER functions are executable by PUBLIC by default.
-- Browser roles must never observe cross-tenant operational state.
REVOKE ALL ON FUNCTION public.fn_ntf_outbox_due_sum(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_outbox_due_sum(UUID, TIMESTAMPTZ) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.fn_ntf_outbox_due_sum(uuid,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ntf_outbox_due_sum(uuid,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION '0756: a browser role can execute the tenant outbox shadow-metrics function';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.fn_ntf_outbox_due_sum(uuid,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION '0756: service_role is missing the tenant outbox shadow-metrics grant';
  END IF;
END $$;

COMMIT;
