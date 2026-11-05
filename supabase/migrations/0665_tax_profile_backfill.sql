-- =============================================================================
-- 0665_tax_profile_backfill.sql
--
-- Purpose: step R1 of the TENANT_VAT_RATE settings-fallback retirement
-- (Line-Level Money Snapshot P6-03, VAT_Settings_Fallback_Retirement_Plan.md).
-- Tax comes from tenant tax profiles (org_tax_profiles_cf). Only when a tenant
-- has no active, currently effective profile at all does the calculator fall
-- back to the settings rate TENANT_VAT_RATE (commercial-context.loader.ts).
-- Before that fallback is deleted, every such tenant gets a real default VAT
-- profile at the rate it is charged today, so no tenant's tax changes.
--
-- Data rules:
--   - Tenant set = exactly the fallback condition: no profile with is_active,
--     rec_status = 1 and effective today. Tenants with any profile are untouched.
--   - Rate = resolved TENANT_VAT_RATE (a fraction, 0.05) x 100 = percent (5.00),
--     the unit of org_tax_profiles_cf.rate. The resolved value is JSON, a number
--     or a numeric string; anything else, 0 or unset is skipped (no tax today).
--   - Rounding as the existing profiles: DOCUMENT, HALF_UP, currency places.
--   - effective_from = the tenant's creation date, so the profile covers every
--     date the tenant could have an order. Stored orders keep their recorded tax.
--   - Idempotent: a rerun finds a profile and inserts nothing.
-- =============================================================================

BEGIN;

-- One default VAT profile per tenant that today relies on the settings rate.
INSERT INTO public.org_tax_profiles_cf (
  tenant_org_id, name, name2, tax_type, rate, is_compound, applies_to,
  effective_from, effective_to, is_default, is_active, rec_status,
  rounding_level, rounding_mode, output_decimal_places, rounding_increment_minor,
  created_info
)
SELECT
  r.tenant_org_id,
  'VAT ' || trim_scale(r.rate_percent) || '%',
  'ضريبة القيمة المضافة ' || trim_scale(r.rate_percent) || '%',
  'VAT', r.rate_percent, false, NULL,
  r.created_on, NULL, true, true, 1,
  'DOCUMENT', 'HALF_UP', NULL, NULL,
  'Line-Level P6-03 R1: default VAT profile from TENANT_VAT_RATE'
FROM (
  SELECT
    t.id AS tenant_org_id,
    LEAST(t.created_at::date, current_date) AS created_on,
    round((v.stng_value_jsonb #>> '{}')::numeric * 100, 2) AS rate_percent
  FROM public.org_tenants_mst t
  CROSS JOIN LATERAL public.fn_stng_resolve_setting_value(t.id, 'TENANT_VAT_RATE', NULL, NULL) v
  WHERE jsonb_typeof(v.stng_value_jsonb) IN ('number', 'string')
    AND (v.stng_value_jsonb #>> '{}') ~ '^\s*[0-9]*\.?[0-9]+\s*$'
    AND NOT EXISTS (
      SELECT 1 FROM public.org_tax_profiles_cf p
      WHERE p.tenant_org_id = t.id
        AND p.is_active AND p.rec_status = 1
        AND p.effective_from <= current_date
        AND (p.effective_to IS NULL OR p.effective_to >= current_date)
    )
) r
WHERE r.rate_percent > 0 AND r.rate_percent <= 100;

COMMIT;
