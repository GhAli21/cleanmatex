-- =============================================================================
-- 0688_hq_doc_seq_permissions.sql
-- Human-Friendly Codes (HFC) phase P6: HQ permission codes for the document
-- numbering screens built in P7.
--
-- Adds three rows to hq_permissions:
--   hq_doc_seq:read           read numbering config and the consistency view
--   hq_general_config:read    read the GENERAL numbering defaults
--   hq_general_config:manage  change the GENERAL numbering defaults
--
-- No role grant is written (decision A-54). SUPER_ADMIN already holds '*',
-- which matches every code. Other roles get these codes from the HQ Roles
-- screen, the same way hq_notifications:operate (0625) was handled.
-- No tenant permission is added (decision A-09: tenant screens reuse the
-- existing orders permissions).
--
-- Safe to run twice: ON CONFLICT DO NOTHING. Nothing is dropped or updated.
-- Rollback: DELETE FROM hq_permissions WHERE created_info = '0688 HFC doc seq permissions'
--   AND permission_code NOT IN (SELECT permission_code FROM hq_role_permissions);
-- =============================================================================

INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  description, description_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT seed.code, seed.name_en, seed.name_ar, seed.desc_en, seed.desc_ar,
       split_part(seed.code, ':', 1), split_part(seed.code, ':', 2),
       true, true, '0688 HFC doc seq permissions'
FROM (
  VALUES
    ('hq_doc_seq:read',
     'Read document numbering', 'عرض ترقيم المستندات',
     'View document numbering config, counters and the consistency check for all tenants.',
     'عرض إعدادات ترقيم المستندات والعدادات وفحص التناسق لكل المستأجرين.'),
    ('hq_general_config:read',
     'Read general numbering defaults', 'عرض الإعدادات العامة للترقيم',
     'View the GENERAL numbering defaults that new tenants receive.',
     'عرض الإعدادات العامة للترقيم التي يحصل عليها المستأجرون الجدد.'),
    ('hq_general_config:manage',
     'Manage general numbering defaults', 'إدارة الإعدادات العامة للترقيم',
     'Change the GENERAL numbering defaults. Existing tenant counters are not changed.',
     'تعديل الإعدادات العامة للترقيم. لا تتغير عدادات المستأجرين الحالية.')
) AS seed(code, name_en, name_ar, desc_en, desc_ar)
ON CONFLICT (permission_code) DO NOTHING;
