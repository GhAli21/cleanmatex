-- =============================================================================
-- 0535_fix_plan_currency_not_null.sql
-- Follow-up to 0533 (H6) — closes a gap 0533 exposed rather than caused.
--
-- 0041 created sys_pln_subscription_plans_mst.currency with its DEFAULT
-- commented out, so no migration has ever set it. Production plans got
-- 'USD' via a manual admin action outside any migration (confirmed by the
-- 0533 H0 audit: 5 rows, all USD, no NULLs). A DB built purely from
-- migration replay (fresh local/dev/CI) never receives that manual fix, so
-- it still has NULL currency on all plan rows today — which is exactly what
-- made 0533's `ALTER COLUMN currency SET NOT NULL` fail there (SQLSTATE
-- 23502) while it succeeds on production. That statement was worked around
-- locally instead of fixed, so NOT NULL is currently NOT enforced anywhere
-- 0533 was applied with the workaround, even though production's own data
-- already satisfies it.
--
-- This migration is idempotent and safe to run against production too:
-- the backfill only touches rows currently NULL (there are none in
-- production today, so it is a no-op there), then (re)applies the NOT NULL
-- that should have landed with 0533, then fills in the sys_pln_price_dtl
-- row 0534 skipped for any plan that was NULL at that time.
--
-- Does NOT modify 0533 or 0534 (CLAUDE.md rule 2 — never edit an existing
-- migration file). Restore any local hand-edit of 0533 back to its
-- committed content before applying this.
--
-- Reversal (forward-only): DROP CONSTRAINT / ALTER COLUMN DROP NOT NULL is
-- possible but pointless — there is no reason to reintroduce NULL currency.
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- 1. Backfill: no-op on any environment where 0533's H0 audit already holds
--    (e.g. production). Only fires where currency was never set (fresh /
--    migration-only environments). 'USD' matches the value production's
--    plans already carry for these same plan_codes.
UPDATE public.sys_pln_subscription_plans_mst
   SET currency = 'USD',
       updated_at = CURRENT_TIMESTAMP,
       updated_by = 'MIGRATION',
       updated_info = '0535_fix_plan_currency_not_null'
 WHERE currency IS NULL;

-- 2. The constraint 0533 intended but which was skipped wherever the
--    workaround was applied. Safe now: step 1 guarantees no NULLs remain.
ALTER TABLE public.sys_pln_subscription_plans_mst
  ALTER COLUMN currency SET NOT NULL;

-- 3. Backfill sys_pln_price_dtl for any plan 0534 skipped because its
--    currency was NULL at that time (mirrors 0534's own inserts exactly).
INSERT INTO public.sys_pln_price_dtl
  (plan_code, currency_code, billing_cycle, price, effective_from, created_by, created_info, metadata)
SELECT p.plan_code, p.currency, 'monthly', p.base_price, DATE '2026-01-01',
       'MIGRATION', '0535_fix_plan_currency_not_null', '{"seed_source":"PLAN_BASE_PRICE_BACKFILL"}'::JSONB
  FROM public.sys_pln_subscription_plans_mst p
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sys_pln_price_dtl d
    WHERE d.plan_code = p.plan_code AND d.currency_code = p.currency AND d.billing_cycle = 'monthly'
 )
ON CONFLICT DO NOTHING;

INSERT INTO public.sys_pln_price_dtl
  (plan_code, currency_code, billing_cycle, price, effective_from, created_by, created_info, metadata)
SELECT p.plan_code, p.currency, 'annual', p.annual_price, DATE '2026-01-01',
       'MIGRATION', '0535_fix_plan_currency_not_null', '{"seed_source":"PLAN_ANNUAL_PRICE_BACKFILL"}'::JSONB
  FROM public.sys_pln_subscription_plans_mst p
 WHERE p.annual_price IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.sys_pln_price_dtl d
      WHERE d.plan_code = p.plan_code AND d.currency_code = p.currency AND d.billing_cycle = 'annual'
   )
ON CONFLICT DO NOTHING;

COMMIT;
