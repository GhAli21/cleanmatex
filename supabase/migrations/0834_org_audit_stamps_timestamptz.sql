-- Organization created_at, updated_at, and deleted_at become timestamptz.
-- Development rows may move. The session is UTC and writers store now(), so each naive value is a UTC wall.
-- A naive deleted_at found here converts in this same file. sys and hq stamps stay out until the HQ reader list.
-- Views that read these columns are dropped and recreated here. anon and authenticated are not granted.

BEGIN;

DROP VIEW IF EXISTS public.admin_locked_accounts RESTRICT;
DROP VIEW IF EXISTS public.vw_fin_coa_explorer RESTRICT;
DROP VIEW IF EXISTS public.vw_fin_open_exceptions RESTRICT;
DROP VIEW IF EXISTS public.vw_fin_tenant_readiness RESTRICT;
DROP VIEW IF EXISTS public.vw_hq_unified_audit_trail RESTRICT;
-- org_asm_exceptions_tr.created_at
ALTER TABLE public.org_asm_exceptions_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_exceptions_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_asm_exceptions_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_asm_exceptions_tr.updated_at
ALTER TABLE public.org_asm_exceptions_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_exceptions_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_items_dtl.created_at
ALTER TABLE public.org_asm_items_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_items_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_asm_items_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_asm_items_dtl.updated_at
ALTER TABLE public.org_asm_items_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_items_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_locations_mst.created_at
ALTER TABLE public.org_asm_locations_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_locations_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_asm_locations_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_asm_locations_mst.updated_at
ALTER TABLE public.org_asm_locations_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_locations_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_asm_tasks_mst.created_at
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_tasks_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_asm_tasks_mst.updated_at
ALTER TABLE public.org_asm_tasks_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_asm_tasks_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_b2b_contacts_dtl.created_at
ALTER TABLE public.org_b2b_contacts_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_b2b_contacts_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_b2b_contacts_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_b2b_contacts_dtl.updated_at
ALTER TABLE public.org_b2b_contacts_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_b2b_contacts_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_b2b_contracts_mst.created_at
ALTER TABLE public.org_b2b_contracts_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_b2b_contracts_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_b2b_contracts_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_b2b_contracts_mst.updated_at
ALTER TABLE public.org_b2b_contracts_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_b2b_contracts_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_b2b_statements_mst.created_at
ALTER TABLE public.org_b2b_statements_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_b2b_statements_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_b2b_statements_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_b2b_statements_mst.updated_at
ALTER TABLE public.org_b2b_statements_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_b2b_statements_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_branches_mst.created_at
ALTER TABLE public.org_branches_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_branches_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_branches_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_branches_mst.updated_at
ALTER TABLE public.org_branches_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_branches_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_customer_addresses.created_at
ALTER TABLE public.org_customer_addresses ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customer_addresses.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_customer_addresses ALTER COLUMN created_at SET DEFAULT now();

-- org_customer_addresses.updated_at
ALTER TABLE public.org_customer_addresses ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customer_addresses.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_customer_addresses ALTER COLUMN updated_at SET DEFAULT now();

-- org_customer_category_cf.created_at
ALTER TABLE public.org_customer_category_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customer_category_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_customer_category_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_customer_category_cf.updated_at
ALTER TABLE public.org_customer_category_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customer_category_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_customer_merge_log.created_at
ALTER TABLE public.org_customer_merge_log ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customer_merge_log.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_customer_merge_log ALTER COLUMN created_at SET DEFAULT now();

-- org_customer_merge_log.updated_at
ALTER TABLE public.org_customer_merge_log ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customer_merge_log.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_customers_mst.created_at
ALTER TABLE public.org_customers_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customers_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_customers_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_customers_mst.updated_at
ALTER TABLE public.org_customers_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customers_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_pod_tr.created_at
ALTER TABLE public.org_dlv_pod_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_pod_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_dlv_pod_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_dlv_pod_tr.updated_at
ALTER TABLE public.org_dlv_pod_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_pod_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_route_seq_cf.updated_at
ALTER TABLE public.org_dlv_route_seq_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_route_seq_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_dlv_route_seq_cf ALTER COLUMN updated_at SET DEFAULT now();

