-- =============================================================================
-- L0 — Tenant currency drift report (READ-ONLY)
-- Tenant plan: docs/features/Tenant_Currency_FX/implementation_plan_01.md §6 (L0)
--
-- Run BEFORE migration 0532 (org_currency_cf create + backfill). It shows, per
-- tenant, every place the tenant currency is stored today, so the owner can
-- resolve disagreements before 0532 picks one value as the base currency.
--
-- Safe to run on local and remote: wrapped in a READ ONLY transaction and
-- ends with ROLLBACK. Nothing is written.
--
-- Output:
--   Q1  per-tenant summary (one row per tenant)
--   Q2  only the tenants that need a decision (subset of Q1)
--   Q3  every currency already used on documents / drawers, per tenant
--       (0532 creates an org_currency_cf row for each so history stays valid)
--
-- How to read Q1/Q2:
--   resolved_tenant_currency  what money code uses TODAY
--                             (fn_stng_resolve_all_settings → TENANT_CURRENCY)
--   resolved_layer            which settings layer supplied it: TENANT_OVERRIDE
--                             = chosen for this tenant; SYSTEM_PROFILE / SYSTEM_DEFAULT
--                             (catalog default 'OMR') = never chosen, flagged in Q2
--   profile_currency          org_tenants_mst.currency (kept as a mirror)
--   resolved_decimal_places   TENANT_DECIMAL_PLACES as resolved today
--   minor_unit                sys_currency_cd.minor_unit of the resolved
--                             currency — the authority after cut-over (C8)
--   has_orders                TRUE ⇒ the base currency will be locked (C6)
--   doc_currencies            distinct currencies on existing documents
-- =============================================================================

BEGIN;
SET TRANSACTION READ ONLY;

-- ── Shared working set ───────────────────────────────────────────────────────
CREATE TEMP VIEW l0_tenant_currency AS
WITH resolved AS (
  SELECT
    t.id                                   AS tenant_org_id,
    t.name                                 AS tenant_name,
    NULLIF(TRIM(t.currency), '')           AS profile_currency,
    (SELECT r.stng_value_jsonb #>> '{}'
       FROM fn_stng_resolve_all_settings(t.id) r
      WHERE r.stng_code = 'TENANT_CURRENCY')                  AS resolved_tenant_currency,
    (SELECT r.stng_source_layer
       FROM fn_stng_resolve_all_settings(t.id) r
      WHERE r.stng_code = 'TENANT_CURRENCY')                  AS resolved_layer,
    (SELECT r.stng_value_jsonb #>> '{}'
       FROM fn_stng_resolve_all_settings(t.id) r
      WHERE r.stng_code = 'TENANT_DECIMAL_PLACES')            AS resolved_decimal_places
  FROM public.org_tenants_mst t
),
doc_ccy AS (
  SELECT tenant_org_id, currency_code FROM public.org_orders_mst            WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_invoice_mst     WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_payments_dtl_tr WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_fin_vouchers_mst WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_cash_drawers_mst WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_cash_drawer_sessions_mst WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_customer_wallets_mst WHERE currency_code IS NOT NULL
  UNION SELECT tenant_org_id, currency_code FROM public.org_gift_cards_mst  WHERE currency_code IS NOT NULL
)
SELECT
  r.tenant_org_id,
  r.tenant_name,
  UPPER(TRIM(r.resolved_tenant_currency))             AS resolved_tenant_currency,
  r.resolved_layer,
  UPPER(r.profile_currency)                           AS profile_currency,
  r.resolved_decimal_places,
  c.minor_unit,
  c.is_active                                         AS currency_is_active,
  c.is_platform_enabled                               AS currency_is_platform_enabled,
  EXISTS (SELECT 1 FROM public.org_orders_mst o WHERE o.tenant_org_id = r.tenant_org_id) AS has_orders,
  (SELECT string_agg(DISTINCT UPPER(TRIM(d.currency_code)), ', ' ORDER BY UPPER(TRIM(d.currency_code)))
     FROM doc_ccy d WHERE d.tenant_org_id = r.tenant_org_id)                             AS doc_currencies
FROM resolved r
LEFT JOIN public.sys_currency_cd c
       ON c.code = UPPER(TRIM(r.resolved_tenant_currency));

-- ── Q1: per-tenant summary ───────────────────────────────────────────────────
SELECT *
  FROM l0_tenant_currency
 ORDER BY tenant_name;

