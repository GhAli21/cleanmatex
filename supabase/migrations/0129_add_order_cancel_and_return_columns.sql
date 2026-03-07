-- ==================================================================
-- 0129_add_order_cancel_and_return_columns.sql
-- Purpose: Add cancel and return columns to org_orders_mst
-- Plan: cancel_and_return_order_ddb29821.plan.md
-- ==================================================================

BEGIN;

-- Cancel columns
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID,
  ADD COLUMN IF NOT EXISTS cancelled_note TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason_code VARCHAR(50);

COMMENT ON COLUMN org_orders_mst.cancelled_at IS 'When order was cancelled';
COMMENT ON COLUMN org_orders_mst.cancelled_by IS 'User who cancelled the order';
COMMENT ON COLUMN org_orders_mst.cancelled_note IS 'Cancellation reason (required)';
COMMENT ON COLUMN org_orders_mst.cancellation_reason_code IS 'Structured reason code (CUSTOMER_REQUEST, DUPLICATE, etc.)';

-- Return columns (for customer return flow)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_by UUID,
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_reason_code VARCHAR(50);

COMMENT ON COLUMN org_orders_mst.returned_at IS 'When customer returned items to facility';
COMMENT ON COLUMN org_orders_mst.returned_by IS 'Staff who processed customer return';
COMMENT ON COLUMN org_orders_mst.return_reason IS 'Reason for customer return';
COMMENT ON COLUMN org_orders_mst.return_reason_code IS 'Structured return reason (CHANGED_MIND, QUALITY_ISSUE, etc.)';

COMMIT;
