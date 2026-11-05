-- =============================================================================
-- 0662_oc_edit_line_speed_discount_targets.sql
--
-- Purpose: let Order Edit change the speed and the discount of one line
-- (Line-Level Money Snapshot P6-02b/c). Adds the ITEM target to two existing
-- Edit operations in the reviewed operation/target catalog:
--   - CHANGE_SERVICE_SPEED / ITEM: a per-line speed that overrides the order speed.
--   - CHANGE_DISCOUNT / ITEM: a manual line discount (amount or percent).
-- The ORDER target of both operations is unchanged.
--
-- Policy effect: a live pair with no rule is refused at runtime
-- (CAPABILITY_POLICY_BINDING_MISSING), so these line controls stay closed until
-- HQ (the SaaS Backoffice) adds rules for the new pairs to a new draft version of
-- each Edit policy and publishes it. Published policy rules are immutable, so this
-- migration seeds no rules; 0637 added its pairs the same way.
-- =============================================================================

BEGIN;

-- One row per reviewed operation/target pair (PK operation_code, target_type).
-- target_type 'ITEM' is already allowed by ck_oc_edit_op_tgt_type (CHANGE_ITEM_PRICE uses it).
INSERT INTO public.sys_oc_order_edit_op_tgt_cd (
  operation_code, target_type, created_info, is_active, rec_status
) VALUES
  ('CHANGE_SERVICE_SPEED', 'ITEM', 'ITEM-Line-Level P6-02: per-line speed', true, 1),
  ('CHANGE_DISCOUNT', 'ITEM', 'ITEM-Line-Level P6-02: line discount', true, 1)
ON CONFLICT (operation_code, target_type) DO UPDATE SET
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status;

-- The operation descriptions now cover both targets.
UPDATE public.sys_oc_order_edit_ops_cd
SET description = 'Change the governed commercial service speed of the order (ORDER) or of one line (ITEM).',
    description2 = 'تغيير سرعة الخدمة التجارية المحكومة للطلب (ORDER) أو لبند واحد (ITEM).',
    updated_at = now(),
    updated_info = 'Line-Level P6-02: ITEM target'
WHERE operation_code = 'CHANGE_SERVICE_SPEED';

UPDATE public.sys_oc_order_edit_ops_cd
SET description = 'Change governed discount, promotion or gift-card inputs of the order (ORDER), or the manual discount of one line (ITEM); never silently rewrite money.',
    description2 = 'تغيير مدخلات الخصم أو العرض أو بطاقة الهدية المحكومة للطلب (ORDER)، أو الخصم اليدوي لبند واحد (ITEM)؛ دون تغيير صامت للمبالغ.',
    updated_at = now(),
    updated_info = 'Line-Level P6-02: ITEM target'
WHERE operation_code = 'CHANGE_DISCOUNT';

COMMIT;
