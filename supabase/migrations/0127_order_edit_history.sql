-- Migration: Order Edit History
-- Description: Creates comprehensive audit table for tracking all order edits with before/after snapshots
-- PRD: Edit Order Feature - Phase 1 - Full Audit Tracking
-- Date: 2026-03-07

-- Create org_order_edit_history table
CREATE TABLE IF NOT EXISTS org_order_edit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  order_no TEXT,
  edit_number INTEGER NOT NULL,
  edited_by UUID NOT NULL,
  edited_by_name TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,

  -- Snapshots (full order state before/after)
  snapshot_before JSONB NOT NULL,
  snapshot_after JSONB NOT NULL,

  -- Structured change summary
  changes JSONB NOT NULL,
  change_summary TEXT,

  -- Payment adjustment info
  payment_adjusted BOOLEAN DEFAULT FALSE,
  payment_adjustment_amount DECIMAL(19, 4),
  payment_adjustment_type TEXT CHECK (payment_adjustment_type IN ('CHARGE', 'REFUND')),

  CONSTRAINT fk_order_edit_history_order FOREIGN KEY (order_id)
    REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_edit_history_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_edit_history_user FOREIGN KEY (edited_by)
    REFERENCES auth.users(id),
  CONSTRAINT uk_order_edit_history_edit_number UNIQUE (order_id, edit_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_edit_history_order
  ON org_order_edit_history(order_id, edit_number DESC);

CREATE INDEX IF NOT EXISTS idx_order_edit_history_tenant
  ON org_order_edit_history(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_order_edit_history_edited_at
  ON org_order_edit_history(edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_edit_history_edited_by
  ON org_order_edit_history(edited_by);

-- GIN indexes for JSONB fields (for efficient querying)
CREATE INDEX IF NOT EXISTS idx_order_edit_history_changes_gin
  ON org_order_edit_history USING GIN (changes);

CREATE INDEX IF NOT EXISTS idx_order_edit_history_snapshot_before_gin
  ON org_order_edit_history USING GIN (snapshot_before);

CREATE INDEX IF NOT EXISTS idx_order_edit_history_snapshot_after_gin
  ON org_order_edit_history USING GIN (snapshot_after);

-- Enable RLS
ALTER TABLE org_order_edit_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see edit history in their tenant
CREATE POLICY org_order_edit_history_select_policy ON org_order_edit_history
  FOR SELECT
  USING (
    tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
    )
  );

-- RLS Policy: Only system/authenticated users can insert audit entries
CREATE POLICY org_order_edit_history_insert_policy ON org_order_edit_history
  FOR INSERT
  WITH CHECK (
    tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
    )
    AND edited_by = auth.uid()
  );

-- No UPDATE or DELETE policies - audit history is immutable

-- Function to get next edit number for an order
CREATE OR REPLACE FUNCTION get_next_order_edit_number(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(edit_number), 0) + 1
  INTO next_number
  FROM org_order_edit_history
  WHERE order_id = p_order_id;

  RETURN next_number;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_order_edit_number(UUID) TO authenticated;

-- Function to get order edit history summary
CREATE OR REPLACE FUNCTION get_order_edit_summary(p_order_id UUID)
RETURNS TABLE (
  edit_count BIGINT,
  last_edited_at TIMESTAMPTZ,
  last_edited_by_name TEXT,
  total_payment_adjustments DECIMAL(19,4)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as edit_count,
    MAX(edited_at) as last_edited_at,
    (SELECT edited_by_name FROM org_order_edit_history
     WHERE order_id = p_order_id
     ORDER BY edited_at DESC
     LIMIT 1) as last_edited_by_name,
    COALESCE(SUM(
      CASE
        WHEN payment_adjusted = TRUE THEN payment_adjustment_amount
        ELSE 0
      END
    ), 0) as total_payment_adjustments
  FROM org_order_edit_history
  WHERE order_id = p_order_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_order_edit_summary(UUID) TO authenticated;

-- Comments on table
COMMENT ON TABLE org_order_edit_history IS
  'Comprehensive audit trail for order edits. Stores before/after snapshots, structured change summaries, and payment adjustment tracking. Immutable - no updates or deletes allowed.';

-- Comments on columns
COMMENT ON COLUMN org_order_edit_history.edit_number IS 'Sequential edit count per order (1, 2, 3...)';
COMMENT ON COLUMN org_order_edit_history.snapshot_before IS 'Full order state before edit (JSONB)';
COMMENT ON COLUMN org_order_edit_history.snapshot_after IS 'Full order state after edit (JSONB)';
COMMENT ON COLUMN org_order_edit_history.changes IS 'Structured diff: {fields: [], items: {added, removed, modified}, pricing: {}}';
COMMENT ON COLUMN org_order_edit_history.change_summary IS 'Human-readable summary: "Changed customer, added 2 items, total increased by 25.00"';
COMMENT ON COLUMN org_order_edit_history.payment_adjusted IS 'True if payment adjustment was required';
COMMENT ON COLUMN org_order_edit_history.payment_adjustment_amount IS 'Amount of payment adjustment (positive = charge, negative = refund)';
COMMENT ON COLUMN org_order_edit_history.payment_adjustment_type IS 'CHARGE or REFUND';
