-- =============================================================================
-- Migration 0550 — CLF M10: retire the legacy cash-drawer model
-- Package CLF (Cash Ledger Foundation), release R3 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.12
--
-- Why
--   Every cash fact now lives in the unified drawer ledger (stamped voucher lines +
--   custody transactions) and every session's figures live in org_cash_drawer_ses_bal_dtl.
--   The code that wrote or read the old objects below was deleted in the same release
--   (single-step openSession/closeSession/approveSessionVariance, the five mirror wiring
--   handlers, cash-drawer-cash-facts). Nothing reads them any more, so they are removed
--   instead of being left to rot and mislead.
--
-- What it removes
--   1. org_order_refunds_dtl.cash_drawer_movement_id (+ its unique index) — the refund's link
--      to a mirror movement row; the refund's own voucher line carries the ledger stamp.
--   2. org_fin_voucher_trx_lines_dtl.cash_drawer_mvt_id — same, on the voucher line.
--   3. org_cash_drawer_movements_dtl — the legacy per-session movement table (36 demo rows on
--      remote; M9 already carried custody-only rows into the session balance rows).
--   4. sys_cash_drawer_movement_type_cd — the lookup that table referenced.
--   5. org_cash_drawer_sessions_mst.expected_cash_amount / counted_cash_amount /
--      difference_amount and chk_org_cds_amounts — the single-currency closing snapshot of the
--      old close. M9 copied the values of every closed legacy session into its
--      org_cash_drawer_ses_bal_dtl row (closing_expected / closing_counted / closing_variance);
--      the new close writes only that table. opening_float_amount stays (the open flow still
--      records the primary-currency opening) so its non-negative rule is re-added as its own CHECK.
--   6. hq_mntnc_cleanup_tenant_orders is redefined without the movements table.
--   7. org_cash_drawers_mst.requires_session / opening_float_required — drawer-level copies of
--      policy that the cash-control settings ladder (DRAWER -> USER -> BRANCH -> TENANT -> drawer
--      type default) replaced in M5 (0528, which carried every deliberately configured value into
--      DRAWER-scope settings rows). Nothing reads them any more; the screens show the resolved
--      policy. ensure_branch_pd_drawer() inserted them, so it is redefined without them first.
--
-- What it adds
--   chk_cds_closed_has_cut — a closed / force-closed session must have its ledger cut
--   (close_ledger_seq). Deferred from M9 because the legacy close wrote closed sessions without
--   one; with that path gone the rule can never be violated.
--
-- Safety
--   - Preconditions abort the whole migration if M9 (0549) has not been applied or any closed
--     session would lose its figures. Nothing is dropped before they pass.
--   - Plain DROP ... RESTRICT only (no CASCADE): a missed dependency fails loudly.
--   - One transaction; verification block at the end.
--
-- Rollback: not reversible for the 36 dropped demo movement rows (pre-launch demo data; their
-- amounts live on in the ledger / balance rows). Structure can be recreated from migrations
-- 0287–0303 and 0412 if ever needed.
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it, then regenerates Prisma/types.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions — abort before anything is dropped
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing_bal  INT;
  v_missing_cut  INT;
  v_missing_fig  INT;
BEGIN
  -- M9 must have given every session a per-currency balance row.
  SELECT COUNT(*) INTO v_missing_bal
    FROM public.org_cash_drawer_sessions_mst s
   WHERE NOT EXISTS (SELECT 1 FROM public.org_cash_drawer_ses_bal_dtl b
                      WHERE b.cash_drawer_session_id = s.id AND b.tenant_org_id = s.tenant_org_id);
  IF v_missing_bal > 0 THEN
    RAISE EXCEPTION 'M10 precondition failed: % session(s) have no org_cash_drawer_ses_bal_dtl row — apply 0549 (CLF M9 backfill) first', v_missing_bal;
  END IF;

  -- Every closed session must carry its ledger cut (the CHECK added below).
  SELECT COUNT(*) INTO v_missing_cut
    FROM public.org_cash_drawer_sessions_mst s
   WHERE s.status IN ('CLOSED', 'FORCE_CLOSED') AND s.close_ledger_seq IS NULL;
  IF v_missing_cut > 0 THEN
    RAISE EXCEPTION 'M10 precondition failed: % closed session(s) have no close_ledger_seq — re-run 0549 / repair before retiring the legacy model', v_missing_cut;
  END IF;

  -- Every closed session must keep its closing figures after the header columns are dropped.
  SELECT COUNT(*) INTO v_missing_fig
    FROM public.org_cash_drawer_sessions_mst s
   WHERE s.status IN ('CLOSED', 'FORCE_CLOSED')
     AND NOT EXISTS (SELECT 1 FROM public.org_cash_drawer_ses_bal_dtl b
                      WHERE b.cash_drawer_session_id = s.id AND b.tenant_org_id = s.tenant_org_id
                        AND b.closing_expected IS NOT NULL);
  IF v_missing_fig > 0 THEN
    RAISE EXCEPTION 'M10 precondition failed: % closed session(s) would lose their closing figures (no closing_expected on any balance row)', v_missing_fig;
  END IF;
