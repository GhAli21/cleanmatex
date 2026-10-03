-- =============================================================================
-- 0559_pos_shift_z_report_and_variance_reject.sql
-- POS Session & Cash Drawer Hardening — D2 (immutable shift Z-report) and C3 (variance rejection).
--
-- 1. D2 — org_pos_shift_z_rpt_tr
--    An X-report is the live, never-stored view of a POS session (computed on demand from its
--    posted voucher lines). The Z-report is the same figures frozen at close: one immutable row per
--    POS session holding a versioned JSON snapshot, its SHA-256 hash and the session facts it was
--    taken from. A later back-dated write can never change a closed shift's Z-report; the hash makes
--    any tampering visible. When the tenant setting `shift_z_report_required` is on, the close
--    transaction generates the Z-report, so a session cannot close without its artifact.
--
-- 2. C3 — variance rejection on drawer sessions
--    A closed session whose variance exceeds its threshold stays "pending approval"
--    (variance_threshold_snapshot set, variance_approved_by NULL). A supervisor could only approve.
--    A supervisor can now also REJECT it — the variance is not accepted and needs investigation —
--    with a mandatory reason; the decision is recorded, never silently dropped. A session is either
--    approved or rejected, not both (CHECK), and a partial index serves the pending-approval queue.
--
-- Prisma-safe composite FK (CLAUDE.md database rule): the parent key of org_pos_sessions_mst is
-- (tenant_org_id, id), so the child FK and the 1:1 UNIQUE are (tenant_org_id, pos_session_id) —
-- same columns, same order.
--
-- IDEMPOTENT: IF NOT EXISTS / dropped-if-exists-then-added throughout.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. org_pos_shift_z_rpt_tr — immutable Z-report snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_pos_shift_z_rpt_tr (
  id                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id           UUID        NOT NULL REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  branch_id               UUID        NOT NULL,
  pos_session_id          UUID        NOT NULL,
  report_no               TEXT        NOT NULL,
  business_date           DATE        NOT NULL,
  business_timezone       TEXT        NOT NULL,
  session_status          TEXT        NOT NULL,
  session_opened_at       TIMESTAMPTZ NOT NULL,
  session_closed_at       TIMESTAMPTZ NOT NULL,
  operator_user_id        UUID        NOT NULL,
  cash_drawer_session_id  UUID        NULL,
  snapshot_version        SMALLINT    NOT NULL DEFAULT 1,
  snapshot                JSONB       NOT NULL,
  snapshot_hash           TEXT        NOT NULL,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  generated_by            TEXT        NOT NULL,
  metadata                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by              TEXT        NULL,
  created_info            TEXT        NULL,
  rec_status              SMALLINT    NOT NULL DEFAULT 1,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_opszr PRIMARY KEY (id),
  CONSTRAINT uq_opszr_tenant_id UNIQUE (tenant_org_id, id),
  -- Exactly one Z-report per POS session, ever (idempotent generation, no "second Z").
  CONSTRAINT uq_opszr_session UNIQUE (tenant_org_id, pos_session_id),
  CONSTRAINT fk_opszr_session FOREIGN KEY (tenant_org_id, pos_session_id)
    REFERENCES public.org_pos_sessions_mst (tenant_org_id, id),
  CONSTRAINT chk_opszr_status CHECK (session_status IN ('CLOSED', 'FORCE_CLOSED')),
  CONSTRAINT chk_opszr_snapshot_obj CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT chk_opszr_window CHECK (session_closed_at >= session_opened_at)
);

