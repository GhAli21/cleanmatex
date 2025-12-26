-- ==================================================================
-- 0001_seed_lookup_tables.sql
-- Purpose: Seed global lookup tables (sys_*) with reference data
-- Author: CleanMateX Development Team
-- Created: 2025-10-24
-- ==================================================================
-- This file populates system-level lookup tables that are shared
-- across all tenants. These are required for the application to function.
-- ==================================================================

BEGIN;

-- ==================================================================
-- ORDER TYPES (Global Reference Data)
-- ==================================================================

INSERT INTO sys_order_type_cd (
  order_type_id,
  order_type_name,
  order_type_name2,
  is_active,
  created_at
)
VALUES
  ('POS', 'Point of Sale', 'نقطة بيع', true, NOW()),
  ('WALK_IN', 'Walk-in Order', 'طلب حضوري', true, NOW()),
  ('PICKUP', 'Pickup Request', 'طلب استلام', true, NOW()),
  ('DELIVERY', 'Delivery to Customer', 'توصيل للعميل', true, NOW()),
  ('EXPRESS', 'Express Order', 'طلب سريع', true, NOW())
ON CONFLICT (order_type_id) DO UPDATE SET
  order_type_name = EXCLUDED.order_type_name,
  order_type_name2 = EXCLUDED.order_type_name2,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ==================================================================
-- SERVICE CATEGORIES (Global Reference Data)
-- ==================================================================

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
  rec_order,
  service_category_icon,
  created_at
)
VALUES
  (
    'LAUNDRY',
    'Laundry',
    'غسيل',
    'Regular laundry wash service',
    48.00,
    24.00,
    1.50,
    true,
    true,
    false,
    true,
	3,
	'Shirt',
    NOW()
  ),
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
	1,
	'WashingMachine',
    NOW()
  ),
  (
    'DRY_CLEAN',
    'Dry Cleaning',
    'دراي كلين',
    'Professional dry cleaning for delicate fabrics',
    72.00,
    48.00,
    1.50,
    true,
    true,
    false,
    true,
	2,
	'Drop',
    NOW()
  ),
  (
    'IRON_ONLY',
    'Ironing Only',
    'كوي فقط',
    'Ironing service Only',
    24.00,
    12.00,
    1.50,
    true,
    true,
    false,
    true,
	4,
	'Iron',
    NOW()
  ),
  (
    'ALTERATION',
    'Alterations',
    'تعديلات',
    'Special Alterations',
    96.00,
    48.00,
    1.50,
    true,
    true,
    false,
    true,
	6,
	'Scissors',
    NOW()
  ),
  (
    'REPAIRS',
    'Repairing',
    'إصلاح',
    'Garment repair and alteration service',
    96.00,
    48.00,
    1.50,
    true,
    true,
    false,
    true,
	5,
	'Wrench',
    NOW()
  )
ON CONFLICT (service_category_code) DO UPDATE SET
  ctg_name = EXCLUDED.ctg_name,
  ctg_name2 = EXCLUDED.ctg_name2,
  ctg_desc = EXCLUDED.ctg_desc,
  turnaround_hh = EXCLUDED.turnaround_hh,
  turnaround_hh_express = EXCLUDED.turnaround_hh_express,
  multiplier_express = EXCLUDED.multiplier_express,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ==================================================================
-- VALIDATION
-- ==================================================================

DO $$
DECLARE
  v_order_types_count INTEGER;
  v_service_categories_count INTEGER;
BEGIN
  -- Check order types
  SELECT COUNT(*) INTO v_order_types_count
  FROM sys_order_type_cd
  WHERE is_active = true;

  ASSERT v_order_types_count >= 3, 'Order types not seeded properly';

  -- Check service categories
  SELECT COUNT(*) INTO v_service_categories_count
  FROM sys_service_category_cd
  WHERE is_active = true;

  ASSERT v_service_categories_count >= 4, 'Service categories not seeded properly';

  RAISE NOTICE '✅ Lookup tables seeded successfully';
  RAISE NOTICE '   Order Types: %', v_order_types_count;
  RAISE NOTICE '   Service Categories: %', v_service_categories_count;
END $$;

COMMIT;

-- ==================================================================
-- NOTES
-- ==================================================================
-- These lookup tables are required for CleanMateX to function properly.
-- They are shared across all tenants and should be loaded once.
-- ==================================================================
