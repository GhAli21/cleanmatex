-- Notification Hub R14 — operational safety tooling (provider control, circuit breaker, failover,
-- account health and usage reconciliation).
--
-- 1. sys_ntf_prov_ctl_cf       per (provider, channel) operator state (ACTIVE | PAUSED | DRAINING) and circuit
--                              breaker state (CLOSED | OPEN | HALF_OPEN).
-- 2. sys_ntf_prov_ctl_log      append-only history of every control and breaker transition.
-- 3. sys_ntf_failover_cf       "when provider A is unavailable for a channel, use provider B" rules.
-- 4. fn_ntf_prov_ctl_set       the only writer of the control table: validates, serializes, logs.
-- 5. fn_ntf_provider_health    rolling success / failure counts per provider and channel (test traffic excluded).
-- 6. fn_ntf_usage_reconcile    dispatch-log SENT counts versus metered usage, differences only.
-- 7. Permission hq_notifications:operate and the circuit-breaker registry keys (metadata only).
--
-- Platform-global (sys_*) data, service-role access only, no tenant data. Idempotent.
BEGIN;

-- 1. Control state --------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ntf_prov_ctl_cf (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity.
  provider_code    TEXT        NOT NULL,                               -- Provider code as in org_ntf_channel_provider_cf.provider_code.
  channel_code     TEXT        NOT NULL REFERENCES public.sys_ntf_channel_cd(code),  -- Channel the control applies to.
  control_state    TEXT        NOT NULL DEFAULT 'ACTIVE',              -- Operator decision: ACTIVE, PAUSED or DRAINING.
  control_reason   TEXT,                                               -- Why the operator changed the state (shown on the screen).
  breaker_state    TEXT        NOT NULL DEFAULT 'CLOSED',              -- Circuit breaker: CLOSED, OPEN or HALF_OPEN.
  breaker_reason   TEXT,                                               -- Why the breaker opened (rates and counts, never message content).
  breaker_opened_at TIMESTAMPTZ,                                       -- When the breaker last opened (drives the cool-down).
  changed_by       TEXT,                                               -- Last actor (operator id or circuit-breaker).
  changed_at       TIMESTAMPTZ,                                        -- Last transition time.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),                 -- Row creation time.
  created_by       TEXT,                                               -- Creator.
  created_info     TEXT,                                               -- Creator provenance.
  updated_at       TIMESTAMPTZ,                                        -- Last update.
  updated_by       TEXT,                                               -- Last updater.
  updated_info     TEXT,                                               -- Last updater provenance.
  rec_status       SMALLINT    NOT NULL DEFAULT 1,                     -- Soft-delete status (1 = active).
  rec_order        INTEGER,                                            -- Unused ordering column.
  rec_notes        TEXT,                                               -- Free-text notes.
  is_active        BOOLEAN     NOT NULL DEFAULT true,                  -- Soft-delete flag.
  CONSTRAINT uq_ntf_prov_ctl UNIQUE (provider_code, channel_code),
  CONSTRAINT ck_ntf_prov_ctl_state CHECK (control_state IN ('ACTIVE', 'PAUSED', 'DRAINING')),
  CONSTRAINT ck_ntf_prov_ctl_breaker CHECK (breaker_state IN ('CLOSED', 'OPEN', 'HALF_OPEN'))
);
COMMENT ON TABLE public.sys_ntf_prov_ctl_cf IS
  'Operator control and circuit-breaker state per (provider, channel). PAUSED refuses new commands and holds queued jobs; DRAINING refuses new commands but lets queued jobs finish; an OPEN breaker refuses (or fails over) until the cool-down ends. A missing row means ACTIVE and CLOSED.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.provider_code IS 'Provider code (matches org_ntf_channel_provider_cf.provider_code).';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.channel_code IS 'Channel the control applies to.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.control_state IS 'ACTIVE, PAUSED or DRAINING (operator decision).';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.control_reason IS 'Operator-entered reason for the last control change.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.breaker_state IS 'CLOSED (healthy), OPEN (refusing) or HALF_OPEN (probing).';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.breaker_reason IS 'Why the breaker last opened: counts and rates only.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.breaker_opened_at IS 'When the breaker last opened; the cool-down is measured from here.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.changed_by IS 'Operator id, or circuit-breaker for automatic transitions.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.changed_at IS 'Time of the last transition.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.created_by IS 'Creator.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.created_info IS 'Creator provenance (function name).';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.updated_at IS 'Last update time.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.updated_by IS 'Last updater.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.updated_info IS 'Last updater provenance.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.rec_status IS 'Soft-delete status; 1 = active.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.rec_order IS 'Unused ordering column.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_cf.is_active IS 'Soft-delete flag.';
