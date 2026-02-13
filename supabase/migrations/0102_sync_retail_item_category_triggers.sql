-- ==================================================================
-- 0102_sync_retail_item_category_triggers.sql
-- Purpose: Enforce consistency between service_category_code and is_retail_item
--          on org_product_data_mst and sys_service_prod_templates_cd
-- Dependencies: 0001_core_schema.sql, 0045_catalog_system_2027_architecture.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: CREATE SYNC FUNCTION
-- ==================================================================

CREATE OR REPLACE FUNCTION sync_retail_item_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 2: is_retail_item=true -> service_category_code='RETAIL_ITEMS'
  IF NEW.is_retail_item = true THEN
    NEW.service_category_code := 'RETAIL_ITEMS';
  END IF;

  -- Rule 1: service_category_code drives is_retail_item
  IF NEW.service_category_code = 'RETAIL_ITEMS' THEN
    NEW.is_retail_item := true;
  ELSE
    NEW.is_retail_item := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_retail_item_category IS 'Syncs service_category_code and is_retail_item: RETAIL_ITEMS<->true, else false';

-- ==================================================================
-- PART 2: TRIGGERS ON org_product_data_mst
-- ==================================================================

DROP TRIGGER IF EXISTS trigger_sync_retail_item_category_prod ON org_product_data_mst;
CREATE TRIGGER trigger_sync_retail_item_category_prod
  BEFORE INSERT OR UPDATE ON org_product_data_mst
  FOR EACH ROW
  EXECUTE FUNCTION sync_retail_item_category();

-- ==================================================================
-- PART 3: TRIGGERS ON sys_service_prod_templates_cd
-- ==================================================================

DROP TRIGGER IF EXISTS trigger_sync_retail_item_category_tpl ON sys_service_prod_templates_cd;
CREATE TRIGGER trigger_sync_retail_item_category_tpl
  BEFORE INSERT OR UPDATE ON sys_service_prod_templates_cd
  FOR EACH ROW
  EXECUTE FUNCTION sync_retail_item_category();

COMMIT;
