-- =============================================================================
-- Migration: 0778_hq_nav_tenant_app_manage.sql
-- Purpose:
--   1. Rename HQ Navigation Registry path
--        /hq-admin-console/navigation -> /hq-admin-console/hq-navigation
--   2. Add the Organization App Management workspace (/tenant-app-manage) under
--      tenant_gov, with its first slice: Organization App Navigation
--      (/tenant-app-manage/tenant-app-navigation, edits sys_components_cd). Replaces the
--      unreachable /settings/navigation screen.
-- Target Table: public.hq_navigation_cd (CleanMateX Platform HQ Console)
-- Redirects for both old paths live in platform-web/next.config.ts.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- 1. Rename HQ Navigation Registry path
UPDATE public.hq_navigation_cd
SET
  nav_path      = '/hq-admin-console/hq-navigation',
  updated_at    = now(),
  updated_by    = 'migration_0778',
  updated_count = COALESCE(updated_count, 0) + 1
WHERE nav_code = 'hq_nav_registry'
  AND nav_path <> '/hq-admin-console/hq-navigation';

-- 2. Organization App Management hub + Navigation slice
INSERT INTO public.hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, description, description2,
  nav_path, nav_icon, badge, main_permission_code, nav_level, display_order,
  is_leaf, is_navigable, is_active, is_system, metadata, rec_status, created_by
)
VALUES
  ('tg_tenant_app_manage', NULL, 'tenant_gov', 'Organization App Management', 'إدارة تطبيق المنشأة',
   'Everything that shapes the Organization app itself: its menus, screens and app-level setup.',
   'كل ما يشكّل تطبيق المنشأة نفسه: قوائمه وشاشاته وإعداداته على مستوى التطبيق.',
   '/tenant-app-manage', 'AppWindow', NULL, NULL, 1, 158,
   false, true, true, true, '{"hub": true}'::jsonb, 1, 'migration_0778'),
  ('tg_tam_navigation', 'tg_tenant_app_manage', 'tenant_gov', 'Organization App Navigation', 'قوائم تطبيق المنشأة',
   'Menu items of the Organization app: labels, icons, order, permissions, feature flags and visibility.',
   'عناصر قوائم تطبيق المنشأة: التسميات والأيقونات والترتيب والصلاحيات وأعلام الميزات وحالة الظهور.',
   '/tenant-app-manage/tenant-app-navigation', 'Compass', NULL, NULL, 2, 1,
   true, true, true, true, '{"table": "sys_components_cd"}'::jsonb, 1, 'migration_0778')
ON CONFLICT (nav_code) DO UPDATE SET
  parent_nav_code      = EXCLUDED.parent_nav_code,
  section_code         = EXCLUDED.section_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  nav_path             = EXCLUDED.nav_path,
  nav_icon             = EXCLUDED.nav_icon,
  badge                = EXCLUDED.badge,
  main_permission_code = EXCLUDED.main_permission_code,
  nav_level            = EXCLUDED.nav_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  metadata             = EXCLUDED.metadata,
  rec_status           = EXCLUDED.rec_status,
  updated_at           = now(),
  updated_by           = 'migration_0778',
  updated_count        = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

COMMIT;
