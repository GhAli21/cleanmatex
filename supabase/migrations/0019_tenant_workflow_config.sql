-- ==================================================================
-- 0019_tenant_workflow_config.sql
-- Purpose: Tenant-level workflow configuration tables for PRD-010
-- Author: CleanMateX Development Team
-- Created: 2025-11-05
-- Dependencies: 0001_core_schema.sql, 0018_workflow_templates.sql
-- ==================================================================
-- This migration creates:
-- - org_tenant_workflow_templates_cf: Tenant template assignments
-- - org_tenant_workflow_settings_cf: Feature flags for workflow features
-- - org_tenant_service_category_workflow_cf: Per-category workflow overrides
-- - Composite FKs with tenant_org_id for multi-tenant isolation
-- - RLS policies for tenant isolation
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE 1: org_tenant_workflow_templates_cf
-- Purpose: Tenant-level workflow template assignments
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_tenant_workflow_templates_cf (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id        UUID NOT NULL,
  template_id          UUID NOT NULL REFERENCES sys_workflow_template_cd(template_id) ON DELETE RESTRICT,
  is_default           BOOLEAN DEFAULT false,
  allow_back_steps     BOOLEAN DEFAULT false,
  extra_config         JSONB DEFAULT '{}'::jsonb,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ
);

COMMENT ON TABLE org_tenant_workflow_templates_cf IS 'Tenant assignments to global workflow templates';
COMMENT ON COLUMN org_tenant_workflow_templates_cf.tenant_org_id IS 'Tenant organization ID';
COMMENT ON COLUMN org_tenant_workflow_templates_cf.template_id IS 'Reference to global workflow template';
COMMENT ON COLUMN org_tenant_workflow_templates_cf.is_default IS 'True if this is the default template for new orders';
COMMENT ON COLUMN org_tenant_workflow_templates_cf.allow_back_steps IS 'Allow users to move orders backward in workflow';
COMMENT ON COLUMN org_tenant_workflow_templates_cf.extra_config IS 'Additional configuration as JSON';

-- ==================================================================
-- TABLE 2: org_tenant_workflow_settings_cf
-- Purpose: Workflow feature flags per tenant
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_tenant_workflow_settings_cf (
  tenant_org_id            UUID PRIMARY KEY REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  use_preparation_screen   BOOLEAN DEFAULT false,
  use_assembly_screen      BOOLEAN DEFAULT false,
  use_qa_screen            BOOLEAN DEFAULT false,
  track_individual_piece   BOOLEAN DEFAULT false,
  orders_split_enabled     BOOLEAN DEFAULT false,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ,
  created_by               UUID,
  updated_by               UUID
);

COMMENT ON TABLE org_tenant_workflow_settings_cf IS 'Workflow feature flags enabling/disabling specific screens and features';
COMMENT ON COLUMN org_tenant_workflow_settings_cf.use_preparation_screen IS 'Enable preparation/detailing screen for Quick Drop orders';
COMMENT ON COLUMN org_tenant_workflow_settings_cf.use_assembly_screen IS 'Enable assembly screen before QA/Ready';
COMMENT ON COLUMN org_tenant_workflow_settings_cf.use_qa_screen IS 'Enable quality assurance screen';
COMMENT ON COLUMN org_tenant_workflow_settings_cf.track_individual_piece IS 'Track items individually through processing stages';
COMMENT ON COLUMN org_tenant_workflow_settings_cf.orders_split_enabled IS 'Allow splitting orders into multiple suborders';

-- ==================================================================
-- TABLE 3: org_tenant_service_category_workflow_cf
-- Purpose: Per-service-category workflow overrides
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_tenant_service_category_workflow_cf (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id           UUID NOT NULL,
  service_category_code   VARCHAR(120) NOT NULL,
  workflow_template_id    UUID REFERENCES sys_workflow_template_cd(template_id) ON DELETE SET NULL,
  use_preparation_screen  BOOLEAN,
  use_assembly_screen     BOOLEAN,
  use_qa_screen           BOOLEAN,
  track_individual_piece  BOOLEAN,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ,
  created_by              UUID,
  updated_by              UUID,
  UNIQUE(tenant_org_id, service_category_code)
);

COMMENT ON TABLE org_tenant_service_category_workflow_cf IS 'Per-category workflow overrides (NULL values inherit from tenant settings)';
COMMENT ON COLUMN org_tenant_service_category_workflow_cf.service_category_code IS 'Service category code (e.g., WASH_FOLD, DRY_CLEAN)';
COMMENT ON COLUMN org_tenant_service_category_workflow_cf.workflow_template_id IS 'Specific template for this category (NULL = use tenant default)';
COMMENT ON COLUMN org_tenant_service_category_workflow_cf.use_preparation_screen IS 'Category-specific override (NULL = inherit from tenant)';
COMMENT ON COLUMN org_tenant_service_category_workflow_cf.use_assembly_screen IS 'Category-specific override (NULL = inherit from tenant)';
COMMENT ON COLUMN org_tenant_service_category_workflow_cf.use_qa_screen IS 'Category-specific override (NULL = inherit from tenant)';
COMMENT ON COLUMN org_tenant_service_category_workflow_cf.track_individual_piece IS 'Category-specific override (NULL = inherit from tenant)';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Ensure tenant FK for template assignments
ALTER TABLE org_tenant_workflow_templates_cf
  ADD CONSTRAINT fk_tenant_workflow_templates_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- Composite FK: tenant + service category (to org_service_category_cf)
