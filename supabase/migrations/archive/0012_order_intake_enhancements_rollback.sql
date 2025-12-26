-- ==================================================================
-- 0012_order_intake_enhancements_rollback.sql
-- Purpose: Rollback script for PRD-004 order intake enhancements
-- Author: CleanMateX Development Team
-- Created: 2025-10-25
-- ==================================================================
-- WARNING: This will remove all order intake enhancement features.
-- Data in removed columns will be LOST.
-- Only run this if you need to rollback the migration completely.
-- ==================================================================

BEGIN;

-- ==================================================================
-- BACKUP REMINDER
-- ==================================================================

DO $$
BEGIN
  RAISE WARNING '========================================';
  RAISE WARNING 'ROLLBACK MIGRATION 0012';
  RAISE WARNING '========================================';
  RAISE WARNING 'This will remove:';
  RAISE WARNING '  - Preparation workflow fields';
  RAISE WARNING '  - Photo URLs';
  RAISE WARNING '  - QR codes and barcodes';
  RAISE WARNING '  - Order number generation function';
  RAISE WARNING '  - Performance indexes';
  RAISE WARNING '';
  RAISE WARNING 'Data in these columns will be PERMANENTLY LOST!';
  RAISE WARNING '';
  RAISE WARNING 'Make sure you have a backup before proceeding.';
  RAISE WARNING '========================================';
END $$;

-- ==================================================================
-- DROP INDEXES
-- ==================================================================

DROP INDEX IF EXISTS idx_orders_preparation_status;
DROP INDEX IF EXISTS idx_orders_received_at;
DROP INDEX IF EXISTS idx_orders_ready_by;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_service_category;
DROP INDEX IF EXISTS idx_orders_status_received;
DROP INDEX IF EXISTS idx_order_items_tenant;

-- ==================================================================
-- DROP FUNCTIONS
-- ==================================================================

DROP FUNCTION IF EXISTS generate_order_number(UUID);
DROP FUNCTION IF EXISTS get_order_number_prefix();
DROP FUNCTION IF EXISTS extract_order_sequence(TEXT);

-- ==================================================================
-- DROP CONSTRAINTS
-- ==================================================================

ALTER TABLE org_orders_mst DROP CONSTRAINT IF EXISTS chk_priority_multiplier;
ALTER TABLE org_orders_mst DROP CONSTRAINT IF EXISTS chk_bag_count;

-- ==================================================================
-- REMOVE COLUMNS FROM org_orders_mst
-- ==================================================================

-- Remove preparation workflow fields
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS preparation_status;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS prepared_at;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS prepared_by;

-- Remove override and multiplier fields
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS ready_by_override;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS priority_multiplier;

-- Remove media fields
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS photo_urls;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS qr_code;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS barcode;

-- Remove bag and service category fields
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS bag_count;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS service_category_code;

-- ==================================================================
-- REMOVE COLUMNS FROM org_order_items_dtl
-- ==================================================================

-- Remove denormalized product names
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS product_name;
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS product_name2;

-- Remove stain and damage notes
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS stain_notes;
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS damage_notes;

-- ==================================================================
-- VALIDATION
-- ==================================================================

DO $$
DECLARE
  v_column_count INTEGER;
BEGIN
  -- Verify columns removed from org_orders_mst
  SELECT COUNT(*)
  INTO v_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'org_orders_mst'
    AND column_name IN (
      'preparation_status', 'prepared_at', 'prepared_by',
      'ready_by_override', 'priority_multiplier', 'photo_urls',
      'bag_count', 'qr_code', 'barcode', 'service_category_code'
    );

  IF v_column_count > 0 THEN
    RAISE WARNING 'Warning: % columns still exist in org_orders_mst', v_column_count;
  ELSE
    RAISE NOTICE '✓ All columns removed from org_orders_mst';
  END IF;

  -- Verify columns removed from org_order_items_dtl
  SELECT COUNT(*)
  INTO v_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'org_order_items_dtl'
    AND column_name IN ('product_name', 'product_name2', 'stain_notes', 'damage_notes');

  IF v_column_count > 0 THEN
    RAISE WARNING 'Warning: % columns still exist in org_order_items_dtl', v_column_count;
  ELSE
    RAISE NOTICE '✓ All columns removed from org_order_items_dtl';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rollback of migration 0012 completed';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==================================================================
-- POST-ROLLBACK NOTES
-- ==================================================================

-- NEXT STEPS AFTER ROLLBACK:
-- 1. Update Prisma schema to remove new columns
-- 2. Regenerate Prisma client: npx prisma generate
-- 3. Remove TypeScript types for removed fields
-- 4. Remove API endpoints for order intake features
-- 5. Remove frontend components for order intake
-- 6. Remove utilities (order number, QR/barcode generators)

-- TO RE-APPLY MIGRATION:
-- Run: 0012_order_intake_enhancements.sql
