-- ==================================================================
-- Migration: 0251_marketing_navigation.sql
-- Purpose: Seed Marketing navigation entries in sys_components_cd
--          (root + Promo Codes / Gift Cards / Discount Rules children)
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Feature: Promotions & Gift Cards (shipped 2026-05-07)
-- Notes:
--   - Permissions match web-admin/src/features/marketing/access/marketing-access.ts
--   - Sidebar config already exists in web-admin/config/navigation.ts
--   - feature_flag left empty to match navigation.ts (no flag gating today);
--     gift_cards_enabled / promotional_pricing_rules flags exist if we
--     want to gate later.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- 0. Marketing permissions (used by navigation + page access checks)
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
  ('promotions:read', 'View Promotions', 'عرض العروض الترويجية', 'crud', 'View promotions and promo codes', 'عرض العروض الترويجية ورموز الخصم', 'Marketing', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('gift_cards:read', 'View Gift Cards', 'عرض بطاقات الهدايا', 'crud', 'View gift cards and usage', 'عرض بطاقات الهدايا والاستخدام', 'Marketing', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('discount_rules:read', 'View Discount Rules', 'عرض قواعد الخصم', 'crud', 'View discount rules', 'عرض قواعد الخصم', 'Marketing', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
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
SELECT
  r.code,
  p.code,
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'operator')
  AND p.code IN ('promotions:read', 'gift_cards:read', 'discount_rules:read')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- 1. Marketing root
INSERT INTO public.sys_components_cd (
  comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'marketing',
  'Marketing',
  'التسويق',
  'Promotions, gift cards, and discount rules',
  'العروض الترويجية وبطاقات الهدايا وقواعد الخصم',
  '/dashboard/marketing',
  'Megaphone',
  0,
  10,
  false,
  true,
  true,
  true,
  true,
  '["admin","super_admin","tenant_admin","operator"]'::jsonb,
  'promotions:read',
  1
)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- 2. Marketing children
INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES
  ('marketing_promos', 'marketing', 'Promo Codes', 'رموز العروض',
   '/dashboard/marketing/promos', 'Tag', 1, 0,
   true, true, true, true, true,
   '["admin","super_admin","tenant_admin","operator"]'::jsonb,
   'promotions:read', 1),
  ('marketing_gift_cards', 'marketing', 'Gift Cards', 'بطاقات الهدايا',
   '/dashboard/marketing/gift-cards', 'Gift', 1, 1,
   true, true, true, true, true,
   '["admin","super_admin","tenant_admin","operator"]'::jsonb,
   'gift_cards:read', 1),
  ('marketing_discount_rules', 'marketing', 'Discount Rules', 'قواعد الخصم',
   '/dashboard/marketing/discount-rules', 'Percent', 1, 2,
   true, true, true, true, true,
   '["admin","super_admin","tenant_admin"]'::jsonb,
   'discount_rules:read', 1)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code = EXCLUDED.parent_comp_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- 3. Resolve parent_comp_id for marketing children
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'marketing'
  AND p.comp_code = 'marketing'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- 4. Ensure marketing root is flagged as a node (has children)
UPDATE sys_components_cd
SET is_leaf = false
WHERE comp_code = 'marketing';

COMMIT;
