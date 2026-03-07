-- ==================================================================
-- 0130_cmx_ord_canceling_returning_functions.sql
-- Purpose: Add canceling and returning screens + transition functions
-- Plan: cancel_and_return_order_ddb29821.plan.md
-- Dependencies: 0075_screen_contract_functions_simplified.sql, 0129_add_order_cancel_and_return_columns.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- Step 1: Extend cmx_ord_screen_pre_conditions with canceling and returning
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_screen_pre_conditions(
  p_screen TEXT
) RETURNS JSONB AS $$
BEGIN
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
      WHEN 'canceling' THEN ARRAY['draft','intake','preparation','processing','sorting','washing','drying','finishing','assembly','qa','packing','ready','out_for_delivery']::TEXT[]
      WHEN 'returning' THEN ARRAY['delivered','closed']::TEXT[]
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
      WHEN 'canceling' THEN ARRAY['orders:cancel']::TEXT[]
      WHEN 'returning' THEN ARRAY['orders:return']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- ==================================================================
-- Step 2: cmx_ord_canceling_pre_conditions
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_canceling_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$
  SELECT cmx_ord_screen_pre_conditions('canceling');
$$;

COMMENT ON FUNCTION cmx_ord_canceling_pre_conditions IS 'Pre-conditions for cancel order screen';

-- ==================================================================
-- Step 3: cmx_ord_canceling_transition
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_canceling_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_input jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_from_status TEXT;
  v_allowed_statuses TEXT[] := ARRAY['draft','intake','preparation','processing','sorting','washing','drying','finishing','assembly','qa','packing','ready','out_for_delivery'];
  v_item_result TEXT;
BEGIN
  -- Lock and get order
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order not found');
  END IF;

  v_from_status := LOWER(COALESCE(v_order.current_status, v_order.status, ''));

  IF v_from_status NOT IN (SELECT unnest(v_allowed_statuses)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STATUS_NOT_ALLOWED',
      'message', format('Cannot cancel order in status %s', v_from_status));
  END IF;

  IF COALESCE(TRIM(p_input->>'cancelled_note'), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Cancellation reason is required');
  END IF;

  -- Optimistic concurrency
  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONCURRENT_UPDATE', 'message', 'Order was modified by another user');
  END IF;

  -- Update order
  UPDATE org_orders_mst
  SET
    status = 'cancelled',
    current_status = 'cancelled',
    current_stage = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_user_id,
    cancelled_note = (p_input->>'cancelled_note')::TEXT,
    cancellation_reason_code = (p_input->>'cancellation_reason_code')::VARCHAR(50),
    last_transition_at = now(),
    last_transition_by = p_user_id,
    updated_at = now()
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;

  -- Update items
  v_item_result := cmx_order_items_transition(
    p_tenant_org_id, p_order_id, v_from_status, 'cancelled', NULL, p_user_id, p_input
  );

  -- Log history
  PERFORM log_order_action(
    p_tenant_org_id, p_order_id, 'STATUS_CHANGE',
    v_from_status, 'cancelled',
    p_user_id,
    p_input || jsonb_build_object('screen', 'canceling', 'idempotency_key', p_idempotency_key)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_from_status,
    'to_status', 'cancelled',
    'order_id', p_order_id,
    'updated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_canceling_transition IS 'Execute cancel order transition';

-- ==================================================================
-- Step 4: cmx_ord_returning_pre_conditions
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_returning_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$
  SELECT cmx_ord_screen_pre_conditions('returning');
$$;

COMMENT ON FUNCTION cmx_ord_returning_pre_conditions IS 'Pre-conditions for customer return screen';

-- ==================================================================
-- Step 5: cmx_ord_returning_transition
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_returning_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_input jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_from_status TEXT;
  v_reason TEXT;
  v_item_result TEXT;
BEGIN
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order not found');
  END IF;

  v_from_status := LOWER(COALESCE(v_order.current_status, v_order.status, ''));

  IF v_from_status NOT IN ('delivered', 'closed') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STATUS_NOT_ALLOWED',
      'message', format('Customer return only allowed for delivered/closed orders, current: %s', v_from_status));
  END IF;

  v_reason := COALESCE(TRIM(p_input->>'return_reason'), TRIM(p_input->>'cancelled_note'), '');
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'Return reason is required');
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONCURRENT_UPDATE', 'message', 'Order was modified by another user');
  END IF;

  -- Update order (cancel + return fields)
  UPDATE org_orders_mst
  SET
    status = 'cancelled',
    current_status = 'cancelled',
    current_stage = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_user_id,
    cancelled_note = v_reason,
    cancellation_reason_code = (p_input->>'cancellation_reason_code')::VARCHAR(50),
    returned_at = now(),
    returned_by = p_user_id,
    return_reason = v_reason,
    return_reason_code = (p_input->>'return_reason_code')::VARCHAR(50),
    last_transition_at = now(),
    last_transition_by = p_user_id,
    updated_at = now()
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;

  v_item_result := cmx_order_items_transition(
    p_tenant_org_id, p_order_id, v_from_status, 'cancelled', NULL, p_user_id, p_input
  );

  PERFORM log_order_action(
    p_tenant_org_id, p_order_id, 'STATUS_CHANGE',
    v_from_status, 'cancelled',
    p_user_id,
    p_input || jsonb_build_object('screen', 'returning', 'return_type', 'customer_return', 'idempotency_key', p_idempotency_key)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_from_status,
    'to_status', 'cancelled',
    'order_id', p_order_id,
    'updated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_returning_transition IS 'Execute customer return transition (delivered/closed -> cancelled)';

-- ==================================================================
-- Step 6: Grants
-- ==================================================================

GRANT EXECUTE ON FUNCTION cmx_ord_canceling_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_canceling_transition(uuid, uuid, uuid, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_returning_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_returning_transition(uuid, uuid, uuid, jsonb, text, timestamptz) TO authenticated;

COMMIT;
