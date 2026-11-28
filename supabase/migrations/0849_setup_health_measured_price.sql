-- =============================================================================
-- Migration: 0849_setup_health_measured_price.sql
-- Program:   Measured Pricing + UoM - P7d (docs/features/Measured_Pricing/PLAN.md)
-- Purpose:   Setup Health check MEASURED_PRODUCT_NO_PRICE (domain CATALOG): an
--            active product priced per measure (kg, m, m2, L, hour) has no
--            price. Without a default price and without a Standard price-list row
--            the order is refused (price not resolved); a zero default price bills
--            the measure at zero.
--            Other unit problems get no check because the database already blocks
--            them: a unit used by a product cannot be switched off
--            (trg_ouom_in_use), a product cannot take an inactive unit
--            (trg_prod_uom_2_rules), and a custom physical unit needs its base
--            conversion (trg_ouom_base_conv, trg_ouomc_base_conv).
-- Affected:  fn_shc_measured_no_price (new), sys_setup_health_check_cd
--            (row MEASURED_PRODUCT_NO_PRICE).
-- Related:   0709 (registry, guard, dispatcher), 0738 (registry v2), 0813/0814
--            (units, product unit columns), 0842 (fn_cmx_dt_today). All must be
--            applied BEFORE this file.
-- Contract:  fn_shc_<check>(uuid, uuid) -> jsonb, read-only, SECURITY INVOKER,
--            fn_shc_guard_tenant first, every org_* read filters tenant_org_id.
--
-- Rollback (forward-only, manual):
--   DELETE FROM sys_setup_health_check_cd WHERE check_code = 'MEASURED_PRODUCT_NO_PRICE';
--   DROP FUNCTION fn_shc_measured_no_price(UUID, UUID) RESTRICT;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. MEASURED_PRODUCT_NO_PRICE
-- -----------------------------------------------------------------------------
-- A product is priced when its default price is above zero, or the Standard
-- price list (the one walk-in customers use) holds an active, in-date row above
-- zero for it. Customer-type lists (b2b, vip) do not count: they price only
-- those customers. "Today" is the business date of p_branch, else the
-- organization's, as get_product_price reads list dates.
CREATE OR REPLACE FUNCTION public.fn_shc_measured_no_price(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_today    DATE;
  v_measured INTEGER;
  v_ids      UUID[];
  v_codes    TEXT[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  v_today := public.fn_cmx_dt_today(p_tenant, 'accept_order', p_branch);

  WITH measured AS (
    SELECT p.id, p.product_code,
           COALESCE(p.default_sell_price, 0) > 0
           OR EXISTS (
             SELECT 1
             FROM org_price_list_items_dtl i
             JOIN org_price_lists_mst l
               ON l.id = i.price_list_id
              AND l.tenant_org_id = i.tenant_org_id
             WHERE i.tenant_org_id = p_tenant
               AND l.tenant_org_id = p_tenant
               AND i.product_id = p.id
               AND i.is_active = TRUE
               AND COALESCE(i.rec_status, 1) = 1
               AND i.price > 0
               AND l.is_active = TRUE
               AND COALESCE(l.rec_status, 1) = 1
               AND l.price_list_type = 'standard'
               AND (l.effective_from IS NULL OR l.effective_from <= v_today)
               AND (l.effective_to IS NULL OR l.effective_to >= v_today)
           ) AS is_priced
    FROM org_product_data_mst p
    JOIN org_uom_cf u
      ON u.tenant_org_id = p.tenant_org_id
     AND u.uom_code = p.base_uom_code
    WHERE p.tenant_org_id = p_tenant
      AND u.tenant_org_id = p_tenant
      AND p.is_active = TRUE
      AND COALESCE(p.rec_status, 1) = 1
      AND u.uom_dimension <> 'COUNT'
  )
  SELECT count(*),
         array_agg(m.id ORDER BY m.product_code) FILTER (WHERE NOT m.is_priced),
         array_agg(m.product_code ORDER BY m.product_code) FILTER (WHERE NOT m.is_priced)
  INTO v_measured, v_ids, v_codes
  FROM measured m;

  -- No measured product: the check does not apply.
  IF v_measured = 0 THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb,
                              'details', jsonb_build_object('reason', 'no_measured_products'));
  END IF;

  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    jsonb_build_object(
                    'measured_products', v_measured,
                    'product_codes',     to_jsonb(COALESCE(v_codes[1:5], '{}'::text[])))
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_measured_no_price(UUID, UUID) IS
  'Setup Health MEASURED_PRODUCT_NO_PRICE: FAIL when an active product with a non-COUNT base unit has neither a default sell price above zero nor an active, in-date standard price-list row above zero. NA when the organization has no measured product. count = unpriced products; sample_ids = up to 5 org_product_data_mst ids; details.product_codes names them. Tenant-filtered, read-only.';

-- Callers: the dispatcher (as the calling role). Never anonymous.
REVOKE ALL ON FUNCTION public.fn_shc_measured_no_price(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_measured_no_price(UUID, UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Registry row (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity, name, name2, ok_name, ok_name2,
  description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_keys,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES
  ('MEASURED_PRODUCT_NO_PRICE', 'CATALOG', 'WARNING',
   'Measured products without a price', 'منتجات تباع بالقياس بلا سعر',
   'All measured products have a price', 'لكل المنتجات التي تباع بالقياس سعر',
   'These products are priced per measure (for example per kilogram or square metre) but have no price above zero, either as a default price or in the Standard price list. The order is refused, or the measure is billed at zero. Set the price per unit.',
   'تُسعّر هذه المنتجات بالقياس (مثل الكيلوغرام أو المتر المربع) لكن ليس لها سعر أكبر من صفر، لا سعراً افتراضياً ولا في قائمة الأسعار القياسية. يُرفض الطلب أو يُحتسب القياس بصفر. حدّد سعر الوحدة.',
   '/dashboard/catalog/services', '/tenants/{tenantId}/catalog', 'admin:manage', '{}'::text[],
   FALSE, FALSE, 'fn_shc_measured_no_price', 10, 'system_admin', '0849 setup health measured price')
ON CONFLICT (check_code) DO UPDATE
SET domain_code = EXCLUDED.domain_code, severity = EXCLUDED.severity,
    name = EXCLUDED.name, name2 = EXCLUDED.name2,
    ok_name = EXCLUDED.ok_name, ok_name2 = EXCLUDED.ok_name2,
    description = EXCLUDED.description, description2 = EXCLUDED.description2,
    fix_route = EXCLUDED.fix_route, hq_fix_route = EXCLUDED.hq_fix_route,
    fix_permission = EXCLUDED.fix_permission, feature_flag_keys = EXCLUDED.feature_flag_keys,
    shows_banner = EXCLUDED.shows_banner, is_hq_only = EXCLUDED.is_hq_only,
    fn_name = EXCLUDED.fn_name, display_order = EXCLUDED.display_order,
    updated_at = NOW(), updated_by = 'system_admin', updated_info = '0849 setup health measured price';

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
    CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL::uuid, NULL::text, NULL::text[]) x
    WHERE t.is_active AND t.rec_status = 1 AND x.status = 'ERROR'
    LIMIT 1
  LOOP
    RAISE EXCEPTION '0849: check % returned ERROR for tenant %: %', v_bad.check_code, v_bad.id, v_bad.details;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.org_tenants_mst t
    WHERE t.is_active AND t.rec_status = 1
      AND (SELECT count(*) FROM public.fn_setup_health_run(t.id, NULL::uuid, NULL::text, NULL::text[])) <> v_checks
  ) THEN
    RAISE EXCEPTION '0849: a tenant did not get one row per active check';
  END IF;
END $$;

COMMIT;
