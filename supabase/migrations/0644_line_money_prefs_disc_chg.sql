-- =============================================================================
-- 0644_line_money_prefs_disc_chg.sql
-- Line-Level Money Snapshot — Phase 3, M6 (PLAN.md §5.3, §6.2-6.5, §13/§15
-- staging note, ADR-060 §3-4, Phase 0 outcome C3/C8).
--
-- Why: the header and the three remaining detail tables each need their own
-- new columns so an order's commercial settings, preference pricing,
-- discount lines and charge tax are each fully self-describing, the same
-- posture M5 gave items and pieces. Every new column is NULLABLE (same
-- staging rule as M5: NOT NULL plus CHECKs enforcing required combinations
-- land in M10, after the Phase 10 recompute). No figure changes; nothing
-- reads these columns yet.
--
-- 1. org_orders_mst (§5.3, §6.2): the commercial settings snapshot --
--    commercial_level, tax_pricing_mode, extra_price_pricing_mode,
--    disc_alloc_mode, commercial_calc_version, plus speed_premium_amount
--    (an informational sum, never an addend to the total). Recompute and
--    Edit read these from the order, never from today's tenant setting
--    (rule #15 / PF-07's defect class).
--
--    disc_alloc_basis (owner addition, not in the plan's §5.3 list): the
--    plan snapshots disc_alloc_mode but not disc_alloc_basis, even though
--    both are tenant settings that affect how a historical order's
--    discount was split. Without it, a later Edit/recompute would read
--    *today's* disc_alloc_basis for an old order under ALLOCATE_TO_LINES,
--    exactly the silent-drift class rule #15 and PF-07 exist to close.
--    Added for consistency; flagged here rather than silently deviating
--    from the plan text.
--
--    tax_pricing_mode / extra_price_pricing_mode did not exist on
--    org_orders_mst before this migration (only on org_tenants_mst /
--    org_branches_mst, M3) -- today's only record of the mode used is
--    inside the financial_calculation_snapshot JSON blob
--    (taxPricingModeAtCalculation). This migration gives them a real,
--    queryable column; the JSON path is unaffected.
--
-- 2. org_order_preferences_dtl (§6.3): extra_price_pricing_mode (snapshot),
--    price_basis (PER_LINE only for now -- a single-value CHECK; widening
--    to PER_PIECE or others is a future migration), list_extra_price,
--    is_price_override, bundle_code, bundle_discount_amt,
--    extra_turnaround_min.
--
-- 3. org_order_discounts_dtl (§6.4): discount_level (ORDER/ITEM/PIECE),
--    order_item_id / order_item_piece_id as COMPOSITE FKs (the plan calls
--    for composite here, unlike the plain single-column FKs the older
--    org_order_preferences_dtl uses for the same item/piece reference --
--    honoured as written, since a discount row is a financial audit
--    record and the plan is explicit), with a CHECK matching the level;
--    disc_alloc_mode (snapshot on ORDER rows); tax_category_code (the
--    category split for a DOCUMENT_LEVEL discount spread across categories).
--    ON DELETE RESTRICT on both composite FKs -- a discount audit row must
--    never silently disappear if its item/piece is ever hard-deleted
--    (items/pieces are soft-removed in practice, via deleted_at /
--    deleted_order_change_id, so this should never fire).
--    The gift-card rule (ADR-060 §7, Phase 0 P0-09) needs no new DB guard:
--    discount_type is already CHECK-restricted to PERCENTAGE / FIXED_AMOUNT,
--    so GIFT_CARD could never be written as a discount_type value.
--
-- 4. org_order_charges_dtl (§6.5): tax_category_code, tax_profile_id,
--    tax_rate, taxable_amount, tax_amount. The plan does not mark
--    tax_profile_id composite here (unlike items/pieces in M5), so a plain
--    FK is used, consistent with that distinction.
--
-- Rollback (forward-only): drop every column added here (RESTRICT; nothing
-- references them yet).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. org_orders_mst — commercial settings snapshot (§5.3, §6.2)
-- ------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS commercial_level          TEXT,
  ADD COLUMN IF NOT EXISTS tax_pricing_mode          TEXT,
  ADD COLUMN IF NOT EXISTS extra_price_pricing_mode  TEXT,
  ADD COLUMN IF NOT EXISTS disc_alloc_mode           TEXT,
  ADD COLUMN IF NOT EXISTS disc_alloc_basis          TEXT,
  ADD COLUMN IF NOT EXISTS commercial_calc_version   SMALLINT,
  ADD COLUMN IF NOT EXISTS speed_premium_amount      DECIMAL(19,4);

ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT chk_oom_commercial_level
    CHECK (commercial_level IS NULL OR commercial_level IN ('ITEM', 'PIECE')),
  ADD CONSTRAINT chk_oom_tax_pricing_mode
    CHECK (tax_pricing_mode IS NULL OR tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT chk_oom_extra_price_mode
    CHECK (extra_price_pricing_mode IS NULL OR extra_price_pricing_mode IN ('INCLUDED_IN_ITEM_PRICE', 'SEPARATE_CHARGE')),
  ADD CONSTRAINT chk_oom_disc_alloc_mode
    CHECK (disc_alloc_mode IS NULL OR disc_alloc_mode IN ('ALLOCATE_TO_LINES', 'DOCUMENT_LEVEL')),
  ADD CONSTRAINT chk_oom_disc_alloc_basis
    CHECK (disc_alloc_basis IS NULL OR disc_alloc_basis IN ('PROPORTIONAL_NET', 'PROPORTIONAL_GROSS'));

COMMENT ON COLUMN public.org_orders_mst.commercial_level IS 'Snapshot of org_tenants_mst.commercial_level at order creation (L12: never re-read or changed after). NULL on existing orders until the Phase 10 recompute.';
COMMENT ON COLUMN public.org_orders_mst.tax_pricing_mode IS 'Snapshot of the tax pricing mode (tenant or branch override) used to calculate this order. Previously recorded only inside financial_calculation_snapshot JSON (taxPricingModeAtCalculation); this is now a real column.';
COMMENT ON COLUMN public.org_orders_mst.extra_price_pricing_mode IS 'Snapshot of the extra-price pricing mode used to calculate this order.';
COMMENT ON COLUMN public.org_orders_mst.disc_alloc_mode IS 'Snapshot of org_tenants_mst.disc_alloc_mode at order creation. Edit and recompute use this, never today''s tenant setting (rule #15).';
COMMENT ON COLUMN public.org_orders_mst.disc_alloc_basis IS 'Snapshot of org_tenants_mst.disc_alloc_basis at order creation. Not in the plan''s original §5.3 list; added alongside disc_alloc_mode for the same reason -- see this migration''s header note.';
COMMENT ON COLUMN public.org_orders_mst.commercial_calc_version IS 'The commercial-calculator version that wrote this order (ADR-060 §3), separate from financial_engine_version. Recompute and reconciliation are aware of it.';
COMMENT ON COLUMN public.org_orders_mst.speed_premium_amount IS 'Sum of every line''s speed_premium_amount. Informational only -- it is already folded into line prices (L2) and must never be added again to the order total.';

-- ------------------------------------------------------------------
-- 2. org_order_preferences_dtl — preference pricing (§6.3)
-- ------------------------------------------------------------------
ALTER TABLE public.org_order_preferences_dtl
  ADD COLUMN IF NOT EXISTS extra_price_pricing_mode  TEXT,
  ADD COLUMN IF NOT EXISTS price_basis               TEXT,
  ADD COLUMN IF NOT EXISTS list_extra_price          DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS is_price_override         BOOLEAN,
  ADD COLUMN IF NOT EXISTS bundle_code               TEXT,
  ADD COLUMN IF NOT EXISTS bundle_discount_amt       DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS extra_turnaround_min      INTEGER;

ALTER TABLE public.org_order_preferences_dtl
  ADD CONSTRAINT chk_opr_extra_price_mode
    CHECK (extra_price_pricing_mode IS NULL OR extra_price_pricing_mode IN ('INCLUDED_IN_ITEM_PRICE', 'SEPARATE_CHARGE')),
  ADD CONSTRAINT chk_opr_price_basis
    CHECK (price_basis IS NULL OR price_basis = 'PER_LINE'),
  ADD CONSTRAINT chk_opr_extra_turn_nonneg
    CHECK (extra_turnaround_min IS NULL OR extra_turnaround_min >= 0);

COMMENT ON COLUMN public.org_order_preferences_dtl.extra_price_pricing_mode IS 'Snapshot of the order''s extra-price pricing mode at the time this preference was priced.';
COMMENT ON COLUMN public.org_order_preferences_dtl.price_basis IS 'How this preference''s extra is charged. PER_LINE is the only value today -- the CHECK is deliberately single-valued (PLAN.md §6.3: "PER_LINE only for now") and widens in a future migration if per-piece preference pricing is added.';
COMMENT ON COLUMN public.org_order_preferences_dtl.list_extra_price IS 'The catalog extra price before any override, so extra_price (the actual charged amount) can be compared against it.';
COMMENT ON COLUMN public.org_order_preferences_dtl.is_price_override IS 'TRUE when extra_price was manually set away from list_extra_price.';
COMMENT ON COLUMN public.org_order_preferences_dtl.bundle_code IS 'Optional bundle this preference belongs to (e.g. a packaged deal of several preferences). No catalog table exists yet; forward-looking placeholder.';
COMMENT ON COLUMN public.org_order_preferences_dtl.bundle_discount_amt IS 'Discount applied because this preference is part of bundle_code.';
COMMENT ON COLUMN public.org_order_preferences_dtl.extra_turnaround_min IS 'Extra minutes this preference adds to the line''s ready-by estimate (e.g. special handling).';

-- ------------------------------------------------------------------
-- 3. org_order_discounts_dtl — line-level discounts (§6.4)
-- ------------------------------------------------------------------
ALTER TABLE public.org_order_discounts_dtl
  ADD COLUMN IF NOT EXISTS discount_level       TEXT,
  ADD COLUMN IF NOT EXISTS order_item_id        UUID,
  ADD COLUMN IF NOT EXISTS order_item_piece_id  UUID,
  ADD COLUMN IF NOT EXISTS disc_alloc_mode       TEXT,
  ADD COLUMN IF NOT EXISTS tax_category_code    TEXT;

ALTER TABLE public.org_order_discounts_dtl
  ADD CONSTRAINT chk_ood_discount_level
    CHECK (discount_level IS NULL OR discount_level IN ('ORDER', 'ITEM', 'PIECE')),
  ADD CONSTRAINT chk_ood_level_matches_refs
    CHECK (
      discount_level IS NULL
      OR (discount_level = 'ORDER' AND order_item_id IS NULL AND order_item_piece_id IS NULL)
      OR (discount_level = 'ITEM' AND order_item_id IS NOT NULL AND order_item_piece_id IS NULL)
      OR (discount_level = 'PIECE' AND order_item_piece_id IS NOT NULL)
    ),
  ADD CONSTRAINT chk_ood_disc_alloc_mode
    CHECK (disc_alloc_mode IS NULL OR disc_alloc_mode IN ('ALLOCATE_TO_LINES', 'DOCUMENT_LEVEL')),
  ADD CONSTRAINT fk_ood_tax_category
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  ADD CONSTRAINT fk_ood_item
    FOREIGN KEY (order_item_id, tenant_org_id) REFERENCES public.org_order_items_dtl(id, tenant_org_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ood_piece
    FOREIGN KEY (order_item_piece_id, tenant_org_id) REFERENCES public.org_order_item_pieces_dtl(id, tenant_org_id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN public.org_order_discounts_dtl.discount_level IS 'ORDER, ITEM or PIECE -- which level this discount row applies to. Must match which of order_item_id / order_item_piece_id is set (CHECK).';
COMMENT ON COLUMN public.org_order_discounts_dtl.order_item_id IS 'Set when discount_level = ITEM. Composite FK (id, tenant_org_id) on org_order_items_dtl. ON DELETE RESTRICT: a discount audit row must never silently vanish.';
COMMENT ON COLUMN public.org_order_discounts_dtl.order_item_piece_id IS 'Set when discount_level = PIECE. Composite FK (id, tenant_org_id) on org_order_item_pieces_dtl. ON DELETE RESTRICT.';
COMMENT ON COLUMN public.org_order_discounts_dtl.disc_alloc_mode IS 'Snapshot of the order''s disc_alloc_mode, recorded on ORDER-level rows (how this order-level discount was spread, or not, across lines).';
COMMENT ON COLUMN public.org_order_discounts_dtl.tax_category_code IS 'FK sys_tax_category_cd. On a DOCUMENT_LEVEL order discount split across tax categories, the category this row''s share belongs to.';

-- ------------------------------------------------------------------
-- 4. org_order_charges_dtl — charge tax (§6.5)
-- ------------------------------------------------------------------
ALTER TABLE public.org_order_charges_dtl
  ADD COLUMN IF NOT EXISTS tax_category_code  TEXT,
  ADD COLUMN IF NOT EXISTS tax_profile_id      UUID,
  ADD COLUMN IF NOT EXISTS tax_rate            NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS taxable_amount      DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS tax_amount          DECIMAL(19,4);

ALTER TABLE public.org_order_charges_dtl
  ADD CONSTRAINT fk_ocd_tax_category
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  ADD CONSTRAINT fk_ocd_tax_profile
    FOREIGN KEY (tax_profile_id) REFERENCES public.org_tax_profiles_cf(id);

COMMENT ON COLUMN public.org_order_charges_dtl.tax_category_code IS 'FK sys_tax_category_cd. This charge''s own tax-base category, taxed by its own profile (ADR-060 §6: charges are taxed by their own profile and category, not the line''s).';
COMMENT ON COLUMN public.org_order_charges_dtl.tax_profile_id IS 'The org_tax_profiles_cf row applied to this charge. Plain FK (the plan does not call for composite here, unlike items/pieces in M5).';
COMMENT ON COLUMN public.org_order_charges_dtl.tax_rate IS 'The rate applied to this charge, as a percentage (same convention as org_order_taxes_dtl.rate).';
COMMENT ON COLUMN public.org_order_charges_dtl.taxable_amount IS 'The base this charge''s tax was computed on (normally the charge amount itself).';
COMMENT ON COLUMN public.org_order_charges_dtl.tax_amount IS 'This charge''s own tax amount.';

COMMIT;
