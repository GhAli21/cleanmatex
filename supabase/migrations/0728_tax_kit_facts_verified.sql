-- 0728_tax_kit_facts_verified.sql
-- Tax Engine: kit facts checked against official sources (follow-ups F1–F6, KIT_FACTS.md §5).
--
-- 1. Gift card tax timing becomes a kit fact: new column sys_tax_kit_versions_mst.voucher_tax_mode,
--    the default for cards sold by an organization on that kit (the cashier may still override per card).
--      OM  SPV  Executive Regulations (Decision 53/2021) Art. 33–34: a single-purpose voucher is taxed
--               when issued; a laundry's own card fixes the place of supply and the tax at issue.
--      BH  SPV  NBR VAT Retail and Wholesale Guide: a voucher redeemable at one VAT rate is single-purpose.
--      AE  SPV  Federal Decree-Law 8/2017 (a voucher is supplied when issued) + Executive Regulation Art. 28.
--      SA  MPV  ZATCA VAT Implementing Regulations: issuing a face-value voucher is not a supply; VAT is due
--               when it is redeemed (only an amount paid above face value is taxed at issue).
-- 2. fn_tax_kit_version_clone copies the new column into HQ drafts (re-created from 0726, one column added).
-- 3. OM: simplified tax invoice only below OMR 500 excluding tax, with Tax Authority approval, and a full
--    invoice whenever the customer asks (Executive Regulations Art. 146–149).
-- 4. OM return layout replaced by the official form (Tax Authority VAT Return Filing guide, June 2021):
--    20 boxes 1a–7c. No tax line stores an OM box code yet (checked on remote), so the rows are replaced.
-- 5. SA return boxes 1–16 match the ZATCA (GAZT) portal form; simplified invoice to a consumer for any
--    amount (ZATCA E-Invoicing Detailed Guidelines) → verified.
-- 6. BH: version facts verified; return lines 1–16 stay unverified (only line 17 = net VAT is confirmed by the
--    NBR filing manual v1.2, 27 Feb 2025), so Setup Health keeps flagging them for HQ.
-- Published kit rows are locked (fn_tax_kit_lock_guard); this data fix uses app.tax_kit_seed.

BEGIN;

-- ─── 1. Gift card tax timing per kit version ──────────────────────────────
ALTER TABLE public.sys_tax_kit_versions_mst
  ADD COLUMN IF NOT EXISTS voucher_tax_mode TEXT NOT NULL DEFAULT 'MPV';
ALTER TABLE public.sys_tax_kit_versions_mst DROP CONSTRAINT IF EXISTS ck_stkv_voucher_tax_mode RESTRICT;
ALTER TABLE public.sys_tax_kit_versions_mst
  ADD CONSTRAINT ck_stkv_voucher_tax_mode CHECK (voucher_tax_mode IN ('SPV', 'MPV'));
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.voucher_tax_mode IS
  'Default tax timing for gift cards sold under this kit: SPV = taxed at sale (single-purpose), MPV = taxed when used. Same values as org_gift_cards_mst.voucher_tax_mode; the cashier may override per card.';
COMMENT ON CONSTRAINT ck_stkv_voucher_tax_mode ON public.sys_tax_kit_versions_mst IS
  'Same values as ck_ogc_voucher_tax_mode on org_gift_cards_mst.';

SET LOCAL app.tax_kit_seed = 'on';

UPDATE public.sys_tax_kit_versions_mst
   SET voucher_tax_mode = 'SPV', simplified_max_amount = 500, is_verified = true, checked_on = DATE '2026-11-12',
       source_url = 'https://mzv.gov.cz/public/aa/7/49/4259098_2607346_VAT_Regulation_unofficial_english_version.pdf',
       review_notes = 'Verified 2026-11-12: return layout from the Tax Authority VAT Return Filing guide (June 2021); simplified invoice below OMR 500 excl. VAT with Tax Authority approval, full invoice on request (Exec. Regs Art. 146-149); vouchers SPV taxed at issue (Art. 33-34).',
       updated_by = 'migration_0728', updated_info = 'Tax kit facts verified'
 WHERE kit_code = 'OM_VAT' AND status = 'PUBLISHED';

UPDATE public.sys_tax_kit_versions_mst
   SET voucher_tax_mode = 'MPV', is_verified = true, checked_on = DATE '2026-11-12',
       source_url = 'https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf',
       review_notes = 'Verified 2026-11-12: simplified invoice to consumers for any amount, B2B below SAR 1,000 (ZATCA E-Invoicing Detailed Guidelines); face-value vouchers taxed at redemption (VAT Implementing Regulations); return boxes 1-16 per the ZATCA portal form.',
       updated_by = 'migration_0728', updated_info = 'Tax kit facts verified'
 WHERE kit_code = 'SA_VAT' AND status = 'PUBLISHED';

