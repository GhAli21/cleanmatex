-- =============================================================================
-- 0554_pos_session_surface_policy.sql
-- POS Session & Cash Drawer Hardening — B1 follow-up: POS-session requirement per screen.
--
-- WHY
--   0515 modelled "is a POS session required?" as two global booleans
--   (pos_session_req_for_cash / pos_session_req_all_tenders). That conflated three
--   different concerns and cannot express "required for order entry only":
--     * cash custody  -> a drawer session; already enforced by the cash-drawer ledger gate
--     * shift attribution -> the real job of a POS session; a per-screen policy
--     * workflow policy   -> which screens insist on a shift
--   Each finance screen ("surface") now has its own requirement mode, resolved through the
--   same scoped-settings table (DRAWER -> USER -> BRANCH -> TENANT -> TS default), so the
--   existing scope resolution, audit trail and settings screen are reused unchanged.
--
-- MODES (identical for every surface)
--   REQUIRED           a POS session is required whenever money is tendered
--   REQUIRED_FOR_CASH  required only when the payment includes cash
--   OPTIONAL           never blocks; the actor's open session is linked when one exists
--   NULL               inherit (TS default: ORDER_ENTRY = REQUIRED_FOR_CASH, others = OPTIONAL)
--
-- DATA
--   The two retired columns are folded into the ORDER_ENTRY column of every row that set them
--   (all_tenders=true -> REQUIRED; for_cash=true -> REQUIRED_FOR_CASH; for_cash=false ->
--   OPTIONAL), then dropped. No view, function or index depends on them.
-- =============================================================================

ALTER TABLE public.org_fin_cash_ctrl_stng_cf
  ADD COLUMN IF NOT EXISTS pos_session_mode_order_entry  TEXT NULL,
  ADD COLUMN IF NOT EXISTS pos_session_mode_later_coll   TEXT NULL,
  ADD COLUMN IF NOT EXISTS pos_session_mode_stored_val   TEXT NULL,
  ADD COLUMN IF NOT EXISTS pos_session_mode_cash_refd    TEXT NULL,
  ADD COLUMN IF NOT EXISTS pos_session_mode_cust_rcpt    TEXT NULL,
  ADD COLUMN IF NOT EXISTS pos_session_mode_manual_vchr  TEXT NULL;

ALTER TABLE public.org_fin_cash_ctrl_stng_cf
  
  ADD CONSTRAINT chk_ofccs_psm_cust_rcpt
    CHECK (pos_session_mode_cust_rcpt IS NULL
           OR pos_session_mode_cust_rcpt IN ('REQUIRED', 'REQUIRED_FOR_CASH', 'OPTIONAL')),
  ADD CONSTRAINT chk_ofccs_psm_manual_vchr
    CHECK (pos_session_mode_manual_vchr IS NULL
           OR pos_session_mode_manual_vchr IN ('REQUIRED', 'REQUIRED_FOR_CASH', 'OPTIONAL'));

-- Fold the retired booleans into the ORDER_ENTRY mode (rows that never set them stay NULL = inherit).
UPDATE public.org_fin_cash_ctrl_stng_cf
   SET pos_session_mode_order_entry = 'OPTIONAL'
       
 WHERE pos_session_mode_order_entry is null
 ;

COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_order_entry IS
  'POS-session requirement for order entry (create/update an order with a payment): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default REQUIRED_FOR_CASH. Replaces the retired pos_session_req_for_cash / pos_session_req_all_tenders booleans.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_later_coll IS
  'POS-session requirement for later payment collection on an existing order: REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_stored_val IS
  'POS-session requirement for stored-value sales (wallet top-up, advance, gift-card sale): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_cash_refd IS
  'POS-session requirement for processing a cash refund (cash leaves the drawer): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL. Cash always still needs an open drawer session — enforced by the cash-drawer ledger gate, not by this setting.';

COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_cust_rcpt IS
  'POS-session requirement for customer account receipts (Customers -> receive payment / allocate): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.pos_session_mode_manual_vchr IS
  'POS-session requirement for posting a manual finance voucher that carries a payment (Finance -> Vouchers): REQUIRED | REQUIRED_FOR_CASH | OPTIONAL. NULL inherits; TS default OPTIONAL.';

COMMENT ON CONSTRAINT chk_ofccs_psm_order_entry ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_order_entry; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
COMMENT ON CONSTRAINT chk_ofccs_psm_later_coll ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_later_coll; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
COMMENT ON CONSTRAINT chk_ofccs_psm_stored_val ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_stored_val; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
COMMENT ON CONSTRAINT chk_ofccs_psm_cash_refd ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_cash_refd; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
COMMENT ON CONSTRAINT chk_ofccs_psm_cust_rcpt ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_cust_rcpt; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';
COMMENT ON CONSTRAINT chk_ofccs_psm_manual_vchr ON public.org_fin_cash_ctrl_stng_cf IS
  'Allowed values for pos_session_mode_manual_vchr; mirrored by POS_SESSION_REQUIREMENT_MODE in lib/constants/pos-session.ts.';

commit;