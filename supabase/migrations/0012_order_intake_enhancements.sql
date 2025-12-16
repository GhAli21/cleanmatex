-- ==================================================================
-- 0012_order_intake_enhancements.sql
-- Purpose: Order intake and preparation enhancements for PRD-004
-- Author: CleanMateX Development Team
-- Created: 2025-10-25
-- Dependencies: 0001_core_schema.sql
-- ==================================================================
-- This migration adds:
-- - Preparation workflow fields to org_orders_mst
-- - Order number generation function
-- - QR code and barcode fields
-- - Photo upload support
-- - Item detail enhancements
-- - Performance indexes
-- ==================================================================

BEGIN;

-- ==================================================================
-- ALTER org_orders_mst - Add Preparation Workflow Fields
-- ==================================================================

-- Preparation workflow status
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(20) DEFAULT 'pending';
COMMENT ON COLUMN org_orders_mst.preparation_status IS 'Preparation status: pending, in_progress, completed';

-- Preparation timestamps and user
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;
COMMENT ON COLUMN org_orders_mst.prepared_at IS 'When preparation was completed';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS prepared_by UUID;
COMMENT ON COLUMN org_orders_mst.prepared_by IS 'User who completed preparation (references auth.users)';

-- Ready-By date override
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS ready_by_override TIMESTAMP;
COMMENT ON COLUMN org_orders_mst.ready_by_override IS 'Manual override for Ready-By date (takes precedence over calculated date)';

-- Priority multiplier for turnaround calculation
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS priority_multiplier NUMERIC(4,2) DEFAULT 1.0;
COMMENT ON COLUMN org_orders_mst.priority_multiplier IS 'Priority multiplier: normal=1.0, urgent=0.7, express=0.5';

-- Photo URLs (JSONB array)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::JSONB;
COMMENT ON COLUMN org_orders_mst.photo_urls IS 'Array of photo URLs from MinIO storage: ["https://storage.../photo1.jpg"]';

-- Bag count for Quick Drop orders
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS bag_count INTEGER DEFAULT 1;
COMMENT ON COLUMN org_orders_mst.bag_count IS 'Number of bags received during Quick Drop intake';

-- QR Code (data URL or external URL)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS qr_code TEXT;
COMMENT ON COLUMN org_orders_mst.qr_code IS 'QR code data URL (data:image/png;base64,...) for label printing';

-- Barcode (data URL or external URL)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS barcode TEXT;
COMMENT ON COLUMN org_orders_mst.barcode IS 'Barcode data URL (data:image/png;base64,...) for label printing';

-- Service category code (primary service for order)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS service_category_code VARCHAR(120);
COMMENT ON COLUMN org_orders_mst.service_category_code IS 'Primary service category for order (wash_fold, dry_clean, etc.)';

-- Add constraint to ensure priority_multiplier is valid
ALTER TABLE org_orders_mst
  ADD CONSTRAINT chk_priority_multiplier
  CHECK (priority_multiplier >= 0.1 AND priority_multiplier <= 2.0);

-- Add constraint to ensure bag_count is positive
ALTER TABLE org_orders_mst
  ADD CONSTRAINT chk_bag_count
  CHECK (bag_count > 0 AND bag_count <= 100);

-- ==================================================================
-- ALTER org_order_items_dtl - Add Item Detail Fields
-- ==================================================================

-- Denormalized product names (for performance - avoid joins in queries)
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(250);
COMMENT ON COLUMN org_order_items_dtl.product_name IS 'Product name (English) - denormalized from org_product_data_mst';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS product_name2 VARCHAR(250);
COMMENT ON COLUMN org_order_items_dtl.product_name2 IS 'Product name (Arabic) - denormalized from org_product_data_mst';

-- Stain and damage details
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS stain_notes TEXT;
COMMENT ON COLUMN org_order_items_dtl.stain_notes IS 'Detailed notes about stains on item (e.g., "Coffee stain on left sleeve")';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS damage_notes TEXT;
COMMENT ON COLUMN org_order_items_dtl.damage_notes IS 'Detailed notes about damage to item (e.g., "Missing button, torn pocket")';

-- ==================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==================================================================

-- Index for preparation status queries (dashboard: "pending preparation")
CREATE INDEX IF NOT EXISTS idx_orders_preparation_status
  ON org_orders_mst(tenant_org_id, preparation_status);

