-- ==================================================================
-- 0055_additional_tables.sql
-- Purpose: Create Additional code tables (Currencies, Countries, Languages, Timezones)
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for additional reference data:
-- 1. sys_currency_cd - Currency codes (ISO 4217)
-- 2. sys_country_cd - Country codes (ISO 3166-1 alpha-2)
-- 3. sys_language_cd - Language codes (ISO 639-1)
-- 4. sys_timezone_cd - Timezone codes (IANA)
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_currency_cd
-- Purpose: Currency codes (ISO 4217)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_currency_cd (
  code VARCHAR(3) PRIMARY KEY,                      -- ISO 4217 code (SAR, USD, EUR, etc.)

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Currency Configuration
  symbol VARCHAR(10) NOT NULL,                       -- Currency symbol (ر.س, $, €, etc.)
  symbol_position VARCHAR(10) DEFAULT 'after',      -- 'before' or 'after'
  decimal_places INTEGER DEFAULT 2,                  -- Number of decimal places
  thousands_separator VARCHAR(5) DEFAULT ',',       -- Thousands separator
  decimal_separator VARCHAR(5) DEFAULT '.',         -- Decimal separator

  -- ISO Standards
  iso_code VARCHAR(3) NOT NULL UNIQUE,              -- ISO 4217 code (same as code)
  iso_numeric INTEGER,                              -- ISO 4217 numeric code

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System currencies cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "region": "Middle East",
      "exchange_rate_source": "central_bank",
      "last_updated": "2025-01-22"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_currency_active
  ON sys_currency_cd(is_active, display_order);

CREATE INDEX idx_currency_iso_numeric
  ON sys_currency_cd(iso_numeric) WHERE iso_numeric IS NOT NULL;

-- Comments
COMMENT ON TABLE sys_currency_cd IS
  'Currency codes following ISO 4217 standard';

COMMENT ON COLUMN sys_currency_cd.code IS
  'ISO 4217 currency code (e.g., SAR, USD, EUR, GBP)';

COMMENT ON COLUMN sys_currency_cd.iso_numeric IS
  'ISO 4217 numeric code (e.g., 682 for SAR, 840 for USD)';

-- ==================================================================
-- TABLE: sys_country_cd
-- Purpose: Country codes (ISO 3166-1 alpha-2)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_country_cd (
  code VARCHAR(2) PRIMARY KEY,                       -- ISO 3166-1 alpha-2 (SA, US, GB, etc.)

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),                                -- Flag emoji or icon code
  color VARCHAR(60),                               -- Hex color for UI

  -- ISO Standards
  iso_code VARCHAR(2) NOT NULL UNIQUE,              -- ISO 3166-1 alpha-2 (same as code)
  iso_alpha3 VARCHAR(3),                            -- ISO 3166-1 alpha-3 (SAU, USA, GBR)
  iso_numeric INTEGER,                              -- ISO 3166-1 numeric (682, 840, 826)

  -- Regional Information
  region VARCHAR(50),                               -- Region name
  subregion VARCHAR(50),                            -- Subregion name
  continent VARCHAR(20),                            -- Continent name

  -- Localization
  default_currency_code VARCHAR(3),                  -- Default currency (references sys_currency_cd)
  default_language_code VARCHAR(2),                  -- Default language (references sys_language_cd)
  default_timezone_code VARCHAR(50),                 -- Default timezone (references sys_timezone_cd)

  -- Phone & Address
  phone_code VARCHAR(10),                           -- International dialing code (+966, +1)
  address_format TEXT,                              -- Address format template

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System countries cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "flag_emoji": "🇸🇦",
      "capital": "Riyadh",
      "population": 34813871,
      "area_km2": 2149690
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_country_active
  ON sys_country_cd(is_active, display_order);

CREATE INDEX idx_country_region
  ON sys_country_cd(region, is_active);

CREATE INDEX idx_country_continent
  ON sys_country_cd(continent, is_active);

CREATE INDEX idx_country_currency
  ON sys_country_cd(default_currency_code) WHERE default_currency_code IS NOT NULL;

-- Comments
COMMENT ON TABLE sys_country_cd IS
  'Country codes following ISO 3166-1 alpha-2 standard';

COMMENT ON COLUMN sys_country_cd.code IS
  'ISO 3166-1 alpha-2 country code (e.g., SA, US, GB, AE)';

COMMENT ON COLUMN sys_country_cd.iso_alpha3 IS
  'ISO 3166-1 alpha-3 country code (e.g., SAU, USA, GBR)';

-- ==================================================================
-- TABLE: sys_language_cd
-- Purpose: Language codes (ISO 639-1)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_language_cd (
  code VARCHAR(2) PRIMARY KEY,                      -- ISO 639-1 code (en, ar, fr, etc.)

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Native name
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- ISO Standards
  iso_code VARCHAR(2) NOT NULL UNIQUE,              -- ISO 639-1 code (same as code)
  iso_639_2 VARCHAR(3),                            -- ISO 639-2/T code (eng, ara, fra)

  -- Localization
  is_rtl BOOLEAN DEFAULT false,                     -- Right-to-left language?
  locale_code VARCHAR(10),                          -- Locale code (en-US, ar-SA, etc.)
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',     -- Default date format
  time_format VARCHAR(20) DEFAULT 'HH:mm',         -- Default time format

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System languages cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "native_name": "English",
      "speakers_millions": 1500,
      "script": "Latin",
      "region": "Global"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_language_active
  ON sys_language_cd(is_active, display_order);

CREATE INDEX idx_language_rtl
  ON sys_language_cd(is_rtl, is_active);

-- Comments
COMMENT ON TABLE sys_language_cd IS
  'Language codes following ISO 639-1 standard';

COMMENT ON COLUMN sys_language_cd.code IS
  'ISO 639-1 language code (e.g., en, ar, fr, es)';

COMMENT ON COLUMN sys_language_cd.is_rtl IS
  'True for right-to-left languages (Arabic, Hebrew, etc.)';

-- ==================================================================
-- TABLE: sys_timezone_cd
-- Purpose: Timezone codes (IANA)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_timezone_cd (
  code VARCHAR(50) PRIMARY KEY,                     -- IANA timezone ID (Asia/Riyadh, America/New_York, etc.)

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Timezone Configuration
  utc_offset_hours INTEGER NOT NULL,                -- UTC offset in hours (-12 to +14)
  utc_offset_minutes INTEGER DEFAULT 0,             -- Additional minutes offset
  utc_offset_string VARCHAR(10),                     -- Formatted offset (e.g., +03:00, -05:00)
  uses_dst BOOLEAN DEFAULT false,                    -- Uses daylight saving time?
  dst_start_rule TEXT,                              -- DST start rule (if applicable)
  dst_end_rule TEXT,                                -- DST end rule (if applicable)

  -- Regional Information
  region VARCHAR(50),                               -- Region name
  country_code VARCHAR(2),                          -- Primary country (references sys_country_cd)

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System timezones cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "iana_id": "Asia/Riyadh",
      "olson_id": "Asia/Riyadh",
      "windows_id": "Arab Standard Time",
      "major_cities": ["Riyadh", "Jeddah", "Mecca"]
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_timezone_active
  ON sys_timezone_cd(is_active, display_order);

CREATE INDEX idx_timezone_utc_offset
  ON sys_timezone_cd(utc_offset_hours, is_active);

CREATE INDEX idx_timezone_country
  ON sys_timezone_cd(country_code) WHERE country_code IS NOT NULL;

CREATE INDEX idx_timezone_region
  ON sys_timezone_cd(region, is_active);

-- Comments
COMMENT ON TABLE sys_timezone_cd IS
  'Timezone codes following IANA timezone database';

COMMENT ON COLUMN sys_timezone_cd.code IS
  'IANA timezone identifier (e.g., Asia/Riyadh, America/New_York, Europe/London)';

COMMENT ON COLUMN sys_timezone_cd.utc_offset_hours IS
  'UTC offset in hours (e.g., 3 for UTC+3, -5 for UTC-5)';

-- ==================================================================
-- SEED DATA: sys_currency_cd
-- Major currencies (20+)
-- ==================================================================

INSERT INTO sys_currency_cd (
  code,
  name,
  name2,
  symbol,
  symbol_position,
  decimal_places,
  iso_code,
  iso_numeric,
  display_order,
  icon,
  color,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  ('SAR', 'Saudi Riyal', 'ريال سعودي', 'ر.س', 'after', 2, 'SAR', 682, 1, 'dollar-sign', '#10B981', true, true, true, '{"region": "Middle East", "exchange_rate_source": "central_bank"}'::jsonb),
  ('USD', 'US Dollar', 'دولار أمريكي', '$', 'before', 2, 'USD', 840, 2, 'dollar-sign', '#3B82F6', false, true, true, '{"region": "North America", "exchange_rate_source": "federal_reserve"}'::jsonb),
  ('EUR', 'Euro', 'يورو', '€', 'before', 2, 'EUR', 978, 3, 'euro', '#6366F1', false, true, true, '{"region": "Europe", "exchange_rate_source": "ecb"}'::jsonb),
  ('GBP', 'British Pound', 'جنيه إسترليني', '£', 'before', 2, 'GBP', 826, 4, 'pound-sterling', '#8B5CF6', false, true, true, '{"region": "Europe", "exchange_rate_source": "bank_of_england"}'::jsonb),
  ('AED', 'UAE Dirham', 'درهم إماراتي', 'د.إ', 'after', 2, 'AED', 784, 5, 'dollar-sign', '#10B981', false, true, true, '{"region": "Middle East", "exchange_rate_source": "central_bank"}'::jsonb),
  ('OMR', 'Omani Rial', 'ريال عماني', 'ر.ع.', 'after', 3, 'OMR', 512, 6, 'dollar-sign', '#10B981', false, true, true, '{"region": "Middle East", "exchange_rate_source": "central_bank"}'::jsonb),
  ('KWD', 'Kuwaiti Dinar', 'دينار كويتي', 'د.ك', 'after', 3, 'KWD', 414, 7, 'dollar-sign', '#10B981', false, true, true, '{"region": "Middle East", "exchange_rate_source": "central_bank"}'::jsonb),
  ('BHD', 'Bahraini Dinar', 'دينار بحريني', 'د.ب', 'after', 3, 'BHD', 048, 8, 'dollar-sign', '#10B981', false, true, true, '{"region": "Middle East", "exchange_rate_source": "central_bank"}'::jsonb),
  ('QAR', 'Qatari Riyal', 'ريال قطري', 'ر.ق', 'after', 2, 'QAR', 634, 9, 'dollar-sign', '#10B981', false, true, true, '{"region": "Middle East", "exchange_rate_source": "central_bank"}'::jsonb),
  ('JPY', 'Japanese Yen', 'ين ياباني', '¥', 'before', 0, 'JPY', 392, 10, 'yen', '#EF4444', false, true, true, '{"region": "Asia", "exchange_rate_source": "bank_of_japan"}'::jsonb),
  ('CNY', 'Chinese Yuan', 'يوان صيني', '¥', 'before', 2, 'CNY', 156, 11, 'yuan', '#DC2626', false, true, true, '{"region": "Asia", "exchange_rate_source": "pboc"}'::jsonb),
  ('INR', 'Indian Rupee', 'روبية هندية', '₹', 'before', 2, 'INR', 356, 12, 'rupee', '#F59E0B', false, true, true, '{"region": "Asia", "exchange_rate_source": "rbi"}'::jsonb),
  ('PKR', 'Pakistani Rupee', 'روبية باكستانية', '₨', 'before', 2, 'PKR', 586, 13, 'rupee', '#F59E0B', false, true, true, '{"region": "Asia", "exchange_rate_source": "central_bank"}'::jsonb),
  ('EGP', 'Egyptian Pound', 'جنيه مصري', 'ج.م', 'after', 2, 'EGP', 818, 14, 'pound-sterling', '#10B981', false, true, true, '{"region": "Africa", "exchange_rate_source": "central_bank"}'::jsonb),
  ('TRY', 'Turkish Lira', 'ليرة تركية', '₺', 'before', 2, 'TRY', 949, 15, 'lira', '#F59E0B', false, true, true, '{"region": "Europe/Asia", "exchange_rate_source": "central_bank"}'::jsonb),
  ('AUD', 'Australian Dollar', 'دولار أسترالي', 'A$', 'before', 2, 'AUD', 036, 16, 'dollar-sign', '#3B82F6', false, true, true, '{"region": "Oceania", "exchange_rate_source": "rba"}'::jsonb),
  ('CAD', 'Canadian Dollar', 'دولار كندي', 'C$', 'before', 2, 'CAD', 124, 17, 'dollar-sign', '#3B82F6', false, true, true, '{"region": "North America", "exchange_rate_source": "bank_of_canada"}'::jsonb),
  ('CHF', 'Swiss Franc', 'فرنك سويسري', 'CHF', 'before', 2, 'CHF', 756, 18, 'franc', '#6366F1', false, true, true, '{"region": "Europe", "exchange_rate_source": "snb"}'::jsonb),
  ('SEK', 'Swedish Krona', 'كرونا سويدية', 'kr', 'after', 2, 'SEK', 752, 19, 'krona', '#6366F1', false, true, true, '{"region": "Europe", "exchange_rate_source": "riksbank"}'::jsonb),
  ('NOK', 'Norwegian Krone', 'كرونا نرويجية', 'kr', 'after', 2, 'NOK', 578, 20, 'krona', '#6366F1', false, true, true, '{"region": "Europe", "exchange_rate_source": "norges_bank"}'::jsonb),
  ('ZAR', 'South African Rand', 'راند جنوب أفريقي', 'R', 'before', 2, 'ZAR', 710, 21, 'rand', '#10B981', false, true, true, '{"region": "Africa", "exchange_rate_source": "reserve_bank"}'::jsonb),
  ('BRL', 'Brazilian Real', 'ريال برازيلي', 'R$', 'before', 2, 'BRL', 986, 22, 'real', '#10B981', false, true, true, '{"region": "South America", "exchange_rate_source": "central_bank"}'::jsonb),
  ('MXN', 'Mexican Peso', 'بيزو مكسيكي', '$', 'before', 2, 'MXN', 484, 23, 'peso', '#3B82F6', false, true, true, '{"region": "North America", "exchange_rate_source": "central_bank"}'::jsonb),
  ('RUB', 'Russian Ruble', 'روبل روسي', '₽', 'after', 2, 'RUB', 643, 24, 'ruble', '#6366F1', false, true, true, '{"region": "Europe/Asia", "exchange_rate_source": "central_bank"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  symbol = EXCLUDED.symbol,
  symbol_position = EXCLUDED.symbol_position,
  decimal_places = EXCLUDED.decimal_places,
  iso_numeric = EXCLUDED.iso_numeric,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_language_cd
-- Common languages (10+)
-- ==================================================================

INSERT INTO sys_language_cd (
  code,
  name,
  name2,
  iso_code,
  iso_639_2,
  display_order,
  icon,
  color,
  is_rtl,
  locale_code,
  date_format,
  time_format,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  ('en', 'English', 'English', 'en', 'eng', 1, 'globe', '#3B82F6', false, 'en-US', 'MM/DD/YYYY', 'hh:mm A', true, true, true, '{"native_name": "English", "speakers_millions": 1500, "script": "Latin", "region": "Global"}'::jsonb),
  ('ar', 'Arabic', 'العربية', 'ar', 'ara', 2, 'globe', '#10B981', true, 'ar-SA', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "العربية", "speakers_millions": 420, "script": "Arabic", "region": "Middle East"}'::jsonb),
  ('fr', 'French', 'Français', 'fr', 'fra', 3, 'globe', '#6366F1', false, 'fr-FR', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "Français", "speakers_millions": 280, "script": "Latin", "region": "Europe/Africa"}'::jsonb),
  ('es', 'Spanish', 'Español', 'es', 'spa', 4, 'globe', '#F59E0B', false, 'es-ES', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "Español", "speakers_millions": 580, "script": "Latin", "region": "Europe/Americas"}'::jsonb),
  ('de', 'German', 'Deutsch', 'de', 'deu', 5, 'globe', '#8B5CF6', false, 'de-DE', 'DD.MM.YYYY', 'HH:mm', false, true, true, '{"native_name": "Deutsch", "speakers_millions": 130, "script": "Latin", "region": "Europe"}'::jsonb),
  ('it', 'Italian', 'Italiano', 'it', 'ita', 6, 'globe', '#EC4899', false, 'it-IT', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "Italiano", "speakers_millions": 85, "script": "Latin", "region": "Europe"}'::jsonb),
  ('pt', 'Portuguese', 'Português', 'pt', 'por', 7, 'globe', '#10B981', false, 'pt-PT', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "Português", "speakers_millions": 260, "script": "Latin", "region": "Europe/South America"}'::jsonb),
  ('ru', 'Russian', 'Русский', 'ru', 'rus', 8, 'globe', '#6366F1', false, 'ru-RU', 'DD.MM.YYYY', 'HH:mm', false, true, true, '{"native_name": "Русский", "speakers_millions": 260, "script": "Cyrillic", "region": "Europe/Asia"}'::jsonb),
  ('zh', 'Chinese', '中文', 'zh', 'zho', 9, 'globe', '#DC2626', false, 'zh-CN', 'YYYY-MM-DD', 'HH:mm', false, true, true, '{"native_name": "中文", "speakers_millions": 1300, "script": "Chinese", "region": "Asia"}'::jsonb),
  ('ja', 'Japanese', '日本語', 'ja', 'jpn', 10, 'globe', '#EF4444', false, 'ja-JP', 'YYYY/MM/DD', 'HH:mm', false, true, true, '{"native_name": "日本語", "speakers_millions": 125, "script": "Japanese", "region": "Asia"}'::jsonb),
  ('ko', 'Korean', '한국어', 'ko', 'kor', 11, 'globe', '#3B82F6', false, 'ko-KR', 'YYYY-MM-DD', 'HH:mm', false, true, true, '{"native_name": "한국어", "speakers_millions": 80, "script": "Hangul", "region": "Asia"}'::jsonb),
  ('hi', 'Hindi', 'हिन्दी', 'hi', 'hin', 12, 'globe', '#F59E0B', false, 'hi-IN', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "हिन्दी", "speakers_millions": 600, "script": "Devanagari", "region": "Asia"}'::jsonb),
  ('tr', 'Turkish', 'Türkçe', 'tr', 'tur', 13, 'globe', '#10B981', false, 'tr-TR', 'DD.MM.YYYY', 'HH:mm', false, true, true, '{"native_name": "Türkçe", "speakers_millions": 80, "script": "Latin", "region": "Europe/Asia"}'::jsonb),
  ('ur', 'Urdu', 'اردو', 'ur', 'urd', 14, 'globe', '#10B981', true, 'ur-PK', 'DD/MM/YYYY', 'HH:mm', false, true, true, '{"native_name": "اردو", "speakers_millions": 230, "script": "Arabic", "region": "Asia"}'::jsonb),
  ('fa', 'Persian', 'فارسی', 'fa', 'fas', 15, 'globe', '#8B5CF6', true, 'fa-IR', 'YYYY/MM/DD', 'HH:mm', false, true, true, '{"native_name": "فارسی", "speakers_millions": 110, "script": "Arabic", "region": "Middle East"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  iso_639_2 = EXCLUDED.iso_639_2,
  is_rtl = EXCLUDED.is_rtl,
  locale_code = EXCLUDED.locale_code,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_country_cd
-- Major countries (focus on Middle East + major countries)
-- ==================================================================

INSERT INTO sys_country_cd (
  code,
  name,
  name2,
  iso_code,
  iso_alpha3,
  iso_numeric,
  region,
  subregion,
  continent,
  default_currency_code,
  default_language_code,
  default_timezone_code,
  phone_code,
  display_order,
  icon,
  color,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  ('SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'SA', 'SAU', 682, 'Middle East', 'Western Asia', 'Asia', 'SAR', 'ar', 'Asia/Riyadh', '+966', 1, 'flag', '#10B981', true, true, true, '{"flag_emoji": "🇸🇦", "capital": "Riyadh", "population": 34813871}'::jsonb),
  ('AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'AE', 'ARE', 784, 'Middle East', 'Western Asia', 'Asia', 'AED', 'ar', 'Asia/Dubai', '+971', 2, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇦🇪", "capital": "Abu Dhabi", "population": 9890400}'::jsonb),
  ('KW', 'Kuwait', 'الكويت', 'KW', 'KWT', 414, 'Middle East', 'Western Asia', 'Asia', 'KWD', 'ar', 'Asia/Kuwait', '+965', 3, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇰🇼", "capital": "Kuwait City", "population": 4270563}'::jsonb),
  ('QA', 'Qatar', 'قطر', 'QA', 'QAT', 634, 'Middle East', 'Western Asia', 'Asia', 'QAR', 'ar', 'Asia/Qatar', '+974', 4, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇶🇦", "capital": "Doha", "population": 2881053}'::jsonb),
  ('BH', 'Bahrain', 'البحرين', 'BH', 'BHR', 048, 'Middle East', 'Western Asia', 'Asia', 'BHD', 'ar', 'Asia/Bahrain', '+973', 5, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇧🇭", "capital": "Manama", "population": 1701575}'::jsonb),
  ('OM', 'Oman', 'عُمان', 'OM', 'OMN', 512, 'Middle East', 'Western Asia', 'Asia', 'OMR', 'ar', 'Asia/Muscat', '+968', 6, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇴🇲", "capital": "Muscat", "population": 5106626}'::jsonb),
  ('US', 'United States', 'الولايات المتحدة', 'US', 'USA', 840, 'North America', 'Northern America', 'North America', 'USD', 'en', 'America/New_York', '+1', 10, 'flag', '#3B82F6', false, true, true, '{"flag_emoji": "🇺🇸", "capital": "Washington, D.C.", "population": 331900000}'::jsonb),
  ('GB', 'United Kingdom', 'المملكة المتحدة', 'GB', 'GBR', 826, 'Europe', 'Northern Europe', 'Europe', 'GBP', 'en', 'Europe/London', '+44', 11, 'flag', '#8B5CF6', false, true, true, '{"flag_emoji": "🇬🇧", "capital": "London", "population": 67081000}'::jsonb),
  ('FR', 'France', 'فرنسا', 'FR', 'FRA', 250, 'Europe', 'Western Europe', 'Europe', 'EUR', 'fr', 'Europe/Paris', '+33', 12, 'flag', '#6366F1', false, true, true, '{"flag_emoji": "🇫🇷", "capital": "Paris", "population": 67897000}'::jsonb),
  ('DE', 'Germany', 'ألمانيا', 'DE', 'DEU', 276, 'Europe', 'Western Europe', 'Europe', 'EUR', 'de', 'Europe/Berlin', '+49', 13, 'flag', '#8B5CF6', false, true, true, '{"flag_emoji": "🇩🇪", "capital": "Berlin", "population": 83200000}'::jsonb),
  ('EG', 'Egypt', 'مصر', 'EG', 'EGY', 818, 'Africa', 'Northern Africa', 'Africa', 'EGP', 'ar', 'Africa/Cairo', '+20', 20, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇪🇬", "capital": "Cairo", "population": 104258327}'::jsonb),
  ('IN', 'India', 'الهند', 'IN', 'IND', 356, 'Asia', 'Southern Asia', 'Asia', 'INR', 'hi', 'Asia/Kolkata', '+91', 21, 'flag', '#F59E0B', false, true, true, '{"flag_emoji": "🇮🇳", "capital": "New Delhi", "population": 1380004385}'::jsonb),
  ('PK', 'Pakistan', 'باكستان', 'PK', 'PAK', 586, 'Asia', 'Southern Asia', 'Asia', 'PKR', 'ur', 'Asia/Karachi', '+92', 22, 'flag', '#10B981', false, true, true, '{"flag_emoji": "🇵🇰", "capital": "Islamabad", "population": 225199937}'::jsonb),
  ('CN', 'China', 'الصين', 'CN', 'CHN', 156, 'Asia', 'Eastern Asia', 'Asia', 'CNY', 'zh', 'Asia/Shanghai', '+86', 23, 'flag', '#DC2626', false, true, true, '{"flag_emoji": "🇨🇳", "capital": "Beijing", "population": 1439323776}'::jsonb),
  ('JP', 'Japan', 'اليابان', 'JP', 'JPN', 392, 'Asia', 'Eastern Asia', 'Asia', 'JPY', 'ja', 'Asia/Tokyo', '+81', 24, 'flag', '#EF4444', false, true, true, '{"flag_emoji": "🇯🇵", "capital": "Tokyo", "population": 125836021}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  iso_alpha3 = EXCLUDED.iso_alpha3,
  iso_numeric = EXCLUDED.iso_numeric,
  region = EXCLUDED.region,
  continent = EXCLUDED.continent,
  default_currency_code = EXCLUDED.default_currency_code,
  default_language_code = EXCLUDED.default_language_code,
  default_timezone_code = EXCLUDED.default_timezone_code,
  phone_code = EXCLUDED.phone_code,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_timezone_cd
-- Major timezones (50+)
-- ==================================================================

INSERT INTO sys_timezone_cd (
  code,
  name,
  name2,
  utc_offset_hours,
  utc_offset_minutes,
  utc_offset_string,
  uses_dst,
  region,
  country_code,
  display_order,
  icon,
  color,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  -- Middle East Timezones
  ('Asia/Riyadh', 'Saudi Arabia Time', 'توقيت السعودية', 3, 0, '+03:00', false, 'Middle East', 'SA', 1, 'clock', '#10B981', true, true, true, '{"iana_id": "Asia/Riyadh", "major_cities": ["Riyadh", "Jeddah", "Mecca"]}'::jsonb),
  ('Asia/Dubai', 'UAE Time', 'توقيت الإمارات', 4, 0, '+04:00', false, 'Middle East', 'AE', 2, 'clock', '#10B981', false, true, true, '{"iana_id": "Asia/Dubai", "major_cities": ["Dubai", "Abu Dhabi"]}'::jsonb),
  ('Asia/Kuwait', 'Kuwait Time', 'توقيت الكويت', 3, 0, '+03:00', false, 'Middle East', 'KW', 3, 'clock', '#10B981', false, true, true, '{"iana_id": "Asia/Kuwait", "major_cities": ["Kuwait City"]}'::jsonb),
  ('Asia/Qatar', 'Qatar Time', 'توقيت قطر', 3, 0, '+03:00', false, 'Middle East', 'QA', 4, 'clock', '#10B981', false, true, true, '{"iana_id": "Asia/Qatar", "major_cities": ["Doha"]}'::jsonb),
  ('Asia/Bahrain', 'Bahrain Time', 'توقيت البحرين', 3, 0, '+03:00', false, 'Middle East', 'BH', 5, 'clock', '#10B981', false, true, true, '{"iana_id": "Asia/Bahrain", "major_cities": ["Manama"]}'::jsonb),
  ('Asia/Muscat', 'Oman Time', 'توقيت عمان', 4, 0, '+04:00', false, 'Middle East', 'OM', 6, 'clock', '#10B981', false, true, true, '{"iana_id": "Asia/Muscat", "major_cities": ["Muscat"]}'::jsonb),
  ('Africa/Cairo', 'Egypt Time', 'توقيت مصر', 2, 0, '+02:00', true, 'Africa', 'EG', 10, 'clock', '#10B981', false, true, true, '{"iana_id": "Africa/Cairo", "major_cities": ["Cairo", "Alexandria"]}'::jsonb),
  -- Major World Timezones
  ('America/New_York', 'Eastern Time', 'التوقيت الشرقي', -5, 0, '-05:00', true, 'North America', 'US', 20, 'clock', '#3B82F6', false, true, true, '{"iana_id": "America/New_York", "major_cities": ["New York", "Washington"]}'::jsonb),
  ('America/Chicago', 'Central Time', 'التوقيت المركزي', -6, 0, '-06:00', true, 'North America', 'US', 21, 'clock', '#3B82F6', false, true, true, '{"iana_id": "America/Chicago", "major_cities": ["Chicago", "Dallas"]}'::jsonb),
  ('America/Denver', 'Mountain Time', 'توقيت الجبال', -7, 0, '-07:00', true, 'North America', 'US', 22, 'clock', '#3B82F6', false, true, true, '{"iana_id": "America/Denver", "major_cities": ["Denver", "Phoenix"]}'::jsonb),
  ('America/Los_Angeles', 'Pacific Time', 'التوقيت Pacific', -8, 0, '-08:00', true, 'North America', 'US', 23, 'clock', '#3B82F6', false, true, true, '{"iana_id": "America/Los_Angeles", "major_cities": ["Los Angeles", "San Francisco"]}'::jsonb),
  ('Europe/London', 'Greenwich Mean Time', 'توقيت غرينتش', 0, 0, '+00:00', true, 'Europe', 'GB', 30, 'clock', '#8B5CF6', false, true, true, '{"iana_id": "Europe/London", "major_cities": ["London"]}'::jsonb),
  ('Europe/Paris', 'Central European Time', 'التوقيت الأوروبي المركزي', 1, 0, '+01:00', true, 'Europe', 'FR', 31, 'clock', '#6366F1', false, true, true, '{"iana_id": "Europe/Paris", "major_cities": ["Paris", "Brussels"]}'::jsonb),
  ('Europe/Berlin', 'Central European Time', 'التوقيت الأوروبي المركزي', 1, 0, '+01:00', true, 'Europe', 'DE', 32, 'clock', '#8B5CF6', false, true, true, '{"iana_id": "Europe/Berlin", "major_cities": ["Berlin", "Frankfurt"]}'::jsonb),
  ('Asia/Kolkata', 'India Standard Time', 'توقيت الهند', 5, 30, '+05:30', false, 'Asia', 'IN', 50, 'clock', '#F59E0B', false, true, true, '{"iana_id": "Asia/Kolkata", "major_cities": ["Mumbai", "Delhi"]}'::jsonb),
  ('Asia/Karachi', 'Pakistan Standard Time', 'توقيت باكستان', 5, 0, '+05:00', false, 'Asia', 'PK', 51, 'clock', '#10B981', false, true, true, '{"iana_id": "Asia/Karachi", "major_cities": ["Karachi", "Lahore"]}'::jsonb),
  ('Asia/Shanghai', 'China Standard Time', 'توقيت الصين', 8, 0, '+08:00', false, 'Asia', 'CN', 60, 'clock', '#DC2626', false, true, true, '{"iana_id": "Asia/Shanghai", "major_cities": ["Shanghai", "Beijing"]}'::jsonb),
  ('Asia/Tokyo', 'Japan Standard Time', 'توقيت اليابان', 9, 0, '+09:00', false, 'Asia', 'JP', 61, 'clock', '#EF4444', false, true, true, '{"iana_id": "Asia/Tokyo", "major_cities": ["Tokyo", "Osaka"]}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  utc_offset_hours = EXCLUDED.utc_offset_hours,
  utc_offset_string = EXCLUDED.utc_offset_string,
  uses_dst = EXCLUDED.uses_dst,
  region = EXCLUDED.region,
  country_code = EXCLUDED.country_code,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_currency_cd',
    'Currencies',
    'العملات',
    'Currency codes (ISO 4217)',
    'رموز العملات (ISO 4217)',
    'Additional',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "dollar-sign", "color": "#10B981", "help_text": "Manage currency codes"}'::jsonb
  ),
  (
    'sys_country_cd',
    'Countries',
    'الدول',
    'Country codes (ISO 3166-1)',
    'رموز الدول (ISO 3166-1)',
    'Additional',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "globe", "color": "#3B82F6", "help_text": "Manage country codes"}'::jsonb
  ),
  (
    'sys_language_cd',
    'Languages',
    'اللغات',
    'Language codes (ISO 639-1)',
    'رموز اللغات (ISO 639-1)',
    'Additional',
    3,
    true,
    true,
    false,
    true,
    '{"icon": "languages", "color": "#8B5CF6", "help_text": "Manage language codes"}'::jsonb
  ),
  (
    'sys_timezone_cd',
    'Timezones',
    'المناطق الزمنية',
    'Timezone codes (IANA)',
    'رموز المناطق الزمنية (IANA)',
    'Additional',
    4,
    true,
    true,
    false,
    true,
    '{"icon": "clock", "color": "#F59E0B", "help_text": "Manage timezone codes"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

