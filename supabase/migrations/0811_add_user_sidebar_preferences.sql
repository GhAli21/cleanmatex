-- =============================================================================
-- Migration: 0811_add_user_sidebar_preferences.sql
-- Purpose:   Add per-user sidebar theme and tenant-scoped pinned menu items
--            columns to sys_users_mst so each user can customize their own
--            sidebar color palette and pinned screens across sessions/devices.
-- =============================================================================

-- 1. User's chosen sidebar color palette (NULL falls back to default 'OCEAN').
ALTER TABLE sys_users_mst
  ADD COLUMN IF NOT EXISTS ui_sidebar_theme TEXT NULL;

-- 2. User's pinned sidebar menu keys, scoped per tenant_org_id as JSONB:
--    e.g. { "<tenant_org_id>": ["orders_new", "orders_workboard", "orders_ready"] }
ALTER TABLE sys_users_mst
  ADD COLUMN IF NOT EXISTS ui_sidebar_pinned JSONB NULL;

-- 3. Restrict ui_sidebar_theme to the supported palette codes (mirrors UI_SIDEBAR_THEMES).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sys_users_ui_sb_theme'
      AND conrelid = 'sys_users_mst'::regclass
  ) THEN
    ALTER TABLE sys_users_mst
      ADD CONSTRAINT chk_sys_users_ui_sb_theme
      CHECK (
        ui_sidebar_theme IS NULL
        OR ui_sidebar_theme IN ('OCEAN', 'MIDNIGHT', 'EMERALD', 'INDIGO', 'SAND')
      );
  END IF;
END $$;

-- 4. Ensure ui_sidebar_pinned is always a JSON object (tenant_org_id -> string[]) when set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sys_users_ui_sb_pinned'
      AND conrelid = 'sys_users_mst'::regclass
  ) THEN
    ALTER TABLE sys_users_mst
      ADD CONSTRAINT chk_sys_users_ui_sb_pinned
      CHECK (
        ui_sidebar_pinned IS NULL
        OR jsonb_typeof(ui_sidebar_pinned) = 'object'
      );
  END IF;
END $$;

COMMENT ON COLUMN sys_users_mst.ui_sidebar_theme IS
  'Per-user sidebar color palette code (OCEAN, MIDNIGHT, EMERALD, INDIGO, SAND). NULL defaults to OCEAN.';

COMMENT ON COLUMN sys_users_mst.ui_sidebar_pinned IS
  'Per-user pinned sidebar menu comp_codes stored as JSONB map keyed by tenant_org_id UUID so pins stay isolated per tenant.';

COMMENT ON CONSTRAINT chk_sys_users_ui_sb_theme ON sys_users_mst IS
  'Enforces valid sidebar palette codes matching web-admin UI_SIDEBAR_THEMES.';

COMMENT ON CONSTRAINT chk_sys_users_ui_sb_pinned ON sys_users_mst IS
  'Enforces that ui_sidebar_pinned stores a JSON object keyed by tenant_org_id.';
