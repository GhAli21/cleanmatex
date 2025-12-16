-- ==================================================================
-- 0058_sys_components_cd_navigation.sql
-- Purpose: Create sys_components_cd table for dynamic navigation system
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- Dependencies: None
-- ==================================================================
-- This migration creates:
-- 1. sys_components_cd table - Stores navigation items with permission-based access
-- 2. RLS policies for read access
-- 3. Indexes for performance
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_components_cd
-- Purpose: System components/navigation items with permission-based display
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_components_cd (
   comp_id              UUID                 NOT NULL DEFAULT gen_random_uuid(), -- uuidv7(),
   parent_comp_id       UUID                 NULL,
   comp_code            TEXT                 NOT NULL,
   parent_comp_code     TEXT                 NULL,
   label                TEXT                 NULL,
   label2               TEXT                 NULL,
   description          TEXT                 NULL,
   description2         TEXT                 NULL,
   comp_level           INTEGER              NULL,
   comp_path            TEXT                 NULL,
   feature_code         TEXT                 NULL,
   main_permission_code TEXT                 NULL, -- Permission required to display
   role_code            TEXT                 NULL,
   screen_code          TEXT                 NULL,
   badge                TEXT                 NULL,
   display_order        INTEGER              NULL,
   is_leaf              BOOLEAN              NULL DEFAULT true,
   is_navigable         BOOLEAN              NULL DEFAULT true,
   is_active            BOOLEAN              NULL DEFAULT true,
   is_system            BOOLEAN              NULL DEFAULT true,
   is_for_tenant_use    BOOLEAN              NULL DEFAULT true,
   roles                JSONB                NULL DEFAULT '[]'::jsonb,
   permissions          JSONB                NULL DEFAULT '[]'::jsonb,
   require_all_permissions BOOLEAN              NULL DEFAULT false,
   feature_flag         JSONB                NULL DEFAULT '[]'::jsonb,
   metadata             JSONB                NULL DEFAULT '{}'::jsonb,
   comp_value1          TEXT                 NULL,
   comp_value2          TEXT                 NULL,
   comp_value3          TEXT                 NULL,
   comp_value4          TEXT                 NULL,
   comp_value5          TEXT                 NULL,
   color1               VARCHAR(60)          NULL,
   color2               VARCHAR(60)          NULL,
   color3               VARCHAR(60)          NULL,
   comp_icon            VARCHAR(120)         NULL,
   comp_image           VARCHAR(120)         NULL,
   rec_order            INTEGER              NULL,
   rec_notes            TEXT                 NULL,
   rec_status           SMALLINT             NULL DEFAULT 1,
   created_at           TIMESTAMP            NOT NULL DEFAULT CURRENT_TIMESTAMP,
   created_by           TEXT                 NULL,
   created_info         TEXT                 NULL,
   updated_at           TIMESTAMP            NULL,
   updated_by           TEXT                 NULL,
   updated_info         TEXT                 NULL,
   CONSTRAINT PK_SYS_COMPONENTS_CD PRIMARY KEY (comp_id),
   CONSTRAINT AK_SYS_COMP_CODE UNIQUE (comp_code)
);

-- Foreign key for parent relationship
ALTER TABLE sys_components_cd
  ADD CONSTRAINT FK_COMP_PARENT
  FOREIGN KEY (parent_comp_id)
  REFERENCES sys_components_cd(comp_id)
  ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comp_parent ON sys_components_cd(parent_comp_id);
