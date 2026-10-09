-- ============================================================================
-- Migration: 0592_ntf_private_template_import_command.sql
-- Purpose:   Provide one service-role-only, tenant-scoped atomic command for
--            recording an authenticated private provider-template observation.
-- Affected:  public.cmx_import_org_ntf_prov_tmpl
-- Related:   0582_ntf_private_template_regs.sql,
--            0586_ntf_platform_template_import_command.sql
-- Security:  The caller is a trusted server connector. Browser roles cannot
--            submit provider evidence, credentials, or approval state directly.
-- ============================================================================
BEGIN;

-- Private provider content must be committed as one registration/revision
-- transition. Separate browser-visible writes could advance a route candidate
-- without its immutable approval evidence or cross a tenant boundary.
CREATE OR REPLACE FUNCTION public.cmx_import_org_ntf_prov_tmpl(
  p_tenant_org_id UUID,
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
  v_registration org_ntf_ptreg_mst%ROWTYPE;
  v_revision_id UUID;
  v_revision_no INTEGER;
BEGIN
  -- Every source lookup includes the declared tenant. Service-role execution
  -- bypasses RLS, so the command itself remains the tenant-isolation boundary.
  IF p_tenant_org_id IS NULL
     OR NULLIF(btrim(p_registration_key), '') IS NULL
     OR NULLIF(btrim(p_external_name), '') IS NULL
     OR NULLIF(btrim(p_provider_language_code), '') IS NULL
     OR NULLIF(btrim(p_content_type_code), '') IS NULL
     OR NULLIF(btrim(p_observed_status_raw), '') IS NULL
     OR NULLIF(btrim(p_provider_status_raw), '') IS NULL
     OR NULLIF(btrim(p_provider_content_hash), '') IS NULL
     OR p_observed_status IS NULL
     OR p_observed_status NOT IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'EXPIRED', 'RETIRED')
     OR p_observation_evidence IS NULL
     OR p_provider_snapshot IS NULL
     OR p_approval_evidence IS NULL
     OR p_unique_var_count < 0
     OR p_occurrence_count < 0
     OR p_provider_param_count < 0
  THEN
    RAISE EXCEPTION 'Private provider-template import payload is incomplete or invalid'
      USING ERRCODE = '23514';
  END IF;

  -- The private account must be active, verified, and owned by this tenant.
  IF NOT EXISTS (
    SELECT 1
    FROM org_ntf_prov_acct_mst account
    WHERE account.id = p_account_id
      AND account.tenant_org_id = p_tenant_org_id
      AND account.is_active = true
      AND account.rec_status = 1
      AND account.verification_state = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'Private provider account is not active, verified, or owned by this tenant'
      USING ERRCODE = '23514';
  END IF;

  -- An optional sender stays bound to the selected tenant account; account-wide
  -- approval remains valid when a provider has no sender-specific approval.
  IF p_sender_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM org_ntf_prov_send_mst sender
    WHERE sender.id = p_sender_id
      AND sender.tenant_org_id = p_tenant_org_id
      AND sender.account_id = p_account_id
      AND sender.is_active = true
      AND sender.rec_status = 1
      AND sender.verification_state = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'Private sender is not active, verified, owned by this tenant, or belongs to the account'
      USING ERRCODE = '23514';
  END IF;

  -- Locale is shared catalog data, but only active WhatsApp-compatible logical
  -- content can be represented by this provider registration.
  IF NOT EXISTS (
    SELECT 1
    FROM sys_ntf_tpl_locale_dtl locale
    WHERE locale.id = p_locale_id
      AND locale.channel_code = 'WHATSAPP'
      AND locale.is_active = true
      AND locale.rec_status = 1
  ) THEN
    RAISE EXCEPTION 'Private provider registration locale is not an active WhatsApp locale'
      USING ERRCODE = '23514';
  END IF;

  -- Lock the tenant/account-local administrative key so concurrent imports
  -- serialize revision numbering and current-pointer replacement.
  SELECT * INTO v_registration
  FROM org_ntf_ptreg_mst registration
  WHERE registration.tenant_org_id = p_tenant_org_id
    AND registration.account_id = p_account_id
    AND registration.registration_key = p_registration_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO org_ntf_ptreg_mst (
      tenant_org_id, account_id, sender_id, locale_id, registration_key,
      external_name, external_template_id, provider_language_code,
      content_type_code, category_code, observed_status, observed_status_raw,
      observed_at, approval_fresh_until, rejection_code, rejection_reason,
      observation_evidence, created_by, created_info, updated_by, updated_info
    ) VALUES (
      p_tenant_org_id, p_account_id, p_sender_id, p_locale_id, p_registration_key,
      p_external_name, p_external_template_id, p_provider_language_code,
      p_content_type_code, p_category_code, p_observed_status, p_observed_status_raw,
      COALESCE(p_observed_at, NOW()), p_approval_fresh_until, p_rejection_code,
      p_rejection_reason, p_observation_evidence, p_actor, p_provenance, p_actor, p_provenance
    ) RETURNING * INTO v_registration;
  ELSE
    UPDATE org_ntf_ptreg_mst
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
        updated_at = NOW(), updated_by = p_actor, updated_info = p_provenance
    WHERE id = v_registration.id
      AND tenant_org_id = p_tenant_org_id
    RETURNING * INTO v_registration;
  END IF;

  SELECT COALESCE(MAX(revision.revision_no), 0) + 1 INTO v_revision_no
  FROM org_ntf_ptrev_dtl revision
  WHERE revision.tenant_org_id = p_tenant_org_id
    AND revision.registration_id = v_registration.id;

  INSERT INTO org_ntf_ptrev_dtl (
    tenant_org_id, registration_id, revision_no, provider_status_at_import,
    provider_status_raw, external_revision_id, content_sid, provider_content_hash,
    provider_snapshot, approval_evidence, rejection_evidence, submitted_at,
    verified_at, valid_until_at_import, unique_var_count, occurrence_count,
    provider_param_count, created_by, created_info
  ) VALUES (
    p_tenant_org_id, v_registration.id, v_revision_no, p_provider_status_at_import,
    p_provider_status_raw, p_external_revision_id, p_content_sid, p_provider_content_hash,
    p_provider_snapshot, p_approval_evidence, p_rejection_evidence, p_submitted_at,
    p_verified_at, p_valid_until_at_import, p_unique_var_count, p_occurrence_count,
    p_provider_param_count, p_actor, p_provenance
  ) RETURNING id INTO v_revision_id;

  UPDATE org_ntf_ptreg_mst
  SET current_revision_id = v_revision_id,
      updated_at = NOW(), updated_by = p_actor, updated_info = p_provenance
  WHERE id = v_registration.id
    AND tenant_org_id = p_tenant_org_id;

  RETURN QUERY SELECT v_registration.id, v_revision_id, v_revision_no;
END;
$$;
COMMENT ON FUNCTION public.cmx_import_org_ntf_prov_tmpl(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) IS 'Atomically imports one redacted server-authenticated tenant-private WhatsApp provider-template observation, creates an immutable revision, and advances the current revision pointer only within the declared tenant.';

-- Browser roles must not fabricate provider snapshots or approve private content
-- through direct RPC calls. The service-role connector has already authenticated
-- against the tenant-owned provider account and passes only redacted evidence.
REVOKE ALL ON FUNCTION public.cmx_import_org_ntf_prov_tmpl(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cmx_import_org_ntf_prov_tmpl(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cmx_import_org_ntf_prov_tmpl(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cmx_import_org_ntf_prov_tmpl(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO service_role;

COMMIT;
