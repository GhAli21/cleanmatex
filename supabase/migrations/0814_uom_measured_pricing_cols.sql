-- =============================================================================
-- Migration: 0814_uom_measured_pricing_cols.sql
-- Purpose:   Unit of Measure platform, part 2 of Migration A
--            (docs/features/Measured_Pricing/PLAN.md §2.3, §3.1, §3.6, §3.6a; decisions D10–D14):
--            1. Numeric precision classes on the columns this program touches:
--               UNIT_PRICE (21,6), UNIT_COST (23,8), QUANTITY (21,6); AMOUNT stays (19,4).
--            2. Products: base_uom_code (FK to the Organization's units), optional min_billable_qty and
--               billing_increment; price_type FIXED | PER_UNIT (PER_PC renamed), NOT NULL.
--            3. HQ templates: base_uom_code (FK to system units), price_type FIXED | PER_UNIT.
--            4. Order lines: unit snapshot + measure columns (measured, length × width, billed) with
--               the billed-measure identity as a CHECK; committed-order guard extended to them.
--            5. Price-list tiers become decimal quantities in the product's base unit.
--            6. Stock quantities/costs, speed prices, price history and tax-document lines widened;
--               tax-document lines get a decimal quantity and a unit snapshot (e-invoice unit code).
--            7. deduct_retail_stock_for_order deducts the measured quantity of measured lines;
--               get_product_price takes a decimal quantity (kept identical to lib/commercial/standard-price.ts).
--            8. Transitional bridge triggers so the current app (which still writes product_unit and
--               PER_PC) keeps working until P2/P3/P7 ship; removed by Migration B.
-- Affected:  org_product_data_mst, sys_service_prod_templates_cd, org_order_items_dtl,
--            org_order_item_pieces_dtl, org_price_list_items_dtl, org_inv_stock_tr,
--            org_inv_stock_by_branch, org_speed_price_rules_cf, org_price_history_audit,
--            org_tax_doc_items_dtl, org_uom_cf (in-use guard); functions deduct_retail_stock_for_order,
--            get_product_price; new fn_uom_* trigger functions.
-- Related:   0813 (units, conversions, fn_uom_seed_tenant, fn_uom_assert_qty_scale), 0642 (old price_type
--            CHECK), 0702 (committed-order column guard), 0815 (permissions + navigation).
-- Data:      P0 (PLAN §2.3): product_unit values PC/piece/unit/UNIT/SUIT/PAIR/SET/NULL; 49 order lines,
--            2 of them governed removed facts; 4 tax-document lines; no views on changed columns.
-- Rollback (manual, forward-only): widen-only type changes need no rollback; drop the new columns,
--            constraints and triggers, restore the 0642 CHECK and the previous function bodies.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Legacy unit mapping (transitional) ───────────────────────────────────

-- Maps the free-text product_unit values found in data and in the old inventory list to unit
-- codes. Used by the backfill and by the bridge triggers until Migration B drops product_unit.
CREATE OR REPLACE FUNCTION public.fn_uom_legacy_code(p_unit text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v text := upper(btrim(COALESCE(p_unit, '')));
BEGIN
  RETURN CASE
    WHEN v IN ('', 'PC', 'PCS', 'PIECE', 'PIECES', 'UNIT', 'ITEM') THEN 'PC'
    WHEN v IN ('LITER', 'LITRE', 'L', 'LTR')                    THEN 'L'
    WHEN v IN ('KG', 'KILOGRAM')                                THEN 'KG'
    WHEN v IN ('G', 'GRAM', 'GRAMS')                            THEN 'G'
    WHEN v IN ('BOTTLE', 'BTL')                                 THEN 'BTL'
    WHEN v ~ '^[A-Z][A-Z0-9_]{0,19}$'                           THEN v   -- SUIT, PAIR, SET, BOX, PACK, ROLL, any unit code
    ELSE NULL
  END;
END $$;
COMMENT ON FUNCTION public.fn_uom_legacy_code(text) IS 'Transitional (dropped by Migration B): maps legacy free-text product_unit values to unit codes (piece/unit/NULL → PC, liter → L, gram → G, bottle → BTL; codes pass through upper-cased). NULL when the text cannot be a unit code.';
REVOKE ALL ON FUNCTION public.fn_uom_legacy_code(text) FROM PUBLIC, anon, authenticated;

-- ─── 2. Products ─────────────────────────────────────────────────────────────

-- Precision classes (PLAN §3.1). Prices per base unit need 6 dp (0.045 per g); costs 8 dp.
-- PostgreSQL cannot retype a column named in a trigger WHEN clause: the price-history trigger is
-- dropped here and recreated unchanged right after the type change.
DROP TRIGGER trigger_log_product_default_price_change ON public.org_product_data_mst;
ALTER TABLE public.org_product_data_mst
  ALTER COLUMN default_sell_price TYPE NUMERIC(21,6),
  ALTER COLUMN min_sell_price     TYPE NUMERIC(21,6),
  ALTER COLUMN product_cost       TYPE NUMERIC(23,8),
  ALTER COLUMN last_purchase_cost TYPE NUMERIC(23,8),
  ALTER COLUMN qty_on_hand        TYPE NUMERIC(21,6),
  ALTER COLUMN reorder_point      TYPE NUMERIC(21,6),
  ALTER COLUMN min_stock_level    TYPE NUMERIC(21,6),
  ALTER COLUMN max_stock_level    TYPE NUMERIC(21,6);
-- Recreated exactly as before (definition captured from the live database in P1).
CREATE TRIGGER trigger_log_product_default_price_change AFTER UPDATE ON public.org_product_data_mst
  FOR EACH ROW WHEN (old.default_sell_price IS DISTINCT FROM new.default_sell_price)
  EXECUTE FUNCTION public.log_product_default_price_change();
COMMENT ON TRIGGER trigger_log_product_default_price_change ON public.org_product_data_mst IS 'Writes a price-history row when the default sell price changes (recreated unchanged by 0814 around the type change).';
COMMENT ON COLUMN public.org_product_data_mst.default_sell_price IS 'Default sell price per one base unit (per piece, per kg, per m²). UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_product_data_mst.min_sell_price IS 'Lowest allowed sell price per base unit. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_product_data_mst.product_cost IS 'Standard cost per base unit. UNIT_COST precision (23,8).';
COMMENT ON COLUMN public.org_product_data_mst.last_purchase_cost IS 'Last purchase cost per base unit. UNIT_COST precision (23,8).';
COMMENT ON COLUMN public.org_product_data_mst.qty_on_hand IS 'Stock on hand in the product base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_product_data_mst.reorder_point IS 'Reorder point in the product base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_product_data_mst.min_stock_level IS 'Minimum stock level in the product base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_product_data_mst.max_stock_level IS 'Maximum stock level in the product base unit. QUANTITY precision (21,6).';

ALTER TABLE public.org_product_data_mst
  ADD COLUMN base_uom_code     TEXT          NULL,
  ADD COLUMN min_billable_qty  NUMERIC(21,6) NULL,
  ADD COLUMN billing_increment NUMERIC(21,6) NULL;
COMMENT ON COLUMN public.org_product_data_mst.base_uom_code IS 'Unit the product is priced and stocked in (org_uom_cf). A product is measured when this unit is not COUNT. Replaces free-text product_unit.';
COMMENT ON COLUMN public.org_product_data_mst.min_billable_qty IS 'Optional minimum billed measure in the base unit (e.g. 3 kg). NULL = no minimum. Measured products only (D12).';
COMMENT ON COLUMN public.org_product_data_mst.billing_increment IS 'Optional billing step in the base unit: the billed measure rounds up to a multiple of it (e.g. 0.5 kg). NULL = bill the exact measure. Measured products only (D13).';

-- Backfill from the legacy text; unknown values stop the migration on purpose (P0 found none).
UPDATE public.org_product_data_mst
   SET base_uom_code = public.fn_uom_legacy_code(product_unit)
 WHERE base_uom_code IS NULL;
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT p.product_unit INTO v_bad
    FROM public.org_product_data_mst p
   WHERE p.base_uom_code IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = p.base_uom_code)
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '0814 backfill: product_unit % has no unit mapping; fix the data or extend fn_uom_legacy_code', v_bad;
  END IF;
END $$;
-- Make sure each Organization holds every unit its products use (non-seeded system units included).
SELECT public.fn_uom_seed_tenant(x.tenant_org_id, x.codes)
  FROM (SELECT tenant_org_id, array_agg(DISTINCT base_uom_code) AS codes
          FROM public.org_product_data_mst GROUP BY tenant_org_id) x;

ALTER TABLE public.org_product_data_mst
  ALTER COLUMN base_uom_code SET NOT NULL,
  ADD CONSTRAINT fk_prod_base_uom FOREIGN KEY (tenant_org_id, base_uom_code)
    REFERENCES public.org_uom_cf (tenant_org_id, uom_code) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_prod_min_billable CHECK (min_billable_qty IS NULL OR min_billable_qty > 0),
  ADD CONSTRAINT ck_prod_billing_incr CHECK (billing_increment IS NULL OR billing_increment > 0);
COMMENT ON CONSTRAINT fk_prod_base_uom ON public.org_product_data_mst IS 'Base unit is a unit of the same Organization; column order matches uq_ouom_tenant_code (Prisma-safe). RESTRICT: units are never hard-deleted.';
COMMENT ON CONSTRAINT ck_prod_min_billable ON public.org_product_data_mst IS 'A minimum, when set, is positive.';
COMMENT ON CONSTRAINT ck_prod_billing_incr ON public.org_product_data_mst IS 'A billing step, when set, is positive.';

-- "Used by N products" checks and unit pickers filter products by unit within an Organization.
CREATE INDEX idx_prod_tenant_uom ON public.org_product_data_mst (tenant_org_id, base_uom_code);
COMMENT ON INDEX public.idx_prod_tenant_uom IS 'Supports the unit in-use check and FK RESTRICT checks on org_uom_cf.';

-- price_type: PER_PC becomes PER_UNIT (per one base unit); NULL becomes PER_UNIT; required.
-- The 0642 CHECK (FIXED / PER_PC / NULL) rejects PER_UNIT, so it is dropped before the rename
-- and replaced right after it.
ALTER TABLE public.org_product_data_mst DROP CONSTRAINT chk_org_product_price_type;
UPDATE public.org_product_data_mst
   SET price_type = 'PER_UNIT'
 WHERE price_type IS NULL OR price_type = 'PER_PC';
ALTER TABLE public.org_product_data_mst
  ALTER COLUMN price_type SET NOT NULL,
  ADD CONSTRAINT chk_org_product_price_type CHECK (price_type IN ('FIXED', 'PER_UNIT'));
COMMENT ON COLUMN public.org_product_data_mst.price_type IS 'PER_UNIT: amount = billed measure (or piece quantity) × unit price. FIXED: one price per line, COUNT units only.';
COMMENT ON CONSTRAINT chk_org_product_price_type ON public.org_product_data_mst IS 'Allowed price types (PER_PC was renamed PER_UNIT in 0814).';

-- Transitional bridge (dropped by Migration B): the current app still writes product_unit and
-- PER_PC. Maps them onto base_uom_code / PER_UNIT so writes keep working until P3 ships.
CREATE OR REPLACE FUNCTION public.fn_uom_prod_legacy_bridge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.price_type IS NULL OR NEW.price_type = 'PER_PC' THEN
    NEW.price_type := 'PER_UNIT';
  END IF;
  IF NEW.base_uom_code IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.product_unit IS DISTINCT FROM OLD.product_unit
         AND NEW.base_uom_code IS NOT DISTINCT FROM OLD.base_uom_code) THEN
    NEW.base_uom_code := public.fn_uom_legacy_code(NEW.product_unit);
    IF NEW.base_uom_code IS NULL THEN
      RAISE EXCEPTION 'UOM_NOT_FOUND: unit "%" is not a known unit', NEW.product_unit USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_prod_legacy_bridge() IS 'Transitional (dropped by Migration B): maps legacy product_unit / PER_PC writes onto base_uom_code / PER_UNIT for products and HQ templates.';
