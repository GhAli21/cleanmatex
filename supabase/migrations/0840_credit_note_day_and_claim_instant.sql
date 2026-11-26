-- Credit-note expiry uses the organization civil day. A missing zone does not expire the note.
-- The worker claim returns scheduled_at as timestamptz, matching org_ntf_outbox_dtl.scheduled_at.

CREATE OR REPLACE FUNCTION public.fn_fin_credit_note_expire_one(p_tenant_org_id uuid, p_credit_note_id uuid, p_only_if_due boolean DEFAULT true, p_actor text DEFAULT 'system/credit-note-expiry'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_key     TEXT := 'cn-expiry-' || p_credit_note_id::text;
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'system/credit-note-expiry'), 120);
  v_note    RECORD;
  v_has_txn BOOLEAN;
BEGIN
  SELECT n.id, n.status, n.remaining_balance, n.currency_code, n.customer_id,
         (n.expires_at IS NOT NULL AND n.expires_at < (now() AT TIME ZONE public.fn_ops_zone(p_tenant_org_id, 'ledger', NULL))::date) AS is_due
    INTO v_note
    FROM public.org_credit_notes_mst n
   WHERE n.tenant_org_id = p_tenant_org_id
     AND n.id = p_credit_note_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.org_credit_note_txn_dtl t
     WHERE t.tenant_org_id = p_tenant_org_id AND t.idempotency_key = v_key
  ) INTO v_has_txn;

  IF v_note.status = 'EXPIRED' OR v_has_txn THEN
    IF v_note.status <> 'EXPIRED' THEN
      UPDATE public.org_credit_notes_mst
         SET status = 'EXPIRED', remaining_balance = 0, updated_at = now(), updated_by = v_actor
       WHERE tenant_org_id = p_tenant_org_id AND id = p_credit_note_id;
    END IF;
    RETURN 'ALREADY_EXPIRED';
  END IF;

  IF v_note.status <> 'ACTIVE' THEN
    RETURN 'NOT_ACTIVE';
  END IF;
  IF p_only_if_due AND NOT v_note.is_due THEN
    RETURN 'NOT_DUE';
  END IF;

  UPDATE public.org_credit_notes_mst
     SET status = 'EXPIRED', remaining_balance = 0, updated_at = now(), updated_by = v_actor
   WHERE tenant_org_id = p_tenant_org_id AND id = p_credit_note_id;

  IF v_note.remaining_balance > 0 THEN
    INSERT INTO public.org_credit_note_txn_dtl (
      tenant_org_id, credit_note_id, customer_id, txn_type, amount, currency_code,
      balance_before, balance_after, idempotency_key, notes, rec_status, created_by, created_info
    ) VALUES (
      p_tenant_org_id, p_credit_note_id, v_note.customer_id, 'EXPIRY', -v_note.remaining_balance, v_note.currency_code,
      v_note.remaining_balance, 0, v_key, 'Credit note expired', 1, v_actor, 'fn_fin_credit_note_expire_one'
    );
  END IF;
  RETURN 'EXPIRED';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_fin_credit_note_expiry_run()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
DECLARE
  r         RECORD;
  v_outcome TEXT;
  v_expired INTEGER := 0;
  v_skipped INTEGER := 0;
  v_failed  INTEGER := 0;
BEGIN
  FOR r IN
    SELECT n.tenant_org_id, n.id
      FROM public.org_credit_notes_mst n
      JOIN public.org_tenants_mst t
        ON t.id = n.tenant_org_id
       AND t.is_active
       AND t.rec_status = 1
     WHERE n.tenant_org_id = t.id
       AND n.status = 'ACTIVE'
       AND n.is_active
       AND n.rec_status = 1
       AND n.expires_at IS NOT NULL
       AND n.expires_at < (now() AT TIME ZONE public.fn_ops_zone(n.tenant_org_id, 'ledger', NULL))::date
     ORDER BY n.expires_at, n.id
     LIMIT 5000
  LOOP
    BEGIN
      v_outcome := public.fn_fin_credit_note_expire_one(r.tenant_org_id, r.id, true, 'system/credit-note-expiry');
      IF v_outcome IN ('EXPIRED', 'ALREADY_EXPIRED') THEN
        v_expired := v_expired + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'fn_fin_credit_note_expiry_run: credit note % (tenant %) failed: %', r.id, r.tenant_org_id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('expired', v_expired, 'skipped', v_skipped, 'failed', v_failed);