COMMENT ON CONSTRAINT uq_ntf_prov_ctl ON public.sys_ntf_prov_ctl_cf IS 'One control row per provider and channel.';
COMMENT ON CONSTRAINT ck_ntf_prov_ctl_state ON public.sys_ntf_prov_ctl_cf IS 'Allowed operator states.';
COMMENT ON CONSTRAINT ck_ntf_prov_ctl_breaker ON public.sys_ntf_prov_ctl_cf IS 'Allowed circuit-breaker states.';

-- 2. Transition history --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ntf_prov_ctl_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity.
  provider_code  TEXT        NOT NULL,                               -- Provider affected.
  channel_code   TEXT        NOT NULL,                               -- Channel affected.
  kind           TEXT        NOT NULL,                               -- CONTROL (operator) or BREAKER (automatic or manual breaker reset).
  old_state      TEXT,                                               -- State before.
  new_state      TEXT        NOT NULL,                               -- State after.
  actor          TEXT        NOT NULL,                               -- Operator id or circuit-breaker.
  reason         TEXT,                                               -- Reason given or computed.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),                 -- When the transition happened.
  CONSTRAINT ck_ntf_prov_ctl_log_kind CHECK (kind IN ('CONTROL', 'BREAKER'))
);
COMMENT ON TABLE public.sys_ntf_prov_ctl_log IS 'Append-only history of provider control and circuit-breaker transitions. Holds states, actor and reason only; never message content.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.provider_code IS 'Provider affected.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.channel_code IS 'Channel affected.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.kind IS 'CONTROL or BREAKER.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.old_state IS 'State before the transition.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.new_state IS 'State after the transition.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.actor IS 'Operator id or circuit-breaker.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.reason IS 'Reason given by the operator or computed by the breaker.';
COMMENT ON COLUMN public.sys_ntf_prov_ctl_log.created_at IS 'Time of the transition.';
COMMENT ON CONSTRAINT ck_ntf_prov_ctl_log_kind ON public.sys_ntf_prov_ctl_log IS 'Transition kinds.';
CREATE INDEX IF NOT EXISTS idx_ntf_prov_ctl_log_prov ON public.sys_ntf_prov_ctl_log (provider_code, channel_code, created_at DESC);
COMMENT ON INDEX public.idx_ntf_prov_ctl_log_prov IS 'Per-provider history, newest first.';

