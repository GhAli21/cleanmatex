-- =============================================================================
-- Migration 0279: System Financial Lookup Tables
-- Creates all sys_* code tables required by the financial platform.
-- No RLS — these are global read-only reference tables with no tenant_org_id.
-- No Prisma models needed — consumed via DB CHECK constraints and TS constants.
-- =============================================================================

BEGIN;

-- ── sys_payment_nature_cd ─────────────────────────────────────────────────────
-- Mirrors check constraint values in sys_payment_method_cd.payment_nature
-- and org_payment_methods_cf.payment_nature.
CREATE TABLE IF NOT EXISTS public.sys_payment_nature_cd (
  payment_nature  TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT,
  updated_info    TEXT
);

INSERT INTO public.sys_payment_nature_cd (payment_nature, name, name2, sort_order) VALUES
  ('REAL_PAYMENT',        'Real Payment',        'دفعة حقيقية',         1),
  ('CREDIT_APPLICATION',  'Credit Application',  'تطبيق رصيد',          2),
  ('DEFERRED_SETTLEMENT', 'Deferred Settlement', 'تسوية مؤجلة',         3),
  ('AR_ALLOCATION',       'AR Allocation',       'تخصيص ذمم مدينة',     4),
  ('INTERNAL_ADJUSTMENT', 'Internal Adjustment', 'تسوية داخلية',        5)
ON CONFLICT (payment_nature) DO UPDATE SET
  name       = EXCLUDED.name,
  name2      = EXCLUDED.name2,
  sort_order = EXCLUDED.sort_order;

-- ── sys_credit_app_types_cd ───────────────────────────────────────────────────
-- Credit application types used in org_order_credit_apps_dtl.credit_type
-- and org_payment_methods_cf.credit_application_type.
-- NOTE: max 30-char table name (sys_credit_application_types_cd = 36 chars)
CREATE TABLE IF NOT EXISTS public.sys_credit_app_types_cd (
  credit_app_type TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT,
  updated_info    TEXT
);

INSERT INTO public.sys_credit_app_types_cd (credit_app_type, name, name2, sort_order) VALUES
  ('GIFT_CARD',      'Gift Card',        'بطاقة هدية',  1),
  ('WALLET',         'Wallet',           'المحفظة',     2),
  ('ADVANCE',        'Customer Advance', 'مقدم من العميل', 3),
  ('CREDIT_NOTE',    'Credit Note',      'إشعار دائن',  4),
  ('LOYALTY_POINTS', 'Loyalty Points',   'نقاط الولاء', 5)
ON CONFLICT (credit_app_type) DO UPDATE SET
  name       = EXCLUDED.name,
  name2      = EXCLUDED.name2,
  sort_order = EXCLUDED.sort_order;

-- ── sys_charge_types_cd ───────────────────────────────────────────────────────
-- Mirrors check constraint in org_order_charges_dtl.charge_type.
CREATE TABLE IF NOT EXISTS public.sys_charge_types_cd (
  charge_type   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT
);

INSERT INTO public.sys_charge_types_cd (charge_type, name, name2, sort_order) VALUES
  ('PREFERENCE',       'Preference Charge', 'رسوم تفضيل',   1),
  ('EXPRESS',          'Express Charge',    'رسوم سريعة',    2),
  ('BULK_SURCHARGE',   'Bulk Surcharge',    'رسوم الكميات',  3),
  ('SPECIAL_HANDLING', 'Special Handling',  'معالجة خاصة',   4)
ON CONFLICT (charge_type) DO UPDATE SET
  name       = EXCLUDED.name,
  name2      = EXCLUDED.name2,
  sort_order = EXCLUDED.sort_order;

-- ── sys_tax_types_cd ──────────────────────────────────────────────────────────
-- Mirrors check constraint in org_order_taxes_dtl.tax_type and org_tax_profiles_cf.tax_type.
CREATE TABLE IF NOT EXISTS public.sys_tax_types_cd (
  tax_type      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT
);

INSERT INTO public.sys_tax_types_cd (tax_type, name, name2, sort_order) VALUES
  ('VAT',    'Value Added Tax', 'ضريبة القيمة المضافة',  1),
  ('GST',    'GST',             'ضريبة السلع والخدمات',  2),
  ('CUSTOM', 'Custom Tax',      'ضريبة مخصصة',           3)
ON CONFLICT (tax_type) DO UPDATE SET
  name       = EXCLUDED.name,
  name2      = EXCLUDED.name2,
  sort_order = EXCLUDED.sort_order;

-- ── sys_refund_methods_cd ─────────────────────────────────────────────────────
-- Refund destination method used in org_order_refunds_dtl.refund_method_code.
CREATE TABLE IF NOT EXISTS public.sys_refund_methods_cd (
  refund_method TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT
);

INSERT INTO public.sys_refund_methods_cd (refund_method, name, name2, sort_order) VALUES
  ('ORIGINAL_METHOD', 'Original Payment Method', 'طريقة الدفع الأصلية', 1),
  ('CASH',            'Cash Refund',             'استرداد نقدي',        2),
  ('CREDIT_NOTE',     'Credit Note',             'إشعار دائن',          3),
  ('WALLET',          'Wallet Credit',           'رصيد المحفظة',        4)
ON CONFLICT (refund_method) DO UPDATE SET
  name       = EXCLUDED.name,
  name2      = EXCLUDED.name2,
  sort_order = EXCLUDED.sort_order;

-- ── sys_refund_reason_codes_cd ────────────────────────────────────────────────
-- Refund reason codes used in org_order_refunds_dtl.reason_code.
CREATE TABLE IF NOT EXISTS public.sys_refund_reason_codes_cd (
  reason_code   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT
);

INSERT INTO public.sys_refund_reason_codes_cd (reason_code, name, name2, sort_order) VALUES
  ('DUPLICATE',  'Duplicate Charge',  'رسوم مكررة',      1),
  ('QUALITY',    'Quality Issue',     'مشكلة جودة',      2),
  ('CANCELLED',  'Order Cancelled',   'تم إلغاء الطلب',  3),
  ('OVERCHARGE', 'Overcharge',        'فرض رسوم زائدة',  4),
  ('OTHER',      'Other',             'أخرى',            5)
ON CONFLICT (reason_code) DO UPDATE SET
  name       = EXCLUDED.name,
  name2      = EXCLUDED.name2,
  sort_order = EXCLUDED.sort_order;

-- NOTE: sys_settlement_type_codes_cd is NOT created here.
-- sys_payment_type_cd already exists (migration 0001, seeded in 0030).
-- Its PK is payment_type_code and contains: PAY_IN_ADVANCE, PAY_ON_COLLECTION,
-- PAY_ON_DELIVERY, CREDIT_INVOICE. SETTLEMENT_TYPE_CODES constants map to these values.

COMMIT;
