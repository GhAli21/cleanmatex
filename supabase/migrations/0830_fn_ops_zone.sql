-- SQL door for the operations zone. Same answer as resolveOperationalTimeZone:
-- an active branch catalog code, otherwise the active organization code, otherwise null.
-- A signed-in caller may ask only for the session tenant. A server connection may name the tenant.
-- Not granted to anon.

BEGIN;

CREATE FUNCTION public.fn_ops_zone(p_tenant UUID, p_operation TEXT, p_scope UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_zone TEXT;
BEGIN
  -- Closed codes shared with web-admin/lib/utils/operational-time.ts.
  IF p_operation NOT IN ('accept_order', 'ready_by', 'pos_session', 'delivery', 'invoice', 'ledger') THEN
    RETURN NULL;
  END IF;
  -- A user JWT cannot read another organization's zone. Server connections have no auth.uid().
  IF auth.uid() IS NOT NULL AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'OPS_ZONE_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT CASE
           WHEN bz.code IS NOT NULL THEN b.timezone_code
           WHEN oz.code IS NOT NULL THEN t.timezone
           ELSE NULL
         END
    INTO v_zone
    FROM public.org_tenants_mst t
    LEFT JOIN public.org_branches_mst b
      ON p_scope IS NOT NULL
     AND b.tenant_org_id = t.id
     AND b.id = p_scope
    LEFT JOIN public.sys_timezone_cd bz
      ON bz.code = b.timezone_code
     AND bz.is_active IS TRUE
    LEFT JOIN public.sys_timezone_cd oz
      ON oz.code = t.timezone
     AND oz.is_active IS TRUE
   WHERE t.id = p_tenant
   LIMIT 1;

  IF v_zone IS NULL THEN
    RETURN NULL;
  END IF;
  -- One value, not a catalog scan. An inactive or unknown code already failed the join.
  BEGIN
    PERFORM pg_catalog.now() AT TIME ZONE v_zone;
  EXCEPTION WHEN invalid_parameter_value THEN
    RETURN NULL;
  END;
  RETURN v_zone;
END;
$$;

COMMENT ON FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) IS
  'Operations zone for one action. p_tenant is the organization. p_operation is accept_order, ready_by, pos_session, delivery, invoice, or ledger. p_scope is the owning branch, or null to read the organization only. Returns the active branch zone, otherwise the active organization zone, otherwise null. Does not fall back to UTC, the HQ zone, or a client-supplied zone.';

REVOKE ALL ON FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ops_zone(UUID, TEXT, UUID) TO authenticated, service_role;

COMMIT;
