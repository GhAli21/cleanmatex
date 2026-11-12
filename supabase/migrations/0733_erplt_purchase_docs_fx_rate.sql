-- =============================================================================
-- 0733_erplt_purchase_docs_fx_rate.sql
-- Purpose:   Let ERP-Lite purchase documents carry a real exchange rate, per the
--            Multi-Currency Transaction Standard (base = amount x fx_rate).
--            Until now every expense, purchase order, supplier invoice and
--            supplier payment was saved with exchange_rate = 1, so a document in
--            a foreign currency was valued wrongly in the ledger (the posting
--            engine already converts with the document's exchange_rate) and a
--            taxed one was refused (TAX_CURRENCY_UNSUPPORTED).
-- Changes (4 tables: org_fin_exp_mst, org_fin_po_mst, org_fin_ap_inv_mst,
--          org_fin_ap_pmt_mst):
--   * exchange_rate widened to DECIMAL(22,10) (was 19,4 / 19,8): FX rates
--     need more decimals than money. It stays the document's fx_rate:
--     1 when the document is in the organization currency.
--   * fx_rate_date, fx_rate_source, fx_rate_id: where the rate came from
--     (tenant or HQ rate book), NULL for a same-currency document.
-- Existing rows keep exchange_rate 1 (pre-launch demo data, no backfill).
-- No view depends on exchange_rate (checked on remote 2026-11-13).
-- Rollback (manual): drop the three columns (RESTRICT); narrowing the rate
--   back would lose decimals, so it is not part of the rollback.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

ALTER TABLE public.org_fin_exp_mst
  ALTER COLUMN exchange_rate TYPE DECIMAL(22,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date DATE NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_id UUID NULL;

ALTER TABLE public.org_fin_po_mst
  ALTER COLUMN exchange_rate TYPE DECIMAL(22,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date DATE NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_id UUID NULL;

ALTER TABLE public.org_fin_ap_inv_mst
  ALTER COLUMN exchange_rate TYPE DECIMAL(22,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date DATE NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_id UUID NULL;

ALTER TABLE public.org_fin_ap_pmt_mst
  ALTER COLUMN exchange_rate TYPE DECIMAL(22,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date DATE NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_id UUID NULL;

-- ─── Column documentation (same text on the four tables) ───────────────────
COMMENT ON COLUMN public.org_fin_exp_mst.exchange_rate IS 'FX rate to the organization (base) currency: base = amount x exchange_rate. 1 when currency_code is the base currency.';
COMMENT ON COLUMN public.org_fin_exp_mst.fx_rate_date IS 'Date of the rate used (rate book row date); NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_exp_mst.fx_rate_source IS 'Rate book and publisher that gave the rate, e.g. TENANT:CBO or HQ:ECB; NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_exp_mst.fx_rate_id IS 'Row id of the rate in the tenant or HQ rate book (no FK: two possible books); NULL for a same-currency document.';

COMMENT ON COLUMN public.org_fin_po_mst.exchange_rate IS 'FX rate to the organization (base) currency: base = amount x exchange_rate. 1 when currency_code is the base currency.';
COMMENT ON COLUMN public.org_fin_po_mst.fx_rate_date IS 'Date of the rate used (rate book row date); NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_po_mst.fx_rate_source IS 'Rate book and publisher that gave the rate, e.g. TENANT:CBO or HQ:ECB; NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_po_mst.fx_rate_id IS 'Row id of the rate in the tenant or HQ rate book (no FK: two possible books); NULL for a same-currency document.';

COMMENT ON COLUMN public.org_fin_ap_inv_mst.exchange_rate IS 'FX rate to the organization (base) currency: base = amount x exchange_rate. 1 when currency_code is the base currency.';
COMMENT ON COLUMN public.org_fin_ap_inv_mst.fx_rate_date IS 'Date of the rate used (rate book row date); NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_ap_inv_mst.fx_rate_source IS 'Rate book and publisher that gave the rate, e.g. TENANT:CBO or HQ:ECB; NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_ap_inv_mst.fx_rate_id IS 'Row id of the rate in the tenant or HQ rate book (no FK: two possible books); NULL for a same-currency document.';

COMMENT ON COLUMN public.org_fin_ap_pmt_mst.exchange_rate IS 'FX rate to the organization (base) currency: base = amount x exchange_rate. 1 when currency_code is the base currency.';
COMMENT ON COLUMN public.org_fin_ap_pmt_mst.fx_rate_date IS 'Date of the rate used (rate book row date); NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_ap_pmt_mst.fx_rate_source IS 'Rate book and publisher that gave the rate, e.g. TENANT:CBO or HQ:ECB; NULL for a same-currency document.';
COMMENT ON COLUMN public.org_fin_ap_pmt_mst.fx_rate_id IS 'Row id of the rate in the tenant or HQ rate book (no FK: two possible books); NULL for a same-currency document.';

COMMIT;
