-- Migration: 0068_sys_stng_categories_and_profiles_schema.sql
-- Description: Create Settings & Configuration System schema with hierarchical profiles
-- Date: 2026-01-08
-- Feature: SAAS Platform Settings Management
-- Dependencies: org_tenants_mst, sys_tenant_settings_cd, org_tenant_settings_cf

-- =====================================================
-- PART 1: Create New Tables for Settings System
-- =====================================================

-- 1. sys_stng_categories_cd: Categories of settings
-- ========================================================
CREATE TABLE IF NOT EXISTS sys_stng_categories_cd (
  stng_category_code      TEXT PRIMARY KEY,           -- Upper case: WORKFLOW, FINANCE, RECEIPTS, etc.
  stng_category_name      VARCHAR(250) NOT NULL,
  stng_category_name2     VARCHAR(250),               -- Arabic
  stng_category_desc      TEXT,
  stng_category_desc2     TEXT,                       -- Arabic
  stng_category_order     INTEGER,                    -- Display order
  stng_category_icon      VARCHAR(120),               -- Icon reference

  -- Audit fields
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by              VARCHAR(120),
  created_info            TEXT,
  updated_at              TIMESTAMP,
  updated_by              VARCHAR(120),
  updated_info            TEXT,
  rec_status              SMALLINT DEFAULT 1,
  rec_order               INTEGER,
  rec_notes               VARCHAR(200),
  is_active               BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for sys_stng_categories_cd
CREATE INDEX IF NOT EXISTS idx_sys_stng_categories_active ON sys_stng_categories_cd(is_active);
CREATE INDEX IF NOT EXISTS idx_sys_stng_categories_order ON sys_stng_categories_cd(stng_category_order);

COMMENT ON TABLE sys_stng_categories_cd IS 'Settings categories for organizing configuration options';
COMMENT ON COLUMN sys_stng_categories_cd.stng_category_code IS 'Category code (upper case): WORKFLOW, FINANCE, RECEIPTS, NOTIFICATIONS, BRANDING, GENERAL, SECURITY, INTEGRATION';
COMMENT ON COLUMN sys_stng_categories_cd.stng_category_order IS 'Display order in UI';


-- 2. sys_stng_profiles_mst: System Profile definitions (hierarchical)
-- ========================================================
CREATE TABLE IF NOT EXISTS sys_stng_profiles_mst (
  stng_profile_code       TEXT PRIMARY KEY,           -- Upper case: GCC_OM_SME, GCC_SA_ENTERPRISE
  stng_profile_id         UUID UNIQUE DEFAULT gen_random_uuid(),  -- For foreign keys if needed
  stng_profile_name       VARCHAR(250) NOT NULL,
  stng_profile_name2      VARCHAR(250),               -- Arabic
  stng_profile_desc       TEXT,
  stng_profile_desc2      TEXT,                       -- Arabic
  country_code            VARCHAR(5),                 -- OM, SA, AE, KW, BH, QA
  segment_code            VARCHAR(50),                -- SME, ENTERPRISE, FRANCHISE
  parent_profile_code     TEXT REFERENCES sys_stng_profiles_mst(stng_profile_code),
  stng_profile_version    INTEGER DEFAULT 1,

  -- Audit fields
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by              VARCHAR(120),
  created_info            TEXT,
  updated_at              TIMESTAMP,
  updated_by              VARCHAR(120),
  updated_info            TEXT,
  rec_status              SMALLINT DEFAULT 1,
  rec_order               INTEGER,
  rec_notes               VARCHAR(200),
  is_active               BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for sys_stng_profiles_mst
CREATE INDEX IF NOT EXISTS idx_sys_stng_profiles_country ON sys_stng_profiles_mst(country_code);
CREATE INDEX IF NOT EXISTS idx_sys_stng_profiles_segment ON sys_stng_profiles_mst(segment_code);
CREATE INDEX IF NOT EXISTS idx_sys_stng_profiles_active ON sys_stng_profiles_mst(is_active);
CREATE INDEX IF NOT EXISTS idx_sys_stng_profiles_parent ON sys_stng_profiles_mst(parent_profile_code);

COMMENT ON TABLE sys_stng_profiles_mst IS 'System profiles for region/segment defaults with hierarchical inheritance';
COMMENT ON COLUMN sys_stng_profiles_mst.stng_profile_code IS 'Profile code (upper case, primary key): GCC_OM_SME, GENERAL_MAIN_PROFILE';
COMMENT ON COLUMN sys_stng_profiles_mst.parent_profile_code IS 'Parent profile for inheritance (NULL = root profile)';
COMMENT ON COLUMN sys_stng_profiles_mst.stng_profile_version IS 'Profile version for tracking changes';


-- 3. sys_stng_profile_values_dtl: Profile value overrides
-- ========================================================
CREATE TABLE IF NOT EXISTS sys_stng_profile_values_dtl (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stng_profile_code       TEXT NOT NULL REFERENCES sys_stng_profiles_mst(stng_profile_code) ON DELETE CASCADE,
  stng_code               TEXT NOT NULL REFERENCES sys_tenant_settings_cd(setting_code),
  stng_value_jsonb        JSONB NOT NULL,

  -- Audit fields
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by              VARCHAR(120),
  created_info            TEXT,
  updated_at              TIMESTAMP,
  updated_by              VARCHAR(120),
  updated_info            TEXT,
  rec_status              SMALLINT DEFAULT 1,
  rec_order               INTEGER,
  rec_notes               VARCHAR(200),
  is_active               BOOLEAN NOT NULL DEFAULT true,

  UNIQUE(stng_profile_code, stng_code)
);

-- Indexes for sys_stng_profile_values_dtl
CREATE INDEX IF NOT EXISTS idx_sys_stng_profile_values_profile ON sys_stng_profile_values_dtl(stng_profile_code);
CREATE INDEX IF NOT EXISTS idx_sys_stng_profile_values_code ON sys_stng_profile_values_dtl(stng_code);
CREATE INDEX IF NOT EXISTS idx_sys_stng_profile_values_active ON sys_stng_profile_values_dtl(stng_profile_code, is_active);

COMMENT ON TABLE sys_stng_profile_values_dtl IS 'Profile-specific setting values (overrides system defaults)';
COMMENT ON COLUMN sys_stng_profile_values_dtl.stng_value_jsonb IS 'Setting value in JSON format (supports all data types)';


-- 4. org_stng_effective_cache_cf: Materialized cache for resolved settings
-- ========================================================
-- Note: Using generated column for composite key with NULLs handled as zeros
CREATE TABLE IF NOT EXISTS org_stng_effective_cache_cf (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id           UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  branch_id               UUID ,
  user_id                 UUID REFERENCES org_users_mst(id) ON DELETE CASCADE,
  stng_cache_jsonb        JSONB NOT NULL,             -- Fully resolved settings
  stng_computed_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  stng_compute_hash       TEXT NOT NULL,              -- Hash for invalidation detection

  -- Audit fields
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by              VARCHAR(120),
  updated_at              TIMESTAMP,
  updated_by              VARCHAR(120),
  rec_status              SMALLINT DEFAULT 1,
  is_active               BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (tenant_org_id, branch_id, user_id),
  Constraint fk_org_stng_effective_cache_cf_branches FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE CASCADE
  
);

-- Indexes for org_stng_effective_cache_cf
CREATE INDEX IF NOT EXISTS idx_org_stng_cache_tenant ON org_stng_effective_cache_cf(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_stng_cache_computed ON org_stng_effective_cache_cf(stng_computed_at);
CREATE INDEX IF NOT EXISTS idx_org_stng_cache_hash ON org_stng_effective_cache_cf(stng_compute_hash);

COMMENT ON TABLE org_stng_effective_cache_cf IS 'Materialized cache of fully resolved settings for performance';
COMMENT ON COLUMN org_stng_effective_cache_cf.stng_cache_jsonb IS 'Full resolved settings cache in JSON format';
COMMENT ON COLUMN org_stng_effective_cache_cf.stng_compute_hash IS 'Hash for cache invalidation detection';


-- 5. org_stng_audit_log_tr: Change audit trail
-- ========================================================
CREATE TABLE IF NOT EXISTS org_stng_audit_log_tr (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id           UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  stng_code               TEXT NOT NULL,
  stng_audit_scope        TEXT NOT NULL,              -- SYSTEM|PROFILE|TENANT|BRANCH|USER
  stng_audit_action       TEXT NOT NULL,              -- CREATE|UPDATE|DELETE|COPY_PROFILE
  branch_id               UUID ,
  user_id                 UUID REFERENCES org_users_mst(id) ON DELETE SET NULL,
  stng_before_value_jsonb JSONB,
  stng_after_value_jsonb  JSONB,
  stng_change_reason      TEXT,
  stng_request_id         TEXT,
  stng_ip_address         TEXT,

  -- Audit fields
  changed_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  changed_by              UUID,
  changed_by_name         VARCHAR(120),
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_info            TEXT,
  rec_status              SMALLINT DEFAULT 1,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  
  Constraint fk_org_stng_audit_log_tr_branches FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE SET NULL
);

-- Indexes for org_stng_audit_log_tr
CREATE INDEX IF NOT EXISTS idx_org_stng_audit_tenant ON org_stng_audit_log_tr(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_stng_audit_code ON org_stng_audit_log_tr(stng_code);
CREATE INDEX IF NOT EXISTS idx_org_stng_audit_changed ON org_stng_audit_log_tr(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_stng_audit_changed_by ON org_stng_audit_log_tr(changed_by);
CREATE INDEX IF NOT EXISTS idx_org_stng_audit_scope ON org_stng_audit_log_tr(stng_audit_scope);

COMMENT ON TABLE org_stng_audit_log_tr IS 'Audit trail for all settings changes';
COMMENT ON COLUMN org_stng_audit_log_tr.stng_audit_scope IS 'Scope of change: SYSTEM, PROFILE, TENANT, BRANCH, USER';
COMMENT ON COLUMN org_stng_audit_log_tr.stng_audit_action IS 'Action: CREATE, UPDATE, DELETE, COPY_PROFILE';


-- =====================================================
-- PART 2: Extend Existing Tables
-- =====================================================

-- Extend org_tenants_mst: Add profile assignment columns
-- ========================================================
ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS stng_profile_code TEXT REFERENCES sys_stng_profiles_mst(stng_profile_code),
  ADD COLUMN IF NOT EXISTS stng_profile_version_applied INTEGER,
  ADD COLUMN IF NOT EXISTS stng_profile_locked BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_org_tenants_profile ON org_tenants_mst(stng_profile_code);

COMMENT ON COLUMN org_tenants_mst.stng_profile_code IS 'Assigned system profile code (e.g., GCC_OM_SME)';
COMMENT ON COLUMN org_tenants_mst.stng_profile_version_applied IS 'Version of profile applied to tenant';
COMMENT ON COLUMN org_tenants_mst.stng_profile_locked IS 'If true, tenant cannot override profile settings';


-- Extend sys_tenant_settings_cd: Add category and metadata
-- ========================================================

ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_category_code TEXT REFERENCES sys_stng_categories_cd(stng_category_code),
  ADD COLUMN IF NOT EXISTS stng_scope TEXT ,
  ADD COLUMN IF NOT EXISTS stng_data_type TEXT ,
  ADD COLUMN IF NOT EXISTS stng_default_value_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS stng_validation_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS stng_is_overridable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS stng_is_sensitive BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stng_requires_restart BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stng_depends_on_flags JSONB;

-- Indexes for extended sys_tenant_settings_cd
CREATE INDEX IF NOT EXISTS idx_sys_settings_category ON sys_tenant_settings_cd(stng_category_code);
CREATE INDEX IF NOT EXISTS idx_sys_settings_scope ON sys_tenant_settings_cd(stng_scope);
CREATE INDEX IF NOT EXISTS idx_sys_settings_overridable ON sys_tenant_settings_cd(stng_is_overridable);

COMMENT ON COLUMN sys_tenant_settings_cd.stng_category_code IS 'Category: WORKFLOW, FINANCE, RECEIPTS, NOTIFICATIONS, BRANDING, GENERAL, SECURITY, INTEGRATION';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_scope IS 'Scope: SYSTEM (no overrides), TENANT, BRANCH, USER';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_data_type IS 'Data type: BOOLEAN, TEXT, NUMBER, DATE, JSON, TEXT_ARRAY, NUMBER_ARRAY';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_default_value_jsonb IS 'System default value in JSON format';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_validation_jsonb IS 'Validation rules: {"min": 1, "max": 100} or {"enum": ["opt1", "opt2"]} or {"regex": "pattern"}';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_is_overridable IS 'Can tenants override this setting?';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_is_sensitive IS 'Is this sensitive data (mask in UI)?';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_requires_restart IS 'Does changing this require app restart?';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_depends_on_flags IS 'Feature flag dependencies: ["flag1", "flag2"]';


-- Extend org_tenant_settings_cf: Add source tracking and profile locking
-- ========================================================
ALTER TABLE org_tenant_settings_cf
  ADD COLUMN IF NOT EXISTS value_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS stng_override_source TEXT,
  ADD COLUMN IF NOT EXISTS stng_locked_by_profile BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stng_override_reason TEXT;

-- Add check constraint for scope consistency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stng_override_scope'
  ) THEN
    ALTER TABLE org_tenant_settings_cf
      ADD CONSTRAINT chk_stng_override_scope CHECK (
        (branch_id IS NULL AND user_id IS NULL AND stng_override_source = 'TENANT') OR
        (branch_id IS NOT NULL AND user_id IS NULL AND stng_override_source = 'BRANCH') OR
        (user_id IS NOT NULL AND stng_override_source = 'USER')
      );
  END IF;
END $$;

-- Indexes for extended org_tenant_settings_cf
CREATE INDEX IF NOT EXISTS idx_org_tenant_settings_source ON org_tenant_settings_cf(stng_override_source);
CREATE INDEX IF NOT EXISTS idx_org_tenant_settings_locked ON org_tenant_settings_cf(stng_locked_by_profile);

COMMENT ON COLUMN org_tenant_settings_cf.value_jsonb IS 'Setting value in JSONB format (new standard, replaces setting_value)';
COMMENT ON COLUMN org_tenant_settings_cf.stng_override_source IS 'Source of override: TENANT, BRANCH, USER';
COMMENT ON COLUMN org_tenant_settings_cf.stng_locked_by_profile IS 'Cannot override if profile is locked';
COMMENT ON COLUMN org_tenant_settings_cf.stng_override_reason IS 'Why was this setting overridden?';


-- =====================================================
-- PART 3: Row-Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE sys_stng_categories_cd ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_stng_profiles_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_stng_profile_values_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_stng_effective_cache_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_stng_audit_log_tr ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sys_stng_categories_cd (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow authenticated read access to categories" ON sys_stng_categories_cd;
CREATE POLICY "Allow authenticated read access to categories"
  ON sys_stng_categories_cd FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for sys_stng_profiles_mst (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow authenticated read access to profiles" ON sys_stng_profiles_mst;
CREATE POLICY "Allow authenticated read access to profiles"
  ON sys_stng_profiles_mst FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for sys_stng_profile_values_dtl (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow authenticated read access to profile values" ON sys_stng_profile_values_dtl;
CREATE POLICY "Allow authenticated read access to profile values"
  ON sys_stng_profile_values_dtl FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for org_stng_effective_cache_cf (tenant-scoped)
DROP POLICY IF EXISTS "Tenants can access their own cache" ON org_stng_effective_cache_cf;
CREATE POLICY "Tenants can access their own cache"
  ON org_stng_effective_cache_cf FOR ALL
  TO authenticated
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid)
  WITH CHECK (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

-- RLS Policies for org_stng_audit_log_tr (tenant-scoped read-only)
DROP POLICY IF EXISTS "Tenants can view their own audit logs" ON org_stng_audit_log_tr;
CREATE POLICY "Tenants can view their own audit logs"
  ON org_stng_audit_log_tr FOR SELECT
  TO authenticated
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);


-- =====================================================
-- PART 4: Migration Summary
-- =====================================================

-- Summary of changes:
-- 1. Created 5 new tables:
--    - sys_stng_categories_cd (settings categories)
--    - sys_stng_profiles_mst (hierarchical system profiles)
--    - sys_stng_profile_values_dtl (profile values)
--    - org_stng_effective_cache_cf (materialized cache)
--    - org_stng_audit_log_tr (audit trail)
--
-- 2. Extended 3 existing tables:
--    - org_tenants_mst (added profile assignment columns)
--    - sys_tenant_settings_cd (added category, scope, data type, validation)
--    - org_tenant_settings_cf (added override source tracking)
--
-- 3. Created 30+ indexes for performance
-- 4. Applied RLS policies for security
-- 5. Added comprehensive comments for documentation
--
-- Next migrations:
-- - 0069: Seed 8 categories
-- - 0070: Seed 12 hierarchical profiles (GCC focus)
-- - 0071: Create resolver functions with inheritance support
-- - 0072: Create audit triggers
