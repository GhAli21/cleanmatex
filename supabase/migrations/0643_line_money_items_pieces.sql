-- =============================================================================
-- 0643_line_money_items_pieces.sql
-- Line-Level Money Snapshot — Phase 3, M5 (PLAN.md §6.1, §13/§15 staging
-- note, ADR-060 §4).
--
-- Why: gives items and pieces the identical set of line-money columns
-- ADR-060 needs (money basis, speed, price source and components, discount
-- shares, tax per line), additive only. Every new column is NULLABLE here --
-- NOT NULL plus the I5 CHECK land in M10, after the Phase 10 recompute backs
-- every existing row with real values (PLAN.md §6, intro note). Phase 4's
-- calculator and Phase 5/6's writers are the first code to populate them;
-- this migration changes no figure and nothing reads these columns yet.
--
-- Also widens org_order_items_dtl.price_per_unit / total_price from
-- NUMERIC(10,3) to DECIMAL(19,4) -- the project money standard, and the
-- scale org_order_item_pieces_dtl and every charge table already use
-- (PF-23). A pure widen: every existing value is representable unchanged
-- (verified against the remote DB: min 1.500, max 44.000).
--
-- Composite-FK prerequisite: org_tax_profiles_cf and org_price_lists_mst
-- have no (tenant_org_id, id) unique yet (only a plain PK(id)), so this
-- migration adds one to each, matching the tenant-first order already used
-- by sibling _cf/_mst tables (org_currency_cf, org_product_data_mst) --
-- required before a Prisma-safe composite FK can target them (/database
-- skill). org_speed_price_rules_cf already has one (M2).
--
-- ready_at (owner addition, 2026-10-24): alongside PLAN.md §6.1's
-- ready_by_at (expected), this migration also adds ready_at (actual) on
-- both tables, mirroring org_orders_mst's existing ready_by / ready_at pair
-- (the on-time SLA check in workflow-service.ts). Not in the plan text;
-- added because the header already proves this exact expected/actual shape
-- is the right one, and because ready_by_at was already landing on these
-- tables -- its actual counterpart is a natural, cheap completion rather
-- than a separate future migration. Nullable; wiring the write (when a
-- line/piece truly becomes ready) is fulfillment-workflow work, not part of
-- this plan's phases.
--
-- Indexes: PLAN.md §6.1 adds (tenant_org_id, service_speed) and
-- (tenant_org_id, tax_category_code) only "if P0-11 shows a reader needs
-- them". No reader exists yet (readers are Phase 8) and P0-11 was never run
-- against a concrete query, so neither index is added here -- adding an
-- unused index on a hot write table is its own cost. Revisit in Phase 8.
--
-- tax_exempt_reason here follows the same choice as org_product_data_mst
-- (M4): not an FK. sys_tax_exempt_reason_cd is keyed by (country, code) and
-- neither items nor pieces carry a country column (resolved via
-- order -> tenant); checked at the service layer instead.
--
-- Rollback (forward-only): drop every column added here (RESTRICT; nothing
-- references them yet), drop the two new FKs's prerequisite uniques, and
-- widening is not reversed (it is lossless).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 0. Composite-FK prerequisites on existing config tables
-- ------------------------------------------------------------------
ALTER TABLE public.org_tax_profiles_cf
  ADD CONSTRAINT uq_org_tax_prof_tenant_id UNIQUE (tenant_org_id, id);

ALTER TABLE public.org_price_lists_mst
  ADD CONSTRAINT uq_org_price_lists_tenant_id UNIQUE (tenant_org_id, id);

-- ------------------------------------------------------------------
-- 1. org_order_items_dtl — widen existing money columns
-- ------------------------------------------------------------------
ALTER TABLE public.org_order_items_dtl
  ALTER COLUMN price_per_unit TYPE DECIMAL(19,4),
  ALTER COLUMN total_price    TYPE DECIMAL(19,4);

