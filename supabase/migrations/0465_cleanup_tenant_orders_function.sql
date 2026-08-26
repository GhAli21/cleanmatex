-- ==================================================================
-- Migration: 0465_cleanup_tenant_orders_function
-- Purpose: HQ Console "Delete Orders" (tenant maintenance) — single-tenant,
--   parameterized port of
--   supabase/snippets/cleanup_all_order_data_all_tenants_or_one_tenant_fixed.sql
--   (validated against real data 2026-08-22/26) into a SECURITY DEFINER
--   function callable only by platform-api's service-role key.
--
-- Deliberate deviations from the source script (see cleanmatexsaas plan
-- "HQ Console: Delete Orders (Tenant Maintenance)" for full rationale):
--   - No all-tenants mode: p_tenant_org_id is required (checked explicitly
--     below), so cleanup_all_tenants and its OR-tenant_org_id guard clauses
--     do not exist here at all — every WHERE clause is a plain
--     tenant_org_id = p_tenant_org_id.
--   - No manual cleanup_order_ids/cleanup_order_nos staging tables —
--     SPECIFIC_ORDERS mode is served directly from p_order_ids / p_order_nos
--     arrays.
--   - include_invoice_rows / include_order_payment_rows / include_voucher_rows /
--     include_wallet_rows / include_advance_rows / include_gift_card_rows /
--     include_credit_note_rows / include_loyalty_rows / update_*_masters are
--     all hardcoded to the script's shipped default of true (not
--     parameterized in v1) — their gating conditions are simply absent below.
--   - delete_empty_wallet_accounts / delete_empty_advance_accounts /
--     delete_empty_loyalty_accounts / delete_orphan_credit_note_headers /
--     delete_orphan_gift_card_masters are hardcoded false (not parameterized
--     in v1) — the source script's "optional orphan/empty master delete"
--     section is entirely omitted here.
--   - fail_on_uncovered_refs is always on (not a parameter) — non-negotiable
--     safety net.
--   - Guard-rail violations (uncovered related rows found; targeted order
--     count exceeds p_max_target_orders) do NOT raise a Postgres exception.
--     They are returned as blocked = true / block_reasons = [...] so a
--     preview call (p_dry_run = true) always succeeds and the caller can
--     render why execution would be refused. Malformed input (bad
--     p_target_mode, or a mode missing its required companion parameter)
--     still raises — that is a caller bug, not a data-dependent condition.
--   - Zero matching orders is not an error — it is a normal empty result
--     (targeted_order_count = 0), matching a UI where a not-yet-matching
--     filter is a routine state, not a failure.
--   - p_created_from / p_created_to are TIMESTAMP (no time zone), matching
--     org_orders_mst.created_at's actual column type — avoids an implicit
--     timezone conversion that timestamptz parameters would introduce.
--   - GRANT EXECUTE is service_role ONLY (never authenticated). Unlike
--     fix_order_data (0113_fix_order_data_add_dry_run.sql), which grants
--     both, this function performs cross-order-data deletes under
--     SECURITY DEFINER and must only be reachable through platform-api,
--     never directly from a tenant session via the Supabase client SDK.
-- ==================================================================

BEGIN;

