-- ============================================================================
-- 0320_ar_invoice_ledger_navigation.sql
-- Purpose:
--   Add the dedicated AR ledger navigation node and keep AR sub-route ordering
--   aligned with the frontend sidebar after the AR UI rollout.
-- DUAL-WRITE:
--   web-admin/config/navigation.ts contains the matching frontend entries.
-- ============================================================================

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
  'billing_ar_ledger', 'billing',
  'AR Ledger', 'دفتر الذمم المدينة',
  'Customer accounts receivable subledger',
  'دفتر الأستاذ الفرعي للذمم المدينة للعملاء',
  '/dashboard/internal_fin/ar/ledger', 'BookOpen',
  1, 14,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
  'ar_ledger:view', 1
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.parent_comp_code = 'billing'
  AND p.comp_code = 'billing'
  AND c.comp_code = 'billing_ar_ledger'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

UPDATE public.sys_components_cd
SET display_order = CASE comp_code
  WHEN 'billing_ar_ledger' THEN 14
  WHEN 'billing_ar_statements' THEN 15
  ELSE display_order
END,
updated_at = CURRENT_TIMESTAMP
WHERE comp_code IN ('billing_ar_ledger', 'billing_ar_statements');

COMMIT;
