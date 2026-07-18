-- =============================================================================
-- 0408_idx_orders_tenant_cstatus_recv.sql
-- Processing list: tenant + current_status + received_at DESC index.
-- =============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_cstatus_recv
  ON org_orders_mst (tenant_org_id, current_status, received_at DESC);

COMMENT ON INDEX idx_orders_tenant_cstatus_recv IS
  'Processing queue list: filter by tenant + current_status, sort by received_at DESC.';

COMMIT;
