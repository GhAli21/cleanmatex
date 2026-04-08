-- ============================================================
-- ERP Lite Data Cleanup Script
-- PURPOSE: Delete all DATA from ERP Lite TENANT (org_fin_) tables only
--          (schema, functions, views, and sys_ tables are untouched)
-- WARNING: Irreversible — use in dev/test only
-- ============================================================

-- ============================================================
-- PARAMETER — set before running
-- ============================================================
-- To delete a specific tenant:   v_tenant_id := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- To delete ALL tenants:         v_tenant_id := 'ALL'
-- ============================================================

DO $$
DECLARE
  v_tenant_id TEXT := '11111111-1111-1111-1111-111111111111';  -- <-- SET THIS: specific UUID or 'ALL'

  -- FK dependency order derived from migrations (children first, parents last):
  --
  -- Level 1 — deepest children (no org_fin_ children of their own)
  --   org_fin_post_action_tr    → org_fin_post_exc_tr, org_fin_post_log_tr
  --   org_fin_post_snapshot_tr  → org_fin_post_log_tr, org_fin_journal_mst
  --   org_fin_tpl_mat_tr        → org_fin_tpl_apply_log
  --   org_fin_bank_match_tr     → org_fin_bank_stmt_dtl, org_fin_bank_recon_mst
  --   org_fin_cash_exc_tr       → org_fin_cash_rec_mst
  --   org_fin_alloc_run_dtl     → org_fin_alloc_run_mst, org_fin_alloc_rule_mst
  --   org_fin_cost_run_dtl      → org_fin_cost_run_mst, org_fin_cost_cmp_cd
  --   org_fin_ap_alloc_tr       → org_fin_ap_pmt_mst, org_fin_ap_inv_mst
  --   org_fin_ap_inv_dtl        → org_fin_ap_inv_mst, org_fin_po_dtl
  --   org_fin_exp_dtl           → org_fin_exp_mst
  --   org_fin_journal_dtl       → org_fin_journal_mst, org_fin_acct_mst
  --   org_fin_cash_txn_tr       → org_fin_cashbox_mst
  --
  -- Level 2 — mid-level parents
  --   org_fin_post_exc_tr       → org_fin_post_log_tr
  --   org_fin_post_log_tr       → org_fin_journal_mst (self-FK retry/repost)
  --   org_fin_bank_recon_mst    → org_fin_bank_acct_mst, org_fin_period_mst
  --   org_fin_bank_stmt_dtl     → org_fin_bank_stmt_mst, org_fin_bank_acct_mst
  --   org_fin_cash_rec_mst      → org_fin_cashbox_mst
  --   org_fin_alloc_run_mst     → org_fin_period_mst
  --   org_fin_cost_run_mst      → org_fin_period_mst
  --   org_fin_ap_pmt_mst        → org_fin_supp_mst, org_fin_bank_acct_mst, org_fin_cashbox_mst
  --   org_fin_ap_inv_mst        → org_fin_supp_mst, org_fin_po_mst
  --   org_fin_po_dtl            → org_fin_po_mst
  --   org_fin_supp_ctc_dtl      → org_fin_supp_mst
  --
  -- Level 3 — grandparent tables
  --   org_fin_journal_mst       → (self-FK reversal_of_journal_id only)
  --   org_fin_bank_stmt_mst     → org_fin_bank_acct_mst
  --   org_fin_cashbox_mst       → org_fin_acct_mst
  --   org_fin_bank_acct_mst     → org_fin_acct_mst
  --   org_fin_supp_mst          → org_fin_acct_mst
  --   org_fin_po_mst            → org_fin_supp_mst
  --   org_fin_alloc_rule_mst    → (no org_fin_ FK)
  --   org_fin_cost_cmp_cd       → (no org_fin_ FK)
  --   org_fin_exp_mst           → (no org_fin_ FK)
  --   org_fin_tpl_apply_log     → (no org_fin_ FK)
  --   org_fin_doc_appr_tr       → (no org_fin_ FK)
  --   org_fin_doc_seq_mst       → (no org_fin_ FK)
  --   org_fin_gov_assign_mst    → (no org_fin_ FK)
  --
  -- Level 4 — root parents
  --   org_fin_usage_map_mst     → org_fin_acct_mst
  --   org_fin_period_mst        → (no org_fin_ FK)
  --   org_fin_acct_mst          → (self-FK parent_account_id only)

  v_tables TEXT[] := ARRAY[
    -- Level 1: deepest children
    'org_fin_post_action_tr',
    'org_fin_post_snapshot_tr',
    'org_fin_tpl_mat_tr',
    'org_fin_bank_match_tr',
    'org_fin_cash_exc_tr',
    'org_fin_alloc_run_dtl',
    'org_fin_cost_run_dtl',
    'org_fin_ap_alloc_tr',
    'org_fin_ap_inv_dtl',
    'org_fin_exp_dtl',
    'org_fin_journal_dtl',
    'org_fin_cash_txn_tr',
    -- Level 2: mid-level parents
    'org_fin_post_exc_tr',
    'org_fin_post_log_tr',
    'org_fin_bank_recon_mst',
    'org_fin_bank_stmt_dtl',
    'org_fin_cash_rec_mst',
    'org_fin_alloc_run_mst',
    'org_fin_cost_run_mst',
    'org_fin_ap_pmt_mst',
    'org_fin_ap_inv_mst',
    'org_fin_po_dtl',
    'org_fin_supp_ctc_dtl',
    -- Level 3: grandparents
    'org_fin_journal_mst',
    'org_fin_bank_stmt_mst',
    'org_fin_cashbox_mst',
    'org_fin_bank_acct_mst',
    'org_fin_po_mst',
    'org_fin_supp_mst',
    'org_fin_alloc_rule_mst',
    'org_fin_cost_cmp_cd',
    'org_fin_exp_mst',
    'org_fin_tpl_apply_log',
    'org_fin_doc_appr_tr',
    'org_fin_doc_seq_mst',
    'org_fin_gov_assign_mst',
    -- Level 4: roots
    'org_fin_usage_map_mst',
    'org_fin_period_mst',
    'org_fin_acct_mst'
  ];

  v_tbl   TEXT;
  v_sql   TEXT;
  v_count BIGINT;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ERP Lite Tenant Data Cleanup';
  RAISE NOTICE 'Target: %', CASE WHEN v_tenant_id = 'ALL' THEN 'ALL TENANTS' ELSE 'tenant_org_id = ' || v_tenant_id END;
  RAISE NOTICE '============================================================';

  -- Unlock seeded/locked accounts before deleting so the guard trigger allows it
  IF v_tenant_id = 'ALL' THEN
    UPDATE public.org_fin_acct_mst SET is_system_seeded = false, is_locked = false;
  ELSE
    UPDATE public.org_fin_acct_mst SET is_system_seeded = false, is_locked = false
    WHERE tenant_org_id = v_tenant_id::uuid;
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_tbl
    ) THEN
      IF v_tenant_id = 'ALL' THEN
        v_sql := format('DELETE FROM %I', v_tbl);
      ELSE
        v_sql := format('DELETE FROM %I WHERE tenant_org_id = %L::uuid', v_tbl, v_tenant_id);
      END IF;

      EXECUTE v_sql;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RAISE NOTICE '  ✓ %-38s  % rows deleted', v_tbl, v_count;
    ELSE
      RAISE NOTICE '  - %-38s  table not found, skipped', v_tbl;
    END IF;
  END LOOP;

  Commit;
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Done.';
  RAISE NOTICE '============================================================';
END $$;
