-- =============================================================================
-- Migration 0536 — CLF M4: counts + session balances (release R2 foundation)
-- Package CLF (Cash Ledger Foundation), release R2 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.3.5, §4B.3.6
-- and docs/features/Order_Fin/ADR/ADR-057-Two-Domain-Cash-Ledger.md
--
-- Adds the schema the two-step close (count -> finalize) and the drawer
-- Policy/Counts tabs need:
--   org_cash_drawer_cnt_mst       — one row per physical cash count (OPENING /
--                                    SPOT / CLOSING / RECOUNT); immutable.
--   org_cash_drawer_cnt_denom_dtl — denomination breakdown lines for a count;
--                                    immutable; the currency's denominations
--                                    must sum to the header's counted_amount.
--   org_cash_drawer_ses_bal_dtl   — the session's money, one row per currency
--                                    (opening/closing expected+counted+variance,
--                                    count refs, AND per-currency disposition);
--                                    immutable once the session is
--                                    CLOSED/FORCE_CLOSED.
--   org_cash_drawer_ses_post_tr   — after-close post_close_status change log;
--                                    insert-only.
--   org_cash_drawer_sessions_mst  — new nullable columns for the two-step close
--                                    (ledger cut, count-step timing, post-close).
--                                    The CHECK tying a closed session to a
--                                    disposition + close_ledger_seq is added in
--                                    M9, AFTER the backfill gives every existing
--                                    closed session those values — adding it here
--                                    would break every session closed before R2.
--
-- Multi-currency readiness (owner decision, 2026-10-01): counting and
-- disposition are per-currency facts, so they live on org_cash_drawer_ses_bal_dtl
-- (one row per currency) rather than as single columns on the session header.
-- P12 currently pins every drawer — and so every line in it — to one currency,
-- so in practice every session has exactly one ses_bal_dtl row today; but a
-- future multi-currency-drawer policy change needs no new migration for
-- counting or disposition, only a change to the gate rule (P12) itself.
-- post_close_* stays on the session header: it is written strictly AFTER the
-- session is CLOSED, which ses_bal_dtl's own immutability trigger would
-- otherwise block, and in practice a physical cash batch is followed up on as
-- one unit regardless of its currency mix.
--
-- A count row exists only when something was actually counted (an uncounted
-- close has no count row). ses_bal_dtl is written at open (opening_*), at the
-- count step (closing_*, count refs), and at finalize (disposition_*, before
-- the session row's own status flips to CLOSED in the same transaction); it
-- stays open (not yet immutable) while the session is OPEN/CLOSING, matching
-- the count step's own read-then-write flow.
--
-- Reversal (forward migration; lossless while these tables are empty and the
-- new session columns are all NULL on every row):
--   DROP INDEX uq_open_cash_drawer_session;
--   CREATE UNIQUE INDEX uq_open_cash_drawer_session ON org_cash_drawer_sessions_mst
--     (tenant_org_id, cash_drawer_id) WHERE (status = 'OPEN' AND is_active = true);
--   ALTER TABLE org_cash_drawer_sessions_mst
--     DROP COLUMN open_ledger_seq, DROP COLUMN close_ledger_seq,
--     DROP COLUMN closing_started_at, DROP COLUMN closing_started_by,
--     DROP COLUMN post_close_status_code, DROP COLUMN post_close_notes,
--     DROP COLUMN post_close_by, DROP COLUMN post_close_at;
--   DROP TRIGGER trg_ocsbd_closed_immutable ON org_cash_drawer_ses_bal_dtl;
--   DROP FUNCTION fn_ocsbd_immutable();
--   DROP TRIGGER trg_ocspt_immutable ON org_cash_drawer_ses_post_tr;
--   DROP FUNCTION fn_ocspt_immutable();
--   DROP TABLE org_cash_drawer_ses_post_tr RESTRICT;
--   DROP TABLE org_cash_drawer_ses_bal_dtl RESTRICT;
--   DROP TRIGGER trg_occdd_total_match ON org_cash_drawer_cnt_denom_dtl;
--   DROP TRIGGER trg_occdd_immutable ON org_cash_drawer_cnt_denom_dtl;
--   DROP TRIGGER trg_occm_immutable ON org_cash_drawer_cnt_mst;
--   DROP FUNCTION fn_occdd_check_total_match(), fn_cash_drawer_count_immutable();
--   DROP TABLE org_cash_drawer_cnt_denom_dtl RESTRICT;
--   DROP TABLE org_cash_drawer_cnt_mst RESTRICT;
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. org_cash_drawer_cnt_mst — count header
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_cnt_mst (
  id                      UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id           UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id               UUID NOT NULL,
  cash_drawer_id          UUID NOT NULL,
  cash_drawer_session_id  UUID NULL,
  count_type              TEXT NOT NULL REFERENCES public.sys_cash_drawer_cnt_type_cd(code),
  count_method            TEXT NOT NULL,
  currency_code           TEXT NOT NULL REFERENCES public.sys_currency_cd(code),
  ledger_seq              BIGINT NOT NULL,
  expected_amount         DECIMAL(19, 4) NOT NULL,
  counted_amount          DECIMAL(19, 4) NOT NULL,
  variance_amount         DECIMAL(19, 4) NOT NULL,
  supersedes_count_id     UUID NULL,
  counted_by              TEXT NOT NULL,
  counted_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  notes                   TEXT NULL,

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

  CONSTRAINT pk_org_cash_drawer_cnt_mst PRIMARY KEY (id),
  CONSTRAINT uq_occm_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT fk_occm_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst (id, tenant_org_id),
  CONSTRAINT fk_occm_drawer FOREIGN KEY (cash_drawer_id, tenant_org_id)
    REFERENCES public.org_cash_drawers_mst (id, tenant_org_id),
  CONSTRAINT fk_occm_session FOREIGN KEY (cash_drawer_session_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_sessions_mst (id, tenant_org_id),
  CONSTRAINT fk_occm_supersedes FOREIGN KEY (supersedes_count_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_cnt_mst (id, tenant_org_id),
  CONSTRAINT chk_occm_method CHECK (count_method IN ('TOTAL_ONLY', 'DENOMINATION')),
  CONSTRAINT chk_occm_counted CHECK (counted_amount >= 0),
  CONSTRAINT chk_occm_ledger_seq CHECK (ledger_seq >= 0),
  CONSTRAINT chk_occm_not_self_supersede CHECK (supersedes_count_id IS NULL OR supersedes_count_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_occm_drawer_counted
  ON public.org_cash_drawer_cnt_mst (tenant_org_id, cash_drawer_id, counted_at DESC);
CREATE INDEX IF NOT EXISTS idx_occm_session
  ON public.org_cash_drawer_cnt_mst (tenant_org_id, cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

ALTER TABLE public.org_cash_drawer_cnt_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_cash_drawer_cnt_mst ON public.org_cash_drawer_cnt_mst;
CREATE POLICY tenant_isolation_org_cash_drawer_cnt_mst
  ON public.org_cash_drawer_cnt_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_cash_drawer_cnt_mst IS
  'CLF (ADR-057): one row per physical cash count (OPENING/SPOT/CLOSING/RECOUNT). Immutable; a correction is a new RECOUNT row referencing supersedes_count_id, never an edit.';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.cash_drawer_session_id IS 'Session this count belongs to, or NULL for a count-only drawer with no session.';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.count_method IS 'TOTAL_ONLY: counted_amount typed directly. DENOMINATION: derived from org_cash_drawer_cnt_denom_dtl (must sum to counted_amount).';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.ledger_seq IS 'The drawer ledger_seq this count was taken against (the cut) — a snapshot read, not an allocation.';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.expected_amount IS 'System-computed expected cash at this cut, snapshotted at count time.';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.counted_amount IS 'Physical count total.';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.variance_amount IS 'counted_amount - expected_amount, snapshotted (never recomputed from live data after the fact).';
COMMENT ON COLUMN public.org_cash_drawer_cnt_mst.supersedes_count_id IS 'For a RECOUNT: the closing count it supersedes for reconciliation purposes. Both rows are kept — nothing is edited or deleted.';

-- -----------------------------------------------------------------------------
-- 2. org_cash_drawer_cnt_denom_dtl — denomination breakdown lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_cnt_denom_dtl (
  id                        UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  count_id                  UUID NOT NULL,
  denomination_id           UUID NOT NULL REFERENCES public.sys_currency_denominations_cd(id),
  denom_value_minor_snap    INTEGER NOT NULL,
  quantity                  INTEGER NOT NULL,
  line_amount               DECIMAL(19, 4) NOT NULL,

  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                TEXT,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                TEXT,
  updated_info              TEXT,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  rec_order                 INTEGER,
  rec_notes                 TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_occdd PRIMARY KEY (id),
  CONSTRAINT fk_occdd_count FOREIGN KEY (count_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_cnt_mst (id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT chk_occdd_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_occdd_denom_minor CHECK (denom_value_minor_snap > 0),
  CONSTRAINT chk_occdd_line_amount CHECK (line_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_occdd_count
  ON public.org_cash_drawer_cnt_denom_dtl (tenant_org_id, count_id);

ALTER TABLE public.org_cash_drawer_cnt_denom_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_cash_drawer_cnt_denom_dtl ON public.org_cash_drawer_cnt_denom_dtl;
CREATE POLICY tenant_isolation_org_cash_drawer_cnt_denom_dtl
  ON public.org_cash_drawer_cnt_denom_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_cash_drawer_cnt_denom_dtl IS
  'CLF (ADR-057): denomination breakdown for a DENOMINATION-method count. line_amount = quantity * denom_value_minor_snap / 10^minor_unit, derived server-side; the sum across a count_id must equal its header counted_amount (enforced by trg_occdd_total_match).';
COMMENT ON COLUMN public.org_cash_drawer_cnt_denom_dtl.denom_value_minor_snap IS 'sys_currency_denominations_cd.denomination_minor at count time (snapshot — a later catalog edit never changes a historical count).';
COMMENT ON COLUMN public.org_cash_drawer_cnt_denom_dtl.quantity IS 'Physical piece count for this denomination.';
COMMENT ON COLUMN public.org_cash_drawer_cnt_denom_dtl.line_amount IS 'quantity * denom_value_minor_snap / 10^minor_unit, computed by the service at insert time.';

-- -----------------------------------------------------------------------------
-- 3. Count immutability + denomination total-match (deferred to commit)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cash_drawer_count_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('cmx.allow_ledger_edit', TRUE), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'CMX02',
    MESSAGE = format('CASH_LINE_IMMUTABLE: %s on %s is not allowed — a correction is a new RECOUNT row', TG_OP, TG_TABLE_NAME);
END;
$$;

COMMENT ON FUNCTION public.fn_cash_drawer_count_immutable() IS
  'CLF: counts are append-only. Blocks UPDATE and DELETE on org_cash_drawer_cnt_mst/_denom_dtl. Maintenance bypass in migrations only: SET LOCAL cmx.allow_ledger_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_occm_immutable ON public.org_cash_drawer_cnt_mst;
CREATE TRIGGER trg_occm_immutable
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_cnt_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_cash_drawer_count_immutable();

DROP TRIGGER IF EXISTS trg_occdd_immutable ON public.org_cash_drawer_cnt_denom_dtl;
CREATE TRIGGER trg_occdd_immutable
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_cnt_denom_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_cash_drawer_count_immutable();

CREATE OR REPLACE FUNCTION public.fn_occdd_check_total_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count_id  UUID;
  v_expected  DECIMAL(19, 4);
  v_actual    DECIMAL(19, 4);
BEGIN
  v_count_id := COALESCE(NEW.count_id, OLD.count_id);

  SELECT counted_amount INTO v_expected
    FROM org_cash_drawer_cnt_mst WHERE id = v_count_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(line_amount), 0) INTO v_actual
    FROM org_cash_drawer_cnt_denom_dtl WHERE count_id = v_count_id;

  IF v_actual <> v_expected THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX03',
      MESSAGE = format('CASH_COUNT_TOTAL_MISMATCH: count %s denomination lines sum to %s, header counted_amount is %s', v_count_id, v_actual, v_expected);
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_occdd_check_total_match() IS
  'CLF: deferred commit-time check — a DENOMINATION count''s lines must sum to its header counted_amount. SQLSTATE CMX03, code CASH_COUNT_TOTAL_MISMATCH.';

DROP TRIGGER IF EXISTS trg_occdd_total_match ON public.org_cash_drawer_cnt_denom_dtl;
CREATE CONSTRAINT TRIGGER trg_occdd_total_match
  AFTER INSERT ON public.org_cash_drawer_cnt_denom_dtl
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_occdd_check_total_match();

-- -----------------------------------------------------------------------------
-- 4. org_cash_drawer_ses_bal_dtl — session money, one row per currency
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_ses_bal_dtl (
  id                        UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  cash_drawer_session_id    UUID NOT NULL,
  currency_code             TEXT NOT NULL REFERENCES public.sys_currency_cd(code),
  opening_expected          DECIMAL(19, 4) NOT NULL DEFAULT 0,
  opening_counted           DECIMAL(19, 4) NULL,
  opening_variance          DECIMAL(19, 4) NULL,
  opening_count_id          UUID NULL,
  fin_in                    DECIMAL(19, 4) NOT NULL DEFAULT 0,
  fin_out                   DECIMAL(19, 4) NOT NULL DEFAULT 0,
  trx_in                    DECIMAL(19, 4) NOT NULL DEFAULT 0,
  trx_out                   DECIMAL(19, 4) NOT NULL DEFAULT 0,
  closing_expected          DECIMAL(19, 4) NULL,
  closing_counted           DECIMAL(19, 4) NULL,
  closing_variance          DECIMAL(19, 4) NULL,
  closing_basis             DECIMAL(19, 4) NULL,
  closing_count_id          UUID NULL,
  variance_threshold_snap   DECIMAL(19, 4) NULL,
  variance_tolerance_snap   DECIMAL(19, 4) NULL,
  disposition_code          TEXT NULL,
  disposition_notes         TEXT NULL,
  disposition_dest_drawer_id UUID NULL,
  disposition_kept_amount   DECIMAL(19, 4) NULL,
  disposition_trx_id        UUID NULL,

  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                TEXT,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                TEXT,
  updated_info              TEXT,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  rec_order                 INTEGER,
  rec_notes                 TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_org_cash_drawer_ses_bal_dtl PRIMARY KEY (id),
  CONSTRAINT uq_ocsbd_session_ccy UNIQUE (cash_drawer_session_id, currency_code),
  CONSTRAINT fk_ocsbd_session FOREIGN KEY (cash_drawer_session_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_sessions_mst (id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocsbd_opening_count FOREIGN KEY (opening_count_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_cnt_mst (id, tenant_org_id),
  CONSTRAINT fk_ocsbd_closing_count FOREIGN KEY (closing_count_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_cnt_mst (id, tenant_org_id),
  CONSTRAINT fk_ocsbd_disposition_code FOREIGN KEY (disposition_code)
    REFERENCES public.sys_cash_drawer_ses_disp_cd (code),
  CONSTRAINT fk_ocsbd_disposition_dest FOREIGN KEY (disposition_dest_drawer_id, tenant_org_id)
    REFERENCES public.org_cash_drawers_mst (id, tenant_org_id),
  CONSTRAINT fk_ocsbd_disposition_trx FOREIGN KEY (disposition_trx_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_trx_mst (id, tenant_org_id),
  CONSTRAINT chk_ocsbd_kept_amount CHECK (disposition_kept_amount IS NULL OR disposition_kept_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ocsbd_tenant_session
  ON public.org_cash_drawer_ses_bal_dtl (tenant_org_id, cash_drawer_session_id);

ALTER TABLE public.org_cash_drawer_ses_bal_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_cash_drawer_ses_bal_dtl ON public.org_cash_drawer_ses_bal_dtl;
CREATE POLICY tenant_isolation_org_cash_drawer_ses_bal_dtl
  ON public.org_cash_drawer_ses_bal_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_cash_drawer_ses_bal_dtl IS
  'CLF (ADR-057): a session''s money, one row per currency it saw activity in. Replaces the single-currency amount columns on org_cash_drawer_sessions_mst (retired in M10). Counts and disposition are deliberately per-currency HERE, not on the session header — P12 currently pins every drawer (and so every line) to one currency, so today every session has exactly one row, but the schema does not assume that: a future multi-currency-drawer policy change needs no new migration for counting or disposition, only the gate rule (P12) itself. Written at open (opening_*), at the count step (closing_*, opening/closing_count_id), and at finalize (disposition_*, before the session row''s own status flips to CLOSED in the same transaction); immutable once the session reaches CLOSED/FORCE_CLOSED (trg_ocsbd_closed_immutable). post_close_* tracking stays on the session header (org_cash_drawer_sessions_mst) — it is written AFTER the session is closed, which this table''s immutability trigger would otherwise block.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.fin_in IS 'Sum of DRAWER-effect cash voucher lines, direction IN, in this currency, in this session''s ledger window.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.fin_out IS 'Sum of DRAWER-effect cash voucher lines, direction OUT, in this currency, in this session''s ledger window.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.trx_in IS 'Sum of custody transaction lines, direction IN, in this currency, in this session''s ledger window.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.trx_out IS 'Sum of custody transaction lines, direction OUT, in this currency, in this session''s ledger window.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.opening_count_id IS 'CLF: the OPENING count row for this currency, if it was physically counted at open.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.closing_count_id IS 'CLF: the CLOSING (or latest RECOUNT) count row for this currency, if the close was physically counted.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.closing_basis IS 'The amount a close disposition can move for this currency (closing_expected, or closing_counted when the close was blind/uncounted).';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.variance_threshold_snap IS 'cash_control settings variance_threshold_amount resolved at close time, snapshotted.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.variance_tolerance_snap IS 'Currency-aware variance tolerance (half the smallest unit, A3-3) resolved at close time, snapshotted.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.disposition_code IS 'CLF: what happened to this currency''s cash at finalize -> sys_cash_drawer_ses_disp_cd. Each currency in a session may disposition differently (e.g. OMR left in drawer, USD moved to the safe).';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.disposition_notes IS 'CLF: free text; mandatory when the disposition code requires notes.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.disposition_dest_drawer_id IS 'CLF: destination drawer for a moving disposition of this currency.';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.disposition_kept_amount IS 'CLF: PARTIAL_REMOVED only — amount of this currency left behind; user-typed, never prefilled (no-silent-money-mutation rule).';
COMMENT ON COLUMN public.org_cash_drawer_ses_bal_dtl.disposition_trx_id IS 'CLF: the CLOSE_DISPOSITION custody transaction line (or its header) that moved this currency, if any moved.';

CREATE OR REPLACE FUNCTION public.fn_ocsbd_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF COALESCE(current_setting('cmx.allow_ledger_edit', TRUE), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT status INTO v_status
    FROM org_cash_drawer_sessions_mst
   WHERE id = COALESCE(NEW.cash_drawer_session_id, OLD.cash_drawer_session_id);

  IF v_status IN ('CLOSED', 'FORCE_CLOSED') THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = format('CASH_LINE_IMMUTABLE: %s on org_cash_drawer_ses_bal_dtl is not allowed once the session is %s', TG_OP, v_status);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION public.fn_ocsbd_immutable() IS
  'CLF: org_cash_drawer_ses_bal_dtl is writable while its session is OPEN/CLOSING (the count step reads-then-writes it) and immutable once CLOSED/FORCE_CLOSED. Maintenance bypass in migrations only: SET LOCAL cmx.allow_ledger_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_ocsbd_closed_immutable ON public.org_cash_drawer_ses_bal_dtl;
CREATE TRIGGER trg_ocsbd_closed_immutable
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_ses_bal_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocsbd_immutable();

-- -----------------------------------------------------------------------------
-- 5. org_cash_drawer_ses_post_tr — post-close change log (insert-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_ses_post_tr (
  id                        UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  cash_drawer_session_id    UUID NOT NULL,
  post_close_status_code    TEXT NOT NULL REFERENCES public.sys_cash_drawer_ses_post_cd(code),
  post_close_notes          TEXT NULL,
  changed_by                TEXT NOT NULL,
  changed_at                TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                TEXT,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                TEXT,
  updated_info              TEXT,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  rec_order                 INTEGER,
  rec_notes                 TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_org_cash_drawer_ses_post_tr PRIMARY KEY (id),
  CONSTRAINT fk_ocspt_session FOREIGN KEY (cash_drawer_session_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_sessions_mst (id, tenant_org_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ocspt_session
  ON public.org_cash_drawer_ses_post_tr (tenant_org_id, cash_drawer_session_id, changed_at DESC);

ALTER TABLE public.org_cash_drawer_ses_post_tr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_cash_drawer_ses_post_tr ON public.org_cash_drawer_ses_post_tr;
CREATE POLICY tenant_isolation_org_cash_drawer_ses_post_tr
  ON public.org_cash_drawer_ses_post_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_cash_drawer_ses_post_tr IS
  'CLF (ADR-057): after-close post_close_status change log — every change to a closed session''s post-close status/notes appends a row here; the session header (post_close_status_code/post_close_notes/post_close_by/post_close_at) always holds the current value.';

CREATE OR REPLACE FUNCTION public.fn_ocspt_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('cmx.allow_ledger_edit', TRUE), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'CMX02',
    MESSAGE = format('CASH_LINE_IMMUTABLE: %s on %s is not allowed — a status change is a new change-log row, never an edit', TG_OP, TG_TABLE_NAME);
END;
$$;

COMMENT ON FUNCTION public.fn_ocspt_immutable() IS
  'CLF: org_cash_drawer_ses_post_tr is an append-only change log. Blocks UPDATE and DELETE. Maintenance bypass in migrations only: SET LOCAL cmx.allow_ledger_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_ocspt_immutable ON public.org_cash_drawer_ses_post_tr;
CREATE TRIGGER trg_ocspt_immutable
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_ses_post_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocspt_immutable();

-- -----------------------------------------------------------------------------
-- 6. org_cash_drawer_sessions_mst — two-step close + post-close
-- -----------------------------------------------------------------------------
-- Per-currency counting and disposition live on org_cash_drawer_ses_bal_dtl
-- (section 4) — only the session-wide facts (the ledger cut, when counting
-- started, and the operational post-close follow-up) live here.
ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD COLUMN IF NOT EXISTS open_ledger_seq             BIGINT NULL,
  ADD COLUMN IF NOT EXISTS close_ledger_seq             BIGINT NULL,
  ADD COLUMN IF NOT EXISTS closing_started_at           TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS closing_started_by           TEXT NULL,
  ADD COLUMN IF NOT EXISTS post_close_status_code       TEXT NULL,
  ADD COLUMN IF NOT EXISTS post_close_notes             TEXT NULL,
  ADD COLUMN IF NOT EXISTS post_close_by                TEXT NULL,
  ADD COLUMN IF NOT EXISTS post_close_at                TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ocds_post_close_status') THEN
    ALTER TABLE public.org_cash_drawer_sessions_mst
      ADD CONSTRAINT fk_ocds_post_close_status FOREIGN KEY (post_close_status_code)
        REFERENCES public.sys_cash_drawer_ses_post_cd (code);
  END IF;
END $$;

COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.open_ledger_seq IS 'CLF: drawer ledger_seq at open — the start of this session''s window.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.close_ledger_seq IS 'CLF: the exact cut, set at the count step — everything with seq <= this value is in this session''s window.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.closing_started_at IS 'CLF: when the count step began (status -> CLOSING).';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.closing_started_by IS 'CLF: who started the count step.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.post_close_status_code IS 'CLF: current after-close status (e.g. deposited to bank) -> sys_cash_drawer_ses_post_cd. Whole-session, not per-currency (unlike disposition) — written after CLOSED, so it cannot live on org_cash_drawer_ses_bal_dtl, whose trigger locks once the session is closed. Every change also appends to org_cash_drawer_ses_post_tr.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.post_close_notes IS 'CLF: current post-close notes; free text, mandatory for post_close_status_code = OTHER.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.post_close_by IS 'CLF: who made the current post-close status change.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.post_close_at IS 'CLF: when the current post-close status was set.';

-- A drawer cannot open a new session while one is still counting (CLOSING).
DROP INDEX IF EXISTS public.uq_open_cash_drawer_session;
CREATE UNIQUE INDEX uq_open_cash_drawer_session
  ON public.org_cash_drawer_sessions_mst (tenant_org_id, cash_drawer_id)
  WHERE (status IN ('OPEN', 'CLOSING') AND is_active = true);

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_occdd_total_match') THEN
    RAISE EXCEPTION 'count total-match trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ocsbd_closed_immutable') THEN
    RAISE EXCEPTION 'session balance immutability trigger missing';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.org_cash_drawer_cnt_mst'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS not enabled on org_cash_drawer_cnt_mst';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.org_cash_drawer_ses_bal_dtl'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS not enabled on org_cash_drawer_ses_bal_dtl';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'uq_open_cash_drawer_session'
       AND indexdef LIKE '%OPEN%CLOSING%'
  ) THEN
    RAISE EXCEPTION 'uq_open_cash_drawer_session predicate not extended to CLOSING';
  END IF;
END $$;

COMMIT;
