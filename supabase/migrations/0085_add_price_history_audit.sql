-- Migration: 0085_add_price_history_audit.sql
-- Description: Create table and triggers to track price changes
-- Date: 2026-01-27
-- Feature: Pricing System - Price History & Audit

-- =====================================================
-- Create Price History Audit Table
-- =====================================================

CREATE TABLE IF NOT EXISTS org_price_history_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  
  -- What changed
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('price_list_item', 'product_default')),
  entity_id UUID NOT NULL,
  price_list_id UUID,
  product_id UUID,
  
  -- Price change details
  old_price NUMERIC(10,3),
  new_price NUMERIC(10,3),
  old_discount_percent NUMERIC(5,2),
  new_discount_percent NUMERIC(5,2),
  
  -- Context
  change_reason TEXT,
  effective_from DATE,
  effective_to DATE,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  
  -- Foreign keys
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (price_list_id) REFERENCES org_price_lists_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, tenant_org_id) REFERENCES org_product_data_mst(id, tenant_org_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_history_tenant ON org_price_history_audit(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_price_history_entity ON org_price_history_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON org_price_history_audit(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_price_list ON org_price_history_audit(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON org_price_history_audit(created_at DESC);

COMMENT ON TABLE org_price_history_audit IS 'Audit trail for price changes in price lists and product defaults';
COMMENT ON COLUMN org_price_history_audit.entity_type IS 'Type of entity: price_list_item or product_default';
COMMENT ON COLUMN org_price_history_audit.entity_id IS 'ID of the changed entity (price_list_item_id or product_id)';

-- =====================================================
-- Trigger Function: Log Price List Item Changes
-- =====================================================

CREATE OR REPLACE FUNCTION log_price_list_item_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if price or discount actually changed
  IF (OLD.price IS DISTINCT FROM NEW.price) OR 
     (OLD.discount_percent IS DISTINCT FROM NEW.discount_percent) THEN
    
    INSERT INTO org_price_history_audit (
      tenant_org_id,
      entity_type,
      entity_id,
      price_list_id,
      product_id,
      old_price,
      new_price,
      old_discount_percent,
      new_discount_percent,
      created_by,
      created_info
    ) VALUES (
      NEW.tenant_org_id,
      'price_list_item',
      NEW.id,
      NEW.price_list_id,
      NEW.product_id,
      OLD.price,
      NEW.price,
      OLD.discount_percent,
      NEW.discount_percent,
      NEW.updated_by,
      NEW.updated_info
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger Function: Log Product Default Price Changes
-- =====================================================

CREATE OR REPLACE FUNCTION log_product_default_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if default prices actually changed
  IF (OLD.default_sell_price IS DISTINCT FROM NEW.default_sell_price) OR 
     (OLD.default_express_sell_price IS DISTINCT FROM NEW.default_express_sell_price) THEN
    
    INSERT INTO org_price_history_audit (
      tenant_org_id,
      entity_type,
      entity_id,
      product_id,
      old_price,
      new_price,
      created_by,
      created_info
    ) VALUES (
      NEW.tenant_org_id,
      'product_default',
      NEW.id,
      NEW.id,
      OLD.default_sell_price,
      NEW.default_sell_price,
      NEW.updated_by,
      NEW.updated_info
    );
    
    -- Also log express price change if different
    IF (OLD.default_express_sell_price IS DISTINCT FROM NEW.default_express_sell_price) THEN
      INSERT INTO org_price_history_audit (
        tenant_org_id,
        entity_type,
        entity_id,
        product_id,
        old_price,
        new_price,
        created_by,
        created_info
      ) VALUES (
        NEW.tenant_org_id,
        'product_default',
        NEW.id || '_express',
        NEW.id,
        OLD.default_express_sell_price,
        NEW.default_express_sell_price,
        NEW.updated_by,
        NEW.updated_info || ' (express price)'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Create Triggers
-- =====================================================

-- Trigger on price list items
DROP TRIGGER IF EXISTS trigger_log_price_list_item_change ON org_price_list_items_dtl;
CREATE TRIGGER trigger_log_price_list_item_change
  AFTER UPDATE ON org_price_list_items_dtl
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price OR OLD.discount_percent IS DISTINCT FROM NEW.discount_percent)
  EXECUTE FUNCTION log_price_list_item_change();

-- Trigger on product default prices
DROP TRIGGER IF EXISTS trigger_log_product_default_price_change ON org_product_data_mst;
CREATE TRIGGER trigger_log_product_default_price_change
  AFTER UPDATE ON org_product_data_mst
  FOR EACH ROW
  WHEN (OLD.default_sell_price IS DISTINCT FROM NEW.default_sell_price OR 
        OLD.default_express_sell_price IS DISTINCT FROM NEW.default_express_sell_price)
  EXECUTE FUNCTION log_product_default_price_change();

COMMENT ON FUNCTION log_price_list_item_change IS 'Logs price changes in price list items';
COMMENT ON FUNCTION log_product_default_price_change IS 'Logs price changes in product default prices';

