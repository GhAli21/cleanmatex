-- Migration: 0405_fix_cmx_ord_order_live_metrics_qty
-- Purpose: Fix cmx_ord_order_live_metrics — column `qty` does not exist on
--          org_order_items_dtl (correct column is `quantity`). The broken RPC
--          caused /api/v1/orders/[id]/workflow-context to return 500.
-- Date: 2026-07-17

BEGIN;

CREATE OR REPLACE FUNCTION cmx_ord_order_live_metrics(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_items_count INTEGER;
  v_pieces_total INTEGER;
  v_pieces_scanned INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_items_count
  FROM org_order_items_dtl
  WHERE order_id = p_order_id
    AND tenant_org_id = p_tenant_org_id;

  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(CASE WHEN item_status = 'processed' THEN quantity ELSE 0 END), 0)
  INTO v_pieces_total, v_pieces_scanned
  FROM org_order_items_dtl
  WHERE order_id = p_order_id
    AND tenant_org_id = p_tenant_org_id;

  RETURN jsonb_build_object(
    'items_count', v_items_count,
    'pieces_total', v_pieces_total,
    'pieces_scanned', v_pieces_scanned,
    'all_items_processed', v_pieces_scanned >= v_pieces_total
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION cmx_ord_order_live_metrics(UUID, UUID) IS
  'Returns simple order metrics (items/pieces). Uses quantity column on org_order_items_dtl.';

GRANT EXECUTE ON FUNCTION cmx_ord_order_live_metrics(UUID, UUID) TO authenticated;

COMMIT;
