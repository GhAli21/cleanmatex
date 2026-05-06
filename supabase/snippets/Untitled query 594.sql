CREATE OR REPLACE FUNCTION public.get_user_tenants()
 RETURNS TABLE(tenant_id uuid, tenant_name character varying, tenant_slug character varying, user_id uuid, org_user_id uuid, user_role character varying, is_active boolean, last_login_at timestamp without time zone, s_current_plan character varying)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    u.user_id AS user_id,
    u.id AS org_user_id,
    u.role AS user_role,
    u.is_active AS is_active,
    u.last_login_at AS last_login_at,
    COALESCE(t.s_current_plan, 'FREE_TRIAL')::VARCHAR AS s_current_plan
  FROM org_users_mst u
  INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = auth.uid()
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$function$
