-- =============================================================================
-- Migration: 0722_tax_convert_existing.sql
-- Program:   Tax Engine T4 / M4 — convert what organizations already had
-- Plan:      docs/features/Tax_Config/TAX_ENGINE_PLAN.md §6, §6.1
-- Builds on: 0718 (tax setup per organization), 0719 (tax lines)
-- Purpose:   Data only; no object is created or altered.
--   1. A default profile the kit does not already cover (for example an extra 2%
--      charged on every order) is kept: its code joins the organization's sales
--      rules, so confirming the setup does not drop it.
--   2. Every other old profile is switched off. The rows stay, because orders
--      already taxed with them still point at them.
--   3. Every organization gets an open tax period for the current month.
-- Not needed: tax_supply_code → item class. No product carries a supply code, and
--   0718 already gave every product the kit's default class.
-- Later:     dropping applies_to, is_default and tax_supply_code is a separate
--   migration, after the old profile screens and the old engine are removed.
-- =============================================================================

BEGIN;

-- 1. Keep default profiles the kit does not cover: add them to the sales rules that charge a kit STANDARD code.
WITH extra AS (
  SELECT p.tenant_org_id, p.tax_code
    FROM public.org_tax_profiles_cf p
   WHERE p.source = 'TENANT' AND p.is_active AND p.rec_status = 1 AND p.is_default
     AND COALESCE(cardinality(p.applies_to), 0) = 0
     AND NOT EXISTS (
       SELECT 1 FROM public.org_tax_profiles_cf k
        WHERE k.tenant_org_id = p.tenant_org_id AND k.source = 'HQ_KIT' AND k.is_active AND k.rec_status = 1
          AND k.tax_flow_code = 'OUTPUT' AND k.tax_category_code = 'STANDARD'
          AND k.tax_type = p.tax_type AND k.rate = p.rate)
),
target AS (
  SELECT e.tenant_org_id, e.tax_code, r.id AS rule_id,
         (SELECT max(d.seq_no) FROM public.org_tax_rule_codes_dtl d
           WHERE d.tenant_org_id = r.tenant_org_id AND d.rule_id = r.id)
         + row_number() OVER (PARTITION BY r.tenant_org_id, r.id ORDER BY e.tax_code) AS seq_no
    FROM extra e
    JOIN public.org_tax_rules_cf r
      ON r.tenant_org_id = e.tenant_org_id AND r.is_active AND r.rec_status = 1 AND r.tax_flow_code = 'OUTPUT'
   WHERE EXISTS (
     SELECT 1 FROM public.org_tax_rule_codes_dtl d
       JOIN public.org_tax_profiles_cf k ON k.tenant_org_id = d.tenant_org_id AND k.tax_code = d.tax_code
      WHERE d.tenant_org_id = r.tenant_org_id AND d.rule_id = r.id AND k.source = 'HQ_KIT' AND k.tax_category_code = 'STANDARD')
)
INSERT INTO public.org_tax_rule_codes_dtl (tenant_org_id, rule_id, seq_no, tax_code, created_by, created_info)
SELECT tenant_org_id, rule_id, seq_no, tax_code, 'migration_0722', 'kept from the old default tax profiles'
  FROM target
ON CONFLICT (tenant_org_id, rule_id, tax_code) DO NOTHING;

-- A kit re-apply must report these rules as changed instead of overwriting them.
UPDATE public.org_tax_rules_cf r
   SET is_tenant_modified = true, updated_by = 'migration_0722', updated_info = 'old default tax profile added'
 WHERE r.is_tenant_modified = false
   AND EXISTS (
     SELECT 1 FROM public.org_tax_rule_codes_dtl d
       JOIN public.org_tax_profiles_cf p ON p.tenant_org_id = d.tenant_org_id AND p.tax_code = d.tax_code
      WHERE d.tenant_org_id = r.tenant_org_id AND d.rule_id = r.id AND p.source = 'TENANT');

-- 2. Rules choose the tax now: an old profile no rule uses is switched off, never deleted.
UPDATE public.org_tax_profiles_cf p
   SET is_active = false, updated_by = 'migration_0722', updated_info = 'replaced by the tax kit'
 WHERE p.source = 'TENANT' AND p.is_active
   AND NOT EXISTS (
     SELECT 1 FROM public.org_tax_rule_codes_dtl d
      WHERE d.tenant_org_id = p.tenant_org_id AND d.tax_code = p.tax_code AND d.is_active AND d.rec_status = 1);

-- 3. An open return period for the current month, so a final tax line has one to land in.
INSERT INTO public.org_tax_periods_mst (tenant_org_id, period_start, period_end, status, created_by, created_info)
SELECT c.tenant_org_id,
       date_trunc('month', CURRENT_DATE)::date,
       (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date,
       'OPEN', 'migration_0722', 'first tax period'
  FROM public.org_tax_config_cf c
 WHERE c.is_active AND c.rec_status = 1
   -- The overlap trigger fires before ON CONFLICT can skip a row, so test for it here.
   AND NOT EXISTS (
     SELECT 1 FROM public.org_tax_periods_mst p
      WHERE p.tenant_org_id = c.tenant_org_id AND p.rec_status = 1
        AND daterange(p.period_start, p.period_end, '[]')
            && daterange(date_trunc('month', CURRENT_DATE)::date,
                         (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date, '[]'))
ON CONFLICT (tenant_org_id, period_start) DO NOTHING;

COMMIT;
