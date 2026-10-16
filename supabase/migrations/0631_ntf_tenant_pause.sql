-- Notification Hub: platform-wide pause of ONE organization (R14 follow-up, owner decision 2026-10-16).
--
-- Provider pause (0625) stops a provider for everybody. This adds the opposite control: an HQ operator stops the
-- notifications of ONE organization, on every channel or on one channel, for example because of abuse, a billing
-- suspension, a compromised account or a wrong bulk send.
--
-- Semantics (deliberate):
--   * A command of a paused organization is REFUSED, not held: the dispatcher records PERMANENT_FAILURE with the
--     error code TENANT_PAUSED, gives the quota unit back, calls no provider and meters nothing. Holding messages
--     for days and releasing them all at once on resume would be a spam burst; the organization's own outbox shows
--     the refusal and can resend what still matters after the resume.
--   * Covers the channels that go through HQ: EMAIL, SMS, WHATSAPP, PUSH. IN_APP is created inside the tenant
--     application and is not governed here.
--   * Scope is the organization (channel_code 'ALL') or one channel; either row paused is enough to refuse.
--   * Written only through fn_ntf_tenant_pause_set (row lock, validation, history); read by the dispatcher and the
--     queue workers through fn_ntf_tenant_is_paused. Service role only. No new permission: hq_notifications:operate.
--
-- Affected: sys_ntf_tenant_pause_cf (new), sys_ntf_tenant_pause_log (new), functions fn_ntf_tenant_pause_set,
--           fn_ntf_tenant_is_paused, fn_ntf_tenant_pause_list (new).
-- Related:  0625_ntf_operational_safety.sql (provider control, same shape).
BEGIN;

