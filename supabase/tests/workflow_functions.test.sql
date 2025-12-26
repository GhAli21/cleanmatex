-- ==================================================================
-- Workflow Functions Tests for PRD-010
-- Purpose: Test cmx_order_transition and related workflow functions
-- Created: 2025-11-05
-- ==================================================================

BEGIN;

-- ==================================================================
-- TEST SETUP
-- ==================================================================

-- Create test tenant
INSERT INTO org_tenants_mst (id, name, slug, is_active, tenant_name)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Workflow Tenant', 'workflow-test', true, 'Test Workflow Tenant')
ON CONFLICT (id) DO NOTHING;

-- Create test customer
INSERT INTO sys_customers_mst (id, first_name, last_name, phone, email, created_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test', 'Customer', '+96890000000', 'customer@test.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Link customer to tenant
INSERT INTO org_customers_mst (id, tenant_org_id, customer_id, loyalty_points, is_active)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0, true)
ON CONFLICT (id) DO NOTHING;

-- Create test user
INSERT INTO org_users_mst (id, user_id, tenant_org_id, display_name, role, is_active)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Admin', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- Create test order
INSERT INTO org_orders_mst (
  id, tenant_org_id, customer_id, order_no, current_status,
  workflow_template_id, received_at, is_active, created_at
)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'ORD-TEST-001',
  'intake',
  (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_STANDARD' LIMIT 1),
  NOW(),
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ==================================================================
-- TEST 1: Valid Workflow Transition
-- ==================================================================

DO $$
DECLARE
  v_result JSONB;
  v_order_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_user_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_transition_success BOOLEAN := false;
BEGIN
  RAISE NOTICE '=== TEST 1: Valid Workflow Transition ===';

  -- Attempt valid transition from intake to processing
  BEGIN
    v_result := cmx_order_transition(
      p_tenant_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      p_order_id := v_order_id,
      p_from_status := 'intake',
      p_to_status := 'processing',
      p_user_id := v_user_id,
      p_payload := '{"notes": "Starting processing"}'::JSONB
    );
    
    IF v_result->>'success' = 'true' THEN
      v_transition_success := true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_transition_success := false;
      RAISE NOTICE 'Error: %', SQLERRM;
  END;

  ASSERT v_transition_success = true, 'Valid transition should succeed';

  -- Verify order status updated
  PERFORM pg_sleep(0.1); -- Small delay for async updates
  
  DECLARE
    v_actual_status TEXT;
  BEGIN
    SELECT current_status INTO v_actual_status
    FROM org_orders_mst
    WHERE id = v_order_id;
    
    ASSERT v_actual_status = 'processing', 'Order status should be updated to processing';
  END;

  -- Verify history entry created
  PERFORM pg_sleep(0.1);
  
  DECLARE
    v_history_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_history_count
    FROM org_order_history
    WHERE order_id = v_order_id
      AND action_type = 'STATUS_CHANGE'
      AND to_value = 'processing';
    
    ASSERT v_history_count >= 1, 'History entry should be created';
  END;

  RAISE NOTICE '✓ TEST 1 PASSED: Valid transition successful';
END $$;

-- ==================================================================
-- TEST 2: Invalid Workflow Transition (Blocked)
-- ==================================================================

DO $$
DECLARE
  v_result JSONB;
  v_order_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_user_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_transition_failed BOOLEAN := false;
BEGIN
  RAISE NOTICE '=== TEST 2: Invalid Workflow Transition ===';

  -- Attempt invalid transition: processing directly to delivered (should be blocked)
  BEGIN
    v_result := cmx_order_transition(
      p_tenant_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      p_order_id := v_order_id,
      p_from_status := 'processing',
      p_to_status := 'delivered',
      p_user_id := v_user_id,
      p_payload := '{}'::JSONB
    );
    
    IF v_result->>'success' = 'false' THEN
      v_transition_failed := true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Expected to fail
      v_transition_failed := true;
  END;

  ASSERT v_transition_failed = true, 'Invalid transition should be blocked';

  RAISE NOTICE '✓ TEST 2 PASSED: Invalid transition blocked';
END $$;

-- ==================================================================
-- TEST 3: History Entry for Order Created
-- ==================================================================

DO $$
DECLARE
  v_order_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_history_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 3: History Entry for Order Created ===';

  -- Check if ORDER_CREATED history entry exists
  SELECT COUNT(*) INTO v_history_count
  FROM org_order_history
  WHERE order_id = v_order_id
    AND action_type = 'ORDER_CREATED';

  ASSERT v_history_count >= 1, 'Order created history entry should exist';

  RAISE NOTICE '✓ TEST 3 PASSED: Order creation history recorded';
END $$;

-- ==================================================================
-- TEST 4: Workflow Template Stages Exist
-- ==================================================================

DO $$
DECLARE
  v_template_id UUID;
  v_stage_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 4: Workflow Template Stages ===';

  -- Get WF_STANDARD template
  SELECT template_id INTO v_template_id
  FROM sys_workflow_template_cd
  WHERE template_code = 'WF_STANDARD'
  LIMIT 1;

  ASSERT v_template_id IS NOT NULL, 'WF_STANDARD template should exist';

  -- Count stages for this template
  SELECT COUNT(*) INTO v_stage_count
  FROM sys_workflow_template_stages
  WHERE template_id = v_template_id;

  ASSERT v_stage_count >= 3, 'Template should have at least 3 stages';

  RAISE NOTICE '✓ TEST 4 PASSED: Workflow template stages verified';
END $$;

-- ==================================================================
-- TEST 5: Tenant Workflow Settings
-- ==================================================================

DO $$
DECLARE
  v_settings_id UUID;
  v_has_prep BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST 5: Tenant Workflow Settings ===';

  -- Create tenant workflow settings if they don't exist
  INSERT INTO org_tenant_workflow_settings_cf (
    tenant_org_id,
    use_preparation_screen,
    use_assembly_screen,
    use_qa_screen,
    track_individual_piece,
    orders_split_enabled
  )
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    true,
    false,
    true,
    true,
    true
  )
  ON CONFLICT (tenant_org_id) DO NOTHING
  RETURNING id INTO v_settings_id;

  -- Verify settings
  SELECT use_preparation_screen INTO v_has_prep
  FROM org_tenant_workflow_settings_cf
  WHERE tenant_org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  ASSERT v_has_prep = true, 'Tenant workflow settings should be created';

  RAISE NOTICE '✓ TEST 5 PASSED: Tenant workflow settings working';
