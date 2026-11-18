-- =============================================================================
-- Migration: 0762_hq_file_util_config_perms.sql
-- Program:   File Util — Phase 7 HQ workspace `/file-util-config`
--            (docs/features/File_Util/PLAN.md §7, step 7.2)
-- Purpose:
--   HQ permissions for the File Util configuration workspace (buckets, categories,
--   purposes, storage usage, health). HQ codes use the dot grammar (resource.action),
--   like catalog.view / tax_packs.view (0602, 0713):
--     file_util.view    read buckets, categories, purposes, storage usage and health
--     file_util.manage  create and edit buckets, categories and purposes (create
--                       a bucket also creates its storage bucket)
--     file_util.*       wildcard, granted to TECH_ADMIN (mirrors its catalog.*)
--   SUPER_ADMIN already holds '*' and VIEWER '*.view', so they need no new grant.
-- Navigation rows for the workspace come in a later migration, once its pages exist.
-- Note: hq_permissions / hq_role_permissions created_by / updated_by are uuid (HQ user ids),
--       so this migration leaves them NULL and records itself in *_info.
-- Target tables: public.hq_permissions, public.hq_role_permissions (rows only; no schema change).
-- Rollback: delete the hq_role_permissions row and the 3 hq_permissions rows
--           whose created_info = '0762 file util HQ'.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Permissions ─────────────────────────────────────────────────────────

INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar, description, description_ar,
  resource_code, action_code, is_system, is_active, rec_status, created_info
)
VALUES
  ('file_util.view',   'View file setup',   'عرض إعداد الملفات',
   'See storage buckets, file categories and purposes, storage used per organization and file health.',
   'عرض حاويات التخزين وفئات الملفات وأغراضها والمساحة المستخدمة لكل منشأة وحالة الملفات.',
   'file_util', 'view', true, true, 1, '0762 file util HQ'),
  ('file_util.manage', 'Manage file setup', 'إدارة إعداد الملفات',
   'Create and edit storage buckets, file categories and purposes. Changes apply to new uploads only.',
   'إنشاء وتعديل حاويات التخزين وفئات الملفات وأغراضها. تسري التغييرات على الملفات الجديدة فقط.',
   'file_util', 'manage', true, true, 1, '0762 file util HQ'),
  ('file_util.*',      'All file setup actions', 'كل إجراءات إعداد الملفات',
   'Every file setup permission.',
   'كل صلاحيات إعداد الملفات.',
   'file_util', '*', true, true, 1, '0762 file util HQ')
ON CONFLICT (permission_code) DO UPDATE
   SET permission_name = EXCLUDED.permission_name, permission_name_ar = EXCLUDED.permission_name_ar,
       description = EXCLUDED.description, description_ar = EXCLUDED.description_ar,
       updated_at = now(), updated_info = '0762 file util HQ';  -- updated_by is a uuid (HQ user); none for a migration

-- ─── 2. Role grant ──────────────────────────────────────────────────────────

-- TECH_ADMIN manages platform reference data (it holds catalog.*); same for file setup.
INSERT INTO public.hq_role_permissions (role_code, permission_code, created_info)
SELECT r.role_code, 'file_util.*', '0762 file util HQ'
  FROM public.hq_roles r
 WHERE r.role_code = 'TECH_ADMIN'
ON CONFLICT (role_code, permission_code) DO NOTHING;

COMMIT;