-- 3. Failover rules ------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ntf_failover_cf (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity.
  channel_code   TEXT        NOT NULL REFERENCES public.sys_ntf_channel_cd(code),  -- Channel the rule applies to.
  from_provider  TEXT        NOT NULL,                               -- Primary provider code.
  to_provider    TEXT        NOT NULL,                               -- Provider used while the primary is unavailable.
  priority       INTEGER     NOT NULL DEFAULT 1,                     -- Lower first when several targets exist.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),                 -- Row creation time.
  created_by     TEXT,                                               -- Creator.
  created_info   TEXT,                                               -- Creator provenance.
  updated_at     TIMESTAMPTZ,                                        -- Last update.
  updated_by     TEXT,                                               -- Last updater.
  updated_info   TEXT,                                               -- Last updater provenance.
  rec_status     SMALLINT    NOT NULL DEFAULT 1,                     -- Soft-delete status (1 = active).
  rec_order      INTEGER,                                            -- Unused ordering column.
  rec_notes      TEXT,                                               -- Free-text notes.
  is_active      BOOLEAN     NOT NULL DEFAULT true,                  -- Rule switch.
  CONSTRAINT uq_ntf_failover UNIQUE (channel_code, from_provider, to_provider),
  CONSTRAINT ck_ntf_failover_distinct CHECK (from_provider <> to_provider),
  CONSTRAINT ck_ntf_failover_priority CHECK (priority BETWEEN 1 AND 100)
);
COMMENT ON TABLE public.sys_ntf_failover_cf IS 'Failover rules: while the primary provider of a channel is paused or its breaker is open, commands go to the target provider if it has a registered connector and is itself available. Platform-managed routes only (a tenant BYO route never fails over).';
COMMENT ON COLUMN public.sys_ntf_failover_cf.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.channel_code IS 'Channel the rule applies to.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.from_provider IS 'Primary provider code.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.to_provider IS 'Target provider code.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.priority IS 'Order among several targets (1 first).';
COMMENT ON COLUMN public.sys_ntf_failover_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.created_by IS 'Creator.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.created_info IS 'Creator provenance.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.updated_at IS 'Last update time.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.updated_by IS 'Last updater.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.updated_info IS 'Last updater provenance.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.rec_status IS 'Soft-delete status; 1 = active.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.rec_order IS 'Unused ordering column.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.sys_ntf_failover_cf.is_active IS 'Rule switch; false disables the rule.';
COMMENT ON CONSTRAINT uq_ntf_failover ON public.sys_ntf_failover_cf IS 'One rule per channel and provider pair.';
COMMENT ON CONSTRAINT ck_ntf_failover_distinct ON public.sys_ntf_failover_cf IS 'A provider cannot fail over to itself.';
COMMENT ON CONSTRAINT ck_ntf_failover_priority ON public.sys_ntf_failover_cf IS 'Priority range.';

-- Access: platform-global, service role only (RLS enabled with no policy denies anon and authenticated).
ALTER TABLE public.sys_ntf_prov_ctl_cf  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_ntf_prov_ctl_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_ntf_failover_cf  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_ntf_prov_ctl_cf, public.sys_ntf_prov_ctl_log, public.sys_ntf_failover_cf FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sys_ntf_prov_ctl_cf TO service_role;           -- written only through fn_ntf_prov_ctl_set
GRANT SELECT, INSERT ON public.sys_ntf_prov_ctl_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sys_ntf_failover_cf TO service_role;

