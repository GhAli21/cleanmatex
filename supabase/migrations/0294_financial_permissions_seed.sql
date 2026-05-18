-- ============================================================
-- Migration 0294: Financial Platform Permissions Seed
-- Phase 7.1 of the Order Financial Platform
--
-- Seeds sys_auth_permissions for all new financial platform features:
--   orders (financial), cash_drawer, stored_value, gift_cards,
--   loyalty, promotions, tax, reconciliation, payment_config, finance_reports
-- Maps permissions to roles via sys_auth_role_default_permissions.
-- ============================================================

BEGIN;

-- ── Orders — financial extensions ────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('orders:view_financial_breakdown', 'View Order Financial Detail',   'عرض التفاصيل المالية للطلب', 'crud',    'View full financial breakdown of an order',       'عرض التفاصيل المالية الكاملة للطلب',   'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:process_refund',           'Process Refund',                'معالجة المرتجع',              'actions', 'Initiate and process a refund for an order',      'بدء ومعالجة مرتجع لطلب',               'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:approve_refund',           'Approve Refund',                'اعتماد المرتجع',              'actions', 'Manager-level approval gate for refunds',          'اعتماد المرتجعات على مستوى المدير',    'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:collect_payment',          'Collect Payment',               'تحصيل الدفعة',               'actions', 'Collect payment on PAY_ON_COLLECTION orders',      'تحصيل الدفعة على طلبات الدفع عند الاستلام', 'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Cash Drawer ───────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('cash_drawer:view',            'View Cash Drawers',         'عرض الصناديق النقدية',         'crud',    'View cash drawers and session summaries',         'عرض الصناديق النقدية وملخصات الجلسات',   'CashDrawer', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:open_session',    'Open Cash Drawer Session',  'فتح جلسة الصندوق النقدي',      'actions', 'Open a cash drawer session',                      'فتح جلسة صندوق نقدي',                    'CashDrawer', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:close_session',   'Close Cash Drawer Session', 'إغلاق جلسة الصندوق النقدي',   'actions', 'Close and reconcile a cash drawer session',        'إغلاق ومطابقة جلسة صندوق نقدي',          'CashDrawer', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:record_movement', 'Record Cash Movement',      'تسجيل حركة نقدية',             'actions', 'Record petty cash in/out movements',              'تسجيل حركات النقد الصغيرة',               'CashDrawer', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:view_reports',    'View Cash Drawer Reports',  'عرض تقارير الصندوق النقدي',    'crud',    'View cash drawer session reports and summaries',  'عرض تقارير وملخصات الصندوق النقدي',       'CashDrawer', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Stored Value ─────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('stored_value:view_balances',   'View Stored Value Balances', 'عرض أرصدة القيمة المخزنة',    'crud',    'View customer wallet/advance/credit-note balances', 'عرض أرصدة المحفظة والسلفة وإشعار الدائن', 'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('stored_value:top_up_wallet',   'Top Up Wallet',              'شحن المحفظة',                  'actions', 'Top up a customer wallet balance',                  'شحن رصيد محفظة العميل',                    'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('stored_value:issue_advance',   'Issue Customer Advance',     'إصدار سلفة للعميل',            'actions', 'Issue a customer advance (pre-paid balance)',        'إصدار سلفة مسبقة للعميل',                  'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('stored_value:issue_credit_note','Issue Credit Note',         'إصدار إشعار دائن',             'actions', 'Issue a credit note for a customer',                'إصدار إشعار دائن للعميل',                  'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('stored_value:view_ledger',     'View Stored Value Ledger',   'عرض سجل القيمة المخزنة',      'crud',    'View transaction ledger for stored value instruments','عرض سجل حركات القيمة المخزنة',             'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('stored_value:adjust_balance',  'Adjust Stored Value Balance','تعديل رصيد القيمة المخزنة',   'actions', 'Manually adjust a stored value balance (admin only)','تعديل رصيد القيمة المخزنة يدوياً',         'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Gift Cards — extend existing ──────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('gift_cards:cancel',      'Cancel Gift Card',         'إلغاء بطاقة الهدية',       'actions', 'Cancel a gift card',                          'إلغاء بطاقة هدية',                   'GiftCards', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('gift_cards:view_ledger', 'View Gift Card Ledger',    'عرض سجل بطاقة الهدية',    'crud',    'View transaction ledger for a gift card',     'عرض سجل حركات بطاقة الهدية',         'GiftCards', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Loyalty ───────────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('loyalty:view_config',           'View Loyalty Config',           'عرض إعدادات الولاء',              'crud',    'View loyalty program and tier configuration',       'عرض إعدادات برنامج الولاء والمستويات',  'Loyalty', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('loyalty:manage_config',         'Manage Loyalty Config',         'إدارة إعدادات الولاء',            'management','Create and edit loyalty programs and tiers',       'إنشاء وتعديل برامج الولاء والمستويات',  'Loyalty', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('loyalty:view_customer_points',  'View Customer Points',          'عرض نقاط العميل',                 'crud',    'View customer loyalty points and account',          'عرض نقاط ولاء العميل وحسابه',          'Loyalty', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('loyalty:adjust_points',         'Adjust Loyalty Points',         'تعديل نقاط الولاء',               'actions', 'Manually adjust a customer loyalty points balance', 'تعديل رصيد نقاط ولاء العميل يدوياً',   'Loyalty', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Promotions ────────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('promotions:view',              'View Promotions',               'عرض العروض الترويجية',           'crud',    'View promotions and campaigns',                   'عرض العروض الترويجية والحملات',          'Promotions', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('promotions:create',            'Create Promotions',             'إنشاء عروض ترويجية',             'crud',    'Create promotions and campaigns',                 'إنشاء عروض ترويجية وحملات',              'Promotions', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('promotions:edit',              'Edit Promotions',               'تعديل العروض الترويجية',         'crud',    'Edit promotions and campaigns',                   'تعديل العروض الترويجية والحملات',        'Promotions', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('promotions:delete',            'Delete Promotions',             'حذف العروض الترويجية',           'crud',    'Delete promotions and campaigns',                 'حذف العروض الترويجية والحملات',          'Promotions', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('promotions:activate_deactivate','Activate/Deactivate Promotions','تفعيل/تعطيل العروض الترويجية', 'actions', 'Toggle promotion active status',                  'تبديل حالة تفعيل العرض الترويجي',        'Promotions', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Tax ───────────────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('tax:view_config',   'View Tax Configuration', 'عرض إعدادات الضريبة',    'crud',       'View tax profiles and exemptions',             'عرض ملفات الضريبة والإعفاءات',          'Tax', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('tax:manage_config', 'Manage Tax Configuration','إدارة إعدادات الضريبة', 'management', 'Create and edit tax profiles and exemptions',  'إنشاء وتعديل ملفات الضريبة والإعفاءات', 'Tax', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('tax:view_reports',  'View Tax Reports',        'عرض تقارير الضريبة',    'crud',       'View tax reports and summaries',               'عرض تقارير الضريبة وملخصاتها',           'Tax', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Reconciliation ────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('reconciliation:view',               'View Reconciliation',              'عرض التسوية المالية',           'crud',    'View reconciliation runs and issues',                'عرض جلسات التسوية المالية ومشاكلها',    'Reconciliation', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('reconciliation:run',                'Run Reconciliation',               'تشغيل التسوية المالية',         'actions', 'Trigger a reconciliation run',                       'بدء جلسة تسوية مالية',                  'Reconciliation', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('reconciliation:acknowledge_issues', 'Acknowledge Reconciliation Issues','اعتماد مشاكل التسوية المالية', 'actions', 'Acknowledge or resolve reconciliation check failures','اعتماد أو حل مشاكل فحص التسوية المالية','Reconciliation', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Payment Config ────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('payment_config:view',   'View Payment Configuration', 'عرض إعدادات الدفع',    'crud',       'View tenant payment method configuration',    'عرض إعدادات طرق الدفع للمستأجر',   'PaymentConfig', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('payment_config:manage', 'Manage Payment Configuration','إدارة إعدادات الدفع', 'management', 'Enable/disable and configure payment methods', 'تفعيل/تعطيل وإعداد طرق الدفع',     'PaymentConfig', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Finance Reports ───────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('finance_reports:view',   'View Financial Reports', 'عرض التقارير المالية',   'crud',    'View financial reports and analytics',  'عرض التقارير والتحليلات المالية',  'FinanceReports', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('finance_reports:export', 'Export Financial Reports','تصدير التقارير المالية', 'export',  'Export financial reports as CSV/PDF',   'تصدير التقارير المالية كـ CSV/PDF', 'FinanceReports', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ── Role → Permission Mapping ─────────────────────────────────────────────────

-- super_admin + tenant_admin + admin: all new financial permissions
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN (
    'orders:view_financial_breakdown','orders:process_refund','orders:approve_refund','orders:collect_payment',
    'cash_drawer:view','cash_drawer:open_session','cash_drawer:close_session',
    'cash_drawer:record_movement','cash_drawer:view_reports',
    'stored_value:view_balances','stored_value:top_up_wallet','stored_value:issue_advance',
    'stored_value:issue_credit_note','stored_value:view_ledger','stored_value:adjust_balance',
    'gift_cards:cancel','gift_cards:view_ledger',
    'loyalty:view_config','loyalty:manage_config','loyalty:view_customer_points','loyalty:adjust_points',
    'promotions:view','promotions:create','promotions:edit','promotions:delete','promotions:activate_deactivate',
    'tax:view_config','tax:manage_config','tax:view_reports',
    'reconciliation:view','reconciliation:run','reconciliation:acknowledge_issues',
    'payment_config:view','payment_config:manage',
    'finance_reports:view','finance_reports:export'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- branch_manager: operational finance (no adjust/config/manage)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    'orders:view_financial_breakdown','orders:process_refund','orders:collect_payment',
    'cash_drawer:view','cash_drawer:open_session','cash_drawer:close_session',
    'cash_drawer:record_movement','cash_drawer:view_reports',
    'stored_value:view_balances','stored_value:top_up_wallet','stored_value:view_ledger',
    'gift_cards:view_ledger',
    'loyalty:view_customer_points',
    'promotions:view',
    'tax:view_config','tax:view_reports',
    'reconciliation:view',
    'payment_config:view',
    'finance_reports:view','finance_reports:export'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- operator: front-desk operational (collect payment, view balances, gift card ledger)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'operator'
  AND p.code IN (
    'orders:view_financial_breakdown','orders:collect_payment',
    'cash_drawer:view','cash_drawer:open_session','cash_drawer:close_session','cash_drawer:record_movement',
    'stored_value:view_balances','stored_value:view_ledger',
    'gift_cards:view_ledger',
    'loyalty:view_customer_points',
    'promotions:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- viewer: read-only financial visibility
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'viewer'
  AND p.code IN (
    'orders:view_financial_breakdown',
    'cash_drawer:view',
    'stored_value:view_balances','stored_value:view_ledger',
    'loyalty:view_customer_points',
    'promotions:view',
    'finance_reports:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
