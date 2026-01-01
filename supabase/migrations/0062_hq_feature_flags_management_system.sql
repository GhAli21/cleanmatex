-- =====================================================
-- Migration: Feature Flag Management System
-- PRD: Feature Flag Management for CleanMateX Platform HQ
-- Date: 2025-12-27
-- Description: Complete feature flag management system including:
--              - Global feature flag definitions (hq_feature_flags_mst)
--              - Tenant-specific overrides (org_ff_overrides_cf)
--              - Plan-flag relationships (sys_pln_flag_mappings_dtl)
--              - Audit trail (hq_ff_audit_history_tr)
--              - Evaluation and validation functions
-- =====================================================

-- =====================================================
-- 1. GLOBAL FEATURE FLAG DEFINITIONS
-- =====================================================

CREATE TABLE hq_feature_flags_mst (
  -- Identification
  flag_key VARCHAR(100) PRIMARY KEY,
  flag_name TEXT NOT NULL,
  flag_name2 TEXT,
  flag_description TEXT,
  flag_description2 TEXT,

  -- Governance Categorization
  governance_category VARCHAR(50) NOT NULL,
  CHECK (governance_category IN ('tenant_feature', 'tenant_limit', 'hq_feature', 'hq_config', 'experimental', 'beta')),

  is_billable BOOLEAN NOT NULL DEFAULT false,
  is_kill_switch BOOLEAN NOT NULL DEFAULT false,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,

  -- Validation (optional but recommended)
  allowed_values JSONB NULL,
  min_value NUMERIC NULL,
  max_value NUMERIC NULL,
  json_schema JSONB NULL,

  -- Data type & validation
  data_type VARCHAR(20) NOT NULL,
  CHECK (data_type IN ('boolean', 'integer', 'float', 'string', 'date', 'datetime', 'object', 'array', 'number')),
  default_value JSONB NOT NULL,
  validation_rules JSONB,

  -- Plan integration
  plan_binding_type VARCHAR(20) NOT NULL DEFAULT 'independent',
  CHECK (plan_binding_type IN ('plan_bound', 'independent')),
  enabled_plan_codes JSONB DEFAULT '[]'::jsonb,

  -- Override control
  allows_tenant_override BOOLEAN DEFAULT true,
  override_requires_approval BOOLEAN DEFAULT false,

  -- UI organization
  ui_group VARCHAR(100),
  comp_code TEXT,
  ui_display_order INTEGER DEFAULT 0,
  ui_icon VARCHAR(120),
  ui_color VARCHAR(60),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Standard audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT
);

-- Indexes
CREATE INDEX idx_hq_ff_flags_active ON hq_feature_flags_mst(is_active, ui_display_order);
CREATE INDEX idx_hq_ff_flags_category ON hq_feature_flags_mst(governance_category);
CREATE INDEX idx_hq_ff_flags_plan_binding ON hq_feature_flags_mst(plan_binding_type);
CREATE INDEX idx_hq_ff_flags_group ON hq_feature_flags_mst(ui_group, ui_display_order);

-- Comments
COMMENT ON TABLE hq_feature_flags_mst IS 'Platform HQ - Global feature flag definitions';
COMMENT ON COLUMN hq_feature_flags_mst.validation_rules IS 'JSONB with type-specific constraints: {min, max, minLength, maxLength, pattern, schema}';
COMMENT ON COLUMN hq_feature_flags_mst.enabled_plan_codes IS 'For plan_bound flags: array of plan codes where flag is enabled';
COMMENT ON COLUMN hq_feature_flags_mst.is_billable IS 'Ties to plan/add-ons for billing';
COMMENT ON COLUMN hq_feature_flags_mst.is_kill_switch IS 'HQ platform override semantics';
COMMENT ON COLUMN hq_feature_flags_mst.is_sensitive IS 'Hide in tenant UI, HQ-only display';

-- =====================================================
-- 2. TENANT OVERRIDE CONFIGURATION
-- =====================================================

CREATE TABLE org_ff_overrides_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Flag reference (soft reference)
  flag_key VARCHAR(100) NOT NULL,

  -- Override value
  data_type VARCHAR(20) NOT NULL,
  override_value JSONB NOT NULL,
  override_reason TEXT,
  override_type VARCHAR(30) DEFAULT 'manual',
  CHECK (override_type IN ('manual', 'plan_upgrade', 'trial', 'promotional', 'support_request', 'migration')),

  -- Approval workflow
  approval_status VARCHAR(20) DEFAULT 'approved',
  CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by VARCHAR(120),
  approved_at TIMESTAMP,
  rejection_reason TEXT,

  -- Time-bounded overrides
  effective_from TIMESTAMP,
  effective_until TIMESTAMP,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Standard audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),

  -- Unique constraint: one active override per tenant per flag
  UNIQUE(tenant_org_id, flag_key, is_active)
);

