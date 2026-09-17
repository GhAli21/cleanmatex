-- =============================================================================
-- 0511_b19_loyalty_points_fifo_expiry.sql
-- B19 follow-up — Loyalty points FIFO lot-consumption ledger + expiry job
--
-- Purpose:
--   B19 deferred loyalty points expiry because org_loyalty_txn_dtl had no
--   per-earn-lot expiry stamp and redemptions decremented one denormalized
--   points_balance with no FIFO consumption tracking — building an
--   approximate sweep risked wrongly zeroing out points a customer already
--   redeemed. This migration adds the missing allocation model:
--
--   1. org_loyalty_txn_dtl.remaining_points — the unconsumed, unexpired
--      balance of a "lot" (any row that CREDITS the account: EARN, BONUS, or
--      a positive ADJUST). NULL for debit rows (REDEEM, EXPIRE, negative
--      ADJUST) — those consume from lots via the allocation table below
--      instead of carrying their own remaining balance.
--   2. org_loyalty_txn_allocs_dtl — one row per (debit txn, lot) pair drawn
--      on, mirroring the existing org_ar_credit_allocs_dtl pattern (0321).
--      Gives full audit traceability: which specific earn(s) funded a given
--      redemption or expiry.
--   3. A one-time backfill that replays every existing txn row in
--      chronological order per account to reconstruct remaining_points and
--      allocation rows exactly as if FIFO tracking had existed from day one.
--      Verified empty on this database (0 rows in org_loyalty_txn_dtl) —
--      written as a correct general replay regardless, not an
--      empty-table shortcut, since this migration may run against a
--      populated environment elsewhere.
--   4. Registers the loyalty_points_expiry job on the existing B19/0505
--      finance-jobs-hub infrastructure (sys_fin_job_run_log, fin_trigger_job,
--      fin_list_job_schedules) — daily 02:10, after gift-card (02:00) and
--      credit-note (02:05) expiry.
--
-- Explicitly NOT in this migration: wallet points expiry (still no policy
-- surface anywhere, genuinely dormant — B19's own documented deferral
-- stands); GL/breakage posting for expired points (deferred to B25, same as
-- gift-card/credit-note expiry never invent a GL dispatch either).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Lot-remaining column on org_loyalty_txn_dtl
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_loyalty_txn_dtl
  ADD COLUMN IF NOT EXISTS remaining_points INTEGER NULL;

ALTER TABLE public.org_loyalty_txn_dtl
  ADD CONSTRAINT chk_oltd_remaining_points CHECK (
    remaining_points IS NULL
    OR (remaining_points >= 0 AND remaining_points <= points)
  );

COMMENT ON COLUMN public.org_loyalty_txn_dtl.remaining_points IS
  'B19 FIFO ledger — unconsumed, unexpired balance of this lot. Only meaningful on a credit row (EARN/BONUS/positive ADJUST, points > 0); NULL on debit rows (REDEEM/EXPIRE/negative ADJUST), which instead draw from lots via org_loyalty_txn_allocs_dtl. Invariant: SUM(remaining_points) per account_id always equals org_loyalty_accounts_mst.points_balance for that account.';

-- Oldest-lot-first lookup for both redemption consumption and the expiry sweep.
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_open_lots
  ON public.org_loyalty_txn_dtl (tenant_org_id, account_id, created_at)
  WHERE remaining_points > 0;

