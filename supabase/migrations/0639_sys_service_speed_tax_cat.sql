-- =============================================================================
-- 0639_sys_service_speed_tax_cat.sql
-- Line-Level Money Snapshot — Phase 2, M1 (PLAN.md §12, §12.1, ADR-060 §6).
--
-- Why:
-- The commercial calculator (ADR-060) needs two global reference code tables
-- that do not exist yet:
--   1. sys_service_speed_cd — replaces the current single hardcoded "express"
--      signal with an open set of service speeds (STANDARD default, EXPRESS
--      today). org_speed_price_rules_cf (M2) will reference this table.
--   2. sys_tax_category_cd — the 4 tax-base categories a line can carry
--      (STANDARD / ZERO_RATED / EXEMPT / OUT_OF_SCOPE), bilingual, mapped to
--      the UNCL5305 duty/tax/fee category code used by e-invoicing (ADR-060
--      §6). org_product_data_mst.tax_category_code (M4) will reference it.
--
-- Both are global sys_* lookups: no tenant_org_id, no RLS (CLAUDE.md: RLS
-- applies to org_* tables; sys_* reference data is shared and public-read).
--
-- Seeds (L17, PLAN §12.1): STANDARD (default) + EXPRESS for speed; the 4
-- categories for tax. These reproduce today's behaviour exactly — EXPRESS is
-- the only speed value in use today, and every product is STANDARD tax
-- category today (PF-04/PF-05 fix lands later in M4 with real exemptions).
--
-- DO NOT APPLY automatically — review then run via the normal DB process.
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. sys_service_speed_cd — service speed codes (STANDARD, EXPRESS, ...)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_service_speed_cd (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  description2    TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  rec_status      SMALLINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE sys_service_speed_cd IS
  'Line-Level Money Snapshot (ADR-060): the service speed a line is priced at. Replaces the single hardcoded "express" signal. org_speed_price_rules_cf (M2) references this code.';
COMMENT ON COLUMN sys_service_speed_cd.code IS 'Stable speed code, e.g. STANDARD, EXPRESS. Referenced by org_order_items_dtl.service_speed (M5) and org_speed_price_rules_cf.service_speed (M2).';
COMMENT ON COLUMN sys_service_speed_cd.name IS 'English display name.';
COMMENT ON COLUMN sys_service_speed_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN sys_service_speed_cd.description IS 'English description for admin UI help text.';
COMMENT ON COLUMN sys_service_speed_cd.description2 IS 'Arabic description for admin UI help text.';
COMMENT ON COLUMN sys_service_speed_cd.display_order IS 'Sort order in pickers.';
COMMENT ON COLUMN sys_service_speed_cd.is_default IS 'Exactly one row should be the default speed assigned when an order line specifies none. Enforced by the partial unique index below, not a CHECK, so it stays enforceable across concurrent updates.';
COMMENT ON COLUMN sys_service_speed_cd.is_active IS 'Soft-disable: hidden from new pickers, existing references unaffected.';
COMMENT ON COLUMN sys_service_speed_cd.rec_status IS 'Standard soft-delete status (1 = active record).';

-- Exactly one default speed at a time (today STANDARD).
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_speed_one_default
  ON sys_service_speed_cd ((is_default))
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_service_speed_active
  ON sys_service_speed_cd (is_active, display_order);

INSERT INTO sys_service_speed_cd (
  code, name, name2, description, description2,
  display_order, is_default, is_active, rec_status
) VALUES
  ('STANDARD', 'Standard', 'عادي', 'Normal turnaround at the standard price', 'مدة تسليم عادية بالسعر العادي', 1, true, true, 1),
  ('EXPRESS', 'Express', 'سريع', 'Faster turnaround, priced per org_speed_price_rules_cf', 'مدة تسليم أسرع، بالسعر المحدد في جدول أسعار السرعة', 2, false, true, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 2. sys_tax_category_cd — the 4 tax-base categories (ADR-060 §6)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_tax_category_cd (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  description2    TEXT,
  uncl5305_code   TEXT NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  rec_status      SMALLINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE sys_tax_category_cd IS
  'Line-Level Money Snapshot (ADR-060 §6): the 4 tax-base categories a line can carry. Mapped to the UNCL5305 duty/tax/fee category code used by GCC e-invoicing. org_product_data_mst.tax_category_code (M4) references this code.';
COMMENT ON COLUMN sys_tax_category_cd.code IS 'Stable category code: STANDARD, ZERO_RATED, EXEMPT, OUT_OF_SCOPE.';
COMMENT ON COLUMN sys_tax_category_cd.name IS 'English display name.';
COMMENT ON COLUMN sys_tax_category_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN sys_tax_category_cd.description IS 'English description for admin UI help text.';
COMMENT ON COLUMN sys_tax_category_cd.description2 IS 'Arabic description for admin UI help text.';
COMMENT ON COLUMN sys_tax_category_cd.uncl5305_code IS 'UNCL5305 duty/tax/fee category code used on fiscal documents: S (standard), Z (zero rated), E (exempt), O (out of scope / not subject to tax).';
COMMENT ON COLUMN sys_tax_category_cd.display_order IS 'Sort order in pickers.';
COMMENT ON COLUMN sys_tax_category_cd.is_default IS 'Exactly one row should be the default category assigned when a product specifies none (today STANDARD, since no product is exempt). Enforced by the partial unique index below.';
COMMENT ON COLUMN sys_tax_category_cd.is_active IS 'Soft-disable: hidden from new pickers, existing references unaffected.';
COMMENT ON COLUMN sys_tax_category_cd.rec_status IS 'Standard soft-delete status (1 = active record).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_category_one_default
  ON sys_tax_category_cd ((is_default))
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_tax_category_active
  ON sys_tax_category_cd (is_active, display_order);

INSERT INTO sys_tax_category_cd (
  code, name, name2, description, description2,
  uncl5305_code, display_order, is_default, is_active, rec_status
) VALUES
  ('STANDARD', 'Standard rated', 'خاضع للضريبة بالمعدل العادي', 'Taxed at the tenant''s standard VAT rate', 'يُفرض عليه معدل ضريبة القيمة المضافة العادي للمنشأة', 'S', 1, true, true, 1),
  ('ZERO_RATED', 'Zero rated', 'نسبة صفرية', 'Taxable supply at 0% (reported, not exempt)', 'توريد خاضع للضريبة بمعدل 0% (يُقيّد ولا يُعد معفى)', 'Z', 2, false, true, 1),
  ('EXEMPT', 'Exempt', 'معفى', 'Not subject to VAT by law or customer exemption', 'غير خاضع لضريبة القيمة المضافة بحكم القانون أو إعفاء العميل', 'E', 3, false, true, 1),
  ('OUT_OF_SCOPE', 'Out of scope', 'خارج نطاق الضريبة', 'Outside the scope of VAT entirely', 'خارج نطاق ضريبة القيمة المضافة كليًا', 'O', 4, false, true, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  uncl5305_code = EXCLUDED.uncl5305_code,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
