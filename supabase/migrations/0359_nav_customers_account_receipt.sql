-- Migration 0359: Navigation — Customer Account Receipt screen (dual-write with navigation.ts)

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'customers_account_receipt', 'customers',
  'Account Receipt', 'قبض حساب',
  'Record and allocate standalone customer account receipts', 'تسجيل وتوزيع قبض حساب العميل المستقل',
  '/dashboard/customers/account-receipt', 'Receipt',
  1, 55,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","cashier"]'::jsonb,
  'customers:receipt_allocate', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'customers_account_receipt'
  AND c.parent_comp_code = 'customers'
  AND p.comp_code = 'customers';

UPDATE public.sys_components_cd
SET is_leaf = false, updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'customers';

COMMIT;
