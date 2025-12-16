
INSERT INTO org_customers_mst (
  id, tenant_org_id, customer_id, name, name2, display_name,
  first_name, last_name, phone, email, type, address, area,
  building, floor, preferences, customer_source_type, s_date,
  loyalty_points, rec_order, rec_status, is_active, rec_notes,
  created_at, created_by, created_info, updated_at, updated_by, updated_info
)
SELECT
  gen_random_uuid(), -- sys.id id,           -- new org-level customer ID
  tenant.id tenant_org_id,                      -- each tenant's ID
  sys.id customer_id,                         -- reference to sys-level customer
  sys.name,
  sys.name2,
  sys.display_name,
  sys.first_name,
  sys.last_name,
  sys.phone,
  sys.email,
  sys.type,
  sys.address,
  sys.area,
  sys.building,
  sys.floor,
  sys.preferences,
  sys.customer_source_type,
  CURRENT_TIMESTAMP,              -- s_date
  0,                              -- loyalty_points
  NULL,                           -- rec_order
  1,                              -- rec_status
  TRUE,                           -- is_active
  NULL,                           -- rec_notes
  CURRENT_TIMESTAMP,              -- created_at
  NULL,                           -- created_by
  NULL,                           -- created_info
  CURRENT_TIMESTAMP,              -- updated_at
  NULL,                           -- updated_by
  NULL                            -- updated_info
FROM sys_customers_mst sys
CROSS JOIN org_tenants_mst tenant
ON CONFLICT (tenant_org_id, customer_id) DO NOTHING
;

Commit;