-- Indexes
CREATE INDEX idx_org_ff_overrides_tenant ON org_ff_overrides_cf(tenant_org_id, is_active);
CREATE INDEX idx_org_ff_overrides_flag ON org_ff_overrides_cf(flag_key, is_active);
CREATE INDEX idx_org_ff_overrides_approval ON org_ff_overrides_cf(approval_status) WHERE approval_status = 'pending';
CREATE INDEX idx_org_ff_overrides_effective ON org_ff_overrides_cf(effective_from, effective_until);

-- Enable RLS
ALTER TABLE org_ff_overrides_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant override isolation" ON org_ff_overrides_cf
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- Comments
COMMENT ON TABLE org_ff_overrides_cf IS 'Tenant-specific feature flag overrides';
COMMENT ON COLUMN org_ff_overrides_cf.override_value IS 'JSONB value - must match flag data_type';
COMMENT ON COLUMN org_ff_overrides_cf.data_type IS 'Cached from flag for fast access';

-- =====================================================
-- 3. PLAN-FLAG RELATIONSHIPS
-- =====================================================

CREATE TABLE sys_pln_flag_mappings_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan reference
  plan_code VARCHAR(50) NOT NULL REFERENCES sys_pln_subscription_plans_mst(plan_code) ON DELETE CASCADE,

  -- Flag reference (soft reference to allow flag deletion)
  flag_key VARCHAR(100) NOT NULL,

  -- Flag-specific value for this plan (optional - overrides default_value)
  plan_specific_value JSONB,

  -- Metadata
  is_enabled BOOLEAN DEFAULT true,
  notes TEXT,

  -- Standard audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN DEFAULT true,

  -- Unique constraint: one mapping per plan-flag combination
  UNIQUE(plan_code, flag_key)
);

-- Indexes
CREATE INDEX idx_sys_pln_flag_mappings_plan ON sys_pln_flag_mappings_dtl(plan_code, is_enabled);
CREATE INDEX idx_sys_pln_flag_mappings_flag ON sys_pln_flag_mappings_dtl(flag_key, is_enabled);
CREATE INDEX idx_sys_pln_flag_mappings_active ON sys_pln_flag_mappings_dtl(is_active, is_enabled);

-- Comments
COMMENT ON TABLE sys_pln_flag_mappings_dtl IS 'Explicit plan-flag relationships with plan-specific values';
COMMENT ON COLUMN sys_pln_flag_mappings_dtl.plan_specific_value IS 'Optional override of flag default_value for this specific plan';
COMMENT ON COLUMN sys_pln_flag_mappings_dtl.is_enabled IS 'Quick toggle to enable/disable flag for plan without deleting mapping';

-- =====================================================
-- 4. AUDIT HISTORY
-- =====================================================

CREATE TABLE hq_ff_audit_history_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity reference
  entity_type VARCHAR(30) NOT NULL,
  CHECK (entity_type IN ('flag_definition', 'tenant_override', 'plan_flag_mapping')),
  entity_id UUID,
  tenant_org_id UUID,
  flag_key VARCHAR(100) NOT NULL,

  -- Action details
  action VARCHAR(50) NOT NULL,
  CHECK (action IN ('created', 'updated', 'deleted', 'activated', 'deactivated', 'approved', 'rejected')),
  before_value JSONB,
  after_value JSONB,
  changed_fields JSONB,

  -- Change context
  change_type VARCHAR(30) DEFAULT 'manual',
  CHECK (change_type IN ('manual', 'bulk_operation', 'plan_change', 'migration', 'api', 'scheduled')),
  bulk_operation_id UUID,

  -- Actor information
  performed_by UUID,
  performed_by_email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_hq_ff_audit_flag ON hq_ff_audit_history_tr(flag_key, created_at DESC);
CREATE INDEX idx_hq_ff_audit_tenant ON hq_ff_audit_history_tr(tenant_org_id, created_at DESC) WHERE tenant_org_id IS NOT NULL;
CREATE INDEX idx_hq_ff_audit_actor ON hq_ff_audit_history_tr(performed_by, created_at DESC);
CREATE INDEX idx_hq_ff_audit_bulk ON hq_ff_audit_history_tr(bulk_operation_id, created_at DESC) WHERE bulk_operation_id IS NOT NULL;
CREATE INDEX idx_hq_ff_audit_created ON hq_ff_audit_history_tr(created_at DESC);

