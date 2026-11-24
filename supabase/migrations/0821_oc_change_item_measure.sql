-- =============================================================================
-- 0821_oc_change_item_measure.sql
--
-- Purpose: let Order Edit change the measure of a measured line (Measured Pricing
-- + UoM, P5): CHANGE_ITEM_MEASURE / ITEM sets what was measured (kg, m, L, h, or
-- length x width); the server resolves the billed quantity and re-prices the line.
-- Adding a measured product to an order in Edit (ADD_ITEM) carries its measure in
-- the operation payload and needs no new pair.
--
-- Three catalogs must know the new operation or Apply refuses it:
--   - sys_oc_order_edit_ops_cd / sys_oc_order_edit_op_tgt_cd: the reviewed operation/target pairs
--     (ITEM = the whole line; PIECE = one piece of the line, stored like the other piece rows).
--   - org_order_change_ops_dtl CHECKs oc_op_catalog_ck and oc_op_target_ck: the history
--     rows an applied operation is recorded in (line operation: target ITEM, item set,
--     no piece, no preference). Rows already stored satisfy the wider checks.
--
-- Registering a pair supplies no writer: the PIECE pair is answered OPERATION_NOT_AVAILABLE
-- until piece-level measures are built (see Measured_Pricing RESUME, P5).
--
-- Policy effect: a live pair with no rule is refused at runtime
-- (CAPABILITY_POLICY_BINDING_MISSING), so the control stays closed until HQ (the
-- SaaS Backoffice) adds a rule for each CHANGE_ITEM_MEASURE pair to a new draft version
-- of each Edit policy and publishes it. Published policy rules are immutable, so this
-- migration seeds no rules; 0637 and 0662 added their pairs the same way.
-- =============================================================================

BEGIN;

INSERT INTO public.sys_oc_order_edit_ops_cd
  (operation_code, name, name2, description, description2, is_system, created_info, is_active, rec_status)
VALUES
  ('CHANGE_ITEM_MEASURE', 'Change Item Measure', 'تغيير قياس الصنف',
   'Change what was measured on a measured item (weight, length, area, volume or time); the billed quantity and the line money are calculated again.',
   'تغيير ما تم قياسه في صنف مقاس (وزن أو طول أو مساحة أو حجم أو وقت)؛ تُحسب الكمية المفوترة ومبالغ البند من جديد.',
   true, 'Measured Pricing P5: re-measure a line', true, 1)
ON CONFLICT (operation_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status;

INSERT INTO public.sys_oc_order_edit_op_tgt_cd
  (operation_code, target_type, created_info, is_active, rec_status)
VALUES
  ('CHANGE_ITEM_MEASURE', 'ITEM', 'Measured Pricing P5: re-measure a line', true, 1),
  ('CHANGE_ITEM_MEASURE', 'PIECE', 'Measured Pricing P5: re-measure one piece', true, 1)
ON CONFLICT (operation_code, target_type) DO UPDATE SET
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status;

-- Dropped and recreated in one transaction: Postgres cannot alter a CHECK in place.
ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_catalog_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_catalog_ck CHECK (
    operation_code IN (
      'ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE',
      'ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE', 'CHANGE_PRIORITY',
      'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY', 'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT',
      'CHANGE_UNLISTED', 'CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT', 'CHANGE_ITEM_MEASURE'
    )
    AND target_type IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE')
  );

ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_target_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_target_ck CHECK (
    (operation_code IN ('ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY',
        'CHANGE_SERVICE_SPEED', 'CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT', 'CHANGE_ITEM_MEASURE')
      AND target_type = 'ITEM' AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NULL AND order_preference_id IS NULL)
    OR (operation_code IN ('ADD_PIECE', 'REMOVE_PIECE', 'CHANGE_SERVICE_SPEED', 'CHANGE_DISCOUNT', 'CHANGE_ITEM_MEASURE')
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
  'Limits applied operations to the V1 catalog, the line price, line discount and line measure of Order Edit (P6-02c, Measured Pricing P5), and CHANGE_UNLISTED, which records a screen edit that has no policy operation.';
COMMENT ON CONSTRAINT oc_op_target_ck ON public.org_order_change_ops_dtl IS
  'Binds each operation to its affected-fact identity. CHANGE_SERVICE_SPEED is an order, line or piece row; CHANGE_DISCOUNT is a line or piece row; CHANGE_ITEM_MEASURE is a line or piece row; CHANGE_ITEM_PRICE and the item quantity operations are line rows; a piece row always names its item (P9-01).';

COMMIT;
