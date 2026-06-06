-- =============================================================================
-- 0344_ntf_catalog_schema.sql
-- Purpose: Notification Hub – global event catalog schema
--          Creates sys_ntf_categories_cd, sys_ntf_events_cd,
--          sys_ntf_event_chan_map and adds WEB_SOCKET to existing
--          sys_notification_channel_cd (migration 0053).
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Feature abbreviation: ntf  (registered in feature-abbreviations.md)
-- Author: CleanMateX Development Team
-- Created: 2026-06-06
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. sys_ntf_categories_cd
--    Global catalog of 27 notification event categories.
--    No tenant_org_id — shared across all tenants.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_categories_cd (
  code              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  name2             TEXT,                        -- Arabic
  description       TEXT,
  description2      TEXT,                        -- Arabic
  icon              TEXT,
  color             TEXT,                        -- Hex colour for UI badge
  display_order     INTEGER DEFAULT 0,

  -- Audit
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        TEXT,
  updated_info      TEXT,
  rec_status        SMALLINT DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ntf_cat_active
  ON sys_ntf_categories_cd (is_active, display_order);

COMMENT ON TABLE sys_ntf_categories_cd IS
  'Notification event categories (ORDER, PAYMENT, DELIVERY, SECURITY, …)';

-- =============================================================================
-- 2. sys_ntf_events_cd
--    Global catalog of 116 notification event codes.
--    Each event belongs to a category and carries routing metadata.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_events_cd (
  code                    TEXT PRIMARY KEY,      -- e.g. 'order.created'
  category_code           TEXT NOT NULL
                            REFERENCES sys_ntf_categories_cd(code),
  name                    TEXT NOT NULL,
  name2                   TEXT,                  -- Arabic
  description             TEXT,
  description2            TEXT,                  -- Arabic

  -- Routing metadata
  priority                TEXT NOT NULL DEFAULT 'NORMAL'
                            CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT','CRITICAL')),
  is_transactional        BOOLEAN NOT NULL DEFAULT true,
                                                 -- false = requires marketing consent
  requires_consent        BOOLEAN NOT NULL DEFAULT false,
  default_recipients      TEXT[],                -- e.g. ARRAY['order_creator','branch_manager']
  idempotency_key_pattern TEXT,                  -- e.g. '{order_id}:{event_code}'

  -- Audit
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMP,
  updated_by    TEXT,
  updated_info  TEXT,
  rec_status    SMALLINT DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ntf_events_category
  ON sys_ntf_events_cd (category_code, is_active);

CREATE INDEX IF NOT EXISTS idx_ntf_events_priority
  ON sys_ntf_events_cd (priority, is_active);

COMMENT ON TABLE sys_ntf_events_cd IS
  'Notification event codes – 116 events across 27 categories';

COMMENT ON COLUMN sys_ntf_events_cd.is_transactional IS
  'Transactional events bypass marketing consent. Marketing events require consent.';

COMMENT ON COLUMN sys_ntf_events_cd.default_recipients IS
  'Symbolic recipient roles resolved at dispatch time: order_creator, branch_manager, driver, customer, admin_users';

-- =============================================================================
-- 3. sys_ntf_event_chan_map  (22 chars – within limit)
--    Default channel mapping per event.
--    Tenant settings and user preferences can override.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_event_chan_map (
  event_code    TEXT NOT NULL REFERENCES sys_ntf_events_cd(code),
  channel_code  TEXT NOT NULL REFERENCES sys_notification_channel_cd(code),
  is_default    BOOLEAN NOT NULL DEFAULT true,
  can_override  BOOLEAN NOT NULL DEFAULT true,   -- user can disable this channel for event

  -- Audit
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMP,
  updated_by    TEXT,
  updated_info  TEXT,
  rec_status    SMALLINT DEFAULT 1,
  rec_notes     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (event_code, channel_code)
);

CREATE INDEX IF NOT EXISTS idx_ntf_ecm_channel
  ON sys_ntf_event_chan_map (channel_code, is_active);

COMMENT ON TABLE sys_ntf_event_chan_map IS
  'Default channel assignments per notification event. Tenant/user overrides apply at dispatch.';

-- =============================================================================
-- 4. Add WEB_SOCKET channel to existing sys_notification_channel_cd (mig 0053)
--    Schema of that table is unchanged – INSERT only.
-- =============================================================================

INSERT INTO sys_notification_channel_cd (
  code, name, name2,
  description, description2,
  display_order, icon, color,
  channel_type,
  requires_configuration, supports_rich_content,
  supports_attachments, max_length,
  cost_per_message, daily_limit, rate_limit_per_minute,
  is_system, is_active,
  metadata
) VALUES (
  'WEB_SOCKET',
  'Web Socket',
  'ويب سوكيت',
  'Real-time in-browser notifications via Supabase Realtime',
  'إشعارات فورية داخل المتصفح عبر Supabase Realtime',
  6,
  'zap',
  '#6366F1',
  'web_socket',
  false,    -- no external configuration required; Supabase Realtime is built-in
  true,
  false,
  NULL,
  0,
  NULL,
  NULL,
  true,
  true,
  '{"provider": "supabase_realtime", "delivery_tracking": true, "read_receipt_supported": true}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name         = EXCLUDED.name,
  name2        = EXCLUDED.name2,
  description  = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  metadata     = EXCLUDED.metadata,
  updated_at   = CURRENT_TIMESTAMP;

COMMIT;
