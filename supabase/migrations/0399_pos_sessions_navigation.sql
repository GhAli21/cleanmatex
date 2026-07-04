-- ============================================================================
-- 0399_pos_sessions_navigation.sql
-- POS Session Management v1 — activate Internal Finance navigation entry.
--
-- DUAL-WRITE:
-- - web-admin/config/navigation.ts adds /dashboard/internal_fin/pos-sessions.
-- - This migration updates the Phase 1 metadata seed from migration 0396.
--
-- Safety:
-- - Idempotent upsert.
-- - Does not execute services, APIs, or data backfill.
-- - Do not apply automatically; review and run through the normal DB process.
-- ============================================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, metadata, rec_status
) VALUES (
  'billing_pos_sessions', 'billing',
  'POS Sessions', 'جلسات نقطة البيع',
  'User-owned POS session operations and audit workbench',
  'واجهة تشغيل وتدقيق جلسات نقطة البيع المملوكة للمستخدم',
  '/dashboard/internal_fin/pos-sessions', 'ClipboardCheck',
  1, 53,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator","cashier"]'::jsonb,
  'pos_session:view',
  '{"phase":"runtime_ui","feature":"pos_session_management_v1"}'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
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
  is_system            = EXCLUDED.is_system,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  metadata             = EXCLUDED.metadata,
  rec_status           = EXCLUDED.rec_status,
  updated_at           = CURRENT_TIMESTAMP,
  updated_info         = 'POS Session Management v1 runtime UI navigation activation';

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'billing_pos_sessions'
  AND p.comp_code = 'billing'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

UPDATE public.sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'billing';

COMMIT;