-- org_dlv_routes_mst.created_at
ALTER TABLE public.org_dlv_routes_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_routes_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_dlv_routes_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_dlv_routes_mst.updated_at
ALTER TABLE public.org_dlv_routes_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_routes_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_slots_mst.created_at
ALTER TABLE public.org_dlv_slots_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_slots_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_dlv_slots_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_dlv_slots_mst.updated_at
ALTER TABLE public.org_dlv_slots_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_slots_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_dlv_stops_dtl.created_at
ALTER TABLE public.org_dlv_stops_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_stops_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_dlv_stops_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_dlv_stops_dtl.updated_at
ALTER TABLE public.org_dlv_stops_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_dlv_stops_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_drivers_mst.created_at
ALTER TABLE public.org_drivers_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_drivers_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_drivers_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_drivers_mst.updated_at
ALTER TABLE public.org_drivers_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_drivers_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ff_overrides_cf.created_at
ALTER TABLE public.org_ff_overrides_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ff_overrides_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ff_overrides_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_ff_overrides_cf.updated_at
ALTER TABLE public.org_ff_overrides_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ff_overrides_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_acct_mst.created_at
ALTER TABLE public.org_fin_acct_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_acct_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_acct_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_acct_mst.updated_at
ALTER TABLE public.org_fin_acct_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_acct_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_alloc_rule_mst.created_at
ALTER TABLE public.org_fin_alloc_rule_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_alloc_rule_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_alloc_rule_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_alloc_rule_mst.updated_at
ALTER TABLE public.org_fin_alloc_rule_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_alloc_rule_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_alloc_run_dtl.created_at
ALTER TABLE public.org_fin_alloc_run_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_alloc_run_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_alloc_run_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_alloc_run_dtl.updated_at
ALTER TABLE public.org_fin_alloc_run_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_alloc_run_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_alloc_run_mst.created_at
ALTER TABLE public.org_fin_alloc_run_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_alloc_run_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_alloc_run_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_alloc_run_mst.updated_at
ALTER TABLE public.org_fin_alloc_run_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_alloc_run_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_ap_alloc_tr.created_at
ALTER TABLE public.org_fin_ap_alloc_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_alloc_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_ap_alloc_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_ap_alloc_tr.updated_at
ALTER TABLE public.org_fin_ap_alloc_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_alloc_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_ap_inv_dtl.created_at
ALTER TABLE public.org_fin_ap_inv_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_inv_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_ap_inv_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_ap_inv_dtl.updated_at
ALTER TABLE public.org_fin_ap_inv_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_inv_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_ap_inv_mst.created_at
ALTER TABLE public.org_fin_ap_inv_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_inv_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_ap_inv_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_ap_inv_mst.updated_at
ALTER TABLE public.org_fin_ap_inv_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_inv_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_ap_pmt_mst.created_at
ALTER TABLE public.org_fin_ap_pmt_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_pmt_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_ap_pmt_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_ap_pmt_mst.updated_at
ALTER TABLE public.org_fin_ap_pmt_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_ap_pmt_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_bank_acct_mst.created_at
ALTER TABLE public.org_fin_bank_acct_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_acct_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_bank_acct_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_bank_acct_mst.updated_at
ALTER TABLE public.org_fin_bank_acct_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_acct_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_bank_match_tr.created_at
ALTER TABLE public.org_fin_bank_match_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_match_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_bank_match_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_bank_match_tr.updated_at
ALTER TABLE public.org_fin_bank_match_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_match_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_bank_recon_mst.created_at
ALTER TABLE public.org_fin_bank_recon_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_recon_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_bank_recon_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_bank_recon_mst.updated_at
ALTER TABLE public.org_fin_bank_recon_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_recon_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_bank_stmt_dtl.created_at
ALTER TABLE public.org_fin_bank_stmt_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_stmt_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_bank_stmt_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_bank_stmt_dtl.updated_at
ALTER TABLE public.org_fin_bank_stmt_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_stmt_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_bank_stmt_mst.created_at
ALTER TABLE public.org_fin_bank_stmt_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_stmt_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_bank_stmt_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_bank_stmt_mst.updated_at
ALTER TABLE public.org_fin_bank_stmt_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_stmt_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cash_exc_tr.created_at
ALTER TABLE public.org_fin_cash_exc_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_exc_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cash_exc_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cash_exc_tr.updated_at
ALTER TABLE public.org_fin_cash_exc_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_exc_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cash_rec_mst.created_at
ALTER TABLE public.org_fin_cash_rec_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_rec_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cash_rec_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cash_rec_mst.updated_at
ALTER TABLE public.org_fin_cash_rec_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_rec_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cash_txn_tr.created_at
ALTER TABLE public.org_fin_cash_txn_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_txn_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cash_txn_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cash_txn_tr.updated_at
ALTER TABLE public.org_fin_cash_txn_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_txn_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cashbox_mst.created_at
ALTER TABLE public.org_fin_cashbox_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cashbox_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cashbox_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cashbox_mst.updated_at
ALTER TABLE public.org_fin_cashbox_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cashbox_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cost_cmp_cd.created_at
ALTER TABLE public.org_fin_cost_cmp_cd ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cost_cmp_cd.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cost_cmp_cd ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cost_cmp_cd.updated_at
ALTER TABLE public.org_fin_cost_cmp_cd ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cost_cmp_cd.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cost_run_dtl.created_at
ALTER TABLE public.org_fin_cost_run_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cost_run_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cost_run_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cost_run_dtl.updated_at
ALTER TABLE public.org_fin_cost_run_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cost_run_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_cost_run_mst.created_at
ALTER TABLE public.org_fin_cost_run_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cost_run_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_cost_run_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_cost_run_mst.updated_at
ALTER TABLE public.org_fin_cost_run_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cost_run_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_doc_appr_tr.created_at
ALTER TABLE public.org_fin_doc_appr_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_doc_appr_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_doc_appr_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_doc_appr_tr.updated_at
ALTER TABLE public.org_fin_doc_appr_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_doc_appr_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_doc_seq_mst.created_at
ALTER TABLE public.org_fin_doc_seq_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_doc_seq_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_doc_seq_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_doc_seq_mst.updated_at
ALTER TABLE public.org_fin_doc_seq_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_doc_seq_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_exp_dtl.created_at
ALTER TABLE public.org_fin_exp_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_exp_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_exp_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_exp_dtl.updated_at
ALTER TABLE public.org_fin_exp_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_exp_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_exp_mst.created_at
ALTER TABLE public.org_fin_exp_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_exp_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_exp_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_exp_mst.updated_at
ALTER TABLE public.org_fin_exp_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_exp_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_gov_assign_mst.created_at
ALTER TABLE public.org_fin_gov_assign_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_gov_assign_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_gov_assign_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_gov_assign_mst.updated_at
ALTER TABLE public.org_fin_gov_assign_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_gov_assign_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_journal_dtl.created_at
ALTER TABLE public.org_fin_journal_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_journal_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_journal_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_journal_dtl.updated_at
ALTER TABLE public.org_fin_journal_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_journal_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_journal_mst.created_at
ALTER TABLE public.org_fin_journal_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_journal_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_journal_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_journal_mst.updated_at
ALTER TABLE public.org_fin_journal_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_journal_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_period_mst.created_at
ALTER TABLE public.org_fin_period_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_period_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_period_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_period_mst.updated_at
ALTER TABLE public.org_fin_period_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_period_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_po_dtl.created_at
ALTER TABLE public.org_fin_po_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_po_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_po_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_po_dtl.updated_at
ALTER TABLE public.org_fin_po_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_po_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_po_mst.created_at
ALTER TABLE public.org_fin_po_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_po_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_po_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_po_mst.updated_at
ALTER TABLE public.org_fin_po_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_po_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_post_action_tr.created_at
ALTER TABLE public.org_fin_post_action_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_action_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_post_action_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_post_exc_tr.created_at
ALTER TABLE public.org_fin_post_exc_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_exc_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_post_exc_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_post_exc_tr.updated_at
ALTER TABLE public.org_fin_post_exc_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_exc_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_post_log_tr.created_at
ALTER TABLE public.org_fin_post_log_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_log_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_post_log_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_post_log_tr.updated_at
ALTER TABLE public.org_fin_post_log_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_log_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_post_snapshot_tr.created_at
ALTER TABLE public.org_fin_post_snapshot_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_post_snapshot_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_supp_ctc_dtl.created_at
ALTER TABLE public.org_fin_supp_ctc_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_supp_ctc_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_supp_ctc_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_supp_ctc_dtl.updated_at
ALTER TABLE public.org_fin_supp_ctc_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_supp_ctc_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_supp_mst.created_at
ALTER TABLE public.org_fin_supp_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_supp_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_supp_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_supp_mst.updated_at
ALTER TABLE public.org_fin_supp_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_supp_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_tpl_apply_log.created_at
ALTER TABLE public.org_fin_tpl_apply_log ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_tpl_apply_log.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_tpl_apply_log ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_tpl_apply_log.updated_at
ALTER TABLE public.org_fin_tpl_apply_log ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_tpl_apply_log.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_tpl_mat_tr.created_at
ALTER TABLE public.org_fin_tpl_mat_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_tpl_mat_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_tpl_mat_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_usage_map_mst.created_at
ALTER TABLE public.org_fin_usage_map_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_usage_map_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_usage_map_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_fin_usage_map_mst.updated_at
ALTER TABLE public.org_fin_usage_map_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_usage_map_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_gift_card_txn_dtl.created_at
ALTER TABLE public.org_gift_card_txn_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_gift_card_txn_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_gift_card_txn_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_gift_card_txn_dtl.updated_at
ALTER TABLE public.org_gift_card_txn_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_gift_card_txn_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_invoice_mst.created_at
ALTER TABLE public.org_invoice_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_invoice_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_invoice_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_invoice_mst.updated_at
ALTER TABLE public.org_invoice_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_invoice_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_camp_targets_dtl.created_at
ALTER TABLE public.org_ntf_camp_targets_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_camp_targets_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_camp_targets_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_camp_targets_dtl.updated_at
ALTER TABLE public.org_ntf_camp_targets_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_camp_targets_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_campaigns_mst.created_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_campaigns_mst.updated_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_channel_provider_cf.created_at
ALTER TABLE public.org_ntf_channel_provider_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_channel_provider_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_channel_provider_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_channel_provider_cf.updated_at
ALTER TABLE public.org_ntf_channel_provider_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_channel_provider_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_inbox_mst.created_at
ALTER TABLE public.org_ntf_inbox_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_inbox_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_inbox_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_inbox_mst.updated_at
ALTER TABLE public.org_ntf_inbox_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_inbox_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_outbox_dtl.created_at
ALTER TABLE public.org_ntf_outbox_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_outbox_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_outbox_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_outbox_dtl.updated_at
ALTER TABLE public.org_ntf_outbox_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_outbox_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_push_subs_dtl.created_at
ALTER TABLE public.org_ntf_push_subs_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_push_subs_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_push_subs_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_push_subs_dtl.updated_at
ALTER TABLE public.org_ntf_push_subs_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_push_subs_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_quota_override_cf.created_at
ALTER TABLE public.org_ntf_quota_override_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_quota_override_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_quota_override_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_quota_override_cf.updated_at
ALTER TABLE public.org_ntf_quota_override_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_quota_override_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_settings_cf.created_at
ALTER TABLE public.org_ntf_settings_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_settings_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_settings_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_settings_cf.updated_at
ALTER TABLE public.org_ntf_settings_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_settings_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_usage_apply_evt.created_at
ALTER TABLE public.org_ntf_usage_apply_evt ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_usage_apply_evt ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_usage_apply_evt.updated_at
ALTER TABLE public.org_ntf_usage_apply_evt ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_usage_apply_evt.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_usage_daily.created_at
ALTER TABLE public.org_ntf_usage_daily ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_usage_daily.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_usage_daily ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_usage_daily.updated_at
ALTER TABLE public.org_ntf_usage_daily ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_usage_daily.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_user_prefs_dtl.created_at
ALTER TABLE public.org_ntf_user_prefs_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_user_prefs_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_user_prefs_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_ntf_user_prefs_dtl.updated_at
ALTER TABLE public.org_ntf_user_prefs_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_user_prefs_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_edit_locks.created_at
ALTER TABLE public.org_order_edit_locks ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_edit_locks.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_order_edit_locks ALTER COLUMN created_at SET DEFAULT now();

