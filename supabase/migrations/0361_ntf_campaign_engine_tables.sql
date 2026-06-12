BEGIN;

-- =============================================================================
-- Migration 0361: Campaign Engine Tables (Phase 4)
-- CMX-PRD-019 Notification & Communication Hub
-- Created: 2026-06-12
--
-- Creates 4 tables:
--   org_notification_campaigns_mst  (30 chars) -- campaign header + state machine
--   org_notif_campaign_targets_dtl  (30 chars) -- individual recipients per campaign
--   org_notification_usage_daily    (28 chars) -- daily aggregated delivery stats
--   org_notification_audit_dtl      (26 chars) -- immutable compliance audit log
--
-- Prerequisites: migrations 0344-0360 applied
-- Next seq: 0362
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. org_notification_campaigns_mst (30 chars ✓)
--
-- Campaign header. Drives the broadcast workflow.
-- State machine:
--   DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → RUNNING → COMPLETED
--   Any non-terminal state → PAUSED (via admin action)
--   Any non-terminal state → CANCELLED (via admin action)
--   RUNNING → FAILED (on unrecoverable processor error)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_notification_campaigns_mst (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID          NOT NULL REFERENCES public.org_tenants_mst(id),

  -- Identity (bilingual)
  name              TEXT          NOT NULL,
  name2             TEXT,
  description       TEXT,
  description2      TEXT,

  -- State machine
  status            TEXT          NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED',
      'RUNNING', 'COMPLETED', 'PAUSED', 'FAILED', 'CANCELLED'
    )),

  -- Delivery config
  channel_code      TEXT          NOT NULL
    REFERENCES public.sys_notification_channel_cd(code),
  template_code     TEXT
    REFERENCES public.sys_ntf_templates_mst(template_code),
  target_segment    JSONB,        -- filter criteria encoded as JSON predicates

  -- Scheduling
  scheduled_at      TIMESTAMP,    -- NULL = run immediately on APPROVED transition
  started_at        TIMESTAMP,
  completed_at      TIMESTAMP,
  paused_at         TIMESTAMP,
  cancelled_at      TIMESTAMP,

  -- Progress counters (updated atomically by processor)
  total_targets     INTEGER       NOT NULL DEFAULT 0,
  sent_count        INTEGER       NOT NULL DEFAULT 0,
  failed_count      INTEGER       NOT NULL DEFAULT 0,
  skip_count        INTEGER       NOT NULL DEFAULT 0,

  -- Approval workflow
  approved_by       TEXT,
  approved_at       TIMESTAMP,
  approval_notes    TEXT,

  -- Standard audit fields
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        TEXT,
  updated_info      TEXT,
  rec_status        SMALLINT      NOT NULL DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT true
);

-- Standard tenant isolation index
CREATE INDEX idx_ntf_camp_tenant
  ON public.org_notification_campaigns_mst(tenant_org_id);

-- Status-filtered index for campaign list API
CREATE INDEX idx_ntf_camp_tenant_status
  ON public.org_notification_campaigns_mst(tenant_org_id, status);

-- Scheduler query: find APPROVED campaigns past their scheduled_at
CREATE INDEX idx_ntf_camp_scheduler
  ON public.org_notification_campaigns_mst(tenant_org_id, status, scheduled_at)
  WHERE status IN ('APPROVED', 'SCHEDULED');

-- Audit / history queries
CREATE INDEX idx_ntf_camp_created
  ON public.org_notification_campaigns_mst(tenant_org_id, created_at DESC);

-- RLS
ALTER TABLE public.org_notification_campaigns_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ntf_campaigns
  ON public.org_notification_campaigns_mst
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. org_notif_campaign_targets_dtl (30 chars ✓)
--
-- One row per intended recipient per campaign.
-- Rows created when campaign transitions to RUNNING.
-- outbox_id populated after outbox row is written for this recipient.
-- All campaign sends require marketing_consent = true (checked by processor).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_notif_campaign_targets_dtl (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id         UUID        NOT NULL REFERENCES public.org_tenants_mst(id),
  campaign_id           UUID        NOT NULL
    REFERENCES public.org_notification_campaigns_mst(id),

  -- Recipient
  recipient_user_id     UUID,       -- auth.users; NULL = external address only
  recipient_address     TEXT,       -- email / phone / push token

  -- Status
  status                TEXT        NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED')),
  skip_reason           TEXT,       -- e.g. NO_MARKETING_CONSENT, INVALID_ADDRESS

  -- Linked outbox row (populated after enqueue)
  outbox_id             UUID
    REFERENCES public.org_ntf_outbox_dtl(id),

  processed_at          TIMESTAMP,

  -- Standard audit fields
  created_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            TEXT,
  created_info          TEXT,
  updated_at            TIMESTAMP,
  updated_by            TEXT,
  updated_info          TEXT,
  rec_status            SMALLINT    NOT NULL DEFAULT 1,
  rec_order             INTEGER,
  rec_notes             TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT true
);

-- Standard tenant isolation index
CREATE INDEX idx_ntf_camp_tgt_tenant
  ON public.org_notif_campaign_targets_dtl(tenant_org_id);

-- Processor batch query: fetch PENDING targets for a campaign
CREATE INDEX idx_ntf_camp_tgt_campaign_pending
  ON public.org_notif_campaign_targets_dtl(campaign_id, status)
  WHERE status = 'PENDING';

