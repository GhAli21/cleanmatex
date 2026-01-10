-- =====================================================================================
-- Migration: 0074_sys_plan_setting_constraints.sql
-- Description: Create plan setting constraints table and seed data
-- Author: CleanMateX Team
-- Date: 2026-01-10
-- Phase: Phase 5 - Integration & Polish
-- =====================================================================================

-- =====================================================================================
-- PART 1: CREATE TABLE
-- =====================================================================================

-- Create plan setting constraints table
CREATE TABLE IF NOT EXISTS sys_plan_setting_constraints (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan and setting references
  plan_code TEXT NOT NULL,                    -- 'STARTER', 'BUSINESS', 'ENTERPRISE'
  stng_code TEXT NOT NULL,                    -- Setting code from sys_tenant_settings_cd

  -- Constraint definition
  constraint_type TEXT NOT NULL,              -- 'max_value', 'min_value', 'deny'
  constraint_value JSONB,                     -- Constraint value (number for min/max, boolean for deny)
  constraint_reason TEXT,                     -- Why this constraint exists

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Unique constraint
  UNIQUE(plan_code, stng_code, constraint_type)
);

-- Add comment
COMMENT ON TABLE sys_plan_setting_constraints IS 'Plan-based constraints for settings (subscription tier limits)';
COMMENT ON COLUMN sys_plan_setting_constraints.plan_code IS 'Plan code: STARTER, BUSINESS, ENTERPRISE';
COMMENT ON COLUMN sys_plan_setting_constraints.constraint_type IS 'Type: max_value, min_value, deny';
COMMENT ON COLUMN sys_plan_setting_constraints.constraint_value IS 'Value for the constraint (JSONB for flexibility)';
COMMENT ON COLUMN sys_plan_setting_constraints.constraint_reason IS 'Business reason for this constraint';

-- =====================================================================================
-- PART 2: CREATE INDEXES
-- =====================================================================================

CREATE INDEX idx_sys_plan_stng_constraints_plan
  ON sys_plan_setting_constraints(plan_code)
  WHERE is_active = true;

CREATE INDEX idx_sys_plan_stng_constraints_stng
  ON sys_plan_setting_constraints(stng_code)
  WHERE is_active = true;

CREATE INDEX idx_sys_plan_stng_constraints_plan_stng
  ON sys_plan_setting_constraints(plan_code, stng_code)
  WHERE is_active = true;

-- =====================================================================================
-- PART 3: SEED CONSTRAINTS FOR STARTER PLAN
-- =====================================================================================

INSERT INTO sys_plan_setting_constraints (
  plan_code, stng_code, constraint_type, constraint_value, constraint_reason,
  created_by, is_active
) VALUES
  -- Workflow constraints for STARTER plan
  (
    'STARTER',
    'workflow.max_concurrent_orders',
    'max_value',
    '5'::jsonb,
    'Starter plan limited to 5 concurrent orders',
    'system_migration',
    true
  ),
  (
    'STARTER',
    'workflow.auto_close_days',
    'max_value',
    '3'::jsonb,
    'Starter plan auto-close limited to 3 days',
    'system_migration',
    true
  ),
  (
    'STARTER',
    'workflow.advanced_reporting',
    'deny',
    'false'::jsonb,
    'Advanced reporting not available in Starter plan',
    'system_migration',
    true
  ),

  -- Branch constraints for STARTER plan
  (
    'STARTER',
    'branches.max_branches',
    'max_value',
    '1'::jsonb,
    'Starter plan limited to 1 branch',
    'system_migration',
    true
  ),

  -- User constraints for STARTER plan
  (
    'STARTER',
    'users.max_users',
    'max_value',
    '5'::jsonb,
    'Starter plan limited to 5 users',
    'system_migration',
    true
  ),

  -- Receipt constraints for STARTER plan
  (
    'STARTER',
    'receipts.custom_templates',
    'deny',
    'false'::jsonb,
    'Custom receipt templates not available in Starter plan',
    'system_migration',
    true
  ),

  -- Notification constraints for STARTER plan
  (
    'STARTER',
    'notifications.sms_enabled',
    'deny',
    'false'::jsonb,
    'SMS notifications not available in Starter plan',
    'system_migration',
    true
  )

ON CONFLICT (plan_code, stng_code, constraint_type)
DO UPDATE SET
  constraint_value = EXCLUDED.constraint_value,
  constraint_reason = EXCLUDED.constraint_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- =====================================================================================
