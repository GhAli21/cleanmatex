-- =============================================================================
-- 0348_ntf_runtime_tables.sql
-- Purpose: Notification Hub – core runtime tables.
--          org_ntf_inbox_mst   — per-user notification inbox (IN_APP store)
--          org_ntf_outbox_dtl  — multi-channel dispatch queue (outbox pattern)
--          org_ntf_delivery_log_dtl — immutable per-attempt delivery audit log
--          Supabase Realtime enabled on org_ntf_inbox_mst for bell updates.
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-06
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. org_ntf_inbox_mst  (17 chars)
--    The IN_APP notification inbox. One row per recipient per notification.
--    Supabase Realtime subscribed here — INSERT triggers the bell badge update
--    in real time without polling.
--    idempotency_key prevents duplicate delivery for the same business event.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_ntf_inbox_mst (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID    NOT NULL,

  -- Recipient
  recipient_user_id UUID    NOT NULL,

  -- Event context
  event_code        TEXT    NOT NULL REFERENCES sys_ntf_events_cd(code),
  category_code     TEXT    REFERENCES sys_ntf_categories_cd(code),
  template_code     TEXT    REFERENCES sys_ntf_templates_mst(template_code),

  -- Rendered content (bilingual, pre-rendered at dispatch time)
  title             TEXT    NOT NULL,
  title2            TEXT,                        -- Arabic title
  body              TEXT    NOT NULL,
  body2             TEXT,                        -- Arabic body

  -- Channel always IN_APP for this table; outbox handles other channels
  channel_code      TEXT    NOT NULL DEFAULT 'IN_APP'
                              REFERENCES sys_notification_channel_cd(code),

  -- Priority (copied from event for fast UI sorting without join)
  priority          TEXT    NOT NULL DEFAULT 'NORMAL'
                              CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT','CRITICAL')),

  -- Read state
  is_read           BOOLEAN NOT NULL DEFAULT false,
  read_at           TIMESTAMP,

  -- Optional action
  action_url        TEXT,                        -- deep-link or route, e.g. /orders/abc123
  action_label      TEXT,                        -- EN button label, e.g. "View Order"
  action_label2     TEXT,                        -- Arabic button label

  -- Source reference for linking back to the business entity
  source_entity_type  TEXT,                      -- e.g. 'order', 'payment', 'campaign'
  source_entity_id    TEXT,                      -- e.g. the order UUID

  -- Metadata for UI rendering (icons, colors, badge counts)
  metadata          JSONB,

  -- Expiry (expired notifications are hidden from the bell but kept for audit)
  expires_at        TIMESTAMP,

  -- Idempotency — prevents duplicate rows for the same business event + recipient
  idempotency_key   TEXT    NOT NULL,

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

  UNIQUE (idempotency_key)
);

-- Query pattern: fetch unread for a user, sorted newest-first
CREATE INDEX IF NOT EXISTS idx_ntf_inbox_user_unread
  ON org_ntf_inbox_mst (tenant_org_id, recipient_user_id, is_read, created_at DESC);

-- Query pattern: fetch all for a user (notification center pagination)
CREATE INDEX IF NOT EXISTS idx_ntf_inbox_user_all
  ON org_ntf_inbox_mst (tenant_org_id, recipient_user_id, created_at DESC);

-- Query pattern: filter by category (tab filtering in UI)
CREATE INDEX IF NOT EXISTS idx_ntf_inbox_category
  ON org_ntf_inbox_mst (tenant_org_id, recipient_user_id, category_code, created_at DESC);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_ntf_inbox_tenant
  ON org_ntf_inbox_mst (tenant_org_id);

-- RLS
ALTER TABLE org_ntf_inbox_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_ntf_inbox_mst
  ON org_ntf_inbox_mst
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Enable Supabase Realtime — required for the notification bell to update
-- without polling. FULL replica identity sends the full row on every change,
-- which lets the client filter on recipient_user_id client-side.
ALTER TABLE org_ntf_inbox_mst REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE org_ntf_inbox_mst;

COMMENT ON TABLE org_ntf_inbox_mst IS
  'IN_APP notification inbox. Supabase Realtime subscribed — bell badge updates on INSERT. One row per recipient per notification event.';

COMMENT ON COLUMN org_ntf_inbox_mst.idempotency_key IS
  'Format: {tenant_org_id}:{event_code}:{source_entity_id}:{recipient_user_id}. Prevents duplicate inbox rows for the same business event.';

COMMENT ON COLUMN org_ntf_inbox_mst.expires_at IS
  'Expired notifications are hidden from the active bell but retained for audit. NULL = never expires.';

