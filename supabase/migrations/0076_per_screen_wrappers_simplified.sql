-- ==================================================================
-- 0076_per_screen_wrappers_simplified.sql
-- Purpose: Per-screen wrapper functions for Orders workflow
-- Author: CleanMateX Development Team
-- Created: 2026-01-14
-- Dependencies: 0075_screen_contract_functions_simplified.sql
-- ==================================================================
-- This migration creates thin wrapper functions for each screen that call
-- the generic cmx_ord_* functions. All wrappers use cmx_ord_* prefix.
-- ==================================================================

BEGIN;

-- ==================================================================
-- PREPARATION SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_preparation_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('preparation'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_preparation_transition(
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
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'preparation',
    v_from_status,
    'processing',
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_preparation_pre_conditions IS 'Wrapper for preparation screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_preparation_transition IS 'Wrapper for preparation screen transition';

-- ==================================================================
-- PROCESSING SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_processing_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('processing'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_processing_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_to_status text,
  p_input jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'processing',
    v_from_status,
    p_to_status,
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_processing_pre_conditions IS 'Wrapper for processing screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_processing_transition IS 'Wrapper for processing screen transition';

-- ==================================================================
-- ASSEMBLY SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_assembly_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('assembly'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_assembly_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_to_status text,
  p_input jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'assembly',
    v_from_status,
    p_to_status,
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_assembly_pre_conditions IS 'Wrapper for assembly screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_assembly_transition IS 'Wrapper for assembly screen transition';

-- ==================================================================
-- QA SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_qa_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('qa'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_qa_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_to_status text,
  p_input jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'qa',
    v_from_status,
    p_to_status,
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_qa_pre_conditions IS 'Wrapper for QA screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_qa_transition IS 'Wrapper for QA screen transition';

-- ==================================================================
-- PACKING SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_packing_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('packing'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_packing_transition(
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
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'packing',
    v_from_status,
    'ready',
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_packing_pre_conditions IS 'Wrapper for packing screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_packing_transition IS 'Wrapper for packing screen transition';

-- ==================================================================
-- READY RELEASE SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_ready_release_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('ready_release'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_ready_release_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_to_status text,
  p_input jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'ready_release',
    v_from_status,
    p_to_status,
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_ready_release_pre_conditions IS 'Wrapper for ready release screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_ready_release_transition IS 'Wrapper for ready release screen transition';

-- ==================================================================
-- DRIVER DELIVERY SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_driver_delivery_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('driver_delivery'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_driver_delivery_transition(
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
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'driver_delivery',
    v_from_status,
    'delivered',
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_driver_delivery_pre_conditions IS 'Wrapper for driver delivery screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_driver_delivery_transition IS 'Wrapper for driver delivery screen transition';

-- ==================================================================
-- NEW ORDER SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_new_order_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('new_order'); 
$$;

CREATE OR REPLACE FUNCTION cmx_ord_new_order_transition(
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
  v_from_status TEXT;
BEGIN
  SELECT current_status INTO v_from_status
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'new_order',
    v_from_status,
    'intake',
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_new_order_pre_conditions IS 'Wrapper for new order screen pre-conditions';
COMMENT ON FUNCTION cmx_ord_new_order_transition IS 'Wrapper for new order screen transition';

-- ==================================================================
-- WORKBOARD SCREEN WRAPPERS
-- ==================================================================

CREATE OR REPLACE FUNCTION cmx_ord_workboard_pre_conditions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$ 
  SELECT cmx_ord_screen_pre_conditions('workboard'); 
$$;

COMMENT ON FUNCTION cmx_ord_workboard_pre_conditions IS 'Wrapper for workboard screen pre-conditions';

-- ==================================================================
-- GRANTS
-- ==================================================================

GRANT EXECUTE ON FUNCTION cmx_ord_preparation_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_preparation_transition(uuid, uuid, uuid, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_processing_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_processing_transition(uuid, uuid, uuid, text, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_assembly_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_assembly_transition(uuid, uuid, uuid, text, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_qa_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_qa_transition(uuid, uuid, uuid, text, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_packing_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_packing_transition(uuid, uuid, uuid, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_ready_release_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_ready_release_transition(uuid, uuid, uuid, text, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_driver_delivery_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_driver_delivery_transition(uuid, uuid, uuid, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_new_order_pre_conditions() TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_new_order_transition(uuid, uuid, uuid, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_workboard_pre_conditions() TO authenticated;

COMMIT;

