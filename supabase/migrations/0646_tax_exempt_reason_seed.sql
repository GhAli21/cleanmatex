-- =============================================================================
-- 0646_tax_exempt_reason_seed.sql
-- Line-Level Money Snapshot — Phase 4 follow-up (ADR-060 §6, PLAN.md §6.7, P0-12).
--
-- Why:
-- 0642 created sys_tax_exempt_reason_cd empty. Fiscal documents (ZATCA in
-- Saudi Arabia, PINT OM / Fawtara in Oman) reject a zero-rated (Z) or exempt
-- (E) line that carries no official reason code, so the codes must exist
-- before tax documents carry item lines (P8-02). This migration:
--   1. adds tax_category_code: every official reason belongs to exactly one
--      tax category (E, Z or O), so a line's category and reason can never
--      contradict each other (checked at the service layer, which already
--      validates tax_exempt_reason because the line column is not an FK);
--   2. adds allows_free_text: ZATCA VATEX-SA-OOS is the one code whose reason
--      text is typed per invoice rather than fixed;
--   3. seeds the published codes for Saudi Arabia (16) and Oman (28).
--
-- Sources (read 2026-10-24):
--   SA: ZATCA exemption reason list as published by
--       https://zatca.wafeq.com/reference/exemptionreasonenum (updated 2026-10-14)
--       and https://www.cleartax.com/sa/vat-category-code-ksa-invoicing.
--       Not seeded: VATEX-SA-DUTYFREE, VATEX-SA-32(bis), VATEX-SA-ROYALDECREE,
--       announced on the ZATCA developer forum in 2025 but not yet confirmed
--       against the ZATCA SDK (exact code string and category unverified).
--   OM: PINT OM code lists CL-05-OM (exemption, VATEX-OM-01..12) and
--       CL-10-OM (zero rating, VATZR-OM-01..16), as transcribed by
--       https://docs.goroute.ai/docs/country-guides/oman from docs.peppol.eu.
--       Oman has no out-of-scope reason list.
--   AE / BH: no verified official list found; not seeded. KW / QA: no VAT.
-- English names follow the published wording. Arabic names (name2) are the
-- project's translation, except the ZATCA forum's own Arabic where noted; a
-- tax adviser should review them before go-live. The code, not the text, is
-- what goes into the e-invoice XML.
--
-- Rollback (forward-only): DELETE the seeded rows by (country, code), then
-- ALTER TABLE ... DROP CONSTRAINT fk_sys_tax_exempt_reason_cat RESTRICT,
-- DROP COLUMN tax_category_code, allows_free_text.
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. New columns (the table is empty, so NOT NULL needs no backfill)
-- ------------------------------------------------------------------
ALTER TABLE public.sys_tax_exempt_reason_cd
  ADD COLUMN IF NOT EXISTS tax_category_code TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS allows_free_text  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sys_tax_exempt_reason_cd
  ADD CONSTRAINT fk_sys_tax_exempt_reason_cat
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  -- A reason only exists for a non-standard line.
  ADD CONSTRAINT chk_sys_tax_exempt_reason_cat
    CHECK (tax_category_code <> 'STANDARD');

COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.tax_category_code IS
  'FK sys_tax_category_cd. The tax category this reason belongs to (EXEMPT, ZERO_RATED or OUT_OF_SCOPE; never STANDARD). A line may carry this reason only when its tax_category_code matches.';
COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.allows_free_text IS
  'True when the official code expects the reason text to be typed per document instead of the fixed name (ZATCA VATEX-SA-OOS).';
COMMENT ON CONSTRAINT fk_sys_tax_exempt_reason_cat ON public.sys_tax_exempt_reason_cd IS
  'Every reason belongs to a known tax category.';
COMMENT ON CONSTRAINT chk_sys_tax_exempt_reason_cat ON public.sys_tax_exempt_reason_cd IS
  'Standard-rated lines carry no exemption reason.';
COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.code IS
  'Official reason code as written on the e-invoice, unique within its country (e.g. VATEX-SA-32, VATEX-OM-02, VATZR-OM-10).';