-- -----------------------------------------------------------------------------
-- 2. Allocation table — one row per (consuming txn, source lot) draw
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.org_loyalty_txn_allocs_dtl (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID        NOT NULL,
  account_id        UUID        NOT NULL,
  consuming_txn_id  UUID        NOT NULL,
  source_txn_id     UUID        NOT NULL,
  applied_points    INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_info      TEXT,
  CONSTRAINT chk_olta_points CHECK (applied_points > 0),
  CONSTRAINT chk_olta_not_self CHECK (consuming_txn_id <> source_txn_id),
  CONSTRAINT fk_olta_account FOREIGN KEY (account_id)
    REFERENCES public.org_loyalty_accounts_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_olta_consuming FOREIGN KEY (consuming_txn_id)
    REFERENCES public.org_loyalty_txn_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT fk_olta_source FOREIGN KEY (source_txn_id)
    REFERENCES public.org_loyalty_txn_dtl(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.org_loyalty_txn_allocs_dtl IS
  'B19 FIFO ledger — links each debit txn (REDEEM/EXPIRE/negative ADJUST) to the specific credit lot(s) it drew from, oldest-first. Mirrors org_ar_credit_allocs_dtl (0321). A single debit can span multiple lots (multiple rows sharing consuming_txn_id); a single lot can fund multiple later debits (multiple rows sharing source_txn_id) until its remaining_points reaches 0.';

CREATE INDEX IF NOT EXISTS idx_olta_consuming
  ON public.org_loyalty_txn_allocs_dtl (tenant_org_id, consuming_txn_id);
CREATE INDEX IF NOT EXISTS idx_olta_source
  ON public.org_loyalty_txn_allocs_dtl (tenant_org_id, source_txn_id);
CREATE INDEX IF NOT EXISTS idx_olta_account
  ON public.org_loyalty_txn_allocs_dtl (tenant_org_id, account_id);

ALTER TABLE public.org_loyalty_txn_allocs_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_loyalty_txn_allocs_dtl
  ON public.org_loyalty_txn_allocs_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

REVOKE ALL ON public.org_loyalty_txn_allocs_dtl FROM anon;

-- -----------------------------------------------------------------------------
-- 3. Backfill — reconstruct FIFO state for any pre-existing history
--    (verified 0 rows on this database; written as a correct general replay)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  credit_row RECORD;
  debit_row RECORD;
  lot RECORD;
  to_consume INTEGER;
  draw INTEGER;
BEGIN
  -- Pass 1: every credit row (points > 0) starts fully unconsumed.
  UPDATE public.org_loyalty_txn_dtl
  SET remaining_points = points
  WHERE points > 0;

  -- Pass 2: replay every debit row (points < 0) in chronological order per
  -- account, drawing from the oldest open lot(s) first — exactly what
  -- consumeLoyaltyLotsTx() does at runtime going forward.
  FOR debit_row IN
    SELECT id, tenant_org_id, account_id, points
    FROM public.org_loyalty_txn_dtl
    WHERE points < 0
    ORDER BY account_id, created_at, id
  LOOP
    to_consume := -debit_row.points;

    FOR lot IN
      SELECT id, remaining_points
      FROM public.org_loyalty_txn_dtl
      WHERE account_id = debit_row.account_id
        AND remaining_points > 0
      ORDER BY created_at, id
    LOOP
      EXIT WHEN to_consume <= 0;
      draw := LEAST(lot.remaining_points, to_consume);

      UPDATE public.org_loyalty_txn_dtl
      SET remaining_points = remaining_points - draw
      WHERE id = lot.id;

      INSERT INTO public.org_loyalty_txn_allocs_dtl (
        tenant_org_id, account_id, consuming_txn_id, source_txn_id,
        applied_points, created_info
      ) VALUES (
        debit_row.tenant_org_id, debit_row.account_id, debit_row.id, lot.id,
        draw, 'backfill:0511_b19_loyalty_points_fifo_expiry'
      );

      to_consume := to_consume - draw;
    END LOOP;

    -- A shortfall here would mean pre-migration data drift (redeemed more
    -- than was ever earned) — surface it loudly rather than silently
    -- leaving an inconsistent ledger.
    IF to_consume > 0 THEN
      RAISE WARNING 'B19 backfill: account % debit txn % could not be fully allocated to lots (% points short) — pre-existing data drift, not created by this migration',
        debit_row.account_id, debit_row.id, to_consume;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Register loyalty_points_expiry on the finance-jobs-hub infrastructure
--    (sys_fin_job_run_log / fin_trigger_job / fin_list_job_schedules — 0429/0505)
-- -----------------------------------------------------------------------------

ALTER TABLE public.sys_fin_job_run_log
  DROP CONSTRAINT chk_fjrl_job_code RESTRICT;

ALTER TABLE public.sys_fin_job_run_log
  ADD CONSTRAINT chk_fjrl_job_code CHECK (job_code IN (
    'gift_card_expiry',
    'idempotency_cleanup',
    'erp_posting_retry',
    'outbox_processor',
    'credit_note_expiry',
    'loyalty_points_expiry'
  ));

COMMENT ON TABLE public.sys_fin_job_run_log IS
  'Run-history ledger for finance maintenance jobs (outbox processor, gift-card expiry, credit-note expiry, loyalty-points expiry, idempotency-key cleanup, ERP posting-retry). System-level: every job is a cross-tenant sweep.';

CREATE OR REPLACE FUNCTION public.fin_list_job_schedules()
RETURNS TABLE (
  job_code   TEXT,
  cron_name  TEXT,
  schedule   TEXT,
  is_active  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.job_code,
    m.cron_name,
    j.schedule,
    COALESCE(j.active, false)
  FROM (
    VALUES
      ('outbox_processor'::text,      'fin-outbox-processor'::text),
      ('gift_card_expiry'::text,      'fin-gift-card-expiry'::text),
      ('credit_note_expiry'::text,    'fin-credit-note-expiry'::text),
      ('loyalty_points_expiry'::text, 'fin-loyalty-points-expiry'::text),
      ('idempotency_cleanup'::text,   'fin-idempotency-cleanup'::text),
      ('erp_posting_retry'::text,     'fin-erp-posting-retry'::text)
  ) AS m(job_code, cron_name)
  LEFT JOIN cron.job j ON j.jobname = m.cron_name;
END;
$$;

COMMENT ON FUNCTION public.fin_list_job_schedules() IS
  'Ops-screen read of pg_cron rows for the registered finance jobs. SECURITY DEFINER because cron.job is not granted to the app role.';

REVOKE ALL ON FUNCTION public.fin_list_job_schedules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fin_list_job_schedules() TO postgres, service_role, authenticated;

-- Daily 02:10 — after gift-card (02:00) and credit-note (02:05) expiry.
SELECT cron.schedule(
  'fin-loyalty-points-expiry',
  '10 2 * * *',
  $$SELECT public.fin_trigger_job('loyalty_points_expiry')$$
);

-- -----------------------------------------------------------------------------
-- 5. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
  v_mismatch INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_constraint
  WHERE conname = 'chk_fjrl_job_code' AND contype = 'c';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'chk_fjrl_job_code was not recreated';
  END IF;

  SELECT COUNT(*) INTO v_count FROM cron.job WHERE jobname = 'fin-loyalty-points-expiry';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'fin-loyalty-points-expiry was not scheduled';
  END IF;

  -- Ledger invariant: SUM(remaining_points) per account must equal
  -- points_balance after the backfill. Zero rows today, so this is
  -- vacuously true — asserted anyway so a populated-environment run of
  -- this same migration fails loudly instead of silently drifting.
  SELECT COUNT(*) INTO v_mismatch
  FROM public.org_loyalty_accounts_mst a
  WHERE a.points_balance <> COALESCE((
    SELECT SUM(t.remaining_points)
    FROM public.org_loyalty_txn_dtl t
    WHERE t.account_id = a.id AND t.remaining_points > 0
  ), 0);
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'B19 backfill invariant violated: % account(s) have SUM(remaining_points) <> points_balance', v_mismatch;
  END IF;

  RAISE NOTICE 'Migration 0511 validation passed';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Rollback: unschedule fin-loyalty-points-expiry; restore chk_fjrl_job_code
--    to the 0505 set (drop 'loyalty_points_expiry'); restore
--    fin_list_job_schedules() to the 0505 version (drop the loyalty row);
--    drop org_loyalty_txn_allocs_dtl; drop idx_loyalty_txn_open_lots; drop
--    constraint chk_oltd_remaining_points; drop column remaining_points from
--    org_loyalty_txn_dtl.
-- 2. Application code (lib/services/loyalty.service.ts) must set
--    remaining_points on every new credit row and route every new debit
--    through the FIFO consumption helper — both ship in this same release,
--    never deploy this migration without that code.
-- 3. Wallet points expiry remains out of scope (B19's original deferral) —
--    no policy surface exists anywhere for it.
-- =============================================================================
