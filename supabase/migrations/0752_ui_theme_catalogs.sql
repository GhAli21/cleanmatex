-- =============================================================================
-- Migration: 0752_ui_theme_catalogs.sql
-- Purpose:   HQ appearance catalogs for the theme runtime (UI Design System PR-07):
--              sys_ui_radius_cd     — corner-radius presets (SHARP, STANDARD, SOFT, ROUND)
--              sys_ui_font_pair_cd  — Latin + Arabic font pairings (STANDARD)
--              sys_ui_theme_cd      — ready-made themes: two brand seeds + one radius
--                                     preset + one font pair (10 seeded, STANDARD default)
--            Every Organization resolves to the default theme until it chooses one
--            (org_tenant_ui_theme_dtl, next migration).
-- Affected:  the three tables above (new). No existing object changes.
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-07.md (Task 2);
--            design THEMING_ARCHITECTURE_DESIGN.md sections 6.1–6.3.
--
-- Codes and values are UPPERCASE and mirrored exactly by
-- web-admin/lib/constants/ui-theme.ts (UI_THEME_SEEDS, DEFAULT_UI_*_CODE).
-- The seed colours are proven readable (text on the brand colour, brand-coloured
-- text on surfaces, 4.5:1, light and dark) by web-admin/__tests__/lib/theme/brand-palette.test.ts.
-- Additive only.
-- =============================================================================

BEGIN;

-- ─── 1. Radius presets ─────────────────────────────────────────────────────

