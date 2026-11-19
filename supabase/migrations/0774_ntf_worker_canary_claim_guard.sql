-- ============================================================================
-- Migration: 0774_ntf_worker_canary_claim_guard.sql
-- Purpose:   Make a notification delivery canary globally one-claim even when
--            Render briefly runs overlapping worker processes during a deploy.
-- Safety:    Creates only a service-role control record and a dedicated claim
--            RPC. It schedules nothing, sends nothing, changes no existing
--            outbox row by itself, and never releases an uncertain provider
--            outcome. The existing normal claim function remains unchanged.
-- ============================================================================

BEGIN;

-- A durable run record makes the canary budget database-global rather than a
-- process-local counter that a rolling deployment could duplicate.
CREATE TABLE public.sys_ntf_wkr_canary_run_cf (
  run_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ARMED',
  claims_used SMALLINT NOT NULL DEFAULT 0,
  claimed_tenant_org_id UUID,
  claimed_outbox_id UUID,
  claimed_claim_token UUID,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_nwcr_status CHECK (status IN ('ARMED', 'CLAIMED', 'CLOSED')),
  CONSTRAINT ck_nwcr_claims CHECK (claims_used IN (0, 1)),
  CONSTRAINT ck_nwcr_shape CHECK (
    (status = 'ARMED' AND claims_used = 0
      AND claimed_tenant_org_id IS NULL AND claimed_outbox_id IS NULL
      AND claimed_claim_token IS NULL AND claimed_by IS NULL AND claimed_at IS NULL
      AND closed_at IS NULL AND close_reason IS NULL)
    OR
    (status = 'CLAIMED' AND claims_used = 1
      AND claimed_tenant_org_id IS NOT NULL AND claimed_outbox_id IS NOT NULL
      AND claimed_claim_token IS NOT NULL AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL
      AND closed_at IS NULL)
    OR
    (status = 'CLOSED' AND claims_used = 1
      AND claimed_tenant_org_id IS NOT NULL AND claimed_outbox_id IS NOT NULL
      AND claimed_claim_token IS NOT NULL AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL
      AND closed_at IS NOT NULL AND close_reason IS NOT NULL)
  )
);

COMMENT ON TABLE public.sys_ntf_wkr_canary_run_cf IS
  'One durable database-global notification-worker canary budget. A run can claim exactly one canonical outbox row across all Render processes; an uncertain claim remains open until canonical reconciliation proves its outcome.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.run_id IS
  'Operator-generated UUID supplied to all worker processes for one controlled canary; a closed run ID cannot be reused.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.status IS
  'ARMED waits for one eligible row, CLAIMED holds the sole canonical row, CLOSED means a later canary observed that claim reached a terminal canonical state.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.claims_used IS
  'Database-enforced canary budget; only zero or one is valid.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.claimed_tenant_org_id IS
  'Explicit tenant owner of the sole claimed canonical outbox row.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.claimed_outbox_id IS
  'Canonical notification outbox row selected by this canary.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.claimed_claim_token IS
  'Opaque canonical lease token that binds subsequent finalization or reconciliation to this exact claim.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.claimed_by IS
  'Render worker identity that acquired the one allowed claim.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.claimed_at IS
  'Timestamp at which the sole claim was atomically acquired.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.closed_at IS
  'Timestamp at which a later canary attempt observed the prior claim in a terminal canonical state.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.close_reason IS
  'Safe terminal-state reason explaining why the prior run no longer blocks a new canary.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.created_at IS 'Control-record creation timestamp.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.created_by IS 'Actor or worker identity that created the control record.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.created_info IS 'Non-secret creation context.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.updated_at IS 'Most recent control-record update timestamp.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.updated_by IS 'Actor or worker identity that last updated the control record.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.updated_info IS 'Non-secret update context.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.rec_status IS 'Operational record status; active runs remain available for audited recovery.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.rec_order IS 'Optional administrative ordering; unused by the claim contract.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.rec_notes IS 'Optional non-secret operator notes; never provider payload or credentials.';
COMMENT ON COLUMN public.sys_ntf_wkr_canary_run_cf.is_active IS 'Control-record activity flag; the claim contract considers only ARMED and CLAIMED records.';
COMMENT ON CONSTRAINT ck_nwcr_status ON public.sys_ntf_wkr_canary_run_cf IS
  'A canary is waiting, holds its sole claim, or is closed after a terminal canonical outcome.';
COMMENT ON CONSTRAINT ck_nwcr_claims ON public.sys_ntf_wkr_canary_run_cf IS
  'The global budget is one claim, never a configurable batch.';
COMMENT ON CONSTRAINT ck_nwcr_shape ON public.sys_ntf_wkr_canary_run_cf IS
  'Claim identity is complete only while a run holds or has closed its one canonical claim.';

-- Even an accidental second worker/environment run cannot open a second active budget.
CREATE UNIQUE INDEX uq_nwcr_open
  ON public.sys_ntf_wkr_canary_run_cf ((1))
  WHERE status IN ('ARMED', 'CLAIMED');
