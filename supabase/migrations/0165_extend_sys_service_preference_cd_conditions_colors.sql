-- ==================================================================
-- Migration: 0165_extend_sys_service_preference_cd_conditions_colors.sql
-- Purpose: Extend sys_service_preference_cd with conditions/colors support,
--          seed conditions and colors, extend org_service_preference_cf
-- Part of: Customer/Order/Item/Pieces Preferences - Unified Plan
-- Do NOT apply - user runs migrations manually
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Add columns to sys_service_preference_cd
-- ==================================================================

ALTER TABLE sys_service_preference_cd
  ADD COLUMN IF NOT EXISTS preference_sys_kind VARCHAR(30) DEFAULT 'service_prefs',
  ADD COLUMN IF NOT EXISTS is_color_prefs BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS color_hex VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_note_prefs BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_used_by_system BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_allow_to_show_for_user BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_type_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_show_in_quick_bar BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_show_in_all_stages BOOLEAN DEFAULT true;

COMMENT ON COLUMN sys_service_preference_cd.preference_sys_kind IS 'Discriminator: service_prefs, condition_stain, condition_damag, color, note';
COMMENT ON COLUMN sys_service_preference_cd.is_color_prefs IS 'True when preference_sys_kind=color';
COMMENT ON COLUMN sys_service_preference_cd.color_hex IS 'Hex for color swatches (e.g. #FF0000)';
COMMENT ON COLUMN sys_service_preference_cd.system_type_code IS 'Optional grouping: stain, damage, solid, pattern';

-- Backfill: Set preference_sys_kind for existing rows
UPDATE sys_service_preference_cd
SET preference_sys_kind = 'service_prefs'
WHERE preference_sys_kind IS NULL OR preference_sys_kind = '';

-- ==================================================================
-- SECTION 2: Seed conditions (stains, damage, special)
-- ==================================================================

