-- ================================================================
-- Migration: Add Order Customer Snapshot Columns to org_orders_mst
-- ================================================================
-- Purpose: Store customer snapshot at order time (name, phone, email, details)
-- and flag when default guest customer is used.
--
-- Created: 2026-03-06
-- Migration: 0125_add_order_customer_snapshot_columns.sql
--
-- Columns:
--   is_default_customer     - true when order used tenant default guest customer
--   customer_mobile_number  - snapshot of customer phone at order time
--   customer_email          - snapshot of customer email at order time
--   customer_name          - snapshot of customer display name at order time
--   customer_details       - extended snapshot (address, notes, etc.) as JSONB
-- ================================================================

-- Add columns to org_orders_mst
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS is_default_customer BOOLEAN DEFAULT false;

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS customer_mobile_number TEXT;

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS customer_details JSONB;

-- Add comments for audit
COMMENT ON COLUMN org_orders_mst.is_default_customer IS 'True when order used tenant default guest customer (TENANT_DEFAULT_GUEST_CUSTOMER_ID)';
COMMENT ON COLUMN org_orders_mst.customer_mobile_number IS 'Snapshot of customer phone at order creation time';
COMMENT ON COLUMN org_orders_mst.customer_email IS 'Snapshot of customer email at order creation time';
COMMENT ON COLUMN org_orders_mst.customer_name IS 'Snapshot of customer display name at order creation time';
COMMENT ON COLUMN org_orders_mst.customer_details IS 'Extended customer snapshot (firstName, lastName, address, etc.) as JSONB';
