-- ==================================================================
-- 0075_screen_contract_functions_simplified.sql
-- Purpose: Simplified screen contract functions for Orders workflow
-- Author: CleanMateX Development Team
-- Created: 2026-01-14
-- Dependencies: 0020_orders_workflow_extensions.sql, 0022_order_history_canonical.sql
-- ==================================================================
-- This migration implements simplified database functions following the principle:
-- "Database for Config & Atomicity, Code for Logic"
-- 
-- Functions:
-- - cmx_ord_screen_pre_conditions(): Simple screen contract retrieval
-- - cmx_ord_validate_transition_basic(): Basic data integrity validation
-- - cmx_ord_execute_transition(): Atomic status update + history logging
-- - cmx_ord_order_workflow_flags(): Simple workflow flags lookup
-- - cmx_ord_order_live_metrics(): Simple metrics calculation
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION: cmx_ord_screen_pre_conditions()
-- Purpose: Simple screen contract retrieval (no complex logic)
-- Returns: JSONB with statuses array and additional filters
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_screen_pre_conditions(
  p_screen TEXT
) RETURNS JSONB AS $$
BEGIN
  -- Return simple configuration, no tenant-specific logic here
  -- Complex logic (feature flags, settings) handled in application layer
  RETURN jsonb_build_object(
    'statuses', CASE p_screen
      WHEN 'preparation' THEN ARRAY['preparing', 'intake']::TEXT[]
      WHEN 'processing' THEN ARRAY['processing']::TEXT[]
      WHEN 'assembly' THEN ARRAY['assembly']::TEXT[]
      WHEN 'qa' THEN ARRAY['qa']::TEXT[]
      WHEN 'packing' THEN ARRAY['packing']::TEXT[]
      WHEN 'ready_release' THEN ARRAY['ready']::TEXT[]
      WHEN 'driver_delivery' THEN ARRAY['out_for_delivery']::TEXT[]
      WHEN 'new_order' THEN ARRAY['draft']::TEXT[]
      WHEN 'workboard' THEN ARRAY['preparing', 'processing', 'assembly', 'qa', 'packing']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END,
    'additional_filters', jsonb_build_object(),
    'required_permissions', CASE p_screen
      WHEN 'preparation' THEN ARRAY['orders:preparation:complete']::TEXT[]
      WHEN 'processing' THEN ARRAY['orders:processing:complete']::TEXT[]
      WHEN 'assembly' THEN ARRAY['orders:assembly:complete']::TEXT[]
      WHEN 'qa' THEN ARRAY['orders:qa:approve', 'orders:qa:reject']::TEXT[]
      WHEN 'packing' THEN ARRAY['orders:packing:complete']::TEXT[]
      WHEN 'ready_release' THEN ARRAY['orders:ready:release']::TEXT[]
      WHEN 'driver_delivery' THEN ARRAY['orders:delivery:complete']::TEXT[]
      WHEN 'new_order' THEN ARRAY['orders:create']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_ord_screen_pre_conditions IS 'Returns screen contract configuration (statuses, filters, permissions). Complex logic handled in application layer.';

-- ==================================================================
-- FUNCTION: cmx_ord_validate_transition_basic()
-- Purpose: Basic transition validation (data integrity only)
-- Returns: JSONB with ok boolean and errors array
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_validate_transition_basic(
  p_tenant_org_id UUID,
  p_order_id UUID,
  p_from_status TEXT,
  p_to_status TEXT
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  -- Get order with row lock
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'errors', jsonb_build_array(
        jsonb_build_object('code', 'ORDER_NOT_FOUND', 'message', 'Order not found')
      )
    );
  END IF;
  
  -- Basic validation: status matches
  IF v_order.current_status != p_from_status THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'STATUS_MISMATCH',
      'message', format('Order is %s, expected %s', v_order.current_status, p_from_status)
    );
  END IF;
  
  -- Basic validation: required fields (data integrity only)
  -- Complex business rules handled in application layer
  IF p_to_status = 'ready' AND COALESCE((SELECT COUNT(*) FROM org_order_items_dtl WHERE order_id = p_order_id AND tenant_org_id = p_tenant_org_id), 0) = 0 THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'NO_ITEMS',
      'message', 'Cannot move to ready without items'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_ord_validate_transition_basic IS 'Basic data integrity validation for transitions. Complex business rules handled in application layer.';

