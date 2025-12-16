-- ===============================================================
-- Seed: system definitions (idempotent)
-- ===============================================================
INSERT INTO sys_tenant_settings_cd (
  setting_code, setting_name, setting_name2, setting_desc,
  setting_value_type, setting_value,
  is_for_tenants_org, is_active,
  is_per_tenant_org_id, is_per_branch_id, is_per_user_id,
  rec_order, rec_notes, rec_status,
  created_by, created_info, updated_at, updated_by, updated_info
)
VALUES
  -- USE_REJECT_TO_SOLVE feature flag
  ('USE_REJECT_TO_SOLVE',
   'Using Reject of items or Pieces of orders',
   'إستحدام رفض وارجاع الصنف او القطع',
   'Defines whether Reject of items or Pieces of orders are allowed.',
   'BOOLEAN','true',
   true,true,
   true,false,false,
   1,'Global config for Reject of items or Pieces of orders',1,
   'system_admin','setup seed', now(),'system_admin','upsert'
   )
  
ON CONFLICT (setting_code) DO UPDATE SET
  setting_name         = EXCLUDED.setting_name,
  setting_name2        = EXCLUDED.setting_name2,
  setting_desc         = EXCLUDED.setting_desc,
  setting_value_type   = EXCLUDED.setting_value_type,
  setting_value        = EXCLUDED.setting_value,
  is_for_tenants_org   = EXCLUDED.is_for_tenants_org,
  is_active            = EXCLUDED.is_active,
  is_per_tenant_org_id = EXCLUDED.is_per_tenant_org_id,
  is_per_branch_id     = EXCLUDED.is_per_branch_id,
  is_per_user_id       = EXCLUDED.is_per_user_id,
  rec_order            = EXCLUDED.rec_order,
  rec_notes            = EXCLUDED.rec_notes,
  rec_status           = EXCLUDED.rec_status,
  updated_at           = now(),
  updated_by           = 'system_admin',
  updated_info         = 'upsert refresh';


-- ===============================================================
-- Propagate system settings to tenants (tenant-global scope only)
-- Safe upsert using the partial unique index for NULL scope.
-- ===============================================================
-- ===============================================================
-- Propagate system settings to tenants (tenant-global scope only)
-- Uses MERGE so we don't need a partial unique constraint name.
-- Match key: (tenant_org_id, setting_code, branch_id IS NULL, user_id IS NULL)
-- ===============================================================

MERGE INTO org_tenant_settings_cf AS dst
USING (
  SELECT
    t.id                AS tenant_org_id,
    s.setting_code,
    s.setting_name,
    s.setting_name2,
    s.setting_desc,
    s.setting_value_type,
    s.setting_value,
    s.is_active,
    s.rec_order,
    s.rec_notes,
    s.rec_status
  FROM sys_tenant_settings_cd s
  CROSS JOIN org_tenants_mst t
  WHERE s.is_active = true
    AND s.is_for_tenants_org = true
) AS src
ON (
  dst.tenant_org_id = src.tenant_org_id
  AND dst.setting_code = src.setting_code
  AND dst.branch_id IS NULL
  AND dst.user_id IS NULL
)
WHEN MATCHED THEN
  UPDATE SET
    setting_name       = src.setting_name,
    setting_name2      = src.setting_name2,
    setting_desc       = src.setting_desc,
    setting_value_type = src.setting_value_type,
    setting_value      = src.setting_value,
    is_active          = src.is_active,
    rec_order          = src.rec_order,
    rec_notes          = src.rec_notes,
    rec_status         = src.rec_status,
    updated_at         = now(),
    updated_by         = 'system_admin',
    updated_info       = 'propagate refresh'
WHEN NOT MATCHED THEN
  INSERT (
    tenant_org_id, setting_code,
    setting_name, setting_name2, setting_desc,
    setting_value_type, setting_value,
    is_active,
    branch_id, user_id,
    rec_order, rec_notes, rec_status,
    created_by, created_info, updated_at, updated_by, updated_info
  )
  VALUES (
    src.tenant_org_id, src.setting_code,
    src.setting_name, src.setting_name2, src.setting_desc,
    src.setting_value_type, src.setting_value,
    src.is_active,
    NULL, NULL,
    src.rec_order, src.rec_notes, src.rec_status,
    'system_admin', 'seed: propagate sys -> tenant', now(), 'system_admin', 'propagate'
  );
  
COMMIT;