CREATE INDEX IF NOT EXISTS idx_opszr_branch_date
  ON public.org_pos_shift_z_rpt_tr (tenant_org_id, branch_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_opszr_operator
  ON public.org_pos_shift_z_rpt_tr (tenant_org_id, operator_user_id, generated_at DESC);

ALTER TABLE public.org_pos_shift_z_rpt_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_opszr_tenant ON public.org_pos_shift_z_rpt_tr;
CREATE POLICY pol_opszr_tenant ON public.org_pos_shift_z_rpt_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- The hash is computed by the database from the stored JSON, so the application can neither skip
-- it nor supply a value that disagrees with the snapshot.
CREATE OR REPLACE FUNCTION public.fn_opszr_set_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.snapshot_hash := encode(sha256(convert_to(NEW.snapshot::text, 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_opszr_set_hash() IS
  'Z-report: stamps snapshot_hash = SHA-256 of the stored jsonb text on INSERT, so the hash always matches the snapshot it protects.';

DROP TRIGGER IF EXISTS trg_opszr_hash ON public.org_pos_shift_z_rpt_tr;
CREATE TRIGGER trg_opszr_hash
  BEFORE INSERT ON public.org_pos_shift_z_rpt_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_opszr_set_hash();

CREATE OR REPLACE FUNCTION public.fn_opszr_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('cmx.allow_ledger_edit', TRUE), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'CMX02',
    MESSAGE = format('Z_REPORT_IMMUTABLE: %s on %s is not allowed — a Z-report is a frozen snapshot of a closed shift', TG_OP, TG_TABLE_NAME);
END;
$$;

COMMENT ON FUNCTION public.fn_opszr_immutable() IS
  'Z-report: append-only. Blocks UPDATE and DELETE on org_pos_shift_z_rpt_tr. Maintenance bypass in migrations/test cleanup only: SET LOCAL cmx.allow_ledger_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_opszr_immutable ON public.org_pos_shift_z_rpt_tr;
CREATE TRIGGER trg_opszr_immutable
  BEFORE UPDATE OR DELETE ON public.org_pos_shift_z_rpt_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_opszr_immutable();

COMMENT ON TABLE public.org_pos_shift_z_rpt_tr IS
  'D2: immutable Z-report of a closed POS session — a versioned JSON snapshot of the shift''s posted voucher lines (by currency, tender and role), the cash handled in the drawer and the linked drawer session figures, frozen at close. One row per POS session. The live X-report is computed on demand and never stored.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.id IS 'Primary key.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.tenant_org_id IS 'Owning tenant (RLS key); part of every composite key.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.branch_id IS 'Branch of the POS session, copied so branch-scoped listing needs no join.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.pos_session_id IS 'The POS session this report closes; with tenant_org_id it is the 1:1 key (uq_opszr_session).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.report_no IS 'Human report number, Z-<POS session number>; unique per branch because the session number is.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.business_date IS 'Business date of the shift, as recorded on the POS session at open (branch-local date).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.business_timezone IS 'IANA timezone the business date was computed in (copied from the session).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.session_status IS 'How the shift ended: CLOSED (normal) or FORCE_CLOSED (supervisor or rollover job).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.session_opened_at IS 'When the POS session opened (UTC instant).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.session_closed_at IS 'When the POS session closed (UTC instant); the end of the reported window.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.operator_user_id IS 'The cashier who owned the POS session.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.cash_drawer_session_id IS 'The cash-drawer session linked to the POS session at close, if any (a drawer session can be shared by several POS sessions).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.snapshot_version IS 'Layout version of the snapshot JSON, so old reports stay readable when the layout evolves.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.snapshot IS 'The frozen report: per-currency tender breakdown, role breakdown, drawer cash handled, change-rounding net and the linked drawer-session figures. Never edited after insert.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.snapshot_hash IS 'SHA-256 (hex) of the snapshot text, stamped by trigger fn_opszr_set_hash; lets a printed Z-report be verified against the stored one.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.generated_at IS 'When the Z-report was generated (server clock).';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.generated_by IS 'User id that closed the shift, or ''system'' for the rollover job.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.metadata IS 'Free-form extension point; not read by the application.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.created_at IS 'Standard audit column: insert time.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.created_by IS 'Standard audit column: inserting actor.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.created_info IS 'Standard audit column: free-text context of the insert.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.rec_status IS 'Standard record status (1 = active); a Z-report is never soft-deleted.';
COMMENT ON COLUMN public.org_pos_shift_z_rpt_tr.is_active IS 'Standard active flag; always true for a Z-report.';
COMMENT ON CONSTRAINT uq_opszr_session ON public.org_pos_shift_z_rpt_tr IS 'Single final Z-report per POS session (and the Prisma-safe 1:1 key, same column order as the FK).';
COMMENT ON CONSTRAINT fk_opszr_session ON public.org_pos_shift_z_rpt_tr IS 'The report belongs to a POS session of the same tenant.';
COMMENT ON CONSTRAINT chk_opszr_status ON public.org_pos_shift_z_rpt_tr IS 'A Z-report exists only for a finished shift.';
COMMENT ON CONSTRAINT chk_opszr_snapshot_obj ON public.org_pos_shift_z_rpt_tr IS 'The snapshot is a JSON object.';
COMMENT ON CONSTRAINT chk_opszr_window ON public.org_pos_shift_z_rpt_tr IS 'The reported window cannot end before it starts.';
COMMENT ON INDEX public.idx_opszr_branch_date IS 'Branch/day listing of Z-reports.';
COMMENT ON INDEX public.idx_opszr_operator IS 'A cashier''s Z-reports, newest first.';
COMMENT ON POLICY pol_opszr_tenant ON public.org_pos_shift_z_rpt_tr IS 'Tenant isolation: rows are visible and writable only for the current tenant.';

-- -----------------------------------------------------------------------------
-- 2. Variance rejection on drawer sessions (C3)
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD COLUMN IF NOT EXISTS variance_rejected_by        UUID        NULL,
  ADD COLUMN IF NOT EXISTS variance_rejected_at        TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS variance_rejection_reason   TEXT        NULL;

ALTER TABLE public.org_cash_drawer_sessions_mst
  DROP CONSTRAINT IF EXISTS chk_ocds_var_decision;

ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD CONSTRAINT chk_ocds_var_decision CHECK (
    -- a rejection carries who, when and why, all together or not at all
    ((variance_rejected_by IS NULL) = (variance_rejected_at IS NULL))
    AND ((variance_rejected_by IS NULL) = (variance_rejection_reason IS NULL))
    -- and a session is approved or rejected, never both
    AND NOT (variance_approved_by IS NOT NULL AND variance_rejected_by IS NOT NULL)
  );

-- The pending-approval queue: closed sessions that tripped a threshold and have no decision yet.
CREATE INDEX IF NOT EXISTS idx_ocds_var_pending
  ON public.org_cash_drawer_sessions_mst (tenant_org_id, branch_id, closed_at DESC)
  WHERE variance_threshold_snapshot IS NOT NULL
    AND variance_approved_by IS NULL
    AND variance_rejected_by IS NULL;

COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.variance_rejected_by IS
  'Supervisor (cash_drawer:approve_variance) who rejected the closing variance: it is not accepted and needs investigation. NULL = not rejected. Mutually exclusive with variance_approved_by.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.variance_rejected_at IS
  'When the closing variance was rejected; set together with variance_rejected_by and variance_rejection_reason.';
COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.variance_rejection_reason IS
  'Mandatory reason given when the closing variance was rejected.';
COMMENT ON CONSTRAINT chk_ocds_var_decision ON public.org_cash_drawer_sessions_mst IS
  'A rejection is recorded whole (who + when + why) and a session is never both approved and rejected.';
COMMENT ON INDEX public.idx_ocds_var_pending IS
  'Pending-approval queue: closed drawer sessions over their variance threshold with no approval or rejection yet.';

-- -----------------------------------------------------------------------------
-- 3. Validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pg_trigger
   WHERE tgrelid = 'public.org_pos_shift_z_rpt_tr'::regclass
     AND tgname IN ('trg_opszr_hash', 'trg_opszr_immutable') AND NOT tgisinternal;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '0559: Z-report triggers missing (found % of 2)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'org_cash_drawer_sessions_mst'
     AND column_name IN ('variance_rejected_by', 'variance_rejected_at', 'variance_rejection_reason');
  IF v_count <> 3 THEN
    RAISE EXCEPTION '0559: variance rejection columns missing (found % of 3)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'org_pos_shift_z_rpt_tr' AND c.relrowsecurity;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '0559: RLS not enabled on org_pos_shift_z_rpt_tr';
  END IF;

  RAISE NOTICE 'Migration 0559 validation passed';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Run `npm run prisma:pull` straight after applying, then restart the dev server.
-- 2. No new permission: Z/X reports use the existing `pos_session:report_z` (0517); variance
--    rejection uses `cash_drawer:approve_variance` (the same gate as approval; no maker≠checker).
-- 3. Rollback (forward-only repo): drop trg_opszr_*, fn_opszr_*, org_pos_shift_z_rpt_tr; drop
--    idx_ocds_var_pending, chk_ocds_var_decision and the three variance_reject* columns.
-- =============================================================================
