-- Migration 0105: Add audit and revision columns to org_orders_mst
BEGIN;

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

COMMENT ON COLUMN org_orders_mst.created_by IS 'User ID who created the order';
COMMENT ON COLUMN org_orders_mst.updated_by IS 'User ID who last updated the order';

COMMIT;
