-- ==================================================================
-- 0022_order_history_canonical.sql
-- Purpose: Canonical order history table for PRD-010
-- Author: CleanMateX Development Team
-- Created: 2025-11-05
-- Dependencies: 0001_core_schema.sql, 0020_orders_workflow_extensions.sql
-- ==================================================================
-- This migration creates:
-- - org_order_history: Comprehensive audit trail for all order actions
-- - Action types: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED
-- - Composite FKs with tenant_org_id for multi-tenant isolation
-- - RLS policies for tenant isolation
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: org_order_history
-- Purpose: Canonical audit trail for all order actions
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id      UUID NOT NULL,
  action_type   TEXT NOT NULL,
  from_value    TEXT,
  to_value      TEXT,
  payload       JSONB DEFAULT '{}'::jsonb,
  done_by       UUID,
  done_at       TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ==================================================================
-- MIGRATE OLD STATUS HISTORY DATA (if exists)
-- ==================================================================

-- Migrate existing status history data from old table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_order_status_history') THEN
    RAISE NOTICE 'org_order_status_history exists, migrating data to org_order_history';
    
    -- Insert existing status history into new history table
    INSERT INTO org_order_history (
      tenant_org_id,
      order_id,
      action_type,
      from_value,
      to_value,
      done_by,
      done_at,
      payload
    )
    SELECT 
      tenant_org_id,
      order_id,
      'STATUS_CHANGE',
      from_status,
      to_status,
      changed_by,
      changed_at,
      jsonb_build_object(
        'notes', notes,
        'changed_by_name', changed_by_name,
        'existing_data', true
      )
    FROM org_order_status_history
    WHERE NOT EXISTS (
      SELECT 1 FROM org_order_history oh 
      WHERE oh.order_id = org_order_status_history.order_id 
      AND oh.action_type = 'STATUS_CHANGE' 
      AND oh.to_value = org_order_status_history.to_status 
      AND oh.done_at = org_order_status_history.changed_at
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Migrated % existing status history records', FOUND;
  END IF;
END $$;

COMMENT ON TABLE org_order_history IS 'Canonical audit trail for all order actions (replaces org_order_status_history)';
COMMENT ON COLUMN org_order_history.action_type IS 'Action type: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED';
COMMENT ON COLUMN org_order_history.from_value IS 'Previous value (e.g., old status, old field value)';
COMMENT ON COLUMN org_order_history.to_value IS 'New value (e.g., new status, new field value)';
COMMENT ON COLUMN org_order_history.payload IS 'Additional context (notes, metadata, user info, etc.)';
COMMENT ON COLUMN org_order_history.done_by IS 'User who performed the action';
COMMENT ON COLUMN org_order_history.done_at IS 'Timestamp when action was performed';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- History FK to order
ALTER TABLE org_order_history
  ADD CONSTRAINT fk_history_order
  FOREIGN KEY (order_id)
  REFERENCES org_orders_mst(id) ON DELETE CASCADE;

-- History FK to tenant
ALTER TABLE org_order_history
  ADD CONSTRAINT fk_history_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- History FK to user
ALTER TABLE org_order_history
  ADD CONSTRAINT fk_history_user
  FOREIGN KEY (done_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- ==================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================

-- Most common query: order timeline
CREATE INDEX IF NOT EXISTS idx_history_order_timeline ON org_order_history(order_id, done_at DESC);

-- Tenant isolation queries
CREATE INDEX IF NOT EXISTS idx_history_tenant ON org_order_history(tenant_org_id, done_at DESC);

-- Action type filtering
CREATE INDEX IF NOT EXISTS idx_history_action_type ON org_order_history(tenant_org_id, action_type, done_at DESC);

-- Composite index for dashboard queries: tenant + action + time
CREATE INDEX IF NOT EXISTS idx_history_tenant_action ON org_order_history(tenant_org_id, action_type, done_at DESC);

-- Composite index for order + action type queries
CREATE INDEX IF NOT EXISTS idx_history_order_action ON org_order_history(order_id, action_type, done_at DESC);

-- User activity queries
CREATE INDEX IF NOT EXISTS idx_history_user ON org_order_history(done_by, done_at DESC)
  WHERE done_by IS NOT NULL;

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

ALTER TABLE org_order_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY tenant_isolation_history ON org_order_history
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_history ON org_order_history
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- CONSTRAINTS
-- ==================================================================

-- Validate action_type enum
ALTER TABLE org_order_history
  ADD CONSTRAINT chk_history_action_type
  CHECK (action_type IN (
    'ORDER_CREATED',
    'STATUS_CHANGE',
    'FIELD_UPDATE',
    'SPLIT',
    'QA_DECISION',
    'ITEM_STEP',
    'ISSUE_CREATED',
    'ISSUE_SOLVED'
  ));

-- ==================================================================
-- HELPER FUNCTIONS
-- ==================================================================

-- Function to log order action
CREATE OR REPLACE FUNCTION log_order_action(
  p_tenant_org_id UUID,
  p_order_id UUID,
  p_action_type TEXT,
  p_from_value TEXT DEFAULT NULL,
  p_to_value TEXT DEFAULT NULL,
  p_done_by UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
BEGIN
  INSERT INTO org_order_history (
    tenant_org_id,
    order_id,
    action_type,
    from_value,
    to_value,
    payload,
    done_by,
    done_at
  )
  VALUES (
    p_tenant_org_id,
    p_order_id,
    p_action_type,
    p_from_value,
    p_to_value,
    p_payload,
    p_done_by,
    now()
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_order_action IS 'Log an action to order history';

-- Function to get order timeline
CREATE OR REPLACE FUNCTION get_order_timeline(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  action_type TEXT,
  from_value TEXT,
  to_value TEXT,
  done_by UUID,
  done_at TIMESTAMPTZ,
  payload JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oh.id,
    oh.action_type,
    oh.from_value,
    oh.to_value,
    oh.done_by,
    oh.done_at,
    oh.payload
  FROM org_order_history oh
  WHERE oh.order_id = p_order_id
  ORDER BY oh.done_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_order_timeline IS 'Get complete timeline for an order';

-- Function to check if order has action type
CREATE OR REPLACE FUNCTION order_has_action(p_order_id UUID, p_action_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_order_history
    WHERE order_id = p_order_id 
    AND action_type = p_action_type
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION order_has_action IS 'Check if order has a specific action type';

-- ==================================================================
-- TRIGGER: Auto-log order creation
-- ==================================================================

-- Function to auto-log order creation
CREATE OR REPLACE FUNCTION fn_auto_log_order_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_order_action(
    NEW.tenant_org_id,
    NEW.id,
    'ORDER_CREATED',
    NULL,
    NEW.current_status,
    auth.uid(),
    jsonb_build_object(
      'order_no', NEW.order_no,
      'customer_id', NEW.customer_id,
      'is_quick_drop', NEW.is_order_quick_drop,
      'order_type_id', NEW.order_type_id,
      'created_via', 'system_trigger'
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on order insert
DROP TRIGGER IF EXISTS trg_order_auto_log_created ON org_orders_mst;
CREATE TRIGGER trg_order_auto_log_created
  AFTER INSERT ON org_orders_mst
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_log_order_created();

COMMENT ON FUNCTION fn_auto_log_order_created IS 'Auto-log order creation to history';
COMMENT ON TRIGGER trg_order_auto_log_created ON org_orders_mst IS 'Automatically create history entry when order is created';

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_history_table_exists BOOLEAN;
  v_index_count INTEGER;
  v_migrated_count INTEGER;
  v_function_count INTEGER;
BEGIN
  -- Check table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'org_order_history'
  ) INTO v_history_table_exists;

  IF NOT v_history_table_exists THEN
    RAISE EXCEPTION 'org_order_history table not created';
  END IF;

  -- Check indexes exist
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename = 'org_order_history';

  IF v_index_count < 6 THEN
    RAISE WARNING 'Expected at least 6 indexes, found %. Some performance indexes may be missing.', v_index_count;
  END IF;

  -- Check functions exist
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN ('log_order_action', 'get_order_timeline', 'order_has_action');

  IF v_function_count < 3 THEN
    RAISE WARNING 'Expected 3 helper functions, found %', v_function_count;
  END IF;

  RAISE NOTICE '✓ Migration 0022 validation passed successfully';
  RAISE NOTICE '  - org_order_history table created';
  RAISE NOTICE '  - % indexes created', v_index_count;
  RAISE NOTICE '  - % helper functions created', v_function_count;
  RAISE NOTICE '  - Auto-log trigger created';
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Implement transition function (0023)

-- TESTING:
-- 1. Create test order and verify ORDER_CREATED entry: SELECT * FROM org_order_history WHERE action_type = 'ORDER_CREATED';
-- 2. Test helper function: SELECT * FROM get_order_timeline('order-id');
-- 3. Test log action: SELECT log_order_action('tenant-id', 'order-id', 'STATUS_CHANGE', 'INTAKE', 'PROCESSING', auth.uid());
-- 4. Test RLS: Try querying as different tenants

-- USAGE EXAMPLES:
-- Log status change:
--   SELECT log_order_action('tenant', 'order', 'STATUS_CHANGE', 'INTAKE', 'PROCESSING', 'user-id', '{"notes": "..."}');
--
-- Log issue created:
--   SELECT log_order_action('tenant', 'order', 'ISSUE_CREATED', NULL, 'damage', 'user-id', '{"issue_id": "...", "reason": "..."}');
--
-- Log split:
--   SELECT log_order_action('tenant', 'order', 'SPLIT', NULL, 'suborder-id', 'user-id', '{"reason": "..."}');
--
-- Log QA decision:
--   SELECT log_order_action('tenant', 'order', 'QA_DECISION', NULL, 'accepted', 'user-id', '{"item_count": 10}');
--
-- Get timeline for UI:
--   SELECT * FROM get_order_timeline('order-id');

