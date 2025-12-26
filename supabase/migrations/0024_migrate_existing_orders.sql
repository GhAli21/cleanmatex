-- ==================================================================
-- 0024_migrate_existing_orders.sql
-- Purpose: Migrate existing orders to new workflow structure
-- Created: 2025-11-05
-- Dependencies: All previous PRD-010 migrations
-- ==================================================================
-- This migration converts existing orders to the new workflow system:
-- 1. Assign default workflow template to existing orders
-- 2. Map old status to new current_status
-- 3. Create initial history entries
-- 4. Migrate preparation status to workflow
-- ==================================================================

BEGIN;

-- ==================================================================
-- STEP 1: Assign Workflow Template to Existing Orders
-- ==================================================================

-- Assign WF_STANDARD template to all orders without template
UPDATE org_orders_mst o
SET workflow_template_id = (
  SELECT template_id 
  FROM sys_workflow_template_cd 
  WHERE template_code = 'WF_STANDARD' 
  LIMIT 1
)
WHERE o.workflow_template_id IS NULL;

-- ==================================================================
-- STEP 2: Map Old Status to Current Status
-- ==================================================================

-- Map legacy status values to new workflow statuses
UPDATE org_orders_mst
SET 
  current_status = CASE
    -- Direct mappings
    WHEN status IN ('pending', 'received') THEN 'intake'
    WHEN status IN ('in_progress', 'washing', 'drying') THEN 'processing'
    WHEN status = 'ready' THEN 'ready'
    WHEN status = 'delivered' THEN 'delivered'
    WHEN status = 'cancelled' THEN 'cancelled'
    -- Default to intake for unknown statuses
    ELSE 'intake'
  END,
  -- Set current_stage based on status
  current_stage = CASE
    WHEN status IN ('pending', 'received') THEN 'intake'
    WHEN status IN ('in_progress', 'washing') THEN 'processing'
    WHEN status = 'drying' THEN 'processing'
    WHEN status = 'ready' THEN 'ready'
    WHEN status = 'delivered' THEN 'delivered'
    ELSE 'intake'
  END
WHERE current_status IS NULL OR current_status = '';

-- ==================================================================
-- STEP 3: Migrate Preparation Status to Workflow
-- ==================================================================

-- Map preparation_status to workflow stage for Quick Drop orders
UPDATE org_orders_mst
SET current_stage = 'preparation'
WHERE is_order_quick_drop = true
  AND preparation_status = 'in_progress'
  AND current_stage IN ('intake', '');

-- ==================================================================
-- STEP 4: Create History Entries for Existing Orders
-- ==================================================================

-- Create ORDER_CREATED history entry for all existing orders
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
  id AS order_id,
  'ORDER_CREATED',
  NULL,
  current_status,
  NULL::uuid AS done_by,
  COALESCE(created_at, NOW()),
  jsonb_build_object(
    'order_no', order_no,
    'order_type_id', order_type_id,
    'migrated', true,
    'original_status', status,
    'preparation_status', preparation_status
  )
FROM org_orders_mst
WHERE id NOT IN (
  SELECT DISTINCT order_id 
  FROM org_order_history 
  WHERE action_type = 'ORDER_CREATED'
)
ON CONFLICT DO NOTHING;

-- Create STATUS_CHANGE history if status transition happened
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
SELECT DISTINCT
  o.tenant_org_id,
  o.id AS order_id,
  'STATUS_CHANGE',
  'intake' AS from_value,
  o.current_status AS to_value,
  NULL::uuid AS done_by,
  COALESCE(o.updated_at, NOW()),
  jsonb_build_object(
    'notes', 'Initial workflow migration',
    'auto_migrated', true,
    'original_status', o.status
  )
FROM org_orders_mst o
WHERE o.current_status IS NOT NULL
  AND o.current_status != 'intake'
  AND o.id NOT IN (
    SELECT DISTINCT order_id 
    FROM org_order_history 
    WHERE action_type = 'STATUS_CHANGE'
  )
ON CONFLICT DO NOTHING;

-- ==================================================================
-- STEP 5: Set Workflow Flags
-- ==================================================================

-- Set has_split flag for parent orders
UPDATE org_orders_mst
SET has_split = true
WHERE id IN (
  SELECT DISTINCT parent_order_id
  FROM org_orders_mst
  WHERE parent_order_id IS NOT NULL
);

-- Set has_issue flag where issues exist
UPDATE org_orders_mst o
SET has_issue = true
WHERE EXISTS (
  SELECT 1 
  FROM org_order_item_issues i
  WHERE i.order_item_id IN (
    SELECT id FROM org_order_items_dtl 
    WHERE order_id = o.id
  )
  AND i.solved_at IS NULL
);

-- ==================================================================
-- STEP 6: Migrate Item Statuses
-- ==================================================================