REVOKE ALL ON FUNCTION public.fn_uom_prod_legacy_bridge() FROM PUBLIC, anon, authenticated;

-- Fires before trg_prod_uom_2_rules (BEFORE triggers run in name order).
CREATE TRIGGER trg_prod_uom_1_bridge BEFORE INSERT OR UPDATE ON public.org_product_data_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_prod_legacy_bridge();
COMMENT ON TRIGGER trg_prod_uom_1_bridge ON public.org_product_data_mst IS 'Transitional legacy mapping; dropped by Migration B.';

-- Product unit rules (BEFORE INSERT/UPDATE). SECURITY DEFINER: products are written with the
-- signed-in user's key, which cannot read org_uom_cf directly; every lookup filters NEW.tenant_org_id.
CREATE OR REPLACE FUNCTION public.fn_uom_prod_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_unit public.org_uom_cf%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.base_uom_code IS NOT DISTINCT FROM OLD.base_uom_code
     AND NEW.price_type IS NOT DISTINCT FROM OLD.price_type
     AND NEW.min_billable_qty IS NOT DISTINCT FROM OLD.min_billable_qty
     AND NEW.billing_increment IS NOT DISTINCT FROM OLD.billing_increment THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_unit FROM public.org_uom_cf u
   WHERE u.tenant_org_id = NEW.tenant_org_id AND u.uom_code = NEW.base_uom_code;
  IF NOT FOUND THEN
    -- A system unit the Organization does not hold yet (template on an unseeded unit): add it.
    IF EXISTS (SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = NEW.base_uom_code AND s.is_active AND s.rec_status = 1) THEN
      PERFORM public.fn_uom_seed_tenant(NEW.tenant_org_id, ARRAY[NEW.base_uom_code]);
      SELECT * INTO v_unit FROM public.org_uom_cf u
       WHERE u.tenant_org_id = NEW.tenant_org_id AND u.uom_code = NEW.base_uom_code;
    ELSE
      RAISE EXCEPTION 'UOM_NOT_FOUND: unit % is not set up for this Organization', NEW.base_uom_code
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.base_uom_code IS DISTINCT FROM OLD.base_uom_code)
     AND (NOT v_unit.is_active OR v_unit.rec_status <> 1) THEN
    RAISE EXCEPTION 'UOM_INACTIVE: unit % is switched off for this Organization', NEW.base_uom_code
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_unit.uom_dimension = 'COUNT' THEN
    IF NEW.min_billable_qty IS NOT NULL OR NEW.billing_increment IS NOT NULL THEN
      RAISE EXCEPTION 'MEASURE_NOT_ALLOWED: minimum and billing step apply to measured units only (unit %)', NEW.base_uom_code
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.price_type = 'FIXED' THEN
    RAISE EXCEPTION 'UOM_FIXED_PRICE_MEASURED: a fixed price needs a count unit, not %', NEW.base_uom_code
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.fn_uom_assert_qty_scale(NEW.tenant_org_id, NEW.base_uom_code, NEW.min_billable_qty, 'minimum billable');
  PERFORM public.fn_uom_assert_qty_scale(NEW.tenant_org_id, NEW.base_uom_code, NEW.billing_increment, 'billing step');
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_prod_rules() IS 'BEFORE INSERT/UPDATE on org_product_data_mst: adds a missing system unit to the Organization, rejects switched-off units, keeps minimum/billing step on measured units only, FIXED on count units only, and checks decimals. Reads only NEW.tenant_org_id rows.';
REVOKE ALL ON FUNCTION public.fn_uom_prod_rules() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_prod_uom_2_rules BEFORE INSERT OR UPDATE ON public.org_product_data_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_prod_rules();
COMMENT ON TRIGGER trg_prod_uom_2_rules ON public.org_product_data_mst IS 'Product unit rules (fn_uom_prod_rules).';

