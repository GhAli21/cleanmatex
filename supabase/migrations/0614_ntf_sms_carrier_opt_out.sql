-- Notification Hub — SMS inbound carrier opt-out / opt-in (STOP / START) (A2 residual, R3).
--
-- When a recipient replies STOP (or START) to the shared platform SMS sender, the carrier
-- layer blocks (or unblocks) that sender->recipient pair for EVERY tenant that sends through
-- the sender. The Twilio inbound webhook carries only the sender and recipient numbers, no
-- tenant context, so the owning tenants are discovered from the notification outbox (every
-- tenant that has actually sent an SMS to that number). The whole discover-and-write step is
-- ONE atomic, idempotent SQL function so a redelivered webhook cannot double-write.
--
-- Reuses the suppression list from 0603 (reason CARRIER_OPT_OUT and channel SMS are already
-- allowed by ck_ntf_suppr_reason / ck_ntf_suppr_channel). No new table.
BEGIN;

-- Supports the cross-tenant recipient lookup used by the function below. Without it the
-- STOP webhook would scan the whole outbox. Partial: only SMS rows that reached the provider.
CREATE INDEX IF NOT EXISTS ix_ntf_outbox_sms_rcpt
  ON org_ntf_outbox_dtl (recipient_address, tenant_org_id)
  WHERE channel_code = 'SMS' AND provider_message_id IS NOT NULL;
COMMENT ON INDEX ix_ntf_outbox_sms_rcpt IS
  'Finds the tenants that have sent an SMS to a given E.164 number (carrier opt-out fan-out). Partial: SMS rows that carry a provider message id only.';

-- Applies a carrier opt-out or opt-in for one E.164 number across the owning tenants.
--   p_action = 'OPT_OUT': upsert a CARRIER_OPT_OUT suppression for every tenant that sent an
--     SMS to the number. Never overwrites an ACTIVE entry with a different reason
--     (hard-bounce / complaint stay authoritative); re-activates an inactive entry.
--   p_action = 'OPT_IN': deactivate (rec_status=0, is_active=false) ONLY active
--     CARRIER_OPT_OUT entries for the number; other suppression reasons are untouched.
-- Returns jsonb {action, tenants_affected, ignored}. `ignored` is set (and nothing is
-- written) for a malformed number or an unknown action, so a hostile or odd payload can
-- never fail the webhook or write a junk row.
CREATE OR REPLACE FUNCTION fn_ntf_carrier_opt_apply(
  p_phone TEXT,
  p_action TEXT,
  p_source TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_phone TEXT := btrim(p_phone);
  v_tenants UUID[];
  v_affected INTEGER := 0;
BEGIN
  IF p_action NOT IN ('OPT_OUT', 'OPT_IN') THEN
    RETURN jsonb_build_object('action', p_action, 'tenants_affected', 0, 'ignored', 'UNKNOWN_ACTION');
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^\+[1-9][0-9]{6,14}$' THEN
    RETURN jsonb_build_object('action', p_action, 'tenants_affected', 0, 'ignored', 'INVALID_NUMBER');
  END IF;

  IF p_action = 'OPT_OUT' THEN
    -- Tenant discovery: the webhook has no tenant context, so the owning tenants are exactly
    -- the tenants whose outbox shows an SMS delivered to this number. This is the only
    -- cross-tenant read; every write below carries the discovered tenant_org_id.
    SELECT COALESCE(array_agg(DISTINCT o.tenant_org_id), ARRAY[]::UUID[])
      INTO v_tenants
      FROM org_ntf_outbox_dtl o
     WHERE o.channel_code = 'SMS'
       AND o.recipient_address = v_phone
       AND o.provider_message_id IS NOT NULL;

    INSERT INTO org_ntf_suppression_lst AS s (
      tenant_org_id, channel_code, address_or_number, reason_code, source, detail,
      suppressed_at, updated_at, updated_by, rec_status, is_active
    )
    SELECT t.tenant_org_id, 'SMS', v_phone, 'CARRIER_OPT_OUT', p_source,
           'recipient replied STOP to the SMS sender', v_now, v_now, p_source, 1, true
      FROM unnest(v_tenants) AS t(tenant_org_id)
    ON CONFLICT (tenant_org_id, channel_code, address_or_number) DO UPDATE SET
      reason_code = 'CARRIER_OPT_OUT', source = EXCLUDED.source, detail = EXCLUDED.detail,
      suppressed_at = v_now, updated_at = v_now, updated_by = p_source, rec_status = 1, is_active = true
    WHERE s.tenant_org_id = ANY(v_tenants)
      AND (s.rec_status = 0 OR s.reason_code = 'CARRIER_OPT_OUT');
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSE
    -- Opt-in: the owning tenants are those holding an active CARRIER_OPT_OUT entry.
    SELECT COALESCE(array_agg(DISTINCT s.tenant_org_id), ARRAY[]::UUID[])
      INTO v_tenants
      FROM org_ntf_suppression_lst s
     WHERE s.channel_code = 'SMS'
       AND s.address_or_number = v_phone
       AND s.reason_code = 'CARRIER_OPT_OUT'
       AND s.rec_status = 1;

    UPDATE org_ntf_suppression_lst s
       SET rec_status = 0, is_active = false, updated_at = v_now, updated_by = p_source,
           detail = 'recipient re-subscribed (START)'
     WHERE s.tenant_org_id = ANY(v_tenants)
       AND s.channel_code = 'SMS'
       AND s.address_or_number = v_phone
       AND s.reason_code = 'CARRIER_OPT_OUT'
       AND s.rec_status = 1;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('action', p_action, 'tenants_affected', v_affected, 'ignored', NULL);
END;
$$;

COMMENT ON FUNCTION fn_ntf_carrier_opt_apply(TEXT, TEXT, TEXT) IS
  'Applies an SMS carrier opt-out (STOP) or opt-in (START) for one E.164 number to every tenant that has sent an SMS to it, via org_ntf_suppression_lst (reason CARRIER_OPT_OUT). Idempotent; never overrides an active hard-bounce/complaint entry; opt-in only clears CARRIER_OPT_OUT. Service-role only.';

-- Writes happen only from trusted server code (the HQ webhook ingress) using the service role.
REVOKE ALL ON FUNCTION fn_ntf_carrier_opt_apply(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_ntf_carrier_opt_apply(TEXT, TEXT, TEXT) TO service_role;

COMMIT;