-- org_order_edit_locks.updated_at
ALTER TABLE public.org_order_edit_locks ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_edit_locks.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_history.updated_at
ALTER TABLE public.org_order_history ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_history.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_issues.updated_at
ALTER TABLE public.org_order_issues ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_issues.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_item_pieces_dtl.created_at
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_order_item_pieces_dtl.updated_at
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_item_processing_steps.created_at
ALTER TABLE public.org_order_item_processing_steps ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_item_processing_steps.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_order_item_processing_steps ALTER COLUMN created_at SET DEFAULT now();

-- org_order_item_processing_steps.updated_at
ALTER TABLE public.org_order_item_processing_steps ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_item_processing_steps.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_items_dtl.created_at
ALTER TABLE public.org_order_items_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_items_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_order_items_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_order_items_dtl.updated_at
ALTER TABLE public.org_order_items_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_items_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_status_history.created_at
ALTER TABLE public.org_order_status_history ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_status_history.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_order_status_history ALTER COLUMN created_at SET DEFAULT now();

-- org_order_status_history.updated_at
ALTER TABLE public.org_order_status_history ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_status_history.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_orders_mst.created_at
ALTER TABLE public.org_orders_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_orders_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_orders_mst.updated_at
ALTER TABLE public.org_orders_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_orders_mst ALTER COLUMN updated_at SET DEFAULT now();

