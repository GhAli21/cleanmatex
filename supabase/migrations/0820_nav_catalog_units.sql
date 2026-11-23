-- =====================================================
-- Migration: 0820_nav_catalog_units.sql
-- Purpose:   Add "Units & Conversions" to the Catalog navigation tree.
-- Route:     /dashboard/catalog/units (tenant units and conversions, org_uom_cf / org_uom_conv_cf)
-- Access:    permission uom:view (seeded by 0815); roles super_admin, tenant_admin
-- Related:   0813-0815, 0817 (UoM schema and permissions); PLAN docs/features/Measured_Pricing/PLAN.md P4
-- =====================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, comp_level, display_order, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, main_permission_code, rec_status
) VALUES (
  'catalog_units',
  'catalog',
  'Units & Conversions',
  'الوحدات والتحويلات',
  'Units of measure and conversions between them',
  'وحدات القياس والتحويل بينها',
  '/dashboard/catalog/units',
  'Ruler',
  1,
  5,
  true,
  true,
  true,
  true,
  true,
  '["super_admin", "tenant_admin"]'::jsonb,
  'uom:view',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- Link catalog_units to its catalog parent
UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'catalog_units'
  AND c.parent_comp_code = 'catalog'
  AND p.comp_code = 'catalog';

COMMIT;
