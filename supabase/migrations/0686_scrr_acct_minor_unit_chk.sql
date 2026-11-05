-- ================================================================
-- GUARD: an ACCOUNTING rounding rule never rounds coarser than the
-- currency's own minor unit.
--
-- Why: order, tax and invoice totals are always exact to the currency's
-- decimals. Cash rounding belongs to the payment only: the change on a cash
-- tender is rounded by the CASH_CHANGE / CASH_TENDER rules and the gap is a
-- CASH_CHANGE_ROUNDING adjustment voucher (owner decision 2026-10-02, A6-1b;
-- web-admin/lib/services/cash-change-rounding.service.ts). The New Order quote
-- applies the ACCOUNTING rule to its total and Order Edit does not, so a coarse
-- ACCOUNTING rule would make Create and Edit disagree and would put a payment
-- detail into the order total.
--
-- Rule (context ACCOUNTING only; every other context is unchanged):
--   rounding_increment_minor IS NULL or 1   -- one minor unit, no snapping
--   output_decimal_places    IS NULL        -- the currency's minor_unit applies
--
-- Data checked 2026-10-31 (remote): 181 active ACCOUNTING rules, all with
-- increment 1 and output_decimal_places NULL, so the constraint validates
-- without touching any row.
-- Writers: HQ platform-api RoundingRuleService (same rule, coded error
-- ACCOUNTING_ROUNDING_TOO_COARSE) and currency-setup seed migrations.
-- Created     : 2026-10-31
-- Created by  : system_admin
-- Migration   : 0686_scrr_acct_minor_unit_chk.sql
-- Plan        : docs/features/Order_Fin/Reusable_Order_Fin_View/STATUS.md (P3-08 rounding finding)
-- ================================================================

BEGIN;

-- One CHECK on the row's own columns: no trigger, no lookup. Validated now.
ALTER TABLE public.sys_currency_rounding_rules_cf
  ADD CONSTRAINT chk_scrr_acct_minor_unit CHECK (
    rounding_context <> 'ACCOUNTING'
    OR ((rounding_increment_minor IS NULL OR rounding_increment_minor = 1)
        AND output_decimal_places IS NULL)
  );

COMMENT ON CONSTRAINT chk_scrr_acct_minor_unit ON public.sys_currency_rounding_rules_cf IS
  'An ACCOUNTING rule rounds to exactly one minor unit of the currency (increment NULL or 1, output_decimal_places NULL). Cash rounding is a payment concern (CASH_CHANGE / CASH_TENDER), never the order total.';

COMMIT;
