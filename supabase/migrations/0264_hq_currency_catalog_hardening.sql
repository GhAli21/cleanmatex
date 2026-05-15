-- =========================================================
-- 0264_hq_currency_catalog_hardening.sql
-- HQ Currency Catalog Hardening
-- Table: public.sys_currency_cd
-- Scope: SaaS HQ platform catalog only
-- =========================================================

BEGIN;

-- 1. Rename existing columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_currency_cd' AND column_name = 'decimal_places') THEN
    ALTER TABLE public.sys_currency_cd RENAME COLUMN decimal_places TO minor_unit;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_currency_cd' AND column_name = 'iso_numeric') THEN
    ALTER TABLE public.sys_currency_cd RENAME COLUMN iso_numeric TO iso_numeric_code;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_currency_cd' AND column_name = 'thousands_separator') THEN
    ALTER TABLE public.sys_currency_cd RENAME COLUMN thousands_separator TO group_separator;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_currency_cd' AND column_name = 'iso_code') THEN
    ALTER TABLE public.sys_currency_cd RENAME COLUMN iso_code TO iso_alpha_code;
  END IF;
END $$;

-- 2. Modify existing columns
ALTER TABLE public.sys_currency_cd
  ALTER COLUMN symbol TYPE VARCHAR(20),
  ALTER COLUMN symbol_position TYPE VARCHAR(20);

-- 3. Add all new columns
ALTER TABLE public.sys_currency_cd
  ADD COLUMN IF NOT EXISTS name_plural VARCHAR(250),
  ADD COLUMN IF NOT EXISTS name_plural2 VARCHAR(250),
  ADD COLUMN IF NOT EXISTS native_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS native_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS narrow_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS narrow_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS minor_unit_name VARCHAR(250),
  ADD COLUMN IF NOT EXISTS minor_unit_name2 VARCHAR(250),
  ADD COLUMN IF NOT EXISTS minor_unit_name_plural VARCHAR(100),
  ADD COLUMN IF NOT EXISTS minor_unit_name_plural2 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS format_locale VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_cash_supported BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cash_rounding_increment_minor BIGINT,
  ADD COLUMN IF NOT EXISTS cash_rounding_mode VARCHAR(20) DEFAULT 'HALF_UP',
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fallback_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fallback_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS official_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS official_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS official_symbol_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS official_symbol_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS requires_symbol_fallback BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thermal_printer_fallback VARCHAR(20),
  ADD COLUMN IF NOT EXISTS thermal_printer_fallback2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pdf_fallback_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pdf_fallback_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mobile_fallback_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mobile_fallback_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS web_fallback_symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS web_fallback_symbol2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pdf_unicode_supported BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_unicode_supported BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS web_unicode_supported BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS symbol_locale_strategy VARCHAR(30) NOT NULL DEFAULT 'LANGUAGE',
  ADD COLUMN IF NOT EXISTS symbol_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS symbol_rendering_mode VARCHAR(30) NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS symbol_direction VARCHAR(10) NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS unicode_codepoint VARCHAR(20),
  ADD COLUMN IF NOT EXISTS font_family VARCHAR(100),
  ADD COLUMN IF NOT EXISTS symbol_svg TEXT,
  ADD COLUMN IF NOT EXISTS symbol_asset_url TEXT,
  ADD COLUMN IF NOT EXISTS format_pattern VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rendering_priority INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT current_timestamp,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- 4. Normalize data
UPDATE public.sys_currency_cd
SET
  code = upper(trim(code)),
  iso_alpha_code = upper(trim(iso_alpha_code)),
  symbol_position = coalesce(nullif(trim(symbol_position), ''), 'AUTO'),
  minor_unit = coalesce(minor_unit, 2),
  group_separator = coalesce(nullif(group_separator, ''), ','),
  decimal_separator = coalesce(nullif(decimal_separator, ''), '.'),
  is_cash_supported = coalesce(is_cash_supported, true),
  cash_rounding_mode = coalesce(nullif(cash_rounding_mode, ''), 'HALF_UP'),
  is_system = coalesce(is_system, true),
  is_active = coalesce(is_active, true),
  metadata = coalesce(metadata, '{}'::jsonb),
  rec_status = coalesce(rec_status, 1);

