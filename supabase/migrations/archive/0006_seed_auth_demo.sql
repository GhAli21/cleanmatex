-- 0006_seed_auth_demo.sql — Seed Demo Tenant with Admin User
-- Purpose: Create demo tenant and admin user for development/testing
-- Author: CleanMateX Development Team
-- Created: 2025-10-17
-- NOTE: This is for DEVELOPMENT ONLY. Do NOT run in production.

BEGIN;

-- =========================
-- DEMO TENANT
-- =========================

-- Create demo tenant (if not exists)
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
  '11111111-1111-1111-1111-111111111111', -- Fixed UUID for testing
  'Demo Laundry Services',
  'خدمات المغسلة التجريبية',
  'demo-laundry',
  'demo@cleanmatex.local',
  '+96812345678',
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
ON CONFLICT (id) DO UPDATE
SET updated_at = NOW();

-- Create subscription for demo tenant
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
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'free',
  'trial',
  50,
  0,
  1,
  2,
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET updated_at = NOW();

-- Create demo branch
INSERT INTO org_branches_mst (
  id,
  tenant_org_id,
  branch_name,
  address,
  city,
  phone,
  email,
  is_active,
  created_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Main Branch',
  'Building 123, Way 456, Al Khuwair',
  'Muscat',
  '+96812345678',
  'main@demo-laundry.local',
  true,
  NOW()
)
ON CONFLICT (id, tenant_org_id) DO UPDATE
SET updated_at = NOW();

-- =========================
-- DEMO ADMIN USER
-- =========================

-- NOTE: Admin user creation is now handled by migration 0009_create_demo_admin_user.sql
-- This migration creates the tenant and initial data
-- Migration 0009 creates the admin user and links it to this tenant

-- The create_tenant_admin function is now created in migration 0004_auth_tables.sql
-- No need to recreate it here

--RAISE NOTICE '📧 Admin user will be created by migration 0009';
--RAISE NOTICE '   Email: admin@demo-laundry.local';
--RAISE NOTICE '   Password: Admin123';

-- =========================
-- DEMO DATA: SERVICE CATEGORIES
-- =========================

-- Seed basic service categories for demo
INSERT INTO sys_service_category_cd (
  service_category_code,
  ctg_name,
  ctg_name2,
  ctg_desc,
  turnaround_hh,
  turnaround_hh_express,
  multiplier_express,
  is_builtin,
  has_fee,
  is_mandatory,
  is_active,
  created_at
)
VALUES
  (
    'WASH_AND_IRON',
    'Wash & Iron',
    'غسيل وكوي',
    'Complete wash and iron service for regular garments',
    48.00,
    24.00,
    1.50,
    true,
    true,
    false,
    true,
    NOW()
  ),
  (
    'DRY_CLEAN',
    'Dry Cleaning',
    'تنظيف جاف',
    'Professional dry cleaning for delicate fabrics',
    72.00,
    48.00,
    1.50,
    true,
    true,
    false,
    true,
    NOW()
  ),
  (
    'IRON_ONLY',
    'Ironing Only',
    'كوي فقط',
    'Ironing service for pre-washed items',
    24.00,
    12.00,
    1.50,
    true,
    true,
    false,
    true,
    NOW()
  )
ON CONFLICT (service_category_code) DO NOTHING;

-- Enable service categories for demo tenant
INSERT INTO org_service_category_cf (
  tenant_org_id,
  service_category_code
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  service_category_code
FROM sys_service_category_cd
WHERE is_active = true
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- =========================
-- DEMO DATA: ORDER TYPES
-- =========================

INSERT INTO sys_order_type_cd (
  order_type_id,
  order_type_name,
  order_type_name2,
  is_active,
  created_at
)
VALUES
  ('WALK_IN', 'Walk-in Order', 'طلب حضوري', true, NOW()),
  ('PICKUP', 'Pickup Order', 'طلب استلام', true, NOW()),
  ('DELIVERY', 'Delivery Order', 'طلب توصيل', true, NOW()),
  ('EXPRESS', 'Express Order', 'طلب سريع', true, NOW())
ON CONFLICT (order_type_id) DO NOTHING;

-- =========================
-- VALIDATION
-- =========================

DO $$
DECLARE
  v_tenant_count INTEGER;
  v_branch_count INTEGER;
  v_service_count INTEGER;
BEGIN
  -- Check demo tenant created
  SELECT COUNT(*) INTO v_tenant_count
  FROM org_tenants_mst
  WHERE id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_tenant_count = 1, 'Demo tenant not created';

  -- Check branch created
  SELECT COUNT(*) INTO v_branch_count
  FROM org_branches_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_branch_count >= 1, 'Demo branch not created';

  -- Check service categories
  SELECT COUNT(*) INTO v_service_count
  FROM sys_service_category_cd
  WHERE is_active = true;

  ASSERT v_service_count >= 3, 'Service categories not seeded';

  RAISE NOTICE '✅ Demo tenant and data seeded successfully';
  RAISE NOTICE '📧 Create admin user via Supabase Auth: admin@demo-laundry.local';
  RAISE NOTICE '🔑 Password: Use Supabase Studio or Auth API';
  RAISE NOTICE '🏢 Tenant ID: 11111111-1111-1111-1111-111111111111';
END $$;

COMMIT;

-- =========================
-- AUTOMATIC SETUP (No Manual Steps Required!)
-- =========================

-- ✅ Migration 0009 automatically creates the demo admin user
-- ✅ Migration 0010 sets up auto-initialization for future tenants
--
-- Demo Credentials:
--   Email:    admin@demo-laundry.local
--   Password: Admin123
--   URL:      http://localhost:3000/login
--
-- If automatic user creation fails, run:
--   cd web-admin
--   node ../scripts/create-test-user.js
