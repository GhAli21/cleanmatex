-- Render notification-worker finalize contract. Review-only draft: no scheduler or sender is enabled.
CREATE OR REPLACE FUNCTION public.fn_ntf_worker_finalize_claim(
  p_tenant_org_id UUID, p_outbox_id UUID, p_claim_token UUID, p_status TEXT,
  p_error_message TEXT DEFAULT NULL, p_provider_message_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_retry_count INTEGER; v_finalized_at TIMESTAMPTZ := now(); v_row_count INTEGER;
BEGIN
  IF p_status NOT IN ('SENT','FAILED_TEMPORARY','FAILED_PERMANENT','SKIPPED') THEN
    RAISE EXCEPTION 'unsupported notification final status';
  END IF;
  UPDATE public.org_ntf_outbox_dtl AS o
  SET status = p_status, error_message = p_error_message,
      skip_reason = CASE WHEN p_status = 'SKIPPED' THEN coalesce(p_error_message, 'Delivery skipped') ELSE NULL END,
      claim_token = NULL, claimed_by = NULL, lease_expires_at = NULL, reconcile_state = NULL,
      finalized_at = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN NULL ELSE v_finalized_at END,
      sent_at = CASE WHEN p_status = 'SENT' THEN v_finalized_at ELSE o.sent_at END,
      retry_count = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN o.retry_count + 1 ELSE o.retry_count END,
      next_retry_at = CASE WHEN p_status = 'FAILED_TEMPORARY' THEN v_finalized_at + make_interval(mins => (ARRAY[5,15,60,240,720])[least(o.retry_count + 1, 5)]) ELSE NULL END,
      provider_message_id = coalesce(p_provider_message_id, o.provider_message_id), updated_at = v_finalized_at
  WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id AND o.status = 'PROCESSING'
    AND o.claim_token = p_claim_token AND o.reconcile_state IS NULL
  RETURNING o.retry_count INTO v_retry_count;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN RETURN FALSE; END IF;
  INSERT INTO public.org_ntf_delivery_log_dtl (tenant_org_id, outbox_id, attempt_number, status, provider_message_id, error_message, logged_at, rec_status)
  VALUES (p_tenant_org_id, p_outbox_id, v_retry_count + 1, p_status, p_provider_message_id, p_error_message, v_finalized_at, 1);
  RETURN TRUE;
END; $$;
COMMENT ON FUNCTION public.fn_ntf_worker_finalize_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT) IS
  'Service-role-only claim-token guarded notification finalization for the future Render worker; records one immutable attempt and preserves tenant outbox authority.';
REVOKE ALL ON FUNCTION public.fn_ntf_worker_finalize_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_finalize_claim(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
