-- =============================================================================
-- Migration: 0860_uom_area_any_unit.sql
-- Program:   Measured Pricing + UoM - area units
--            (docs/features/Measured_Pricing/STATUS.md)
-- Purpose:   Any area unit can price a product. Staff either type the area
--            itself or type length x width in any length unit; the application
--            converts the sides to metres and the area to the line's unit. So
--            the stored area is no longer length x width in the line's unit,
--            and the 0814 identity check is replaced by: length and width come
--            together, only with an area, in metres, and the area keeps the
--            unit's decimals. Adds the common area units to the system catalog.
-- Replaces:  the unapplied draft 0859_uom_area_side_units (SQM / SQFT only).
-- Affected:  org_order_items_dtl (one CHECK replaced, two column comments);
--            sys_uom_cd and sys_uom_conv_cd (seed rows only). No data changes,
--            no new table, column, function or grant.
-- Rollback (forward-only, manual): restore the 0814 ck_oid_measure_area and
--            delete the seeded rows if no Organization has added them.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Order lines: the area is what staff confirmed; length and width record the size
-- -----------------------------------------------------------------------------
-- Every stored line already meets the new rule: it is looser than the 0814 one.
ALTER TABLE public.org_order_items_dtl DROP CONSTRAINT ck_oid_measure_area;

-- Area lines: length and width together or not at all, only with an area; the area keeps
-- the unit's decimals (fn_uom_item_snapshot checks that for every other measured unit).
ALTER TABLE public.org_order_items_dtl
  ADD CONSTRAINT ck_oid_measure_area CHECK (CASE WHEN uom_dimension = 'AREA'
    THEN (measure_length IS NULL) = (measure_width IS NULL)
         AND (measure_length IS NULL OR (measure_length > 0 AND measure_width > 0 AND measured_qty IS NOT NULL))
         AND (measured_qty IS NULL OR measured_qty = round(measured_qty, uom_qty_decimals))
    ELSE measure_length IS NULL AND measure_width IS NULL END);
COMMENT ON CONSTRAINT ck_oid_measure_area ON public.org_order_items_dtl IS
  'Area lines: length and width are both set or both empty, only with an area, and the area keeps the unit decimals. The area may be typed directly or worked out from the size in any area unit, so it is not length x width (0860). Other lines never store a size.';

COMMENT ON COLUMN public.org_order_items_dtl.measure_length IS
  'Area lines: the length staff typed, converted to metres (QUANTITY). A record of the size; measured_qty is the area that is charged. NULL when the area was typed directly, and on other lines.';
COMMENT ON COLUMN public.org_order_items_dtl.measure_width IS
  'Area lines: the width staff typed, converted to metres (QUANTITY). Set together with measure_length. NULL otherwise.';

-- -----------------------------------------------------------------------------
-- 2. System catalog: common area units (not copied into Organizations by default)
-- -----------------------------------------------------------------------------
-- Sources: UN/ECE Recommendation 20 codes; SI and international (1959) yard and inch.
-- Decimals let a laundry-size item keep its size: 0.25 m2 = 0.000025 ha. Square kilometre
-- and square mile are left out: at 6 decimals a small item would round to double.
INSERT INTO public.sys_uom_cd
  (uom_code, name, name2, symbol, symbol2, uom_dimension, is_base_unit, is_packaging, qty_decimals, unece_code, is_to_seed, rec_order, created_by, created_info)
VALUES
  ('SQMM', 'Square millimetre', 'مليمتر مربع', 'mm²', 'مم²',     'AREA', false, false, 0, 'MMK', false, 221, 'system', '0860 area units'),
  ('SQCM', 'Square centimetre', 'سنتيمتر مربع', 'cm²', 'سم²',    'AREA', false, false, 0, 'CMK', false, 222, 'system', '0860 area units'),
  ('SQIN', 'Square inch',       'بوصة مربعة',  'in²', 'بوصة²',   'AREA', false, false, 0, 'INK', false, 223, 'system', '0860 area units'),
  ('SQYD', 'Square yard',       'ياردة مربعة', 'yd²', 'ياردة²',  'AREA', false, false, 2, 'YDK', false, 224, 'system', '0860 area units'),
  ('ARE',  'Are',               'آر',          'a',   'آر',      'AREA', false, false, 4, 'ARE', false, 225, 'system', '0860 area units'),
  ('HA',   'Hectare',           'هكتار',       'ha',  'هكتار',   'AREA', false, false, 6, 'HAR', false, 226, 'system', '0860 area units'),
  ('ACRE', 'Acre',              'أكر',         'ac',  'أكر',     'AREA', false, false, 6, 'ACR', false, 227, 'system', '0860 area units')
ON CONFLICT (uom_code) DO NOTHING;

-- Each to the base area unit; divide_rate = 1 / multiply_rate rounded to 12 dp.
INSERT INTO public.sys_uom_conv_cd (from_uom_code, to_uom_code, multiply_rate, divide_rate, rec_notes, created_by, created_info)
VALUES
  ('SQMM', 'SQM', 0.000001,      1000000,           'SI',                       'system', '0860 area units'),
  ('SQCM', 'SQM', 0.0001,        10000,             'SI',                       'system', '0860 area units'),
  ('SQIN', 'SQM', 0.00064516,    1550.003100006200, 'International inch² 1959', 'system', '0860 area units'),
  ('SQYD', 'SQM', 0.83612736,    1.195990046301,    'International yard² 1959', 'system', '0860 area units'),
  ('ARE',  'SQM', 100,           0.01,              'SI (accepted unit)',       'system', '0860 area units'),
  ('HA',   'SQM', 10000,         0.0001,            'SI (accepted unit)',       'system', '0860 area units'),
  ('ACRE', 'SQM', 4046.8564224,  0.000247105381,    'International acre 1959',  'system', '0860 area units')
ON CONFLICT (from_uom_code, to_uom_code) DO NOTHING;

COMMIT;