ALTER TABLE org_tenant_service_category_workflow_cf
  ADD CONSTRAINT fk_service_category_workflow_category
  FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code) ON DELETE CASCADE;

-- ==================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_templates_tenant ON org_tenant_workflow_templates_cf(tenant_org_id, is_default);
CREATE INDEX IF NOT EXISTS idx_tenant_templates_active ON org_tenant_workflow_templates_cf(tenant_org_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_category_workflow ON org_tenant_service_category_workflow_cf(tenant_org_id, service_category_code);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

ALTER TABLE org_tenant_workflow_templates_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tenant_workflow_settings_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tenant_service_category_workflow_cf ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_workflow_templates ON org_tenant_workflow_templates_cf
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY tenant_isolation_workflow_settings ON org_tenant_workflow_settings_cf
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_workflow_settings ON org_tenant_workflow_settings_cf
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_category_workflow ON org_tenant_service_category_workflow_cf
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- SEED DATA: Assign WF_STANDARD as default for all existing tenants
-- ==================================================================

-- Get WF_STANDARD template_id
DO $$
DECLARE
  v_template_id UUID;
  v_tenant_count INTEGER;
  v_assigned_count INTEGER;
BEGIN
  -- Get WF_STANDARD template
  SELECT template_id INTO v_template_id
  FROM sys_workflow_template_cd
  WHERE template_code = 'WF_STANDARD' AND is_active = true;

  IF v_template_id IS NULL THEN
    RAISE WARNING 'WF_STANDARD template not found, skipping template assignments';
  ELSE
    -- Assign to all existing tenants as default
    INSERT INTO org_tenant_workflow_templates_cf (
      tenant_org_id,
      template_id,
      is_default,
      allow_back_steps,
      is_active
    )
    SELECT 
      t.id,
      v_template_id,
      true,
      false,
      true
    FROM org_tenants_mst t
    WHERE NOT EXISTS (
      SELECT 1 FROM org_tenant_workflow_templates_cf twt
      WHERE twt.tenant_org_id = t.id 
      AND twt.template_id = v_template_id
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_assigned_count = ROW_COUNT;

    RAISE NOTICE 'Assigned WF_STANDARD template to % new tenant(s)', v_assigned_count;
  END IF;
END $$;

-- ==================================================================
-- SEED DATA: Initialize workflow settings for existing tenants
-- ==================================================================

-- Create default settings for tenants without them
INSERT INTO org_tenant_workflow_settings_cf (
  tenant_org_id,
  use_preparation_screen,
  use_assembly_screen,
  use_qa_screen,
  track_individual_piece,
  orders_split_enabled
)
SELECT 
  t.id,
  false, -- preparation_screen
  false, -- assembly_screen
  false, -- qa_screen
  false, -- track_individual_piece
  true   -- orders_split_enabled
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_tenant_workflow_settings_cf tws
  WHERE tws.tenant_org_id = t.id
)
ON CONFLICT (tenant_org_id) DO NOTHING;

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_tenant_count INTEGER;
  v_template_assignment_count INTEGER;
  v_settings_count INTEGER;
  v_category_override_count INTEGER;
BEGIN
  -- Count tenants
  SELECT COUNT(*) INTO v_tenant_count FROM org_tenants_mst WHERE is_active = true;

  -- Verify template assignments
  SELECT COUNT(*) INTO v_template_assignment_count
  FROM org_tenant_workflow_templates_cf
  WHERE is_active = true AND is_default = true;

  -- Verify settings exist
  SELECT COUNT(*) INTO v_settings_count
  FROM org_tenant_workflow_settings_cf;

  -- Verify category overrides (should be 0 initially)
  SELECT COUNT(*) INTO v_category_override_count
  FROM org_tenant_service_category_workflow_cf;

  IF v_template_assignment_count < v_tenant_count THEN
    RAISE WARNING 'Not all tenants have default template assignments. Expected %, found %', 
      v_tenant_count, v_template_assignment_count;
  END IF;

  IF v_settings_count < v_tenant_count THEN
    RAISE WARNING 'Not all tenants have workflow settings. Expected %, found %', 
      v_tenant_count, v_settings_count;
  END IF;

  RAISE NOTICE '✓ Migration 0019 validation passed successfully';
  RAISE NOTICE '  - % tenants have default template assignments', v_template_assignment_count;
  RAISE NOTICE '  - % tenants have workflow settings', v_settings_count;
  RAISE NOTICE '  - % category-specific overrides', v_category_override_count;
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Extend orders tables with workflow fields (0020)
-- 2. Create issue and processing steps tables (0021)
-- 3. Implement transition function (0023)

-- TESTING:
-- 1. SELECT * FROM org_tenant_workflow_templates_cf;
-- 2. SELECT * FROM org_tenant_workflow_settings_cf;
-- 3. SELECT * FROM org_tenant_service_category_workflow_cf;
-- 4. Test RLS: Try querying as different tenants

-- USAGE:
-- To enable preparation screen for a tenant:
-- UPDATE org_tenant_workflow_settings_cf SET use_preparation_screen = true WHERE tenant_org_id = 'xxx';
--
-- To assign different template to a specific category:
-- INSERT INTO org_tenant_service_category_workflow_cf (tenant_org_id, service_category_code, workflow_template_id)
-- VALUES ('tenant-id', 'WASH_FOLD', (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_ASSEMBLY_QA'));

