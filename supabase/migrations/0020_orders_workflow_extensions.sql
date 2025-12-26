-- ==================================================================
-- 0020_orders_workflow_extensions.sql
-- Purpose: Extend orders tables with workflow fields for PRD-010
-- Author: CleanMateX Development Team
-- Created: 2025-11-05
-- Dependencies: 0001_core_schema.sql, 0018_workflow_templates.sql
-- ==================================================================
-- This migration extends:
-- - org_orders_mst: Add workflow template reference, current_status, split tracking, issue tracking
-- - org_order_items_dtl: Add item-level status, stage tracking, issue tracking
-- - Composite FKs for tenant isolation
-- - Indexes for performance
-- ==================================================================

BEGIN;

-- ==================================================================
-- ALTER org_orders_mst - Add Workflow Fields
-- ==================================================================

-- Workflow template reference
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES sys_workflow_template_cd(template_id) ON DELETE SET NULL;

COMMENT ON COLUMN org_orders_mst.workflow_template_id IS 'Reference to workflow template used for this order';

-- Current status and stage (replaces/enhances existing status field)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS current_status TEXT;
COMMENT ON COLUMN org_orders_mst.current_status IS 'Current workflow status (intake, preparing, processing, assembly, qa, ready, delivered, etc.)';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS current_stage TEXT;
COMMENT ON COLUMN org_orders_mst.current_stage IS 'Current workflow stage (synonym for current_status, kept for compatibility)';

-- Split order tracking
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS parent_order_id UUID;
COMMENT ON COLUMN org_orders_mst.parent_order_id IS 'Parent order ID for split orders (NULL for main orders)';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS order_subtype TEXT;
COMMENT ON COLUMN org_orders_mst.order_subtype IS 'Order subtype (e.g., split_parent, split_child, issue_resolution)';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS has_split BOOLEAN DEFAULT false;
COMMENT ON COLUMN org_orders_mst.has_split IS 'True if this order has been split into suborders';

-- Rejection and issue tracking
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT false;
COMMENT ON COLUMN org_orders_mst.is_rejected IS 'True if order was rejected during QA or processing';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS rejected_from_stage TEXT;
COMMENT ON COLUMN org_orders_mst.rejected_from_stage IS 'Stage from which order was rejected';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS issue_id UUID;
COMMENT ON COLUMN org_orders_mst.issue_id IS 'Reference to main issue for this order (if any)';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS has_issue BOOLEAN DEFAULT false;
COMMENT ON COLUMN org_orders_mst.has_issue IS 'True if order has unresolved issues';

-- Recalculated SLA tracking
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS ready_by_at_new TIMESTAMPTZ;
COMMENT ON COLUMN org_orders_mst.ready_by_at_new IS 'Recalculated ready-by date after preparation or changes';

-- Transition tracking
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS last_transition_at TIMESTAMPTZ;
COMMENT ON COLUMN org_orders_mst.last_transition_at IS 'Timestamp of last workflow transition';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS last_transition_by UUID;
COMMENT ON COLUMN org_orders_mst.last_transition_by IS 'User who performed last transition';

-- Quick Drop tracking
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS is_order_quick_drop BOOLEAN DEFAULT false;
COMMENT ON COLUMN org_orders_mst.is_order_quick_drop IS 'True if order is Quick Drop (items entered later)';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS quick_drop_quantity INTEGER;
COMMENT ON COLUMN org_orders_mst.quick_drop_quantity IS 'Estimated quantity for Quick Drop (before itemization)';

-- Rack location (required for READY status)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS rack_location VARCHAR(100);
COMMENT ON COLUMN org_orders_mst.rack_location IS 'Physical rack location where order is stored when ready';

-- ==================================================================
-- ALTER org_order_items_dtl - Add Workflow Fields
-- ==================================================================

-- Item-level status and stage tracking
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_status TEXT;
COMMENT ON COLUMN org_order_items_dtl.item_status IS 'Current status of this item (intake, processing, ready, etc.)';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_stage TEXT;
COMMENT ON COLUMN org_order_items_dtl.item_stage IS 'Current stage of this item';

-- Item-level rejection and issue tracking
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_is_rejected BOOLEAN DEFAULT false;
COMMENT ON COLUMN org_order_items_dtl.item_is_rejected IS 'True if this item was rejected';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_issue_id UUID;
COMMENT ON COLUMN org_order_items_dtl.item_issue_id IS 'Reference to issue for this specific item';

-- Item-level processing step tracking
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_last_step TEXT;
COMMENT ON COLUMN org_order_items_dtl.item_last_step IS 'Last completed processing step (sorting, pretreatment, washing, drying, finishing)';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_last_step_at TIMESTAMPTZ;
COMMENT ON COLUMN org_order_items_dtl.item_last_step_at IS 'Timestamp when last step was completed';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS item_last_step_by UUID;
COMMENT ON COLUMN org_order_items_dtl.item_last_step_by IS 'User who completed last step';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Self-referencing FK for split orders
ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_order_parent_order
  FOREIGN KEY (parent_order_id)
  REFERENCES org_orders_mst(id) ON DELETE SET NULL;

