-- =============================================================================
-- Migration: 0713_hq_tax_kits_perms_nav.sql
-- Program:   Tax Engine T2 — HQ side (docs/features/Tax_Config/TAX_ENGINE_PLAN.md §9)
-- Purpose:
--   1. HQ permissions for the Tax Kits and Starter Packages screens. HQ codes use
--      the dot grammar (resource.action), like catalog.view / catalog.manage (0602):
--        tax_packs.view    read kits, versions, codes, rules, examples, packages
--        tax_packs.manage  mark kit facts verified, edit starter packages
--        tax_packs.*       wildcard, granted to TECH_ADMIN (mirrors its catalog.*)
--      SUPER_ADMIN already holds '*' and VIEWER '*.view', so they need no new grant.
--   2. Two HQ sidebar rows under Master System Codes & Financial Setup
--      (tg_system_codes, /system-codes): Tax Kits and Starter Packages.
-- Note: hq_permissions / hq_role_permissions created_by / updated_by are uuid (HQ user ids),
--       so this migration leaves them NULL and records itself in *_info.
-- Target tables: public.hq_permissions, public.hq_role_permissions,
--                public.hq_navigation_cd (rows only; no schema change).
-- Rollback: delete the 2 hq_navigation_cd rows, the 3 hq_role_permissions /
--           hq_permissions rows created here (created_info = '0713 ...').
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Permissions ─────────────────────────────────────────────────────────

INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar, description, description_ar,
  resource_code, action_code, is_system, is_active, rec_status, created_info
)
VALUES
  ('tax_packs.view',   'View tax kits',   'عرض الإعدادات الضريبية الجاهزة',
   'See country tax kits, their versions, codes, rules, worked examples and starter packages.',
   'عرض الإعدادات الضريبية الجاهزة لكل دولة وإصداراتها ورموزها وقواعدها وأمثلتها والباقات المبدئية.',
   'tax_packs', 'view', true, true, 1, '0713 tax kits HQ'),
  ('tax_packs.manage', 'Manage tax kits', 'إدارة الإعدادات الضريبية الجاهزة',
   'Mark kit facts as verified against an official source and edit starter packages.',
   'تأكيد بيانات الإعداد الضريبي من مصدر رسمي وتعديل الباقات المبدئية.',
   'tax_packs', 'manage', true, true, 1, '0713 tax kits HQ'),
  ('tax_packs.*',      'All tax kit actions', 'كل إجراءات الإعدادات الضريبية',
   'Every tax kit permission.',
   'كل صلاحيات الإعدادات الضريبية الجاهزة.',
   'tax_packs', '*', true, true, 1, '0713 tax kits HQ')
ON CONFLICT (permission_code) DO UPDATE
   SET permission_name = EXCLUDED.permission_name, permission_name_ar = EXCLUDED.permission_name_ar,
       description = EXCLUDED.description, description_ar = EXCLUDED.description_ar,
       updated_at = now(), updated_info = '0713 tax kits HQ';  -- updated_by is a uuid (HQ user); none for a migration

-- TECH_ADMIN manages platform reference data (it holds catalog.*); same for tax kits.
INSERT INTO public.hq_role_permissions (role_code, permission_code, created_info)
SELECT r.role_code, 'tax_packs.*', '0713 tax kits HQ'
  FROM public.hq_roles r
 WHERE r.role_code = 'TECH_ADMIN'
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ─── 2. HQ navigation (dual-write: platform-web layout.json + FALLBACK_SECTIONS) ──

INSERT INTO public.hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, description, description2,
  nav_path, nav_icon, badge, main_permission_code, nav_level, display_order,
  is_leaf, is_navigable, is_active, is_system, metadata, rec_status, created_by
)
VALUES
  ('tg_sys_codes_tax_kits', 'tg_system_codes', 'tenant_gov', 'Tax Kits', 'الإعدادات الضريبية الجاهزة',
   'Country tax kits: rates, thresholds, codes, rules, worked examples and verification status.',
   'الإعدادات الضريبية لكل دولة: النسب والحدود والرموز والقواعد والأمثلة وحالة التوثيق.',
   '/system-codes/tax-kits', 'Receipt', NULL, 'tax_packs.view', 2, 169, true, true, true, true, '{}'::jsonb, 1, 'migration_0713'),
  ('tg_sys_codes_starter_pkgs', 'tg_system_codes', 'tenant_gov', 'Starter Packages', 'الباقات المبدئية',
   'Ready setups per country and business segment: tax kit, calendar, setup mode and price mode.',
   'إعدادات جاهزة لكل دولة وفئة نشاط: الإعداد الضريبي والتقويم ونمط الإعداد ونمط الأسعار.',
   '/system-codes/starter-packages', 'Package', NULL, 'tax_packs.view', 2, 170, true, true, true, true, '{}'::jsonb, 1, 'migration_0713')
ON CONFLICT (nav_code) DO UPDATE
   SET parent_nav_code = EXCLUDED.parent_nav_code, section_code = EXCLUDED.section_code,
       label = EXCLUDED.label, label2 = EXCLUDED.label2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       nav_path = EXCLUDED.nav_path, nav_icon = EXCLUDED.nav_icon, main_permission_code = EXCLUDED.main_permission_code,
       nav_level = EXCLUDED.nav_level, display_order = EXCLUDED.display_order,
       updated_at = now(), updated_by = 'migration_0713', updated_count = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

COMMIT;
