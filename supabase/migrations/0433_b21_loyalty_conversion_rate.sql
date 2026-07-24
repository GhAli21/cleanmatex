-- =============================================================================
-- 0433_b21_loyalty_conversion_rate.sql
-- B21 — Loyalty Conversion Rate
-- (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose:
--   1. Add `rounding_rule` to org_loyalty_programs_cf — the one genuinely
--      missing piece of B21's three-part ask (rate, rounding rule,
--      min-redemption). `redeem_rate_per_point` and `min_redeem_points`
--      ALREADY exist (migration 0287) and are already live/seeded/editable —
--      B21's own doc assumed all three were missing; corrected during
--      implementation (see B21's own Completion evidence).
--      Default 'CEIL' preserves the exact current hardcoded behavior
--      (`Math.ceil(amount / redeemRate)` in both existing call sites) —
--      this migration changes zero existing redemption math.
--      Vocabulary mirrors `sys_currency_rounding_rules_cd.rounding_method`
--      (migration 0290) exactly for naming consistency across the codebase.
--   2. Add CHECK constraints on `redeem_rate_per_point` (> 0) and
--      `min_redeem_points` (>= 0) — neither existed before; a 0 or negative
--      rate would make redemption math divide-by-zero or produce negative
--      points. Pre-validated against live data before applying (Step 0).
--
-- Decisions: none required — technical config design (per B21's own
--            metadata: "config design is technical; liability valuation
--            belongs to D012/B25").
-- Dependencies:
--   0287_loyalty.sql          — org_loyalty_programs_cf origin
--   0290_currency_rounding.sql — rounding-rule vocabulary precedent (HALF_UP/HALF_DOWN/FLOOR/CEIL)
-- Work packages:
--   docs/features/Order_Fin/Remediation_Work_Packages/B21_Loyalty_Conversion_Rate.md
--
-- WHY this migration is safe:
--   • New column is nullable-then-defaulted additive (DEFAULT 'CEIL' NOT NULL
--     — every existing row backfills to the value matching current behavior).
--   • Step 0 pre-validates no live row would violate either new CHECK before
--     attempting to add it — a clear, actionable exception instead of a
--     generic constraint-violation error if data is ever found to violate it.
--   • No data migration, no destructive change, no CASCADE.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Pre-validate: no live row may already violate the new CHECK constraints
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_bad_rate INTEGER;
  v_bad_min  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bad_rate FROM public.org_loyalty_programs_cf WHERE redeem_rate_per_point <= 0;
  IF v_bad_rate > 0 THEN
    RAISE EXCEPTION 'B21 migration aborted: % org_loyalty_programs_cf row(s) have redeem_rate_per_point <= 0 — fix the data before applying chk_loyalty_redeem_rate_positive', v_bad_rate;
  END IF;

  SELECT COUNT(*) INTO v_bad_min FROM public.org_loyalty_programs_cf WHERE min_redeem_points < 0;
  IF v_bad_min > 0 THEN
    RAISE EXCEPTION 'B21 migration aborted: % org_loyalty_programs_cf row(s) have min_redeem_points < 0 — fix the data before applying chk_loyalty_min_redeem_nonneg', v_bad_min;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. rounding_rule column
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_loyalty_programs_cf
  ADD COLUMN IF NOT EXISTS rounding_rule TEXT NOT NULL DEFAULT 'CEIL';

ALTER TABLE public.org_loyalty_programs_cf
  ADD CONSTRAINT chk_loyalty_rounding_rule
  CHECK (rounding_rule IN ('HALF_UP', 'HALF_DOWN', 'FLOOR', 'CEIL'));

COMMENT ON COLUMN public.org_loyalty_programs_cf.rounding_rule IS
  'B21 — how a fractional points-per-currency-amount computation rounds to a whole point count at redemption. Mirrors sys_currency_rounding_rules_cd.rounding_method vocabulary (migration 0290). Default CEIL preserves the pre-B21 hardcoded behavior (Math.ceil) unchanged for every existing tenant.';

-- -----------------------------------------------------------------------------
-- 2. Missing CHECK constraints on the already-existing rate/threshold columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_loyalty_programs_cf
  ADD CONSTRAINT chk_loyalty_redeem_rate_positive
  CHECK (redeem_rate_per_point > 0);

ALTER TABLE public.org_loyalty_programs_cf
  ADD CONSTRAINT chk_loyalty_min_redeem_nonneg
  CHECK (min_redeem_points >= 0);

-- -----------------------------------------------------------------------------
-- 3. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'org_loyalty_programs_cf' AND column_name = 'rounding_rule';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'org_loyalty_programs_cf.rounding_rule column was not created';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.check_constraints
  WHERE constraint_name IN ('chk_loyalty_rounding_rule', 'chk_loyalty_redeem_rate_positive', 'chk_loyalty_min_redeem_nonneg');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'B21 CHECK constraints not fully created (found % of 3)', v_count;
  END IF;

  RAISE NOTICE '✓ Migration 0433 validation passed';
  RAISE NOTICE '  - rounding_rule added to org_loyalty_programs_cf (default CEIL, unchanged behavior)';
  RAISE NOTICE '  - chk_loyalty_redeem_rate_positive / chk_loyalty_min_redeem_nonneg added';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Prisma schema.prisma must be hand-updated to mirror the new
--    rounding_rule column on org_loyalty_programs_cf, then `npx prisma
--    generate` re-run.
-- 2. No new permission codes — this package reuses the existing
--    `loyalty:view_config` / `loyalty:manage_config` (migration 0294),
--    which B21's own doc incorrectly assumed didn't exist yet.
-- 3. To rollback: drop chk_loyalty_rounding_rule / chk_loyalty_redeem_rate_positive
--    / chk_loyalty_min_redeem_nonneg, drop the rounding_rule column (additive,
--    nullable-defaulted — safe to drop).
-- =============================================================================
