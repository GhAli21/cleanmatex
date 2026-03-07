-- ==================================================================
-- 0133_order_history_action_types_cancel_return.sql
-- Purpose: Add ORDER_CANCELLED and CUSTOMER_RETURN to org_order_history; use them in cancel/return transitions
-- Plan: cancel_and_return_order_ddb29821.plan.md
-- Dependencies: 0022_order_history_canonical.sql, 0130_cmx_ord_canceling_returning_functions.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- Step 1: Extend chk_history_action_type to include ORDER_CANCELLED, CUSTOMER_RETURN
-- ==================================================================

ALTER TABLE org_order_history DROP CONSTRAINT IF EXISTS chk_history_action_type;

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
    'ISSUE_SOLVED',
    'ORDER_CANCELLED',
    'CUSTOMER_RETURN'
  ));

COMMENT ON COLUMN org_order_history.action_type IS 'Action type: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED, ORDER_CANCELLED, CUSTOMER_RETURN';

-- ==================================================================
-- Step 2: Update cmx_ord_canceling_transition to use ORDER_CANCELLED
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

  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONCURRENT_UPDATE', 'message', 'Order was modified by another user');
  END IF;

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

  v_item_result := cmx_order_items_transition(
    p_tenant_org_id, p_order_id, v_from_status, 'cancelled', NULL, p_user_id, p_input
  );

  PERFORM log_order_action(
    p_tenant_org_id, p_order_id, 'ORDER_CANCELLED',
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
-- Step 3: Update cmx_ord_returning_transition to use CUSTOMER_RETURN
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
    p_tenant_org_id, p_order_id, 'CUSTOMER_RETURN',
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

COMMIT;