COMMENT ON TABLE public.sys_tax_exempt_reason_cd IS
  'Line-Level Money Snapshot (ADR-060 §6): official bilingual reason codes a non-STANDARD tax-category line carries on fiscal documents, per country (ZATCA VATEX-SA-*, PINT OM VATEX-OM-* / VATZR-OM-*). Seeded by 0646 for SA and OM; other countries are added when an official list is verified.';

-- ------------------------------------------------------------------
-- 2. Saudi Arabia (ZATCA)
-- ------------------------------------------------------------------
INSERT INTO public.sys_tax_exempt_reason_cd
  (country, code, tax_category_code, name, name2, description, allows_free_text, display_order)
VALUES
  ('SA', 'VATEX-SA-29',    'EXEMPT',       'Financial services mentioned in Article 29 of the VAT Regulations', 'الخدمات المالية المذكورة في المادة 29 من اللائحة التنفيذية لنظام ضريبة القيمة المضافة', 'VAT Regulations Art. 29', FALSE, 10),
  ('SA', 'VATEX-SA-29-7',  'EXEMPT',       'Life insurance services mentioned in Article 29 of the VAT Regulations', 'عقود تأمين الحياة المذكورة في المادة 29 من اللائحة التنفيذية لنظام ضريبة القيمة المضافة', 'VAT Regulations Art. 29(7)', FALSE, 20),
  ('SA', 'VATEX-SA-30',    'EXEMPT',       'Real estate transactions mentioned in Article 30 of the VAT Regulations', 'التوريدات العقارية المذكورة في المادة 30 من اللائحة التنفيذية لنظام ضريبة القيمة المضافة', 'VAT Regulations Art. 30', FALSE, 30),
  ('SA', 'VATEX-SA-32',    'ZERO_RATED',   'Export of goods', 'صادرات السلع من المملكة', 'VAT Regulations Art. 32', FALSE, 40),
  ('SA', 'VATEX-SA-33',    'ZERO_RATED',   'Export of services', 'صادرات الخدمات من المملكة', 'VAT Regulations Art. 33', FALSE, 50),
  ('SA', 'VATEX-SA-34-1',  'ZERO_RATED',   'The international transport of Goods', 'النقل الدولي للسلع', 'VAT Regulations Art. 34(1)', FALSE, 60),
  ('SA', 'VATEX-SA-34-2',  'ZERO_RATED',   'International transport of passengers', 'النقل الدولي للركاب', 'VAT Regulations Art. 34(2)', FALSE, 70),
  ('SA', 'VATEX-SA-34-3',  'ZERO_RATED',   'Services directly connected and incidental to a Supply of international passenger transport', 'الخدمات المرتبطة مباشرة أو العرضية لتوريد النقل الدولي للركاب', 'VAT Regulations Art. 34(3)', FALSE, 80),
  ('SA', 'VATEX-SA-34-4',  'ZERO_RATED',   'Supply of a qualifying means of transport', 'توريد وسائل النقل المؤهلة', 'VAT Regulations Art. 34(4)', FALSE, 90),
  ('SA', 'VATEX-SA-34-5',  'ZERO_RATED',   'Any services relating to Goods or passenger transportation, as defined in article twenty five of these Regulations', 'الخدمات ذات الصلة بنقل السلع أو الركاب، وفقاً للتعريف الوارد في المادة الخامسة والعشرين من اللائحة التنفيذية', 'VAT Regulations Art. 34(5)', FALSE, 100),
  ('SA', 'VATEX-SA-35',    'ZERO_RATED',   'Medicines and medical equipment', 'الأدوية والمعدات الطبية', 'VAT Regulations Art. 35', FALSE, 110),
  ('SA', 'VATEX-SA-36',    'ZERO_RATED',   'Qualifying metals', 'المعادن المؤهلة', 'VAT Regulations Art. 36', FALSE, 120),
  ('SA', 'VATEX-SA-EDU',   'ZERO_RATED',   'Private education to citizen', 'الخدمات التعليمية الخاصة للمواطنين', NULL, FALSE, 130),
  ('SA', 'VATEX-SA-HEA',   'ZERO_RATED',   'Private healthcare to citizen', 'الخدمات الصحية الخاصة للمواطنين', NULL, FALSE, 140),
  ('SA', 'VATEX-SA-MLTRY', 'ZERO_RATED',   'Supply of qualified military goods', 'توريد السلع العسكرية المؤهلة', NULL, FALSE, 150),
  ('SA', 'VATEX-SA-OOS',   'OUT_OF_SCOPE', 'Other reason for exemption provided as free text', 'سبب آخر للإعفاء يُكتب نصاً', 'The reason text is typed on each document.', TRUE, 160)