UPDATE public.sys_tax_kit_versions_mst
   SET voucher_tax_mode = 'SPV', is_verified = true, checked_on = DATE '2026-11-12',
       source_url = 'https://tax.gov.ae/DataFolder/Files/Pdf/VAT-Decree-Law-No-8-of-2017.pdf',
       review_notes = 'Verified 2026-11-12: a voucher is supplied when issued (Decree-Law 8/2017, Executive Regulation Art. 28); a laundry''s own card is single-purpose. Return layout VAT 201 with emirate split.',
       updated_by = 'migration_0728', updated_info = 'Tax kit facts verified'
 WHERE kit_code = 'AE_VAT' AND status = 'PUBLISHED';

UPDATE public.sys_tax_kit_versions_mst
   SET voucher_tax_mode = 'SPV', is_verified = true, checked_on = DATE '2026-11-12',
       review_notes = 'Verified 2026-11-12: vouchers redeemable at one VAT rate are single-purpose (NBR VAT Retail and Wholesale Guide). Return lines 1-16: titles still to confirm on the NBR portal (line 17 = net VAT confirmed by the NBR filing manual v1.2, 27 Feb 2025).',
       updated_by = 'migration_0728', updated_info = 'Tax kit facts verified'
 WHERE kit_code = 'BH_VAT' AND status = 'PUBLISHED';

-- ─── 2. HQ drafts copy the new column (re-created from 0726) ──────────────
CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_clone(p_version_id UUID, p_actor TEXT)
RETURNS UUID LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  v_src  public.sys_tax_kit_versions_mst%ROWTYPE;
  v_new  UUID;
  v_no   INTEGER;
  v_info TEXT := 'fn_tax_kit_version_clone';
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_src FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id AND rec_status = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  -- One draft per kit, so two HQ users never edit competing drafts.
  PERFORM 1 FROM public.sys_tax_kits_mst WHERE kit_code = v_src.kit_code FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst WHERE kit_code = v_src.kit_code AND status = 'DRAFT' AND rec_status = 1) THEN
    RAISE EXCEPTION 'TAX_KIT_DRAFT_EXISTS: kit % already has a draft version', v_src.kit_code USING ERRCODE = '55000';
  END IF;
  SELECT COALESCE(max(version_no), 0) + 1 INTO v_no FROM public.sys_tax_kit_versions_mst WHERE kit_code = v_src.kit_code;

  INSERT INTO public.sys_tax_kit_versions_mst
    (kit_code, version_no, status, effective_from, effective_to, currency_code, mandatory_reg_threshold, voluntary_reg_threshold,
     simplified_max_amount, rounding_level, rounding_mode, tax_on_advance, voucher_tax_mode, is_verified, source_url, checked_on,
     review_notes, created_by, created_info)
  VALUES
    (v_src.kit_code, v_no, 'DRAFT', GREATEST(CURRENT_DATE + 1, v_src.effective_from), NULL, v_src.currency_code,
     v_src.mandatory_reg_threshold, v_src.voluntary_reg_threshold, v_src.simplified_max_amount, v_src.rounding_level,
     v_src.rounding_mode, v_src.tax_on_advance, v_src.voucher_tax_mode, false, v_src.source_url, NULL, v_src.review_notes,
     p_actor, v_info)
  RETURNING id INTO v_new;

  INSERT INTO public.sys_tax_kit_codes_dtl
    (kit_version_id, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
     calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status, created_by, created_info)
  SELECT v_new, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
         calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_codes_dtl WHERE kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_item_classes_dtl
    (kit_version_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
     is_active, rec_status, created_by, created_info)
  SELECT v_new, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
         is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_item_classes_dtl WHERE kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_rules_dtl
    (kit_version_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
     segment_codes, priority, name, name2, is_active, rec_status, created_by, created_info)
  SELECT v_new, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
         segment_codes, priority, name, name2, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_rules_dtl WHERE kit_version_id = p_version_id;

  -- Rule codes follow their rule by rule_code (rule ids are new).
  INSERT INTO public.sys_tax_kit_rule_codes_dtl
    (rule_id, kit_version_id, seq_no, tax_code, is_active, rec_status, created_by, created_info)
  SELECT nr.id, v_new, rc.seq_no, rc.tax_code, rc.is_active, rc.rec_status, p_actor, v_info
    FROM public.sys_tax_kit_rule_codes_dtl rc
    JOIN public.sys_tax_kit_rules_dtl orl ON orl.id = rc.rule_id AND orl.kit_version_id = p_version_id
    JOIN public.sys_tax_kit_rules_dtl nr  ON nr.kit_version_id = v_new AND nr.rule_code = orl.rule_code
   WHERE rc.kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_vectors_dtl
    (kit_version_id, vector_code, description, description2, input, expected, is_active, rec_status, created_by, created_info)
  SELECT v_new, vector_code, description, description2, input, expected, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_vectors_dtl WHERE kit_version_id = p_version_id;

  RETURN v_new;
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_version_clone(UUID, TEXT) IS
  'HQ: copies a kit version (codes, item classes, rules + rule codes, examples) into a new DRAFT version (next version_no, effective from tomorrow at the earliest, not verified). One draft per kit (TAX_KIT_DRAFT_EXISTS). Returns the draft id. Caller checks permission and writes the audit log.';