-- 5. Drop unused columns
ALTER TABLE public.sys_currency_cd DROP COLUMN IF EXISTS is_default;

-- 6. Drop old constraints
ALTER TABLE public.sys_currency_cd
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_code_upper,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_iso_code_upper,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_iso_alpha_code_upper,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_code_len,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_iso_code_len,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_iso_alpha_code_len,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_decimal_places,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_minor_unit,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_symbol_position,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_cash_rounding_mode,
  DROP CONSTRAINT IF EXISTS chk_sys_currency_cd_rec_status,
  DROP CONSTRAINT IF EXISTS chk_currency_symbol_locale_strategy,
  DROP CONSTRAINT IF EXISTS chk_currency_symbol_type,
  DROP CONSTRAINT IF EXISTS chk_currency_symbol_rendering_mode,
  DROP CONSTRAINT IF EXISTS chk_currency_symbol_position,
  DROP CONSTRAINT IF EXISTS chk_currency_symbol_direction,
  DROP CONSTRAINT IF EXISTS chk_currency_official_symbol_required,
  DROP CONSTRAINT IF EXISTS chk_currency_fallback_required,
  DROP CONSTRAINT IF EXISTS chk_currency_exchange_rate_source,
  DROP CONSTRAINT IF EXISTS chk_currency_rendering_priority;

-- 7. Add constraints
ALTER TABLE public.sys_currency_cd
  ADD CONSTRAINT chk_sys_currency_cd_code_upper CHECK (code = upper(code)),
  ADD CONSTRAINT chk_sys_currency_cd_iso_alpha_code_upper CHECK (iso_alpha_code = upper(iso_alpha_code)),
  ADD CONSTRAINT chk_sys_currency_cd_code_len CHECK (length(code) = 3),
  ADD CONSTRAINT chk_sys_currency_cd_iso_alpha_code_len CHECK (length(iso_alpha_code) = 3),
  ADD CONSTRAINT chk_sys_currency_cd_minor_unit CHECK (minor_unit BETWEEN 0 AND 6),
  ADD CONSTRAINT chk_currency_symbol_position CHECK (symbol_position IN ('LEFT', 'RIGHT', 'AUTO', 'LOCALE', 'before', 'after')),
  ADD CONSTRAINT chk_sys_currency_cd_cash_rounding_mode CHECK (cash_rounding_mode IN ('HALF_UP', 'HALF_EVEN', 'UP', 'DOWN')),
  ADD CONSTRAINT chk_sys_currency_cd_rec_status CHECK (rec_status IN (0, 1, 2)),
  ADD CONSTRAINT chk_currency_symbol_locale_strategy CHECK (symbol_locale_strategy IN ('FIXED', 'LANGUAGE', 'LOCALE', 'CHANNEL')),
  ADD CONSTRAINT chk_currency_symbol_type CHECK (symbol_type IN ('TEXT', 'UNICODE', 'SVG', 'FONT_GLYPH', 'IMAGE')),
  ADD CONSTRAINT chk_currency_symbol_rendering_mode CHECK (symbol_rendering_mode IN ('AUTO', 'TEXT', 'UNICODE', 'SVG', 'FONT')),
  ADD CONSTRAINT chk_currency_symbol_direction CHECK (symbol_direction IN ('LTR', 'RTL', 'AUTO')),
  ADD CONSTRAINT chk_currency_official_symbol_required CHECK (official_symbol_enabled = false OR official_symbol IS NOT NULL),
  ADD CONSTRAINT chk_currency_fallback_required CHECK (requires_symbol_fallback = false OR fallback_symbol IS NOT NULL OR fallback_symbol2 IS NOT NULL),
  ADD CONSTRAINT chk_currency_exchange_rate_source CHECK (exchange_rate_source IS NULL OR exchange_rate_source IN ('central_bank', 'manual', 'ecb', 'open_exchange', 'fixer', 'xe', 'custom_api')),
  ADD CONSTRAINT chk_currency_rendering_priority CHECK (rendering_priority >= 1);

