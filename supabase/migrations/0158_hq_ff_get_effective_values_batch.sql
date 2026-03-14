-- hq_ff_get_effective_values_batch: Resolve multiple feature flags for a tenant in one call
-- Source of truth: hq_ff_feature_flags_mst + sys_ff_pln_flag_mappings_dtl + org_ff_overrides_cf
-- Resolution: override > plan_specific > plan > default

CREATE OR REPLACE FUNCTION hq_ff_get_effective_values_batch(
  p_tenant_id UUID,
  p_flag_keys TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_flag_key TEXT;
  v_value JSONB;
  v_keys TEXT[];
BEGIN
  -- Resolve which keys to evaluate
  IF p_flag_keys IS NULL OR array_length(p_flag_keys, 1) IS NULL THEN
    SELECT COALESCE(array_agg(f.flag_key), ARRAY[]::TEXT[])
    INTO v_keys
    FROM hq_ff_feature_flags_mst f
    WHERE f.is_active = true;
  ELSE
    v_keys := p_flag_keys;
  END IF;

  -- Evaluate each flag
  FOREACH v_flag_key IN ARRAY v_keys
  LOOP
    BEGIN
      SELECT f.value INTO v_value
      FROM hq_ff_get_effective_value(p_tenant_id, v_flag_key) f
      LIMIT 1;
      v_result := v_result || jsonb_build_object(v_flag_key, v_value);
    EXCEPTION
      WHEN OTHERS THEN
        v_result := v_result || jsonb_build_object(v_flag_key, to_jsonb(false));
    END;
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION hq_ff_get_effective_values_batch IS
  'Returns effective values for multiple feature flags. Keys not in hq_ff_feature_flags_mst default to false. Pass NULL for all active flags.';
