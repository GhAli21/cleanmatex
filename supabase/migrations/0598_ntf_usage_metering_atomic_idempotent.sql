-- =============================================================================
-- Migration: 0598_ntf_usage_metering_atomic_idempotent.sql
-- Purpose:   Pure concurrency-correctness fix for HQ notification usage
--            metering and quota enforcement (CMX-PRD-019 Notification &
--            Communication Hub). Fixes two confirmed bugs:
--
--   1. MeteringService.meter() (platform-api) performed an application-level
--      SELECT then UPDATE/INSERT against org_ntf_usage_daily. Two concurrent
--      calls for the same (tenant_org_id, channel_code, usage_date,
--      provider_code, currency_code) bucket could both read the same starting
--      counters and one increment is lost ("lost update").
--
--   2. dispatch.processor.ts (platform-workers) upserted org_ntf_usage_daily
--      with an onConflict target of (tenant_org_id, channel_code, usage_date,
--      provider_code) — four columns. Migration 0366 replaced the matching
--      unique index with a five-column index that also includes
--      currency_code (idx_ntf_usage_natural). The worker's upsert has not
--      matched any real constraint since 0366 and has been silently failing
--      (or inserting duplicate rows) on every queued-channel send.
--
--   Neither call site carried any idempotency identity, so a redelivered or
--   retried usage-metering call for the same logical dispatch command had no
--   way to avoid double-applying its delta.
--
-- Scope boundary (explicit, approved):
--   This migration does NOT change any resolved quota value (included_qty,
--   hard_cap, overage_allowed), any price, any plan default, or any override
--   semantics. QuotaService.resolveQuota() and PricingService are untouched.
--   This migration does NOT implement a reservation/expiry/release ledger —
--   that is explicitly out of scope (tracked separately under a future M6
--   gate in the production implementation plan). It implements exactly what
--   was approved: an atomic increment (single UPSERT statement, immune to
--   lost updates) plus an idempotency ledger (apply usage for a given
--   idempotency_key at most once) plus an advisory-lock-serialized read for
--   the quota hard-cap check.
--
-- New objects:
--   1. org_ntf_usage_apply_evt   — idempotency ledger; one row per
--                                   idempotency_key that has had its usage
--                                   delta applied. A second attempt to apply
--                                   the same idempotency_key is a no-op.
--   2. fn_ntf_meter_usage_atomic — SQL entry point used by both
--                                   MeteringService.meter() (platform-api)
--                                   and the async dispatch worker
--                                   (platform-workers) to record usage.
--                                   Claims the idempotency key and performs
--                                   a single atomic INSERT ... ON CONFLICT
--                                   DO UPDATE increment against
--                                   org_ntf_usage_daily.
--   3. fn_ntf_quota_usage_locked — replaces the plain SUM(sent_count) read
--                                   in QuotaRepository.getUsageInPeriod with
--                                   an advisory-lock-serialized read, so the
--                                   hard-cap check cannot observe a
--                                   partially-applied concurrent increment
--                                   for the same (tenant, channel) pair.
--
-- Residual limitation (by design, out of scope — see plan section 16/23):
--   fn_ntf_quota_usage_locked and fn_ntf_meter_usage_atomic share the same
--   per-(tenant_org_id, channel_code) advisory lock, so a usage read can
--   never observe a half-applied increment and vice versa. This closes the
--   lost-update class of bug completely. It does NOT close the wider
--   check-then-send-then-record race between two DIFFERENT concurrent
--   dispatch commands: the quota gate (QuotaService.checkAndReserve, called
--   BEFORE the provider send) and the usage increment (MeteringService.meter,
--   called AFTER the provider send completes) are still two separate calls
--   separated by real network I/O time. Fully closing that gap requires a
--   true pre-send reservation that is released on send failure — the
--   reservation/expiry/release ledger explicitly called out as future M6
--   scope, not part of this approved increment.
--
-- Seq: 0598 (after 0597_wp05b_order_edit_policy_foundation.sql)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. org_ntf_usage_apply_evt — usage-metering idempotency ledger
-- ---------------------------------------------------------------------------
-- One row per idempotency_key whose usage delta has been applied to
-- org_ntf_usage_daily. idempotency_key is the same caller-supplied key stored
-- (globally unique) on hq_ntf_dispatch_log — one logical dispatch command,
-- one usage application, regardless of how many times metering is invoked
-- for it (API sync path finalize, async worker job execution, any BullMQ
-- redelivery/retry). FK to hq_ntf_dispatch_log(idempotency_key) guarantees
-- a usage event can only ever be recorded for a real, previously-reserved
-- dispatch command.
CREATE TABLE IF NOT EXISTS public.org_ntf_usage_apply_evt (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotency token — same value as hq_ntf_dispatch_log.idempotency_key.
  -- UNIQUE enforces "apply usage for this logical command at most once".
  idempotency_key   TEXT          NOT NULL
    REFERENCES public.hq_ntf_dispatch_log(idempotency_key),

  -- Tenant context — every org_* table is filtered by tenant_org_id directly
  -- in every query per CleanMateX multi-tenancy rules (CLAUDE.md rule #4).
  tenant_org_id     UUID          NOT NULL REFERENCES public.org_tenants_mst(id),

  -- Which usage bucket this event was applied against (denormalized from the
  -- call for observability/debugging — the authoritative counters live on
  -- org_ntf_usage_daily, this table only records that the delta was applied).
  channel_code      TEXT          NOT NULL
    REFERENCES public.sys_ntf_channel_cd(code),
  provider_code     TEXT          NOT NULL DEFAULT '',
  currency_code     TEXT          NOT NULL DEFAULT 'USD',
  usage_date        DATE          NOT NULL,

  -- Outcome status this usage event reflects (SENT | FAILED |
  -- PERMANENT_FAILURE) — stored as plain TEXT, no CHECK constraint, so this
  -- ledger never needs a migration if DispatchStatus gains a value.
  status            TEXT          NOT NULL,

  -- Deltas actually applied to org_ntf_usage_daily by this event.
  sent_delta        INTEGER       NOT NULL DEFAULT 0 CHECK (sent_delta >= 0),
  failed_delta      INTEGER       NOT NULL DEFAULT 0 CHECK (failed_delta >= 0),
  cost_delta        DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (cost_delta >= 0),

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

COMMENT ON TABLE public.org_ntf_usage_apply_evt IS
  'Idempotency ledger for notification usage metering. One row per idempotency_key that has had its usage delta applied to org_ntf_usage_daily. A repeated apply attempt for the same idempotency_key (retry, redelivery, duplicate call) is a no-op — see fn_ntf_meter_usage_atomic. Not a reservation/expiry/release system: deltas are recorded after the send outcome is known, exactly as before this migration, only now exactly once per logical command.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.idempotency_key IS
  'Same value as hq_ntf_dispatch_log.idempotency_key (FK). UNIQUE — enforces at-most-once usage application per logical dispatch command.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.tenant_org_id IS
  'Owning tenant. Always filtered explicitly in queries/functions — never relied on via RLS alone.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.channel_code IS
  'Notification channel this usage event was recorded for (EMAIL | SMS | WHATSAPP | PUSH).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.provider_code IS
  'Provider that handled the send attempt this usage event reflects. Empty string = no specific provider, mirrors org_ntf_usage_daily.provider_code sentinel.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.currency_code IS
  'ISO 4217 currency code for cost_delta. Defaults to USD, matching org_ntf_usage_daily.currency_code default.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.usage_date IS
  'Calendar date (UTC) the usage delta was attributed to — matches the org_ntf_usage_daily.usage_date row this event incremented.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.status IS
  'DispatchStatus value (SENT | FAILED | PERMANENT_FAILURE) this usage event reflects, recorded for observability only.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.sent_delta IS
  'sent_count delta actually applied to org_ntf_usage_daily by this event (0 or 1 in current call sites).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.failed_delta IS
  'failed_count delta actually applied to org_ntf_usage_daily by this event (0 or 1 in current call sites).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.cost_delta IS
  'cost_amount delta actually applied to org_ntf_usage_daily by this event, in currency_code.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.created_at IS 'Row creation timestamp (standard audit column).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.created_by IS 'Actor/service that created this row (standard audit column; HQ service role writes this, typically NULL/system).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.created_info IS 'Free-text creation context (standard audit column).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.updated_at IS 'Last update timestamp (standard audit column). This ledger is append-only in practice — expected to stay NULL.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.updated_by IS 'Actor/service that last updated this row (standard audit column).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.updated_info IS 'Free-text update context (standard audit column).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.rec_status IS 'Soft-delete status flag (standard audit column). 1 = active. This ledger is never soft-deleted in normal operation.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.rec_order IS 'Manual display/sort order override (standard audit column). Unused for this table.';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.rec_notes IS 'Free-text operator notes (standard audit column).';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.is_active IS 'Soft-delete flag (standard audit column). Always true for this ledger in normal operation.';

-- Idempotency lookup / enforcement — the single UNIQUE index this entire fix
-- relies on to make usage application at-most-once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ntf_usage_apply_evt_key
  ON public.org_ntf_usage_apply_evt (idempotency_key);

-- Tenant-scoped audit/reporting lookups.
CREATE INDEX IF NOT EXISTS idx_ntf_usage_apply_evt_tenant
  ON public.org_ntf_usage_apply_evt (tenant_org_id, created_at DESC);

ALTER TABLE public.org_ntf_usage_apply_evt ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ntf_usage_apply_evt
  ON public.org_ntf_usage_apply_evt
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());

COMMENT ON POLICY tenant_isolation_ntf_usage_apply_evt ON public.org_ntf_usage_apply_evt IS
  'Defense-in-depth tenant isolation. HQ writes via service role (bypasses RLS) and always passes tenant_org_id explicitly in fn_ntf_meter_usage_atomic — this policy protects any future non-service-role access path.';

-- ---------------------------------------------------------------------------
-- 2. fn_ntf_meter_usage_atomic — atomic + idempotent usage metering entry point
-- ---------------------------------------------------------------------------
-- Single statement-level entry point replacing the application-level
-- SELECT-then-UPDATE/INSERT in MeteringService.meter() and the broken ad hoc
-- upsert in dispatch.processor.ts. Called once per usage-metering attempt by
-- both the synchronous API dispatch path and the async worker dispatch path.
--
-- Behaviour:
--   1. Takes a per-(tenant_org_id, channel_code) advisory transaction lock,
--      shared with fn_ntf_quota_usage_locked, so a concurrent quota read for
--      the same tenant+channel cannot interleave with this increment.
--   2. Attempts to claim the idempotency_key in org_ntf_usage_apply_evt. If
--      the key was already claimed by a previous call, this call is a no-op
--      (applied = false) and the current org_ntf_usage_daily counters are
--      returned unchanged.
--   3. Otherwise, performs a single atomic
--      INSERT ... ON CONFLICT (tenant_org_id, channel_code, usage_date,
--      provider_code, currency_code) DO UPDATE SET col = col + delta
--      against org_ntf_usage_daily. This is one indivisible statement — the
--      unique index's row-level lock makes it immune to the lost-update race
--      that existed when the read and the write were two separate
--      application-level round-trips.
--
-- Returns the post-apply (or unchanged, if already-applied) counters so
-- callers can log/observe them without a second round-trip.
CREATE OR REPLACE FUNCTION public.fn_ntf_meter_usage_atomic(
  p_idempotency_key TEXT,
  p_tenant_org_id   UUID,
  p_channel_code    TEXT,
  p_provider_code   TEXT,
  p_currency_code   TEXT,
  p_usage_date      DATE,
  p_status          TEXT,
  p_sent_delta      INTEGER,
  p_failed_delta    INTEGER,
  p_cost_delta      DECIMAL(19,4)
)
RETURNS TABLE (
  applied      BOOLEAN,
  sent_count   INTEGER,
  failed_count INTEGER,
  cost_amount  DECIMAL(19,4)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key BIGINT;
BEGIN
  v_lock_key := hashtextextended(p_tenant_org_id::text || ':' || p_channel_code, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  INSERT INTO public.org_ntf_usage_apply_evt (
    idempotency_key, tenant_org_id, channel_code, provider_code,
    currency_code, usage_date, status, sent_delta, failed_delta, cost_delta
  ) VALUES (
    p_idempotency_key, p_tenant_org_id, p_channel_code, p_provider_code,
    p_currency_code, p_usage_date, p_status,
    GREATEST(p_sent_delta, 0), GREATEST(p_failed_delta, 0), GREATEST(p_cost_delta, 0)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    -- Already applied by a previous call for this idempotency key — return
    -- the current snapshot without incrementing anything further.
    RETURN QUERY
      SELECT false, d.sent_count, d.failed_count, d.cost_amount
        FROM public.org_ntf_usage_daily d
        WHERE d.tenant_org_id = p_tenant_org_id
          AND d.channel_code  = p_channel_code
          AND d.usage_date    = p_usage_date
          AND d.provider_code = p_provider_code
          AND d.currency_code = p_currency_code;
    RETURN;
  END IF;

  RETURN QUERY
    INSERT INTO public.org_ntf_usage_daily (
      tenant_org_id, channel_code, usage_date, provider_code, currency_code,
      sent_count, failed_count, skip_count, cost_amount
    ) VALUES (
      p_tenant_org_id, p_channel_code, p_usage_date, p_provider_code, p_currency_code,
      GREATEST(p_sent_delta, 0), GREATEST(p_failed_delta, 0), 0, GREATEST(p_cost_delta, 0)
    )
    ON CONFLICT (tenant_org_id, channel_code, usage_date, provider_code, currency_code)
    DO UPDATE SET
      sent_count   = org_ntf_usage_daily.sent_count   + EXCLUDED.sent_count,
      failed_count = org_ntf_usage_daily.failed_count + EXCLUDED.failed_count,
      cost_amount  = org_ntf_usage_daily.cost_amount  + EXCLUDED.cost_amount,
      updated_at   = CURRENT_TIMESTAMP
    RETURNING true, sent_count, failed_count, cost_amount;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_meter_usage_atomic(TEXT, UUID, TEXT, TEXT, TEXT, DATE, TEXT, INTEGER, INTEGER, DECIMAL) IS
  'Atomic + idempotent usage-metering entry point for org_ntf_usage_daily. Claims p_idempotency_key in org_ntf_usage_apply_evt (no-op if already claimed), then performs a single INSERT ... ON CONFLICT DO UPDATE increment. Replaces the application-level SELECT-then-UPDATE/INSERT race in MeteringService.meter() and the broken onConflict target in platform-workers dispatch.processor.ts. Does not resolve pricing or quota values — callers pass already-resolved deltas.';

-- ---------------------------------------------------------------------------
-- 3. fn_ntf_quota_usage_locked — lock-serialized usage read for the quota gate
-- ---------------------------------------------------------------------------
-- Replaces the plain SELECT sent_count ... (summed in application code) in
-- QuotaRepository.getUsageInPeriod. Takes the SAME per-(tenant_org_id,
-- channel_code) advisory lock as fn_ntf_meter_usage_atomic so this read can
-- never observe a half-applied concurrent increment for the same tenant and
-- channel — the aggregate is always a consistent snapshot relative to any
-- concurrently-committing metering call for that pair.
--
-- Scope note: this removes the lost-update-driven under-counting that let
-- the hard-cap check read stale/wrong totals. It does not, by itself, make
-- QuotaService.checkAndReserve (called before a provider send) atomic with
-- MeteringService.meter (called after a provider send completes) across two
-- different concurrent commands — see the migration header's "Residual
-- limitation" note. resolveQuota()'s precedence logic is untouched; this
-- function only replaces the usage aggregate read.
CREATE OR REPLACE FUNCTION public.fn_ntf_quota_usage_locked(
  p_tenant_org_id UUID,
  p_metric        TEXT,
  p_from_date     DATE,
  p_to_date       DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key BIGINT;
  v_total    INTEGER;
BEGIN
  v_lock_key := hashtextextended(p_tenant_org_id::text || ':' || p_metric, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(SUM(sent_count), 0) INTO v_total
    FROM public.org_ntf_usage_daily
    WHERE tenant_org_id = p_tenant_org_id
      AND channel_code  = p_metric
      AND usage_date BETWEEN p_from_date AND p_to_date;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_quota_usage_locked(UUID, TEXT, DATE, DATE) IS
  'Advisory-lock-serialized SUM(sent_count) read for QuotaRepository.getUsageInPeriod. Shares its advisory lock key with fn_ntf_meter_usage_atomic (same tenant_org_id + channel/metric) so the quota hard-cap check always reads a consistent snapshot relative to concurrent usage increments for that pair. Does not resolve or change quota values — QuotaService.resolveQuota() is untouched and remains the sole source of included_qty/hard_cap/overage_allowed.';

COMMIT;