-- ─── 4. Oman return layout: the official form ─────────────────────────────
-- Removal intent: the old 9-box layout used guessed numbers; replaced by the official 20 boxes.
DELETE FROM public.sys_tax_return_box_map_dtl WHERE kit_code = 'OM_VAT';
DELETE FROM public.sys_tax_return_box_cd WHERE kit_code = 'OM_VAT';

INSERT INTO public.sys_tax_return_box_cd
  (kit_code, box_code, section_code, box_kind, shows_amount, shows_tax, name, name2, description, display_order,
   is_verified, source_url, created_by, created_info)
VALUES
  ('OM_VAT', '1a', 'SALES', 'LINES', true, true, 'Supplies of goods / services taxed at 5%', 'التوريدات من السلع والخدمات الخاضعة لنسبة 5%', 'Standard-rated supplies in Oman, VAT-exclusive value.', 10, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1b', 'SALES', 'LINES', true, false, 'Supplies of goods / services taxed at 0%', 'التوريدات من السلع والخدمات الخاضعة لنسبة 0%', 'Zero-rated supplies in Oman, excluding exports.', 20, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1c', 'SALES', 'LINES', true, false, 'Supplies of goods / services tax exempt', 'التوريدات من السلع والخدمات المعفاة', 'Exempt supplies in Oman; out-of-scope supplies excluded.', 30, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1d', 'SALES', 'MANUAL', true, true, 'Supplies of goods, tax levy shifted to recipient inside GCC', 'توريدات السلع التي ينتقل فيها عبء الضريبة إلى المستلم داخل دول المجلس', 'Not activated until the GCC rules apply.', 40, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1e', 'SALES', 'MANUAL', true, true, 'Supplies of services, tax levy shifted to recipient inside GCC', 'توريدات الخدمات التي ينتقل فيها عبء الضريبة إلى المستلم داخل دول المجلس', 'Not activated until the GCC rules apply.', 50, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1f', 'SALES', 'MANUAL', true, true, 'Supply of goods as per profit margin scheme', 'توريد السلع وفق نظام هامش الربح', 'Profit margin excluding VAT on used goods sold under the margin scheme.', 60, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '2a', 'SALES', 'MANUAL', true, true, 'Purchases from the GCC subject to reverse charge', 'المشتريات من دول المجلس الخاضعة لآلية الاحتساب العكسي', 'Not activated until the GCC rules apply.', 70, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '2b', 'SALES', 'LINES', true, true, 'Purchases from outside the GCC subject to reverse charge', 'المشتريات من خارج دول المجلس الخاضعة لآلية الاحتساب العكسي', 'Standard-rated supplies received under the reverse charge, VAT-exclusive value.', 80, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '3a', 'SALES', 'MANUAL', true, false, 'Exports', 'الصادرات', 'Zero-rated exports of goods and services.', 90, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '4a', 'SALES', 'MANUAL', true, true, 'Import of goods (postponed payment)', 'استيراد السلع (الدفع المؤجل)', 'Goods imported with VAT postponed at import.', 100, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '4b', 'SALES', 'MANUAL', true, false, 'Total goods imported', 'إجمالي السلع المستوردة', 'All other imports (VAT paid at customs, zero-rated or exempt), excluding box 4a.', 110, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5a', 'NET', 'TOTAL', false, true, 'Total VAT due (1a + 1f + 2a + 2b + 4a)', 'إجمالي الضريبة المستحقة (1أ + 1و + 2أ + 2ب + 4أ)', 'VAT due before adjustments.', 120, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5b', 'NET', 'MANUAL', false, true, 'Adjustment of VAT due', 'تعديلات الضريبة المستحقة', 'Bad debts, refunds, returns and other adjustments to output VAT.', 130, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6a', 'PURCHASES', 'LINES', true, true, 'Purchases (except import of goods)', 'المشتريات (عدا استيراد السلع)', 'All purchases excluding imported goods and fixed assets; recoverable VAT after apportionment.', 140, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6b', 'PURCHASES', 'MANUAL', true, true, 'Import of goods', 'استيراد السلع', 'Standard-rated imported goods and their deductible VAT.', 150, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6c', 'PURCHASES', 'MANUAL', false, true, 'VAT on acquisition of fixed assets', 'ضريبة اقتناء الأصول الثابتة', 'Deductible VAT on capital assets.', 160, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6d', 'PURCHASES', 'MANUAL', false, true, 'Adjustment of input VAT credit', 'تعديلات ضريبة المدخلات القابلة للخصم', 'Bad debts, refunds, returns and other adjustments to deductible VAT.', 170, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7a', 'NET', 'TOTAL', false, true, 'Total VAT due (5a + 5b)', 'إجمالي الضريبة المستحقة (5أ + 5ب)', 'VAT due for the period.', 180, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7b', 'NET', 'TOTAL', false, true, 'Total input VAT credit (6a + 6b + 6c + 6d)', 'إجمالي ضريبة المدخلات (6أ + 6ب + 6ج + 6د)', 'Deductible input VAT for the period.', 190, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7c', 'NET', 'TOTAL', false, true, 'Net VAT payable or refundable (7a - 7b)', 'صافي الضريبة المستحقة أو القابلة للاسترداد (7أ - 7ب)', 'Positive: payable. Negative: refundable.', 200, true, 'https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409', 'migration_0728', 'Tax kit facts verified');