-- Index for received_at sorting (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_received_at
  ON org_orders_mst(tenant_org_id, received_at DESC);

-- Index for ready_by date queries (dashboard: "ready today", "overdue")
CREATE INDEX IF NOT EXISTS idx_orders_ready_by
  ON org_orders_mst(tenant_org_id, ready_by);

-- Index for status filtering (dashboard filters)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON org_orders_mst(tenant_org_id, status);

-- Index for service category reporting
CREATE INDEX IF NOT EXISTS idx_orders_service_category
  ON org_orders_mst(tenant_org_id, service_category_code);

-- Composite index for common queries (status + received_at)
CREATE INDEX IF NOT EXISTS idx_orders_status_received
  ON org_orders_mst(tenant_org_id, status, received_at DESC);

-- Index for order items by tenant (for cross-tenant isolation verification)
CREATE INDEX IF NOT EXISTS idx_order_items_tenant
  ON org_order_items_dtl(tenant_org_id);

-- ==================================================================
-- ORDER NUMBER GENERATION FUNCTION
-- ==================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS generate_order_number(UUID);

-- Create function to generate unique order number per tenant per day
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date TEXT;
  v_sequence INTEGER;
  v_order_number TEXT;
  v_max_attempts INTEGER := 10;
  v_attempt INTEGER := 0;
BEGIN
  -- Get current date in YYYYMMDD format (tenant's timezone)
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Loop to handle rare race conditions
  LOOP
    v_attempt := v_attempt + 1;

    -- Get next sequence number for this tenant and date
    -- Using FOR UPDATE to prevent race conditions
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM 14) AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM org_orders_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND order_no LIKE 'ORD-' || v_date || '-%';

    -- Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20251025-0001)
    v_order_number := 'ORD-' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');

    -- Verify uniqueness
    IF NOT EXISTS (
      SELECT 1 FROM org_orders_mst
      WHERE tenant_org_id = p_tenant_org_id
        AND order_no = v_order_number
    ) THEN
      RETURN v_order_number;
    END IF;

    -- If we've tried too many times, raise exception
    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', v_max_attempts;
    END IF;

    -- Small delay before retry (1ms)
    PERFORM pg_sleep(0.001);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION generate_order_number(UUID) IS
'Generate unique order number per tenant per day in format ORD-YYYYMMDD-XXXX. Thread-safe with retry logic.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_order_number(UUID) TO authenticated;

-- ==================================================================
-- HELPER FUNCTIONS
-- ==================================================================

-- Function to get order number prefix for today
CREATE OR REPLACE FUNCTION get_order_number_prefix()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
$$;

COMMENT ON FUNCTION get_order_number_prefix() IS
'Get order number prefix for current date (e.g., "ORD-20251025-")';

-- Function to extract sequence number from order number
CREATE OR REPLACE FUNCTION extract_order_sequence(p_order_no TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CAST(SUBSTRING(p_order_no FROM 14) AS INTEGER);
$$;

COMMENT ON FUNCTION extract_order_sequence(TEXT) IS
'Extract sequence number from order number (e.g., "ORD-20251025-0001" → 1)';

-- ==================================================================
-- UPDATE EXISTING DATA (if needed)
-- ==================================================================

-- Set default priority_multiplier based on existing priority field
UPDATE org_orders_mst
SET priority_multiplier = CASE
  WHEN priority = 'express' THEN 0.5
  WHEN priority = 'urgent' THEN 0.7
  ELSE 1.0
END
WHERE priority_multiplier IS NULL;

-- Set default service_category_code from bag_count (Quick Drop indicator)
-- This is a best-guess migration; manual review may be needed
UPDATE org_orders_mst o
SET service_category_code = 'WASH_AND_FOLD'
WHERE service_category_code IS NULL
  AND bag_count > 1;

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_column_count INTEGER;
  v_index_count INTEGER;
  v_function_exists BOOLEAN;
BEGIN
  -- Verify new columns exist in org_orders_mst
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

  IF v_column_count != 10 THEN
    RAISE EXCEPTION 'Expected 10 new columns in org_orders_mst, found %', v_column_count;
  END IF;

  -- Verify new columns exist in org_order_items_dtl
  SELECT COUNT(*)
  INTO v_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'org_order_items_dtl'
    AND column_name IN ('product_name', 'product_name2', 'stain_notes', 'damage_notes');

  IF v_column_count != 4 THEN
    RAISE EXCEPTION 'Expected 4 new columns in org_order_items_dtl, found %', v_column_count;
  END IF;

  -- Verify indexes exist
  SELECT COUNT(*)
  INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_orders_preparation_status',
      'idx_orders_received_at',
      'idx_orders_ready_by',
      'idx_orders_status',
      'idx_orders_service_category',
      'idx_orders_status_received',
      'idx_order_items_tenant'
    );

  IF v_index_count != 7 THEN
    RAISE WARNING 'Expected 7 new indexes, found %. This may be acceptable if some indexes already existed.', v_index_count;
  END IF;

  -- Verify function exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_order_number'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Function generate_order_number does not exist';
  END IF;

  RAISE NOTICE '✓ Migration 0012 validation passed successfully';
  RAISE NOTICE '  - 10 columns added to org_orders_mst';
  RAISE NOTICE '  - 4 columns added to org_order_items_dtl';
  RAISE NOTICE '  - % indexes created', v_index_count;
  RAISE NOTICE '  - generate_order_number() function created';
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Update Prisma schema to include new columns
-- 2. Regenerate Prisma client: npx prisma generate
-- 3. Create TypeScript types for new fields
-- 4. Implement order number generator utility
-- 5. Implement QR/barcode generator utility
-- 6. Create API endpoints for order intake
-- 7. Build frontend components

-- TESTING:
-- 1. Test order number generation:
--    SELECT generate_order_number('tenant-uuid-here');
-- 2. Verify uniqueness across concurrent calls
-- 3. Test RLS policies still work correctly
-- 4. Test indexes improve query performance

-- ROLLBACK:
-- If you need to rollback this migration:
-- Run: 0012_order_intake_enhancements_rollback.sql
