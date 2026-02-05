-- Migration 0094: Seed currency settings (TENANT_CURRENCY, TENANT_DECIMAL_PLACES, BRANCH_CURRENCY)
-- Payment & Order Data Enhancement Plan

BEGIN;

INSERT INTO sys_tenant_settings_cd (
  setting_code, setting_name, setting_name2, setting_desc,
  setting_value_type, setting_value,
  is_for_tenants_org, is_active,
  is_per_tenant_org_id, is_per_branch_id, is_per_user_id,
  rec_order, rec_notes, rec_status,
  created_by, created_info, updated_at, updated_by, updated_info
)
VALUES
  ('TENANT_CURRENCY', 'Tenant Currency Code', 'رمز عملة المستأجر', 'ISO 4217 currency code (e.g. OMR, SAR, AED).',
   'TEXT', 'OMR', true, true, true, false, false,
   10, 'Currency for tenant', 1,
   'MIGRATION', '0094_seed_currency_settings', now(), 'MIGRATION', 'upsert'),
  ('TENANT_DECIMAL_PLACES', 'Currency Decimal Places', 'المنازل العشرية للعملة', 'Decimal places for currency (typically 2, 3, or 4).',
   'NUMBER', '3', true, true, true, false, false,
   11, 'Decimal places for OMR etc.', 1,
   'MIGRATION', '0094_seed_currency_settings', now(), 'MIGRATION', 'upsert'),
  ('BRANCH_CURRENCY', 'Branch Currency Code', 'رمز عملة الفرع', 'Optional branch-level currency override.',
   'TEXT', NULL, true, true, true, true, false,
   12, 'Branch override for currency', 1,
   'MIGRATION', '0094_seed_currency_settings', now(), 'MIGRATION', 'upsert')
ON CONFLICT (setting_code) DO UPDATE SET
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  setting_desc = EXCLUDED.setting_desc,
  setting_value_type = EXCLUDED.setting_value_type,
  setting_value = COALESCE(EXCLUDED.setting_value, sys_tenant_settings_cd.setting_value),
  updated_at = now(),
  updated_by = 'MIGRATION';

-- Apply default currency settings to existing tenants (tenant-global scope only)
INSERT INTO org_tenant_settings_cf (
  tenant_org_id, setting_code, setting_value_type, setting_value,
  branch_id, user_id, is_active, rec_status, created_at, created_by
)
SELECT t.id, 'TENANT_CURRENCY', 'TEXT', 'OMR',
  NULL, NULL, true, 1, now(), 'MIGRATION'
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_tenant_settings_cf cf
  WHERE cf.tenant_org_id = t.id AND cf.setting_code = 'TENANT_CURRENCY'
    AND cf.branch_id IS NULL AND cf.user_id IS NULL
);

INSERT INTO org_tenant_settings_cf (
  tenant_org_id, setting_code, setting_value_type, setting_value,
  branch_id, user_id, is_active, rec_status, created_at, created_by
)
SELECT t.id, 'TENANT_DECIMAL_PLACES', 'NUMBER', '3',
  NULL, NULL, true, 1, now(), 'MIGRATION'
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_tenant_settings_cf cf
  WHERE cf.tenant_org_id = t.id AND cf.setting_code = 'TENANT_DECIMAL_PLACES'
    AND cf.branch_id IS NULL AND cf.user_id IS NULL
);

COMMIT;
