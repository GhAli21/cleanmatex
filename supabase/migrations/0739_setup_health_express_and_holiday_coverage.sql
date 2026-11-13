-- =============================================================================
-- Migration: 0739_setup_health_express_and_holiday_coverage.sql
-- Purpose:   Two Setup Health checks for Service Speeds (review 2026-11-13).
--   (1) SPEED_NO_EXPRESS: the organization has no organization-wide Express
--       rule. Without one the customer app does not offer Express (a rule for
--       only some branches, categories or products cannot be offered to a cart
--       the app cannot price in advance), and staff see Express for some items
--       only. Owner decision: the gap is REPORTED here, never seeded.
--   (2) CAL_HOLIDAYS_MISSING (HQ only): the platform has no public-holiday
--       dates far enough ahead for a country in use. Ready-by times then ignore
--       holidays silently once the seeded years (2026-2027) run out.
-- Affected:  fn_shc_speed_no_express, fn_shc_cal_holidays_missing (new),
--            sys_setup_health_check_cd (rows SPEED_NO_EXPRESS, CAL_HOLIDAYS_MISSING).
-- Related:   0709 (registry, guard, dispatcher), 0716 (holiday check pattern),
--            0711 (org_speed_price_rules_cf rules, sys_public_holidays_cf),
--            0738 (registry v2: ok_name, ok_name2, feature_flag_keys,
--            fn_setup_health_run with a check list). All must be applied BEFORE this file.
-- Contract:  fn_shc_<check>(uuid, uuid) -> jsonb, read-only, SECURITY INVOKER,
--            fn_shc_guard_tenant first, every org_* read filters tenant_org_id.
--
-- Rollback (forward-only, manual):
--   DELETE FROM sys_setup_health_check_cd WHERE check_code IN ('SPEED_NO_EXPRESS', 'CAL_HOLIDAYS_MISSING');
--   DROP FUNCTION fn_shc_speed_no_express(UUID, UUID) RESTRICT;
--   DROP FUNCTION fn_shc_cal_holidays_missing(UUID, UUID) RESTRICT;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. SPEED_NO_EXPRESS
-- -----------------------------------------------------------------------------
-- "Today" is the organization's business date (its time zone), as the order
-- loader reads rule dates; an unknown zone falls back to UTC. A rule counts when
-- it is active, in date, and applies to p_branch (or any branch when NULL).
-- It is organization-wide only when it names no branch, category or product.
CREATE OR REPLACE FUNCTION public.fn_shc_speed_no_express(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz    TEXT;
  v_today DATE;
  v_any   INTEGER;
  v_wide  INTEGER;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  SELECT t.timezone INTO v_tz FROM org_tenants_mst t WHERE t.id = p_tenant;
  IF v_tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = v_tz) THEN
    v_tz := 'UTC';
  END IF;
  v_today := (now() AT TIME ZONE v_tz)::date;

  SELECT count(*),
         count(*) FILTER (WHERE r.branch_id IS NULL AND r.product_id IS NULL AND r.service_category_code IS NULL)
  INTO v_any, v_wide
  FROM org_speed_price_rules_cf r
  WHERE r.tenant_org_id = p_tenant
    AND r.service_speed = 'EXPRESS'
    AND (p_branch IS NULL OR r.branch_id IS NULL OR r.branch_id = p_branch)
    AND r.is_active = TRUE
    AND r.rec_status = 1
    AND r.effective_from <= v_today
    AND (r.effective_to IS NULL OR r.effective_to >= v_today);

  RETURN jsonb_build_object(
    'status',     CASE WHEN v_wide > 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      CASE WHEN v_wide > 0 THEN 0 ELSE 1 END,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object(
                    'reason',         CASE WHEN v_wide > 0 THEN NULL WHEN v_any = 0 THEN 'NONE' ELSE 'PARTIAL' END,
                    'express_rules',  v_any,
                    'wide_rules',     v_wide)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_speed_no_express(UUID, UUID) IS
  'Setup Health SPEED_NO_EXPRESS: FAIL when the organization (or p_branch) has no active, in-date EXPRESS speed rule that covers every branch, category and product. details.reason = NONE (no Express rule) or PARTIAL (rules only for some branches, categories or products). Tenant-filtered, read-only.';

REVOKE ALL ON FUNCTION public.fn_shc_speed_no_express(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_speed_no_express(UUID, UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. CAL_HOLIDAYS_MISSING (HQ only)
-- -----------------------------------------------------------------------------
-- Countries = each active branch's country, else the organization's country
-- (the same rule as ready-by). A country needs dates at least 90 days ahead.
-- A country with no dates at all (not seeded yet) fails too: ready-by ignores
-- its holidays.
CREATE OR REPLACE FUNCTION public.fn_shc_cal_holidays_missing(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_countries TEXT[];
  v_short     JSONB;
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

  IF v_countries IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb,
                              'details', jsonb_build_object('reason', 'no_country'));
  END IF;

  -- One entry per country whose last known holiday is less than 90 days ahead.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('country', c.cc, 'last_date', h.last_date) ORDER BY c.cc), '[]'::jsonb)
  INTO v_short
  FROM unnest(v_countries) AS c(cc)
  LEFT JOIN LATERAL (
    SELECT max(p.holiday_date) AS last_date
    FROM sys_public_holidays_cf p
    WHERE p.country_code = c.cc AND p.is_active = TRUE AND p.rec_status = 1
  ) h ON TRUE
  WHERE h.last_date IS NULL OR h.last_date < CURRENT_DATE + 90;

  RETURN jsonb_build_object(
    'status',     CASE WHEN jsonb_array_length(v_short) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      jsonb_array_length(v_short),
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('countries', v_short, 'min_days_ahead', 90)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_cal_holidays_missing(UUID, UUID) IS
  'Setup Health CAL_HOLIDAYS_MISSING: FAIL when a country of the organization''s active branches (or p_branch), else the organization country, has no public-holiday date at least 90 days ahead in sys_public_holidays_cf. NA when no country is set. count = countries short of dates; details.countries = [{country, last_date}]. Read-only.';

REVOKE ALL ON FUNCTION public.fn_shc_cal_holidays_missing(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_cal_holidays_missing(UUID, UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Registry rows (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity, name, name2, ok_name, ok_name2,
  description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_keys,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES
  ('SPEED_NO_EXPRESS', 'SPEEDS', 'WARNING',
   'Express is not offered for every item', 'المستعجل غير متاح لكل الأصناف',
   'Express is offered for every item', 'المستعجل متاح لكل الأصناف',
   'There is no organization-wide Express rule (one for all branches, categories and products). Without it the customer app cannot offer Express, and staff see it for some items only. Add an Express rule in Speed Pricing.',
   'لا توجد قاعدة مستعجل تشمل المنشأة كلها (كل الفروع والفئات والمنتجات). بدونها لا يستطيع تطبيق العميل عرض المستعجل، ويراه الموظفون لبعض الأصناف فقط. أضف قاعدة مستعجل في تسعير السرعة.',
   '/dashboard/catalog/speed-pricing', '/tenants/{tenantId}/catalog', 'pricing:read', '{}'::text[],
   FALSE, FALSE, 'fn_shc_speed_no_express', 20, 'system_admin', '0739 setup health express'),
  ('CAL_HOLIDAYS_MISSING', 'CALENDAR', 'INFO',
   'Public holiday dates are missing for a country', 'مواعيد العطل الرسمية ناقصة لإحدى الدول',
   'Public holiday dates are loaded', 'مواعيد العطل الرسمية محمّلة',
   'The platform has no public holiday dates at least 90 days ahead for a country this organization uses. Ready-by times ignore holidays of that country until HQ adds the next year.',
   'لا تتوفر في المنصة مواعيد عطل رسمية لتسعين يوماً قادمة على الأقل لإحدى الدول التي تستخدمها هذه المنشأة. تتجاهل مواعيد الجاهزية عطل تلك الدولة حتى تضيف إدارة المنصة السنة القادمة.',
   NULL, '/products-items-config/public-holidays', NULL, '{}'::text[],
   FALSE, TRUE, 'fn_shc_cal_holidays_missing', 30, 'system_admin', '0739 setup health express')
ON CONFLICT (check_code) DO UPDATE
SET domain_code = EXCLUDED.domain_code, severity = EXCLUDED.severity,
    name = EXCLUDED.name, name2 = EXCLUDED.name2,
    ok_name = EXCLUDED.ok_name, ok_name2 = EXCLUDED.ok_name2,
    description = EXCLUDED.description, description2 = EXCLUDED.description2,
    fix_route = EXCLUDED.fix_route, hq_fix_route = EXCLUDED.hq_fix_route,
    fix_permission = EXCLUDED.fix_permission, feature_flag_keys = EXCLUDED.feature_flag_keys,
    shows_banner = EXCLUDED.shows_banner, is_hq_only = EXCLUDED.is_hq_only,
    fn_name = EXCLUDED.fn_name, display_order = EXCLUDED.display_order,
    updated_at = NOW(), updated_by = 'system_admin', updated_info = '0739 setup health express';

-- -----------------------------------------------------------------------------
-- 4. Verification: every active tenant still gets one row per active check and
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
    CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL::uuid, NULL::text, NULL::text[]) x
    WHERE t.is_active AND t.rec_status = 1 AND x.status = 'ERROR'
    LIMIT 1
  LOOP
    RAISE EXCEPTION '0739: check % returned ERROR for tenant %: %', v_bad.check_code, v_bad.id, v_bad.details;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.org_tenants_mst t
    WHERE t.is_active AND t.rec_status = 1
      AND (SELECT count(*) FROM public.fn_setup_health_run(t.id, NULL::uuid, NULL::text, NULL::text[])) <> v_checks
  ) THEN
    RAISE EXCEPTION '0739: a tenant did not get one row per active check';
  END IF;
END $$;

COMMIT;