-- Corner-radius presets an Organization theme can use. Values are written as
-- --cmx-radius-sm/md/lg on <html> by the server.
CREATE TABLE IF NOT EXISTS public.sys_ui_radius_cd (
  code                   TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  radius_sm              TEXT        NOT NULL,
  radius_md              TEXT        NOT NULL,
  radius_lg              TEXT        NOT NULL,
  is_default             BOOLEAN     NOT NULL DEFAULT false,
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
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_ui_radius_cd PRIMARY KEY (code),
  CONSTRAINT ck_suir_code CHECK (code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT ck_suir_lengths CHECK (
    radius_sm ~ '^[0-9]+(\.[0-9]+)?(px|rem)$'
    AND radius_md ~ '^[0-9]+(\.[0-9]+)?(px|rem)$'
    AND radius_lg ~ '^[0-9]+(\.[0-9]+)?(px|rem)$'),
  CONSTRAINT ck_suir_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- At most one live default preset.
CREATE UNIQUE INDEX IF NOT EXISTS uq_suir_one_default
  ON public.sys_ui_radius_cd (is_default) WHERE is_default AND rec_status = 1;

COMMENT ON TABLE  public.sys_ui_radius_cd IS 'HQ corner-radius presets for themes. Written only by HQ (service role); read by the server.';
COMMENT ON COLUMN public.sys_ui_radius_cd.code IS 'Preset code (UPPERCASE), e.g. STANDARD.';
COMMENT ON COLUMN public.sys_ui_radius_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_ui_radius_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_ui_radius_cd.radius_sm IS 'Small radius as a CSS length (px or rem); becomes --cmx-radius-sm.';
COMMENT ON COLUMN public.sys_ui_radius_cd.radius_md IS 'Medium radius as a CSS length; becomes --cmx-radius-md.';
COMMENT ON COLUMN public.sys_ui_radius_cd.radius_lg IS 'Large radius as a CSS length; becomes --cmx-radius-lg.';
COMMENT ON COLUMN public.sys_ui_radius_cd.is_default IS 'True for the preset used when nothing else is chosen; at most one live row.';
COMMENT ON COLUMN public.sys_ui_radius_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_ui_radius_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_ui_radius_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_ui_radius_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_ui_radius_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_ui_radius_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_ui_radius_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_ui_radius_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_ui_radius_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_ui_radius_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_ui_radius_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_ui_radius_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_ui_radius_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_ui_radius_cd.is_active IS 'False = hidden from pickers; themes already using it keep it.';
COMMENT ON CONSTRAINT pk_sys_ui_radius_cd ON public.sys_ui_radius_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_suir_code ON public.sys_ui_radius_cd IS 'UPPER_SNAKE code, mirrored by the TypeScript code pattern.';
COMMENT ON CONSTRAINT ck_suir_lengths ON public.sys_ui_radius_cd IS 'Only plain px/rem lengths, so a value written into the page style cannot carry anything else.';
COMMENT ON CONSTRAINT ck_suir_rec_status ON public.sys_ui_radius_cd IS 'Standard record status values.';
COMMENT ON INDEX public.uq_suir_one_default IS 'At most one live default radius preset.';

-- ─── 2. Font pairs ─────────────────────────────────────────────────────────

-- Latin + Arabic font pairings. The font files ship with the app (next/font),
-- so a new family needs a deploy; HQ can enable, rename and set the default.
CREATE TABLE IF NOT EXISTS public.sys_ui_font_pair_cd (
  code                   TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  font_family_en         TEXT        NOT NULL,
  font_family_ar         TEXT        NOT NULL,
  is_default             BOOLEAN     NOT NULL DEFAULT false,
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
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_ui_font_pair_cd PRIMARY KEY (code),
  CONSTRAINT ck_suif_code CHECK (code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT ck_suif_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- At most one live default pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_suif_one_default
  ON public.sys_ui_font_pair_cd (is_default) WHERE is_default AND rec_status = 1;

COMMENT ON TABLE  public.sys_ui_font_pair_cd IS 'HQ font pairings (Latin + Arabic) for themes. The code maps to fonts bundled in the app; written only by HQ (service role).';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.code IS 'Pair code (UPPERCASE); written as <html data-font>.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.font_family_en IS 'Latin font family name, for display in pickers only.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.font_family_ar IS 'Arabic font family name, for display in pickers only.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.is_default IS 'True for the pair used when nothing else is chosen; at most one live row.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_ui_font_pair_cd.is_active IS 'False = hidden from pickers; themes already using it keep it.';
COMMENT ON CONSTRAINT pk_sys_ui_font_pair_cd ON public.sys_ui_font_pair_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_suif_code ON public.sys_ui_font_pair_cd IS 'UPPER_SNAKE code, mirrored by the TypeScript code pattern.';
COMMENT ON CONSTRAINT ck_suif_rec_status ON public.sys_ui_font_pair_cd IS 'Standard record status values.';
COMMENT ON INDEX public.uq_suif_one_default IS 'At most one live default font pair.';

-- ─── 3. Themes ─────────────────────────────────────────────────────────────

-- Ready-made themes any Organization may pick on any plan. The server turns the
-- two seeds into every brand colour for light and dark (lib/theme/brand-palette.ts).
CREATE TABLE IF NOT EXISTS public.sys_ui_theme_cd (
  code                   TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  brand_color_primary    TEXT        NOT NULL,
  brand_color_secondary  TEXT        NOT NULL,
  ui_radius_code         TEXT        NOT NULL,
  ui_font_pair_code      TEXT        NOT NULL,
  is_default             BOOLEAN     NOT NULL DEFAULT false,
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
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_ui_theme_cd PRIMARY KEY (code),
  CONSTRAINT ck_suit_code CHECK (code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT ck_suit_colors CHECK (
    brand_color_primary ~ '^#[0-9A-Fa-f]{6}$'
    AND brand_color_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT fk_suit_radius FOREIGN KEY (ui_radius_code)
    REFERENCES public.sys_ui_radius_cd (code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_suit_font_pair FOREIGN KEY (ui_font_pair_code)
    REFERENCES public.sys_ui_font_pair_cd (code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_suit_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- At most one live default theme.
CREATE UNIQUE INDEX IF NOT EXISTS uq_suit_one_default
  ON public.sys_ui_theme_cd (is_default) WHERE is_default AND rec_status = 1;
-- FK lookups when HQ deactivates or renames a preset.
CREATE INDEX IF NOT EXISTS idx_suit_radius ON public.sys_ui_theme_cd (ui_radius_code);
CREATE INDEX IF NOT EXISTS idx_suit_font_pair ON public.sys_ui_theme_cd (ui_font_pair_code);

COMMENT ON TABLE  public.sys_ui_theme_cd IS 'HQ ready-made themes (two brand seeds + radius preset + font pair). Any Organization may pick one; the default is used by Organizations that chose nothing. Written only by HQ (service role).';
COMMENT ON COLUMN public.sys_ui_theme_cd.code IS 'Theme code (UPPERCASE), e.g. STANDARD.';
COMMENT ON COLUMN public.sys_ui_theme_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_ui_theme_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_ui_theme_cd.description IS 'English short description for the theme picker.';
COMMENT ON COLUMN public.sys_ui_theme_cd.description2 IS 'Arabic short description for the theme picker.';
COMMENT ON COLUMN public.sys_ui_theme_cd.brand_color_primary IS 'Primary brand seed #RRGGBB; used unchanged as the solid brand colour.';
COMMENT ON COLUMN public.sys_ui_theme_cd.brand_color_secondary IS 'Secondary brand seed #RRGGBB.';
COMMENT ON COLUMN public.sys_ui_theme_cd.ui_radius_code IS 'Radius preset of the theme.';
COMMENT ON COLUMN public.sys_ui_theme_cd.ui_font_pair_code IS 'Font pair of the theme.';
COMMENT ON COLUMN public.sys_ui_theme_cd.is_default IS 'True for the theme of Organizations that chose nothing; at most one live row.';
COMMENT ON COLUMN public.sys_ui_theme_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_ui_theme_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_ui_theme_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_ui_theme_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_ui_theme_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_ui_theme_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_ui_theme_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_ui_theme_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_ui_theme_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_ui_theme_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_ui_theme_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_ui_theme_cd.rec_order IS 'Display order in the picker (lower first).';
COMMENT ON COLUMN public.sys_ui_theme_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_ui_theme_cd.is_active IS 'False = hidden from the picker; Organizations already using it keep it.';
COMMENT ON CONSTRAINT pk_sys_ui_theme_cd ON public.sys_ui_theme_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_suit_code ON public.sys_ui_theme_cd IS 'UPPER_SNAKE code, mirrored by the TypeScript code pattern.';
COMMENT ON CONSTRAINT ck_suit_colors ON public.sys_ui_theme_cd IS 'Seeds are #RRGGBB only, so a value written into the page style cannot carry anything else.';
COMMENT ON CONSTRAINT fk_suit_radius ON public.sys_ui_theme_cd IS 'Radius preset must exist; a preset in use cannot be deleted or renamed.';
COMMENT ON CONSTRAINT fk_suit_font_pair ON public.sys_ui_theme_cd IS 'Font pair must exist; a pair in use cannot be deleted or renamed.';
COMMENT ON CONSTRAINT ck_suit_rec_status ON public.sys_ui_theme_cd IS 'Standard record status values.';
COMMENT ON INDEX public.uq_suit_one_default IS 'At most one live default theme.';
COMMENT ON INDEX public.idx_suit_radius IS 'Supports the radius FK check and "themes using this preset".';
COMMENT ON INDEX public.idx_suit_font_pair IS 'Supports the font pair FK check and "themes using this pair".';

-- ─── 4. Access, triggers ───────────────────────────────────────────────────

-- Catalogs stay closed to the public key (anon) and to user JWTs (authenticated):
-- the app reads them with the service role after its own checks, HQ writes them
-- with the service role. RLS is on with no policy, so a user JWT sees nothing even
-- if a grant is added by mistake later.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_ui_radius_cd', 'sys_ui_font_pair_cd', 'sys_ui_theme_cd'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t,
                   'Keeps updated_at and updated_count current.');
  END LOOP;
END $$;

-- ─── 5. Seeds ──────────────────────────────────────────────────────────────

-- STANDARD matches today's static --cmx-radius-* values in tokens.css, so the
-- default theme renders exactly as before.
INSERT INTO public.sys_ui_radius_cd (code, name, name2, radius_sm, radius_md, radius_lg, is_default, rec_order, created_by, created_info) VALUES
  ('SHARP',    'Sharp',    'حادة',    '0px',      '0px',     '0px',     false, 10, 'system_seed', '0752_ui_theme_catalogs'),
  ('STANDARD', 'Standard', 'قياسية',  '0.375rem', '0.5rem',  '0.75rem', true,  20, 'system_seed', '0752_ui_theme_catalogs'),
  ('SOFT',     'Soft',     'ناعمة',   '0.5rem',   '0.75rem', '1rem',    false, 30, 'system_seed', '0752_ui_theme_catalogs'),
  ('ROUND',    'Round',    'دائرية',  '0.75rem',  '1rem',    '1.5rem',  false, 40, 'system_seed', '0752_ui_theme_catalogs')
ON CONFLICT (code) DO NOTHING;

-- One pair: the system Latin stack plus the bundled Noto Sans Arabic (PLAN_PR-07 ruling 5).
INSERT INTO public.sys_ui_font_pair_cd (code, name, name2, font_family_en, font_family_ar, is_default, rec_order, created_by, created_info) VALUES
  ('STANDARD', 'Standard', 'قياسي', 'System UI', 'Noto Sans Arabic', true, 10, 'system_seed', '0752_ui_theme_catalogs')
ON CONFLICT (code) DO NOTHING;

-- The ten themes of design 6.3. Seeds equal UI_THEME_SEEDS in lib/constants/ui-theme.ts.
INSERT INTO public.sys_ui_theme_cd (code, name, name2, description, description2, brand_color_primary, brand_color_secondary, ui_radius_code, ui_font_pair_code, is_default, rec_order, created_by, created_info) VALUES
  ('STANDARD', 'CleanMateX',  'كلين ميت إكس', 'Aqua and navy, the CleanMateX brand', 'أزرق مائي وكحلي، هوية كلين ميت إكس', '#0AB6D8', '#0E2A47', 'STANDARD', 'STANDARD', true,  10, 'system_seed', '0752_ui_theme_catalogs'),
  ('OCEAN',    'Ocean',       'المحيط',       'Classic business blue',               'أزرق كلاسيكي للأعمال',              '#2563EB', '#0F172A', 'STANDARD', 'STANDARD', false, 20, 'system_seed', '0752_ui_theme_catalogs'),
  ('EMERALD',  'Emerald',     'الزمرد',       'Fresh green',                         'أخضر منعش',                         '#059669', '#064E3B', 'STANDARD', 'STANDARD', false, 30, 'system_seed', '0752_ui_theme_catalogs'),
  ('TEAL',     'Teal',        'الفيروزي',     'Calm teal',                           'فيروزي هادئ',                       '#0D9488', '#134E4A', 'STANDARD', 'STANDARD', false, 40, 'system_seed', '0752_ui_theme_catalogs'),
  ('ROYAL',    'Royal',       'الملكي',       'Purple',                              'بنفسجي',                            '#7C3AED', '#1E1B4B', 'STANDARD', 'STANDARD', false, 50, 'system_seed', '0752_ui_theme_catalogs'),
  ('ROSE',     'Rose',        'الوردي',       'Crimson',                             'قرمزي',                             '#E11D48', '#4C0519', 'STANDARD', 'STANDARD', false, 60, 'system_seed', '0752_ui_theme_catalogs'),
  ('SUNSET',   'Sunset',      'الغروب',       'Warm orange',                         'برتقالي دافئ',                      '#EA580C', '#7C2D12', 'STANDARD', 'STANDARD', false, 70, 'system_seed', '0752_ui_theme_catalogs'),
  ('GOLD',     'Gold',        'الذهبي',       'Amber and brown',                     'كهرماني وبني',                      '#B45309', '#451A03', 'STANDARD', 'STANDARD', false, 80, 'system_seed', '0752_ui_theme_catalogs'),
  ('SLATE',    'Slate',       'الأردوازي',    'Neutral blue-grey',                   'رمادي مزرق محايد',                  '#475569', '#0F172A', 'STANDARD', 'STANDARD', false, 90, 'system_seed', '0752_ui_theme_catalogs'),
  ('GRAPHITE', 'Graphite',    'الغرافيت',     'Near-black, minimal',                 'أسود تقريبًا، بسيط',                '#18181B', '#52525B', 'STANDARD', 'STANDARD', false, 100, 'system_seed', '0752_ui_theme_catalogs')
ON CONFLICT (code) DO NOTHING;

COMMIT;
