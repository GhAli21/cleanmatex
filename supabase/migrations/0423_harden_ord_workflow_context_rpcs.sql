-- ==================================================================
-- 0423_harden_ord_workflow_context_rpcs.sql
-- Purpose: Root-harden workflow-context RPCs so order existence + tenant
--          scope are enforced inside the functions (no extra API preflight
--          SELECT required). Metrics no longer return zeros for missing orders.
-- ==================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Flags: keep existing shape; add stable code for API mapping
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cmx_ord_order_workflow_flags(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_template_id UUID;
BEGIN
  IF p_tenant_org_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ORDER_NOT_FOUND',
      'error', 'Order not found'
    );
  END IF;

  SELECT id, workflow_template_id
    INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id
    AND tenant_org_id = p_tenant_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ORDER_NOT_FOUND',
      'error', 'Order not found'
    );
  END IF;

  v_template_id := COALESCE(
    v_order.workflow_template_id,
    (
      SELECT template_id
      FROM sys_workflow_template_cd
      WHERE template_code = 'WF_SIMPLE'
        AND is_active = true
      LIMIT 1
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'template_id', v_template_id,
    'assembly_enabled', EXISTS (
      SELECT 1
      FROM sys_workflow_template_stages
      WHERE template_id = v_template_id
        AND stage_code = 'assembly'
        AND is_active = true
    ),
    'qa_enabled', EXISTS (
      SELECT 1
      FROM sys_workflow_template_stages
      WHERE template_id = v_template_id
        AND stage_code = 'qa'
        AND is_active = true
    ),
    'packing_enabled', EXISTS (
      SELECT 1
      FROM sys_workflow_template_stages
      WHERE template_id = v_template_id
        AND stage_code = 'packing'
        AND is_active = true
    )
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_order_workflow_flags(UUID, UUID) IS
  'Workflow template flags for an order. Tenant-scoped; returns ORDER_NOT_FOUND when missing.';

-- ---------------------------------------------------------------------------
-- Metrics: reject missing orders instead of silent zero counts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cmx_ord_order_live_metrics(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items_count INTEGER;
  v_pieces_total INTEGER;
  v_pieces_scanned INTEGER;
BEGIN
  IF p_tenant_org_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ORDER_NOT_FOUND',
      'error', 'Order not found'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM org_orders_mst
    WHERE id = p_order_id
      AND tenant_org_id = p_tenant_org_id
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ORDER_NOT_FOUND',
      'error', 'Order not found'
    );
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_items_count
  FROM org_order_items_dtl
  WHERE order_id = p_order_id
    AND tenant_org_id = p_tenant_org_id;

  SELECT
    COALESCE(SUM(quantity), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN item_status = 'processed' THEN quantity ELSE 0 END), 0)::INTEGER
  INTO v_pieces_total, v_pieces_scanned
  FROM org_order_items_dtl
  WHERE order_id = p_order_id
    AND tenant_org_id = p_tenant_org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'items_count', v_items_count,
    'pieces_total', v_pieces_total,
    'pieces_scanned', v_pieces_scanned,
    'all_items_processed', v_pieces_scanned >= v_pieces_total AND v_pieces_total > 0
  );
END;
$$;

COMMENT ON FUNCTION cmx_ord_order_live_metrics(UUID, UUID) IS
  'Order item/piece metrics. Tenant-scoped; returns ORDER_NOT_FOUND when order missing. Uses quantity on org_order_items_dtl.';

GRANT EXECUTE ON FUNCTION cmx_ord_order_workflow_flags(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cmx_ord_order_live_metrics(UUID, UUID) TO authenticated;

COMMIT;