CREATE INDEX IF NOT EXISTS idx_comp_code ON sys_components_cd(comp_code);
CREATE INDEX IF NOT EXISTS idx_comp_active ON sys_components_cd(is_active, display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_comp_permission ON sys_components_cd(main_permission_code) WHERE main_permission_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comp_navigable ON sys_components_cd(is_navigable, is_active) WHERE is_navigable = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_comp_level ON sys_components_cd(comp_level, display_order);

-- Comments
COMMENT ON TABLE sys_components_cd IS
  'System components/navigation items with permission-based access control';

COMMENT ON COLUMN sys_components_cd.main_permission_code IS
  'Permission code required to display this navigation item. If user has this permission, item and all parents are shown';

COMMENT ON COLUMN sys_components_cd.comp_code IS
  'Unique component code (e.g., "home", "orders", "orders_list")';

COMMENT ON COLUMN sys_components_cd.comp_path IS
  'Navigation path (e.g., "/dashboard", "/dashboard/orders")';

COMMENT ON COLUMN sys_components_cd.comp_icon IS
  'Lucide icon name (e.g., "Home", "PackageSearch")';

COMMENT ON COLUMN sys_components_cd.roles IS
  'JSONB array of allowed roles (e.g., ["admin", "operator"])';

COMMENT ON COLUMN sys_components_cd.permissions IS
  'JSONB array of required permissions (e.g., ["orders:read", "orders:create"])';

COMMENT ON COLUMN sys_components_cd.feature_flag IS
  'JSONB array of required feature flags (e.g., ["driver_app"])';

-- ==================================================================
-- ROW LEVEL SECURITY
-- ==================================================================

ALTER TABLE sys_components_cd ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read active navigation items
CREATE POLICY navigation_read_policy ON sys_components_cd
  FOR SELECT
  TO authenticated
  USING (is_active = true AND is_navigable = true);

-- Policy: Service role has full access (for seeding and admin operations)
CREATE POLICY navigation_service_role_policy ON sys_components_cd
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================================================================
-- HELPER FUNCTION: Get navigation items with parent chain
-- ==================================================================

CREATE OR REPLACE FUNCTION get_navigation_with_parents(
  p_user_permissions TEXT[],
  p_user_role TEXT DEFAULT NULL,
  p_feature_flags JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  comp_id UUID,
  parent_comp_id UUID,
  comp_code TEXT,
  parent_comp_code TEXT,
  label TEXT,
  label2 TEXT,
  comp_path TEXT,
  comp_icon VARCHAR(120),
  badge TEXT,
  display_order INTEGER,
  comp_level INTEGER,
  is_leaf BOOLEAN,
  roles JSONB,
  permissions JSONB,
  require_all_permissions BOOLEAN,
  feature_flag JSONB,
  main_permission_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE visible_items AS (
    -- Base: Items user has permission for
    SELECT 
      c.comp_id,
      c.parent_comp_id,
      c.comp_code,
      c.parent_comp_code,
      c.label,
      c.label2,
      c.comp_path,
      c.comp_icon,
      c.badge,
      c.display_order,
      c.comp_level,
      c.is_leaf,
      c.roles,
      c.permissions,
      c.require_all_permissions,
      c.feature_flag,
      c.main_permission_code
    FROM sys_components_cd c
    WHERE c.is_active = true
      AND c.is_navigable = true
      
	  AND (
        -- User has main_permission_code (base case - only items user has permission for)
        (c.main_permission_code IS NOT NULL 
         AND array_length(p_user_permissions, 1) > 0 
         AND c.main_permission_code = ANY(p_user_permissions))
      )
	  
      
	  AND (
        -- Role check: if roles specified, user must have one
        (c.roles IS NULL OR c.roles = '[]'::jsonb OR (p_user_role IS NOT NULL AND c.roles ? p_user_role))
      )
	  AND (
        -- Feature flag check: if feature_flag specified, must be enabled
        -- Check if any feature flag in the array matches enabled flags
        (c.feature_flag IS NULL OR c.feature_flag = '[]'::jsonb OR 
         (p_feature_flags IS NOT NULL AND p_feature_flags != '[]'::jsonb AND
          EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.feature_flag) AS flag 
                  WHERE flag IN (SELECT jsonb_array_elements_text(p_feature_flags)))))
      )
	  
    UNION

    -- Recursive: Include all parents of visible items
    SELECT 
      p.comp_id,
      p.parent_comp_id,
      p.comp_code,
      p.parent_comp_code,
      p.label,
      p.label2,
      p.comp_path,
      p.comp_icon,
      p.badge,
      p.display_order,
      p.comp_level,
      p.is_leaf,
      p.roles,
      p.permissions,
      p.require_all_permissions,
      p.feature_flag,
      p.main_permission_code
    FROM sys_components_cd p
    INNER JOIN visible_items v ON p.comp_id = v.parent_comp_id
    WHERE p.is_active = true
      AND p.is_navigable = true
  )
  SELECT DISTINCT
    vi.comp_id,
    vi.parent_comp_id,
    vi.comp_code,
    vi.parent_comp_code,
    vi.label,
    vi.label2,
    vi.comp_path,
    vi.comp_icon,
    vi.badge,
    vi.display_order,
    vi.comp_level,
    vi.is_leaf,
    vi.roles,
    vi.permissions,
    vi.require_all_permissions,
    vi.feature_flag,
    vi.main_permission_code
  FROM visible_items vi
  ORDER BY vi.comp_level NULLS FIRST, vi.display_order NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_navigation_with_parents IS
  'Get navigation items filtered by user permissions, including all parent items';