ON CONFLICT (country, code) DO NOTHING;

-- ------------------------------------------------------------------
-- 3. Oman (PINT OM: CL-05-OM exemption, CL-10-OM zero rating)
-- ------------------------------------------------------------------
INSERT INTO public.sys_tax_exempt_reason_cd
  (country, code, tax_category_code, name, name2, description, allows_free_text, display_order)
VALUES
  ('OM', 'VATEX-OM-01', 'EXEMPT', 'Qualifying Financial Services', 'الخدمات المالية المؤهلة', 'CL-05-OM', FALSE, 10),
  ('OM', 'VATEX-OM-02', 'EXEMPT', 'Educational Services and Related Goods and Services', 'الخدمات التعليمية والسلع والخدمات المرتبطة بها', 'CL-05-OM', FALSE, 20),
  ('OM', 'VATEX-OM-03', 'EXEMPT', 'Healthcare Services and related Goods and Services', 'خدمات الرعاية الصحية والسلع والخدمات المرتبطة بها', 'CL-05-OM', FALSE, 30),
  ('OM', 'VATEX-OM-04', 'EXEMPT', 'Rental of properties for residential purposes', 'تأجير العقارات للأغراض السكنية', 'CL-05-OM', FALSE, 40),
  ('OM', 'VATEX-OM-05', 'EXEMPT', 'Local Passenger Transport', 'النقل المحلي للركاب', 'CL-05-OM', FALSE, 50),
  ('OM', 'VATEX-OM-06', 'EXEMPT', 'Undeveloped land (bare land)', 'الأراضي غير المطورة (الأراضي الفضاء)', 'CL-05-OM', FALSE, 60),
  ('OM', 'VATEX-OM-07', 'EXEMPT', 'Resale of residential properties', 'إعادة بيع العقارات السكنية', 'CL-05-OM', FALSE, 70),
  ('OM', 'VATEX-OM-08', 'EXEMPT', 'Imported goods supplied to diplomatic and consular bodies, international organizations, and the heads and members of diplomatic and consular bodies', 'السلع المستوردة للهيئات الدبلوماسية والقنصلية والمنظمات الدولية ورؤساء وأعضاء الهيئات الدبلوماسية والقنصلية', 'CL-05-OM', FALSE, 80),
  ('OM', 'VATEX-OM-09', 'EXEMPT', 'Imports for the Armed Forces and Internal Security Forces', 'واردات القوات المسلحة وقوات الأمن الداخلي', 'CL-05-OM', FALSE, 90),
  ('OM', 'VATEX-OM-10', 'EXEMPT', 'Imported supplies for non-profit charities', 'الواردات للجمعيات الخيرية غير الربحية', 'CL-05-OM', FALSE, 100),
  ('OM', 'VATEX-OM-11', 'EXEMPT', 'Import of returned goods', 'استيراد السلع المعادة', 'CL-05-OM', FALSE, 110),
  ('OM', 'VATEX-OM-12', 'EXEMPT', 'Imported Goods in cases where the supply of such Goods is exempted from Tax or subject to Tax at a rate of zero percent in the Final Destination Point of Entry', 'السلع المستوردة في الحالات التي يكون فيها توريدها معفى من الضريبة أو خاضعاً لها بنسبة صفر في المائة في نقطة الدخول للوجهة النهائية', 'CL-05-OM', FALSE, 120),
  ('OM', 'VATZR-OM-01', 'ZERO_RATED', 'Qualifying Supply of Food items specified by a decision from the Chairman', 'التوريد المؤهل للمواد الغذائية المحددة بقرار من الرئيس', 'CL-10-OM', FALSE, 210),
  ('OM', 'VATZR-OM-02', 'ZERO_RATED', 'Qualifying Supply of Medicines and medical equipment', 'التوريد المؤهل للأدوية والمعدات الطبية', 'CL-10-OM', FALSE, 220),
  ('OM', 'VATZR-OM-03', 'ZERO_RATED', 'Supply of investment gold, silver, and platinum', 'توريد الذهب والفضة والبلاتين الاستثماري', 'CL-10-OM', FALSE, 230),
  ('OM', 'VATZR-OM-04', 'ZERO_RATED', 'Supplies of international and intra GCC transport of Goods or passengers', 'توريدات النقل الدولي والنقل بين دول مجلس التعاون للسلع أو الركاب', 'CL-10-OM', FALSE, 240),
  ('OM', 'VATZR-OM-05', 'ZERO_RATED', 'Supply of Services related to International and Intra GCC transportation of Goods or passengers', 'توريد الخدمات المرتبطة بالنقل الدولي والنقل بين دول مجلس التعاون للسلع أو الركاب', 'CL-10-OM', FALSE, 250),
  ('OM', 'VATZR-OM-06', 'ZERO_RATED', 'Supply of qualifying air, sea and land means of transport', 'توريد وسائل النقل الجوية والبحرية والبرية المؤهلة', 'CL-10-OM', FALSE, 260),
  ('OM', 'VATZR-OM-07', 'ZERO_RATED', 'Supply of rescue planes, and rescue and assistance boats', 'توريد طائرات الإنقاذ وقوارب الإنقاذ والمساعدة', 'CL-10-OM', FALSE, 270),
  ('OM', 'VATZR-OM-08', 'ZERO_RATED', 'Supply of oil, oil derivatives and natural gas', 'توريد النفط ومشتقاته والغاز الطبيعي', 'CL-10-OM', FALSE, 280),
  ('OM', 'VATZR-OM-09', 'ZERO_RATED', 'Export of service', 'تصدير الخدمات', 'CL-10-OM; export documents only', FALSE, 290),
  ('OM', 'VATZR-OM-10', 'ZERO_RATED', 'Direct export of goods', 'التصدير المباشر للسلع', 'CL-10-OM; export documents only', FALSE, 300),
  ('OM', 'VATZR-OM-11', 'ZERO_RATED', 'Indirect export of goods', 'التصدير غير المباشر للسلع', 'CL-10-OM; export documents only', FALSE, 310),
  ('OM', 'VATZR-OM-12', 'ZERO_RATED', 'Re-export of goods', 'إعادة تصدير السلع', 'CL-10-OM; export documents only', FALSE, 320),
  ('OM', 'VATZR-OM-13', 'ZERO_RATED', 'Supply from a Special Zone to a Special Zone, or within a Special Zone', 'التوريد من منطقة خاصة إلى منطقة خاصة أو داخل منطقة خاصة', 'CL-10-OM', FALSE, 330),
  ('OM', 'VATZR-OM-14', 'ZERO_RATED', 'Supply from Mainland to Special Zone', 'التوريد من البر الرئيسي إلى منطقة خاصة', 'CL-10-OM', FALSE, 340),
  ('OM', 'VATZR-OM-15', 'ZERO_RATED', 'Customs Duty Suspension Statuses to a Special Zone', 'التوريد من أوضاع تعليق الرسوم الجمركية إلى منطقة خاصة', 'CL-10-OM', FALSE, 350),
  ('OM', 'VATZR-OM-16', 'ZERO_RATED', 'Special Zone to Customs Duty Suspension Statuses', 'التوريد من منطقة خاصة إلى أوضاع تعليق الرسوم الجمركية', 'CL-10-OM', FALSE, 360)
ON CONFLICT (country, code) DO NOTHING;

COMMIT;
