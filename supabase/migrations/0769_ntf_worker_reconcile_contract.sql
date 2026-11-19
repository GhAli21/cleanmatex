-- ============================================================================
-- Migration: 0769_ntf_worker_reconcile_contract.sql
-- Purpose:   Make Render-worker notification finalization and provider-status
--            reconciliation atomic, tenant-scoped, and campaign-consistent.
-- Affected:  fn_ntf_worker_finalize_claim, fn_ntf_worker_reconcile_claim,
--            org_ntf_outbox_dtl, org_ntf_delivery_log_dtl, org_ntf_receipts_tr
-- Related:   0556_ntf_outbox_claim_safety.sql, 0564_ntf_attempt_receipt_safety.sql,
--            0601_ntf_campaign_processor_correctness.sql,
--            0761_ntf_worker_finalize_contract.sql,
--            0764_ntf_worker_uncertain_contract.sql
-- ============================================================================

BEGIN;

-- Replaces the provisional worker finalizer with the same signature so normal
-- provider outcomes advance campaign targets in the same transaction as their
-- outbox state. This prevents campaign counters from silently diverging during
-- the Render cutover while preserving the established RPC contract.
CREATE OR REPLACE FUNCTION public.fn_ntf_worker_finalize_claim(
  p_tenant_org_id UUID,
  p_outbox_id UUID,
  p_claim_token UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_retry_count INTEGER;
  v_attempt_number INTEGER;
  v_source_entity_type TEXT;
  v_provider_message_id TEXT;
  v_finalized_at TIMESTAMPTZ := now();
  v_row_count INTEGER;
BEGIN
  IF p_status NOT IN ('SENT', 'FAILED_TEMPORARY', 'FAILED_PERMANENT', 'SKIPPED') THEN
    RAISE EXCEPTION 'unsupported notification final status';
  END IF;

  UPDATE public.org_ntf_outbox_dtl AS o
  SET status = p_status,
      error_message = p_error_message,
      skip_reason = CASE
        WHEN p_status = 'SKIPPED' THEN coalesce(p_error_message, 'Delivery skipped')
        ELSE NULL
      END,
      claim_token = NULL,
      claimed_by = NULL,
      lease_expires_at = NULL,
      reconcile_state = NULL,
      finalized_at = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN NULL ELSE v_finalized_at END,
      sent_at = CASE WHEN p_status = 'SENT' THEN v_finalized_at ELSE o.sent_at END,
      retry_count = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN o.retry_count + 1 ELSE o.retry_count END,
      next_retry_at = CASE
        WHEN p_status = 'FAILED_TEMPORARY'
          THEN v_finalized_at + make_interval(mins => (ARRAY[5, 15, 60, 240, 720])[least(o.retry_count + 1, 5)])
        ELSE NULL
      END,
      provider_message_id = coalesce(p_provider_message_id, o.provider_message_id),
      updated_at = v_finalized_at
  WHERE o.id = p_outbox_id
    AND o.tenant_org_id = p_tenant_org_id
    AND o.status = 'PROCESSING'
    AND o.claim_token = p_claim_token
    AND o.reconcile_state IS NULL
  RETURNING o.retry_count, o.source_entity_type, o.provider_message_id
    INTO v_retry_count, v_source_entity_type, v_provider_message_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- retry_count is incremented by the update for a retryable outcome, so the
  -- current attempt ordinal is the new count rather than the next one.
  v_attempt_number := CASE
    WHEN p_status = 'FAILED_TEMPORARY' THEN v_retry_count
    ELSE v_retry_count + 1
  END;

  INSERT INTO public.org_ntf_delivery_log_dtl (
    tenant_org_id,
    outbox_id,
    claim_token,
    attempt_number,
    status,
    provider_message_id,
    acceptance_state,
    retryable,
    finished_at,
    error_message,
    logged_at,
    rec_status
  ) VALUES (
    p_tenant_org_id,
    p_outbox_id,
    p_claim_token,
    v_attempt_number,
    p_status,
    v_provider_message_id,
    CASE
      WHEN p_status = 'SENT' THEN 'ACCEPTED'
      WHEN p_status IN ('FAILED_TEMPORARY', 'FAILED_PERMANENT') THEN 'REJECTED'
      ELSE NULL
    END,
    p_status = 'FAILED_TEMPORARY',
    v_finalized_at,
    p_error_message,
    v_finalized_at,
    1
  );

  IF v_source_entity_type = 'campaign' AND p_status IN ('SENT', 'FAILED_PERMANENT', 'SKIPPED') THEN
    PERFORM public.fn_ntf_camp_target_resolve(
      p_outbox_id,
      p_tenant_org_id,
      CASE WHEN p_status = 'FAILED_PERMANENT' THEN 'FAILED' ELSE p_status END,
      CASE WHEN p_status = 'SKIPPED' THEN p_error_message ELSE NULL END
    );
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_worker_finalize_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT) IS
  'Service-role-only claim-token guarded normal finalization for the Render notification worker. It atomically updates the tenant outbox, records one immutable attempt, and resolves a campaign target only after a terminal outcome.';

