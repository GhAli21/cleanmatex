-- ============================================================
-- Migration: 0723_retire_category_express_hours.sql
-- Purpose:   Retire sys_service_category_cd.turnaround_hh_express. Express was the
--            only speed offered without a rule, using these hours. From now on
--            every speed needs a rule (Service Speeds D5), so each organization's
--            legacy promise moves into a category-scoped EXPRESS rule first.
-- Affected:  org_speed_price_rules_cf (rows), org_price_history_audit (rows),
--            sys_service_category_cd (column dropped)
-- Related:   0707 (turnaround unit), 0711 (demo rules), 0720 (seeder)
-- Note:      The new rules have a 0 premium: Express without a rule cost the same
--            as Standard, so no price changes. Products with their own rule keep it.
-- ============================================================

BEGIN;

-- Refuse to drop the column if the app schema this depends on is missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'org_speed_price_rules_cf'
                   AND column_name = 'turnaround_unit') THEN
    RAISE EXCEPTION 'RETIRE_EXPRESS_PRECHECK: apply 0707_service_speeds_cutoff_hours.sql first';
  END IF;
END $$;

-- One EXPRESS rule per organization and enabled category with legacy hours. Skipped when
-- the organization already prices Express for everything (an active all-products rule, which a
-- category rule would override) or already has a rule for that category in any state.
-- Hours of 0 (retail items) promised nothing and need no rule.
WITH created AS (
  INSERT INTO public.org_speed_price_rules_cf (
    tenant_org_id, service_speed, service_category_code,
    speed_price_type, multiplier_speed,
    turnaround_unit, turnaround_hh_speed,
    effective_from, created_by, created_info
  )
  SELECT
    c.tenant_org_id, 'EXPRESS', c.service_category_code,
    'MULTIPLIER', 0,
    'HOURS', s.turnaround_hh_express,
    CURRENT_DATE, 'system_migration', 'Legacy category Express hours (0723)'
  FROM public.org_service_category_cf c
  JOIN public.sys_service_category_cd s
    ON s.service_category_code = c.service_category_code
  WHERE c.is_active = true
    AND c.rec_status = 1
    AND s.turnaround_hh_express > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.org_speed_price_rules_cf r
      WHERE r.tenant_org_id = c.tenant_org_id
        AND r.service_speed = 'EXPRESS'
        AND r.branch_id IS NULL
        AND r.product_id IS NULL
        AND r.service_category_code IS NULL
        AND r.is_active = true
        AND r.rec_status = 1
        AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.org_speed_price_rules_cf r
      WHERE r.tenant_org_id = c.tenant_org_id
        AND r.service_speed = 'EXPRESS'
        AND r.product_id IS NULL
        AND r.service_category_code = c.service_category_code
    )
  ON CONFLICT ON CONSTRAINT uq_org_spd_price_rules_scope DO NOTHING
  RETURNING id, tenant_org_id, speed_price_type, multiplier_speed, effective_from, effective_to
)
-- One history row per rule, as the Speed Pricing screen writes on create.
INSERT INTO public.org_price_history_audit (
  tenant_org_id, entity_type, entity_id, product_id, old_price, new_price,
  change_reason, effective_from, effective_to, created_by, created_info
)
SELECT
  c.tenant_org_id, 'speed_rule', c.id, NULL, NULL, c.multiplier_speed,
  'CREATE: - -> ' || c.speed_price_type,
  c.effective_from, c.effective_to,
  -- created_by is a user UUID; a migration has none.
  NULL, 'Legacy category Express hours (0723)'
FROM created c;

-- Removed: its values now live in the rules above, and no function, view or app code reads it.
-- sys_service_prod_templates_cd.turnaround_hh_express stays: the catalog seeder reads it.
ALTER TABLE public.sys_service_category_cd
  DROP COLUMN turnaround_hh_express RESTRICT;

COMMIT;
