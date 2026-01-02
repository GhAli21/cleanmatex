-- ==================================================================
-- 0066_fix_navigation_is_navigable.sql
-- Purpose: Fix missing is_navigable column in sys_components_cd
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- ==================================================================
-- This migration:
-- 1. Adds is_navigable column if it doesn't exist
-- 2. Updates the get_navigation_with_parents_jh function to handle missing column gracefully
-- ==================================================================

BEGIN;

-- Add is_navigable column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_components_cd' 
    AND column_name = 'is_navigable'
  ) THEN
    ALTER TABLE sys_components_cd 
    ADD COLUMN is_navigable BOOLEAN NULL DEFAULT true;
    
    -- Set all existing rows to true
    UPDATE sys_components_cd SET is_navigable = true WHERE is_navigable IS NULL;
    
    RAISE NOTICE 'Added is_navigable column to sys_components_cd';
  ELSE
    RAISE NOTICE 'is_navigable column already exists';
  END IF;
END $$;

-- Update the function to handle cases where is_navigable might be NULL
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
      AND (c.is_navigable IS NULL OR c.is_navigable = true) -- Handle NULL case
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
      AND (p.is_navigable IS NULL OR p.is_navigable = true) -- Handle NULL case
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
  'Get navigation items filtered by user permissions, including all parent items. Handles missing is_navigable column gracefully.';

COMMIT;