-- Full campaign status breakdown
CREATE INDEX idx_ntf_camp_tgt_campaign_status
  ON public.org_notif_campaign_targets_dtl(campaign_id, status);

-- User-level lookup (consent check, preference check)
CREATE INDEX idx_ntf_camp_tgt_user
  ON public.org_notif_campaign_targets_dtl(tenant_org_id, recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;

-- RLS
ALTER TABLE public.org_notif_campaign_targets_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ntf_camp_tgt
  ON public.org_notif_campaign_targets_dtl
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. org_notification_usage_daily (28 chars ✓)
--
-- Daily aggregated delivery stats per tenant / channel / provider.
-- Upsert target for the outbox processor on each successful/failed send.
--
-- Design note: provider_code uses '' (empty string) as sentinel for
-- "no specific provider" to enable a clean UNIQUE constraint without
-- NULL-equality issues. When inserting from code, use COALESCE(provider_code, '').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_notification_usage_daily (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID          NOT NULL REFERENCES public.org_tenants_mst(id),

  -- Natural key dimensions
  channel_code      TEXT          NOT NULL
    REFERENCES public.sys_notification_channel_cd(code),
  usage_date        DATE          NOT NULL,
  provider_code     TEXT          NOT NULL DEFAULT '',  -- '' = no specific provider

  -- Daily counters (incremented via upsert)
  sent_count        INTEGER       NOT NULL DEFAULT 0,
  failed_count      INTEGER       NOT NULL DEFAULT 0,
  skip_count        INTEGER       NOT NULL DEFAULT 0,
  cost_amount       DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Standard audit fields
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        TEXT,
  updated_info      TEXT,
  rec_status        SMALLINT      NOT NULL DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT true
);

-- Natural key — enables ON CONFLICT (...) DO UPDATE upsert in the processor
CREATE UNIQUE INDEX idx_ntf_usage_natural
  ON public.org_notification_usage_daily(tenant_org_id, channel_code, usage_date, provider_code);

-- Tenant overview queries
CREATE INDEX idx_ntf_usage_tenant
  ON public.org_notification_usage_daily(tenant_org_id);

-- Date-range queries for reporting and quota checks
CREATE INDEX idx_ntf_usage_tenant_date
  ON public.org_notification_usage_daily(tenant_org_id, usage_date DESC);

-- RLS
ALTER TABLE public.org_notification_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ntf_usage
  ON public.org_notification_usage_daily
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. org_notification_audit_dtl (26 chars ✓)
--
-- Immutable compliance audit log for notification system events:
-- campaign state changes, consent grants/revocations, provider activations,
-- admin overrides, channel enable/disable changes.
--
-- Design: INSERT-only (no UPDATE or DELETE policies). The absence of UPDATE
-- and DELETE policies means those operations are rejected by RLS.
-- No updated_at / updated_by columns — this is intentional.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_notification_audit_dtl (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID        NOT NULL REFERENCES public.org_tenants_mst(id),

  -- What changed
  entity_type       TEXT        NOT NULL
    CHECK (entity_type IN (
      'CAMPAIGN',
      'USER_PREF',
      'CHANNEL_SETTING',
      'CONSENT',
      'PROVIDER_CONFIG',
      'OUTBOX'
    )),
  entity_id         TEXT        NOT NULL,   -- UUID or code of the entity being audited
  action_code       TEXT        NOT NULL,   -- e.g. STATUS_CHANGED, CONSENT_GRANTED,
                                            --      PROVIDER_ACTIVATED, CHANNEL_DISABLED

  -- Change capture (JSONB snapshots)
  old_value         JSONB,
  new_value         JSONB,
  change_reason     TEXT,

  -- Who / when (immutable)
  performed_by      TEXT        NOT NULL,   -- user_id (UUID as text) or 'system'
  performed_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address        TEXT,
  user_agent        TEXT,

  -- Additional context
  metadata          JSONB,

  -- Minimal record fields (insert-only; no update timestamps)
  rec_status        SMALLINT    NOT NULL DEFAULT 1,
  rec_notes         TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true
);

-- Standard tenant isolation
CREATE INDEX idx_ntf_audit_tenant
  ON public.org_notification_audit_dtl(tenant_org_id);

-- Entity drill-down (e.g. "all audit entries for campaign X")
CREATE INDEX idx_ntf_audit_entity
  ON public.org_notification_audit_dtl(tenant_org_id, entity_type, entity_id);

-- Chronological audit trail per tenant
CREATE INDEX idx_ntf_audit_performed
  ON public.org_notification_audit_dtl(tenant_org_id, performed_at DESC);

-- Action code queries (e.g. all CONSENT_GRANTED events this month)
CREATE INDEX idx_ntf_audit_action
  ON public.org_notification_audit_dtl(tenant_org_id, action_code, performed_at DESC);

-- RLS: SELECT and INSERT allowed; UPDATE and DELETE blocked by absence of policies
ALTER TABLE public.org_notification_audit_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ntf_audit_select
  ON public.org_notification_audit_dtl
  FOR SELECT
  USING (tenant_org_id = public.current_tenant_id());

CREATE POLICY tenant_isolation_ntf_audit_insert
  ON public.org_notification_audit_dtl
  FOR INSERT
  WITH CHECK (tenant_org_id = public.current_tenant_id());

-- No UPDATE or DELETE policies = those DML operations are blocked by RLS


COMMIT;