END $$;

-- Pending-deposit drawers relied on the drawer column being FALSE; after the drop their policy
-- comes from the type default, which must therefore say "no session required".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_cash_drawer_type_cd
              WHERE code = 'PENDING_DEPOSIT' AND requires_session_default IS DISTINCT FROM FALSE) THEN
    RAISE EXCEPTION 'M10 precondition failed: sys_cash_drawer_type_cd.PENDING_DEPOSIT.requires_session_default must be FALSE';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. hq_mntnc_cleanup_tenant_orders — drop the movements table from its table list and
--    from its DELETE sequence BEFORE the table goes away.
--
--    The function body is ~60 KB; it is rewritten by transforming its own current definition
--    (pg_get_functiondef) rather than re-transcribing it, so everything else — signature,
--    SECURITY/search_path settings, ownership and grants (CREATE OR REPLACE keeps them) — is
--    preserved byte for byte. The block asserts the movements table is gone from the new text.
--    Idempotent: a definition that no longer mentions the table is left untouched.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_new text;
  v_start INT;
  v_end INT;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';

  IF v_oid IS NULL THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders not found — nothing to redefine';
    RETURN;
  END IF;

  v_def := pg_get_functiondef(v_oid);
  IF position('org_cash_drawer_movements_dtl' IN v_def) = 0 THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders already free of org_cash_drawer_movements_dtl';
    RETURN;
  END IF;

  v_new := v_def;
  -- (a) the entry in the table-name list
  v_new := replace(v_new, '''org_cash_drawer_movements_dtl'', ', '');
  -- (b) the DELETE statement: from "DELETE FROM public.org_cash_drawer_movements_dtl" to its own
  --     terminating ';' (the statement contains no other ';'). Plain position/substring slicing —
  --     a regex would be greedy here (the first greedy atom decides the whole pattern) and could
  --     swallow the rest of the function.
  v_start := position('DELETE FROM public.org_cash_drawer_movements_dtl' IN v_new);
  IF v_start = 0 THEN
    RAISE EXCEPTION 'M10: DELETE FROM org_cash_drawer_movements_dtl not found in hq_mntnc_cleanup_tenant_orders — redefine it by hand';
  END IF;
  v_end := v_start + position(';' IN substring(v_new FROM v_start)) - 1;
  v_new := left(v_new, v_start - 1) || substring(v_new FROM v_end + 1);

  IF position('org_cash_drawer_movements_dtl' IN v_new) > 0 OR v_new = v_def THEN
    RAISE EXCEPTION 'M10: could not cleanly remove org_cash_drawer_movements_dtl from hq_mntnc_cleanup_tenant_orders — redefine it by hand';
  END IF;

  EXECUTE v_new;
END $$;

-- -----------------------------------------------------------------------------
-- 1b. ensure_branch_pd_drawer — stop inserting the retired drawer-level policy columns.
--     Pending-deposit drawers keep behaving as before: their type default
--     (sys_cash_drawer_type_cd.requires_session_default = FALSE) now supplies the policy.
--     Body identical to 0523 apart from the two removed columns and their FALSE values.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_branch_pd_drawer(
  p_tenant_org_id UUID,
  p_branch_id     UUID,
  p_currency_code TEXT DEFAULT NULL,
  p_actor         TEXT DEFAULT NULL
)
RETURNS TABLE (drawer_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_currency  TEXT;
  v_name      TEXT;
  v_name2     TEXT;
  v_code_base TEXT;
  v_code      TEXT;
  v_suffix    INTEGER := 0;
  v_id        UUID;
BEGIN
  IF p_tenant_org_id IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'ensure_branch_pd_drawer: tenant and branch are required';
  END IF;

  SELECT COALESCE(b.name, b.branch_name), COALESCE(b.name2, b.name, b.branch_name)
    INTO v_name, v_name2
    FROM org_branches_mst b
   WHERE b.id = p_branch_id AND b.tenant_org_id = p_tenant_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ensure_branch_pd_drawer: branch % not found for tenant %', p_branch_id, p_tenant_org_id;
  END IF;

  SELECT d.id INTO v_id
    FROM org_cash_drawers_mst d
   WHERE d.tenant_org_id = p_tenant_org_id AND d.branch_id = p_branch_id
     AND d.drawer_type = 'PENDING_DEPOSIT' AND d.is_active;
  IF FOUND THEN
    RETURN QUERY SELECT v_id, FALSE;
    RETURN;
  END IF;

  v_currency := NULLIF(TRIM(p_currency_code), '');
  IF v_currency IS NULL THEN
    SELECT NULLIF(TRIM(t.currency), '') INTO v_currency
      FROM org_tenants_mst t WHERE t.id = p_tenant_org_id;
  END IF;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'CMX01',
      MESSAGE = 'CASH_DRAWER_CURRENCY_NOT_CONFIGURED: tenant has no currency; pending-deposit drawer not created';
  END IF;

  -- Code derived from the branch id (branches have no code column); suffixed if
  -- an older inactive drawer already holds it.
  v_code_base := 'PD-' || UPPER(LEFT(REPLACE(p_branch_id::TEXT, '-', ''), 8));
  v_code := v_code_base;
  WHILE EXISTS (SELECT 1 FROM org_cash_drawers_mst
                 WHERE tenant_org_id = p_tenant_org_id AND drawer_code = v_code) LOOP
    v_suffix := v_suffix + 1;
    v_code := v_code_base || '-' || v_suffix;
  END LOOP;

  INSERT INTO org_cash_drawers_mst (
    tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
    drawer_type, currency_code,
    created_by, created_info, is_active, rec_status, metadata
  ) VALUES (
    p_tenant_org_id, p_branch_id, v_code,
    'Pending deposit' || COALESCE(' - ' || v_name, ''),
    'قيد الإيداع' || COALESCE(' - ' || v_name2, ''),
    'PENDING_DEPOSIT', v_currency,
    COALESCE(p_actor, 'system'), 'ensure_branch_pd_drawer', TRUE, 1,
    jsonb_build_object('system_drawer', TRUE)
  )
  ON CONFLICT (tenant_org_id, branch_id) WHERE drawer_type = 'PENDING_DEPOSIT' AND is_active
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, TRUE;
    RETURN;
  END IF;

  -- A concurrent caller created it first.
  SELECT d.id INTO v_id
    FROM org_cash_drawers_mst d
   WHERE d.tenant_org_id = p_tenant_org_id AND d.branch_id = p_branch_id
     AND d.drawer_type = 'PENDING_DEPOSIT' AND d.is_active;
  RETURN QUERY SELECT v_id, FALSE;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Refund -> mirror-movement link (the unique index goes first; the column drop would
--    remove it anyway, stated explicitly for the reader)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_ord_refund_cash_mvt;
ALTER TABLE public.org_order_refunds_dtl DROP COLUMN IF EXISTS cash_drawer_movement_id;

-- -----------------------------------------------------------------------------
-- 3. Voucher line -> mirror-movement link
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_fin_voucher_trx_lines_dtl DROP COLUMN IF EXISTS cash_drawer_mvt_id;

-- -----------------------------------------------------------------------------
-- 4. The legacy movement table and its type lookup (RESTRICT: anything still pointing at
--    them makes the migration fail instead of being silently dropped)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.org_cash_drawer_movements_dtl RESTRICT;
DROP TABLE IF EXISTS public.sys_cash_drawer_movement_type_cd RESTRICT;

-- -----------------------------------------------------------------------------
-- 5. Session header: retire the old single-currency closing snapshot
-- -----------------------------------------------------------------------------
-- The old CHECK bundled opening_float_amount >= 0 with the retired columns; it must go first.
ALTER TABLE public.org_cash_drawer_sessions_mst DROP CONSTRAINT IF EXISTS chk_org_cds_amounts;

ALTER TABLE public.org_cash_drawer_sessions_mst
  DROP COLUMN IF EXISTS expected_cash_amount,
  DROP COLUMN IF EXISTS counted_cash_amount,
  DROP COLUMN IF EXISTS difference_amount;

-- The opening float keeps its non-negative rule, now as its own constraint.
ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD CONSTRAINT chk_org_cds_opening_float CHECK (opening_float_amount >= 0);
COMMENT ON CONSTRAINT chk_org_cds_opening_float ON public.org_cash_drawer_sessions_mst IS
  'The opening float of a session can never be negative. Replaces the opening-float part of the retired chk_org_cds_amounts.';

-- -----------------------------------------------------------------------------
-- 5b. Drawer header: retire the drawer-level policy copies (see header, item 7)
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_cash_drawers_mst
  DROP COLUMN IF EXISTS requires_session,
  DROP COLUMN IF EXISTS opening_float_required;

-- A closed session must have frozen its ledger window (set by the count step or force-close).
ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD CONSTRAINT chk_cds_closed_has_cut
  CHECK (status NOT IN ('CLOSED', 'FORCE_CLOSED') OR close_ledger_seq IS NOT NULL);
COMMENT ON CONSTRAINT chk_cds_closed_has_cut ON public.org_cash_drawer_sessions_mst IS
  'A CLOSED or FORCE_CLOSED session must carry close_ledger_seq, the cut that ends its ledger window; without it the next session cannot chain its opening balance.';

-- -----------------------------------------------------------------------------
-- 6. Verification — abort the whole migration if anything is off
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.org_cash_drawer_movements_dtl') IS NOT NULL THEN
    RAISE EXCEPTION 'M10 verification failed: org_cash_drawer_movements_dtl still exists';
  END IF;
  IF to_regclass('public.sys_cash_drawer_movement_type_cd') IS NOT NULL THEN
    RAISE EXCEPTION 'M10 verification failed: sys_cash_drawer_movement_type_cd still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND ((table_name = 'org_cash_drawer_sessions_mst' AND column_name IN ('expected_cash_amount', 'counted_cash_amount', 'difference_amount'))
                  OR (table_name = 'org_order_refunds_dtl' AND column_name = 'cash_drawer_movement_id')
                  OR (table_name = 'org_fin_voucher_trx_lines_dtl' AND column_name = 'cash_drawer_mvt_id'))) THEN
    RAISE EXCEPTION 'M10 verification failed: a retired column still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'org_cash_drawers_mst'
                AND column_name IN ('requires_session', 'opening_float_required')) THEN
    RAISE EXCEPTION 'M10 verification failed: a retired drawer policy column still exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cds_closed_has_cut' AND conrelid = 'public.org_cash_drawer_sessions_mst'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_cds_opening_float' AND conrelid = 'public.org_cash_drawer_sessions_mst'::regclass) THEN
    RAISE EXCEPTION 'M10 verification failed: a replacement CHECK constraint is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE p.pronamespace = 'public'::regnamespace
                AND p.prokind = 'f'
                AND pg_get_functiondef(p.oid) LIKE '%org_cash_drawer_movements_dtl%') THEN
    RAISE EXCEPTION 'M10 verification failed: a function still references org_cash_drawer_movements_dtl';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Post-apply (by hand)
--   1. Regenerate Prisma + types.
--   2. Remove the legacy deletes from the dev-only cleanup helpers if you still use them:
--      supabase/snippets/cleanup_*.sql (already updated in the same change).
--   3. Smoke: open a drawer session, take a cash payment, count + close it, read the session
--      detail — closing expected / counted / variance come from the balance row.
-- =============================================================================
