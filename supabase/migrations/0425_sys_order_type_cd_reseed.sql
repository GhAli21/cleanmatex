-- ==================================================================
-- 0425_sys_order_type_cd_reseed.sql
-- Purpose: Re-seed sys_order_type_cd with the full commercial/fulfillment
--          catalog (incl. ONLINE/PHONE used by app constants/reports),
--          bilingual labels, icons, colors, rec_order / rec_status.
-- Author: CleanMateX Development Team
-- Created: 2026-07-24
-- Dependencies: 0001, 0007, 0134
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================
-- Notes:
--   - Distinct from sys_order_sources_cd (sales/integration channel).
--   - Does not remap org_orders_mst (existing codes stay valid).
--   - Must stay in sync with web-admin/lib/constants/order-types.ts
--     ORDER_TYPE_IDS.
-- ==================================================================

BEGIN;

COMMENT ON TABLE sys_order_type_cd IS
  'Global commercial/fulfillment order types (POS, walk-in, pickup, delivery, express, online, phone). Distinct from order_source_code (channel).';

INSERT INTO sys_order_type_cd (
  order_type_id,
  order_type_name,
  order_type_name2,
  is_active,
  order_type_icon,
  order_type_color1,
  order_type_color2,
  order_type_color3,
  rec_order,
  rec_status,
  rec_notes,
  created_at,
  updated_at,
  created_info,
  updated_info
)
VALUES
  (
    'POS',
    'Point of Sale',
    'نقطة بيع',
    true,
    'Monitor',
    '#2563EB',
    '#1D4ED8',
    '#DBEAFE',
    10,
    1,
    'Counter / terminal order',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  ),
  (
    'WALK_IN',
    'Walk-in Order',
    'طلب حضوري',
    true,
    'UserRound',
    '#059669',
    '#047857',
    '#D1FAE5',
    20,
    1,
    'Customer present at branch without prior booking',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  ),
  (
    'PICKUP',
    'Pickup Request',
    'طلب استلام',
    true,
    'Package',
    '#7C3AED',
    '#6D28D9',
    '#EDE9FE',
    30,
    1,
    'Customer collects finished order at branch',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  ),
  (
    'DELIVERY',
    'Delivery to Customer',
    'توصيل للعميل',
    true,
    'Truck',
    '#EA580C',
    '#C2410C',
    '#FFEDD5',
    40,
    1,
    'Finished order delivered to customer address',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  ),
  (
    'EXPRESS',
    'Express Order',
    'طلب سريع',
    true,
    'Zap',
    '#DC2626',
    '#B91C1C',
    '#FEE2E2',
    50,
    1,
    'Rush / express service profile',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  ),
  (
    'ONLINE',
    'Online Order',
    'طلب إلكتروني',
    true,
    'Globe',
    '#0891B2',
    '#0E7490',
    '#CFFAFE',
    60,
    1,
    'Web / digital storefront order (not channel — see order_source_code)',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  ),
  (
    'PHONE',
    'Phone Order',
    'طلب هاتفي',
    true,
    'Phone',
    '#4F46E5',
    '#4338CA',
    '#E0E7FF',
    70,
    1,
    'Order taken by phone',
    NOW(),
    NOW(),
    '0425_sys_order_type_cd_reseed',
    '0425_sys_order_type_cd_reseed'
  )
ON CONFLICT (order_type_id) DO UPDATE SET
  order_type_name = EXCLUDED.order_type_name,
  order_type_name2 = EXCLUDED.order_type_name2,
  is_active = EXCLUDED.is_active,
  order_type_icon = EXCLUDED.order_type_icon,
  order_type_color1 = EXCLUDED.order_type_color1,
  order_type_color2 = EXCLUDED.order_type_color2,
  order_type_color3 = EXCLUDED.order_type_color3,
  rec_order = EXCLUDED.rec_order,
  rec_status = EXCLUDED.rec_status,
  rec_notes = EXCLUDED.rec_notes,
  updated_at = NOW(),
  updated_info = EXCLUDED.updated_info;

DO $$
DECLARE
  v_active_count INTEGER;
  v_missing TEXT[];
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM sys_order_type_cd
  WHERE is_active = true
    AND order_type_id IN (
      'POS', 'WALK_IN', 'PICKUP', 'DELIVERY', 'EXPRESS', 'ONLINE', 'PHONE'
    );

  ASSERT v_active_count = 7,
    format('sys_order_type_cd reseed incomplete: expected 7 active catalog rows, got %s', v_active_count);

  SELECT ARRAY_AGG(expected.id ORDER BY expected.id)
  INTO v_missing
  FROM (
    VALUES
      ('POS'),
      ('WALK_IN'),
      ('PICKUP'),
      ('DELIVERY'),
      ('EXPRESS'),
      ('ONLINE'),
      ('PHONE')
  ) AS expected(id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM sys_order_type_cd t
    WHERE t.order_type_id = expected.id
      AND t.is_active = true
  );

  ASSERT v_missing IS NULL,
    format('sys_order_type_cd missing active codes: %s', v_missing);

  RAISE NOTICE 'sys_order_type_cd reseeded: % active catalog types', v_active_count;
END $$;

COMMIT;
