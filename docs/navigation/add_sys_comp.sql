-- =====================================================
-- Add New Navigation Components for Pricing Feature
-- Date: 2026-01-27
-- Feature: Pricing System - UI Navigation
-- =====================================================

BEGIN;

INSERT INTO public.sys_components_cd (comp_code, parent_comp_code, label, label2, description, description2, comp_level, comp_path, feature_code, main_permission_code, role_code, screen_code, badge, display_order, is_leaf, is_navigable, is_active, is_system, is_for_tenant_use, roles, permissions, require_all_permissions, feature_flag, metadata, comp_value1, comp_value2, comp_value3, comp_value4, comp_value5, color1, color2, color3, comp_icon, comp_image, rec_order, rec_notes, rec_status, created_at, created_by, created_info, updated_at, updated_by, updated_info) 
VALUES ('orders_packing', 'orders', 'Orders Packing', 'تعبئة الطلبات', NULL, NULL, 1, '/dashboard/packing', NULL, 'orders:read', NULL, NULL, NULL, 10, false, true, true, true, true, '["''super_admin''", "''tenant_admin''", "''admin''", "''operator''"]', '[]', false, '[]', '{}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Boxes', NULL, NULL, NULL, 1, '2026-01-15 21:30:00.658385', 'SYSTEM_USER', NULL, '2026-01-15 21:30:53.244', 'SYSTEM_USER', NULL) ;

INSERT INTO public.sys_components_cd (comp_code, parent_comp_code, label, label2, description, description2, comp_level, comp_path, feature_code, main_permission_code, role_code, screen_code, badge, display_order, is_leaf, is_navigable, is_active, is_system, is_for_tenant_use, roles, permissions, require_all_permissions, feature_flag, metadata, comp_value1, comp_value2, comp_value3, comp_value4, comp_value5, color1, color2, color3, comp_icon, comp_image, rec_order, rec_notes, rec_status, created_at, created_by, created_info, updated_at, updated_by, updated_info) 
VALUES ('orders_delivery', 'orders', 'Orders Delivery', 'تسليم الطلبات', NULL, NULL, 1, '/dashboard/delivery', NULL, 'orders:read', NULL, NULL, NULL, 11, false, true, true, true, true, '[]', '[]', false, '[]', '{}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Truck', NULL, NULL, NULL, 1, '2026-01-15 21:32:12.263608', 'SYSTEM_USER', NULL, NULL, NULL, NULL) ;

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'orders'
  AND p.comp_code = 'orders';


-- =====================================================
-- 1. Finance Settings Page
-- =====================================================
-- Add Finance settings page under Settings parent
-- Display order: 6 (after Subscription which is 5)
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'settings_finance',
  'settings',
  'Finance',
  'المالية',
  'Configure financial settings including tax rates and tax types',
  'تكوين الإعدادات المالية بما في ذلك معدلات الضرائب وأنواع الضرائب',
  '/dashboard/settings/finance',
  'DollarSign',
  1,
  6,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb,
  'settings:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for finance settings
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'settings_finance'
  AND c.parent_comp_code = 'settings'
  AND p.comp_code = 'settings';

