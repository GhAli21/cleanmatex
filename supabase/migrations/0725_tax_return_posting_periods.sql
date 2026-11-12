-- =============================================================================
-- 0725_tax_return_posting_periods.sql
-- Tax Engine T7 (M7) — return boxes, tax ledger postings, period permission
-- Plan: docs/features/Tax_Config/TAX_ENGINE_PLAN.md (T7, M7) · facts: KIT_FACTS.md §3
--
-- 1. sys_tax_return_box_cd + sys_tax_return_box_map_dtl: the VAT return layout of
--    each tax kit and how final tax lines (org_tax_lines_tr) add up into each box.
--    Seeded for AE, SA, BH, OM and the generic VAT kit. Categories are reliable;
--    exact box numbering is unverified (is_verified = false) until HQ checks the
--    authority's current form (KIT_FACTS §5).
-- 2. ERP-Lite: four events that move tax recorded on prepayments (advances,
--    single-purpose gift cards) between the liability account and Output VAT,
--    and back when it is netted on the invoice. Expense posting gains an Input
--    VAT debit line; the app sends a zero recoverable amount when no tax lines
--    exist, so expenses without the tax engine post exactly as before.
-- 3. Permission tax:manage_periods (open / close / reopen tax periods).
-- 4. Navigation: Reports → VAT Return (/dashboard/reports/tax-return).
--
-- Additive only: new tables, new reference rows, one new rule line.
-- =============================================================================

BEGIN;

-- ─── 1. Return boxes ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_tax_return_box_cd (
  kit_code       TEXT        NOT NULL,
  box_code       TEXT        NOT NULL,
  section_code   TEXT        NOT NULL,
  box_kind       TEXT        NOT NULL,
  shows_amount   BOOLEAN     NOT NULL,
  shows_tax      BOOLEAN     NOT NULL,
  name           TEXT        NOT NULL,
  name2          TEXT        NULL,
  description    TEXT        NULL,
  description2   TEXT        NULL,
  display_order  INTEGER     NOT NULL,
  is_verified    BOOLEAN     NOT NULL DEFAULT false,
  source_url     TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT        NULL,
  created_info   TEXT        NULL,
  updated_at     TIMESTAMPTZ NULL,
  updated_by     TEXT        NULL,
  updated_info   TEXT        NULL,
  updated_count  INTEGER     NOT NULL DEFAULT 0,
  deleted_at     TIMESTAMPTZ NULL,
  deleted_by     TEXT        NULL,
  deleted_info   TEXT        NULL,
  rec_status     SMALLINT    NOT NULL DEFAULT 1,
  rec_order      INTEGER     NULL,
  rec_notes      TEXT        NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_tax_return_box PRIMARY KEY (kit_code, box_code),
  CONSTRAINT fk_strb_kit FOREIGN KEY (kit_code) REFERENCES public.sys_tax_kits_mst (kit_code) ON DELETE RESTRICT,
  CONSTRAINT ck_strb_section CHECK (section_code IN ('SALES', 'PURCHASES', 'NET')),
  CONSTRAINT ck_strb_kind CHECK (box_kind IN ('LINES', 'TOTAL', 'MANUAL')),
  CONSTRAINT ck_strb_shows CHECK (shows_amount OR shows_tax),
  CONSTRAINT ck_strb_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_tax_return_box_cd IS 'VAT return layout per tax kit: one row per box on the authority''s return form. Values come from final tax lines (LINES), other boxes (TOTAL) or are entered on the authority portal (MANUAL, shown empty).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.kit_code IS 'Tax kit whose return this box belongs to (the organization''s active kit picks the layout).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.box_code IS 'Box number as printed on the form (e.g. 1a, 9, S1).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.section_code IS 'Form section: SALES, PURCHASES or NET (result boxes).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.box_kind IS 'LINES = sum of matching tax lines; TOTAL = signed sum of other boxes (may also add lines); MANUAL = not derivable from the books, entered on the portal.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.shows_amount IS 'True when the form asks for the amount (taxable value) in this box.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.shows_tax IS 'True when the form asks for the tax in this box.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.name IS 'English box label.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.name2 IS 'Arabic box label.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.description IS 'English note on what goes in the box.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.description2 IS 'Arabic note on what goes in the box.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.display_order IS 'Order on the report, as on the form.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.is_verified IS 'True once HQ checked the box against the authority''s current form; false boxes show a "to confirm" note.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.source_url IS 'Where the layout was taken from.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_tax_return_box_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_tax_return_box_cd.is_active IS 'False = box hidden from the report.';
COMMENT ON CONSTRAINT fk_strb_kit ON public.sys_tax_return_box_cd IS 'Box belongs to an existing kit.';
COMMENT ON CONSTRAINT ck_strb_section ON public.sys_tax_return_box_cd IS 'Known form sections only.';
COMMENT ON CONSTRAINT ck_strb_kind ON public.sys_tax_return_box_cd IS 'Known box kinds only.';
COMMENT ON CONSTRAINT ck_strb_shows ON public.sys_tax_return_box_cd IS 'A box shows an amount, a tax, or both.';
COMMENT ON CONSTRAINT ck_strb_rec_status ON public.sys_tax_return_box_cd IS 'Standard record status values.';

CREATE TABLE IF NOT EXISTS public.sys_tax_return_box_map_dtl (
  kit_code          TEXT        NOT NULL,
  box_code          TEXT        NOT NULL,
  map_no            SMALLINT    NOT NULL,
  source_kind       TEXT        NOT NULL,
  tax_flow_code     TEXT        NULL,
  tax_category_code TEXT        NULL,
  is_reverse_charge BOOLEAN     NULL,
  emirate_code      TEXT        NULL,
  tax_measure       TEXT        NULL,
  source_box_code   TEXT        NULL,
  sign              SMALLINT    NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT        NULL,
  created_info      TEXT        NULL,
  updated_at        TIMESTAMPTZ NULL,
  updated_by        TEXT        NULL,
  updated_info      TEXT        NULL,
  updated_count     INTEGER     NOT NULL DEFAULT 0,
  deleted_at        TIMESTAMPTZ NULL,
  deleted_by        TEXT        NULL,
  deleted_info      TEXT        NULL,
  rec_status        SMALLINT    NOT NULL DEFAULT 1,
  rec_order         INTEGER     NULL,
  rec_notes         TEXT        NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_tax_return_box_map PRIMARY KEY (kit_code, box_code, map_no),
  CONSTRAINT fk_strbm_box FOREIGN KEY (kit_code, box_code) REFERENCES public.sys_tax_return_box_cd (kit_code, box_code) ON DELETE RESTRICT,
  CONSTRAINT fk_strbm_src_box FOREIGN KEY (kit_code, source_box_code) REFERENCES public.sys_tax_return_box_cd (kit_code, box_code) ON DELETE RESTRICT,
  CONSTRAINT fk_strbm_category FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd (code) ON DELETE RESTRICT,
  CONSTRAINT ck_strbm_kind CHECK (
    (source_kind = 'LINES' AND tax_flow_code IS NOT NULL AND tax_measure IS NOT NULL AND source_box_code IS NULL)
    OR (source_kind = 'BOX' AND source_box_code IS NOT NULL AND tax_flow_code IS NULL AND tax_category_code IS NULL
        AND is_reverse_charge IS NULL AND emirate_code IS NULL AND tax_measure IS NULL)),
  CONSTRAINT ck_strbm_flow CHECK (tax_flow_code IS NULL OR tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING')),
  CONSTRAINT ck_strbm_measure CHECK (tax_measure IS NULL OR tax_measure IN ('TAX', 'RECOVERABLE')),
  CONSTRAINT ck_strbm_emirate CHECK (emirate_code IS NULL OR emirate_code IN ('AZ', 'DU', 'SH', 'AJ', 'UQ', 'RK', 'FU')),
  CONSTRAINT ck_strbm_sign CHECK (sign IN (1, -1)),
  CONSTRAINT ck_strbm_not_self CHECK (source_box_code IS NULL OR source_box_code <> box_code),
  CONSTRAINT ck_strbm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_tax_return_box_map_dtl IS 'What adds up into a return box: either final tax lines matching the filters (LINES) or another box (BOX), each with a sign. A line may feed several boxes (e.g. reverse charge: tax due and tax recoverable).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.kit_code IS 'Kit of the target box.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.box_code IS 'Target box.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.map_no IS 'Position of this source within the box.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.source_kind IS 'LINES = final tax lines matching the filters below; BOX = the value of source_box_code.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.tax_flow_code IS 'LINES: tax line flow to include (OUTPUT, INPUT, WITHHOLDING).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.tax_category_code IS 'LINES: tax category to include; NULL = any category.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.is_reverse_charge IS 'LINES: true = only reverse-charge codes, false = only other codes, NULL = both (flag read from the line''s tax code version).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.emirate_code IS 'LINES: UAE emirate of the line''s branch (AE return boxes 1a–1g); NULL = any branch.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.tax_measure IS 'LINES: which tax figure fills the box tax column — TAX (tax charged / due) or RECOVERABLE (input tax that can be reclaimed).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.source_box_code IS 'BOX: box whose amount and tax are added.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.sign IS '+1 adds, -1 subtracts.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_tax_return_box_map_dtl.is_active IS 'False = source ignored.';
COMMENT ON CONSTRAINT fk_strbm_box ON public.sys_tax_return_box_map_dtl IS 'Target box exists in the kit.';
COMMENT ON CONSTRAINT fk_strbm_src_box ON public.sys_tax_return_box_map_dtl IS 'Source box exists in the same kit.';
COMMENT ON CONSTRAINT fk_strbm_category ON public.sys_tax_return_box_map_dtl IS 'Category filter is a known tax category.';
COMMENT ON CONSTRAINT ck_strbm_kind ON public.sys_tax_return_box_map_dtl IS 'LINES rows carry line filters and a measure; BOX rows carry only the source box.';
COMMENT ON CONSTRAINT ck_strbm_flow ON public.sys_tax_return_box_map_dtl IS 'Known tax flows only.';
COMMENT ON CONSTRAINT ck_strbm_measure ON public.sys_tax_return_box_map_dtl IS 'Known measures only.';
COMMENT ON CONSTRAINT ck_strbm_emirate ON public.sys_tax_return_box_map_dtl IS 'Same seven emirate codes as org_branches_mst.emirate_code.';
COMMENT ON CONSTRAINT ck_strbm_sign ON public.sys_tax_return_box_map_dtl IS 'Sign is +1 or -1.';
COMMENT ON CONSTRAINT ck_strbm_not_self ON public.sys_tax_return_box_map_dtl IS 'A box cannot add itself.';
COMMENT ON CONSTRAINT ck_strbm_rec_status ON public.sys_tax_return_box_map_dtl IS 'Standard record status values.';

DO $$
DECLARE
  t TEXT;
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tax_return_box_cd', 'sys_tax_return_box_map_dtl'] LOOP
    p := 'pol_' || t || '_rd';
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', p, t);
    EXECUTE format('COMMENT ON POLICY %I ON public.%I IS %L', p, t, 'Any signed-in user may read (platform reference data); HQ writes through the service role.');
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);                                   -- not public data
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);     -- read-only for app users
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t, 'Keeps updated_at and updated_count current.');
  END LOOP;
