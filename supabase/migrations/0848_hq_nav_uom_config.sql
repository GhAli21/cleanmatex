-- =============================================================================
-- Migration: 0848_hq_nav_uom_config.sql
-- Program:   Measured Pricing + UoM — P7 HQ workspace `/uom-config`
--            (docs/features/Measured_Pricing/PLAN.md §3.10; permissions in 0815)
-- Purpose:
--   HQ sidebar rows for the Units & Conversions workspace: one hub under Tenant
--   Governance & Config, placed between Products & Items Config (150) and File
--   Setup (156), and its two slices as nav_level 2 children. Every row needs
--   uom_config:view (0815).
-- Dual-write: platform-web messages/{en,ar}/layout.json (sidebar.routes.uomConfig,
--   uomUnits, uomConversions), FALLBACK_SECTIONS and HQ_NAV_ICON_MAP (adds Ruler)
--   in src/ui/navigation/cmx-sidebar.tsx, breadcrumbs map in
--   cmx-auto-breadcrumbs.tsx, hub page app/uom-config/page.tsx.
-- Target table: public.hq_navigation_cd (rows only; no schema change).
-- Rollback: soft-retire the 3 rows whose created_by = 'migration_0848'
--           (is_active = false, is_navigable = false, rec_status = 0).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Hub (nav_level 1) and its two slices (nav_level 2, in hub order). Re-running refreshes the rows.
INSERT INTO public.hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, description, description2,
  nav_path, nav_icon, badge, main_permission_code, nav_level, display_order,
  is_leaf, is_navigable, is_active, is_system, metadata, rec_status, created_by
)
VALUES
  ('tg_uom_config', NULL, 'tenant_gov', 'Units & Conversions', 'الوحدات والتحويلات',
   'The units every organization can price and stock in, and the standard conversions between them.',
   'الوحدات التي تسعّر بها المنشآت وتخزّن، والتحويلات القياسية بينها.',
   '/uom-config', 'Ruler', NULL, 'uom_config:view', 1, 153, false, true, true, true, '{}'::jsonb, 1, 'migration_0848'),
  ('tg_uom_units', 'tg_uom_config', 'tenant_gov', 'Units', 'الوحدات',
   'Piece, kilogram, metre, square metre, litre, hour and packaging units.',
   'القطعة والكيلوغرام والمتر والمتر المربع واللتر والساعة ووحدات التعبئة.',
   '/uom-config/units', 'Ruler', NULL, 'uom_config:view', 2, 1, true, true, true, true, '{}'::jsonb, 1, 'migration_0848'),
  ('tg_uom_conversions', 'tg_uom_config', 'tenant_gov', 'Conversions', 'التحويلات',
   'Standard rates between units of the same kind, such as pound to kilogram.',
   'معاملات قياسية بين وحدات من النوع نفسه، مثل الرطل إلى الكيلوغرام.',
   '/uom-config/conversions', 'ArrowLeftRight', NULL, 'uom_config:view', 2, 2, true, true, true, true, '{}'::jsonb, 1, 'migration_0848')
ON CONFLICT (nav_code) DO UPDATE
   SET parent_nav_code = EXCLUDED.parent_nav_code, section_code = EXCLUDED.section_code,
       label = EXCLUDED.label, label2 = EXCLUDED.label2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       nav_path = EXCLUDED.nav_path, nav_icon = EXCLUDED.nav_icon, main_permission_code = EXCLUDED.main_permission_code,
       nav_level = EXCLUDED.nav_level, display_order = EXCLUDED.display_order, is_leaf = EXCLUDED.is_leaf,
       updated_at = now(), updated_by = 'migration_0848', updated_count = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

COMMIT;
