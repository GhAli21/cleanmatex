-- ==================================================================
-- 0023_workflow_transition_function.sql
-- Purpose: Core workflow transition function for PRD-010
-- Author: CleanMateX Development Team
-- Created: 2025-11-05
-- Dependencies: 0018-0022 (all previous workflow migrations)
-- ==================================================================
-- This migration implements:
-- - cmx_order_transition(): Enforce workflow transitions with validation
-- - Validate template transitions
-- - Check quality gates (e.g., rack_location for READY)
-- - Update order status and history
-- - Bulk-update items when needed
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION: cmx_order_transition()
-- Purpose: Core workflow transition validation and execution
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_order_items_transition(
  p_tenant UUID,
  p_order UUID,
  p_from TEXT,
  p_to TEXT,
  p_user UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_transition_allowed BOOLEAN := false;
  v_quality_gate_passed BOOLEAN := true;
  v_error_message TEXT;
  v_result JSONB;
  v_items_updated INTEGER := 0;
  v_rack_location TEXT;
  v_notes TEXT;
  v_from TEXT:=LOWER(p_from);
  v_to TEXT:=LOWER(p_to);
  
BEGIN
  
  v_from :=LOWER(p_from);
  v_to :=LOWER(p_to);
  
  IF v_to = 'ready' THEN
    
	UPDATE org_order_items_dtl
    SET 
      item_status = 'ready',
      item_stage = 'ready'
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      /*
	  AND ( lower(item_status) IS NULL 
	        OR 
			lower(item_status) not in( 'ready', 'out_for_delivery', 'delivered', 'closed', 'cancelled')
		  )
	  */
	  --AND item_status IS NULL OR item_status = 'intake'
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
  
  ELSIF v_to = 'processing' THEN
    UPDATE org_order_items_dtl
    SET 
      item_status = 'processing',
      item_stage = 'processing'
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      /*
	  AND ( lower(item_status) IS NULL 
	        OR 
			lower(item_status) in( 'draft', 'intake', 'preparation')
		  )
	  */
	  --AND item_status IS NULL OR item_status = 'intake'
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
	
  ELSIF v_to = 'closed' THEN
    UPDATE org_order_items_dtl
    SET 
      item_status = v_to,
      item_stage = v_to
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      /*
	  AND ( lower(item_status) IS NULL 
	        OR 
			lower(item_status) in( 'draft', 'intake', 'preparation', 'processing')
		  )
	  */
	  --AND item_status IS NULL OR item_status = 'intake'
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
  
  ELSE 
    UPDATE org_order_items_dtl
    SET 
      item_status = v_to,
      item_stage = v_to
    WHERE order_id = p_order
      AND tenant_org_id = p_tenant
      
	  ;
    
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
	
  END IF;
  
  Return v_items_updated;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    --v_error_message := SQLERRM;
	Return('ERROR:'+SQLERRM);
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cmx_order_items_transition IS 'Update Order Items Status ';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cmx_order_items_transition(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_order_items_transition(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION cmx_order_transition(
  p_tenant UUID,
  p_order UUID,
  p_from TEXT,
  p_to TEXT,
  p_user UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_transition_allowed BOOLEAN := false;
  v_quality_gate_passed BOOLEAN := true;
  v_error_message TEXT;
  v_result JSONB;
  v_items_updated INTEGER := 0;
  v_rack_location TEXT;
  v_notes TEXT;
  v_from TEXT:=LOWER(p_from);
  v_to TEXT:=LOWER(p_to);
  v_item_update_result TEXT;
  
BEGIN
  
  v_from :=LOWER(p_from);
  v_to :=LOWER(p_to);
  
  -- Step 1: Get order details
  SELECT 
    o.*,
    otwt.template_id as workflow_template_id,
    COALESCE(otwt.template_id, o.workflow_template_id) as resolved_template_id
  INTO v_order
  FROM org_orders_mst o
  LEFT JOIN org_tenant_workflow_templates_cf otwt 
    ON otwt.tenant_org_id = o.tenant_org_id 
    AND otwt.is_default = true 
    AND otwt.is_active = true
  WHERE o.id = p_order 
    AND o.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or access denied',
      'code', 'ORDER_NOT_FOUND'
    );
  END IF;

  -- Set resolved template_id
  v_template_id := v_order.resolved_template_id;

  -- Fallback to WF_STANDARD if no template
  IF v_template_id IS NULL THEN
    SELECT template_id INTO v_template_id
    FROM sys_workflow_template_cd
    WHERE template_code = 'WF_STANDARD' AND is_active = true
    LIMIT 1;
  END IF;

  -- Step 2: Validate transition is allowed in template
  SELECT EXISTS (
    SELECT 1 FROM sys_workflow_template_transitions
    WHERE template_id = v_template_id
      AND LOWER(from_stage_code) = v_from
      AND LOWER(to_stage_code) = v_to
      AND is_active = true
      AND allow_manual = true
  ) INTO v_transition_allowed;

  IF NOT v_transition_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Transition from %s to %s not allowed', p_from, p_to),
      'code', 'TRANSITION_NOT_ALLOWED',
      'from', p_from,
      'to', p_to,
      'template_id', v_template_id
    );
  END IF;

  -- Step 3: Quality gate checks
  IF v_to = 'ready' THEN
    -- Check rack_location is set
    v_rack_location := COALESCE(
      (p_payload->>'rack_location')::TEXT,
      v_order.rack_location
    );

    IF v_rack_location IS NULL OR v_rack_location = '' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Rack location is required before moving to READY status',
        'code', 'QUALITY_GATE_FAILED',
        'gate', 'rack_location_required'
      );
    END IF;
  END IF;

  -- Step 4: Extract optional notes from payload
  v_notes := p_payload->>'notes';
  
  
  -- Step 5: Update org_orders_mst
  IF v_to='ready' THEN
      	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		ready_at=now(),
		last_transition_at = now(),
		last_transition_by = p_user,
		rack_location = COALESCE((p_payload->>'rack_location')::TEXT, rack_location),
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSIF v_to='delivered' THEN
      	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		delivered_at=now(),
		--delivered_note=COALESCE((p_payload->>'delivered_note')::TEXT, delivered_note),
		last_transition_at = now(),
		last_transition_by = p_user,
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSIF v_to='closed' THEN
      	  
	  UPDATE org_orders_mst
	  SET
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		delivered_at=COALESCE(delivered_at, now()),
		--closed_at=now(),
		--closed_note=COALESCE((p_payload->>'closed_note')::TEXT, closed_note),
		last_transition_at = now(),
		last_transition_by = p_user,
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSIF v_to='cancelled' THEN
      	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		--cancelled_at=now(),
		--cancelled_note=COALESCE((p_payload->>'cancelled_note')::TEXT, cancelled_note),
		last_transition_at = now(),
		last_transition_by = p_user,
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
	  
  ELSE
	  
	  UPDATE org_orders_mst
	  SET 
		status=v_to,
		current_status = v_to,
		current_stage = v_to,
		last_transition_at = now(),
		last_transition_by = p_user,
		rack_location = COALESCE((p_payload->>'rack_location')::TEXT, rack_location),
		updated_at = now()
	  WHERE id = p_order AND tenant_org_id = p_tenant
	  RETURNING * INTO v_order;
  
  END IF;
  
  -- Step 6: Bulk-update items if transitioning to processing
  v_item_update_result:=cmx_order_items_transition(
	  p_tenant,
	  p_order,
	  p_from,
	  p_to,
	  p_user
  );
  
  IF SUBSTR(v_item_update_result, 1, 5) = 'ERROR' THEN
    v_items_updated:=0;
  END IF;
  
  -- Step 7: Insert into org_order_history
  PERFORM log_order_action(
    p_tenant,
    p_order,
    'STATUS_CHANGE',
    p_from,
    p_to,
    p_user,
    jsonb_build_object(
      'template_id', v_template_id,
      'items_updated', v_items_updated,
      'notes', v_notes,
      'payload', p_payload
    )
  );

  -- Step 8: Build success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order,
    'from_status', p_from,
    'to_status', p_to,
    'template_id', v_template_id,
    'items_updated', v_items_updated,
    'rack_location', v_order.rack_location,
    'transitioned_at', now()
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    v_error_message := SQLERRM;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error_message,
      'code', 'TRANSITION_ERROR',
      'from', p_from,
      'to', p_to
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cmx_order_transition IS 'Enforce workflow transitions with template validation and quality gates';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cmx_order_transition(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_order_transition(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

-- ==================================================================
-- FUNCTION: cmx_validate_transition()
-- Purpose: Validate if a transition is allowed without executing it
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_validate_transition(
  p_tenant UUID,
  p_order UUID,
  p_from TEXT,
  p_to TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_transition_allowed BOOLEAN := false;
  v_result JSONB;
  v_quality_gates JSONB;
  v_from TEXT:=LOWER(p_from);
  v_to TEXT:=LOWER(p_to);
  
BEGIN
  
  v_from :=LOWER(p_from);
  v_to :=LOWER(p_to);
  
  -- Get order details
  SELECT 
    o.*,
    otwt.template_id as workflow_template_id,
    COALESCE(otwt.template_id, o.workflow_template_id) as resolved_template_id
  INTO v_order
  FROM org_orders_mst o
  LEFT JOIN org_tenant_workflow_templates_cf otwt 
    ON otwt.tenant_org_id = o.tenant_org_id 
    AND otwt.is_default = true 
    AND otwt.is_active = true
  WHERE o.id = p_order 
    AND o.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Order not found',
      'code', 'ORDER_NOT_FOUND'
    );
  END IF;

  v_template_id := v_order.resolved_template_id;

  -- Fallback to WF_STANDARD
  IF v_template_id IS NULL THEN
    SELECT template_id INTO v_template_id
    FROM sys_workflow_template_cd
    WHERE template_code = 'WF_STANDARD' AND is_active = true
    LIMIT 1;
  END IF;

  -- Check if transition is allowed
  SELECT EXISTS (
    SELECT 1 FROM sys_workflow_template_transitions
    WHERE template_id = v_template_id
      AND LOWER(from_stage_code) = v_from
      AND LOWER(to_stage_code) = v_to
      AND is_active = true
      AND allow_manual = true
  ) INTO v_transition_allowed;

  -- Check quality gates
  v_quality_gates := jsonb_build_object();

  IF p_to = 'ready' THEN
    IF v_order.rack_location IS NULL THEN
      v_quality_gates := jsonb_build_object(
        'passed', false,
        'required', 'rack_location'
      );
    ELSE
      v_quality_gates := jsonb_build_object('passed', true);
    END IF;
  ELSE
    v_quality_gates := jsonb_build_object('passed', true);
  END IF;

  v_result := jsonb_build_object(
    'allowed', v_transition_allowed,
    'template_id', v_template_id,
    'quality_gates', v_quality_gates,
    'from', p_from,
    'to', p_to
  );

  IF NOT v_transition_allowed THEN
    v_result := v_result || jsonb_build_object(
      'error', format('Transition from %s to %s not allowed', p_from, p_to),
      'code', 'TRANSITION_NOT_ALLOWED'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_validate_transition IS 'Validate if a workflow transition is allowed without executing it';

GRANT EXECUTE ON FUNCTION cmx_validate_transition(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_validate_transition(UUID, UUID, TEXT, TEXT) TO service_role;

-- ==================================================================
-- FUNCTION: cmx_get_allowed_transitions()
-- Purpose: Get all allowed transitions for an order
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_get_allowed_transitions(
  p_tenant UUID,
  p_order UUID,
  p_from TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
  v_allowed JSONB;
  v_current_status TEXT;
  v_from TEXT:=LOWER(p_from);
  
BEGIN
  -- Get order details
  SELECT 
    o.*,
    COALESCE(otwt.template_id, o.workflow_template_id) as resolved_template_id
  INTO v_order
  FROM org_orders_mst o
  LEFT JOIN org_tenant_workflow_templates_cf otwt 
    ON otwt.tenant_org_id = o.tenant_org_id 
    AND otwt.is_default = true 
    AND otwt.is_active = true
  WHERE o.id = p_order 
    AND o.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found',
      'transitions', '[]'::jsonb
    );
  END IF;

  v_template_id := v_order.resolved_template_id;
  v_current_status := LOWER(COALESCE(p_from, v_order.current_status));

  -- Fallback to WF_STANDARD
  IF v_template_id IS NULL THEN
    SELECT template_id INTO v_template_id
    FROM sys_workflow_template_cd
    WHERE template_code = 'WF_STANDARD' AND is_active = true
    LIMIT 1;
  END IF;

  -- Get allowed transitions
  SELECT jsonb_agg(
    jsonb_build_object(
      'to', to_stage_code,
      'requires_scan', requires_scan_ok,
      'requires_invoice', requires_invoice,
      'requires_pod', requires_pod,
      'allow_manual', allow_manual,
      'auto_when_done', auto_when_done
    )
  ) INTO v_allowed
  FROM sys_workflow_template_transitions
  WHERE template_id = v_template_id
    AND from_stage_code = v_current_status
    AND is_active = true;

  IF v_allowed IS NULL THEN
    v_allowed := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'from_status', v_current_status,
    'template_id', v_template_id,
    'transitions', v_allowed
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_get_allowed_transitions IS 'Get all allowed transitions for an order from current status';

GRANT EXECUTE ON FUNCTION cmx_get_allowed_transitions(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_get_allowed_transitions(UUID, UUID, TEXT) TO service_role;

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_function_count INTEGER;
  v_order_exists BOOLEAN;
  v_template_exists BOOLEAN;
BEGIN
  -- Check functions exist
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'cmx_order_transition',
    'cmx_validate_transition',
    'cmx_get_allowed_transitions'
  );

  IF v_function_count < 3 THEN
    RAISE EXCEPTION 'Expected 3 transition functions, found %', v_function_count;
  END IF;

  -- Check we have orders and templates
  SELECT EXISTS (SELECT 1 FROM org_orders_mst LIMIT 1) INTO v_order_exists;
  SELECT EXISTS (SELECT 1 FROM sys_workflow_template_cd WHERE is_active = true LIMIT 1) INTO v_template_exists;

  IF v_template_exists THEN
    RAISE NOTICE '✓ Migration 0023 validation passed successfully';
    RAISE NOTICE '  - 3 transition functions created';
    RAISE NOTICE '  - Execute permissions granted';
    RAISE NOTICE '  - Workflow templates available for testing';
  ELSE
    RAISE WARNING 'No active workflow templates found. Template transitions will use WF_STANDARD fallback.';
  END IF;
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Enhance WorkflowService to call these functions
-- 2. Create API endpoints for transitions
-- 3. Test transitions end-to-end

-- TESTING:
-- 1. Test validation: SELECT cmx_validate_transition('tenant-id', 'order-id', 'intake', 'processing');
--{"to":"processing","from":"intake","allowed":true,"template_id":"847de71d-3dfb-4d7c-a5b2-d5a98822eb85","quality_gates":{"passed":true}}

-- 2. Test get transitions: SELECT cmx_get_allowed_transitions('tenant-id', 'order-id');
-- 3. Test transition: SELECT cmx_order_transition('tenant-id', 'order-id', 'intake', 'processing', auth.uid(), '{"notes": "Test"}'::jsonb);
-- 4. Test quality gate: Try transitioning to ready without rack_location

-- IMPORTANT NOTES:
-- - All functions are SECURITY DEFINER to bypass RLS during execution
-- - Functions validate tenant isolation explicitly
-- - Quality gate checks are extensible (add more as needed)
-- - History is auto-logged via log_order_action()
-- - Item bulk-updates happen automatically for certain transitions

-- ERROR CODES:
-- - ORDER_NOT_FOUND: Order doesn't exist or tenant mismatch
-- - TRANSITION_NOT_ALLOWED: Invalid from/to status combination
-- - QUALITY_GATE_FAILED: Required conditions not met
-- - TRANSITION_ERROR: Unexpected error during transition

