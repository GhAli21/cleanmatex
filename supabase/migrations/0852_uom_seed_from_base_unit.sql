-- =============================================================================
-- Migration: 0852_uom_seed_from_base_unit.sql
-- Program:   Measured Pricing + UoM - P9 step 1 of 2
--            (docs/features/Measured_Pricing/PLAN.md)
-- Purpose:   The catalog seeders copy the template's base_uom_code instead of the
--            legacy text product_unit, and the unit and price type get column
--            defaults. Both are needed before any writer stops sending
--            product_unit: today a template without product_unit would seed as
--            a piece.
-- Affected:  initialize_tenant_product_catalog, reseed_missing_products
--            (bodies of 0700 with only the unit column changed);
--            org_product_data_mst and sys_service_prod_templates_cd column
--            defaults for price_type and base_uom_code.
-- Order:     apply this BEFORE running the application code of P9, then apply
--            0853 after that code is running. Safe with old and new code.
-- Defaults:  they replace what the bridge trigger (dropped by 0853) did for an
--            insert that omits the column. A unit left out means a piece (PC,
--            the base count unit every organization holds).
-- Rollback (forward-only, manual): re-create both functions from 0700 and drop
--            the four defaults.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Defaults for an insert that omits the column
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_product_data_mst
  ALTER COLUMN base_uom_code SET DEFAULT 'PC',
  ALTER COLUMN price_type SET DEFAULT 'PER_UNIT';

ALTER TABLE public.sys_service_prod_templates_cd
  ALTER COLUMN base_uom_code SET DEFAULT 'PC',
  ALTER COLUMN price_type SET DEFAULT 'PER_UNIT';

-- -----------------------------------------------------------------------------
-- 2. Seed an organization's products with the template unit
-- -----------------------------------------------------------------------------
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
      t.base_uom_code,
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
      price_type, base_uom_code, default_sell_price, product_cost, min_sell_price,
      min_quantity, pieces_per_product, extra_days, turnaround_hh, product_order,
      tags, id_sku, is_active, product_color1, product_color2, product_color3,
      product_icon, product_image, product_group1, product_group2, product_group3,
      rec_order, created_by, rec_status
    )
    SELECT
      id, tenant_org_id, service_category_code, item_type_code, item_code,
      product_name, product_name2, hint_text, is_retail_item, product_type,
      price_type, base_uom_code, default_sell_price, product_cost, min_sell_price,
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

-- -----------------------------------------------------------------------------
-- 3. Reseed missing products with the template unit
-- -----------------------------------------------------------------------------
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
      price_type, base_uom_code, default_sell_price, product_cost, min_sell_price,
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
      v_template.base_uom_code,
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

-- CREATE OR REPLACE keeps the grants; restated so the intent stays with the definition (HQ only).
REVOKE ALL ON FUNCTION public.initialize_tenant_product_catalog(uuid, boolean, boolean, boolean, character varying) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_tenant_product_catalog(uuid, boolean, boolean, boolean, character varying) TO service_role;
REVOKE ALL ON FUNCTION public.reseed_missing_products(uuid, boolean, boolean, character varying[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseed_missing_products(uuid, boolean, boolean, character varying[]) TO service_role;

COMMIT;
