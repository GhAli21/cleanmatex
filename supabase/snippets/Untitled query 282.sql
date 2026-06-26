
SELECT cmx_rebuild_user_permissions(user_id, tenant_org_id)
FROM org_users_mst
WHERE 1=1 -- tenant_org_id = 'tenant-uuid'::uuid
  AND is_active = true
  ;

SELECT permission_code, resource_type, resource_id, allow
FROM cmx_effective_permissions
WHERE user_id = 'user-uuid'
  AND tenant_org_id = 'tenant-uuid'
ORDER BY permission_code
;

SELECT cmx_rebuild_user_permissions(user_id, tenant_org_id)
FROM (
  SELECT DISTINCT user_id, tenant_org_id
  FROM org_users_mst
) AS users
;