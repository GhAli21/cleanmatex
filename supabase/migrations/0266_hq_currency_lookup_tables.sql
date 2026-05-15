-- =========================================================
-- 0266_hq_currency_lookup_tables.sql
-- HQ Currency Catalog Lookup Tables & Foreign Keys
-- =========================================================

BEGIN;

-- 1. Create Lookup Tables
CREATE TABLE IF NOT EXISTS public.sys_currency_symbol_type_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_symbol_type_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS public.sys_currency_symbol_rendering_mode_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_symbol_rendering_mode_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS public.sys_currency_symbol_position_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_symbol_position_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS public.sys_currency_symbol_direction_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_symbol_direction_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS public.sys_currency_symbol_locale_strategy_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_symbol_locale_strategy_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS public.sys_currency_cash_rounding_mode_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_cash_rounding_mode_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS public.sys_exchange_rate_source_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_exchange_rate_source_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- 2. Insert Seed Data
INSERT INTO public.sys_currency_symbol_locale_strategy_cd (code, name, name2, description, description2, display_order) VALUES
('FIXED', 'Fixed', 'ثابت', 'Use one symbol regardless of language or channel.', 'استخدام رمز واحد بغض النظر عن اللغة أو القناة.', 1),
('LANGUAGE', 'Language Based', 'حسب اللغة', 'Select symbol based on application language.', 'اختيار الرمز حسب لغة التطبيق.', 2),
('LOCALE', 'Locale Based', 'حسب اللغة والمنطقة', 'Select symbol based on locale.', 'اختيار الرمز حسب اللغة والمنطقة.', 3),
('CHANNEL', 'Channel Based', 'حسب القناة', 'Select symbol based on output channel.', 'اختيار الرمز حسب قناة العرض.', 4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

INSERT INTO public.sys_currency_symbol_type_cd (code, name, name2, description, description2, display_order) VALUES
('TEXT', 'Text', 'نص', 'Plain text currency symbol.', 'رمز عملة نصي عادي.', 1),
('UNICODE', 'Unicode', 'يونيكود', 'Unicode-based currency symbol.', 'رمز عملة مبني على معيار يونيكود.', 2),
('SVG', 'SVG', 'SVG', 'Vector symbol used for reliable rendering.', 'رمز متجهي لضمان العرض الصحيح.', 3),
('FONT_GLYPH', 'Font Glyph', 'رمز خط', 'Symbol rendered using a specific font glyph.', 'رمز يتم عرضه باستخدام خط محدد.', 4),
('IMAGE', 'Image', 'صورة', 'Image-based symbol fallback.', 'رمز عملة على شكل صورة.', 5)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

INSERT INTO public.sys_currency_symbol_rendering_mode_cd (code, name, name2, description, description2, display_order) VALUES
('AUTO', 'Automatic', 'تلقائي', 'System chooses the best rendering method.', 'يختار النظام أفضل طريقة عرض.', 1),
('TEXT', 'Text', 'نص', 'Force plain text rendering.', 'فرض العرض النصي.', 2),
('UNICODE', 'Unicode', 'يونيكود', 'Force Unicode rendering.', 'فرض العرض باستخدام يونيكود.', 3),
('SVG', 'SVG', 'SVG', 'Force SVG rendering.', 'فرض العرض باستخدام SVG.', 4),
('FONT', 'Font', 'خط', 'Force font-based rendering.', 'فرض العرض باستخدام الخط.', 5)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

INSERT INTO public.sys_currency_symbol_position_cd (code, name, name2, description, description2, display_order) VALUES
('LEFT', 'Left of Amount', 'يسار المبلغ', 'Symbol appears to the left of the amount.', 'يظهر الرمز يسار المبلغ.', 1),
('RIGHT', 'Right of Amount', 'يمين المبلغ', 'Symbol appears to the right of the amount.', 'يظهر الرمز يمين المبلغ.', 2),
('AUTO', 'Automatic', 'تلقائي', 'System determines placement.', 'يحدد النظام موضع الرمز.', 3),
('LOCALE', 'Locale Based', 'حسب اللغة والمنطقة', 'Placement follows locale rules.', 'الموضع يتبع قواعد اللغة والمنطقة.', 4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

INSERT INTO public.sys_currency_symbol_direction_cd (code, name, name2, description, description2, display_order) VALUES
('LTR', 'Left-to-right', 'من اليسار إلى اليمين', 'Render symbol left-to-right.', 'عرض الرمز من اليسار إلى اليمين.', 1),
('RTL', 'Right-to-left', 'من اليمين إلى اليسار', 'Render symbol right-to-left.', 'عرض الرمز من اليمين إلى اليسار.', 2),
('AUTO', 'Automatic', 'تلقائي', 'System determines direction.', 'يحدد النظام الاتجاه.', 3)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

INSERT INTO public.sys_currency_cash_rounding_mode_cd (code, name, name2, description, description2, display_order) VALUES
('HALF_UP', 'Half Up', 'تقريب النصف للأعلى', 'Round half values upward.', 'تقريب القيم النصفية للأعلى.', 1),
('HALF_EVEN', 'Half Even', 'تقريب النصف للزوجي', 'Banker rounding.', 'التقريب البنكي.', 2),
('UP', 'Up', 'للأعلى', 'Always round upward.', 'التقريب دائماً للأعلى.', 3),
('DOWN', 'Down', 'للأسفل', 'Always round downward.', 'التقريب دائماً للأسفل.', 4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

INSERT INTO public.sys_exchange_rate_source_cd (code, name, name2, description, description2, display_order) VALUES
('central_bank', 'Central Bank', 'البنك المركزي', 'Exchange rates from official central bank source.', 'أسعار الصرف من مصدر البنك المركزي الرسمي.', 1),
('manual', 'Manual', 'يدوي', 'Manually maintained exchange rates.', 'أسعار صرف يتم إدخالها يدوياً.', 2),
('ecb', 'European Central Bank', 'البنك المركزي الأوروبي', 'European Central Bank exchange rate source.', 'مصدر أسعار صرف البنك المركزي الأوروبي.', 3),
('open_exchange', 'Open Exchange Rates', 'Open Exchange Rates', 'External Open Exchange Rates provider.', 'مزود خارجي لأسعار الصرف.', 4),
('fixer', 'Fixer', 'Fixer', 'External Fixer exchange rate provider.', 'مزود Fixer لأسعار الصرف.', 5),
('xe', 'XE', 'XE', 'External XE exchange rate provider.', 'مزود XE لأسعار الصرف.', 6),
('custom_api', 'Custom API', 'واجهة مخصصة', 'Custom exchange rate API integration.', 'تكامل مخصص لأسعار الصرف.', 7)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order;

-- 3. Add Foreign Keys
ALTER TABLE public.sys_currency_cd
  DROP CONSTRAINT IF EXISTS fk_sys_currency_symbol_locale_strategy,
  DROP CONSTRAINT IF EXISTS fk_sys_currency_symbol_type,
  DROP CONSTRAINT IF EXISTS fk_sys_currency_symbol_rendering_mode,
  DROP CONSTRAINT IF EXISTS fk_sys_currency_symbol_position,
  DROP CONSTRAINT IF EXISTS fk_sys_currency_symbol_direction,
  DROP CONSTRAINT IF EXISTS fk_sys_currency_cash_rounding_mode,
  DROP CONSTRAINT IF EXISTS fk_sys_currency_exchange_rate_source;

ALTER TABLE public.sys_currency_cd
  ADD CONSTRAINT fk_sys_currency_symbol_locale_strategy FOREIGN KEY (symbol_locale_strategy) REFERENCES public.sys_currency_symbol_locale_strategy_cd(code),
  ADD CONSTRAINT fk_sys_currency_symbol_type FOREIGN KEY (symbol_type) REFERENCES public.sys_currency_symbol_type_cd(code),
  ADD CONSTRAINT fk_sys_currency_symbol_rendering_mode FOREIGN KEY (symbol_rendering_mode) REFERENCES public.sys_currency_symbol_rendering_mode_cd(code),
  ADD CONSTRAINT fk_sys_currency_symbol_position FOREIGN KEY (symbol_position) REFERENCES public.sys_currency_symbol_position_cd(code),
  ADD CONSTRAINT fk_sys_currency_symbol_direction FOREIGN KEY (symbol_direction) REFERENCES public.sys_currency_symbol_direction_cd(code),
  ADD CONSTRAINT fk_sys_currency_cash_rounding_mode FOREIGN KEY (cash_rounding_mode) REFERENCES public.sys_currency_cash_rounding_mode_cd(code),
  ADD CONSTRAINT fk_sys_currency_exchange_rate_source FOREIGN KEY (exchange_rate_source) REFERENCES public.sys_exchange_rate_source_cd(code);

COMMIT;