-- org_pck_packing_lists_mst.created_at
ALTER TABLE public.org_pck_packing_lists_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pck_packing_lists_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_pck_packing_lists_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_pck_packing_lists_mst.updated_at
ALTER TABLE public.org_pck_packing_lists_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pck_packing_lists_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_change_history_tr.created_at
ALTER TABLE public.org_pln_change_history_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_change_history_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_pln_change_history_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_pln_change_history_tr.updated_at
ALTER TABLE public.org_pln_change_history_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_change_history_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_subscriptions_mst.created_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_pln_subscriptions_mst.updated_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_preference_kind_cf.created_at
ALTER TABLE public.org_preference_kind_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_preference_kind_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_preference_kind_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_preference_kind_cf.updated_at
ALTER TABLE public.org_preference_kind_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_preference_kind_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_price_history_audit.created_at
ALTER TABLE public.org_price_history_audit ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_price_history_audit.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_price_history_audit ALTER COLUMN created_at SET DEFAULT now();

-- org_price_list_items_dtl.created_at
ALTER TABLE public.org_price_list_items_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_price_list_items_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_price_list_items_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_price_list_items_dtl.updated_at
ALTER TABLE public.org_price_list_items_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_price_list_items_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_price_lists_mst.created_at
ALTER TABLE public.org_price_lists_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_price_lists_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_price_lists_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_price_lists_mst.updated_at
ALTER TABLE public.org_price_lists_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_price_lists_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_product_data_mst.created_at
ALTER TABLE public.org_product_data_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_product_data_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_product_data_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_product_data_mst.updated_at
ALTER TABLE public.org_product_data_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_product_data_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_promotion_usage_dtl.created_at
ALTER TABLE public.org_promotion_usage_dtl ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_promotion_usage_dtl.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_promotion_usage_dtl ALTER COLUMN created_at SET DEFAULT now();

-- org_promotion_usage_dtl.updated_at
ALTER TABLE public.org_promotion_usage_dtl ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_promotion_usage_dtl.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_qa_decisions_tr.created_at
ALTER TABLE public.org_qa_decisions_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_qa_decisions_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_qa_decisions_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_qa_decisions_tr.updated_at
ALTER TABLE public.org_qa_decisions_tr ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_qa_decisions_tr.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_rcpt_receipts_mst.created_at
ALTER TABLE public.org_rcpt_receipts_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_rcpt_receipts_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_rcpt_receipts_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_rcpt_receipts_mst.updated_at
ALTER TABLE public.org_rcpt_receipts_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_rcpt_receipts_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_rcpt_templates_cf.created_at
ALTER TABLE public.org_rcpt_templates_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_rcpt_templates_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_rcpt_templates_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_rcpt_templates_cf.updated_at
ALTER TABLE public.org_rcpt_templates_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_rcpt_templates_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_service_category_cf.created_at
ALTER TABLE public.org_service_category_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_service_category_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_service_category_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_service_category_cf.updated_at
ALTER TABLE public.org_service_category_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_service_category_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_stng_audit_log_tr.created_at
ALTER TABLE public.org_stng_audit_log_tr ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_stng_audit_log_tr.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_stng_audit_log_tr ALTER COLUMN created_at SET DEFAULT now();

-- org_stng_effective_cache_cf.created_at
ALTER TABLE public.org_stng_effective_cache_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_stng_effective_cache_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_stng_effective_cache_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_stng_effective_cache_cf.updated_at
ALTER TABLE public.org_stng_effective_cache_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_stng_effective_cache_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_tenant_order_sources_cf.created_at
ALTER TABLE public.org_tenant_order_sources_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_tenant_order_sources_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_tenant_order_sources_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_tenant_order_sources_cf.updated_at
ALTER TABLE public.org_tenant_order_sources_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_tenant_order_sources_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_tenants_mst.created_at
ALTER TABLE public.org_tenants_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_tenants_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_tenants_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_tenants_mst.updated_at
ALTER TABLE public.org_tenants_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_tenants_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_usage_tracking.created_at
ALTER TABLE public.org_usage_tracking ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_usage_tracking.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_usage_tracking ALTER COLUMN created_at SET DEFAULT now();