-- Units in use cannot be switched off or deleted (D10: "used by N products").
CREATE OR REPLACE FUNCTION public.fn_uom_unit_in_use_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF (OLD.is_active AND NOT NEW.is_active) OR (OLD.rec_status = 1 AND NEW.rec_status <> 1) THEN
    SELECT count(*) INTO v_count FROM public.org_product_data_mst p
     WHERE p.tenant_org_id = OLD.tenant_org_id AND p.base_uom_code = OLD.uom_code
       AND COALESCE(p.rec_status, 1) = 1;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'UOM_IN_USE: unit % is used by % product(s)', OLD.uom_code, v_count
        USING ERRCODE = 'check_violation', DETAIL = v_count::text;
    END IF;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_unit_in_use_guard() IS 'BEFORE UPDATE on org_uom_cf: a unit used by live products cannot be switched off or soft-deleted. DETAIL carries the product count for the "used by N products" message. Filters OLD.tenant_org_id.';
REVOKE ALL ON FUNCTION public.fn_uom_unit_in_use_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ouom_in_use BEFORE UPDATE OF is_active, rec_status ON public.org_uom_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_unit_in_use_guard();
COMMENT ON TRIGGER trg_ouom_in_use ON public.org_uom_cf IS 'Blocks switching off a unit used by products (fn_uom_unit_in_use_guard).';

-- ─── 3. HQ templates ─────────────────────────────────────────────────────────

ALTER TABLE public.sys_service_prod_templates_cd
  ALTER COLUMN default_sell_price         TYPE NUMERIC(21,6),
  ALTER COLUMN default_express_sell_price TYPE NUMERIC(21,6),
  ALTER COLUMN min_sell_price             TYPE NUMERIC(21,6),
  ALTER COLUMN product_cost               TYPE NUMERIC(23,8),
  ADD COLUMN base_uom_code TEXT NULL;
COMMENT ON COLUMN public.sys_service_prod_templates_cd.default_sell_price IS 'Template default sell price per base unit. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.sys_service_prod_templates_cd.default_express_sell_price IS 'Template express sell price per base unit. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.sys_service_prod_templates_cd.min_sell_price IS 'Template minimum sell price per base unit. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.sys_service_prod_templates_cd.product_cost IS 'Template standard cost per base unit. UNIT_COST precision (23,8).';
COMMENT ON COLUMN public.sys_service_prod_templates_cd.base_uom_code IS 'System unit the template product is priced in; copied to the tenant product (the unit is added to the Organization when missing). Minimum and billing step are tenant-only (D12).';

UPDATE public.sys_service_prod_templates_cd
   SET base_uom_code = public.fn_uom_legacy_code(product_unit)
 WHERE base_uom_code IS NULL;
UPDATE public.sys_service_prod_templates_cd
   SET price_type = 'PER_UNIT'
 WHERE price_type IS NULL OR price_type = 'PER_PC';

ALTER TABLE public.sys_service_prod_templates_cd
  ALTER COLUMN base_uom_code SET NOT NULL,
  ALTER COLUMN price_type SET NOT NULL,
  ADD CONSTRAINT fk_sspt_base_uom FOREIGN KEY (base_uom_code) REFERENCES public.sys_uom_cd (uom_code) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_sspt_price_type CHECK (price_type IN ('FIXED', 'PER_UNIT'));
COMMENT ON COLUMN public.sys_service_prod_templates_cd.price_type IS 'PER_UNIT or FIXED (FIXED on count units only).';
COMMENT ON CONSTRAINT fk_sspt_base_uom ON public.sys_service_prod_templates_cd IS 'Templates use system units; deleting a unit in use is blocked.';
COMMENT ON CONSTRAINT ck_sspt_price_type ON public.sys_service_prod_templates_cd IS 'Allowed price types.';

CREATE INDEX idx_sspt_base_uom ON public.sys_service_prod_templates_cd (base_uom_code);
COMMENT ON INDEX public.idx_sspt_base_uom IS 'FK RESTRICT checks on sys_uom_cd and HQ "templates using this unit" lookups.';

CREATE TRIGGER trg_sspt_uom_1_bridge BEFORE INSERT OR UPDATE ON public.sys_service_prod_templates_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_prod_legacy_bridge();
COMMENT ON TRIGGER trg_sspt_uom_1_bridge ON public.sys_service_prod_templates_cd IS 'Transitional legacy mapping for HQ template writes; dropped by Migration B.';

