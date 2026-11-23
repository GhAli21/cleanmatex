-- =============================================================================
-- Migration: 0813_uom_units_conversions.sql
-- Purpose:   Unit of Measure platform, part 1 of Migration A
--            (docs/features/Measured_Pricing/PLAN.md §3.2–§3.4, decisions D7, D8, D10, D11):
--            1. sys_uom_cd       – HQ catalog of units (piece, kg, m, m², L, h …) with UN/ECE Rec 20 codes.
--            2. sys_uom_conv_cd  – HQ standard conversions (lb→kg, cm→m …), open multiply + divide rates.
--            3. org_uom_cf       – every unit an Organization can use: seeded copies of system units
--                                  plus the Organization's own custom units. Tenant tables FK here.
--            4. org_uom_conv_cf  – Organization conversions: seeded copies of system pairs, tenant pairs,
--                                  and per-product pairs (1 BOX = 12 PC for one product).
--            5. fn_uom_seed_tenant / fn_uom_sync_all_tenants – copy and refresh system rows per tenant;
--               run for every existing tenant here, on every new tenant (trigger), and on every HQ edit.
--            6. fn_uom_conv_rate / fn_uom_convert / fn_uom_assert_qty_scale – bounded resolver and the
--               whole-number / decimals rule, mirrored by web-admin lib/uom/.
--            7. fn_uom_reset_unit / fn_uom_reset_conv – "Reset to system" for customized rows.
-- Affected:  new sys_uom_cd, sys_uom_conv_cd, org_uom_cf, org_uom_conv_cf and their functions/triggers;
--            new AFTER INSERT trigger on org_tenants_mst.
-- Related:   0814 (product / order / price-list / stock columns), 0815 (permissions + navigation).
--            Precision class RATE = DECIMAL(28,12) (docs/dev/rules/numeric-precision.md).
-- Idempotent: no (forward-only DDL). Seeds use ON CONFLICT.
-- Rollback (manual, forward-only): drop trigger trg_tenant_uom_seed, then the four tables RESTRICT
--            (after 0814 is rolled back), then the functions.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. System units ─────────────────────────────────────────────────────────

