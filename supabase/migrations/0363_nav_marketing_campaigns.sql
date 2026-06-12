-- =============================================================================
-- 0363_nav_marketing_campaigns.sql
-- Purpose: Register the Campaigns page under the Marketing section in
--          sys_components_cd (RBAC + navigation API source of truth).
--
-- Companion frontend change: marketing_campaigns added to navigation.ts
--   gated by FLAG_KEYS.CAMPAIGNS_ENABLED and notifications:manage permission.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub — Phase 4
-- Author: CleanMateX Development Team
-- Created: 2026-06-12
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. Ensure required permission exists
-- =============================================================================

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  (
    'notifications:manage',
    'Manage Notifications & Campaigns',
    'إدارة الإشعارات والحملات',
    'crud',
    'Create, approve, launch, and cancel notification campaigns',
    'إنشاء الحملات الإعلانية والموافقة عليها وإطلاقها وإلغاؤها',
    'Notifications',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 1. Seed permission to default roles (NOT EXISTS guard — idempotent)
-- =============================================================================

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code = 'notifications:manage'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- =============================================================================
-- 2. Insert Campaigns child page under the marketing section
-- =============================================================================

INSERT INTO public.sys_components_cd (
  comp_code,             parent_comp_code,
  label,                 label2,
  description,           description2,
  comp_path,             comp_icon,
  comp_level,            display_order,
  is_leaf,               is_navigable,
  is_active,             is_system,     is_for_tenant_use,
  roles,                 main_permission_code,
  feature_flag,
  rec_status
) VALUES (
  'marketing_campaigns', 'marketing',
  'Campaigns',           'الحملات الإعلانية',
  'Broadcast notification campaigns with approval workflow and consent gating',
  'حملات إشعارات بث مع سير عمل الموافقة وبوابة الموافقة',
  '/dashboard/marketing/campaigns', 'Megaphone',
  2,                     10,
  true,                  true,
  true,                  true,          true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb, 'notifications:manage',
  '["campaigns_enabled"]'::jsonb,
  1
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag         = EXCLUDED.feature_flag,
  updated_at           = CURRENT_TIMESTAMP;

-- =============================================================================
-- 3. Resolve parent_comp_id for the new child
-- =============================================================================

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'marketing_campaigns'
  AND p.comp_code = 'marketing'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- Ensure marketing section is a node (not a leaf)
UPDATE public.sys_components_cd
SET is_leaf = false
WHERE comp_code = 'marketing';

COMMIT;
