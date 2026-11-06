-- =============================================================================
-- Migration: 0704_hq_nav_seed_registry_screen.sql
-- Purpose: Seed HQ Navigation Registry (/hq-admin-console/navigation) into
--          public.hq_navigation_cd under Section 5 (hq_admin) and mark
--          hq_console (/hq-admin-console) as a hub (is_leaf = false).
-- Target Table: public.hq_navigation_cd (CleanMateX Platform HQ Console)
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- 1. Ensure hq_console (/hq-admin-console) is marked as a non-leaf hub
UPDATE public.hq_navigation_cd
SET
  is_leaf       = false,
  metadata      = '{"hub": true, "overview": true}'::jsonb,
  updated_at    = now(),
  updated_by    = 'migration_0704',
  updated_count = COALESCE(updated_count, 0) + 1
WHERE nav_code = 'hq_console';

-- 2. Upsert hq_nav_registry (/hq-admin-console/navigation)
INSERT INTO public.hq_navigation_cd (
  nav_code,
  parent_nav_code,
  section_code,
  label,
  label2,
  description,
  description2,
  nav_path,
  nav_icon,
  badge,
  main_permission_code,
  nav_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  metadata,
  rec_status,
  created_by
)
VALUES
  (
    'hq_nav_registry',
    'hq_console',
    'hq_admin',
    'HQ Navigation Registry',
    'سجل HQ Navigation',
    'Runtime HQ sidebar sections, routes, bilingual labels, icons, badges, and visibility flags.',
    'إدارة أقسام ومسارات الشريط الجانبي للمقر، التسميات الثنائية، الأيقونات، الشارات، وحالة التفعيل.',
    '/hq-admin-console/navigation',
    'Compass',
    NULL,
    'hq_ops:read',
    2,
    405,
    true,
    true,
    true,
    true,
    '{"table": "hq_navigation_cd"}'::jsonb,
    1,
    'migration_0704'
  )
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
  updated_by           = 'migration_0704',
  updated_count        = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

COMMIT;

