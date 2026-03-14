-- hq_ff_get_plan_defaults: Resolve feature flags for a plan (no tenant)
-- Used for plan comparison UI. Source: hq_ff_feature_flags_mst + sys_ff_pln_flag_mappings_dtl

CREATE OR REPLACE FUNCTION hq_ff_get_plan_defaults(
  p_plan_code VARCHAR,
  p_flag_keys TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_keys TEXT[];
  v_row RECORD;
  v_value JSONB;
  v_mapping RECORD;
  v_flag_key TEXT;
BEGIN
  IF p_plan_code IS NULL OR p_plan_code = '' THEN
    RETURN v_result;
  END IF;

  IF p_flag_keys IS NULL OR array_length(p_flag_keys, 1) IS NULL THEN
    SELECT COALESCE(array_agg(f.flag_key), ARRAY[]::TEXT[])
    INTO v_keys
    FROM hq_ff_feature_flags_mst f
    WHERE f.is_active = true;
  ELSE
    v_keys := p_flag_keys;
  END IF;

  FOR v_row IN
    SELECT f.flag_key, f.default_value, f.plan_binding_type, f.enabled_plan_codes
    FROM hq_ff_feature_flags_mst f
    WHERE f.is_active = true
      AND f.flag_key = ANY(v_keys)
  LOOP
    v_value := v_row.default_value;

    IF v_row.plan_binding_type = 'plan_bound' THEN
      SELECT m.plan_specific_value, m.is_enabled INTO v_mapping
      FROM sys_ff_pln_flag_mappings_dtl m
      WHERE m.plan_code = p_plan_code
        AND m.flag_key = v_row.flag_key
        AND m.is_active = true
      LIMIT 1;

      IF FOUND AND v_mapping.is_enabled THEN
        v_value := COALESCE(v_mapping.plan_specific_value, v_row.default_value);
      ELSIF v_row.enabled_plan_codes IS NOT NULL AND
            p_plan_code = ANY(SELECT jsonb_array_elements_text(v_row.enabled_plan_codes)) THEN
        v_value := v_row.default_value;
      ELSE
        v_value := to_jsonb(false);
      END IF;
    END IF;

    v_result := v_result || jsonb_build_object(v_row.flag_key, v_value);
  END LOOP;

  -- Add false for keys in p_flag_keys not found in hq_ff
  FOREACH v_flag_key IN ARRAY v_keys
  LOOP
    IF NOT (v_result ? v_flag_key) THEN
      v_result := v_result || jsonb_build_object(v_flag_key, to_jsonb(false));
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION hq_ff_get_plan_defaults IS
  'Returns plan-level feature flag values (no tenant overrides). Used for plan comparison UI.';
