-- ============================================================
-- Migration 0292: Domain Events Outbox + Idempotency Keys
-- Phase 6.3 of the Order Financial Platform
--
-- Tables created:
--   org_domain_events_outbox — async event ledger for outbox pattern
--   org_idempotency_keys     — request deduplication store (24h TTL)
-- ============================================================

-- ── org_domain_events_outbox ──────────────────────────────────────────────────
-- Append-only outbox for domain events. Worker polls PENDING/FAILED rows and
-- publishes them to the event bus. next_retry_at drives exponential back-off.
CREATE TABLE org_domain_events_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  aggregate_type  TEXT        NOT NULL,
  aggregate_id    UUID        NOT NULL,
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','PROCESSING','PROCESSED','FAILED')),
  attempts        SMALLINT    NOT NULL DEFAULT 0,
  max_attempts    SMALLINT    NOT NULL DEFAULT 6,
  next_retry_at   TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: worker only needs PENDING/FAILED rows ordered by next_retry_at
CREATE INDEX IF NOT EXISTS idx_outbox_worker_poll
  ON org_domain_events_outbox (status, next_retry_at)
  WHERE status IN ('PENDING','FAILED');

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON org_domain_events_outbox (tenant_org_id, aggregate_id, event_type);

ALTER TABLE org_domain_events_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_domain_events_outbox
  ON org_domain_events_outbox FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── org_idempotency_keys ──────────────────────────────────────────────────────
-- Deduplicates API requests by (tenant, key, resource_type). response_cache
-- stores the first successful response so retries return the same result.
-- Rows expire automatically after 24 hours (enforced by application cleanup job).
CREATE TABLE org_idempotency_keys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  key             TEXT        NOT NULL,
  resource_type   TEXT        NOT NULL,
  resource_id     UUID,
  response_cache  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  CONSTRAINT uq_idempotency_key UNIQUE (tenant_org_id, key, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup
  ON org_idempotency_keys (tenant_org_id, key, resource_type);

ALTER TABLE org_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_idempotency_keys
  ON org_idempotency_keys FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
