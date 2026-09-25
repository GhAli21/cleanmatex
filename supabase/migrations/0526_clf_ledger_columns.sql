-- =============================================================================
-- Migration 0526 — CLF M2: drawer ledger columns on finance voucher lines
-- Package CLF (Cash Ledger Foundation), release R1 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.3.2–§4B.3.3
-- and docs/features/Order_Fin/ADR/ADR-057-Two-Domain-Cash-Ledger.md
--
-- (Nominal plan number 0524; 0524 and 0525 belong to the currency work — see STATUS.md collision note.)
--
-- What this migration does
--   1. org_cash_drawers_mst.ledger_seq — per-drawer counter. The drawer row lock
--      + this counter give every drawer ledger entry an exact order, so a session
--      close can record an exact cut (fixes D22 by design; a time cut is unsafe
--      because now() is transaction-start time).
--   2. UNIQUE (id, tenant_org_id) on drawers and drawer sessions so child rows can
--      carry composite tenant FKs.
--   3. Five cash columns on org_fin_voucher_trx_lines_dtl, written only by the
--      cash-drawer ledger gate (lib/services/cash-drawer-ledger/), plus composite
--      FKs, a consistency CHECK and indexes.
--   4. trg_vtl_posted_immutable — once a line is POSTED its money facts and its
--      drawer stamp never change (principle: a closed period is never rewritten;
--      corrections are reversal lines). The only allowed cash transition is the
--      one-time recognition of a pending cash leg (PENDING → DRAWER / NONE).
--      DELETE is deliberately not blocked here (the HQ demo-cleanup function
--      deletes voucher data); deletion stays governed by permissions.
--
-- Maintenance bypass: a migration that must rewrite posted lines (the CLF M9
-- backfill) runs `SET LOCAL cmx.allow_posted_line_edit = 'on';` first. Never set
-- it from application code.
--
-- Existing rows: all new columns are NULL; `cash_effect_code IS NULL` satisfies
-- the CHECK. Verified 2026-09-25 on remote: 29 lines carry a session id, 0 of
-- them point to a missing or other-tenant session, so the FKs validate now.
--
-- Reversal (forward migration; lossless before the gate writes data):
--   DROP TRIGGER trg_vtl_posted_immutable ON org_fin_voucher_trx_lines_dtl;
--   DROP FUNCTION fn_vtl_posted_immutable() RESTRICT;
--   DROP INDEX uq_vtl_drawer_seq, idx_vtl_drawer_seq;
--   ALTER TABLE org_fin_voucher_trx_lines_dtl
--     DROP CONSTRAINT chk_vtl_cash_effect, DROP CONSTRAINT fk_vtl_cash_drawer,
--     DROP CONSTRAINT fk_vtl_cash_drawer_ses,
--     DROP COLUMN cash_drawer_id, DROP COLUMN cash_ledger_seq,
--     DROP COLUMN cash_recognized_at, DROP COLUMN cash_recognized_by,
--     DROP COLUMN cash_effect_code;
--   ALTER TABLE org_cash_drawer_sessions_mst DROP CONSTRAINT uq_ocds_id_tenant;
--   ALTER TABLE org_cash_drawers_mst DROP CONSTRAINT uq_ocd_id_tenant,
--     DROP COLUMN ledger_seq;
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Per-drawer ledger sequence
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_cash_drawers_mst
  ADD COLUMN IF NOT EXISTS ledger_seq BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_cash_drawers_mst.ledger_seq IS
  'CLF: last ledger sequence issued for this drawer. Incremented only under the drawer row lock by the ledger gate and the drawer-transaction service; each ledger entry (cash voucher line or drawer transaction line) takes the next value.';