CREATE OR REPLACE FUNCTION public.fn_uom_tpl_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.price_type = 'FIXED'
     AND EXISTS (SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = NEW.base_uom_code AND s.uom_dimension <> 'COUNT') THEN
    RAISE EXCEPTION 'UOM_FIXED_PRICE_MEASURED: a fixed price needs a count unit, not %', NEW.base_uom_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_tpl_rules() IS 'BEFORE INSERT/UPDATE on sys_service_prod_templates_cd: FIXED price only on count units.';
REVOKE ALL ON FUNCTION public.fn_uom_tpl_rules() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sspt_uom_2_rules BEFORE INSERT OR UPDATE ON public.sys_service_prod_templates_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_tpl_rules();
COMMENT ON TRIGGER trg_sspt_uom_2_rules ON public.sys_service_prod_templates_cd IS 'Template unit rules (fn_uom_tpl_rules).';

-- ─── 4. Order lines ──────────────────────────────────────────────────────────

ALTER TABLE public.org_order_items_dtl
  ALTER COLUMN price_per_unit  TYPE NUMERIC(21,6),
  ALTER COLUMN list_unit_price TYPE NUMERIC(21,6),
  ALTER COLUMN price_override  TYPE NUMERIC(21,6),
  ADD COLUMN uom_code          TEXT          NULL,
  ADD COLUMN uom_dimension     TEXT          NULL,
  ADD COLUMN uom_unece_code    TEXT          NULL,
  ADD COLUMN uom_symbol        TEXT          NULL,
  ADD COLUMN uom_symbol2       TEXT          NULL,
  ADD COLUMN uom_qty_decimals  SMALLINT      NULL,
  ADD COLUMN price_type        TEXT          NULL,
  ADD COLUMN min_billable_qty  NUMERIC(21,6) NULL,
  ADD COLUMN billing_increment NUMERIC(21,6) NULL,
  ADD COLUMN measured_qty      NUMERIC(21,6) NULL,
  ADD COLUMN measure_length    NUMERIC(21,6) NULL,
  ADD COLUMN measure_width     NUMERIC(21,6) NULL,
  ADD COLUMN billed_qty        NUMERIC(21,6) NULL;
COMMENT ON COLUMN public.org_order_items_dtl.price_per_unit IS 'Charged price per base unit (per piece, per kg). UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_order_items_dtl.list_unit_price IS 'List price per base unit before overrides. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_order_items_dtl.price_override IS 'Manual price per base unit, when overridden. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_order_items_dtl.quantity IS 'Piece / bag count of the line (INTEGER, unchanged). For measured lines money uses billed_qty, not this.';
COMMENT ON COLUMN public.org_order_items_dtl.uom_code IS 'Unit of the line at sale time (product base unit; PC for custom items). FK to org_uom_cf.';
COMMENT ON COLUMN public.org_order_items_dtl.uom_dimension IS 'Snapshot: dimension of the unit at sale time (COUNT = piece-priced line).';
COMMENT ON COLUMN public.org_order_items_dtl.uom_unece_code IS 'Snapshot: UN/ECE Rec 20 code for e-invoices at sale time; NULL for a custom unit without one.';
COMMENT ON COLUMN public.org_order_items_dtl.uom_symbol IS 'Snapshot: English symbol at sale time, so prints never change after a rename.';
COMMENT ON COLUMN public.org_order_items_dtl.uom_symbol2 IS 'Snapshot: Arabic symbol at sale time.';
COMMENT ON COLUMN public.org_order_items_dtl.uom_qty_decimals IS 'Snapshot: decimals of the unit at sale time (measure formatting and the area rounding rule).';
COMMENT ON COLUMN public.org_order_items_dtl.price_type IS 'Snapshot: FIXED or PER_UNIT at sale time.';
COMMENT ON COLUMN public.org_order_items_dtl.min_billable_qty IS 'Snapshot: product minimum billed measure at sale time; NULL = none. Measured lines only.';
COMMENT ON COLUMN public.org_order_items_dtl.billing_increment IS 'Snapshot: product billing step at sale time; NULL = exact measure. Measured lines only.';
COMMENT ON COLUMN public.org_order_items_dtl.measured_qty IS 'Measured amount in the line unit (2.4 kg, 3.5 m, 6.25 m²). NULL on count lines and on measured lines not weighed yet (cannot be committed). QUANTITY (21,6).';
COMMENT ON COLUMN public.org_order_items_dtl.measure_length IS 'Length in metres for area lines (m² = length × width). NULL otherwise.';
COMMENT ON COLUMN public.org_order_items_dtl.measure_width IS 'Width in metres for area lines. NULL otherwise.';
COMMENT ON COLUMN public.org_order_items_dtl.billed_qty IS 'Billed measure: max(measured, minimum) rounded up to the billing step. Money = billed_qty × unit price. NULL on count lines and unmeasured lines.';

-- Backfill snapshots of existing lines (all count lines). Two lines are governed removed facts,
-- which oc_item_removed_guard keeps immutable; the guard is paused for this one-time fill of NEW
-- columns only (no existing value changes) and switched back on below. fn_recalc_order_totals is a
-- no-op (P0), so the AFTER UPDATE recalc trigger changes nothing.
ALTER TABLE public.org_order_items_dtl DISABLE TRIGGER oc_item_removed_guard;

UPDATE public.org_order_items_dtl i
   SET uom_code   = COALESCE((SELECT p.base_uom_code FROM public.org_product_data_mst p
                               WHERE p.tenant_org_id = i.tenant_org_id AND p.id = i.product_id), 'PC'),
       price_type = COALESCE((SELECT p.price_type FROM public.org_product_data_mst p
                               WHERE p.tenant_org_id = i.tenant_org_id AND p.id = i.product_id), 'PER_UNIT');

UPDATE public.org_order_items_dtl i
   SET uom_dimension    = u.uom_dimension,
       uom_unece_code   = u.unece_code,
       uom_symbol       = u.symbol,
       uom_symbol2      = u.symbol2,
       uom_qty_decimals = u.qty_decimals
  FROM public.org_uom_cf u
 WHERE u.tenant_org_id = i.tenant_org_id AND u.uom_code = i.uom_code;

-- The backfill queued checks of the deferred FK oc_item_removal_change_fk; ALTER TABLE refuses to
-- run while trigger events are pending (55006). Run them now and keep constraints immediate for the
-- rest of this migration, so the later ALTERs on these tables never wait on queued events.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.org_order_items_dtl ENABLE TRIGGER oc_item_removed_guard;