-- ── Q2: tenants that need an owner decision before 0532 ──────────────────────
SELECT
  tenant_org_id,
  tenant_name,
  resolved_tenant_currency,
  resolved_layer,
  profile_currency,
  resolved_decimal_places,
  minor_unit,
  has_orders,
  doc_currencies,
  concat_ws(' | ',
    CASE WHEN resolved_tenant_currency IS NULL
         THEN 'NO_RESOLVED_CURRENCY: 0532 falls back to profile_currency, else creates no base row' END,
    CASE WHEN resolved_tenant_currency IS NOT NULL AND minor_unit IS NULL
         THEN 'UNKNOWN_CURRENCY_CODE: resolved code not in sys_currency_cd' END,
    CASE WHEN currency_is_active = FALSE
         THEN 'CURRENCY_INACTIVE in sys_currency_cd' END,
    CASE WHEN currency_is_platform_enabled = FALSE
         THEN 'CURRENCY_NOT_PLATFORM_ENABLED: enable it in HQ Currency Setup or pick another' END,
    CASE WHEN profile_currency IS DISTINCT FROM resolved_tenant_currency
         THEN 'PROFILE_MISMATCH: org_tenants_mst.currency differs; the mirror will be overwritten with the base' END,
    CASE WHEN resolved_decimal_places IS NOT NULL AND minor_unit IS NOT NULL
              AND resolved_decimal_places ~ '^\d+$'
              AND resolved_decimal_places::INT <> minor_unit
         THEN 'DECIMALS_CHANGE: TENANT_DECIMAL_PLACES ' || resolved_decimal_places
              || ' will become minor_unit ' || minor_unit || ' (rounding changes, C8)' END,
    CASE WHEN resolved_layer IS NOT NULL AND resolved_layer NOT ILIKE '%TENANT%'
         THEN 'DEFAULTED: value came from layer ' || resolved_layer || ', not chosen for this tenant' END,
    CASE WHEN doc_currencies IS NOT NULL
              AND resolved_tenant_currency IS NOT NULL
              AND doc_currencies <> resolved_tenant_currency
         THEN 'OTHER_DOC_CURRENCIES: documents use ' || doc_currencies END
  ) AS issues
FROM l0_tenant_currency
WHERE resolved_tenant_currency IS NULL
   OR minor_unit IS NULL
   OR currency_is_active = FALSE
   OR currency_is_platform_enabled = FALSE
   OR profile_currency IS DISTINCT FROM resolved_tenant_currency
   OR (resolved_decimal_places ~ '^\d+$' AND minor_unit IS NOT NULL
       AND resolved_decimal_places::INT <> minor_unit)
   OR (resolved_layer IS NOT NULL AND resolved_layer NOT ILIKE '%TENANT%')
   OR (doc_currencies IS NOT NULL AND resolved_tenant_currency IS NOT NULL
       AND doc_currencies <> resolved_tenant_currency)
ORDER BY has_orders DESC, tenant_name;

-- ── Q3: currencies already in use, per tenant and source ─────────────────────
SELECT tenant_org_id, source_table, UPPER(TRIM(currency_code)) AS currency_code, COUNT(*) AS row_count
FROM (
  SELECT tenant_org_id, currency_code, 'org_orders_mst'               AS source_table FROM public.org_orders_mst
  UNION ALL SELECT tenant_org_id, currency_code, 'org_invoice_mst'               FROM public.org_invoice_mst
  UNION ALL SELECT tenant_org_id, currency_code, 'org_payments_dtl_tr'           FROM public.org_payments_dtl_tr
  UNION ALL SELECT tenant_org_id, currency_code, 'org_fin_vouchers_mst'          FROM public.org_fin_vouchers_mst
  UNION ALL SELECT tenant_org_id, currency_code, 'org_cash_drawers_mst'          FROM public.org_cash_drawers_mst
  UNION ALL SELECT tenant_org_id, currency_code, 'org_cash_drawer_sessions_mst'  FROM public.org_cash_drawer_sessions_mst
  UNION ALL SELECT tenant_org_id, currency_code, 'org_customer_wallets_mst'      FROM public.org_customer_wallets_mst
  UNION ALL SELECT tenant_org_id, currency_code, 'org_gift_cards_mst'            FROM public.org_gift_cards_mst
) u
WHERE currency_code IS NOT NULL
GROUP BY tenant_org_id, source_table, UPPER(TRIM(currency_code))
ORDER BY tenant_org_id, currency_code, source_table;

ROLLBACK;
