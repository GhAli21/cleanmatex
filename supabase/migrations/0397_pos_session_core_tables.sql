-- =============================================================================
-- 0397_pos_session_core_tables.sql
-- POS Session Management v1 — tenant-safe session and event tables.
-- This migration creates schema only. No runtime lifecycle logic is added here.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. org_pos_sessions_mst
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_pos_sessions_mst (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id         UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL,
  user_id               UUID NOT NULL,
  terminal_id           UUID,
  cash_drawer_id        UUID,
  cash_drawer_session_id UUID,
  session_no            TEXT NOT NULL,
  business_date         DATE NOT NULL,
  business_timezone     TEXT NOT NULL,
  status                TEXT NOT NULL REFERENCES public.sys_pos_session_status_cd(code),
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by             UUID NOT NULL,
  paused_at             TIMESTAMPTZ,
  paused_by             UUID,
  pause_reason          TEXT,
  closed_at             TIMESTAMPTZ,
  closed_by             UUID,
  close_reason          TEXT,
  force_closed_at       TIMESTAMPTZ,
  force_closed_by       UUID,
  force_close_reason    TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            TEXT,
  created_info          TEXT,
  updated_at            TIMESTAMPTZ,
  updated_by            TEXT,
  updated_info          TEXT,
  rec_status            SMALLINT NOT NULL DEFAULT 1,
  rec_order             INTEGER,
  rec_notes             TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_ops_tenant_id
    UNIQUE (tenant_org_id, id),

  CONSTRAINT uq_ops_branch_no
    UNIQUE (tenant_org_id, branch_id, session_no),

  CONSTRAINT chk_ops_sess_no
    CHECK (btrim(session_no) <> ''),

  CONSTRAINT chk_ops_tz
    CHECK (btrim(business_timezone) <> ''),

  CONSTRAINT fk_ops_branch
    FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_ops_term
    FOREIGN KEY (terminal_id)
    REFERENCES public.org_payment_terminals_cf(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ops_drawer
    FOREIGN KEY (cash_drawer_id)
    REFERENCES public.org_cash_drawers_mst(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ops_draw_sess
    FOREIGN KEY (cash_drawer_session_id)
    REFERENCES public.org_cash_drawer_sessions_mst(id)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_user_act
  ON public.org_pos_sessions_mst (tenant_org_id, user_id)
  WHERE status IN ('OPEN', 'PAUSED')
    AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ops_usr_st
  ON public.org_pos_sessions_mst (tenant_org_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_ops_br_st
  ON public.org_pos_sessions_mst (tenant_org_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_ops_opened
  ON public.org_pos_sessions_mst (tenant_org_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_cd_sess
  ON public.org_pos_sessions_mst (tenant_org_id, cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. org_pos_session_events_dtl
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_pos_session_events_dtl (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  pos_session_id   UUID NOT NULL,
  event_type       TEXT NOT NULL REFERENCES public.sys_pos_session_event_type_cd(code),
  previous_status  TEXT REFERENCES public.sys_pos_session_status_cd(code),
  new_status       TEXT REFERENCES public.sys_pos_session_status_cd(code),
  event_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by     UUID NOT NULL,
  reason           TEXT,
  idempotency_key  TEXT,
  source_channel   TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       TEXT,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       TEXT,
  updated_info     TEXT,
  rec_status       SMALLINT NOT NULL DEFAULT 1,
  rec_order        INTEGER,
  rec_notes        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_opse_pos
    FOREIGN KEY (tenant_org_id, pos_session_id)
    REFERENCES public.org_pos_sessions_mst(tenant_org_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opse_pos_evt
  ON public.org_pos_session_events_dtl (tenant_org_id, pos_session_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_opse_typ_evt
  ON public.org_pos_session_events_dtl (tenant_org_id, event_type, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_opse_idem
  ON public.org_pos_session_events_dtl (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_pos_sessions_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_pos_session_events_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_ops_tenant ON public.org_pos_sessions_mst;
CREATE POLICY pol_ops_tenant
  ON public.org_pos_sessions_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS pol_opse_tenant ON public.org_pos_session_events_dtl;
CREATE POLICY pol_opse_tenant
  ON public.org_pos_session_events_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
