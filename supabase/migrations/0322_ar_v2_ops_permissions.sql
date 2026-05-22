-- ============================================================================
-- 0322_ar_v2_ops_permissions.sql
-- Purpose:
--   Seed AR v2 operational permissions and default role mappings.
-- ============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('ar_credits:view',
   'View AR Credits', 'عرض أرصدة الذمم الدائنة',
   'reports', 'View unapplied AR credits and customer credit balances',
   'عرض الأرصدة الدائنة غير المخصصة وأرصدة العملاء الدائنة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_credits:apply',
   'Apply AR Credits', 'تطبيق أرصدة الذمم',
   'actions', 'Apply unapplied AR credits against open invoices',
   'تطبيق الأرصدة الدائنة غير المخصصة على الفواتير المفتوحة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_credits:reverse',
   'Reverse AR Credit Applications', 'عكس تطبيق أرصدة الذمم',
   'actions', 'Reverse AR credit applications with audit trail',
   'عكس تطبيقات أرصدة الذمم مع أثر تدقيقي',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_disputes:view',
   'View AR Disputes', 'عرض منازعات الذمم المدينة',
   'crud', 'View invoice disputes and dispute workflow history',
   'عرض منازعات الفواتير وسجل سير عمل المنازعات',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_disputes:create',
   'Create AR Disputes', 'إنشاء منازعات الذمم المدينة',
   'actions', 'Open AR disputes against invoices',
   'فتح منازعات ذمم مدينة على الفواتير',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_disputes:resolve',
   'Resolve AR Disputes', 'حل منازعات الذمم المدينة',
   'actions', 'Resolve or reject AR disputes',
   'حل أو رفض منازعات الذمم المدينة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_dunning:view',
   'View AR Dunning', 'عرض إجراءات التحصيل',
   'reports', 'View AR dunning runs and overdue collection actions',
   'عرض عمليات التحصيل وإجراءات متابعة المتأخرات',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_dunning:run',
   'Run AR Dunning', 'تشغيل إجراءات التحصيل',
   'actions', 'Execute AR reminder, notice, and hold workflows',
   'تنفيذ تذكيرات الذمم وإشعاراتها وإجراءات الإيقاف',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_stmt_cycles:view',
   'View AR Statement Cycles', 'عرض دورات كشوف الذمم',
   'crud', 'View AR statement cycle definitions and previews',
   'عرض تعريفات دورات كشوف الذمم ومعايناتها',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('ar_stmt_cycles:manage',
   'Manage AR Statement Cycles', 'إدارة دورات كشوف الذمم',
   'actions', 'Create and maintain AR statement cycle configurations',
   'إنشاء وصيانة إعدادات دورات كشوف الذمم',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    'ar_credits:view',
    'ar_credits:apply',
    'ar_disputes:view',
    'ar_disputes:create',
    'ar_dunning:view',
    'ar_stmt_cycles:view'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('operator', 'cashier')
  AND p.code IN (
    'ar_credits:view',
    'ar_disputes:view',
    'ar_dunning:view'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'tenant_admin', 'super_admin')
  AND p.code IN (
    'ar_credits:view',
    'ar_credits:apply',
    'ar_credits:reverse',
    'ar_disputes:view',
    'ar_disputes:create',
    'ar_disputes:resolve',
    'ar_dunning:view',
    'ar_dunning:run',
    'ar_stmt_cycles:view',
    'ar_stmt_cycles:manage'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;
