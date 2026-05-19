-- ==================================================================
-- 0304_voucher_permissions_seed.sql
-- Business Voucher Module (BVM) — Phase 1, Step 5
-- Seeds 18 BVM permissions into sys_auth_permissions.
--
-- Permission codes follow pattern: resource:action
-- Regex: ^[a-z0-9_]+:([a-z0-9_]+|\*)$
--
-- Permission → role matrix:
--   cashier + operator        : view, print, create, post, line:create
--   branch_manager+           : + update, cancel, line:update,
--                                 line:delete_draft, expenses:create,
--                                 refunds:create
--   admin + tenant_admin
--     + super_admin           : + reverse, delete_draft, export, reports,
--                                 line:reverse, expenses:approve, refunds:approve
--
-- Note: cashier has create+post but is further restricted by voucher type
-- and line role at the service layer (CASHIER_ALLOWED_VOUCHER_TYPES).
-- ==================================================================

BEGIN;

-- ==================================================================
-- 1. Permissions
-- ==================================================================

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  -- Voucher header
  ('fin_vouchers:view',
   'View Vouchers',              'عرض السندات',
   'crud',    'View finance vouchers and their details',
   'عرض السندات المالية وتفاصيلها',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:create',
   'Create Vouchers',            'إنشاء سندات',
   'crud',    'Create new finance vouchers',
   'إنشاء سندات مالية جديدة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:update',
   'Update Draft Vouchers',      'تعديل السندات المسودة',
   'crud',    'Edit vouchers that are still in DRAFT status',
   'تعديل السندات المالية التي لا تزال في حالة مسودة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:post',
   'Post Vouchers',              'ترحيل السندات',
   'actions', 'Finalize and post a voucher (DRAFT → POSTED)',
   'إتمام ترحيل السند من مسودة إلى مرحّل',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:cancel',
   'Cancel Vouchers',            'إلغاء السندات',
   'actions', 'Cancel a draft voucher',
   'إلغاء سند مالي في حالة مسودة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:reverse',
   'Reverse Vouchers',           'عكس السندات',
   'actions', 'Reverse a posted voucher',
   'إصدار سند عكسي لسند مرحّل',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:delete_draft',
   'Delete Draft Vouchers',      'حذف السندات المسودة',
   'crud',    'Permanently delete a voucher in DRAFT status',
   'حذف نهائي لسند في حالة مسودة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:print',
   'Print Vouchers',             'طباعة السندات',
   'actions', 'Print or download a voucher PDF',
   'طباعة السند المالي أو تنزيله كـ PDF',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:export',
   'Export Vouchers',            'تصدير السندات',
   'export',  'Export voucher list as CSV/Excel',
   'تصدير قائمة السندات بصيغة CSV أو Excel',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_vouchers:reports',
   'View Voucher Reports',       'عرض تقارير السندات',
   'crud',    'Access voucher summary and analytics reports',
   'الوصول إلى تقارير وتحليلات السندات المالية',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  -- Voucher lines
  ('fin_voucher_lines:create',
   'Create Voucher Lines',       'إضافة بنود السند',
   'crud',    'Add transaction lines to a draft voucher',
   'إضافة بنود حركات لسند مالي في حالة مسودة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_voucher_lines:update',
   'Update Voucher Lines',       'تعديل بنود السند',
   'crud',    'Edit transaction lines on a draft voucher',
   'تعديل بنود الحركات على سند مالي في حالة مسودة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_voucher_lines:delete_draft',
   'Delete Draft Voucher Lines', 'حذف بنود السند المسودة',
   'crud',    'Delete a draft line from a voucher',
   'حذف بند في حالة مسودة من السند المالي',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_voucher_lines:reverse',
   'Reverse Voucher Lines',      'عكس بنود السند',
   'actions', 'Reverse individual posted voucher lines',
   'إصدار عكس لبنود سند مرحّلة بشكل منفرد',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  -- Expenses
  ('fin_expenses:create',
   'Create Expense Vouchers',    'إنشاء سندات مصروفات',
   'crud',    'Create payment vouchers for expenses',
   'إنشاء سندات صرف للمصروفات',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_expenses:approve',
   'Approve Expense Vouchers',   'اعتماد سندات المصروفات',
   'actions', 'Approve expense vouchers pending authorization',
   'اعتماد سندات المصروفات المعلقة للموافقة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  -- Refunds
  ('fin_refunds:create',
   'Create Refund Vouchers',     'إنشاء سندات المرتجعات',
   'crud',    'Create refund vouchers for customers',
   'إنشاء سندات استرداد للعملاء',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('fin_refunds:approve',
   'Approve Refund Vouchers',    'اعتماد سندات المرتجعات',
   'actions', 'Approve refund vouchers pending authorization',
   'اعتماد سندات استرداد المعلقة للموافقة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')

ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 2. Role → Permission mapping
-- ==================================================================

-- ── cashier + operator: view, print, create, post, line:create ────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('cashier', 'operator')
  AND p.code IN (
    'fin_vouchers:view',
    'fin_vouchers:print',
    'fin_vouchers:create',
    'fin_vouchers:post',
    'fin_voucher_lines:create'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── branch_manager: + update, cancel, line:update, line:delete_draft,
--                     expenses:create, refunds:create ───────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    'fin_vouchers:view',
    'fin_vouchers:print',
    'fin_vouchers:create',
    'fin_vouchers:post',
    'fin_vouchers:update',
    'fin_vouchers:cancel',
    'fin_voucher_lines:create',
    'fin_voucher_lines:update',
    'fin_voucher_lines:delete_draft',
    'fin_expenses:create',
    'fin_refunds:create'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── admin + tenant_admin + super_admin: all 18 permissions ────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'tenant_admin', 'super_admin')
  AND p.code IN (
    'fin_vouchers:view',
    'fin_vouchers:create',
    'fin_vouchers:update',
    'fin_vouchers:post',
    'fin_vouchers:cancel',
    'fin_vouchers:reverse',
    'fin_vouchers:delete_draft',
    'fin_vouchers:print',
    'fin_vouchers:export',
    'fin_vouchers:reports',
    'fin_voucher_lines:create',
    'fin_voucher_lines:update',
    'fin_voucher_lines:delete_draft',
    'fin_voucher_lines:reverse',
    'fin_expenses:create',
    'fin_expenses:approve',
    'fin_refunds:create',
    'fin_refunds:approve'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