-- PART 4: SEED CONSTRAINTS FOR BUSINESS PLAN
-- =====================================================================================

INSERT INTO sys_plan_setting_constraints (
  plan_code, stng_code, constraint_type, constraint_value, constraint_reason,
  created_by, is_active
) VALUES
  -- Workflow constraints for BUSINESS plan
  (
    'BUSINESS',
    'workflow.max_concurrent_orders',
    'max_value',
    '25'::jsonb,
    'Business plan limited to 25 concurrent orders',
    'system_migration',
    true
  ),
  (
    'BUSINESS',
    'workflow.auto_close_days',
    'max_value',
    '7'::jsonb,
    'Business plan auto-close limited to 7 days',
    'system_migration',
    true
  ),

  -- Branch constraints for BUSINESS plan
  (
    'BUSINESS',
    'branches.max_branches',
    'max_value',
    '5'::jsonb,
    'Business plan limited to 5 branches',
    'system_migration',
    true
  ),

  -- User constraints for BUSINESS plan
  (
    'BUSINESS',
    'users.max_users',
    'max_value',
    '25'::jsonb,
    'Business plan limited to 25 users',
    'system_migration',
    true
  )

ON CONFLICT (plan_code, stng_code, constraint_type)
DO UPDATE SET
  constraint_value = EXCLUDED.constraint_value,
  constraint_reason = EXCLUDED.constraint_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- =====================================================================================
-- PART 5: SEED CONSTRAINTS FOR ENTERPRISE PLAN
-- =====================================================================================

INSERT INTO sys_plan_setting_constraints (
  plan_code, stng_code, constraint_type, constraint_value, constraint_reason,
  created_by, is_active
) VALUES
  -- Workflow constraints for ENTERPRISE plan
  (
    'ENTERPRISE',
    'workflow.max_concurrent_orders',
    'max_value',
    '100'::jsonb,
    'Enterprise plan limited to 100 concurrent orders',
    'system_migration',
    true
  ),
  (
    'ENTERPRISE',
    'workflow.auto_close_days',
    'max_value',
    '30'::jsonb,
    'Enterprise plan auto-close limited to 30 days',
    'system_migration',
    true
  ),

  -- Branch constraints for ENTERPRISE plan
  (
    'ENTERPRISE',
    'branches.max_branches',
    'max_value',
    '50'::jsonb,
    'Enterprise plan limited to 50 branches',
    'system_migration',
    true
  ),

  -- User constraints for ENTERPRISE plan
  (
    'ENTERPRISE',
    'users.max_users',
    'max_value',
    '500'::jsonb,
    'Enterprise plan limited to 500 users',
    'system_migration',
    true
  )

ON CONFLICT (plan_code, stng_code, constraint_type)
DO UPDATE SET
  constraint_value = EXCLUDED.constraint_value,
  constraint_reason = EXCLUDED.constraint_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- =====================================================================================
-- PART 6: VERIFICATION QUERIES
-- =====================================================================================

-- Verify table creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'sys_plan_setting_constraints'
  ) THEN
    RAISE NOTICE 'Table sys_plan_setting_constraints created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create table sys_plan_setting_constraints';
  END IF;
END $$;

-- Count seeded constraints
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sys_plan_setting_constraints WHERE is_active = true;
  RAISE NOTICE 'Seeded % plan constraints', v_count;
END $$;

-- Show summary by plan
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Plan Constraint Summary:';
  FOR rec IN
    SELECT
      plan_code,
      COUNT(*) as constraint_count,
      COUNT(*) FILTER (WHERE constraint_type = 'max_value') as max_constraints,
      COUNT(*) FILTER (WHERE constraint_type = 'min_value') as min_constraints,
      COUNT(*) FILTER (WHERE constraint_type = 'deny') as deny_constraints
    FROM sys_plan_setting_constraints
    WHERE is_active = true
    GROUP BY plan_code
    ORDER BY plan_code
  LOOP
    RAISE NOTICE '  % : % total (% max, % min, % deny)',
      rec.plan_code, rec.constraint_count, rec.max_constraints,
      rec.min_constraints, rec.deny_constraints;
  END LOOP;
END $$;

-- =====================================================================================
-- MIGRATION COMPLETE
-- =====================================================================================
