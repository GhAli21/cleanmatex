-- =============================================================================
-- Migration 0549 — CLF M9: demo-data backfill into the Cash Ledger Foundation
-- Package CLF (Cash Ledger Foundation), release R3 prep — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.12
--
-- Why
--   Cash that was recorded before the ledger existed has no drawer stamp and no
--   per-currency session balance row, so old closed sessions read as empty in the
--   ledger / session detail / print report. This brings the existing (pre-launch
--   demo) data into the same shape the live code writes. Idempotent — a re-run
--   touches nothing that is already stamped / already has a balance row.
--
-- What it does (one transaction)
--   1. Stamps every POSTED / REVERSED cash-family voucher line that has no stamp yet:
--        session + completed payment  -> cash_effect_code 'DRAWER' (drawer from its session)
--        no session                   -> 'UNTRACKED'
--        pending leg                  -> 'PENDING'      failed leg -> 'NONE'
--      DRAFT lines are left alone (the gate stamps them when they are posted).
--   2. Renumbers cash_ledger_seq per drawer in (created_at, id) order across ALL stamped
--      lines of the drawers it touches (including lines the live code already stamped),
--      so history stays chronological, and sets org_cash_drawers_mst.ledger_seq to the max.
--      Drawers that already hold custody transactions (org_cash_drawer_trx_dtl) share the
--      same sequence and are NOT renumbered — the migration stops with a clear message
--      instead (none exist today; remote count = 0).
--   3. Re-derives open_ledger_seq / close_ledger_seq for the sessions of those drawers as a
--      monotone chain (open = previous session's cut, close = highest seq inside the session
--      or the previous cut). A late line posted against an older session after a newer one
--      opened is therefore attributed to the newer window — acceptable for demo data.
--      Closed legacy sessions on other drawers get a 0 / 0 cut so the chain never has holes.
--   4. Creates the org_cash_drawer_ses_bal_dtl row (session currency) for every session that
--      has none: opening float as expected + counted, FIN in/out from the stamped lines,
--      custody in/out from legacy manual movements that never had a voucher line (they were
--      not vouchers and are not migrated into finance), and for closed sessions the old header
--      closing values + disposition 'LEGACY'.
--   5. Verifies the result and aborts the whole migration if anything is inconsistent.
--
-- Deliberately NOT here: the "closed session => close_ledger_seq NOT NULL" CHECK. The legacy
-- closeSession path (still present until R3) writes closed sessions without a cut; the CHECK
-- moves to M10 (retire legacy), where it can no longer be violated.
--
-- Uses the existing cmx.allow_posted_line_edit escape hatch (transaction-local) because the
-- posted-line immutability trigger would otherwise reject stamping posted lines.
--
-- Rollback: none needed for correctness (additive stamps); to undo, null the cash_* columns of
-- lines with created_by 'migration_0549' stamps and delete bal rows with created_by 'migration_0549'.
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- Transaction-local: allow stamping already-posted lines (immutability trigger bypass).
SELECT set_config('cmx.allow_posted_line_edit', 'on', TRUE);

-- -----------------------------------------------------------------------------
-- 0. Work set — every unstamped cash-family line and the stamp it should get
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _clf_bf_lines ON COMMIT DROP AS
SELECT l.id,
       l.tenant_org_id,
       l.created_at,
       s.cash_drawer_id,
       s.currency_code AS session_currency,
       CASE
         WHEN l.cash_drawer_session_id IS NULL THEN 'UNTRACKED'
         WHEN l.payment_status IN ('PENDING', 'PROCESSING', 'CAPTURE_PENDING') THEN 'PENDING'
         WHEN l.payment_status = 'FAILED' THEN 'NONE'
         ELSE 'DRAWER'
       END AS effect
  FROM public.org_fin_voucher_trx_lines_dtl l
  LEFT JOIN public.org_cash_drawer_sessions_mst s
         ON s.id = l.cash_drawer_session_id
        AND s.tenant_org_id = l.tenant_org_id
 WHERE l.payment_method_code = 'CASH'
   AND l.cash_effect_code IS NULL
   AND l.direction IN ('IN', 'OUT')
   AND l.line_status IN ('POSTED', 'REVERSED');

CREATE TEMP TABLE _clf_bf_drawers ON COMMIT DROP AS
SELECT DISTINCT tenant_org_id, cash_drawer_id
  FROM _clf_bf_lines
 WHERE effect = 'DRAWER'
   AND cash_drawer_id IS NOT NULL;

