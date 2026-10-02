-- Migration 0543: L4 completion — soft-retire orphaned profile-value rows
-- for the legacy currency settings.
--
-- 0542 soft-retired the catalog (sys_tenant_settings_cd) and tenant-override
-- (org_tenant_settings_cf) rows for TENANT_CURRENCY / TENANT_DECIMAL_PLACES /
-- BRANCH_CURRENCY, but missed the profile-defaults layer the HQ settings
-- resolver also reads (platform-api stng-resolver.service.ts): tenant
-- profiles (sys_stng_profiles_mst, e.g. GCC_OM_MAIN, GCC_KSA_MAIN) carry
-- their own default value per setting code in sys_stng_profile_values_dtl.
-- Confirmed on the live remote DB (2026-10-02): 3 active rows —
-- GCC_OM_MAIN/TENANT_CURRENCY=OMR, GCC_KSA_MAIN/TENANT_CURRENCY=SAR,
-- GCC_KSA_MAIN/TENANT_DECIMAL_PLACES=2. No active row for BRANCH_CURRENCY.
--
-- With the catalog row already is_active=false (0542), the resolver's
-- catalog-driven lookups already skip these codes, so this is data hygiene
-- (no dangling rows pointing at a retired setting), not a behavior change.
-- Additive/reversible: flips is_active/rec_status off, does not delete.
--
-- Note: sys_stng_settings_cd (a differently-named table, NOT
-- sys_tenant_settings_cd) also has an active TENANT_CURRENCY row, but no
-- application code in either repo queries that table (grep-confirmed) —
-- it only appears in generated type files. Left untouched; out of scope
-- for L4, which targets the live catalog/resolver path.

BEGIN;

UPDATE sys_stng_profile_values_dtl
SET is_active = false,
    rec_status = 0,
    rec_notes = COALESCE(rec_notes || ' | ', '') || 'Retired 0543: superseded by org_currency_cf (Tenant_Currency_FX plan 01, L4)',
    updated_at = now(),
    updated_by = 'MIGRATION',
    updated_info = '0543_retire_legacy_currency_settings_profile_values'
WHERE stng_code IN ('TENANT_CURRENCY', 'TENANT_DECIMAL_PLACES', 'BRANCH_CURRENCY')
  AND is_active = true;

COMMIT;