-- 4. The one writer of the control table ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_prov_ctl_set(
  p_provider TEXT,
  p_channel  TEXT,
  p_kind     TEXT,
  p_state    TEXT,
  p_actor    TEXT,
  p_reason   TEXT,
  p_expected TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor  TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
  v_reason TEXT := left(NULLIF(btrim(p_reason), ''), 500);
  v_old    TEXT;
  v_row    public.sys_ntf_prov_ctl_cf%ROWTYPE;
BEGIN
  IF p_kind NOT IN ('CONTROL', 'BREAKER') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_KIND', 'message', 'Kind must be CONTROL or BREAKER');
  END IF;
  IF p_kind = 'CONTROL' AND p_state NOT IN ('ACTIVE', 'PAUSED', 'DRAINING') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATE', 'message', 'Control state must be ACTIVE, PAUSED or DRAINING');
  END IF;
  IF p_kind = 'BREAKER' AND p_state NOT IN ('CLOSED', 'OPEN', 'HALF_OPEN') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATE', 'message', 'Breaker state must be CLOSED, OPEN or HALF_OPEN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_ntf_channel_cd WHERE code = p_channel) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_CHANNEL', 'message', 'Unknown channel');
  END IF;

  -- Serialize concurrent changes for the same provider and channel (a missing row is created first).
  INSERT INTO public.sys_ntf_prov_ctl_cf (provider_code, channel_code, created_by, created_info)
  VALUES (upper(btrim(p_provider)), p_channel, v_actor, 'fn_ntf_prov_ctl_set')
  ON CONFLICT (provider_code, channel_code) DO NOTHING;

  SELECT * INTO v_row FROM public.sys_ntf_prov_ctl_cf
  WHERE provider_code = upper(btrim(p_provider)) AND channel_code = p_channel
  FOR UPDATE;

  v_old := CASE WHEN p_kind = 'CONTROL' THEN v_row.control_state ELSE v_row.breaker_state END;

  -- Compare-and-set for automatic transitions: the breaker only moves from the state it evaluated.
  IF p_expected IS NOT NULL AND p_expected <> v_old THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_STATE', 'message', 'State changed meanwhile', 'old', v_old);
  END IF;
  IF v_old = p_state THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE', 'message', 'Already in that state', 'old', v_old, 'new', p_state);
  END IF;

  IF p_kind = 'CONTROL' THEN
    UPDATE public.sys_ntf_prov_ctl_cf
    SET control_state = p_state, control_reason = v_reason, changed_by = v_actor, changed_at = now(),
        updated_at = now(), updated_by = v_actor, updated_info = 'fn_ntf_prov_ctl_set'
    WHERE id = v_row.id;
  ELSE
    UPDATE public.sys_ntf_prov_ctl_cf
    SET breaker_state = p_state,
        breaker_reason = CASE WHEN p_state = 'CLOSED' THEN NULL ELSE v_reason END,
        breaker_opened_at = CASE WHEN p_state = 'OPEN' THEN now() WHEN p_state = 'CLOSED' THEN NULL ELSE breaker_opened_at END,
        changed_by = v_actor, changed_at = now(),
        updated_at = now(), updated_by = v_actor, updated_info = 'fn_ntf_prov_ctl_set'
    WHERE id = v_row.id;
  END IF;

  INSERT INTO public.sys_ntf_prov_ctl_log (provider_code, channel_code, kind, old_state, new_state, actor, reason)
  VALUES (v_row.provider_code, p_channel, p_kind, v_old, p_state, v_actor, v_reason);

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'State updated', 'old', v_old, 'new', p_state);
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_prov_ctl_set(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Sets the operator control state (CONTROL) or the circuit-breaker state (BREAKER) of a provider and channel under a row lock, with an optional expected-state check (STALE_STATE) for automatic transitions, and logs the transition. The only writer of sys_ntf_prov_ctl_cf.';
REVOKE ALL ON FUNCTION public.fn_ntf_prov_ctl_set(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_prov_ctl_set(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 5. Account health ------------------------------------------------------------------------------------------
-- A "provider failure" is a temporary failure, or a permanent failure the provider itself caused
-- (rejected credentials or request). Our own refusals (quota, missing configuration, unsupported channel,
-- paused or open) are not provider health and are ignored. Test traffic is excluded.
CREATE OR REPLACE FUNCTION public.fn_ntf_provider_health(p_window_minutes INTEGER DEFAULT 10)
RETURNS TABLE (
  provider_code    TEXT,
  channel_code     TEXT,
  sent_count       INTEGER,
  failed_count     INTEGER,
  last_success_at  TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT d.provider_code,
         d.channel_code,
         count(*) FILTER (WHERE d.status = 'SENT')::INTEGER,
         count(*) FILTER (WHERE d.status = 'FAILED'
                             OR (d.status = 'PERMANENT_FAILURE' AND d.error_code IN ('PROVIDER_AUTH_FAILED', 'PROVIDER_REJECTED')))::INTEGER,
         max(d.dispatched_at),
         max(d.failed_at) FILTER (WHERE d.status = 'FAILED'
                             OR (d.status = 'PERMANENT_FAILURE' AND d.error_code IN ('PROVIDER_AUTH_FAILED', 'PROVIDER_REJECTED')))
  FROM public.hq_ntf_dispatch_log d
  WHERE d.is_test = false
    AND d.created_at >= now() - make_interval(mins => GREATEST(LEAST(COALESCE(p_window_minutes, 10), 1440), 1))
  GROUP BY d.provider_code, d.channel_code;
$$;
COMMENT ON FUNCTION public.fn_ntf_provider_health(INTEGER) IS
  'Rolling provider health from the HQ dispatch log (window 1-1440 minutes, default 10): sent and failed counts per provider and channel. Failures are temporary failures and provider-caused permanent failures; refusals of our own (quota, not configured, paused) and test traffic are ignored.';
REVOKE ALL ON FUNCTION public.fn_ntf_provider_health(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_provider_health(INTEGER) TO service_role;

-- 6. Usage reconciliation ------------------------------------------------------------------------------------
-- HQ-wide report (every tenant, by design): SENT commands in the dispatch log against the usage that was
-- metered for the same tenant, channel and UTC day. Only differences are returned.
CREATE OR REPLACE FUNCTION public.fn_ntf_usage_reconcile(p_from DATE, p_to DATE)
RETURNS TABLE (
  tenant_org_id  UUID,
  channel_code   TEXT,
  usage_date     DATE,
  dispatch_sent  BIGINT,
  metered_sent   BIGINT,
  difference     BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH dispatched AS (
    SELECT l.tenant_org_id, l.channel_code, (l.dispatched_at AT TIME ZONE 'UTC')::DATE AS usage_date, count(*) AS n
    FROM public.hq_ntf_dispatch_log l
    WHERE l.status = 'SENT' AND l.is_test = false
      AND l.dispatched_at >= (p_from::TIMESTAMP AT TIME ZONE 'UTC')
      AND l.dispatched_at <  ((p_to + 1)::TIMESTAMP AT TIME ZONE 'UTC')
    GROUP BY 1, 2, 3
  ), metered AS (
    SELECT u.tenant_org_id, u.channel_code, u.usage_date, sum(u.sent_count) AS n
    FROM public.org_ntf_usage_daily u
    WHERE u.usage_date BETWEEN p_from AND p_to
    GROUP BY 1, 2, 3
  )
  SELECT COALESCE(d.tenant_org_id, m.tenant_org_id),
         COALESCE(d.channel_code, m.channel_code),
         COALESCE(d.usage_date, m.usage_date),
         COALESCE(d.n, 0)::BIGINT,
         COALESCE(m.n, 0)::BIGINT,
         (COALESCE(d.n, 0) - COALESCE(m.n, 0))::BIGINT
  FROM dispatched d
  FULL JOIN metered m
    ON m.tenant_org_id = d.tenant_org_id AND m.channel_code = d.channel_code AND m.usage_date = d.usage_date
  WHERE COALESCE(d.n, 0) <> COALESCE(m.n, 0)
  ORDER BY 3 DESC, 1, 2
  LIMIT 1000;
$$;
COMMENT ON FUNCTION public.fn_ntf_usage_reconcile(DATE, DATE) IS
  'Differences between SENT commands in hq_ntf_dispatch_log (test traffic excluded) and metered org_ntf_usage_daily.sent_count per tenant, channel and UTC day, across all tenants (HQ report, service role only). A positive difference means sends that were never metered. Capped at 1000 rows.';
REVOKE ALL ON FUNCTION public.fn_ntf_usage_reconcile(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_usage_reconcile(DATE, DATE) TO service_role;

-- 7. Permission and registry keys ----------------------------------------------------------------------------
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT seed.code, seed.name_en, seed.name_ar,
       split_part(seed.code, ':', 1), split_part(seed.code, ':', 2),
       true, true, '0625 notification operational safety'
FROM (
  VALUES ('hq_notifications:operate', 'Operate notification providers (pause, drain, failover)', 'تشغيل مزودي الإشعارات (إيقاف، تصريف، تحويل)')
) AS seed(code, name_en, name_ar)
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO public.sys_ops_config_cf (
  config_key, module, name, name2, description, description2, value_type, is_secret, is_encrypted, source_policy,
  env_var_name, is_bootstrap, is_wired, requires_restart, manage_via, guidance, guidance2, applies_to_app, env_var_scope_val,
  created_info, is_active, rec_status
) VALUES
  ('ntf.hq.breaker.enabled', 'ntf', 'Circuit breaker enabled', 'تفعيل قاطع الدائرة',
   'true lets HQ API open a provider''s circuit automatically when its failure rate is too high. false = only operator pause and drain apply.',
   'القيمة true تسمح لواجهة HQ بفتح دائرة المزوّد تلقائيًا عند ارتفاع نسبة الفشل. false = يبقى الإيقاف والتصريف اليدوي فقط.',
   'BOOLEAN', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_BREAKER_ENABLED', false, true, false, 'UI',
   'Default true. Takes effect within a minute.', 'الافتراضي true. يسري خلال دقيقة.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0625_ntf_operational_safety', true, 1),
  ('ntf.hq.breaker.window_minutes', 'ntf', 'Circuit breaker window (minutes)', 'نافذة قاطع الدائرة (دقائق)',
   'Length of the rolling window used to compute a provider''s failure rate (1-60, default 10).',
   'طول النافذة المتحركة لحساب نسبة فشل المزوّد (1-60، الافتراضي 10).',
   'NUMBER', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_BREAKER_WINDOW_MIN', false, true, false, 'UI',
   'Whole minutes.', 'دقائق صحيحة.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0625_ntf_operational_safety', true, 1),
  ('ntf.hq.breaker.min_volume', 'ntf', 'Circuit breaker minimum volume', 'الحد الأدنى لحجم قاطع الدائرة',
   'The breaker only judges a provider that handled at least this many commands in the window (1-1000, default 10).',
   'لا يحكم القاطع إلا على مزوّد عالج هذا العدد من الأوامر على الأقل خلال النافذة (1-1000، الافتراضي 10).',
   'NUMBER', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_BREAKER_MIN_VOLUME', false, true, false, 'UI',
   'Whole number.', 'عدد صحيح.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0625_ntf_operational_safety', true, 1),
  ('ntf.hq.breaker.failure_pct', 'ntf', 'Circuit breaker failure threshold (%)', 'عتبة فشل قاطع الدائرة (%)',
   'The breaker opens when failures reach this percentage of the window''s judged commands (1-100, default 50).',
   'يُفتح القاطع عندما تبلغ الإخفاقات هذه النسبة من أوامر النافذة (1-100، الافتراضي 50).',
   'NUMBER', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_BREAKER_FAILURE_PCT', false, true, false, 'UI',
   'Whole percentage.', 'نسبة مئوية صحيحة.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0625_ntf_operational_safety', true, 1),
  ('ntf.hq.breaker.cooldown_seconds', 'ntf', 'Circuit breaker cool-down (seconds)', 'مهلة تهدئة قاطع الدائرة (ثوانٍ)',
   'How long an open circuit stays open before probing the provider again (10-3600, default 120).',
   'المدة التي تبقى فيها الدائرة المفتوحة مفتوحة قبل اختبار المزوّد من جديد (10-3600، الافتراضي 120).',
   'NUMBER', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_BREAKER_COOLDOWN_SEC', false, true, false, 'UI',
   'Whole seconds.', 'ثوانٍ صحيحة.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0625_ntf_operational_safety', true, 1)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
