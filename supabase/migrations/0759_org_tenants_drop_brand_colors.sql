-- =============================================================================
-- Migration: 0759_org_tenants_drop_brand_colors.sql
-- Purpose:   Retire the old brand colour columns on org_tenants_mst (UI Design
--            System PR-07, design 6.4). Brand colours now live in the
--            Organization's saved themes (org_tenant_ui_theme_dtl, 0753) over the
--            HQ theme catalog (sys_ui_theme_cd, 0752); accent is derived, not stored.
--            0753 copied every non-default colour into a saved theme (remote: none).
-- Affected:  org_tenants_mst: DROP brand_color_primary, brand_color_secondary,
--            brand_color_accent. logo_url stays: File Util publishes the MAIN logo
--            URL there (File Util decision 14).
-- Checked before writing (2026-11-17):
--   * no reader in cleanmatex (web-admin, mobile) or cleanmatexsaas (platform-api,
--     platform-web) other than generated type files, which are regenerated after apply;
--   * no function or view in the database references these columns.
-- RESTRICT: the drop fails instead of removing anything that still depends on a column.
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-07.md (Task 11).
-- =============================================================================

BEGIN;

ALTER TABLE public.org_tenants_mst DROP COLUMN IF EXISTS brand_color_primary RESTRICT;
ALTER TABLE public.org_tenants_mst DROP COLUMN IF EXISTS brand_color_secondary RESTRICT;
ALTER TABLE public.org_tenants_mst DROP COLUMN IF EXISTS brand_color_accent RESTRICT;

COMMIT;
