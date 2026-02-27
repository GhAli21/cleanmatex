-- ==================================================================
-- 0119_initialize_catalog_skip_existing_products.sql
-- Purpose: Make initialize_tenant_product_catalog idempotent - skip products
--   that already exist for the tenant (fixes duplicate key constraint error).
-- ==================================================================

BEGIN;

CREATE OR REPLACE FUNCTION initialize_tenant_product_catalog(
  p_tenant_org_id UUID,
  p_include_pricing BOOLEAN DEFAULT false,
  p_include_cost BOOLEAN DEFAULT false,
  p_create_default_price_list BOOLEAN DEFAULT false,
  p_seed_filter VARCHAR(50) DEFAULT 'standard'  -- 'basic', 'standard', 'premium', 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_products_created INTEGER := 0;
  v_price_list_id UUID;
  v_result JSONB;
  v_business_type_code VARCHAR(60);
BEGIN
  SELECT business_type_code INTO v_business_type_code
  FROM org_tenants_mst
  WHERE id = p_tenant_org_id;

  -- Insert only products that don't already exist for this tenant
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
      CASE WHEN p_include_pricing THEN t.default_express_sell_price ELSE NULL END AS default_express_sell_price,
      CASE WHEN p_include_cost THEN t.product_cost ELSE NULL END AS product_cost,
      CASE WHEN p_include_pricing THEN t.min_sell_price ELSE NULL END AS min_sell_price,
      t.min_quantity,
      t.pieces_per_product,
      t.extra_days,
      t.turnaround_hh,
      t.turnaround_hh_express,
      t.multiplier_express,
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
        OR (
          btt.is_enabled = true
          AND (btt.is_default = true OR p_seed_filter = 'all')
        )
      )
      AND (
        p_seed_filter = 'all'
        OR (
          t.seed_options IS NULL
          OR t.seed_options->'required_for' IS NULL
          OR (t.seed_options->'required_for') @> to_jsonb(p_seed_filter::text)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM org_product_data_mst p
        WHERE p.tenant_org_id = p_tenant_org_id
          AND p.product_code = t.item_code
          AND p.is_active = true
      )
    ORDER BY t.seed_priority ASC
  )
  INSERT INTO org_product_data_mst (
    id,
    tenant_org_id,
    service_category_code,
    item_type_code,
    product_code,
    product_name,
    product_name2,
    hint_text,
    is_retail_item,
    product_type,
    price_type,
    product_unit,
    default_sell_price,
    default_express_sell_price,
    product_cost,
    min_sell_price,
    min_quantity,
    pieces_per_product,
    extra_days,
    turnaround_hh,
    turnaround_hh_express,
    multiplier_express,
    product_order,
    tags,
    id_sku,
    is_active,
    product_color1,
    product_color2,
    product_color3,
    product_icon,
    product_image,
    product_group1,
    product_group2,
    product_group3,
    rec_order,
    created_by,
    rec_status
  )
  SELECT
    id,
    tenant_org_id,
    service_category_code,
    item_type_code,
    item_code,
    product_name,
    product_name2,
    hint_text,
    is_retail_item,
    product_type,
    price_type,
    product_unit,
    default_sell_price,
    default_express_sell_price,
    product_cost,
    min_sell_price,
    min_quantity,
    pieces_per_product,
    extra_days,
    turnaround_hh,
    turnaround_hh_express,
    multiplier_express,
    product_order,
    tags,
    id_sku,
    true,
    product_color1,
    product_color2,
    product_color3,
    product_icon,
    product_image,
    product_group1,
    NULL,
    NULL,
    rec_order,
    'system_seed',
    1
  FROM templates_to_insert;

  GET DIAGNOSTICS v_products_created = ROW_COUNT;

  IF p_create_default_price_list AND p_include_pricing THEN
    INSERT INTO org_price_lists_mst (
      tenant_org_id,
      name,
      name2,
      description,
      price_list_type,
      is_default,
      is_active,
      created_by
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
      tenant_org_id,
      price_list_id,
      product_id,
      price,
      is_active,
      created_by
    )
    SELECT
      p_tenant_org_id,
      v_price_list_id,
      p.id,
      p.default_sell_price,
      true,
      'system_seed'
    FROM org_product_data_mst p
    WHERE p.tenant_org_id = p_tenant_org_id
      AND p.default_sell_price IS NOT NULL
      AND p.is_active = true;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'products_created', v_products_created,
    'price_list_created', p_create_default_price_list,
    'price_list_id', v_price_list_id,
    'tenant_org_id', p_tenant_org_id,
    'business_type_code', v_business_type_code,
    'seed_filter', p_seed_filter,
    'include_pricing', p_include_pricing
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION initialize_tenant_product_catalog IS 'Initialize tenant product catalog from templates; skips products that already exist (idempotent)';

COMMIT;
