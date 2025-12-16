-- 0035_rbac_seed_system_data.sql — RBAC System Data Seeding
-- Purpose: Seed system permissions, roles, and role-permission mappings
-- Author: CleanMateX Development Team
-- Created: 2025-01-XX
-- Dependencies: 0034_rbac_foundation.sql

BEGIN;

-- =========================
-- SEED SYSTEM PERMISSIONS (118+ permissions)
-- =========================

-- Orders Management (16 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('orders:create', 'Create Orders', 'إنشاء الطلبات', 'crud', 'Create new orders'),
('orders:read', 'View Orders', 'عرض الطلبات', 'crud', 'View orders'),
('orders:update', 'Edit Orders', 'تعديل الطلبات', 'crud', 'Edit order details'),
('orders:delete', 'Delete Orders', 'حذف الطلبات', 'crud', 'Delete orders'),
('orders:cancel', 'Cancel Orders', 'إلغاء الطلبات', 'actions', 'Cancel orders'),
('orders:split', 'Split Orders', 'تقسيم الطلبات', 'actions', 'Split orders'),
('orders:merge', 'Merge Orders', 'دمج الطلبات', 'actions', 'Merge orders'),
('orders:transition', 'Change Order Status', 'تغيير حالة الطلب', 'actions', 'Change order status'),
('orders:assign', 'Assign Orders', 'تعيين الطلبات', 'actions', 'Assign to staff/driver'),
('orders:export', 'Export Orders', 'تصدير الطلبات', 'export', 'Export order data'),
('orders:print', 'Print Orders', 'طباعة الطلبات', 'actions', 'Print receipts/labels'),
('orders:refund', 'Refund Orders', 'استرداد الطلبات', 'actions', 'Process refunds'),
('orders:discount', 'Apply Discounts', 'تطبيق الخصومات', 'actions', 'Apply discounts'),
('orders:notes', 'Add Notes', 'إضافة ملاحظات', 'actions', 'Add internal notes'),
('orders:history', 'View History', 'عرض السجل', 'crud', 'View full history'),
('orders:urgent', 'Mark Urgent', 'تعليم عاجل', 'actions', 'Mark as urgent')
ON CONFLICT (code) DO NOTHING;

-- Customers Management (10 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('customers:create', 'Create Customers', 'إنشاء العملاء', 'crud', 'Create customers'),
('customers:read', 'View Customers', 'عرض العملاء', 'crud', 'View customers'),
('customers:update', 'Edit Customers', 'تعديل العملاء', 'crud', 'Edit customer details'),
('customers:delete', 'Delete Customers', 'حذف العملاء', 'crud', 'Delete customers'),
('customers:export', 'Export Customers', 'تصدير العملاء', 'export', 'Export customer data'),
('customers:merge', 'Merge Customers', 'دمج العملاء', 'actions', 'Merge duplicate customers'),
('customers:upgrade', 'Upgrade Customer', 'ترقية العميل', 'actions', 'Upgrade customer profile'),
('customers:loyalty', 'Manage Loyalty', 'إدارة الولاء', 'actions', 'Manage loyalty points'),
('customers:tags', 'Manage Tags', 'إدارة العلامات', 'actions', 'Add/edit customer tags'),
('customers:history', 'View Customer History', 'عرض سجل العميل', 'crud', 'View order history')
ON CONFLICT (code) DO NOTHING;

-- Products & Catalog (8 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('products:create', 'Create Products', 'إنشاء المنتجات', 'crud', 'Create products/services'),
('products:read', 'View Catalog', 'عرض الكتالوج', 'crud', 'View catalog'),
('products:update', 'Edit Products', 'تعديل المنتجات', 'crud', 'Edit products'),
('products:delete', 'Delete Products', 'حذف المنتجات', 'crud', 'Delete products'),
('products:categories', 'Manage Categories', 'إدارة الفئات', 'management', 'Manage categories'),
('products:publish', 'Publish Products', 'نشر المنتجات', 'actions', 'Publish/unpublish'),
('products:stock', 'Manage Stock', 'إدارة المخزون', 'management', 'Manage stock levels'),
('products:export', 'Export Catalog', 'تصدير الكتالوج', 'export', 'Export catalog')
ON CONFLICT (code) DO NOTHING;

-- Pricing Management (7 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('pricing:create', 'Create Price Lists', 'إنشاء قوائم الأسعار', 'crud', 'Create price lists'),
('pricing:read', 'View Pricing', 'عرض الأسعار', 'crud', 'View pricing'),
('pricing:update', 'Update Prices', 'تحديث الأسعار', 'crud', 'Update prices'),
('pricing:delete', 'Delete Price Lists', 'حذف قوائم الأسعار', 'crud', 'Delete price lists'),
('pricing:tiers', 'Manage Pricing Tiers', 'إدارة مستويات الأسعار', 'management', 'Manage pricing tiers'),
('pricing:bulk', 'Bulk Price Updates', 'تحديثات الأسعار بالجملة', 'actions', 'Bulk price updates'),
('pricing:history', 'View Price History', 'عرض سجل الأسعار', 'crud', 'View price history')
ON CONFLICT (code) DO NOTHING;

-- Users & Roles (10 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('users:create', 'Create Users', 'إنشاء المستخدمين', 'crud', 'Create users'),
('users:read', 'View Users', 'عرض المستخدمين', 'crud', 'View users'),
('users:update', 'Edit Users', 'تعديل المستخدمين', 'crud', 'Edit user details'),
('users:delete', 'Delete Users', 'حذف المستخدمين', 'crud', 'Delete users'),
('users:activate', 'Activate Users', 'تفعيل المستخدمين', 'actions', 'Activate/deactivate'),
('users:assign_roles', 'Assign Roles', 'تعيين الأدوار', 'management', 'Assign roles'),
('users:reset_password', 'Reset Passwords', 'إعادة تعيين كلمات المرور', 'actions', 'Reset passwords'),
('roles:create', 'Create Roles', 'إنشاء الأدوار', 'crud', 'Create custom roles'),
('roles:update', 'Edit Roles', 'تعديل الأدوار', 'crud', 'Edit roles'),
('roles:delete', 'Delete Roles', 'حذف الأدوار', 'crud', 'Delete custom roles')
ON CONFLICT (code) DO NOTHING;

-- Invoices & Billing (9 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('invoices:create', 'Generate Invoices', 'إنشاء الفواتير', 'crud', 'Generate invoices'),
('invoices:read', 'View Invoices', 'عرض الفواتير', 'crud', 'View invoices'),
('invoices:update', 'Edit Invoices', 'تعديل الفواتير', 'crud', 'Edit invoices'),
('invoices:void', 'Void Invoices', 'إلغاء الفواتير', 'actions', 'Void invoices'),
('invoices:send', 'Send Invoices', 'إرسال الفواتير', 'actions', 'Send to customer'),
('invoices:print', 'Print Invoices', 'طباعة الفواتير', 'actions', 'Print invoices'),
('invoices:export', 'Export Invoices', 'تصدير الفواتير', 'export', 'Export invoice data'),
('invoices:credit_note', 'Issue Credit Notes', 'إصدار إشعارات الائتمان', 'actions', 'Issue credit notes'),
('invoices:recurring', 'Manage Recurring', 'إدارة المتكررة', 'management', 'Manage recurring invoices')
ON CONFLICT (code) DO NOTHING;

-- Payments (7 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('payments:create', 'Record Payments', 'تسجيل المدفوعات', 'crud', 'Record payments'),
('payments:read', 'View Payments', 'عرض المدفوعات', 'crud', 'View payments'),
('payments:refund', 'Process Refunds', 'معالجة الاسترداد', 'actions', 'Process refunds'),
('payments:void', 'Void Payments', 'إلغاء المدفوعات', 'actions', 'Void payments'),
('payments:reconcile', 'Reconcile Payments', 'تسوية المدفوعات', 'actions', 'Reconcile payments'),
('payments:export', 'Export Payments', 'تصدير المدفوعات', 'export', 'Export payment data'),
('payments:methods', 'Manage Payment Methods', 'إدارة طرق الدفع', 'management', 'Manage payment methods')
ON CONFLICT (code) DO NOTHING;

-- Reports & Analytics (12 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('reports:view_financial', 'View Financial Reports', 'عرض التقارير المالية', 'reports', 'View financial reports'),
('reports:view_operational', 'View Operational Reports', 'عرض التقارير التشغيلية', 'reports', 'View operational reports'),
('reports:view_customer', 'View Customer Reports', 'عرض تقارير العملاء', 'reports', 'View customer reports'),
('reports:view_staff', 'View Staff Reports', 'عرض تقارير الموظفين', 'reports', 'View staff reports'),
('reports:export', 'Export Reports', 'تصدير التقارير', 'export', 'Export reports'),
('reports:schedule', 'Schedule Reports', 'جدولة التقارير', 'management', 'Schedule reports'),
('reports:custom', 'Create Custom Reports', 'إنشاء تقارير مخصصة', 'management', 'Create custom reports'),
('reports:dashboard', 'View Dashboard', 'عرض لوحة المعلومات', 'reports', 'View dashboard'),
('analytics:view', 'View Analytics', 'عرض التحليلات', 'analytics', 'View analytics'),
('analytics:export', 'Export Analytics', 'تصدير التحليلات', 'export', 'Export analytics'),
('analytics:kpi', 'View KPIs', 'عرض مؤشرات الأداء', 'analytics', 'View KPIs'),
('analytics:trends', 'View Trends', 'عرض الاتجاهات', 'analytics', 'View trend analysis')
ON CONFLICT (code) DO NOTHING;

-- Settings & Configuration (15 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('settings:read', 'View Settings', 'عرض الإعدادات', 'crud', 'View settings'),
('settings:update', 'Update Settings', 'تحديث الإعدادات', 'crud', 'Update settings'),
('settings:organization', 'Org Settings', 'إعدادات المؤسسة', 'management', 'Organization settings'),
('settings:billing', 'Billing Settings', 'إعدادات الفوترة', 'management', 'Billing settings'),
('settings:workflow', 'Workflow Config', 'إعدادات سير العمل', 'management', 'Workflow configuration'),
('settings:notifications', 'Notification Settings', 'إعدادات الإشعارات', 'management', 'Notification settings'),
('settings:integrations', 'Integration Config', 'إعدادات التكامل', 'management', 'Integration configuration'),
('settings:branding', 'Branding Settings', 'إعدادات العلامة التجارية', 'management', 'Branding settings'),
('settings:security', 'Security Settings', 'إعدادات الأمان', 'management', 'Security settings'),
('settings:api', 'API Settings', 'إعدادات API', 'management', 'API settings'),
('settings:webhooks', 'Webhook Config', 'إعدادات Webhooks', 'management', 'Webhook configuration'),
('settings:subscription', 'Subscription Mgmt', 'إدارة الاشتراك', 'management', 'Subscription management'),
('settings:features', 'Feature Flags', 'علامات الميزات', 'management', 'Feature flags'),
('settings:localization', 'Localization', 'الترجمة', 'management', 'Language/timezone settings'),
('settings:tax', 'Tax Configuration', 'إعدادات الضرائب', 'management', 'Tax configuration')
ON CONFLICT (code) DO NOTHING;

-- Drivers & Delivery (8 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('drivers:create', 'Create Drivers', 'إنشاء السائقين', 'crud', 'Create driver profiles'),
('drivers:read', 'View Drivers', 'عرض السائقين', 'crud', 'View drivers'),
('drivers:update', 'Edit Drivers', 'تعديل السائقين', 'crud', 'Edit driver details'),
('drivers:delete', 'Delete Drivers', 'حذف السائقين', 'crud', 'Delete drivers'),
('delivery:assign', 'Assign Deliveries', 'تعيين عمليات التسليم', 'actions', 'Assign deliveries'),
('delivery:track', 'Track Deliveries', 'تتبع عمليات التسليم', 'actions', 'Track deliveries'),
('delivery:routes', 'Manage Routes', 'إدارة المسارات', 'management', 'Manage routes'),
('delivery:pod', 'Proof of Delivery', 'إثبات التسليم', 'actions', 'Proof of delivery')
ON CONFLICT (code) DO NOTHING;

-- Branches (6 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('branches:create', 'Create Branches', 'إنشاء الفروع', 'crud', 'Create branches'),
('branches:read', 'View Branches', 'عرض الفروع', 'crud', 'View branches'),
('branches:update', 'Edit Branches', 'تعديل الفروع', 'crud', 'Edit branches'),
('branches:delete', 'Delete Branches', 'حذف الفروع', 'crud', 'Delete branches'),
('branches:transfer', 'Transfer Orders', 'نقل الطلبات', 'actions', 'Transfer orders/items'),
('branches:settings', 'Branch Settings', 'إعدادات الفرع', 'management', 'Branch settings')
ON CONFLICT (code) DO NOTHING;

-- Integrations (6 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('integrations:read', 'View Integrations', 'عرض التكاملات', 'crud', 'View integrations'),
('integrations:create', 'Add Integrations', 'إضافة التكاملات', 'crud', 'Add integrations'),
('integrations:update', 'Edit Integrations', 'تعديل التكاملات', 'crud', 'Edit integrations'),
('integrations:delete', 'Remove Integrations', 'إزالة التكاملات', 'crud', 'Remove integrations'),
('integrations:test', 'Test Connections', 'اختبار الاتصالات', 'actions', 'Test connections'),
('integrations:logs', 'View Integration Logs', 'عرض سجلات التكامل', 'crud', 'View integration logs')
ON CONFLICT (code) DO NOTHING;

-- Audit & Logs (4 permissions)
INSERT INTO sys_auth_permissions (code, name, name2, category, description) VALUES
('audit:read', 'View Audit Logs', 'عرض سجلات التدقيق', 'crud', 'View audit logs'),
('audit:export', 'Export Audit Logs', 'تصدير سجلات التدقيق', 'export', 'Export audit logs'),
('logs:view', 'View System Logs', 'عرض سجلات النظام', 'crud', 'View system logs'),
('logs:export', 'Export Logs', 'تصدير السجلات', 'export', 'Export logs')
ON CONFLICT (code) DO NOTHING;

-- =========================
-- SEED SYSTEM ROLES
-- =========================

INSERT INTO sys_auth_roles (code, name, name2, description, is_system) VALUES
('super_admin', 'Super Administrator', 'المدير العام', 'Platform administrator with all permissions across all tenants', true),
('tenant_admin', 'Tenant Administrator', 'مدير المستأجر', 'Tenant owner with all permissions within tenant', true),
('branch_manager', 'Branch Manager', 'مدير الفرع', 'Branch supervisor with branch-scoped permissions', true),
('operator', 'Operator', 'مشغل', 'Standard worker with operational permissions', true),
('viewer', 'Viewer', 'عارض', 'Read-only access to view data', true)
ON CONFLICT (code) DO NOTHING;

-- =========================
-- MAP PERMISSIONS TO ROLES
-- =========================

-- Helper function to assign permissions to a role
DO $$
DECLARE
  role_id_var UUID;
  perm_code_var TEXT;
BEGIN
  -- Super Admin: All permissions (wildcard conceptually, but we'll assign all)
  SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'super_admin';
  
  -- Assign all permissions to super_admin
  FOR perm_code_var IN SELECT code FROM sys_auth_permissions LOOP
    INSERT INTO sys_auth_role_default_permissions (role_id, permission_id)
    SELECT role_id_var, permission_id
    FROM sys_auth_permissions
    WHERE code = perm_code_var
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Tenant Admin: All tenant permissions (all except super_admin specific)
  SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'tenant_admin';
  
  -- Assign all permissions to tenant_admin (same as super_admin for now, scope handled by RLS)
  FOR perm_code_var IN SELECT code FROM sys_auth_permissions LOOP
    INSERT INTO sys_auth_role_default_permissions (role_id, permission_id)
    SELECT role_id_var, permission_id
    FROM sys_auth_permissions
    WHERE code = perm_code_var
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Branch Manager: Branch-scoped operational permissions
  SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'branch_manager';
  
  INSERT INTO sys_auth_role_default_permissions (role_id, permission_id)
  SELECT role_id_var, permission_id FROM sys_auth_permissions
  WHERE code IN (
    -- Orders (most operations)
    'orders:create', 'orders:read', 'orders:update', 'orders:cancel', 'orders:split',
    'orders:transition', 'orders:assign', 'orders:print', 'orders:discount', 'orders:notes',
    'orders:history', 'orders:urgent',
    -- Customers
    'customers:create', 'customers:read', 'customers:update', 'customers:merge',
    'customers:upgrade', 'customers:tags', 'customers:history',
    -- Products (read-only)
    'products:read', 'products:stock',
    -- Pricing (read-only)
    'pricing:read', 'pricing:history',
    -- Users (read-only)
    'users:read',
    -- Invoices
    'invoices:create', 'invoices:read', 'invoices:update', 'invoices:send', 'invoices:print',
    -- Payments
    'payments:create', 'payments:read', 'payments:reconcile',
    -- Reports
    'reports:view_financial', 'reports:view_operational', 'reports:view_customer',
    'reports:view_staff', 'reports:dashboard', 'analytics:view', 'analytics:kpi', 'analytics:trends',
    -- Settings (read-only)
    'settings:read', 'settings:notifications',
    -- Drivers & Delivery
    'drivers:create', 'drivers:read', 'drivers:update', 'delivery:assign', 'delivery:track',
    'delivery:routes', 'delivery:pod',
    -- Branches (read-only)
    'branches:read', 'branches:transfer', 'branches:settings'
  )
  ON CONFLICT DO NOTHING;

  -- Operator: Operational permissions
  SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'operator';
  
  INSERT INTO sys_auth_role_default_permissions (role_id, permission_id)
  SELECT role_id_var, permission_id FROM sys_auth_permissions
  WHERE code IN (
    -- Orders (operational)
    'orders:create', 'orders:read', 'orders:update', 'orders:split', 'orders:transition',
    'orders:print', 'orders:discount', 'orders:notes', 'orders:history', 'orders:urgent',
    -- Customers
    'customers:create', 'customers:read', 'customers:update', 'customers:upgrade',
    'customers:tags', 'customers:history',
    -- Products (read-only)
    'products:read',
    -- Pricing (read-only)
    'pricing:read',
    -- Invoices
    'invoices:create', 'invoices:read', 'invoices:send', 'invoices:print',
    -- Payments
    'payments:create', 'payments:read',
    -- Reports (operational)
    'reports:view_operational', 'reports:view_customer', 'reports:dashboard',
    -- Drivers & Delivery
    'drivers:read', 'delivery:assign', 'delivery:track', 'delivery:pod'
  )
  ON CONFLICT DO NOTHING;

  -- Viewer: Read-only permissions
  SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'viewer';
  
  INSERT INTO sys_auth_role_default_permissions (role_id, permission_id)
  SELECT role_id_var, permission_id FROM sys_auth_permissions
  WHERE code IN (
    -- Orders (read-only)
    'orders:read', 'orders:history',
    -- Customers (read-only)
    'customers:read', 'customers:history',
    -- Products (read-only)
    'products:read',
    -- Pricing (read-only)
    'pricing:read', 'pricing:history',
    -- Invoices (read-only)
    'invoices:read',
    -- Payments (read-only)
    'payments:read',
    -- Reports (read-only)
    'reports:view_financial', 'reports:view_operational', 'reports:view_customer',
    'reports:dashboard', 'analytics:view', 'analytics:kpi', 'analytics:trends',
    -- Drivers (read-only)
    'drivers:read', 'delivery:track',
    -- Branches (read-only)
    'branches:read'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- =========================
-- VALIDATION
-- =========================

DO $$
DECLARE
  perm_count INTEGER;
  role_count INTEGER;
  mapping_count INTEGER;
BEGIN
  -- Verify permissions were seeded
  SELECT COUNT(*) INTO perm_count FROM sys_auth_permissions;
  ASSERT perm_count >= 118, format('Expected at least 118 permissions, got %s', perm_count);

  -- Verify roles were seeded
  SELECT COUNT(*) INTO role_count FROM sys_auth_roles WHERE is_system = true;
  ASSERT role_count = 5, format('Expected 5 system roles, got %s', role_count);

  -- Verify role-permission mappings
  SELECT COUNT(*) INTO mapping_count FROM sys_auth_role_default_permissions;
  ASSERT mapping_count > 0, 'No role-permission mappings found';

  RAISE NOTICE '✅ RBAC system data seeded successfully';
  RAISE NOTICE '   Permissions: %', perm_count;
  RAISE NOTICE '   System Roles: %', role_count;
  RAISE NOTICE '   Role-Permission Mappings: %', mapping_count;
END $$;


--======

Update sys_auth_permissions m
set feature_code=  s.codd
, category_main=s.codd
from(
select  code, (INITCAP(SUBSTRING(code FROM 1 FOR POSITION(':' IN code)-1))) codd
from sys_auth_permissions
) s
where m.code=s.code
--and m.feature_code is null
;

--=====-
COMMIT;

