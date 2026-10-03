-- =============================================================================
-- 0566_order_change_v2_permissions.sql
--
-- Why: Edit Order V2 needs a dedicated base permission and a separate override
-- permission. `orders:update` remains the legacy replacement-edit capability;
-- it must not silently authorize governed commercial Change operations.
--
-- This migration creates no database schema object. It adds two catalog rows
-- only. No role-default grant is inserted: the role mapping is an explicit
-- WP05 pilot/release gate, so an unreviewed global/default grant could enable
-- an immutable commercial Change path too broadly.
--
-- Forward-only reversal reference: remove any tenant/user grants first, then
-- delete the two `sys_auth_permissions` rows. Do not remove a code while an
-- audited Change profile or a role assignment still references it.
-- =============================================================================

BEGIN;

-- Permission catalog rows mirror ORDERS_PERMISSIONS.EDIT and EDIT_OVERRIDE in
-- web-admin. UPSERT keeps local and hosted catalog recovery idempotent.
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
  created_by,
  created_info,
  updated_at,
  updated_by,
  updated_info
) VALUES
  (
    'orders:edit',
    'Edit Order V2',
    'تعديل الطلب الإصدار الثاني',
    'actions',
    'Evaluate and submit governed Edit Order V2 commercial Changes. This permission alone never bypasses per-order access, workflow capability policy, fiscal restrictions, or required review proof.',
    'تقييم وإرسال تغييرات تجارية محكومة لتعديل الطلب الإصدار الثاني. لا يتجاوز هذا الإذن بمفرده صلاحية الطلب أو سياسة سير العمل أو القيود الضريبية أو إثبات المراجعة المطلوب.',
    'Orders',
    TRUE,
    TRUE,
    1,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0566_order_change_v2_permissions.sql',
    NULL,
    NULL,
    NULL
  ),
  (
    'orders:edit_override',
    'Override Edit Order V2 Policy',
    'تجاوز سياسة تعديل الطلب الإصدار الثاني',
    'actions',
    'Authorize a profile-configured Edit Order V2 override with a reason. It cannot bypass hard structural, tenant, fiscal, historical-fact, or permanent order-access denials.',
    'اعتماد تجاوز مهيأ في ملف سير العمل لتعديل الطلب الإصدار الثاني مع سبب. لا يمكنه تجاوز المنع البنيوي أو منع المستأجر أو المنع الضريبي أو الحقائق التاريخية أو منع وصول الطلب الدائم.',
    'Orders',
    TRUE,
    TRUE,
    1,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0566_order_change_v2_permissions.sql',
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active = EXCLUDED.is_active,
  is_enabled = EXCLUDED.is_enabled,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration: 0566_order_change_v2_permissions.sql';

-- Self-check proves both catalog identities exist while intentionally proving
-- no broad role-default assignment was performed by this migration.
DO $$
DECLARE
  permission_count INTEGER;
  default_grant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO permission_count
  FROM public.sys_auth_permissions
  WHERE code IN ('orders:edit', 'orders:edit_override')
    AND is_active = TRUE
    AND is_enabled = TRUE
    AND rec_status = 1;

  IF permission_count <> 2 THEN
    RAISE EXCEPTION 'Edit Order V2 permission catalog is incomplete (% active rows)', permission_count;
  END IF;

  SELECT COUNT(*) INTO default_grant_count
  FROM public.sys_auth_role_default_permissions
  WHERE permission_code IN ('orders:edit', 'orders:edit_override')
    AND is_active = TRUE
    AND is_enabled = TRUE
    AND rec_status = 1;

  RAISE NOTICE 'Edit Order V2 permissions seeded; % active role defaults remain intentionally review-owned.', default_grant_count;
END $$;

COMMIT;

