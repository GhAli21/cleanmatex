-- =============================================================================
-- Migration: 0775_sys_tenant_extra_config_cf.sql
-- Purpose:   Global catalog of preferred Organization extra UI/formatting/ergonomic
--            settings and curated option lists (UI Design System PR-08 Task 6).
--            Powers list-assisted Tenant Settings UI and strict server allowlist
--            validation. Defaults are GCC-first (Western digits 'LATN' 123 in
--            both EN and AR locales unless an Organization opts into 'ARAB').
-- Affected:  public.sys_tenant_extra_config_cf (new table + 8 seeded defaults).
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-08.md (Task 6.1).
-- Access:    Closed to anon and authenticated; read by Next.js / HQ backend
--            via catalogReadClient (service role) after RBAC checks.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Global catalog of extra tenant UI, formatting, and POS ergonomic settings.
CREATE TABLE IF NOT EXISTS public.sys_tenant_extra_config_cf (
  config_key             TEXT        NOT NULL,
  category_code          TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  value_type             TEXT        NOT NULL,
  default_value          TEXT        NOT NULL,
  allowed_values_json    JSONB       NULL,
  validation_regex       TEXT        NULL,
  min_num                NUMERIC     NULL,
  max_num                NUMERIC     NULL,
  is_editable_by_tenant  BOOLEAN     NOT NULL DEFAULT true,
  plan_flag_key          TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_tnt_extra_cfg_cf PRIMARY KEY (config_key),
  CONSTRAINT ck_stec_key CHECK (config_key ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_stec_cat CHECK (category_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_stec_vtype CHECK (value_type IN ('SELECT', 'BOOLEAN', 'NUMBER', 'TEXT')),
  CONSTRAINT ck_stec_allowed_arr CHECK (
    allowed_values_json IS NULL OR jsonb_typeof(allowed_values_json) = 'array'
  ),
  CONSTRAINT ck_stec_bounds CHECK (
    min_num IS NULL OR max_num IS NULL OR min_num <= max_num
  ),
  CONSTRAINT ck_stec_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- Supports grouped catalog queries for settings screens and HQ pickers.
CREATE INDEX IF NOT EXISTS idx_stec_cat_order
  ON public.sys_tenant_extra_config_cf (category_code, rec_order, config_key)
  WHERE rec_status = 1 AND is_active;

-- Complete PostgreSQL metadata comments.
COMMENT ON TABLE  public.sys_tenant_extra_config_cf IS 'Global catalog of extra Organization UI/formatting/ergonomic defaults and curated option lists. Managed by HQ; read server-side via service role.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.config_key IS 'Stable UPPER_SNAKE_CASE configuration key (primary key).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.category_code IS 'Logical settings group code (NUMBERS_AND_DATES, TABLES_AND_DENSITY, POS_ERGONOMICS, ACCESSIBILITY).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.name IS 'English setting label shown in UI.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.name2 IS 'Arabic setting label shown in UI.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.description IS 'English helper explanation shown under the control.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.description2 IS 'Arabic helper explanation shown under the control.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.value_type IS 'Input control & validation kind: SELECT, BOOLEAN, NUMBER, or TEXT.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.default_value IS 'Platform preferred default serialized as TEXT (e.g. LATN, TRUE, 10).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.allowed_values_json IS 'JSON array of {value, label, label2, description?, description2?} options driving list-assisted UI and backend allowlist validation.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.validation_regex IS 'Optional regex validated on TEXT entries.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.min_num IS 'Optional inclusive lower bound validated on NUMBER entries.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.max_num IS 'Optional inclusive upper bound validated on NUMBER entries.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.is_editable_by_tenant IS 'When false, tenant admins can inspect the default but cannot override it.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.plan_flag_key IS 'Optional HQ feature/plan flag key gating tenant override access.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.created_info IS 'Creation context (migration, HQ action, script).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.updated_at IS 'When the row was last updated (maintained by trigger).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.updated_count IS 'Monotonic update counter (incremented by trigger).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.rec_status IS 'Record status: 1 active, 0 soft-deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.rec_order IS 'Display sort order within category (lower first).';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.rec_notes IS 'Internal notes about the catalog setting.';
COMMENT ON COLUMN public.sys_tenant_extra_config_cf.is_active IS 'False hides the setting from active resolution and tenant settings UI.';
COMMENT ON CONSTRAINT pk_sys_tnt_extra_cfg_cf ON public.sys_tenant_extra_config_cf IS 'Primary key on UPPER_SNAKE_CASE config_key.';
COMMENT ON CONSTRAINT ck_stec_key ON public.sys_tenant_extra_config_cf IS 'Enforces UPPER_SNAKE_CASE key format mirrored in TS constants.';
COMMENT ON CONSTRAINT ck_stec_cat ON public.sys_tenant_extra_config_cf IS 'Enforces UPPER_SNAKE_CASE category_code format.';
COMMENT ON CONSTRAINT ck_stec_vtype ON public.sys_tenant_extra_config_cf IS 'Restricts value_type to SELECT, BOOLEAN, NUMBER, TEXT.';
COMMENT ON CONSTRAINT ck_stec_allowed_arr ON public.sys_tenant_extra_config_cf IS 'Ensures allowed_values_json is a JSON array when present.';
COMMENT ON CONSTRAINT ck_stec_bounds ON public.sys_tenant_extra_config_cf IS 'Prevents inverted min_num > max_num ranges.';
COMMENT ON CONSTRAINT ck_stec_rec_status ON public.sys_tenant_extra_config_cf IS 'Standard CleanMateX rec_status values (0, 1, 2).';
COMMENT ON INDEX public.idx_stec_cat_order IS 'Covers ordered category reads for active catalog rows.';

-- Public-key grants & audit trigger.
-- Closed to anon and authenticated per integration & security policy; app reads
-- server-side via catalogReadClient (service_role).
ALTER TABLE public.sys_tenant_extra_config_cf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_tenant_extra_config_cf FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sys_tenant_extra_config_cf TO service_role;

DROP TRIGGER IF EXISTS trg_audit_touch ON public.sys_tenant_extra_config_cf;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.sys_tenant_extra_config_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.sys_tenant_extra_config_cf IS 'Keeps updated_at and updated_count current.';

-- ─── Preferred GCC-first default seeds ────────────────────────────────────────

INSERT INTO public.sys_tenant_extra_config_cf (
  config_key, category_code, name, name2, description, description2,
  value_type, default_value, allowed_values_json, is_editable_by_tenant,
  plan_flag_key, rec_order, created_by, created_info
) VALUES
(
  'NUMBER_SCRIPT',
  'NUMBERS_AND_DATES',
  'Currency & Number Digits',
  'أرقام العملة والمبالغ',
  'Controls numeral script for money amounts, KPI counts, and table numbers across English and Arabic views. GCC standard uses Western 123 digits in both languages.',
  'يتحكم في شكل الأرقام للمبالغ المالية والمؤشرات والجداول في الواجهتين العربية والإنجليزية. المعيار الخليجي يستخدم الأرقام 123 في اللغتين.',
  'SELECT',
  'LATN',
  '[
    {
      "value": "LATN",
      "label": "1234567890 (Western / GCC Standard)",
      "label2": "1234567890 (الأرقام اللاتينية — المعيار الخليجي)",
      "description": "Consistent with GCC POS receipts, banks, SKUs, and invoices.",
      "description2": "متوافق مع إيصالات نقاط البيع والبنوك ورموز الطلبات في الخليج."
    },
    {
      "value": "ARAB",
      "label": "١٢٣٤٥٦٧٨٩٠ (Eastern Arabic)",
      "label2": "١٢٣٤٥٦٧٨٩٠ (الأرقام الهندية / العربية المشرقية)",
      "description": "Renders Eastern Arabic numerals in Arabic interface.",
      "description2": "يعرض الأرقام المشرقية في الواجهة العربية فقط."
    }
  ]'::jsonb,
  true,
  NULL,
  10,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'DATE_DIGITS',
  'NUMBERS_AND_DATES',
  'Date & Time Digits',
  'أرقام التواريخ والأوقات',
  'Controls whether calendar dates, timestamps, and cut-off times render Western 123 digits or Arabic digits.',
  'يحدد ما إذا كانت التواريخ والأوقات وأوقات الاستلام تُعرض بالأرقام 123 أو الأرقام المشرقية.',
  'SELECT',
  'LATN',
  '[
    {
      "value": "LATN",
      "label": "Latin Digits (e.g. 19 Nov 2026, 14:30)",
      "label2": "الأرقام اللاتينية (مثل 19 نوفمبر 2026، 14:30)",
      "description": "Recommended default for fast counter scanning.",
      "description2": "الافتراضي الموصى به لسرعة القراءة عند الكاونتر."
    },
    {
      "value": "ARAB",
      "label": "Arabic Digits (e.g. ١٩ نوفمبر ٢٠٢٦)",
      "label2": "الأرقام المشرقية (مثل ١٩ نوفمبر ٢٠٢٦)",
      "description": "Localized numeral shapes inside Arabic dates.",
      "description2": "أرقام مشرقية داخل التواريخ العربية."
    }
  ]'::jsonb,
  true,
  NULL,
  20,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'NUMBER_GROUPING_LOCALE',
  'NUMBERS_AND_DATES',
  'Decimal & Thousands Separators',
  'فواصل الآلاف والكسور العشرية',
  'Selects decimal dot and thousands comma formatting convention for monetary figures.',
  'يحدد نمط الفاصلة العشرية وفواصل الآلاف للمبالغ المالية.',
  'SELECT',
  'EN_US',
  '[
    {
      "value": "EN_US",
      "label": "1,234.500 (Dot decimal, comma grouping)",
      "label2": "1,234.500 (نقطة للكسر وفاصلة للآلاف — القياسي)",
      "description": "Standard commercial/ERP separator format across GCC.",
      "description2": "التنسيق التجاري والمحاسبي المعتمد في دول الخليج."
    },
    {
      "value": "AR_LATN",
      "label": "Locale separators with Latin digits",
      "label2": "فواصل محلية مع أرقام 123",
      "description": "Arabic locale grouping symbols combined with 123 digits.",
      "description2": "فواصل محلية عربية مع الإبقاء على الأرقام 123."
    },
    {
      "value": "AR_NATIVE",
      "label": "Locale separators & Eastern digits",
      "label2": "فواصل محلية وأرقام مشرقية",
      "description": "Traditional Arabic locale separators and Eastern digits.",
      "description2": "فواصل محلية تقليدية مع أرقام مشرقية."
    }
  ]'::jsonb,
  true,
  NULL,
  30,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'BDI_ISOLATION_ENABLED',
  'ACCESSIBILITY',
  'BiDi Code & Phone Isolation',
  'عزل اتجاه الرموز وأرقام الهواتف',
  'Wraps phone numbers, order numbers, piece codes, SKUs, and emails in <bdi dir="ltr"> so RTL punctuation never reorders identifiers.',
  'يغلّف أرقام الهواتف وأرقام الطلبات والأكواد والبريد الإلكتروني بعزل اتجاه LTR لمنع انقلاب العلامات مثل +968 في العربية.',
  'BOOLEAN',
  'TRUE',
  '[
    {
      "value": "TRUE",
      "label": "Enabled (Recommended)",
      "label2": "مفعّل (موصى به)",
      "description": "Keeps +968, ORD-1024, and SKU codes intact in RTL.",
      "description2": "يحافظ على ترتيب +968 وأكواد الطلبات بشكل سليم."
    },
    {
      "value": "FALSE",
      "label": "Disabled",
      "label2": "معطّل",
      "description": "Uses plain surrounding flow direction.",
      "description2": "يستخدم اتجاه النص المحيط دون عزل إضافي."
    }
  ]'::jsonb,
  true,
  NULL,
  10,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'DEFAULT_TABLE_PAGE_SIZE',
  'TABLES_AND_DENSITY',
  'Default Table Rows Per Page',
  'عدد صفوف الجداول الافتراضي',
  'Default page size applied across data tables when a screen does not specify a custom override.',
  'العدد الافتراضي للصفوف في كل صفحة عبر جداول البيانات.',
  'SELECT',
  '10',
  '[
    { "value": "10",  "label": "10 rows",  "label2": "10 صفوف" },
    { "value": "20",  "label": "20 rows",  "label2": "20 صفاً" },
    { "value": "30",  "label": "30 rows",  "label2": "30 صفاً" },
    { "value": "50",  "label": "50 rows",  "label2": "50 صفاً" },
    { "value": "100", "label": "100 rows", "label2": "100 صف" }
  ]'::jsonb,
  true,
  NULL,
  10,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'TABLE_DENSITY_OVERRIDE',
  'TABLES_AND_DENSITY',
  'Organization Table Density',
  'كثافة صفوف الجداول للمنشأة',
  'Allows Organization admins to standardize row spacing or defer to each user''s Appearance setting.',
  'يسمح بتوحيد كثافة صفوف الجداول على مستوى المنشأة أو تركها لاختيار كل مستخدم.',
  'SELECT',
  'INHERIT',
  '[
    {
      "value": "INHERIT",
      "label": "Follow user / theme preference",
      "label2": "اتباع تفضيل المستخدم / المظهر",
      "description": "Respects individual user Appearance density setting.",
      "description2": "يحترم اختيار الكثافة لكل مستخدم في شاشة المظهر."
    },
    {
      "value": "COMFORTABLE",
      "label": "Comfortable (Relaxed spacing)",
      "label2": "مريح (تباعد أوسع)",
      "description": "Forces generous row padding for easier visual scanning.",
      "description2": "تباعد صفوف مريح لتسهيل القراءة."
    },
    {
      "value": "COMPACT",
      "label": "Compact (High-density ERP view)",
      "label2": "مضغوط (عرض كثيف للبيانات)",
      "description": "Fits more records on laptop and counter displays.",
      "description2": "يعرض عدد صفوف أكبر في الشاشات الصغيرة."
    }
  ]'::jsonb,
  true,
  NULL,
  20,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'SHOW_CURRENCY_CODE_IN_TABLES',
  'TABLES_AND_DENSITY',
  'Show Currency Code in Tables',
  'عرض رمز العملة داخل الجداول',
  'Controls whether monetary table columns append the currency code (e.g. OMR) next to amounts.',
  'يتحكم في إظهار رمز العملة (مثل OMR) بجانب المبالغ في جداول النظام.',
  'BOOLEAN',
  'TRUE',
  '[
    {
      "value": "TRUE",
      "label": "Show currency code (e.g. 12.500 OMR)",
      "label2": "إظهار رمز العملة (مثل 12.500 OMR)"
    },
    {
      "value": "FALSE",
      "label": "Amount only (e.g. 12.500)",
      "label2": "المبلغ فقط (مثل 12.500)"
    }
  ]'::jsonb,
  true,
  NULL,
  30,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
),
(
  'POS_STEPPER_MIN_TARGET',
  'POS_ERGONOMICS',
  'POS Counter Touch Target Mode',
  'حجم أزرار نقاط البيع والكميات',
  'Sets minimum hit area for POS quantity steppers, pagination, and quick-drop actions.',
  'يحدد الحد الأدنى لحجم أزرار زيادة/إنقاص الكمية وأزرار نقاط البيع.',
  'SELECT',
  'ADAPTIVE',
  '[
    {
      "value": "ADAPTIVE",
      "label": "Adaptive (44px touch / 32px desktop)",
      "label2": "تكيّفي (44px للمس / 32px لسطح المكتب)",
      "description": "Uses compact 32px controls with mouse and 44px on touch screens.",
      "description2": "يستخدم 32px مع الفأرة و44px على شاشات اللمس."
    },
    {
      "value": "ALWAYS_TOUCH_44",
      "label": "Always Touch-First (44px minimum)",
      "label2": "مخصص للمس دائماً (44px كحد أدنى)",
      "description": "Ideal for dedicated kiosk counters and tablets.",
      "description2": "مثالي لأجهزة الكاشير والتابلت."
    }
  ]'::jsonb,
  true,
  NULL,
  10,
  'system_seed',
  '0775_sys_tenant_extra_config_cf'
)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
