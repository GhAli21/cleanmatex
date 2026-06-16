-- ============================================================
-- Migration 0374: RBAC — All Laundry SaaS Tenant Roles
--
-- Creates 14 operational roles for CleanMateX laundry tenants:
--   Front-Desk:  cashier, receptionist
--   Operations:  laundry_worker, presser, qa_inspector, store_keeper
--   Delivery:    driver, route_supervisor
--   Finance:     accountant, finance_manager
--   Management:  admin, supervisor
--   Customer:    b2b_customer
--   IT:          it_support
--
-- Already seeded in 0035 (NOT modified here):
--   super_admin, tenant_admin, branch_manager, operator, viewer
--
-- Permission assignment: CROSS JOIN + NOT EXISTS (canonical pattern).
--   • Silently skips any permission code not yet in sys_auth_permissions
--   • ON CONFLICT (code) DO NOTHING on roles — safe to re-run
-- Created: 2026-06-16
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- STEP 1: Create all new roles
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.sys_auth_roles (
  code, name, name2, description, description2,
  is_system, is_active, created_at, created_by
) VALUES

  -- ── Front-Desk ──────────────────────────────────────────
  ('cashier',
   'Cashier', 'كاشير',
   'Front-desk cashier — order intake, payment collection, cash drawer',
   'كاشير المنطقة الأمامية — استقبال الطلبات وتحصيل المدفوعات وإدارة صندوق النقدية',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('receptionist',
   'Receptionist', 'موظف استقبال',
   'Order intake and customer service — no direct payment access',
   'موظف استقبال الطلبات وخدمة العملاء — بدون صلاحية الدفع المباشر',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  -- ── Operations / Production ─────────────────────────────
  ('laundry_worker',
   'Laundry Worker', 'عامل مغسلة',
   'Processing / washing floor worker — order status transitions only',
   'عامل قسم الغسيل — تحديث حالة الطلبات فقط',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('presser',
   'Presser', 'مكوي',
   'Ironing and finishing worker — order status transitions only',
   'عامل الكي والتشطيب — تحديث حالة الطلبات فقط',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('qa_inspector',
   'QA Inspector', 'مفتش جودة',
   'Quality assurance inspector — reviews and approves finished orders',
   'مفتش الجودة — مراجعة الطلبات المنجزة والموافقة عليها',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('store_keeper',
   'Store Keeper', 'أمين المستودع',
   'Inventory and stock management',
   'إدارة المخزون والمستودع',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  -- ── Delivery / Field ────────────────────────────────────
  ('driver',
   'Driver', 'سائق',
   'Pickup and delivery operations',
   'عمليات الاستلام والتوصيل',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('route_supervisor',
   'Route Supervisor', 'مشرف التوصيل',
   'Supervises drivers and manages delivery routes',
   'مشرف السائقين وإدارة خطوط التوصيل',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  -- ── Finance / Accounting ────────────────────────────────
  ('accountant',
   'Accountant', 'محاسب',
   'Financial reporting, invoices, and reconciliation — read-only financial access',
   'التقارير المالية والفواتير والتسوية — صلاحية قراءة مالية فقط',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('finance_manager',
   'Finance Manager', 'مدير مالي',
   'Full financial operations including payments, refunds, and approvals',
   'العمليات المالية الكاملة بما في ذلك المدفوعات والمبالغ المستردة والموافقات',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  -- ── Management ──────────────────────────────────────────
  ('admin',
   'Admin', 'مدير',
   'Mid-level administrator — above branch manager, below tenant admin',
   'مدير من المستوى المتوسط — فوق مدير الفرع وتحت مدير المستأجر',
   true, true, CURRENT_TIMESTAMP, 'system_admin'),

  ('supervisor',
   'Supervisor', 'مشرف',
   'Floor supervisor with operational oversight — no admin functions',
   'مشرف العمليات الميدانية — بدون صلاحيات إدارية',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  -- ── Customer / B2B ──────────────────────────────────────
  ('b2b_customer',
   'B2B Customer', 'عميل أعمال',
   'Corporate customer portal access — view orders and invoices only',
   'وصول بوابة العملاء التجاريين — عرض الطلبات والفواتير فقط',
   false, true, CURRENT_TIMESTAMP, 'system_admin'),

  -- ── IT / Technical ──────────────────────────────────────
  ('it_support',
   'IT Support', 'دعم تقني',
   'Internal technical support — system settings and integration access',
   'الدعم التقني الداخلي — الوصول لإعدادات النظام والتكاملات',
   false, true, CURRENT_TIMESTAMP, 'system_admin')

ON CONFLICT (code) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- STEP 2: Assign permissions per role
-- ═══════════════════════════════════════════════════════════

-- ── cashier ─────────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'cashier'
  AND p.code IN (
    -- Orders
    'orders:create', 'orders:read', 'orders:update', 'orders:print',
    'orders:notes', 'orders:history', 'orders:transition', 'orders:cancel', 'orders:urgent',
    'orders:collect_payment', 'orders:view_financial_breakdown',
    -- Customers
    'customers:create', 'customers:read', 'customers:history', 'customers:tags',
    -- Payments
    'payments:create', 'payments:read',
    -- Invoices
    'invoices:create', 'invoices:read', 'invoices:print',
    -- Cash Drawer
    'cash_drawer:view', 'cash_drawer:open_session', 'cash_drawer:close_session', 'cash_drawer:record_movement',
    -- Stored Value
    'stored_value:view_balances', 'stored_value:view_ledger',
    -- Loyalty & Promotions
    'loyalty:view_customer_points', 'promotions:view',
    -- Catalog (read-only)
    'products:read', 'pricing:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── receptionist ────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'receptionist'
  AND p.code IN (
    -- Orders
    'orders:create', 'orders:read', 'orders:update', 'orders:print',
    'orders:notes', 'orders:history', 'orders:transition', 'orders:urgent',
    -- Customers
    'customers:create', 'customers:read', 'customers:update', 'customers:history', 'customers:tags',
    -- Catalog (read-only)
    'products:read', 'pricing:read',
    -- Invoices (read-only)
    'invoices:read',
    -- Reports
    'reports:view_operational', 'reports:dashboard'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── laundry_worker ──────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'laundry_worker'
  AND p.code IN (
    'orders:read', 'orders:transition', 'orders:notes', 'orders:history', 'orders:urgent'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── presser ─────────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'presser'
  AND p.code IN (
    'orders:read', 'orders:transition', 'orders:notes', 'orders:history'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── qa_inspector ────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'qa_inspector'
  AND p.code IN (
    'orders:read', 'orders:transition', 'orders:notes', 'orders:history', 'orders:urgent',
    'customers:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── store_keeper ────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'store_keeper'
  AND p.code IN (
    'products:read', 'products:stock', 'products:update',
    'orders:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── driver ──────────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'driver'
  AND p.code IN (
    'orders:read', 'orders:notes', 'orders:history',
    'delivery:track', 'delivery:pod', 'delivery:assign',
    'customers:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── route_supervisor ────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'route_supervisor'
  AND p.code IN (
    'orders:read', 'orders:history',
    'delivery:assign', 'delivery:track', 'delivery:routes', 'delivery:pod',
    'drivers:read', 'drivers:update',
    'customers:read',
    'reports:view_operational', 'reports:dashboard'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── accountant ──────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'accountant'
  AND p.code IN (
    -- Invoices (read-only)
    'invoices:read', 'invoices:print', 'invoices:export',
    -- Payments (read + reconcile)
    'payments:read', 'payments:reconcile', 'payments:export',
    -- Cash Drawer (view-only)
    'cash_drawer:view', 'cash_drawer:view_reports',
    -- Finance Reports
    'finance_reports:view', 'finance_reports:export',
    -- Reports
    'reports:view_financial', 'reports:export',
    -- Reconciliation
    'reconciliation:view',
    -- Stored Value (read-only)
    'stored_value:view_balances', 'stored_value:view_ledger',
    -- Tax (read-only)
    'tax:view_reports', 'tax:view_config',
    -- Audit
    'audit:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── finance_manager ─────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'finance_manager'
  AND p.code IN (
    -- Invoices (full)
    'invoices:create', 'invoices:read', 'invoices:update', 'invoices:void',
    'invoices:send', 'invoices:print', 'invoices:export',
    -- Payments (full)
    'payments:create', 'payments:read', 'payments:refund', 'payments:reconcile', 'payments:export',
    -- Orders (financial actions)
    'orders:view_financial_breakdown', 'orders:process_refund',
    'orders:approve_refund', 'orders:collect_payment',
    -- Cash Drawer (full)
    'cash_drawer:view', 'cash_drawer:open_session', 'cash_drawer:close_session',
    'cash_drawer:record_movement', 'cash_drawer:view_reports',
    -- Stored Value (full)
    'stored_value:view_balances', 'stored_value:view_ledger', 'stored_value:top_up_wallet',
    'stored_value:issue_advance', 'stored_value:issue_credit_note',
    -- Loyalty
    'loyalty:view_customer_points',
    -- Gift Cards
    'gift_cards:view_ledger',
    -- Tax
    'tax:view_config', 'tax:view_reports',
    -- Reconciliation (full)
    'reconciliation:view', 'reconciliation:run', 'reconciliation:acknowledge_issues',
    -- Payment Config
    'payment_config:view',
    -- Finance Reports
    'finance_reports:view', 'finance_reports:export',
    -- Reports
    'reports:view_financial', 'reports:export',
    -- Audit
    'audit:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── admin ───────────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'admin'
  AND p.code IN (
    -- Orders (full operational)
    'orders:create', 'orders:read', 'orders:update', 'orders:cancel', 'orders:assign',
    'orders:transition', 'orders:notes', 'orders:history', 'orders:urgent', 'orders:print',
    'orders:discount', 'orders:collect_payment', 'orders:view_financial_breakdown',
    'orders:process_refund', 'orders:approve_refund',
    -- Customers (full)
    'customers:create', 'customers:read', 'customers:update', 'customers:delete',
    'customers:export', 'customers:tags', 'customers:history',
    -- Invoices (full)
    'invoices:create', 'invoices:read', 'invoices:update', 'invoices:void',
    'invoices:send', 'invoices:print', 'invoices:export',
    -- Payments (full)
    'payments:create', 'payments:read', 'payments:refund', 'payments:reconcile', 'payments:export',
    -- Cash Drawer (full)
    'cash_drawer:view', 'cash_drawer:open_session', 'cash_drawer:close_session',
    'cash_drawer:record_movement', 'cash_drawer:view_reports',
    -- Stored Value (full)
    'stored_value:view_balances', 'stored_value:view_ledger', 'stored_value:top_up_wallet',
    'stored_value:issue_advance', 'stored_value:issue_credit_note',
    -- Gift Cards
    'gift_cards:view_ledger',
    -- Loyalty (manage)
    'loyalty:manage_config', 'loyalty:view_config', 'loyalty:view_customer_points',
    -- Promotions (manage)
    'promotions:create', 'promotions:edit', 'promotions:view', 'promotions:activate_deactivate',
    -- Tax
    'tax:view_config', 'tax:view_reports',
    -- Reconciliation (full)
    'reconciliation:view', 'reconciliation:run', 'reconciliation:acknowledge_issues',
    -- Payment Config
    'payment_config:view',
    -- Finance Reports
    'finance_reports:view', 'finance_reports:export',
    -- Products / Catalog (manage)
    'products:create', 'products:read', 'products:update', 'products:publish',
    -- Pricing (manage)
    'pricing:create', 'pricing:read', 'pricing:update', 'pricing:history',
    -- Users & Roles
    'users:create', 'users:read', 'users:update', 'users:activate', 'users:assign_roles',
    'roles:create', 'roles:update',
    -- Settings
    'settings:read', 'settings:update', 'settings:workflow', 'settings:notifications', 'settings:branding',
    -- Integrations (read-only)
    'integrations:read',
    -- Branches (manage)
    'branches:create', 'branches:read', 'branches:update', 'branches:settings',
    -- Reports & Analytics (full)
    'reports:view_financial', 'reports:view_operational', 'reports:view_customer',
    'reports:export', 'reports:dashboard',
    -- Audit
    'audit:read', 'audit:export',
    -- Delivery oversight
    'delivery:assign', 'delivery:track', 'delivery:routes',
    'drivers:read', 'drivers:update'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── supervisor ──────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'supervisor'
  AND p.code IN (
    -- Orders (full operational, no financial approvals)
    'orders:create', 'orders:read', 'orders:update', 'orders:cancel', 'orders:assign',
    'orders:transition', 'orders:notes', 'orders:history', 'orders:urgent',
    'orders:print', 'orders:discount',
    -- Customers
    'customers:create', 'customers:read', 'customers:update', 'customers:history', 'customers:tags',
    -- Catalog (read-only)
    'products:read', 'pricing:read',
    -- Invoices (read + print)
    'invoices:read', 'invoices:print',
    -- Payments (read-only)
    'payments:read',
    -- Reports
    'reports:view_operational', 'reports:view_customer', 'reports:dashboard',
    -- Delivery oversight
    'drivers:read', 'delivery:track', 'delivery:assign',
    -- Branches (read-only)
    'branches:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── b2b_customer ────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'b2b_customer'
  AND p.code IN (
    'orders:read', 'orders:history', 'orders:print',
    'invoices:read', 'invoices:print',
    'payments:read',
    'reports:view_customer',
    'customers:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── it_support ──────────────────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'it_support'
  AND p.code IN (
    'users:read', 'users:activate', 'users:reset_password',
    'settings:read',
    'integrations:read', 'integrations:test', 'integrations:logs',
    'audit:read', 'logs:view',
    'branches:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );


-- ═══════════════════════════════════════════════════════════
-- STEP 3: Verification
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  v_role_count  INTEGER;
  v_perm_total  INTEGER;
  r             RECORD;
BEGIN
  SELECT COUNT(*) INTO v_role_count
  FROM sys_auth_roles
  WHERE code IN (
    'cashier', 'receptionist', 'laundry_worker', 'presser', 'qa_inspector',
    'store_keeper', 'driver', 'route_supervisor', 'accountant', 'finance_manager',
    'admin', 'supervisor', 'b2b_customer', 'it_support'
  )
  AND is_active = true;

  SELECT COUNT(*) INTO v_perm_total
  FROM sys_auth_role_default_permissions
  WHERE role_code IN (
    'cashier', 'receptionist', 'laundry_worker', 'presser', 'qa_inspector',
    'store_keeper', 'driver', 'route_supervisor', 'accountant', 'finance_manager',
    'admin', 'supervisor', 'b2b_customer', 'it_support'
  )
  AND is_active = true;

  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Migration 0374 — All Laundry Roles Complete';
  RAISE NOTICE 'Active roles: % / 14', v_role_count;
  RAISE NOTICE 'Total permission assignments: %', v_perm_total;
  RAISE NOTICE '══════════════════════════════════════════════════════';

  FOR r IN
    SELECT role_code, COUNT(*) AS cnt
    FROM sys_auth_role_default_permissions
    WHERE role_code IN (
      'cashier', 'receptionist', 'laundry_worker', 'presser', 'qa_inspector',
      'store_keeper', 'driver', 'route_supervisor', 'accountant', 'finance_manager',
      'admin', 'supervisor', 'b2b_customer', 'it_support'
    )
    AND is_active = true
    GROUP BY role_code
    ORDER BY role_code
  LOOP
    RAISE NOTICE '  %-20s  %s permissions', r.role_code, r.cnt;
  END LOOP;

  IF v_role_count < 14 THEN
    RAISE WARNING 'Only % / 14 roles active — some may have existed already (ON CONFLICT DO NOTHING)', v_role_count;
  END IF;
END $$;

COMMIT;