-- Map item statuses to workflow item_status
UPDATE org_order_items_dtl
SET 
  item_status = CASE
    WHEN item_status IN ('pending', 'tagged') THEN 'pending'
    WHEN item_status IN ('washing') THEN 'processing'
    WHEN item_status IN ('drying') THEN 'processing'
    WHEN item_status IN ('finishing') THEN 'processing'
    WHEN item_status = 'packed' THEN 'ready'
    WHEN item_status = 'delivered' THEN 'delivered'
    ELSE 'pending'
  END,
  item_stage = CASE
    WHEN item_status IN ('pending', 'tagged') THEN 'intake'
    WHEN item_status IN ('washing', 'drying', 'finishing') THEN 'processing'
    WHEN item_status = 'packed' THEN 'ready'
    WHEN item_status = 'delivered' THEN 'delivered'
    ELSE 'intake'
  END
WHERE item_status IS NULL OR item_status = '';

-- ==================================================================
-- STEP 7: Convert bag_count to Quick Drop
-- ==================================================================

-- Mark orders with bag_count as quick drop orders
UPDATE org_orders_mst
SET 
  is_order_quick_drop = true,
  quick_drop_quantity = COALESCE(bag_count, 0)
WHERE bag_count > 0 
  AND (is_order_quick_drop IS NULL OR is_order_quick_drop = false);

-- ==================================================================
-- STEP 8: Set Default Ready By Date
-- ==================================================================

-- Calculate and set ready_by_at_new for orders without it
UPDATE org_orders_mst
SET ready_by_at_new = 
  CASE
    -- If express or urgent, use shorter time
    WHEN priority IN ('express', 'urgent') 
      THEN received_at + INTERVAL '24 hours'
    -- If ready_by exists, use it
    WHEN ready_by IS NOT NULL 
      THEN ready_by
    -- Default: 3 days for standard
    ELSE received_at + INTERVAL '3 days'
  END
WHERE ready_by_at_new IS NULL
  AND received_at IS NOT NULL;

-- ==================================================================
-- STEP 9: Link Split Orders
-- ==================================================================

-- If orders reference each other with similar order numbers, 
-- try to establish parent-child relationships
UPDATE org_orders_mst o1
SET parent_order_id = o2.id
FROM org_orders_mst o2
WHERE o1.order_no LIKE '%' || o2.order_no || '-%'
  AND o1.id != o2.id
  AND o1.parent_order_id IS NULL
  AND o2.parent_order_id IS NULL;

-- ==================================================================
-- STEP 10: Create Tenant Workflow Settings
-- ==================================================================

-- Create default tenant workflow settings for all existing tenants
INSERT INTO org_tenant_workflow_settings_cf (
  tenant_org_id,
  use_preparation_screen,
  use_assembly_screen,
  use_qa_screen,
  track_individual_piece,
  orders_split_enabled
)
SELECT DISTINCT
  tenant_org_id,
  true AS use_preparation_screen,
  false AS use_assembly_screen,
  true AS use_qa_screen,
  true AS track_individual_piece,
  true AS orders_split_enabled
FROM org_orders_mst
WHERE tenant_org_id NOT IN (
  SELECT tenant_org_id 
  FROM org_tenant_workflow_settings_cf
)
ON CONFLICT (tenant_org_id) DO NOTHING;

-- ==================================================================
-- VERIFICATION QUERIES (for manual inspection)
-- ==================================================================

DO $$
DECLARE
  v_migrated_count INTEGER;
  v_no_template_count INTEGER;
  v_no_status_count INTEGER;
  v_no_history_count INTEGER;
BEGIN
  -- Count successfully migrated orders
  SELECT COUNT(*) INTO v_migrated_count
  FROM org_orders_mst
  WHERE workflow_template_id IS NOT NULL
    AND current_status IS NOT NULL
    AND current_status != '';

  -- Count orders still needing attention
  SELECT COUNT(*) INTO v_no_template_count
  FROM org_orders_mst
  WHERE workflow_template_id IS NULL;

  SELECT COUNT(*) INTO v_no_status_count
  FROM org_orders_mst
  WHERE current_status IS NULL OR current_status = '';

  SELECT COUNT(*) INTO v_no_history_count
  FROM org_orders_mst o
  WHERE NOT EXISTS (
    SELECT 1 FROM org_order_history h
    WHERE h.order_id = o.id
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ORDER MIGRATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Successfully migrated: % orders', v_migrated_count;
  RAISE NOTICE 'Missing template: % orders', v_no_template_count;
  RAISE NOTICE 'Missing status: % orders', v_no_status_count;
  RAISE NOTICE 'Missing history: % orders', v_no_history_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==================================================================
-- ROLLBACK INSTRUCTIONS
-- ==================================================================
-- If migration needs to be rolled back:
-- 
-- BEGIN;
-- DELETE FROM org_order_history WHERE payload->>'migrated' = 'true';
-- UPDATE org_orders_mst 
--   SET workflow_template_id = NULL,
--       current_status = NULL,
--       current_stage = NULL,
--       has_split = false,
--       has_issue = false,
--       is_order_quick_drop = false,
--       ready_by_at_new = NULL
--   WHERE id IN (...affected IDs...);
-- DELETE FROM org_tenant_workflow_settings_cf WHERE created_at > (SELECT MAX(created_at) - INTERVAL '1 hour' FROM org_order_history LIMIT 1);
-- COMMIT;
-- ==================================================================