-- org_usage_tracking.updated_at
ALTER TABLE public.org_usage_tracking ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_usage_tracking.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_usage_tracking ALTER COLUMN updated_at SET DEFAULT now();

-- org_users_mst.created_at
ALTER TABLE public.org_users_mst ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_users_mst.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_users_mst ALTER COLUMN created_at SET DEFAULT now();

-- org_users_mst.updated_at
ALTER TABLE public.org_users_mst ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_users_mst.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_workflow_rules.created_at
ALTER TABLE public.org_workflow_rules ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_workflow_rules.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_workflow_rules ALTER COLUMN created_at SET DEFAULT now();

-- org_workflow_rules.updated_at
ALTER TABLE public.org_workflow_rules ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_workflow_rules.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_workflow_settings_cf.created_at
ALTER TABLE public.org_workflow_settings_cf ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_workflow_settings_cf.created_at IS 'UTC instant (created_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_workflow_settings_cf ALTER COLUMN created_at SET DEFAULT now();

-- org_workflow_settings_cf.updated_at
ALTER TABLE public.org_workflow_settings_cf ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_workflow_settings_cf.updated_at IS 'UTC instant (updated_at). Converted from a naive stamp written while the database session was UTC.';

CREATE VIEW public.admin_locked_accounts AS
 SELECT au.id AS user_id,
    au.email,
    ou.display_name,
    ou.tenant_org_id,
    ou.failed_login_attempts,
    ou.last_failed_login_at,
    ou.locked_until,
    ou.lock_reason,
    ou.updated_at,
    EXTRACT(epoch FROM ou.locked_until - now()) / 60::numeric AS minutes_remaining
   FROM auth.users au
     JOIN org_users_mst ou ON au.id = ou.user_id
  WHERE ou.locked_until IS NOT NULL AND ou.locked_until > now()
  ORDER BY ou.locked_until DESC;;
COMMENT ON VIEW public.admin_locked_accounts IS 'Memberships whose lock expiry is still in the future. locked_until and last_failed_login_at are UTC instants. Service role only.';
REVOKE ALL ON TABLE public.admin_locked_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.admin_locked_accounts TO service_role;

CREATE VIEW public.vw_fin_coa_explorer AS
 WITH RECURSIVE account_path AS (
         SELECT a_1.id,
            a_1.tenant_org_id,
            a_1.name::text AS path_str,
            COALESCE(a_1.name2, a_1.name)::text AS path_str2
           FROM org_fin_acct_mst a_1
          WHERE a_1.parent_account_id IS NULL AND a_1.rec_status = 1
        UNION ALL
         SELECT c.id,
            c.tenant_org_id,
            (p.path_str || ' > '::text) || c.name::text AS path_str,
            (p.path_str2 || ' > '::text) || COALESCE(c.name2, c.name)::text AS path_str2
           FROM org_fin_acct_mst c
             JOIN account_path p ON p.id = c.parent_account_id AND p.tenant_org_id = c.tenant_org_id
          WHERE c.rec_status = 1
        ), usage_map_counts AS (
         SELECT org_fin_usage_map_mst.tenant_org_id,
            org_fin_usage_map_mst.account_id,
            count(*) AS active_usage_map_count
           FROM org_fin_usage_map_mst
          WHERE org_fin_usage_map_mst.status_code::text = 'ACTIVE'::text AND org_fin_usage_map_mst.is_active = true AND org_fin_usage_map_mst.rec_status = 1 AND (org_fin_usage_map_mst.effective_from IS NULL OR org_fin_usage_map_mst.effective_from <= CURRENT_DATE) AND (org_fin_usage_map_mst.effective_to IS NULL OR org_fin_usage_map_mst.effective_to >= CURRENT_DATE)
          GROUP BY org_fin_usage_map_mst.tenant_org_id, org_fin_usage_map_mst.account_id
        )
 SELECT a.id AS account_id,
    a.tenant_org_id,
    a.account_code,
    a.name,
    a.name2,
    a.description,
    a.description2,
    a.parent_account_id,
    pa.account_code AS parent_account_code,
    pa.name AS parent_account_name,
    pa.name2 AS parent_account_name2,
    COALESCE(a.account_level::integer, 0) AS account_level,
    ap.path_str AS full_path,
    ap.path_str2 AS full_path2,
    a.acc_type_id,
    at.acc_type_code,
    at.name AS acc_type_name,
    at.name2 AS acc_type_name2,
    at.normal_balance AS normal_balance_side,
    a.acc_group_id,
    ag.name AS acc_group_name,
    ag.name2 AS acc_group_name2,
    a.is_postable,
    a.is_control_account,
    a.is_system_linked,
    a.manual_post_allowed,
    COALESCE(a.is_system_seeded, false) AS is_system_seeded,
    COALESCE(a.is_locked, false) AS is_locked,
    COALESCE(a.allow_tenant_children, true) AS allow_tenant_children,
    a.effective_from,
    a.effective_to,
        CASE
            WHEN a.is_active = false OR a.rec_status <> 1 THEN 'INACTIVE'::text
            WHEN COALESCE(a.is_locked, false) = true THEN 'SYSTEM_LOCKED'::text
            WHEN a.is_postable = false THEN 'NOT_POSTABLE'::text
            WHEN a.effective_to IS NOT NULL AND a.effective_to < CURRENT_DATE THEN 'EXPIRED'::text
            ELSE 'ACTIVE'::text
        END AS account_status,
    COALESCE(umc.active_usage_map_count, 0::bigint) AS active_usage_map_count,
    a.source_tpl_pkg_id,
    a.source_tpl_line_id,
    a.is_active,
    a.rec_status,
    a.created_at,
    a.created_by,
    a.updated_at,
    a.updated_by
   FROM org_fin_acct_mst a
     LEFT JOIN sys_fin_acc_type_cd at ON at.acc_type_id = a.acc_type_id
     LEFT JOIN sys_fin_acc_group_cd ag ON ag.acc_group_id = a.acc_group_id
     LEFT JOIN org_fin_acct_mst pa ON pa.id = a.parent_account_id AND pa.tenant_org_id = a.tenant_org_id
     LEFT JOIN account_path ap ON ap.id = a.id AND ap.tenant_org_id = a.tenant_org_id
     LEFT JOIN usage_map_counts umc ON umc.account_id = a.id AND umc.tenant_org_id = a.tenant_org_id
  WHERE a.rec_status = 1;;
