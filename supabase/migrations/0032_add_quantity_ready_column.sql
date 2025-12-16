-- Migration: Add quantity_ready column to org_order_items_dtl
-- Created: 2025-11-08
-- Description: Add quantity_ready column to track how many pieces are ready per order item
-- This supports piece-level processing tracking in the processing modal

BEGIN;

-- Add quantity_ready column to track ready pieces
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS quantity_ready INTEGER DEFAULT 0;

-- Add check constraint to ensure quantity_ready is valid
ALTER TABLE org_order_items_dtl
  ADD CONSTRAINT quantity_ready_check
  CHECK (quantity_ready >= 0 AND quantity_ready <= quantity);

-- Add comment for documentation
COMMENT ON COLUMN org_order_items_dtl.quantity_ready IS
  'Number of pieces marked as ready for this item (must be between 0 and quantity). Example: if quantity=3 and quantity_ready=2, then 2 out of 3 pieces are ready for delivery.';

-- Add index for efficient querying of items with ready pieces
CREATE INDEX IF NOT EXISTS idx_order_items_quantity_ready
  ON org_order_items_dtl(tenant_org_id, quantity_ready)
  WHERE quantity_ready > 0;

-- Add index for items that are partially ready (some pieces ready but not all)
CREATE INDEX IF NOT EXISTS idx_order_items_partially_ready
  ON org_order_items_dtl(tenant_org_id, order_id)
  WHERE quantity_ready > 0 AND quantity_ready < quantity;

COMMIT;
