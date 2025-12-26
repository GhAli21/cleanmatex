-- ==================================================================
-- 0058_navigation_seed.sql
-- Purpose: Seed sys_components_cd table with navigation items from NAVIGATION_SECTIONS
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- Dependencies: 0058_sys_components_cd_navigation.sql
-- ==================================================================
-- This seed script populates navigation items from the hardcoded NAVIGATION_SECTIONS
-- ==================================================================

BEGIN;

-- Clear existing navigation items (if re-seeding)
-- DELETE FROM sys_components_cd WHERE is_system = true;

-- Insert navigation sections and their children
-- Note: This is a manual seed based on NAVIGATION_SECTIONS structure

-- 1. Home (Dashboard)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'home', 'Dashboard', '/dashboard', 'Home', 0, 0,
  true, true, true, true, true,
  '["admin", "operator"]'::jsonb, NULL, 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- 2. Orders (with children)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'orders', 'Orders', '/dashboard/orders', 'PackageSearch', 0, 1,
  false, true, true, true, true,
  '["admin", "operator"]'::jsonb, 'orders:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- Orders children
INSERT INTO sys_components_cd (
  comp_code, parent_comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES
  ('orders_list', 'orders', 'All Orders', '/dashboard/orders', 'PackageSearch', 1, 0,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:read', 1),
  ('orders_new', 'orders', 'New Order', '/dashboard/orders/new', 'PackageSearch', 1, 1,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:create', 1),
  ('orders_preparation', 'orders', 'Preparation', '/dashboard/preparation', 'PackageSearch', 1, 2,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:read', 1),
  ('orders_processing', 'orders', 'Processing', '/dashboard/processing', 'PackageSearch', 1, 3,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:read', 1),
  ('orders_assembly', 'orders', 'Assembly', '/dashboard/assembly', 'PackageSearch', 1, 4,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:read', 1),
  ('orders_qa', 'orders', 'Quality Check', '/dashboard/qa', 'PackageSearch', 1, 5,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:read', 1),
  ('orders_ready', 'orders', 'Ready', '/dashboard/ready', 'PackageSearch', 1, 6,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'orders:read', 1)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  display_order = EXCLUDED.display_order,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for orders children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'orders'
  AND p.comp_code = 'orders';

-- 3. Assembly
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'assembly', 'Assembly', '/dashboard/assembly', 'ScanBarcode', 0, 2,
  true, true, true, true, true,
  '["admin", "operator"]'::jsonb, 'orders:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- 4. Drivers & Routes (with feature flag)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, feature_flag, rec_status
) VALUES (
  'drivers', 'Drivers & Routes', '/dashboard/drivers', 'Truck', 0, 3,
  false, true, true, true, true,
  '["admin"]'::jsonb, 'drivers:read', '["driver_app"]'::jsonb, 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- Drivers children
INSERT INTO sys_components_cd (
  comp_code, parent_comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, feature_flag, rec_status
) VALUES
  ('drivers_list', 'drivers', 'All Drivers', '/dashboard/drivers', 'Truck', 1, 0,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'drivers:read', '["driver_app"]'::jsonb, 1),
  ('drivers_routes', 'drivers', 'Routes', '/dashboard/drivers/routes', 'Truck', 1, 1,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'drivers:read', '["driver_app"]'::jsonb, 1)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for drivers children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'drivers'
  AND p.comp_code = 'drivers';

-- 5. Customers
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'customers', 'Customers', '/dashboard/customers', 'Users', 0, 4,
  true, true, true, true, true,
  '["admin", "operator"]'::jsonb, 'customers:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- 6. Catalog & Pricing (with children)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'catalog', 'Catalog & Pricing', '/dashboard/catalog', 'Tags', 0, 5,
  false, true, true, true, true,
  '["admin"]'::jsonb, 'catalog:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Catalog children
INSERT INTO sys_components_cd (
  comp_code, parent_comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES
  ('catalog_services', 'catalog', 'Services', '/dashboard/catalog/services', 'Tags', 1, 0,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'catalog:read', 1),
  ('catalog_pricing', 'catalog', 'Pricing', '/dashboard/catalog/pricing', 'Tags', 1, 1,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'catalog:read', 1),
  ('catalog_addons', 'catalog', 'Add-ons', '/dashboard/catalog/addons', 'Tags', 1, 2,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'catalog:read', 1)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for catalog children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'catalog'
  AND p.comp_code = 'catalog';

-- 7. Billing (Invoices & Payments) (with children)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'billing', 'Invoices & Payments', '/dashboard/billing', 'Receipt', 0, 6,
  false, true, true, true, true,
  '["admin", "operator"]'::jsonb, 'billing:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Billing children
INSERT INTO sys_components_cd (
  comp_code, parent_comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES
  ('billing_invoices', 'billing', 'Invoices', '/dashboard/billing/invoices', 'Receipt', 1, 0,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'billing:read', 1),
  ('billing_payments', 'billing', 'Payments', '/dashboard/billing/payments', 'Receipt', 1, 1,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'billing:read', 1),
  ('billing_cashup', 'billing', 'Cash Up', '/dashboard/billing/cashup', 'Receipt', 1, 2,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'billing:read', 1)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for billing children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'billing'
  AND p.comp_code = 'billing';

-- 8. Reports & Analytics (with feature flag)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, feature_flag, rec_status
) VALUES (
  'reports', 'Reports & Analytics', '/dashboard/reports', 'BarChart3', 0, 7,
  true, true, true, true, true,
  '["admin"]'::jsonb, 'reports:read', '["advanced_analytics"]'::jsonb, 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- 9. Inventory & Machines (with children)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'inventory', 'Inventory & Machines', '/dashboard/inventory', 'Boxes', 0, 8,
  false, true, true, true, true,
  '["admin", "operator"]'::jsonb, 'inventory:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Inventory children
INSERT INTO sys_components_cd (
  comp_code, parent_comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES
  ('inventory_stock', 'inventory', 'Stock', '/dashboard/inventory/stock', 'Boxes', 1, 0,
   true, true, true, true, true,
   '["admin", "operator"]'::jsonb, 'inventory:read', 1),
  ('inventory_machines', 'inventory', 'Machines', '/dashboard/inventory/machines', 'Boxes', 1, 1,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'inventory:read', 1)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for inventory children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'inventory'
  AND p.comp_code = 'inventory';

-- 10. Settings (with children)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'settings', 'Settings', '/dashboard/settings', 'Settings', 0, 9,
  false, true, true, true, true,
  '["admin"]'::jsonb, 'settings:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Settings children
INSERT INTO sys_components_cd (
  comp_code, parent_comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES
  ('settings_general', 'settings', 'General', '/dashboard/settings/general', 'Settings', 1, 0,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'settings:read', 1),
  ('settings_users', 'settings', 'Team Members', '/dashboard/settings/users', 'Settings', 1, 1,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'settings:read', 1),
  ('settings_roles', 'settings', 'Roles & Permissions', '/dashboard/settings/roles', 'Settings', 1, 2,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'settings:read', 1),
  ('settings_workflow_roles', 'settings', 'Workflow Roles', '/dashboard/settings/workflow-roles', 'Settings', 1, 3,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'settings:read', 1),
  ('settings_branding', 'settings', 'Branding', '/dashboard/settings/branding', 'Settings', 1, 4,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'settings:read', 1),
  ('settings_subscription', 'settings', 'Subscription', '/dashboard/settings/subscription', 'Settings', 1, 5,
   true, true, true, true, true,
   '["admin"]'::jsonb, 'settings:read', 1)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update parent_comp_id for settings children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.parent_comp_code = 'settings'
  AND p.comp_code = 'settings';

-- 11. Help
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'help', 'Help', '/dashboard/help', 'LifeBuoy', 0, 10,
  true, true, true, true, true,
  '["admin", "operator"]'::jsonb, NULL, 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- 12. JWT Test (admin only)
INSERT INTO sys_components_cd (
  comp_code, label, comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'jhtestui', 'JWT Test', '/dashboard/jhtestui', 'Bug', 0, 11,
  true, true, true, true, true,
  '["admin"]'::jsonb, NULL, 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Update comp_level for all items based on hierarchy
UPDATE sys_components_cd
SET comp_level = 0
WHERE parent_comp_id IS NULL;

UPDATE sys_components_cd c
SET comp_level = 1
WHERE c.parent_comp_id IS NOT NULL;

-- Verify seed
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_components_cd
  WHERE is_system = true;

  IF v_count < 10 THEN
    RAISE WARNING 'Expected at least 10 navigation items, found %', v_count;
  ELSE
    RAISE NOTICE '✅ Navigation seed completed. % items inserted.', v_count;
  END IF;
END $$;

COMMIT;
