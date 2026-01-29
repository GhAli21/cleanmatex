-- Migration: 0084_enhance_get_product_price_with_tax.sql
-- Description: Create enhanced function that returns full pricing breakdown including tax
-- Date: 2026-01-27
-- Feature: Pricing System - Enhanced Price Lookup

-- =====================================================
-- Enhanced Function: get_product_price_with_tax
-- =====================================================

CREATE OR REPLACE FUNCTION get_product_price_with_tax(
  p_tenant_org_id UUID,
  p_product_id UUID,
  p_price_list_type VARCHAR(50) DEFAULT 'standard',
  p_quantity INTEGER DEFAULT 1,
  p_customer_id UUID DEFAULT NULL,
  p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  base_price NUMERIC(10,3),
  discount_percent NUMERIC(5,2),
  final_price NUMERIC(10,3),
  tax_rate NUMERIC(5,4),
  tax_amount NUMERIC(10,3),
  total NUMERIC(10,3),
  price_list_id UUID,
  price_list_item_id UUID,
  source VARCHAR(20),
  price_list_name VARCHAR(255),
  quantity_tier_min INTEGER,
  quantity_tier_max INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_base_price NUMERIC(10,3);
  v_discount_percent NUMERIC(5,2) := 0;
  v_final_price NUMERIC(10,3);
  v_tax_rate NUMERIC(5,4);
  v_tax_amount NUMERIC(10,3);
  v_total NUMERIC(10,3);
  v_price_list_id UUID;
  v_price_list_item_id UUID;
  v_source VARCHAR(20) := 'product_default';
  v_price_list_name VARCHAR(255);
  v_quantity_tier_min INTEGER;
  v_quantity_tier_max INTEGER;
  v_customer_type VARCHAR(50);
  v_effective_price_list_type VARCHAR(50);
BEGIN
  -- Determine effective price list type (check customer if provided)
  v_effective_price_list_type := p_price_list_type;
  
  IF p_customer_id IS NOT NULL THEN
    -- Check customer type for B2B/VIP pricing
    SELECT type, preferences INTO v_customer_type
    FROM org_customers_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND id = p_customer_id
      AND is_active = true;
    
    IF v_customer_type = 'b2b' OR v_customer_type = 'B2B' THEN
      v_effective_price_list_type := 'b2b';
    ELSIF v_customer_type = 'vip' OR v_customer_type = 'VIP' THEN
      v_effective_price_list_type := 'vip';
    END IF;
    
    -- Check preferences for pricing_tier (overrides type)
    IF v_customer_type IS NOT NULL THEN
      -- Note: preferences is JSONB, would need JSONB extraction in real implementation
      -- For now, rely on customer type
    END IF;
  END IF;
  
  -- Get price from active price list
  SELECT 
    pli.price,
    COALESCE(pli.discount_percent, 0),
    pl.id,
    pli.id,
    pl.name,
    pli.min_quantity,
    pli.max_quantity
  INTO 
    v_base_price,
    v_discount_percent,
    v_price_list_id,
    v_price_list_item_id,
    v_price_list_name,
    v_quantity_tier_min,
    v_quantity_tier_max
  FROM org_price_list_items_dtl pli
  JOIN org_price_lists_mst pl ON pli.price_list_id = pl.id
  WHERE pli.tenant_org_id = p_tenant_org_id
    AND pli.product_id = p_product_id
    AND pli.is_active = true
    AND pl.is_active = true
    AND pl.price_list_type = v_effective_price_list_type
    AND (pl.effective_from IS NULL OR pl.effective_from <= p_effective_date)
    AND (pl.effective_to IS NULL OR pl.effective_to >= p_effective_date)
    AND pli.min_quantity <= p_quantity
    AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
  ORDER BY pl.priority DESC, pli.min_quantity DESC
  LIMIT 1;
  
  -- If no price list price found, fall back to product default price
  IF v_base_price IS NULL THEN
    SELECT 
      CASE 
        WHEN v_effective_price_list_type = 'express' THEN COALESCE(default_express_sell_price, default_sell_price)
        ELSE default_sell_price
      END
    INTO v_base_price
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND id = p_product_id
      AND is_active = true;
    
    v_source := 'product_default';
    v_discount_percent := 0;
    v_price_list_id := NULL;
    v_price_list_item_id := NULL;
    v_price_list_name := NULL;
    v_quantity_tier_min := NULL;
    v_quantity_tier_max := NULL;
  ELSE
    v_source := 'price_list';
  END IF;
  
  -- Calculate final price (after discount)
  v_final_price := v_base_price * (1 - v_discount_percent / 100);
  
  -- Get tax rate from tenant settings
  SELECT 
    COALESCE(
      (value_jsonb::text)::numeric,
      (stng_default_value_jsonb::text)::numeric,
      0.05
    )
  INTO v_tax_rate
  FROM sys_tenant_settings_cd st
  LEFT JOIN org_tenant_settings_cf ot ON 
    ot.setting_code = st.setting_code 
    AND ot.tenant_org_id = p_tenant_org_id
    AND ot.is_active = true
    AND ot.branch_id IS NULL
    AND ot.user_id IS NULL
  WHERE st.setting_code = 'TAX_RATE'
    AND st.is_active = true
  LIMIT 1;
  
  -- Default to 5% if not found
  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0.05;
  END IF;
  
  -- Calculate tax amount (on final price * quantity)
  v_tax_amount := v_final_price * p_quantity * v_tax_rate;
  
  -- Calculate total
  v_total := (v_final_price * p_quantity) + v_tax_amount;
  
  -- Return result
  RETURN QUERY SELECT
    ROUND(v_base_price, 3),
    ROUND(v_discount_percent, 2),
    ROUND(v_final_price, 3),
    ROUND(v_tax_rate, 4),
    ROUND(v_tax_amount, 3),
    ROUND(v_total, 3),
    v_price_list_id,
    v_price_list_item_id,
    v_source,
    v_price_list_name,
    v_quantity_tier_min,
    v_quantity_tier_max;
END;
$$;

COMMENT ON FUNCTION get_product_price_with_tax IS 'Get full pricing breakdown for a product including tax, discounts, and price list information';