-- Precondition: drawers with custody transactions share the sequence and are not renumbered here.
DO $$
DECLARE
  v_ids TEXT;
BEGIN
  SELECT string_agg(DISTINCT d.cash_drawer_id::TEXT, ', ')
    INTO v_ids
    FROM _clf_bf_drawers d
   WHERE EXISTS (
     SELECT 1 FROM public.org_cash_drawer_trx_dtl t
      WHERE t.tenant_org_id = d.tenant_org_id AND t.cash_drawer_id = d.cash_drawer_id
   );
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'CLF 0549: drawer(s) % hold custody transactions and also need a legacy backfill; renumbering would interleave the two ledgers. Resolve manually (demo data) and re-run.', v_ids;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Non-drawer effects (no sequence): UNTRACKED / PENDING / NONE
-- -----------------------------------------------------------------------------
UPDATE public.org_fin_voucher_trx_lines_dtl l
   SET cash_effect_code = w.effect,
       updated_at       = CURRENT_TIMESTAMP,
       updated_by       = 'migration_0549',
       updated_info     = 'Migration 0549 — CLF backfill stamp'
  FROM _clf_bf_lines w
 WHERE l.id = w.id
   AND l.tenant_org_id = w.tenant_org_id
   AND w.effect <> 'DRAWER';

-- -----------------------------------------------------------------------------
-- 2. DRAWER lines: stamp + renumber per drawer chronologically (existing stamped + new)
-- -----------------------------------------------------------------------------
-- Move existing sequence values out of the way so the final numbers never collide
-- with the non-deferrable unique index while the statement runs.
UPDATE public.org_fin_voucher_trx_lines_dtl l
   SET cash_ledger_seq = l.cash_ledger_seq + 1000000000
  FROM _clf_bf_drawers d
 WHERE l.tenant_org_id = d.tenant_org_id
   AND l.cash_drawer_id = d.cash_drawer_id
   AND l.cash_effect_code = 'DRAWER'
   AND l.cash_ledger_seq IS NOT NULL;

CREATE TEMP TABLE _clf_bf_order ON COMMIT DROP AS
WITH combined AS (
  SELECT w.id, w.tenant_org_id, w.cash_drawer_id, w.created_at
    FROM _clf_bf_lines w
   WHERE w.effect = 'DRAWER' AND w.cash_drawer_id IS NOT NULL
  UNION ALL
  SELECT l.id, l.tenant_org_id, l.cash_drawer_id, l.created_at
    FROM public.org_fin_voucher_trx_lines_dtl l
    JOIN _clf_bf_drawers d
      ON d.tenant_org_id = l.tenant_org_id AND d.cash_drawer_id = l.cash_drawer_id
   WHERE l.cash_effect_code = 'DRAWER'
)
SELECT id, tenant_org_id, cash_drawer_id,
       ROW_NUMBER() OVER (PARTITION BY tenant_org_id, cash_drawer_id ORDER BY created_at, id) AS seq
  FROM combined;

UPDATE public.org_fin_voucher_trx_lines_dtl l
   SET cash_effect_code   = 'DRAWER',
       cash_drawer_id     = o.cash_drawer_id,
       cash_ledger_seq    = o.seq,
       cash_recognized_at = COALESCE(l.cash_recognized_at, l.created_at),
       cash_recognized_by = COALESCE(l.cash_recognized_by, 'migration_0549'),
       currency_code      = COALESCE(l.currency_code, w.session_currency),
       updated_at         = CURRENT_TIMESTAMP,
       updated_by         = 'migration_0549',
       updated_info       = 'Migration 0549 — CLF backfill stamp'
  FROM _clf_bf_order o
  LEFT JOIN _clf_bf_lines w
         ON w.id = o.id AND w.tenant_org_id = o.tenant_org_id
 WHERE l.id = o.id
   AND l.tenant_org_id = o.tenant_org_id;

UPDATE public.org_cash_drawers_mst dr
   SET ledger_seq   = m.max_seq,
       updated_at   = CURRENT_TIMESTAMP,
       updated_by   = 'migration_0549',
       updated_info = 'Migration 0549 — CLF backfill ledger_seq'
  FROM (
    SELECT tenant_org_id, cash_drawer_id, MAX(seq) AS max_seq
      FROM _clf_bf_order
     GROUP BY tenant_org_id, cash_drawer_id
  ) m
 WHERE dr.id = m.cash_drawer_id
   AND dr.tenant_org_id = m.tenant_org_id;

