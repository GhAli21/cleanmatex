-- =============================================================================
-- Migration: 0763_hq_nav_file_util_config.sql
-- Program:   File Util — Phase 7 HQ workspace `/file-util-config`
--            (docs/features/File_Util/PLAN.md §7; permissions in 0762)
-- Purpose:
--   HQ sidebar rows for the File Util configuration workspace: one hub under
--   Tenant Governance & Config, placed after Products & Items Config (150), and its
--   five slices as nav_level 2 children. Every row needs file_util.view (0762).
-- Dual-write: platform-web messages/{en,ar}/layout.json (sidebar.routes.fileUtil*),
--   FALLBACK_SECTIONS in src/ui/navigation/cmx-sidebar.tsx, hub page
--   app/file-util-config/page.tsx. Icons already exist in HQ_NAV_ICON_MAP.
-- Target table: public.hq_navigation_cd (rows only; no schema change).
-- Rollback: soft-retire the 6 rows whose created_by = 'migration_0763'
--           (is_active = false, is_navigable = false, rec_status = 0).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

INSERT INTO public.hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, description, description2,
  nav_path, nav_icon, badge, main_permission_code, nav_level, display_order,
  is_leaf, is_navigable, is_active, is_system, metadata, rec_status, created_by
)
VALUES
  -- Hub (nav_level 1): the workspace landing page with one card per slice.
  ('tg_file_util_config', NULL, 'tenant_gov', 'File Setup', 'إعداد الملفات',
   'Storage buckets, file categories and purposes, storage used per organization and file health.',
   'حاويات التخزين وفئات الملفات وأغراضها والمساحة المستخدمة لكل منشأة وحالة الملفات.',
   '/file-util-config', 'FileText', NULL, 'file_util.view', 1, 156, false, true, true, true, '{}'::jsonb, 1, 'migration_0763'),
  -- Slices (nav_level 2), in hub order.
  ('tg_fu_buckets', 'tg_file_util_config', 'tenant_gov', 'Storage Buckets', 'حاويات التخزين',
   'Where files are stored; creating a bucket also creates its storage bucket.',
   'أماكن حفظ الملفات؛ إنشاء حاوية ينشئ حاوية التخزين الخاصة بها.',
   '/file-util-config/buckets', 'Server', NULL, 'file_util.view', 2, 1, true, true, true, true, '{}'::jsonb, 1, 'migration_0763'),
  ('tg_fu_categories', 'tg_file_util_config', 'tenant_gov', 'File Categories', 'فئات الملفات',
   'Kinds of files (order photos, documents...) with their bucket, size limit and files per record.',
   'أنواع الملفات (صور الطلبات، المستندات...) مع حاويتها وحد الحجم وعدد الملفات لكل سجل.',
   '/file-util-config/categories', 'Layers', NULL, 'file_util.view', 2, 2, true, true, true, true, '{}'::jsonb, 1, 'migration_0763'),
  ('tg_fu_purposes', 'tg_file_util_config', 'tenant_gov', 'File Purposes', 'أغراض الملفات',
   'Slots inside a category (before photo, receipt...) with their own limits and default.',
   'خانات داخل الفئة (صورة قبل، إيصال...) لكل منها حدودها وقيمتها الافتراضية.',
   '/file-util-config/purposes', 'ListChecks', NULL, 'file_util.view', 2, 3, true, true, true, true, '{}'::jsonb, 1, 'migration_0763'),
  ('tg_fu_storage_usage', 'tg_file_util_config', 'tenant_gov', 'Storage Usage', 'استخدام التخزين',
   'Storage used by each organization against its plan limit, by category.',
   'المساحة المستخدمة لكل منشأة مقارنة بحد باقتها، حسب الفئة.',
   '/file-util-config/storage-usage', 'BarChart3', NULL, 'file_util.view', 2, 4, true, true, true, true, '{}'::jsonb, 1, 'migration_0763'),
  ('tg_fu_health', 'tg_file_util_config', 'tenant_gov', 'File Health', 'حالة الملفات',
   'Stuck uploads, deleted files waiting for purge, missing storage buckets and the last cleanup run.',
   'الرفع المتعثر والملفات المحذوفة بانتظار الإزالة وحاويات التخزين المفقودة وآخر تنظيف.',
   '/file-util-config/health', 'HeartPulse', NULL, 'file_util.view', 2, 5, true, true, true, true, '{}'::jsonb, 1, 'migration_0763')
ON CONFLICT (nav_code) DO UPDATE
   SET parent_nav_code = EXCLUDED.parent_nav_code, section_code = EXCLUDED.section_code,
       label = EXCLUDED.label, label2 = EXCLUDED.label2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       nav_path = EXCLUDED.nav_path, nav_icon = EXCLUDED.nav_icon, main_permission_code = EXCLUDED.main_permission_code,
       nav_level = EXCLUDED.nav_level, display_order = EXCLUDED.display_order, is_leaf = EXCLUDED.is_leaf,
       updated_at = now(), updated_by = 'migration_0763', updated_count = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

COMMIT;