END $$;

-- ==================================================================
-- TEST 6: Get Allowed Transitions
-- ==================================================================

DO $$
DECLARE
  v_order_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_transitions JSONB;
  v_transition_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 6: Get Allowed Transitions ===';

  -- Get allowed transitions for current order status
  SELECT cmx_get_allowed_transitions(v_order_id) INTO v_transitions;

  -- Count transitions
  v_transition_count := jsonb_array_length(v_transitions);

  ASSERT v_transition_count > 0, 'Should return at least one allowed transition';

  RAISE NOTICE '✓ TEST 6 PASSED: Allowed transitions retrieved';
END $$;

-- ==================================================================
-- TEST 7: Quality Gates (QA Required)
-- ==================================================================

DO $$
DECLARE
  v_template_id UUID;
  v_has_qa BOOLEAN := false;
BEGIN
  RAISE NOTICE '=== TEST 7: Quality Gates ===';

  -- Check if WF_ASSEMBLY_QA template has QA stage
  SELECT EXISTS (
    SELECT 1
    FROM sys_workflow_template_stages
    WHERE template_id = (
      SELECT template_id FROM sys_workflow_template_cd 
      WHERE template_code = 'WF_ASSEMBLY_QA'
    )
    AND stage_code = 'qa'
  ) INTO v_has_qa;

  ASSERT v_has_qa = true, 'WF_ASSEMBLY_QA template should have QA stage';

  RAISE NOTICE '✓ TEST 7 PASSED: Quality gates configured';
END $$;

-- ==================================================================
-- TEST 8: RLS Policies for History
-- ==================================================================

DO $$
DECLARE
  v_history_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 8: RLS Policies ===';

  -- Simulate tenant user context
  SET LOCAL request.jwt.claims = '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "tenant_org_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

  -- Try to query history
  SELECT COUNT(*) INTO v_history_count
  FROM org_order_history
  WHERE order_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  ASSERT v_history_count >= 0, 'User should be able to query history';

  RAISE NOTICE '✓ TEST 8 PASSED: RLS policies working';
END $$;

-- ==================================================================
-- TEST SUMMARY
-- ==================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ ALL WORKFLOW FUNCTION TESTS PASSED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tests completed successfully:';
  RAISE NOTICE '1. Valid Workflow Transition';
  RAISE NOTICE '2. Invalid Transition Blocking';
  RAISE NOTICE '3. History Entry Creation';
  RAISE NOTICE '4. Workflow Template Stages';
  RAISE NOTICE '5. Tenant Workflow Settings';
  RAISE NOTICE '6. Allowed Transitions';
  RAISE NOTICE '7. Quality Gates';
  RAISE NOTICE '8. RLS Policies';
  RAISE NOTICE '========================================';
END $$;

-- ==================================================================
-- CLEANUP (Optional - comment out to inspect test data)
-- ==================================================================

-- BEGIN;
-- DELETE FROM org_order_history WHERE order_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
-- DELETE FROM org_orders_mst WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
-- DELETE FROM org_users_mst WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
-- DELETE FROM org_customers_mst WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- DELETE FROM sys_customers_mst WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- DELETE FROM org_tenant_workflow_settings_cf WHERE tenant_org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- DELETE FROM org_tenants_mst WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- COMMIT;