END $$;

-- Boxes: (kit, box, section, kind, shows_amount, shows_tax, order, name, name2, url)
INSERT INTO public.sys_tax_return_box_cd (
  kit_code, box_code, section_code, box_kind, shows_amount, shows_tax, display_order, name, name2, source_url, created_by, created_info
)
SELECT s.kit, s.box, s.section, s.kind, s.amt, s.tax, s.ord, s.name, s.name2, s.url, 'system_admin', 'Migration 0725'
FROM (VALUES
  -- AE — FTA VAT 201
  ('AE_VAT', '1a', 'SALES',     'LINES',  true,  true,  10, 'Standard-rated supplies in Abu Dhabi', 'التوريدات الخاضعة للنسبة الأساسية في أبوظبي', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '1b', 'SALES',     'LINES',  true,  true,  20, 'Standard-rated supplies in Dubai', 'التوريدات الخاضعة للنسبة الأساسية في دبي', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '1c', 'SALES',     'LINES',  true,  true,  30, 'Standard-rated supplies in Sharjah', 'التوريدات الخاضعة للنسبة الأساسية في الشارقة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '1d', 'SALES',     'LINES',  true,  true,  40, 'Standard-rated supplies in Ajman', 'التوريدات الخاضعة للنسبة الأساسية في عجمان', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '1e', 'SALES',     'LINES',  true,  true,  50, 'Standard-rated supplies in Umm Al Quwain', 'التوريدات الخاضعة للنسبة الأساسية في أم القيوين', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '1f', 'SALES',     'LINES',  true,  true,  60, 'Standard-rated supplies in Ras Al Khaimah', 'التوريدات الخاضعة للنسبة الأساسية في رأس الخيمة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '1g', 'SALES',     'LINES',  true,  true,  70, 'Standard-rated supplies in Fujairah', 'التوريدات الخاضعة للنسبة الأساسية في الفجيرة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '2',  'SALES',     'MANUAL', true,  true,  80, 'Tax refunds provided to tourists', 'المبالغ الضريبية المستردة للسياح', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '3',  'SALES',     'LINES',  true,  true,  90, 'Supplies subject to the reverse charge', 'التوريدات الخاضعة لآلية الاحتساب العكسي', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '4',  'SALES',     'LINES',  true,  false, 100, 'Zero-rated supplies', 'التوريدات الخاضعة للنسبة الصفرية', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '5',  'SALES',     'LINES',  true,  false, 110, 'Exempt supplies', 'التوريدات المعفاة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '6',  'SALES',     'MANUAL', true,  true,  120, 'Goods imported into the UAE', 'السلع المستوردة إلى الدولة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '7',  'SALES',     'MANUAL', true,  true,  130, 'Adjustments to goods imported into the UAE', 'التعديلات على السلع المستوردة إلى الدولة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '8',  'SALES',     'TOTAL',  true,  true,  140, 'Total sales', 'إجمالي المبيعات', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '9',  'PURCHASES', 'LINES',  true,  true,  150, 'Standard-rated expenses', 'المصروفات الخاضعة للنسبة الأساسية', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '10', 'PURCHASES', 'LINES',  true,  true,  160, 'Supplies subject to the reverse charge (recoverable)', 'التوريدات الخاضعة لآلية الاحتساب العكسي (القابلة للاسترداد)', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '11', 'PURCHASES', 'TOTAL',  true,  true,  170, 'Total expenses', 'إجمالي المصروفات', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '12', 'NET',       'TOTAL',  false, true,  180, 'Total tax due for the period', 'إجمالي الضريبة المستحقة عن الفترة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '13', 'NET',       'TOTAL',  false, true,  190, 'Total recoverable tax for the period', 'إجمالي الضريبة القابلة للاسترداد عن الفترة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  ('AE_VAT', '14', 'NET',       'TOTAL',  false, true,  200, 'Payable tax for the period', 'الضريبة المستحقة الدفع عن الفترة', 'https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html'),
  -- SA — ZATCA VAT return
  ('SA_VAT', '1',  'SALES',     'LINES',  true,  true,  10, 'Standard-rated sales', 'المبيعات الخاضعة للنسبة الأساسية', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '2',  'SALES',     'MANUAL', true,  true,  20, 'Private healthcare and education to citizens', 'الرعاية الصحية والتعليم الخاص للمواطنين', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '3',  'SALES',     'LINES',  true,  false, 30, 'Zero-rated domestic sales', 'المبيعات المحلية الخاضعة للنسبة الصفرية', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '4',  'SALES',     'MANUAL', true,  false, 40, 'Exports', 'الصادرات', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '5',  'SALES',     'LINES',  true,  false, 50, 'Exempt sales', 'المبيعات المعفاة', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '6',  'SALES',     'TOTAL',  true,  true,  60, 'Total sales', 'إجمالي المبيعات', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '7',  'PURCHASES', 'LINES',  true,  true,  70, 'Standard-rated domestic purchases', 'المشتريات المحلية الخاضعة للنسبة الأساسية', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '8',  'PURCHASES', 'MANUAL', true,  true,  80, 'Imports with VAT paid at customs', 'الاستيرادات الخاضعة للضريبة المدفوعة في الجمارك', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '9',  'PURCHASES', 'LINES',  true,  true,  90, 'Imports under the reverse charge', 'الاستيرادات الخاضعة لآلية الاحتساب العكسي', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '10', 'PURCHASES', 'LINES',  true,  false, 100, 'Zero-rated purchases', 'المشتريات الخاضعة للنسبة الصفرية', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '11', 'PURCHASES', 'LINES',  true,  false, 110, 'Exempt purchases', 'المشتريات المعفاة', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '12', 'PURCHASES', 'TOTAL',  true,  true,  120, 'Total purchases', 'إجمالي المشتريات', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '13', 'NET',       'TOTAL',  false, true,  130, 'Total VAT due for the period', 'إجمالي ضريبة القيمة المضافة المستحقة عن الفترة', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '14', 'NET',       'MANUAL', false, true,  140, 'Corrections from previous periods', 'تصحيحات من فترات سابقة', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '15', 'NET',       'MANUAL', false, true,  150, 'VAT credit carried forward', 'الرصيد الدائن المرحّل', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  ('SA_VAT', '16', 'NET',       'TOTAL',  false, true,  160, 'Net VAT due', 'صافي الضريبة المستحقة', 'https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html'),
  -- BH — NBR VAT return
  ('BH_VAT', '1',  'SALES',     'LINES',  true,  true,  10, 'Standard-rated sales', 'المبيعات الخاضعة للنسبة الأساسية', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '2',  'SALES',     'MANUAL', true,  true,  20, 'Sales to registered customers in other GCC states', 'المبيعات لعملاء مسجلين في دول الخليج الأخرى', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '3',  'SALES',     'MANUAL', true,  false, 30, 'Sales under the domestic reverse charge', 'المبيعات الخاضعة لآلية الاحتساب العكسي المحلية', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '4',  'SALES',     'LINES',  true,  false, 40, 'Zero-rated domestic sales', 'المبيعات المحلية الخاضعة للنسبة الصفرية', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '5',  'SALES',     'MANUAL', true,  false, 50, 'Exports', 'الصادرات', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '6',  'SALES',     'LINES',  true,  false, 60, 'Exempt sales', 'المبيعات المعفاة', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '7',  'SALES',     'TOTAL',  true,  true,  70, 'Total sales', 'إجمالي المبيعات', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '8',  'PURCHASES', 'LINES',  true,  true,  80, 'Standard-rated domestic purchases', 'المشتريات المحلية الخاضعة للنسبة الأساسية', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '9',  'PURCHASES', 'MANUAL', true,  true,  90, 'Imports with VAT paid at customs', 'الاستيرادات الخاضعة للضريبة المدفوعة في الجمارك', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '10', 'PURCHASES', 'LINES',  true,  true,  100, 'Imports under the reverse charge', 'الاستيرادات الخاضعة لآلية الاحتساب العكسي', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '11', 'PURCHASES', 'MANUAL', true,  true,  110, 'Purchases under the domestic reverse charge', 'المشتريات الخاضعة لآلية الاحتساب العكسي المحلية', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '12', 'PURCHASES', 'LINES',  true,  false, 120, 'Purchases from non-registered suppliers, zero-rated or exempt', 'المشتريات من موردين غير مسجلين أو الخاضعة للنسبة الصفرية أو المعفاة', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '13', 'PURCHASES', 'TOTAL',  true,  true,  130, 'Total purchases', 'إجمالي المشتريات', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '14', 'NET',       'TOTAL',  false, true,  140, 'VAT due for the period', 'الضريبة المستحقة عن الفترة', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '15', 'NET',       'MANUAL', false, true,  150, 'Corrections from previous periods', 'تصحيحات من فترات سابقة', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '16', 'NET',       'MANUAL', false, true,  160, 'VAT credit carried forward', 'الرصيد الدائن المرحّل', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  ('BH_VAT', '17', 'NET',       'TOTAL',  false, true,  170, 'Net VAT due', 'صافي الضريبة المستحقة', 'https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html'),
  -- OM — Tax Authority VAT return (box numbers are placeholders until HQ reads the official form)
  ('OM_VAT', '1a', 'SALES',     'LINES',  true,  true,  10, 'Standard-rated supplies', 'التوريدات الخاضعة للنسبة الأساسية', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '1b', 'SALES',     'LINES',  true,  false, 20, 'Zero-rated supplies', 'التوريدات الخاضعة للنسبة الصفرية', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '1c', 'SALES',     'LINES',  true,  false, 30, 'Exempt supplies', 'التوريدات المعفاة', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '1d', 'SALES',     'MANUAL', true,  false, 40, 'Exports (GCC and other countries)', 'الصادرات (دول الخليج ودول أخرى)', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '2a', 'SALES',     'LINES',  true,  true,  50, 'Purchases subject to the reverse charge', 'المشتريات الخاضعة لآلية الاحتساب العكسي', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '3a', 'SALES',     'MANUAL', true,  true,  60, 'Imports (customs paid or deferred)', 'الاستيرادات (مدفوعة في الجمارك أو مؤجلة)', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '4a', 'PURCHASES', 'LINES',  true,  true,  70, 'Input tax on purchases', 'ضريبة المدخلات على المشتريات', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '4b', 'PURCHASES', 'MANUAL', true,  true,  80, 'Input tax on imports', 'ضريبة المدخلات على الاستيرادات', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  ('OM_VAT', '5',  'NET',       'TOTAL',  false, true,  90, 'Net VAT due', 'صافي الضريبة المستحقة', 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf'),
  -- GENERIC — layout for countries without a seeded form
  ('GENERIC_VAT', 'S1', 'SALES',     'LINES', true,  true,  10, 'Standard-rated sales', 'المبيعات الخاضعة للنسبة الأساسية', NULL),
  ('GENERIC_VAT', 'S2', 'SALES',     'LINES', true,  false, 20, 'Zero-rated sales', 'المبيعات الخاضعة للنسبة الصفرية', NULL),
  ('GENERIC_VAT', 'S3', 'SALES',     'LINES', true,  false, 30, 'Exempt sales', 'المبيعات المعفاة', NULL),
  ('GENERIC_VAT', 'S4', 'SALES',     'TOTAL', true,  true,  40, 'Total sales', 'إجمالي المبيعات', NULL),
  ('GENERIC_VAT', 'P1', 'PURCHASES', 'LINES', true,  true,  50, 'Standard-rated purchases', 'المشتريات الخاضعة للنسبة الأساسية', NULL),
  ('GENERIC_VAT', 'P2', 'PURCHASES', 'LINES', true,  true,  60, 'Purchases under the reverse charge', 'المشتريات الخاضعة لآلية الاحتساب العكسي', NULL),
  ('GENERIC_VAT', 'P3', 'PURCHASES', 'LINES', true,  false, 70, 'Other purchases (zero-rated, exempt, no tax)', 'مشتريات أخرى (نسبة صفرية أو معفاة أو بلا ضريبة)', NULL),
  ('GENERIC_VAT', 'P4', 'PURCHASES', 'TOTAL', true,  true,  80, 'Total purchases', 'إجمالي المشتريات', NULL),
  ('GENERIC_VAT', 'N1', 'NET',       'LINES', false, true,  90, 'Reverse-charge tax due', 'الضريبة المستحقة بآلية الاحتساب العكسي', NULL),
  ('GENERIC_VAT', 'N2', 'NET',       'TOTAL', false, true,  100, 'Net tax due', 'صافي الضريبة المستحقة', NULL)
) AS s(kit, box, section, kind, amt, tax, ord, name, name2, url)
ON CONFLICT (kit_code, box_code) DO UPDATE SET
  section_code = EXCLUDED.section_code, box_kind = EXCLUDED.box_kind,
  shows_amount = EXCLUDED.shows_amount, shows_tax = EXCLUDED.shows_tax,
  display_order = EXCLUDED.display_order, name = EXCLUDED.name, name2 = EXCLUDED.name2,
  source_url = EXCLUDED.source_url, updated_by = 'system_admin', updated_info = 'Migration 0725';

-- Sources: (kit, box, no, kind, flow, category, reverse_charge, emirate, measure, source_box, sign)
INSERT INTO public.sys_tax_return_box_map_dtl (
  kit_code, box_code, map_no, source_kind, tax_flow_code, tax_category_code, is_reverse_charge, emirate_code,
  tax_measure, source_box_code, sign, created_by, created_info
)
SELECT s.kit, s.box, s.no, s.kind, s.flow, s.cat, s.rc, s.emirate, s.measure, s.src, s.sign, 'system_admin', 'Migration 0725'
FROM (VALUES
  -- AE: sales per emirate of the selling branch
  ('AE_VAT', '1a', 1::smallint, 'LINES', 'OUTPUT', 'STANDARD', false, 'AZ', 'TAX', NULL, 1::smallint),
  ('AE_VAT', '1b', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'DU', 'TAX', NULL, 1),
  ('AE_VAT', '1c', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'SH', 'TAX', NULL, 1),
  ('AE_VAT', '1d', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'AJ', 'TAX', NULL, 1),
  ('AE_VAT', '1e', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'UQ', 'TAX', NULL, 1),
  ('AE_VAT', '1f', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'RK', 'TAX', NULL, 1),
  ('AE_VAT', '1g', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'FU', 'TAX', NULL, 1),
  ('AE_VAT', '3',  1, 'LINES', 'INPUT',  'STANDARD', true,  NULL, 'TAX', NULL, 1),
  ('AE_VAT', '4',  1, 'LINES', 'OUTPUT', 'ZERO_RATED', NULL, NULL, 'TAX', NULL, 1),
  ('AE_VAT', '5',  1, 'LINES', 'OUTPUT', 'EXEMPT', NULL, NULL, 'TAX', NULL, 1),
  ('AE_VAT', '8',  1, 'BOX', NULL, NULL, NULL, NULL, NULL, '1a', 1),
  ('AE_VAT', '8',  2, 'BOX', NULL, NULL, NULL, NULL, NULL, '1b', 1),
  ('AE_VAT', '8',  3, 'BOX', NULL, NULL, NULL, NULL, NULL, '1c', 1),
  ('AE_VAT', '8',  4, 'BOX', NULL, NULL, NULL, NULL, NULL, '1d', 1),
  ('AE_VAT', '8',  5, 'BOX', NULL, NULL, NULL, NULL, NULL, '1e', 1),
  ('AE_VAT', '8',  6, 'BOX', NULL, NULL, NULL, NULL, NULL, '1f', 1),
  ('AE_VAT', '8',  7, 'BOX', NULL, NULL, NULL, NULL, NULL, '1g', 1),
  ('AE_VAT', '8',  8, 'BOX', NULL, NULL, NULL, NULL, NULL, '2', 1),
  ('AE_VAT', '8',  9, 'BOX', NULL, NULL, NULL, NULL, NULL, '3', 1),
  ('AE_VAT', '8', 10, 'BOX', NULL, NULL, NULL, NULL, NULL, '4', 1),
  ('AE_VAT', '8', 11, 'BOX', NULL, NULL, NULL, NULL, NULL, '5', 1),
  ('AE_VAT', '8', 12, 'BOX', NULL, NULL, NULL, NULL, NULL, '6', 1),
  ('AE_VAT', '8', 13, 'BOX', NULL, NULL, NULL, NULL, NULL, '7', 1),
  ('AE_VAT', '9',  1, 'LINES', 'INPUT', 'STANDARD', false, NULL, 'RECOVERABLE', NULL, 1),
  ('AE_VAT', '10', 1, 'LINES', 'INPUT', 'STANDARD', true,  NULL, 'RECOVERABLE', NULL, 1),
  ('AE_VAT', '11', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '9', 1),
  ('AE_VAT', '11', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '10', 1),
  ('AE_VAT', '12', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '8', 1),
  ('AE_VAT', '13', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '11', 1),
  ('AE_VAT', '14', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '12', 1),
  ('AE_VAT', '14', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '13', -1),
  -- SA
  ('SA_VAT', '1',  1, 'LINES', 'OUTPUT', 'STANDARD', false, NULL, 'TAX', NULL, 1),
  ('SA_VAT', '3',  1, 'LINES', 'OUTPUT', 'ZERO_RATED', NULL, NULL, 'TAX', NULL, 1),
  ('SA_VAT', '5',  1, 'LINES', 'OUTPUT', 'EXEMPT', NULL, NULL, 'TAX', NULL, 1),
  ('SA_VAT', '6',  1, 'BOX', NULL, NULL, NULL, NULL, NULL, '1', 1),
  ('SA_VAT', '6',  2, 'BOX', NULL, NULL, NULL, NULL, NULL, '2', 1),
  ('SA_VAT', '6',  3, 'BOX', NULL, NULL, NULL, NULL, NULL, '3', 1),
  ('SA_VAT', '6',  4, 'BOX', NULL, NULL, NULL, NULL, NULL, '4', 1),
  ('SA_VAT', '6',  5, 'BOX', NULL, NULL, NULL, NULL, NULL, '5', 1),
  ('SA_VAT', '7',  1, 'LINES', 'INPUT', 'STANDARD', false, NULL, 'RECOVERABLE', NULL, 1),
  ('SA_VAT', '9',  1, 'LINES', 'INPUT', 'STANDARD', true,  NULL, 'RECOVERABLE', NULL, 1),
  ('SA_VAT', '10', 1, 'LINES', 'INPUT', 'ZERO_RATED', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('SA_VAT', '11', 1, 'LINES', 'INPUT', 'EXEMPT', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('SA_VAT', '12', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '7', 1),
  ('SA_VAT', '12', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '8', 1),
  ('SA_VAT', '12', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, '9', 1),
  ('SA_VAT', '12', 4, 'BOX', NULL, NULL, NULL, NULL, NULL, '10', 1),
  ('SA_VAT', '12', 5, 'BOX', NULL, NULL, NULL, NULL, NULL, '11', 1),
  ('SA_VAT', '13', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '6', 1),
  ('SA_VAT', '13', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '12', -1),
  ('SA_VAT', '13', 3, 'LINES', 'INPUT', 'STANDARD', true, NULL, 'TAX', NULL, 1),   -- reverse-charge tax due
  ('SA_VAT', '16', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '13', 1),
  ('SA_VAT', '16', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '14', 1),
  ('SA_VAT', '16', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, '15', -1),
  -- BH
  ('BH_VAT', '1',  1, 'LINES', 'OUTPUT', 'STANDARD', false, NULL, 'TAX', NULL, 1),
  ('BH_VAT', '4',  1, 'LINES', 'OUTPUT', 'ZERO_RATED', NULL, NULL, 'TAX', NULL, 1),
  ('BH_VAT', '6',  1, 'LINES', 'OUTPUT', 'EXEMPT', NULL, NULL, 'TAX', NULL, 1),
  ('BH_VAT', '7',  1, 'BOX', NULL, NULL, NULL, NULL, NULL, '1', 1),
  ('BH_VAT', '7',  2, 'BOX', NULL, NULL, NULL, NULL, NULL, '2', 1),
  ('BH_VAT', '7',  3, 'BOX', NULL, NULL, NULL, NULL, NULL, '3', 1),
  ('BH_VAT', '7',  4, 'BOX', NULL, NULL, NULL, NULL, NULL, '4', 1),
  ('BH_VAT', '7',  5, 'BOX', NULL, NULL, NULL, NULL, NULL, '5', 1),
  ('BH_VAT', '7',  6, 'BOX', NULL, NULL, NULL, NULL, NULL, '6', 1),
  ('BH_VAT', '8',  1, 'LINES', 'INPUT', 'STANDARD', false, NULL, 'RECOVERABLE', NULL, 1),
  ('BH_VAT', '10', 1, 'LINES', 'INPUT', 'STANDARD', true,  NULL, 'RECOVERABLE', NULL, 1),
  ('BH_VAT', '12', 1, 'LINES', 'INPUT', 'ZERO_RATED', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('BH_VAT', '12', 2, 'LINES', 'INPUT', 'EXEMPT', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('BH_VAT', '12', 3, 'LINES', 'INPUT', 'OUT_OF_SCOPE', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('BH_VAT', '13', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '8', 1),
  ('BH_VAT', '13', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '9', 1),
  ('BH_VAT', '13', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, '10', 1),
  ('BH_VAT', '13', 4, 'BOX', NULL, NULL, NULL, NULL, NULL, '11', 1),
  ('BH_VAT', '13', 5, 'BOX', NULL, NULL, NULL, NULL, NULL, '12', 1),
  ('BH_VAT', '14', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '7', 1),
  ('BH_VAT', '14', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '13', -1),
  ('BH_VAT', '14', 3, 'LINES', 'INPUT', 'STANDARD', true, NULL, 'TAX', NULL, 1),   -- reverse-charge tax due
  ('BH_VAT', '17', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, '14', 1),
  ('BH_VAT', '17', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, '15', 1),
  ('BH_VAT', '17', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, '16', -1),
  -- OM
  ('OM_VAT', '1a', 1, 'LINES', 'OUTPUT', 'STANDARD', false, NULL, 'TAX', NULL, 1),
  ('OM_VAT', '1b', 1, 'LINES', 'OUTPUT', 'ZERO_RATED', NULL, NULL, 'TAX', NULL, 1),
  ('OM_VAT', '1c', 1, 'LINES', 'OUTPUT', 'EXEMPT', NULL, NULL, 'TAX', NULL, 1),
  ('OM_VAT', '2a', 1, 'LINES', 'INPUT',  'STANDARD', true, NULL, 'TAX', NULL, 1),
  ('OM_VAT', '4a', 1, 'LINES', 'INPUT',  'STANDARD', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('OM_VAT', '5',  1, 'BOX', NULL, NULL, NULL, NULL, NULL, '1a', 1),
  ('OM_VAT', '5',  2, 'BOX', NULL, NULL, NULL, NULL, NULL, '2a', 1),
  ('OM_VAT', '5',  3, 'BOX', NULL, NULL, NULL, NULL, NULL, '3a', 1),
  ('OM_VAT', '5',  4, 'BOX', NULL, NULL, NULL, NULL, NULL, '4a', -1),
  ('OM_VAT', '5',  5, 'BOX', NULL, NULL, NULL, NULL, NULL, '4b', -1),
  -- GENERIC
  ('GENERIC_VAT', 'S1', 1, 'LINES', 'OUTPUT', 'STANDARD', false, NULL, 'TAX', NULL, 1),
  ('GENERIC_VAT', 'S2', 1, 'LINES', 'OUTPUT', 'ZERO_RATED', NULL, NULL, 'TAX', NULL, 1),
  ('GENERIC_VAT', 'S3', 1, 'LINES', 'OUTPUT', 'EXEMPT', NULL, NULL, 'TAX', NULL, 1),
  ('GENERIC_VAT', 'S4', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, 'S1', 1),
  ('GENERIC_VAT', 'S4', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, 'S2', 1),
  ('GENERIC_VAT', 'S4', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, 'S3', 1),
  ('GENERIC_VAT', 'P1', 1, 'LINES', 'INPUT', 'STANDARD', false, NULL, 'RECOVERABLE', NULL, 1),
  ('GENERIC_VAT', 'P2', 1, 'LINES', 'INPUT', 'STANDARD', true,  NULL, 'RECOVERABLE', NULL, 1),
  ('GENERIC_VAT', 'P3', 1, 'LINES', 'INPUT', 'ZERO_RATED', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('GENERIC_VAT', 'P3', 2, 'LINES', 'INPUT', 'EXEMPT', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('GENERIC_VAT', 'P3', 3, 'LINES', 'INPUT', 'OUT_OF_SCOPE', NULL, NULL, 'RECOVERABLE', NULL, 1),
  ('GENERIC_VAT', 'P4', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, 'P1', 1),
  ('GENERIC_VAT', 'P4', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, 'P2', 1),
  ('GENERIC_VAT', 'P4', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, 'P3', 1),
  ('GENERIC_VAT', 'N1', 1, 'LINES', 'INPUT', 'STANDARD', true, NULL, 'TAX', NULL, 1),
  ('GENERIC_VAT', 'N2', 1, 'BOX', NULL, NULL, NULL, NULL, NULL, 'S4', 1),
  ('GENERIC_VAT', 'N2', 2, 'BOX', NULL, NULL, NULL, NULL, NULL, 'N1', 1),
  ('GENERIC_VAT', 'N2', 3, 'BOX', NULL, NULL, NULL, NULL, NULL, 'P4', -1)
) AS s(kit, box, no, kind, flow, cat, rc, emirate, measure, src, sign)
ON CONFLICT (kit_code, box_code, map_no) DO UPDATE SET
  source_kind = EXCLUDED.source_kind, tax_flow_code = EXCLUDED.tax_flow_code,
  tax_category_code = EXCLUDED.tax_category_code, is_reverse_charge = EXCLUDED.is_reverse_charge,
  emirate_code = EXCLUDED.emirate_code, tax_measure = EXCLUDED.tax_measure,
  source_box_code = EXCLUDED.source_box_code, sign = EXCLUDED.sign,
  updated_by = 'system_admin', updated_info = 'Migration 0725';

-- ─── 2. ERP-Lite: prepayment tax events + expense input VAT line ───────────

INSERT INTO public.sys_fin_evt_cd (
  evt_code, name, name2, description, description2, phase_code, is_locked, rec_order,
  created_at, created_by, created_info, is_active, rec_status
) VALUES
  ('TAX_ADVANCE_RECORDED',   'Advance Tax Recorded',   'تسجيل ضريبة الدفعة المقدمة',        'Tax recorded on a customer advance when the money was received: moved from the advance liability to Output VAT.', 'ضريبة مسجلة على دفعة مقدمة عند استلام المبلغ: تُنقل من التزام الدفعة المقدمة إلى ضريبة المخرجات.', 'V1', true, 170, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1),
  ('TAX_ADVANCE_NETTED',     'Advance Tax Netted',     'خصم ضريبة الدفعة المقدمة',          'Advance tax already declared and now included in the invoice (or the advance was reversed): moved back from Output VAT to the advance liability.', 'ضريبة دفعة مقدمة سبق الإقرار بها وأصبحت ضمن الفاتورة (أو عُكست الدفعة): تُعاد من ضريبة المخرجات إلى التزام الدفعة المقدمة.', 'V1', true, 180, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1),
  ('TAX_GIFT_CARD_RECORDED', 'Gift Card Tax Recorded', 'تسجيل ضريبة بطاقة الهدايا',         'Tax recorded at sale of a single-purpose gift card: moved from the gift card liability to Output VAT.', 'ضريبة مسجلة عند بيع بطاقة هدايا أحادية الغرض: تُنقل من التزام بطاقات الهدايا إلى ضريبة المخرجات.', 'V1', true, 190, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1),
  ('TAX_GIFT_CARD_NETTED',   'Gift Card Tax Netted',   'خصم ضريبة بطاقة الهدايا',           'Gift card tax already declared and now included in the invoice (or the sale was reversed): moved back from Output VAT to the gift card liability.', 'ضريبة بطاقة هدايا سبق الإقرار بها وأصبحت ضمن الفاتورة (أو عُكس البيع): تُعاد من ضريبة المخرجات إلى التزام بطاقات الهدايا.', 'V1', true, 200, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1)
ON CONFLICT (evt_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code, is_locked = EXCLUDED.is_locked, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0725';

INSERT INTO public.sys_fin_map_rule_mst (
  pkg_id, evt_id, rule_code, version_no, name, name2, description, description2,
  priority_no, condition_json, is_fallback, stop_on_match, status_code, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, seed.rule_code, 1, seed.name, seed.name2, seed.description, seed.description2,
  seed.priority_no, '{}'::jsonb, true, true, 'DRAFT', seed.priority_no,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1
FROM (
  VALUES
    ('TAX_ADVANCE_RECORDED_V1',   'TAX_ADVANCE_RECORDED',   'Advance tax recorded v1',   'تسجيل ضريبة الدفعة المقدمة v1', 'Dr advance liability, Cr Output VAT for the tax inside an advance.', 'مدين التزام الدفعة المقدمة، دائن ضريبة المخرجات بقيمة الضريبة داخل الدفعة.', 170),
    ('TAX_ADVANCE_NETTED_V1',     'TAX_ADVANCE_NETTED',     'Advance tax netted v1',     'خصم ضريبة الدفعة المقدمة v1',   'Dr Output VAT, Cr advance liability when advance tax is netted or reversed.', 'مدين ضريبة المخرجات، دائن التزام الدفعة المقدمة عند خصم ضريبة الدفعة أو عكسها.', 180),
    ('TAX_GIFT_CARD_RECORDED_V1', 'TAX_GIFT_CARD_RECORDED', 'Gift card tax recorded v1', 'تسجيل ضريبة بطاقة الهدايا v1',  'Dr gift card liability, Cr Output VAT for the tax inside a single-purpose card sale.', 'مدين التزام بطاقات الهدايا، دائن ضريبة المخرجات بقيمة الضريبة داخل بيع البطاقة.', 190),
    ('TAX_GIFT_CARD_NETTED_V1',   'TAX_GIFT_CARD_NETTED',   'Gift card tax netted v1',   'خصم ضريبة بطاقة الهدايا v1',    'Dr Output VAT, Cr gift card liability when card tax is netted or reversed.', 'مدين ضريبة المخرجات، دائن التزام بطاقات الهدايا عند خصم ضريبة البطاقة أو عكسها.', 200)
) AS seed(rule_code, evt_code, name, name2, description, description2, priority_no)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, rule_code) DO UPDATE SET
  evt_id = EXCLUDED.evt_id, name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  priority_no = EXCLUDED.priority_no, condition_json = EXCLUDED.condition_json,
  is_fallback = EXCLUDED.is_fallback, stop_on_match = EXCLUDED.stop_on_match,
  rec_order = EXCLUDED.rec_order, is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0725';

INSERT INTO public.sys_fin_map_rule_dtl (
  rule_id, line_no, entry_side, usage_code_id, resolver_id, amount_source_code,
  line_type_code, condition_json, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  r.rule_id, seed.line_no, seed.entry_side, uc.usage_code_id, NULL, seed.amount_source_code,
  seed.line_type_code, seed.cond::jsonb, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1
FROM (
  VALUES
    ('TAX_ADVANCE_RECORDED_V1',   10, 'DR', 'CUSTOMER_ADVANCE_LIABILITY', 'tax_amount', 'MAIN', '{}', 10),
    ('TAX_ADVANCE_RECORDED_V1',   20, 'CR', 'VAT_OUTPUT',                 'tax_amount', 'VAT',  '{}', 20),
    ('TAX_ADVANCE_NETTED_V1',     10, 'DR', 'VAT_OUTPUT',                 'tax_amount', 'VAT',  '{}', 10),
    ('TAX_ADVANCE_NETTED_V1',     20, 'CR', 'CUSTOMER_ADVANCE_LIABILITY', 'tax_amount', 'MAIN', '{}', 20),
    ('TAX_GIFT_CARD_RECORDED_V1', 10, 'DR', 'GIFT_CARD_LIABILITY',        'tax_amount', 'MAIN', '{}', 10),
    ('TAX_GIFT_CARD_RECORDED_V1', 20, 'CR', 'VAT_OUTPUT',                 'tax_amount', 'VAT',  '{}', 20),
    ('TAX_GIFT_CARD_NETTED_V1',   10, 'DR', 'VAT_OUTPUT',                 'tax_amount', 'VAT',  '{}', 10),
    ('TAX_GIFT_CARD_NETTED_V1',   20, 'CR', 'GIFT_CARD_LIABILITY',        'tax_amount', 'MAIN', '{}', 20),
    -- Expense: recoverable input VAT to its own account (the app sends 0 when there are no tax lines)
    ('EXPENSE_RECORDED_V1',       15, 'DR', 'VAT_INPUT',                  'tax_amount', 'VAT',  '{"when":"tax_amount > 0"}', 15)
) AS seed(rule_code, line_no, entry_side, usage_code, amount_source_code, line_type_code, cond, rec_order)
JOIN public.sys_fin_map_rule_mst r ON r.rule_code = seed.rule_code
JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
ON CONFLICT (rule_id, line_no) DO UPDATE SET
  entry_side = EXCLUDED.entry_side, usage_code_id = EXCLUDED.usage_code_id, resolver_id = EXCLUDED.resolver_id,
  amount_source_code = EXCLUDED.amount_source_code, line_type_code = EXCLUDED.line_type_code,
  condition_json = EXCLUDED.condition_json, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0725';

-- Expense line 10 now debits the expense with net_amount; the app sends net = total − recoverable tax,
-- so an expense without recoverable tax still debits its full total exactly as before.
UPDATE public.sys_fin_map_rule_dtl d
   SET amount_source_code = 'net_amount', updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
       updated_info = 'Migration 0725 — expense debit excludes recoverable input VAT'
  FROM public.sys_fin_map_rule_mst r
 WHERE r.rule_id = d.rule_id AND r.rule_code = 'EXPENSE_RECORDED_V1' AND d.line_no = 10;

INSERT INTO public.sys_fin_auto_post_mst (
  pkg_id, evt_id, policy_ver, is_enabled, blocking_mode, required_success,
  retry_allowed, repost_allowed, status_code, failure_action_code, notes, notes2, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, 1, true, 'NON_BLOCKING', false, true, true, 'DRAFT', 'FINANCE_EXCEPTION',
  'Never block the sale, receipt or invoice; a failed tax reclass goes to the finance exception queue.',
  'لا تمنع البيع أو الاستلام أو الفاتورة؛ يذهب فشل إعادة تصنيف الضريبة إلى قائمة استثناءات المالية.',
  seed.rec_order, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0725', true, 1
FROM (
  VALUES ('TAX_ADVANCE_RECORDED', 170), ('TAX_ADVANCE_NETTED', 180), ('TAX_GIFT_CARD_RECORDED', 190), ('TAX_GIFT_CARD_NETTED', 200)
) AS seed(evt_code, rec_order)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, evt_id, policy_ver) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, blocking_mode = EXCLUDED.blocking_mode,
  required_success = EXCLUDED.required_success, retry_allowed = EXCLUDED.retry_allowed,
  repost_allowed = EXCLUDED.repost_allowed, failure_action_code = EXCLUDED.failure_action_code,
  notes = EXCLUDED.notes, notes2 = EXCLUDED.notes2, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0725';

UPDATE public.sys_fin_map_rule_mst r
   SET status_code = 'ACTIVE', updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
       updated_info = 'Migration 0725 — activate tax reclass rules'
  FROM public.sys_fin_evt_cd e
 WHERE r.evt_id = e.evt_id
   AND e.evt_code IN ('TAX_ADVANCE_RECORDED', 'TAX_ADVANCE_NETTED', 'TAX_GIFT_CARD_RECORDED', 'TAX_GIFT_CARD_NETTED')
   AND r.status_code = 'DRAFT';

UPDATE public.sys_fin_auto_post_mst ap
   SET status_code = 'ACTIVE', effective_from = COALESCE(ap.effective_from, CURRENT_DATE),
       updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
       updated_info = 'Migration 0725 — activate tax reclass policies'
  FROM public.sys_fin_evt_cd e
 WHERE ap.evt_id = e.evt_id
   AND e.evt_code IN ('TAX_ADVANCE_RECORDED', 'TAX_ADVANCE_NETTED', 'TAX_GIFT_CARD_RECORDED', 'TAX_GIFT_CARD_NETTED')
   AND ap.status_code = 'DRAFT';

-- ─── 3. Permission: tax:manage_periods ─────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('tax:manage_periods', 'Manage Tax Periods', 'إدارة الفترات الضريبية', 'management',
   'Add, close and reopen tax return periods', 'إضافة الفترات الضريبية وإغلاقها وإعادة فتحها',
   'Tax', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- Same holders as tax:manage_config, plus finance_manager (closing a return period is finance work).
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, 'tax:manage_periods', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
WHERE r.code IN ('super_admin', 'tenant_admin', 'finance_manager')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = 'tax:manage_periods'
  );

-- ─── 4. Navigation: Reports → VAT Return ───────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, main_permission_code, display_order, comp_level,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, permissions, feature_flag, badge, rec_status, created_info
)
VALUES (
  'reports_tax_return',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'reports'),
  'reports',
  'VAT Return',
  'الإقرار الضريبي',
  'Return boxes for a tax period from the final tax lines, with drill-down and export',
  'خانات الإقرار لفترة ضريبية من سطور الضريبة النهائية مع التفاصيل والتصدير',
  '/dashboard/reports/tax-return',
  'Receipt',
  'tax:view_reports',
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM public.sys_components_cd WHERE parent_comp_code = 'reports' AND comp_code <> 'reports_tax_return'),
  (SELECT comp_level + 1 FROM public.sys_components_cd WHERE comp_code = 'reports'),
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin","branch_manager","accountant","finance_manager"]'::jsonb,
  '["tax:view_reports"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'Tax Engine T7 — VAT return report.'
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_id = EXCLUDED.parent_comp_id, parent_comp_code = EXCLUDED.parent_comp_code,
  label = EXCLUDED.label, label2 = EXCLUDED.label2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path, comp_icon = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code, display_order = EXCLUDED.display_order,
  comp_level = EXCLUDED.comp_level, is_leaf = TRUE, is_navigable = TRUE, is_active = TRUE,
  roles = EXCLUDED.roles, permissions = EXCLUDED.permissions, updated_at = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd SET is_leaf = FALSE WHERE comp_code = 'reports' AND is_leaf IS DISTINCT FROM FALSE;

-- ─── 5. Validation ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v INTEGER;
BEGIN
  SELECT count(*) INTO v FROM public.sys_tax_return_box_cd WHERE created_info = 'Migration 0725' OR updated_info = 'Migration 0725';
  IF v <> 72 THEN RAISE EXCEPTION '0725: expected 72 return boxes, found %', v; END IF;

  -- Every LINES / TOTAL box has at least one source; MANUAL boxes have none.
  SELECT count(*) INTO v FROM public.sys_tax_return_box_cd b
   WHERE b.kit_code IN ('AE_VAT', 'SA_VAT', 'BH_VAT', 'OM_VAT', 'GENERIC_VAT')
     AND ((b.box_kind <> 'MANUAL') <> EXISTS (SELECT 1 FROM public.sys_tax_return_box_map_dtl m
                                                WHERE m.kit_code = b.kit_code AND m.box_code = b.box_code));
  IF v <> 0 THEN RAISE EXCEPTION '0725: % boxes have sources that do not match their kind', v; END IF;

  SELECT count(*) INTO v FROM public.sys_fin_auto_post_mst ap JOIN public.sys_fin_evt_cd e ON e.evt_id = ap.evt_id
   WHERE e.evt_code IN ('TAX_ADVANCE_RECORDED', 'TAX_ADVANCE_NETTED', 'TAX_GIFT_CARD_RECORDED', 'TAX_GIFT_CARD_NETTED')
     AND ap.status_code = 'ACTIVE' AND ap.blocking_mode = 'NON_BLOCKING';
  IF v <> 4 THEN RAISE EXCEPTION '0725: expected 4 active tax reclass policies, found %', v; END IF;

  SELECT count(*) INTO v FROM public.sys_fin_map_rule_dtl d JOIN public.sys_fin_map_rule_mst r ON r.rule_id = d.rule_id
   WHERE r.rule_code = 'EXPENSE_RECORDED_V1' AND ((d.line_no = 10 AND d.amount_source_code = 'net_amount') OR d.line_no = 15);
  IF v <> 2 THEN RAISE EXCEPTION '0725: expense rule not updated (found % of 2 lines)', v; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'reports_tax_return' AND parent_comp_id IS NOT NULL) THEN
    RAISE EXCEPTION '0725: reports_tax_return was not attached to the reports node';
  END IF;
END $$;

COMMIT;
