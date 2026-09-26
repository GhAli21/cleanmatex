-- =============================================================================
-- 0532_org_currency_cf.sql
-- Tenant Currency & FX, stage 5A / L1 —
-- docs/features/Tenant_Currency_FX/implementation_plan_01.md §4, §5, §6 (L1).
--
-- Creates the tenant currency authority and backfills it from today's state:
--
--   1. org_currency_cf     one row per tenant × currency. Exactly one active
--                          base (= functional) currency per tenant; optional
--                          reporting currency; foreign currencies with
--                          per-context permissions and FX defaults. Decimals
--                          always come from sys_currency_cd.minor_unit (C8).
--   2. org_fin_fx_stng_cf  tenant-wide FX policy (one row per tenant; no row =
--                          defaults), following org_fin_cash_ctrl_stng_cf.
--   3. Triggers
--      - base lock (C6): the base currency cannot change once the tenant has
--        orders — enforced in the DB, so it binds HQ and tenant app alike.
--      - mirror (base row → org_tenants_mst.currency), which is KEPT as a
--        synced copy (owner, 2026-09-25; 0523 ensure_branch_pd_drawer reads it).
--      - bridge (org_tenants_mst.currency → base row) for the legacy writers
--        (HQ tenant wizard / locale tab, tenant profile) until they move to
--        org_currency_cf (tenant L2, HQ 4E). New tenants therefore get a base
--        row automatically, and a legacy currency edit on a tenant with orders
--        is rejected by the lock instead of silently drifting.
--   4. Backfill (L1): one base row per tenant from the value the settings
--      resolver returns today for TENANT_CURRENCY (fn_stng_resolve_all_settings
--      → override → profile → default), else org_tenants_mst.currency; plus a
--      row (contexts off) for every other currency already on that tenant's
--      documents or drawers, so history stays valid.
--      L0 drift report (2026-09-25, local + remote): 3 tenants, all consistent
--      (resolved = profile = document currencies; decimals = minor_unit).
--   5. org_cash_drawers_mst (tenant_org_id, currency_code) → org_currency_cf
--      composite FK (C5): a drawer can only hold a currency the tenant has.
--      Added NOT VALID, then VALIDATEd after the backfill.
--
-- Settings (TENANT_CURRENCY / BRANCH_CURRENCY / TENANT_DECIMAL_PLACES) are NOT
-- touched here; the app keeps reading them until cut-over L2, and they are
-- retired later (L4, owner go).
--
-- A migration calling fn_stng_resolve_all_settings is not the app-code
-- "never query sys_stng_*" ban — it reproduces exactly what money code sees.
--
-- Reversal (forward-only): a later migration would DROP CONSTRAINT
-- fk_ocd_tenant_currency on org_cash_drawers_mst, DROP TRIGGER the three
-- triggers and their functions, then DROP TABLE org_fin_fx_stng_cf and
-- org_currency_cf RESTRICT. org_tenants_mst.currency is unchanged by this
-- migration's backfill (the mirror writes the same value it read).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ── 1. org_currency_cf ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_currency_cf (
  id                          UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id               UUID NOT NULL,
  currency_code               TEXT NOT NULL,

  -- roles
  is_base_currency            BOOLEAN NOT NULL DEFAULT FALSE,
  base_locked_at              TIMESTAMPTZ,
  is_reporting_currency       BOOLEAN NOT NULL DEFAULT FALSE,

  -- contexts (FALSE by default; the base row is forced TRUE for READY contexts)
  allow_sales                 BOOLEAN NOT NULL DEFAULT FALSE,
  allow_payments              BOOLEAN NOT NULL DEFAULT FALSE,
  allow_cash                  BOOLEAN NOT NULL DEFAULT FALSE,
  allow_ar                    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_wallet                BOOLEAN NOT NULL DEFAULT FALSE,
  allow_gift_card             BOOLEAN NOT NULL DEFAULT FALSE,
  allow_customer_advance      BOOLEAN NOT NULL DEFAULT FALSE,
  allow_purchasing            BOOLEAN NOT NULL DEFAULT FALSE,

  -- pricing
  sales_pricing_mode          TEXT NOT NULL DEFAULT 'CONVERT_FROM_BASE',

  -- FX policy / defaults (never a current rate)
  default_rate_type_code      TEXT,
  default_rate_source_code    TEXT,
  rate_max_age_days           INTEGER,
  allow_manual_fx_rate        BOOLEAN NOT NULL DEFAULT FALSE,
  manual_fx_requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  manual_rate_tolerance_pct   NUMERIC(7,4),
  tax_rate_source_code        TEXT,

  display_order               INTEGER,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status                  SMALLINT NOT NULL DEFAULT 1,
  rec_order                   INTEGER,
  rec_notes                   TEXT,
  metadata                    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                  TEXT,
  created_info                TEXT,
  updated_at                  TIMESTAMPTZ,
  updated_by                  TEXT,
  updated_info                TEXT,

  CONSTRAINT pk_orgcur PRIMARY KEY (id),
  -- FULL unique (not partial) so composite FKs can target it; a deactivated
  -- currency is reactivated on the same row, never re-inserted.
  CONSTRAINT uq_orgcur_ccy        UNIQUE (tenant_org_id, currency_code),
  CONSTRAINT uq_orgcur_tenant_id  UNIQUE (tenant_org_id, id),
  CONSTRAINT fk_orgcur_tenant     FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_orgcur_currency   FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd(code),
  CONSTRAINT fk_orgcur_rate_type  FOREIGN KEY (default_rate_type_code) REFERENCES public.sys_fx_rate_type_cd(code),
  CONSTRAINT fk_orgcur_rate_src   FOREIGN KEY (default_rate_source_code) REFERENCES public.sys_exchange_rate_source_cd(code),
  CONSTRAINT fk_orgcur_tax_src    FOREIGN KEY (tax_rate_source_code) REFERENCES public.sys_exchange_rate_source_cd(code),
  CONSTRAINT chk_orgcur_pricing   CHECK (sales_pricing_mode IN ('CONVERT_FROM_BASE', 'PRICE_LIST')),
  CONSTRAINT chk_orgcur_max_age   CHECK (rate_max_age_days IS NULL OR rate_max_age_days > 0),
  CONSTRAINT chk_orgcur_tolerance CHECK (manual_rate_tolerance_pct IS NULL OR manual_rate_tolerance_pct >= 0),
  CONSTRAINT chk_orgcur_base_ok   CHECK (NOT is_base_currency
                                         OR (is_active AND rec_status = 1 AND allow_sales
                                             AND allow_payments AND allow_cash AND allow_ar)),
  CONSTRAINT chk_orgcur_roles     CHECK (NOT (is_base_currency AND is_reporting_currency)),
  CONSTRAINT chk_orgcur_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- Exactly one active base per tenant (at most one here; "at least one" is the
-- backfill + bridge trigger + resolver fail-loud behavior).
CREATE UNIQUE INDEX IF NOT EXISTS uq_orgcur_one_base
  ON public.org_currency_cf (tenant_org_id)
  WHERE is_base_currency AND rec_status = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orgcur_one_reporting
  ON public.org_currency_cf (tenant_org_id)
  WHERE is_reporting_currency AND rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_orgcur_tenant_active ON public.org_currency_cf (tenant_org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orgcur_tenant_status ON public.org_currency_cf (tenant_org_id, rec_status);

ALTER TABLE public.org_currency_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_orgcur_tenant ON public.org_currency_cf;
CREATE POLICY pol_orgcur_tenant ON public.org_currency_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_currency_cf IS
  'Tenant currency authority (Tenant_Currency_FX plan 01 §4). One row per tenant × currency: exactly one active base (functional) currency, optional reporting currency, and foreign currencies with per-context permissions and FX defaults. Replaces the legacy TENANT_CURRENCY / BRANCH_CURRENCY / TENANT_DECIMAL_PLACES settings; org_tenants_mst.currency is a trigger-synced mirror of the base row. Decimals come from sys_currency_cd.minor_unit, never from here.';
COMMENT ON COLUMN public.org_currency_cf.currency_code IS 'FK sys_currency_cd. No default (locale rule). Must be active and platform-enabled when added (service-enforced).';
COMMENT ON COLUMN public.org_currency_cf.is_base_currency IS 'TRUE for the tenant''s base = functional currency. Exactly one active per tenant. Locked once the tenant has orders (trigger trg_orgcur_base_lock).';
COMMENT ON COLUMN public.org_currency_cf.base_locked_at IS 'Informational: when the base currency became locked (first order). The lock itself is enforced by trg_orgcur_base_lock from order existence, not from this column.';
COMMENT ON COLUMN public.org_currency_cf.is_reporting_currency IS 'Optional reporting currency different from base. At most one per tenant. Unset = report in base.';
COMMENT ON COLUMN public.org_currency_cf.allow_sales IS 'Orders / invoices / price display may be in this currency.';
COMMENT ON COLUMN public.org_currency_cf.allow_payments IS 'Non-cash tenders (card, bank, link) may be in this currency.';
COMMENT ON COLUMN public.org_currency_cf.allow_cash IS 'Cash drawers may be created in this currency (foreign cash = a drawer in that currency, CLF P12).';
COMMENT ON COLUMN public.org_currency_cf.allow_ar IS 'B2B invoices / statements may be in this currency.';
COMMENT ON COLUMN public.org_currency_cf.allow_wallet IS 'Reserved: customer wallet balances in this currency. Service rejects TRUE for a foreign currency until the wallet module is multi-currency ready (C10).';
COMMENT ON COLUMN public.org_currency_cf.allow_gift_card IS 'Reserved: gift cards in this currency (not ready, C10).';
COMMENT ON COLUMN public.org_currency_cf.allow_customer_advance IS 'Reserved: customer advances in this currency (not ready, C10).';
COMMENT ON COLUMN public.org_currency_cf.allow_purchasing IS 'Reserved: AP invoices / POs in this currency (not ready, C10).';
COMMENT ON COLUMN public.org_currency_cf.sales_pricing_mode IS 'CONVERT_FROM_BASE: base price × resolved rate, rounded by the currency''s FX_CONVERSION rule, rate shown inline. PRICE_LIST reserved.';
COMMENT ON COLUMN public.org_currency_cf.default_rate_type_code IS 'Rate type used for this currency when none is requested (FK sys_fx_rate_type_cd). NULL = tenant default.';
COMMENT ON COLUMN public.org_currency_cf.default_rate_source_code IS 'Preferred publisher (FK sys_exchange_rate_source_cd). NULL = precedence by display_order.';
COMMENT ON COLUMN public.org_currency_cf.rate_max_age_days IS 'Override of the rate type''s staleness window. NULL = rate type default.';
COMMENT ON COLUMN public.org_currency_cf.allow_manual_fx_rate IS 'Whether users may type a rate on a document in this currency.';
COMMENT ON COLUMN public.org_currency_cf.manual_fx_requires_approval IS 'Whether a manually typed rate needs approval.';
COMMENT ON COLUMN public.org_currency_cf.manual_rate_tolerance_pct IS 'Maximum % a manual rate may deviate from the resolved reference rate. NULL = no check.';
COMMENT ON COLUMN public.org_currency_cf.tax_rate_source_code IS 'Publisher required for converting tax documents (e.g. central_bank). Enforced when documents are wired (stage 5G).';

-- ── 2. org_fin_fx_stng_cf ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_fin_fx_stng_cf (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id            UUID NOT NULL,
  resolution_policy        TEXT NOT NULL DEFAULT 'TENANT_THEN_HQ',
  default_rate_type_code   TEXT,
  auto_approve_imports     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status               SMALLINT NOT NULL DEFAULT 1,
  rec_notes                TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by               TEXT,
  created_info             TEXT,
  updated_at               TIMESTAMPTZ,
  updated_by               TEXT,
  updated_info             TEXT,
  CONSTRAINT uq_offs_tenant      UNIQUE (tenant_org_id),
  CONSTRAINT fk_offs_tenant      FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_offs_rate_type   FOREIGN KEY (default_rate_type_code) REFERENCES public.sys_fx_rate_type_cd(code),
  CONSTRAINT chk_offs_policy     CHECK (resolution_policy IN ('TENANT_THEN_HQ', 'TENANT_ONLY', 'HQ_ONLY')),
  CONSTRAINT chk_offs_rec_status CHECK (rec_status IN (0, 1, 2))
);

ALTER TABLE public.org_fin_fx_stng_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_offs_tenant ON public.org_fin_fx_stng_cf;
CREATE POLICY pol_offs_tenant ON public.org_fin_fx_stng_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_fin_fx_stng_cf IS
  'Tenant-wide FX policy (Tenant_Currency_FX plan 01 §5). One row per tenant; ships with zero rows — no row means defaults (TENANT_THEN_HQ, SPOT, imports land as drafts). Per-currency overrides live on org_currency_cf.';
COMMENT ON COLUMN public.org_fin_fx_stng_cf.resolution_policy IS 'TENANT_THEN_HQ: tenant approved rate, else HQ approved rate. TENANT_ONLY: never fall back to HQ. HQ_ONLY: always use HQ rates.';
COMMENT ON COLUMN public.org_fin_fx_stng_cf.auto_approve_imports IS 'When TRUE, imported rates land APPROVED if the importing user holds fx_rates:approve; otherwise DRAFT.';

-- ── 3. Triggers ──────────────────────────────────────────────────────────────

-- 3a. Base lock (C6): once a tenant has orders, the base row cannot change
--     currency, stop being base, be deactivated, and no other row can become
--     base. The check reads order existence directly, so it cannot be skipped
--     by a missing stamp.
CREATE OR REPLACE FUNCTION public.fn_orgcur_base_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_changes_base BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changes_base := NEW.is_base_currency
      AND EXISTS (SELECT 1 FROM public.org_currency_cf c
                   WHERE c.tenant_org_id = NEW.tenant_org_id
                     AND c.is_base_currency AND c.rec_status = 1);
  ELSE
    v_changes_base :=
         (OLD.is_base_currency AND (NOT NEW.is_base_currency
                                    OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
                                    OR NOT NEW.is_active
                                    OR NEW.rec_status <> 1))
      OR (NOT OLD.is_base_currency AND NEW.is_base_currency);
  END IF;

  IF v_changes_base
     AND EXISTS (SELECT 1 FROM public.org_orders_mst o WHERE o.tenant_org_id = NEW.tenant_org_id) THEN
    RAISE EXCEPTION 'BASE_CURRENCY_LOCKED: tenant % already has orders; the base currency cannot be changed', NEW.tenant_org_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orgcur_base_lock ON public.org_currency_cf;
CREATE TRIGGER trg_orgcur_base_lock
  BEFORE INSERT OR UPDATE ON public.org_currency_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_orgcur_base_lock();

-- 3b. Mirror: the active base row is copied to org_tenants_mst.currency.
CREATE OR REPLACE FUNCTION public.fn_orgcur_mirror_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY DEFINER: the cross-table write must not be silently filtered by the
-- invoking user's RLS (0 rows updated = drift). Scope is fixed to this row's tenant.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_base_currency AND NEW.rec_status = 1 THEN
    UPDATE public.org_tenants_mst t
       SET currency = NEW.currency_code
     WHERE t.id = NEW.tenant_org_id
       AND t.currency IS DISTINCT FROM NEW.currency_code;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orgcur_sync_tenant_ccy ON public.org_currency_cf;
CREATE TRIGGER trg_orgcur_sync_tenant_ccy
  AFTER INSERT OR UPDATE OF currency_code, is_base_currency, rec_status ON public.org_currency_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_orgcur_mirror_tenant();

-- 3c. Bridge for legacy writers until L2 / HQ 4E: a tenant row's currency
--     creates the base row if missing, or updates it (subject to 3a's lock).
--     No loop: 3b only writes when the value differs, and this function only
--     writes when the base row differs.
CREATE OR REPLACE FUNCTION public.fn_tenant_ccy_to_orgcur()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY DEFINER: the cross-table write must not be silently filtered by the
-- invoking user's RLS (0 rows updated = drift). Scope is fixed to this row's tenant.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code TEXT := NULLIF(UPPER(TRIM(NEW.currency)), '');
BEGIN
  IF v_code IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.org_currency_cf c
                  WHERE c.tenant_org_id = NEW.id AND c.is_base_currency AND c.rec_status = 1) THEN
    INSERT INTO public.org_currency_cf
      (tenant_org_id, currency_code, is_base_currency,
       allow_sales, allow_payments, allow_cash, allow_ar,
       created_by, created_info, metadata)
    VALUES
      (NEW.id, v_code, TRUE, TRUE, TRUE, TRUE, TRUE,
       'SYSTEM', 'trg_tenant_ccy_to_orgcur', '{"seed_source":"TENANT_CURRENCY_BRIDGE"}'::JSONB)
    ON CONFLICT (tenant_org_id, currency_code) DO UPDATE
      SET is_base_currency = TRUE,
          is_reporting_currency = FALSE,
          is_active = TRUE,
          rec_status = 1,
          allow_sales = TRUE, allow_payments = TRUE, allow_cash = TRUE, allow_ar = TRUE,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'SYSTEM',
          updated_info = 'trg_tenant_ccy_to_orgcur';
  ELSE
    UPDATE public.org_currency_cf c
       SET currency_code = v_code,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = 'SYSTEM',
           updated_info = 'trg_tenant_ccy_to_orgcur'
     WHERE c.tenant_org_id = NEW.id
       AND c.is_base_currency AND c.rec_status = 1
       AND c.currency_code IS DISTINCT FROM v_code;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_ccy_to_orgcur ON public.org_tenants_mst;
CREATE TRIGGER trg_tenant_ccy_to_orgcur
  AFTER INSERT OR UPDATE OF currency ON public.org_tenants_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_ccy_to_orgcur();

COMMENT ON FUNCTION public.fn_orgcur_base_lock() IS 'C6: rejects any base-currency change for a tenant that has orders (BASE_CURRENCY_LOCKED).';
COMMENT ON FUNCTION public.fn_orgcur_mirror_tenant() IS 'Keeps org_tenants_mst.currency equal to the active base row of org_currency_cf.';
COMMENT ON FUNCTION public.fn_tenant_ccy_to_orgcur() IS 'Bridge for legacy writers of org_tenants_mst.currency until tenant L2 / HQ 4E write org_currency_cf directly. Remove once no legacy writer remains.';

-- ── 4. Backfill (L1) ─────────────────────────────────────────────────────────

-- 4a. Base row per tenant: resolved TENANT_CURRENCY, else org_tenants_mst.currency.
INSERT INTO public.org_currency_cf
  (tenant_org_id, currency_code, is_base_currency, base_locked_at,
   allow_sales, allow_payments, allow_cash, allow_ar,
   created_by, created_info, metadata)
SELECT
  src.tenant_org_id,
  src.code,
  TRUE,
  CASE WHEN EXISTS (SELECT 1 FROM public.org_orders_mst o WHERE o.tenant_org_id = src.tenant_org_id)
       THEN CURRENT_TIMESTAMP END,
  TRUE, TRUE, TRUE, TRUE,
  'MIGRATION', '0532_org_currency_cf',
  jsonb_build_object('seed_source', 'LEGACY_TENANT_CURRENCY', 'resolved_from', src.origin)
FROM (
  SELECT t.id AS tenant_org_id,
         COALESCE(UPPER(NULLIF(TRIM(r.code), '')), UPPER(NULLIF(TRIM(t.currency), ''))) AS code,
         CASE WHEN NULLIF(TRIM(r.code), '') IS NOT NULL THEN 'TENANT_CURRENCY_SETTING'
              ELSE 'ORG_TENANTS_MST_CURRENCY' END AS origin
    FROM public.org_tenants_mst t
    LEFT JOIN LATERAL (
      SELECT s.stng_value_jsonb #>> '{}' AS code
        FROM fn_stng_resolve_all_settings(t.id) s
       WHERE s.stng_code = 'TENANT_CURRENCY'
    ) r ON TRUE
) src
JOIN public.sys_currency_cd c ON c.code = src.code
WHERE src.code IS NOT NULL
ON CONFLICT (tenant_org_id, currency_code) DO NOTHING;

-- 4b. Every other currency already used by the tenant (contexts off) so
--     history and the drawer FK below stay valid.
INSERT INTO public.org_currency_cf
  (tenant_org_id, currency_code, is_base_currency, created_by, created_info, metadata)
SELECT DISTINCT u.tenant_org_id, UPPER(TRIM(u.currency_code)), FALSE,
       'MIGRATION', '0532_org_currency_cf', '{"seed_source":"LEGACY_DOCUMENT_CURRENCY"}'::JSONB
FROM (
            SELECT tenant_org_id, currency_code FROM public.org_orders_mst
  UNION ALL SELECT tenant_org_id, currency_code FROM public.org_invoice_mst
  UNION ALL SELECT tenant_org_id, currency_code FROM public.org_fin_vouchers_mst
  UNION ALL SELECT tenant_org_id, currency_code FROM public.org_cash_drawers_mst
  UNION ALL SELECT tenant_org_id, currency_code FROM public.org_cash_drawer_sessions_mst
  UNION ALL SELECT tenant_org_id, currency_code FROM public.org_customer_wallets_mst
  UNION ALL SELECT tenant_org_id, currency_code FROM public.org_gift_cards_mst
) u
JOIN public.sys_currency_cd c ON c.code = UPPER(TRIM(u.currency_code))
WHERE NULLIF(TRIM(u.currency_code), '') IS NOT NULL
ON CONFLICT (tenant_org_id, currency_code) DO NOTHING;

-- 4c. Report tenants left without a base row (they fail loudly at runtime,
--     exactly as an unconfigured tenant does today).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.id, t.name FROM public.org_tenants_mst t
     WHERE NOT EXISTS (SELECT 1 FROM public.org_currency_cf c
                        WHERE c.tenant_org_id = t.id AND c.is_base_currency AND c.rec_status = 1)
  LOOP
    RAISE NOTICE '0532: tenant % (%) has no base currency — set it before money operations', r.id, r.name;
  END LOOP;
END
$$;

-- ── 5. Drawer currency must be a tenant currency (C5) ────────────────────────

ALTER TABLE public.org_cash_drawers_mst
  DROP CONSTRAINT IF EXISTS fk_ocd_tenant_currency;
ALTER TABLE public.org_cash_drawers_mst
  ADD CONSTRAINT fk_ocd_tenant_currency
  FOREIGN KEY (tenant_org_id, currency_code)
  REFERENCES public.org_currency_cf (tenant_org_id, currency_code)
  NOT VALID;
ALTER TABLE public.org_cash_drawers_mst
  VALIDATE CONSTRAINT fk_ocd_tenant_currency;

COMMENT ON CONSTRAINT fk_ocd_tenant_currency ON public.org_cash_drawers_mst IS
  'C5: a drawer''s currency must be one of the tenant''s currencies (org_currency_cf). Whether cash is allowed in it (allow_cash) is checked by the drawer service.';

COMMIT;