-- =============================================================================
-- 2. org_ntf_outbox_dtl  (18 chars)
--    Multi-channel dispatch queue using the outbox pattern.
--    The orchestrator writes here for EMAIL, SMS, WHATSAPP, PUSH.
--    Supabase pg_cron calls POST /api/notifications/process-outbox every minute
--    to process QUEUED and FAILED_TEMPORARY rows.
--    Idempotency key prevents duplicate dispatches.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_ntf_outbox_dtl (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID    NOT NULL,

  -- Source notification (optional link back to inbox row)
  inbox_id            UUID    REFERENCES org_ntf_inbox_mst(id),

  -- Routing
  channel_code        TEXT    NOT NULL REFERENCES sys_notification_channel_cd(code),
  provider_code       TEXT    REFERENCES sys_ntf_providers_cd(code),
  recipient_address   TEXT,                      -- email, phone number, FCM token, etc.
  recipient_user_id   UUID,                      -- for linking back to the user

  -- Content (pre-rendered at write time)
  rendered_subject    TEXT,
  rendered_subject2   TEXT,
  rendered_body       TEXT    NOT NULL,
  rendered_body2      TEXT,
  metadata            JSONB,                     -- channel-specific payload overrides

  -- Event context (for retry and audit without joining inbox)
  event_code          TEXT    REFERENCES sys_ntf_events_cd(code),
  source_entity_type  TEXT,
  source_entity_id    TEXT,

  -- State machine
  -- QUEUED → PROCESSING → SENT → DELIVERED → READ
  -- QUEUED → PROCESSING → FAILED_TEMPORARY → RETRYING → SENT
  -- QUEUED → PROCESSING → FAILED_PERMANENT
  -- QUEUED → SKIPPED (feature flag off, quota exceeded, consent missing, quiet hours deferred then cancelled)
  -- Any state → CANCELLED
  status              TEXT    NOT NULL DEFAULT 'QUEUED'
                                CHECK (status IN (
                                  'QUEUED','PROCESSING','SENT','DELIVERED','READ',
                                  'FAILED_TEMPORARY','FAILED_PERMANENT',
                                  'SKIPPED','CANCELLED'
                                )),
  skip_reason         TEXT,                      -- populated when status = SKIPPED
  error_message       TEXT,                      -- last error from provider

  -- Scheduling and retry
  scheduled_at        TIMESTAMP NOT NULL DEFAULT NOW(), -- quiet hours can delay this
  next_retry_at       TIMESTAMP,
  retry_count         INTEGER   NOT NULL DEFAULT 0,
  max_retries         INTEGER   NOT NULL DEFAULT 5,

  -- Provider tracking
  provider_message_id TEXT,                      -- returned by provider (SID, message ID, etc.)

  -- Timestamps
  sent_at             TIMESTAMP,
  delivered_at        TIMESTAMP,
  read_at             TIMESTAMP,

  -- Idempotency
  idempotency_key     TEXT    NOT NULL,

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

  UNIQUE (idempotency_key)
);

-- Query pattern: outbox processor fetches QUEUED rows due for dispatch
CREATE INDEX IF NOT EXISTS idx_ntf_outbox_dispatch
  ON org_ntf_outbox_dtl (tenant_org_id, status, scheduled_at)
  WHERE status IN ('QUEUED', 'FAILED_TEMPORARY');

-- Query pattern: retry sweep fetches FAILED_TEMPORARY rows with next_retry_at due
CREATE INDEX IF NOT EXISTS idx_ntf_outbox_retry
  ON org_ntf_outbox_dtl (status, next_retry_at)
  WHERE status = 'FAILED_TEMPORARY';

-- Query pattern: delivery log page filters by channel and status
CREATE INDEX IF NOT EXISTS idx_ntf_outbox_channel
  ON org_ntf_outbox_dtl (tenant_org_id, channel_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ntf_outbox_tenant
  ON org_ntf_outbox_dtl (tenant_org_id);

-- RLS
ALTER TABLE org_ntf_outbox_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_ntf_outbox_dtl
  ON org_ntf_outbox_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE org_ntf_outbox_dtl IS
  'Multi-channel dispatch queue (outbox pattern). pg_cron processes QUEUED rows every minute via POST /api/notifications/process-outbox.';

COMMENT ON COLUMN org_ntf_outbox_dtl.skip_reason IS
  'Populated when status=SKIPPED. Values: NO_MARKETING_CONSENT, QUOTA_EXCEEDED, CHANNEL_DISABLED, FEATURE_FLAG_OFF, QUIET_HOURS_CANCELLED.';

COMMENT ON COLUMN org_ntf_outbox_dtl.scheduled_at IS
  'Normally NOW(). Set to future time by quiet-hours logic for non-URGENT/CRITICAL messages.';

-- =============================================================================
-- 3. org_ntf_delivery_log_dtl  (25 chars)
--    Immutable per-attempt audit log. One row per dispatch attempt.
--    Never updated after INSERT — append-only for compliance and debugging.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_ntf_delivery_log_dtl (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID    NOT NULL,
  outbox_id           UUID    NOT NULL REFERENCES org_ntf_outbox_dtl(id),

  -- Attempt details
  attempt_number      INTEGER NOT NULL DEFAULT 1,
  status              TEXT    NOT NULL,           -- the status after this attempt
  provider_code       TEXT,
  provider_message_id TEXT,
  provider_response   JSONB,                      -- raw provider response (masked — no secrets)
  error_code          TEXT,
  error_message       TEXT,
  duration_ms         INTEGER,                    -- time taken for this attempt in ms

  -- Immutable timestamp — no updated_at on this table
  logged_at           TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Minimal audit (no update fields — this table is append-only)
  rec_status          SMALLINT DEFAULT 1,
  rec_notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_ntf_dlog_outbox
  ON org_ntf_delivery_log_dtl (outbox_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_ntf_dlog_tenant
  ON org_ntf_delivery_log_dtl (tenant_org_id, logged_at DESC);

-- RLS
ALTER TABLE org_ntf_delivery_log_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_ntf_delivery_log
  ON org_ntf_delivery_log_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE org_ntf_delivery_log_dtl IS
  'Immutable per-attempt delivery audit log. Append-only — never update rows after INSERT. One row per dispatch attempt per outbox entry.';

COMMENT ON COLUMN org_ntf_delivery_log_dtl.provider_response IS
  'Raw provider response stored for debugging. Sensitive fields (API keys, tokens) must be masked before storing.';

COMMIT;
