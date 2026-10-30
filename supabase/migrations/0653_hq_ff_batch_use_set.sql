-- ============================================================
-- Migration: 0653_hq_ff_batch_use_set.sql
-- Purpose:   (1) Rewire hq_ff_get_effective_values_batch to the set-based
--                hq_ff_get_eff_values_set (0651). Equivalence verified on remote
--                2026-10-28: every tenant, all 302 active flags plus a subset that
--                includes an unknown key, identical JSON.
--            (2) Close a cross-tenant read. The batch takes p_tenant_id from the
--                caller and was executable by anon/authenticated, so any session
--                could read any tenant's flags. Both real callers are service-role:
--                web-admin lib/services/feature-flags.service.ts (admin client since
--                2026-10-28) and HQ platform-api FlagEvaluationService
--                (SupabaseService uses SUPABASE_SERVICE_ROLE_KEY).
-- Affected:  hq_ff_get_effective_values_batch (body and grants)
-- Related:   0158 (original batch), 0651 (set-based core)
-- ============================================================

-- Same signature and return type, so generated types are unchanged.
-- SECURITY INVOKER: it only delegates. The core it calls is SECURITY DEFINER and
-- executable by service_role only, which keeps the callable surface server-side.
CREATE OR REPLACE FUNCTION public.hq_ff_get_effective_values_batch(
  p_tenant_id UUID,
  p_flag_keys TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT public.hq_ff_get_eff_values_set(p_tenant_id, p_flag_keys);
$function$;

COMMENT ON FUNCTION public.hq_ff_get_effective_values_batch(UUID, TEXT[]) IS
  'Effective feature-flag values for a tenant ({flag_key: value}); NULL/empty keys = all active flags. Delegates to hq_ff_get_eff_values_set (0653). Server-only (service_role).';

-- Server-only: browser and customer sessions must not read arbitrary tenants' flags.
REVOKE EXECUTE ON FUNCTION public.hq_ff_get_effective_values_batch(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hq_ff_get_effective_values_batch(UUID, TEXT[]) TO service_role;
