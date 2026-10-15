-- Records a screen edit whose operation code is not in the Edit Policy.
-- Preview and Apply allow it. The row is an order-level audit fact; the field and value stay in after_values.
-- This does not add the code to the policy catalog.

BEGIN;

ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_catalog_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_catalog_ck CHECK (
    operation_code IN (
      'ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE',
      'ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE', 'CHANGE_PRIORITY',
      'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY', 'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT',
      'CHANGE_UNLISTED'
    )
    AND target_type IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE')
  );

ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_target_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_target_ck CHECK (
    (operation_code IN ('ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY')
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
  'Limits applied operations to the V1 catalog plus CHANGE_UNLISTED, which records a screen edit that has no policy operation.';
COMMENT ON CONSTRAINT oc_op_target_ck ON public.org_order_change_ops_dtl IS
  'Binds each operation to its affected-fact identity. CHANGE_UNLISTED is stored as an order audit row; its field, value, and screen target stay in after_values.';

COMMIT;
