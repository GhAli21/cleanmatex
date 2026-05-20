-- =============================================================================
-- Migration 0309: Order Fin credit application and adjustment permissions
-- Purpose:
-- 1. Seed the missing Batch 0 Order Fin action permissions for stored-value
--    applications and financial adjustments.
-- 2. Map them to the same privileged default roles already trusted with
--    refunds and collections.
-- Notes:
-- - Additive only. No existing permission codes are modified.
-- =============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
)
VALUES
  (
    'orders:apply_credit',
    'Apply Order Credit',
    'تطبيق رصيد على الطلب',
    'actions',
    'Apply stored value such as wallet, advance, credit note, loyalty, or gift card to an existing order.',
    'تطبيق القيمة المخزنة مثل المحفظة أو العربون أو الإشعار الدائن أو الولاء أو بطاقة الهدية على طلب موجود.',
    'Orders',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  ),
  (
    'orders:create_adjustment',
    'Create Order Adjustment',
    'إنشاء تسوية مالية للطلب',
    'actions',
    'Create a controlled financial adjustment row for an order.',
    'إنشاء سجل تسوية مالية مضبوط لطلب.',
    'Orders',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'operator', 'cachier')
  AND p.code IN ('orders:apply_credit', 'orders:create_adjustment')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;
