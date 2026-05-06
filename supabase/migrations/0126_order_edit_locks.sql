-- Migration: Order Edit Locks
-- Description: Creates table and infrastructure for order edit locking to prevent concurrent modifications
-- PRD: Edit Order Feature - Phase 1
-- Date: 2026-03-07

-- Create org_order_edit_locks table
CREATE TABLE IF NOT EXISTS org_order_edit_locks (
  order_id UUID PRIMARY KEY,
  tenant_org_id UUID NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_name TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,

  CONSTRAINT fk_order_edit_lock_order FOREIGN KEY (order_id)
    REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_edit_lock_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_edit_lock_user FOREIGN KEY (locked_by)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_edit_locks_tenant
  ON org_order_edit_locks(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_order_edit_locks_expires_at
  ON org_order_edit_locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_order_edit_locks_locked_by
  ON org_order_edit_locks(locked_by);

-- Enable RLS
ALTER TABLE org_order_edit_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see locks in their tenant
CREATE POLICY org_order_edit_locks_select_policy ON org_order_edit_locks
  FOR SELECT
  USING (
    tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
    )
  );

-- RLS Policy: Users can insert locks in their tenant
CREATE POLICY org_order_edit_locks_insert_policy ON org_order_edit_locks
  FOR INSERT
  WITH CHECK (
    tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
    )
    AND locked_by = auth.uid()
  );

-- RLS Policy: Users can update their own locks
CREATE POLICY org_order_edit_locks_update_policy ON org_order_edit_locks
  FOR UPDATE
  USING (locked_by = auth.uid())
  WITH CHECK (locked_by = auth.uid());

-- RLS Policy: Users can delete their own locks
CREATE POLICY org_order_edit_locks_delete_policy ON org_order_edit_locks
  FOR DELETE
  USING (
    locked_by = auth.uid()
    OR tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
      WHERE user_role IN ('owner', 'super_admin', 'tenant_admin') -- Admins can force unlock
    )
  );

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_order_edit_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM org_order_edit_locks
  WHERE expires_at <= NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired order edit locks', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_order_edit_locks() TO authenticated;

-- Comment on table
COMMENT ON TABLE org_order_edit_locks IS
  'Tracks active edit locks on orders to prevent concurrent modifications. Locks expire after 30 minutes (TTL). A cron job cleans up expired locks every 5 minutes.';

-- Comments on columns
COMMENT ON COLUMN org_order_edit_locks.order_id IS 'Order being locked (primary key)';
COMMENT ON COLUMN org_order_edit_locks.locked_by IS 'User who holds the lock';
COMMENT ON COLUMN org_order_edit_locks.locked_at IS 'When lock was acquired';
COMMENT ON COLUMN org_order_edit_locks.expires_at IS 'When lock expires (30 minutes from locked_at)';
COMMENT ON COLUMN org_order_edit_locks.session_id IS 'Browser session ID for tracking';

-- Note: pg_cron job setup needs to be done manually in Supabase dashboard
-- or via admin SQL. Add this schedule:
-- SELECT cron.schedule(
--   'cleanup-order-edit-locks',
--   '*/5 * * * *', -- Every 5 minutes
--   $$ SELECT cleanup_expired_order_edit_locks(); $$
-- );
