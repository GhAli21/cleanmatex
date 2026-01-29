-- Migration: 0086_add_price_override_fields.sql
-- Description: Add fields for manual price overrides with audit trail
-- Date: 2026-01-27
-- Feature: Pricing System - Price Override

-- =====================================================
-- Add Price Override Fields to Order Items
-- =====================================================

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,3)
;

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS price_override NUMERIC(19,4),
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES org_users_mst(id);

-- Add index for queries
CREATE INDEX IF NOT EXISTS idx_order_items_price_override 
ON org_order_items_dtl(tenant_org_id, price_override) 
WHERE price_override IS NOT NULL;

COMMENT ON COLUMN org_order_items_dtl.price_override IS 'Manually overridden price (if different from calculated price)';
COMMENT ON COLUMN org_order_items_dtl.override_reason IS 'Reason for price override';
COMMENT ON COLUMN org_order_items_dtl.override_by IS 'User who applied the override';

