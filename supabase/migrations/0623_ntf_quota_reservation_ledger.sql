-- Notification Hub R10 — atomic quota reservation ledger (closes the hard-cap race).
--
-- Background (see 0598): QuotaService.checkAndReserve read usage BEFORE the provider send and the usage
-- increment happened AFTER it, so N concurrent commands could all read "below the cap" and all send.
-- This migration adds a real reservation: the cap check and the reservation happen in ONE function under
-- the per-(tenant, channel) advisory lock, and the usage increment settles the reservation in the same
-- transaction. Parallel commands therefore cannot exceed the cap.
--
-- Objects:
--   1. org_ntf_quota_rsv_dtl            reservation ledger (one row per dispatch command)
--   2. fn_ntf_quota_reserve             check cap + reserve atomically (idempotent per command)
--   3. fn_ntf_quota_release             release a reservation when nothing was sent
--   4. fn_ntf_meter_usage_atomic        REPLACED (same signature): settles the reservation in the same
--                                       transaction as the usage increment, and no longer claims the
--                                       idempotency key for a non-terminal (QUEUED/PENDING) status
--   4b. fn_ntf_quota_reserved_qty       read-only in-flight quantity for the quota screen
--   5. fn_ntf_quota_rsv_sweep           expires stale reservations, purges old settled rows
--   6. fn_ntf_retention_sweep           REPLACED (same signature): removes usage-apply rows before their
--                                       dispatch-log parent (0598 FK is NO ACTION, so the 0609 sweep would
--                                       have failed on the first eligible row)
--   7. job registry + pg_cron           ntf-quota-rsv-sweep every 5 minutes
--
-- Three latent defects fixed here (found while designing R10):
--   * fn_ntf_meter_usage_atomic (0598) could never complete a first-time increment: its final
--     RETURNING sent_count/failed_count/cost_amount is ambiguous against the function's own OUT
--     parameters (SQLSTATE 42702, raised on every call that actually applies usage). The API swallows
--     the error, so org_ntf_usage_daily and org_ntf_usage_apply_evt are EMPTY on a database that has
--     already sent messages (verified: 3 SENT dispatch rows, 0 usage rows). Qualified here.
--   * HQ API metered a QUEUED command with zero deltas, which claimed the idempotency key, so the async
--     worker's real metering for the same key became a no-op and queued SMS/WhatsApp/push usage was
--     never counted (the cap could never be reached on those channels).
--   * fn_ntf_retention_sweep deleted hq_ntf_dispatch_log rows still referenced by org_ntf_usage_apply_evt.
--
-- Safety: new objects only plus two CREATE OR REPLACE of existing functions with unchanged signatures.
-- Reversal: unschedule the cron job, drop the new functions and table; re-run 0598/0609 function bodies.
BEGIN;

-- 1. Reservation ledger -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_ntf_quota_rsv_dtl (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity of the reservation.
  tenant_org_id    UUID          NOT NULL REFERENCES public.org_tenants_mst(id),  -- Owning tenant; every query filters it.
  channel_code     TEXT          NOT NULL REFERENCES public.sys_ntf_channel_cd(code),  -- Quota metric (notification channel).
  idempotency_key  TEXT          NOT NULL,                              -- Dispatch command key (same value as hq_ntf_dispatch_log.idempotency_key). No FK: the retention sweep deletes dispatch-log rows.
  usage_date       DATE          NOT NULL,                              -- UTC day the reservation counts toward (period windows are matched on it).
  qty              INTEGER       NOT NULL DEFAULT 1,                    -- Units held (1 per message today).
  status           TEXT          NOT NULL DEFAULT 'RESERVED',           -- RESERVED | COMMITTED | RELEASED | EXPIRED.
  expires_at       TIMESTAMPTZ   NOT NULL,                              -- A RESERVED row past this instant no longer counts (crash safety net).
  settled_at       TIMESTAMPTZ,                                         -- When it left RESERVED (commit, release or expiry).
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),                -- Row creation time.
  created_by       TEXT,                                                -- Writer (system).
  created_info     TEXT,                                                -- Writer provenance.
  updated_at       TIMESTAMPTZ,                                         -- Last change.
  updated_by       TEXT,                                                -- Last writer.
  updated_info     TEXT,                                                -- Last writer provenance.
  rec_status       SMALLINT      NOT NULL DEFAULT 1,                    -- Soft-delete status (1 = active).
  rec_order        INTEGER,                                             -- Unused ordering column.
  rec_notes        TEXT,                                                -- Free-text notes.
  is_active        BOOLEAN       NOT NULL DEFAULT true,                 -- Soft-delete flag.
  CONSTRAINT uq_ntf_quota_rsv_key UNIQUE (idempotency_key),
  CONSTRAINT ck_ntf_quota_rsv_status CHECK (status IN ('RESERVED', 'COMMITTED', 'RELEASED', 'EXPIRED')),
  CONSTRAINT ck_ntf_quota_rsv_qty CHECK (qty >= 1)
);

