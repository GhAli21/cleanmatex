-- =============================================================================
-- Migration: 0815_uom_perms_nav.sql
-- Purpose:   Unit of Measure platform, part 3 of Migration A (docs/features/Measured_Pricing/PLAN.md §3.8,
--            §3.10, §3.13):
--            1. Tenant permissions uom:view (see units and conversions) and uom:manage (add/edit/switch off
--               units, edit conversions). Granted like products:read / products:update.
--            2. HQ permissions uom_config:view and uom_config:manage for the HQ Units & Conversions
--               screens, granted to TECH_ADMIN (the role that holds catalog.*). SUPER_ADMIN holds '*'.
--            3. Tenant navigation Catalog › Units & Conversions (dual-write: the other half is
--               web-admin/config/navigation.ts, entry catalog_units, added in P4).
--            4. Rebuild of the effective-permission cache for users holding the granted roles.
-- Affected:  sys_auth_permissions, sys_auth_role_default_permissions, hq_permissions, hq_role_permissions,
--            hq_roles.permissions, sys_components_cd, cmx_effective_permissions (via rebuild)
-- Related:   0813, 0814 (UoM schema). Pattern: 0710.
-- Idempotent: ON CONFLICT DO UPDATE for definitions, UPDATE + INSERT…NOT EXISTS for grants, upsert for the menu row.
-- Rollback (forward-only, manual): delete the catalog_units component, the role grants and the four
--            permission rows, then rebuild users.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Tenant permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by, created_info
) VALUES
  ('uom:view',
   'View units of measure', 'عرض وحدات القياس', 'crud',
   'See the units (piece, kg, m, m² …) and unit conversions of the organization.',
   'عرض وحدات القياس (قطعة، كغ، م، م² …) وتحويلات الوحدات في المنشأة.',
   'Products', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', '0815 uom'),
  ('uom:manage',
   'Manage units of measure', 'إدارة وحدات القياس', 'crud',
   'Add custom units, add units from the system catalog, edit or switch off units, and edit unit conversions.',
   'إضافة وحدات خاصة، وإضافة وحدات من كتالوج النظام، وتعديل الوحدات أو إيقافها، وتعديل تحويلات الوحدات.',
   'Products', true, true, 1, CURRENT_TIMESTAMP, 'system_admin', '0815 uom')
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

-- Grant plan: whoever can read products can see units; whoever can update products can manage them.
CREATE TEMP TABLE _uom_grants ON COMMIT DROP AS
SELECT DISTINCT d.role_code, g.perm
  FROM public.sys_auth_role_default_permissions d
  JOIN (VALUES ('products:read', 'uom:view'), ('products:update', 'uom:manage')) AS g(src, perm)
    ON g.src = d.permission_code
 WHERE d.is_active AND d.is_enabled AND COALESCE(d.rec_status, 1) = 1;

-- Remember who holds those roles now (their cache is rebuilt in step 4).
CREATE TEMP TABLE _uom_perm_users ON COMMIT DROP AS
SELECT DISTINCT ur.user_id, ur.tenant_org_id
  FROM public.org_auth_user_roles ur
 WHERE ur.role_code IN (SELECT role_code FROM _uom_grants)
   AND ur.is_active = TRUE
   AND COALESCE(ur.rec_status, 1) = 1;

-- Re-enable grants that exist but were switched off.
UPDATE public.sys_auth_role_default_permissions d
   SET is_enabled = true, is_active = true, rec_status = 1, updated_at = CURRENT_TIMESTAMP
  FROM _uom_grants g
 WHERE d.role_code = g.role_code AND d.permission_code = g.perm;

-- Add missing grants.
INSERT INTO public.sys_auth_role_default_permissions
  (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT g.role_code, g.perm, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  FROM _uom_grants g
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = g.role_code AND e.permission_code = g.perm
 );

-- -----------------------------------------------------------------------------
-- 2. HQ permissions (colon format, as the newer HQ codes hq_doc_seq:read, tenant_setup_health:view)
-- -----------------------------------------------------------------------------
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  description, description_ar,
  resource_code, action_code, is_system, is_active, created_info
) VALUES
  ('uom_config:view',
   'View system units of measure', 'عرض وحدات القياس للنظام',
   'See the system unit catalog and standard unit conversions.',
   'عرض كتالوج وحدات القياس للنظام والتحويلات القياسية.',
   'uom_config', 'view', true, true, '0815 uom'),
  ('uom_config:manage',
   'Manage system units of measure', 'إدارة وحدات القياس للنظام',
   'Add and edit system units and standard conversions. Changes reach every organization automatically.',
   'إضافة وتعديل وحدات النظام والتحويلات القياسية. تصل التغييرات إلى كل المنشآت تلقائياً.',
   'uom_config', 'manage', true, true, '0815 uom')
