-- =============================================================================
-- Migration: 0753_org_tenant_ui_theme.sql
-- Purpose:   Organization saved themes (UI Design System PR-07). An Organization
--            may keep several saved themes; at most one is in use. Each starts
--            from an HQ theme (sys_ui_theme_cd, 0752) and may override parts of
--            it; an empty override means "use the HQ theme's value", so later HQ
--            changes to that theme flow through. An Organization with no row in
--            use resolves to the HQ default theme (STANDARD).
--            Logos are NOT stored here: they are File Util files (category
--            TENANT_LOGO), and org_tenants_mst.logo_url stays as the published
--            URL of the MAIN logo (PLAN_PR-07 ruling 1).
-- Affected:  org_tenant_ui_theme_dtl (new); one data backfill from
--            org_tenants_mst.brand_color_primary/secondary.
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-07.md (Task 3);
--            design THEMING_ARCHITECTURE_DESIGN.md section 6.4.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_tenant_ui_theme_dtl (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id          UUID        NOT NULL,
  theme_name             TEXT        NOT NULL,
  theme_name2            TEXT        NULL,
  ui_theme_code          TEXT        NOT NULL,
  brand_color_primary    TEXT        NULL,
  brand_color_secondary  TEXT        NULL,
  ui_radius_code         TEXT        NULL,
  ui_font_pair_code      TEXT        NULL,
  default_ui_density     TEXT        NULL,
  app_display_name       TEXT        NULL,
  app_display_name2      TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT false,
  CONSTRAINT pk_org_tenant_ui_theme_dtl PRIMARY KEY (id),
  CONSTRAINT uq_otut_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT fk_otut_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otut_theme FOREIGN KEY (ui_theme_code)
    REFERENCES public.sys_ui_theme_cd (code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_otut_radius FOREIGN KEY (ui_radius_code)
    REFERENCES public.sys_ui_radius_cd (code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_otut_font_pair FOREIGN KEY (ui_font_pair_code)
    REFERENCES public.sys_ui_font_pair_cd (code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_otut_colors CHECK (
    (brand_color_primary IS NULL OR brand_color_primary ~ '^#[0-9A-Fa-f]{6}$')
    AND (brand_color_secondary IS NULL OR brand_color_secondary ~ '^#[0-9A-Fa-f]{6}$')),
  CONSTRAINT ck_otut_density CHECK (default_ui_density IS NULL OR default_ui_density IN ('COMFORTABLE', 'COMPACT')),
  CONSTRAINT ck_otut_names CHECK (
    length(btrim(theme_name)) BETWEEN 1 AND 80
    AND (theme_name2 IS NULL OR length(btrim(theme_name2)) BETWEEN 1 AND 80)
    AND (app_display_name IS NULL OR length(btrim(app_display_name)) BETWEEN 1 AND 80)
    AND (app_display_name2 IS NULL OR length(btrim(app_display_name2)) BETWEEN 1 AND 80)),
  CONSTRAINT ck_otut_deleted_inactive CHECK (rec_status = 1 OR NOT is_active),
  CONSTRAINT ck_otut_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_tenant_ui_theme_dtl IS 'Saved themes of an Organization; at most one in use (is_active). Starts from an HQ theme with optional overrides (NULL = HQ value). Logos live in File Util, not here. Tenant-scoped read RLS; writes through the server.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.id IS 'Saved theme id.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.tenant_org_id IS 'Organization that owns the saved theme.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.theme_name IS 'English name of the saved theme, shown in the saved-themes list.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.theme_name2 IS 'Arabic name of the saved theme.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.ui_theme_code IS 'HQ theme this saved theme starts from; its values apply wherever an override is NULL.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.brand_color_primary IS 'Primary brand seed override #RRGGBB; NULL = HQ theme value. Applied only when the plan has custom_branding.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.brand_color_secondary IS 'Secondary brand seed override #RRGGBB; NULL = HQ theme value. Applied only with custom_branding.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.ui_radius_code IS 'Radius preset override; NULL = HQ theme value. Applied only with custom_branding.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.ui_font_pair_code IS 'Font pair override; NULL = HQ theme value. Applied only with custom_branding.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.default_ui_density IS 'Organization default density (COMFORTABLE, COMPACT); NULL = COMFORTABLE. A user''s own density wins. All plans.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.app_display_name IS 'English app name replacing "CleanMateX" in titles and the sidebar. Applied only when the plan has white_label.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.app_display_name2 IS 'Arabic app name. Applied only with white_label.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.rec_order IS 'Display order in the saved-themes list (lower first).';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.org_tenant_ui_theme_dtl.is_active IS 'True = this is the theme in use; at most one live row per Organization (uq_otut_one_in_use). Switching is one transaction (old off, new on).';
COMMENT ON CONSTRAINT pk_org_tenant_ui_theme_dtl ON public.org_tenant_ui_theme_dtl IS 'Saved theme id.';
COMMENT ON CONSTRAINT uq_otut_id_tenant ON public.org_tenant_ui_theme_dtl IS 'Target for composite (id, tenant_org_id) FKs from child tables, per the design.';
COMMENT ON CONSTRAINT fk_otut_tenant ON public.org_tenant_ui_theme_dtl IS 'Existing Organization; one with saved themes cannot be hard-deleted.';
COMMENT ON CONSTRAINT fk_otut_theme ON public.org_tenant_ui_theme_dtl IS 'HQ theme exists; a theme in use cannot be deleted or renamed by HQ.';
COMMENT ON CONSTRAINT fk_otut_radius ON public.org_tenant_ui_theme_dtl IS 'Radius override exists; a preset in use cannot be deleted or renamed.';
COMMENT ON CONSTRAINT fk_otut_font_pair ON public.org_tenant_ui_theme_dtl IS 'Font pair override exists; a pair in use cannot be deleted or renamed.';
COMMENT ON CONSTRAINT ck_otut_colors ON public.org_tenant_ui_theme_dtl IS 'Overrides are #RRGGBB only, so a value written into the page style cannot carry anything else.';
COMMENT ON CONSTRAINT ck_otut_density ON public.org_tenant_ui_theme_dtl IS 'Density values, mirrored by UI_DENSITIES in lib/constants/ui-theme.ts.';
COMMENT ON CONSTRAINT ck_otut_names ON public.org_tenant_ui_theme_dtl IS 'Names not blank, at most 80 characters (same limit as the Zod schema).';
COMMENT ON CONSTRAINT ck_otut_deleted_inactive ON public.org_tenant_ui_theme_dtl IS 'A deleted or archived theme can never be the theme in use.';
COMMENT ON CONSTRAINT ck_otut_rec_status ON public.org_tenant_ui_theme_dtl IS 'Standard record status values.';

-- At most one theme in use per Organization. With the transaction in the
-- activate service, concurrent switches can never leave two rows in use.
CREATE UNIQUE INDEX IF NOT EXISTS uq_otut_one_in_use
  ON public.org_tenant_ui_theme_dtl (tenant_org_id) WHERE is_active AND rec_status = 1;
COMMENT ON INDEX public.uq_otut_one_in_use IS 'At most one live theme in use per Organization.';

-- Saved-themes list of one Organization.
CREATE INDEX IF NOT EXISTS idx_otut_tenant_list
  ON public.org_tenant_ui_theme_dtl (tenant_org_id, rec_status, theme_name);
COMMENT ON INDEX public.idx_otut_tenant_list IS 'Saved-themes list of one Organization, tenant-first.';

-- FK lookups when HQ deactivates a theme or preset ("who uses this?").
CREATE INDEX IF NOT EXISTS idx_otut_theme ON public.org_tenant_ui_theme_dtl (ui_theme_code);
COMMENT ON INDEX public.idx_otut_theme IS 'Supports the HQ theme FK check and HQ "Organizations using this theme".';
CREATE INDEX IF NOT EXISTS idx_otut_radius ON public.org_tenant_ui_theme_dtl (ui_radius_code) WHERE ui_radius_code IS NOT NULL;
COMMENT ON INDEX public.idx_otut_radius IS 'Supports the radius FK check.';
CREATE INDEX IF NOT EXISTS idx_otut_font_pair ON public.org_tenant_ui_theme_dtl (ui_font_pair_code) WHERE ui_font_pair_code IS NOT NULL;
COMMENT ON INDEX public.idx_otut_font_pair IS 'Supports the font pair FK check.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_tenant_ui_theme_dtl;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_tenant_ui_theme_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_tenant_ui_theme_dtl IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.org_tenant_ui_theme_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_tenant_ui_theme_dtl ON public.org_tenant_ui_theme_dtl;
-- Read-only tenant isolation. Writes go through the server (explicit tenant_org_id
-- in every query), which checks settings:branding and the plan flags.
CREATE POLICY tenant_isolation_org_tenant_ui_theme_dtl ON public.org_tenant_ui_theme_dtl
  FOR SELECT TO authenticated
  USING (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY tenant_isolation_org_tenant_ui_theme_dtl ON public.org_tenant_ui_theme_dtl IS 'Signed-in users may read saved themes of their own Organization only; no direct writes.';
-- The public key has no access; user JWTs may only read (policy above); service_role keeps full access.
REVOKE ALL ON public.org_tenant_ui_theme_dtl FROM anon;
REVOKE ALL ON public.org_tenant_ui_theme_dtl FROM authenticated;
GRANT SELECT ON public.org_tenant_ui_theme_dtl TO authenticated;
GRANT ALL ON public.org_tenant_ui_theme_dtl TO service_role;

-- ─── Backfill ──────────────────────────────────────────────────────────────
-- An Organization that set its own colours on org_tenants_mst gets one theme in
-- use: STANDARD with those colours as overrides. Colours equal to the old code
-- defaults (#3B82F6 / #10B981, never applied to the UI) or to STANDARD's seeds
-- are not custom, so those Organizations get no row and resolve to STANDARD.
-- (Remote check 2026-11-17: 5 Organizations, none custom.) brand_color_accent is
-- not carried over: accent is derived.
INSERT INTO public.org_tenant_ui_theme_dtl
  (tenant_org_id, theme_name, theme_name2, ui_theme_code, brand_color_primary, brand_color_secondary,
   is_active, created_by, created_info)
SELECT t.id, 'Custom', 'مخصص', 'STANDARD',
       CASE WHEN t.brand_color_primary ~ '^#[0-9A-Fa-f]{6}$' THEN upper(t.brand_color_primary) END,
       CASE WHEN t.brand_color_secondary ~ '^#[0-9A-Fa-f]{6}$' THEN upper(t.brand_color_secondary) END,
       true, 'system_migration', '0753_org_tenant_ui_theme backfill from org_tenants_mst'
FROM public.org_tenants_mst t
WHERE (t.brand_color_primary ~ '^#[0-9A-Fa-f]{6}$' AND upper(t.brand_color_primary) NOT IN ('#3B82F6', '#0AB6D8'))
   OR (t.brand_color_secondary ~ '^#[0-9A-Fa-f]{6}$' AND upper(t.brand_color_secondary) NOT IN ('#10B981', '#0E2A47'))
ON CONFLICT DO NOTHING;

COMMIT;