COMMENT ON TABLE public.org_ntf_quota_rsv_dtl IS
  'Quota reservation ledger. One row per dispatch command: RESERVED while the message is in flight, COMMITTED when usage was counted, RELEASED when nothing was sent, EXPIRED when the process died before settling. Only unexpired RESERVED rows count against the cap.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.id IS 'Surrogate identity of the reservation.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.tenant_org_id IS 'Owning tenant; always filtered explicitly in queries and functions.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.channel_code IS 'Quota metric: the notification channel the reservation counts against.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.idempotency_key IS 'Dispatch command key; UNIQUE so one command holds at most one reservation. No FK (retention deletes dispatch-log rows).';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.usage_date IS 'UTC day the reservation counts toward; matched against the quota period window.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.qty IS 'Units held by this reservation (1 per message).';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.status IS 'RESERVED, COMMITTED, RELEASED or EXPIRED.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.expires_at IS 'A RESERVED row past this instant stops counting; protects the cap from a crashed sender.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.settled_at IS 'When the reservation left RESERVED.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.created_by IS 'Writer of the row (system).';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.created_info IS 'Writer provenance (function name).';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.updated_at IS 'Last change time.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.updated_by IS 'Last writer.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.updated_info IS 'Last writer provenance.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.rec_status IS 'Soft-delete status; 1 = active.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.rec_order IS 'Unused ordering column.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.org_ntf_quota_rsv_dtl.is_active IS 'Soft-delete flag.';
COMMENT ON CONSTRAINT uq_ntf_quota_rsv_key ON public.org_ntf_quota_rsv_dtl IS 'One reservation per dispatch command.';
COMMENT ON CONSTRAINT ck_ntf_quota_rsv_status ON public.org_ntf_quota_rsv_dtl IS 'Allowed reservation states.';
COMMENT ON CONSTRAINT ck_ntf_quota_rsv_qty ON public.org_ntf_quota_rsv_dtl IS 'A reservation holds at least one unit.';

-- Cap check: sum of live reservations for a tenant and channel in a period.
CREATE INDEX IF NOT EXISTS idx_ntf_quota_rsv_live
  ON public.org_ntf_quota_rsv_dtl (tenant_org_id, channel_code, usage_date)
  WHERE status = 'RESERVED';
COMMENT ON INDEX public.idx_ntf_quota_rsv_live IS 'Serves the cap check: live (RESERVED) rows per tenant, channel and day.';
-- Sweep: expired and old settled rows.
CREATE INDEX IF NOT EXISTS idx_ntf_quota_rsv_sweep
  ON public.org_ntf_quota_rsv_dtl (status, expires_at);
COMMENT ON INDEX public.idx_ntf_quota_rsv_sweep IS 'Serves the expiry and purge sweep.';

ALTER TABLE public.org_ntf_quota_rsv_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ntf_quota_rsv ON public.org_ntf_quota_rsv_dtl;
CREATE POLICY tenant_isolation_ntf_quota_rsv
  ON public.org_ntf_quota_rsv_dtl
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());
COMMENT ON POLICY tenant_isolation_ntf_quota_rsv ON public.org_ntf_quota_rsv_dtl IS
  'Defense in depth: HQ writes through the service role and always passes the tenant explicitly.';