ON CONFLICT (permission_code) DO UPDATE SET
  permission_name    = EXCLUDED.permission_name,
  permission_name_ar = EXCLUDED.permission_name_ar,
  description        = EXCLUDED.description,
  description_ar     = EXCLUDED.description_ar,
  is_active          = true,
  updated_at         = NOW();

-- TECH_ADMIN owns HQ catalog setup (it holds catalog.*); SUPER_ADMIN holds '*' already.
INSERT INTO public.hq_role_permissions (role_code, permission_code, created_info)
SELECT r.role_code, p.code, '0815 uom'
  FROM public.hq_roles r
 CROSS JOIN (VALUES ('uom_config:view'), ('uom_config:manage')) AS p(code)
 WHERE r.role_code = 'TECH_ADMIN'
   AND NOT EXISTS (
     SELECT 1 FROM public.hq_role_permissions e
      WHERE e.role_code = r.role_code AND e.permission_code = p.code
   );

-- Keep the role's permissions array in step with hq_role_permissions (both are read by HQ auth).
UPDATE public.hq_roles r
   SET permissions = COALESCE(r.permissions, '[]'::jsonb) || '["uom_config:view"]'::jsonb,
       updated_at  = NOW()
 WHERE r.role_code = 'TECH_ADMIN'
   AND NOT COALESCE(r.permissions, '[]'::jsonb) ? 'uom_config:view';
UPDATE public.hq_roles r
   SET permissions = COALESCE(r.permissions, '[]'::jsonb) || '["uom_config:manage"]'::jsonb,
       updated_at  = NOW()
 WHERE r.role_code = 'TECH_ADMIN'
   AND NOT COALESCE(r.permissions, '[]'::jsonb) ? 'uom_config:manage';

-- -----------------------------------------------------------------------------
-- 3. Tenant navigation: Catalog › Units & Conversions (display order 6, after Customer Categories 5)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2,
  description, description2, comp_path, comp_icon, main_permission_code,
  display_order, comp_level, is_leaf, is_navigable, is_active, is_system,
  is_for_tenant_use, roles, permissions, feature_flag, rec_status, created_info
)
VALUES (
  'catalog_units',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'catalog'),
  'catalog',
  'Units & Conversions',
  'الوحدات والتحويلات',
  'Units of measure used for pricing and stock, and how they convert.',
  'وحدات القياس المستخدمة في التسعير والمخزون وكيفية التحويل بينها.',
  '/dashboard/catalog/units',
  'Ruler',
  'uom:view',
  6, 1, TRUE, TRUE, TRUE, TRUE, TRUE,
  '[]'::jsonb,
  '["uom:view"]'::jsonb,
  '[]'::jsonb,
  1,
  '0815 uom'
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  permissions          = EXCLUDED.permissions,
  is_active            = TRUE,
  rec_status           = 1,
  updated_at           = NOW(),
  updated_info         = '0815 uom';

-- -----------------------------------------------------------------------------
-- 4. Rebuild effective permissions of the users captured above
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_user RECORD;
  v_n    INTEGER := 0;
BEGIN
  FOR v_user IN SELECT user_id, tenant_org_id FROM _uom_perm_users LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE '0815: effective permissions rebuilt for % user/tenant rows', v_n;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sys_auth_role_default_permissions
                  WHERE permission_code = 'uom:manage' AND role_code = 'tenant_admin' AND is_enabled) THEN
    RAISE EXCEPTION '0815: uom:manage not granted to tenant_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_auth_role_default_permissions
                  WHERE permission_code = 'uom:view' AND role_code = 'cashier' AND is_enabled) THEN
    RAISE EXCEPTION '0815: uom:view not granted to cashier';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd
                  WHERE comp_code = 'catalog_units' AND parent_comp_id IS NOT NULL) THEN
    RAISE EXCEPTION '0815: catalog_units menu row missing or not linked to catalog';
  END IF;
  IF (SELECT count(*) FROM public.hq_permissions WHERE permission_code IN ('uom_config:view', 'uom_config:manage')) <> 2 THEN
    RAISE EXCEPTION '0815: HQ uom_config permissions missing';
  END IF;
END $$;

COMMIT;