INSERT INTO sys_service_preference_cd (
  code, name, name2, preference_category, preference_sys_kind,
  is_color_prefs, is_note_prefs, is_used_by_system, is_allow_to_show_for_user,
  system_type_code, is_show_in_quick_bar, is_show_in_all_stages,
  display_order, icon, is_active, created_by
) VALUES
-- Stains (condition_stain)
('COFFEE', 'Coffee', 'قهوة', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 101, 'mdi-coffee', true, 'system_admin'),
('WINE', 'Wine', 'نبيذ', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 102, 'mdi-glass-wine', true, 'system_admin'),
('BLOOD', 'Blood', 'دم', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 103, 'mdi-water', true, 'system_admin'),
('MUD', 'Mud', 'طين', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 104, 'mdi-mud', true, 'system_admin'),
('OIL', 'Oil', 'زيت', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 105, 'mdi-oil', true, 'system_admin'),
('INK', 'Ink', 'حبر', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 106, 'mdi-pen', true, 'system_admin'),
('GREASE', 'Grease', 'شحوم', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 107, 'mdi-grease', true, 'system_admin'),
('BLEACH', 'Bleach stain', 'بقع مبيض', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 108, 'mdi-bottle-tonic', true, 'system_admin'),
('BUBBLE', 'Bubble gum', 'علكة', 'stain', 'condition_stain', false, false, true, true, 'stain', true, true, 109, 'mdi-circle', true, 'system_admin'),
-- Damage (condition_damag)
('BUTTON_BROKEN', 'Button Broken', 'زر مكسور', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 201, 'mdi-circle-outline', true, 'system_admin'),
('BUTTON_MISSING', 'Button Missing', 'زر مفقود', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 202, 'mdi-minus-circle', true, 'system_admin'),
('COLLAR_TORN', 'Collar Torn', 'ياقة ممزقة', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 203, 'mdi-tshirt-crew', true, 'system_admin'),
('ZIPPER_BROKEN', 'Zipper Broken', 'سحاب مكسور', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 204, 'mdi-zip-box', true, 'system_admin'),
('HOLE', 'Hole', 'ثقب', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 205, 'mdi-circle', true, 'system_admin'),
('TEAR', 'Tear', 'تمزق', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 206, 'mdi-scissors-cutting', true, 'system_admin'),
('SEAM_OPEN', 'Seam Open', 'درز مفتوح', 'damage', 'condition_damag', false, false, true, true, 'damage', true, true, 207, 'mdi-separator', true, 'system_admin'),
-- Special (condition_stain for special care)
('SPECIAL_CARE', 'Special Care', 'عناية خاصة', 'special', 'condition_stain', false, false, true, true, 'special', true, true, 301, 'mdi-heart', true, 'system_admin'),
('DELICATE_COND', 'Delicate', 'هش', 'special', 'condition_stain', false, false, true, true, 'special', true, true, 302, 'mdi-hand-heart', true, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- SECTION 3: Seed colors (preference_sys_kind=color, is_color_prefs=true)
-- ==================================================================

INSERT INTO sys_service_preference_cd (
  code, name, name2, preference_category, preference_sys_kind,
  is_color_prefs, is_note_prefs, is_used_by_system, is_allow_to_show_for_user,
  system_type_code, color_hex, is_show_in_quick_bar, is_show_in_all_stages,
  display_order, icon, is_active, created_by
) VALUES
-- Solid colors
('BLACK', 'Black', 'أسود', 'color', 'color', true, false, true, true, 'solid', '#000000', true, true, 401, 'mdi-circle', true, 'system_admin'),
('WHITE', 'White', 'أبيض', 'color', 'color', true, false, true, true, 'solid', '#FFFFFF', true, true, 402, 'mdi-circle', true, 'system_admin'),
('GREY', 'Grey', 'رمادي', 'color', 'color', true, false, true, true, 'solid', '#808080', true, true, 403, 'mdi-circle', true, 'system_admin'),
('RED', 'Red', 'أحمر', 'color', 'color', true, false, true, true, 'solid', '#FF0000', true, true, 404, 'mdi-circle', true, 'system_admin'),
('BLUE', 'Blue', 'أزرق', 'color', 'color', true, false, true, true, 'solid', '#0000FF', true, true, 405, 'mdi-circle', true, 'system_admin'),
('GREEN', 'Green', 'أخضر', 'color', 'color', true, false, true, true, 'solid', '#008000', true, true, 406, 'mdi-circle', true, 'system_admin'),
('YELLOW', 'Yellow', 'أصفر', 'color', 'color', true, false, true, true, 'solid', '#FFFF00', true, true, 407, 'mdi-circle', true, 'system_admin'),
('ORANGE', 'Orange', 'برتقالي', 'color', 'color', true, false, true, true, 'solid', '#FFA500', true, true, 408, 'mdi-circle', true, 'system_admin'),
('PINK', 'Pink', 'وردي', 'color', 'color', true, false, true, true, 'solid', '#FFC0CB', true, true, 409, 'mdi-circle', true, 'system_admin'),
('PURPLE', 'Purple', 'بنفسجي', 'color', 'color', true, false, true, true, 'solid', '#800080', true, true, 410, 'mdi-circle', true, 'system_admin'),
('BROWN', 'Brown', 'بني', 'color', 'color', true, false, true, true, 'solid', '#8B4513', true, true, 411, 'mdi-circle', true, 'system_admin'),
('NAVY', 'Navy', 'كحلي', 'color', 'color', true, false, true, true, 'solid', '#000080', true, true, 412, 'mdi-circle', true, 'system_admin'),
('BEIGE', 'Beige', 'بيج', 'color', 'color', true, false, true, true, 'solid', '#F5F5DC', true, true, 413, 'mdi-circle', true, 'system_admin'),
-- Pattern
('STRIPED', 'Striped', 'مخطط', 'color', 'color', true, false, true, true, 'pattern', NULL, true, true, 501, 'mdi-format-list-bulleted', true, 'system_admin'),
('CHECKERED', 'Checkered', 'مربعات', 'color', 'color', true, false, true, true, 'pattern', NULL, true, true, 502, 'mdi-checkerboard', true, 'system_admin'),
('MULTI_COLOR', 'Multi-Color', 'متعدد الألوان', 'color', 'color', true, false, true, true, 'pattern', NULL, true, true, 503, 'mdi-palette', true, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- SECTION 4: Add columns to org_service_preference_cf
-- ==================================================================

ALTER TABLE org_service_preference_cf
  ADD COLUMN IF NOT EXISTS preference_sys_kind VARCHAR(30),
  ADD COLUMN IF NOT EXISTS is_show_in_quick_bar BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_show_in_all_stages BOOLEAN DEFAULT true;

COMMENT ON COLUMN org_service_preference_cf.preference_sys_kind IS 'Denormalized from sys_service_preference_cd for filtering';
COMMENT ON COLUMN org_service_preference_cf.is_show_in_quick_bar IS 'Tenant override for quick-select bar';
COMMENT ON COLUMN org_service_preference_cf.is_show_in_all_stages IS 'Tenant override for workflow stages';

-- Backfill preference_sys_kind from sys catalog
UPDATE org_service_preference_cf cf
SET preference_sys_kind = cd.preference_sys_kind
FROM sys_service_preference_cd cd
WHERE cf.preference_code = cd.code
  AND (cf.preference_sys_kind IS NULL OR cf.preference_sys_kind = '');

COMMIT;
