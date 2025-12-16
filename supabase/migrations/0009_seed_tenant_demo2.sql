-- ==================================================================
-- 0003_seed_tenant_demo2.sql
-- Purpose: Seed Demo Tenant #2 (BlueWave Laundry Co.) with complete data
-- Author: CleanMateX Development Team
-- Created: 2025-10-24
-- ==================================================================
-- ⚠️  WARNING: FOR DEVELOPMENT/DEMO ONLY
-- This file creates a second demo tenant for multi-tenant testing.
-- DO NOT use in production environments.
-- ==================================================================
-- CONSOLIDATED FROM:
--   - 0011_seed_core_02.sql (tenant, branch, products, orders)
--   - 0012_seed_auth_demo_02.sql (auth user - commented out)
--   - 0013_create_demo_admin_user_02.sql (admin user - manual step required)
-- ==================================================================

BEGIN;

-- ==================================================================
-- DEMO TENANT #2: BlueWave Laundry Co.
-- ==================================================================
-- UUID Pattern: 20000002-2222-2222-2222-22222222222X
-- Tenant ID: 20000002-2222-2222-2222-222222222221
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
  created_at,
  updated_at
)
VALUES (
  '20000002-2222-2222-2222-222222222221',
  'BlueWave Laundry Co.',
  'شركة بلو ويف للغسيل',
  'bluewave-laundry',
  'hq@bluewave.example',
  '+96871112230',
  'FREE_TRIAL',
  'Way 1234, Qurum Heights, Muscat',
  'Muscat',
  'OM',
  'OMR',
  'Asia/Muscat',
  'en',
  true,
  'trial',
  NOW(),
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
  '20000002-2222-2222-2222-222222222220', -- Subscription ID
  '20000002-2222-2222-2222-222222222221', -- Tenant ID
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

-- Create Branch
INSERT INTO org_branches_mst (
  id,
  tenant_org_id,
  branch_name,
  name,
   name2,
   is_main,
  phone,
  email,
  type,
  address,
  country,
  city,
  area,
  latitude,
  longitude,
  is_active,
  created_at
)
VALUES (
  '20000002-2222-2222-2222-222222222222', -- Branch ID
  '20000002-2222-2222-2222-222222222221', -- Tenant ID
  'BlueWave Qurum Branch',
  'Main Branch Name',
  'الفرع الرئيسي',
  true,
  '+96871112231',
  'qurum@bluewave.example',
  'walk_in',
  'Qurum Heights Plaza, Shop 12',
  'OM',
  'Muscat',
  'Qurum',
  23.602,
  58.470,
  true,
  NOW()
)
ON CONFLICT (id, tenant_org_id) DO UPDATE SET
  branch_name = EXCLUDED.branch_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  area = EXCLUDED.area,
  updated_at = NOW();

-- Enable Service Categories for Tenant

INSERT INTO org_service_category_cf (tenant_org_id, service_category_code, rec_order)--, is_enabled)
SELECT
  '20000002-2222-2222-2222-222222222221',
  service_category_code,
  rec_order
  --true is_enabled,
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
  '20000002-2222-2222-2222-222222222225', -- Customer ID
  'Jh Test',
  'Customer',
  'Jh Test Customer',
  'حي إتش تجريبي عميل',
  'Jh Test dev21',
  '+96896662624',
  'jhtest.dev21@gmail.com',
  'walk_in',
  'Muscat',
  '20000002-2222-2222-2222-222222222221', -- First tenant
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
  '20000002-2222-2222-2222-222222222225', -- id
  '20000002-2222-2222-2222-222222222225', -- Customer ID
  '20000002-2222-2222-2222-222222222221', -- Tenant ID
  0,
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ======
UPDATE org_customers_mst AS org
SET
  name = COALESCE(org.name, sys.name),
  name2 = COALESCE(org.name2, sys.name),
  first_name = COALESCE(org.first_name, sys.first_name),
  last_name = COALESCE(org.last_name, sys.last_name),
  email = COALESCE(org.email, sys.email),
  display_name = COALESCE(org.display_name, sys.display_name),
  type = COALESCE(org.type, sys.type),
  address = COALESCE(org.address, sys.address),
  area = COALESCE(org.area, sys.area),
  building = COALESCE(org.building, sys.building),
  floor = COALESCE(org.floor, sys.floor)
  
