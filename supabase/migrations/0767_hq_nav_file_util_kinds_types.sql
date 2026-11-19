-- =============================================================================
-- Migration: 0767_hq_nav_file_util_kinds_types.sql
-- Program:   File Util — Phase 7.5b (docs/features/File_Util/PLAN.md §7)
-- Purpose:
--   Two new slices of the HQ File Setup hub (`tg_file_util_config`, 0763):
--   Media kinds (`sys_file_media_kind_cd`, size limit per kind, 0765) and
--   File types (`sys_file_mime_types_cd`, optional size override per type, 0765).
--   They sit after File purposes; Storage usage and File health move down one place each.
--   Every row needs file_util.view (0762).
-- Dual-write: platform-web messages/{en,ar}/layout.json (sidebar.routes.fileUtilMediaKinds,
--   fileUtilMimeTypes), FALLBACK_SECTIONS in src/ui/navigation/cmx-sidebar.tsx, breadcrumbs map
--   in cmx-auto-breadcrumbs.tsx, hub cards in app/file-util-config/page.tsx.
--   Icons LayoutGrid / FileText already exist in HQ_NAV_ICON_MAP.
-- Target table: public.hq_navigation_cd (rows only; no schema change).
-- Rollback: soft-retire the 2 rows whose created_by = 'migration_0767'
--           (is_active = false, is_navigable = false, rec_status = 0) and set
--           display_order of tg_fu_storage_usage / tg_fu_health back to 4 / 5.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- New slices (nav_level 2, leaf, under the File Setup hub).
INSERT INTO public.hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, description, description2,
  nav_path, nav_icon, badge, main_permission_code, nav_level, display_order,
  is_leaf, is_navigable, is_active, is_system, metadata, rec_status, created_by
)
VALUES
  ('tg_fu_media_kinds', 'tg_file_util_config', 'tenant_gov', 'Media Kinds', 'أنواع الوسائط',
   'Groups of file types (image, PDF, video...) with the largest file allowed for each.',
   'مجموعات أنواع الملفات (صورة، PDF، فيديو...) مع أكبر حجم مسموح لكل مجموعة.',
   '/file-util-config/media-kinds', 'LayoutGrid', NULL, 'file_util.view', 2, 4, true, true, true, true, '{}'::jsonb, 1, 'migration_0767'),
  ('tg_fu_mime_types', 'tg_file_util_config', 'tenant_gov', 'File Types', 'أنواع الملفات',
   'The file type list (MIME types): allowed or blocked, extensions, preview and an optional size limit.',
   'قائمة أنواع الملفات (MIME): مسموح أو محظور، الامتدادات، طريقة العرض وحد حجم اختياري.',
   '/file-util-config/mime-types', 'FileText', NULL, 'file_util.view', 2, 5, true, true, true, true, '{}'::jsonb, 1, 'migration_0767')
ON CONFLICT (nav_code) DO UPDATE
   SET parent_nav_code = EXCLUDED.parent_nav_code, section_code = EXCLUDED.section_code,
       label = EXCLUDED.label, label2 = EXCLUDED.label2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       nav_path = EXCLUDED.nav_path, nav_icon = EXCLUDED.nav_icon, main_permission_code = EXCLUDED.main_permission_code,
       nav_level = EXCLUDED.nav_level, display_order = EXCLUDED.display_order, is_leaf = EXCLUDED.is_leaf,
       updated_at = now(), updated_by = 'migration_0767', updated_count = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

-- Monitoring slices move after the two new setup slices (hub order: setup first, then monitoring).
UPDATE public.hq_navigation_cd AS n
   SET display_order = v.display_order,
       updated_at = now(), updated_by = 'migration_0767', updated_count = COALESCE(n.updated_count, 0) + 1
  FROM (VALUES ('tg_fu_storage_usage', 6), ('tg_fu_health', 7)) AS v(nav_code, display_order)
 WHERE n.nav_code = v.nav_code;

COMMIT;
