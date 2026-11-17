-- =============================================================================
-- Migration: 0749_settings_resolver_session_definer.sql
-- Purpose:   Let the signed-in user resolve settings again. The resolver
--            reads the settings catalog and calls hq_ff_get_effective_value.
--            Those stay closed to the public key, so the invoker function
--            fails with permission denied. The two entry points now run as
--            the owner. A browser or anon JWT may pass only its own session
--            organization. service_role keeps the tenant id it was given.
--            The inner resolver body is not rewritten.
-- Affected:  fn_stng_resolve_all_settings, fn_stng_resolve_setting_value
-- Plan:      docs/pending_to_production/16_11_2026/S0_privilege_lockdown_PLAN.md
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- Browser settings, including the default guest customer, call this entry.
CREATE OR REPLACE FUNCTION public.fn_stng_resolve_all_settings(
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  stng_code text,
  stng_value_jsonb jsonb,
  stng_source_layer text,
  stng_source_id text,
  stng_computed_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
BEGIN
  -- Owner reads the catalog. The session may not ask for another organization.
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     AND p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'permission denied for settings'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.fn_stng_resolve_settings_set(p_tenant_id, p_branch_id, p_user_id, NULL);
END;
$function$;

-- Single-code entry. It reads the catalog itself, so it needs the same rule.
CREATE OR REPLACE FUNCTION public.fn_stng_resolve_setting_value(
  p_tenant_id uuid,
  p_setting_code text,
  p_branch_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  stng_code text,
  stng_value_jsonb jsonb,
  stng_source_layer text,
  stng_source_id text,
  stng_computed_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
#variable_conflict use_column
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     AND p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'permission denied for settings'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_tenant_settings_cd c
    WHERE c.setting_code = p_setting_code
      AND c.is_active = true
  ) THEN
    RETURN QUERY
    SELECT
      p_setting_code,
      jsonb_build_object(
        'error', 'Setting ' || COALESCE(p_setting_code, '<NULL>') || ' not found in catalog',
        'detail', 'P0001'
      ),
      'ERROR_AT: Checking Catalog for ' || COALESCE(p_setting_code, '<NULL>'),
      NULL::text,
      CURRENT_TIMESTAMP;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.fn_stng_resolve_settings_set(
    p_tenant_id, p_branch_id, p_user_id, ARRAY[p_setting_code]
  );
END;
$function$;

-- anon must not keep a definer that reads the catalog. The session role and
-- the service role are the callers.
REVOKE ALL ON FUNCTION public.fn_stng_resolve_all_settings(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_stng_resolve_setting_value(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_stng_resolve_all_settings(p_tenant_id uuid, p_branch_id uuid, p_user_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_stng_resolve_setting_value(p_tenant_id uuid, p_setting_code text, p_branch_id uuid, p_user_id uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_stng_resolve_all_settings(uuid, uuid, uuid) IS
  'Resolves every active setting for one organization. Runs as the owner so the catalog stays closed to the public key. anon and authenticated may pass only current_tenant_id() (0749).';

COMMENT ON FUNCTION public.fn_stng_resolve_setting_value(uuid, text, uuid, uuid) IS
  'Resolves one setting code for one organization. Runs as the owner so the catalog stays closed to the public key. anon and authenticated may pass only current_tenant_id() (0749).';

DO $check$
DECLARE
  bad integer;
BEGIN
  SELECT count(*) INTO bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('fn_stng_resolve_all_settings', 'fn_stng_resolve_setting_value')
    AND NOT (
      p.prosecdef
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%' AND cfg LIKE '%auth%'
      )
    );

  IF bad > 0 THEN
    RAISE EXCEPTION '0749 self-check failed: a settings resolver is not a session-checked definer';
  END IF;
END
$check$;

COMMIT;
