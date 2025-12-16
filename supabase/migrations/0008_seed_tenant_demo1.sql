-- ==================================================================
-- 0002_seed_tenant_demo1.sql
-- Purpose: Seed Demo Tenant #1 (Demo Laundry LLC) with complete data
-- Author: CleanMateX Development Team
-- Created: 2025-10-24
-- ==================================================================
-- ⚠️  WARNING: FOR DEVELOPMENT/DEMO ONLY
-- This file creates a complete demo tenant with test data and hardcoded UUIDs.
-- DO NOT use in production environments.
-- ==================================================================
-- CONSOLIDATED FROM:
--   - 0003_seed_core.sql (tenant, branch, products, orders)
--   - 0006_seed_auth_demo.sql (subscription, service categories)
--   - 0009_create_demo_admin_user.sql (admin user - manual step required)
-- ==================================================================

BEGIN;

-- ==================================================================
-- DEMO TENANT #1: Demo Laundry LLC
-- ==================================================================
-- UUID Pattern: 11111111-1111-1111-1111-11111111111X
-- Tenant ID: 11111111-1111-1111-1111-111111111111
-- ==================================================================

-- Create Tenant Organization
INSERT INTO org_tenants_mst (
  id,
  name,
  name2,
  slug,
  email,
  phone,
  s_current_plan,
  address,
  city,
  country,
  currency,
  timezone,
  language,
  is_active,
  status,
  created_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Demo Laundry LLC',
  'شركة ديمو للغسيل',
  'demo-laundry',
  'owner@demo-laundry.example',
  '+96870000000',
  'FREE_TRIAL',
  'Building 123, Way 456, Al Khuwair',
  'Muscat',
  'OM',
  'OMR',
  'Asia/Muscat',
  'en',
  true,
  'trial',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  slug = EXCLUDED.slug,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  updated_at = NOW();

-- Create Subscription (14-day trial)
INSERT INTO org_subscriptions_mst (
  id,
  tenant_org_id,
  plan,
  status,
  orders_limit,
  orders_used,
  branch_limit,
  user_limit,
  start_date,
  end_date,
  trial_ends,
  created_at
)
VALUES (
  '11111111-1111-1111-1111-111111111112', -- Subscription ID
  '11111111-1111-1111-1111-111111111111', -- Tenant ID
  'free',
  'trial',
  100,
  0,
  2,
  5,
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '14 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Create Main Branch
INSERT INTO org_branches_mst (
  id,
  tenant_org_id,
  branch_name,
  name,
   name2,
   is_main,
  phone,
  email,
  address,
  city,
  area,
  latitude,
  longitude,
  is_active,
  created_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222', -- Branch ID
  '11111111-1111-1111-1111-111111111111', -- Tenant ID
  'Main Branch',
  'Main Branch Name',
  'الفرع الرئيسي',
  true,
  '+96871111111',
  'main@demo-laundry.example',
  'Way 1234, Muscat',
  'Muscat',
  'Al Khuwair',
  23.5859,
  58.4059,
  true,
  NOW()
)
ON CONFLICT (id, tenant_org_id) DO UPDATE SET
  branch_name = EXCLUDED.branch_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  area = EXCLUDED.area,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = NOW();

-- Enable Service Categories for Tenant
INSERT INTO org_service_category_cf (tenant_org_id, service_category_code, rec_order)--, is_enabled)
SELECT
  '11111111-1111-1111-1111-111111111111',
  service_category_code,
  rec_order
  --true is_enabled
FROM sys_service_category_cd
WHERE is_active = true
  --AND service_category_code IN ('LAUNDRY', 'WASH_AND_IRON', 'DRY_CLEAN', 'IRON', 'IRON_ONLY')
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- ==================================================================
-- DEMO CUSTOMER
-- ==================================================================

-- Create Global Customer
INSERT INTO sys_customers_mst (
  id,
  first_name,
  last_name,
  name,
  name2,
  display_name,
  phone,
  email,
  type,
  address,
  first_tenant_org_id,
  created_at,
  updated_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333', -- Customer ID
  'Gehad',
  'Ali',
  'Gehad Ali',
  'جهاد علي',
  'Jehad Al-Mekhlafi',
  '+96877182624',
  'customer@demo-laundry.example',
  'walk_in',
  'Muscat',
  '11111111-1111-1111-1111-111111111111', -- First tenant
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = NOW();

-- Link Customer to Tenant
INSERT INTO org_customers_mst (
  id,
  customer_id,
  tenant_org_id,
  loyalty_points,
  is_active,
  created_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333', -- id
  '33333333-3333-3333-3333-333333333333', -- Customer ID
  '11111111-1111-1111-1111-111111111111', -- Tenant ID
  100, -- Starting loyalty points
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ==================================================================
-- DEMO PRODUCTS
-- ==================================================================

INSERT INTO org_product_data_mst (
  id,
  tenant_org_id,
  service_category_code,
  product_code,
  product_name,
  product_name2,
  product_unit,
  default_sell_price,
  default_express_sell_price,
  is_active,
  created_at
)
VALUES
  (
    '44444444-4444-4444-4444-444444444441',
    '11111111-1111-1111-1111-111111111111',
    'WASH_AND_IRON',
    'PROD-SHIRT-WI',
    'Shirt - Wash & Iron',
    'قميص - غسيل وكي',
    'piece',
    0.800,
    1.200,
    true,
    NOW()
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '11111111-1111-1111-1111-111111111111',
    'WASH_AND_IRON',
    'PROD-PANTS-WI',
    'Pants - Wash & Iron',
    'بنطال - غسيل وكي',
    'piece',
    1.000,
    1.500,
    true,
    NOW()
  ),
  (
    '44444444-4444-4444-4444-444444444443',
    '11111111-1111-1111-1111-111111111111',
    'DRY_CLEAN',
    'PROD-SUIT-DC',
    'Suit - Dry Clean',
    'بدلة - دراي كلين',
    'piece',
    3.500,
    5.000,
    true,
    NOW()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'IRON_ONLY',
    'PROD-SHIRT-IO',
    'Shirt - Iron Only',
    'قميص - كوي فقط',
    'piece',
    0.300,
    0.500,
    true,
    NOW()
  )
ON CONFLICT (tenant_org_id, product_code) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  product_name2 = EXCLUDED.product_name2,
  default_sell_price = EXCLUDED.default_sell_price,
  default_express_sell_price = EXCLUDED.default_express_sell_price,
  updated_at = NOW();

-- ==================================================================
-- DEMO ORDER
-- ==================================================================

-- Create Sample Order
INSERT INTO org_orders_mst (
  id,
  tenant_org_id,
  branch_id,
  customer_id,
  order_type_id,
  order_no,
  status,
  priority,
  total_items,
  subtotal,
  discount,
  tax,
  total,
  payment_status,
  received_at,
  created_at,
  updated_at
)
VALUES (
  '55555555-5555-5555-5555-555555555555', -- Order ID
  '11111111-1111-1111-1111-111111111111', -- Tenant ID
  '22222222-2222-2222-2222-222222222222', -- Branch ID
  '33333333-3333-3333-3333-333333333333', -- Customer ID
  'POS',
  'CMX-2025-0001',
  'intake',
  'normal',
  2, -- 2 items
  1.800, -- 0.800 + 1.000
  0.000,
  0.090, -- 5% tax
  1.890,
  'processing',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (tenant_org_id, order_no) DO NOTHING;

-- Create Order Items
INSERT INTO org_order_items_dtl (
  id,
  order_id,
  tenant_org_id,
  service_category_code,
  order_item_srno,
  product_id,
  quantity,
  price_per_unit,
  total_price,
  status,
  created_at
)
VALUES
  (
    '55555555-5555-5555-5555-555555555551', -- Item 1 ID
    '55555555-5555-5555-5555-555555555555', -- Order ID
    '11111111-1111-1111-1111-111111111111', -- Tenant ID
    'WASH_AND_IRON',
    '001',
    '44444444-4444-4444-4444-444444444441', -- Shirt product
    1,
    0.800,
    0.800,
    'processing',
    NOW()
  ),
  (
    '55555555-5555-5555-5555-555555555552', -- Item 2 ID
    '55555555-5555-5555-5555-555555555555', -- Order ID
    '11111111-1111-1111-1111-111111111111', -- Tenant ID
    'WASH_AND_IRON',
    '002',
    '44444444-4444-4444-4444-444444444442', -- Pants product
    1,
    1.000,
    1.000,
    'processing',
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Create Invoice
INSERT INTO org_invoice_mst (
  id,
  order_id,
  tenant_org_id,
  invoice_no,
  subtotal,
  discount,
  tax,
  total,
  status,
  created_at
)
VALUES (
  '66666666-6666-6666-6666-666666666666', -- Invoice ID
  '55555555-5555-5555-5555-555555555555', -- Order ID
  '11111111-1111-1111-1111-111111111111', -- Tenant ID
  'INV-2025-0001',
  1.800,
  0.000,
  0.090,
  1.890,
  'processing',
  NOW()
)
ON CONFLICT (tenant_org_id, invoice_no) DO NOTHING;

-- Create Payment Transaction
INSERT INTO org_payments_dtl_tr (
  id,
  invoice_id,
  tenant_org_id,
  paid_amount,
  status,
  payment_method,
  paid_at,
  metadata,
  created_at
)
VALUES (
  '77777777-7777-7777-7777-777777777777', -- Payment ID
  '66666666-6666-6666-6666-666666666666', -- Invoice ID
  '11111111-1111-1111-1111-111111111111', -- Tenant ID
  1.890,
  'paid',
  'cash',
  NOW(),
  '{"note":"Demo payment - seed data"}'::jsonb,
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================================================================
-- VALIDATION
-- ==================================================================

DO $$
DECLARE
  v_tenant_count INTEGER;
  v_branch_count INTEGER;
  v_product_count INTEGER;
  v_order_count INTEGER;
BEGIN
  -- Verify tenant created
  SELECT COUNT(*) INTO v_tenant_count
  FROM org_tenants_mst
  WHERE id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_tenant_count = 1, 'Demo Tenant #1 not created';

  -- Verify branch created
  SELECT COUNT(*) INTO v_branch_count
  FROM org_branches_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_branch_count >= 1, 'Demo branch not created';

  -- Verify products created
  SELECT COUNT(*) INTO v_product_count
  FROM org_product_data_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_product_count >= 3, 'Demo products not created';

  -- Verify order created
  SELECT COUNT(*) INTO v_order_count
  FROM org_orders_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_order_count >= 1, 'Demo order not created';

  RAISE NOTICE '✅ Demo Tenant #1 seeded successfully';
  RAISE NOTICE '   Tenant: Demo Laundry LLC';
  RAISE NOTICE '   ID: 11111111-1111-1111-1111-111111111111';
  RAISE NOTICE '   Branch: Main Branch';
  RAISE NOTICE '   Products: %', v_product_count;
  RAISE NOTICE '   Orders: %', v_order_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next: Create admin users';
  RAISE NOTICE '   Auto:   node scripts/db/create-demo-admins.js';
  RAISE NOTICE '   Manual: Supabase Studio > Authentication';
END $$;

COMMIT;

-- ==================================================================
-- ADMIN USER CREATION
-- ==================================================================
-- ✅ AUTOMATED: Run after seeding
--    node scripts/db/create-demo-admins.js
--
--    OR use integrated script:
--    .\scripts\db\reset-with-seeds.ps1  (automatically creates users)
--    .\scripts\db\load-seeds.ps1 -AutoCreateAdmins
--
-- 📋 Demo Credentials (created by script):
--    admin@demo-laundry.example / Admin123 (admin)
--    operator@demo-laundry.example / Operator123 (operator)
--    viewer@demo-laundry.example / Viewer123 (viewer)
--
-- ℹ️  Manual creation via Supabase Studio also supported
--    See: supabase/migrations/seeds/README.md
-- ==================================================================
