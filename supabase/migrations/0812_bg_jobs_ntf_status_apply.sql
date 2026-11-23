-- =============================================================================
-- Migration: 0812_bg_jobs_ntf_status_apply.sql
-- Purpose:   Background Jobs step 5c - ntf.status_apply (DESIGN.md 7 webhook flow,
--            STEP5_PLAN.md item 4). A provider webhook is verified, stored in
--            hq_ntf_webhook_events and queued; the HQ API consumer then applies it with:
--            1. fn_ntf_status_apply: applies ONE provider receipt (delivered, read,
--               failed, undelivered) to ONE outbox row of one tenant and records it in
--               org_ntf_receipts_tr. Before this, webhooks only changed
--               hq_ntf_dispatch_log, so outbox rows never reached DELIVERED / READ and
--               a carrier bounce after acceptance stayed SENT.
--            2. ix_hq_ntf_dispatch_prov_msg: the consumer finds the dispatch row (and so
--               the tenant and the outbox attempt) by provider message id; without it
--               every webhook scans hq_ntf_dispatch_log.
-- Security:  The function is closed to PUBLIC, anon and authenticated (service role only),
--            like the other fn_ntf_worker_* functions.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Lookup index for webhook receipts.
-- -----------------------------------------------------------------------------
-- Partial: rows without a provider message id (PENDING reservations, failures before
-- acceptance) can never match a receipt.
CREATE INDEX IF NOT EXISTS ix_hq_ntf_dispatch_prov_msg
  ON public.hq_ntf_dispatch_log (provider_message_id, provider_code)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON INDEX public.ix_hq_ntf_dispatch_prov_msg IS
  'Finds the dispatch row for a provider webhook (provider message id + provider code) in ntf.status_apply.';