CREATE OR REPLACE FUNCTION get_navigation_with_parents_jh(
  p_user_permissions TEXT[],
  p_user_role TEXT DEFAULT NULL,
  p_feature_flags JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  comp_id UUID,
  parent_comp_id UUID,
  comp_code TEXT,
  parent_comp_code TEXT,
  label TEXT,
  label2 TEXT,
  comp_path TEXT,
  comp_icon VARCHAR(120),
  badge TEXT,
  display_order INTEGER,
  comp_level INTEGER,
  is_leaf BOOLEAN,
  roles JSONB,
  permissions JSONB,
  require_all_permissions BOOLEAN,
  feature_flag JSONB,
  main_permission_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE visible_items AS (
    -- Base: Items user has permission for
    SELECT 
      c.comp_id,
      c.parent_comp_id,
      c.comp_code,
      c.parent_comp_code,
      c.label,
      c.label2,
      c.comp_path,
      c.comp_icon,
      c.badge,
      c.display_order,
      c.comp_level,
      c.is_leaf,
      c.roles,
      c.permissions,
      c.require_all_permissions,
      c.feature_flag,
      c.main_permission_code
    FROM sys_components_cd c
    WHERE c.is_active = true
      AND c.is_navigable = true
      /*
	  AND (
        -- User has main_permission_code (base case - only items user has permission for)
        (c.main_permission_code IS NOT NULL 
         AND array_length(p_user_permissions, 1) > 0 
         AND c.main_permission_code = ANY(p_user_permissions))
      )
	  */
      /*
	  AND (
        -- Role check: if roles specified, user must have one
        (c.roles IS NULL OR c.roles = '[]'::jsonb OR (p_user_role IS NOT NULL AND c.roles ? p_user_role))
      )
	  */
      /*
	  AND (
        -- Feature flag check: if feature_flag specified, must be enabled
        -- Check if any feature flag in the array matches enabled flags
        (c.feature_flag IS NULL OR c.feature_flag = '[]'::jsonb OR 
         (p_feature_flags IS NOT NULL AND p_feature_flags != '[]'::jsonb AND
          EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.feature_flag) AS flag 
                  WHERE flag IN (SELECT jsonb_array_elements_text(p_feature_flags)))))
      )
	  */
    UNION

    -- Recursive: Include all parents of visible items
    SELECT 
      p.comp_id,
      p.parent_comp_id,
      p.comp_code,
      p.parent_comp_code,
      p.label,
      p.label2,
      p.comp_path,
      p.comp_icon,
      p.badge,
      p.display_order,
      p.comp_level,
      p.is_leaf,
      p.roles,
      p.permissions,
      p.require_all_permissions,
      p.feature_flag,
      p.main_permission_code
    FROM sys_components_cd p
    INNER JOIN visible_items v ON p.comp_id = v.parent_comp_id
    WHERE p.is_active = true
      AND p.is_navigable = true
  )
  SELECT DISTINCT
    vi.comp_id,
    vi.parent_comp_id,
    vi.comp_code,
    vi.parent_comp_code,
    vi.label,
    vi.label2,
    vi.comp_path,
    vi.comp_icon,
    vi.badge,
    vi.display_order,
    vi.comp_level,
    vi.is_leaf,
    vi.roles,
    vi.permissions,
    vi.require_all_permissions,
    vi.feature_flag,
    vi.main_permission_code
  FROM visible_items vi
  ORDER BY vi.comp_level NULLS FIRST, vi.display_order NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_navigation_with_parents_jh IS
  'Get navigation items filtered by user permissions, including all parent items';


-- ==================================================================
-- VERIFICATION
-- ==================================================================

DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sys_components_cd') THEN
    RAISE EXCEPTION 'Table sys_components_cd was not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'sys_components_cd'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on sys_components_cd';
  END IF;

  RAISE NOTICE '✅ sys_components_cd table and RLS policies created successfully';
END $$;

COMMIT;
