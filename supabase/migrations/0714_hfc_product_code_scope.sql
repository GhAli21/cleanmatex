-- ============================================================================
-- Migration: 0714_hfc_product_code_scope.sql
-- Purpose:   Align Human-Friendly Code registry metadata with the approved
--            category-scoped product-code uniqueness contract.
-- Affected:  public.sys_doc_seq_type_cd (PRODUCT and STOCK_ITEM registry rows)
-- Related:   0667_doc_seq_type_config.sql, 0700_retire_product_express_cols.sql
-- ============================================================================
-- Product codes may repeat in one organization only when their service categories differ
-- (for example, SHIRT in IRON_ONLY and DRY_CLEAN). Migration 0700 deliberately enforces
-- uniqueness on (tenant_org_id, service_category_code, product_code); the registry must
-- declare the same scope so the consistency screen does not report a false contract mismatch.

BEGIN;

SET LOCAL lock_timeout = '10s';

-- This is registry metadata only. It does not alter the existing product constraint, generated
-- code behavior, or any product row.
UPDATE public.sys_doc_seq_type_cd
   SET unique_with = ARRAY['tenant_org_id', 'service_category_code']::TEXT[],
       updated_at = now(),
       updated_by = 'migration_0714',
       updated_info = '0714 aligns PRODUCT and STOCK_ITEM uniqueness metadata with category-scoped product codes'
 WHERE doc_type_code IN ('PRODUCT', 'STOCK_ITEM')
   AND unique_with IS DISTINCT FROM ARRAY['tenant_org_id', 'service_category_code']::TEXT[];

DO $$
DECLARE
  v_matching_rows INTEGER;
BEGIN
  SELECT count(*)
    INTO v_matching_rows
    FROM public.sys_doc_seq_type_cd
   WHERE doc_type_code IN ('PRODUCT', 'STOCK_ITEM')
     AND unique_with = ARRAY['tenant_org_id', 'service_category_code']::TEXT[];

  IF v_matching_rows <> 2 THEN
    RAISE EXCEPTION
      '0714 expected category-scoped uniqueness metadata for PRODUCT and STOCK_ITEM; found % matching rows',
      v_matching_rows;
  END IF;
END $$;

COMMIT;
