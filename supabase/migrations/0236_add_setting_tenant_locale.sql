-- ================================================================
-- ADD SETTING: TENANT_LOCALE
-- Purpose: Store the default locale/language for a tenant (e.g. en-US, ar)
-- Created: 2026-04-11
-- Created by: system_admin
-- Migration: 0236_add_setting_tenant_locale.sql
-- ================================================================

BEGIN;

-- ================================================================
-- STEP 1: VALIDATE PREREQUISITES
-- ================================================================
DO $$
BEGIN
  -- Check if setting already exists
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'TENANT_LOCALE'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: TENANT_LOCALE';
  END IF;

  -- Check if GENERAL category exists
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'GENERAL'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: GENERAL';
  END IF;

  -- Check GENERAL_MAIN_PROFILE exists (mandatory for all settings)
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  ) THEN
    RAISE EXCEPTION 'GENERAL_MAIN_PROFILE does not exist — cannot proceed';
  END IF;

  RAISE NOTICE '✓ Prerequisites validated successfully';
END $$;

-- ================================================================
-- STEP 2: INSERT CATALOG ENTRY
-- ================================================================
INSERT INTO sys_tenant_settings_cd (
  -- Primary Key
  setting_code,

  -- Classification
  stng_category_code,
  stng_scope,
  stng_data_type,

  -- Default Value & Validation (JSONB!)
  stng_default_value_jsonb,
  stng_validation_jsonb,

  -- Behavior Flags
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,

  -- Required & Minimum Layer
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,

  -- Dependencies (JSONB array or NULL)
  stng_depends_on_flags,

  -- Metadata (Bilingual)
  setting_name,
  setting_name2,
  setting_desc,
  setting_desc2,

  -- UI Hints
  stng_ui_component,
  stng_ui_group,
  stng_display_order,

  -- Audit Fields
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Primary Key
  'TENANT_LOCALE',

  -- Classification
  'GENERAL',
  'TENANT',
  'TEXT',

  -- Default Value & Validation
  '"en-US"'::jsonb,
  NULL,

  -- Behavior Flags
  true,   -- stng_is_overridable: tenants can override
  false,  -- stng_is_sensitive
  false,  -- stng_requires_restart

  -- Required & Minimum Layer
  false,  -- stng_is_required
  true,   -- stng_allows_null
  NULL,   -- stng_required_min_layer

  -- Dependencies
  NULL,   -- stng_depends_on_flags

  -- Metadata (Bilingual)
  'Tenant Default Locale',
  'اللغة الافتراضية للمستأجر',
  'The default locale/language code for the tenant (e.g. en-US, ar). Used to set the default language for the tenant interface and communications.',
  'رمز اللغة/اللغة الافتراضية للمستأجر (مثل en-US أو ar). يُستخدم لتحديد اللغة الافتراضية لواجهة المستأجر والمراسلات.',

  -- UI Hints
  'text-input',
  'Localization',
  10,

  -- Audit Fields
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0236_add_setting_tenant_locale.sql',
  1,
  true
)
ON CONFLICT (setting_code) DO NOTHING;

-- ================================================================
-- STEP 3: INSERT PROFILE VALUES
-- ================================================================
-- GENERAL_MAIN_PROFILE is MANDATORY — same value as setting default
INSERT INTO sys_stng_profile_values_dtl (
  id,
  stng_profile_code,
  stng_code,
  stng_value_jsonb,
  stng_override_reason,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  gen_random_uuid(),
  'GENERAL_MAIN_PROFILE',
  'TENANT_LOCALE',
  '"en-US"'::jsonb,
  'Global default locale for all tenants',
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0236_add_setting_tenant_locale.sql',
  1,
  true
)
ON CONFLICT (stng_profile_code, stng_code)
DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- ================================================================
-- STEP 4: VERIFY CATALOG ENTRY
-- ================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'TENANT_LOCALE';

  IF v_count = 0 THEN
    RAISE EXCEPTION '❌ Setting TENANT_LOCALE was NOT inserted into catalog';
  END IF;

  RAISE NOTICE '✅ Setting catalog entry verified: TENANT_LOCALE';
END $$;

-- ================================================================
-- STEP 5: VERIFY PROFILE VALUES
-- ================================================================
DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'TENANT_LOCALE';

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION '❌ Profile values for TENANT_LOCALE were NOT inserted';
  END IF;

  RAISE NOTICE '✅ Profile values verified: % row(s) for TENANT_LOCALE', v_profile_count;
END $$;

COMMIT;

-- ================================================================
-- SUMMARY
-- ================================================================
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE '✅ Migration 0236 completed successfully!';
  RAISE NOTICE 'Setting Code : TENANT_LOCALE';
  RAISE NOTICE 'Category     : GENERAL';
  RAISE NOTICE 'Scope        : TENANT';
  RAISE NOTICE 'Data Type    : TEXT';
  RAISE NOTICE 'Default      : en-US';
  RAISE NOTICE 'Profiles     : GENERAL_MAIN_PROFILE';
  RAISE NOTICE '==============================================';
END $$;

-- ================================================================
-- ROLLBACK (if needed — run manually)
-- ================================================================
-- DELETE FROM sys_stng_profile_values_dtl WHERE stng_code = 'TENANT_LOCALE';
-- DELETE FROM sys_tenant_settings_cd WHERE setting_code = 'TENANT_LOCALE';
