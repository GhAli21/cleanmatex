-- Fix: column reference "plan_code" is ambiguous in hq_ff_get_effective_value
-- The RETURNS TABLE(plan_code VARCHAR) creates an implicit variable that conflicts
-- with table columns. Qualify all column references with table aliases.

CREATE OR REPLACE FUNCTION hq_ff_get_effective_value(
  p_tenant_id UUID,
  p_flag_key VARCHAR
)
RETURNS TABLE(
  value JSONB,
  source VARCHAR,
  override_id UUID,
  plan_code VARCHAR,
  plan_specific BOOLEAN
) AS $$
DECLARE
  v_flag RECORD;
  v_override RECORD;
  v_subscription RECORD;
  v_plan_mapping RECORD;
BEGIN
  -- Get flag definition
  SELECT * INTO v_flag
  FROM hq_ff_feature_flags_mst f
  WHERE f.flag_key = p_flag_key AND f.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag % not found', p_flag_key;
  END IF;

  -- 1. Check for active tenant override (highest priority)
  SELECT * INTO v_override
  FROM org_ff_overrides_cf o
  WHERE o.tenant_org_id = p_tenant_id
    AND o.flag_key = p_flag_key
    AND o.is_active = true
    AND o.approval_status = 'approved'
    AND (o.effective_from IS NULL OR o.effective_from <= CURRENT_TIMESTAMP)
    AND (o.effective_until IS NULL OR o.effective_until >= CURRENT_TIMESTAMP)
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_override.override_value, 'override'::VARCHAR, v_override.id, NULL::VARCHAR, false;
    RETURN;
  END IF;

  -- 2. If plan-bound, check tenant's subscription plan
  IF v_flag.plan_binding_type = 'plan_bound' THEN
    SELECT * INTO v_subscription
    FROM org_pln_subscriptions_mst s
    WHERE s.tenant_org_id = p_tenant_id
      AND s.is_active = true
      AND s.status IN ('trial', 'active')
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- 2a. Check for plan-specific value in mapping table (qualify plan_code to avoid ambiguity)
      SELECT * INTO v_plan_mapping
      FROM sys_ff_pln_flag_mappings_dtl m
      WHERE m.plan_code = v_subscription.plan_code
        AND m.flag_key = p_flag_key
        AND m.is_enabled = true
        AND m.is_active = true;

      IF FOUND AND v_plan_mapping.plan_specific_value IS NOT NULL THEN
        RETURN QUERY SELECT v_plan_mapping.plan_specific_value, 'plan_specific'::VARCHAR, NULL::UUID, v_subscription.plan_code, true;
        RETURN;
      ELSIF FOUND THEN
        RETURN QUERY SELECT v_flag.default_value, 'plan'::VARCHAR, NULL::UUID, v_subscription.plan_code, false;
        RETURN;
      END IF;

      -- 2b. Fallback: Check enabled_plan_codes JSONB (backward compatibility)
      IF v_subscription.plan_code = ANY(SELECT jsonb_array_elements_text(v_flag.enabled_plan_codes)) THEN
        RETURN QUERY SELECT v_flag.default_value, 'plan'::VARCHAR, NULL::UUID, v_subscription.plan_code, false;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 3. Return default value
  RETURN QUERY SELECT v_flag.default_value, 'default'::VARCHAR, NULL::UUID, NULL::VARCHAR, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION hq_ff_get_effective_value IS 'Evaluates effective feature flag value: override > plan_specific > plan > default';
