-- =============================================================================
-- 0524_currency_fk_phase_a.sql
-- (originally authored/attempted as 0523; renumbered to 0524 after a
-- filename collision with a concurrently-written 0523_clf_drawer_catalogs.sql
-- — see cleanmatex/docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/
-- STATUS.md. This file's DDL had already executed live on remote before the
-- collision was caught (Supabase CLI committed the DDL even though its own
-- ledger insert failed on the duplicate version). Rewritten below to be
-- idempotent — every ADD CONSTRAINT is guarded by an existence check, so a
-- plain `supabase db push --include-all` now completes and records this
-- migration as applied whether the constraints already exist (from the
-- earlier partial run) or not. `supabase migration repair` is no longer
-- required for this file.
-- Currency Setup Phase 3, task 3.7 (D6 resolution) — first phase of a
-- deliberately phased FK rollout, not a single big-bang migration. Full
-- decision + the remaining phases: cleanmatexsaas
-- docs/features/Currency_Setup/progress_status.md §5, "A2 resolution".
--
-- A remote read-only query (owner-run) found 47 currency_code-shaped columns
-- across 43 org_* tenant tables + 4 sys_* HQ tables, 0 FKs to sys_currency_cd
-- anywhere, split TEXT (30) / VARCHAR(3) (7) / VARCHAR(10) (10). Phase A picks
-- the 5 highest-signal "is this currency actually in use" tables — order-
-- taking, cash operations, stored value, vouchers, gift cards — because this
-- unblocks CurrencyUsageService (Phase 3 task 3.6) with a real check instead
-- of the current hardcoded-0 stub. The other ~42 columns are intentionally
-- left for later phases (B: remaining order/customer/invoice/tax-document
-- tables; C: ERP-lite back-office, promotions, B2B, reconciliation; D: the 4
-- sys_* HQ tables) — validating every existing value across all of them in
-- one pass is a materially larger, higher-risk undertaking than the rest of
-- Currency Setup Phase 3 combined.
--
-- Mechanics: normalize VARCHAR -> TEXT first where needed (lossless, already
-- precedented on sys_currency_cd itself in migration 0520), then add each FK
-- as NOT VALID. NOT VALID enforces on every new/updated row immediately,
-- without a table scan or lock, and without needing to pre-audit existing
-- rows for orphaned currency codes first — the safest way to introduce a
-- first FK onto tables that already carry data. VALIDATE CONSTRAINT (which
-- does scan and can fail if an orphan exists) is deliberately NOT run here;
-- it's a cheap, separate, later step once orphaned values (if any) are
-- confirmed absent or cleaned up. Pre-launch (no real tenants yet), so this
-- is safe to complete whenever convenient, not urgent.
--
-- Reversal (forward-only): a future migration would
-- ALTER TABLE ... DROP CONSTRAINT fk_... RESTRICT for each of the 5, and
-- revert org_orders_mst.currency_code / org_fin_vouchers_mst.currency_code
-- back to VARCHAR(3) (lossless either direction). No data loss either way —
-- these are constraint/type changes only, no rows are touched.
-- =============================================================================

BEGIN;

-- ── Normalize VARCHAR -> TEXT on the 2 Phase-A columns that need it ────────
-- (org_cash_drawer_sessions_mst, org_customer_wallets_mst, org_gift_cards_mst
-- are already TEXT — confirmed via the same read-only query, no change needed)
-- ALTER COLUMN ... TYPE TEXT is naturally idempotent in Postgres — a no-op,
-- no error, when the column is already TEXT. No guard needed.

ALTER TABLE public.org_orders_mst
  ALTER COLUMN currency_code TYPE TEXT;

ALTER TABLE public.org_fin_vouchers_mst
  ALTER COLUMN currency_code TYPE TEXT;

-- ── Phase A: NOT VALID FKs on the 5 highest-signal "in use" tables ────────
-- Each ADD CONSTRAINT is guarded by an existence check: if a prior partial
-- run already created it, skip it and continue to the next one, rather than
-- erroring out and aborting statements that haven't run yet.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_orders_mst_currency'
      AND conrelid = 'public.org_orders_mst'::regclass
  ) THEN
    ALTER TABLE public.org_orders_mst
      ADD CONSTRAINT fk_org_orders_mst_currency
        FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_cds_sessions_currency'
      AND conrelid = 'public.org_cash_drawer_sessions_mst'::regclass
  ) THEN
    ALTER TABLE public.org_cash_drawer_sessions_mst
      ADD CONSTRAINT fk_org_cds_sessions_currency
        FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_cust_wallets_currency'
      AND conrelid = 'public.org_customer_wallets_mst'::regclass
  ) THEN
    ALTER TABLE public.org_customer_wallets_mst
      ADD CONSTRAINT fk_org_cust_wallets_currency
        FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_fin_vouchers_currency'
      AND conrelid = 'public.org_fin_vouchers_mst'::regclass
  ) THEN
    ALTER TABLE public.org_fin_vouchers_mst
      ADD CONSTRAINT fk_org_fin_vouchers_currency
        FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_org_gift_cards_currency'
      AND conrelid = 'public.org_gift_cards_mst'::regclass
  ) THEN
    ALTER TABLE public.org_gift_cards_mst
      ADD CONSTRAINT fk_org_gift_cards_currency
        FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code) NOT VALID;
  END IF;
END $$;

-- COMMENT ON CONSTRAINT is itself idempotent (always just (re)sets the
-- comment) and each constraint is guaranteed to exist by this point
-- (either pre-existing or just created above), so these need no guard.

COMMENT ON CONSTRAINT fk_org_orders_mst_currency ON public.org_orders_mst IS
  'Currency Setup Phase 3 (D6/A2 resolution), Phase A of a phased FK rollout — NOT VALID, not yet retroactively validated against existing rows. See cleanmatexsaas docs/features/Currency_Setup/progress_status.md.';
COMMENT ON CONSTRAINT fk_org_cds_sessions_currency ON public.org_cash_drawer_sessions_mst IS
  'Currency Setup Phase 3 (D6/A2 resolution), Phase A of a phased FK rollout — NOT VALID, not yet retroactively validated against existing rows.';
COMMENT ON CONSTRAINT fk_org_cust_wallets_currency ON public.org_customer_wallets_mst IS
  'Currency Setup Phase 3 (D6/A2 resolution), Phase A of a phased FK rollout — NOT VALID, not yet retroactively validated against existing rows.';
COMMENT ON CONSTRAINT fk_org_fin_vouchers_currency ON public.org_fin_vouchers_mst IS
  'Currency Setup Phase 3 (D6/A2 resolution), Phase A of a phased FK rollout — NOT VALID, not yet retroactively validated against existing rows.';
COMMENT ON CONSTRAINT fk_org_gift_cards_currency ON public.org_gift_cards_mst IS
  'Currency Setup Phase 3 (D6/A2 resolution), Phase A of a phased FK rollout — NOT VALID, not yet retroactively validated against existing rows.';

COMMIT;
