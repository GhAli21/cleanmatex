-- =============================================================================
-- Migration: 0367_hq_ntf_dispatch_log.sql
-- Purpose:   Create hq_ntf_dispatch_log — the HQ dispatch proxy's idempotency
--            and delivery tracking table (CMX-PRD-019 B1).
--
-- Design:
--   • Each outbound send attempt gets one row.
--   • idempotency_key (caller-supplied UUID) enforces exactly-once delivery:
--     if a row already exists for the key, the proxy returns the cached result
--     instead of re-sending to the provider.
--   • provider_message_id stores the ID returned by the external provider
--     (Resend message ID, Twilio SID, etc.) for tracing.
--   • status progression: PENDING → SENT | FAILED | PERMANENT_FAILURE
--   • No tenant data in this table — logs live at platform level (HQ only).
--     tenant_org_id is a plain UUID reference (no FK, no RLS) so HQ service
--     role can write without triggering tenant isolation logic.
--
-- Seq: 0367 (after 0366_ntf_dispatch_mode_currency.sql)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS hq_ntf_dispatch_log (
  id                    UUID      PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotency key supplied by the caller (cleanmatex outbox row UUID works well).
  -- UNIQUE constraint prevents double-sends for the same logical message.
  idempotency_key       TEXT      NOT NULL,

  -- Tenant context (plain UUID, no FK — HQ bypasses RLS)
  tenant_org_id         UUID      NOT NULL,

  -- What channel and provider handled the send
  channel_code          TEXT      NOT NULL,   -- EMAIL | SMS | WHATSAPP | PUSH
  provider_code         TEXT      NOT NULL,   -- RESEND | TWILIO | etc.
  dispatch_mode         TEXT      NOT NULL    -- PLATFORM | BYO
    CHECK (dispatch_mode IN ('PLATFORM', 'BYO')),

  -- Recipient (hashed/masked for GDPR — never store plaintext PII)
  recipient_hash        TEXT,                 -- SHA-256(recipient) for dedup/reporting

  -- Result
  status                TEXT      NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'PERMANENT_FAILURE')),
  provider_message_id   TEXT,                 -- ID returned by provider on success
  error_code            TEXT,                 -- Provider error code on failure
  error_message         TEXT,                 -- Human-readable failure reason
  attempt_count         SMALLINT  NOT NULL DEFAULT 1,

  -- Performance
  duration_ms           INT,                  -- Wall-clock time for this dispatch attempt

  -- Tracing
  request_id            TEXT,                 -- X-Request-ID / correlation ID from caller
  audit_id              UUID,                 -- References hq_audit_logs(id) for this dispatch

  -- Timestamps
  dispatched_at         TIMESTAMP,            -- Set when status transitions to SENT
  failed_at             TIMESTAMP,            -- Set when status transitions to FAILED/PERMANENT_FAILURE
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP
);

COMMENT ON TABLE hq_ntf_dispatch_log IS
  'HQ-level dispatch proxy log. One row per send attempt. idempotency_key ensures exactly-once delivery. No plaintext PII stored — use recipient_hash for analytics.';

COMMENT ON COLUMN hq_ntf_dispatch_log.idempotency_key IS
  'Caller-supplied unique key (e.g. cleanmatex outbox row UUID). Duplicate keys return cached result instead of re-sending.';
COMMENT ON COLUMN hq_ntf_dispatch_log.recipient_hash IS
  'SHA-256(normalized_recipient) — never store plaintext email/phone here. Used for analytics and dedup only.';
COMMENT ON COLUMN hq_ntf_dispatch_log.provider_message_id IS
  'Message ID returned by the external provider on success (Resend message ID, Twilio SID, FCM message ID, etc.)';
COMMENT ON COLUMN hq_ntf_dispatch_log.audit_id IS
  'References the hq_audit_logs row written for this dispatch event, enabling fast join from dispatch log to full audit detail.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary idempotency lookup (most frequent read path)
CREATE UNIQUE INDEX IF NOT EXISTS uq_hq_ntf_dispatch_idempotency
  ON hq_ntf_dispatch_log (idempotency_key);

-- Tenant-scoped dispatch history for HQ observability screens
CREATE INDEX IF NOT EXISTS idx_hq_ntf_dispatch_tenant_created
  ON hq_ntf_dispatch_log (tenant_org_id, created_at DESC);

-- Provider performance and error-rate monitoring
CREATE INDEX IF NOT EXISTS idx_hq_ntf_dispatch_provider_status
  ON hq_ntf_dispatch_log (provider_code, status, created_at DESC);

-- Failed/permanent-failure rows for retry queue scan
CREATE INDEX IF NOT EXISTS idx_hq_ntf_dispatch_failures
  ON hq_ntf_dispatch_log (status, created_at DESC)
  WHERE status IN ('FAILED', 'PERMANENT_FAILURE');

-- Cross-service trace lookup by request_id
CREATE INDEX IF NOT EXISTS idx_hq_ntf_dispatch_request_id
  ON hq_ntf_dispatch_log (request_id)
  WHERE request_id IS NOT NULL;

COMMIT;
