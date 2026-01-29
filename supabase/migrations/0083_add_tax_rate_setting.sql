-- Migration: 0083_add_tax_rate_setting.sql
-- Description: Add tax rate configuration setting for tenants
-- Date: 2026-01-27
-- Feature: Pricing System - Tax Configuration

-- =====================================================
-- Add TAX_RATE Setting
-- =====================================================

INSERT INTO sys_tenant_settings_cd (
  setting_code,
  setting_name,
  setting_name2,
  setting_desc,
  setting_value_type,
  setting_value,
  stng_category_code,
  stng_data_type,
  stng_default_value_jsonb,
  is_for_tenants_org,
  is_per_tenant_org_id,
  is_per_branch_id,
  is_per_user_id,
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'TAX_RATE',
  'Tax Rate',
  'معدل الضريبة',
  'Default tax rate (VAT) as decimal (e.g., 0.05 for 5%)',
  'DECIMAL',
  '0.05',
  'FINANCE',
  'DECIMAL',
  '0.05'::jsonb,
  true,
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (setting_code) DO UPDATE SET
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  setting_desc = EXCLUDED.setting_desc,
  stng_category_code = EXCLUDED.stng_category_code,
  stng_data_type = EXCLUDED.stng_data_type,
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';

-- =====================================================
-- Seed Default Tax Rate for Existing Tenants
-- =====================================================

-- Insert default tax rate (0.05 = 5%) for all existing tenants
-- Only insert if not already exists
INSERT INTO org_tenant_settings_cf (
  tenant_org_id,
  setting_code,
  setting_value,
  value_jsonb,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT 
  id as tenant_org_id,
  'TAX_RATE' as setting_code,
  '0.05' as setting_value,
  '0.05'::jsonb as value_jsonb,
  true as is_active,
  1 as rec_status,
  CURRENT_TIMESTAMP as created_at,
  'system_admin' as created_by
FROM org_tenants_mst
WHERE is_active = true
  AND id NOT IN (
    SELECT tenant_org_id 
    FROM org_tenant_settings_cf 
    WHERE setting_code = 'TAX_RATE'
      AND (branch_id IS NULL AND user_id IS NULL)
  );

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  setting_count INTEGER;
  tenant_count INTEGER;
BEGIN
  -- Check if setting was created
  SELECT COUNT(*) INTO setting_count 
  FROM sys_tenant_settings_cd 
  WHERE setting_code = 'TAX_RATE' AND is_active = true;
  
  IF setting_count = 1 THEN
    RAISE NOTICE 'SUCCESS: TAX_RATE setting created';
  ELSE
    RAISE WARNING 'WARNING: TAX_RATE setting not found or multiple entries';
  END IF;
  
  -- Check tenant settings
  SELECT COUNT(*) INTO tenant_count 
  FROM org_tenant_settings_cf 
  WHERE setting_code = 'TAX_RATE' 
    AND is_active = true
    AND branch_id IS NULL 
    AND user_id IS NULL;
  
  RAISE NOTICE 'INFO: Tax rate configured for % tenants', tenant_count;
END $$;

