-- =============================================================================
-- 0700_retire_product_express_cols.sql
--
-- Purpose: Line-Level Money Snapshot M11 (PLAN §12, P10-03). Express pricing lives
-- in org_speed_price_rules_cf (0640). This migration removes the last database
-- readers of the retired product fields, then drops the fields:
--   org_product_data_mst.default_express_sell_price, multiplier_express,
--   turnaround_hh_express, is_tax_exempt (tax comes from tax_category_code, 0639).
--
-- Changes:
--   0. service_category_code becomes NOT NULL, and product code is unique per tenant
--      AND service category (was per tenant): the same item can be sold in two
--      categories (e.g. a shirt washed vs dry cleaned), as the templates already
--      allow (key item_code + service_category_code).
--   1. seed_product_speed_rules (new): gives products just created by a catalog
--      seeder their EXPRESS rule, from the same template facts the product columns
--      used to copy. Same mapping as 0640's backfill, without its zero-multiplier
--      rows (0694 removed those: they blocked broader rules and added nothing).
--   2. initialize_tenant_product_catalog / reseed_missing_products: stop writing the
--      retired columns; call (1) for the products they created. Existing products and
--      rules are never touched, so no price changes silently. Result JSON gains
--      speed_rules_created (additive).
--   3. get_product_price: the 'express' list-type fallback to the product's express
--      price is removed (Express premium = speed rules). Also adds the missing tenant
--      predicate on the price-list join.
--   4. get_product_price_with_tax: dropped. No caller in either app, and it fell
--      back to a hard-coded 5% tax rate (tax comes only from tax profiles, P6-03).
--   5. trigger_log_product_default_price_change: rebuilt without the express column
--      (the old function also wrote an invalid entity_id, NEW.id || '_express').
--   6. Drop the four columns (RESTRICT).
--
-- Seeder fixes made while replacing them (all found in review):
--   - An unknown organization id raised nothing and seeded every template; it now raises.
--   - The seeders skipped only active products, so one inactive product with the same
--     key failed the whole run. Any existing row (same category + code) is now skipped
--     (a product switched off stays off), and inserts use ON CONFLICT for races.
--   - A second initialize with a default price list created a second default list.
--   - The price-history trigger cast free-text updated_by into a UUID column, which
--     failed any default-price update by a non-UUID actor (e.g. 'system_migration').
--   - Seeded speed rules get the same history row the Speed Pricing screen writes.
--
-- Grants: the catalog seeders and the new helper are HQ-only (service role); anon,
-- PUBLIC and signed-in users lose EXECUTE (they could call them before). Tenant
-- pricing keeps get_product_price for signed-in users.
--
-- Not changed: sys_service_prod_templates_cd and sys_service_category_cd keep their
-- express fields (platform defaults the seeders read).
-- =============================================================================

BEGIN;

-- ─── 0. Product key: tenant + service category + product code ───────────────

-- Every product belongs to a service category: seeded products copy the template's
-- (NOT NULL there), tenant products must pick an enabled one, inventory items use
-- RETAIL_ITEMS. No row has NULL today. Being part of the key, it must not be NULL.
ALTER TABLE public.org_product_data_mst
  ALTER COLUMN service_category_code SET NOT NULL;

COMMENT ON COLUMN public.org_product_data_mst.service_category_code IS
  'Service category the product is sold under (FK fk_org_prod_ctg to org_service_category_cf). Required; part of the product key with product_code.';

-- The new key is added before the old one is dropped, so the table is never without
-- a key. Existing rows already satisfy it (the old key was stricter).
ALTER TABLE public.org_product_data_mst
  ADD CONSTRAINT uq_org_prod_tenant_ctg_code
    UNIQUE (tenant_org_id, service_category_code, product_code),
  -- Replaced by uq_org_prod_tenant_ctg_code; no foreign key uses it.
  DROP CONSTRAINT org_product_data_mst_tenant_org_id_product_code_key RESTRICT;

COMMENT ON CONSTRAINT uq_org_prod_tenant_ctg_code ON public.org_product_data_mst IS
  'A product code is unique within a tenant''s service category (the same item may be offered in several categories, as the templates allow).';