-- 1. Current state ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ntf_tenant_pause_cf (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity.
  tenant_org_id  UUID        NOT NULL REFERENCES public.org_tenants_mst(id),  -- Organization whose notifications are controlled.
  channel_code   TEXT        NOT NULL DEFAULT 'ALL',                 -- ALL, or one of EMAIL, SMS, WHATSAPP, PUSH.
  is_paused      BOOLEAN     NOT NULL DEFAULT false,                 -- True while the organization is paused for this scope.
  reason         TEXT,                                               -- Why the operator paused it (shown on the screen).
  changed_by     TEXT,                                               -- Last actor (operator id).
  changed_at     TIMESTAMPTZ,                                        -- Last transition time.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),                 -- Row creation time.
  created_by     TEXT,                                               -- Creator.
  created_info   TEXT,                                               -- Creator provenance.
  updated_at     TIMESTAMPTZ,                                        -- Last update.
  updated_by     TEXT,                                               -- Last updater.
  updated_info   TEXT,                                               -- Last updater provenance.
  rec_status     SMALLINT    NOT NULL DEFAULT 1,                     -- Soft-delete status (1 = active).
  rec_order      INTEGER,                                            -- Unused ordering column.
  rec_notes      TEXT,                                               -- Free-text notes.
  is_active      BOOLEAN     NOT NULL DEFAULT true,                  -- Soft-delete flag.
  CONSTRAINT uq_ntf_tenant_pause UNIQUE (tenant_org_id, channel_code),
  CONSTRAINT ck_ntf_tenant_pause_channel CHECK (channel_code IN ('ALL', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'))
);
COMMENT ON TABLE public.sys_ntf_tenant_pause_cf IS
  'Operator pause of the notifications of one organization (all channels or one). A paused organization''s commands are refused with TENANT_PAUSED without calling a provider. A missing row means not paused. Written only through fn_ntf_tenant_pause_set.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.tenant_org_id IS 'Organization whose notifications are controlled.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.channel_code IS 'ALL or one channel (EMAIL, SMS, WHATSAPP, PUSH).';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.is_paused IS 'True while paused for this scope.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.reason IS 'Operator-entered reason for the last pause.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.changed_by IS 'Operator who made the last change.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.changed_at IS 'Time of the last change.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.created_by IS 'Creator.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.created_info IS 'Creator provenance.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.updated_at IS 'Last update time.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.updated_by IS 'Last updater.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.updated_info IS 'Last updater provenance.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.rec_status IS 'Soft-delete status; 1 = active.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.rec_order IS 'Unused ordering column.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_cf.is_active IS 'Soft-delete flag.';
COMMENT ON CONSTRAINT uq_ntf_tenant_pause ON public.sys_ntf_tenant_pause_cf IS 'One row per organization and scope.';
COMMENT ON CONSTRAINT ck_ntf_tenant_pause_channel ON public.sys_ntf_tenant_pause_cf IS 'Allowed scopes: ALL or a channel served through HQ.';
-- Lookup used by the dispatcher on every command: only paused rows matter.
CREATE INDEX IF NOT EXISTS idx_ntf_tenant_pause_paused ON public.sys_ntf_tenant_pause_cf (tenant_org_id) WHERE is_paused;
COMMENT ON INDEX public.idx_ntf_tenant_pause_paused IS 'Finds the paused scopes of an organization quickly (partial index).';

-- 2. History ---------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ntf_tenant_pause_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity.
  tenant_org_id  UUID        NOT NULL,                               -- Organization affected (no FK: history outlives the row).
  channel_code   TEXT        NOT NULL,                               -- Scope affected.
  old_paused     BOOLEAN,                                            -- State before.
  new_paused     BOOLEAN     NOT NULL,                               -- State after.
  actor          TEXT        NOT NULL,                               -- Operator id.
  reason         TEXT,                                               -- Reason given.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()                  -- When the change happened.
);
COMMENT ON TABLE public.sys_ntf_tenant_pause_log IS 'Append-only history of organization pauses and resumes: who, when, why. Never message content.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.tenant_org_id IS 'Organization affected.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.channel_code IS 'Scope affected (ALL or a channel).';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.old_paused IS 'State before the change.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.new_paused IS 'State after the change.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.actor IS 'Operator id.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.reason IS 'Reason given by the operator.';
COMMENT ON COLUMN public.sys_ntf_tenant_pause_log.created_at IS 'Time of the change.';
CREATE INDEX IF NOT EXISTS idx_ntf_tenant_pause_log_tenant ON public.sys_ntf_tenant_pause_log (tenant_org_id, created_at DESC);
COMMENT ON INDEX public.idx_ntf_tenant_pause_log_tenant IS 'Per-organization history, newest first.';

-- 3. Access: service role only (the HQ API); tables are written only through the function ------------------------
ALTER TABLE public.sys_ntf_tenant_pause_cf  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_ntf_tenant_pause_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_ntf_tenant_pause_cf  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sys_ntf_tenant_pause_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sys_ntf_tenant_pause_cf TO service_role;            -- written only through fn_ntf_tenant_pause_set
GRANT SELECT, INSERT ON public.sys_ntf_tenant_pause_log TO service_role;

