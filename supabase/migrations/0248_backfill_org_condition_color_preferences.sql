-- ==================================================================
-- Migration: 0248_backfill_org_condition_color_preferences.sql
-- Purpose:
--   A) sys_service_preference_cd — upsert parity rows for POS piece
--      conditions matching web-admin STAIN_CONDITIONS / UI_TO_CATALOG
--      (lib/types/order-creation.ts, lib/utils/condition-codes.ts).
--   B) org_service_preference_cf — fix denormalized catalog drift
--      (kind, category, flags, fabric/keyword fields, system_type_code)
--      for those codes on existing tenant rows (icon/color_hex: keep tenant
--      override when already set).
--   C) Tenant CF backfills — for each org_tenants_mst row with
--      is_active = true (primary; NULL excluded) and not soft-deleted
--      (rec_status = 1), insert missing org_preference_kind_cf,
--      org_service_preference_cf, org_packing_preference_cf from active
--      sys catalog (service prefs require join to active sys_preference_kind_cd).
-- Safety: org inserts use ON CONFLICT DO NOTHING; sys uses ON CONFLICT UPDATE.
-- Schema cross-check: verified against remote public.* column list
-- (information_schema) for unique keys (tenant_org_id, preference_code),
-- org_service_preference_cf.system_type_code, org_preference_kind_cf.is_stopped_by_saas default.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) sys_service_preference_cd — STAIN_CONDITIONS / UI_TO_CATALOG parity
-- ------------------------------------------------------------------
INSERT INTO sys_service_preference_cd (
  code,
  name,
  name2,
  description,
  description2,
  preference_category,
  preference_sys_kind,
  is_color_prefs,
  is_note_prefs,
  is_used_by_system,
  is_allow_to_show_for_user,
  system_type_code,
  is_show_in_quick_bar,
  is_show_in_all_stages,
  default_extra_price,
  extra_turnaround_minutes,
  sustainability_score,
  color_hex,
  applies_to_fabric_types,
  is_incompatible_with,
  keywords,
  workflow_impact,
  display_order,
  icon,
  is_active,
  created_by
)
VALUES
  ('BUBBLE',      'Bubble',      'علكة',            NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 101, 'mdi-circle',          true, '0248_parity'),
  ('COFFEE',      'Coffee',      'قهوة',            NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 102, 'mdi-coffee',          true, '0248_parity'),
  ('INK',         'Ink',         'حبر',             NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 106, 'mdi-pen',             true, '0248_parity'),
  ('GREASE',      'Grease',      'شحوم',            NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 107, 'mdi-grease',          true, '0248_parity'),
  ('BLEACH',      'Bleach',      'بقع مبيض',        NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 108, 'mdi-bottle-tonic',  true, '0248_parity'),
  ('WINE',        'Wine',        'نبيذ',            NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 103, 'mdi-glass-wine',      true, '0248_parity'),
  ('BLOOD',       'Blood',       'دم',              NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 104, 'mdi-water',           true, '0248_parity'),
  ('MUD',         'Mud',         'طين',             NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 105, 'mdi-mud',             true, '0248_parity'),
  ('OIL',         'Oil',         'زيت',             NULL, NULL, 'stain',   'condition_stain',   false, false, true, true, 'stain',   true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 110, 'mdi-oil',             true, '0248_parity'),
  ('BUTTON_BROKEN',  'Button Broken',  'زر مكسور',      NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 201, 'mdi-circle-outline',  true, '0248_parity'),
  ('BUTTON_MISSING', 'Button Missing', 'زر مفقود',      NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 202, 'mdi-minus-circle',    true, '0248_parity'),
  ('COLLAR_TORN',    'Collar Torn',    'ياقة ممزقة',    NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 203, 'mdi-tshirt-crew',     true, '0248_parity'),
  ('ZIPPER_BROKEN',  'Zipper Broken',  'سحاب مكسور',    NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 204, 'mdi-zip-box',         true, '0248_parity'),
  ('HOLE',           'Hole',           'ثقب',           NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 205, 'mdi-circle',          true, '0248_parity'),
  ('TEAR',           'Tear',           'تمزق',          NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 206, 'mdi-scissors-cutting', true, '0248_parity'),
  ('SEAM_OPEN',      'Seam Open',      'درز مفتوح',     NULL, NULL, 'damage',  'condition_damag',   false, false, true, true, 'damage',  true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 207, 'mdi-separator',       true, '0248_parity'),
  ('SPECIAL_CARE',   'Special Care',   'عناية خاصة',    NULL, NULL, 'special', 'condition_special', false, false, true, true, 'special', true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 301, 'mdi-heart',           true, '0248_parity'),
  ('DELICATE_COND',  'Delicate',       'هش',            NULL, NULL, 'special', 'condition_special', false, false, true, true, 'special', true, true, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, 302, 'mdi-hand-heart',      true, '0248_parity')
