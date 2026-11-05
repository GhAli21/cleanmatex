-- =============================================================================
-- 0692_oc_edit_piece_speed_discount.sql
--
-- Purpose: let Order Edit change the speed and the discount of one piece
-- (Line-Level Money Snapshot P9-01, PIECE commercial level):
--   - CHANGE_SERVICE_SPEED / PIECE: a piece's own speed, overriding its line's.
--   - CHANGE_DISCOUNT / PIECE: a manual discount on one piece.
-- Both are stored like the other piece operations: target PIECE, with the item and
-- the piece set and no preference. The ORDER and ITEM targets are unchanged, and
-- rows already stored satisfy the wider check.
--
-- Policy effect: a live pair with no rule is refused at runtime
-- (CAPABILITY_POLICY_BINDING_MISSING), so these controls stay closed until HQ
-- (the SaaS Backoffice) adds rules for the new pairs to a new draft version of each
-- Edit policy and publishes it. Published policy rules are immutable, so this
-- migration seeds no rules; 0637 and 0662 added their pairs the same way.
-- =============================================================================

BEGIN;

-- One row per reviewed operation/target pair (PK operation_code, target_type).
-- target_type 'PIECE' is already allowed by ck_oc_edit_op_tgt_type (REMOVE_PIECE uses it).
INSERT INTO public.sys_oc_order_edit_op_tgt_cd (
  operation_code, target_type, created_info, is_active, rec_status
) VALUES
  ('CHANGE_SERVICE_SPEED', 'PIECE', 'PIECE-Line-Level P9-01: per-piece speed', true, 1),
  ('CHANGE_DISCOUNT', 'PIECE', 'PIECE-Line-Level P9-01: piece discount', true, 1)
ON CONFLICT (operation_code, target_type) DO UPDATE SET
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status;

-- The operation descriptions now cover the new target.
UPDATE public.sys_oc_order_edit_ops_cd
SET description = 'Change the governed commercial service speed of the order (ORDER), of one line (ITEM) or of one piece (PIECE).',
    description2 = 'تغيير سرعة الخدمة التجارية المحكومة للطلب (ORDER) أو لبند واحد (ITEM) أو لقطعة واحدة (PIECE).',
    updated_at = now(),
    updated_info = 'Line-Level P9-01: PIECE target'
WHERE operation_code = 'CHANGE_SERVICE_SPEED';

UPDATE public.sys_oc_order_edit_ops_cd
SET description = 'Change governed discount, promotion or gift-card inputs of the order (ORDER), or the manual discount of one line (ITEM) or one piece (PIECE); no order-level writer until its policy is enabled.',
    description2 = 'تغيير مدخلات الخصم أو العرض أو بطاقة الهدية المحكومة للطلب (ORDER)، أو الخصم اليدوي لبند واحد (ITEM) أو لقطعة واحدة (PIECE)؛ لا يوجد منفذ على مستوى الطلب حتى تفعيل سياسته.',
    updated_at = now(),
    updated_info = 'Line-Level P9-01: PIECE target'
WHERE operation_code = 'CHANGE_DISCOUNT';

-- Dropped and recreated in one transaction: Postgres cannot alter a CHECK in place.
-- Removes only this constraint (no dependents); recreated below, wider.
ALTER TABLE public.org_order_change_ops_dtl
  DROP CONSTRAINT oc_op_target_ck;

ALTER TABLE public.org_order_change_ops_dtl
  ADD CONSTRAINT oc_op_target_ck CHECK (
    (operation_code IN ('ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY',
        'CHANGE_SERVICE_SPEED', 'CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT')
      AND target_type = 'ITEM' AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NULL AND order_preference_id IS NULL)
    OR (operation_code IN ('ADD_PIECE', 'REMOVE_PIECE', 'CHANGE_SERVICE_SPEED', 'CHANGE_DISCOUNT')
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

COMMENT ON CONSTRAINT oc_op_target_ck ON public.org_order_change_ops_dtl IS
  'Binds each operation to its affected-fact identity. CHANGE_SERVICE_SPEED is an order, line or piece row; CHANGE_DISCOUNT is a line or piece row; a piece row always names its item (P9-01).';

COMMIT;
