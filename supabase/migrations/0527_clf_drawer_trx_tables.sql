-- =============================================================================
-- Migration 0527 — CLF M3: drawer (custody) transaction tables
-- Package CLF (Cash Ledger Foundation), release R1 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.3.4
-- and docs/features/Order_Fin/ADR/ADR-057-Two-Domain-Cash-Ledger.md
--
-- Custody domain: operational events that MOVE physical cash between drawers
-- (float issue, drops, drawer↔drawer, driver handover, deposit prep, close
-- disposition). Custody never creates or destroys cash — only finance vouchers
-- do — so every transaction's lines net to zero per currency.
--
--   org_cash_drawer_trx_mst — one row per physical custody event
--   org_cash_drawer_trx_dtl — one row per drawer side, each carrying that
--                              drawer's ledger sequence (same counter as the
--                              cash voucher lines, org_cash_drawers_mst.ledger_seq)
--
-- Invariants enforced here:
--   * trg_ocdt_balanced (deferred, at commit): >= 2 lines, >= 2 distinct drawers,
--     Σ IN = Σ OUT per currency, every drawer in the header's branch and tenant.
--   * Header and lines are immutable after insert (corrections are REVERSAL
--     transactions pointing at the original). Maintenance bypass for migrations
--     only: SET LOCAL cmx.allow_ledger_edit = 'on'.
--   * generate_cash_drawer_trx_no() — CDT-YYYYMMDD-NNNN per tenant and day,
--     serialised by a transaction-scoped advisory lock. The prefix
--     'CDT-YYYYMMDD-' is 13 characters, so digits start at character 14
--     (the 0519 off-by-one lesson).
--
-- Lock order (documented in lib/services/cash-drawer-ledger/cash-drawer-lock.ts):
-- drawer rows (sorted) → this numbering lock → session numbering lock.
--
-- Reversal (forward migration; lossless while both tables are empty):
--   DROP TRIGGER trg_ocdt_balanced ON org_cash_drawer_trx_dtl;
--   DROP TRIGGER trg_ocdt_hdr_balanced ON org_cash_drawer_trx_mst;
--   DROP TRIGGER trg_ocdt_dtl_immutable ON org_cash_drawer_trx_dtl;
--   DROP TRIGGER trg_ocdt_mst_immutable ON org_cash_drawer_trx_mst;
--   DROP FUNCTION fn_ocdt_check_balanced(), fn_ocdt_immutable(),
--     generate_cash_drawer_trx_no(UUID) RESTRICT;
--   DROP TABLE org_cash_drawer_trx_dtl RESTRICT;
--   DROP TABLE org_cash_drawer_trx_mst RESTRICT;
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Header
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_trx_mst (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL,
  trx_no              TEXT NOT NULL,
  trx_type_code       TEXT NOT NULL REFERENCES public.sys_cash_drawer_trx_type_cd(code),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  business_date       DATE NULL,
  source_session_id   UUID NULL,
  reverses_trx_id     UUID NULL,
  reason_code         TEXT NULL,
  notes               TEXT NULL,
  performed_by        TEXT NOT NULL,
  approved_by         TEXT NULL,
  idempotency_key     TEXT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  rec_status          SMALLINT NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_org_cash_drawer_trx_mst PRIMARY KEY (id),
  CONSTRAINT uq_ocdt_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_ocdt_trx_no UNIQUE (tenant_org_id, trx_no),
  CONSTRAINT fk_ocdt_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst (id, tenant_org_id),
  CONSTRAINT fk_ocdt_source_ses FOREIGN KEY (source_session_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_sessions_mst (id, tenant_org_id),
  CONSTRAINT fk_ocdt_reverses FOREIGN KEY (reverses_trx_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_trx_mst (id, tenant_org_id),
  CONSTRAINT chk_ocdt_not_self_rev CHECK (reverses_trx_id IS NULL OR reverses_trx_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ocdt_idempotency
  ON public.org_cash_drawer_trx_mst (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocdt_reversed_once
  ON public.org_cash_drawer_trx_mst (tenant_org_id, reverses_trx_id)
  WHERE reverses_trx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocdt_tenant_occurred
  ON public.org_cash_drawer_trx_mst (tenant_org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocdt_branch_occurred
  ON public.org_cash_drawer_trx_mst (tenant_org_id, branch_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocdt_source_ses
  ON public.org_cash_drawer_trx_mst (tenant_org_id, source_session_id)
  WHERE source_session_id IS NOT NULL;

ALTER TABLE public.org_cash_drawer_trx_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_cash_drawer_trx_mst ON public.org_cash_drawer_trx_mst;
CREATE POLICY tenant_isolation_org_cash_drawer_trx_mst
  ON public.org_cash_drawer_trx_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_cash_drawer_trx_mst IS
  'CLF (ADR-057): custody transaction header — one physical cash-movement event between drawers. Operational, not financial. Immutable; corrections are REVERSAL transactions.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.tenant_org_id IS 'Tenant; RLS + composite FKs.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.branch_id IS 'Branch; every drawer on the lines must belong to it (checked at commit).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.trx_no IS 'CDT-YYYYMMDD-NNNN from generate_cash_drawer_trx_no(); unique per tenant.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.trx_type_code IS 'Type → sys_cash_drawer_trx_type_cd (allowed drawer types per side are validated by the service).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.occurred_at IS 'When the cash moved (clock_timestamp() under the drawer locks).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.business_date IS 'Business day; filled by Wave B business-date resolution. NULL until then.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.source_session_id IS 'Session that produced it (e.g. the session whose close disposition moved the cash).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.reverses_trx_id IS 'For REVERSAL transactions: the transaction being reversed (each can be reversed once).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.reason_code IS 'Optional reason code.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.notes IS 'Free text; mandatory when the type requires notes (service-enforced).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.performed_by IS 'User who moved the cash.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.approved_by IS 'Optional approver (permission-gated only — no maker ≠ checker).';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.idempotency_key IS 'Client idempotency key; a replay returns the first transaction.';
COMMENT ON COLUMN public.org_cash_drawer_trx_mst.metadata IS 'Extra context; never money.';

-- -----------------------------------------------------------------------------
-- 2. Lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_trx_dtl (
  id                      UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id           UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  trx_id                  UUID NOT NULL,
  line_no                 INTEGER NOT NULL,
  cash_drawer_id          UUID NOT NULL,
  cash_drawer_session_id  UUID NULL,
  ledger_seq              BIGINT NOT NULL,
  direction               TEXT NOT NULL,
  amount                  DECIMAL(19, 4) NOT NULL,
  currency_code           TEXT NOT NULL REFERENCES public.sys_currency_cd(code),

  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by              TEXT,
  created_info            TEXT,
  updated_at              TIMESTAMPTZ,
  updated_by              TEXT,
  updated_info            TEXT,
  rec_status              SMALLINT NOT NULL DEFAULT 1,
  rec_order               INTEGER,
  rec_notes               TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_org_cash_drawer_trx_dtl PRIMARY KEY (id),
  CONSTRAINT uq_ocdtd_line UNIQUE (trx_id, line_no),
  CONSTRAINT uq_ocdtd_drawer_seq UNIQUE (tenant_org_id, cash_drawer_id, ledger_seq),
  CONSTRAINT fk_ocdtd_trx FOREIGN KEY (trx_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_trx_mst (id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocdtd_drawer FOREIGN KEY (cash_drawer_id, tenant_org_id)
    REFERENCES public.org_cash_drawers_mst (id, tenant_org_id),
  CONSTRAINT fk_ocdtd_session FOREIGN KEY (cash_drawer_session_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_sessions_mst (id, tenant_org_id),
  CONSTRAINT chk_ocdtd_direction CHECK (direction IN ('IN', 'OUT')),
  CONSTRAINT chk_ocdtd_amount CHECK (amount > 0),
  CONSTRAINT chk_ocdtd_seq CHECK (ledger_seq > 0)
);

CREATE INDEX IF NOT EXISTS idx_ocdtd_trx
  ON public.org_cash_drawer_trx_dtl (tenant_org_id, trx_id);
CREATE INDEX IF NOT EXISTS idx_ocdtd_drawer_seq
  ON public.org_cash_drawer_trx_dtl (tenant_org_id, cash_drawer_id, ledger_seq)
  INCLUDE (direction, amount, currency_code);
CREATE INDEX IF NOT EXISTS idx_ocdtd_session
  ON public.org_cash_drawer_trx_dtl (tenant_org_id, cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

ALTER TABLE public.org_cash_drawer_trx_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_cash_drawer_trx_dtl ON public.org_cash_drawer_trx_dtl;
CREATE POLICY tenant_isolation_org_cash_drawer_trx_dtl
  ON public.org_cash_drawer_trx_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_cash_drawer_trx_dtl IS
  'CLF (ADR-057): custody transaction lines — one per drawer side. Each line is a drawer ledger entry ordered by ledger_seq; lines of one transaction net to zero per currency.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.trx_id IS 'Header (composite FK).';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.line_no IS 'Line number within the transaction.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.cash_drawer_id IS 'Drawer this side affects.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.cash_drawer_session_id IS 'Session open on that drawer when posted, or NULL (between sessions → next window). Informational; windows are decided by ledger_seq.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.ledger_seq IS 'That drawer''s ledger sequence (shared counter with cash voucher lines); unique per drawer.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.direction IS 'IN = cash arrives in this drawer; OUT = cash leaves it.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.amount IS 'Always positive; sign comes from direction.';
COMMENT ON COLUMN public.org_cash_drawer_trx_dtl.currency_code IS 'Currency of this side; must equal the drawer currency (service-enforced).';

-- -----------------------------------------------------------------------------
-- 3. Balance check (deferred to commit)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ocdt_check_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trx_id    UUID;
  v_tenant    UUID;
  v_branch    UUID;
  v_lines     INTEGER;
  v_drawers   INTEGER;
  v_bad_ccy   TEXT;
  v_bad_brn   INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'org_cash_drawer_trx_mst' THEN
    v_trx_id := NEW.id;
  ELSE
    v_trx_id := NEW.trx_id;
  END IF;

  SELECT h.tenant_org_id, h.branch_id INTO v_tenant, v_branch
    FROM org_cash_drawer_trx_mst h WHERE h.id = v_trx_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT l.cash_drawer_id) INTO v_lines, v_drawers
    FROM org_cash_drawer_trx_dtl l WHERE l.trx_id = v_trx_id;
  IF v_lines < 2 OR v_drawers < 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX03',
      MESSAGE = format('CASH_TRX_UNBALANCED: transaction %s needs at least 2 lines on 2 different drawers', v_trx_id);
  END IF;

  SELECT string_agg(x.currency_code, ', ') INTO v_bad_ccy
    FROM (
      SELECT l.currency_code
        FROM org_cash_drawer_trx_dtl l
       WHERE l.trx_id = v_trx_id
       GROUP BY l.currency_code
      HAVING SUM(CASE WHEN l.direction = 'IN' THEN l.amount ELSE -l.amount END) <> 0
    ) x;
  IF v_bad_ccy IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX03',
      MESSAGE = format('CASH_TRX_UNBALANCED: transaction %s does not net to zero in %s', v_trx_id, v_bad_ccy);
  END IF;

  SELECT COUNT(*) INTO v_bad_brn
    FROM org_cash_drawer_trx_dtl l
    JOIN org_cash_drawers_mst d ON d.id = l.cash_drawer_id
   WHERE l.trx_id = v_trx_id
     AND (d.branch_id <> v_branch OR d.tenant_org_id <> v_tenant OR l.tenant_org_id <> v_tenant);
  IF v_bad_brn > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX03',
      MESSAGE = format('CASH_TRX_CROSS_BRANCH: transaction %s has a drawer outside its branch', v_trx_id);
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_ocdt_check_balanced() IS
  'CLF: deferred commit-time check for a custody transaction — >= 2 lines on >= 2 drawers, nets to zero per currency, all drawers in the header''s branch and tenant. SQLSTATE CMX03.';

DROP TRIGGER IF EXISTS trg_ocdt_balanced ON public.org_cash_drawer_trx_dtl;
CREATE CONSTRAINT TRIGGER trg_ocdt_balanced
  AFTER INSERT OR UPDATE ON public.org_cash_drawer_trx_dtl
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocdt_check_balanced();

-- A header inserted without lines must also fail at commit.
DROP TRIGGER IF EXISTS trg_ocdt_hdr_balanced ON public.org_cash_drawer_trx_mst;
CREATE CONSTRAINT TRIGGER trg_ocdt_hdr_balanced
  AFTER INSERT ON public.org_cash_drawer_trx_mst
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocdt_check_balanced();

-- -----------------------------------------------------------------------------
-- 4. Immutability (header + lines)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ocdt_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('cmx.allow_ledger_edit', TRUE), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'CMX02',
    MESSAGE = format('CASH_TRX_IMMUTABLE: %s on %s is not allowed — post a REVERSAL transaction instead', TG_OP, TG_TABLE_NAME);
END;
$$;

COMMENT ON FUNCTION public.fn_ocdt_immutable() IS
  'CLF: custody transactions are append-only. Blocks UPDATE and DELETE on org_cash_drawer_trx_mst/_dtl. Maintenance bypass in migrations only: SET LOCAL cmx.allow_ledger_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_ocdt_mst_immutable ON public.org_cash_drawer_trx_mst;
CREATE TRIGGER trg_ocdt_mst_immutable
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_trx_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocdt_immutable();

DROP TRIGGER IF EXISTS trg_ocdt_dtl_immutable ON public.org_cash_drawer_trx_dtl;
CREATE TRIGGER trg_ocdt_dtl_immutable
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_trx_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocdt_immutable();

-- -----------------------------------------------------------------------------
-- 5. Transaction numbering
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_cash_drawer_trx_no(p_tenant_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Serialise concurrent callers for the same tenant and day; the ':cdt:' part
  -- keeps this key apart from the session-number lock.
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_org_id::TEXT || ':cdt:' || v_date));

  -- 'CDT-YYYYMMDD-' is 13 characters; the digits start at character 14.
  SELECT COALESCE(MAX(CAST(SUBSTRING(trx_no FROM 14) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM org_cash_drawer_trx_mst
   WHERE tenant_org_id = p_tenant_org_id
     AND trx_no LIKE 'CDT-' || v_date || '-%';

  RETURN 'CDT-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_cash_drawer_trx_no(UUID) IS
  'CLF: next custody transaction number CDT-YYYYMMDD-NNNN for a tenant; call inside the inserting transaction (transaction-scoped advisory lock).';

REVOKE ALL ON FUNCTION public.generate_cash_drawer_trx_no(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_cash_drawer_trx_no(UUID) TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ocdt_balanced') THEN
    RAISE EXCEPTION 'balance trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ocdt_dtl_immutable') THEN
    RAISE EXCEPTION 'immutability trigger missing';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.org_cash_drawer_trx_dtl'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS not enabled on org_cash_drawer_trx_dtl';
  END IF;
END $$;

COMMIT;