ON CONFLICT (code) DO UPDATE SET
  description             = EXCLUDED.description,
  description2            = EXCLUDED.description2,
  name                    = EXCLUDED.name,
  name2                   = EXCLUDED.name2,
  preference_category     = EXCLUDED.preference_category,
  preference_sys_kind     = EXCLUDED.preference_sys_kind,
  is_color_prefs          = EXCLUDED.is_color_prefs,
  is_note_prefs           = EXCLUDED.is_note_prefs,
  is_used_by_system       = EXCLUDED.is_used_by_system,
  is_allow_to_show_for_user = EXCLUDED.is_allow_to_show_for_user,
  system_type_code        = EXCLUDED.system_type_code,
  is_show_in_quick_bar    = EXCLUDED.is_show_in_quick_bar,
  is_show_in_all_stages   = EXCLUDED.is_show_in_all_stages,
  default_extra_price     = EXCLUDED.default_extra_price,
  extra_turnaround_minutes = EXCLUDED.extra_turnaround_minutes,
  sustainability_score    = EXCLUDED.sustainability_score,
  color_hex               = EXCLUDED.color_hex,
  applies_to_fabric_types = EXCLUDED.applies_to_fabric_types,
  is_incompatible_with    = EXCLUDED.is_incompatible_with,
  keywords                = EXCLUDED.keywords,
  workflow_impact         = EXCLUDED.workflow_impact,
  display_order           = EXCLUDED.display_order,
  icon                    = EXCLUDED.icon,
  is_active               = true,
  updated_at              = NOW(),
  updated_by              = '0248_parity';

-- ------------------------------------------------------------------
-- 2) org_service_preference_cf — sync denormalized catalog for parity codes
-- ------------------------------------------------------------------
UPDATE org_service_preference_cf cf
SET
  preference_sys_kind       = cd.preference_sys_kind,
  preference_category      = cd.preference_category,
  system_type_code         = cd.system_type_code,
  applies_to_fabric_types  = cd.applies_to_fabric_types,
  is_incompatible_with     = cd.is_incompatible_with,
  workflow_impact          = cd.workflow_impact,
  sustainability_score     = cd.sustainability_score,
  keywords                 = cd.keywords,
  icon                     = COALESCE(cf.icon, cd.icon),
  is_color_prefs           = cd.is_color_prefs,
  color_hex                = COALESCE(cf.color_hex, cd.color_hex),
  is_note_prefs            = cd.is_note_prefs,
  is_used_by_system        = cd.is_used_by_system,
  is_allow_to_show_for_user = cd.is_allow_to_show_for_user
FROM sys_service_preference_cd cd
WHERE cf.preference_code = cd.code
  AND cd.code IN (
    'BUBBLE','COFFEE','INK','GREASE','BLEACH','WINE','BLOOD','MUD','OIL',
    'BUTTON_BROKEN','BUTTON_MISSING','COLLAR_TORN','ZIPPER_BROKEN','HOLE','TEAR','SEAM_OPEN',
    'SPECIAL_CARE','DELICATE_COND'
  )
  AND (
    cf.preference_sys_kind IS DISTINCT FROM cd.preference_sys_kind
    OR cf.preference_category IS DISTINCT FROM cd.preference_category
    OR cf.system_type_code IS DISTINCT FROM cd.system_type_code
    OR cf.applies_to_fabric_types IS DISTINCT FROM cd.applies_to_fabric_types
    OR cf.is_incompatible_with IS DISTINCT FROM cd.is_incompatible_with
    OR cf.workflow_impact IS DISTINCT FROM cd.workflow_impact
    OR cf.sustainability_score IS DISTINCT FROM cd.sustainability_score
    OR cf.keywords IS DISTINCT FROM cd.keywords
    OR cf.is_color_prefs IS DISTINCT FROM cd.is_color_prefs
    OR cf.is_note_prefs IS DISTINCT FROM cd.is_note_prefs
    OR cf.is_used_by_system IS DISTINCT FROM cd.is_used_by_system
    OR cf.is_allow_to_show_for_user IS DISTINCT FROM cd.is_allow_to_show_for_user
    OR (cf.icon IS NULL AND cd.icon IS NOT NULL)
    OR (cf.color_hex IS NULL AND cd.color_hex IS NOT NULL)
  );