-- Enable RLS (deny all - service role only)
ALTER TABLE hq_ff_audit_history_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit trail is service role only" ON hq_ff_audit_history_tr
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Comments
COMMENT ON TABLE hq_ff_audit_history_tr IS 'Immutable audit trail for all feature flag changes';

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to validate flag value against data type and rules
CREATE OR REPLACE FUNCTION hq_ff_validate_value(
  p_flag_key VARCHAR,
  p_value JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_flag RECORD;
  v_rules JSONB;
BEGIN
  SELECT data_type, validation_rules INTO v_flag
  FROM hq_feature_flags_mst
  WHERE flag_key = p_flag_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag % not found', p_flag_key;
  END IF;

  v_rules := v_flag.validation_rules;

  -- Type checking
  CASE v_flag.data_type
    WHEN 'boolean' THEN
      IF jsonb_typeof(p_value) != 'boolean' THEN
        RAISE EXCEPTION 'Value must be boolean';
      END IF;
    WHEN 'integer' THEN
      IF jsonb_typeof(p_value) != 'number' OR p_value::text ~ '\.' THEN
        RAISE EXCEPTION 'Value must be integer';
      END IF;
      -- Check min/max
      IF v_rules ? 'min' AND (p_value::numeric) < (v_rules->>'min')::numeric THEN
        RAISE EXCEPTION 'Value must be >= %', v_rules->>'min';
      END IF;
      IF v_rules ? 'max' AND (p_value::numeric) > (v_rules->>'max')::numeric THEN
        RAISE EXCEPTION 'Value must be <= %', v_rules->>'max';
      END IF;
    WHEN 'float', 'number' THEN
      IF jsonb_typeof(p_value) != 'number' THEN
        RAISE EXCEPTION 'Value must be number';
      END IF;
    WHEN 'string' THEN
      IF jsonb_typeof(p_value) != 'string' THEN
        RAISE EXCEPTION 'Value must be string';
      END IF;
      -- Check minLength/maxLength
      IF v_rules ? 'minLength' AND length(p_value #>> '{}') < (v_rules->>'minLength')::integer THEN
        RAISE EXCEPTION 'String length must be >= %', v_rules->>'minLength';
      END IF;
      IF v_rules ? 'maxLength' AND length(p_value #>> '{}') > (v_rules->>'maxLength')::integer THEN
        RAISE EXCEPTION 'String length must be <= %', v_rules->>'maxLength';
      END IF;
    WHEN 'object' THEN
      IF jsonb_typeof(p_value) != 'object' THEN
        RAISE EXCEPTION 'Value must be object';
      END IF;
    WHEN 'array' THEN
      IF jsonb_typeof(p_value) != 'array' THEN
        RAISE EXCEPTION 'Value must be array';
      END IF;
    WHEN 'date', 'datetime' THEN
      -- Validate ISO 8601 format
      BEGIN
        PERFORM (p_value #>> '{}')::timestamp;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Value must be valid ISO 8601 date/datetime';
      END;
    ELSE
      RAISE EXCEPTION 'Unknown data type: %', v_flag.data_type;
  END CASE;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION hq_ff_validate_value IS 'Validates a feature flag value against its data type and validation rules';

-- Function to get effective feature flag value for a tenant
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
  FROM hq_feature_flags_mst
  WHERE flag_key = p_flag_key AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag % not found', p_flag_key;
  END IF;

  -- 1. Check for active tenant override (highest priority)
  SELECT * INTO v_override
  FROM org_ff_overrides_cf
  WHERE tenant_org_id = p_tenant_id
    AND flag_key = p_flag_key
    AND is_active = true
    AND approval_status = 'approved'
    AND (effective_from IS NULL OR effective_from <= CURRENT_TIMESTAMP)
    AND (effective_until IS NULL OR effective_until >= CURRENT_TIMESTAMP)
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_override.override_value, 'override'::VARCHAR, v_override.id, NULL::VARCHAR, false;
    RETURN;
  END IF;

  -- 2. If plan-bound, check tenant's subscription plan
  IF v_flag.plan_binding_type = 'plan_bound' THEN
    SELECT * INTO v_subscription
    FROM org_pln_subscriptions_mst
    WHERE tenant_org_id = p_tenant_id
      AND is_active = true
      AND status IN ('trial', 'active')
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- 2a. Check for plan-specific value in mapping table
      SELECT * INTO v_plan_mapping
      FROM sys_pln_flag_mappings_dtl
      WHERE plan_code = v_subscription.plan_code
        AND flag_key = p_flag_key
        AND is_enabled = true
        AND is_active = true;

      IF FOUND AND v_plan_mapping.plan_specific_value IS NOT NULL THEN
        -- Plan has a specific value for this flag
        RETURN QUERY SELECT v_plan_mapping.plan_specific_value, 'plan_specific'::VARCHAR, NULL::UUID, v_subscription.plan_code, true;
        RETURN;
      ELSIF FOUND THEN
        -- Plan includes flag but uses default value
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

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_hq_ff_flags_timestamp
  BEFORE UPDATE ON hq_feature_flags_mst
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_ff_overrides_timestamp
  BEFORE UPDATE ON org_ff_overrides_cf
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sys_pln_flag_mappings_timestamp
  BEFORE UPDATE ON sys_pln_flag_mappings_dtl
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Sync enabled_plan_codes JSONB when mappings change
CREATE OR REPLACE FUNCTION sync_flag_enabled_plan_codes()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_codes JSONB;
BEGIN
  -- Rebuild enabled_plan_codes from mapping table
  SELECT COALESCE(jsonb_agg(plan_code), '[]'::jsonb) INTO v_plan_codes
  FROM sys_pln_flag_mappings_dtl
  WHERE flag_key = COALESCE(NEW.flag_key, OLD.flag_key)
    AND is_enabled = true
    AND is_active = true;

  -- Update flag table
  UPDATE hq_feature_flags_mst
  SET enabled_plan_codes = v_plan_codes,
      updated_at = CURRENT_TIMESTAMP
  WHERE flag_key = COALESCE(NEW.flag_key, OLD.flag_key);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on mapping table
CREATE TRIGGER sync_enabled_plan_codes_on_insert
  AFTER INSERT ON sys_pln_flag_mappings_dtl
  FOR EACH ROW
  EXECUTE FUNCTION sync_flag_enabled_plan_codes();

CREATE TRIGGER sync_enabled_plan_codes_on_update
  AFTER UPDATE ON sys_pln_flag_mappings_dtl
  FOR EACH ROW
  WHEN (OLD.is_enabled IS DISTINCT FROM NEW.is_enabled OR OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION sync_flag_enabled_plan_codes();

CREATE TRIGGER sync_enabled_plan_codes_on_delete
  AFTER DELETE ON sys_pln_flag_mappings_dtl
  FOR EACH ROW
  EXECUTE FUNCTION sync_flag_enabled_plan_codes();

-- =====================================================
-- 7. SEED DATA
-- =====================================================

INSERT INTO hq_feature_flags_mst (
  flag_key, flag_name, flag_name2, governance_category, data_type, default_value,
  plan_binding_type, enabled_plan_codes, allows_tenant_override, ui_group, ui_display_order, validation_rules
) VALUES

-- Billing Features (Plan-bound)
('tenant_pdf_invoices', 'PDF Invoices', 'فواتير PDF', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["STARTER", "GROWTH", "PRO", "ENTERPRISE"]'::jsonb, false, 'Billing Features', 1, NULL),
('tenant_whatsapp_receipts', 'WhatsApp Receipts', 'إيصالات واتساب', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["GROWTH", "PRO", "ENTERPRISE"]'::jsonb, false, 'Billing Features', 2, NULL),
('tenant_in_app_receipts', 'In-App Receipts', 'إيصالات داخل التطبيق', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["STARTER", "GROWTH", "PRO", "ENTERPRISE"]'::jsonb, false, 'Billing Features', 3, NULL),

-- Operational Features (Plan-bound)
('tenant_multi_branch', 'Multi-Branch Support', 'دعم الفروع المتعددة', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["GROWTH", "PRO", "ENTERPRISE"]'::jsonb, false, 'Operational Features', 10, NULL),
('tenant_driver_app', 'Driver App Access', 'تطبيق السائق', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'Operational Features', 11, NULL),
('tenant_white_label', 'White Label Branding', 'العلامة التجارية الخاصة', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, false, 'Operational Features', 12, NULL),

-- Analytics Features (Plan-bound)
('tenant_advanced_analytics', 'Advanced Analytics', 'تحليلات متقدمة', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'Analytics', 20, NULL),
('tenant_api_access', 'API Access', 'الوصول إلى API', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, true, 'Analytics', 21, NULL),

-- Limits (Plan-bound with numeric values)
('tenant_max_orders_per_month', 'Max Orders Per Month', 'الحد الأقصى للطلبات شهريًا', 'tenant_limit', 'integer', '100'::jsonb, 'plan_bound', '["STARTER"]'::jsonb, true, 'Limits', 30, '{"min": 1, "max": 100000}'::jsonb),
('tenant_max_branches', 'Max Branches', 'الحد الأقصى للفروع', 'tenant_limit', 'integer', '1'::jsonb, 'plan_bound', '[]'::jsonb, true, 'Limits', 31, '{"min": 1, "max": 100}'::jsonb),
('tenant_max_users', 'Max Users', 'الحد الأقصى للمستخدمين', 'tenant_limit', 'integer', '1'::jsonb, 'plan_bound', '[]'::jsonb, true, 'Limits', 32, '{"min": 1, "max": 1000}'::jsonb),
('tenant_max_storage_mb', 'Max Storage (MB)', 'الحد الأقصى للتخزين', 'tenant_limit', 'integer', '1000'::jsonb, 'plan_bound', '[]'::jsonb, true, 'Limits', 33, '{"min": 100, "max": 100000}'::jsonb),

-- Beta/Experimental Features (Independent)
('tenant_beta_ai_classification', 'AI Order Classification (Beta)', 'تصنيف الطلبات بالذكاء الاصطناعي', 'experimental', 'boolean', 'false'::jsonb, 'independent', '[]'::jsonb, true, 'Experimental', 40, NULL),
('tenant_beta_voice_orders', 'Voice Order Entry (Beta)', 'إدخال الطلبات الصوتي', 'experimental', 'boolean', 'false'::jsonb, 'independent', '[]'::jsonb, true, 'Experimental', 41, NULL),
('tenant_new_dashboard_ui', 'New Dashboard UI', 'واجهة لوحة التحكم الجديدة', 'beta', 'boolean', 'false'::jsonb, 'independent', '[]'::jsonb, true, 'Beta Features', 50, NULL),

-- HQ Platform Features
('hq_maintenance_mode', 'Maintenance Mode', 'وضع الصيانة', 'hq_config', 'boolean', 'false'::jsonb, 'independent', '[]'::jsonb, false, 'Platform Config', 100, NULL),
('hq_advanced_analytics', 'HQ Advanced Analytics', 'تحليلات HQ المتقدمة', 'hq_feature', 'boolean', 'true'::jsonb, 'independent', '[]'::jsonb, false, 'HQ Features', 101, NULL),

-- Configuration Examples (String, Object types)
('tenant_custom_domain', 'Custom Domain', 'نطاق مخصص', 'tenant_feature', 'string', '""'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, true, 'Branding', 60, '{"maxLength": 255}'::jsonb),
('tenant_branding_config', 'Branding Configuration', 'إعدادات العلامة التجارية', 'tenant_feature', 'object', '{}'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, true, 'Branding', 61, NULL)

ON CONFLICT (flag_key) DO NOTHING;

-- =====================================================
-- 8. GRANTS & PERMISSIONS
-- =====================================================

-- Grant to service_role (platform-api uses this)
GRANT ALL ON hq_feature_flags_mst TO service_role;
GRANT ALL ON org_ff_overrides_cf TO service_role;
GRANT ALL ON sys_pln_flag_mappings_dtl TO service_role;
GRANT ALL ON hq_ff_audit_history_tr TO service_role;

-- Grant to authenticated (for service role key)
GRANT ALL ON hq_feature_flags_mst TO authenticated;
GRANT ALL ON org_ff_overrides_cf TO authenticated;
GRANT ALL ON sys_pln_flag_mappings_dtl TO authenticated;
GRANT ALL ON hq_ff_audit_history_tr TO authenticated;

-- =====================================================
-- 9. MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Feature Flag Management System migration completed successfully';
    RAISE NOTICE '✅ Created tables: hq_feature_flags_mst, org_ff_overrides_cf, sys_pln_flag_mappings_dtl, hq_ff_audit_history_tr';
    RAISE NOTICE '✅ Seeded % feature flags', (SELECT COUNT(*) FROM hq_feature_flags_mst);
    RAISE NOTICE '✅ RLS policies applied';
    RAISE NOTICE '✅ Helper functions created: hq_ff_validate_value, hq_ff_get_effective_value';
END $$;