ALTER TABLE public.org_order_items_dtl
  ALTER COLUMN uom_code SET NOT NULL,
  ALTER COLUMN uom_dimension SET NOT NULL,
  ALTER COLUMN uom_symbol SET NOT NULL,
  ALTER COLUMN uom_qty_decimals SET NOT NULL,
  ALTER COLUMN price_type SET NOT NULL,
  ADD CONSTRAINT fk_oid_uom FOREIGN KEY (tenant_org_id, uom_code)
    REFERENCES public.org_uom_cf (tenant_org_id, uom_code) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_oid_uom_dimension CHECK (uom_dimension IN ('COUNT', 'MASS', 'LENGTH', 'AREA', 'VOLUME', 'TIME')),
  ADD CONSTRAINT ck_oid_price_type CHECK (price_type IN ('FIXED', 'PER_UNIT') AND (price_type = 'PER_UNIT' OR uom_dimension = 'COUNT')),
  ADD CONSTRAINT ck_oid_measure_count CHECK (uom_dimension <> 'COUNT' OR (measured_qty IS NULL AND measure_length IS NULL
    AND measure_width IS NULL AND billed_qty IS NULL AND min_billable_qty IS NULL AND billing_increment IS NULL)),
  ADD CONSTRAINT ck_oid_measure_pos CHECK ((measured_qty IS NULL OR measured_qty > 0) AND (min_billable_qty IS NULL OR min_billable_qty > 0)
    AND (billing_increment IS NULL OR billing_increment > 0)),
  ADD CONSTRAINT ck_oid_measure_pair CHECK ((measured_qty IS NULL) = (billed_qty IS NULL)),
  ADD CONSTRAINT ck_oid_measure_area CHECK (CASE WHEN uom_dimension = 'AREA'
      THEN (measure_length IS NULL) = (measure_width IS NULL) AND (measure_length IS NULL) = (measured_qty IS NULL)
           AND (measure_length IS NULL OR (measure_length > 0 AND measure_width > 0
                AND measured_qty = round(measure_length * measure_width, uom_qty_decimals)))
      ELSE measure_length IS NULL AND measure_width IS NULL END),
  ADD CONSTRAINT ck_oid_billed_qty CHECK (measured_qty IS NULL OR billed_qty = CASE
      WHEN billing_increment IS NULL THEN GREATEST(measured_qty, COALESCE(min_billable_qty, measured_qty))
      ELSE ceil(GREATEST(measured_qty, COALESCE(min_billable_qty, measured_qty)) / billing_increment) * billing_increment END);
COMMENT ON CONSTRAINT fk_oid_uom ON public.org_order_items_dtl IS 'Line unit is a unit of the same Organization; column order matches uq_ouom_tenant_code (Prisma-safe).';
COMMENT ON CONSTRAINT ck_oid_uom_dimension ON public.org_order_items_dtl IS 'Allowed dimensions.';
COMMENT ON CONSTRAINT ck_oid_price_type ON public.org_order_items_dtl IS 'FIXED or PER_UNIT; FIXED only on count lines.';
COMMENT ON CONSTRAINT ck_oid_measure_count ON public.org_order_items_dtl IS 'Count lines carry no measure, minimum or billing step.';
COMMENT ON CONSTRAINT ck_oid_measure_pos ON public.org_order_items_dtl IS 'Measures, minimum and billing step are positive when present.';
COMMENT ON CONSTRAINT ck_oid_measure_pair ON public.org_order_items_dtl IS 'A line is either unmeasured (both NULL) or measured and billed.';
COMMENT ON CONSTRAINT ck_oid_measure_area ON public.org_order_items_dtl IS 'Area lines store length × width with measured_qty = round(L × W, unit decimals); other lines never store length/width.';
COMMENT ON CONSTRAINT ck_oid_billed_qty ON public.org_order_items_dtl IS 'Billed measure identity (PLAN §3.6a): max(measured, minimum), rounded up to the billing step. The calculator computes it; the database refuses any other value.';

CREATE INDEX idx_oid_tenant_uom ON public.org_order_items_dtl (tenant_org_id, uom_code);
COMMENT ON INDEX public.idx_oid_tenant_uom IS 'FK RESTRICT checks on org_uom_cf and "billed by unit" reporting.';

-- Fills the unit snapshot of a line from its product (or PC for custom items) when the writer did
-- not send it, re-fills it when the product changes, and checks measure decimals. SECURITY
-- DEFINER: lines are written with the signed-in user's key; every lookup filters NEW.tenant_org_id.
CREATE OR REPLACE FUNCTION public.fn_uom_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_prod public.org_product_data_mst%ROWTYPE;
  v_unit public.org_uom_cf%ROWTYPE;
  v_refill boolean;
BEGIN
  v_refill := (TG_OP = 'INSERT' AND NEW.uom_code IS NULL)
           OR (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id
               AND NEW.uom_code IS NOT DISTINCT FROM OLD.uom_code);
  IF (v_refill OR NEW.price_type IS NULL) AND NEW.product_id IS NOT NULL THEN
    SELECT * INTO v_prod FROM public.org_product_data_mst p
     WHERE p.tenant_org_id = NEW.tenant_org_id AND p.id = NEW.product_id;
  END IF;
  IF v_refill THEN
    -- Writer sent no unit: the line takes the product's unit and measure settings.
    -- (A writer that sends uom_code owns min_billable_qty / billing_increment too.)
    NEW.uom_code          := COALESCE(v_prod.base_uom_code, 'PC');
    NEW.price_type        := COALESCE(v_prod.price_type, NEW.price_type, 'PER_UNIT');
    NEW.min_billable_qty  := COALESCE(NEW.min_billable_qty, v_prod.min_billable_qty);
    NEW.billing_increment := COALESCE(NEW.billing_increment, v_prod.billing_increment);
  ELSIF NEW.price_type IS NULL THEN
    NEW.price_type := COALESCE(v_prod.price_type, 'PER_UNIT');
  END IF;

  IF v_refill OR NEW.uom_dimension IS NULL OR NEW.uom_symbol IS NULL OR NEW.uom_qty_decimals IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.uom_code IS DISTINCT FROM OLD.uom_code) THEN
    SELECT * INTO v_unit FROM public.org_uom_cf u
     WHERE u.tenant_org_id = NEW.tenant_org_id AND u.uom_code = NEW.uom_code;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'UOM_NOT_FOUND: unit % is not set up for this Organization', NEW.uom_code USING ERRCODE = 'foreign_key_violation';
    END IF;
    NEW.uom_dimension    := v_unit.uom_dimension;
    NEW.uom_unece_code   := v_unit.unece_code;
    NEW.uom_symbol       := v_unit.symbol;
    NEW.uom_symbol2      := v_unit.symbol2;
    NEW.uom_qty_decimals := v_unit.qty_decimals;
    -- Count lines never carry the product's measure settings.
    IF v_unit.uom_dimension = 'COUNT' THEN
      NEW.min_billable_qty := NULL;
      NEW.billing_increment := NULL;
    END IF;
  END IF;

  IF NEW.measured_qty IS NOT NULL AND NEW.uom_dimension <> 'AREA' THEN
    IF NEW.measured_qty <> round(NEW.measured_qty, NEW.uom_qty_decimals) THEN
      RAISE EXCEPTION 'UOM_QTY_SCALE: measure % allows % decimal place(s) (got %)', NEW.uom_code, NEW.uom_qty_decimals, NEW.measured_qty
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_item_snapshot() IS 'BEFORE INSERT/UPDATE on org_order_items_dtl: fills the unit snapshot (code, dimension, UN/ECE code, symbols, decimals, price type, minimum, billing step) from the product when not sent or when the product changes; checks measure decimals. Never rewrites money; the billed-measure CHECK verifies the calculator. Reads only NEW.tenant_org_id rows.';
REVOKE ALL ON FUNCTION public.fn_uom_item_snapshot() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_oid_uom_snapshot BEFORE INSERT OR UPDATE ON public.org_order_items_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_item_snapshot();
COMMENT ON TRIGGER trg_oid_uom_snapshot ON public.org_order_items_dtl IS 'Unit snapshot and measure decimals (fn_uom_item_snapshot).';

