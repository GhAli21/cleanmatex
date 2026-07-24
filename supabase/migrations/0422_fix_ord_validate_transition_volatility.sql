-- ==================================================================
-- 0422_fix_ord_validate_transition_volatility.sql
-- Purpose: Fix "SELECT FOR UPDATE is not allowed in a non-volatile function"
--          during preparation/processing Complete & Continue transitions.
--
-- Root cause: cmx_ord_validate_transition_basic was STABLE but uses
--             SELECT ... FOR UPDATE. Postgres only allows FOR UPDATE in
--             VOLATILE functions. Preparation transition call chain:
--               cmx_ord_preparation_transition
--                 → cmx_ord_execute_transition (VOLATILE, FOR UPDATE)
--                   → cmx_ord_validate_transition_basic (was STABLE + FOR UPDATE) ✗
-- ==================================================================

BEGIN;

-- Keep FOR UPDATE for standalone callers; mark VOLATILE so locking is legal.
ALTER FUNCTION public.cmx_ord_validate_transition_basic(UUID, UUID, TEXT, TEXT)
  VOLATILE;

COMMENT ON FUNCTION public.cmx_ord_validate_transition_basic(UUID, UUID, TEXT, TEXT) IS
  'Basic data integrity validation for transitions (VOLATILE: uses SELECT FOR UPDATE). Complex business rules handled in application layer.';

-- Screen pre-condition wrappers previously IMMUTABLE; they now read tenant/
-- system rows via cmx_ord_screen_pre_conditions (STABLE). Align volatility.
ALTER FUNCTION public.cmx_ord_preparation_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_processing_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_assembly_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_qa_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_packing_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_ready_release_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_driver_delivery_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_new_order_pre_conditions() STABLE;
ALTER FUNCTION public.cmx_ord_workboard_pre_conditions() STABLE;

-- Cancel/return wrappers added in 0130 (may exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cmx_ord_canceling_pre_conditions'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.cmx_ord_canceling_pre_conditions() STABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cmx_ord_returning_pre_conditions'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.cmx_ord_returning_pre_conditions() STABLE';
  END IF;
END $$;

COMMIT;