-- -----------------------------------------------------------------------------
-- 3. Session cuts — monotone chain per drawer
-- -----------------------------------------------------------------------------
WITH ses AS (
  SELECT s.id, s.tenant_org_id, s.cash_drawer_id, s.status, s.opened_at, s.close_ledger_seq,
         COALESCE((
           SELECT MAX(l.cash_ledger_seq)
             FROM public.org_fin_voucher_trx_lines_dtl l
            WHERE l.tenant_org_id = s.tenant_org_id
              AND l.cash_drawer_session_id = s.id
              AND l.cash_effect_code = 'DRAWER'
         ), 0) AS own_max
    FROM public.org_cash_drawer_sessions_mst s
    JOIN _clf_bf_drawers d
      ON d.tenant_org_id = s.tenant_org_id AND d.cash_drawer_id = s.cash_drawer_id
), chain AS (
  SELECT ses.*,
         MAX(own_max) OVER (
           PARTITION BY tenant_org_id, cash_drawer_id ORDER BY opened_at, id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS run
    FROM ses
), chain2 AS (
  SELECT chain.*,
         COALESCE(LAG(run) OVER (PARTITION BY tenant_org_id, cash_drawer_id ORDER BY opened_at, id), 0) AS prev_run
    FROM chain
)
UPDATE public.org_cash_drawer_sessions_mst s
   SET open_ledger_seq  = c.prev_run,
       close_ledger_seq = CASE
         WHEN c.status IN ('CLOSED', 'FORCE_CLOSED')
           OR (c.status = 'CLOSING' AND s.close_ledger_seq IS NOT NULL)
         THEN c.run
         ELSE s.close_ledger_seq
       END,
       updated_at   = CURRENT_TIMESTAMP,
       updated_by   = 'migration_0549',
       updated_info = 'Migration 0549 — CLF backfill session cut'
  FROM chain2 c
 WHERE s.id = c.id
   AND s.tenant_org_id = c.tenant_org_id;

-- Closed legacy sessions on drawers with no backfilled lines: a 0 / 0 cut (older than any cut).
UPDATE public.org_cash_drawer_sessions_mst s
   SET open_ledger_seq  = COALESCE(s.open_ledger_seq, 0),
       close_ledger_seq = COALESCE(s.close_ledger_seq, 0),
       updated_at       = CURRENT_TIMESTAMP,
       updated_by       = 'migration_0549',
       updated_info     = 'Migration 0549 — CLF backfill session cut'
 WHERE s.status IN ('CLOSED', 'FORCE_CLOSED')
   AND (s.open_ledger_seq IS NULL OR s.close_ledger_seq IS NULL);

-- -----------------------------------------------------------------------------
-- 4. Per-currency session balance rows for every session that has none
-- -----------------------------------------------------------------------------
INSERT INTO public.org_cash_drawer_ses_bal_dtl (
  tenant_org_id, cash_drawer_session_id, currency_code,
  opening_expected, opening_counted, opening_variance,
  fin_in, fin_out, trx_in, trx_out,
  closing_expected, closing_counted, closing_variance,
  variance_threshold_snap, disposition_code,
  created_by, created_info
)
SELECT s.tenant_org_id, s.id, s.currency_code,
       s.opening_float_amount, s.opening_float_amount, 0,
       COALESCE((SELECT SUM(l.amount) FROM public.org_fin_voucher_trx_lines_dtl l
                  WHERE l.tenant_org_id = s.tenant_org_id AND l.cash_drawer_session_id = s.id
                    AND l.cash_effect_code = 'DRAWER' AND l.direction = 'IN'
                    AND COALESCE(l.currency_code, s.currency_code) = s.currency_code), 0),
       COALESCE((SELECT SUM(l.amount) FROM public.org_fin_voucher_trx_lines_dtl l
                  WHERE l.tenant_org_id = s.tenant_org_id AND l.cash_drawer_session_id = s.id
                    AND l.cash_effect_code = 'DRAWER' AND l.direction = 'OUT'
                    AND COALESCE(l.currency_code, s.currency_code) = s.currency_code), 0),
       COALESCE((SELECT SUM(m.amount) FROM public.org_cash_drawer_movements_dtl m
                  WHERE m.tenant_org_id = s.tenant_org_id AND m.cash_drawer_session_id = s.id
                    AND m.fin_voucher_trx_line_id IS NULL AND m.is_active
                    AND m.direction = 'IN' AND m.currency_code = s.currency_code), 0),
       COALESCE((SELECT SUM(m.amount) FROM public.org_cash_drawer_movements_dtl m
                  WHERE m.tenant_org_id = s.tenant_org_id AND m.cash_drawer_session_id = s.id
                    AND m.fin_voucher_trx_line_id IS NULL AND m.is_active
                    AND m.direction = 'OUT' AND m.currency_code = s.currency_code), 0),
       CASE WHEN s.status IN ('CLOSED', 'FORCE_CLOSED') THEN s.expected_cash_amount END,
       CASE WHEN s.status IN ('CLOSED', 'FORCE_CLOSED') THEN s.counted_cash_amount END,
       CASE WHEN s.status IN ('CLOSED', 'FORCE_CLOSED') THEN s.difference_amount END,
       s.variance_threshold_snapshot,
       CASE WHEN s.status IN ('CLOSED', 'FORCE_CLOSED') THEN 'LEGACY' END,
       'migration_0549', 'Migration 0549 — CLF backfill'
  FROM public.org_cash_drawer_sessions_mst s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.org_cash_drawer_ses_bal_dtl b
    WHERE b.tenant_org_id = s.tenant_org_id AND b.cash_drawer_session_id = s.id
 );