FROM sys_customers_mst AS sys
WHERE org.customer_id = sys.id;


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
  is_retail_item,
  product_type,
  price_type,
  product_unit,
  default_sell_price,
  default_express_sell_price,
  min_sell_price,
  min_quantity,
  pieces_per_product,
  extra_days,
  turnaround_hh,
  turnaround_hh_express,
  multiplier_express,
  product_order,
  is_tax_exempt,
  is_active,
  created_at
)
VALUES
  (
    '20000002-2222-2222-2222-222222222226',
    '20000002-2222-2222-2222-222222222221',
    'LAUNDRY',
    'BW-SHIRT-WASH',
    'Shirt Wash',
    'غسيل قميص',
    false,
    1,
    'per_piece',
    'unit',
    0.800,
    1.600,
    0.700,
    1,
    1,
    0,
    24,
    12,
    2.0,
    1,
    0,
    true,
    NOW()
  ),
  (
    '20000002-2222-2222-2222-222222222227',
    '20000002-2222-2222-2222-222222222221',
    'DRY_CLEAN',
    'BW-SUIT-DRY',
    'Suit Dry Clean',
    'تنظيف بدلة',
    false,
    1,
    'per_piece',
    'unit',
    3.200,
    6.000,
    2.800,
    1,
    2,
    1,
    48,
    24,
    1.8,
    2,
    0,
    true,
    NOW()
  ),
  (
    '20000002-2222-2222-2222-222222222228',
    '20000002-2222-2222-2222-222222222221',
    'IRON_ONLY',
    'BW-TROUSER-PRESS',
    'Trouser Press',
    'كي بنطلون',
    false,
    1,
    'per_piece',
    'unit',
    0.600,
    1.200,
    0.500,
    1,
    1,
    0,
    12,
    6,
    2.0,
    3,
    0,
    true,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  product_name2 = EXCLUDED.product_name2,
  default_sell_price = EXCLUDED.default_sell_price,
  default_express_sell_price = EXCLUDED.default_express_sell_price,
  is_active = EXCLUDED.is_active,
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
  subtotal,
  discount,
  tax,
  total,
  payment_status,
  received_at,
  ready_by,
  customer_notes,
  internal_notes,
  created_at,
  updated_at
)
VALUES (
  '20000002-2222-2222-2222-222222222229', -- Order ID
  '20000002-2222-2222-2222-222222222221', -- Tenant ID
  '20000002-2222-2222-2222-222222222222', -- Branch ID
  '20000002-2222-2222-2222-222222222225', -- Customer ID
  'POS',
  'BW-2025-0001',
  'intake',
  'high',
  0, -- Will be calculated
  0,
  0,
  0,
  'processing',
  NOW(),
  NOW() + INTERVAL '2 days',
  'Handle with care',
  'Quick drop bag',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

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
  notes,
  metadata,
  created_at
)
VALUES
  (
    '20000002-2222-2222-2222-222222222230',
    '20000002-2222-2222-2222-222222222229',
    '20000002-2222-2222-2222-222222222221',
    'LAUNDRY',
    '001',
    '20000002-2222-2222-2222-222222222226', -- Shirt wash product
    3,
    0.800,
    2.400,
    'processing',
    'White shirts',
    '{"starch":"light"}'::jsonb,
    NOW()
  ),
  (
    '20000002-2222-2222-2222-222222222231',
    '20000002-2222-2222-2222-222222222229',
    '20000002-2222-2222-2222-222222222221',
    'IRON_ONLY',
    '002',
    '20000002-2222-2222-2222-222222222228', -- Trouser press product
    2,
    0.600,
    1.200,
    'processing',
    'Office trousers',
    '{"crease":"sharp"}'::jsonb,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Recalculate Order Totals
UPDATE org_orders_mst o
SET
  subtotal = i.subtotal,
  tax = ROUND(i.subtotal * 0.05, 3),
  total = ROUND(i.subtotal * 1.05, 3),
  updated_at = NOW()
FROM (
  SELECT order_id, SUM(total_price) AS subtotal
  FROM org_order_items_dtl
  WHERE order_id = '20000002-2222-2222-2222-222222222229'
  GROUP BY order_id
) i
WHERE o.id = i.order_id;

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
  due_date,
  payment_method,
  paid_amount,
  created_at
)
VALUES (
  '20000002-2222-2222-2222-222222222232', -- Invoice ID
  '20000002-2222-2222-2222-222222222229', -- Order ID
  '20000002-2222-2222-2222-222222222221', -- Tenant ID
  'INV-BW-2025-0001',
  (SELECT subtotal FROM org_orders_mst WHERE id = '20000002-2222-2222-2222-222222222229'),
  0,
  (SELECT tax FROM org_orders_mst WHERE id = '20000002-2222-2222-2222-222222222229'),
  (SELECT total FROM org_orders_mst WHERE id = '20000002-2222-2222-2222-222222222229'),
  'processing',
  NOW() + INTERVAL '7 days',
  'cash',
  0,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create Payment Transaction (Pending)
INSERT INTO org_payments_dtl_tr (
  id,
  invoice_id,
  tenant_org_id,
  paid_amount,
  status,
  payment_method,
  metadata,
  created_at
)
VALUES (
  '20000002-2222-2222-2222-222222222233', -- Payment ID
  '20000002-2222-2222-2222-222222222232', -- Invoice ID
  '20000002-2222-2222-2222-222222222221', -- Tenant ID
  0.000,
  'pending',
  'cash',
  '{"note":"To be paid on collection"}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

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
  WHERE id = '20000002-2222-2222-2222-222222222221';

  ASSERT v_tenant_count = 1, 'Demo Tenant #2 not created';

  -- Verify branch created
  SELECT COUNT(*) INTO v_branch_count
  FROM org_branches_mst
  WHERE tenant_org_id = '20000002-2222-2222-2222-222222222221';

  ASSERT v_branch_count >= 1, 'Demo branch not created';

  -- Verify products created
  SELECT COUNT(*) INTO v_product_count
  FROM org_product_data_mst
  WHERE tenant_org_id = '20000002-2222-2222-2222-222222222221';

  ASSERT v_product_count >= 3, 'Demo products not created';

  -- Verify order created
  SELECT COUNT(*) INTO v_order_count
  FROM org_orders_mst
  WHERE tenant_org_id = '20000002-2222-2222-2222-222222222221';

  ASSERT v_order_count >= 1, 'Demo order not created';

  RAISE NOTICE '✅ Demo Tenant #2 seeded successfully';
  RAISE NOTICE '   Tenant: BlueWave Laundry Co.';
  RAISE NOTICE '   ID: 20000002-2222-2222-2222-222222222221';
  RAISE NOTICE '   Branch: BlueWave Qurum Branch';
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
--    admin@bluewave.example / Admin123 (admin)
--    operator@bluewave.example / Operator123 (operator)
--    viewer@bluewave.example / Viewer123 (viewer)
--
-- ℹ️  Manual creation via Supabase Studio also supported
--    See: supabase/migrations/seeds/README.md
-- ==================================================================
