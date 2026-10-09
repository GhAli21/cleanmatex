-- ============================================================================
-- Migration: 0588_ntf_platform_template_binding_command.sql
-- Purpose:   Add a service-role-only atomic command that defines the complete
--            ordered binding set for one imported platform provider revision.
-- Why:       Bindings are part of the approved external-template contract.
--            They must be all-or-nothing and immutable after definition so a
--            later administrative edit cannot silently change an active route.
-- Security:  Browser roles cannot call this function. The HQ service validates
--            operator permission and writes the human audit event separately.
-- ============================================================================
BEGIN;

-- The function accepts a complete JSON array rather than one mutable binding at
-- a time. It permits first definition only; a correction requires a newly
-- imported provider revision, preserving the original approval/binding trail.
CREATE OR REPLACE FUNCTION public.cmx_define_sys_ntf_prov_tmpl_bindings(
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
  IF jsonb_typeof(p_bindings) <> 'array' THEN
    RAISE EXCEPTION 'Provider bindings must be a JSON array' USING ERRCODE = '23514';
  END IF;

  -- A binding set is valid only for the current imported revision. This makes
  -- the registration pointer the explicit approval/version boundary.
  SELECT revision.provider_param_count, locale.template_version_id
    INTO v_expected_count, v_template_version_id
  FROM sys_ntf_prov_tmpl_rev_dtl revision
  JOIN sys_ntf_prov_tmpl_reg_mst registration
    ON registration.id = revision.registration_id
  JOIN sys_ntf_tpl_locale_dtl locale
    ON locale.id = registration.locale_id
  WHERE revision.id = p_revision_id
    AND revision.is_active = true
    AND revision.rec_status = 1
    AND registration.current_revision_id = revision.id
    AND registration.is_active = true
    AND registration.rec_status = 1
    AND locale.is_active = true
    AND locale.rec_status = 1
  FOR UPDATE OF revision, registration;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider revision is not the current active revision for an active registration'
      USING ERRCODE = '23514';
  END IF;

  -- Existing rows are never edited or deleted. Re-importing the provider
  -- content creates a new revision for a corrected mapping.
  IF EXISTS (
    SELECT 1 FROM sys_ntf_prov_tmpl_bind_dtl binding
    WHERE binding.revision_id = p_revision_id
  ) THEN
    RAISE EXCEPTION 'Provider revision bindings are immutable once defined; import a new revision for corrections'
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
    RAISE EXCEPTION 'Binding count or ordered positions do not match the imported provider parameter count'
      USING ERRCODE = '23514';
  END IF;

  -- Validate every supplied binding before inserting any row. Variables must
  -- belong to the exact logical template version represented by the imported
  -- locale; this prevents cross-template variable substitution.
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
       OR binding.format_spec IS NOT NULL AND jsonb_typeof(binding.format_spec) <> 'object'
       OR ((binding.variable_id IS NULL) = (NULLIF(binding.static_value, '') IS NULL))
       OR (binding.variable_id IS NOT NULL AND variable.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Provider binding is incomplete, ambiguous, or references a variable outside the locale template version'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO sys_ntf_prov_tmpl_bind_dtl (
    revision_id, component_key, component_position, parameter_position,
    external_slot, variable_id, static_value, format_spec, is_required,
    created_by, created_info
  )
  SELECT
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
COMMENT ON FUNCTION public.cmx_define_sys_ntf_prov_tmpl_bindings(UUID, JSONB, TEXT, TEXT) IS 'Atomically defines the one immutable complete ordered variable/static binding set for the current active platform provider-template revision. Only service_role may execute it.';

-- Provider binding definitions must be created by the trusted service after it
-- verifies operator authorization. This prevents direct browser RPC calls from
-- mapping arbitrary logical variables to approved external template slots.
REVOKE ALL ON FUNCTION public.cmx_define_sys_ntf_prov_tmpl_bindings(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cmx_define_sys_ntf_prov_tmpl_bindings(UUID, JSONB, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cmx_define_sys_ntf_prov_tmpl_bindings(UUID, JSONB, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cmx_define_sys_ntf_prov_tmpl_bindings(UUID, JSONB, TEXT, TEXT) TO service_role;

COMMIT;
