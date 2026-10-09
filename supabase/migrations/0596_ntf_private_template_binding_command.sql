-- ============================================================================
-- Migration: 0596_ntf_private_template_binding_command.sql
-- Purpose:   Add a service-role-only atomic command that defines the complete
--            immutable ordered binding set for a tenant-private provider
--            template revision.
-- Why:       A private provider template is route-eligible only when every
--            external parameter has a typed logical source or explicit static
--            value. Mapping must be tenant-bound, all-or-nothing, and
--            immutable so a later edit cannot silently change an active route.
-- Affected:  public.cmx_define_org_ntf_ptmpl_binds
-- Related:   0582_ntf_private_template_regs.sql,
--            0592_ntf_private_template_import_command.sql,
--            0593_ntf_private_account_credentials.sql
-- Security:  Browser roles cannot call this command. The trusted HQ service
--            authorizes the operator, supplies the declared tenant, and writes
--            the administrative audit event separately.
-- ============================================================================
BEGIN;

-- The complete JSON array makes binding creation atomic. It accepts first
-- definition only; a correction requires a newly imported private revision so
-- every route keeps the exact mapping evidence used for its approval decision.
CREATE OR REPLACE FUNCTION public.cmx_define_org_ntf_ptmpl_binds(
  p_tenant_org_id UUID,
  p_revision_id UUID,
  p_bindings JSONB,
  p_actor TEXT,
  p_provenance TEXT
)
RETURNS TABLE (binding_count INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_count INTEGER;
  v_template_version_id UUID;
  v_received_count INTEGER;
  v_distinct_position_count INTEGER;
BEGIN
  IF p_tenant_org_id IS NULL
     OR p_revision_id IS NULL
     OR jsonb_typeof(p_bindings) <> 'array' THEN
    RAISE EXCEPTION 'Tenant, provider revision, and JSON binding array are required'
      USING ERRCODE = '23514';
  END IF;

  -- Every tenant-owned source includes the caller-declared tenant because the
  -- service role bypasses RLS and this command remains the isolation boundary.
  SELECT revision.provider_param_count, locale.template_version_id
    INTO v_expected_count, v_template_version_id
  FROM org_ntf_ptrev_dtl revision
  JOIN org_ntf_ptreg_mst registration
    ON registration.id = revision.registration_id
   AND registration.tenant_org_id = p_tenant_org_id
  JOIN sys_ntf_tpl_locale_dtl locale
    ON locale.id = registration.locale_id
  WHERE revision.id = p_revision_id
    AND revision.tenant_org_id = p_tenant_org_id
    AND revision.is_active = true
    AND revision.rec_status = 1
    AND registration.current_revision_id = revision.id
    AND registration.is_active = true
    AND registration.rec_status = 1
    AND locale.is_active = true
    AND locale.rec_status = 1
  FOR UPDATE OF revision, registration;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Private provider revision is not the current active revision for this tenant registration'
      USING ERRCODE = '23514';
  END IF;

  -- Historical mappings are immutable. Re-import creates a new revision for a
  -- correction instead of mutating the evidence behind a route decision.
  IF EXISTS (
    SELECT 1
    FROM org_ntf_ptbind_dtl binding
    WHERE binding.tenant_org_id = p_tenant_org_id
      AND binding.revision_id = p_revision_id
  ) THEN
    RAISE EXCEPTION 'Private provider revision bindings are immutable once defined; import a new revision for corrections'
      USING ERRCODE = '23505';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT (component_position, parameter_position))
    INTO v_received_count, v_distinct_position_count
  FROM jsonb_to_recordset(p_bindings) AS binding(
    component_key TEXT,
    component_position INTEGER,
    parameter_position INTEGER,
    external_slot TEXT,
    variable_id UUID,
    static_value TEXT,
    format_spec JSONB,
    is_required BOOLEAN
  );

  IF v_received_count <> v_expected_count
     OR v_distinct_position_count <> v_received_count THEN
    RAISE EXCEPTION 'Binding count or ordered positions do not match the imported private provider parameter count'
      USING ERRCODE = '23514';
  END IF;

  -- Validate the complete set before inserting any row. A logical variable
  -- must be active and belong to the locale's exact template version; this
  -- blocks cross-template substitution and executable binding expressions.
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_bindings) AS binding(
      component_key TEXT, component_position INTEGER, parameter_position INTEGER,
      external_slot TEXT, variable_id UUID, static_value TEXT, format_spec JSONB,
      is_required BOOLEAN
    )
    LEFT JOIN sys_ntf_tpl_var_dtl variable
      ON variable.id = binding.variable_id
     AND variable.template_version_id = v_template_version_id
     AND variable.is_active = true
     AND variable.rec_status = 1
    WHERE NULLIF(btrim(binding.component_key), '') IS NULL
       OR binding.component_position IS NULL OR binding.component_position <= 0
       OR binding.parameter_position IS NULL OR binding.parameter_position <= 0
       OR NULLIF(btrim(binding.external_slot), '') IS NULL
       OR (binding.format_spec IS NOT NULL AND jsonb_typeof(binding.format_spec) <> 'object')
       OR ((binding.variable_id IS NULL) = (NULLIF(binding.static_value, '') IS NULL))
       OR (binding.variable_id IS NOT NULL AND variable.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Private provider binding is incomplete, ambiguous, or references a variable outside the locale template version'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO org_ntf_ptbind_dtl (
    tenant_org_id, revision_id, component_key, component_position,
    parameter_position, external_slot, variable_id, static_value,
    format_spec, is_required, created_by, created_info
  )
  SELECT
    p_tenant_org_id,
    p_revision_id,
    binding.component_key,
    binding.component_position,
    binding.parameter_position,
    binding.external_slot,
    binding.variable_id,
    NULLIF(binding.static_value, ''),
    COALESCE(binding.format_spec, '{}'::jsonb),
    COALESCE(binding.is_required, true),
    p_actor,
    p_provenance
  FROM jsonb_to_recordset(p_bindings) AS binding(
    component_key TEXT, component_position INTEGER, parameter_position INTEGER,
    external_slot TEXT, variable_id UUID, static_value TEXT, format_spec JSONB,
    is_required BOOLEAN
  );

  RETURN QUERY SELECT v_received_count;
END;
$$;
COMMENT ON FUNCTION public.cmx_define_org_ntf_ptmpl_binds(UUID, UUID, JSONB, TEXT, TEXT) IS 'Atomically defines the one immutable complete ordered variable/static binding set for the current active tenant-private provider-template revision. Every tenant-owned access uses the declared tenant; only service_role may execute it.';

-- The browser must not directly map provider slots or create evidence that a
-- route activation could trust. Only the HQ connector may call this command
-- after authenticating the operator and validating the connector snapshot.
REVOKE ALL ON FUNCTION public.cmx_define_org_ntf_ptmpl_binds(UUID, UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cmx_define_org_ntf_ptmpl_binds(UUID, UUID, JSONB, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cmx_define_org_ntf_ptmpl_binds(UUID, UUID, JSONB, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cmx_define_org_ntf_ptmpl_binds(UUID, UUID, JSONB, TEXT, TEXT) TO service_role;

COMMIT;
