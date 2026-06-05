-- ==================================================================
-- 0339_tax_pricing_mode_config.sql
-- Purpose: Order Fin v1.1 Phase 5 — Tax-inclusive pricing config.
--          Adds tenant-level defaults and branch overrides for tax
--          pricing mode plus extra-price presentation mode, then seeds
--          settings catalog entries and RBAC permissions for the UI.
-- Plan: docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-full-alignment-implementation-plan.md § Phase 5
-- ==================================================================
-- WHY this migration is safe:
--   • All schema changes are additive.
--   • Defaults preserve current TAX_EXCLUSIVE behavior.
--   • CHECK constraints are added only after the columns are populated
--     by their NOT NULL defaults.
--   • Permission and settings seeds are idempotent.
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — Tenant-level pricing defaults
-- ──────────────────────────────────────────────────────────────────
-- Why org_tenants_mst:
-- The calculator needs a stable scalar tenant default without querying
-- HQ-managed sys_stng_* runtime paths from tenant application code.

ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS tax_pricing_mode TEXT NOT NULL DEFAULT 'TAX_EXCLUSIVE',
  ADD COLUMN IF NOT EXISTS extra_price_pricing_mode TEXT NOT NULL DEFAULT 'INCLUDED_IN_ITEM_PRICE';

ALTER TABLE public.org_tenants_mst
  DROP CONSTRAINT IF EXISTS chk_org_tnt_tax_price_mode RESTRICT,
  DROP CONSTRAINT IF EXISTS chk_org_tnt_extra_price RESTRICT;

ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT chk_org_tnt_tax_price_mode
    CHECK (tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT chk_org_tnt_extra_price
    CHECK (extra_price_pricing_mode IN ('INCLUDED_IN_ITEM_PRICE', 'SEPARATE_CHARGE'));

COMMENT ON COLUMN public.org_tenants_mst.tax_pricing_mode IS
  'Order pricing tax mode. TAX_EXCLUSIVE preserves current behavior; TAX_INCLUSIVE extracts tax from inclusive item prices.';

COMMENT ON COLUMN public.org_tenants_mst.extra_price_pricing_mode IS
  'Controls whether order extra prices are treated as included in item price or as a separate charge.';

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Branch-level overrides
-- ──────────────────────────────────────────────────────────────────
-- Why nullable override columns:
-- NULL means "inherit tenant default"; explicit values allow branch
-- rollout without changing every tenant-level calculation at once.

ALTER TABLE public.org_branches_mst
  ADD COLUMN IF NOT EXISTS tax_pricing_mode TEXT NULL,
  ADD COLUMN IF NOT EXISTS extra_price_pricing_mode TEXT NULL;

ALTER TABLE public.org_branches_mst
  DROP CONSTRAINT IF EXISTS chk_branch_tax_price_mode RESTRICT,
  DROP CONSTRAINT IF EXISTS chk_branch_extra_price RESTRICT;

ALTER TABLE public.org_branches_mst
  ADD CONSTRAINT chk_branch_tax_price_mode
    CHECK (tax_pricing_mode IS NULL OR tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT chk_branch_extra_price
    CHECK (extra_price_pricing_mode IS NULL OR extra_price_pricing_mode IN ('INCLUDED_IN_ITEM_PRICE', 'SEPARATE_CHARGE'));

COMMENT ON COLUMN public.org_branches_mst.tax_pricing_mode IS
  'Optional branch override for order pricing tax mode; NULL inherits org_tenants_mst.tax_pricing_mode.';

COMMENT ON COLUMN public.org_branches_mst.extra_price_pricing_mode IS
  'Optional branch override for extra-price presentation mode; NULL inherits org_tenants_mst.extra_price_pricing_mode.';

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Settings catalog entries (same pattern as 0236_add_setting_tenant_locale.sql)
-- ──────────────────────────────────────────────────────────────────
-- Why catalog rows still exist:
-- The scalar columns are the calculator contract, while settings catalog
-- rows give admin UI and HQ/profile tooling a bilingual metadata source.

-- ================================================================
-- STEP 3.1: VALIDATE PREREQUISITES
-- ================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'TAX_PRICING_MODE'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: TAX_PRICING_MODE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'EXTRA_PRICE_PRICING_MODE'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: EXTRA_PRICE_PRICING_MODE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'FINANCE'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: FINANCE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  ) THEN
    RAISE EXCEPTION 'GENERAL_MAIN_PROFILE does not exist — cannot proceed';
  END IF;

  RAISE NOTICE '✓ Prerequisites validated successfully';
END $$;

-- ================================================================
-- STEP 3.2: INSERT CATALOG ENTRIES
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
  'TAX_PRICING_MODE',
  'FINANCE',
  'TENANT',
  'TEXT',
  '"TAX_EXCLUSIVE"'::jsonb,
  '{"enum":["TAX_INCLUSIVE","TAX_EXCLUSIVE"]}'::jsonb,
  true,
  false,
  false,
  true,
  false,
  'TENANT_OVERRIDE',
  NULL,
  'Tax Pricing Mode',
  'وضع تسعير الضريبة',
  'Controls whether order item prices are tax-exclusive TAX_INCLUSIVE or TAX_EXCLUSIVE tax-inclusive.',
  'يتحكم فيما إذا كانت أسعار عناصر الطلب غير شاملة للضريبة أو شاملة لها  TAX_INCLUSIVE or TAX_EXCLUSIVE .',
  'radio',
  'Pricing',
  50,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0339_tax_pricing_mode_config.sql',
  1,
  true
)
ON CONFLICT (setting_code) DO NOTHING;

