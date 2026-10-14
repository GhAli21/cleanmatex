-- Notification Hub — repeated soft-bounce tracking (A2 residual, R2).
--
-- A single transient (soft) bounce must not suppress an address, but repeated soft
-- bounces inside a rolling window should be promoted to a BOUNCE_SOFT_REPEATED
-- suppression (reason already allowed by ck_ntf_suppr_reason in 0603). Counting and
-- promotion are done in ONE atomic SQL function so concurrent webhook deliveries
-- cannot lose increments or double-promote.
BEGIN;

-- Rolling soft-bounce counter, one row per (tenant, channel, normalized address).
CREATE TABLE IF NOT EXISTS org_ntf_soft_bounce_lst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  channel_code TEXT NOT NULL,
  address_or_number TEXT NOT NULL,
  bounce_count INTEGER NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_bounce_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_ntf_sbnc_tenant
    FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_sbnc_addr
    UNIQUE (tenant_org_id, channel_code, address_or_number),
  CONSTRAINT ck_ntf_sbnc_channel CHECK (channel_code IN ('EMAIL', 'SMS')),
  CONSTRAINT ck_ntf_sbnc_count CHECK (bounce_count >= 1),
  CONSTRAINT ck_ntf_sbnc_nonempty CHECK (btrim(address_or_number) <> '')
);

COMMENT ON TABLE org_ntf_soft_bounce_lst IS
  'Rolling counter of provider-reported transient (soft) bounces per tenant/channel/address; reaching the threshold promotes the address to org_ntf_suppression_lst as BOUNCE_SOFT_REPEATED. Written only by fn_ntf_soft_bounce_record.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.id IS 'Surrogate identity of the counter row.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.tenant_org_id IS 'Tenant owner; required for RLS and explicit predicates.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.channel_code IS 'EMAIL or SMS (same channels as the suppression list).';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.address_or_number IS 'Normalized recipient identity (lowercase email / E.164 number), same form as org_ntf_suppression_lst.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.bounce_count IS 'Soft bounces observed inside the current window; reset to 1 when the window expires.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.window_started_at IS 'Start of the current rolling window; a bounce arriving after window_started_at + window starts a new window.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.last_bounce_at IS 'Time of the most recent counted soft bounce.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.last_event_id IS 'Provider event id (e.g. svix-id) of the last counted bounce; a redelivery of the same id is not counted twice.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.created_at IS 'UTC insertion time.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.created_by IS 'Trusted service identity that created the row.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.created_info IS 'Non-secret creation context.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.updated_at IS 'Last time the counter was updated.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.updated_by IS 'Trusted service identity that last updated the row.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.updated_info IS 'Non-secret update context.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.rec_status IS 'Record lifecycle marker; 1=active.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.rec_order IS 'Reserved compatibility ordering field; unused.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.rec_notes IS 'Optional operator note; never provider payload or credentials.';
COMMENT ON COLUMN org_ntf_soft_bounce_lst.is_active IS 'Soft-activity marker mirroring rec_status.';
COMMENT ON CONSTRAINT fk_ntf_sbnc_tenant ON org_ntf_soft_bounce_lst IS 'Requires an existing tenant; RESTRICT preserves evidence.';
COMMENT ON CONSTRAINT uq_ntf_sbnc_addr ON org_ntf_soft_bounce_lst IS 'One counter per tenant/channel/address; enables the atomic ON CONFLICT upsert.';
COMMENT ON CONSTRAINT ck_ntf_sbnc_channel ON org_ntf_soft_bounce_lst IS 'Restricts counters to EMAIL/SMS.';
COMMENT ON CONSTRAINT ck_ntf_sbnc_count ON org_ntf_soft_bounce_lst IS 'A counter row always represents at least one bounce.';
COMMENT ON CONSTRAINT ck_ntf_sbnc_nonempty ON org_ntf_soft_bounce_lst IS 'Prevents a blank address from being recorded.';

