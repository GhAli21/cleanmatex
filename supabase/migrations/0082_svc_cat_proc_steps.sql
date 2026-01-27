-- ==================================================================
-- 0082_svc_cat_proc_steps.sql
-- Purpose: Service category processing steps configuration
-- Author: CleanMateX Development Team
-- Created: 2025-01-XX
-- Dependencies: 0001_core_schema.sql, 0021_order_issues_steps.sql
-- ==================================================================
-- This migration creates:
-- - sys_svc_cat_proc_steps: System-level processing step configurations per service category
-- - org_svc_cat_proc_steps_cf: Tenant-level overrides for processing steps
-- - Seeds default step configurations for all service categories
-- - Updates org_order_item_processing_steps CHECK constraint to allow dynamic steps
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE 1: sys_svc_cat_proc_steps
-- Purpose: System-level processing step configurations per service category
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_svc_cat_proc_steps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category_code VARCHAR(120) NOT NULL,
  step_code             VARCHAR(50) NOT NULL,
  step_seq              INTEGER NOT NULL,
  step_name             VARCHAR(250) NOT NULL,
  step_name2            VARCHAR(250),
  step_color            VARCHAR(60),
  step_icon             VARCHAR(120),
  is_active             BOOLEAN DEFAULT true,
  display_order         INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ,
  updated_by            UUID,
  rec_status            SMALLINT DEFAULT 1,
  rec_order              INTEGER,
  rec_notes              VARCHAR(200),
  UNIQUE(service_category_code, step_code)
);

COMMENT ON TABLE sys_svc_cat_proc_steps IS 'System-level processing step configurations per service category';
COMMENT ON COLUMN sys_svc_cat_proc_steps.service_category_code IS 'Service category code (LAUNDRY, DRY_CLEAN, etc.)';
COMMENT ON COLUMN sys_svc_cat_proc_steps.step_code IS 'Step code (sorting, pretreatment, washing, drying, finishing, dry_cleaning, deep_cleaning, leather_cleaning, conditioning)';
COMMENT ON COLUMN sys_svc_cat_proc_steps.step_seq IS 'Sequence number for step order';
COMMENT ON COLUMN sys_svc_cat_proc_steps.step_name IS 'Step name (English)';
COMMENT ON COLUMN sys_svc_cat_proc_steps.step_name2 IS 'Step name (Arabic)';
COMMENT ON COLUMN sys_svc_cat_proc_steps.step_color IS 'Hex color code for UI display';
COMMENT ON COLUMN sys_svc_cat_proc_steps.step_icon IS 'Icon name for UI display';
COMMENT ON COLUMN sys_svc_cat_proc_steps.display_order IS 'Display order for UI sorting';

-- ==================================================================
-- TABLE 2: org_svc_cat_proc_steps_cf
-- Purpose: Tenant-level overrides for processing steps
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_svc_cat_proc_steps_cf (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id         UUID NOT NULL,
  service_category_code VARCHAR(120) NOT NULL,
  step_code             VARCHAR(50) NOT NULL,
  step_seq              INTEGER NOT NULL,
  step_name             VARCHAR(250) NOT NULL,
  step_name2            VARCHAR(250),
  step_color            VARCHAR(60),
  step_icon             VARCHAR(120),
  is_active             BOOLEAN DEFAULT true,
  display_order         INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID,
  updated_at            TIMESTAMPTZ,
  updated_by            UUID,
  rec_status            SMALLINT DEFAULT 1,
  rec_order              INTEGER,
  rec_notes              VARCHAR(200),
  UNIQUE(tenant_org_id, service_category_code, step_code)
);

COMMENT ON TABLE org_svc_cat_proc_steps_cf IS 'Tenant-level overrides for processing steps (inherits from sys_svc_cat_proc_steps if not overridden)';
COMMENT ON COLUMN org_svc_cat_proc_steps_cf.tenant_org_id IS 'Tenant organization ID';
COMMENT ON COLUMN org_svc_cat_proc_steps_cf.service_category_code IS 'Service category code';
COMMENT ON COLUMN org_svc_cat_proc_steps_cf.step_code IS 'Step code';
COMMENT ON COLUMN org_svc_cat_proc_steps_cf.step_color IS 'Hex color code for UI display (tenant override)';
COMMENT ON COLUMN org_svc_cat_proc_steps_cf.step_icon IS 'Icon name for UI display (tenant override)';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- FK to service category
ALTER TABLE sys_svc_cat_proc_steps
  ADD CONSTRAINT fk_sys_steps_category
  FOREIGN KEY (service_category_code)
  REFERENCES sys_service_category_cd(service_category_code) ON DELETE CASCADE;

