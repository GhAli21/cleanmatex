-- =============================================================================
-- Migration: 0754_sys_users_ui_prefs.sql
-- Purpose:   Per-person appearance preferences (UI Design System PR-07). Stored
--            on the person (sys_users_mst), so they follow the user across
--            Organizations. Read on the server per request from the session, so
--            a shared counter tablet always shows the signed-in person's values.
--            Only the person can change them, through PUT /api/v1/me/ui-preferences
--            (server, service role, where id = the session user).
-- Affected:  sys_users_mst (3 new columns, additive). org_users_mst.preferences
--            is not touched.
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-07.md (Task 4);
--            design THEMING_ARCHITECTURE_DESIGN.md section 6.5.
-- Values mirror UI_COLOR_MODES, UI_DENSITIES, UI_FONT_SCALES in
-- web-admin/lib/constants/ui-theme.ts.
-- =============================================================================

BEGIN;

ALTER TABLE public.sys_users_mst
  ADD COLUMN IF NOT EXISTS ui_color_mode TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS ui_density    TEXT NULL,
  ADD COLUMN IF NOT EXISTS ui_font_scale TEXT NOT NULL DEFAULT 'MD';

ALTER TABLE public.sys_users_mst
  ADD CONSTRAINT ck_sysusr_ui_color_mode CHECK (ui_color_mode IN ('LIGHT', 'DARK', 'SYSTEM')),
  ADD CONSTRAINT ck_sysusr_ui_density CHECK (ui_density IS NULL OR ui_density IN ('COMFORTABLE', 'COMPACT')),
  ADD CONSTRAINT ck_sysusr_ui_font_scale CHECK (ui_font_scale IN ('SM', 'MD', 'LG'));

COMMENT ON COLUMN public.sys_users_mst.ui_color_mode IS 'Colour mode chosen by the person: LIGHT, DARK or SYSTEM (follow the device). Written as <html data-mode> once dark mode is offered (PR-07 task 6); until then the page is always LIGHT.';
COMMENT ON COLUMN public.sys_users_mst.ui_density IS 'Density chosen by the person: COMFORTABLE or COMPACT. NULL = follow the Organization default (org_tenant_ui_theme_dtl.default_ui_density).';
COMMENT ON COLUMN public.sys_users_mst.ui_font_scale IS 'Font size chosen by the person: SM, MD (default) or LG. Written as <html data-font-scale>.';
COMMENT ON CONSTRAINT ck_sysusr_ui_color_mode ON public.sys_users_mst IS 'Colour mode values, mirrored by UI_COLOR_MODES.';
COMMENT ON CONSTRAINT ck_sysusr_ui_density ON public.sys_users_mst IS 'Density values or NULL (follow the Organization), mirrored by UI_DENSITIES.';
COMMENT ON CONSTRAINT ck_sysusr_ui_font_scale ON public.sys_users_mst IS 'Font scale values, mirrored by UI_FONT_SCALES.';

COMMIT;