-- Committed-order guard (0702 lineage): the new unit and measure columns are committed money facts
-- too, so only Edit Order may change them on a committed order. Same function, longer column list.
DROP TRIGGER oc_item_committed_cols_guard ON public.org_order_items_dtl;
CREATE TRIGGER oc_item_committed_cols_guard BEFORE INSERT OR DELETE OR UPDATE ON public.org_order_items_dtl
  FOR EACH ROW EXECUTE FUNCTION public.oc_guard_committed_cols(
    'tenant_org_id', 'order_id', 'service_category_code', 'product_id', 'product_name', 'product_name2', 'quantity',
    'price_per_unit', 'total_price', 'notes', 'color', 'brand', 'has_stain', 'has_damage', 'stain_notes', 'damage_notes',
    'price_override', 'override_reason', 'override_by', 'packing_pref_code', 'packing_pref_is_override',
    'packing_pref_source', 'service_pref_charge', 'rec_status', 'deleted_at', 'deleted_by', 'deleted_order_change_id',
    'money_basis', 'service_speed', 'ready_by_at', 'price_source', 'price_list_id', 'speed_rule_id', 'list_unit_price',
    'speed_premium_amount', 'line_disc_amount', 'order_disc_alloc_amount', 'net_amount', 'tax_pricing_mode',
    'tax_profile_id', 'tax_category_code', 'tax_exempt_reason', 'tax_rate', 'taxable_amount', 'tax_amount',
    'line_total_amount',
    'uom_code', 'uom_dimension', 'uom_unece_code', 'uom_symbol', 'uom_symbol2', 'uom_qty_decimals', 'price_type',
    'min_billable_qty', 'billing_increment', 'measured_qty', 'measure_length', 'measure_width', 'billed_qty');
COMMENT ON TRIGGER oc_item_committed_cols_guard ON public.org_order_items_dtl IS 'Data-API roles cannot change committed-order money facts directly (0702); 0814 adds the unit snapshot and measure columns.';

-- Pieces keep integer quantities; only their per-unit prices widen.
ALTER TABLE public.org_order_item_pieces_dtl
  ALTER COLUMN price_per_unit  TYPE NUMERIC(21,6),
  ALTER COLUMN list_unit_price TYPE NUMERIC(21,6);
COMMENT ON COLUMN public.org_order_item_pieces_dtl.price_per_unit IS 'Charged price per piece. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.list_unit_price IS 'List price per piece before overrides. UNIT_PRICE precision (21,6).';

-- ─── 5. Price lists ──────────────────────────────────────────────────────────

-- Tiers are measured in the product base unit (0–9.999 kg, ≥ 10 kg), so they become decimals.
-- The price-history trigger names price in its WHEN clause: dropped and recreated unchanged.
DROP TRIGGER trigger_log_price_list_item_change ON public.org_price_list_items_dtl;
ALTER TABLE public.org_price_list_items_dtl
  ALTER COLUMN price        TYPE NUMERIC(21,6),
  ALTER COLUMN min_quantity TYPE NUMERIC(21,6),
  ALTER COLUMN max_quantity TYPE NUMERIC(21,6);
CREATE TRIGGER trigger_log_price_list_item_change AFTER UPDATE ON public.org_price_list_items_dtl
  FOR EACH ROW WHEN ((old.price IS DISTINCT FROM new.price) OR (old.discount_percent IS DISTINCT FROM new.discount_percent))
  EXECUTE FUNCTION public.log_price_list_item_change();
COMMENT ON TRIGGER trigger_log_price_list_item_change ON public.org_price_list_items_dtl IS 'Writes a price-history row when a list price or discount changes (recreated unchanged by 0814 around the type change).';
COMMENT ON COLUMN public.org_price_list_items_dtl.price IS 'List price per product base unit. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_price_list_items_dtl.min_quantity IS 'Tier start (inclusive) in the product base unit: piece count, or billed measure for measured products. QUANTITY (21,6).';
COMMENT ON COLUMN public.org_price_list_items_dtl.max_quantity IS 'Tier end (inclusive) in the product base unit; NULL = no upper bound. QUANTITY (21,6).';

CREATE OR REPLACE FUNCTION public.fn_uom_pli_scale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_uom text;
BEGIN
  SELECT p.base_uom_code INTO v_uom FROM public.org_product_data_mst p
   WHERE p.tenant_org_id = NEW.tenant_org_id AND p.id = NEW.product_id;
  IF v_uom IS NOT NULL THEN
    PERFORM public.fn_uom_assert_qty_scale(NEW.tenant_org_id, v_uom, NEW.min_quantity, 'tier start');
    PERFORM public.fn_uom_assert_qty_scale(NEW.tenant_org_id, v_uom, NEW.max_quantity, 'tier end');
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_pli_scale() IS 'BEFORE INSERT/UPDATE on org_price_list_items_dtl: tier quantities respect the product unit decimals (whole numbers for count products). Reads only NEW.tenant_org_id rows.';
REVOKE ALL ON FUNCTION public.fn_uom_pli_scale() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_pli_uom_scale BEFORE INSERT OR UPDATE OF product_id, min_quantity, max_quantity ON public.org_price_list_items_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_pli_scale();
COMMENT ON TRIGGER trg_pli_uom_scale ON public.org_price_list_items_dtl IS 'Tier decimals follow the product unit (fn_uom_pli_scale).';

ALTER TABLE public.org_price_history_audit
  ALTER COLUMN old_price TYPE NUMERIC(21,6),
  ALTER COLUMN new_price TYPE NUMERIC(21,6);
COMMENT ON COLUMN public.org_price_history_audit.old_price IS 'Price per base unit before the change. UNIT_PRICE precision (21,6), same as the audited columns.';
COMMENT ON COLUMN public.org_price_history_audit.new_price IS 'Price per base unit after the change. UNIT_PRICE precision (21,6).';