-- -----------------------------------------------------------------------------
-- 2. fn_ntf_status_apply - one provider receipt -> one outbox row.
-- -----------------------------------------------------------------------------
-- outcome:
--   APPLIED     the receipt was recorded and the outbox status moved forward.
--   RECORDED    the receipt was recorded; the status did not change (ACCEPTED, a late
--               DELIVERED after READ, or a failure after the message was delivered).
--   DUPLICATE   this provider event was already recorded for this tenant; nothing changed.
--   NOT_FOUND   no active outbox row of this tenant has this id and provider message id
--               (a dispatch that is not an outbox send, such as an OTP or a test send).
-- Status moves forward only: SENT -> DELIVERED -> READ; SENT -> FAILED_PERMANENT on
-- FAILED / UNDELIVERABLE. A row that is not yet SENT (still being delivered or
-- reconciled) is left alone: the claim owns it, and its own finalize decides.
CREATE OR REPLACE FUNCTION public.fn_ntf_status_apply(
  p_tenant_org_id       UUID,
  p_outbox_id           UUID,
  p_provider_message_id TEXT,
  p_provider_code       TEXT,
  p_provider_event_key  TEXT,
  p_receipt_kind        TEXT,
  p_provider_status_raw TEXT,
  p_error_message       TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row        public.org_ntf_outbox_dtl%ROWTYPE;
  v_attempt_id UUID;
  v_receipt_id UUID;
  v_new_status TEXT;
  -- Same convention as fn_ntf_worker_finalize_claim's sent_at: now() stored in a timestamp
  -- column, so delivered_at / read_at compare directly with sent_at on the same row.
  v_now        TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_org_id IS NULL OR p_outbox_id IS NULL
     OR coalesce(btrim(p_provider_message_id), '') = ''
     OR coalesce(btrim(p_provider_code), '') = ''
     OR coalesce(btrim(p_provider_event_key), '') = ''
     OR coalesce(btrim(p_provider_status_raw), '') = '' THEN
    RAISE EXCEPTION 'tenant, outbox id, provider message id, provider code, event key and raw status are required';
  END IF;
  IF p_receipt_kind IS NULL OR p_receipt_kind NOT IN ('ACCEPTED', 'DELIVERED', 'READ', 'FAILED', 'UNDELIVERABLE') THEN
    RAISE EXCEPTION 'unsupported receipt kind';
  END IF;

  SELECT o.* INTO v_row
  FROM public.org_ntf_outbox_dtl AS o
  WHERE o.id = p_outbox_id
    AND o.tenant_org_id = p_tenant_org_id
    AND o.provider_message_id = p_provider_message_id
    AND o.rec_status = 1
    AND o.is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  -- The attempt that produced this provider message id; the latest one if the provider
  -- reused the id across attempts.
  SELECT d.attempt_id INTO v_attempt_id
  FROM public.org_ntf_delivery_log_dtl AS d
  WHERE d.tenant_org_id = p_tenant_org_id
    AND d.outbox_id = p_outbox_id
    AND d.provider_message_id = p_provider_message_id
  ORDER BY d.logged_at DESC, d.attempt_number DESC
  LIMIT 1;

  IF v_attempt_id IS NOT NULL THEN
    INSERT INTO public.org_ntf_receipts_tr (
      tenant_org_id, delivery_id, attempt_id, provider_code, provider_event_key,
      provider_message_id, receipt_kind, provider_status_raw, received_at, verified_at,
      redacted_payload, created_by, created_info, rec_status
    ) VALUES (
      p_tenant_org_id, p_outbox_id, v_attempt_id, p_provider_code, p_provider_event_key,
      p_provider_message_id, p_receipt_kind, p_provider_status_raw, v_now, v_now,
      jsonb_build_object('source', 'webhook', 'status', p_provider_status_raw),
      'hq-api', 'ntf.status_apply', 1
    )
    ON CONFLICT (tenant_org_id, provider_code, provider_event_key) DO NOTHING
    RETURNING id INTO v_receipt_id;

    IF v_receipt_id IS NULL THEN
      RETURN 'DUPLICATE';
    END IF;
  END IF;

  v_new_status := CASE
    WHEN p_receipt_kind = 'DELIVERED' AND v_row.status = 'SENT' THEN 'DELIVERED'
    WHEN p_receipt_kind = 'READ' AND v_row.status IN ('SENT', 'DELIVERED') THEN 'READ'
    WHEN p_receipt_kind IN ('FAILED', 'UNDELIVERABLE') AND v_row.status = 'SENT' THEN 'FAILED_PERMANENT'
    ELSE NULL
  END;

  -- A late DELIVERED after READ still fills delivered_at; nothing else changes.
  IF v_new_status IS NULL THEN
    IF p_receipt_kind = 'DELIVERED' AND v_row.status = 'READ' AND v_row.delivered_at IS NULL THEN
      UPDATE public.org_ntf_outbox_dtl AS o
      SET delivered_at = v_now, updated_at = v_now
      WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id;
    END IF;
    RETURN 'RECORDED';
  END IF;

  UPDATE public.org_ntf_outbox_dtl AS o
  SET status = v_new_status,
      delivered_at = CASE WHEN v_new_status IN ('DELIVERED', 'READ') THEN coalesce(o.delivered_at, v_now) ELSE o.delivered_at END,
      read_at = CASE WHEN v_new_status = 'READ' THEN coalesce(o.read_at, v_now) ELSE o.read_at END,
      error_message = CASE
        WHEN v_new_status = 'FAILED_PERMANENT'
          THEN coalesce(p_error_message, 'Provider reported ' || p_provider_status_raw)
        ELSE o.error_message
      END,
      updated_at = v_now
  WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id;

  RETURN 'APPLIED';
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_status_apply(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Service-role-only: applies one verified provider receipt (ACCEPTED, DELIVERED, READ, FAILED, UNDELIVERABLE) to one outbox row of one tenant for an ntf.status_apply job. Records it in org_ntf_receipts_tr (idempotent on tenant + provider + event key) and moves status forward only (SENT -> DELIVERED -> READ, SENT -> FAILED_PERMANENT). Returns APPLIED, RECORDED, DUPLICATE or NOT_FOUND.';
REVOKE ALL ON FUNCTION public.fn_ntf_status_apply(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_status_apply(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
