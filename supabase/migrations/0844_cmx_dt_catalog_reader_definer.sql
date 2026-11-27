-- =============================================================================
-- Migration: 0844_cmx_dt_catalog_reader_definer.sql
-- Purpose:   Signed-in users (role authenticated) could not resolve a zone or
--            validate a zone: fn_ops_zone and the three catalog readers were
--            SECURITY INVOKER, and sys_timezone_cd is closed to anon and
--            authenticated since 0745 (S0 privilege lockdown, no browser policy).
--            Error seen: "permission denied for table sys_timezone_cd" (42501)
--            from fn_cmx_dt_zone -> fn_ops_zone as authenticated. The same gap
--            hit the zone validators on org_tenants_mst / org_branches_mst for
--            writes made with a user JWT (trigger -> fn_cmx_dt__accept_zone).
-- Fix:       Keep 0745 (no SELECT grant, no policy on sys_timezone_cd). Run the
--            four readers as their owner (SECURITY DEFINER) with the search_path
--            they already pin. Each returns only a zone name or a boolean; the
--            tenant guard in fn_ops_zone (auth.uid() + current_tenant_id())
--            still blocks reading another organization. Execute grants do not
--            change: authenticated and service_role yes, anon no.
-- Functions: fn_ops_zone(uuid,text,uuid) (0830/0842), fn_cmx_dt_is_valid_zone(text),
--            fn_cmx_dt_canonical_zone(text), fn_cmx_dt__accept_zone(text) (0842).
-- Checked:   every other fn_cmx_dt_* / fn_shc_clock_* that reads sys_country_cd,
--            hq_general_config, cmx_dt_env_cf or sys_timezone_cd is already
--            SECURITY DEFINER, or (fn_cmx_dt__fake_instant) reads its table only
--            after the superuser gate. fn_cmx_dt__catalog_integrity fires only on
--            sys_timezone_cd writes, which only service_role/postgres can make.
-- Requires:  0842 applied. Owner (postgres) must bypass row security (0745 forces it).
-- Apply:     by the user (D17). Plan: docs/features/Time_and_Timezone/MASTER_PLAN_v2.md (S2 follow-up 0.1.43.2).
--
-- ROLLBACK (only if this change must be undone; it brings the 42501 back for authenticated):
--   BEGIN;
--   ALTER FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) SECURITY INVOKER;  -- CLOCK-OK: rollback note
--   ALTER FUNCTION public.fn_cmx_dt_is_valid_zone(TEXT) SECURITY INVOKER;
--   ALTER FUNCTION public.fn_cmx_dt_canonical_zone(TEXT) SECURITY INVOKER;
--   ALTER FUNCTION public.fn_cmx_dt__accept_zone(TEXT) SECURITY INVOKER;
--   COMMIT;
--   Grants and bodies are untouched by this file, so nothing else is restored.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

DO $pre$
BEGIN
  IF to_regprocedure('public.fn_cmx_dt__accept_zone(text)') IS NULL
     OR to_regprocedure('public.fn_cmx_dt_is_valid_zone(text)') IS NULL
     OR to_regprocedure('public.fn_cmx_dt_canonical_zone(text)') IS NULL
     OR to_regprocedure('public.fn_ops_zone(uuid,text,uuid)') IS NULL THEN  -- CLOCK-OK: precheck of the zone door
    RAISE EXCEPTION '0844: apply 0842 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION '0844: run as postgres (the owner must bypass row security on sys_timezone_cd)';
  END IF;
END
$pre$;

ALTER FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) SECURITY DEFINER;  -- CLOCK-OK: 0844 changes the zone door's security mode
ALTER FUNCTION public.fn_cmx_dt_is_valid_zone(TEXT) SECURITY DEFINER;
ALTER FUNCTION public.fn_cmx_dt_canonical_zone(TEXT) SECURITY DEFINER;
ALTER FUNCTION public.fn_cmx_dt__accept_zone(TEXT) SECURITY DEFINER;

-- Owner is the migration role so the definer bypasses forced row security.
ALTER FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) OWNER TO postgres;  -- CLOCK-OK: 0844 owner of the zone door
ALTER FUNCTION public.fn_cmx_dt_is_valid_zone(TEXT) OWNER TO postgres;
ALTER FUNCTION public.fn_cmx_dt_canonical_zone(TEXT) OWNER TO postgres;
ALTER FUNCTION public.fn_cmx_dt__accept_zone(TEXT) OWNER TO postgres;

-- Grants restated (unchanged): no anon, no PUBLIC.
REVOKE ALL ON FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) FROM PUBLIC, anon;  -- CLOCK-OK: 0844 restates the zone door grants
GRANT EXECUTE ON FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) TO authenticated, service_role;  -- CLOCK-OK: 0844 restates the zone door grants
REVOKE ALL ON FUNCTION public.fn_cmx_dt_is_valid_zone(TEXT), public.fn_cmx_dt_canonical_zone(TEXT), public.fn_cmx_dt__accept_zone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cmx_dt_is_valid_zone(TEXT), public.fn_cmx_dt_canonical_zone(TEXT), public.fn_cmx_dt__accept_zone(TEXT) TO authenticated, service_role;

-- Verification: definer, pinned search_path, owner bypasses row security, anon cannot execute.
DO $verify$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
    FROM pg_proc p
    JOIN pg_roles o ON o.oid = p.proowner
   WHERE p.oid IN ('public.fn_ops_zone(uuid,text,uuid)'::regprocedure,  -- CLOCK-OK: verification of the zone door
                   'public.fn_cmx_dt_is_valid_zone(text)'::regprocedure,
                   'public.fn_cmx_dt_canonical_zone(text)'::regprocedure,
                   'public.fn_cmx_dt__accept_zone(text)'::regprocedure)
     AND (NOT p.prosecdef
          OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search\_path=%')
          OR NOT (o.rolsuper OR o.rolbypassrls)
          OR has_function_privilege('anon', p.oid, 'EXECUTE')
          OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '0844 verification failed for %', v_bad;
  END IF;
  IF public.fn_cmx_dt__accept_zone('Asia/Calcutta') IS DISTINCT FROM 'Asia/Kolkata' THEN
    RAISE EXCEPTION '0844 verification failed: alias normalization';
  END IF;
  RAISE NOTICE '0844: 4 catalog readers are SECURITY DEFINER; authenticated can resolve and validate zones';
END
$verify$;

COMMIT;