ALTER TABLE public.org_speed_price_rules_cf
  ALTER COLUMN default_speed_sell_price TYPE NUMERIC(21,6);
COMMENT ON COLUMN public.org_speed_price_rules_cf.default_speed_sell_price IS 'Speed sell price per base unit (per piece, per kg). UNIT_PRICE precision (21,6).';

-- Same lookup as lib/commercial/standard-price.ts; the quantity is now a decimal measure.
-- The old (…, integer, date) signature has no callers (P0) and is replaced.
DROP FUNCTION public.get_product_price(uuid, uuid, character varying, integer, date) RESTRICT;
CREATE FUNCTION public.get_product_price(
  p_tenant_org_id   uuid,
  p_product_id      uuid,
  p_price_list_type character varying DEFAULT 'standard',
  p_quantity        numeric DEFAULT 1,
  p_effective_date  date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_price NUMERIC(21,6);
BEGIN
  -- The active price list's price (its discount folded in), highest priority and deepest tier first.
  SELECT pli.price * (1 - COALESCE(pli.discount_percent, 0) / 100)
    INTO v_price
    FROM org_price_list_items_dtl pli
    JOIN org_price_lists_mst pl
      ON pl.id = pli.price_list_id
     AND pl.tenant_org_id = pli.tenant_org_id
   WHERE pli.tenant_org_id = p_tenant_org_id
     AND pli.product_id = p_product_id
     AND pli.is_active = true
     AND pl.is_active = true
     AND pl.price_list_type = p_price_list_type
     AND (pl.effective_from IS NULL OR pl.effective_from <= p_effective_date)
     AND (pl.effective_to IS NULL OR pl.effective_to >= p_effective_date)
     AND pli.min_quantity <= p_quantity
     AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
   ORDER BY pl.priority DESC, pli.min_quantity DESC
   LIMIT 1;

  -- Else the product's default price for every list type (speed premiums come from speed rules).
  IF v_price IS NULL THEN
    SELECT default_sell_price
      INTO v_price
      FROM org_product_data_mst
     WHERE tenant_org_id = p_tenant_org_id
       AND id = p_product_id
       AND is_active = true;
  END IF;

  RETURN v_price;
END $$;
COMMENT ON FUNCTION public.get_product_price(uuid, uuid, character varying, numeric, date) IS 'Unit price of a product for a list type, quantity (piece count or billed measure in the base unit) and date: active list row by priority then deepest tier, else the product default. Mirrors lib/commercial/standard-price.ts.';
-- Same exposure as the replaced signature: signed-in users (RLS applies, SECURITY INVOKER) and the server.
REVOKE ALL ON FUNCTION public.get_product_price(uuid, uuid, character varying, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_price(uuid, uuid, character varying, numeric, date) TO authenticated, service_role;

-- ─── 6. Stock ────────────────────────────────────────────────────────────────

ALTER TABLE public.org_inv_stock_tr
  ALTER COLUMN quantity   TYPE NUMERIC(21,6),
  ALTER COLUMN qty_before TYPE NUMERIC(21,6),
  ALTER COLUMN qty_after  TYPE NUMERIC(21,6),
  ALTER COLUMN unit_cost  TYPE NUMERIC(23,8);
COMMENT ON COLUMN public.org_inv_stock_tr.quantity IS 'Signed movement in the product base unit (negative = out). QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_tr.qty_before IS 'Stock before the movement, base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_tr.qty_after IS 'Stock after the movement, base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_tr.unit_cost IS 'Cost per base unit of the movement. UNIT_COST precision (23,8); total_cost stays AMOUNT (19,4).';

ALTER TABLE public.org_inv_stock_by_branch
  ALTER COLUMN qty_on_hand        TYPE NUMERIC(21,6),
  ALTER COLUMN reorder_point      TYPE NUMERIC(21,6),
  ALTER COLUMN min_stock_level    TYPE NUMERIC(21,6),
  ALTER COLUMN max_stock_level    TYPE NUMERIC(21,6),
  ALTER COLUMN last_purchase_cost TYPE NUMERIC(23,8);
COMMENT ON COLUMN public.org_inv_stock_by_branch.qty_on_hand IS 'Branch stock in the product base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_by_branch.reorder_point IS 'Branch reorder point, base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_by_branch.min_stock_level IS 'Branch minimum stock, base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_by_branch.max_stock_level IS 'Branch maximum stock, base unit. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_inv_stock_by_branch.last_purchase_cost IS 'Last purchase cost per base unit. UNIT_COST precision (23,8).';

-- Retail sale deduction: measured retail lines (detergent sold by litre) deduct the measured
-- amount in the product base unit; count lines deduct the piece quantity as before. Body otherwise
-- unchanged from the previous definition.
CREATE OR REPLACE FUNCTION public.deduct_retail_stock_for_order(
  p_order_id uuid,
  p_tenant_org_id uuid,
  p_branch_id uuid DEFAULT NULL::uuid,
  p_reference_type text DEFAULT 'ORDER'::text,
  p_reference_id uuid DEFAULT NULL::uuid,
  p_reference_no text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_user_name text DEFAULT NULL::text,
  p_user_info text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text,
  p_user_device text DEFAULT NULL::text,
  p_user_browser text DEFAULT NULL::text,
  p_user_os text DEFAULT NULL::text,
  p_user_ip text DEFAULT NULL::text,
  p_reason text DEFAULT 'Order sale deduction'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  r RECORD;
  v_qty_to_deduct NUMERIC(21,6);
  v_qty_before    NUMERIC(21,6);
  v_qty_after     NUMERIC(21,6);
  v_created_info  TEXT;
BEGIN
  FOR r IN (
    SELECT oi.product_id, oi.quantity, oi.measured_qty, oi.uom_dimension, p.is_retail_item
      FROM public.org_order_items_dtl oi
      JOIN public.org_product_data_mst p
        ON p.id = oi.product_id
       AND p.tenant_org_id = oi.tenant_org_id
     WHERE oi.order_id = p_order_id
       AND oi.tenant_org_id = p_tenant_org_id
       AND oi.product_id IS NOT NULL
       AND p.is_retail_item = true
       AND p.service_category_code = 'RETAIL_ITEMS'
       AND oi.service_category_code = 'RETAIL_ITEMS'
  ) LOOP
    -- Measured line: the measured amount (base unit). Count line: the piece quantity.
    IF r.uom_dimension <> 'COUNT' THEN
      IF r.measured_qty IS NULL THEN
        RAISE EXCEPTION 'MEASURE_REQUIRED: retail product % has no measured quantity', r.product_id
          USING ERRCODE = 'check_violation';
      END IF;
      v_qty_to_deduct := r.measured_qty;
    ELSE
      v_qty_to_deduct := r.quantity;
    END IF;

    IF p_branch_id IS NOT NULL THEN
      INSERT INTO public.org_inv_stock_by_branch (
        tenant_org_id, product_id, branch_id,
        qty_on_hand, reorder_point, min_stock_level, max_stock_level,
        last_purchase_cost, storage_location, id_sku
      )
      SELECT
        p_tenant_org_id, r.product_id, p_branch_id,
        0,
        COALESCE(p.reorder_point, 0),
        COALESCE(p.min_stock_level, 0),
        p.max_stock_level,
        p.last_purchase_cost,
        p.storage_location,
        p.id_sku
      FROM public.org_product_data_mst p
      WHERE p.id = r.product_id
        AND p.tenant_org_id = p_tenant_org_id
      ON CONFLICT (tenant_org_id, product_id, branch_id) DO NOTHING;

      SELECT b.qty_on_hand
        INTO v_qty_before
        FROM public.org_inv_stock_by_branch b
       WHERE b.tenant_org_id = p_tenant_org_id
         AND b.product_id = r.product_id
         AND b.branch_id = p_branch_id
       FOR UPDATE;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;

      UPDATE public.org_inv_stock_by_branch b
         SET qty_on_hand = v_qty_after,
             updated_at = now()
       WHERE b.tenant_org_id = p_tenant_org_id
         AND b.product_id = r.product_id
         AND b.branch_id = p_branch_id;
    ELSE
      SELECT p.qty_on_hand
        INTO v_qty_before
        FROM public.org_product_data_mst p
       WHERE p.id = r.product_id
         AND p.tenant_org_id = p_tenant_org_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % not found', r.product_id;
      END IF;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;

      UPDATE public.org_product_data_mst p
         SET qty_on_hand = v_qty_after,
             updated_at = now()
       WHERE p.id = r.product_id
         AND p.tenant_org_id = p_tenant_org_id;
    END IF;

    SELECT CASE
      WHEN p_user_info IS NULL AND p_user_agent IS NULL AND p_user_device IS NULL
       AND p_user_browser IS NULL AND p_user_os IS NULL AND p_user_ip IS NULL
      THEN NULL
      ELSE json_build_object(
        'user_info', p_user_info,
        'user_agent', p_user_agent,
        'user_device', p_user_device,
        'user_browser', p_user_browser,
        'user_os', p_user_os,
        'user_ip', p_user_ip
      )::TEXT
    END INTO v_created_info;

    INSERT INTO public.org_inv_stock_tr (
      tenant_org_id, product_id, branch_id,
      transaction_type, quantity,
      qty_before, qty_after,
      reference_type, reference_id, reference_no,
      reason, processed_by, created_by, created_info,
      is_active, rec_status
    ) VALUES (
      p_tenant_org_id, r.product_id, p_branch_id,
      'STOCK_OUT', -v_qty_to_deduct,
      v_qty_before, v_qty_after,
      COALESCE(NULLIF(trim(p_reference_type), ''), 'ORDER'),
      COALESCE(p_reference_id, p_order_id),
      COALESCE(
        p_reference_no,
        (
          SELECT o.order_no
            FROM public.org_orders_mst o
           WHERE o.id = p_order_id
             AND o.tenant_org_id = p_tenant_org_id
           LIMIT 1
        )
      ),
      COALESCE(NULLIF(trim(p_reason), ''), 'Order sale deduction'),
      p_user_id,
      p_user_name,
      v_created_info,
      true,
      1
    );
  END LOOP;
END
$function$;
COMMENT ON FUNCTION public.deduct_retail_stock_for_order(uuid, uuid, uuid, text, uuid, text, uuid, text, text, text, text, text, text, text, text) IS 'Deducts retail stock for an order''s RETAIL_ITEMS lines (branch stock when a branch is given, else product stock) and writes STOCK_OUT movements. Measured lines deduct measured_qty in the base unit (MEASURE_REQUIRED when missing); count lines deduct quantity.';
-- Grants unchanged by CREATE OR REPLACE (service_role only, per P0).

-- ─── 7. Tax-document lines (e-invoice) ───────────────────────────────────────

-- A measured line is invoiced as 2.5 KGM, so the quantity becomes a decimal and the line keeps
-- the unit it was invoiced in.
ALTER TABLE public.org_tax_doc_items_dtl
  ALTER COLUMN quantity       TYPE NUMERIC(21,6),
  ALTER COLUMN price_per_unit TYPE NUMERIC(21,6),
  ADD COLUMN uom_code       TEXT NULL,
  ADD COLUMN uom_unece_code TEXT NULL;
COMMENT ON COLUMN public.org_tax_doc_items_dtl.quantity IS 'Invoiced quantity: billed measure for measured lines, piece count otherwise. QUANTITY precision (21,6).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.price_per_unit IS 'Invoiced price per unit. UNIT_PRICE precision (21,6).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.uom_code IS 'Snapshot of the order line unit at issue time (filled from the order line when the writer omits it).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.uom_unece_code IS 'Snapshot of the UN/ECE Rec 20 code written on the e-invoice; NULL for a custom unit without one (dimension fallback).';

UPDATE public.org_tax_doc_items_dtl d
   SET uom_code = i.uom_code,
       uom_unece_code = i.uom_unece_code
  FROM public.org_order_items_dtl i
 WHERE i.tenant_org_id = d.tenant_org_id AND i.id = d.order_item_id
   AND d.uom_code IS NULL;
-- Any line whose order line is not found was a piece line (no measured lines existed before 0814).
UPDATE public.org_tax_doc_items_dtl
   SET uom_code = 'PC', uom_unece_code = 'H87'
 WHERE uom_code IS NULL;

CREATE OR REPLACE FUNCTION public.fn_uom_taxdoc_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.uom_code IS NULL THEN
    SELECT i.uom_code, i.uom_unece_code INTO NEW.uom_code, NEW.uom_unece_code
      FROM public.org_order_items_dtl i
     WHERE i.tenant_org_id = NEW.tenant_org_id AND i.id = NEW.order_item_id;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_taxdoc_item_snapshot() IS 'BEFORE INSERT on org_tax_doc_items_dtl: copies the unit snapshot from the order line when the writer omits it. Reads only NEW.tenant_org_id rows.';
REVOKE ALL ON FUNCTION public.fn_uom_taxdoc_item_snapshot() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_taxdoc_item_uom BEFORE INSERT ON public.org_tax_doc_items_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_taxdoc_item_snapshot();
COMMENT ON TRIGGER trg_taxdoc_item_uom ON public.org_tax_doc_items_dtl IS 'Unit snapshot from the order line (fn_uom_taxdoc_item_snapshot).';

ALTER TABLE public.org_tax_doc_items_dtl ALTER COLUMN uom_code SET NOT NULL;

COMMIT;
