-- =============================================================================
-- Migration: 0748_grant_rls_helper_execute.sql
-- Purpose:   Restore EXECUTE on the two SECURITY DEFINER helpers that
--            organization row-security policies call as the session role.
--            0746 revoked every definer, including these. A policy then
--            raises "permission denied for function current_tenant_id"
--            instead of returning no rows. Both helpers ignore a
--            caller-supplied user or tenant: no JWT session returns NULL
--            or false. Bodies are not rewritten.
-- Affected:  public.current_tenant_id(), public.is_admin()
-- Plan:      docs/pending_to_production/16_11_2026/S0_privilege_lockdown_PLAN.md
--            Allowlist: S0_authenticated_allowlist.md (s0-rls-helpers)
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- Policies on org_* tables evaluate these as anon or authenticated.
-- service_role already has EXECUTE from 0746. Do not grant any other definer.
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

COMMENT ON FUNCTION public.current_tenant_id() IS
  'RLS tenant = the caller ACTIVE session laundry. PENDING, a locked membership, a global lock, and an attack lock return NULL. JWT tenant claims are ignored. Executable by anon and authenticated because row-security policies call it as the session role (0748). No session returns NULL.';

COMMENT ON FUNCTION public.is_admin() IS
  'True when auth.uid() is an active super_admin, tenant_admin or admin of current_tenant_id(). Single admin check used by RLS policies (0650). Executable by anon and authenticated because those policies call it as the session role (0748). No session returns false.';

DO $check$
DECLARE
  missing integer;
BEGIN
  SELECT count(*) INTO missing
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname IN ('current_tenant_id', 'is_admin')
    AND pg_get_function_identity_arguments(p.oid) = ''
    AND NOT (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
    );

  IF missing > 0 THEN
    RAISE EXCEPTION '0748 self-check failed: current_tenant_id or is_admin is not executable by anon, authenticated, and service_role';
  END IF;
END
$check$;

COMMIT;
