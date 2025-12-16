-- ==================================================================
-- 0047_migrate_existing_products.sql
-- Purpose: Migrate existing products to use item_type_code
-- Author: CleanMateX Development Team
-- Created: 2025-01-26
-- PRD: Product Catalog System Redesign
-- Dependencies: 0045_catalog_system_2027_architecture.sql, 0046_seed_catalog_reference_data.sql
-- ==================================================================
-- This migration:
-- 1. Maps existing product_group1 values to item_type_code
-- 2. Validates all active products have item_type_code
-- 3. Ensures data integrity
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: MAP product_group1 TO item_type_code
-- ==================================================================

-- Update existing products with item_type_code based on product_group1
UPDATE org_product_data_mst
SET item_type_code =
  CASE product_group1
    WHEN 'TOPS' THEN 'TOPS'
    WHEN 'BOTTOMS' THEN 'BOTTOMS'
    WHEN 'FULL_BODY' THEN 'FULL_BODY'
    WHEN 'OUTERWEAR' THEN 'OUTERWEAR'
    WHEN 'INTIMATE' THEN 'INTIMATE'
    WHEN 'SPECIAL' THEN 'SPECIAL'
    WHEN 'HOUSEHOLD' THEN 'HOUSEHOLD'
    WHEN 'RETAIL_GOODS' THEN 'RETAIL_GOODS'
    WHEN 'ACCESSORIES' THEN 'ACCESSORIES'
    ELSE 'OTHER'
  END,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_migration_0047'
WHERE item_type_code IS NULL;

-- ==================================================================
-- PART 2: VALIDATE DATA INTEGRITY
-- ==================================================================

-- Check for any active products missing item_type_code
DO $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_missing_count
  FROM org_product_data_mst
  WHERE item_type_code IS NULL
    AND is_active = true;

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % active products missing item_type_code', v_missing_count;
  END IF;

  RAISE NOTICE 'Migration validation passed: All active products have item_type_code';
END $$;

-- ==================================================================
-- PART 3: VERIFY ITEM_TYPE_CODE REFERENCES
-- ==================================================================

-- Check for any invalid item_type_code values
DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_invalid_count
  FROM org_product_data_mst p
  LEFT JOIN sys_item_type_cd t ON p.item_type_code = t.item_type_code
  WHERE p.item_type_code IS NOT NULL
    AND t.item_type_code IS NULL;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % products have invalid item_type_code values', v_invalid_count;
  END IF;

  RAISE NOTICE 'Migration validation passed: All item_type_code values are valid';
END $$;

-- ==================================================================
-- PART 4: MIGRATION SUMMARY
-- ==================================================================

DO $$
DECLARE
  v_total_products INTEGER;
  v_mapped_products INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_products FROM org_product_data_mst;
  SELECT COUNT(*) INTO v_mapped_products FROM org_product_data_mst WHERE item_type_code IS NOT NULL;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 0047 COMPLETED SUCCESSFULLY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total products: %', v_total_products;
  RAISE NOTICE 'Products with item_type_code: %', v_mapped_products;
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================
