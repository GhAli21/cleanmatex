-- =============================================================================
-- 0856_customer_app_membership_read.sql
-- Customer App Orders, Phase 2: controlled global membership discovery.
--
-- Purpose:
--   Provide the Customer App service a single service-role-only read contract
--   for the Organizations that a verified global End Customer belongs to. It
--   replaces unauthenticated phone-based tenant enumeration. The caller must
--   first authenticate the opaque Customer App session; this function never
--   grants direct anon or authenticated access to tenant relationship data.
--
-- Deployment:
--   Forward-only draft. Review and apply through the owner-controlled database
--   workflow only; agents must not apply migrations.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE FUNCTION public.fn_cust_app_memberships(p_sys_customer_id UUID)
RETURNS TABLE (
  tenant_org_id UUID,
  org_customer_id UUID,
  organization_name TEXT,
  organization_name2 TEXT,
  organization_logo_url TEXT,
  is_hidden_by_customer BOOLEAN,
  active_order_count BIGINT,
  order_history_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    c.tenant_org_id,
    c.id AS org_customer_id,
    t.name AS organization_name,
    t.name2 AS organization_name2,
    t.logo_url AS organization_logo_url,
    c.is_hidden_by_customer,
    (
      SELECT count(*)
      FROM public.org_orders_mst o
      WHERE o.tenant_org_id = c.tenant_org_id
        AND o.customer_id = c.id
        --AND o.is_active
        --AND COALESCE(o.rec_status, 1) = 1
        --AND COALESCE(o.status, '') NOT IN ('delivered', 'cancelled', 'CANCELLED')
    ) AS active_order_count,
    (
      SELECT count(*)
      FROM public.org_orders_mst h
      WHERE h.tenant_org_id = c.tenant_org_id
        AND h.customer_id = c.id
        AND h.is_active
        AND COALESCE(h.rec_status, 1) = 1
    ) AS order_history_count
  FROM public.org_customers_mst c
  JOIN public.org_tenants_mst t
    ON t.id = c.tenant_org_id
   AND t.is_active
   AND COALESCE(t.rec_status, 1) = 1
  WHERE c.customer_id = p_sys_customer_id
    AND c.tenant_org_id = t.id
    AND c.is_active
    AND COALESCE(c.rec_status, 1) = 1
  ORDER BY c.created_at desc
  --ORDER BY lower(COALESCE(t.name, '')), c.tenant_org_id
  ;
$$;

COMMENT ON FUNCTION public.fn_cust_app_memberships(UUID) IS
  'Service-role-only Customer App membership projection. Given a verified global End Customer id, returns active Organization customer relationships, customer-controlled visibility, and tenant-scoped order summary counts. The API authenticates the opaque customer session before invoking it; this function does not authorize callers by itself.';

-- This privileged cross-Organization projection must not be callable with a
-- browser JWT. The Customer App API uses service_role after session validation.
REVOKE ALL ON FUNCTION public.fn_cust_app_memberships(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cust_app_memberships(UUID) TO service_role;

COMMIT;


