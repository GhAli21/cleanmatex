-- =============================================================================
-- 0520_hq_currency_rounding_context_and_mode_catalog.sql
-- HQ Currency Setup handoff (docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening
-- + cleanmatexsaas/docs/features/Currency_Setup/HQ_CURRENCY_HANDOFF.md §3.2/§3.5/§6),
-- Phase 2, step 1 of 3.
--
-- 1. sys_rounding_context_cd — the 15-context catalog (handoff §3.2.3), seeded.
-- 2. sys_rounding_mode_cd — replaces sys_currency_cash_rounding_mode_cd (34
--    chars, over this repo's 30-char limit; only live referrer is
--    sys_currency_cd.cash_rounding_mode). Expanded from 4 codes (HALF_UP,
--    HALF_EVEN, UP, DOWN) to the unified 7-code vocabulary (adds HALF_DOWN,
--    CEILING, FLOOR), each row documenting its negative-amount behavior
--    (handoff §3.2.5) so refunds round consistently with charges.
-- 3. sys_currency_cd VARCHAR -> TEXT (handoff §6, folded in here since the
--    next migration's FK from sys_currency_rounding_rules_cf.currency_code
--    to sys_currency_cd(code) requires TEXT on both sides).
--
-- Verified against remote (supabase_remote_db MCP, read-only) before writing:
-- sys_currency_cash_rounding_mode_cd has exactly one live referrer
-- (sys_currency_cd.cash_rounding_mode), so the repoint-then-drop below is a
-- complete, RESTRICT-safe migration of that table's one live FK.
--
-- Reversal (forward-only; this repo forbids editing applied migrations): a
-- future migration would repoint sys_currency_cd.cash_rounding_mode back to
-- a recreated sys_currency_cash_rounding_mode_cd (4-row reseed), then
-- DROP TABLE sys_rounding_context_cd and sys_rounding_mode_cd RESTRICT, then
-- revert the VARCHAR/TEXT columns (lossless — TEXT and VARCHAR read
-- identically in Postgres, this direction is purely a type-widening no-op).
-- =============================================================================

BEGIN;

