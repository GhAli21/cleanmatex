-- =============================================================================
-- 0533_hq_billing_fx.sql
-- HQ FX, stage H-A (part 1 of 2) — cleanmatexsaas/docs/features/Currency_Setup/
-- implementation_plan_04_hq_fx.md §4.2 (H1, H3, H5, H6), §5.2.
-- (Provisional numbers 0537–0540 in plan 04 are replaced by the next free
-- numbers 0533/0534 at write time.)
--
-- H0 check (owner, 2026-09-25): 5 HQ billing currency columns, all VARCHAR,
-- none with an FK; defaults 'OMR' (invoices, subscriptions, live plans) and
-- 'SAR' (legacy sys_plans_mst); NO orphan values; sys_bill_invoices_mst and
-- sys_bill_invoice_payments_tr are EMPTY. Values: subscriptions OMR (2),
-- live plans USD (5).
--
--   1. sys_platform_finance_cf — single-row HQ finance configuration holding
--      the platform REPORTING currency = USD (owner decision, Q10). No
--      platform-scope settings mechanism exists (the settings catalog is
--      tenant-scoped), so a dedicated locked row replaces plan 04's
--      "platform setting" wording. Locked once any HQ invoice exists.
--   2. H6 — currency columns → TEXT + FK to sys_currency_cd (NOT VALID then
--      VALIDATE — H0 found no orphans):
--        sys_bill_invoices_mst.currency           default 'OMR' DROPPED, NOT NULL
--        sys_bill_invoice_payments_tr.currency_code (already NOT NULL, no default)
--        org_pln_subscriptions_mst.currency       default 'OMR' DROPPED, NOT NULL
--        sys_pln_subscription_plans_mst.currency  NOT NULL; default 'OMR' KEPT
--          for now — HQ plan creation has no currency field yet (API DTO and
--          form); it is dropped in stage H-C when plan pricing gets a currency.
--      Legacy sys_plans_mst (unused by code) is left untouched.
--      !! Deploy the platform-api fix "invoice.service sets currency from the
--      subscription" BEFORE applying: invoice creation currently relies on the
--      'OMR' default and would fail NOT NULL without it.
--   3. H3 — FX snapshot columns (the /database multi-currency standard) on HQ
--      invoices and payments: base_currency_code (= reporting currency),
--      base_*_amount, fx_rate NUMERIC(22,10), fx_rate_date, fx_rate_source,
--      fx_rate_id → sys_currency_exchange_rate_mst. Nullable until the write
--      paths are wired (H-C); a same-currency CHECK applies whenever a base
--      currency is recorded. Each payment carries its OWN rate.
--   4. H5 — sys_bill_revenue_metrics_monthly: reporting_currency_code +
--      fx_rates_used (the rate snapshot behind converted figures).
--
-- Reversal (forward-only): a later migration would drop the added columns,
-- constraints and sys_platform_finance_cf (RESTRICT), and restore the dropped
-- defaults. Lossless while the new columns are unused.
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ── 1. Platform finance configuration (reporting currency) ──────────────────

CREATE TABLE IF NOT EXISTS public.sys_platform_finance_cf (
  id                       SMALLINT PRIMARY KEY DEFAULT 1,
  reporting_currency_code  TEXT NOT NULL,
  reporting_locked_at      TIMESTAMPTZ,
  rec_notes                TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by               TEXT,
  created_info             TEXT,
  updated_at               TIMESTAMPTZ,
  updated_by               TEXT,
  updated_info             TEXT,
  CONSTRAINT fk_spf_reporting_ccy FOREIGN KEY (reporting_currency_code) REFERENCES public.sys_currency_cd(code),
  CONSTRAINT chk_spf_one_row   CHECK (id = 1)
);

COMMENT ON TABLE public.sys_platform_finance_cf IS
  'Single-row HQ finance configuration. reporting_currency_code is the currency CleanMateX consolidates its own revenue in (MRR/ARR, HQ invoice base amounts). Locked once any HQ invoice exists (trg_spf_reporting_lock).';
COMMENT ON COLUMN public.sys_platform_finance_cf.reporting_currency_code IS
  'Platform reporting currency (owner decision 2026-09-25: USD). No catalog default — set explicitly here. Must be platform-enabled.';
COMMENT ON COLUMN public.sys_platform_finance_cf.reporting_locked_at IS
  'Informational: when the reporting currency became locked. The lock is enforced from HQ invoice existence.';

INSERT INTO public.sys_platform_finance_cf (id, reporting_currency_code, created_by, created_info, rec_notes)
VALUES (1, 'USD', 'MIGRATION', '0533_hq_billing_fx', 'Owner decision 2026-09-25 (HQ plan 04 Q10).')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_spf_reporting_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reporting_currency_code IS DISTINCT FROM OLD.reporting_currency_code
     AND EXISTS (SELECT 1 FROM public.sys_bill_invoices_mst) THEN
    RAISE EXCEPTION 'REPORTING_CURRENCY_LOCKED: HQ invoices exist; the platform reporting currency cannot change'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_currency_cd c
                  WHERE c.code = NEW.reporting_currency_code AND c.is_active AND c.is_platform_enabled) THEN
    RAISE EXCEPTION 'REPORTING_CURRENCY_INVALID: % must be an active, platform-enabled currency', NEW.reporting_currency_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spf_reporting_lock ON public.sys_platform_finance_cf;