-- ------------------------------------------------------------------
-- 2. org_order_items_dtl — new line-money columns (PLAN.md §6.1)
-- ------------------------------------------------------------------
ALTER TABLE public.org_order_items_dtl
  ADD COLUMN IF NOT EXISTS money_basis               TEXT,
  ADD COLUMN IF NOT EXISTS service_speed              TEXT,
  ADD COLUMN IF NOT EXISTS ready_by_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_source               TEXT,
  ADD COLUMN IF NOT EXISTS price_list_id              UUID,
  ADD COLUMN IF NOT EXISTS speed_rule_id              UUID,
  ADD COLUMN IF NOT EXISTS list_unit_price            DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS speed_premium_amount       DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS line_disc_amount           DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS order_disc_alloc_amount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS net_amount                 DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS tax_pricing_mode           TEXT,
  ADD COLUMN IF NOT EXISTS tax_profile_id             UUID,
  ADD COLUMN IF NOT EXISTS tax_category_code          TEXT,
  ADD COLUMN IF NOT EXISTS tax_exempt_reason          TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate                   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS taxable_amount             DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS tax_amount                 DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS line_total_amount          DECIMAL(19,4);

ALTER TABLE public.org_order_items_dtl
  ADD CONSTRAINT chk_oid_money_basis
    CHECK (money_basis IS NULL OR money_basis IN ('PRICED', 'ALLOCATED', 'ROLLUP')),
  ADD CONSTRAINT chk_oid_price_source
    CHECK (price_source IS NULL OR price_source IN ('PRICE_LIST', 'PRODUCT_DEFAULT', 'CUSTOMER_PRICE', 'SPEED_RULE', 'MANUAL')),
  ADD CONSTRAINT chk_oid_tax_pricing_mode
    CHECK (tax_pricing_mode IS NULL OR tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT fk_oid_service_speed
    FOREIGN KEY (service_speed) REFERENCES public.sys_service_speed_cd(code),
  ADD CONSTRAINT fk_oid_tax_category
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  ADD CONSTRAINT fk_oid_price_list
    FOREIGN KEY (tenant_org_id, price_list_id) REFERENCES public.org_price_lists_mst(tenant_org_id, id),
  ADD CONSTRAINT fk_oid_speed_rule
    FOREIGN KEY (tenant_org_id, speed_rule_id) REFERENCES public.org_speed_price_rules_cf(tenant_org_id, id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_oid_tax_profile
    FOREIGN KEY (tenant_org_id, tax_profile_id) REFERENCES public.org_tax_profiles_cf(tenant_org_id, id);

COMMENT ON COLUMN public.org_order_items_dtl.money_basis IS 'PRICED (this row carries the real price) / ALLOCATED (split from the other level) / ROLLUP (summed from the other level). Decided by the order''s commercial_level (PLAN.md §5.1). NULL until the Phase 10 recompute backfills it; NOT NULL from M10.';
COMMENT ON COLUMN public.org_order_items_dtl.service_speed IS 'FK sys_service_speed_cd. The speed this line was priced at.';
COMMENT ON COLUMN public.org_order_items_dtl.ready_by_at IS 'This line''s own promised ready time, from the resolved turnaround at its speed. Set once by the calculator at creation (or recompute) -- never by the fulfillment workflow.';
COMMENT ON COLUMN public.org_order_items_dtl.ready_at IS 'This line''s own real ready time, mirroring org_orders_mst.ready_by / ready_at (used for on-time SLA in workflow-service.ts). Set by the fulfillment workflow when this line actually becomes ready -- never by the calculator. Wiring that write is not part of this plan''s phases; added here, alongside ready_by_at, so a future per-line SLA does not need its own migration. TIMESTAMPTZ (not the header''s legacy TIMESTAMP, matching every other new column in this migration).';
COMMENT ON COLUMN public.org_order_items_dtl.price_source IS 'Which price this line resolved to: a price list, the product default, a customer-specific price, a speed rule, or a manual override.';
COMMENT ON COLUMN public.org_order_items_dtl.price_list_id IS 'The price list used to price this line, if price_source = PRICE_LIST. Composite FK (tenant_org_id, id) on org_price_lists_mst.';
COMMENT ON COLUMN public.org_order_items_dtl.speed_rule_id IS 'The org_speed_price_rules_cf row used to price this line''s speed premium. ON DELETE RESTRICT: a rule in use can never be hard-deleted (soft-disable instead).';
COMMENT ON COLUMN public.org_order_items_dtl.list_unit_price IS 'The standard catalog unit price before any speed premium, override or discount (PLAN.md §8.1 step 1).';
COMMENT ON COLUMN public.org_order_items_dtl.speed_premium_amount IS 'The speed premium folded into price_per_unit (L2: never a separate charge). 0 at STANDARD speed.';
COMMENT ON COLUMN public.org_order_items_dtl.line_disc_amount IS 'Sum of this line''s own line-level discounts (price-list discount, manual line discount), source PRICE_LIST / MANUAL / PROMO per the discount rows.';
COMMENT ON COLUMN public.org_order_items_dtl.order_disc_alloc_amount IS 'This line''s share of an ORDER-level discount. 0 under disc_alloc_mode = DOCUMENT_LEVEL (today''s behaviour).';
COMMENT ON COLUMN public.org_order_items_dtl.net_amount IS 'total_price - line_disc_amount - order_disc_alloc_amount (I5).';
COMMENT ON COLUMN public.org_order_items_dtl.tax_pricing_mode IS 'The order''s tax_pricing_mode, copied onto every line (I6) so a line is self-describing without joining the order.';
COMMENT ON COLUMN public.org_order_items_dtl.tax_profile_id IS 'The org_tax_profiles_cf row applied to this line. Composite FK (tenant_org_id, id).';
COMMENT ON COLUMN public.org_order_items_dtl.tax_category_code IS 'FK sys_tax_category_cd. This line''s tax-base category at the time it was priced (a product''s tax_category_code can change later; the line keeps what applied then).';
COMMENT ON COLUMN public.org_order_items_dtl.tax_exempt_reason IS 'Reason code for a non-STANDARD tax_category_code (constants, P0-10). Not an FK: sys_tax_exempt_reason_cd is keyed by country, which this row does not carry (resolved via order -> tenant); checked at the service layer.';
COMMENT ON COLUMN public.org_order_items_dtl.tax_rate IS 'The combined tax rate applied, as a percentage (same convention as org_order_taxes_dtl.rate, e.g. 15.00 for 15%).';
COMMENT ON COLUMN public.org_order_items_dtl.taxable_amount IS 'The base this line''s tax was computed on.';
COMMENT ON COLUMN public.org_order_items_dtl.tax_amount IS 'This line''s own tax amount.';
COMMENT ON COLUMN public.org_order_items_dtl.line_total_amount IS 'net_amount + tax_amount (tax-exclusive) or net_amount (tax-inclusive) (I5).';

-- ------------------------------------------------------------------
-- 3. org_order_item_pieces_dtl — identical new columns (price_per_unit /
--    total_price are already DECIMAL(19,4); no widen needed here)
-- ------------------------------------------------------------------
ALTER TABLE public.org_order_item_pieces_dtl
  ADD COLUMN IF NOT EXISTS money_basis               TEXT,
  ADD COLUMN IF NOT EXISTS service_speed              TEXT,
  ADD COLUMN IF NOT EXISTS ready_by_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_source               TEXT,
  ADD COLUMN IF NOT EXISTS price_list_id              UUID,
  ADD COLUMN IF NOT EXISTS speed_rule_id              UUID,
  ADD COLUMN IF NOT EXISTS list_unit_price            DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS speed_premium_amount       DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS line_disc_amount           DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS order_disc_alloc_amount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS net_amount                 DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS tax_pricing_mode           TEXT,
  ADD COLUMN IF NOT EXISTS tax_profile_id             UUID,
  ADD COLUMN IF NOT EXISTS tax_category_code          TEXT,
  ADD COLUMN IF NOT EXISTS tax_exempt_reason          TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate                   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS taxable_amount             DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS tax_amount                 DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS line_total_amount          DECIMAL(19,4);

ALTER TABLE public.org_order_item_pieces_dtl
  ADD CONSTRAINT chk_opd_money_basis
    CHECK (money_basis IS NULL OR money_basis IN ('PRICED', 'ALLOCATED', 'ROLLUP')),
  ADD CONSTRAINT chk_opd_price_source
    CHECK (price_source IS NULL OR price_source IN ('PRICE_LIST', 'PRODUCT_DEFAULT', 'CUSTOMER_PRICE', 'SPEED_RULE', 'MANUAL')),
  ADD CONSTRAINT chk_opd_tax_pricing_mode
    CHECK (tax_pricing_mode IS NULL OR tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT fk_opd_service_speed
    FOREIGN KEY (service_speed) REFERENCES public.sys_service_speed_cd(code),
  ADD CONSTRAINT fk_opd_tax_category
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  ADD CONSTRAINT fk_opd_price_list
    FOREIGN KEY (tenant_org_id, price_list_id) REFERENCES public.org_price_lists_mst(tenant_org_id, id),
  ADD CONSTRAINT fk_opd_speed_rule
    FOREIGN KEY (tenant_org_id, speed_rule_id) REFERENCES public.org_speed_price_rules_cf(tenant_org_id, id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_opd_tax_profile
    FOREIGN KEY (tenant_org_id, tax_profile_id) REFERENCES public.org_tax_profiles_cf(tenant_org_id, id);

COMMENT ON COLUMN public.org_order_item_pieces_dtl.money_basis IS 'Mirrors org_order_items_dtl.money_basis -- the opposite value under the order''s commercial_level (PRICED on pieces when the item is ROLLUP, and vice versa).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.service_speed IS 'FK sys_service_speed_cd. Copies the item''s speed; may differ only under PIECE level (Phase 9).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.ready_by_at IS 'This piece''s own promised ready time. Set once by the calculator at creation (or recompute) -- never by the fulfillment workflow.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.ready_at IS 'This piece''s own real ready time (same expected/actual pattern as org_order_items_dtl.ready_at, mirroring the order-level ready_by / ready_at SLA pair). Set by the fulfillment workflow -- the same write path that already sets piece_status / is_ready / last_step_at -- never by the calculator. Wiring that write is not part of this plan''s phases.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.price_source IS 'Same meaning as org_order_items_dtl.price_source, at piece level.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.price_list_id IS 'Composite FK (tenant_org_id, id) on org_price_lists_mst.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.speed_rule_id IS 'The org_speed_price_rules_cf row used to price this piece''s speed premium. ON DELETE RESTRICT.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.list_unit_price IS 'Same meaning as org_order_items_dtl.list_unit_price, at piece level.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.speed_premium_amount IS 'Same meaning as org_order_items_dtl.speed_premium_amount, at piece level.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.line_disc_amount IS 'This piece''s own line-level discounts (PLAN.md §8.3: items and pieces have their own line discounts).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.order_disc_alloc_amount IS 'This piece''s share of an ORDER-level discount.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.net_amount IS 'total_price - line_disc_amount - order_disc_alloc_amount (I5), at piece level.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tax_pricing_mode IS 'The order''s tax_pricing_mode, copied onto every piece (I6).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tax_profile_id IS 'Composite FK (tenant_org_id, id) on org_tax_profiles_cf.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tax_category_code IS 'FK sys_tax_category_cd, at piece level.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tax_exempt_reason IS 'Same meaning and the same not-an-FK reasoning as org_order_items_dtl.tax_exempt_reason.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tax_rate IS 'Same convention as org_order_items_dtl.tax_rate (percentage, e.g. 15.00).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.taxable_amount IS 'This piece''s own tax base.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tax_amount IS 'This piece''s own tax amount. Sigma over an item''s pieces must equal the item''s tax_amount under ALLOCATED (I1).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.line_total_amount IS 'net_amount + tax_amount (tax-exclusive) or net_amount (tax-inclusive) (I5), at piece level.';

COMMIT;