-- =====================================================
-- 2. Price List Detail Page (Dynamic Route)
-- =====================================================
-- Note: This is a dynamic route [id], so it's not directly navigable
-- but we add it for reference and potential future use
-- The main pricing list page is already in navigation as 'catalog_pricing'
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  metadata,
  rec_status
) VALUES (
  'catalog_pricing_detail',
  'catalog_pricing',
  'Price List Details',
  'تفاصيل قائمة الأسعار',
  'View and edit price list details, items, and history',
  'عرض وتعديل تفاصيل قائمة الأسعار والعناصر والتاريخ',
  '/dashboard/catalog/pricing/[id]',
  'FileText',
  2,
  0,
  true,
  false, -- Not directly navigable (dynamic route)
  true,
  true,
  true,
  '["admin"]'::jsonb,
  'catalog:read',
  '{"isDynamicRoute": true, "routeParam": "id"}'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for price list detail
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'catalog_pricing_detail'
  AND c.parent_comp_code = 'catalog_pricing'
  AND p.comp_code = 'catalog_pricing';

-- The main pricing list page already exists, but we update it with bilingual labels
UPDATE sys_components_cd
SET 
  label2 = 'التسعير',
  description = 'Manage price lists, product pricing, and quantity tiers',
  description2 = 'إدارة قوائم الأسعار وأسعار المنتجات ومستويات الكمية',
  comp_icon = 'DollarSign', -- Update icon to be more specific
  updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'catalog_pricing';

-- =====================================================
-- 4. Invoices Section Under Billing
-- =====================================================
-- The billing root and its children are seeded in 0058_navigation_seed.sql
-- Here we ensure a dedicated invoices node under billing that matches
-- the new `/dashboard/invoices` route used in web-admin.

INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'billing_invoices_v2',
  'billing',
  'Invoices',
  'الفواتير',
  'View and manage customer invoices and balances',
  'عرض وإدارة فواتير العملاء والأرصدة المتبقية',
  '/dashboard/invoices',
  'Receipt',
  1,
  0,
  true,
  true,
  true,
  true,
  true,
  '["admin", "operator"]'::jsonb,
  'billing:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Link invoices node to billing parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'billing_invoices_v2'
  AND c.parent_comp_code = 'billing'
  AND p.comp_code = 'billing';

-- =====================================================
-- 5. Payments: New Payment Page (Create standalone payment)
-- =====================================================
-- Child of billing_payments; navigable route for "New Payment"
-- Date: 2026-01-30
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'billing_payments_new',
  'billing_payments',
  'New Payment',
  'دفعة جديدة',
  'Create a new standalone payment (invoice, deposit, advance, or POS)',
  'إنشاء دفعة مستقلة جديدة (فاتورة، عربون، دفعة مسبقة، أو نقطة بيع)',
  '/dashboard/billing/payments/new',
  'Plus',
  2,
  0,
  true,
  true,
  true,
  true,
  true,
  '["admin", "operator"]'::jsonb,
  'billing:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'billing_payments_new'
  AND c.parent_comp_code = 'billing_payments'
  AND p.comp_code = 'billing_payments';

-- =====================================================
-- 6. Payments: Payment Detail Page (Dynamic route [id])
-- =====================================================
-- Not directly navigable; for breadcrumb/reference
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  metadata,
  rec_status
) VALUES (
  'billing_payments_detail',
  'billing_payments',
  'Payment Details',
  'تفاصيل الدفعة',
  'View payment details, notes, cancel or refund',
  'عرض تفاصيل الدفعة والملاحظات والإلغاء أو الاسترداد',
  '/dashboard/billing/payments/[id]',
  'FileText',
  2,
  1,
  true,
  false,
  true,
  true,
  true,
  '["admin", "operator"]'::jsonb,
  'billing:read',
  '{"isDynamicRoute": true, "routeParam": "id"}'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'billing_payments_detail'
  AND c.parent_comp_code = 'billing_payments'
  AND p.comp_code = 'billing_payments';

-- Ensure parent Payments node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'billing_payments';

-- =====================================================
-- 7. Reports & Analytics (parent + children)
-- =====================================================
-- Make reports a node (is_leaf = false) and add child screens.
-- Parent already exists in 0059_navigation_seed; update and add children.
-- Feature: advanced_analytics; roles: admin
UPDATE sys_components_cd
SET
  label2 = 'التقارير والتحليلات',
  description = 'Reports and analytics for orders, payments, invoices, revenue, and customers',
  description2 = 'التقارير والتحليلات للطلبات والمدفوعات والفواتير والإيرادات والعملاء',
  is_leaf = false,
  updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'reports';

-- Reports children: Orders & Sales, Payments, Invoices, Revenue, Customers
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES
  (
    'reports_orders',
    'reports',
    'Orders & Sales',
    'الطلبات والمبيعات',
    'Orders and sales reports',
    'تقارير الطلبات والمبيعات',
    '/dashboard/reports/orders',
    'BarChart3',
    1,
    0,
    true,
    true,
    true,
    true,
    true,
    '["super_admin", "tenant_admin", "operator", "viewer"]'::jsonb,
    'settings:read',
    '["advanced_analytics"]'::jsonb,
    1
  ),
  (
    'reports_payments',
    'reports',
    'Payments',
    'المدفوعات',
    'Payments reports',
    'تقارير المدفوعات',
    '/dashboard/reports/payments',
    'BarChart3',
    1,
    1,
    true,
    true,
    true,
    true,
    true,
    '["super_admin", "tenant_admin", "operator", "viewer"]'::jsonb,
    'settings:read',
    '["advanced_analytics"]'::jsonb,
    1
  ),
  (
    'reports_invoices',
    'reports',
    'Invoices',
    'الفواتير',
    'Invoices reports',
    'تقارير الفواتير',
    '/dashboard/reports/invoices',
    'BarChart3',
    1,
    2,
    true,
    true,
    true,
    true,
    true,
    '["super_admin", "tenant_admin", "operator", "viewer"]'::jsonb,
    'settings:read',
    '["advanced_analytics"]'::jsonb,
    1
  ),
  (
    'reports_revenue',
    'reports',
    'Revenue',
    'الإيرادات',
    'Revenue reports',
    'تقارير الإيرادات',
    '/dashboard/reports/revenue',
    'BarChart3',
    1,
    3,
    true,
    true,
    true,
    true,
    true,
    '["super_admin", "tenant_admin", "operator", "viewer"]'::jsonb,
    'settings:read',
    '["advanced_analytics"]'::jsonb,
    1
  ),
  (
    'reports_customers',
    'reports',
    'Customers',
    'العملاء',
    'Customers reports',
    'تقارير العملاء',
    '/dashboard/reports/customers',
    'BarChart3',
    1,
    4,
    true,
    true,
    true,
    true,
    true,
    '["super_admin", "tenant_admin", "operator", "viewer"]'::jsonb,
    'settings:read',
    '["advanced_analytics"]'::jsonb,
    1
  )
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- Set parent_comp_id for all reports children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'reports'
  AND p.comp_code = 'reports'
  AND c.parent_comp_id IS DISTINCT FROM p.comp_id;

-- Ensure parent Reports node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'reports';

-- =====================================================
-- 8. Receipt Vouchers Under Billing
-- =====================================================
-- Add Receipt Vouchers page under billing parent
-- Display order: 1 (between invoices 0 and payments 1)
-- Date: 2026-02-07
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'billing_vouchers',
  'billing',
  'Receipt Vouchers',
  'إيصالات الدفع',
  'View and manage receipt vouchers',
  'عرض وإدارة إيصالات الدفع',
  '/dashboard/billing/vouchers',
  'Receipt',
  1,
  1,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  'billing:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  updated_at = CURRENT_TIMESTAMP;

-- Link vouchers node to billing parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'billing_vouchers'
  AND c.parent_comp_code = 'billing'
  AND p.comp_code = 'billing';

-- Update display_order for existing billing children to maintain order:
-- vouchers = 1, payments = 2, cashup = 3
UPDATE sys_components_cd
SET display_order = 2,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'billing_payments';

UPDATE sys_components_cd
SET display_order = 3,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'billing_cashup';

-- =====================================================
-- 9. Inventory & Machines (Parent + Children)
-- =====================================================
-- Update/Add Inventory parent and its children (Stock and Machines)
-- Date: 2026-02-07

-- Update parent Inventory node
UPDATE sys_components_cd
SET
  label2 = 'المخزون والآلات',
  description = 'Manage inventory stock and machines',
  description2 = 'إدارة مخزون المواد والآلات',
  comp_icon = 'Boxes',
  is_leaf = false,
  roles = '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'inventory';

-- Add/Update inventory_stock child
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'inventory_stock',
  'inventory',
  'Stock',
  'المخزون',
  'Manage inventory stock levels and adjustments',
  'إدارة مستويات المخزون والتعديلات',
  '/dashboard/inventory/stock',
  'Boxes',
  1,
  0,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  'inventory:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  updated_at = CURRENT_TIMESTAMP;

-- Add/Update inventory_machines child
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'inventory_machines',
  'inventory',
  'Machines',
  'الآلات',
  'Manage machines and equipment',
  'إدارة الآلات والمعدات',
  '/dashboard/inventory/machines',
  'Boxes',
  1,
  1,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  'inventory:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  updated_at = CURRENT_TIMESTAMP;

-- Link children to inventory parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'inventory'
  AND p.comp_code = 'inventory'
  AND c.parent_comp_id IS DISTINCT FROM p.comp_id;

-- Ensure parent Inventory node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'inventory';

-- =====================================================
-- 10. Delivery (standalone root)
-- =====================================================
-- Add Delivery as root-level nav item (between drivers and customers)
-- Path: /dashboard/delivery; roles: admin, operator
-- Date: 2026-02-13
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'delivery',
  NULL,
  'Delivery',
  'التوصيل',
  'Delivery management and tracking',
  'إدارة التوصيل وتتبعه',
  '/dashboard/delivery',
  'Truck',
  0,
  4,
  true,
  true,
  true,
  true,
  true,
  '["admin", "operator"]'::jsonb,
  'orders:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- Bump display_order for siblings after delivery (customers, catalog, billing, reports, inventory, settings, help, jhtestui)
UPDATE sys_components_cd SET display_order = 6, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'customers';
UPDATE sys_components_cd SET display_order = 7, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'catalog';
UPDATE sys_components_cd SET display_order = 8, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'billing';
UPDATE sys_components_cd SET display_order = 9, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'reports';
UPDATE sys_components_cd SET display_order = 10, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'inventory';
UPDATE sys_components_cd SET display_order = 11, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'settings';
UPDATE sys_components_cd SET display_order = 12, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'help';
UPDATE sys_components_cd SET display_order = 13, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'jhtestui';

-- =====================================================
-- 10b. Users / Team Members (root + child)
-- =====================================================
-- Add Users as root-level nav (standalone Team Members at /dashboard/users)
-- Between delivery and customers
-- Date: 2026-02-13
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'users',
  NULL,
  'Team Members',
  'أعضاء الفريق',
  'Manage team members and user access',
  'إدارة أعضاء الفريق والوصول',
  '/dashboard/users',
  'Users',
  0,
  5,
  false,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb,
  'users:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  is_leaf = EXCLUDED.is_leaf,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'users_list',
  'users',
  'All Users',
  'جميع المستخدمين',
  'View and manage all team members',
  'عرض وإدارة جميع أعضاء الفريق',
  '/dashboard/users',
  'Users',
  1,
  0,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb,
  'users:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  parent_comp_code = EXCLUDED.parent_comp_code,
  updated_at = CURRENT_TIMESTAMP;

-- Link users_list to users parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'users_list'
  AND c.parent_comp_code = 'users'
  AND p.comp_code = 'users';

-- Ensure parent Users node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'users';

-- =====================================================
-- 11. Settings Permissions (child of settings)
-- =====================================================
-- Add Permissions page under Settings parent
-- Display order: 3 (after Roles & Permissions which is 2)
-- Date: 2026-02-13
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'settings_permissions',
  'settings',
  'Permissions',
  'الصلاحيات',
  'Manage granular permissions and access control',
  'إدارة الصلاحيات التفصيلية والتحكم في الوصول',
  '/dashboard/settings/permissions',
  'Shield',
  1,
  3,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  'settings:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  updated_at = CURRENT_TIMESTAMP;

-- Link settings_permissions to settings parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'settings_permissions'
  AND c.parent_comp_code = 'settings'
  AND p.comp_code = 'settings';

-- Bump display_order for settings children after permissions (workflow_roles, branding, subscription, finance)
UPDATE sys_components_cd SET display_order = 4, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'settings_workflow_roles';
UPDATE sys_components_cd SET display_order = 5, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'settings_branding';
UPDATE sys_components_cd SET display_order = 6, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'settings_subscription';
UPDATE sys_components_cd SET display_order = 7, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'settings_finance';

-- Ensure parent Settings node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'settings';

UPDATE sys_components_cd
SET
  label = 'AssemblyJh',
  roles = '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'assembly';

-- =====================================================
-- 13. Settings - All Settings aggregate screen
-- =====================================================
-- New leaf screen under Settings for the consolidated
-- /dashboard/settings route. Visible only to super_admin.

INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'settings_all',
  'settings',
  'All Settings',
  'كل الإعدادات',
  'View all tenant, branch, user settings and related configuration in a single consolidated screen',
  'عرض جميع إعدادات المستأجر والفروع والمستخدمين والتكوينات ذات الصلة في شاشة موحدة واحدة',
  '/dashboard/settings',
  'SlidersHorizontal',
  1,
  8,
  true,
  true,
  true,
  true,
  true,
  '["super_admin"]'::jsonb,
  'settings:read',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  updated_at = CURRENT_TIMESTAMP;

-- Link settings_all to Settings parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'settings_all'
  AND c.parent_comp_code = 'settings'
  AND p.comp_code = 'settings';

-- =====================================================
-- Verification Queries
-- =====================================================
-- Uncomment to verify inserts:
-- SELECT comp_code, label, label2, comp_path, display_order, is_navigable
-- FROM sys_components_cd
-- WHERE comp_code IN (
--   'delivery',
--   'users',
--   'users_list',
--   'settings_permissions',
--   'settings_all',
--   'assembly',
--   'settings_finance',
--   'catalog_pricing_detail',
--   'catalog_pricing',
--   'billing_payments_new',
--   'billing_payments_detail',
--   'billing_vouchers',
--   'inventory',
--   'inventory_stock',
--   'inventory_machines'
-- )
-- ORDER BY comp_level, display_order, comp_code;

COMMIT;
