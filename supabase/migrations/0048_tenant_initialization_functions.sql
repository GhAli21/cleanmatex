-- ==================================================================
-- 0048_tenant_initialization_functions.sql
-- Purpose: Create tenant product catalog initialization functions
-- Author: CleanMateX Development Team
-- Created: 2025-01-26
-- PRD: Product Catalog System Redesign
-- Dependencies: 0045_catalog_system_2027_architecture.sql, 0046_seed_catalog_reference_data.sql
-- ==================================================================
-- This migration creates:
-- 1. initialize_tenant_product_catalog() - Initialize tenant catalog from templates
-- 2. reseed_missing_products() - Restore missing/deleted products
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION 1: initialize_tenant_product_catalog()
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
BEGIN
  -- Copy templates to tenant products
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
    service_category_code,
    item_type_code,
    template_code,  -- Use template_code as product_code
    name,
    name2,
    hint_text,
    is_retail_item,
    1,  -- Default product_type
    price_type,
    product_unit,
    CASE WHEN p_include_pricing THEN default_sell_price ELSE NULL END,
    CASE WHEN p_include_pricing THEN default_express_sell_price ELSE NULL END,
    CASE WHEN p_include_cost THEN product_cost ELSE NULL END,
    CASE WHEN p_include_pricing THEN min_sell_price ELSE NULL END,
    min_quantity,
    pieces_per_product,
    extra_days,
    turnaround_hh,
    turnaround_hh_express,
    multiplier_express,
    rec_order,
    tags,
    id_sku,
    true,  -- is_active
    product_color1,
    product_color2,
    product_color3,
    product_icon,
    product_image,
    item_type_code,  -- Map to product_group1 for backward compatibility
    NULL,
    NULL,
    seed_priority,
    'system_seed',
    1
  FROM sys_service_prod_templates_cd
  WHERE is_to_seed = true
    AND is_active = true
    AND (
      p_seed_filter = 'all'
      OR (
        seed_options IS NULL
        OR seed_options->>'required_for' IS NULL
        OR seed_options->>'required_for' ? p_seed_filter
      )
    )
  ORDER BY seed_priority ASC;

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
    'seed_filter', p_seed_filter,
    'include_pricing', p_include_pricing
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION initialize_tenant_product_catalog IS 'Initialize tenant product catalog from templates with configurable options';

-- ==================================================================
-- FUNCTION 2: reseed_missing_products()
-- ==================================================================

CREATE OR REPLACE FUNCTION reseed_missing_products(
  p_tenant_org_id UUID,
  p_include_pricing BOOLEAN DEFAULT false,
  p_only_missing BOOLEAN DEFAULT true,  -- Only add missing products (don't overwrite existing)
  p_template_codes VARCHAR(50)[] DEFAULT NULL  -- Specific template codes to reseed (NULL = all)
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
BEGIN
  -- Get count of templates to process
  SELECT COUNT(*) INTO v_templates_found
  FROM sys_service_prod_templates_cd
  WHERE is_to_seed = true
    AND is_active = true
    AND (p_template_codes IS NULL OR template_code = ANY(p_template_codes));

  -- Process each template
  FOR v_template IN
    SELECT *
    FROM sys_service_prod_templates_cd
    WHERE is_to_seed = true
      AND is_active = true
      AND (p_template_codes IS NULL OR template_code = ANY(p_template_codes))
    ORDER BY seed_priority ASC
  LOOP
    -- Check if product already exists for this tenant
    IF EXISTS (
      SELECT 1 FROM org_product_data_mst
      WHERE tenant_org_id = p_tenant_org_id
        AND product_code = v_template.template_code
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
      v_template.template_code,
      v_template.name,
      v_template.name2,
      v_template.hint_text,
      v_template.is_retail_item,
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
      v_template.tags,
      v_template.id_sku,
      true,
      v_template.product_color1,
      v_template.product_color2,
      v_template.product_color3,
      v_template.product_icon,
      v_template.product_image,
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
    'tenant_org_id', p_tenant_org_id
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION reseed_missing_products IS 'Restore missing or deleted products from templates for a specific tenant';

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================