COMMENT ON VIEW public.vw_fin_coa_explorer IS 'Enriched COA explorer view for the tenant Chart of Accounts screen. Pre-joins account type, group, parent, and derives the full ancestry path and account_status label. active_usage_map_count shows how many active usage-code mappings point to this account (protected account guardrail). Used by COA Explorer list, tree mode, and protected-account badge logic. Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.vw_fin_coa_explorer FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_fin_coa_explorer TO service_role;

CREATE VIEW public.vw_fin_open_exceptions AS
 SELECT e.id AS exception_id,
    e.tenant_org_id,
    e.branch_id,
    e.posting_log_id,
    e.source_doc_id,
    e.source_doc_type_code,
    e.txn_event_code,
    e.exception_type_code,
    e.status_code,
    e.error_message,
    e.resolution_notes,
    e.resolved_at,
    e.resolved_by,
    e.created_at,
    e.created_by,
    pl.idempotency_key,
    pl.attempt_no,
    pl.attempt_status_code,
    pl.log_status_code,
    pl.source_module_code,
    pl.source_doc_no,
    pl.mapping_rule_id,
    pl.mapping_rule_version_no,
    pl.error_code AS log_error_code,
    pl.retry_of_log_id,
    pl.repost_of_log_id,
    pl.journal_id,
        CASE
            WHEN e.status_code::text = ANY (ARRAY['NEW'::character varying, 'OPEN'::character varying, 'RETRY_PENDING'::character varying]::text[]) THEN true
            ELSE false
        END AS is_retry_eligible,
        CASE
            WHEN e.status_code::text = ANY (ARRAY['NEW'::character varying, 'OPEN'::character varying, 'RETRY_PENDING'::character varying, 'RETRIED'::character varying, 'REPOST_PENDING'::character varying]::text[]) THEN true
            ELSE false
        END AS is_repost_eligible
   FROM org_fin_post_exc_tr e
     LEFT JOIN org_fin_post_log_tr pl ON pl.id = e.posting_log_id AND pl.tenant_org_id = e.tenant_org_id
  WHERE (e.status_code::text <> ALL (ARRAY['RESOLVED'::character varying, 'IGNORED'::character varying, 'CLOSED'::character varying]::text[])) AND e.is_active = true AND e.rec_status = 1;;
COMMENT ON VIEW public.vw_fin_open_exceptions IS 'Operational queue of all non-terminal posting exceptions with posting-log context. Powers the Exception Workbench list. Excludes RESOLVED, IGNORED, and CLOSED exceptions. is_retry_eligible and is_repost_eligible are hints; service layer enforces policy. Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.vw_fin_open_exceptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_fin_open_exceptions TO service_role;