END;
$function$;

DROP FUNCTION public.fn_ntf_worker_claim_one(p_tenant_org_id uuid, p_outbox_id uuid, p_claim_token uuid, p_worker_id text, p_lease_seconds integer) RESTRICT;

CREATE OR REPLACE FUNCTION public.fn_ntf_worker_claim_one(p_tenant_org_id uuid, p_outbox_id uuid, p_claim_token uuid, p_worker_id text, p_lease_seconds integer DEFAULT 120)
 RETURNS TABLE(claim_outcome text, id uuid, tenant_org_id uuid, claim_token uuid, status text, scheduled_at timestamptz, channel_code text, recipient_address text, recipient_user_id uuid, rendered_subject text, rendered_body text, event_code text, retry_count integer, max_retries integer, source_entity_type text, source_entity_id text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.org_ntf_outbox_dtl%ROWTYPE;
BEGIN
  IF p_tenant_org_id IS NULL OR p_outbox_id IS NULL OR p_claim_token IS NULL
     OR coalesce(trim(p_worker_id), '') = '' THEN
    RAISE EXCEPTION 'tenant, outbox id, claim token and worker identity are required';
  END IF;
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 600';
  END IF;

  SELECT o.* INTO v_row
  FROM public.org_ntf_outbox_dtl AS o
  WHERE o.id = p_outbox_id
    AND o.tenant_org_id = p_tenant_org_id
    AND o.rec_status = 1
    AND o.is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::TEXT, p_outbox_id, p_tenant_org_id, NULL::UUID, NULL::TEXT, NULL::TIMESTAMP,
      NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER,
      NULL::TEXT, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_row.status = 'PROCESSING' AND v_row.claim_token = p_claim_token AND v_row.reconcile_state IS NULL THEN
    UPDATE public.org_ntf_outbox_dtl AS o
    SET lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id
    RETURNING o.* INTO v_row;
    RETURN QUERY SELECT 'OWN_CLAIM'::TEXT, v_row.id, v_row.tenant_org_id, v_row.claim_token, v_row.status,
      v_row.scheduled_at, v_row.channel_code, v_row.recipient_address, v_row.recipient_user_id,
      v_row.rendered_subject, v_row.rendered_body, v_row.event_code, v_row.retry_count, v_row.max_retries,
      v_row.source_entity_type, v_row.source_entity_id, v_row.metadata;
    RETURN;
  END IF;

  IF v_row.claim_token IS NOT NULL OR v_row.reconcile_state IS NOT NULL
     OR v_row.status NOT IN ('QUEUED', 'FAILED_TEMPORARY') THEN
    RETURN QUERY SELECT 'NOT_CLAIMABLE'::TEXT, v_row.id, v_row.tenant_org_id, NULL::UUID, v_row.status,
      v_row.scheduled_at, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::INTEGER, NULL::INTEGER, NULL::TEXT, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- scheduled_at is a timestamptz. now() is the same kind of instant.
  -- A missing organization zone does not change this eligibility check.
  IF v_row.status = 'QUEUED' AND v_row.scheduled_at > now() + interval '5 seconds' THEN
    RETURN QUERY SELECT 'NOT_DUE'::TEXT, v_row.id, v_row.tenant_org_id, NULL::UUID, v_row.status,
      v_row.scheduled_at, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::INTEGER, NULL::INTEGER, NULL::TEXT, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  UPDATE public.org_ntf_outbox_dtl AS o
  SET status = 'PROCESSING',
      claim_token = p_claim_token,
      claimed_by = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id
  RETURNING o.* INTO v_row;

  RETURN QUERY SELECT 'CLAIMED'::TEXT, v_row.id, v_row.tenant_org_id, v_row.claim_token, v_row.status,
    v_row.scheduled_at, v_row.channel_code, v_row.recipient_address, v_row.recipient_user_id,
    v_row.rendered_subject, v_row.rendered_body, v_row.event_code, v_row.retry_count, v_row.max_retries,
    v_row.source_entity_type, v_row.source_entity_id, v_row.metadata;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ntf_worker_claim_one(p_tenant_org_id uuid, p_outbox_id uuid, p_claim_token uuid, p_worker_id text, p_lease_seconds integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_claim_one(p_tenant_org_id uuid, p_outbox_id uuid, p_claim_token uuid, p_worker_id text, p_lease_seconds integer) TO service_role;