-- -----------------------------------------------------------------------------
-- 5. Verification — abort the whole migration on any inconsistency
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.org_fin_voucher_trx_lines_dtl
   WHERE payment_method_code = 'CASH' AND cash_effect_code IS NULL
     AND direction IN ('IN', 'OUT') AND line_status IN ('POSTED', 'REVERSED');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'CLF 0549: % posted cash line(s) still have no cash_effect_code', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.org_fin_voucher_trx_lines_dtl l
   WHERE l.cash_effect_code = 'DRAWER'
     AND NOT EXISTS (
       SELECT 1 FROM public.org_cash_drawers_mst d
        WHERE d.id = l.cash_drawer_id AND d.tenant_org_id = l.tenant_org_id
          AND d.ledger_seq >= l.cash_ledger_seq
     );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'CLF 0549: % DRAWER line(s) exceed their drawer ledger_seq', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.org_cash_drawer_sessions_mst s
   WHERE s.status IN ('CLOSED', 'FORCE_CLOSED')
     AND (NOT EXISTS (
            SELECT 1 FROM public.org_cash_drawer_ses_bal_dtl b
             WHERE b.tenant_org_id = s.tenant_org_id AND b.cash_drawer_session_id = s.id)
          OR s.open_ledger_seq IS NULL OR s.close_ledger_seq IS NULL);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'CLF 0549: % closed session(s) lack a balance row or a ledger cut', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.org_cash_drawer_sessions_mst s
   WHERE s.close_ledger_seq IS NOT NULL AND s.open_ledger_seq IS NOT NULL
     AND s.close_ledger_seq < s.open_ledger_seq;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'CLF 0549: % session(s) have a cut that runs backwards', v_count;
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Post-apply read-only checks (run by hand)
--   -- every closed session has a balance row and a cut
--   SELECT COUNT(*) FROM org_cash_drawer_sessions_mst s WHERE s.status IN ('CLOSED','FORCE_CLOSED')
--     AND NOT EXISTS (SELECT 1 FROM org_cash_drawer_ses_bal_dtl b WHERE b.cash_drawer_session_id = s.id);   -- 0
--   -- no recognised cash line without a drawer
--   SELECT COUNT(*) FROM org_fin_voucher_trx_lines_dtl WHERE cash_effect_code = 'DRAWER' AND cash_drawer_id IS NULL;  -- 0
--   -- sequences unique per drawer (enforced by uq_vtl_drawer_seq) and the drawer counter covers them
--   SELECT d.id FROM org_cash_drawers_mst d
--    WHERE d.ledger_seq < COALESCE((SELECT MAX(cash_ledger_seq) FROM org_fin_voucher_trx_lines_dtl l
--                                    WHERE l.cash_drawer_id = d.id AND l.tenant_org_id = d.tenant_org_id), 0);  -- no rows
-- -----------------------------------------------------------------------------
