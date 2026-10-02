-- Migration 0542: L4 — soft-retire legacy currency settings
-- Tenant_Currency_FX implementation plan 01, §6 "L4" / §9 sequencing.
--
-- TENANT_CURRENCY, TENANT_DECIMAL_PLACES, BRANCH_CURRENCY were superseded by
-- org_currency_cf (migration 0532, L2 code cut-over 2026-09-26) and by HQ 4E
-- (tenant wizard / locale tab / settings screens now write org_currency_cf,
-- cleanmatexsaas implementation_plan_04_hq_fx.md §10.4). No app code reads
-- these 3 codes for currency any longer — see currency-resolution.ts and
-- tenant-currency-profile.service.ts header comments. This migration is
-- additive/reversible: it flips is_active/rec_status off, it does not drop
-- any row or column. Hard delete is a separate later stage (L5).

BEGIN;

UPDATE sys_tenant_settings_cd
SET is_active = false,
    rec_status = 0,
    rec_notes = COALESCE(rec_notes || ' | ', '') || 'Retired 0542: superseded by org_currency_cf (Tenant_Currency_FX plan 01, L4)',
    updated_at = now(),
    updated_by = 'MIGRATION',
    updated_info = '0542_retire_legacy_currency_settings'
WHERE setting_code IN ('TENANT_CURRENCY', 'TENANT_DECIMAL_PLACES', 'BRANCH_CURRENCY')
  AND is_active = true;

UPDATE org_tenant_settings_cf
SET is_active = false,
    rec_status = 0,
    rec_notes = COALESCE(rec_notes || ' | ', '') || 'Retired 0542: superseded by org_currency_cf (Tenant_Currency_FX plan 01, L4)',
    updated_at = now(),
    updated_by = 'MIGRATION',
    updated_info = '0542_retire_legacy_currency_settings'
WHERE setting_code IN ('TENANT_CURRENCY', 'TENANT_DECIMAL_PLACES', 'BRANCH_CURRENCY')
  AND is_active = true;

COMMIT;
