-- =============================================================================
-- 0730_tax_ae_return_boxes_verified.sql
-- Purpose:   Mark the 20 UAE VAT 201 return boxes verified. They were seeded in
--            an earlier tax kit migration from secondary sources (Zoho, ERPNext,
--            Tally). The FTA's official EmaraTax manual "VAT 201 - VAT Returns
--            form - User Manual" (Oct 2022, v1.0.0.0, pages 18-25) confirms the
--            same layout, so no box title or map changes:
--              1a-1g standard-rated supplies per emirate; 2 tourist refunds
--              (pre-filled from Planet Tax Free); 3 supplies subject to the
--              reverse charge; 4 zero-rated; 5 exempt; 6 goods imported (from
--              customs); 7 adjustments to 6; 8 = total of 1-7 (outputs);
--              9 standard-rated expenses; 10 reverse-charge supplies (inputs);
--              11 total inputs; 12 total output tax; 13 total input tax;
--              14 payable / refundable tax.
-- Tables:    sys_tax_return_box_cd (data only; no DDL).
-- Idempotent: plain UPDATE.
-- Rollback (manual): set is_verified = false and the previous source_url.
-- =============================================================================

BEGIN;

-- Kit data is locked (fn_tax_kit_lock_guard); this data fix uses app.tax_kit_seed.
SET LOCAL app.tax_kit_seed = 'on';

UPDATE public.sys_tax_return_box_cd
   SET is_verified  = true,
       source_url   = 'https://tax.gov.ae/DownloadOpenTextFile?fileUrl=en%2FVAT_VAT_Guides%2FVAT_Returns_form%2FProcess_the_VAT_201_returns_form_EN.pdf',
       updated_at   = NOW(),
       updated_by   = 'migration_0730',
       updated_info = 'Confirmed by FTA VAT 201 user manual (Oct 2022)'
 WHERE kit_code = 'AE_VAT';

COMMIT;
