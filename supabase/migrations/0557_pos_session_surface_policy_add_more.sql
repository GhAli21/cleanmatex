-- =============================================================================
-- 0557_pos_session_surface_policy_add_more.sql
-- POS Session & Cash Drawer Hardening — per-screen POS-session policy, two more screens.
--
-- WHY
--   0554 introduced one requirement mode per finance screen on the scoped settings table
--   (org_fin_cash_ctrl_stng_cf): order entry, later collection, stored-value sales, cash refunds.
--   Two more money-moving screens need the same policy:
--     * pos_session_mode_cust_rcpt   — customer account receipts (Customers -> receive payment)
--     * pos_session_mode_manual_vchr — manual finance vouchers that carry a payment
--                                      (Finance -> Vouchers -> post)
--   Modes are identical to 0554: REQUIRED | REQUIRED_FOR_CASH | OPTIONAL | NULL (= inherit;
--   TS default OPTIONAL for both).
--
-- IDEMPOTENT BY DESIGN
--   0554's first draft was edited after it had been applied, and the added statements were run by
--   hand in the SQL editor. Every statement here is therefore safe to run whether or not those
--   hand-run statements already happened: columns use ADD COLUMN IF NOT EXISTS, check
--   constraints are dropped IF EXISTS and re-added (PostgreSQL has no ADD CONSTRAINT IF NOT
--   EXISTS), and COMMENT statements simply overwrite.
--
-- DATA
--   No data change. Existing override rows keep NULL = inherit for the new columns.
-- =============================================================================

ALTER TABLE public.org_fin_cash_ctrl_stng_cf
  ADD COLUMN IF NOT EXISTS pos_session_mode_cust_rcpt    TEXT NULL,
  ADD COLUMN IF NOT EXISTS pos_session_mode_manual_vchr  TEXT NULL;

-- Re-create the two check constraints so a hand-run (or missing) copy converges to this definition.
ALTER TABLE public.org_fin_cash_ctrl_stng_cf
  DROP CONSTRAINT IF EXISTS chk_ofccs_psm_cust_rcpt,
  DROP CONSTRAINT IF EXISTS chk_ofccs_psm_manual_vchr;

ALTER TABLE public.org_fin_cash_ctrl_stng_cf
  ADD CONSTRAINT chk_ofccs_psm_cust_rcpt
    CHECK (pos_session_mode_cust_rcpt IS NULL
           OR pos_session_mode_cust_rcpt IN ('REQUIRED', 'REQUIRED_FOR_CASH', 'OPTIONAL')),
  ADD CONSTRAINT chk_ofccs_psm_manual_vchr
    CHECK (pos_session_mode_manual_vchr IS NULL
           OR pos_session_mode_manual_vchr IN ('REQUIRED', 'REQUIRED_FOR_CASH', 'OPTIONAL'));

COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_cust_rcpt IS
  'POS-session requirement for customer account receipts (Customers -> receive payment / allocate): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_manual_vchr IS
  'POS-session requirement for posting a manual finance voucher that carries a payment (Finance -> Vouchers): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL.';

COMMENT ON CONSTRAINT chk_ofccs_psm_cust_rcpt ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_cust_rcpt; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
COMMENT ON CONSTRAINT chk_ofccs_psm_manual_vchr ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_manual_vchr; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