CREATE VIEW public.vw_fin_tenant_readiness AS
 WITH missing_maps AS (
         SELECT vw_fin_missing_required_usage.tenant_org_id,
            count(*) FILTER (WHERE vw_fin_missing_required_usage.mapping_issue <> 'OK'::text) AS missing_or_broken_count,
            count(*) AS total_required_count
           FROM vw_fin_missing_required_usage
          GROUP BY vw_fin_missing_required_usage.tenant_org_id
        ), open_exc AS (
         SELECT org_fin_post_exc_tr.tenant_org_id,
            count(*) AS open_exception_count
           FROM org_fin_post_exc_tr
          WHERE (org_fin_post_exc_tr.status_code::text <> ALL (ARRAY['RESOLVED'::character varying, 'IGNORED'::character varying, 'CLOSED'::character varying]::text[])) AND org_fin_post_exc_tr.is_active = true AND org_fin_post_exc_tr.rec_status = 1
          GROUP BY org_fin_post_exc_tr.tenant_org_id
        ), open_periods AS (
         SELECT org_fin_period_mst.tenant_org_id,
            count(*) AS open_period_count
           FROM org_fin_period_mst
          WHERE org_fin_period_mst.status_code::text = 'OPEN'::text AND org_fin_period_mst.is_active = true AND org_fin_period_mst.rec_status = 1
          GROUP BY org_fin_period_mst.tenant_org_id
        ), last_apply AS (
         SELECT DISTINCT ON (org_fin_tpl_apply_log.tenant_org_id) org_fin_tpl_apply_log.tenant_org_id,
            org_fin_tpl_apply_log.applied_at AS last_template_applied_at,
            org_fin_tpl_apply_log.tpl_pkg_code AS last_template_pkg_code,
            org_fin_tpl_apply_log.apply_result_code AS last_apply_status
           FROM org_fin_tpl_apply_log
          ORDER BY org_fin_tpl_apply_log.tenant_org_id, org_fin_tpl_apply_log.applied_at DESC
        ), last_post AS (
         SELECT org_fin_post_log_tr.tenant_org_id,
            max(org_fin_post_log_tr.created_at) FILTER (WHERE org_fin_post_log_tr.log_status_code::text = 'POSTED'::text) AS last_posted_at,
            max(org_fin_post_log_tr.created_at) FILTER (WHERE org_fin_post_log_tr.log_status_code::text = 'FAILED'::text) AS last_failed_at
           FROM org_fin_post_log_tr
          GROUP BY org_fin_post_log_tr.tenant_org_id
        ), coa_stats AS (
         SELECT org_fin_acct_mst.tenant_org_id,
            count(*) AS total_accounts,
            count(*) FILTER (WHERE org_fin_acct_mst.is_postable = true) AS postable_accounts,
            count(*) FILTER (WHERE org_fin_acct_mst.is_active = false) AS inactive_accounts
           FROM org_fin_acct_mst
          WHERE org_fin_acct_mst.rec_status = 1
          GROUP BY org_fin_acct_mst.tenant_org_id
        ), gov_assign AS (
         SELECT vw_fin_effective_gov_for_tenant.tenant_org_id
           FROM vw_fin_effective_gov_for_tenant
        )
 SELECT t.id AS tenant_org_id,
    COALESCE(mm.missing_or_broken_count, 0::bigint) AS missing_required_mappings,
    COALESCE(mm.total_required_count, 0::bigint) AS total_required_mappings,
    COALESCE(oe.open_exception_count, 0::bigint) AS open_exception_count,
    COALESCE(op.open_period_count, 0::bigint) AS open_period_count,
    la.last_template_applied_at,
    la.last_template_pkg_code,
    la.last_apply_status,
    lp.last_posted_at,
    lp.last_failed_at,
    COALESCE(cs.total_accounts, 0::bigint) AS total_coa_accounts,
    COALESCE(cs.postable_accounts, 0::bigint) AS postable_coa_accounts,
    COALESCE(cs.inactive_accounts, 0::bigint) AS inactive_coa_accounts,
        CASE
            WHEN ga.tenant_org_id IS NOT NULL THEN true
            ELSE false
        END AS has_gov_assignment,
        CASE
            WHEN COALESCE(mm.missing_or_broken_count, 0::bigint) > 0 THEN 'NOT_READY'::text
            WHEN COALESCE(op.open_period_count, 0::bigint) = 0 THEN 'NOT_READY'::text
            WHEN ga.tenant_org_id IS NULL THEN 'NOT_READY'::text
            WHEN COALESCE(oe.open_exception_count, 0::bigint) > 0 THEN 'WARNING'::text
            WHEN la.last_apply_status IS NULL THEN 'WARNING'::text
            ELSE 'READY'::text
        END AS readiness_status
   FROM org_tenants_mst t
     LEFT JOIN missing_maps mm ON mm.tenant_org_id = t.id
     LEFT JOIN open_exc oe ON oe.tenant_org_id = t.id
     LEFT JOIN open_periods op ON op.tenant_org_id = t.id
     LEFT JOIN last_apply la ON la.tenant_org_id = t.id
     LEFT JOIN last_post lp ON lp.tenant_org_id = t.id
     LEFT JOIN coa_stats cs ON cs.tenant_org_id = t.id
     LEFT JOIN gov_assign ga ON ga.tenant_org_id = t.id
  WHERE t.is_active = true AND t.rec_status = 1;;
COMMENT ON VIEW public.vw_fin_tenant_readiness IS 'Finance readiness summary per tenant. readiness_status: READY, WARNING, NOT_READY. NOT_READY when: missing required usage mappings, no open period, or no governance assignment. WARNING when: open unresolved exceptions exist or template never applied. Used by readiness dashboard and HQ rollout tools. Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.vw_fin_tenant_readiness FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_fin_tenant_readiness TO service_role;

CREATE VIEW public.vw_hq_unified_audit_trail AS
 SELECT h.id,
    h.seq_no,
    'hq_audit_logs'::text AS audit_silo,
    h.created_at,
    h.user_id,
    h.user_email,
    COALESCE(h.actor_type, 'hq_admin'::text) AS actor_type,
    h.actor_role_code,
    h.impersonated_user_id,
    h.tenant_org_id,
    h.action,
    COALESCE(h.action_category,
        CASE
            WHEN h.action::text ~~* '%create%'::text OR h.action::text ~~* '%insert%'::text THEN 'create'::text
            WHEN h.action::text ~~* '%delete%'::text OR h.action::text ~~* '%remove%'::text THEN 'delete'::text
            WHEN h.action::text ~~* '%login%'::text OR h.action::text ~~* '%auth%'::text THEN 'auth'::text
            ELSE 'update'::text
        END) AS action_category,
    COALESCE(h.resource_type, 'platform'::character varying) AS resource_type,
    h.resource_id,
    COALESCE(h.resource_label, h.resource_type::text || COALESCE(' #'::text || h.resource_id::text, ''::text)) AS resource_label,
    COALESCE(h.source_module, h.resource_type::text, 'platform'::text) AS source_module,
    COALESCE(h.severity, 'info'::text) AS severity,
    h.old_value,
    h.new_value,
    h.details,
    h.changed_fields,
    h.change_reason,
    h.tags,
    h.is_sensitive,
    h.request_id,
    h.session_id,
    h.batch_id,
    h.parent_audit_id,
    h.ip_address::text AS ip_address,
    h.user_agent,
    h.http_method,
    h.http_path,
    h.http_status_code,
    h.duration_ms,
    COALESCE(h.success, true) AS success,
    h.error_message,
    COALESCE(h.origin_service, 'platform-api'::character varying) AS origin_service,
    h.prev_hash,
    h.row_hash
   FROM hq_audit_logs h