-- 2. Atomic cap check + reservation ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_quota_reserve(
  p_idempotency_key TEXT,
  p_tenant_org_id   UUID,
  p_channel_code    TEXT,
  p_from_date       DATE,
  p_to_date         DATE,
  p_hard_cap        INTEGER,
  p_overage_allowed BOOLEAN,
  p_qty             INTEGER DEFAULT 1,
  p_ttl_seconds     INTEGER DEFAULT 900
)
RETURNS TABLE (
  allowed         BOOLEAN,
  reason          TEXT,
  used_qty        INTEGER,
  reserved_qty    INTEGER,
  reservation_id  UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_qty      INTEGER := GREATEST(COALESCE(p_qty, 1), 1);
  v_ttl      INTEGER := LEAST(GREATEST(COALESCE(p_ttl_seconds, 900), 30), 86400);
  v_used     INTEGER;
  v_reserved INTEGER;
  v_existing public.org_ntf_quota_rsv_dtl%ROWTYPE;
  v_id       UUID;
BEGIN
  -- Same per-(tenant, channel) lock as fn_ntf_meter_usage_atomic and fn_ntf_quota_usage_locked: the cap
  -- check, the reservation and any concurrent settlement are strictly serialized.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_org_id::text || ':' || p_channel_code, 0));

  -- A command that already counted (or is already holding) its unit is not counted twice.
  SELECT * INTO v_existing
  FROM public.org_ntf_quota_rsv_dtl
  WHERE idempotency_key = p_idempotency_key AND tenant_org_id = p_tenant_org_id;
  IF FOUND AND (v_existing.status = 'COMMITTED'
                OR (v_existing.status = 'RESERVED' AND v_existing.expires_at > now())) THEN
    RETURN QUERY SELECT true, NULL::TEXT, 0, 0, v_existing.id;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(d.sent_count), 0)::INTEGER INTO v_used
  FROM public.org_ntf_usage_daily d
  WHERE d.tenant_org_id = p_tenant_org_id
    AND d.channel_code  = p_channel_code
    AND d.usage_date BETWEEN p_from_date AND p_to_date;

  SELECT COALESCE(SUM(r.qty), 0)::INTEGER INTO v_reserved
  FROM public.org_ntf_quota_rsv_dtl r
  WHERE r.tenant_org_id = p_tenant_org_id
    AND r.channel_code  = p_channel_code
    AND r.status        = 'RESERVED'
    AND r.expires_at    > now()
    AND r.usage_date BETWEEN p_from_date AND p_to_date
    AND r.idempotency_key <> p_idempotency_key;

  -- Hard cap: used + in-flight + this command must not exceed it (equal to the cap is allowed).
  IF p_hard_cap IS NOT NULL AND (v_used + v_reserved + v_qty) > p_hard_cap AND NOT COALESCE(p_overage_allowed, false) THEN
    RETURN QUERY SELECT false, 'QUOTA_EXCEEDED'::TEXT, v_used, v_reserved, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO public.org_ntf_quota_rsv_dtl (
    tenant_org_id, channel_code, idempotency_key, usage_date, qty, status, expires_at, created_info
  ) VALUES (
    p_tenant_org_id, p_channel_code, p_idempotency_key, (now() AT TIME ZONE 'UTC')::DATE, v_qty, 'RESERVED',
    now() + make_interval(secs => v_ttl), 'fn_ntf_quota_reserve'
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET status = 'RESERVED', qty = EXCLUDED.qty, usage_date = EXCLUDED.usage_date, expires_at = EXCLUDED.expires_at,
        settled_at = NULL, updated_at = now(), updated_info = 'fn_ntf_quota_reserve (re-reserved)'
    WHERE public.org_ntf_quota_rsv_dtl.tenant_org_id = p_tenant_org_id
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_used, v_reserved, v_id;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_quota_reserve(TEXT, UUID, TEXT, DATE, DATE, INTEGER, BOOLEAN, INTEGER, INTEGER) IS
  'Atomically checks the hard cap (usage + live reservations + this command) and, when allowed, reserves the unit, under the per-(tenant, channel) advisory lock. Idempotent per command key: a command that already holds or committed its unit is allowed without being counted again; a released or expired one is re-reserved. NULL cap = unlimited; overage_allowed bypasses the cap but still reserves.';
REVOKE ALL ON FUNCTION public.fn_ntf_quota_reserve(TEXT, UUID, TEXT, DATE, DATE, INTEGER, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_quota_reserve(TEXT, UUID, TEXT, DATE, DATE, INTEGER, BOOLEAN, INTEGER, INTEGER) TO service_role;

-- 3. Release -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_quota_release(p_idempotency_key TEXT, p_tenant_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.org_ntf_quota_rsv_dtl
  SET status = 'RELEASED', settled_at = now(), updated_at = now(), updated_info = 'fn_ntf_quota_release'
  WHERE idempotency_key = p_idempotency_key
    AND tenant_org_id   = p_tenant_org_id
    AND status          = 'RESERVED';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_quota_release(TEXT, UUID) IS
  'Releases a RESERVED quota unit for a command that sent nothing (queue refused, send crashed, rejected). Returns whether a reservation was released; a settled or unknown command is a harmless no-op.';
REVOKE ALL ON FUNCTION public.fn_ntf_quota_release(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_quota_release(TEXT, UUID) TO service_role;

-- 4. Metering: settle the reservation atomically; never claim the key for a non-terminal status ------------
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_key BIGINT;
BEGIN
  v_lock_key := hashtextextended(p_tenant_org_id::text || ':' || p_channel_code, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- A command that is only queued (or otherwise not finished) has no usage to record yet. Claiming the key
  -- now would turn the worker's real metering for the same command into a no-op (the defect fixed here).
  IF p_status NOT IN ('SENT', 'FAILED', 'PERMANENT_FAILURE') THEN
    RETURN QUERY SELECT false, 0, 0, 0::DECIMAL(19,4);
    RETURN;
  END IF;

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

  -- Same transaction, same lock: the reservation turns into counted usage (sent) or is given back (not sent).
  UPDATE public.org_ntf_quota_rsv_dtl
  SET status = CASE WHEN p_sent_delta > 0 THEN 'COMMITTED' ELSE 'RELEASED' END,
      settled_at = now(), updated_at = now(), updated_info = 'fn_ntf_meter_usage_atomic'
  WHERE idempotency_key = p_idempotency_key
    AND tenant_org_id   = p_tenant_org_id
    AND status          = 'RESERVED';

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
    RETURNING true, org_ntf_usage_daily.sent_count, org_ntf_usage_daily.failed_count, org_ntf_usage_daily.cost_amount;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_meter_usage_atomic(TEXT, UUID, TEXT, TEXT, TEXT, DATE, TEXT, INTEGER, INTEGER, DECIMAL) IS
  'Atomic, idempotent usage metering (0598) extended in 0623: ignores non-terminal statuses without claiming the idempotency key, and settles the command''s quota reservation (COMMITTED when sent, RELEASED otherwise) in the same transaction and under the same advisory lock as the usage increment.';

-- 4b. Read the in-flight quantity (quota screen) ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_quota_reserved_qty(
  p_tenant_org_id UUID,
  p_channel_code  TEXT,
  p_from_date     DATE,
  p_to_date       DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(r.qty), 0)::INTEGER
  FROM public.org_ntf_quota_rsv_dtl r
  WHERE r.tenant_org_id = p_tenant_org_id
    AND r.channel_code  = p_channel_code
    AND r.status        = 'RESERVED'
    AND r.expires_at    > now()
    AND r.usage_date BETWEEN p_from_date AND p_to_date;
$$;

COMMENT ON FUNCTION public.fn_ntf_quota_reserved_qty(UUID, TEXT, DATE, DATE) IS
  'Units currently held by live (RESERVED, unexpired) quota reservations for a tenant and channel in a period. Read-only; used by the HQ quota screen.';
REVOKE ALL ON FUNCTION public.fn_ntf_quota_reserved_qty(UUID, TEXT, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_quota_reserved_qty(UUID, TEXT, DATE, DATE) TO service_role;

-- 5. Reservation sweep ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_quota_rsv_sweep(p_purge_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expired INTEGER;
  v_purged  INTEGER;
BEGIN
  -- Housekeeping across all tenants (like the other sweeps): a RESERVED row past its expiry no longer counts
  -- anyway; marking it keeps the screen and the counts honest.
  UPDATE public.org_ntf_quota_rsv_dtl
  SET status = 'EXPIRED', settled_at = now(), updated_at = now(), updated_info = 'fn_ntf_quota_rsv_sweep'
  WHERE status = 'RESERVED' AND expires_at <= now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  DELETE FROM public.org_ntf_quota_rsv_dtl
  WHERE status <> 'RESERVED'
    AND settled_at < now() - make_interval(days => GREATEST(p_purge_days, 1));
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN v_expired + v_purged;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_quota_rsv_sweep(INTEGER) IS
  'Marks unsettled reservations past their expiry as EXPIRED and purges settled rows older than the given days (default 30). Returns the number of rows changed.';
REVOKE ALL ON FUNCTION public.fn_ntf_quota_rsv_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_quota_rsv_sweep(INTEGER) TO service_role;

-- 6. Retention sweep: delete usage-apply rows before their dispatch-log parent (same body as 0609 plus one step)
CREATE OR REPLACE FUNCTION public.fn_ntf_retention_sweep(p_retention_days INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff    TIMESTAMPTZ := now() - make_interval(days => p_retention_days);
  v_deleted   INTEGER := 0;
  v_this_pass INTEGER;
BEGIN
  DELETE FROM public.org_ntf_outbox_dtl
  WHERE status IN ('SENT', 'DELIVERED', 'READ', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED')
    AND COALESCE(finalized_at, delivered_at, created_at) < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  DELETE FROM public.org_ntf_delivery_log_dtl
  WHERE logged_at < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  DELETE FROM public.org_ntf_receipts_tr
  WHERE received_at < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  DELETE FROM public.org_ntf_inbox_mst
  WHERE (is_read = true OR (expires_at IS NOT NULL AND expires_at < now()))
    AND created_at < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  -- NEW: child rows of the dispatch-log rows deleted next. org_ntf_usage_apply_evt references
  -- hq_ntf_dispatch_log(idempotency_key) with NO ACTION, so the parent delete below would otherwise fail.
  DELETE FROM public.org_ntf_usage_apply_evt e
  USING public.hq_ntf_dispatch_log d
  WHERE e.idempotency_key = d.idempotency_key
    AND e.tenant_org_id   = d.tenant_org_id
    AND d.status IN ('SENT', 'PERMANENT_FAILURE')
    AND COALESCE(d.dispatched_at, d.failed_at, d.created_at) < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  DELETE FROM public.hq_ntf_dispatch_log
  WHERE status IN ('SENT', 'PERMANENT_FAILURE')
    AND COALESCE(dispatched_at, failed_at, created_at) < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) IS
  'Purges terminal Notification Hub rows (outbox, delivery log, receipts, in-app inbox, usage-apply ledger, HQ dispatch log) older than the retention window (default 180 days). 0623 adds the usage-apply step, which must precede the dispatch-log delete because of its foreign key. Only terminal rows are ever touched.';
REVOKE EXECUTE ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) TO service_role;

-- 7. Job registry and schedule --------------------------------------------------------------------------------
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2,
  category, module, sub_system, kind, cron_job_name,
  default_schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, notes, created_info
) VALUES (
  'ntf-quota-rsv-sweep', 'Quota reservation sweep', 'تنظيف حجوزات الحصة',
  'Every 5 minutes: expires quota reservations whose sender never settled them and purges settled reservations older than 30 days.',
  'كل 5 دقائق: ينهي حجوزات الحصة التي لم يسوِّها المرسل ويحذف الحجوزات المسوّاة الأقدم من 30 يوما.',
  'CLEANUP', 'ntf', 'quota', 'PG_CRON', 'ntf-quota-rsv-sweep',
  '*/5 * * * *', true, true, 'SYNC',
  '0623', NULL, '0623 seed'
)
ON CONFLICT (job_code) DO NOTHING;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-quota-rsv-sweep';
SELECT cron.schedule('ntf-quota-rsv-sweep', '*/5 * * * *', $$ SELECT public.fn_ntf_quota_rsv_sweep(30) $$);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ntf-quota-rsv-sweep') THEN
    RAISE EXCEPTION '0623: ntf-quota-rsv-sweep cron job was not registered';
  END IF;
END $$;

COMMIT;