CREATE OR REPLACE FUNCTION cleanup_tenant_orders(
  p_tenant_org_id UUID,
  p_target_mode TEXT DEFAULT 'ALL_TENANT_ORDERS',
  p_order_ids UUID[] DEFAULT NULL,
  p_order_nos TEXT[] DEFAULT NULL,
  p_order_no_like TEXT DEFAULT NULL,
  p_created_from TIMESTAMP DEFAULT NULL,
  p_created_to TIMESTAMP DEFAULT NULL,
  p_include_fin_audit_rows BOOLEAN DEFAULT false,
  p_max_target_orders INT DEFAULT 200,
  p_dry_run BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_count          INTEGER;
  v_uncovered_count       BIGINT;
  v_blocked               BOOLEAN := false;
  v_block_reasons         TEXT[]  := ARRAY[]::TEXT[];
  v_target_summary        JSONB;
  v_master_repair_preview JSONB;
  v_uncovered_refs        JSONB;
  v_verification          JSONB;
  v_result                JSONB;

  -- uncovered-ref scan locals
  r_col       RECORD;
  v_count     BIGINT;
  v_predicate TEXT;
BEGIN
  -- -------------------------------------------------------------------------
  -- 0. Validate and normalize input
  -- -------------------------------------------------------------------------
  IF p_tenant_org_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_org_id is required.';
  END IF;

  p_target_mode := COALESCE(p_target_mode, 'ALL_TENANT_ORDERS');
  p_dry_run := COALESCE(p_dry_run, true);
  p_include_fin_audit_rows := COALESCE(p_include_fin_audit_rows, false);
  p_max_target_orders := COALESCE(p_max_target_orders, 200);

  IF p_target_mode NOT IN ('ALL_TENANT_ORDERS', 'ORDER_NO_PATTERN', 'CREATED_RANGE', 'SPECIFIC_ORDERS') THEN
    RAISE EXCEPTION 'Invalid p_target_mode: %. Allowed: ALL_TENANT_ORDERS, ORDER_NO_PATTERN, CREATED_RANGE, SPECIFIC_ORDERS.', p_target_mode;
  END IF;

  IF p_target_mode = 'ORDER_NO_PATTERN' AND p_order_no_like IS NULL THEN
    RAISE EXCEPTION 'p_target_mode = ORDER_NO_PATTERN requires p_order_no_like.';
  END IF;

  IF p_target_mode = 'SPECIFIC_ORDERS'
     AND (p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL)
     AND (p_order_nos IS NULL OR array_length(p_order_nos, 1) IS NULL) THEN
    RAISE EXCEPTION 'p_target_mode = SPECIFIC_ORDERS requires a non-empty p_order_ids or p_order_nos array.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1. Drop any leftover temp tables from a prior call on this connection
  -- -------------------------------------------------------------------------
  DROP TABLE IF EXISTS tmp_cto_target_orders;
  DROP TABLE IF EXISTS tmp_cto_target_customers;
  DROP TABLE IF EXISTS tmp_cto_target_order_items;
  DROP TABLE IF EXISTS tmp_cto_target_asm_tasks;
  DROP TABLE IF EXISTS tmp_cto_target_invoices;
  DROP TABLE IF EXISTS tmp_cto_target_order_payments;
  DROP TABLE IF EXISTS tmp_cto_target_order_refunds;
  DROP TABLE IF EXISTS tmp_cto_target_credit_apps;
  DROP TABLE IF EXISTS tmp_cto_target_order_adjustments;
  DROP TABLE IF EXISTS tmp_cto_target_vouchers;
  DROP TABLE IF EXISTS tmp_cto_target_voucher_lines;
  DROP TABLE IF EXISTS tmp_cto_target_credit_notes;
  DROP TABLE IF EXISTS tmp_cto_target_outbox_events;
  DROP TABLE IF EXISTS tmp_cto_target_tax_documents;
  DROP TABLE IF EXISTS tmp_cto_target_wf_releases;
  DROP TABLE IF EXISTS tmp_cto_target_sv_funding_tenders;
  DROP TABLE IF EXISTS tmp_cto_target_ar_ledger_rows;
  DROP TABLE IF EXISTS tmp_cto_target_wallet_txns;
  DROP TABLE IF EXISTS tmp_cto_target_advance_txns;
  DROP TABLE IF EXISTS tmp_cto_target_gift_card_txns;
  DROP TABLE IF EXISTS tmp_cto_target_credit_note_txns;
  DROP TABLE IF EXISTS tmp_cto_target_loyalty_txns;
  DROP TABLE IF EXISTS tmp_cto_target_wallets;
  DROP TABLE IF EXISTS tmp_cto_target_advances;
  DROP TABLE IF EXISTS tmp_cto_target_gift_cards;
  DROP TABLE IF EXISTS tmp_cto_target_loyalty_accounts;
  DROP TABLE IF EXISTS tmp_cto_target_fin_audit_docs;
  DROP TABLE IF EXISTS tmp_cto_target_fin_journals;
  DROP TABLE IF EXISTS tmp_cto_target_fin_post_logs;
  DROP TABLE IF EXISTS tmp_cto_wallet_master_delta;
  DROP TABLE IF EXISTS tmp_cto_advance_master_delta;
  DROP TABLE IF EXISTS tmp_cto_credit_note_master_delta;
  DROP TABLE IF EXISTS tmp_cto_gift_card_master_delta;
  DROP TABLE IF EXISTS tmp_cto_loyalty_master_delta;
  DROP TABLE IF EXISTS tmp_cto_uncovered_refs;

  -- -------------------------------------------------------------------------
  -- 2. Primary target sets (ported from
  --    cleanup_all_order_data_all_tenants_or_one_tenant_fixed.sql)
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_cto_target_orders ON COMMIT DROP AS
  SELECT DISTINCT
    o.id            AS order_id,
    o.tenant_org_id,
    o.order_no,
    o.customer_id,
    o.created_at,
    o.status,
    o.payment_status,
    o.gift_card_id
  FROM public.org_orders_mst AS o
  WHERE o.tenant_org_id = p_tenant_org_id
    AND (
      p_target_mode = 'ALL_TENANT_ORDERS'
      OR (p_target_mode = 'ORDER_NO_PATTERN' AND o.order_no ILIKE p_order_no_like)
      OR (
        p_target_mode = 'CREATED_RANGE'
        AND (p_created_from IS NULL OR o.created_at >= p_created_from)
        AND (p_created_to IS NULL OR o.created_at < p_created_to)
      )
      OR (
        p_target_mode = 'SPECIFIC_ORDERS'
        AND (o.id = ANY(p_order_ids) OR o.order_no = ANY(p_order_nos))
      )
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_orders ON tmp_cto_target_orders (order_id);

  CREATE TEMP TABLE tmp_cto_target_customers ON COMMIT DROP AS
  SELECT DISTINCT customer_id
  FROM tmp_cto_target_orders
  WHERE customer_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_customers ON tmp_cto_target_customers (customer_id);

  CREATE TEMP TABLE tmp_cto_target_order_items ON COMMIT DROP AS
  SELECT i.id AS order_item_id
  FROM public.org_order_items_dtl AS i
  WHERE i.tenant_org_id = p_tenant_org_id
    AND i.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_order_items ON tmp_cto_target_order_items (order_item_id);

  CREATE TEMP TABLE tmp_cto_target_asm_tasks ON COMMIT DROP AS
  SELECT t.id AS task_id
  FROM public.org_asm_tasks_mst AS t
  WHERE t.tenant_org_id = p_tenant_org_id
    AND t.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_asm_tasks ON tmp_cto_target_asm_tasks (task_id);

  CREATE TEMP TABLE tmp_cto_target_invoices ON COMMIT DROP AS
  SELECT DISTINCT inv.id AS invoice_id
  FROM public.org_invoice_mst AS inv
  WHERE inv.tenant_org_id = p_tenant_org_id
    AND inv.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
  UNION
  SELECT DISTINCT link.invoice_id
  FROM public.org_invoice_orders_dtl AS link
  WHERE link.tenant_org_id = p_tenant_org_id
    AND link.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_invoices ON tmp_cto_target_invoices (invoice_id);

  CREATE TEMP TABLE tmp_cto_target_order_payments ON COMMIT DROP AS
  SELECT DISTINCT p.id AS order_payment_id
  FROM public.org_order_payments_dtl AS p
  WHERE p.tenant_org_id = p_tenant_org_id
    AND p.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_order_payments ON tmp_cto_target_order_payments (order_payment_id);

  CREATE TEMP TABLE tmp_cto_target_order_refunds ON COMMIT DROP AS
  SELECT DISTINCT r.id AS refund_id
  FROM public.org_order_refunds_dtl AS r
  WHERE r.tenant_org_id = p_tenant_org_id
    AND r.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_order_refunds ON tmp_cto_target_order_refunds (refund_id);

  CREATE TEMP TABLE tmp_cto_target_credit_apps ON COMMIT DROP AS
  SELECT DISTINCT
    c.id               AS credit_app_id,
    c.credit_type,
    c.credit_source_id
  FROM public.org_order_credit_apps_dtl AS c
  WHERE c.tenant_org_id = p_tenant_org_id
    AND c.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_credit_apps ON tmp_cto_target_credit_apps (credit_app_id);

  CREATE TEMP TABLE tmp_cto_target_order_adjustments ON COMMIT DROP AS
  SELECT DISTINCT a.id AS adjustment_id
  FROM public.org_order_adjustments_dtl AS a
  WHERE a.tenant_org_id = p_tenant_org_id
    AND a.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_order_adjustments ON tmp_cto_target_order_adjustments (adjustment_id);

  CREATE TEMP TABLE tmp_cto_target_vouchers ON COMMIT DROP AS
  SELECT DISTINCT v.id AS voucher_id
  FROM public.org_fin_vouchers_mst AS v
  WHERE v.tenant_org_id = p_tenant_org_id
    AND (
      v.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR v.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
    )
  UNION
  SELECT DISTINCT p.fin_voucher_id
  FROM public.org_order_payments_dtl AS p
  WHERE p.tenant_org_id = p_tenant_org_id
    AND p.id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)
    AND p.fin_voucher_id IS NOT NULL
  UNION
  SELECT DISTINCT c.fin_voucher_id
  FROM public.org_order_credit_apps_dtl AS c
  WHERE c.tenant_org_id = p_tenant_org_id
    AND c.id IN (SELECT credit_app_id FROM tmp_cto_target_credit_apps)
    AND c.fin_voucher_id IS NOT NULL
  UNION
  SELECT DISTINCT r.voucher_id
  FROM public.org_invoice_payments_dtl AS r
  WHERE r.tenant_org_id = p_tenant_org_id
    AND r.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
    AND r.voucher_id IS NOT NULL
  UNION
  SELECT DISTINCT r.voucher_id
  FROM public.org_rcpt_receipts_mst AS r
  WHERE r.tenant_org_id = p_tenant_org_id
    AND r.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
    AND r.voucher_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_vouchers ON tmp_cto_target_vouchers (voucher_id);

  CREATE TEMP TABLE tmp_cto_target_voucher_lines ON COMMIT DROP AS
  SELECT DISTINCT l.id AS voucher_line_id
  FROM public.org_fin_voucher_trx_lines_dtl AS l
  WHERE l.tenant_org_id = p_tenant_org_id
    AND (
      l.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR l.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR l.order_payment_id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)
      OR l.id IN (
        SELECT p.fin_voucher_trx_line_id
        FROM public.org_order_payments_dtl AS p
        WHERE p.tenant_org_id = p_tenant_org_id
          AND p.fin_voucher_trx_line_id IS NOT NULL
          AND p.id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)
      )
      OR l.id IN (
        SELECT c.fin_voucher_trx_line_id
        FROM public.org_order_credit_apps_dtl AS c
        WHERE c.tenant_org_id = p_tenant_org_id
          AND c.fin_voucher_trx_line_id IS NOT NULL
          AND c.id IN (SELECT credit_app_id FROM tmp_cto_target_credit_apps)
      )
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_voucher_lines ON tmp_cto_target_voucher_lines (voucher_line_id);

  CREATE TEMP TABLE tmp_cto_target_credit_notes ON COMMIT DROP AS
  SELECT DISTINCT n.id AS credit_note_id
  FROM public.org_credit_notes_mst AS n
  WHERE n.tenant_org_id = p_tenant_org_id
    AND n.related_order_id IN (SELECT order_id FROM tmp_cto_target_orders)
  UNION
  SELECT DISTINCT t.credit_note_id
  FROM public.org_credit_note_txn_dtl AS t
  WHERE t.tenant_org_id = p_tenant_org_id
    AND (
      t.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR t.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR t.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    )
  UNION
  SELECT DISTINCT c.credit_source_id
  FROM tmp_cto_target_credit_apps AS c
  WHERE c.credit_type = 'CREDIT_NOTE'
    AND c.credit_source_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_credit_notes ON tmp_cto_target_credit_notes (credit_note_id);

  CREATE TEMP TABLE tmp_cto_target_outbox_events ON COMMIT DROP AS
  SELECT DISTINCT h.outbox_event_id
  FROM public.org_order_history AS h
  WHERE h.tenant_org_id = p_tenant_org_id
    AND h.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
    AND h.outbox_event_id IS NOT NULL
  UNION
  SELECT DISTINCT e.id
  FROM public.org_domain_events_outbox AS e
  WHERE e.tenant_org_id = p_tenant_org_id
    AND e.aggregate_id IS NOT NULL
    AND (
      e.aggregate_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR e.aggregate_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
      OR e.aggregate_id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)
      OR e.aggregate_id IN (SELECT refund_id FROM tmp_cto_target_order_refunds)
      OR e.aggregate_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_outbox_events ON tmp_cto_target_outbox_events (outbox_event_id);

  CREATE TEMP TABLE tmp_cto_target_tax_documents ON COMMIT DROP AS
  SELECT DISTINCT d.id AS tax_document_id
  FROM public.org_tax_documents_mst AS d
  WHERE d.tenant_org_id = p_tenant_org_id
    AND d.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_tax_documents ON tmp_cto_target_tax_documents (tax_document_id);

  CREATE TEMP TABLE tmp_cto_target_wf_releases ON COMMIT DROP AS
  SELECT DISTINCT r.id AS release_id
  FROM public.org_wf_release_mst AS r
  WHERE r.tenant_org_id = p_tenant_org_id
    AND r.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

  CREATE UNIQUE INDEX idx_tmp_cto_target_wf_releases ON tmp_cto_target_wf_releases (release_id);

  CREATE TEMP TABLE tmp_cto_target_sv_funding_tenders ON COMMIT DROP AS
  SELECT DISTINCT t.id AS funding_tender_id
  FROM public.org_sv_funding_tenders_dtl AS t
  WHERE t.tenant_org_id = p_tenant_org_id
    AND (
      t.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR t.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_sv_funding_tenders ON tmp_cto_target_sv_funding_tenders (funding_tender_id);

  CREATE TEMP TABLE tmp_cto_target_ar_ledger_rows ON COMMIT DROP AS
  SELECT DISTINCT l.id AS ar_ledger_id
  FROM public.org_customer_ar_ledger_dtl AS l
  WHERE l.tenant_org_id = p_tenant_org_id
    AND (
      l.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
      OR l.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR l.payment_alloc_id IN (
        SELECT p.id
        FROM public.org_invoice_payments_dtl AS p
        WHERE p.tenant_org_id = p_tenant_org_id
          AND p.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
      )
      OR l.adjustment_id IN (
        SELECT a.id
        FROM public.org_invoice_adjustments_dtl AS a
        WHERE a.tenant_org_id = p_tenant_org_id
          AND a.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
      )
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_ar_ledger_rows ON tmp_cto_target_ar_ledger_rows (ar_ledger_id);

  CREATE TEMP TABLE tmp_cto_target_wallet_txns ON COMMIT DROP AS
  SELECT DISTINCT
    x.id,
    x.wallet_id,
    x.customer_id,
    x.amount,
    x.balance_before,
    x.balance_after,
    x.created_at
  FROM public.org_wallet_txn_dtl AS x
  WHERE x.tenant_org_id = p_tenant_org_id
    AND (
      x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_wallet_txns ON tmp_cto_target_wallet_txns (id);

  CREATE TEMP TABLE tmp_cto_target_advance_txns ON COMMIT DROP AS
  SELECT DISTINCT
    x.id,
    x.advance_id,
    x.customer_id,
    x.amount,
    x.balance_before,
    x.balance_after,
    x.created_at
  FROM public.org_advance_txn_dtl AS x
  WHERE x.tenant_org_id = p_tenant_org_id
    AND (
      x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_advance_txns ON tmp_cto_target_advance_txns (id);

  CREATE TEMP TABLE tmp_cto_target_gift_card_txns ON COMMIT DROP AS
  SELECT DISTINCT
    x.id,
    x.gift_card_id,
    x.amount,
    x.balance_before,
    x.balance_after,
    x.transaction_type,
    x.transaction_date
  FROM public.org_gift_card_txn_dtl AS x
  WHERE x.tenant_org_id = p_tenant_org_id
    AND (
      x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
      OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_gift_card_txns ON tmp_cto_target_gift_card_txns (id);

  CREATE TEMP TABLE tmp_cto_target_credit_note_txns ON COMMIT DROP AS
  SELECT DISTINCT
    x.id,
    x.credit_note_id,
    x.customer_id,
    x.amount,
    x.balance_before,
    x.balance_after,
    x.txn_type,
    x.created_at
  FROM public.org_credit_note_txn_dtl AS x
  WHERE x.tenant_org_id = p_tenant_org_id
    AND (
      x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR x.credit_note_id IN (SELECT credit_note_id FROM tmp_cto_target_credit_notes)
      OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_credit_note_txns ON tmp_cto_target_credit_note_txns (id);

  CREATE TEMP TABLE tmp_cto_target_loyalty_txns ON COMMIT DROP AS
  SELECT DISTINCT
    x.id,
    x.account_id,
    x.customer_id,
    x.points,
    x.points_before,
    x.points_after,
    x.txn_type,
    x.created_at
  FROM public.org_loyalty_txn_dtl AS x
  WHERE x.tenant_org_id = p_tenant_org_id
    AND (
      x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
    );

  CREATE UNIQUE INDEX idx_tmp_cto_target_loyalty_txns ON tmp_cto_target_loyalty_txns (id);

  CREATE TEMP TABLE tmp_cto_target_wallets ON COMMIT DROP AS
  SELECT DISTINCT wallet_id
  FROM tmp_cto_target_wallet_txns
  UNION
  SELECT DISTINCT credit_source_id
  FROM tmp_cto_target_credit_apps
  WHERE credit_type = 'WALLET'
    AND credit_source_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_wallets ON tmp_cto_target_wallets (wallet_id);

  CREATE TEMP TABLE tmp_cto_target_advances ON COMMIT DROP AS
  SELECT DISTINCT advance_id
  FROM tmp_cto_target_advance_txns
  UNION
  SELECT DISTINCT credit_source_id
  FROM tmp_cto_target_credit_apps
  WHERE credit_type = 'ADVANCE'
    AND credit_source_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_advances ON tmp_cto_target_advances (advance_id);

  CREATE TEMP TABLE tmp_cto_target_gift_cards ON COMMIT DROP AS
  SELECT DISTINCT gift_card_id
  FROM tmp_cto_target_gift_card_txns
  UNION
  SELECT DISTINCT gift_card_id
  FROM tmp_cto_target_orders
  WHERE gift_card_id IS NOT NULL
  UNION
  SELECT DISTINCT inv.gift_card_id
  FROM public.org_invoice_mst AS inv
  WHERE inv.tenant_org_id = p_tenant_org_id
    AND inv.id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
    AND inv.gift_card_id IS NOT NULL
  UNION
  SELECT DISTINCT credit_source_id
  FROM tmp_cto_target_credit_apps
  WHERE credit_type = 'GIFT_CARD'
    AND credit_source_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_gift_cards ON tmp_cto_target_gift_cards (gift_card_id);

  CREATE TEMP TABLE tmp_cto_target_loyalty_accounts ON COMMIT DROP AS
  SELECT DISTINCT account_id
  FROM tmp_cto_target_loyalty_txns
  UNION
  SELECT DISTINCT credit_source_id
  FROM tmp_cto_target_credit_apps
  WHERE credit_type = 'LOYALTY_POINTS'
    AND credit_source_id IS NOT NULL;

  CREATE UNIQUE INDEX idx_tmp_cto_target_loyalty_accounts ON tmp_cto_target_loyalty_accounts (account_id);

  -- Finance posting/audit target sets — always built (cheap set-based
  -- queries), only actually deleted from when p_include_fin_audit_rows is
  -- true, so downstream references stay unconditional.
  CREATE TEMP TABLE tmp_cto_target_fin_audit_docs ON COMMIT DROP AS
  SELECT 'INVOICE'::text AS source_doc_type_code, invoice_id AS source_doc_id FROM tmp_cto_target_invoices
  UNION
  SELECT 'PAYMENT', order_payment_id FROM tmp_cto_target_order_payments
  UNION
  SELECT 'PAYMENT_REFUND', refund_id FROM tmp_cto_target_order_refunds
  UNION
  SELECT 'SV_FUNDING_VOUCHER', voucher_id FROM tmp_cto_target_vouchers
  UNION
  SELECT 'GIFT_CARD', gift_card_id FROM tmp_cto_target_gift_cards
  UNION
  SELECT 'GIFT_CARD_TXN', id FROM tmp_cto_target_gift_card_txns;

  CREATE UNIQUE INDEX idx_tmp_cto_target_fin_audit_docs ON tmp_cto_target_fin_audit_docs (source_doc_type_code, source_doc_id);

  CREATE TEMP TABLE tmp_cto_target_fin_journals ON COMMIT DROP AS
  SELECT DISTINCT j.id AS journal_id
  FROM public.org_fin_journal_mst AS j
  WHERE j.tenant_org_id = p_tenant_org_id
    AND (j.source_doc_type_code, j.source_doc_id) IN (SELECT source_doc_type_code, source_doc_id FROM tmp_cto_target_fin_audit_docs);

  CREATE UNIQUE INDEX idx_tmp_cto_target_fin_journals ON tmp_cto_target_fin_journals (journal_id);

  CREATE TEMP TABLE tmp_cto_target_fin_post_logs ON COMMIT DROP AS
  SELECT DISTINCT p.id AS post_log_id
  FROM public.org_fin_post_log_tr AS p
  WHERE p.tenant_org_id = p_tenant_org_id
    AND (p.source_doc_type_code, p.source_doc_id) IN (SELECT source_doc_type_code, source_doc_id FROM tmp_cto_target_fin_audit_docs);

  CREATE UNIQUE INDEX idx_tmp_cto_target_fin_post_logs ON tmp_cto_target_fin_post_logs (post_log_id);

  -- -------------------------------------------------------------------------
  -- 3. Delta tables used to repair master balances after ledger-row deletes
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_cto_wallet_master_delta ON COMMIT DROP AS
  SELECT wallet_id, sum(balance_after - balance_before) AS balance_delta
  FROM tmp_cto_target_wallet_txns
  GROUP BY wallet_id;

  CREATE UNIQUE INDEX idx_tmp_cto_wallet_master_delta ON tmp_cto_wallet_master_delta (wallet_id);

  CREATE TEMP TABLE tmp_cto_advance_master_delta ON COMMIT DROP AS
  SELECT advance_id, sum(balance_after - balance_before) AS balance_delta
  FROM tmp_cto_target_advance_txns
  GROUP BY advance_id;

  CREATE UNIQUE INDEX idx_tmp_cto_advance_master_delta ON tmp_cto_advance_master_delta (advance_id);

  CREATE TEMP TABLE tmp_cto_credit_note_master_delta ON COMMIT DROP AS
  SELECT credit_note_id, sum(balance_after - balance_before) AS balance_delta
  FROM tmp_cto_target_credit_note_txns
  GROUP BY credit_note_id;

  CREATE UNIQUE INDEX idx_tmp_cto_credit_note_master_delta ON tmp_cto_credit_note_master_delta (credit_note_id);

  CREATE TEMP TABLE tmp_cto_gift_card_master_delta ON COMMIT DROP AS
  SELECT
    gift_card_id,
    sum(balance_after - balance_before) AS balance_delta,
    sum(
      CASE
        WHEN transaction_type = 'REDEEM' THEN amount
        WHEN transaction_type = 'REFUND' THEN -amount
        ELSE 0
      END
    ) AS redeemed_delta,
    count(*) FILTER (WHERE transaction_type = 'REDEEM') AS redeem_count_delta
  FROM tmp_cto_target_gift_card_txns
  GROUP BY gift_card_id;

  CREATE UNIQUE INDEX idx_tmp_cto_gift_card_master_delta ON tmp_cto_gift_card_master_delta (gift_card_id);

  CREATE TEMP TABLE tmp_cto_loyalty_master_delta ON COMMIT DROP AS
  SELECT
    account_id,
    customer_id,
    sum(points_after - points_before) AS points_delta,
    sum(
      CASE
        WHEN txn_type IN ('EARN', 'BONUS') AND points > 0 THEN points
        ELSE 0
      END
    ) AS lifetime_earned_delta
  FROM tmp_cto_target_loyalty_txns
  GROUP BY account_id, customer_id;

  CREATE UNIQUE INDEX idx_tmp_cto_loyalty_master_delta ON tmp_cto_loyalty_master_delta (account_id);

  -- -------------------------------------------------------------------------
  -- 4. Uncovered reference scan — if new related org_* tables appear, surface them
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_cto_uncovered_refs (
    reference_scope TEXT   NOT NULL,
    table_name      TEXT   NOT NULL,
    link_column     TEXT   NOT NULL,
    row_count       BIGINT NOT NULL
  ) ON COMMIT DROP;

  FOR r_col IN
    SELECT
      c.table_name,
      c.column_name,
      CASE c.column_name
        WHEN 'order_id'                THEN 'ORDER'
        WHEN 'source_order_id'         THEN 'ORDER'
        WHEN 'related_order_id'        THEN 'ORDER'
        WHEN 'invoice_id'              THEN 'INVOICE'
        WHEN 'order_payment_id'        THEN 'ORDER_PAYMENT'
        WHEN 'voucher_id'              THEN 'VOUCHER'
        WHEN 'fin_voucher_id'          THEN 'VOUCHER'
        WHEN 'fin_voucher_trx_line_id' THEN 'VOUCHER_LINE'
        WHEN 'outbox_event_id'         THEN 'OUTBOX_EVENT'
        WHEN 'credit_note_id'          THEN 'CREDIT_NOTE'
        WHEN 'gift_card_id'            THEN 'GIFT_CARD'
        WHEN 'wallet_id'               THEN 'WALLET'
        WHEN 'advance_id'              THEN 'ADVANCE'
        WHEN 'account_id'              THEN 'LOYALTY_ACCOUNT'
        ELSE 'OTHER'
      END AS reference_scope
    FROM information_schema.columns AS c
    JOIN information_schema.tables AS t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE 'org\_%' ESCAPE '\'
      AND c.column_name IN (
        'order_id', 'source_order_id', 'related_order_id', 'invoice_id',
        'order_payment_id', 'voucher_id', 'fin_voucher_id', 'fin_voucher_trx_line_id',
        'outbox_event_id', 'credit_note_id', 'gift_card_id', 'wallet_id',
        'advance_id', 'account_id'
      )
      AND (
        c.column_name <> 'account_id'
        OR c.table_name LIKE 'org\_loyalty\_%' ESCAPE '\'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns AS tc
        WHERE tc.table_schema = c.table_schema
          AND tc.table_name = c.table_name
          AND tc.column_name = 'tenant_org_id'
      )
      AND c.table_name NOT IN (
        'org_orders_mst', 'org_order_items_dtl', 'org_order_preferences_dtl',
        'org_order_discounts_dtl', 'org_order_status_history', 'org_order_status_history_legacy',
        'org_order_edit_locks', 'org_fin_vouchers_mst', 'org_order_history', 'org_order_issues',
        'org_order_item_processing_steps', 'org_gift_card_txn_dtl', 'org_promotion_usage_dtl',
        'org_asm_tasks_mst', 'org_dlv_stops_dtl', 'org_pck_packing_lists_mst', 'org_qa_decisions_tr',
        'org_rcpt_receipts_mst', 'org_order_item_pieces_dtl', 'org_ord_transition_events',
        'org_order_edit_history', 'org_invoice_mst', 'org_invoice_lines_dtl', 'org_invoice_orders_dtl',
        'org_cash_drawer_movements_dtl', 'org_order_credit_apps_dtl', 'org_order_refunds_dtl',
        'org_order_payments_dtl', 'org_order_charges_dtl', 'org_order_taxes_dtl', 'org_order_adjustments_dtl',
        'org_wallet_txn_dtl', 'org_advance_txn_dtl', 'org_credit_notes_mst', 'org_credit_note_txn_dtl',
        'org_loyalty_txn_dtl', 'org_order_piece_hist_tr', 'org_domain_events_outbox',
        'org_customer_ar_ledger_dtl', 'org_invoice_payments_dtl', 'org_invoice_adjustments_dtl',
        'org_invoice_status_history_dtl', 'org_fin_voucher_trx_lines_dtl',
        'org_ar_credit_allocs_dtl', 'org_ar_disputes_mst', 'org_ar_dunning_runs_mst',
        'org_b2b_statement_payments_dtl', 'org_fin_cost_run_dtl', 'org_fin_overpay_disp_dtl',
        'org_fin_rcpt_alloc_preview_tr', 'org_fin_voucher_audit_log', 'org_sv_funding_tenders_dtl',
        'org_tax_documents_mst', 'org_tax_doc_lines_dtl', 'org_wf_gate_decision_mst',
        'org_wf_release_mst', 'org_wf_release_ln'
      )
  LOOP
    v_predicate := CASE r_col.column_name
      WHEN 'order_id'                THEN 't.order_id IN (SELECT order_id FROM tmp_cto_target_orders)'
      WHEN 'source_order_id'         THEN 't.source_order_id IN (SELECT order_id FROM tmp_cto_target_orders)'
      WHEN 'related_order_id'        THEN 't.related_order_id IN (SELECT order_id FROM tmp_cto_target_orders)'
      WHEN 'invoice_id'              THEN 't.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)'
      WHEN 'order_payment_id'        THEN 't.order_payment_id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)'
      WHEN 'voucher_id'              THEN 't.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)'
      WHEN 'fin_voucher_id'          THEN 't.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)'
      WHEN 'fin_voucher_trx_line_id' THEN 't.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)'
      WHEN 'outbox_event_id'         THEN 't.outbox_event_id IN (SELECT outbox_event_id FROM tmp_cto_target_outbox_events)'
      WHEN 'credit_note_id'          THEN 't.credit_note_id IN (SELECT credit_note_id FROM tmp_cto_target_credit_notes)'
      WHEN 'gift_card_id'            THEN 't.gift_card_id IN (SELECT gift_card_id FROM tmp_cto_target_gift_cards)'
      WHEN 'wallet_id'               THEN 't.wallet_id IN (SELECT wallet_id FROM tmp_cto_target_wallets)'
      WHEN 'advance_id'              THEN 't.advance_id IN (SELECT advance_id FROM tmp_cto_target_advances)'
      WHEN 'account_id'              THEN 't.account_id IN (SELECT account_id FROM tmp_cto_target_loyalty_accounts)'
      ELSE NULL
    END;

    IF v_predicate IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t WHERE t.tenant_org_id = $1 AND %s',
      r_col.table_name,
      v_predicate
    )
    INTO v_count
    USING p_tenant_org_id;

    IF v_count > 0 THEN
      INSERT INTO tmp_cto_uncovered_refs (reference_scope, table_name, link_column, row_count)
      VALUES (r_col.reference_scope, r_col.table_name, r_col.column_name, v_count);
    END IF;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 5. Guard rails -> blocked / block_reasons (never raises for data-dependent
  --    conditions — only malformed input raises, validated in step 0)
  -- -------------------------------------------------------------------------
  SELECT count(*) INTO v_target_count FROM tmp_cto_target_orders;
  SELECT COALESCE(sum(row_count), 0) INTO v_uncovered_count FROM tmp_cto_uncovered_refs;

  IF v_target_count > p_max_target_orders THEN
    v_blocked := true;
    v_block_reasons := v_block_reasons || format(
      'Targeted %s orders exceeds p_max_target_orders (%s). Use the reviewed SQL cleanup script for larger wipes.',
      v_target_count, p_max_target_orders
    );
  END IF;

  IF v_uncovered_count > 0 THEN
    v_blocked := true;
    v_block_reasons := v_block_reasons || 'Uncovered related rows exist in org_* tables not covered by this function — review uncovered_related_refs before proceeding.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 6. Preview payload (always computed, dry run or not)
  -- -------------------------------------------------------------------------
  SELECT jsonb_agg(jsonb_build_object('table_name', table_name, 'row_count', row_count))
  INTO v_target_summary
  FROM (
    VALUES
      ('org_orders_mst',                (SELECT count(*)::bigint FROM tmp_cto_target_orders)),
      ('org_order_items_dtl',           (SELECT count(*)::bigint FROM tmp_cto_target_order_items)),
      ('org_asm_tasks_mst',             (SELECT count(*)::bigint FROM tmp_cto_target_asm_tasks)),
      ('org_invoice_mst',               (SELECT count(*)::bigint FROM tmp_cto_target_invoices)),
      ('org_order_payments_dtl',        (SELECT count(*)::bigint FROM tmp_cto_target_order_payments)),
      ('org_order_refunds_dtl',         (SELECT count(*)::bigint FROM tmp_cto_target_order_refunds)),
      ('org_order_credit_apps_dtl',     (SELECT count(*)::bigint FROM tmp_cto_target_credit_apps)),
      ('org_order_adjustments_dtl',     (SELECT count(*)::bigint FROM tmp_cto_target_order_adjustments)),
      ('org_fin_vouchers_mst',          (SELECT count(*)::bigint FROM tmp_cto_target_vouchers)),
      ('org_fin_voucher_trx_lines_dtl', (SELECT count(*)::bigint FROM tmp_cto_target_voucher_lines)),
      ('org_credit_notes_mst',          (SELECT count(*)::bigint FROM tmp_cto_target_credit_notes)),
      ('org_wallet_txn_dtl',            (SELECT count(*)::bigint FROM tmp_cto_target_wallet_txns)),
      ('org_advance_txn_dtl',           (SELECT count(*)::bigint FROM tmp_cto_target_advance_txns)),
      ('org_gift_card_txn_dtl',         (SELECT count(*)::bigint FROM tmp_cto_target_gift_card_txns)),
      ('org_credit_note_txn_dtl',       (SELECT count(*)::bigint FROM tmp_cto_target_credit_note_txns)),
      ('org_loyalty_txn_dtl',           (SELECT count(*)::bigint FROM tmp_cto_target_loyalty_txns)),
      ('org_domain_events_outbox',      (SELECT count(*)::bigint FROM tmp_cto_target_outbox_events)),
      ('org_customer_ar_ledger_dtl',    (SELECT count(*)::bigint FROM tmp_cto_target_ar_ledger_rows)),
      ('org_sv_funding_tenders_dtl',    (SELECT count(*)::bigint FROM tmp_cto_target_sv_funding_tenders)),
      ('org_tax_documents_mst',         (SELECT count(*)::bigint FROM tmp_cto_target_tax_documents)),
      ('org_wf_release_mst',            (SELECT count(*)::bigint FROM tmp_cto_target_wf_releases)),
      ('org_fin_journal_mst',           (CASE WHEN p_include_fin_audit_rows THEN (SELECT count(*)::bigint FROM tmp_cto_target_fin_journals) ELSE 0 END)),
      ('org_fin_post_log_tr',           (CASE WHEN p_include_fin_audit_rows THEN (SELECT count(*)::bigint FROM tmp_cto_target_fin_post_logs) ELSE 0 END))
  ) AS preview(table_name, row_count)
  WHERE row_count > 0;

  SELECT jsonb_agg(jsonb_build_object(
    'table_name', table_name,
    'target_master_count', target_master_count,
    'affected_txn_count', affected_txn_count
  ))
  INTO v_master_repair_preview
  FROM (
    VALUES
      ('org_customer_wallets_mst',  (SELECT count(*)::bigint FROM tmp_cto_target_wallets),          (SELECT count(*)::bigint FROM tmp_cto_target_wallet_txns)),
      ('org_customer_advances_mst', (SELECT count(*)::bigint FROM tmp_cto_target_advances),         (SELECT count(*)::bigint FROM tmp_cto_target_advance_txns)),
      ('org_gift_cards_mst',        (SELECT count(*)::bigint FROM tmp_cto_target_gift_cards),       (SELECT count(*)::bigint FROM tmp_cto_target_gift_card_txns)),
      ('org_credit_notes_mst',      (SELECT count(*)::bigint FROM tmp_cto_target_credit_notes),     (SELECT count(*)::bigint FROM tmp_cto_target_credit_note_txns)),
      ('org_loyalty_accounts_mst',  (SELECT count(*)::bigint FROM tmp_cto_target_loyalty_accounts), (SELECT count(*)::bigint FROM tmp_cto_target_loyalty_txns))
  ) AS preview(table_name, target_master_count, affected_txn_count)
  WHERE target_master_count > 0 OR affected_txn_count > 0;

  SELECT jsonb_agg(jsonb_build_object(
    'reference_scope', reference_scope,
    'table_name', table_name,
    'link_column', link_column,
    'row_count', row_count
  ))
  INTO v_uncovered_refs
  FROM tmp_cto_uncovered_refs;

  -- -------------------------------------------------------------------------
  -- 7. Execute — only when not a dry run and not blocked
  -- -------------------------------------------------------------------------
  IF NOT p_dry_run AND NOT v_blocked THEN
    -- org_ar_credit_allocs_dtl RESTRICTs both org_customer_ar_ledger_dtl and
    -- org_invoice_mst, so it has to go first.
    DELETE FROM public.org_ar_credit_allocs_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
        OR x.source_ledger_id IN (SELECT ar_ledger_id FROM tmp_cto_target_ar_ledger_rows)
      );

    DELETE FROM public.org_ar_disputes_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices);

    DELETE FROM public.org_ar_dunning_runs_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices);

    DELETE FROM public.org_customer_ar_ledger_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT ar_ledger_id FROM tmp_cto_target_ar_ledger_rows);

    DELETE FROM public.org_invoice_payments_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices);

    DELETE FROM public.org_invoice_status_history_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices);

    DELETE FROM public.org_invoice_adjustments_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices);

    DELETE FROM public.org_invoice_lines_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
        OR x.source_order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      );

    DELETE FROM public.org_invoice_orders_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
        OR x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      );

    -- org_fin_overpay_disp_dtl RESTRICTs org_orders_mst.
    DELETE FROM public.org_fin_overpay_disp_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
        OR x.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
        OR x.voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
      );

    DELETE FROM public.org_cash_drawer_movements_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
        OR x.order_payment_id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)
        OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
        OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
        OR x.funding_tender_id IN (SELECT funding_tender_id FROM tmp_cto_target_sv_funding_tenders)
      );

    DELETE FROM public.org_rcpt_receipts_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
        OR x.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
      );

    DELETE FROM public.org_promotion_usage_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
        OR x.invoice_id IN (SELECT invoice_id FROM tmp_cto_target_invoices)
      );

    DELETE FROM public.org_order_refunds_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT refund_id FROM tmp_cto_target_order_refunds);

    DELETE FROM public.org_order_credit_apps_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT credit_app_id FROM tmp_cto_target_credit_apps);

    DELETE FROM public.org_order_adjustments_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT adjustment_id FROM tmp_cto_target_order_adjustments);

    DELETE FROM public.org_wallet_txn_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT id FROM tmp_cto_target_wallet_txns);

    DELETE FROM public.org_advance_txn_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT id FROM tmp_cto_target_advance_txns);

    DELETE FROM public.org_gift_card_txn_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT id FROM tmp_cto_target_gift_card_txns);

    DELETE FROM public.org_credit_note_txn_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT id FROM tmp_cto_target_credit_note_txns);

    DELETE FROM public.org_loyalty_txn_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT id FROM tmp_cto_target_loyalty_txns);

    DELETE FROM public.org_order_payments_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments);

    -- Voucher-linked children. org_sv_funding_tenders_dtl RESTRICTs both the
    -- voucher and the voucher line; the other two would otherwise be
    -- silently SET NULL / cascaded.
    DELETE FROM public.org_sv_funding_tenders_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT funding_tender_id FROM tmp_cto_target_sv_funding_tenders);

    DELETE FROM public.org_b2b_statement_payments_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)
        OR x.voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines)
      );

    DELETE FROM public.org_fin_voucher_audit_log AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.voucher_id IN (SELECT voucher_id FROM tmp_cto_target_vouchers);

    DELETE FROM public.org_fin_voucher_trx_lines_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT voucher_line_id FROM tmp_cto_target_voucher_lines);

    DELETE FROM public.org_fin_vouchers_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT voucher_id FROM tmp_cto_target_vouchers);

    -- Repair stored-value / loyalty masters from deleted row deltas
    UPDATE public.org_customer_wallets_mst AS m
    SET
      balance = GREATEST(0, m.balance - d.balance_delta),
      last_activity_at = (
        SELECT max(t.created_at) FROM public.org_wallet_txn_dtl AS t
        WHERE t.tenant_org_id = m.tenant_org_id AND t.wallet_id = m.id
      ),
      updated_at = now(),
      updated_info = 'cleanup_tenant_orders(): reverse deleted wallet txn effects'
    FROM tmp_cto_wallet_master_delta AS d
    WHERE m.tenant_org_id = p_tenant_org_id
      AND m.id = d.wallet_id;

    UPDATE public.org_customer_advances_mst AS m
    SET
      balance = GREATEST(0, m.balance - d.balance_delta),
      last_activity_at = (
        SELECT max(t.created_at) FROM public.org_advance_txn_dtl AS t
        WHERE t.tenant_org_id = m.tenant_org_id AND t.advance_id = m.id
      ),
      updated_at = now(),
      updated_info = 'cleanup_tenant_orders(): reverse deleted advance txn effects'
    FROM tmp_cto_advance_master_delta AS d
    WHERE m.tenant_org_id = p_tenant_org_id
      AND m.id = d.advance_id;

    UPDATE public.org_credit_notes_mst AS m
    SET
      remaining_balance = LEAST(m.original_amount, GREATEST(0, m.remaining_balance - d.balance_delta)),
      status = CASE
        WHEN m.status IN ('CANCELLED', 'EXPIRED') THEN m.status
        WHEN LEAST(m.original_amount, GREATEST(0, m.remaining_balance - d.balance_delta)) <= 0 THEN 'EXHAUSTED'
        ELSE 'ACTIVE'
      END,
      updated_at = now(),
      updated_info = 'cleanup_tenant_orders(): reverse deleted credit-note txn effects'
    FROM tmp_cto_credit_note_master_delta AS d
    WHERE m.tenant_org_id = p_tenant_org_id
      AND m.id = d.credit_note_id;

    UPDATE public.org_gift_cards_mst AS m
    SET
      available_amount = LEAST(m.original_amount, GREATEST(0, m.available_amount - d.balance_delta)),
      current_balance = LEAST(m.original_amount, GREATEST(0, m.current_balance - d.balance_delta)),
      redeemed_amount = GREATEST(0, m.redeemed_amount - d.redeemed_delta),
      redemption_count = GREATEST(0, m.redemption_count - d.redeem_count_delta),
      status = CASE
        WHEN m.status IN ('VOIDED', 'EXPIRED', 'SUSPENDED') THEN m.status
        WHEN m.status = 'DRAFT' THEN 'DRAFT'
        WHEN m.status = 'GENERATED'
          AND LEAST(m.original_amount, GREATEST(0, m.available_amount - d.balance_delta)) = m.original_amount
          THEN 'GENERATED'
        WHEN LEAST(m.original_amount, GREATEST(0, m.available_amount - d.balance_delta)) <= 0 THEN 'FULLY_REDEEMED'
        WHEN LEAST(m.original_amount, GREATEST(0, m.available_amount - d.balance_delta)) >= m.original_amount THEN 'ACTIVE'
        ELSE 'PARTIALLY_REDEEMED'
      END,
      updated_at = now(),
      updated_info = 'cleanup_tenant_orders(): reverse deleted gift-card txn effects'
    FROM tmp_cto_gift_card_master_delta AS d
    WHERE m.tenant_org_id = p_tenant_org_id
      AND m.id = d.gift_card_id;

    UPDATE public.org_loyalty_accounts_mst AS m
    SET
      points_balance = GREATEST(0, m.points_balance - d.points_delta),
      lifetime_earned = GREATEST(0, m.lifetime_earned - d.lifetime_earned_delta),
      current_tier_id = (
        SELECT t.id FROM public.org_loyalty_tiers_cf AS t
        WHERE t.tenant_org_id = m.tenant_org_id
          AND t.program_id = m.program_id
          AND t.is_active = true
          AND t.min_points <= GREATEST(0, m.lifetime_earned - d.lifetime_earned_delta)
        ORDER BY t.min_points DESC, t.sort_order DESC, t.id DESC
        LIMIT 1
      ),
      last_activity_at = (
        SELECT max(t.created_at) FROM public.org_loyalty_txn_dtl AS t
        WHERE t.tenant_org_id = m.tenant_org_id AND t.account_id = m.id
      ),
      updated_at = now(),
      updated_info = 'cleanup_tenant_orders(): reverse deleted loyalty txn effects'
    FROM tmp_cto_loyalty_master_delta AS d
    WHERE m.tenant_org_id = p_tenant_org_id
      AND m.id = d.account_id;

    UPDATE public.org_customers_mst AS c
    SET
      loyalty_points = COALESCE((
        SELECT sum(a.points_balance) FROM public.org_loyalty_accounts_mst AS a
        WHERE a.tenant_org_id = c.tenant_org_id AND a.customer_id = c.id AND a.is_active = true
      ), 0),
      updated_at = now(),
      updated_info = 'cleanup_tenant_orders(): sync loyalty_points from loyalty accounts'
    WHERE c.tenant_org_id = p_tenant_org_id
      AND c.id IN (
        SELECT customer_id FROM tmp_cto_target_loyalty_txns
        UNION
        SELECT customer_id FROM tmp_cto_target_customers
      );

    DELETE FROM public.org_invoice_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT invoice_id FROM tmp_cto_target_invoices);

    DELETE FROM public.org_asm_items_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.task_id IN (SELECT task_id FROM tmp_cto_target_asm_tasks)
        OR x.order_item_id IN (SELECT order_item_id FROM tmp_cto_target_order_items)
      );

    DELETE FROM public.org_qa_decisions_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_pck_packing_lists_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_asm_exceptions_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.task_id IN (SELECT task_id FROM tmp_cto_target_asm_tasks);

    DELETE FROM public.org_asm_tasks_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT task_id FROM tmp_cto_target_asm_tasks);

    -- org_dlv_ev_uploads_tr RESTRICTs org_dlv_stops_dtl; org_dlv_pod_tr
    -- cascades but is removed explicitly for the same reason.
    DELETE FROM public.org_dlv_ev_uploads_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.stop_id IN (
        SELECT sub.id FROM public.org_dlv_stops_dtl AS sub
        WHERE sub.tenant_org_id = p_tenant_org_id
          AND sub.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      );

    DELETE FROM public.org_dlv_pod_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.stop_id IN (
        SELECT sub.id FROM public.org_dlv_stops_dtl AS sub
        WHERE sub.tenant_org_id = p_tenant_org_id
          AND sub.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
      );

    DELETE FROM public.org_dlv_stops_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_piece_hist_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_ord_transition_events AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_edit_history AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_edit_locks AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_history AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_item_processing_steps AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_issues AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_preferences_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_item_pieces_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_discounts_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_charges_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    -- Tax documents: org_tax_doc_lines_dtl RESTRICTs the header, the header
    -- RESTRICTs org_orders_mst, and the header RESTRICTs itself through
    -- supersedes_id. Unlink the supersede chain first.
    UPDATE public.org_tax_documents_mst AS x
    SET supersedes_id = NULL
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.supersedes_id IN (SELECT tax_document_id FROM tmp_cto_target_tax_documents);

    DELETE FROM public.org_tax_doc_lines_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.tax_document_id IN (SELECT tax_document_id FROM tmp_cto_target_tax_documents);

    DELETE FROM public.org_tax_documents_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT tax_document_id FROM tmp_cto_target_tax_documents);

    DELETE FROM public.org_order_taxes_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_status_history AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_order_items_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_domain_events_outbox AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT outbox_event_id FROM tmp_cto_target_outbox_events);

    -- Workflow Engine rows. org_wf_gate_decision_mst RESTRICTs org_orders_mst
    -- and org_wf_release_ln has a NO ACTION link to its header.
    DELETE FROM public.org_wf_release_ln AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.release_id IN (SELECT release_id FROM tmp_cto_target_wf_releases);

    DELETE FROM public.org_wf_release_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT release_id FROM tmp_cto_target_wf_releases);

    DELETE FROM public.org_wf_gate_decision_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    -- Order-linked rows with no foreign key, which would otherwise be left
    -- behind pointing at deleted orders.
    DELETE FROM public.org_order_status_history_legacy AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    DELETE FROM public.org_fin_cost_run_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND (
        x.order_id IN (SELECT order_id FROM tmp_cto_target_orders)
        OR x.order_item_id IN (SELECT order_item_id FROM tmp_cto_target_order_items)
      );

    DELETE FROM public.org_fin_rcpt_alloc_preview_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.source_order_id IN (SELECT order_id FROM tmp_cto_target_orders);

    -- GL posting/audit rows — opt-in via p_include_fin_audit_rows (default
    -- false). org_fin_post_exc_tr / org_fin_post_snapshot_tr CASCADE from
    -- org_fin_post_log_tr, but are also matched by their own source_doc_id
    -- so nothing depends on the cascade. org_fin_journal_mst.
    -- reversal_of_journal_id RESTRICTs itself, so that link is unlinked
    -- before the journal rows are deleted.
    IF p_include_fin_audit_rows THEN
      DELETE FROM public.org_fin_post_exc_tr AS x
      WHERE x.tenant_org_id = p_tenant_org_id
        AND (
          (x.source_doc_type_code, x.source_doc_id) IN (SELECT source_doc_type_code, source_doc_id FROM tmp_cto_target_fin_audit_docs)
          OR x.posting_log_id IN (SELECT post_log_id FROM tmp_cto_target_fin_post_logs)
        );

      DELETE FROM public.org_fin_post_snapshot_tr AS x
      WHERE x.tenant_org_id = p_tenant_org_id
        AND (
          (x.source_doc_type_code, x.source_doc_id) IN (SELECT source_doc_type_code, source_doc_id FROM tmp_cto_target_fin_audit_docs)
          OR x.posting_log_id IN (SELECT post_log_id FROM tmp_cto_target_fin_post_logs)
        );

      UPDATE public.org_fin_journal_mst AS x
      SET reversal_of_journal_id = NULL
      WHERE x.tenant_org_id = p_tenant_org_id
        AND x.reversal_of_journal_id IN (SELECT journal_id FROM tmp_cto_target_fin_journals);

      DELETE FROM public.org_fin_post_log_tr AS x
      WHERE x.tenant_org_id = p_tenant_org_id
        AND x.id IN (SELECT post_log_id FROM tmp_cto_target_fin_post_logs);

      -- org_fin_journal_dtl CASCADEs from org_fin_journal_mst.
      DELETE FROM public.org_fin_journal_mst AS x
      WHERE x.tenant_org_id = p_tenant_org_id
        AND x.id IN (SELECT journal_id FROM tmp_cto_target_fin_journals);
    END IF;

    DELETE FROM public.org_orders_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT order_id FROM tmp_cto_target_orders);

    -- Final verification snapshot — remaining_* should all be 0.
    SELECT jsonb_build_object(
      'targeted_orders', (SELECT count(*) FROM tmp_cto_target_orders),
      'remaining_orders', (SELECT count(*) FROM public.org_orders_mst WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT order_id FROM tmp_cto_target_orders)),
      'remaining_invoices', (SELECT count(*) FROM public.org_invoice_mst WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT invoice_id FROM tmp_cto_target_invoices)),
      'remaining_order_payments', (SELECT count(*) FROM public.org_order_payments_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT order_payment_id FROM tmp_cto_target_order_payments)),
      'remaining_tax_documents', (SELECT count(*) FROM public.org_tax_documents_mst WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT tax_document_id FROM tmp_cto_target_tax_documents)),
      'remaining_wf_releases', (SELECT count(*) FROM public.org_wf_release_mst WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT release_id FROM tmp_cto_target_wf_releases)),
      'remaining_funding_tenders', (SELECT count(*) FROM public.org_sv_funding_tenders_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT funding_tender_id FROM tmp_cto_target_sv_funding_tenders)),
      'remaining_ar_ledger_rows', (SELECT count(*) FROM public.org_customer_ar_ledger_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT ar_ledger_id FROM tmp_cto_target_ar_ledger_rows)),
      'remaining_vouchers', (SELECT count(*) FROM public.org_fin_vouchers_mst WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT voucher_id FROM tmp_cto_target_vouchers)),
      'remaining_wallet_txns', (SELECT count(*) FROM public.org_wallet_txn_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT id FROM tmp_cto_target_wallet_txns)),
      'remaining_advance_txns', (SELECT count(*) FROM public.org_advance_txn_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT id FROM tmp_cto_target_advance_txns)),
      'remaining_gift_card_txns', (SELECT count(*) FROM public.org_gift_card_txn_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT id FROM tmp_cto_target_gift_card_txns)),
      'remaining_credit_note_txns', (SELECT count(*) FROM public.org_credit_note_txn_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT id FROM tmp_cto_target_credit_note_txns)),
      'remaining_loyalty_txns', (SELECT count(*) FROM public.org_loyalty_txn_dtl WHERE tenant_org_id = p_tenant_org_id AND id IN (SELECT id FROM tmp_cto_target_loyalty_txns))
    ) INTO v_verification;
  END IF;

  v_result := jsonb_build_object(
    'dry_run', p_dry_run,
    'blocked', v_blocked,
    'block_reasons', to_jsonb(v_block_reasons),
    'targeted_order_count', v_target_count,
    'target_summary', COALESCE(v_target_summary, '[]'::jsonb),
    'master_repair_preview', COALESCE(v_master_repair_preview, '[]'::jsonb),
    'uncovered_related_refs', COALESCE(v_uncovered_refs, '[]'::jsonb),
    'verification', v_verification
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION cleanup_tenant_orders(UUID, TEXT, UUID[], TEXT[], TEXT, TIMESTAMP, TIMESTAMP, BOOLEAN, INT, BOOLEAN) IS
  'HQ Console destructive order-data cleanup for a single tenant. Ported from supabase/snippets/cleanup_all_order_data_all_tenants_or_one_tenant_fixed.sql (no all-tenants mode; see migration header for the full deviation list). p_dry_run defaults true. Returns blocked/block_reasons instead of raising for data-dependent guard-rail conditions (uncovered related rows; target count over p_max_target_orders); raises only for malformed input. service_role EXECUTE only.';

GRANT EXECUTE ON FUNCTION cleanup_tenant_orders(UUID, TEXT, UUID[], TEXT[], TEXT, TIMESTAMP, TIMESTAMP, BOOLEAN, INT, BOOLEAN) TO service_role;

COMMIT;