CREATE TRIGGER trg_spf_reporting_lock
  BEFORE UPDATE ON public.sys_platform_finance_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_spf_reporting_lock();

ALTER TABLE public.sys_platform_finance_cf ENABLE ROW LEVEL SECURITY;
-- No policies: HQ-internal, service role only.

-- ── 2. H6 — normalize HQ billing currency columns ────────────────────────────

-- 2a. HQ invoices (empty per H0)
ALTER TABLE public.sys_bill_invoices_mst
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE TEXT,
  ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.sys_bill_invoices_mst
  DROP CONSTRAINT IF EXISTS fk_sbi_currency;
ALTER TABLE public.sys_bill_invoices_mst
  ADD CONSTRAINT fk_sbi_currency FOREIGN KEY (currency) REFERENCES public.sys_currency_cd(code) NOT VALID;
ALTER TABLE public.sys_bill_invoices_mst VALIDATE CONSTRAINT fk_sbi_currency;

-- 2b. HQ invoice payments (empty per H0)
ALTER TABLE public.sys_bill_invoice_payments_tr
  ALTER COLUMN currency_code TYPE TEXT;
ALTER TABLE public.sys_bill_invoice_payments_tr
  DROP CONSTRAINT IF EXISTS fk_sbip_currency;
ALTER TABLE public.sys_bill_invoice_payments_tr
  ADD CONSTRAINT fk_sbip_currency FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code) NOT VALID;
ALTER TABLE public.sys_bill_invoice_payments_tr VALIDATE CONSTRAINT fk_sbip_currency;

-- 2c. Tenant subscriptions (2 rows, OMR per H0; insert code sets plan.currency)
ALTER TABLE public.org_pln_subscriptions_mst
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE TEXT,
  ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.org_pln_subscriptions_mst
  DROP CONSTRAINT IF EXISTS fk_ops_currency;
ALTER TABLE public.org_pln_subscriptions_mst
  ADD CONSTRAINT fk_ops_currency FOREIGN KEY (currency) REFERENCES public.sys_currency_cd(code) NOT VALID;
ALTER TABLE public.org_pln_subscriptions_mst VALIDATE CONSTRAINT fk_ops_currency;

-- 2d. Live plan catalog (5 rows, USD per H0). Default kept until stage H-C
--     gives plan creation a currency field (see header).
ALTER TABLE public.sys_pln_subscription_plans_mst
  ALTER COLUMN currency TYPE TEXT,
  ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.sys_pln_subscription_plans_mst
  DROP CONSTRAINT IF EXISTS fk_spsp_currency;
ALTER TABLE public.sys_pln_subscription_plans_mst
  ADD CONSTRAINT fk_spsp_currency FOREIGN KEY (currency) REFERENCES public.sys_currency_cd(code) NOT VALID;
ALTER TABLE public.sys_pln_subscription_plans_mst VALIDATE CONSTRAINT fk_spsp_currency;

COMMENT ON COLUMN public.sys_pln_subscription_plans_mst.currency IS
  'Currency of base_price / annual_price. TEMPORARY default ''OMR'' (legacy) remains until HQ plan creation sends a currency (stage H-C); per-currency prices live in sys_pln_price_dtl.';

-- ── 3. H3 — FX snapshot on HQ invoices and payments ─────────────────────────

