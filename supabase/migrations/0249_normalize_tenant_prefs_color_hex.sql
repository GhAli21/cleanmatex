-- ==================================================================
-- Migration: 0249_normalize_tenant_prefs_color_hex.sql
-- Purpose: Canonicalize tenant-stored `#RGB` / `#RRGGBB` prefs colors to
--          uppercase `#RRGGBB` (`org_service_preference_cf.color_hex`,
--          `org_preference_kind_cf.kind_bg_color`). Adds reusable helper for
--          future seeds/normalization jobs.
-- Do NOT apply automatically — tenant reviews/applies migrations per project rules.
-- ==================================================================

BEGIN;

CREATE OR REPLACE FUNCTION cmf_color_hex_normalize7(p_hex text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN p_hex IS NULL OR length(btrim(p_hex)) = 0 THEN NULL::text
  WHEN upper(btrim(p_hex)) ~ '^#[0-9A-F]{6}$' THEN upper(btrim(p_hex))
  WHEN upper(btrim(p_hex)) ~ '^#[0-9A-F]{3}$' THEN
    '#' ||
    repeat(substr(upper(btrim(p_hex)), 2, 1), 2) ||
    repeat(substr(upper(btrim(p_hex)), 3, 1), 2) ||
    repeat(substr(upper(btrim(p_hex)), 4, 1), 2)
  ELSE btrim(p_hex)
END;
$$;

COMMENT ON FUNCTION cmf_color_hex_normalize7(text) IS
  'Normalize prefs swatch/tab hex: expand #RGB, uppercase #RRGGBB, trim; non-hex retained as trimmed (within VARCHAR(20)).';

UPDATE org_service_preference_cf
SET color_hex = cmf_color_hex_normalize7(color_hex)
WHERE color_hex IS NOT NULL AND btrim(color_hex) <> '';

UPDATE org_preference_kind_cf
SET kind_bg_color = cmf_color_hex_normalize7(kind_bg_color)
WHERE kind_bg_color IS NOT NULL AND btrim(kind_bg_color) <> '';

COMMENT ON COLUMN org_service_preference_cf.color_hex IS
  'Garment swatch: preferably uppercase #RRGGBB; NULL inherits sys_service_preference_cd.color_hex.';
COMMENT ON COLUMN org_preference_kind_cf.kind_bg_color IS
  'Order panel tint: preferably uppercase #RRGGBB; NULL inherits sys_preference_kind_cd.kind_bg_color.';

COMMIT;
