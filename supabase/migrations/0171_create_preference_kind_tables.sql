-- ==================================================================
-- Migration: 0171_create_preference_kind_tables.sql
-- Purpose: Create sys_preference_kind_cd (global catalog) and
--          org_preference_kind_cf (per-tenant overrides) for the
--          dynamic preference panel tabs system.
-- Do NOT apply — user reviews and applies manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: sys_preference_kind_cd (global, no RLS)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_preference_kind_cd (
  -- Primary key
  kind_code        VARCHAR(30) PRIMARY KEY,

  -- Display
  name             VARCHAR(250),
  name2            VARCHAR(250),
  description      TEXT,
  description2     TEXT,

  -- Rendering
  kind_bg_color    VARCHAR(20),
  main_type_code   VARCHAR(30),
  icon             VARCHAR(100),

  -- Visibility flags
  is_show_in_quick_bar  BOOLEAN NOT NULL DEFAULT true,
  is_show_for_customer  BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by   VARCHAR(120),
  created_info TEXT,
  updated_at   TIMESTAMP,
  updated_by   VARCHAR(120),
  updated_info TEXT,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  rec_notes    VARCHAR(200),
  is_active    BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE sys_preference_kind_cd IS 'Global catalog of preference kinds driving the dynamic tab row in the order preferences panel';
COMMENT ON COLUMN sys_preference_kind_cd.kind_code      IS 'Matches preference_sys_kind discriminator: service_prefs, packing_prefs, condition_stain, condition_damag, condition_special, condition_pattern, condition_material, color, note';
COMMENT ON COLUMN sys_preference_kind_cd.main_type_code IS 'Rendering driver: preferences (selector list), conditions (toggle chips), color (swatch grid), notes (textarea)';
COMMENT ON COLUMN sys_preference_kind_cd.kind_bg_color  IS 'CSS color string for tab badge background';

-- ==================================================================
-- SECTION 2: Seed 9 global kinds
-- ==================================================================

INSERT INTO sys_preference_kind_cd (
  kind_code, name, name2,
  kind_bg_color, main_type_code, icon,
  is_show_in_quick_bar, is_show_for_customer,
  rec_order, is_active, created_by
) VALUES
  ('service_prefs',      'Service Preferences', 'تفضيلات الخدمة',  '#1976D2', 'preferences', 'mdi-tune',            true, true, 10, true, 'system_admin'),
  ('packing_prefs',      'Packing Preferences', 'تفضيلات التعبئة', '#388E3C', 'preferences', 'mdi-package-variant', true, true, 20, true, 'system_admin'),
  ('condition_stain',    'Stains',              'البقع',            '#E53935', 'conditions',  'mdi-water',           true, true, 30, true, 'system_admin'),
  ('condition_damag',    'Damage',              'التلف',            '#F57C00', 'conditions',  'mdi-alert-circle',    true, true, 40, true, 'system_admin'),
  ('condition_special',  'Special Care',        'عناية خاصة',       '#7B1FA2', 'conditions',  'mdi-heart',           true, true, 50, true, 'system_admin'),
  ('condition_pattern',  'Patterns',            'الأنماط',          '#0097A7', 'conditions',  'mdi-shape',           true, true, 60, true, 'system_admin'),
  ('condition_material', 'Material',            'المادة',           '#5D4037', 'conditions',  'mdi-fabric',          true, true, 70, true, 'system_admin'),
  ('color',              'Colors',              'الألوان',          '#F50057', 'color',       'mdi-palette',         true, true, 80, true, 'system_admin'),
  ('note',               'Notes',               'الملاحظات',        '#546E7A', 'notes',       'mdi-note-text',       true, true, 90, true, 'system_admin')
ON CONFLICT (kind_code) DO NOTHING;

-- ==================================================================
-- SECTION 3: org_preference_kind_cf (per-tenant overrides, with RLS)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_preference_kind_cf (
  -- Primary key
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  kind_code     VARCHAR(30) NOT NULL REFERENCES sys_preference_kind_cd(kind_code),

  -- Tenant overrides (NULL = use sys default)
  name          VARCHAR(250),
  name2         VARCHAR(250),
  kind_bg_color VARCHAR(20),

  -- Visibility overrides
  is_show_in_quick_bar BOOLEAN NOT NULL DEFAULT true,
  is_show_for_customer BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by   VARCHAR(120),
  created_info TEXT,
  updated_at   TIMESTAMP,
  updated_by   VARCHAR(120),
  updated_info TEXT,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  rec_notes    VARCHAR(200),
  is_active    BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (tenant_org_id, kind_code)
);

COMMENT ON TABLE org_preference_kind_cf IS 'Per-tenant overrides for preference kind display: name, color, visibility. Seeded from sys_preference_kind_cd on tenant init.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_tenant
  ON org_preference_kind_cf(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_tn_st
  ON org_preference_kind_cf(tenant_org_id, rec_status);

CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_tn_act
  ON org_preference_kind_cf(tenant_org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_created
  ON org_preference_kind_cf(tenant_org_id, created_at DESC);

-- Enable RLS
ALTER TABLE org_preference_kind_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_preference_kind_cf
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- ==================================================================
-- SECTION 4: Seed org_preference_kind_cf for all existing tenants
-- ==================================================================

INSERT INTO org_preference_kind_cf (
  tenant_org_id, kind_code,
  is_show_in_quick_bar, is_show_for_customer,
  rec_order, is_active, created_by
)
SELECT
  t.id,
  s.kind_code,
  s.is_show_in_quick_bar,
  s.is_show_for_customer,
  s.rec_order,
  true,
  'system_migration'
FROM org_tenants_mst t
CROSS JOIN sys_preference_kind_cd s
WHERE t.rec_status = 1
ON CONFLICT (tenant_org_id, kind_code) DO NOTHING;

-- ==================================================================
-- SECTION 5: Update SPECIAL_CARE + DELICATE_COND to condition_special
-- These were seeded in 0165 under condition_stain by mistake.
-- ==================================================================

UPDATE sys_service_preference_cd
SET preference_sys_kind = 'condition_special'
WHERE code IN ('SPECIAL_CARE', 'DELICATE_COND')
  AND preference_sys_kind = 'condition_stain';

-- Backfill org_service_preference_cf denormalized column
UPDATE org_service_preference_cf cf
SET preference_sys_kind = 'condition_special'
WHERE cf.preference_code IN ('SPECIAL_CARE', 'DELICATE_COND');

COMMIT;