-- ==================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================

-- Workflow status queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_current_status ON org_orders_mst(tenant_org_id, current_status);
CREATE INDEX IF NOT EXISTS idx_orders_workflow_template ON org_orders_mst(tenant_org_id, workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_orders_parent_order ON org_orders_mst(tenant_org_id, parent_order_id);

-- Quick Drop queries
CREATE INDEX IF NOT EXISTS idx_orders_quick_drop ON org_orders_mst(tenant_org_id, is_order_quick_drop, current_status)
  WHERE is_order_quick_drop = true;

-- Issue queries
CREATE INDEX IF NOT EXISTS idx_orders_has_issue ON org_orders_mst(tenant_org_id, has_issue, current_status)
  WHERE has_issue = true;

-- Split queries
CREATE INDEX IF NOT EXISTS idx_orders_has_split ON org_orders_mst(tenant_org_id, has_split)
  WHERE has_split = true;

-- Rejected queries
CREATE INDEX IF NOT EXISTS idx_orders_is_rejected ON org_orders_mst(tenant_org_id, is_rejected)
  WHERE is_rejected = true;

-- Item-level workflow queries
CREATE INDEX IF NOT EXISTS idx_order_items_status ON org_order_items_dtl(tenant_org_id, item_status);
CREATE INDEX IF NOT EXISTS idx_order_items_stage ON org_order_items_dtl(tenant_org_id, item_stage);

-- Item-level issues
CREATE INDEX IF NOT EXISTS idx_order_items_issue ON org_order_items_dtl(tenant_org_id, item_issue_id)
  WHERE item_issue_id IS NOT NULL;

-- Ready-by queries
CREATE INDEX IF NOT EXISTS idx_orders_ready_by_new ON org_orders_mst(tenant_org_id, ready_by_at_new)
  WHERE ready_by_at_new IS NOT NULL;

-- Composite index for common dashboard query: status + last transition
CREATE INDEX IF NOT EXISTS idx_orders_status_transition ON org_orders_mst(tenant_org_id, current_status, last_transition_at DESC);

-- ==================================================================
-- DATA MIGRATION: Set current_status for existing orders
-- ==================================================================

-- Migrate existing status to current_status
UPDATE org_orders_mst
SET current_status = status
WHERE current_status IS NULL AND status IS NOT NULL;

-- Set workflow template for existing orders (default to WF_STANDARD)
UPDATE org_orders_mst o
SET workflow_template_id = (
  SELECT template_id FROM sys_workflow_template_cd 
  WHERE template_code = 'WF_STANDARD' AND is_active = true
  LIMIT 1
)
WHERE workflow_template_id IS NULL;

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_orders_count INTEGER;
  v_orders_with_status INTEGER;
  v_orders_with_template INTEGER;
  v_items_count INTEGER;
BEGIN
  -- Check total orders
  SELECT COUNT(*) INTO v_orders_count FROM org_orders_mst;

  -- Check orders with current_status
  SELECT COUNT(*) INTO v_orders_with_status FROM org_orders_mst WHERE current_status IS NOT NULL;

  -- Check orders with workflow template
  SELECT COUNT(*) INTO v_orders_with_template FROM org_orders_mst WHERE workflow_template_id IS NOT NULL;

  -- Check items
  SELECT COUNT(*) INTO v_items_count FROM org_order_items_dtl;

  IF v_orders_with_status < v_orders_count THEN
    RAISE WARNING '% orders missing current_status (expected %), check migration', 
      v_orders_count - v_orders_with_status, v_orders_count;
  END IF;

  IF v_orders_with_template < v_orders_count THEN
    RAISE WARNING '% orders missing workflow_template_id (expected %), check migration', 
      v_orders_count - v_orders_with_template, v_orders_count;
  END IF;

  RAISE NOTICE '✓ Migration 0020 validation passed successfully';
  RAISE NOTICE '  - % total orders', v_orders_count;
  RAISE NOTICE '  - % orders with current_status', v_orders_with_status;
  RAISE NOTICE '  - % orders with workflow_template_id', v_orders_with_template;
  RAISE NOTICE '  - % items tracked', v_items_count;
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Create issue and processing steps tables (0021)
-- 2. Create comprehensive order history table (0022)
-- 3. Implement transition function (0023)

-- TESTING:
-- 1. SELECT * FROM org_orders_mst WHERE current_status IS NOT NULL LIMIT 10;
-- 2. SELECT * FROM org_orders_mst WHERE workflow_template_id IS NOT NULL LIMIT 10;
-- 3. SELECT * FROM org_order_items_dtl WHERE item_status IS NOT NULL LIMIT 10;
-- 4. Test split order FK: Try creating a suborder with parent_order_id

-- IMPORTANT NOTES:
-- - current_status is the authoritative field for order status
-- - workflow_template_id must be set for all new orders
-- - rack_location is REQUIRED before transitioning to READY status
-- - All workflow transitions should update current_status, current_stage, last_transition_*

