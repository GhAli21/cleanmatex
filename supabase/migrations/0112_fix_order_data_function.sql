-- ==================================================================
-- Migration: 0112_fix_order_data_function
-- Purpose: Fix order data function — sync order item pieces to quantity
--          Returns full details for modal UI (overall, steps with summary, details, item_results)
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION: fix_order_data
-- ==================================================================

CREATE OR REPLACE FUNCTION fix_order_data(
  p_tenant_org_id UUID DEFAULT NULL,
  p_steps TEXT[] DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{"overall": "success", "steps": []}'::JSONB;
  v_steps_out JSONB := '[]'::JSONB;
  v_overall TEXT := 'success';
  v_run_complete_pieces BOOLEAN := false;

  -- complete_order_item_pieces step
  r_oi RECORD;
  v_piece_count INTEGER;
  v_max_seq INTEGER;
  v_to_add INTEGER;
  v_pieces_added INTEGER := 0;
  v_pieces_removed INTEGER := 0;
  v_items_adjusted INTEGER := 0;
  v_item_results JSONB := '[]'::JSONB;
  v_step_summary TEXT;
  v_step_details JSONB;
  v_price_per_piece NUMERIC(19,4);
  v_seq INTEGER;
  v_step_result JSONB;
  v_err_msg TEXT;
BEGIN
  -- Determine which steps to run (NULL = all; else only listed)
  v_run_complete_pieces := (p_steps IS NULL OR 'complete_order_item_pieces' = ANY(p_steps));

  IF v_run_complete_pieces THEN
    -- Step: complete_order_item_pieces
    v_pieces_added := 0;
    v_pieces_removed := 0;
    v_items_adjusted := 0;
    v_item_results := '[]'::JSONB;
    v_err_msg := NULL;

    BEGIN
      FOR r_oi IN
        SELECT oi.id AS order_item_id,
               oi.order_id,
               oi.tenant_org_id,
               COALESCE(oi.order_item_srno, '') AS order_item_srno,
               oi.quantity,
               oi.total_price,
               oi.service_category_code,
               oi.product_id,
               (SELECT COUNT(*) FROM org_order_item_pieces_dtl p
                WHERE p.order_item_id = oi.id) AS piece_count,
               (SELECT COALESCE(MAX(p.piece_seq), 0) FROM org_order_item_pieces_dtl p
                WHERE p.order_item_id = oi.id) AS max_seq
        FROM org_order_items_dtl oi
        WHERE oi.tenant_org_id = COALESCE(p_tenant_org_id, oi.tenant_org_id)
          AND (p_order_id IS NULL OR oi.order_id = p_order_id)
          AND oi.quantity IS NOT NULL
          AND oi.quantity > 0
      LOOP
        v_piece_count := r_oi.piece_count;
        v_max_seq := r_oi.max_seq;

        IF v_piece_count < r_oi.quantity THEN
          -- Add missing pieces
          v_to_add := r_oi.quantity - v_piece_count;
          v_price_per_piece := r_oi.total_price / NULLIF(r_oi.quantity, 0);
          FOR v_seq IN (v_max_seq + 1)..r_oi.quantity LOOP
            INSERT INTO org_order_item_pieces_dtl (
              tenant_org_id, order_id, order_item_id, piece_seq,
              service_category_code, product_id, scan_state, quantity,
              price_per_unit, total_price, piece_status, is_ready, is_rejected
            ) VALUES (
              r_oi.tenant_org_id, r_oi.order_id, r_oi.order_item_id, v_seq,
              r_oi.service_category_code, r_oi.product_id, 'expected', 1,
              v_price_per_piece, v_price_per_piece, 'processing', false, false
            );
          END LOOP;
          v_pieces_added := v_pieces_added + v_to_add;
          v_items_adjusted := v_items_adjusted + 1;
          v_item_results := v_item_results || jsonb_build_array(jsonb_build_object(
            'order_item_id', r_oi.order_item_id,
            'order_item_srno', r_oi.order_item_srno,
            'action', 'added_pieces',
            'count', v_to_add
          ));
        ELSIF v_piece_count > r_oi.quantity THEN
          -- Remove excess pieces (keep piece_seq 1..quantity)
          DELETE FROM org_order_item_pieces_dtl
          WHERE order_item_id = r_oi.order_item_id
            AND piece_seq > r_oi.quantity;
          v_to_add := v_piece_count - r_oi.quantity;
          v_pieces_removed := v_pieces_removed + v_to_add;
          v_items_adjusted := v_items_adjusted + 1;
          v_item_results := v_item_results || jsonb_build_array(jsonb_build_object(
            'order_item_id', r_oi.order_item_id,
            'order_item_srno', r_oi.order_item_srno,
            'action', 'removed_pieces',
            'count', v_to_add
          ));
        END IF;
      END LOOP;

      IF v_items_adjusted = 0 AND v_pieces_added = 0 AND v_pieces_removed = 0 THEN
        v_step_summary := 'No changes needed.';
      ELSE
        v_step_summary := v_items_adjusted || ' items adjusted. ' ||
          v_pieces_added || ' pieces added, ' || v_pieces_removed || ' removed.';
      END IF;

      v_step_details := jsonb_build_object(
        'items_adjusted', v_items_adjusted,
        'pieces_added', v_pieces_added,
        'pieces_removed', v_pieces_removed,
        'item_results', v_item_results
      );
      v_step_result := jsonb_build_object(
        'step_id', 'complete_order_item_pieces',
        'status', 'success',
        'summary', v_step_summary,
        'details', v_step_details,
        'error_message', NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_err_msg := SQLERRM;
      v_overall := 'error';
      v_step_result := jsonb_build_object(
        'step_id', 'complete_order_item_pieces',
        'status', 'error',
        'summary', NULL,
        'details', NULL,
        'error_message', v_err_msg
      );
    END;

    v_steps_out := v_steps_out || v_step_result;
  END IF;

  v_result := jsonb_build_object(
    'overall', v_overall,
    'steps', v_steps_out
  );
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fix_order_data(UUID, TEXT[], UUID) IS
  'Fix order data: sync order item pieces to quantity (complete_order_item_pieces). Returns full details for UI: overall, steps[] with step_id, status, summary, details (counts + item_results), error_message.';

GRANT EXECUTE ON FUNCTION fix_order_data(UUID, TEXT[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fix_order_data(UUID, TEXT[], UUID) TO authenticated;

COMMIT;
