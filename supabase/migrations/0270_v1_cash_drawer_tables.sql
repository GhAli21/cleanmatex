-- =============================================================================
-- Migration 0270: Payment Config Client Layer — Cash Drawer Tables
-- Creates cash drawer inventory, session management, and movement tracking.
-- Also adds generate_session_no() DB function.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. generate_session_no()
--    Produces SES-YYYYMMDD-XXXX per tenant, same pattern as generate_order_number().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_session_no(p_tenant_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  SELECT COALESCE(MAX(CAST(SUBSTRING(session_no FROM 13) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM public.org_cash_drawer_sessions_mst
   WHERE tenant_org_id = p_tenant_org_id
     AND session_no LIKE 'SES-' || v_date || '-%';

  RETURN 'SES-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. org_cash_drawers_mst
--    Physical cash drawer inventory per branch.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawers_mst (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                       UUID NOT NULL,

  drawer_code                     TEXT NOT NULL,
  drawer_name                     TEXT NOT NULL,
  drawer_name2                    TEXT,

  drawer_type                     TEXT NOT NULL DEFAULT 'COUNTER',
  currency_code                   TEXT NOT NULL,

  requires_session                BOOLEAN NOT NULL DEFAULT TRUE,
  opening_float_required          BOOLEAN NOT NULL DEFAULT TRUE,
  max_cash_limit                  DECIMAL(19,4),

  -- Optional terminal assignment
  assigned_user_id                UUID,
  assigned_terminal_id            UUID REFERENCES public.org_payment_terminals_cf(id) ON DELETE SET NULL,

  -- Audit
  created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                      TEXT,
  created_info                    TEXT,
  updated_at                      TIMESTAMPTZ,
  updated_by                      TEXT,
  updated_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  CONSTRAINT uq_org_cash_drawers_mst_code
    UNIQUE (tenant_org_id, drawer_code),

  CONSTRAINT chk_org_cash_drawers_type
    CHECK (drawer_type IN ('COUNTER','SAFE','DRIVER_BAG','TEMPORARY')),

  CONSTRAINT chk_org_cash_drawers_max_cash
    CHECK (max_cash_limit IS NULL OR max_cash_limit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_org_cash_drawers_tenant
  ON public.org_cash_drawers_mst (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_cash_drawers_branch
  ON public.org_cash_drawers_mst (tenant_org_id, branch_id, is_active);

ALTER TABLE public.org_cash_drawers_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_cash_drawers_mst
  ON public.org_cash_drawers_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 3. org_cash_drawer_sessions_mst
--    Open/close session tracking per cash drawer.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_sessions_mst (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                       UUID NOT NULL,
  cash_drawer_id                  UUID NOT NULL REFERENCES public.org_cash_drawers_mst(id) ON DELETE RESTRICT,

  session_no                      TEXT NOT NULL,

  opened_by                       UUID NOT NULL,
  opened_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  opening_float_amount            DECIMAL(19,4) NOT NULL DEFAULT 0,
  currency_code                   TEXT NOT NULL,

  status                          TEXT NOT NULL DEFAULT 'OPEN'
                                    REFERENCES public.sys_cash_drawer_session_status_cd(code),

  -- Running cash totals (updated on each movement)
  expected_cash_amount            DECIMAL(19,4) NOT NULL DEFAULT 0,
  counted_cash_amount             DECIMAL(19,4),
  difference_amount               DECIMAL(19,4),

  closed_by                       UUID,
  closed_at                       TIMESTAMPTZ,
  close_notes                     TEXT,
  force_close_reason              TEXT,

  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit
  created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                      TEXT,
  created_info                    TEXT,
  updated_at                      TIMESTAMPTZ,
  updated_by                      TEXT,
  updated_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_org_cash_drawer_sessions_no
    UNIQUE (tenant_org_id, session_no),

  CONSTRAINT chk_org_cds_amounts
    CHECK (
      opening_float_amount >= 0
      AND expected_cash_amount >= 0
      AND (counted_cash_amount IS NULL OR counted_cash_amount >= 0)
    )
);

-- DB-level enforcement: only one OPEN session per drawer per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_cash_drawer_session
  ON public.org_cash_drawer_sessions_mst (tenant_org_id, cash_drawer_id)
  WHERE status = 'OPEN' AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_org_cds_tenant
  ON public.org_cash_drawer_sessions_mst (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_cds_drawer
  ON public.org_cash_drawer_sessions_mst (tenant_org_id, cash_drawer_id, status);

CREATE INDEX IF NOT EXISTS idx_org_cds_opened_at
  ON public.org_cash_drawer_sessions_mst (tenant_org_id, opened_at DESC);

ALTER TABLE public.org_cash_drawer_sessions_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_cash_drawer_sessions_mst
  ON public.org_cash_drawer_sessions_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 4. org_cash_drawer_movements_dtl
--    Individual cash movements within a session.
--    Note: order_payment_id is a plain UUID here; FK to org_order_payments_dtl
--    is added in migration 0271 after that table is created.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_movements_dtl (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                       UUID NOT NULL,
  cash_drawer_id                  UUID NOT NULL REFERENCES public.org_cash_drawers_mst(id) ON DELETE RESTRICT,
  cash_drawer_session_id          UUID NOT NULL REFERENCES public.org_cash_drawer_sessions_mst(id) ON DELETE RESTRICT,

  movement_type                   TEXT NOT NULL REFERENCES public.sys_cash_drawer_movement_type_cd(code),
  direction                       TEXT NOT NULL,
  amount                          DECIMAL(19,4) NOT NULL,
  currency_code                   TEXT NOT NULL,

  -- Links to order payment — FK added in migration 0271 after org_order_payments_dtl is created
  order_id                        UUID,
  order_payment_id                UUID,
  refund_id                       UUID,

  reference_no                    TEXT,
  reason                          TEXT,

  performed_by                    UUID NOT NULL,
  performed_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit
  created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                      TEXT,
  created_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_org_cdm_direction
    CHECK (direction IN ('IN','OUT','NONE')),

  CONSTRAINT chk_org_cdm_amount
    CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_org_cdm_session
  ON public.org_cash_drawer_movements_dtl (tenant_org_id, cash_drawer_session_id, performed_at);

CREATE INDEX IF NOT EXISTS idx_org_cdm_drawer
  ON public.org_cash_drawer_movements_dtl (tenant_org_id, cash_drawer_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_cdm_order_pay
  ON public.org_cash_drawer_movements_dtl (order_payment_id)
  WHERE order_payment_id IS NOT NULL;

ALTER TABLE public.org_cash_drawer_movements_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_cash_drawer_movements_dtl
  ON public.org_cash_drawer_movements_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