INSERT INTO sys_tenant_settings_cd (
  setting_code,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,
  stng_depends_on_flags,
  setting_name,
  setting_name2,
  setting_desc,
  setting_desc2,
  stng_ui_component,
  stng_ui_group,
  stng_display_order,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  'EXTRA_PRICE_PRICING_MODE',
  'FINANCE',
  'TENANT',
  'TEXT',
  '"INCLUDED_IN_ITEM_PRICE"'::jsonb,
  '{"enum":["INCLUDED_IN_ITEM_PRICE","SEPARATE_CHARGE"]}'::jsonb,
  true,
  false,
  false,
  true,
  false,
  'TENANT_OVERRIDE',
  NULL,
  'Extra Price Pricing Mode',
  'وضع تسعير الأسعار الإضافية',
  'Controls whether extra prices are included in item price or shown as a separate charge.',
  'يتحكم فيما إذا كانت الأسعار الإضافية مدمجة في سعر العنصر أو تعرض كرسم منفصل.',
  'radio',
  'Pricing',
  51,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0339_tax_pricing_mode_config.sql',
  1,
  true
)
ON CONFLICT (setting_code) DO NOTHING;

-- ================================================================
-- STEP 3.3: INSERT PROFILE VALUES
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
  'TAX_PRICING_MODE',
  '"TAX_EXCLUSIVE"'::jsonb,
  'Order Fin v1.1 default tax pricing mode.',
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0339_tax_pricing_mode_config.sql',
  1,
  true
)
ON CONFLICT (stng_profile_code, stng_code)
DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

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
  'EXTRA_PRICE_PRICING_MODE',
  '"INCLUDED_IN_ITEM_PRICE"'::jsonb,
  'Order Fin v1.1 default extra-price pricing mode.',
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0339_tax_pricing_mode_config.sql',
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
-- STEP 3.4: VERIFY CATALOG ENTRIES
-- ================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'TAX_PRICING_MODE';

  IF v_count = 0 THEN
    RAISE EXCEPTION '❌ Setting TAX_PRICING_MODE was NOT inserted into catalog';
  END IF;

  RAISE NOTICE '✅ Setting catalog entry verified: TAX_PRICING_MODE';
END $$;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'EXTRA_PRICE_PRICING_MODE';

  IF v_count = 0 THEN
    RAISE EXCEPTION '❌ Setting EXTRA_PRICE_PRICING_MODE was NOT inserted into catalog';
  END IF;

  RAISE NOTICE '✅ Setting catalog entry verified: EXTRA_PRICE_PRICING_MODE';
END $$;

-- ================================================================
-- STEP 3.5: VERIFY PROFILE VALUES
-- ================================================================
DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'TAX_PRICING_MODE';

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION '❌ Profile values for TAX_PRICING_MODE were NOT inserted';
  END IF;

  RAISE NOTICE '✅ Profile values verified: % row(s) for TAX_PRICING_MODE', v_profile_count;
END $$;

DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'EXTRA_PRICE_PRICING_MODE';

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION '❌ Profile values for EXTRA_PRICE_PRICING_MODE were NOT inserted';
  END IF;

  RAISE NOTICE '✅ Profile values verified: % row(s) for EXTRA_PRICE_PRICING_MODE', v_profile_count;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- Step 4 — Pricing-mode permissions
-- ──────────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
) VALUES
  (
    'tenant_settings:update_pricing_mode',
    'Update Tenant Pricing Mode',
    'تحديث وضع تسعير المستأجر',
    'settings',
    'Update tenant-level tax and extra-price pricing modes.',
    'تحديث أوضاع تسعير الضريبة والأسعار الإضافية على مستوى المستأجر.',
    'Settings',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  ),
  (
    'branch_settings:update_pricing_mode',
    'Update Branch Pricing Mode',
    'تحديث وضع تسعير الفرع',
    'settings',
    'Update branch-level overrides for tax and extra-price pricing modes.',
    'تحديث تجاوزات الفرع لأوضاع تسعير الضريبة والأسعار الإضافية.',
    'Settings',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active = true,
  is_enabled = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration: 0339_tax_pricing_mode_config.sql';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE (
    (p.code = 'tenant_settings:update_pricing_mode'
      AND r.code IN ('super_admin', 'tenant_admin', 'admin'))
    OR
    (p.code = 'branch_settings:update_pricing_mode'
      AND r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager'))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;

-- ================================================================
-- SETTINGS SUMMARY (Step 3 — same pattern as 0236)
-- ================================================================
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE '✅ Migration 0339 settings seeded successfully';
  RAISE NOTICE 'Setting Codes : TAX_PRICING_MODE, EXTRA_PRICE_PRICING_MODE';
  RAISE NOTICE 'Category      : FINANCE';
  RAISE NOTICE 'Scope         : TENANT';
  RAISE NOTICE 'Data Type     : TEXT';
  RAISE NOTICE 'Defaults      : TAX_EXCLUSIVE, INCLUDED_IN_ITEM_PRICE';
  RAISE NOTICE 'Profiles      : GENERAL_MAIN_PROFILE';
  RAISE NOTICE '==============================================';
END $$;

-- ================================================================
-- ROLLBACK (if needed — run manually)
-- ================================================================
-- DELETE FROM sys_stng_profile_values_dtl WHERE stng_code IN ('TAX_PRICING_MODE', 'EXTRA_PRICE_PRICING_MODE');
-- DELETE FROM sys_tenant_settings_cd WHERE setting_code IN ('TAX_PRICING_MODE', 'EXTRA_PRICE_PRICING_MODE');
