-- =============================================================================
-- 0673_retire_tenant_vat_rate_setting.sql
--
-- Purpose: step R6 of the TENANT_VAT_RATE settings-fallback retirement
-- (Line-Level Money Snapshot P6-03, VAT_Settings_Fallback_Retirement_Plan.md).
-- Tax comes from tenant tax profiles (org_tax_profiles_cf) only. No code reads
-- these settings any more (calculator, legacy calculator, price lookups,
-- booking bootstrap, preparation preview and the Finance settings page were
-- moved to profiles in the same step; 0665 first gave every tenant that relied
-- on the fallback a default VAT profile at the same rate).
--
-- Retired codes (deactivated, kept for history, nothing deleted):
--   - TENANT_VAT_RATE: the fraction the fallback read (0.05).
--   - TAX_RATE: an older duplicate of the same rate, read by no code.
--   - TENANT_VAT_ENABLED: already inactive in the catalog; its rows follow.
-- TAX_PRICING_MODE stays: inclusive/exclusive pricing is still used.
-- Apply after the code of P6-03 is deployed, so a code rollback never meets a
-- deactivated setting. Idempotent: a rerun updates nothing.
-- =============================================================================

BEGIN;

-- Catalog: an inactive code resolves to "not found in catalog" and is hidden
-- from settings screens (HQ and tenant).
UPDATE public.sys_tenant_settings_cd
SET is_active = false,
rec_status=0,
    updated_at = now(),
    updated_info = 'Line-Level P6-03 R6: retired, tax comes from tax profiles'
WHERE setting_code IN ('TENANT_VAT_RATE', 'TAX_RATE', 'TENANT_VAT_ENABLED')
  AND is_active = true;

-- System profile values (GCC_OM_MAIN, GCC_KSA_MAIN, ...).
UPDATE public.sys_stng_profile_values_dtl
SET is_active = false,
rec_status=0,
    updated_at = now(),
    updated_info = 'Line-Level P6-03 R6: retired, tax comes from tax profiles'
WHERE stng_code IN ('TENANT_VAT_RATE', 'TAX_RATE', 'TENANT_VAT_ENABLED')
  AND is_active = true;

-- Tenant, branch and user overrides, for every organization (explicit tenant predicate).
-- The audit trigger (fn_stng_audit_changes) records stng_override_reason as the change reason.
UPDATE public.org_tenant_settings_cf
SET is_active = false,
rec_status=0,
    stng_override_reason = 'Retired in Line-Level P6-03: tax comes from tax profiles',
    updated_at = now(),
    updated_info = 'Line-Level P6-03 R6: retired, tax comes from tax profiles'
WHERE tenant_org_id IN (SELECT t.id FROM public.org_tenants_mst t)
  AND setting_code IN ('TENANT_VAT_RATE', 'TAX_RATE', 'TENANT_VAT_ENABLED')
  AND is_active = true;

COMMIT;