ALTER TABLE public.sys_bill_invoices_mst
  ADD COLUMN IF NOT EXISTS base_currency_code  TEXT,
  ADD COLUMN IF NOT EXISTS base_total_amount   DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS base_amount_paid    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS fx_rate             NUMERIC(22,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date        DATE,
  ADD COLUMN IF NOT EXISTS fx_rate_source      TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate_id          UUID;

ALTER TABLE public.sys_bill_invoices_mst
  DROP CONSTRAINT IF EXISTS fk_sbi_base_ccy,
  DROP CONSTRAINT IF EXISTS fk_sbi_fx_rate,
  DROP CONSTRAINT IF EXISTS chk_sbi_fx_same_ccy,
  DROP CONSTRAINT IF EXISTS chk_sbi_fx_rate_pos;
ALTER TABLE public.sys_bill_invoices_mst
  ADD CONSTRAINT fk_sbi_base_ccy FOREIGN KEY (base_currency_code) REFERENCES public.sys_currency_cd(code),
  ADD CONSTRAINT fk_sbi_fx_rate  FOREIGN KEY (fx_rate_id) REFERENCES public.sys_currency_exchange_rate_mst(id),
  ADD CONSTRAINT chk_sbi_fx_rate_pos CHECK (fx_rate IS NULL OR fx_rate > 0),
  -- /database standard: same currency ⇒ base = amount and no FX snapshot;
  -- different currency ⇒ a rate and its date are recorded.
  ADD CONSTRAINT chk_sbi_fx_same_ccy CHECK (
    base_currency_code IS NULL
    OR (base_currency_code = currency
        AND base_total_amount = total
        AND fx_rate IS NULL AND fx_rate_date IS NULL AND fx_rate_source IS NULL AND fx_rate_id IS NULL)
    OR (base_currency_code <> currency
        AND base_total_amount IS NOT NULL AND fx_rate IS NOT NULL AND fx_rate_date IS NOT NULL)
  );

ALTER TABLE public.sys_bill_invoice_payments_tr
  ADD COLUMN IF NOT EXISTS base_currency_code  TEXT,
  ADD COLUMN IF NOT EXISTS base_amount         DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS fx_rate             NUMERIC(22,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date        DATE,
  ADD COLUMN IF NOT EXISTS fx_rate_source      TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate_id          UUID;

ALTER TABLE public.sys_bill_invoice_payments_tr
  DROP CONSTRAINT IF EXISTS fk_sbip_base_ccy,
  DROP CONSTRAINT IF EXISTS fk_sbip_fx_rate,
  DROP CONSTRAINT IF EXISTS chk_sbip_fx_same_ccy,
  DROP CONSTRAINT IF EXISTS chk_sbip_fx_rate_pos;
ALTER TABLE public.sys_bill_invoice_payments_tr
  ADD CONSTRAINT fk_sbip_base_ccy FOREIGN KEY (base_currency_code) REFERENCES public.sys_currency_cd(code),
  ADD CONSTRAINT fk_sbip_fx_rate  FOREIGN KEY (fx_rate_id) REFERENCES public.sys_currency_exchange_rate_mst(id),
  ADD CONSTRAINT chk_sbip_fx_rate_pos CHECK (fx_rate IS NULL OR fx_rate > 0),
  ADD CONSTRAINT chk_sbip_fx_same_ccy CHECK (
    base_currency_code IS NULL
    OR (base_currency_code = currency_code
        AND base_amount = amount
        AND fx_rate IS NULL AND fx_rate_date IS NULL AND fx_rate_source IS NULL AND fx_rate_id IS NULL)
    OR (base_currency_code <> currency_code
        AND base_amount IS NOT NULL AND fx_rate IS NOT NULL AND fx_rate_date IS NOT NULL)
  );

COMMENT ON COLUMN public.sys_bill_invoices_mst.base_currency_code IS 'Platform reporting currency at issue time (sys_platform_finance_cf). NULL until the write path is wired (H-C).';
COMMENT ON COLUMN public.sys_bill_invoices_mst.base_total_amount IS 'total × fx_rate, rounded to the base currency; frozen at issue.';
COMMENT ON COLUMN public.sys_bill_invoices_mst.base_amount_paid IS 'Sum of payments'' own base_amount (each payment freezes its own rate).';
COMMENT ON COLUMN public.sys_bill_invoices_mst.fx_rate IS 'Frozen rate: base = amount × fx_rate. NULL when currency = base currency.';
COMMENT ON COLUMN public.sys_bill_invoices_mst.fx_rate_id IS 'HQ rate row used (sys_currency_exchange_rate_mst). NULL for same currency or a manual rate.';
COMMENT ON COLUMN public.sys_bill_invoice_payments_tr.base_amount IS 'amount × the payment''s OWN fx_rate at receipt. The difference vs the invoice rate is HQ''s realized FX gain/loss basis.';
COMMENT ON COLUMN public.sys_bill_invoice_payments_tr.fx_rate IS 'Rate frozen at receipt: base = amount × fx_rate. NULL when currency = base currency.';

-- ── 4. H5 — reporting currency on stored revenue metrics ─────────────────────

ALTER TABLE public.sys_bill_revenue_metrics_monthly
  ADD COLUMN IF NOT EXISTS reporting_currency_code TEXT,
  ADD COLUMN IF NOT EXISTS fx_rates_used           JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.sys_bill_revenue_metrics_monthly
  DROP CONSTRAINT IF EXISTS fk_sbrm_reporting_ccy;
ALTER TABLE public.sys_bill_revenue_metrics_monthly
  ADD CONSTRAINT fk_sbrm_reporting_ccy FOREIGN KEY (reporting_currency_code) REFERENCES public.sys_currency_cd(code);

COMMENT ON COLUMN public.sys_bill_revenue_metrics_monthly.reporting_currency_code IS
  'Currency of the stored money figures. NULL for rows written before H-B (single native currency, or NULL figures when multi-currency).';
COMMENT ON COLUMN public.sys_bill_revenue_metrics_monthly.fx_rates_used IS
  'Snapshot of the rates (id, pair, type, date, value) used to convert this month''s figures, so history is reproducible after rates are voided.';

COMMIT;