-- FK to tenant service category (composite)
ALTER TABLE org_svc_cat_proc_steps_cf
  ADD CONSTRAINT fk_org_steps_category
  FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code) ON DELETE CASCADE;

-- FK to tenant
ALTER TABLE org_svc_cat_proc_steps_cf
  ADD CONSTRAINT fk_org_steps_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- ==================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_sys_steps_category ON sys_svc_cat_proc_steps(service_category_code, step_seq);
CREATE INDEX IF NOT EXISTS idx_sys_steps_active ON sys_svc_cat_proc_steps(service_category_code, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_org_steps_tenant_category ON org_svc_cat_proc_steps_cf(tenant_org_id, service_category_code, step_seq);
CREATE INDEX IF NOT EXISTS idx_org_steps_active ON org_svc_cat_proc_steps_cf(tenant_org_id, service_category_code, is_active) WHERE is_active = true;

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

-- sys_svc_cat_proc_steps: System table, no RLS needed (read-only for all)
-- org_svc_cat_proc_steps_cf: Tenant isolation required

ALTER TABLE org_svc_cat_proc_steps_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_svc_cat_proc_steps_cf ON org_svc_cat_proc_steps_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

CREATE POLICY service_role_org_svc_cat_proc_steps_cf ON org_svc_cat_proc_steps_cf
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- SEED DATA: Default Step Configurations
-- ==================================================================

-- Step definitions with colors and icons
-- Colors: blue, purple, cyan, sky, violet, indigo, orange, amber, green, red
-- Icons: Shuffle, Sparkles, Droplets, Wind, Iron, Scissors, Package, etc.

-- LAUNDRY: sorting → pretreatment → washing → drying → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('LAUNDRY', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('LAUNDRY', 'pretreatment', 2, 'Pretreatment', 'المعالجة المسبقة', '#3b82f6', 'Sparkles', 2, true),
  ('LAUNDRY', 'washing', 3, 'Washing', 'الغسيل', '#06b6d4', 'Droplets', 3, true),
  ('LAUNDRY', 'drying', 4, 'Drying', 'التجفيف', '#0ea5e9', 'Wind', 4, true),
  ('LAUNDRY', 'finishing', 5, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 5, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- DRY_CLEAN: sorting → pretreatment → dry_cleaning → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('DRY_CLEAN', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('DRY_CLEAN', 'pretreatment', 2, 'Pretreatment', 'المعالجة المسبقة', '#3b82f6', 'Sparkles', 2, true),
  ('DRY_CLEAN', 'dry_cleaning', 3, 'Dry Cleaning', 'التنظيف الجاف', '#06b6d4', 'Droplets', 3, true),
  ('DRY_CLEAN', 'finishing', 4, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 4, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- IRON_ONLY: sorting → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('IRON_ONLY', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('IRON_ONLY', 'finishing', 2, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 2, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- WASH_AND_IRON: sorting → pretreatment → washing → drying → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('WASH_AND_IRON', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('WASH_AND_IRON', 'pretreatment', 2, 'Pretreatment', 'المعالجة المسبقة', '#3b82f6', 'Sparkles', 2, true),
  ('WASH_AND_IRON', 'washing', 3, 'Washing', 'الغسيل', '#06b6d4', 'Droplets', 3, true),
  ('WASH_AND_IRON', 'drying', 4, 'Drying', 'التجفيف', '#0ea5e9', 'Wind', 4, true),
  ('WASH_AND_IRON', 'finishing', 5, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 5, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- REPAIRS: sorting → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('REPAIRS', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('REPAIRS', 'finishing', 2, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 2, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ALTERATION: sorting → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('ALTERATION', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('ALTERATION', 'finishing', 2, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 2, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- CARPET: sorting → pretreatment → deep_cleaning → drying → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('CARPET', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('CARPET', 'pretreatment', 2, 'Pretreatment', 'المعالجة المسبقة', '#3b82f6', 'Sparkles', 2, true),
  ('CARPET', 'deep_cleaning', 3, 'Deep Cleaning', 'التنظيف العميق', '#06b6d4', 'Droplets', 3, true),
  ('CARPET', 'drying', 4, 'Drying', 'التجفيف', '#0ea5e9', 'Wind', 4, true),
  ('CARPET', 'finishing', 5, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 5, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- CURTAIN: sorting → pretreatment → dry_cleaning → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('CURTAIN', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('CURTAIN', 'pretreatment', 2, 'Pretreatment', 'المعالجة المسبقة', '#3b82f6', 'Sparkles', 2, true),
  ('CURTAIN', 'dry_cleaning', 3, 'Dry Cleaning', 'التنظيف الجاف', '#06b6d4', 'Droplets', 3, true),
  ('CURTAIN', 'finishing', 4, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 4, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- LEATHER: sorting → pretreatment → leather_cleaning → conditioning → finishing
INSERT INTO sys_svc_cat_proc_steps (service_category_code, step_code, step_seq, step_name, step_name2, step_color, step_icon, display_order, is_active)
VALUES
  ('LEATHER', 'sorting', 1, 'Sorting', 'الفرز', '#9333ea', 'Shuffle', 1, true),
  ('LEATHER', 'pretreatment', 2, 'Pretreatment', 'المعالجة المسبقة', '#3b82f6', 'Sparkles', 2, true),
  ('LEATHER', 'leather_cleaning', 3, 'Leather Cleaning', 'تنظيف الجلد', '#f59e0b', 'Droplets', 3, true),
  ('LEATHER', 'conditioning', 4, 'Conditioning', 'التكييف', '#10b981', 'Sparkles', 4, true),
  ('LEATHER', 'finishing', 5, 'Finishing', 'الكوي', '#8b5cf6', 'Iron', 5, true)
ON CONFLICT (service_category_code, step_code) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  step_name2 = EXCLUDED.step_name2,
  step_color = EXCLUDED.step_color,
  step_icon = EXCLUDED.step_icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ==================================================================
-- UPDATE CONSTRAINT: Remove hardcoded CHECK constraint
-- ==================================================================

-- Drop the old hardcoded CHECK constraint
ALTER TABLE org_order_item_processing_steps
  DROP CONSTRAINT IF EXISTS chk_step_code;

-- Note: step_code validation will now be done at application level
-- based on service category configuration

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_sys_table_exists BOOLEAN;
  v_org_table_exists BOOLEAN;
  v_seed_count INTEGER;
BEGIN
  -- Check tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'sys_svc_cat_proc_steps'
  ) INTO v_sys_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'org_svc_cat_proc_steps_cf'
  ) INTO v_org_table_exists;

  IF NOT v_sys_table_exists THEN
    RAISE EXCEPTION 'sys_svc_cat_proc_steps table not created';
  END IF;

  IF NOT v_org_table_exists THEN
    RAISE EXCEPTION 'org_svc_cat_proc_steps_cf table not created';
  END IF;

  -- Check seed data
  SELECT COUNT(*) INTO v_seed_count
  FROM sys_svc_cat_proc_steps
  WHERE is_active = true;

  IF v_seed_count < 30 THEN
    RAISE WARNING 'Expected at least 30 seeded steps, found %. Check seed data.', v_seed_count;
  END IF;

  RAISE NOTICE '✓ Migration 0082 validation passed successfully';
  RAISE NOTICE '  - sys_svc_cat_proc_steps table created';
  RAISE NOTICE '  - org_svc_cat_proc_steps_cf table created';
  RAISE NOTICE '  - % steps seeded', v_seed_count;
  RAISE NOTICE '  - CHECK constraint removed from org_order_item_processing_steps';
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================
--
-- NEXT STEPS:
-- 1. Create processing-steps-service.ts to fetch steps with inheritance
-- 2. Create API endpoint /api/v1/processing-steps/[category]
-- 3. Update frontend components to use dynamic steps
-- 4. Update validation in item-processing-service.ts
--
-- TESTING:
-- 1. SELECT * FROM sys_svc_cat_proc_steps WHERE service_category_code = 'LAUNDRY' ORDER BY step_seq;
-- 2. SELECT * FROM sys_svc_cat_proc_steps WHERE service_category_code = 'IRON_ONLY' ORDER BY step_seq;
-- 3. Test tenant override: INSERT INTO org_svc_cat_proc_steps_cf (...);
-- 4. Test inheritance: Query should check tenant table first, then system table
--
-- USAGE:
-- To get steps for a service category:
-- 1. Check org_svc_cat_proc_steps_cf for tenant overrides
-- 2. If not found, use sys_svc_cat_proc_steps for system defaults
-- 3. Return steps ordered by step_seq with color/icon information