-- This RPC is an internal service boundary. It is deliberately unavailable to
-- browser, anonymous, and ordinary authenticated database clients.
REVOKE ALL ON FUNCTION public.fn_ntf_worker_finalize_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_finalize_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- Resolves a provider-confirmed stale or uncertain claim in one transaction.
-- A two-minute expiry grace mirrors the established reconciliation service and
-- avoids classifying an active-but-slow normal worker as a stale lease.
CREATE OR REPLACE FUNCTION public.fn_ntf_worker_reconcile_claim(
  p_tenant_org_id UUID,
  p_outbox_id UUID,
  p_claim_token UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_provider_message_id TEXT DEFAULT NULL,
  p_provider_code TEXT DEFAULT NULL,
  p_provider_event_key TEXT DEFAULT NULL,
  p_provider_status_raw TEXT DEFAULT NULL,
  p_receipt_kind TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_retry_count INTEGER;
  v_attempt_number INTEGER;
  v_source_entity_type TEXT;
  v_provider_message_id TEXT;
  v_attempt_id UUID;
  v_reconciled_at TIMESTAMPTZ := now();
  v_row_count INTEGER;
  v_has_receipt BOOLEAN := p_provider_code IS NOT NULL
    OR p_provider_event_key IS NOT NULL
    OR p_provider_status_raw IS NOT NULL
    OR p_receipt_kind IS NOT NULL;
BEGIN
  IF p_status NOT IN ('SENT', 'FAILED_TEMPORARY', 'FAILED_PERMANENT', 'SKIPPED') THEN
    RAISE EXCEPTION 'unsupported notification reconciliation status';
  END IF;

  IF v_has_receipt AND (
    p_provider_code IS NULL OR btrim(p_provider_code) = ''
    OR p_provider_event_key IS NULL OR btrim(p_provider_event_key) = ''
    OR p_provider_status_raw IS NULL OR btrim(p_provider_status_raw) = ''
    OR p_receipt_kind NOT IN ('ACCEPTED', 'DELIVERED', 'READ', 'FAILED', 'UNDELIVERABLE')
  ) THEN
    RAISE EXCEPTION 'a reconciliation receipt requires provider code, event key, raw status, and a valid receipt kind';
  END IF;

  IF v_has_receipt AND p_receipt_kind IN ('ACCEPTED', 'DELIVERED', 'READ') AND p_status <> 'SENT' THEN
    RAISE EXCEPTION 'positive provider receipt requires SENT reconciliation status';
  END IF;

  IF v_has_receipt AND p_receipt_kind IN ('FAILED', 'UNDELIVERABLE')
    AND p_status NOT IN ('FAILED_TEMPORARY', 'FAILED_PERMANENT') THEN
    RAISE EXCEPTION 'negative provider receipt requires a failed reconciliation status';
  END IF;

  UPDATE public.org_ntf_outbox_dtl AS o
  SET status = p_status,
      error_message = p_error_message,
      skip_reason = CASE
        WHEN p_status = 'SKIPPED' THEN coalesce(p_error_message, 'Delivery skipped')
        ELSE NULL
      END,
      claim_token = NULL,
      claimed_by = NULL,
      lease_expires_at = NULL,
      reconcile_state = NULL,
      finalized_at = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN NULL ELSE v_reconciled_at END,
      sent_at = CASE WHEN p_status = 'SENT' THEN v_reconciled_at ELSE o.sent_at END,
      retry_count = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN o.retry_count + 1 ELSE o.retry_count END,
      next_retry_at = CASE
        WHEN p_status = 'FAILED_TEMPORARY'
          THEN v_reconciled_at + make_interval(mins => (ARRAY[5, 15, 60, 240, 720])[least(o.retry_count + 1, 5)])
        ELSE NULL
      END,
      provider_message_id = coalesce(p_provider_message_id, o.provider_message_id),
      updated_at = v_reconciled_at
  WHERE o.id = p_outbox_id
    AND o.tenant_org_id = p_tenant_org_id
    AND o.status = 'PROCESSING'
    AND o.claim_token = p_claim_token
    AND (
      o.reconcile_state = 'ACCEPTANCE_UNCERTAIN'
      OR o.lease_expires_at < v_reconciled_at - make_interval(mins => 2)
    )
  RETURNING o.retry_count, o.source_entity_type, o.provider_message_id
    INTO v_retry_count, v_source_entity_type, v_provider_message_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    RETURN FALSE;
  END IF;

  v_attempt_number := CASE
    WHEN p_status = 'FAILED_TEMPORARY' THEN v_retry_count
    ELSE v_retry_count + 1
  END;

  INSERT INTO public.org_ntf_delivery_log_dtl (
    tenant_org_id,
    outbox_id,
    claim_token,
    attempt_number,
    status,
    provider_message_id,
    acceptance_state,
    retryable,
    finished_at,
    error_message,
    logged_at,
    rec_status
  ) VALUES (
    p_tenant_org_id,
    p_outbox_id,
    p_claim_token,
    v_attempt_number,
    p_status,
    v_provider_message_id,
    CASE
      WHEN p_status = 'SENT' THEN 'ACCEPTED'
      WHEN p_status IN ('FAILED_TEMPORARY', 'FAILED_PERMANENT') THEN 'REJECTED'
      ELSE NULL
    END,
    p_status = 'FAILED_TEMPORARY',
    v_reconciled_at,
    p_error_message,
    v_reconciled_at,
    1
  )
  RETURNING attempt_id INTO v_attempt_id;

  IF v_has_receipt THEN
    INSERT INTO public.org_ntf_receipts_tr (
      tenant_org_id,
      delivery_id,
      attempt_id,
      provider_code,
      provider_event_key,
      provider_message_id,
      receipt_kind,
      provider_status_raw,
      received_at,
      verified_at,
      redacted_payload,
      created_by,
      created_info,
      rec_status
    ) VALUES (
      p_tenant_org_id,
      p_outbox_id,
      v_attempt_id,
      p_provider_code,
      p_provider_event_key,
      v_provider_message_id,
      p_receipt_kind,
      p_provider_status_raw,
      v_reconciled_at,
      v_reconciled_at,
      jsonb_build_object('source', 'worker-reconciliation', 'status', p_provider_status_raw),
      'platform-worker',
      'provider-status-reconciliation',
      1
    )
    ON CONFLICT (tenant_org_id, provider_code, provider_event_key) DO NOTHING;
  END IF;

  IF v_source_entity_type = 'campaign' AND p_status IN ('SENT', 'FAILED_PERMANENT', 'SKIPPED') THEN
    PERFORM public.fn_ntf_camp_target_resolve(
      p_outbox_id,
      p_tenant_org_id,
      CASE WHEN p_status = 'FAILED_PERMANENT' THEN 'FAILED' ELSE p_status END,
      CASE WHEN p_status = 'SKIPPED' THEN p_error_message ELSE NULL END
    );
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_worker_reconcile_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Service-role-only provider-reconciliation writer for a stale or acceptance-uncertain Render notification claim. It atomically changes the tenant outbox, appends its attempt, records an optional verified provider receipt, and resolves terminal campaign targets.';

-- The reconciliation function accepts provider evidence only from the trusted
-- worker/API path; PUBLIC and user JWT roles must not submit provider outcomes.
REVOKE ALL ON FUNCTION public.fn_ntf_worker_reconcile_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_reconcile_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
