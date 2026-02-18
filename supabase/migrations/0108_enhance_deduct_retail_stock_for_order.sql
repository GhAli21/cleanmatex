-- ==================================================================
-- 0108_enhance_deduct_retail_stock_for_order.sql
-- Purpose: Enhance deduct_retail_stock_for_order to:
--   1. Insert into org_inv_stock_by_branch when no row exists
--   2. Allow negative stock (user adjusts later)
--   3. Add optional audit/reference parameters for org_inv_stock_tr
-- Dependencies: 0103_inventory_branch_and_deduct.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- DROP OLD FUNCTION SIGNATURES
-- ==================================================================

DROP FUNCTION IF EXISTS deduct_retail_stock_for_order(UUID, UUID);
DROP FUNCTION IF EXISTS deduct_retail_stock_for_order(UUID, UUID, UUID);

-- ==================================================================
-- CREATE ENHANCED deduct_retail_stock_for_order
-- ==================================================================

CREATE OR REPLACE FUNCTION deduct_retail_stock_for_order(
  p_order_id       UUID,
  p_tenant_org_id  UUID,
  p_branch_id      UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'ORDER',
  p_reference_id   UUID DEFAULT NULL,
  p_reference_no   TEXT DEFAULT NULL,
  p_user_id        UUID DEFAULT NULL,
  p_user_name      TEXT DEFAULT NULL,
  p_user_info      TEXT DEFAULT NULL,
  p_user_agent     TEXT DEFAULT NULL,
  p_user_device    TEXT DEFAULT NULL,
  p_user_browser   TEXT DEFAULT NULL,
  p_user_os        TEXT DEFAULT NULL,
  p_user_ip        TEXT DEFAULT NULL,
  p_reason         TEXT DEFAULT 'Order sale deduction'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_qty_to_deduct DECIMAL(19,4);
  v_qty_before    DECIMAL(19,4);
  v_qty_after     DECIMAL(19,4);
  v_trans_no      VARCHAR(30);
  v_seq           INT := 0;
  v_today         VARCHAR(8);
  v_created_info  TEXT;
BEGIN
  v_today := to_char(now(), 'YYYYMMDD');

  FOR r IN (
    SELECT oi.product_id, oi.quantity, p.is_retail_item
    FROM org_order_items_dtl oi
    JOIN org_product_data_mst p ON p.id = oi.product_id AND p.tenant_org_id = oi.tenant_org_id
    WHERE oi.order_id = p_order_id
      AND oi.tenant_org_id = p_tenant_org_id
      AND oi.product_id IS NOT NULL
      AND p.is_retail_item = true
      AND p.service_category_code = 'RETAIL_ITEMS'
  ) LOOP
    v_qty_to_deduct := r.quantity;

    IF p_branch_id IS NOT NULL THEN
      -- Branch-level: ensure row exists, then deduct from org_inv_stock_by_branch
      INSERT INTO org_inv_stock_by_branch (
        tenant_org_id, product_id, branch_id,
        qty_on_hand, reorder_point, min_stock_level
      ) VALUES (
        p_tenant_org_id, r.product_id, p_branch_id,
        0, 0, 0
      )
      ON CONFLICT (tenant_org_id, product_id, branch_id) DO NOTHING;

      SELECT qty_on_hand INTO v_qty_before
      FROM org_inv_stock_by_branch
      WHERE tenant_org_id = p_tenant_org_id
        AND product_id = r.product_id
        AND branch_id = p_branch_id
      FOR UPDATE;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;

      UPDATE org_inv_stock_by_branch
      SET qty_on_hand = v_qty_after, updated_at = now()
      WHERE tenant_org_id = p_tenant_org_id
        AND product_id = r.product_id
        AND branch_id = p_branch_id;

    ELSE
      -- Legacy: deduct from org_product_data_mst.qty_on_hand
      SELECT qty_on_hand INTO v_qty_before
      FROM org_product_data_mst
      WHERE id = r.product_id
        AND tenant_org_id = p_tenant_org_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % not found', r.product_id;
      END IF;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;

      UPDATE org_product_data_mst
      SET qty_on_hand = v_qty_after, updated_at = now()
      WHERE id = r.product_id
        AND tenant_org_id = p_tenant_org_id;
    END IF;

    -- Build created_info JSON (NULL if all user fields are null)
    SELECT CASE
      WHEN p_user_info IS NULL AND p_user_agent IS NULL AND p_user_device IS NULL
           AND p_user_browser IS NULL AND p_user_os IS NULL AND p_user_ip IS NULL
      THEN NULL
      ELSE json_build_object(
        'user_info', p_user_info,
        'user_agent', p_user_agent,
        'user_device', p_user_device,
        'user_browser', p_user_browser,
        'user_os', p_user_os,
        'user_ip', p_user_ip
      )::text
    END INTO v_created_info;

    -- Insert stock transaction
    v_seq := v_seq + 1;
    v_trans_no := 'STK-' || v_today || '-' || lpad(v_seq::text, 4, '0');

    INSERT INTO org_inv_stock_tr (
      tenant_org_id, product_id, branch_id,
      transaction_no, transaction_type, quantity,
      qty_before, qty_after,
      reference_type, reference_id, reference_no,
      reason, processed_by, created_by, created_info,
      is_active, rec_status
    ) VALUES (
      p_tenant_org_id, r.product_id, p_branch_id,
      v_trans_no, 'STOCK_OUT', -v_qty_to_deduct,
      v_qty_before, v_qty_after,
      COALESCE(NULLIF(trim(p_reference_type), ''), 'ORDER'),
      COALESCE(p_reference_id, p_order_id),
      COALESCE(p_reference_no, (SELECT order_no FROM org_orders_mst WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id LIMIT 1)),
      COALESCE(NULLIF(trim(p_reason), ''), 'Order sale deduction'),
      p_user_id,
      p_user_name,
      v_created_info,
      true, 1
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION deduct_retail_stock_for_order IS
  'Deduct stock for retail items in an order. When p_branch_id provided: deduct from org_inv_stock_by_branch (inserts row if missing, allows negative). When NULL: deduct from org_product_data_mst.qty_on_hand (legacy). Accepts optional audit params for org_inv_stock_tr.';

COMMIT;