-- -----------------------------------------------------------------------------
-- 2. Composite-key targets
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ocd_id_tenant') THEN
    ALTER TABLE public.org_cash_drawers_mst
      ADD CONSTRAINT uq_ocd_id_tenant UNIQUE (id, tenant_org_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ocds_id_tenant') THEN
    ALTER TABLE public.org_cash_drawer_sessions_mst
      ADD CONSTRAINT uq_ocds_id_tenant UNIQUE (id, tenant_org_id);
  END IF;
END $$;

COMMENT ON CONSTRAINT uq_ocd_id_tenant ON public.org_cash_drawers_mst IS
  'CLF: target for composite (drawer, tenant) FKs so a child row can never point at another tenant''s drawer.';
COMMENT ON CONSTRAINT uq_ocds_id_tenant ON public.org_cash_drawer_sessions_mst IS
  'CLF: target for composite (session, tenant) FKs.';

-- -----------------------------------------------------------------------------
-- 3. Cash columns on finance voucher lines
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD COLUMN IF NOT EXISTS cash_drawer_id      UUID NULL,
  ADD COLUMN IF NOT EXISTS cash_ledger_seq     BIGINT NULL,
  ADD COLUMN IF NOT EXISTS cash_recognized_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cash_recognized_by  TEXT NULL,
  ADD COLUMN IF NOT EXISTS cash_effect_code    TEXT NULL;

COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.cash_drawer_id IS
  'CLF: drawer this cash line belongs to (or, for PENDING, the intended drawer). Written only by the cash-drawer ledger gate.';
COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.cash_ledger_seq IS
  'CLF: the drawer''s ledger sequence for this line. Set when the cash is recognised (effect DRAWER); decides which session window the line belongs to.';
COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.cash_recognized_at IS
  'CLF: when the cash was recognised in the drawer (clock_timestamp() under the drawer lock).';
COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.cash_recognized_by IS
  'CLF: user who caused the recognition.';
COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.cash_effect_code IS
  'CLF: NULL = not a cash-family line; PENDING = cash leg not completed yet (not in the ledger); DRAWER = in the drawer ledger; UNTRACKED = cash method not tracked in drawers; NONE = pending leg that never completed. Mirrored in lib/constants/cash-drawer.ts.';
COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.cash_drawer_session_id IS
  'Session open on the drawer when the cash was recognised (NULL = arrived between sessions; counted in the next window). From CLF on, set only by the cash-drawer ledger gate.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_vtl_cash_effect') THEN
    ALTER TABLE public.org_fin_voucher_trx_lines_dtl
      ADD CONSTRAINT chk_vtl_cash_effect CHECK (
        (cash_effect_code IS NULL
          AND cash_drawer_id IS NULL AND cash_ledger_seq IS NULL
          AND cash_recognized_at IS NULL AND cash_recognized_by IS NULL)
        OR (cash_effect_code = 'DRAWER'
          AND cash_drawer_id IS NOT NULL AND cash_ledger_seq IS NOT NULL
          AND cash_recognized_at IS NOT NULL)
        OR (cash_effect_code IN ('PENDING', 'UNTRACKED', 'NONE')
          AND cash_ledger_seq IS NULL AND cash_recognized_at IS NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vtl_cash_drawer') THEN
    ALTER TABLE public.org_fin_voucher_trx_lines_dtl
      ADD CONSTRAINT fk_vtl_cash_drawer
      FOREIGN KEY (cash_drawer_id, tenant_org_id)
      REFERENCES public.org_cash_drawers_mst (id, tenant_org_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vtl_cash_drawer_ses') THEN
    ALTER TABLE public.org_fin_voucher_trx_lines_dtl
      ADD CONSTRAINT fk_vtl_cash_drawer_ses
      FOREIGN KEY (cash_drawer_session_id, tenant_org_id)
      REFERENCES public.org_cash_drawer_sessions_mst (id, tenant_org_id);
  END IF;
END $$;

COMMENT ON CONSTRAINT chk_vtl_cash_effect ON public.org_fin_voucher_trx_lines_dtl IS
  'CLF: a DRAWER line carries drawer + sequence + recognition time; non-ledger effects carry no sequence; non-cash lines carry no cash stamp at all.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_vtl_drawer_seq
  ON public.org_fin_voucher_trx_lines_dtl (tenant_org_id, cash_drawer_id, cash_ledger_seq)
  WHERE cash_ledger_seq IS NOT NULL;

COMMENT ON INDEX public.uq_vtl_drawer_seq IS
  'CLF: one voucher line per drawer ledger sequence (drawer transaction lines take the other values).';

CREATE INDEX IF NOT EXISTS idx_vtl_drawer_seq
  ON public.org_fin_voucher_trx_lines_dtl (tenant_org_id, cash_drawer_id, cash_ledger_seq)
  INCLUDE (direction, amount, currency_code)
  WHERE cash_effect_code = 'DRAWER';

COMMENT ON INDEX public.idx_vtl_drawer_seq IS
  'CLF: covering index for session-window sums (drawer + sequence range → direction, amount, currency).';

-- -----------------------------------------------------------------------------
-- 4. Posted-line immutability
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_vtl_posted_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recognition BOOLEAN;
BEGIN
  -- Drafts are freely editable; the gate stamps lines while they are still DRAFT.
  IF OLD.line_status NOT IN ('POSTED', 'REVERSED') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_setting('cmx.allow_posted_line_edit', TRUE), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT (
       (OLD.line_status = 'POSTED'   AND NEW.line_status IN ('POSTED', 'REVERSED'))
    OR (OLD.line_status = 'REVERSED' AND NEW.line_status = 'REVERSED')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = format('CASH_LINE_IMMUTABLE: line_status %s -> %s not allowed on a posted line', OLD.line_status, NEW.line_status);
  END IF;

  IF NEW.amount                 IS DISTINCT FROM OLD.amount
  OR NEW.direction              IS DISTINCT FROM OLD.direction
  OR NEW.currency_code          IS DISTINCT FROM OLD.currency_code
  OR NEW.payment_method_code    IS DISTINCT FROM OLD.payment_method_code
  OR NEW.tendered_amount        IS DISTINCT FROM OLD.tendered_amount
  OR NEW.change_returned_amount IS DISTINCT FROM OLD.change_returned_amount
  OR NEW.tenant_org_id          IS DISTINCT FROM OLD.tenant_org_id
  OR NEW.voucher_id             IS DISTINCT FROM OLD.voucher_id THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = 'CASH_LINE_IMMUTABLE: money facts of a posted voucher line cannot change — post a reversal instead';
  END IF;

  -- One-time recognition of a pending cash leg (B30 VERIFY, CANCEL/FAIL of a pending leg).
  v_recognition := OLD.cash_effect_code = 'PENDING'
               AND NEW.cash_effect_code IN ('DRAWER', 'NONE');

  IF NOT v_recognition AND (
       NEW.cash_effect_code       IS DISTINCT FROM OLD.cash_effect_code
    OR NEW.cash_drawer_id         IS DISTINCT FROM OLD.cash_drawer_id
    OR NEW.cash_ledger_seq        IS DISTINCT FROM OLD.cash_ledger_seq
    OR NEW.cash_recognized_at     IS DISTINCT FROM OLD.cash_recognized_at
    OR NEW.cash_recognized_by     IS DISTINCT FROM OLD.cash_recognized_by
    OR NEW.cash_drawer_session_id IS DISTINCT FROM OLD.cash_drawer_session_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = 'CASH_LINE_IMMUTABLE: the drawer stamp of a posted voucher line cannot change';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_vtl_posted_immutable() IS
  'CLF: BEFORE UPDATE guard on org_fin_voucher_trx_lines_dtl. POSTED/REVERSED lines keep their money facts and drawer stamp; allowed: POSTED→REVERSED, wiring back-links/status, payment_status, and the one-time PENDING→DRAWER/NONE recognition. SQLSTATE CMX02 = CASH_LINE_IMMUTABLE. Bypass only in maintenance migrations via SET LOCAL cmx.allow_posted_line_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_vtl_posted_immutable ON public.org_fin_voucher_trx_lines_dtl;
CREATE TRIGGER trg_vtl_posted_immutable
  BEFORE UPDATE ON public.org_fin_voucher_trx_lines_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_vtl_posted_immutable();

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'org_cash_drawers_mst'
                    AND column_name = 'ledger_seq') THEN
    RAISE EXCEPTION 'ledger_seq missing';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'org_fin_voucher_trx_lines_dtl'
         AND column_name IN ('cash_drawer_id', 'cash_ledger_seq', 'cash_recognized_at',
                             'cash_recognized_by', 'cash_effect_code')) <> 5 THEN
    RAISE EXCEPTION 'voucher-line cash columns incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vtl_posted_immutable') THEN
    RAISE EXCEPTION 'immutability trigger missing';
  END IF;
END $$;

COMMIT;
