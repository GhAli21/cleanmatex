

-- 1) Confirm the tenant-user row exists and see the assigned base role
select user_id, tenant_org_id, role, is_active, display_name
from org_users_mst
where user_id = '8ee8d050-aa45-4c04-82d6-cfc761a0a1bd'
  and tenant_org_id = '11111111-1111-1111-1111-111111111111'
;
user_id= 8ee8d050-aa45-4c04-82d6-cfc761a0a1bd

-- 2) See role-default permissions from the base role on org_users_mst
select ou.role, rdp.permission_code
from org_users_mst ou
join sys_auth_role_default_permissions rdp
  on rdp.role_code = ou.role
where ou.user_id = '8ee8d050-aa45-4c04-82d6-cfc761a0a1bd'
  and ou.tenant_org_id = '11111111-1111-1111-1111-111111111111'
  and ou.is_active = true
  and rdp.is_active = true
  and rdp.is_enabled = true
order by rdp.permission_code
;

-- 3) See explicit tenant role assignments
select user_id, tenant_org_id, role_code, is_active
from org_auth_user_roles
where user_id = '8ee8d050-aa45-4c04-82d6-cfc761a0a1bd'
  and tenant_org_id = '11111111-1111-1111-1111-111111111111'
order by role_code
;

-- 4) See the effective permission cache rows actually used by get_user_permissions()
select permission_code, allow
from cmx_effective_permissions
where user_id = '8ee8d050-aa45-4c04-82d6-cfc761a0a1bd'
  and tenant_org_id = '11111111-1111-1111-1111-111111111111'
order by permission_code
;

-- 5) Quick count of effective allowed permissions
select count(*) as effective_allowed_count
from cmx_effective_permissions
where user_id = '8ee8d050-aa45-4c04-82d6-cfc761a0a1bd'
  and tenant_org_id = '11111111-1111-1111-1111-111111111111'
  and allow = true
;

-- 6) Emulate the browser JWT/session and test the exact RPC path
begin;

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "8ee8d050-aa45-4c04-82d6-cfc761a0a1bd",
  "role": "authenticated",
  "tenant_org_id": "11111111-1111-1111-1111-111111111111"
}';

select auth.uid(), current_tenant_id();

select * from get_user_permissions() order by permission_code;

select
  has_permission('products:read') as products_read,
  has_permission('catalog:read') as catalog_read,
  has_permission('orders:read') as orders_read,
  has_permission('pos_session:view') as pos_session_view;

rollback;

-- 7) Compare with the role-based helper used by navigation
select * from get_role_permissions_jh('super_admin') order by permission_code
;

-- 8) Compare with the user+tenant helper
select *
from get_user_permissions_jh(
  '8ee8d050-aa45-4c04-82d6-cfc761a0a1bd',
  '11111111-1111-1111-1111-111111111111'
)
order by permission_code
;

Select cmx_rebuild_user_permissions(ou.user_id, ou.tenant_org_id)
from org_users_mst ou
;

DO $$
DECLARE
  v_user RECORD;
  v_rebuilt_count INTEGER := 0;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ou.user_id, ou.tenant_org_id
    FROM public.org_users_mst ou
    WHERE ou.user_id IS NOT NULL
      AND ou.tenant_org_id IS NOT NULL
      --AND COALESCE(ou.is_active, TRUE) = TRUE
      --AND COALESCE(ou.rec_status, 1) = 1
  LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_rebuilt_count := v_rebuilt_count + 1;
  END LOOP;

  RAISE NOTICE 'POS session effective permissions rebuilt for % user/tenant rows', v_rebuilt_count;
END $$;