-- ------------------------------------------------------------------
-- 3) org_preference_kind_cf ← active sys_preference_kind_cd (tab row)
-- ------------------------------------------------------------------
INSERT INTO org_preference_kind_cf (
  tenant_org_id,
  kind_code,
  name,
  name2,
  kind_bg_color,
  is_show_in_quick_bar,
  is_show_for_customer,
  rec_order,
  is_active,
  created_by,
  created_info
)
SELECT
  t.id,
  s.kind_code,
  s.name,
  s.name2,
  s.kind_bg_color,
  s.is_show_in_quick_bar,
  s.is_show_for_customer,
  s.rec_order,
  true,
  '0248_backfill',
  'Backfill org_preference_kind_cf from sys_preference_kind_cd'
FROM org_tenants_mst t
CROSS JOIN sys_preference_kind_cd s
WHERE t.is_active = true
  AND COALESCE(t.rec_status, 1) = 1
  AND s.is_active = true
ON CONFLICT (tenant_org_id, kind_code) DO NOTHING;

-- ------------------------------------------------------------------
-- 4) org_service_preference_cf ← active sys_service_preference_cd
-- ------------------------------------------------------------------
INSERT INTO org_service_preference_cf (
  tenant_org_id,
  preference_code,
  is_system_code,
  name,
  name2,
  extra_price,
  extra_turnaround_minutes,
  applies_to_services,
  is_active,
  display_order,
  created_by,
  created_info,
  preference_sys_kind,
  is_show_in_quick_bar,
  is_show_in_all_stages,
  preference_category,
  applies_to_fabric_types,
  is_incompatible_with,
  workflow_impact,
  sustainability_score,
  keywords,
  icon,
  is_color_prefs,
  color_hex,
  is_note_prefs,
  is_used_by_system,
  is_allow_to_show_for_user,
  system_type_code
)
SELECT
  t.id,
  cd.code,
  true,
  cd.name,
  cd.name2,
  COALESCE(cd.default_extra_price, 0::NUMERIC(19, 4)),
  cd.extra_turnaround_minutes,
  NULL::TEXT[],
  true,
  cd.display_order,
  '0248_backfill',
  'Backfill org_service_preference_cf from sys_service_preference_cd',
  cd.preference_sys_kind,
  COALESCE(cd.is_show_in_quick_bar, true),
  COALESCE(cd.is_show_in_all_stages, true),
  cd.preference_category,
  cd.applies_to_fabric_types,
  cd.is_incompatible_with,
  cd.workflow_impact,
  cd.sustainability_score,
  cd.keywords,
  cd.icon,
  COALESCE(cd.is_color_prefs, false),
  cd.color_hex,
  COALESCE(cd.is_note_prefs, false),
  COALESCE(cd.is_used_by_system, true),
  COALESCE(cd.is_allow_to_show_for_user, true),
  cd.system_type_code
FROM org_tenants_mst t
CROSS JOIN sys_service_preference_cd cd
INNER JOIN sys_preference_kind_cd k
  ON k.kind_code = cd.preference_sys_kind
  AND k.is_active = true
WHERE t.is_active = true
  AND COALESCE(t.rec_status, 1) = 1
  AND cd.is_active = true
  AND cd.preference_sys_kind IS NOT NULL
  AND btrim(cd.preference_sys_kind) <> ''
ON CONFLICT (tenant_org_id, preference_code) DO NOTHING;

-- ------------------------------------------------------------------
-- 5) org_packing_preference_cf ← active sys_packing_preference_cd
-- ------------------------------------------------------------------
INSERT INTO org_packing_preference_cf (
  tenant_org_id,
  packing_pref_code,
  is_system_code,
  name,
  name2,
  extra_price,
  is_active,
  display_order,
  created_by,
  created_info
)
SELECT
  t.id,
  p.code,
  true,
  p.name,
  p.name2,
  0::NUMERIC(19, 4),
  true,
  p.display_order,
  '0248_backfill',
  'Backfill org_packing_preference_cf from sys_packing_preference_cd'
FROM org_tenants_mst t
CROSS JOIN sys_packing_preference_cd p
WHERE t.is_active = true
  AND COALESCE(t.rec_status, 1) = 1
  AND p.is_active = true
ON CONFLICT (tenant_org_id, packing_pref_code) DO NOTHING;

COMMIT;
