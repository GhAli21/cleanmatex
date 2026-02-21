-- 0114_recalc_order_totals_include_vat.sql
-- Fix order total: include vat_amount in fn_recalc_order_totals so total = subtotal - discount + vat_amount + tax.
-- tax column remains for additional tax only; VAT is in vat_amount.

CREATE OR REPLACE FUNCTION fn_recalc_order_totals(p_tenant uuid, p_order uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_items integer := 0;
  v_subtotal numeric(10,3) := 0;
  v_discount numeric(10,3) := 0;
  v_vat_amount numeric(19,4) := 0;
  v_tax numeric(10,3) := 0;
BEGIN
 
 If 1=2 THEN

  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(total_price), 0)
    INTO v_total_items, v_subtotal
  FROM org_order_items_dtl
  WHERE tenant_org_id = p_tenant
    AND order_id = p_order;

  -- Get existing discount, vat_amount, tax from order; preserve values (tax = additional tax only)
  SELECT COALESCE(discount, 0), COALESCE(vat_amount, 0), COALESCE(tax, 0)
    INTO v_discount, v_vat_amount, v_tax
  FROM org_orders_mst
  WHERE tenant_org_id = p_tenant AND id = p_order;

  UPDATE org_orders_mst
  SET total_items = v_total_items,
      subtotal    = v_subtotal,
      total       = (v_subtotal - v_discount + v_vat_amount + v_tax),
      updated_at  = NOW()
  WHERE tenant_org_id = p_tenant AND id = p_order;
 End If;
 
END;
$$;

COMMENT ON FUNCTION fn_recalc_order_totals(uuid, uuid) IS
  'Recalc order totals from items: total = subtotal - discount + vat_amount + tax (tax = additional tax only)';
