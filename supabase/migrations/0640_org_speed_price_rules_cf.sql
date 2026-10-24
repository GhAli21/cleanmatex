-- =============================================================================
-- 0640_org_speed_price_rules_cf.sql
-- Line-Level Money Snapshot — Phase 2, M2 (PLAN.md §6.6, §12, §12.1 L20).
--
-- Why:
-- Replaces the single product-level express fields (default_express_sell_price,
-- multiplier_express, turnaround_hh_express) with a configurable speed-price
-- rules table. A rule can be scoped at product, category, branch or tenant
-- level (narrowest match wins; the resolver lands in Phase 4/5). This
-- migration only creates the table and backfills one product-level EXPRESS
-- rule per existing active product, reproducing today's prices exactly
-- (L17); it does not read from or write to the old product columns at
-- runtime (M11 drops them after P10 recompute).
--
-- Table: org_speed_price_rules_cf
--   service_speed            FK sys_service_speed_cd(code); never STANDARD
--                             (STANDARD has no premium, so no rule needed).
--   branch_id / service_category_code / product_id
--                             Nullable scope dimensions, narrowest to widest:
--                             product > category > branch > tenant-wide.
--   speed_price_type          SELL_PRICE | MULTIPLIER | FIXED_AMOUNT — which
--                             of the three value columns applies.
--   default_speed_sell_price  SELL_PRICE: the full unit price at this speed
--                             (was org_product_data_mst.default_express_sell_price).
--   multiplier_speed          MULTIPLIER: the added fraction (L20), e.g. 0.30
--                             = +30% over the normal price (was
--                             multiplier_express, which stored a FACTOR
--                             1.00-2.00; converted here by subtracting 1).
--                             NUMERIC(6,4), wider than the old NUMERIC(4,2),
--                             so every existing value fits and finer
--                             fractions like 0.125 become possible.
--   speed_extra_amount        FIXED_AMOUNT: a flat amount added per unit or
--                             per line (price_basis says which). Unused by
--                             today's backfill; available for new rules.
--   turnaround_hh_speed       Hours at this speed (was turnaround_hh_express).
--                             NUMERIC(6,2), wider than NUMERIC(4,2), so
--                             turnarounds over 99 hours fit.
--
-- Exactly one of the three value columns is set, matching speed_price_type
-- (CHECK). Soft-delete only: a rule referenced by a priced line is never hard
-- deleted (ON DELETE RESTRICT is implied — there is no FK *from* order lines
-- to this table yet; M5 will add it). RLS scopes every row to its tenant.
--
-- Price-history audit: the plan calls for a row in org_price_history_audit
-- (entity_type = 'speed_rule') whenever a rule is edited. That table's
-- entity_type CHECK currently allows only 'price_list_item' and
-- 'product_default' (lowercase, DB-mirror convention) — this migration does
-- not touch it, because no code writes speed-rule audit rows yet. The CHECK
-- widening (lowercase 'speed_rule', matching the existing values' case) is
-- deferred to the migration that ships the Phase 7 rules UI/service, which
-- is the first and only writer.
--
-- Rollback (forward-only): DROP TABLE org_speed_price_rules_cf RESTRICT (no
-- dependents yet).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_speed_price_rules_cf (
  id                        UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id             UUID NOT NULL,

  -- scope
  service_speed             TEXT NOT NULL,
  branch_id                 UUID,
  service_category_code     TEXT,
  product_id                UUID,

  -- pricing method
  speed_price_type          TEXT NOT NULL,
  default_speed_sell_price  DECIMAL(19,4),
  multiplier_speed          NUMERIC(6,4),
  speed_extra_amount        DECIMAL(19,4),
  price_basis               TEXT,

  -- fulfilment
  turnaround_hh_speed       NUMERIC(6,2),

  -- label + validity
  name                      TEXT,
  name2                     TEXT,
  effective_from            DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to              DATE,

  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  rec_order                 INTEGER,
  rec_notes                 TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                TEXT,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                TEXT,
  updated_info              TEXT,

  CONSTRAINT pk_org_spd_price_rules PRIMARY KEY (id),
  -- Full unique on (tenant_org_id, id) so composite child FKs (M5, order
  -- lines -> the rule applied) can target this table (Prisma-safe pattern).
  CONSTRAINT uq_org_spd_price_rules_tenant_id UNIQUE (tenant_org_id, id),

  CONSTRAINT fk_org_spd_price_rules_tenant
    FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_spd_price_rules_speed
    FOREIGN KEY (service_speed) REFERENCES public.sys_service_speed_cd(code),
  CONSTRAINT fk_org_spd_price_rules_branch
    FOREIGN KEY (branch_id, tenant_org_id) REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL (branch_id),
  CONSTRAINT fk_org_spd_price_rules_product
    FOREIGN KEY (product_id, tenant_org_id) REFERENCES public.org_product_data_mst(id, tenant_org_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_org_spd_price_rules_speed_not_standard
    CHECK (service_speed <> 'STANDARD'),
  CONSTRAINT chk_org_spd_price_rules_type
    CHECK (speed_price_type IN ('SELL_PRICE', 'MULTIPLIER', 'FIXED_AMOUNT')),
  CONSTRAINT chk_org_spd_price_rules_basis
    CHECK (price_basis IS NULL OR price_basis IN ('PER_UNIT', 'PER_LINE')),
  CONSTRAINT chk_org_spd_price_rules_basis_scope
    CHECK (price_basis IS NULL OR speed_price_type = 'FIXED_AMOUNT'),
  -- Exactly the value column of the chosen speed_price_type is set; the
  -- other two stay NULL (PLAN §6.6).
  CONSTRAINT chk_org_spd_price_rules_value_cols
    CHECK (
      (speed_price_type = 'SELL_PRICE'
        AND default_speed_sell_price IS NOT NULL
        AND multiplier_speed IS NULL
        AND speed_extra_amount IS NULL)
      OR (speed_price_type = 'MULTIPLIER'
        AND multiplier_speed IS NOT NULL
        AND default_speed_sell_price IS NULL
        AND speed_extra_amount IS NULL)
      OR (speed_price_type = 'FIXED_AMOUNT'
        AND speed_extra_amount IS NOT NULL
        AND default_speed_sell_price IS NULL
        AND multiplier_speed IS NULL)
    ),
  CONSTRAINT chk_org_spd_price_rules_sell_price_nonneg
    CHECK (default_speed_sell_price IS NULL OR default_speed_sell_price >= 0),
  CONSTRAINT chk_org_spd_price_rules_multiplier_nonneg
    CHECK (multiplier_speed IS NULL OR multiplier_speed >= 0),
  CONSTRAINT chk_org_spd_price_rules_extra_nonneg
    CHECK (speed_extra_amount IS NULL OR speed_extra_amount >= 0),
  CONSTRAINT chk_org_spd_price_rules_turnaround_nonneg
    CHECK (turnaround_hh_speed IS NULL OR turnaround_hh_speed >= 0),
  CONSTRAINT chk_org_spd_price_rules_dates
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT chk_org_spd_price_rules_rec_status
    CHECK (rec_status IN (0, 1, 2)),

  -- One rule per exact scope combination per effective start date. NULLS NOT
  -- DISTINCT so two tenant-wide (branch/category/product all NULL) rules for
  -- the same speed and start date collide instead of silently coexisting.
  CONSTRAINT uq_org_spd_price_rules_scope
    UNIQUE NULLS NOT DISTINCT (tenant_org_id, service_speed, branch_id, service_category_code, product_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_org_spd_price_rules_lookup
  ON public.org_speed_price_rules_cf (tenant_org_id, service_speed, is_active);

CREATE INDEX IF NOT EXISTS idx_org_spd_price_rules_product
  ON public.org_speed_price_rules_cf (tenant_org_id, product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.org_speed_price_rules_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_org_spd_price_rules_tenant ON public.org_speed_price_rules_cf;
CREATE POLICY pol_org_spd_price_rules_tenant ON public.org_speed_price_rules_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_speed_price_rules_cf IS
  'Line-Level Money Snapshot (PLAN.md §6.6): configurable speed-price rules (today only EXPRESS), scoped to tenant/branch/category/product. Replaces org_product_data_mst.default_express_sell_price / multiplier_express / turnaround_hh_express, which are dropped in M11 after the Phase 10 recompute. Narrowest scope match wins at resolve time (Phase 4/5).';
COMMENT ON COLUMN public.org_speed_price_rules_cf.service_speed IS 'FK sys_service_speed_cd. Never STANDARD (the base speed carries no rule).';
COMMENT ON COLUMN public.org_speed_price_rules_cf.branch_id IS 'Optional branch scope. NULL = all branches. Detached (set NULL) if the branch is removed; the rule itself survives.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.service_category_code IS 'Optional org_product_data_mst.service_category_code value. Free text, no FK (the source column has none either).';
COMMENT ON COLUMN public.org_speed_price_rules_cf.product_id IS 'Optional single-product scope. NULL = applies to every product in the narrower-unscoped category/branch/tenant combination. Cascades if the product is deleted.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.speed_price_type IS 'SELL_PRICE (a full replacement unit price), MULTIPLIER (an added fraction over the normal price, L20), or FIXED_AMOUNT (a flat amount added per unit or line).';
COMMENT ON COLUMN public.org_speed_price_rules_cf.default_speed_sell_price IS 'SELL_PRICE only: the unit price at this speed. Was org_product_data_mst.default_express_sell_price.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.multiplier_speed IS 'MULTIPLIER only: the added fraction (0.30 = +30%). Was org_product_data_mst.multiplier_express, which stored a factor (1.00-2.00); converted by subtracting 1 in this migration''s backfill.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.speed_extra_amount IS 'FIXED_AMOUNT only: a flat amount added per unit or per line (see price_basis). Not used by today''s backfill.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.price_basis IS 'PER_UNIT or PER_LINE, meaningful only when speed_price_type = FIXED_AMOUNT.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.turnaround_hh_speed IS 'Hours at this speed. Was org_product_data_mst.turnaround_hh_express.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.name IS 'Optional English label shown in the rules admin screen (Phase 7).';
COMMENT ON COLUMN public.org_speed_price_rules_cf.name2 IS 'Optional Arabic label.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.effective_from IS 'Date this rule starts applying. Part of the scope uniqueness key, so a new dated version can be added without replacing the old one.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.effective_to IS 'Date this rule stops applying, or NULL while open-ended.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.is_active IS 'Soft-disable: excluded from resolution, kept for history.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.rec_status IS 'Standard soft-delete status (1 = active record).';

-- ------------------------------------------------------------------
-- Backfill (L17): one product-level EXPRESS rule per active product,
-- reproducing today's price exactly.
--   default_express_sell_price > 0  -> SELL_PRICE at that price
--   otherwise                       -> MULTIPLIER, multiplier_express - 1
--                                      (NULL multiplier_express treated as 0)
-- turnaround_hh_speed copies turnaround_hh_express in both cases.
-- Verified against the remote DB before writing this migration: 127 active
-- products, 95 take the SELL_PRICE branch, 32 take MULTIPLIER (30 at factor
-- 1.00, 2 NULL) -> all 32 become multiplier_speed = 0, matching "express
-- price = normal price" for those products today.
-- ------------------------------------------------------------------
INSERT INTO public.org_speed_price_rules_cf (
  tenant_org_id, service_speed, product_id,
  speed_price_type, default_speed_sell_price, multiplier_speed,
  turnaround_hh_speed, effective_from, created_by, created_info
)
SELECT
  p.tenant_org_id,
  'EXPRESS',
  p.id,
  CASE WHEN p.default_express_sell_price IS NOT NULL AND p.default_express_sell_price > 0
    THEN 'SELL_PRICE' ELSE 'MULTIPLIER' END,
  CASE WHEN p.default_express_sell_price IS NOT NULL AND p.default_express_sell_price > 0
    THEN p.default_express_sell_price ELSE NULL END,
  CASE WHEN p.default_express_sell_price IS NOT NULL AND p.default_express_sell_price > 0
    THEN NULL ELSE COALESCE(p.multiplier_express, 1) - 1 END,
  p.turnaround_hh_express,
  CURRENT_DATE,
  NULL,
  'Backfilled from org_product_data_mst express fields by migration 0640 (L17)'
FROM public.org_product_data_mst p
WHERE p.rec_status = 1
ON CONFLICT ON CONSTRAINT uq_org_spd_price_rules_scope DO NOTHING;

COMMIT;