-- ─── 1. Speed rules for newly seeded products ───────────────────────────────

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
BEGIN
  IF p_tenant_org_id IS NULL OR p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
    RETURN 0;
  END IF;

  WITH created AS (
  INSERT INTO org_speed_price_rules_cf (
    tenant_org_id, service_speed, product_id,
    speed_price_type, default_speed_sell_price, multiplier_speed,
    turnaround_hh_speed, effective_from, created_by, created_info
  )
  SELECT
    src.tenant_org_id,
    'EXPRESS',
    src.product_id,
    CASE WHEN src.use_price THEN 'SELL_PRICE' ELSE 'MULTIPLIER' END,
    CASE WHEN src.use_price THEN src.express_price END,
    CASE WHEN src.use_price THEN NULL ELSE src.multiplier - 1 END,
    src.turnaround,
    CURRENT_DATE,
    'system_seed',
    'Seeded from the product template by seed_product_speed_rules (0700)'
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
    NULL, 'Catalog seed (seed_product_speed_rules, 0700)'
  FROM created c;

  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN v_created;
END;
$function$;

COMMENT ON FUNCTION public.seed_product_speed_rules(uuid, uuid[], boolean) IS
  'Creates the EXPRESS speed rule of products a catalog seeder just created, from their template: SELL_PRICE when pricing is copied and the template express price differs from the normal price; else, when no express price is copied, MULTIPLIER (template factor - 1) if the factor is above 1. Never a rule that adds nothing, never a second rule for a product, and none when the organization''s own all-products or category rule already covers the product. Returns the number of rules created.';

-- Called only by the seeders below and by HQ (service role).
REVOKE ALL ON FUNCTION public.seed_product_speed_rules(uuid, uuid[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_product_speed_rules(uuid, uuid[], boolean) TO service_role;

-- ─── 2a. initialize_tenant_product_catalog ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.initialize_tenant_product_catalog(
  p_tenant_org_id uuid,
  p_include_pricing boolean DEFAULT false,
  p_include_cost boolean DEFAULT false,
  p_create_default_price_list boolean DEFAULT false,
  p_seed_filter character varying DEFAULT 'standard'::character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_products_created INTEGER := 0;
  v_new_product_ids UUID[];
  v_speed_rules_created INTEGER := 0;
  v_price_list_id UUID;
  v_business_type_code TEXT;
BEGIN
  SELECT business_type_code INTO v_business_type_code
  FROM org_tenants_mst
  WHERE id = p_tenant_org_id;
  -- An unknown id has no business type, which would otherwise mean "seed everything".
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization % not found', p_tenant_org_id USING ERRCODE = 'P0002';
  END IF;

  -- STEP 1: every service category the templates use exists for the tenant
  -- (prevents fk_org_prod_ctg violations).
  INSERT INTO org_service_category_cf (tenant_org_id, service_category_code, rec_order)
  SELECT p_tenant_org_id, s.service_category_code, COALESCE(s.rec_order, 1)
  FROM sys_service_category_cd s
  WHERE s.is_active = true
    AND EXISTS (
      SELECT 1 FROM sys_service_prod_templates_cd t
      INNER JOIN sys_items_data_list_cd i ON t.item_code = i.item_code
      LEFT JOIN sys_business_type_template_cf btt ON
        t.item_code = btt.item_code
        AND t.service_category_code = btt.service_category_code
        AND btt.business_type_code = v_business_type_code
      WHERE t.service_category_code = s.service_category_code
        AND t.is_to_seed = true
        AND t.is_active = true
        AND (
          v_business_type_code IS NULL
          OR (btt.is_enabled = true AND (btt.is_default = true OR p_seed_filter = 'all'))
        )
        AND (
          p_seed_filter = 'all'
          OR t.seed_options IS NULL
          OR t.seed_options->'required_for' IS NULL
          OR (t.seed_options->'required_for') @> to_jsonb(p_seed_filter::text)
        )
        AND NOT EXISTS (
          SELECT 1 FROM org_product_data_mst p
          WHERE p.tenant_org_id = p_tenant_org_id
            AND p.service_category_code = t.service_category_code
            AND p.product_code = t.item_code
        )
    )
  ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

  -- STEP 2: insert only the products the tenant does not have yet.
  WITH templates_to_insert AS (
    SELECT
      gen_random_uuid() AS id,
      p_tenant_org_id AS tenant_org_id,
      t.service_category_code,
      t.item_type_code,
      t.item_code,
      COALESCE(t.name, i.item_name) AS product_name,
      COALESCE(t.name2, i.item_name2) AS product_name2,
      COALESCE(t.hint_text, i.hint_text) AS hint_text,
      COALESCE(t.is_retail_item, i.is_retail_item) AS is_retail_item,
      1 AS product_type,
      t.price_type,
      t.product_unit,
      CASE WHEN p_include_pricing THEN t.default_sell_price ELSE NULL END AS default_sell_price,
      CASE WHEN p_include_cost THEN t.product_cost ELSE NULL END AS product_cost,
      CASE WHEN p_include_pricing THEN t.min_sell_price ELSE NULL END AS min_sell_price,
      t.min_quantity,
      t.pieces_per_product,
      t.extra_days,
      t.turnaround_hh,
      COALESCE(t.tags, i.tags) AS tags,
      COALESCE(t.id_sku, i.id_sku) AS id_sku,
      COALESCE(t.product_color1, i.item_color1) AS product_color1,
      COALESCE(t.product_color2, i.item_color2) AS product_color2,
      COALESCE(t.product_color3, i.item_color3) AS product_color3,
      COALESCE(t.product_icon, i.item_icon) AS product_icon,
      COALESCE(t.product_image, i.item_image) AS product_image,
      t.item_type_code AS product_group1,
      t.rec_order AS product_order,
      t.seed_priority AS rec_order
    FROM sys_service_prod_templates_cd t
    INNER JOIN sys_items_data_list_cd i ON t.item_code = i.item_code
    LEFT JOIN sys_business_type_template_cf btt ON
      t.item_code = btt.item_code
      AND t.service_category_code = btt.service_category_code
      AND btt.business_type_code = v_business_type_code
    WHERE t.is_to_seed = true
      AND t.is_active = true
      AND (
        v_business_type_code IS NULL
        OR (btt.is_enabled = true AND (btt.is_default = true OR p_seed_filter = 'all'))
      )
      AND (
        p_seed_filter = 'all'
        OR t.seed_options IS NULL
        OR t.seed_options->'required_for' IS NULL
        OR (t.seed_options->'required_for') @> to_jsonb(p_seed_filter::text)
      )
      -- Any existing row with the same key (category + code), active or not: a
      -- product the organization switched off must not come back.
      AND NOT EXISTS (
        SELECT 1 FROM org_product_data_mst p
        WHERE p.tenant_org_id = p_tenant_org_id
          AND p.service_category_code = t.service_category_code
          AND p.product_code = t.item_code
      )
    ORDER BY t.seed_priority ASC
  ),
  inserted AS (
    INSERT INTO org_product_data_mst (
      id, tenant_org_id, service_category_code, item_type_code, product_code,
      product_name, product_name2, hint_text, is_retail_item, product_type,
      price_type, product_unit, default_sell_price, product_cost, min_sell_price,
      min_quantity, pieces_per_product, extra_days, turnaround_hh, product_order,
      tags, id_sku, is_active, product_color1, product_color2, product_color3,
      product_icon, product_image, product_group1, product_group2, product_group3,
      rec_order, created_by, rec_status
    )
    SELECT
      id, tenant_org_id, service_category_code, item_type_code, item_code,
      product_name, product_name2, hint_text, is_retail_item, product_type,
      price_type, product_unit, default_sell_price, product_cost, min_sell_price,
      min_quantity, pieces_per_product, extra_days, turnaround_hh, product_order,
      tags, id_sku, true, product_color1, product_color2, product_color3,
      product_icon, product_image, product_group1, NULL, NULL,
      rec_order, 'system_seed', 1
    FROM templates_to_insert
    -- A concurrent seed inserted it first: keep that row.
    ON CONFLICT ON CONSTRAINT uq_org_prod_tenant_ctg_code DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer, array_agg(id) INTO v_products_created, v_new_product_ids
  FROM inserted;

  -- STEP 3: Express rules for the products just created (replaces the copied columns).
  v_speed_rules_created := public.seed_product_speed_rules(p_tenant_org_id, v_new_product_ids, p_include_pricing);

  -- Once per organization: a second run must not add a second default list.
  IF p_create_default_price_list AND p_include_pricing AND NOT EXISTS (
    SELECT 1 FROM org_price_lists_mst pl
    WHERE pl.tenant_org_id = p_tenant_org_id
      AND pl.price_list_type = 'standard'
      AND pl.is_default = true
      AND pl.is_active = true
  ) THEN
    INSERT INTO org_price_lists_mst (
      tenant_org_id, name, name2, description, price_list_type, is_default, is_active, created_by
    ) VALUES (
      p_tenant_org_id,
      'Standard Price List',
      'قائمة الأسعار القياسية',
      'Default price list created during tenant initialization',
      'standard',
      true,
      true,
      'system_seed'
    )
    RETURNING id INTO v_price_list_id;

    INSERT INTO org_price_list_items_dtl (
      tenant_org_id, price_list_id, product_id, price, is_active, created_by
    )
    SELECT p_tenant_org_id, v_price_list_id, p.id, p.default_sell_price, true, 'system_seed'
    FROM org_product_data_mst p
    WHERE p.tenant_org_id = p_tenant_org_id
      AND p.default_sell_price IS NOT NULL
      AND p.is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'products_created', v_products_created,
    'speed_rules_created', v_speed_rules_created,
    'price_list_created', v_price_list_id IS NOT NULL,
    'price_list_id', v_price_list_id,
    'tenant_org_id', p_tenant_org_id,
    'business_type_code', v_business_type_code,
    'seed_filter', p_seed_filter,
    'include_pricing', p_include_pricing
  );
END;
$function$;

COMMENT ON FUNCTION public.initialize_tenant_product_catalog(uuid, boolean, boolean, boolean, character varying) IS
  'HQ: seeds a tenant''s products from the platform templates (missing ones only), their EXPRESS speed rules (seed_product_speed_rules), and optionally a default price list. Returns counts as JSON.';

-- HQ-only (service role). Signed-in tenant users and anon lose EXECUTE.
REVOKE ALL ON FUNCTION public.initialize_tenant_product_catalog(uuid, boolean, boolean, boolean, character varying) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_tenant_product_catalog(uuid, boolean, boolean, boolean, character varying) TO service_role;

-- ─── 2b. reseed_missing_products ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reseed_missing_products(
  p_tenant_org_id uuid,
  p_include_pricing boolean DEFAULT false,
  p_only_missing boolean DEFAULT true,
  p_item_codes character varying[] DEFAULT NULL::character varying[]
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_products_added INTEGER := 0;
  v_templates_found INTEGER := 0;
  v_already_exists INTEGER := 0;
  v_new_product_id UUID;
  v_new_product_ids UUID[] := '{}';
  v_speed_rules_created INTEGER := 0;
  v_template RECORD;
  v_business_type_code TEXT;
BEGIN
  SELECT business_type_code INTO v_business_type_code
  FROM org_tenants_mst
  WHERE id = p_tenant_org_id;
  -- An unknown id has no business type, which would otherwise mean "seed everything".
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization % not found', p_tenant_org_id USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*) INTO v_templates_found
  FROM sys_service_prod_templates_cd t
  LEFT JOIN sys_business_type_template_cf btt ON
    t.item_code = btt.item_code
    AND t.service_category_code = btt.service_category_code
    AND btt.business_type_code = v_business_type_code
  WHERE t.is_to_seed = true
    AND t.is_active = true
    AND (p_item_codes IS NULL OR t.item_code = ANY (p_item_codes))
    AND (v_business_type_code IS NULL OR btt.is_enabled = true);

  FOR v_template IN
    SELECT
      t.*,
      i.item_name,
      i.item_name2,
      i.hint_text AS item_hint_text,
      i.is_retail_item AS item_is_retail_item,
      i.item_color1,
      i.item_color2,
      i.item_color3,
      i.item_icon,
      i.item_image,
      i.tags AS item_tags,
      i.id_sku AS item_id_sku
    FROM sys_service_prod_templates_cd t
    INNER JOIN sys_items_data_list_cd i ON t.item_code = i.item_code
    LEFT JOIN sys_business_type_template_cf btt ON
      t.item_code = btt.item_code
      AND t.service_category_code = btt.service_category_code
      AND btt.business_type_code = v_business_type_code
    WHERE t.is_to_seed = true
      AND t.is_active = true
      AND (p_item_codes IS NULL OR t.item_code = ANY (p_item_codes))
      AND (v_business_type_code IS NULL OR btt.is_enabled = true)
    ORDER BY t.seed_priority ASC
  LOOP
    v_new_product_id := NULL;
    -- Skip a product the tenant already has (same category + code), active or not:
    -- re-inserting an inactive one failed the whole run. p_only_missing is kept for
    -- callers; both values now skip existing rows.
    IF EXISTS (
      SELECT 1 FROM org_product_data_mst
      WHERE tenant_org_id = p_tenant_org_id
        AND service_category_code = v_template.service_category_code
        AND product_code = v_template.item_code
    ) THEN
      v_already_exists := v_already_exists + 1;
      CONTINUE;
    END IF;

    INSERT INTO org_product_data_mst (
      id, tenant_org_id, service_category_code, item_type_code, product_code,
      product_name, product_name2, hint_text, is_retail_item, product_type,
      price_type, product_unit, default_sell_price, product_cost, min_sell_price,
      min_quantity, pieces_per_product, extra_days, turnaround_hh, product_order,
      tags, id_sku, is_active, product_color1, product_color2, product_color3,
      product_icon, product_image, product_group1, rec_order, created_by, rec_status
    ) VALUES (
      gen_random_uuid(),
      p_tenant_org_id,
      v_template.service_category_code,
      v_template.item_type_code,
      v_template.item_code,
      COALESCE(v_template.name, v_template.item_name),
      COALESCE(v_template.name2, v_template.item_name2),
      COALESCE(v_template.hint_text, v_template.item_hint_text),
      COALESCE(v_template.is_retail_item, v_template.item_is_retail_item),
      1,
      v_template.price_type,
      v_template.product_unit,
      CASE WHEN p_include_pricing THEN v_template.default_sell_price ELSE NULL END,
      NULL, -- cost is not copied on reseed
      CASE WHEN p_include_pricing THEN v_template.min_sell_price ELSE NULL END,
      v_template.min_quantity,
      v_template.pieces_per_product,
      v_template.extra_days,
      v_template.turnaround_hh,
      v_template.rec_order,
      COALESCE(v_template.tags, v_template.item_tags),
      COALESCE(v_template.id_sku, v_template.item_id_sku),
      true,
      COALESCE(v_template.product_color1, v_template.item_color1),
      COALESCE(v_template.product_color2, v_template.item_color2),
      COALESCE(v_template.product_color3, v_template.item_color3),
      COALESCE(v_template.product_icon, v_template.item_icon),
      COALESCE(v_template.product_image, v_template.item_image),
      v_template.item_type_code,
      v_template.seed_priority,
      'system_reseed',
      1
    )
    -- A concurrent seed inserted it first: count it as existing.
    ON CONFLICT ON CONSTRAINT uq_org_prod_tenant_ctg_code DO NOTHING
    RETURNING id INTO v_new_product_id;

    IF v_new_product_id IS NULL THEN
      v_already_exists := v_already_exists + 1;
      CONTINUE;
    END IF;
    v_new_product_ids := array_append(v_new_product_ids, v_new_product_id);
    v_products_added := v_products_added + 1;
  END LOOP;

  -- Express rules for the products just added (replaces the copied columns).
  v_speed_rules_created := public.seed_product_speed_rules(p_tenant_org_id, v_new_product_ids, p_include_pricing);

  RETURN jsonb_build_object(
    'success', true,
    'templates_found', v_templates_found,
    'products_added', v_products_added,
    'speed_rules_created', v_speed_rules_created,
    'already_exists', v_already_exists,
    'tenant_org_id', p_tenant_org_id,
    'business_type_code', v_business_type_code
  );
END;
$function$;

COMMENT ON FUNCTION public.reseed_missing_products(uuid, boolean, boolean, character varying[]) IS
  'HQ maintenance: adds the template products a tenant is missing and their EXPRESS speed rules (seed_product_speed_rules). Existing products and rules are untouched. Returns counts as JSON.';

-- HQ-only (service role). Signed-in tenant users and anon lose EXECUTE.
REVOKE ALL ON FUNCTION public.reseed_missing_products(uuid, boolean, boolean, character varying[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseed_missing_products(uuid, boolean, boolean, character varying[]) TO service_role;

-- ─── 3. get_product_price ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_product_price(
  p_tenant_org_id uuid,
  p_product_id uuid,
  p_price_list_type character varying DEFAULT 'standard'::character varying,
  p_quantity integer DEFAULT 1,
  p_effective_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  -- Same precision as before: this migration only removes the express branch.
  v_price NUMERIC(10,3);
BEGIN
  -- The active price list's price (its discount folded in), highest priority and
  -- deepest quantity tier first.
  SELECT pli.price * (1 - COALESCE(pli.discount_percent, 0) / 100)
  INTO v_price
  FROM org_price_list_items_dtl pli
  JOIN org_price_lists_mst pl
    ON pl.id = pli.price_list_id
   AND pl.tenant_org_id = pli.tenant_org_id
  WHERE pli.tenant_org_id = p_tenant_org_id
    AND pli.product_id = p_product_id
    AND pli.is_active = true
    AND pl.is_active = true
    AND pl.price_list_type = p_price_list_type
    AND (pl.effective_from IS NULL OR pl.effective_from <= p_effective_date)
    AND (pl.effective_to IS NULL OR pl.effective_to >= p_effective_date)
    AND pli.min_quantity <= p_quantity
    AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
  ORDER BY pl.priority DESC, pli.min_quantity DESC
  LIMIT 1;

  -- Else the product's default price, for every list type: the Express premium
  -- comes from the speed rules, not from this price.
  IF v_price IS NULL THEN
    SELECT default_sell_price
    INTO v_price
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND id = p_product_id
      AND is_active = true;
  END IF;

  RETURN v_price;
END;
$function$;

COMMENT ON FUNCTION public.get_product_price(uuid, uuid, character varying, integer, date) IS
  'Unit price of a product for a tenant: the active price list of the given type (discount folded in, priority then quantity tier), else the product default price. Never includes a speed premium (speed rules, 0640).';

-- Signed-in tenant users (legacy pricing service) and HQ keep it; anon loses it.
REVOKE ALL ON FUNCTION public.get_product_price(uuid, uuid, character varying, integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_price(uuid, uuid, character varying, integer, date) TO authenticated, service_role;

-- ─── 4. get_product_price_with_tax (removed) ────────────────────────────────

-- No caller in either app; it used a hard-coded 5% fallback tax rate.
DROP FUNCTION public.get_product_price_with_tax(uuid, uuid, character varying, integer, uuid, date) RESTRICT;

-- ─── 5. Default-price history trigger ───────────────────────────────────────

-- Dropped first: its WHEN clause depends on default_express_sell_price.
DROP TRIGGER trigger_log_product_default_price_change ON public.org_product_data_mst RESTRICT;

CREATE OR REPLACE FUNCTION public.log_product_default_price_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO org_price_history_audit (
    tenant_org_id, entity_type, entity_id, product_id,
    old_price, new_price, created_by, created_info
  ) VALUES (
    NEW.tenant_org_id, 'product_default', NEW.id, NEW.id,
    OLD.default_sell_price, NEW.default_sell_price,
    -- updated_by is free text (e.g. 'system_migration'); created_by is a UUID. Casting
    -- such text failed the whole product update, so a non-UUID actor goes to created_info.
    CASE WHEN NEW.updated_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN NEW.updated_by::uuid END,
    CASE WHEN NEW.updated_by IS NULL
           OR NEW.updated_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN NEW.updated_info
      ELSE concat_ws(' | ', 'by ' || NEW.updated_by, NEW.updated_info) END
  );
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.log_product_default_price_change() IS
  'Trigger: records a product''s default sell price change in org_price_history_audit (entity_type product_default). Express price history lives with the speed rules.';

-- Trigger-only; nobody calls it directly.
REVOKE ALL ON FUNCTION public.log_product_default_price_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trigger_log_product_default_price_change
  AFTER UPDATE ON public.org_product_data_mst
  FOR EACH ROW
  WHEN (OLD.default_sell_price IS DISTINCT FROM NEW.default_sell_price)
  EXECUTE FUNCTION public.log_product_default_price_change();

COMMENT ON TRIGGER trigger_log_product_default_price_change ON public.org_product_data_mst IS
  'Audits default sell price changes only (row written by log_product_default_price_change).';

-- ─── 6. Drop the retired product columns ────────────────────────────────────

-- Express price, factor and hours: replaced by org_speed_price_rules_cf (0640).
-- is_tax_exempt: replaced by tax_category_code (0639). No reader is left.
ALTER TABLE public.org_product_data_mst
  DROP COLUMN default_express_sell_price RESTRICT,
  DROP COLUMN multiplier_express RESTRICT,
  DROP COLUMN turnaround_hh_express RESTRICT,
  DROP COLUMN is_tax_exempt RESTRICT;

COMMIT;