UNION ALL
 SELECT ff.id,
    NULL::bigint AS seq_no,
    'hq_ff_audit_history_tr'::text AS audit_silo,
    ff.created_at,
    NULL::uuid AS user_id,
    COALESCE(ff.performed_by_email::text, ff.performed_by::text, 'hq_admin'::text) AS user_email,
    'hq_admin'::text AS actor_type,
    NULL::character varying(50) AS actor_role_code,
    NULL::uuid AS impersonated_user_id,
    ff.tenant_org_id,
    'feature_flag.'::text || lower(COALESCE(ff.action::text, 'update'::text)) AS action,
        CASE
            WHEN ff.action::text ~~* '%create%'::text THEN 'create'::text
            WHEN ff.action::text ~~* '%delete%'::text THEN 'delete'::text
            ELSE 'config'::text
        END AS action_category,
    COALESCE(ff.entity_type::text, 'feature_flag'::text) AS resource_type,
    COALESCE(ff.flag_key::text, ff.entity_id::text) AS resource_id,
    ff.flag_key::text AS resource_label,
    'feature-flags'::text AS source_module,
    'info'::text AS severity,
    ff.before_value AS old_value,
    ff.after_value AS new_value,
    jsonb_build_object('change_type', ff.change_type, 'performed_info', ff.performed_info) AS details,
    NULL::text[] AS changed_fields,
    ff.performed_info AS change_reason,
    ARRAY['feature-flags'::text, COALESCE(ff.flag_key::text, ''::text)] AS tags,
    false AS is_sensitive,
    NULL::text AS request_id,
    NULL::text AS session_id,
        CASE
            WHEN ff.bulk_operation_id IS NOT NULL AND ff.bulk_operation_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text THEN ff.bulk_operation_id::text::uuid
            ELSE NULL::uuid
        END AS batch_id,
    NULL::uuid AS parent_audit_id,
    ff.ip_address::text AS ip_address,
    ff.user_agent,
    NULL::text AS http_method,
    NULL::text AS http_path,
    NULL::smallint AS http_status_code,
    NULL::integer AS duration_ms,
    true AS success,
    NULL::text AS error_message,
    'platform-api'::character varying(40) AS origin_service,
    NULL::text AS prev_hash,
    NULL::text AS row_hash
   FROM hq_ff_audit_history_tr ff
UNION ALL
 SELECT st.id,
    NULL::bigint AS seq_no,
    'org_stng_audit_log_tr'::text AS audit_silo,
    COALESCE(st.changed_at, st.created_at::timestamp with time zone) AS created_at,
    st.user_id,
    COALESCE(st.changed_by_name::text, st.changed_by::text, 'system'::text) AS user_email,
    'hq_admin'::text AS actor_type,
    NULL::character varying(50) AS actor_role_code,
    NULL::uuid AS impersonated_user_id,
    st.tenant_org_id,
    'setting.'::text || lower(COALESCE(st.stng_audit_action, 'update'::text)) AS action,
    'config'::text AS action_category,
    'setting'::text AS resource_type,
    st.stng_code AS resource_id,
    ((st.stng_code || ' ('::text) || COALESCE(st.stng_audit_scope, 'TENANT'::text)) || ')'::text AS resource_label,
    'settings'::text AS source_module,
    'info'::text AS severity,
    st.stng_before_value_jsonb AS old_value,
    st.stng_after_value_jsonb AS new_value,
    jsonb_build_object('scope', st.stng_audit_scope, 'branch_id', st.branch_id) AS details,
    NULL::text[] AS changed_fields,
    st.stng_change_reason AS change_reason,
    ARRAY['settings'::text, COALESCE(st.stng_code, ''::text), COALESCE(st.stng_audit_scope, ''::text)] AS tags,
    false AS is_sensitive,
    st.stng_request_id AS request_id,
    NULL::text AS session_id,
    NULL::uuid AS batch_id,
    NULL::uuid AS parent_audit_id,
    st.stng_ip_address AS ip_address,
    NULL::text AS user_agent,
    NULL::text AS http_method,
    NULL::text AS http_path,
    NULL::smallint AS http_status_code,
    NULL::integer AS duration_ms,
    true AS success,
    NULL::text AS error_message,
    'platform-api'::character varying(40) AS origin_service,
    NULL::text AS prev_hash,
    NULL::text AS row_hash
   FROM org_stng_audit_log_tr st;;
COMMENT ON VIEW public.vw_hq_unified_audit_trail IS 'Unified cross-silo read view combining hq_audit_logs, hq_ff_audit_history_tr, and org_stng_audit_log_tr for the HQ Audit & Forensics Explorer';
REVOKE ALL ON TABLE public.vw_hq_unified_audit_trail FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_hq_unified_audit_trail TO service_role;

COMMIT;
