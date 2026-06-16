-- ============================================================
-- 0372_hq_ntf_webhook_events.sql
-- HQ Notification — Provider Webhook Event Log
-- Platform-only table (no RLS — accessed via service role).
-- Stores raw inbound callbacks from providers (Twilio, Meta,
-- FCM, VAPID, etc.) for idempotent replay protection and audit.
-- ============================================================

CREATE TABLE IF NOT EXISTS hq_ntf_webhook_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identity
  provider_code     TEXT        NOT NULL,           -- e.g. TWILIO, META_WHATSAPP, FCM
  event_type        TEXT,                           -- e.g. 'delivered', 'failed', 'read'

  -- Idempotency key — set to provider's unique callback ID when available,
  -- or SHA-256(provider_code || ':' || request_body) as fallback
  idempotency_key   TEXT        NOT NULL UNIQUE,

  -- Raw payload (stored for debugging / replay)
  payload           JSONB,

  -- Security
  signature_valid   BOOLEAN     NOT NULL DEFAULT false,

  -- Processing state
  processed_at      TIMESTAMP,                      -- NULL = not yet processed
  processing_error  TEXT,                           -- set on processing failure

  -- Link to dispatch log (optional — populated when providerMessageId matches)
  dispatch_log_id   UUID,                           -- FK to hq_ntf_dispatch_log.id (soft ref)
  tenant_org_id     UUID,                           -- populated when resolved from dispatch log

  -- Audit
  created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        VARCHAR(120) DEFAULT 'webhook_ingestion',
  rec_status        SMALLINT    NOT NULL DEFAULT 1,

  CONSTRAINT hq_ntf_webhook_events_idempotency_key_key UNIQUE (idempotency_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hq_ntf_webhook_provider
  ON hq_ntf_webhook_events (provider_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hq_ntf_webhook_unprocessed
  ON hq_ntf_webhook_events (processed_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hq_ntf_webhook_tenant
  ON hq_ntf_webhook_events (tenant_org_id, created_at DESC)
  WHERE tenant_org_id IS NOT NULL;

COMMENT ON TABLE hq_ntf_webhook_events IS
  'Raw inbound provider callback events for the HQ notification dispatch layer. '
  'Idempotency key prevents double-processing on provider retries. '
  'Platform-only: accessed via service role key, no RLS needed.';
