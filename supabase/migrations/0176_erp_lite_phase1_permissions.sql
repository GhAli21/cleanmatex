-- ==================================================================
-- Migration: 0176_erp_lite_phase1_permissions.sql
-- Purpose: Seed ERP-Lite Phase 1 permissions and default role mappings
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 1 - Platform Enablement
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by,
  created_info
) VALUES
  ('erp_lite:view', 'View Finance & Accounting', 'عرض المالية والمحاسبة', 'crud', 'View the ERP-Lite Finance & Accounting section', 'عرض قسم المالية والمحاسبة في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_coa:view', 'View Chart of Accounts', 'عرض دليل الحسابات', 'crud', 'View ERP-Lite chart of accounts', 'عرض دليل الحسابات في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_coa:create', 'Create Chart of Accounts Entries', 'إنشاء حسابات في دليل الحسابات', 'crud', 'Create ERP-Lite account rows', 'إنشاء حسابات في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_coa:edit', 'Edit Chart of Accounts', 'تعديل دليل الحسابات', 'crud', 'Edit ERP-Lite account rows', 'تعديل حسابات ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_coa:delete', 'Delete Chart of Accounts Entries', 'حذف حسابات من دليل الحسابات', 'crud', 'Delete ERP-Lite account rows', 'حذف حسابات ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_gl:view', 'View General Ledger', 'عرض دفتر الأستاذ العام', 'crud', 'View ERP-Lite general ledger shells', 'عرض قوالب دفتر الأستاذ العام لـ ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_gl:edit', 'Edit General Ledger Entries', 'تعديل قيود دفتر الأستاذ', 'crud', 'Edit ERP-Lite manual ledger entries', 'تعديل القيود اليدوية في دفتر الأستاذ لـ ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_gl:reverse', 'Reverse Ledger Entries', 'عكس قيود دفتر الأستاذ', 'actions', 'Reverse ERP-Lite posted ledger entries', 'عكس القيود المرحّلة في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_gl:post', 'Post Ledger Entries', 'ترحيل قيود دفتر الأستاذ', 'actions', 'Post ERP-Lite ledger batches', 'ترحيل دفعات دفتر الأستاذ في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_gl:repost', 'Repost Ledger Entries', 'إعادة ترحيل قيود دفتر الأستاذ', 'actions', 'Repost ERP-Lite finance events after remediation', 'إعادة ترحيل أحداث ERP-Lite المالية بعد المعالجة', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_reports:view', 'View Financial Reports', 'عرض التقارير المالية', 'reports', 'View ERP-Lite financial reports', 'عرض التقارير المالية في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_reports:export', 'Export Financial Reports', 'تصدير التقارير المالية', 'export', 'Export ERP-Lite financial reports', 'تصدير التقارير المالية في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_ar:view', 'View AR Aging', 'عرض أعمار الذمم المدينة', 'reports', 'View ERP-Lite accounts receivable aging', 'عرض أعمار الذمم المدينة في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_expenses:view', 'View Expenses', 'عرض المصروفات', 'crud', 'View ERP-Lite expenses shells', 'عرض قوالب المصروفات في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_expenses:create', 'Create Expenses', 'إنشاء المصروفات', 'crud', 'Create ERP-Lite expense entries', 'إنشاء قيود المصروفات في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_expenses:approve', 'Approve Expenses', 'اعتماد المصروفات', 'actions', 'Approve ERP-Lite expense entries', 'اعتماد قيود المصروفات في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_bank_recon:view', 'View Bank Reconciliation', 'عرض تسوية البنك', 'crud', 'View ERP-Lite bank reconciliation shells', 'عرض قوالب تسوية البنك في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_bank_recon:edit', 'Edit Bank Reconciliation', 'تعديل تسوية البنك', 'crud', 'Edit ERP-Lite bank reconciliation matches', 'تعديل مطابقات تسوية البنك في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_ap:view', 'View Accounts Payable', 'عرض الذمم الدائنة', 'crud', 'View ERP-Lite accounts payable shells', 'عرض قوالب الذمم الدائنة في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_ap:create', 'Create Accounts Payable Entries', 'إنشاء قيود الذمم الدائنة', 'crud', 'Create ERP-Lite payable entries', 'إنشاء قيود الذمم الدائنة في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_ap:edit', 'Edit Accounts Payable Entries', 'تعديل قيود الذمم الدائنة', 'crud', 'Edit ERP-Lite payable entries', 'تعديل قيود الذمم الدائنة في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_po:view', 'View Purchase Orders', 'عرض أوامر الشراء', 'crud', 'View ERP-Lite purchase order shells', 'عرض قوالب أوامر الشراء في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_po:create', 'Create Purchase Orders', 'إنشاء أوامر الشراء', 'crud', 'Create ERP-Lite purchase orders', 'إنشاء أوامر الشراء في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_po:edit', 'Edit Purchase Orders', 'تعديل أوامر الشراء', 'crud', 'Edit ERP-Lite purchase orders', 'تعديل أوامر الشراء في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_branch_pl:view', 'View Branch P&L', 'عرض أرباح وخسائر الفروع', 'reports', 'View ERP-Lite branch profitability screens', 'عرض شاشات أرباح وخسائر الفروع في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_exceptions:view', 'View Posting Exceptions', 'عرض استثناءات الترحيل', 'crud', 'View ERP-Lite posting exceptions', 'عرض استثناءات الترحيل في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_exceptions:retry', 'Retry Posting Exceptions', 'إعادة محاولة استثناءات الترحيل', 'actions', 'Retry ERP-Lite posting exceptions', 'إعادة محاولة استثناءات الترحيل في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_exceptions:repost', 'Repost Corrected Finance Events', 'إعادة ترحيل الأحداث المالية المصححة', 'actions', 'Repost ERP-Lite finance events after correction', 'إعادة ترحيل الأحداث المالية في ERP-Lite بعد التصحيح', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_periods:view', 'View Accounting Periods', 'عرض الفترات المحاسبية', 'crud', 'View ERP-Lite accounting periods', 'عرض الفترات المحاسبية في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_periods:close', 'Close Accounting Periods', 'إغلاق الفترات المحاسبية', 'actions', 'Close ERP-Lite accounting periods', 'إغلاق الفترات المحاسبية في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176'),
  ('erp_lite_periods:reopen', 'Reopen Accounting Periods', 'إعادة فتح الفترات المحاسبية', 'actions', 'Reopen ERP-Lite accounting periods', 'إعادة فتح الفترات المحاسبية في ERP-Lite', 'ERP-Lite', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_enabled = EXCLUDED.is_enabled,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0176 ERP-Lite Phase 1';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by, created_info
)
SELECT
  r.code, p.code,
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0176 ERP-Lite Phase 1'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin')
  AND p.code IN (
    'erp_lite:view',
    'erp_lite_coa:view',
    'erp_lite_coa:create',
    'erp_lite_coa:edit',
    'erp_lite_coa:delete',
    'erp_lite_gl:view',
    'erp_lite_gl:edit',
    'erp_lite_gl:reverse',
    'erp_lite_gl:post',
    'erp_lite_gl:repost',
    'erp_lite_reports:view',
    'erp_lite_reports:export',
    'erp_lite_ar:view',
    'erp_lite_expenses:view',
    'erp_lite_expenses:create',
    'erp_lite_expenses:approve',
    'erp_lite_bank_recon:view',
    'erp_lite_bank_recon:edit',
    'erp_lite_ap:view',
    'erp_lite_ap:create',
    'erp_lite_ap:edit',
    'erp_lite_po:view',
    'erp_lite_po:create',
    'erp_lite_po:edit',
    'erp_lite_branch_pl:view',
    'erp_lite_exceptions:view',
    'erp_lite_exceptions:retry',
    'erp_lite_exceptions:repost',
    'erp_lite_periods:view',
    'erp_lite_periods:close',
    'erp_lite_periods:reopen'
  )
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
