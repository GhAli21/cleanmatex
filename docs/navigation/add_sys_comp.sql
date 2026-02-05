-- =====================================================
-- Add New Navigation Components for Pricing Feature
-- Date: 2026-01-27
-- Feature: Pricing System - UI Navigation
-- =====================================================

BEGIN;

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
  '["admin"]'::jsonb,
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
-- Verification Queries
-- =====================================================
-- Uncomment to verify inserts:
-- SELECT comp_code, label, label2, comp_path, display_order, is_navigable
-- FROM sys_components_cd
-- WHERE comp_code IN ('settings_finance', 'catalog_pricing_detail', 'catalog_pricing', 'billing_payments_new', 'billing_payments_detail')
-- ORDER BY comp_code;

COMMIT;