INSERT INTO public.sys_tax_return_box_map_dtl
  (kit_code, box_code, map_no, source_kind, tax_flow_code, tax_category_code, is_reverse_charge, tax_measure,
   source_box_code, sign, created_by, created_info)
VALUES
  ('OM_VAT', '1a', 1, 'LINES', 'OUTPUT', 'STANDARD', false, 'TAX', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1b', 1, 'LINES', 'OUTPUT', 'ZERO_RATED', NULL, 'TAX', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '1c', 1, 'LINES', 'OUTPUT', 'EXEMPT', NULL, 'TAX', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '2b', 1, 'LINES', 'INPUT', 'STANDARD', true, 'TAX', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5a', 1, 'BOX', NULL, NULL, NULL, NULL, '1a', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5a', 2, 'BOX', NULL, NULL, NULL, NULL, '1f', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5a', 3, 'BOX', NULL, NULL, NULL, NULL, '2a', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5a', 4, 'BOX', NULL, NULL, NULL, NULL, '2b', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '5a', 5, 'BOX', NULL, NULL, NULL, NULL, '4a', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6a', 1, 'LINES', 'INPUT', 'STANDARD', NULL, 'RECOVERABLE', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6a', 2, 'LINES', 'INPUT', 'ZERO_RATED', NULL, 'RECOVERABLE', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '6a', 3, 'LINES', 'INPUT', 'EXEMPT', NULL, 'RECOVERABLE', NULL, 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7a', 1, 'BOX', NULL, NULL, NULL, NULL, '5a', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7a', 2, 'BOX', NULL, NULL, NULL, NULL, '5b', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7b', 1, 'BOX', NULL, NULL, NULL, NULL, '6a', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7b', 2, 'BOX', NULL, NULL, NULL, NULL, '6b', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7b', 3, 'BOX', NULL, NULL, NULL, NULL, '6c', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7b', 4, 'BOX', NULL, NULL, NULL, NULL, '6d', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7c', 1, 'BOX', NULL, NULL, NULL, NULL, '7a', 1, 'migration_0728', 'Tax kit facts verified'),
  ('OM_VAT', '7c', 2, 'BOX', NULL, NULL, NULL, NULL, '7b', -1, 'migration_0728', 'Tax kit facts verified');

-- ─── 5. Saudi return boxes confirmed ──────────────────────────────────────
UPDATE public.sys_tax_return_box_cd
   SET is_verified = true,
       source_url = 'https://tallysolutions.com/mena/wp-content/uploads/2018/vat/VAT%20Return.pdf',
       updated_by = 'migration_0728', updated_info = 'Tax kit facts verified'
 WHERE kit_code = 'SA_VAT';

-- ─── 6. Bahrain: net line confirmed, lines 1–16 still to confirm ──────────
UPDATE public.sys_tax_return_box_cd
   SET is_verified = true, updated_by = 'migration_0728', updated_info = 'Line 17 = net VAT (NBR filing manual v1.2)'
 WHERE kit_code = 'BH_VAT' AND box_code = '17';

COMMIT;