-- ==================================================================
-- FUNCTION: cmx_ord_execute_transition()
-- Purpose: Atomic transition execution (simple update + history)
-- Returns: JSONB with ok boolean and transition details
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_execute_transition(
  p_tenant_org_id UUID,
  p_order_id UUID,
  p_screen TEXT,
  p_from_status TEXT,
  p_to_status TEXT,
  p_user_id UUID,
  p_input JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_validation JSONB;
  v_existing_history UUID;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_history
    FROM org_order_history
    WHERE tenant_org_id = p_tenant_org_id
      AND order_id = p_order_id
      AND payload->>'idempotency_key' = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_history IS NOT NULL THEN
      -- Return existing result
      RETURN jsonb_build_object(
        'ok', true,
        'from_status', p_from_status,
        'to_status', p_to_status,
        'order_id', p_order_id,
        'idempotent', true
      );
    END IF;
  END IF;
  
  -- Lock order row
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ORDER_NOT_FOUND',
      'message', 'Order not found'
    );
  END IF;
  
  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at != p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CONCURRENT_UPDATE',
      'message', 'Order was modified by another user',
      'current_updated_at', v_order.updated_at,
      'expected_updated_at', p_expected_updated_at
    );
  END IF;
  
  -- Basic validation (data integrity only)
  v_validation := cmx_ord_validate_transition_basic(
    p_tenant_org_id, p_order_id, p_from_status, p_to_status
  );
  
  IF (v_validation->>'ok')::boolean = false THEN
    RETURN v_validation;
  END IF;
  
  -- Atomic update
  UPDATE org_orders_mst
  SET
    previous_status = current_status,
    current_status = p_to_status,
    current_stage = p_to_status,
    last_transition_at = NOW(),
    last_transition_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Write history
  INSERT INTO org_order_history (
    tenant_org_id, order_id, action_type, from_value, to_value,
    done_by, done_at, payload
  ) VALUES (
    p_tenant_org_id, 
    p_order_id, 
    'STATUS_CHANGE',
    p_from_status, 
    p_to_status,
    p_user_id, 
    NOW(),
    p_input || jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'screen', p_screen
    )
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'from_status', p_from_status,
    'to_status', p_to_status,
    'order_id', p_order_id,
    'updated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cmx_ord_execute_transition IS 'Atomic transition execution with history logging. Complex validation handled in application layer.';

-- ==================================================================
-- FUNCTION: cmx_ord_order_workflow_flags()
-- Purpose: Simple workflow flags lookup (no complex logic)
-- Returns: JSONB with workflow flags
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_order_workflow_flags(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
BEGIN
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  
  -- Get workflow template ID
  v_template_id := COALESCE(v_order.workflow_template_id, 
    (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_SIMPLE' AND is_active = true LIMIT 1));
  
  -- Return simple flags based on template
  -- Complex feature flag checks handled in application layer
  RETURN jsonb_build_object(
    'template_id', v_template_id,
    'assembly_enabled', EXISTS (
      SELECT 1 FROM sys_workflow_template_stages 
      WHERE template_id = v_template_id 
      AND stage_code = 'assembly' 
      AND is_active = true
    ),
    'qa_enabled', EXISTS (
      SELECT 1 FROM sys_workflow_template_stages 
      WHERE template_id = v_template_id 
      AND stage_code = 'qa' 
      AND is_active = true
    ),
    'packing_enabled', EXISTS (
      SELECT 1 FROM sys_workflow_template_stages 
      WHERE template_id = v_template_id 
      AND stage_code = 'packing' 
      AND is_active = true
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_ord_order_workflow_flags IS 'Returns workflow flags based on template. Complex feature flag checks handled in application layer.';

-- ==================================================================
-- FUNCTION: cmx_ord_order_live_metrics()
-- Purpose: Simple metrics calculation
-- Returns: JSONB with order metrics
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_order_live_metrics(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_items_count INTEGER;
  v_pieces_total INTEGER;
  v_pieces_scanned INTEGER;
BEGIN
  -- Simple counts
  SELECT COUNT(*) INTO v_items_count
  FROM org_order_items_dtl
  WHERE order_id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  SELECT 
    COALESCE(SUM(qty), 0),
    COALESCE(SUM(CASE WHEN item_status = 'processed' THEN qty ELSE 0 END), 0)
  INTO v_pieces_total, v_pieces_scanned
  FROM org_order_items_dtl
  WHERE order_id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN jsonb_build_object(
    'items_count', v_items_count,
    'pieces_total', v_pieces_total,
    'pieces_scanned', v_pieces_scanned,
    'all_items_processed', v_pieces_scanned >= v_pieces_total
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_ord_order_live_metrics IS 'Returns simple order metrics. Complex calculations handled in application layer.';

-- ==================================================================
-- GRANTS
-- ==================================================================

GRANT EXECUTE ON FUNCTION cmx_ord_screen_pre_conditions(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_validate_transition_basic(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_execute_transition(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_order_workflow_flags(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_order_live_metrics(UUID, UUID) TO authenticated;

COMMIT;

