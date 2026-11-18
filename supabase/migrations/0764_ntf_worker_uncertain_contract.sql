-- Preserves an ambiguous provider submission under the exact active Render lease.
-- This migration does not schedule, send, retry, or reconcile any notification.
CREATE OR REPLACE FUNCTION public.fn_ntf_worker_mark_uncertain(
  p_tenant_org_id UUID, p_outbox_id UUID, p_claim_token UUID, p_error_message TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_updated INTEGER; v_now TIMESTAMPTZ := now();
BEGIN
  IF coalesce(trim(p_error_message), '') = '' THEN RAISE EXCEPTION 'uncertainty diagnostic is required'; END IF;
  UPDATE public.org_ntf_outbox_dtl AS o
  SET reconcile_state = 'ACCEPTANCE_UNCERTAIN', error_message = p_error_message, updated_at = v_now
  WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id
    AND o.status = 'PROCESSING' AND o.claim_token = p_claim_token AND o.reconcile_state IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN FALSE; END IF;
  INSERT INTO public.org_ntf_delivery_log_dtl (tenant_org_id, outbox_id, attempt_number, status, error_message, logged_at, rec_status)
  SELECT o.tenant_org_id, o.id, o.retry_count + 1, 'ACCEPTANCE_UNCERTAIN', p_error_message, v_now, 1
  FROM public.org_ntf_outbox_dtl AS o WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id AND o.claim_token = p_claim_token;
  RETURN TRUE;
END; $$;
COMMENT ON FUNCTION public.fn_ntf_worker_mark_uncertain(UUID, UUID, UUID, TEXT) IS
  'Service-role-only claim-token guarded preservation of uncertain provider acceptance; rows remain PROCESSING for reconciliation and are never automatically resent.';
REVOKE ALL ON FUNCTION public.fn_ntf_worker_mark_uncertain(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_mark_uncertain(UUID, UUID, UUID, TEXT) TO service_role;
