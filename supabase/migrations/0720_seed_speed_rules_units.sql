-- ============================================================
-- Migration: 0720_seed_speed_rules_units.sql
-- Purpose:   Fix the catalog seeder for new organizations and give them sample
--            speeds. seed_product_speed_rules wrote turnaround_hh_speed without
--            turnaround_unit, which chk_org_spd_price_rules_turn_unit (0707)
--            refuses, so seeding any template with Express hours failed. A speed
--            is offered only with a rule (Service Speeds D5), so a new
--            organization also needs NEXT_DAY / EXPRESS / URGENT sample rules.
-- Affected:  public.seed_product_speed_rules (function)
-- Related:   0700 (function created), 0707 (turnaround unit CHECK), 0711 (demo rules)
-- Data:      none changed here. Existing organizations and rules are not touched;
--            the function only adds rules when a seeder creates products.
-- ============================================================

BEGIN;

-- Same signature, so existing grants and HQ's RPC call keep working.
-- Returns template rules plus sample rules created (HQ reports it as a count).
CREATE OR REPLACE FUNCTION public.seed_product_speed_rules(
  p_tenant_org_id   uuid,
  p_product_ids     uuid[],
  p_include_pricing boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_created integer := 0;
  v_samples integer := 0;
BEGIN
  IF p_tenant_org_id IS NULL OR p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- Template-based EXPRESS rules per product (rules unchanged from 0700, plus the unit).
  WITH created AS (
  INSERT INTO org_speed_price_rules_cf (
    tenant_org_id, service_speed, product_id,
    speed_price_type, default_speed_sell_price, multiplier_speed,
    turnaround_unit, turnaround_hh_speed, effective_from, created_by, created_info
  )
  SELECT
    src.tenant_org_id,
    'EXPRESS',
    src.product_id,
    CASE WHEN src.use_price THEN 'SELL_PRICE' ELSE 'MULTIPLIER' END,
    CASE WHEN src.use_price THEN src.express_price END,
    CASE WHEN src.use_price THEN NULL ELSE src.multiplier - 1 END,
    -- chk_org_spd_price_rules_turn_unit: hours need the HOURS unit, no hours need none.
    CASE WHEN src.turnaround IS NOT NULL THEN 'HOURS' END,
    src.turnaround,
    CURRENT_DATE,
    'system_seed',
    'Seeded from the product template by seed_product_speed_rules (0720)'
  FROM (
    -- One template per product (the seeders match on item and category).
    SELECT DISTINCT ON (p.id)
      p.tenant_org_id,
      p.id AS product_id,
      p.service_category_code,
      t.default_express_sell_price AS express_price,
      t.multiplier_express AS multiplier,
      t.turnaround_hh_express AS turnaround,
      -- The express price was copied only with pricing, as before; when copied, it
      -- decides alone (the factor is not used for that product).
      COALESCE(p_include_pricing AND t.default_express_sell_price > 0, false) AS has_price,
      -- An express price equal to the normal price adds nothing, like a factor of 1.
      COALESCE(p_include_pricing AND t.default_express_sell_price > 0
        AND t.default_express_sell_price IS DISTINCT FROM t.default_sell_price, false) AS use_price
    FROM org_product_data_mst p
    JOIN sys_service_prod_templates_cd t
      ON t.item_code = p.product_code
     AND t.service_category_code = p.service_category_code
    WHERE p.tenant_org_id = p_tenant_org_id
      AND p.id = ANY (p_product_ids)
    ORDER BY p.id, t.seed_priority
  ) src
  -- No rule when it would add nothing (factor 1 or none): a zero rule would only
  -- hide a category or all-products rule from this product (0694).
  WHERE (src.use_price OR (NOT src.has_price AND COALESCE(src.multiplier, 1) > 1))
    -- Never a second rule for a product that already has one, in any state.
    AND NOT EXISTS (
      SELECT 1 FROM org_speed_price_rules_cf r
      WHERE r.tenant_org_id = src.tenant_org_id
        AND r.service_speed = 'EXPRESS'
        AND r.product_id = src.product_id
    )
    -- The organization's own rule for all products or for this category (all
    -- branches, active, in date) already prices Express: a template rule would
    -- override it, so the product follows the organization's rule instead.
    AND NOT EXISTS (
      SELECT 1 FROM org_speed_price_rules_cf r
      WHERE r.tenant_org_id = src.tenant_org_id
        AND r.service_speed = 'EXPRESS'
        AND r.product_id IS NULL
        AND r.branch_id IS NULL
        AND (r.service_category_code IS NULL OR r.service_category_code = src.service_category_code)
        AND r.is_active = true
        AND r.rec_status = 1
        AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    )
  -- A concurrent seed of the same product created it first: keep that one.
  ON CONFLICT ON CONSTRAINT uq_org_spd_price_rules_scope DO NOTHING
  RETURNING id, tenant_org_id, product_id, speed_price_type,
            default_speed_sell_price, multiplier_speed, effective_from, effective_to
  )
  -- One history row per rule, as the Speed Pricing screen writes on create.
  INSERT INTO org_price_history_audit (
    tenant_org_id, entity_type, entity_id, product_id, old_price, new_price,
    change_reason, effective_from, effective_to, created_by, created_info
  )
  SELECT
    c.tenant_org_id, 'speed_rule', c.id, c.product_id, NULL,
    COALESCE(c.default_speed_sell_price, c.multiplier_speed),
    'CREATE: - -> ' || c.speed_price_type,
    c.effective_from, c.effective_to,
    -- created_by is a user UUID; a system seed has none.
    NULL, 'Catalog seed (seed_product_speed_rules, 0720)'
  FROM created c;

  GET DIAGNOSTICS v_created = ROW_COUNT;

  -- Sample rules for all products, so the speeds are offered from day one. A separate
  -- statement, so it sees the EXPRESS rules created above. Only for a speed the
  -- organization has no rule for in any scope or state: its own setup always wins,
  -- including a rule it switched off. ECONOMY is a business choice, so it is not seeded.
  WITH created AS (
    INSERT INTO org_speed_price_rules_cf (
      tenant_org_id, service_speed, speed_price_type, multiplier_speed,
      turnaround_unit, turnaround_hh_speed, turnaround_days_speed,
      effective_from, created_by, created_info
    )
    SELECT
      p_tenant_org_id, s.speed, 'MULTIPLIER', s.multiplier,
      s.unit, s.hours, s.days,
      CURRENT_DATE, 'system_seed', 'Sample rule from seed_product_speed_rules (0720)'
    FROM (VALUES
      ('NEXT_DAY', 0.25::numeric, 'WORKING_DAYS', NULL::numeric, 1::smallint),
      ('EXPRESS',  0.50::numeric, 'WORKING_DAYS', NULL::numeric, 0::smallint),
      ('URGENT',   1.00::numeric, 'HOURS',        3::numeric,    NULL::smallint)
    ) AS s(speed, multiplier, unit, hours, days)
    WHERE NOT EXISTS (
      SELECT 1 FROM org_speed_price_rules_cf r
      WHERE r.tenant_org_id = p_tenant_org_id
        AND r.service_speed = s.speed
    )
    ON CONFLICT ON CONSTRAINT uq_org_spd_price_rules_scope DO NOTHING
    RETURNING id, tenant_org_id, speed_price_type, multiplier_speed, effective_from, effective_to
  )
  INSERT INTO org_price_history_audit (
    tenant_org_id, entity_type, entity_id, product_id, old_price, new_price,
    change_reason, effective_from, effective_to, created_by, created_info
  )
  SELECT
    c.tenant_org_id, 'speed_rule', c.id, NULL, NULL, c.multiplier_speed,
    'CREATE: - -> ' || c.speed_price_type,
    c.effective_from, c.effective_to,
    NULL, 'Catalog seed (seed_product_speed_rules, 0720)'
  FROM created c;

  GET DIAGNOSTICS v_samples = ROW_COUNT;
  RETURN v_created + v_samples;
END;
$function$;

COMMENT ON FUNCTION public.seed_product_speed_rules(uuid, uuid[], boolean) IS
  'For products a catalog seeder just created: creates their EXPRESS rule from the template (SELL_PRICE when pricing is copied and the template express price differs from the normal price; else MULTIPLIER, template factor - 1, if above 1; hours carry the HOURS unit). Never a rule that adds nothing, never a second rule for a product, none when the organization''s own all-products or category rule covers the product. Then adds organization-wide sample rules (NEXT_DAY +25% 1 working day, EXPRESS +50% same working day, URGENT +100% 3 working hours) for each speed with no rule in any scope or state. Returns the number of rules created.';

-- Restated from 0700: only the seeders and HQ (service role) may call it.
REVOKE ALL ON FUNCTION public.seed_product_speed_rules(uuid, uuid[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_product_speed_rules(uuid, uuid[], boolean) TO service_role;

COMMIT;