-- 8. Alter column properties
ALTER TABLE public.sys_currency_cd
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN symbol SET NOT NULL,
  ALTER COLUMN symbol_position SET NOT NULL,
  ALTER COLUMN symbol_position SET DEFAULT 'AUTO',
  ALTER COLUMN minor_unit SET NOT NULL,
  ALTER COLUMN group_separator SET NOT NULL,
  ALTER COLUMN decimal_separator SET NOT NULL,
  ALTER COLUMN iso_alpha_code SET NOT NULL,
  ALTER COLUMN is_cash_supported SET NOT NULL,
  ALTER COLUMN is_system SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN rec_status SET NOT NULL;

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_sys_currency_cd_active_list ON public.sys_currency_cd (rec_status, is_active, display_order, code);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sys_currency_cd_iso_numeric_code' AND n.nspname = 'public') THEN
        CREATE INDEX idx_sys_currency_cd_iso_numeric_code ON public.sys_currency_cd (iso_numeric_code) WHERE iso_numeric_code IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sys_currency_cd_name' AND n.nspname = 'public') THEN
        CREATE INDEX idx_sys_currency_cd_name ON public.sys_currency_cd (name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sys_currency_cd_name2' AND n.nspname = 'public') THEN
        CREATE INDEX idx_sys_currency_cd_name2 ON public.sys_currency_cd (name2);
    END IF;
END $$;

-- 10. Triggers
CREATE OR REPLACE FUNCTION public.trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sys_currency_cd_updated_at ON public.sys_currency_cd;
CREATE TRIGGER trg_sys_currency_cd_updated_at
BEFORE UPDATE ON public.sys_currency_cd
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_updated_at();

-- 11. Comments
COMMENT ON COLUMN public.sys_currency_cd.code IS 'Immutable primary ISO currency code used internally and externally. Should normally match ISO 4217 alpha code. Example: SAR, OMR, USD';
COMMENT ON COLUMN public.sys_currency_cd.name IS 'Currency name in English/default language. Example: Saudi Riyal';
COMMENT ON COLUMN public.sys_currency_cd.name2 IS 'Currency name in Arabic/secondary language. Example: ريال سعودي';
COMMENT ON COLUMN public.sys_currency_cd.name_plural IS 'Plural currency name in English/default language. Example: Saudi Riyals';
COMMENT ON COLUMN public.sys_currency_cd.name_plural2 IS 'Plural currency name in Arabic/secondary language. Example: ريالات سعودية';
COMMENT ON COLUMN public.sys_currency_cd.description IS 'Detailed English/default description of the currency. Example: Official currency of Saudi Arabia';
COMMENT ON COLUMN public.sys_currency_cd.description2 IS 'Detailed Arabic/secondary description of the currency. Example: العملة الرسمية للمملكة العربية السعودية';
COMMENT ON COLUMN public.sys_currency_cd.country_code IS 'Primary ISO 3166-1 alpha-2 country code associated with the currency. This is a primary/default country, not necessarily the only country using the currency. Example: SA';
COMMENT ON COLUMN public.sys_currency_cd.region_code IS 'Business/geographic region grouping used for filtering and onboarding. Example: GCC';
COMMENT ON COLUMN public.sys_currency_cd.display_order IS 'Ordering value used in dropdowns, tables, and admin screens. Lower values appear first. Example: 1';
COMMENT ON COLUMN public.sys_currency_cd.icon IS 'Frontend icon identifier used by UI components. Example: coins';
COMMENT ON COLUMN public.sys_currency_cd.color IS 'UI display color, usually HEX. Example: #10B981';
COMMENT ON COLUMN public.sys_currency_cd.symbol IS 'Primary symbol/code used in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.symbol2 IS 'Primary symbol/code used in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.fallback_symbol IS 'Fallback symbol for unsupported rendering environments in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.fallback_symbol2 IS 'Fallback symbol for unsupported rendering environments in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.native_symbol IS 'Native/local market symbol in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.native_symbol2 IS 'Native/local market symbol in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.narrow_symbol IS 'Compact symbol for constrained UI spaces in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.narrow_symbol2 IS 'Compact symbol for constrained UI spaces in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.official_symbol IS 'Official regulatory/Unicode symbol in English/default context when available. Example: ⃁';
COMMENT ON COLUMN public.sys_currency_cd.official_symbol2 IS 'Official regulatory/Unicode symbol in Arabic/secondary context when available. Example: ⃁';
COMMENT ON COLUMN public.sys_currency_cd.official_symbol_enabled IS 'Controls whether the official symbol should be used by rendering engines. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.official_symbol_source IS 'Authority/source of the official symbol. Example: SAMA, CBO';
COMMENT ON COLUMN public.sys_currency_cd.requires_symbol_fallback IS 'Indicates whether fallback symbols are mandatory because official rendering may fail in some channels. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.thermal_printer_fallback IS 'Symbol fallback for thermal receipt printers in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.thermal_printer_fallback2 IS 'Symbol fallback for thermal receipt printers in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.pdf_fallback_symbol IS 'Symbol fallback for PDF rendering in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.pdf_fallback_symbol2 IS 'Symbol fallback for PDF rendering in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.mobile_fallback_symbol IS 'Symbol fallback for mobile apps in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.mobile_fallback_symbol2 IS 'Symbol fallback for mobile apps in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.web_fallback_symbol IS 'Symbol fallback for web rendering in English/default context. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.web_fallback_symbol2 IS 'Symbol fallback for web rendering in Arabic/secondary context. Example: ر.س';
COMMENT ON COLUMN public.sys_currency_cd.pdf_unicode_supported IS 'Indicates whether the PDF generation stack supports the official Unicode symbol. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.mobile_unicode_supported IS 'Indicates whether mobile apps support the official Unicode symbol. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.web_unicode_supported IS 'Indicates whether web browsers/fonts support the official Unicode symbol. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.symbol_locale_strategy IS 'Determines how symbols are selected: fixed value, language-based, locale-based, or channel-specific. Example: LANGUAGE';
COMMENT ON COLUMN public.sys_currency_cd.symbol_type IS 'Technical type of the symbol representation. Example: TEXT, UNICODE, SVG, FONT_GLYPH, IMAGE';
COMMENT ON COLUMN public.sys_currency_cd.symbol_rendering_mode IS 'Preferred rendering strategy used by formatting/rendering services. Example: AUTO, TEXT, UNICODE, SVG, FONT';
COMMENT ON COLUMN public.sys_currency_cd.symbol_position IS 'Symbol placement strategy relative to the amount. Example: LEFT, RIGHT, AUTO, LOCALE';
COMMENT ON COLUMN public.sys_currency_cd.symbol_direction IS 'Text direction behavior for symbol rendering. Example: LTR, RTL, AUTO';
COMMENT ON COLUMN public.sys_currency_cd.unicode_codepoint IS 'Unicode codepoint for the official symbol where applicable. Example: U+20C1';
COMMENT ON COLUMN public.sys_currency_cd.font_family IS 'Preferred font family required for correct rendering. Example: SaudiRiyalFont';
COMMENT ON COLUMN public.sys_currency_cd.symbol_svg IS 'Inline SVG markup used when Unicode/font rendering is not reliable. Example: <svg>...</svg>';
COMMENT ON COLUMN public.sys_currency_cd.symbol_asset_url IS 'Path or URL to hosted symbol asset. Example: /assets/currency/sar.svg';
COMMENT ON COLUMN public.sys_currency_cd.format_pattern IS 'Template used by formatting service to combine amount and symbol. Example: {symbol} {amount}';
COMMENT ON COLUMN public.sys_currency_cd.rendering_priority IS 'Priority order used by rendering fallback logic. Lower number means higher priority. Example: 1';
COMMENT ON COLUMN public.sys_currency_cd.minor_unit IS 'Number of decimal places used by the currency minor unit. Example: 2 for SAR/USD, 3 for OMR/KWD, 0 for JPY';
COMMENT ON COLUMN public.sys_currency_cd.minor_unit_name IS 'Minor unit name in English/default language. Example: Halala';
COMMENT ON COLUMN public.sys_currency_cd.minor_unit_name2 IS 'Minor unit name in Arabic/secondary language. Example: هللة';
COMMENT ON COLUMN public.sys_currency_cd.minor_unit_name_plural IS 'Plural minor unit name in English/default language. Example: Halalas';
COMMENT ON COLUMN public.sys_currency_cd.minor_unit_name_plural2 IS 'Plural minor unit name in Arabic/secondary language. Example: هللات';
COMMENT ON COLUMN public.sys_currency_cd.group_separator IS 'Digit grouping separator used for formatted numbers. Example: ,';
COMMENT ON COLUMN public.sys_currency_cd.decimal_separator IS 'Decimal separator used for formatted numbers. Example: .';
COMMENT ON COLUMN public.sys_currency_cd.format_locale IS 'Default locale hint for formatting preview and localization. Example: ar-SA';
COMMENT ON COLUMN public.sys_currency_cd.is_cash_supported IS 'Indicates whether the currency supports physical cash operations. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.cash_rounding_increment_minor IS 'Cash rounding increment expressed in minor units. Example: 5';
COMMENT ON COLUMN public.sys_currency_cd.cash_rounding_mode IS 'Cash rounding strategy. Example: HALF_UP';
COMMENT ON COLUMN public.sys_currency_cd.iso_alpha_code IS 'Official ISO 4217 alphabetic currency code. Example: SAR';
COMMENT ON COLUMN public.sys_currency_cd.iso_numeric_code IS 'Official ISO 4217 numeric currency code. Example: 682';
COMMENT ON COLUMN public.sys_currency_cd.exchange_rate_source IS 'Default exchange-rate source/provider hint. Example: central_bank';
COMMENT ON COLUMN public.sys_currency_cd.effective_from IS 'Date from which this currency record becomes valid. Example: 2026-01-01';
COMMENT ON COLUMN public.sys_currency_cd.effective_to IS 'Date after which this currency record becomes invalid/obsolete. Example: 2030-12-31';
COMMENT ON COLUMN public.sys_currency_cd.is_system IS 'Indicates whether the record is protected and platform-managed. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.is_active IS 'Indicates whether the currency is active and selectable. Example: true';
COMMENT ON COLUMN public.sys_currency_cd.metadata IS 'Flexible extension object for rare/non-queryable metadata. Example: {"note":"future extension"}';
COMMENT ON COLUMN public.sys_currency_cd.created_at IS 'Timestamp when the record was created. Example: 2026-05-14 20:00:00';
COMMENT ON COLUMN public.sys_currency_cd.created_by IS 'User ID that created the record. Example: 00000000-0000-0000-0000-000000000000';
COMMENT ON COLUMN public.sys_currency_cd.updated_at IS 'Timestamp of the latest update. Example: 2026-05-15 09:00:00';
COMMENT ON COLUMN public.sys_currency_cd.updated_by IS 'User ID that last updated the record. Example: 00000000-0000-0000-0000-000000000000';
COMMENT ON COLUMN public.sys_currency_cd.rec_status IS 'Internal lifecycle status. Recommended: 1 active, 2 inactive/archived, 0 deleted. Example: 1';

COMMIT;
