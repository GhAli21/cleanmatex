-- Migration: Order Edit Feature Flags & Settings
-- Description: Adds multi-level feature flags for order editing (global, tenant, branch)
-- PRD: Edit Order Feature - Phase 1 - Feature Flag Control
-- Date: 2026-03-07

-- Add allow_order_edit column to sys_branches_mst (branch-level override)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sys_branches_mst'
    AND column_name = 'allow_order_edit'
  ) THEN
    ALTER TABLE sys_branches_mst
    ADD COLUMN allow_order_edit BOOLEAN DEFAULT FALSE;

    COMMENT ON COLUMN sys_branches_mst.allow_order_edit IS
      'Branch-level override for order edit feature. ' ||
      'If NULL, inherits from tenant setting. If FALSE, blocks editing even if tenant allows it. ' ||
      'Example: Main branch allows editing, satellite branches don''t.';
  END IF;
END $$;

-- Insert tenant setting for allow_edit_order_enabled if not exists
INSERT INTO sys_tenant_settings (
  tenant_org_id,
  setting_key,
  setting_value,
  setting_type,
  setting_category,
  setting_description,
  is_public,
  is_editable,
  created_at,
  created_by
)
SELECT
  t.id as tenant_org_id,
  'allow_edit_order_enabled' as setting_key,
  'false' as setting_value,
  'boolean' as setting_type,
  'orders' as setting_category,
  'Allow users to edit orders that have not started processing (DRAFT, INTAKE, PREPARATION). Requires global feature flag FEATURE_EDIT_ORDER_ENABLED=true. Can be overridden per-branch via sys_branches_mst.allow_order_edit.' as setting_description,
  FALSE as is_public,
  TRUE as is_editable,
  NOW() as created_at,
  'system' as created_by
FROM sys_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM sys_tenant_settings
  WHERE tenant_org_id = t.id
  AND setting_key = 'allow_edit_order_enabled'
)
ON CONFLICT (tenant_org_id, setting_key) DO NOTHING;

-- Function to check if order editing is enabled (multi-level check)
CREATE OR REPLACE FUNCTION can_edit_orders_feature(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  global_enabled BOOLEAN;
  tenant_enabled BOOLEAN;
  branch_setting BOOLEAN;
BEGIN
  -- 1. Check global environment variable (set via Supabase secrets/environment)
  -- Note: This is a placeholder - actual check would be done in application code
  -- For database function, we assume global is enabled if we reach here
  global_enabled := TRUE;

  -- 2. Check tenant setting
  SELECT
    CASE
      WHEN setting_value = 'true' THEN TRUE
      ELSE FALSE
    END
  INTO tenant_enabled
  FROM sys_tenant_settings
  WHERE tenant_org_id = p_tenant_id
    AND setting_key = 'allow_edit_order_enabled';

  -- If tenant setting not found or disabled, return FALSE
  IF tenant_enabled IS NULL OR tenant_enabled = FALSE THEN
    RETURN FALSE;
  END IF;

  -- 3. Check branch override (if branch_id provided)
  IF p_branch_id IS NOT NULL THEN
    SELECT allow_order_edit
    INTO branch_setting
    FROM sys_branches_mst
    WHERE id = p_branch_id
      AND tenant_org_id = p_tenant_id;

    -- If branch explicitly disables, return FALSE
    IF branch_setting = FALSE THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- All checks passed
  RETURN TRUE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_edit_orders_feature(UUID, UUID) TO authenticated;

-- Function to get feature flag status with details
CREATE OR REPLACE FUNCTION get_order_edit_feature_status(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  global_enabled BOOLEAN,
  tenant_enabled BOOLEAN,
  branch_setting BOOLEAN,
  can_edit BOOLEAN,
  disabled_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_enabled BOOLEAN;
  v_branch_setting BOOLEAN;
  v_can_edit BOOLEAN;
  v_reason TEXT;
BEGIN
  -- Global check (placeholder)
  global_enabled := TRUE;

  -- Tenant check
  SELECT
    CASE
      WHEN setting_value = 'true' THEN TRUE
      ELSE FALSE
    END
  INTO v_tenant_enabled
  FROM sys_tenant_settings
  WHERE tenant_org_id = p_tenant_id
    AND setting_key = 'allow_edit_order_enabled';

  IF v_tenant_enabled IS NULL THEN
    v_tenant_enabled := FALSE;
    v_reason := 'Tenant setting not found';
  ELSIF v_tenant_enabled = FALSE THEN
    v_reason := 'Disabled at tenant level';
  END IF;

  tenant_enabled := COALESCE(v_tenant_enabled, FALSE);

  -- Branch check
  IF p_branch_id IS NOT NULL THEN
    SELECT allow_order_edit
    INTO v_branch_setting
    FROM sys_branches_mst
    WHERE id = p_branch_id
      AND tenant_org_id = p_tenant_id;

    IF v_branch_setting = FALSE THEN
      v_reason := 'Disabled at branch level';
    END IF;
  END IF;

  branch_setting := v_branch_setting;

  -- Final determination
  v_can_edit := can_edit_orders_feature(p_tenant_id, p_branch_id);
  can_edit := v_can_edit;

  IF v_can_edit = FALSE AND v_reason IS NULL THEN
    v_reason := 'Unknown reason';
  ELSIF v_can_edit = TRUE THEN
    v_reason := NULL;
  END IF;

  disabled_reason := v_reason;

  RETURN NEXT;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_order_edit_feature_status(UUID, UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION can_edit_orders_feature(UUID, UUID) IS
  'Checks if order editing feature is enabled for a tenant/branch. ' ||
  'Resolution order: global → tenant → branch. ' ||
  'Returns TRUE only if all applicable levels allow editing.';

COMMENT ON FUNCTION get_order_edit_feature_status(UUID, UUID) IS
  'Returns detailed feature flag status with reason if disabled. ' ||
  'Useful for debugging and showing user-friendly messages.';

-- Create index on allow_order_edit for performance
CREATE INDEX IF NOT EXISTS idx_branches_allow_order_edit
  ON sys_branches_mst(tenant_org_id, allow_order_edit)
  WHERE allow_order_edit IS NOT NULL;