-- HQ-owned catalog of units. Read by HQ and copied into each Organization (org_uom_cf);
-- tenant screens never read this table directly for their own work.
CREATE TABLE public.sys_uom_cd (
  uom_code      TEXT        NOT NULL,                 -- Stable code, upper case (KG, SQM, PC)
  name          TEXT        NOT NULL,                 -- English name
  name2         TEXT        NULL,                     -- Arabic name
  symbol        TEXT        NOT NULL,                 -- English short symbol shown after quantities (kg, m²)
  symbol2       TEXT        NULL,                     -- Arabic short symbol (كغ, م²)
  uom_dimension TEXT        NOT NULL,                 -- What the unit measures: COUNT MASS LENGTH AREA VOLUME TIME
  is_base_unit  BOOLEAN     NOT NULL DEFAULT false,   -- The one unit per dimension every conversion resolves through
  is_packaging  BOOLEAN     NOT NULL DEFAULT false,   -- Size depends on the product (BOX, BAG): converts per product only
  qty_decimals  SMALLINT    NOT NULL DEFAULT 0,       -- Decimals a quantity in this unit may carry; COUNT is always 0
  unece_code    TEXT        NOT NULL,                 -- UN/ECE Recommendation 20 code for e-invoices (KGM, MTR, H87)
  is_to_seed    BOOLEAN     NOT NULL DEFAULT true,    -- Copied into every Organization automatically
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  updated_count INTEGER     NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ NULL,
  deleted_by    TEXT        NULL,
  deleted_info  TEXT        NULL,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  rec_order     INTEGER     NULL,                     -- Display order in pickers
  rec_notes     TEXT        NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_uom_cd PRIMARY KEY (uom_code),
  CONSTRAINT ck_suom_code CHECK (uom_code ~ '^[A-Z][A-Z0-9_]{0,19}$'),
  CONSTRAINT ck_suom_dimension CHECK (uom_dimension IN ('COUNT', 'MASS', 'LENGTH', 'AREA', 'VOLUME', 'TIME')),
  CONSTRAINT ck_suom_decimals CHECK (qty_decimals BETWEEN 0 AND 6 AND (uom_dimension <> 'COUNT' OR qty_decimals = 0)),
  CONSTRAINT ck_suom_base_seeded CHECK (NOT is_base_unit OR is_to_seed),
  CONSTRAINT ck_suom_base_not_pack CHECK (NOT (is_base_unit AND is_packaging)),
  CONSTRAINT ck_suom_unece CHECK (unece_code ~ '^[A-Z0-9]{2,3}$'),
  CONSTRAINT ck_suom_names CHECK (btrim(name) <> '' AND btrim(symbol) <> ''),
  CONSTRAINT ck_suom_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_suom_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

-- Exactly one base unit per dimension: the anchor of every two-leg conversion.
CREATE UNIQUE INDEX uq_suom_base_per_dim ON public.sys_uom_cd (uom_dimension) WHERE is_base_unit;

COMMENT ON TABLE public.sys_uom_cd IS 'HQ catalog of units of measure. Rows flagged is_to_seed are copied into every Organization (org_uom_cf) and kept in sync by trigger; locked fields (dimension, base flag, packaging flag, UN/ECE code) always come from here.';
COMMENT ON COLUMN public.sys_uom_cd.uom_code IS 'Stable unit code (upper case, letters/digits/underscore, max 20). Primary key; also the code of the tenant copy.';
COMMENT ON COLUMN public.sys_uom_cd.name IS 'English unit name.';
COMMENT ON COLUMN public.sys_uom_cd.name2 IS 'Arabic unit name.';
COMMENT ON COLUMN public.sys_uom_cd.symbol IS 'English short symbol shown after quantities (kg, m, m²).';
COMMENT ON COLUMN public.sys_uom_cd.symbol2 IS 'Arabic short symbol shown after quantities.';
COMMENT ON COLUMN public.sys_uom_cd.uom_dimension IS 'What the unit measures: COUNT, MASS, LENGTH, AREA, VOLUME or TIME. A product is "measured" when its unit is not COUNT. Cannot change once tenants hold a copy.';
COMMENT ON COLUMN public.sys_uom_cd.is_base_unit IS 'True for the single base unit of the dimension (PC, KG, M, SQM, L, HR); conversions resolve through it. Cannot change once tenants hold a copy.';
COMMENT ON COLUMN public.sys_uom_cd.is_packaging IS 'True when the unit size depends on the product (BOX, PACK, BAG, SET): it converts only through per-product conversions.';
COMMENT ON COLUMN public.sys_uom_cd.qty_decimals IS 'How many decimals a quantity in this unit may have (0–6). COUNT units are always 0, so piece counts stay whole.';
COMMENT ON COLUMN public.sys_uom_cd.unece_code IS 'UN/ECE Recommendation 20 unit code written on e-invoice lines (H87 piece, KGM kilogram, MTR metre, MTK square metre).';
COMMENT ON COLUMN public.sys_uom_cd.is_to_seed IS 'True = copied into every Organization automatically. False = Organizations add it on demand ("Add from system catalog"). Base units are always seeded.';
COMMENT ON COLUMN public.sys_uom_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_uom_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_uom_cd.created_info IS 'Creation context (screen, migration).';
COMMENT ON COLUMN public.sys_uom_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_uom_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_uom_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_uom_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_uom_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_uom_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_uom_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_uom_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived. Units are never hard-deleted.';
COMMENT ON COLUMN public.sys_uom_cd.rec_order IS 'Display order in unit pickers.';
COMMENT ON COLUMN public.sys_uom_cd.rec_notes IS 'Free notes about the unit.';
COMMENT ON COLUMN public.sys_uom_cd.is_active IS 'False = no longer offered to Organizations; existing tenant copies stay usable.';
COMMENT ON CONSTRAINT pk_sys_uom_cd ON public.sys_uom_cd IS 'One row per unit code.';
COMMENT ON CONSTRAINT ck_suom_code ON public.sys_uom_cd IS 'Codes are upper case, start with a letter, max 20 characters.';
COMMENT ON CONSTRAINT ck_suom_dimension ON public.sys_uom_cd IS 'Allowed dimensions.';
COMMENT ON CONSTRAINT ck_suom_decimals ON public.sys_uom_cd IS 'Decimals 0–6; COUNT units are whole numbers (D11).';
COMMENT ON CONSTRAINT ck_suom_base_seeded ON public.sys_uom_cd IS 'Base units are copied into every Organization so every dimension has its anchor.';
COMMENT ON CONSTRAINT ck_suom_base_not_pack ON public.sys_uom_cd IS 'A base unit has a fixed size, so it cannot be a packaging unit.';
COMMENT ON CONSTRAINT ck_suom_unece ON public.sys_uom_cd IS 'UN/ECE Rec 20 codes are 2–3 upper-case letters or digits.';
COMMENT ON CONSTRAINT ck_suom_names ON public.sys_uom_cd IS 'Name and symbol are not blank.';
COMMENT ON CONSTRAINT ck_suom_rec_status ON public.sys_uom_cd IS 'Standard rec_status values.';
COMMENT ON CONSTRAINT ck_suom_deleted_inactive ON public.sys_uom_cd IS 'Soft-deleted or archived units cannot stay active.';
COMMENT ON INDEX public.uq_suom_base_per_dim IS 'At most one base unit per dimension.';

CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.sys_uom_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.sys_uom_cd IS 'Keeps updated_at and updated_count current.';

-- Read and written by HQ through the service connection only.
ALTER TABLE public.sys_uom_cd ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_uom_cd FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sys_uom_cd TO service_role;

-- Seed (sources: UN/ECE Recommendation 20 rev. 17 code list; SI and US customary definitions).
-- Rarely used units are not seeded by default (is_to_seed = false); tenants add them on demand.
INSERT INTO public.sys_uom_cd
  (uom_code, name, name2, symbol, symbol2, uom_dimension, is_base_unit, is_packaging, qty_decimals, unece_code, is_to_seed, rec_order, created_by, created_info)
VALUES
  ('PC',   'Piece',           'قطعة',        'pc',   'قطعة',  'COUNT',  true,  false, 0, 'H87', true,  10,  'system', '0813 uom seed'),
  ('PAIR', 'Pair',            'زوج',         'pair', 'زوج',   'COUNT',  false, false, 0, 'PR',  true,  20,  'system', '0813 uom seed'),
  ('SET',  'Set',             'طقم',         'set',  'طقم',   'COUNT',  false, true,  0, 'SET', true,  30,  'system', '0813 uom seed'),
  -- A suit is billed as one piece on e-invoices (Rec 20 has no suit code).
  ('SUIT', 'Suit',            'بدلة',        'suit', 'بدلة',  'COUNT',  false, true,  0, 'H87', true,  40,  'system', '0813 uom seed'),
  ('BAG',  'Bag',             'كيس',         'bag',  'كيس',   'COUNT',  false, true,  0, 'BG',  true,  50,  'system', '0813 uom seed'),
  ('BOX',  'Box',             'صندوق',       'box',  'صندوق', 'COUNT',  false, true,  0, 'BX',  true,  60,  'system', '0813 uom seed'),
  ('PACK', 'Pack',            'عبوة',        'pack', 'عبوة',  'COUNT',  false, true,  0, 'PK',  true,  70,  'system', '0813 uom seed'),
  ('BTL',  'Bottle',          'زجاجة',       'btl',  'زجاجة', 'COUNT',  false, true,  0, 'BO',  true,  80,  'system', '0813 uom seed'),
  ('ROLL', 'Roll',            'لفة',         'roll', 'لفة',   'COUNT',  false, true,  0, 'RO',  true,  90,  'system', '0813 uom seed'),
  ('DRUM', 'Drum',            'برميل',       'drum', 'برميل', 'COUNT',  false, true,  0, 'DR',  false, 100, 'system', '0813 uom seed'),
  ('KG',   'Kilogram',        'كيلوغرام',    'kg',   'كغ',    'MASS',   true,  false, 3, 'KGM', true,  110, 'system', '0813 uom seed'),
  ('G',    'Gram',            'غرام',        'g',    'غ',     'MASS',   false, false, 0, 'GRM', true,  120, 'system', '0813 uom seed'),
  ('LB',   'Pound',           'رطل',         'lb',   'رطل',   'MASS',   false, false, 3, 'LBR', true,  130, 'system', '0813 uom seed'),
  ('OZ',   'Ounce',           'أونصة',       'oz',   'أونصة', 'MASS',   false, false, 2, 'ONZ', false, 140, 'system', '0813 uom seed'),
  ('M',    'Metre',           'متر',         'm',    'م',     'LENGTH', true,  false, 2, 'MTR', true,  150, 'system', '0813 uom seed'),
  ('CM',   'Centimetre',      'سنتيمتر',     'cm',   'سم',    'LENGTH', false, false, 1, 'CMT', true,  160, 'system', '0813 uom seed'),
  ('MM',   'Millimetre',      'مليمتر',      'mm',   'مم',    'LENGTH', false, false, 0, 'MMT', true,  170, 'system', '0813 uom seed'),
  ('IN',   'Inch',            'بوصة',        'in',   'بوصة',  'LENGTH', false, false, 2, 'INH', true,  180, 'system', '0813 uom seed'),
  ('FT',   'Foot',            'قدم',         'ft',   'قدم',   'LENGTH', false, false, 2, 'FOT', true,  190, 'system', '0813 uom seed'),
  ('YD',   'Yard',            'ياردة',       'yd',   'ياردة', 'LENGTH', false, false, 2, 'YRD', false, 200, 'system', '0813 uom seed'),
  ('SQM',  'Square metre',    'متر مربع',    'm²',   'م²',    'AREA',   true,  false, 2, 'MTK', true,  210, 'system', '0813 uom seed'),
  ('SQFT', 'Square foot',     'قدم مربع',    'ft²',  'قدم²',  'AREA',   false, false, 2, 'FTK', false, 220, 'system', '0813 uom seed'),
  ('L',    'Litre',           'لتر',         'L',    'لتر',   'VOLUME', true,  false, 3, 'LTR', true,  230, 'system', '0813 uom seed'),
  ('ML',   'Millilitre',      'مليلتر',      'mL',   'مل',    'VOLUME', false, false, 0, 'MLT', true,  240, 'system', '0813 uom seed'),
  ('GAL',  'Gallon (US)',     'غالون',       'gal',  'غالون', 'VOLUME', false, false, 3, 'GLL', false, 250, 'system', '0813 uom seed'),
  ('HR',   'Hour',            'ساعة',        'h',    'س',     'TIME',   true,  false, 2, 'HUR', true,  260, 'system', '0813 uom seed'),
  ('MIN',  'Minute',          'دقيقة',       'min',  'د',     'TIME',   false, false, 0, 'MIN', true,  270, 'system', '0813 uom seed')
ON CONFLICT (uom_code) DO NOTHING;

-- ─── 2. System conversions ───────────────────────────────────────────────────

-- HQ standard conversions between units of the same dimension. Stored like FX rates:
-- qty_to = qty_from × multiply_rate, and back with divide_rate (both kept so neither side drifts).
CREATE TABLE public.sys_uom_conv_cd (
  from_uom_code TEXT          NOT NULL,               -- "UoM" in the conversion screen
  to_uom_code   TEXT          NOT NULL,               -- "UoM To"
  multiply_rate NUMERIC(28,12) NOT NULL,              -- qty_to = qty_from × multiply_rate
  divide_rate   NUMERIC(28,12) NOT NULL,              -- qty_from = qty_to × divide_rate (≈ 1 / multiply_rate)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT          NULL,
  created_info  TEXT          NULL,
  updated_at    TIMESTAMPTZ   NULL,
  updated_by    TEXT          NULL,
  updated_info  TEXT          NULL,
  updated_count INTEGER       NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ   NULL,
  deleted_by    TEXT          NULL,
  deleted_info  TEXT          NULL,
  rec_status    SMALLINT      NOT NULL DEFAULT 1,
  rec_order     INTEGER       NULL,
  rec_notes     TEXT          NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_uom_conv_cd PRIMARY KEY (from_uom_code, to_uom_code),
  CONSTRAINT fk_suomc_from FOREIGN KEY (from_uom_code) REFERENCES public.sys_uom_cd (uom_code) ON DELETE RESTRICT,
  CONSTRAINT fk_suomc_to FOREIGN KEY (to_uom_code) REFERENCES public.sys_uom_cd (uom_code) ON DELETE RESTRICT,
  CONSTRAINT ck_suomc_distinct CHECK (from_uom_code <> to_uom_code),
  CONSTRAINT ck_suomc_rates CHECK (multiply_rate > 0 AND divide_rate > 0 AND abs(multiply_rate * divide_rate - 1) <= 0.000001),
  CONSTRAINT ck_suomc_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_suomc_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

-- One row per unordered pair: KG→LB and LB→KG cannot both exist.
CREATE UNIQUE INDEX uq_suomc_pair ON public.sys_uom_conv_cd (LEAST(from_uom_code, to_uom_code), GREATEST(from_uom_code, to_uom_code));
-- FK support: lookups and RESTRICT checks by the "to" unit.
CREATE INDEX idx_suomc_to ON public.sys_uom_conv_cd (to_uom_code);

COMMENT ON TABLE public.sys_uom_conv_cd IS 'HQ standard conversions between units of the same dimension (open multiply + divide rates, like FX rate + inverse). Copied into each Organization (org_uom_conv_cf) when both units are present there.';
COMMENT ON COLUMN public.sys_uom_conv_cd.from_uom_code IS 'Source unit ("UoM").';
COMMENT ON COLUMN public.sys_uom_conv_cd.to_uom_code IS 'Target unit ("UoM To").';
COMMENT ON COLUMN public.sys_uom_conv_cd.multiply_rate IS 'qty_to = qty_from × multiply_rate. RATE precision (28,12).';
COMMENT ON COLUMN public.sys_uom_conv_cd.divide_rate IS 'qty_from = qty_to × divide_rate. Stored, not derived, so the reverse direction uses the published figure.';
COMMENT ON COLUMN public.sys_uom_conv_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_uom_conv_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_uom_conv_cd.created_info IS 'Creation context (screen, migration).';
COMMENT ON COLUMN public.sys_uom_conv_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_uom_conv_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_uom_conv_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_uom_conv_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_uom_conv_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_uom_conv_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_uom_conv_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_uom_conv_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_uom_conv_cd.rec_order IS 'Display order.';
COMMENT ON COLUMN public.sys_uom_conv_cd.rec_notes IS 'Free notes (source of the figure).';
COMMENT ON COLUMN public.sys_uom_conv_cd.is_active IS 'False = no longer copied to Organizations; existing copies stay.';
COMMENT ON CONSTRAINT pk_sys_uom_conv_cd ON public.sys_uom_conv_cd IS 'One row per ordered pair (the unordered-pair index forbids the reverse row too).';
COMMENT ON CONSTRAINT fk_suomc_from ON public.sys_uom_conv_cd IS 'Source must be a system unit; deleting a unit in use is blocked.';
COMMENT ON CONSTRAINT fk_suomc_to ON public.sys_uom_conv_cd IS 'Target must be a system unit; deleting a unit in use is blocked.';
COMMENT ON CONSTRAINT ck_suomc_distinct ON public.sys_uom_conv_cd IS 'A unit does not convert to itself.';
COMMENT ON CONSTRAINT ck_suomc_rates ON public.sys_uom_conv_cd IS 'Both rates positive and reciprocal within 0.000001.';
COMMENT ON CONSTRAINT ck_suomc_rec_status ON public.sys_uom_conv_cd IS 'Standard rec_status values.';
COMMENT ON CONSTRAINT ck_suomc_deleted_inactive ON public.sys_uom_conv_cd IS 'Soft-deleted or archived rows cannot stay active.';
COMMENT ON INDEX public.uq_suomc_pair IS 'One conversion per unordered unit pair.';
COMMENT ON INDEX public.idx_suomc_to IS 'Supports RESTRICT checks and lookups by target unit.';

CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.sys_uom_conv_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.sys_uom_conv_cd IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.sys_uom_conv_cd ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_uom_conv_cd FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sys_uom_conv_cd TO service_role;

-- Same-dimension, non-packaging rule for system pairs (packaging sizes are per product).
CREATE OR REPLACE FUNCTION public.fn_uom_sys_conv_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_from public.sys_uom_cd%ROWTYPE;
  v_to   public.sys_uom_cd%ROWTYPE;
BEGIN
  SELECT * INTO v_from FROM public.sys_uom_cd WHERE uom_code = NEW.from_uom_code;
  SELECT * INTO v_to   FROM public.sys_uom_cd WHERE uom_code = NEW.to_uom_code;
  IF v_from.uom_dimension IS DISTINCT FROM v_to.uom_dimension THEN
    RAISE EXCEPTION 'UOM_CONV_DIMENSION: % (%) and % (%) measure different things', NEW.from_uom_code, v_from.uom_dimension, NEW.to_uom_code, v_to.uom_dimension
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_from.is_packaging OR v_to.is_packaging THEN
    RAISE EXCEPTION 'UOM_CONV_PACKAGING: packaging units convert per product only (% → %)', NEW.from_uom_code, NEW.to_uom_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_sys_conv_guard() IS 'BEFORE INSERT/UPDATE on sys_uom_conv_cd: system conversions join units of the same dimension and never packaging units.';
REVOKE ALL ON FUNCTION public.fn_uom_sys_conv_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_suomc_guard BEFORE INSERT OR UPDATE ON public.sys_uom_conv_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_sys_conv_guard();
COMMENT ON TRIGGER trg_suomc_guard ON public.sys_uom_conv_cd IS 'Rejects cross-dimension and packaging system conversions.';

-- Seed: exact SI / US customary definitions; divide_rate = 1 / multiply_rate rounded to 12 dp.
INSERT INTO public.sys_uom_conv_cd (from_uom_code, to_uom_code, multiply_rate, divide_rate, rec_notes, created_by, created_info)
VALUES
  ('G',    'KG',  0.001,          1000,           'SI',                       'system', '0813 uom seed'),
  ('LB',   'KG',  0.45359237,     2.204622621849, 'International pound 1959', 'system', '0813 uom seed'),
  ('OZ',   'KG',  0.028349523125, 35.273961949580,'Avoirdupois ounce',        'system', '0813 uom seed'),
  ('CM',   'M',   0.01,           100,            'SI',                       'system', '0813 uom seed'),
  ('MM',   'M',   0.001,          1000,           'SI',                       'system', '0813 uom seed'),
  ('IN',   'M',   0.0254,         39.370078740157,'International inch 1959',  'system', '0813 uom seed'),
  ('FT',   'M',   0.3048,         3.280839895013, 'International foot 1959',  'system', '0813 uom seed'),
  ('YD',   'M',   0.9144,         1.093613298338, 'International yard 1959',  'system', '0813 uom seed'),
  ('SQFT', 'SQM', 0.09290304,     10.763910416710,'International foot²',      'system', '0813 uom seed'),
  ('ML',   'L',   0.001,          1000,           'SI',                       'system', '0813 uom seed'),
  ('GAL',  'L',   3.785411784,    0.264172052358, 'US liquid gallon',         'system', '0813 uom seed'),
  ('MIN',  'HR',  0.016666666667, 60,             'SI',                       'system', '0813 uom seed')
ON CONFLICT (from_uom_code, to_uom_code) DO NOTHING;

-- ─── 3. Organization units ───────────────────────────────────────────────────

-- Every unit an Organization can use. System rows are seeded copies (sys_uom_code set);
-- custom rows belong to the Organization only (sys_uom_code NULL). All tenant tables that
-- store a unit reference this table through (tenant_org_id, uom_code).
CREATE TABLE public.org_uom_cf (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID        NOT NULL,
  uom_code      TEXT        NOT NULL,                 -- Equal to sys_uom_code for system rows
  sys_uom_code  TEXT        NULL,                     -- Source system unit; NULL = custom unit
  name          TEXT        NOT NULL,
  name2         TEXT        NULL,
  symbol        TEXT        NOT NULL,
  symbol2       TEXT        NULL,
  uom_dimension TEXT        NOT NULL,                 -- Locked on system rows; immutable on all rows
  is_base_unit  BOOLEAN     NOT NULL DEFAULT false,   -- Only system rows can be base units
  is_packaging  BOOLEAN     NOT NULL DEFAULT false,   -- Locked on system rows
  qty_decimals  SMALLINT    NOT NULL DEFAULT 0,       -- Editable for physical units; COUNT always 0
  unece_code    TEXT        NULL,                     -- Locked on system rows; NULL on a custom unit = e-invoice falls back per dimension
  is_customized BOOLEAN     NOT NULL DEFAULT false,   -- Tenant changed presentation fields of a system row
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  updated_count INTEGER     NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ NULL,
  deleted_by    TEXT        NULL,
  deleted_info  TEXT        NULL,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  rec_order     INTEGER     NULL,
  rec_notes     TEXT        NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_uom_cf PRIMARY KEY (id),
  CONSTRAINT uq_ouom_tenant_code UNIQUE (tenant_org_id, uom_code),
  CONSTRAINT fk_ouom_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ouom_sys FOREIGN KEY (sys_uom_code) REFERENCES public.sys_uom_cd (uom_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ouom_code CHECK (uom_code ~ '^[A-Z][A-Z0-9_]{0,19}$'),
  CONSTRAINT ck_ouom_sys_same_code CHECK (sys_uom_code IS NULL OR sys_uom_code = uom_code),
  CONSTRAINT ck_ouom_dimension CHECK (uom_dimension IN ('COUNT', 'MASS', 'LENGTH', 'AREA', 'VOLUME', 'TIME')),
  CONSTRAINT ck_ouom_decimals CHECK (qty_decimals BETWEEN 0 AND 6 AND (uom_dimension <> 'COUNT' OR qty_decimals = 0)),
  CONSTRAINT ck_ouom_custom_not_base CHECK (sys_uom_code IS NOT NULL OR NOT is_base_unit),
  CONSTRAINT ck_ouom_custom_not_cust CHECK (sys_uom_code IS NOT NULL OR NOT is_customized),
  CONSTRAINT ck_ouom_base_active CHECK (NOT is_base_unit OR (is_active AND rec_status = 1)),
  CONSTRAINT ck_ouom_unece CHECK (unece_code IS NULL OR unece_code ~ '^[A-Z0-9]{2,3}$'),
  CONSTRAINT ck_ouom_names CHECK (btrim(name) <> '' AND btrim(symbol) <> ''),
  CONSTRAINT ck_ouom_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_ouom_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

-- One base unit per dimension per Organization (copied from the system base units).
CREATE UNIQUE INDEX uq_ouom_base_per_dim ON public.org_uom_cf (tenant_org_id, uom_dimension) WHERE is_base_unit;
-- HQ sync and the HQ collision check look up tenant copies of one system unit across Organizations.
CREATE INDEX idx_ouom_sys ON public.org_uom_cf (sys_uom_code) WHERE sys_uom_code IS NOT NULL;
-- HQ collision check: is a code used as a custom unit by any Organization.
CREATE INDEX idx_ouom_custom_code ON public.org_uom_cf (uom_code) WHERE sys_uom_code IS NULL;

COMMENT ON TABLE public.org_uom_cf IS 'Units an Organization can use: seeded copies of system units (sys_uom_code set, locked fields synced from sys_uom_cd) and custom units (sys_uom_code NULL). FK target for every tenant unit column. Never hard-deleted.';
COMMENT ON COLUMN public.org_uom_cf.id IS 'Row UUID primary key.';
COMMENT ON COLUMN public.org_uom_cf.tenant_org_id IS 'Owning Organization (explicit tenant filter required on every query).';
COMMENT ON COLUMN public.org_uom_cf.uom_code IS 'Unit code, unique per Organization; referenced by products, order lines and conversions. Immutable.';
COMMENT ON COLUMN public.org_uom_cf.sys_uom_code IS 'System unit this row copies; NULL for a custom unit. Immutable.';
COMMENT ON COLUMN public.org_uom_cf.name IS 'English unit name (editable; edits on a system row set is_customized).';
COMMENT ON COLUMN public.org_uom_cf.name2 IS 'Arabic unit name (editable).';
COMMENT ON COLUMN public.org_uom_cf.symbol IS 'English short symbol (editable).';
COMMENT ON COLUMN public.org_uom_cf.symbol2 IS 'Arabic short symbol (editable).';
COMMENT ON COLUMN public.org_uom_cf.uom_dimension IS 'What the unit measures. Copied from the system unit; immutable on every row (create a new unit instead).';
COMMENT ON COLUMN public.org_uom_cf.is_base_unit IS 'Base unit of the dimension for this Organization. Only system rows; immutable.';
COMMENT ON COLUMN public.org_uom_cf.is_packaging IS 'Size depends on the product: converts per product only. Locked on system rows, editable on custom rows.';
COMMENT ON COLUMN public.org_uom_cf.qty_decimals IS 'Decimals a quantity in this unit may carry (0–6). Editable for physical units; COUNT always 0.';
COMMENT ON COLUMN public.org_uom_cf.unece_code IS 'UN/ECE Rec 20 code for e-invoices. Locked on system rows; optional on custom rows (NULL = e-invoice uses the dimension fallback documented in the UoM guide).';
COMMENT ON COLUMN public.org_uom_cf.is_customized IS 'True when the Organization changed presentation fields of a system row; sync then keeps its names. Reset to system clears it.';
COMMENT ON COLUMN public.org_uom_cf.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_uom_cf.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.org_uom_cf.created_info IS 'Creation context (seed, screen).';
COMMENT ON COLUMN public.org_uom_cf.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_uom_cf.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_uom_cf.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_uom_cf.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_uom_cf.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_uom_cf.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_uom_cf.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_uom_cf.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived. Units are never hard-deleted (FK RESTRICT).';
COMMENT ON COLUMN public.org_uom_cf.rec_order IS 'Display order in unit pickers (editable).';
COMMENT ON COLUMN public.org_uom_cf.rec_notes IS 'Free notes about the unit.';
COMMENT ON COLUMN public.org_uom_cf.is_active IS 'False = hidden from pickers; existing references stay valid. Base units cannot be deactivated; units used by products cannot be deactivated (0814).';
COMMENT ON CONSTRAINT pk_org_uom_cf ON public.org_uom_cf IS 'Surrogate primary key.';
COMMENT ON CONSTRAINT uq_ouom_tenant_code ON public.org_uom_cf IS 'Unit code unique per Organization; parent key (tenant_org_id, uom_code) of every tenant unit FK — children use the same column order (Prisma-safe).';
COMMENT ON CONSTRAINT fk_ouom_tenant ON public.org_uom_cf IS 'Unit belongs to an existing Organization; deleting the Organization is blocked while units exist.';
COMMENT ON CONSTRAINT fk_ouom_sys ON public.org_uom_cf IS 'A system row copies an existing system unit; deleting the system unit is blocked.';
COMMENT ON CONSTRAINT ck_ouom_code ON public.org_uom_cf IS 'Codes are upper case, start with a letter, max 20 characters.';
COMMENT ON CONSTRAINT ck_ouom_sys_same_code ON public.org_uom_cf IS 'A system row keeps the system code.';
COMMENT ON CONSTRAINT ck_ouom_dimension ON public.org_uom_cf IS 'Allowed dimensions.';
COMMENT ON CONSTRAINT ck_ouom_decimals ON public.org_uom_cf IS 'Decimals 0–6; COUNT units are whole numbers (D11).';
COMMENT ON CONSTRAINT ck_ouom_custom_not_base ON public.org_uom_cf IS 'Custom units are never base units; system base units anchor every dimension.';
COMMENT ON CONSTRAINT ck_ouom_custom_not_cust ON public.org_uom_cf IS 'is_customized only applies to system rows.';
COMMENT ON CONSTRAINT ck_ouom_base_active ON public.org_uom_cf IS 'Base units stay active: every conversion resolves through them.';
COMMENT ON CONSTRAINT ck_ouom_unece ON public.org_uom_cf IS 'UN/ECE Rec 20 codes are 2–3 upper-case letters or digits.';
COMMENT ON CONSTRAINT ck_ouom_names ON public.org_uom_cf IS 'Name and symbol are not blank.';
COMMENT ON CONSTRAINT ck_ouom_rec_status ON public.org_uom_cf IS 'Standard rec_status values.';
COMMENT ON CONSTRAINT ck_ouom_deleted_inactive ON public.org_uom_cf IS 'Soft-deleted or archived units cannot stay active.';
COMMENT ON INDEX public.uq_ouom_base_per_dim IS 'At most one base unit per dimension per Organization.';
COMMENT ON INDEX public.idx_ouom_sys IS 'HQ sync and HQ guards: find tenant copies of a system unit.';
COMMENT ON INDEX public.idx_ouom_custom_code IS 'HQ guard: is a new system code already used as a custom code.';

CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_uom_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_uom_cf IS 'Keeps updated_at and updated_count current.';

-- Signed-in users may read their own Organization's units; all writes go through the server
-- (service_role), which applies the rules below and the permission uom:manage.
ALTER TABLE public.org_uom_cf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_uom_cf FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.org_uom_cf TO authenticated;
GRANT ALL ON public.org_uom_cf TO service_role;
CREATE POLICY tenant_isolation_org_uom_cf ON public.org_uom_cf
  FOR SELECT TO authenticated
  USING (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY tenant_isolation_org_uom_cf ON public.org_uom_cf IS 'Signed-in users may read units of their own Organization only; no direct writes.';

-- ─── 4. Organization conversions ─────────────────────────────────────────────

-- Conversions an Organization uses. product_id NULL = Organization-wide (seeded system pairs and
-- pairs for custom units); product_id set = that product only (BOX→PC 12, DRUM→L 200).
-- Conversions are hard-deletable: transactions that convert snapshot the factor they used.
CREATE TABLE public.org_uom_conv_cf (
  id             UUID           NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id  UUID           NOT NULL,
  product_id     UUID           NULL,                 -- NULL = Organization-wide
  from_uom_code  TEXT           NOT NULL,             -- "UoM"
  to_uom_code    TEXT           NOT NULL,             -- "UoM To"
  multiply_rate  NUMERIC(28,12) NOT NULL,             -- qty_to = qty_from × multiply_rate
  divide_rate    NUMERIC(28,12) NOT NULL,             -- qty_from = qty_to × divide_rate
  is_from_system BOOLEAN        NOT NULL DEFAULT false, -- Seeded copy of a sys_uom_conv_cd pair
  is_customized  BOOLEAN        NOT NULL DEFAULT false, -- Organization changed the rates of a seeded pair
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT           NULL,
  created_info   TEXT           NULL,
  updated_at     TIMESTAMPTZ    NULL,
  updated_by     TEXT           NULL,
  updated_info   TEXT           NULL,
  updated_count  INTEGER        NOT NULL DEFAULT 0,
  deleted_at     TIMESTAMPTZ    NULL,
  deleted_by     TEXT           NULL,
  deleted_info   TEXT           NULL,
  rec_status     SMALLINT       NOT NULL DEFAULT 1,
  rec_order      INTEGER        NULL,
  rec_notes      TEXT           NULL,
  is_active      BOOLEAN        NOT NULL DEFAULT true,
  CONSTRAINT pk_org_uom_conv_cf PRIMARY KEY (id),
  CONSTRAINT fk_ouomc_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ouomc_from FOREIGN KEY (tenant_org_id, from_uom_code) REFERENCES public.org_uom_cf (tenant_org_id, uom_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ouomc_to FOREIGN KEY (tenant_org_id, to_uom_code) REFERENCES public.org_uom_cf (tenant_org_id, uom_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ouomc_product FOREIGN KEY (tenant_org_id, product_id) REFERENCES public.org_product_data_mst (tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_ouomc_distinct CHECK (from_uom_code <> to_uom_code),
  CONSTRAINT ck_ouomc_rates CHECK (multiply_rate > 0 AND divide_rate > 0 AND abs(multiply_rate * divide_rate - 1) <= 0.000001),
  CONSTRAINT ck_ouomc_sys_wide CHECK (NOT is_from_system OR product_id IS NULL),
  CONSTRAINT ck_ouomc_cust_sys CHECK (is_from_system OR NOT is_customized),
  CONSTRAINT ck_ouomc_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_ouomc_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

-- One Organization-wide row per unordered pair.
CREATE UNIQUE INDEX uq_ouomc_wide_pair ON public.org_uom_conv_cf
  (tenant_org_id, LEAST(from_uom_code, to_uom_code), GREATEST(from_uom_code, to_uom_code)) WHERE product_id IS NULL;
-- One per-product row per unordered pair.
CREATE UNIQUE INDEX uq_ouomc_prod_pair ON public.org_uom_conv_cf
  (tenant_org_id, product_id, LEAST(from_uom_code, to_uom_code), GREATEST(from_uom_code, to_uom_code)) WHERE product_id IS NOT NULL;
-- Resolver lookups by source unit and FK RESTRICT checks on units.
CREATE INDEX idx_ouomc_from ON public.org_uom_conv_cf (tenant_org_id, from_uom_code);
CREATE INDEX idx_ouomc_to ON public.org_uom_conv_cf (tenant_org_id, to_uom_code);
-- Product "Units" tab and FK RESTRICT checks on products.
CREATE INDEX idx_ouomc_product ON public.org_uom_conv_cf (tenant_org_id, product_id) WHERE product_id IS NOT NULL;

COMMENT ON TABLE public.org_uom_conv_cf IS 'Unit conversions of an Organization: seeded copies of system pairs, Organization-wide pairs (custom units) and per-product pairs. Open multiply + divide rates. Resolver: product pair → Organization pair → two legs through the base unit (fn_uom_convert).';
COMMENT ON COLUMN public.org_uom_conv_cf.id IS 'Row UUID primary key.';
COMMENT ON COLUMN public.org_uom_conv_cf.tenant_org_id IS 'Owning Organization (explicit tenant filter required on every query).';
COMMENT ON COLUMN public.org_uom_conv_cf.product_id IS 'Product the pair applies to; NULL = Organization-wide. Cross-dimension and packaging pairs need a product.';
COMMENT ON COLUMN public.org_uom_conv_cf.from_uom_code IS 'Source unit ("UoM"); FK to org_uom_cf.';
COMMENT ON COLUMN public.org_uom_conv_cf.to_uom_code IS 'Target unit ("UoM To"); FK to org_uom_cf.';
COMMENT ON COLUMN public.org_uom_conv_cf.multiply_rate IS 'qty_to = qty_from × multiply_rate. RATE precision (28,12).';
COMMENT ON COLUMN public.org_uom_conv_cf.divide_rate IS 'qty_from = qty_to × divide_rate. Stored so the reverse direction uses the entered figure.';
COMMENT ON COLUMN public.org_uom_conv_cf.is_from_system IS 'True for a seeded copy of a system pair (units and product fixed; rates editable).';
COMMENT ON COLUMN public.org_uom_conv_cf.is_customized IS 'True when the Organization changed the rates of a seeded pair; sync then leaves it alone. Reset to system clears it.';
COMMENT ON COLUMN public.org_uom_conv_cf.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_uom_conv_cf.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.org_uom_conv_cf.created_info IS 'Creation context (seed, screen).';
COMMENT ON COLUMN public.org_uom_conv_cf.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_uom_conv_cf.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_uom_conv_cf.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_uom_conv_cf.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_uom_conv_cf.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_uom_conv_cf.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_uom_conv_cf.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_uom_conv_cf.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived. Only active rows are used by the resolver.';
COMMENT ON COLUMN public.org_uom_conv_cf.rec_order IS 'Display order.';
COMMENT ON COLUMN public.org_uom_conv_cf.rec_notes IS 'Free notes (where the figure comes from).';
COMMENT ON COLUMN public.org_uom_conv_cf.is_active IS 'False = ignored by the resolver.';
COMMENT ON CONSTRAINT pk_org_uom_conv_cf ON public.org_uom_conv_cf IS 'Surrogate primary key.';
COMMENT ON CONSTRAINT fk_ouomc_tenant ON public.org_uom_conv_cf IS 'Row belongs to an existing Organization.';
COMMENT ON CONSTRAINT fk_ouomc_from ON public.org_uom_conv_cf IS 'Source is a unit of the same Organization; column order matches uq_ouom_tenant_code (Prisma-safe). RESTRICT: units are never hard-deleted.';
COMMENT ON CONSTRAINT fk_ouomc_to ON public.org_uom_conv_cf IS 'Target is a unit of the same Organization; same column order as the parent key.';
COMMENT ON CONSTRAINT fk_ouomc_product ON public.org_uom_conv_cf IS 'Per-product pair belongs to a product of the same Organization; column order matches uk_org_products_tenant_id (tenant_org_id, id). RESTRICT: remove the product''s conversions first.';
COMMENT ON CONSTRAINT ck_ouomc_distinct ON public.org_uom_conv_cf IS 'A unit does not convert to itself.';
COMMENT ON CONSTRAINT ck_ouomc_rates ON public.org_uom_conv_cf IS 'Both rates positive and reciprocal within 0.000001.';
COMMENT ON CONSTRAINT ck_ouomc_sys_wide ON public.org_uom_conv_cf IS 'Seeded system pairs are Organization-wide.';
COMMENT ON CONSTRAINT ck_ouomc_cust_sys ON public.org_uom_conv_cf IS 'is_customized only applies to seeded system pairs.';
COMMENT ON CONSTRAINT ck_ouomc_rec_status ON public.org_uom_conv_cf IS 'Standard rec_status values.';
COMMENT ON CONSTRAINT ck_ouomc_deleted_inactive ON public.org_uom_conv_cf IS 'Soft-deleted or archived rows cannot stay active.';
COMMENT ON INDEX public.uq_ouomc_wide_pair IS 'One Organization-wide conversion per unordered unit pair.';
COMMENT ON INDEX public.uq_ouomc_prod_pair IS 'One per-product conversion per unordered unit pair.';
COMMENT ON INDEX public.idx_ouomc_from IS 'Resolver lookups by source unit; FK checks on the source unit.';
COMMENT ON INDEX public.idx_ouomc_to IS 'Resolver lookups by target unit; FK checks on the target unit.';
COMMENT ON INDEX public.idx_ouomc_product IS 'Product Units tab; FK checks when a product is deleted.';

CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_uom_conv_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_uom_conv_cf IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.org_uom_conv_cf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_uom_conv_cf FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.org_uom_conv_cf TO authenticated;
GRANT ALL ON public.org_uom_conv_cf TO service_role;
CREATE POLICY tenant_isolation_org_uom_conv_cf ON public.org_uom_conv_cf
  FOR SELECT TO authenticated
  USING (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY tenant_isolation_org_uom_conv_cf ON public.org_uom_conv_cf IS 'Signed-in users may read conversions of their own Organization only; no direct writes.';

-- ─── 5. Guards ───────────────────────────────────────────────────────────────

-- True while fn_uom_seed_tenant / reset functions run: they may write locked fields.
-- Transaction-local setting, switched back off by the same functions.
CREATE OR REPLACE FUNCTION public.fn_uom_in_sync()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$ SELECT COALESCE(current_setting('cmx.uom_sync', true), '') = 'on' $$;
COMMENT ON FUNCTION public.fn_uom_in_sync() IS 'True while a UoM sync/reset function is running in this transaction (setting cmx.uom_sync). Lets those functions write fields that tenant edits may not touch.';
REVOKE ALL ON FUNCTION public.fn_uom_in_sync() FROM PUBLIC, anon, authenticated;

-- Organization unit rules (BEFORE INSERT/UPDATE).
CREATE OR REPLACE FUNCTION public.fn_uom_org_unit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_sys public.sys_uom_cd%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sys_uom_code IS NULL THEN
      -- Custom unit: its code must not shadow a system code (no magic prefixes).
      IF EXISTS (SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = NEW.uom_code) THEN
        RAISE EXCEPTION 'UOM_CODE_RESERVED: % is a system unit code; add it from the system catalog instead', NEW.uom_code
          USING ERRCODE = 'unique_violation';
      END IF;
      NEW.is_base_unit := false;
      NEW.is_customized := false;
    ELSE
      -- System row: locked fields always come from the system unit, whoever inserts.
      SELECT * INTO v_sys FROM public.sys_uom_cd s WHERE s.uom_code = NEW.sys_uom_code;
      NEW.uom_dimension := v_sys.uom_dimension;
      NEW.is_base_unit  := v_sys.is_base_unit;
      NEW.is_packaging  := v_sys.is_packaging;
      NEW.unece_code    := v_sys.unece_code;
      IF NEW.uom_dimension = 'COUNT' THEN NEW.qty_decimals := 0; END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: identity is immutable on every row.
  IF NEW.tenant_org_id IS DISTINCT FROM OLD.tenant_org_id
     OR NEW.uom_code IS DISTINCT FROM OLD.uom_code
     OR NEW.sys_uom_code IS DISTINCT FROM OLD.sys_uom_code
     OR NEW.uom_dimension IS DISTINCT FROM OLD.uom_dimension
     OR NEW.is_base_unit IS DISTINCT FROM OLD.is_base_unit THEN
    IF NOT (public.fn_uom_in_sync() AND NEW.tenant_org_id = OLD.tenant_org_id AND NEW.uom_code = OLD.uom_code
            AND NEW.sys_uom_code IS NOT DISTINCT FROM OLD.sys_uom_code) THEN
      RAISE EXCEPTION 'UOM_FIELD_LOCKED: code, dimension and base flag of unit % cannot change; create a new unit instead', OLD.uom_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD.sys_uom_code IS NOT NULL AND NOT public.fn_uom_in_sync() THEN
    -- Fields owned by HQ on a system row.
    IF NEW.is_packaging IS DISTINCT FROM OLD.is_packaging OR NEW.unece_code IS DISTINCT FROM OLD.unece_code THEN
      RAISE EXCEPTION 'UOM_FIELD_LOCKED: packaging flag and e-invoice code of system unit % are set by HQ', OLD.uom_code
        USING ERRCODE = 'check_violation';
    END IF;
    -- Any presentation edit marks the row customized, so sync keeps the tenant's wording.
    IF NEW.name IS DISTINCT FROM OLD.name OR NEW.name2 IS DISTINCT FROM OLD.name2
       OR NEW.symbol IS DISTINCT FROM OLD.symbol OR NEW.symbol2 IS DISTINCT FROM OLD.symbol2
       OR NEW.qty_decimals IS DISTINCT FROM OLD.qty_decimals OR NEW.rec_order IS DISTINCT FROM OLD.rec_order THEN
      NEW.is_customized := true;
    END IF;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_org_unit_guard() IS 'BEFORE INSERT/UPDATE on org_uom_cf: custom codes cannot shadow system codes; system rows take locked fields from sys_uom_cd; code/dimension/base flag are immutable; HQ-owned fields only change through sync; presentation edits set is_customized. SECURITY DEFINER so it can read sys_uom_cd for any caller; it reads only the system catalog.';
REVOKE ALL ON FUNCTION public.fn_uom_org_unit_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ouom_guard BEFORE INSERT OR UPDATE ON public.org_uom_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_org_unit_guard();
COMMENT ON TRIGGER trg_ouom_guard ON public.org_uom_cf IS 'Enforces unit ownership and immutability rules (fn_uom_org_unit_guard).';

-- A custom unit of a physical dimension must convert directly to that dimension's base unit,
-- otherwise it can never be priced or stocked. Checked at commit so the unit and its conversion
-- can be created in one transaction.
CREATE OR REPLACE FUNCTION public.fn_uom_assert_base_conv(p_tenant_org_id uuid, p_uom_code text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_unit public.org_uom_cf%ROWTYPE;
  v_base text;
BEGIN
  SELECT * INTO v_unit FROM public.org_uom_cf u
   WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code = p_uom_code;
  IF NOT FOUND OR v_unit.sys_uom_code IS NOT NULL OR v_unit.uom_dimension = 'COUNT'
     OR NOT v_unit.is_active OR v_unit.rec_status <> 1 THEN
    RETURN;
  END IF;
  SELECT b.uom_code INTO v_base FROM public.org_uom_cf b
   WHERE b.tenant_org_id = p_tenant_org_id AND b.uom_dimension = v_unit.uom_dimension AND b.is_base_unit;
  IF NOT EXISTS (
    SELECT 1 FROM public.org_uom_conv_cf c
     WHERE c.tenant_org_id = p_tenant_org_id
       AND c.product_id IS NULL AND c.is_active AND c.rec_status = 1
       AND ((c.from_uom_code = p_uom_code AND c.to_uom_code = v_base)
         OR (c.from_uom_code = v_base AND c.to_uom_code = p_uom_code))
  ) THEN
    RAISE EXCEPTION 'UOM_BASE_CONV_REQUIRED: custom unit % needs an active conversion to %', p_uom_code, v_base
      USING ERRCODE = 'check_violation';
  END IF;
END $$;
COMMENT ON FUNCTION public.fn_uom_assert_base_conv(uuid, text) IS 'Raises UOM_BASE_CONV_REQUIRED when an active custom unit of a physical dimension has no active Organization-wide conversion to its base unit. Filters by the given tenant only.';
REVOKE ALL ON FUNCTION public.fn_uom_assert_base_conv(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_assert_base_conv(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_uom_unit_base_conv_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.fn_uom_assert_base_conv(NEW.tenant_org_id, NEW.uom_code);
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.fn_uom_unit_base_conv_trg() IS 'Deferred constraint trigger body on org_uom_cf: re-checks the base-conversion rule for the saved unit at commit.';
REVOKE ALL ON FUNCTION public.fn_uom_unit_base_conv_trg() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER trg_ouom_base_conv AFTER INSERT OR UPDATE ON public.org_uom_cf
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_unit_base_conv_trg();
COMMENT ON TRIGGER trg_ouom_base_conv ON public.org_uom_cf IS 'At commit: a custom physical unit must convert to its base unit.';

-- Organization conversion rules (BEFORE INSERT/UPDATE).
CREATE OR REPLACE FUNCTION public.fn_uom_org_conv_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_from public.org_uom_cf%ROWTYPE;
  v_to   public.org_uom_cf%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_org_id IS DISTINCT FROM OLD.tenant_org_id OR NEW.is_from_system IS DISTINCT FROM OLD.is_from_system THEN
      RAISE EXCEPTION 'UOM_FIELD_LOCKED: Organization and origin of a conversion cannot change' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.is_from_system AND (NEW.from_uom_code IS DISTINCT FROM OLD.from_uom_code
        OR NEW.to_uom_code IS DISTINCT FROM OLD.to_uom_code OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
      RAISE EXCEPTION 'UOM_FIELD_LOCKED: units of a system conversion cannot change; only its rates' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.is_from_system AND NOT public.fn_uom_in_sync()
       AND (NEW.multiply_rate IS DISTINCT FROM OLD.multiply_rate OR NEW.divide_rate IS DISTINCT FROM OLD.divide_rate) THEN
      NEW.is_customized := true;
    END IF;
  ELSIF NEW.is_from_system AND NOT public.fn_uom_in_sync() THEN
    RAISE EXCEPTION 'UOM_FIELD_LOCKED: system conversions are added by the unit sync only' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_from FROM public.org_uom_cf u WHERE u.tenant_org_id = NEW.tenant_org_id AND u.uom_code = NEW.from_uom_code;
  SELECT * INTO v_to   FROM public.org_uom_cf u WHERE u.tenant_org_id = NEW.tenant_org_id AND u.uom_code = NEW.to_uom_code;
  IF NEW.product_id IS NULL THEN
    IF v_from.uom_dimension IS DISTINCT FROM v_to.uom_dimension THEN
      RAISE EXCEPTION 'UOM_CONV_DIMENSION: % (%) and % (%) measure different things; set a product to link them', NEW.from_uom_code, v_from.uom_dimension, NEW.to_uom_code, v_to.uom_dimension
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_from.is_packaging OR v_to.is_packaging THEN
      RAISE EXCEPTION 'UOM_CONV_PACKAGING: % → % depends on the product; set a product', NEW.from_uom_code, NEW.to_uom_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_org_conv_guard() IS 'BEFORE INSERT/UPDATE on org_uom_conv_cf: Organization-wide pairs join units of one dimension and no packaging units; seeded system pairs keep their units and only change rates (which sets is_customized). Reads units of NEW.tenant_org_id only.';
REVOKE ALL ON FUNCTION public.fn_uom_org_conv_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ouomc_guard BEFORE INSERT OR UPDATE ON public.org_uom_conv_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_org_conv_guard();
COMMENT ON TRIGGER trg_ouomc_guard ON public.org_uom_conv_cf IS 'Enforces conversion rules (fn_uom_org_conv_guard).';

-- Removing or switching off a conversion must not orphan a custom unit (checked at commit).
CREATE OR REPLACE FUNCTION public.fn_uom_conv_base_conv_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.product_id IS NULL THEN
    PERFORM public.fn_uom_assert_base_conv(OLD.tenant_org_id, OLD.from_uom_code);
    PERFORM public.fn_uom_assert_base_conv(OLD.tenant_org_id, OLD.to_uom_code);
  END IF;
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.fn_uom_conv_base_conv_trg() IS 'Deferred constraint trigger body on org_uom_conv_cf: after a conversion is changed or removed, both of its units must still satisfy the base-conversion rule.';
REVOKE ALL ON FUNCTION public.fn_uom_conv_base_conv_trg() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER trg_ouomc_base_conv AFTER UPDATE OR DELETE ON public.org_uom_conv_cf
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_conv_base_conv_trg();
COMMENT ON TRIGGER trg_ouomc_base_conv ON public.org_uom_conv_cf IS 'At commit: changing or removing a conversion cannot leave a custom unit without its base conversion.';

-- HQ guard on system units (BEFORE INSERT/UPDATE): no clash with tenant custom codes;
-- dimension and base flag are fixed once any Organization holds a copy.
CREATE OR REPLACE FUNCTION public.fn_uom_sys_unit_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_count FROM public.org_uom_cf u WHERE u.uom_code = NEW.uom_code AND u.sys_uom_code IS NULL;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'UOM_CODE_IN_USE_BY_TENANTS: % is a custom unit in % Organization(s); choose another code', NEW.uom_code, v_count
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.uom_dimension IS DISTINCT FROM OLD.uom_dimension OR NEW.is_base_unit IS DISTINCT FROM OLD.is_base_unit)
     AND EXISTS (SELECT 1 FROM public.org_uom_cf u WHERE u.sys_uom_code = OLD.uom_code) THEN
    RAISE EXCEPTION 'UOM_FIELD_LOCKED: dimension and base flag of % cannot change once Organizations use it', OLD.uom_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_sys_unit_guard() IS 'BEFORE INSERT/UPDATE on sys_uom_cd: a new system code may not equal any tenant custom code; dimension and base flag are fixed once tenants hold a copy. Cross-tenant read on purpose (HQ catalog guard), returns only a count.';
REVOKE ALL ON FUNCTION public.fn_uom_sys_unit_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_suom_guard BEFORE INSERT OR UPDATE ON public.sys_uom_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_sys_unit_guard();
COMMENT ON TRIGGER trg_suom_guard ON public.sys_uom_cd IS 'HQ catalog guard (fn_uom_sys_unit_guard).';

-- ─── 6. Seeding and sync ─────────────────────────────────────────────────────

-- Copies system units (and the system conversions whose two units are present) into one
-- Organization and refreshes the copies. Idempotent; never deletes; never touches custom rows;
-- keeps customized names/rates.
--   p_uom_codes NULL  → every active system unit flagged is_to_seed (plus units already present: refresh)
--   p_uom_codes given → also those system units ("Add from system catalog", product on an unseeded unit)
CREATE OR REPLACE FUNCTION public.fn_uom_seed_tenant(p_tenant_org_id uuid, p_uom_codes text[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_added integer := 0;
  v_conv  integer := 0;
  v_bad   text;
BEGIN
  IF p_tenant_org_id IS NULL THEN
    RAISE EXCEPTION 'fn_uom_seed_tenant: tenant is required' USING ERRCODE = 'null_value_not_allowed';
  END IF;
  IF p_uom_codes IS NOT NULL THEN
    SELECT c INTO v_bad FROM unnest(p_uom_codes) c
     WHERE NOT EXISTS (SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = c AND s.is_active AND s.rec_status = 1)
     LIMIT 1;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'UOM_NOT_FOUND: % is not an active system unit', v_bad USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  PERFORM set_config('cmx.uom_sync', 'on', true);

  -- 1. Missing system units.
  INSERT INTO public.org_uom_cf
    (tenant_org_id, uom_code, sys_uom_code, name, name2, symbol, symbol2, uom_dimension,
     is_base_unit, is_packaging, qty_decimals, unece_code, rec_order, created_by, created_info)
  SELECT p_tenant_org_id, s.uom_code, s.uom_code, s.name, s.name2, s.symbol, s.symbol2, s.uom_dimension,
         s.is_base_unit, s.is_packaging, s.qty_decimals, s.unece_code, s.rec_order, 'system', 'fn_uom_seed_tenant'
    FROM public.sys_uom_cd s
   WHERE s.is_active AND s.rec_status = 1
     AND (s.is_to_seed OR s.uom_code = ANY (COALESCE(p_uom_codes, ARRAY[]::text[])))
  ON CONFLICT (tenant_org_id, uom_code) DO NOTHING;
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- 2. Refresh copies: HQ-owned fields always; presentation only where not customized.
  UPDATE public.org_uom_cf u
     SET uom_dimension = s.uom_dimension,
         is_base_unit  = s.is_base_unit,
         is_packaging  = s.is_packaging,
         unece_code    = s.unece_code,
         name          = CASE WHEN u.is_customized THEN u.name    ELSE s.name    END,
         name2         = CASE WHEN u.is_customized THEN u.name2   ELSE s.name2   END,
         symbol        = CASE WHEN u.is_customized THEN u.symbol  ELSE s.symbol  END,
         symbol2       = CASE WHEN u.is_customized THEN u.symbol2 ELSE s.symbol2 END,
         qty_decimals  = CASE WHEN u.is_customized THEN u.qty_decimals ELSE s.qty_decimals END,
         rec_order     = CASE WHEN u.is_customized THEN u.rec_order ELSE s.rec_order END,
         updated_by    = 'system',
         updated_info  = 'fn_uom_seed_tenant'
    FROM public.sys_uom_cd s
   WHERE u.tenant_org_id = p_tenant_org_id
     AND u.sys_uom_code = s.uom_code
     AND (   (u.uom_dimension, u.is_base_unit, u.is_packaging, u.unece_code)
               IS DISTINCT FROM (s.uom_dimension, s.is_base_unit, s.is_packaging, s.unece_code)
          OR (NOT u.is_customized
              AND (u.name, u.name2, u.symbol, u.symbol2, u.qty_decimals, u.rec_order)
                  IS DISTINCT FROM (s.name, s.name2, s.symbol, s.symbol2, s.qty_decimals, s.rec_order)));

  -- 3. Missing system conversions whose two units the Organization has (no tenant pair for them yet).
  INSERT INTO public.org_uom_conv_cf
    (tenant_org_id, product_id, from_uom_code, to_uom_code, multiply_rate, divide_rate,
     is_from_system, rec_notes, created_by, created_info)
  SELECT p_tenant_org_id, NULL, c.from_uom_code, c.to_uom_code, c.multiply_rate, c.divide_rate,
         true, c.rec_notes, 'system', 'fn_uom_seed_tenant'
    FROM public.sys_uom_conv_cd c
   WHERE c.is_active AND c.rec_status = 1
     AND EXISTS (SELECT 1 FROM public.org_uom_cf f WHERE f.tenant_org_id = p_tenant_org_id AND f.uom_code = c.from_uom_code)
     AND EXISTS (SELECT 1 FROM public.org_uom_cf t WHERE t.tenant_org_id = p_tenant_org_id AND t.uom_code = c.to_uom_code)
     AND NOT EXISTS (
       SELECT 1 FROM public.org_uom_conv_cf x
        WHERE x.tenant_org_id = p_tenant_org_id AND x.product_id IS NULL
          AND LEAST(x.from_uom_code, x.to_uom_code) = LEAST(c.from_uom_code, c.to_uom_code)
          AND GREATEST(x.from_uom_code, x.to_uom_code) = GREATEST(c.from_uom_code, c.to_uom_code));
  GET DIAGNOSTICS v_conv = ROW_COUNT;

  -- 4. Refresh rates of seeded pairs the Organization did not customize.
  UPDATE public.org_uom_conv_cf x
     SET multiply_rate = c.multiply_rate,
         divide_rate   = c.divide_rate,
         updated_by    = 'system',
         updated_info  = 'fn_uom_seed_tenant'
    FROM public.sys_uom_conv_cd c
   WHERE x.tenant_org_id = p_tenant_org_id
     AND x.is_from_system AND NOT x.is_customized
     AND x.from_uom_code = c.from_uom_code AND x.to_uom_code = c.to_uom_code
     AND (x.multiply_rate, x.divide_rate) IS DISTINCT FROM (c.multiply_rate, c.divide_rate);

  PERFORM set_config('cmx.uom_sync', 'off', true);
  RETURN v_added + v_conv;
END $$;
COMMENT ON FUNCTION public.fn_uom_seed_tenant(uuid, text[]) IS 'Copies system units (is_to_seed, or the given codes) and matching system conversions into one Organization and refreshes existing copies (HQ fields always, names/rates unless customized). Idempotent, never deletes. Every write filters p_tenant_org_id. Returns rows added.';
REVOKE ALL ON FUNCTION public.fn_uom_seed_tenant(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_seed_tenant(uuid, text[]) TO service_role;

-- Runs the seed/sync for every Organization (HQ edits, migration backfill).
CREATE OR REPLACE FUNCTION public.fn_uom_sync_all_tenants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_tenant uuid;
  v_total  integer := 0;
BEGIN
  FOR v_tenant IN SELECT t.id FROM public.org_tenants_mst t ORDER BY t.id LOOP
    v_total := v_total + public.fn_uom_seed_tenant(v_tenant, NULL);
  END LOOP;
  RETURN v_total;
END $$;
COMMENT ON FUNCTION public.fn_uom_sync_all_tenants() IS 'Runs fn_uom_seed_tenant for every Organization in id order (stable lock order). Called after HQ edits to system units/conversions and by the backfill.';
REVOKE ALL ON FUNCTION public.fn_uom_sync_all_tenants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_sync_all_tenants() TO service_role;

CREATE OR REPLACE FUNCTION public.fn_uom_sys_sync_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.fn_uom_sync_all_tenants();
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.fn_uom_sys_sync_trg() IS 'Statement trigger body: an HQ change to system units or conversions reaches every Organization in the same transaction.';
REVOKE ALL ON FUNCTION public.fn_uom_sys_sync_trg() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_suom_sync AFTER INSERT OR UPDATE ON public.sys_uom_cd
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_uom_sys_sync_trg();
COMMENT ON TRIGGER trg_suom_sync ON public.sys_uom_cd IS 'Pushes HQ unit changes to every Organization (fn_uom_sync_all_tenants).';
CREATE TRIGGER trg_suomc_sync AFTER INSERT OR UPDATE ON public.sys_uom_conv_cd
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_uom_sys_sync_trg();
COMMENT ON TRIGGER trg_suomc_sync ON public.sys_uom_conv_cd IS 'Pushes HQ conversion changes to every Organization (fn_uom_sync_all_tenants).';

-- Every new Organization gets its units at creation, before any product can reference them.
CREATE OR REPLACE FUNCTION public.fn_uom_tenant_seed_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.fn_uom_seed_tenant(NEW.id, NULL);
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.fn_uom_tenant_seed_trg() IS 'AFTER INSERT on org_tenants_mst: seeds the new Organization''s units and conversions.';
REVOKE ALL ON FUNCTION public.fn_uom_tenant_seed_trg() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_tenant_uom_seed AFTER INSERT ON public.org_tenants_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_tenant_seed_trg();
COMMENT ON TRIGGER trg_tenant_uom_seed ON public.org_tenants_mst IS 'No Organization exists without its units (fn_uom_seed_tenant).';

-- "Reset to system" for a customized unit: presentation fields back to the HQ values.
CREATE OR REPLACE FUNCTION public.fn_uom_reset_unit(p_tenant_org_id uuid, p_uom_code text, p_user text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM set_config('cmx.uom_sync', 'on', true);
  UPDATE public.org_uom_cf u
     SET name = s.name, name2 = s.name2, symbol = s.symbol, symbol2 = s.symbol2,
         qty_decimals = s.qty_decimals, rec_order = s.rec_order, is_customized = false,
         updated_by = p_user, updated_info = 'reset to system'
    FROM public.sys_uom_cd s
   WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code = p_uom_code AND u.sys_uom_code = s.uom_code;
  IF NOT FOUND THEN
    PERFORM set_config('cmx.uom_sync', 'off', true);
    RAISE EXCEPTION 'UOM_NOT_FOUND: % is not a system unit of this Organization', p_uom_code USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM set_config('cmx.uom_sync', 'off', true);
END $$;
COMMENT ON FUNCTION public.fn_uom_reset_unit(uuid, text, text) IS 'Reset to system: copies the HQ presentation fields back onto a tenant system unit and clears is_customized. Filters by tenant and code.';
REVOKE ALL ON FUNCTION public.fn_uom_reset_unit(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_reset_unit(uuid, text, text) TO service_role;

-- "Reset to system" for a customized seeded conversion: rates back to the HQ values.
CREATE OR REPLACE FUNCTION public.fn_uom_reset_conv(p_tenant_org_id uuid, p_conv_id uuid, p_user text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM set_config('cmx.uom_sync', 'on', true);
  UPDATE public.org_uom_conv_cf x
     SET multiply_rate = c.multiply_rate, divide_rate = c.divide_rate, is_customized = false,
         updated_by = p_user, updated_info = 'reset to system'
    FROM public.sys_uom_conv_cd c
   WHERE x.tenant_org_id = p_tenant_org_id AND x.id = p_conv_id AND x.is_from_system
     AND x.from_uom_code = c.from_uom_code AND x.to_uom_code = c.to_uom_code;
  IF NOT FOUND THEN
    PERFORM set_config('cmx.uom_sync', 'off', true);
    RAISE EXCEPTION 'UOM_NOT_FOUND: conversion is not a system conversion of this Organization' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM set_config('cmx.uom_sync', 'off', true);
END $$;
COMMENT ON FUNCTION public.fn_uom_reset_conv(uuid, uuid, text) IS 'Reset to system: copies the HQ rates back onto a seeded tenant conversion and clears is_customized. Filters by tenant and id.';
REVOKE ALL ON FUNCTION public.fn_uom_reset_conv(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_reset_conv(uuid, uuid, text) TO service_role;

-- ─── 7. Resolver and quantity rule ───────────────────────────────────────────

-- Direct rate between two units for one Organization, most specific first:
-- the product's own pair, then the Organization-wide pair; either direction. NULL when none.
CREATE OR REPLACE FUNCTION public.fn_uom_conv_rate(p_tenant_org_id uuid, p_product_id uuid, p_from text, p_to text)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT CASE WHEN c.from_uom_code = p_from THEN c.multiply_rate ELSE c.divide_rate END
    FROM public.org_uom_conv_cf c
   WHERE c.tenant_org_id = p_tenant_org_id
     AND c.is_active AND c.rec_status = 1
     AND ((c.from_uom_code = p_from AND c.to_uom_code = p_to) OR (c.from_uom_code = p_to AND c.to_uom_code = p_from))
     AND (c.product_id IS NULL OR c.product_id = p_product_id)
   ORDER BY (c.product_id IS NULL), c.id
   LIMIT 1
$$;
COMMENT ON FUNCTION public.fn_uom_conv_rate(uuid, uuid, text, text) IS 'Direct conversion rate (qty_to = qty_from × rate) between two units of one Organization: per-product pair first, then Organization-wide; reverse direction uses divide_rate. NULL when no direct pair. Mirrored by web-admin lib/uom/convert.ts.';
REVOKE ALL ON FUNCTION public.fn_uom_conv_rate(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_conv_rate(uuid, uuid, text, text) TO service_role;

-- Converts a quantity. Bounded: same unit → direct pair → two legs through the base unit of the
-- source dimension, then of the target dimension. At most two stored rates are multiplied, so
-- conversion data can never loop. A COUNT target must come out whole unless p_require_whole is false.
CREATE OR REPLACE FUNCTION public.fn_uom_convert(
  p_tenant_org_id uuid,
  p_product_id    uuid,
  p_qty           numeric,
  p_from          text,
  p_to            text,
  p_require_whole boolean DEFAULT true
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_rate   numeric;
  v_leg1   numeric;
  v_leg2   numeric;
  v_base   text;
  v_dim_to text;
  v_result numeric;
BEGIN
  IF p_qty IS NULL OR p_from IS NULL OR p_to IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_from = p_to THEN
    RETURN p_qty;
  END IF;

  v_rate := public.fn_uom_conv_rate(p_tenant_org_id, p_product_id, p_from, p_to);

  IF v_rate IS NULL THEN
    -- Two legs through a base unit: the source dimension's base, then the target's.
    FOR v_base IN
      SELECT b.uom_code
        FROM public.org_uom_cf u
        JOIN public.org_uom_cf b
          ON b.tenant_org_id = u.tenant_org_id AND b.uom_dimension = u.uom_dimension AND b.is_base_unit
       WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code IN (p_from, p_to)
       ORDER BY (u.uom_code = p_from) DESC
    LOOP
      CONTINUE WHEN v_base IN (p_from, p_to);
      v_leg1 := public.fn_uom_conv_rate(p_tenant_org_id, p_product_id, p_from, v_base);
      v_leg2 := public.fn_uom_conv_rate(p_tenant_org_id, p_product_id, v_base, p_to);
      IF v_leg1 IS NOT NULL AND v_leg2 IS NOT NULL THEN
        v_rate := v_leg1 * v_leg2;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'UOM_CONVERSION_MISSING: no conversion from % to %', p_from, p_to
      USING ERRCODE = 'no_data_found';
  END IF;

  v_result := p_qty * v_rate;

  SELECT u.uom_dimension INTO v_dim_to FROM public.org_uom_cf u
   WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code = p_to;
  IF p_require_whole AND v_dim_to = 'COUNT' AND v_result <> trunc(v_result) THEN
    RAISE EXCEPTION 'UOM_QTY_NOT_WHOLE: % % is % %, not a whole number', p_qty, p_from, v_result, p_to
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_result;
END $$;
COMMENT ON FUNCTION public.fn_uom_convert(uuid, uuid, numeric, text, text, boolean) IS 'Converts p_qty from one unit to another for one Organization (and optionally one product): same unit, direct pair (product → Organization), else two legs through a base unit. Raises UOM_CONVERSION_MISSING, or UOM_QTY_NOT_WHOLE for a fractional COUNT result when p_require_whole. Returns an unrounded value; callers round to the target unit decimals. Mirrored by web-admin lib/uom/convert.ts.';
REVOKE ALL ON FUNCTION public.fn_uom_convert(uuid, uuid, numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_convert(uuid, uuid, numeric, text, text, boolean) TO service_role;

-- The decimals rule (D11): a quantity in a unit carries at most that unit's qty_decimals.
CREATE OR REPLACE FUNCTION public.fn_uom_assert_qty_scale(p_tenant_org_id uuid, p_uom_code text, p_qty numeric, p_label text DEFAULT 'quantity')
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_decimals smallint;
BEGIN
  IF p_qty IS NULL THEN
    RETURN;
  END IF;
  SELECT u.qty_decimals INTO v_decimals FROM public.org_uom_cf u
   WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code = p_uom_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UOM_NOT_FOUND: unit % is not set up for this Organization', p_uom_code USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF p_qty <> round(p_qty, v_decimals) THEN
    RAISE EXCEPTION 'UOM_QTY_SCALE: % % allows % decimal place(s) (got %)', p_label, p_uom_code, v_decimals, p_qty
      USING ERRCODE = 'check_violation';
  END IF;
END $$;
COMMENT ON FUNCTION public.fn_uom_assert_qty_scale(uuid, text, numeric, text) IS 'Raises UOM_QTY_SCALE when a quantity has more decimals than its unit allows (COUNT units: none). Used by product, price-list and order-line triggers (0814). Mirrored by web-admin lib/uom/scale.ts.';
REVOKE ALL ON FUNCTION public.fn_uom_assert_qty_scale(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_uom_assert_qty_scale(uuid, text, numeric, text) TO service_role;

-- ─── 8. Backfill: every existing Organization ────────────────────────────────

-- The INSERTs above ran before the sync triggers existed, so seed every Organization explicitly.
SELECT public.fn_uom_sync_all_tenants();

COMMIT;