-- 4. fn_ntf_tenant_pause_set: the only writer ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_tenant_pause_set(
  p_tenant_org_id UUID,
  p_channel       TEXT,
  p_paused        BOOLEAN,
  p_actor         TEXT,
  p_reason        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
  v_reason  TEXT := left(NULLIF(btrim(p_reason), ''), 500);
  v_channel TEXT := upper(btrim(COALESCE(p_channel, 'ALL')));
  v_row     public.sys_ntf_tenant_pause_cf%ROWTYPE;
BEGIN
  IF p_paused IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATE', 'message', 'paused must be true or false');
  END IF;
  IF v_channel NOT IN ('ALL', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_CHANNEL', 'message', 'Channel must be ALL, EMAIL, SMS, WHATSAPP or PUSH');
  END IF;
  IF p_paused AND v_reason IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED', 'message', 'A reason is required to pause an organization');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.org_tenants_mst t WHERE t.id = p_tenant_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_TENANT', 'message', 'Organization not found');
  END IF;

  -- Serialize concurrent changes for the same organization and scope (a missing row is created first).
  INSERT INTO public.sys_ntf_tenant_pause_cf (tenant_org_id, channel_code, created_by, created_info)
  VALUES (p_tenant_org_id, v_channel, v_actor, 'fn_ntf_tenant_pause_set')
  ON CONFLICT (tenant_org_id, channel_code) DO NOTHING;

  SELECT * INTO v_row FROM public.sys_ntf_tenant_pause_cf
   WHERE tenant_org_id = p_tenant_org_id AND channel_code = v_channel
   FOR UPDATE;

  IF v_row.is_paused = p_paused THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE', 'message', 'Already in that state',
                              'old', v_row.is_paused, 'new', p_paused);
  END IF;

  UPDATE public.sys_ntf_tenant_pause_cf
     SET is_paused = p_paused,
         reason = CASE WHEN p_paused THEN v_reason ELSE NULL END,
         changed_by = v_actor, changed_at = now(),
         updated_at = now(), updated_by = v_actor, updated_info = 'fn_ntf_tenant_pause_set'
   WHERE id = v_row.id;

  INSERT INTO public.sys_ntf_tenant_pause_log (tenant_org_id, channel_code, old_paused, new_paused, actor, reason)
  VALUES (p_tenant_org_id, v_channel, v_row.is_paused, p_paused, v_actor, v_reason);

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'State updated', 'old', v_row.is_paused, 'new', p_paused);
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_tenant_pause_set(UUID, TEXT, BOOLEAN, TEXT, TEXT) IS
  'Pauses or resumes the notifications of one organization (channel ALL or one channel) under a row lock. A reason is required to pause. Writes the history row. Returns {ok, code, message, old, new}; codes: UPDATED, NOTHING_TO_CHANGE, INVALID_STATE, UNKNOWN_CHANNEL, REASON_REQUIRED, UNKNOWN_TENANT. Service role only.';
REVOKE ALL ON FUNCTION public.fn_ntf_tenant_pause_set(UUID, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_tenant_pause_set(UUID, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;

-- 5. fn_ntf_tenant_is_paused: the hot-path read -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_tenant_is_paused(p_tenant_org_id UUID, p_channel TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sys_ntf_tenant_pause_cf c
     WHERE c.tenant_org_id = p_tenant_org_id
       AND c.is_paused
       AND c.is_active AND c.rec_status = 1
       AND c.channel_code IN ('ALL', upper(btrim(p_channel)))
  );
$$;
COMMENT ON FUNCTION public.fn_ntf_tenant_is_paused(UUID, TEXT) IS
  'True when the organization is paused for the channel (its own row or the ALL row). Used by the HQ dispatcher and the queue workers before any provider call. Service role only.';
REVOKE ALL ON FUNCTION public.fn_ntf_tenant_is_paused(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_tenant_is_paused(UUID, TEXT) TO service_role;

-- 6. fn_ntf_tenant_pause_list: the Operations screen ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_tenant_pause_list()
RETURNS TABLE (
  tenant_org_id  UUID,
  tenant_name    TEXT,
  channel_code   TEXT,
  reason         TEXT,
  changed_by     TEXT,
  changed_at     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.tenant_org_id, t.name::TEXT, c.channel_code, c.reason, c.changed_by, c.changed_at
    FROM public.sys_ntf_tenant_pause_cf c
    JOIN public.org_tenants_mst t ON t.id = c.tenant_org_id
   WHERE c.is_paused AND c.is_active AND c.rec_status = 1
   ORDER BY c.changed_at DESC NULLS LAST, t.name
   LIMIT 500;
$$;
COMMENT ON FUNCTION public.fn_ntf_tenant_pause_list() IS
  'Currently paused organization scopes with the organization name, reason, actor and time (newest first, capped at 500). Platform-wide HQ read; service role only.';
REVOKE ALL ON FUNCTION public.fn_ntf_tenant_pause_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_tenant_pause_list() TO service_role;

COMMIT;