ALTER TABLE org_ntf_soft_bounce_lst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_iso_ntf_sbnc_read
  ON org_ntf_soft_bounce_lst
  FOR SELECT
  USING (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_sbnc_read ON org_ntf_soft_bounce_lst IS
  'Tenants may read only their own counters. No write policy: only service-role code (fn_ntf_soft_bounce_record) writes.';

-- Records one soft bounce atomically and promotes to suppression at the threshold.
-- Returns jsonb {bounce_count, suppressed, duplicate}. A redelivered p_event_id equal to
-- the row's last_event_id is a no-op (duplicate=true). Suppression promotion never
-- downgrades an active BOUNCE_HARD / COMPLAINT entry.
CREATE OR REPLACE FUNCTION fn_ntf_soft_bounce_record(
  p_tenant_org_id UUID,
  p_channel_code TEXT,
  p_address TEXT,
  p_event_id TEXT,
  p_threshold INTEGER,
  p_window_hours INTEGER,
  p_source TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER;
  v_dup BOOLEAN := false;
  v_suppressed BOOLEAN := false;
BEGIN
  IF p_threshold < 2 OR p_window_hours < 1 THEN
    RAISE EXCEPTION 'invalid soft-bounce policy: threshold>=2 and window>=1 required';
  END IF;

  INSERT INTO org_ntf_soft_bounce_lst AS b (
    tenant_org_id, channel_code, address_or_number, bounce_count,
    window_started_at, last_bounce_at, last_event_id, created_by
  ) VALUES (
    p_tenant_org_id, p_channel_code, p_address, 1, v_now, v_now, p_event_id, p_source
  )
  ON CONFLICT (tenant_org_id, channel_code, address_or_number) DO UPDATE SET
    bounce_count = CASE
      WHEN b.last_event_id IS NOT NULL AND b.last_event_id = EXCLUDED.last_event_id THEN b.bounce_count
      WHEN b.window_started_at < v_now - make_interval(hours => p_window_hours) THEN 1
      ELSE b.bounce_count + 1 END,
    window_started_at = CASE
      WHEN b.last_event_id IS NOT NULL AND b.last_event_id = EXCLUDED.last_event_id THEN b.window_started_at
      WHEN b.window_started_at < v_now - make_interval(hours => p_window_hours) THEN v_now
      ELSE b.window_started_at END,
    last_bounce_at = CASE
      WHEN b.last_event_id IS NOT NULL AND b.last_event_id = EXCLUDED.last_event_id THEN b.last_bounce_at
      ELSE v_now END,
    last_event_id = EXCLUDED.last_event_id,
    updated_at = v_now,
    updated_by = p_source
  WHERE b.tenant_org_id = p_tenant_org_id
  RETURNING bounce_count, (xmax <> 0 AND last_bounce_at <> v_now) INTO v_count, v_dup;

  IF v_count >= p_threshold THEN
    INSERT INTO org_ntf_suppression_lst AS s (
      tenant_org_id, channel_code, address_or_number, reason_code, source, detail,
      suppressed_at, updated_at, updated_by, rec_status, is_active
    ) VALUES (
      p_tenant_org_id, p_channel_code, p_address, 'BOUNCE_SOFT_REPEATED', p_source,
      'soft bounces=' || v_count, v_now, v_now, p_source, 1, true
    )
    ON CONFLICT (tenant_org_id, channel_code, address_or_number) DO UPDATE SET
      reason_code = 'BOUNCE_SOFT_REPEATED', source = EXCLUDED.source, detail = EXCLUDED.detail,
      suppressed_at = v_now, updated_at = v_now, updated_by = p_source, rec_status = 1, is_active = true
    WHERE s.tenant_org_id = p_tenant_org_id
      AND (s.rec_status = 0 OR s.reason_code = 'BOUNCE_SOFT_REPEATED');
    v_suppressed := true;
  END IF;

  RETURN jsonb_build_object('bounce_count', v_count, 'suppressed', v_suppressed, 'duplicate', COALESCE(v_dup, false));
END;
$$;

COMMENT ON FUNCTION fn_ntf_soft_bounce_record(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) IS
  'Atomically counts one soft bounce for a tenant/channel/address in a rolling window (idempotent per p_event_id) and promotes to BOUNCE_SOFT_REPEATED suppression at p_threshold. Never downgrades an active hard-bounce/complaint suppression. Service-role only.';

-- Writes happen only from trusted server code using the service role.
REVOKE ALL ON FUNCTION fn_ntf_soft_bounce_record(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_ntf_soft_bounce_record(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO service_role;

COMMIT;
