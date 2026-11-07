-- =============================================================================
-- Migration: 0716_setup_health_cal_holidays.sql
-- Purpose:   Setup Health check CAL_HOLIDAYS_ESTIMATED (docs/features/Setup_Health/PLAN.md
--            step 1b; docs/features/Service_Speeds/PLAN.md "Setup Health" row).
--            INFO, HQ only: the next 60 days contain public holidays whose date
--            is still an estimate (is_estimated = true, e.g. Islamic holidays
--            before the moon-sighting announcement) for a country the
--            organization works in. Ready-by skips those dates, so a wrong date
--            moves promised times. HQ confirms the date; the organization
--            cannot, so the tenant app never shows this check.
-- Affected:  fn_shc_cal_holidays_estimated (new),
--            sys_setup_health_check_cd (row CAL_HOLIDAYS_ESTIMATED).
-- Related:   0709 (registry, guard, dispatcher), 0711 (sys_public_holidays_cf,
--            org_branches_mst.country / org_tenants_mst.country). Both must be
--            applied BEFORE this file.
-- Notes:     hq_fix_route is NULL: the HQ public-holidays screen (Service Speeds,
--            Master System Codes › Calendars) does not exist yet. A later
--            migration sets it when that screen ships.
--
-- Rollback (forward-only, manual):
--   DELETE FROM sys_setup_health_check_cd WHERE check_code = 'CAL_HOLIDAYS_ESTIMATED';
--   DROP FUNCTION fn_shc_cal_holidays_estimated(UUID, UUID) RESTRICT;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Check function
-- -----------------------------------------------------------------------------
-- Countries = each active branch's country, else the organization's country
-- (same rule as ready-by in web-admin calendar-facts.ts). Window = today + 60
-- days (database date). Holidays the organization overrides in org_holidays_cf
-- still count: the public date itself is what HQ must confirm.
CREATE OR REPLACE FUNCTION public.fn_shc_cal_holidays_estimated(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_countries TEXT[];
  v_ids       UUID[];
  v_first     DATE;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  SELECT array_agg(DISTINCT x.cc) FILTER (WHERE x.cc IS NOT NULL)
  INTO v_countries
  FROM (
    SELECT upper(COALESCE(NULLIF(b.country, ''), t.country)) AS cc
    FROM org_tenants_mst t
    LEFT JOIN org_branches_mst b
      ON b.tenant_org_id = p_tenant
     AND b.tenant_org_id = t.id
     AND (p_branch IS NULL OR b.id = p_branch)
     AND b.is_active = TRUE
     AND b.rec_status = 1
    WHERE t.id = p_tenant
  ) x;

  -- No country known: nothing can be checked.
  IF v_countries IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb,
                              'details', jsonb_build_object('reason', 'no_country'));
  END IF;

  SELECT array_agg(h.id ORDER BY h.holiday_date, h.country_code),
         min(h.holiday_date)
  INTO v_ids, v_first
  FROM sys_public_holidays_cf h
  WHERE h.country_code = ANY (v_countries)
    AND h.is_estimated = TRUE
    AND h.is_active = TRUE
    AND h.rec_status = 1
    AND h.holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60;

  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    jsonb_build_object(
                    'countries',  to_jsonb(v_countries),
                    'first_date', v_first,
                    'window_days', 60)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_cal_holidays_estimated(UUID, UUID) IS
  'Setup Health CAL_HOLIDAYS_ESTIMATED: FAIL when sys_public_holidays_cf has is_estimated holidays in the next 60 days for the countries of the organization''s active branches (or p_branch), falling back to the organization country. NA when no country is set. count = holiday rows; sample_ids = up to 5 sys_public_holidays_cf ids. Tenant-filtered, read-only.';

-- Callers: the dispatcher (as the calling role). Never anonymous.
REVOKE ALL ON FUNCTION public.fn_shc_cal_holidays_estimated(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_cal_holidays_estimated(UUID, UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Registry row (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity, name, name2, description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_key,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES
  ('CAL_HOLIDAYS_ESTIMATED', 'CALENDAR', 'INFO',
   'Public holiday dates are not confirmed yet', 'مواعيد العطل الرسمية غير مؤكدة بعد',
   'One or more public holidays in the next 60 days still use an estimated date (for example Eid before the official announcement). Ready-by times skip these days, so confirm the dates once they are announced.',
   'عطلة رسمية واحدة أو أكثر خلال الستين يوماً القادمة ما زال تاريخها تقديرياً (مثل العيد قبل الإعلان الرسمي). مواعيد الجاهزية تتخطى هذه الأيام، لذلك أكّد التواريخ عند إعلانها.',
   NULL, NULL, NULL, NULL,
   FALSE, TRUE, 'fn_shc_cal_holidays_estimated', 20, 'system_admin', '0716 setup health')
ON CONFLICT (check_code) DO UPDATE
SET domain_code = EXCLUDED.domain_code, severity = EXCLUDED.severity,
    name = EXCLUDED.name, name2 = EXCLUDED.name2,
    description = EXCLUDED.description, description2 = EXCLUDED.description2,
    fix_route = EXCLUDED.fix_route, hq_fix_route = EXCLUDED.hq_fix_route,
    fix_permission = EXCLUDED.fix_permission, feature_flag_key = EXCLUDED.feature_flag_key,
    shows_banner = EXCLUDED.shows_banner, is_hq_only = EXCLUDED.is_hq_only,
    fn_name = EXCLUDED.fn_name, display_order = EXCLUDED.display_order,
    updated_at = NOW(), updated_by = 'system_admin', updated_info = '0716 setup health';

-- -----------------------------------------------------------------------------
-- 3. Verification: every active tenant still gets one row per active check and
--    no ERROR rows. Fails the migration if not.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_checks INTEGER;
  v_bad    RECORD;
BEGIN
  SELECT count(*) INTO v_checks FROM public.sys_setup_health_check_cd WHERE is_active AND rec_status = 1;

  FOR v_bad IN
    SELECT t.id, x.check_code, x.details
    FROM public.org_tenants_mst t
    CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL, NULL) x
    WHERE t.is_active AND t.rec_status = 1 AND x.status = 'ERROR'
    LIMIT 1
  LOOP
    RAISE EXCEPTION '0716: check % returned ERROR for tenant %: %', v_bad.check_code, v_bad.id, v_bad.details;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.org_tenants_mst t
    WHERE t.is_active AND t.rec_status = 1
      AND (SELECT count(*) FROM public.fn_setup_health_run(t.id, NULL, NULL)) <> v_checks
  ) THEN
    RAISE EXCEPTION '0716: a tenant did not get one row per active check';
  END IF;
END $$;

COMMIT;
