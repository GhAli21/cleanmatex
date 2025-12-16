-- ==================================================================
-- 0057_update_tenant_init_functions_business_types.sql
-- Purpose: Update tenant initialization functions to support business type filtering
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- Dependencies: 0056_catalog_redesign_business_types.sql
-- ==================================================================
-- This migration updates:
-- 1. initialize_tenant_product_catalog() - Filter by business_type_code
-- 2. reseed_missing_products() - Filter by business_type_code
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION 1: initialize_tenant_product_catalog() - UPDATED
-- ==================================================================

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
  -- Get tenant's business type code
  SELECT business_type_code INTO v_business_type_code
  FROM org_tenants_mst
  WHERE id = p_tenant_org_id;

  -- Copy templates to tenant products
  -- Filter by business type if tenant has one assigned
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
    gen_random_uuid(),
    p_tenant_org_id,
    t.service_category_code,
    t.item_type_code,
    t.item_code,  -- Use item_code instead of template_code
    COALESCE(t.name, i.item_name) AS product_name,  -- Prefer template name, fallback to item name
    COALESCE(t.name2, i.item_name2) AS product_name2,
    COALESCE(t.hint_text, i.hint_text) AS hint_text,
    COALESCE(t.is_retail_item, i.is_retail_item) AS is_retail_item,
    1,  -- Default product_type
    t.price_type,
    t.product_unit,
    CASE WHEN p_include_pricing THEN t.default_sell_price ELSE NULL END,
    CASE WHEN p_include_pricing THEN t.default_express_sell_price ELSE NULL END,
    CASE WHEN p_include_cost THEN t.product_cost ELSE NULL END,
    CASE WHEN p_include_pricing THEN t.min_sell_price ELSE NULL END,
    t.min_quantity,
    t.pieces_per_product,
    t.extra_days,
    t.turnaround_hh,
    t.turnaround_hh_express,
    t.multiplier_express,
    t.rec_order,
    COALESCE(t.tags, i.tags) AS tags,
    COALESCE(t.id_sku, i.id_sku) AS id_sku,
    true,  -- is_active
    COALESCE(t.product_color1, i.item_color1) AS product_color1,
    COALESCE(t.product_color2, i.item_color2) AS product_color2,
    COALESCE(t.product_color3, i.item_color3) AS product_color3,
    COALESCE(t.product_icon, i.item_icon) AS product_icon,
    COALESCE(t.product_image, i.item_image) AS product_image,
    t.item_type_code,  -- Map to product_group1 for backward compatibility
    NULL,
    NULL,
    t.seed_priority,
    'system_seed',
    1
  FROM sys_service_prod_templates_cd t
  INNER JOIN sys_items_data_list_cd i ON t.item_code = i.item_code
  LEFT JOIN sys_business_type_template_cf btt ON 
    t.item_code = btt.item_code 
    AND t.service_category_code = btt.service_category_code
    AND btt.business_type_code = v_business_type_code
  WHERE t.is_to_seed = true
    AND t.is_active = true
    AND (
      -- If tenant has business type, filter by it
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
        OR t.seed_options->>'required_for' IS NULL
        OR t.seed_options->>'required_for' ? p_seed_filter
      )
    )
  ORDER BY t.seed_priority ASC;

  GET DIAGNOSTICS v_products_created = ROW_COUNT;

  -- Optionally create default price list
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

    -- Copy prices from products to price list
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

  -- Build result
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

COMMENT ON FUNCTION initialize_tenant_product_catalog IS 'Initialize tenant product catalog from templates filtered by business type';

-- ==================================================================
-- FUNCTION 2: reseed_missing_products() - UPDATED
-- ==================================================================

-- Drop the old function first to allow parameter name changes
DROP FUNCTION IF EXISTS reseed_missing_products(UUID, BOOLEAN, BOOLEAN, VARCHAR(50)[]);
DROP FUNCTION IF EXISTS reseed_missing_products(UUID, BOOLEAN, BOOLEAN, VARCHAR(60)[]);

CREATE FUNCTION reseed_missing_products(
  p_tenant_org_id UUID,
  p_include_pricing BOOLEAN DEFAULT false,
  p_only_missing BOOLEAN DEFAULT true,  -- Only add missing products (don't overwrite existing)
  p_item_codes VARCHAR(60)[] DEFAULT NULL  -- Specific item codes to reseed (NULL = all)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_products_added INTEGER := 0;
  v_templates_found INTEGER := 0;
  v_already_exists INTEGER := 0;
  v_result JSONB;
  v_template RECORD;
  v_business_type_code VARCHAR(60);
BEGIN
  -- Get tenant's business type code
  SELECT business_type_code INTO v_business_type_code
  FROM org_tenants_mst
  WHERE id = p_tenant_org_id;

  -- Get count of templates to process
  SELECT COUNT(*) INTO v_templates_found
  FROM sys_service_prod_templates_cd t
  LEFT JOIN sys_business_type_template_cf btt ON 
    t.item_code = btt.item_code 
    AND t.service_category_code = btt.service_category_code
    AND btt.business_type_code = v_business_type_code
  WHERE t.is_to_seed = true
    AND t.is_active = true
    AND (
      p_item_codes IS NULL 
      OR t.item_code = ANY(p_item_codes)
    )
    AND (
      -- If tenant has business type, filter by it
      v_business_type_code IS NULL
      OR btt.is_enabled = true
    );

  -- Process each template
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
      AND (
        p_item_codes IS NULL 
        OR t.item_code = ANY(p_item_codes)
      )
      AND (
        -- If tenant has business type, filter by it
        v_business_type_code IS NULL
        OR btt.is_enabled = true
      )
    ORDER BY t.seed_priority ASC
  LOOP
    -- Check if product already exists for this tenant
    IF EXISTS (
      SELECT 1 FROM org_product_data_mst
      WHERE tenant_org_id = p_tenant_org_id
        AND product_code = v_template.item_code
        AND (p_only_missing = false OR is_active = true)  -- Skip if only_missing and exists
    ) THEN
      v_already_exists := v_already_exists + 1;
      CONTINUE;  -- Skip this template
    END IF;

    -- Insert missing product
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
      rec_order,
      created_by,
      rec_status
    ) VALUES (
      gen_random_uuid(),
      p_tenant_org_id,
      v_template.service_category_code,
      v_template.item_type_code,
      v_template.item_code,  -- Use item_code instead of template_code
      COALESCE(v_template.name, v_template.item_name),
      COALESCE(v_template.name2, v_template.item_name2),
      COALESCE(v_template.hint_text, v_template.item_hint_text),
      COALESCE(v_template.is_retail_item, v_template.item_is_retail_item),
      1,
      v_template.price_type,
      v_template.product_unit,
      CASE WHEN p_include_pricing THEN v_template.default_sell_price ELSE NULL END,
      CASE WHEN p_include_pricing THEN v_template.default_express_sell_price ELSE NULL END,
      NULL,  -- Don't include cost on reseed
      CASE WHEN p_include_pricing THEN v_template.min_sell_price ELSE NULL END,
      v_template.min_quantity,
      v_template.pieces_per_product,
      v_template.extra_days,
      v_template.turnaround_hh,
      v_template.turnaround_hh_express,
      v_template.multiplier_express,
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
    );

    v_products_added := v_products_added + 1;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'templates_found', v_templates_found,
    'products_added', v_products_added,
    'already_exists', v_already_exists,
    'tenant_org_id', p_tenant_org_id,
    'business_type_code', v_business_type_code
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION reseed_missing_products IS 'Restore missing or deleted products from templates filtered by business type';

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================