COMMENT ON INDEX public.uq_nwcr_open IS
  'Allows only one open notification canary globally, including across overlapping Render processes.';

CREATE OR REPLACE FUNCTION public.fn_ntf_worker_claim_canary(
  p_run_id UUID,
  p_tenant_org_id UUID,
  p_worker_id TEXT,
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
DECLARE
  v_open public.sys_ntf_wkr_canary_run_cf%ROWTYPE;
  v_outbox_status TEXT;
  v_reconcile_state TEXT;
BEGIN
  IF p_run_id IS NULL OR p_tenant_org_id IS NULL OR coalesce(trim(p_worker_id), '') = '' THEN
    RAISE EXCEPTION 'canary run, tenant, and worker identity are required';
  END IF;
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'claim bounds are invalid';
  END IF;

  -- This transaction-scoped lock serializes different process/environment run IDs.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ntf_worker_canary_global'));

  SELECT * INTO v_open
  FROM public.sys_ntf_wkr_canary_run_cf AS r
  WHERE r.status IN ('ARMED', 'CLAIMED')
  ORDER BY r.created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_open.run_id = p_run_id THEN
      -- A claimed run has consumed its one permitted delivery; another process gets no work.
      IF v_open.status = 'CLAIMED' THEN
        RETURN;
      END IF;
    ELSIF v_open.status = 'ARMED' THEN
      -- Do not silently replace a waiting operator-approved run with a different environment value.
      RETURN;
    ELSE
      SELECT o.status, o.reconcile_state
      INTO v_outbox_status, v_reconcile_state
      FROM public.org_ntf_outbox_dtl AS o
      WHERE o.tenant_org_id = v_open.claimed_tenant_org_id
        AND o.id = v_open.claimed_outbox_id;

      IF FOUND
        AND v_reconcile_state IS NULL
        AND v_outbox_status IN ('SENT', 'SKIPPED', 'FAILED_TEMPORARY', 'FAILED_PERMANENT') THEN
        UPDATE public.sys_ntf_wkr_canary_run_cf AS r
        SET status = 'CLOSED',
            closed_at = now(),
            close_reason = 'Prior canonical claim reached ' || v_outbox_status,
            updated_at = now(),
            updated_by = p_worker_id,
            updated_info = 'fn_ntf_worker_claim_canary'
        WHERE r.run_id = v_open.run_id
          AND r.status = 'CLAIMED';
      ELSE
        -- PROCESSING, acceptance uncertainty, or a missing canonical row needs human reconciliation.
        RETURN;
      END IF;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sys_ntf_wkr_canary_run_cf AS r
    WHERE r.run_id = p_run_id
      AND r.status = 'CLOSED'
  ) THEN
    RAISE EXCEPTION 'closed canary run IDs cannot be reused';
  END IF;

  INSERT INTO public.sys_ntf_wkr_canary_run_cf (
    run_id, status, claims_used, created_by, created_info
  )
  VALUES (p_run_id, 'ARMED', 0, p_worker_id, 'fn_ntf_worker_claim_canary')
  ON CONFLICT (run_id) DO NOTHING;

  RETURN QUERY
  WITH candidate AS (
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
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.org_ntf_outbox_dtl AS o
    SET status = 'PROCESSING',
        claim_token = gen_random_uuid(),
        claimed_by = p_worker_id,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    FROM candidate AS c
    WHERE o.id = c.id
      AND o.tenant_org_id = p_tenant_org_id
    RETURNING o.*
  ), recorded AS (
    UPDATE public.sys_ntf_wkr_canary_run_cf AS r
    SET status = 'CLAIMED',
        claims_used = 1,
        claimed_tenant_org_id = c.tenant_org_id,
        claimed_outbox_id = c.id,
        claimed_claim_token = c.claim_token,
        claimed_by = p_worker_id,
        claimed_at = now(),
        updated_at = now(),
        updated_by = p_worker_id,
        updated_info = 'fn_ntf_worker_claim_canary'
    FROM claimed AS c
    WHERE r.run_id = p_run_id
      AND r.status = 'ARMED'
      AND r.claims_used = 0
    RETURNING c.*
  )
  SELECT r.id::UUID, r.tenant_org_id::UUID, r.claim_token::UUID,
    r.channel_code::TEXT, r.recipient_address::TEXT, r.recipient_user_id::UUID,
    r.rendered_subject::TEXT, r.rendered_body::TEXT, r.event_code::TEXT,
    r.retry_count::INTEGER, r.max_retries::INTEGER, r.source_entity_type::TEXT,
    r.source_entity_id::TEXT, r.metadata::JSONB
  FROM recorded AS r;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_worker_claim_canary(UUID, UUID, TEXT, INTEGER) IS
  'Service-role-only globally one-claim notification canary. A durable run ID and advisory lock prevent overlapping Render processes from claiming different rows; a prior uncertain claim blocks every later canary until canonical reconciliation resolves it.';

REVOKE ALL ON TABLE public.sys_ntf_wkr_canary_run_cf FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ntf_worker_claim_canary(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_claim_canary(UUID, UUID, TEXT, INTEGER) TO service_role;

COMMIT;
