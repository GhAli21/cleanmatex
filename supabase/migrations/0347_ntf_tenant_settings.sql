-- =============================================================================
-- 0347_ntf_tenant_settings.sql
-- Purpose: Notification Hub – tenant-scoped settings and user preferences.
--          Creates org_ntf_settings_cf (per-tenant, per-channel config) and
--          org_ntf_user_prefs_dtl (per-user, per-channel, per-event prefs).
--          RLS enabled on both tables.
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-06
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. org_ntf_settings_cf  (20 chars)
--    Tenant-level channel configuration.
--    One row per (tenant_org_id, channel_code) pair.
--    Controls whether a channel is enabled for the tenant and global
--    quiet-hours policy. Admins manage this; users see individual prefs below.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_ntf_settings_cf (
  tenant_org_id       UUID    NOT NULL,
  channel_code        TEXT    NOT NULL REFERENCES sys_notification_channel_cd(code),

  -- Channel toggle
  is_enabled          BOOLEAN NOT NULL DEFAULT false,  -- tenant must explicitly enable each channel

  -- Quiet hours (non-URGENT/CRITICAL messages are delayed until end)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start   TIME,                            -- e.g. '22:00'
  quiet_hours_end     TIME,                            -- e.g. '08:00'
  quiet_hours_tz      TEXT,                            -- tenant timezone, e.g. 'Asia/Riyadh'

  -- Optional per-channel limits (NULL = use plan default)
  daily_limit         INTEGER,

  -- Flexible channel-specific overrides
  metadata            JSONB,

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
  is_active     BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (tenant_org_id, channel_code)
);

-- Standard tenant indexes
CREATE INDEX IF NOT EXISTS idx_ntf_stng_tenant
  ON org_ntf_settings_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ntf_stng_tenant_active
  ON org_ntf_settings_cf (tenant_org_id, is_active);

-- RLS
ALTER TABLE org_ntf_settings_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_ntf_settings_cf
  ON org_ntf_settings_cf
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE org_ntf_settings_cf IS
  'Tenant-level channel settings: enable/disable per channel, quiet hours, daily limits.';

COMMENT ON COLUMN org_ntf_settings_cf.is_enabled IS
  'Tenant must explicitly enable each channel. Defaults to false for all channels.';

COMMENT ON COLUMN org_ntf_settings_cf.quiet_hours_enabled IS
  'When true, non-URGENT/CRITICAL messages are deferred until quiet_hours_end. URGENT and CRITICAL always bypass.';

-- Seed IN_APP as enabled by default for all tenants is done at the app layer
-- (when a tenant is provisioned). This table starts empty.

-- =============================================================================
-- 2. org_ntf_user_prefs_dtl  (24 chars)
--    Per-user, per-channel, per-event notification preferences.
--    A row with event_code = NULL means the preference applies to all events
--    on that channel (coarse-grained). A row with event_code set is a fine-
--    grained override for a specific event.
--    branch_id = NULL means the preference applies to all branches.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_ntf_user_prefs_dtl (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID    NOT NULL,
  user_id         UUID    NOT NULL,
  branch_id       UUID,                                     -- NULL = all branches

  -- Scope
  channel_code    TEXT    NOT NULL REFERENCES sys_notification_channel_cd(code),
  event_code      TEXT    REFERENCES sys_ntf_events_cd(code),  -- NULL = all events on channel

  -- Preference
  is_enabled      BOOLEAN NOT NULL DEFAULT true,

  -- Marketing consent (only relevant for non-transactional events)
  marketing_consent   BOOLEAN   NOT NULL DEFAULT false,
  consent_given_at    TIMESTAMP,
  consent_withdrawn_at TIMESTAMP,
  consent_ip          TEXT,

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
  is_active     BOOLEAN NOT NULL DEFAULT true,

  -- A user can have one preference row per channel+event+branch combination
  UNIQUE (tenant_org_id, user_id, channel_code, event_code, branch_id),

  -- Composite FK enforces branch must belong to same tenant (org_branches_mst PK is (id, tenant_org_id))
  FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id)
);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_ntf_uprefs_tenant
  ON org_ntf_user_prefs_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ntf_uprefs_user
  ON org_ntf_user_prefs_dtl (tenant_org_id, user_id, channel_code);

CREATE INDEX IF NOT EXISTS idx_ntf_uprefs_event
  ON org_ntf_user_prefs_dtl (tenant_org_id, user_id, event_code)
  WHERE event_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ntf_uprefs_consent
  ON org_ntf_user_prefs_dtl (tenant_org_id, marketing_consent)
  WHERE marketing_consent = true;

-- RLS
ALTER TABLE org_ntf_user_prefs_dtl ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage all preferences in their tenant;
-- users can only manage their own.
-- We use a single policy at tenant level here; row-level user filtering
-- is enforced in the application layer (API routes check user_id = current user).
CREATE POLICY tenant_isolation_org_ntf_user_prefs
  ON org_ntf_user_prefs_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE org_ntf_user_prefs_dtl IS
  'Per-user notification preferences. event_code = NULL = applies to all events on that channel. branch_id = NULL = all branches.';

COMMENT ON COLUMN org_ntf_user_prefs_dtl.marketing_consent IS
  'Marketing consent flag. Must be true before any non-transactional notification is sent to this user on this channel.';

COMMENT ON COLUMN org_ntf_user_prefs_dtl.event_code IS
  'NULL = coarse preference (all events on channel). Set = fine-grained override for one event.';

COMMIT;