-- ── 1. Rounding-context catalog (handoff §3.2.3) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_rounding_context_cd (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT,
  CONSTRAINT chk_srcc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_rounding_context_cd IS
  'HQ-owned catalog of rounding contexts (cash tender, cash change, tax, accounting, ...). Consumed read-only by cleanmatex via sys_currency_rounding_rules_cf.rounding_context.';
COMMENT ON COLUMN public.sys_rounding_context_cd.code IS
  'Stable business key referenced by sys_currency_rounding_rules_cf.rounding_context. Immutable once in use.';
COMMENT ON COLUMN public.sys_rounding_context_cd.name IS 'Display label, English.';
COMMENT ON COLUMN public.sys_rounding_context_cd.name2 IS 'Display label, Arabic.';
COMMENT ON COLUMN public.sys_rounding_context_cd.description IS 'One-sentence explanation of when this context applies, English.';
COMMENT ON COLUMN public.sys_rounding_context_cd.description2 IS 'One-sentence explanation of when this context applies, Arabic.';
COMMENT ON COLUMN public.sys_rounding_context_cd.display_order IS 'Sort order for admin-UI dropdowns; NULL sorts last.';
COMMENT ON COLUMN public.sys_rounding_context_cd.is_active IS 'Soft-enable flag; FALSE hides the context from new-rule pickers without deleting history.';
COMMENT ON COLUMN public.sys_rounding_context_cd.rec_status IS '1=active, 0=soft-deleted, 2=archived — never hard-delete.';
COMMENT ON COLUMN public.sys_rounding_context_cd.rec_order IS 'Reserved manual-ordering column, not populated by this seed (display_order carries the seeded sort order).';
COMMENT ON COLUMN public.sys_rounding_context_cd.rec_notes IS 'Longer free-text note about this row, e.g. an internal justification for adding or retiring a context.';
COMMENT ON COLUMN public.sys_rounding_context_cd.created_at IS 'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sys_rounding_context_cd.created_by IS 'Actor (HQ user id or system) that created the row.';
COMMENT ON COLUMN public.sys_rounding_context_cd.created_info IS 'Freeform context captured at creation (e.g. request/session info).';
COMMENT ON COLUMN public.sys_rounding_context_cd.updated_at IS 'Last update timestamp (UTC); NULL if never updated.';
COMMENT ON COLUMN public.sys_rounding_context_cd.updated_by IS 'Actor (HQ user id or system) that last updated the row.';
COMMENT ON COLUMN public.sys_rounding_context_cd.updated_info IS 'Freeform context captured at the last update.';

INSERT INTO public.sys_rounding_context_cd (code, name, name2, description, description2, display_order) VALUES
  ('ACCOUNTING',     'Accounting',         'محاسبي',
   'General ledger and financial reporting precision; the fallback when no more specific context has a rule.',
   'دقة دفتر الأستاذ العام والتقارير المالية؛ الوضع الافتراضي عند عدم وجود قاعدة أكثر تحديدًا.', 1),
  ('ORDER',          'Order Total',        'إجمالي الطلب',
   'Rounding applied to an order''s grand total before it is persisted.',
   'التقريب المطبق على إجمالي الطلب قبل حفظه.', 2),
  ('INVOICE',        'Invoice',            'فاتورة',
   'Rounding applied when generating a customer invoice or receipt.',
   'التقريب المطبق عند إصدار فاتورة أو إيصال للعميل.', 3),
  ('TAX',            'Tax',                'ضريبة',
   'Rounding applied to a calculated tax/VAT amount, per the tax authority''s rules.',
   'التقريب المطبق على مبلغ الضريبة المحسوب وفق قواعد الهيئة الضريبية.', 4),
  ('DISCOUNT',       'Discount',           'خصم',
   'Rounding applied to a calculated discount amount.',
   'التقريب المطبق على مبلغ الخصم المحسوب.', 5),
  ('PAYMENT',        'Payment',            'دفعة',
   'Rounding applied to a recorded payment amount, independent of the cash-specific contexts below.',
   'التقريب المطبق على مبلغ الدفعة المسجلة، بمعزل عن سياقات النقد أدناه.', 6),
  ('CASH_TENDER',    'Cash Tender',        'الدفع النقدي',
   'What a customer can physically hand over in cash — fixed by which coins actually circulate, not a business choice.',
   'المبلغ الذي يمكن للعميل تسليمه نقدًا فعليًا — محدد بالعملات المعدنية المتداولة فعليًا، وليس خيارًا تجاريًا.', 7),
  ('CASH_CHANGE',    'Cash Change',        'الباقي النقدي',
   'What the business hands back as change; may round in a different direction than cash tender (tenant-overridable).',
   'الباقي الذي يرده المتجر للعميل؛ قد يُقرَّب باتجاه مختلف عن الدفع النقدي (قابل للتخصيص من قبل المستأجر).', 8),
  ('REFUND',         'Refund',             'استرداد',
   'Rounding applied when calculating an amount refunded back to the customer.',
   'التقريب المطبق عند حساب مبلغ مسترد للعميل.', 9),
  ('FX_CONVERSION',  'FX Conversion',      'تحويل العملة',
   'Rounding applied when converting an amount between currencies at a point-in-time rate.',
   'التقريب المطبق عند تحويل مبلغ بين عملتين بسعر صرف لحظي.', 10),
  ('FX_REVALUATION', 'FX Revaluation',     'إعادة تقييم العملة',
   'Rounding applied when periodically revaluing open foreign-currency balances.',
   'التقريب المطبق عند إعادة تقييم الأرصدة الأجنبية المفتوحة بشكل دوري.', 11),
  ('REPORTING',      'Reporting',          'تقارير',
   'Rounding applied only for display in summary reports; never affects stored or posted amounts.',
   'التقريب المطبق فقط لعرض التقارير الموجزة؛ لا يؤثر أبدًا على المبالغ المحفوظة أو المرحّلة.', 12),
  ('UNIT_PRICE',     'Unit Price',         'سعر الوحدة',
   'Rounding applied to a per-unit price before it is multiplied by quantity.',
   'التقريب المطبق على سعر الوحدة قبل ضربه في الكمية.', 13),
  ('LOYALTY_REDEEM', 'Loyalty Redemption', 'استبدال الولاء',
   'Rounding applied when converting loyalty points into a redeemable monetary value.',
   'التقريب المطبق عند تحويل نقاط الولاء إلى قيمة نقدية قابلة للاسترداد.', 14),
  ('PAYOUT',         'Payout',             'صرف',
   'Rounding applied to an outbound payout amount, e.g. a vendor or partner settlement.',
   'التقريب المطبق على مبلغ صرف صادر، مثل تسوية مع مورد أو شريك.', 15)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order;

-- ── 2. Unified rounding-mode catalog ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_rounding_mode_cd (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT,
  CONSTRAINT chk_srmc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_rounding_mode_cd IS
  'Unified 7-mode rounding vocabulary, replacing sys_currency_cash_rounding_mode_cd (34 chars, over the 30-char repo limit) and the separate rules-table CHECK vocabulary. Each description states negative-amount behavior explicitly (handoff §3.2.5) so refunds round consistently with charges.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.code IS
  'Stable business key referenced by sys_currency_rounding_rules_cf.rounding_mode and sys_currency_cd.cash_rounding_mode. Immutable once in use.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.name IS 'Display label, English.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.name2 IS 'Display label, Arabic.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.description IS 'Exact rounding behavior including the negative-amount case, English — see §3.2.5.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.description2 IS 'Exact rounding behavior including the negative-amount case, Arabic.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.display_order IS 'Sort order for admin-UI dropdowns; NULL sorts last.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.is_active IS 'Soft-enable flag; FALSE hides the mode from new-rule pickers without deleting history.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.rec_status IS '1=active, 0=soft-deleted, 2=archived — never hard-delete.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.rec_order IS 'Reserved manual-ordering column, not populated by this seed (display_order carries the seeded sort order).';
COMMENT ON COLUMN public.sys_rounding_mode_cd.rec_notes IS 'Longer free-text note about this row, e.g. an internal justification for adding or retiring a mode.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.created_at IS 'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sys_rounding_mode_cd.created_by IS 'Actor (HQ user id or system) that created the row.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.created_info IS 'Freeform context captured at creation (e.g. request/session info).';
COMMENT ON COLUMN public.sys_rounding_mode_cd.updated_at IS 'Last update timestamp (UTC); NULL if never updated.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.updated_by IS 'Actor (HQ user id or system) that last updated the row.';
COMMENT ON COLUMN public.sys_rounding_mode_cd.updated_info IS 'Freeform context captured at the last update.';

INSERT INTO public.sys_rounding_mode_cd (code, name, name2, description, description2, display_order) VALUES
  ('HALF_UP',   'Half Up',   'لأعلى عند التعادل',  'Ties round away from zero.',                                  'التعادل يُقرَّب بعيدًا عن الصفر.',                 1),
  ('HALF_DOWN', 'Half Down', 'لأسفل عند التعادل',  'Ties round toward zero.',                                     'التعادل يُقرَّب نحو الصفر.',                      2),
  ('HALF_EVEN', 'Half Even', 'للزوجي عند التعادل', 'Ties round to the nearest even digit (banker''s rounding).',  'التعادل يُقرَّب إلى أقرب رقم زوجي (تقريب بنكي).', 3),
  ('UP',        'Up',        'لأعلى',              'Always rounds away from zero, for both positive and negative amounts.', 'يُقرَّب دائمًا بعيدًا عن الصفر، للقيم الموجبة والسالبة.', 4),
  ('DOWN',      'Down',      'لأسفل',              'Always rounds toward zero (truncates), for both positive and negative amounts.', 'يُقرَّب دائمًا نحو الصفر (اقتطاع)، للقيم الموجبة والسالبة.', 5),
  ('CEILING',   'Ceiling',   'السقف',              'Always rounds toward positive infinity, regardless of sign.', 'يُقرَّب دائمًا نحو اللانهاية الموجبة، بغض النظر عن الإشارة.', 6),
  ('FLOOR',     'Floor',     'الأرضية',            'Always rounds toward negative infinity, regardless of sign.', 'يُقرَّب دائمًا نحو اللانهاية السالبة، بغض النظر عن الإشارة.', 7)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order;

-- ── 3. Repoint sys_currency_cd.cash_rounding_mode, then drop the old table ──

ALTER TABLE public.sys_currency_cd
  DROP CONSTRAINT IF EXISTS fk_sys_currency_cash_rounding_mode;

-- Every live value is already 'HALF_UP' (confirmed via remote read-only
-- query before writing this migration) or NULL, and 'HALF_UP' exists in the
-- new catalog unchanged, so no data conversion is needed here.
ALTER TABLE public.sys_currency_cd
  ADD CONSTRAINT fk_sys_currency_cash_rounding_mode
    FOREIGN KEY (cash_rounding_mode) REFERENCES public.sys_rounding_mode_cd(code);

DROP TABLE public.sys_currency_cash_rounding_mode_cd RESTRICT;

-- ── 4. VARCHAR -> TEXT on sys_currency_cd (handoff §6) ───────────────────────
-- Lossless widening; TEXT and VARCHAR(n) are stored identically in Postgres.

ALTER TABLE public.sys_currency_cd
  ALTER COLUMN code                        TYPE TEXT,
  ALTER COLUMN name                        TYPE TEXT,
  ALTER COLUMN name2                       TYPE TEXT,
  ALTER COLUMN icon                        TYPE TEXT,
  ALTER COLUMN color                       TYPE TEXT,
  ALTER COLUMN symbol                      TYPE TEXT,
  ALTER COLUMN symbol_position             TYPE TEXT,
  ALTER COLUMN group_separator             TYPE TEXT,
  ALTER COLUMN decimal_separator           TYPE TEXT,
  ALTER COLUMN iso_alpha_code              TYPE TEXT,
  ALTER COLUMN name_plural                 TYPE TEXT,
  ALTER COLUMN name_plural2                TYPE TEXT,
  ALTER COLUMN native_symbol               TYPE TEXT,
  ALTER COLUMN native_symbol2              TYPE TEXT,
  ALTER COLUMN narrow_symbol               TYPE TEXT,
  ALTER COLUMN narrow_symbol2              TYPE TEXT,
  ALTER COLUMN minor_unit_name             TYPE TEXT,
  ALTER COLUMN minor_unit_name2            TYPE TEXT,
  ALTER COLUMN minor_unit_name_plural      TYPE TEXT,
  ALTER COLUMN minor_unit_name_plural2     TYPE TEXT,
  ALTER COLUMN format_locale               TYPE TEXT,
  ALTER COLUMN cash_rounding_mode          TYPE TEXT,
  ALTER COLUMN country_code                TYPE TEXT,
  ALTER COLUMN region_code                 TYPE TEXT,
  ALTER COLUMN symbol2                     TYPE TEXT,
  ALTER COLUMN fallback_symbol             TYPE TEXT,
  ALTER COLUMN fallback_symbol2            TYPE TEXT,
  ALTER COLUMN official_symbol             TYPE TEXT,
  ALTER COLUMN official_symbol2            TYPE TEXT,
  ALTER COLUMN official_symbol_source      TYPE TEXT,
  ALTER COLUMN thermal_printer_fallback    TYPE TEXT,
  ALTER COLUMN thermal_printer_fallback2   TYPE TEXT,
  ALTER COLUMN pdf_fallback_symbol         TYPE TEXT,
  ALTER COLUMN pdf_fallback_symbol2        TYPE TEXT,
  ALTER COLUMN mobile_fallback_symbol      TYPE TEXT,
  ALTER COLUMN mobile_fallback_symbol2     TYPE TEXT,
  ALTER COLUMN web_fallback_symbol         TYPE TEXT,
  ALTER COLUMN web_fallback_symbol2        TYPE TEXT,
  ALTER COLUMN symbol_locale_strategy      TYPE TEXT,
  ALTER COLUMN symbol_type                 TYPE TEXT,
  ALTER COLUMN symbol_rendering_mode       TYPE TEXT,
  ALTER COLUMN symbol_direction            TYPE TEXT,
  ALTER COLUMN unicode_codepoint           TYPE TEXT,
  ALTER COLUMN font_family                 TYPE TEXT,
  ALTER COLUMN format_pattern              TYPE TEXT,
  ALTER COLUMN exchange_rate_source        TYPE TEXT;

COMMIT;
