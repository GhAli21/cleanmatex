-- ============================================================================
-- Migration: 0586_ntf_platform_template_import_command.sql
-- Purpose:   Provide one service-role-only, atomic command for recording an
--            authenticated provider-template observation as an immutable
--            platform revision and selecting it as the current revision.
-- Why:       PostgREST calls are independent transactions. Importing the
--            mutable registration projection, revision, and current pointer in
--            separate calls could leave an approval record half committed.
-- Scope:     Platform-owned sys_ntf_prov_tmpl_* records only. Tenant-private
--            imports need their own tenant-scoped command in a later slice.
-- Security:  The caller must be a trusted server connector. Browser roles are
--            explicitly denied execution; credentials remain in the vault and
--            never cross this function boundary.
-- ============================================================================
BEGIN;

-- A trusted connector submits only a redacted, normalized observation after it
-- has fetched it with the account's opaque vault credential reference. The
-- command serializes imports for one registration row, creates a new immutable
-- revision on every authenticated observation, and changes the mutable current
-- pointer only after that insert succeeds.
CREATE OR REPLACE FUNCTION public.cmx_import_sys_ntf_prov_tmpl(
  p_account_id UUID,
  p_sender_id UUID,
  p_locale_id UUID,
  p_registration_key TEXT,
  p_external_name TEXT,
  p_external_template_id TEXT,
  p_provider_language_code TEXT,
  p_content_type_code TEXT,
  p_category_code TEXT,
  p_observed_status TEXT,
  p_observed_status_raw TEXT,
  p_observed_at TIMESTAMPTZ,
  p_approval_fresh_until TIMESTAMPTZ,
  p_rejection_code TEXT,
  p_rejection_reason TEXT,
  p_observation_evidence JSONB,
  p_provider_status_at_import TEXT,
  p_provider_status_raw TEXT,
  p_external_revision_id TEXT,
  p_content_sid TEXT,
  p_provider_content_hash TEXT,
  p_provider_snapshot JSONB,
  p_approval_evidence JSONB,
  p_rejection_evidence JSONB,
  p_submitted_at TIMESTAMPTZ,
  p_verified_at TIMESTAMPTZ,
  p_valid_until_at_import TIMESTAMPTZ,
  p_unique_var_count INTEGER,
  p_occurrence_count INTEGER,
  p_provider_param_count INTEGER,
  p_actor TEXT,
  p_provenance TEXT
)
RETURNS TABLE (registration_id UUID, revision_id UUID, revision_no INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registration sys_ntf_prov_tmpl_reg_mst%ROWTYPE;
  v_revision_id UUID;
  v_revision_no INTEGER;
BEGIN
  -- Import is permitted only for a live, verified platform account. This is a
  -- second-line check after the connector's vault lookup and prevents a stale
  -- browser/API command from creating approval records for retired accounts.
  IF NOT EXISTS (
    SELECT 1
    FROM sys_ntf_prov_acct_mst account
    WHERE account.id = p_account_id
      AND account.is_active = true
      AND account.rec_status = 1
      AND account.verification_state = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'Platform provider account % is not active and verified', p_account_id
      USING ERRCODE = '23514';
  END IF;

  -- An optional sender must belong to this exact platform account and be safe
  -- for future use. The registration can intentionally be account-wide when
  -- the provider approval is not sender-specific.
  IF p_sender_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM sys_ntf_prov_send_mst sender
    WHERE sender.id = p_sender_id
      AND sender.account_id = p_account_id
      AND sender.is_active = true
      AND sender.rec_status = 1
      AND sender.verification_state = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'Platform sender % is not active, verified, or owned by account %', p_sender_id, p_account_id
      USING ERRCODE = '23514';
  END IF;

  -- Reject malformed trusted payloads before they can produce a confusing
  -- immutable audit record. JSONB values are already structured, but null is
  -- not a valid evidence/snapshot document for this command.
  IF NULLIF(btrim(p_registration_key), '') IS NULL
     OR NULLIF(btrim(p_external_name), '') IS NULL
     OR NULLIF(btrim(p_provider_language_code), '') IS NULL
     OR NULLIF(btrim(p_content_type_code), '') IS NULL
     OR NULLIF(btrim(p_observed_status_raw), '') IS NULL
     OR NULLIF(btrim(p_provider_status_raw), '') IS NULL
     OR NULLIF(btrim(p_provider_content_hash), '') IS NULL
     OR p_observation_evidence IS NULL
     OR p_provider_snapshot IS NULL
     OR p_approval_evidence IS NULL
     OR p_unique_var_count < 0
     OR p_occurrence_count < 0
     OR p_provider_param_count < 0
  THEN
    RAISE EXCEPTION 'Provider-template import payload is incomplete or invalid'
      USING ERRCODE = '23514';
  END IF;

  -- The account-local administrative key is immutable for locking and
  -- idempotent routing of imports. SELECT FOR UPDATE serializes concurrently
  -- requested refreshes without requiring an unsafe read-max-write sequence.
  SELECT * INTO v_registration
  FROM sys_ntf_prov_tmpl_reg_mst registration
  WHERE registration.account_id = p_account_id
    AND registration.registration_key = p_registration_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO sys_ntf_prov_tmpl_reg_mst (
      account_id, sender_id, locale_id, registration_key, external_name,
      external_template_id, provider_language_code, content_type_code,
      category_code, observed_status, observed_status_raw, observed_at,
      approval_fresh_until, rejection_code, rejection_reason,
      observation_evidence, created_by, created_info, updated_by, updated_info
    ) VALUES (
      p_account_id, p_sender_id, p_locale_id, p_registration_key, p_external_name,
      p_external_template_id, p_provider_language_code, p_content_type_code,
      p_category_code, p_observed_status, p_observed_status_raw,
      COALESCE(p_observed_at, NOW()), p_approval_fresh_until, p_rejection_code,
      p_rejection_reason, p_observation_evidence, p_actor, p_provenance,
      p_actor, p_provenance
    )
    RETURNING * INTO v_registration;
  ELSE
    UPDATE sys_ntf_prov_tmpl_reg_mst
    SET sender_id = p_sender_id,
        locale_id = p_locale_id,
        external_name = p_external_name,
        external_template_id = p_external_template_id,
        provider_language_code = p_provider_language_code,
        content_type_code = p_content_type_code,
        category_code = p_category_code,
        observed_status = p_observed_status,
        observed_status_raw = p_observed_status_raw,
        observed_at = COALESCE(p_observed_at, NOW()),
        approval_fresh_until = p_approval_fresh_until,
        rejection_code = p_rejection_code,
        rejection_reason = p_rejection_reason,
        observation_evidence = p_observation_evidence,
        updated_at = NOW(),
        updated_by = p_actor,
        updated_info = p_provenance
    WHERE id = v_registration.id
    RETURNING * INTO v_registration;
  END IF;

  SELECT COALESCE(MAX(revision.revision_no), 0) + 1
    INTO v_revision_no
  FROM sys_ntf_prov_tmpl_rev_dtl revision
  WHERE revision.registration_id = v_registration.id;

  INSERT INTO sys_ntf_prov_tmpl_rev_dtl (
    registration_id, revision_no, provider_status_at_import,
    provider_status_raw, external_revision_id, content_sid,
    provider_content_hash, provider_snapshot, approval_evidence,
    rejection_evidence, submitted_at, verified_at, valid_until_at_import,
    unique_var_count, occurrence_count, provider_param_count, created_by,
    created_info
  ) VALUES (
    v_registration.id, v_revision_no, p_provider_status_at_import,
    p_provider_status_raw, p_external_revision_id, p_content_sid,
    p_provider_content_hash, p_provider_snapshot, p_approval_evidence,
    p_rejection_evidence, p_submitted_at, p_verified_at,
    p_valid_until_at_import, p_unique_var_count, p_occurrence_count,
    p_provider_param_count, p_actor, p_provenance
  )
  RETURNING id INTO v_revision_id;

  UPDATE sys_ntf_prov_tmpl_reg_mst
  SET current_revision_id = v_revision_id,
      updated_at = NOW(),
      updated_by = p_actor,
      updated_info = p_provenance
  WHERE id = v_registration.id;

  RETURN QUERY SELECT v_registration.id, v_revision_id, v_revision_no;
END;
$$;
COMMENT ON FUNCTION public.cmx_import_sys_ntf_prov_tmpl(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) IS 'Atomically imports one redacted server-authenticated platform provider-template observation, creates an immutable revision, and advances the current revision pointer. Browser roles cannot execute it.';

-- Provider snapshots/evidence are trusted connector inputs only. Explicit
-- revokes prevent a logged-in HQ browser from fabricating an approved status,
-- Content SID, or provider evidence by calling the RPC directly.
REVOKE ALL ON FUNCTION public.cmx_import_sys_ntf_prov_tmpl(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cmx_import_sys_ntf_prov_tmpl(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cmx_import_sys_ntf_prov_tmpl(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cmx_import_sys_ntf_prov_tmpl(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO service_role;

COMMIT;
