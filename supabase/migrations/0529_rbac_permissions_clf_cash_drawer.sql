-- =============================================================================
-- Migration 0529 — CLF M6: cash-drawer permissions for the Cash Ledger Foundation
-- Package CLF, release R1 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.8, §4B.2a
--
-- Permissions
--   * NEW  cash_drawer:post_close_update — record/update the optional after-close
--          follow-up status and notes of a closed drawer session (e.g. "deposited
--          to bank" the next day). Granted to: super_admin, tenant_admin, admin
--          (mandatory base), accountant, finance_manager, branch_manager.
--   * META cash_drawer:record_movement — existing code, re-purposed by CLF: it now
--          gates the drawer "Cash in / Cash out" dialog, which posts finance
--          vouchers (expense, supplier, petty cash issue/return, pay-in). Only its
--          name/description change; role grants are untouched.
--
-- Owner rule: no maker ≠ checker — holding the permission is the only gate, the
-- same user may perform consecutive steps.
--
-- Reversal (forward migration):
--   UPDATE sys_auth_role_default_permissions SET is_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
--    WHERE permission_code = 'cash_drawer:post_close_update';
--   UPDATE sys_auth_permissions SET is_enabled = FALSE, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
--    WHERE code = 'cash_drawer:post_close_update';
--   Re-apply the 0517 metadata for cash_drawer:record_movement.
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Permission definitions
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('cash_drawer:post_close_update',
   'Update Closed Session Follow-up',
   'تحديث متابعة الجلسة المغلقة',
   'actions',
   'Record or update the after-close follow-up status and notes of a closed cash drawer session (e.g. deposited to bank).',
   'تسجيل أو تحديث حالة المتابعة والملاحظات لجلسة صندوق نقدي مغلقة (مثل الإيداع في البنك).',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:record_movement',
   'Record Cash In / Cash Out',
   'تسجيل إدخال / إخراج نقدية',
   'actions',
   'Record cash in or cash out on a drawer (expense, supplier payment, petty cash issue/return, owner pay-in). Each entry is posted as a finance voucher.',
   'تسجيل إدخال أو إخراج نقدية على الصندوق (مصروف، دفعة لمورد، صرف أو إرجاع عهدة نثرية، إيداع من المالك). يُرحَّل كل قيد كسند مالي.',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status,
  updated_at    = CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 2. Role defaults — cash_drawer:post_close_update
-- -----------------------------------------------------------------------------
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = TRUE,
  is_active  = TRUE,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin', 'accountant', 'finance_manager', 'branch_manager')
  AND permission_code = 'cash_drawer:post_close_update';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'accountant', 'finance_manager', 'branch_manager')
  AND p.code = 'cash_drawer:post_close_update'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.sys_auth_role_default_permissions
       WHERE permission_code = 'cash_drawer:post_close_update' AND is_enabled) < 6 THEN
    RAISE EXCEPTION 'cash_drawer:post_close_update role defaults incomplete';
  END IF;
END $$;

COMMIT;
