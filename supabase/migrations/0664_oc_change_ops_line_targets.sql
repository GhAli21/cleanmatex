-- =============================================================================
-- 0664_oc_change_ops_line_targets.sql
--
-- Purpose: let the Order Change history store the line controls of Order Edit
-- (Line-Level Money Snapshot P6-02b/c). Apply records each applied operation in
-- org_order_change_ops_dtl; its two CHECK constraints still listed only the V1
-- catalog, so every Apply of these three operations was refused:
--   - CHANGE_SERVICE_SPEED / ITEM: a per-line speed (the ORDER target is kept).
--   - CHANGE_ITEM_PRICE / ITEM: a line's cashier price (was missing from the catalog check).
--   - CHANGE_DISCOUNT / ITEM: a line's cashier discount (was missing from the catalog check).
-- Each is stored like the other line operations: target ITEM, order_item_id set,
-- no piece and no preference. Rows already stored are unaffected (all satisfy the
-- wider checks). Found by the real-database Edit parity proof (P6-02f).
-- =============================================================================

BEGIN;

-- Dropped and recreated in one transaction: Postgres cannot alter a CHECK in place.
ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_catalog_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_catalog_ck CHECK (
    operation_code IN (
      'ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE',
      'ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE', 'CHANGE_PRIORITY',
      'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY', 'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT',
      'CHANGE_UNLISTED', 'CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT'
    )
    AND target_type IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE')
  );

ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_target_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_target_ck CHECK (
    (operation_code IN ('ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY',
        'CHANGE_SERVICE_SPEED', 'CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT')
      AND target_type = 'ITEM' AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NULL AND order_preference_id IS NULL)
    OR (operation_code IN ('ADD_PIECE', 'REMOVE_PIECE')
      AND target_type = 'PIECE' AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NOT NULL AND order_preference_id IS NULL)
    OR (operation_code IN ('ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE')
      AND target_type = 'PREFERENCE' AND order_preference_id IS NOT NULL
      AND (order_item_piece_id IS NULL OR order_item_id IS NOT NULL))
    OR (operation_code IN ('CHANGE_PRIORITY', 'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY',
        'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT', 'CHANGE_UNLISTED')
      AND target_type = 'ORDER' AND order_item_id IS NULL
      AND order_item_piece_id IS NULL AND order_preference_id IS NULL)
  );

COMMENT ON CONSTRAINT oc_op_catalog_ck ON public.org_order_change_ops_dtl IS
  'Limits applied operations to the V1 catalog, the line price and line discount of Order Edit (P6-02c), and CHANGE_UNLISTED, which records a screen edit that has no policy operation.';
COMMENT ON CONSTRAINT oc_op_target_ck ON public.org_order_change_ops_dtl IS
  'Binds each operation to its affected-fact identity. CHANGE_SERVICE_SPEED is an order row or a line row (P6-02b); CHANGE_ITEM_PRICE and CHANGE_DISCOUNT are line rows. CHANGE_UNLISTED is stored as an order audit row; its field, value, and screen target stay in after_values.';

COMMIT;
