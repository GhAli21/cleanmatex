-- ============================================================================
-- Migration: 0442_retire_workflow_rpc_grants.sql
-- Purpose: Retire application access to superseded workflow business RPCs
-- Scope: Permission contraction only; functions remain available to their owner
-- Rollback: Re-grant only the signatures required by an approved rollback plan
-- ============================================================================

-- The application workflow engine is now the sole transition authority. Revoking
-- PUBLIC as well as API roles prevents accidental re-entry through REST/RPC clients.
REVOKE EXECUTE ON FUNCTION public.cmx_order_items_transition(UUID, UUID, TEXT, TEXT, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_order_transition(UUID, UUID, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_validate_transition(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_get_allowed_transitions(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cmx_ord_screen_pre_conditions(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_ord_validate_transition_basic(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_ord_execute_transition(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_ord_order_workflow_flags(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_ord_canceling_transition(UUID, UUID, UUID, JSONB, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cmx_ord_returning_transition(UUID, UUID, UUID, JSONB, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.cmx_order_transition(UUID, UUID, TEXT, TEXT, UUID, JSONB)
  IS 'Retired application RPC retained temporarily for controlled rollback; WorkflowEngine is authoritative.';
COMMENT ON FUNCTION public.cmx_ord_execute_transition(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TIMESTAMPTZ)
  IS 'Retired application RPC retained temporarily for controlled rollback; WorkflowEngine is authoritative.';
