-- ==================================================================
-- 0015_preparation_itemization.sql
-- Purpose: Preparation itemization enhancements (indexes, srno, totals, RLS)
-- Author: CleanMateX Development Team
-- Created: 2025-10-31
-- Dependencies: 0001_core_schema.sql, 0012_order_intake_enhancements.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- Indexes for org_order_items_dtl
-- ==================================================================

-- Optimize common lookups
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order
  ON org_order_items_dtl (tenant_org_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_tenant_status
  ON org_order_items_dtl (tenant_org_id, status);

CREATE INDEX IF NOT EXISTS idx_order_items_tenant_barcode
  ON org_order_items_dtl (tenant_org_id, barcode);

-- ==================================================================
-- Per-order serial number generation for order_item_srno
-- ==================================================================

-- Helper function: next serial number scoped to (tenant_org_id, order_id)
CREATE OR REPLACE FUNCTION fn_next_order_item_srno(p_tenant uuid, p_order uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_num integer;
BEGIN
  SELECT COALESCE(MAX((CASE WHEN order_item_srno ~ '^\\d+$' THEN order_item_srno::int ELSE 0 END)), 0) + 1
    INTO v_next_num
  FROM org_order_items_dtl
  WHERE tenant_org_id = p_tenant
    AND order_id = p_order;

  -- Return zero-padded 3+ width (e.g., 001, 012, 120)
  RETURN lpad(v_next_num::text, 3, '0');
END;
$$;

-- BEFORE INSERT trigger to set order_item_srno if missing
CREATE OR REPLACE FUNCTION trg_set_order_item_srno()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_item_srno IS NULL OR NEW.order_item_srno = '' THEN
    NEW.order_item_srno := fn_next_order_item_srno(NEW.tenant_org_id, NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'before_ins_set_order_item_srno'
  ) THEN
    CREATE TRIGGER before_ins_set_order_item_srno
    BEFORE INSERT ON org_order_items_dtl
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_order_item_srno();
  END IF;
END $$;

-- ==================================================================
-- Totals maintenance: keep org_orders_mst aggregates in sync
-- ==================================================================

CREATE OR REPLACE FUNCTION fn_recalc_order_totals(p_tenant uuid, p_order uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_items integer := 0;
  v_subtotal numeric(10,3) := 0;
  v_discount numeric(10,3) := 0;
  v_tax numeric(10,3) := 0;
BEGIN
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(total_price), 0)
    INTO v_total_items, v_subtotal
  FROM org_order_items_dtl
  WHERE tenant_org_id = p_tenant
    AND order_id = p_order;

  -- Get existing discount/tax from order; preserve values
  SELECT COALESCE(discount, 0), COALESCE(tax, 0)
    INTO v_discount, v_tax
  FROM org_orders_mst
  WHERE tenant_org_id = p_tenant AND id = p_order;

  UPDATE org_orders_mst
  SET total_items = v_total_items,
      subtotal    = v_subtotal,
      total       = (v_subtotal - v_discount + v_tax),
      updated_at  = NOW()
  WHERE tenant_org_id = p_tenant AND id = p_order;
END;
$$;

CREATE OR REPLACE FUNCTION trg_after_item_change_recalc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant uuid;
  v_order uuid;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_tenant := NEW.tenant_org_id;
    v_order  := NEW.order_id;
  ELSE
    v_tenant := OLD.tenant_org_id;
    v_order  := OLD.order_id;
  END IF;

  PERFORM fn_recalc_order_totals(v_tenant, v_order);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_ins_items_recalc') THEN
    CREATE TRIGGER after_ins_items_recalc
    AFTER INSERT ON org_order_items_dtl
    FOR EACH ROW
    EXECUTE FUNCTION trg_after_item_change_recalc();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_upd_items_recalc') THEN
    CREATE TRIGGER after_upd_items_recalc
    AFTER UPDATE ON org_order_items_dtl
    FOR EACH ROW
    EXECUTE FUNCTION trg_after_item_change_recalc();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_del_items_recalc') THEN
    CREATE TRIGGER after_del_items_recalc
    AFTER DELETE ON org_order_items_dtl
    FOR EACH ROW
    EXECUTE FUNCTION trg_after_item_change_recalc();
  END IF;
END $$;

-- ==================================================================
-- RLS (defense-in-depth) – ensure enabled and tenant policies exist
-- ==================================================================

-- Enable RLS if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'org_order_items_dtl' AND rowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE org_order_items_dtl ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Tenant isolation policy for org_order_items_dtl
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'org_order_items_dtl' AND policyname = 'tenant_isolation_all'
  ) THEN
    EXECUTE 'CREATE POLICY tenant_isolation_all ON org_order_items_dtl
      FOR ALL
      USING (tenant_org_id = (auth.jwt() ->> ''tenant_org_id'')::uuid)
      WITH CHECK (tenant_org_id = (auth.jwt() ->> ''tenant_org_id'')::uuid)';
  END IF;
END $$;

COMMIT;

-- ==================================================================
-- END 0015_preparation_itemization.sql
-- ==================================================================


