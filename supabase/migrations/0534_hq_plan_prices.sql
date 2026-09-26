-- =============================================================================
-- 0534_hq_plan_prices.sql
-- HQ FX, stage H-A (part 2 of 2) — cleanmatexsaas/docs/features/Currency_Setup/
-- implementation_plan_04_hq_fx.md §4.2 (H2).
--
-- sys_pln_price_dtl: explicit subscription-plan prices per currency and
-- billing cycle (standard SaaS practice — prices are set per currency, never
-- produced by a daily conversion; FX is for reporting only).
--
-- Attached to the LIVE plan catalog sys_pln_subscription_plans_mst (the only
-- plan table referenced by code; H0 confirmed). Legacy sys_plans_mst untouched.
--
-- billing_cycle mirrors the live vocabulary of sys_pln_subscription_plans_mst /
-- org_pln_subscriptions_mst ('monthly' | 'annual'), NOT the legacy
-- sys_billing_cycle_cd codes ('MONTHLY' …), which no live table uses.
--
-- Backfill: one row per plan from its current base_price (monthly) and, when
-- set, annual_price (annual), in the plan's own currency (all USD per H0).
-- Nothing reads this table yet — billing keeps using the plan columns until
-- stage H-C switches price lookup to (plan, tenant base currency, cycle).
--
-- H0 note for H-C: the 2 existing subscriptions are OMR while their plans are
-- priced in USD — exactly the gap this table closes (an OMR price row per
-- plan is an owner pricing decision, not something to derive by conversion).
--
-- Reversal: DROP TABLE sys_pln_price_dtl RESTRICT (lossless while unread).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_pln_price_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code       TEXT NOT NULL,
  currency_code   TEXT NOT NULL,
  billing_cycle   TEXT NOT NULL,
  price           DECIMAL(19,4) NOT NULL,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  rec_notes       TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      TEXT,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT,
  updated_info    TEXT,
  CONSTRAINT fk_spp_plan      FOREIGN KEY (plan_code) REFERENCES public.sys_pln_subscription_plans_mst(plan_code),
  CONSTRAINT fk_spp_currency  FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code),
  CONSTRAINT chk_spp_cycle    CHECK (billing_cycle IN ('monthly', 'annual')),
  CONSTRAINT chk_spp_price    CHECK (price >= 0),
  CONSTRAINT chk_spp_dates    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT chk_spp_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- One live price per plan / currency / cycle / start date.
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_live
  ON public.sys_pln_price_dtl (plan_code, currency_code, billing_cycle, effective_from)
  WHERE rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_spp_lookup
  ON public.sys_pln_price_dtl (plan_code, currency_code, billing_cycle, effective_from DESC)
  WHERE rec_status = 1 AND is_active;

ALTER TABLE public.sys_pln_price_dtl ENABLE ROW LEVEL SECURITY;
-- No policies: HQ-internal, service role only.

COMMENT ON TABLE public.sys_pln_price_dtl IS
  'Subscription-plan prices per currency and billing cycle (HQ plan 04, H2). A tenant is billed in its base currency when a price exists for it, else in the plan''s own currency. Prices are set explicitly, never converted daily.';
COMMENT ON COLUMN public.sys_pln_price_dtl.plan_code IS 'FK sys_pln_subscription_plans_mst.plan_code (the live plan catalog).';
COMMENT ON COLUMN public.sys_pln_price_dtl.billing_cycle IS 'monthly | annual — same vocabulary as the live plan and subscription tables.';
COMMENT ON COLUMN public.sys_pln_price_dtl.price IS 'Price per cycle in currency_code. DECIMAL(19,4).';
COMMENT ON COLUMN public.sys_pln_price_dtl.effective_from IS 'First day the price applies; the lookup takes the latest effective_from <= billing date.';

INSERT INTO public.sys_pln_price_dtl
  (plan_code, currency_code, billing_cycle, price, effective_from, created_by, created_info, metadata)
SELECT p.plan_code, p.currency, 'monthly', p.base_price, DATE '2026-01-01',
       'MIGRATION', '0534_hq_plan_prices', '{"seed_source":"PLAN_BASE_PRICE"}'::JSONB
  FROM public.sys_pln_subscription_plans_mst p
 WHERE p.currency IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.sys_pln_price_dtl
  (plan_code, currency_code, billing_cycle, price, effective_from, created_by, created_info, metadata)
SELECT p.plan_code, p.currency, 'annual', p.annual_price, DATE '2026-01-01',
       'MIGRATION', '0534_hq_plan_prices', '{"seed_source":"PLAN_ANNUAL_PRICE"}'::JSONB
  FROM public.sys_pln_subscription_plans_mst p
 WHERE p.currency IS NOT NULL AND p.annual_price IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
