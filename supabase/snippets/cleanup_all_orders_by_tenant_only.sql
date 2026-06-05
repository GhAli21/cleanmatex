--ROLLBACK;
-- =============================================================================
-- Cleanup script: delete ALL order-related test data for ONE tenant
--
-- ONE INPUT ONLY:
--   - Replace 00000000-0000-0000-0000-000000000000 with the test tenant_org_id.
--
-- Behavior:
--   - Automatically targets every order under that tenant.
--   - Deletes related order details, operational rows, payments, invoices, vouchers,
--     stored-value ledger rows, loyalty rows, and related audit/outbox rows included
--     in this script.
--   - No manual order IDs or order numbers are required.
--   - No TRUNCATE / no CASCADE.
--   - Never deletes sys_* configuration tables.
--
-- WARNING:
--   - This is intended for a TEST TENANT only.
--   - If the tenant contains real production orders, those orders will be deleted.
--
-- Coverage:
--   - order rows, item/detail rows, invoice/payment/voucher rows
--   - optional stored-value and loyalty ledgers
--   - optional repair of affected wallet / advance / gift-card /
--     credit-note / loyalty master balances
--   - optional deletion of orphan stored-value masters after cleanup
--
-- Workflow:
--   1. Replace 00000000-0000-0000-0000-000000000000 with the target test tenant UUID.
--   2. Run the script in pgAdmin.
--   3. Review the final verification result set.
-- =============================================================================

BEGIN;

SET LOCAL search_path = public;

-- -----------------------------------------------------------------------------
-- Top-level options
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE cleanup_config (
  execute                            BOOLEAN NOT NULL,
  tenant_org_id                      UUID    NOT NULL,
  max_target_orders                  INTEGER NOT NULL DEFAULT 25,
  fail_on_uncovered_refs             BOOLEAN NOT NULL DEFAULT true,

  -- Auto-target is fixed to ALL_TENANT_ORDERS.
  -- Do not add manual order IDs or order numbers.
  auto_target_orders                 BOOLEAN NOT NULL DEFAULT true,
  auto_target_mode                   TEXT    NOT NULL DEFAULT 'ALL_TENANT_ORDERS',
  auto_order_no_like                 TEXT,
  auto_created_from                  TIMESTAMP WITHOUT TIME ZONE,
  auto_created_to                    TIMESTAMP WITHOUT TIME ZONE,

  include_invoice_rows               BOOLEAN NOT NULL DEFAULT true,
  include_legacy_payment_rows        BOOLEAN NOT NULL DEFAULT true,
  include_order_payment_rows         BOOLEAN NOT NULL DEFAULT true,
  include_voucher_rows               BOOLEAN NOT NULL DEFAULT true,

  include_wallet_rows                BOOLEAN NOT NULL DEFAULT true,
  include_advance_rows               BOOLEAN NOT NULL DEFAULT true,
  include_gift_card_rows             BOOLEAN NOT NULL DEFAULT true,
  include_credit_note_rows           BOOLEAN NOT NULL DEFAULT true,
  include_loyalty_rows               BOOLEAN NOT NULL DEFAULT true,

  update_wallet_masters              BOOLEAN NOT NULL DEFAULT true,
  update_advance_masters             BOOLEAN NOT NULL DEFAULT true,
  update_gift_card_masters           BOOLEAN NOT NULL DEFAULT true,
  update_credit_note_masters         BOOLEAN NOT NULL DEFAULT true,
  update_loyalty_masters             BOOLEAN NOT NULL DEFAULT true,

  delete_empty_wallet_accounts       BOOLEAN NOT NULL DEFAULT false,
  delete_empty_advance_accounts      BOOLEAN NOT NULL DEFAULT false,
  delete_empty_loyalty_accounts      BOOLEAN NOT NULL DEFAULT false,
  delete_orphan_credit_note_headers  BOOLEAN NOT NULL DEFAULT false,
  delete_orphan_gift_card_masters    BOOLEAN NOT NULL DEFAULT false
) ON COMMIT DROP;

INSERT INTO cleanup_config (
  execute,
  tenant_org_id,
  max_target_orders,
  fail_on_uncovered_refs,
  auto_target_orders,
  auto_target_mode,
  auto_order_no_like,
  auto_created_from,
  auto_created_to,
  include_invoice_rows,
  include_legacy_payment_rows,
  include_order_payment_rows,
  include_voucher_rows,
  include_wallet_rows,
  include_advance_rows,
  include_gift_card_rows,
  include_credit_note_rows,
  include_loyalty_rows,
  update_wallet_masters,
  update_advance_masters,
  update_gift_card_masters,
  update_credit_note_masters,
  update_loyalty_masters,
  delete_empty_wallet_accounts,
  delete_empty_advance_accounts,
  delete_empty_loyalty_accounts,
  delete_orphan_credit_note_headers,
  delete_orphan_gift_card_masters
)
VALUES (
  true,
  -- CHANGE ONLY THIS VALUE:
  '11111111-1111-1111-1111-111111111111',--::uuid,
  100000,
  true,
  true,
  'ALL_TENANT_ORDERS',
  NULL,
  NULL,
  NULL,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  false,
  false,
  false
);

DO $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_org_id INTO v_tenant FROM cleanup_config LIMIT 1;
  IF v_tenant = '11111111-1111-1111-1111-111111111111'::uuid THEN
    null;--RAISE EXCEPTION 'Replace cleanup_config.tenant_org_id with the real test tenant_org_id before running this script.';
  END IF;
END $$;

CREATE TEMP TABLE cleanup_order_ids (
  order_id UUID PRIMARY KEY
) ON COMMIT DROP;

CREATE TEMP TABLE cleanup_order_nos (
  order_no TEXT PRIMARY KEY
) ON COMMIT DROP;

-- Optional manual input blocks.
-- No manual order input required.
-- cleanup_order_ids is filled automatically from all orders under tenant_org_id.

-- -----------------------------------------------------------------------------
-- Auto-fill target order ids
-- -----------------------------------------------------------------------------
-- This section fills cleanup_order_ids automatically based on cleanup_config.
-- The script automatically targets all orders for the configured tenant.
INSERT INTO cleanup_order_ids (order_id)
SELECT o.id
FROM public.org_orders_mst AS o
CROSS JOIN cleanup_config AS cfg
WHERE cfg.auto_target_orders
  AND o.tenant_org_id = cfg.tenant_org_id
  AND (
    cfg.auto_target_mode = 'ALL_TENANT_ORDERS'
    OR (
      cfg.auto_target_mode = 'ORDER_NO_PATTERN'
      AND cfg.auto_order_no_like IS NOT NULL
      AND o.order_no ILIKE cfg.auto_order_no_like
    )
    OR (
      cfg.auto_target_mode = 'CREATED_RANGE'
      AND (cfg.auto_created_from IS NULL OR o.created_at >= cfg.auto_created_from)
      AND (cfg.auto_created_to IS NULL OR o.created_at < cfg.auto_created_to)
    )
  )
ON CONFLICT (order_id) DO NOTHING;

-- Also convert order numbers to ids, so all downstream logic uses one canonical target list.
INSERT INTO cleanup_order_ids (order_id)
SELECT o.id
FROM public.org_orders_mst AS o
CROSS JOIN cleanup_config AS cfg
WHERE o.tenant_org_id = cfg.tenant_org_id
  AND o.order_no IN (SELECT order_no FROM cleanup_order_nos)
ON CONFLICT (order_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Primary target sets
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_target_orders ON COMMIT DROP AS
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
CROSS JOIN cleanup_config AS cfg
WHERE o.tenant_org_id = cfg.tenant_org_id
  AND o.id IN (SELECT order_id FROM cleanup_order_ids);

CREATE UNIQUE INDEX idx_tmp_target_orders ON tmp_target_orders (order_id);

CREATE TEMP TABLE tmp_target_customers ON COMMIT DROP AS
SELECT DISTINCT customer_id
FROM tmp_target_orders
WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_customers ON tmp_target_customers (customer_id);

CREATE TEMP TABLE tmp_target_order_items ON COMMIT DROP AS
SELECT i.id AS order_item_id
FROM public.org_order_items_dtl AS i
CROSS JOIN cleanup_config AS cfg
WHERE i.tenant_org_id = cfg.tenant_org_id
  AND i.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_order_items ON tmp_target_order_items (order_item_id);

CREATE TEMP TABLE tmp_target_asm_tasks ON COMMIT DROP AS
SELECT t.id AS task_id
FROM public.org_asm_tasks_mst AS t
CROSS JOIN cleanup_config AS cfg
WHERE t.tenant_org_id = cfg.tenant_org_id
  AND t.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_asm_tasks ON tmp_target_asm_tasks (task_id);

CREATE TEMP TABLE tmp_target_invoices ON COMMIT DROP AS
SELECT DISTINCT inv.id AS invoice_id
FROM public.org_invoice_mst AS inv
CROSS JOIN cleanup_config AS cfg
WHERE inv.tenant_org_id = cfg.tenant_org_id
  AND inv.order_id IN (SELECT order_id FROM tmp_target_orders)

UNION

SELECT DISTINCT link.invoice_id
FROM public.org_invoice_orders_dtl AS link
CROSS JOIN cleanup_config AS cfg
WHERE link.tenant_org_id = cfg.tenant_org_id
  AND link.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_invoices ON tmp_target_invoices (invoice_id);

CREATE TEMP TABLE tmp_target_legacy_payments ON COMMIT DROP AS
SELECT DISTINCT p.id AS payment_id
FROM public.org_payments_dtl_tr AS p
CROSS JOIN cleanup_config AS cfg
WHERE p.tenant_org_id = cfg.tenant_org_id
  AND (
    p.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR p.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
  );

CREATE UNIQUE INDEX idx_tmp_target_legacy_payments ON tmp_target_legacy_payments (payment_id);

CREATE TEMP TABLE tmp_target_order_payments ON COMMIT DROP AS
SELECT DISTINCT p.id AS order_payment_id
FROM public.org_order_payments_dtl AS p
CROSS JOIN cleanup_config AS cfg
WHERE p.tenant_org_id = cfg.tenant_org_id
  AND p.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_order_payments ON tmp_target_order_payments (order_payment_id);

CREATE TEMP TABLE tmp_target_order_refunds ON COMMIT DROP AS
SELECT DISTINCT r.id AS refund_id
FROM public.org_order_refunds_dtl AS r
CROSS JOIN cleanup_config AS cfg
WHERE r.tenant_org_id = cfg.tenant_org_id
  AND r.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_order_refunds ON tmp_target_order_refunds (refund_id);

CREATE TEMP TABLE tmp_target_credit_apps ON COMMIT DROP AS
SELECT DISTINCT
  c.id               AS credit_app_id,
  c.credit_type,
  c.credit_source_id
FROM public.org_order_credit_apps_dtl AS c
CROSS JOIN cleanup_config AS cfg
WHERE c.tenant_org_id = cfg.tenant_org_id
  AND c.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_credit_apps ON tmp_target_credit_apps (credit_app_id);

CREATE TEMP TABLE tmp_target_order_adjustments ON COMMIT DROP AS
SELECT DISTINCT a.id AS adjustment_id
FROM public.org_order_adjustments_dtl AS a
CROSS JOIN cleanup_config AS cfg
WHERE a.tenant_org_id = cfg.tenant_org_id
  AND a.order_id IN (SELECT order_id FROM tmp_target_orders);

CREATE UNIQUE INDEX idx_tmp_target_order_adjustments ON tmp_target_order_adjustments (adjustment_id);

CREATE TEMP TABLE tmp_target_vouchers ON COMMIT DROP AS
SELECT DISTINCT v.id AS voucher_id
FROM public.org_fin_vouchers_mst AS v
CROSS JOIN cleanup_config AS cfg
WHERE v.tenant_org_id = cfg.tenant_org_id
  AND (
    v.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR v.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
  )

UNION

SELECT DISTINCT p.voucher_id
FROM public.org_payments_dtl_tr AS p
CROSS JOIN cleanup_config AS cfg
WHERE p.tenant_org_id = cfg.tenant_org_id
  AND p.id IN (SELECT payment_id FROM tmp_target_legacy_payments)
  AND p.voucher_id IS NOT NULL

UNION

SELECT DISTINCT p.fin_voucher_id
FROM public.org_order_payments_dtl AS p
CROSS JOIN cleanup_config AS cfg
WHERE p.tenant_org_id = cfg.tenant_org_id
  AND p.id IN (SELECT order_payment_id FROM tmp_target_order_payments)
  AND p.fin_voucher_id IS NOT NULL

UNION

SELECT DISTINCT c.fin_voucher_id
FROM public.org_order_credit_apps_dtl AS c
CROSS JOIN cleanup_config AS cfg
WHERE c.tenant_org_id = cfg.tenant_org_id
  AND c.id IN (SELECT credit_app_id FROM tmp_target_credit_apps)
  AND c.fin_voucher_id IS NOT NULL

UNION

SELECT DISTINCT r.voucher_id
FROM public.org_invoice_payments_dtl AS r
CROSS JOIN cleanup_config AS cfg
WHERE r.tenant_org_id = cfg.tenant_org_id
  AND r.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
  AND r.voucher_id IS NOT NULL

UNION

SELECT DISTINCT r.voucher_id
FROM public.org_rcpt_receipts_mst AS r
CROSS JOIN cleanup_config AS cfg
WHERE r.tenant_org_id = cfg.tenant_org_id
  AND r.order_id IN (SELECT order_id FROM tmp_target_orders)
  AND r.voucher_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_vouchers ON tmp_target_vouchers (voucher_id);

CREATE TEMP TABLE tmp_target_voucher_lines ON COMMIT DROP AS
SELECT DISTINCT l.id AS voucher_line_id
FROM public.org_fin_voucher_trx_lines_dtl AS l
CROSS JOIN cleanup_config AS cfg
WHERE l.tenant_org_id = cfg.tenant_org_id
  AND (
    l.voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR l.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR l.order_payment_id IN (SELECT order_payment_id FROM tmp_target_order_payments)
    OR l.id IN (
      SELECT p.fin_voucher_trx_line_id
      FROM public.org_order_payments_dtl AS p
      WHERE p.tenant_org_id = cfg.tenant_org_id
        AND p.fin_voucher_trx_line_id IS NOT NULL
        AND p.id IN (SELECT order_payment_id FROM tmp_target_order_payments)
    )
    OR l.id IN (
      SELECT c.fin_voucher_trx_line_id
      FROM public.org_order_credit_apps_dtl AS c
      WHERE c.tenant_org_id = cfg.tenant_org_id
        AND c.fin_voucher_trx_line_id IS NOT NULL
        AND c.id IN (SELECT credit_app_id FROM tmp_target_credit_apps)
    )
  );

CREATE UNIQUE INDEX idx_tmp_target_voucher_lines ON tmp_target_voucher_lines (voucher_line_id);

CREATE TEMP TABLE tmp_target_credit_notes ON COMMIT DROP AS
SELECT DISTINCT n.id AS credit_note_id
FROM public.org_credit_notes_mst AS n
CROSS JOIN cleanup_config AS cfg
WHERE n.tenant_org_id = cfg.tenant_org_id
  AND n.related_order_id IN (SELECT order_id FROM tmp_target_orders)

UNION

SELECT DISTINCT t.credit_note_id
FROM public.org_credit_note_txn_dtl AS t
CROSS JOIN cleanup_config AS cfg
WHERE t.tenant_org_id = cfg.tenant_org_id
  AND (
    t.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR t.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR t.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  )

UNION

SELECT DISTINCT c.credit_source_id
FROM tmp_target_credit_apps AS c
WHERE c.credit_type = 'CUSTOMER_CREDIT'
  AND c.credit_source_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_credit_notes ON tmp_target_credit_notes (credit_note_id);

CREATE TEMP TABLE tmp_target_outbox_events ON COMMIT DROP AS
SELECT DISTINCT h.outbox_event_id
FROM public.org_order_history AS h
CROSS JOIN cleanup_config AS cfg
WHERE h.tenant_org_id = cfg.tenant_org_id
  AND h.order_id IN (SELECT order_id FROM tmp_target_orders)
  AND h.outbox_event_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_outbox_events ON tmp_target_outbox_events (outbox_event_id);

-- -----------------------------------------------------------------------------
-- Stored-value / loyalty target sets
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_target_wallet_txns ON COMMIT DROP AS
SELECT DISTINCT
  x.id,
  x.wallet_id,
  x.customer_id,
  x.amount,
  x.balance_before,
  x.balance_after,
  x.created_at
FROM public.org_wallet_txn_dtl AS x
CROSS JOIN cleanup_config AS cfg
WHERE x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  );

CREATE UNIQUE INDEX idx_tmp_target_wallet_txns ON tmp_target_wallet_txns (id);

CREATE TEMP TABLE tmp_target_advance_txns ON COMMIT DROP AS
SELECT DISTINCT
  x.id,
  x.advance_id,
  x.customer_id,
  x.amount,
  x.balance_before,
  x.balance_after,
  x.created_at
FROM public.org_advance_txn_dtl AS x
CROSS JOIN cleanup_config AS cfg
WHERE x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  );

CREATE UNIQUE INDEX idx_tmp_target_advance_txns ON tmp_target_advance_txns (id);

CREATE TEMP TABLE tmp_target_gift_card_txns ON COMMIT DROP AS
SELECT DISTINCT
  x.id,
  x.gift_card_id,
  x.amount,
  x.balance_before,
  x.balance_after,
  x.transaction_type,
  x.transaction_date
FROM public.org_gift_card_txn_dtl AS x
CROSS JOIN cleanup_config AS cfg
WHERE x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
    OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  );

CREATE UNIQUE INDEX idx_tmp_target_gift_card_txns ON tmp_target_gift_card_txns (id);

CREATE TEMP TABLE tmp_target_credit_note_txns ON COMMIT DROP AS
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
CROSS JOIN cleanup_config AS cfg
WHERE x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.credit_note_id IN (SELECT credit_note_id FROM tmp_target_credit_notes)
    OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  );

CREATE UNIQUE INDEX idx_tmp_target_credit_note_txns ON tmp_target_credit_note_txns (id);

CREATE TEMP TABLE tmp_target_loyalty_txns ON COMMIT DROP AS
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
CROSS JOIN cleanup_config AS cfg
WHERE x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  );

CREATE UNIQUE INDEX idx_tmp_target_loyalty_txns ON tmp_target_loyalty_txns (id);

CREATE TEMP TABLE tmp_target_wallets ON COMMIT DROP AS
SELECT DISTINCT wallet_id
FROM tmp_target_wallet_txns

UNION

SELECT DISTINCT credit_source_id
FROM tmp_target_credit_apps
WHERE credit_type = 'WALLET'
  AND credit_source_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_wallets ON tmp_target_wallets (wallet_id);

CREATE TEMP TABLE tmp_target_advances ON COMMIT DROP AS
SELECT DISTINCT advance_id
FROM tmp_target_advance_txns

UNION

SELECT DISTINCT credit_source_id
FROM tmp_target_credit_apps
WHERE credit_type = 'CUSTOMER_ADVANCE'
  AND credit_source_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_advances ON tmp_target_advances (advance_id);

CREATE TEMP TABLE tmp_target_gift_cards ON COMMIT DROP AS
SELECT DISTINCT gift_card_id
FROM tmp_target_gift_card_txns

UNION

SELECT DISTINCT gift_card_id
FROM tmp_target_orders
WHERE gift_card_id IS NOT NULL

UNION

SELECT DISTINCT gift_card_id
FROM public.org_invoice_mst
WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1)
  AND id IN (SELECT invoice_id FROM tmp_target_invoices)
  AND gift_card_id IS NOT NULL

UNION

SELECT DISTINCT gift_card_id
FROM public.org_payments_dtl_tr
WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1)
  AND id IN (SELECT payment_id FROM tmp_target_legacy_payments)
  AND gift_card_id IS NOT NULL

UNION

SELECT DISTINCT credit_source_id
FROM tmp_target_credit_apps
WHERE credit_type = 'GIFT_CARD'
  AND credit_source_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_gift_cards ON tmp_target_gift_cards (gift_card_id);

CREATE TEMP TABLE tmp_target_loyalty_accounts ON COMMIT DROP AS
SELECT DISTINCT account_id
FROM tmp_target_loyalty_txns

UNION

SELECT DISTINCT credit_source_id
FROM tmp_target_credit_apps
WHERE credit_type = 'LOYALTY_CREDIT'
  AND credit_source_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tmp_target_loyalty_accounts ON tmp_target_loyalty_accounts (account_id);

-- -----------------------------------------------------------------------------
-- Delta tables used to repair master balances after ledger-row deletes
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_wallet_master_delta ON COMMIT DROP AS
SELECT
  wallet_id,
  sum(balance_after - balance_before) AS balance_delta
FROM tmp_target_wallet_txns
GROUP BY wallet_id;

CREATE UNIQUE INDEX idx_tmp_wallet_master_delta ON tmp_wallet_master_delta (wallet_id);

CREATE TEMP TABLE tmp_advance_master_delta ON COMMIT DROP AS
SELECT
  advance_id,
  sum(balance_after - balance_before) AS balance_delta
FROM tmp_target_advance_txns
GROUP BY advance_id;

CREATE UNIQUE INDEX idx_tmp_advance_master_delta ON tmp_advance_master_delta (advance_id);

CREATE TEMP TABLE tmp_credit_note_master_delta ON COMMIT DROP AS
SELECT
  credit_note_id,
  sum(balance_after - balance_before) AS balance_delta
FROM tmp_target_credit_note_txns
GROUP BY credit_note_id;

CREATE UNIQUE INDEX idx_tmp_credit_note_master_delta ON tmp_credit_note_master_delta (credit_note_id);

CREATE TEMP TABLE tmp_gift_card_master_delta ON COMMIT DROP AS
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
FROM tmp_target_gift_card_txns
GROUP BY gift_card_id;

CREATE UNIQUE INDEX idx_tmp_gift_card_master_delta ON tmp_gift_card_master_delta (gift_card_id);

CREATE TEMP TABLE tmp_loyalty_master_delta ON COMMIT DROP AS
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
FROM tmp_target_loyalty_txns
GROUP BY account_id, customer_id;

CREATE UNIQUE INDEX idx_tmp_loyalty_master_delta ON tmp_loyalty_master_delta (account_id);

-- -----------------------------------------------------------------------------
-- Uncovered reference scan: if new related org_* tables appear, preview them
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_uncovered_related_refs (
  reference_scope TEXT   NOT NULL,
  table_name      TEXT   NOT NULL,
  link_column     TEXT   NOT NULL,
  row_count       BIGINT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  v_tenant_org_id UUID;
  r RECORD;
  v_count BIGINT;
  v_predicate TEXT;
BEGIN
  SELECT tenant_org_id
  INTO v_tenant_org_id
  FROM cleanup_config
  LIMIT 1;

  FOR r IN
    SELECT
      c.table_name,
      c.column_name,
      CASE c.column_name
        WHEN 'order_id'                THEN 'ORDER'
        WHEN 'source_order_id'         THEN 'ORDER'
        WHEN 'related_order_id'        THEN 'ORDER'
        WHEN 'invoice_id'              THEN 'INVOICE'
        WHEN 'payment_id'              THEN 'LEGACY_PAYMENT'
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
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE 'org\_%' ESCAPE '\'
      AND c.column_name IN (
        'order_id',
        'source_order_id',
        'related_order_id',
        'invoice_id',
        'payment_id',
        'order_payment_id',
        'voucher_id',
        'fin_voucher_id',
        'fin_voucher_trx_line_id',
        'outbox_event_id',
        'credit_note_id',
        'gift_card_id',
        'wallet_id',
        'advance_id',
        'account_id'
      )
      AND c.table_name NOT IN (
        'org_orders_mst',
        'org_order_items_dtl',
        'org_order_preferences_dtl',
        'org_order_discounts_dtl',
        'org_order_status_history',
        'org_order_edit_locks',
        'org_payments_dtl_tr',
        'org_fin_vouchers_mst',
        'org_order_history',
        'org_order_item_issues',
        'org_order_item_processing_steps',
        'org_gift_card_txn_dtl',
        'org_promotion_usage_dtl',
        'org_asm_tasks_mst',
        'org_dlv_stops_dtl',
        'org_pck_packing_lists_mst',
        'org_qa_decisions_tr',
        'org_rcpt_receipts_mst',
        'org_order_item_pieces_dtl',
        'org_ord_transition_events',
        'org_order_edit_history',
        'org_invoice_mst',
        'org_invoice_lines_dtl',
        'org_invoice_orders_dtl',
        'org_cash_drawer_movements_dtl',
        'org_order_credit_apps_dtl',
        'org_order_refunds_dtl',
        'org_order_payments_dtl',
        'org_order_charges_dtl',
        'org_order_taxes_dtl',
        'org_order_adjustments_dtl',
        'org_wallet_txn_dtl',
        'org_advance_txn_dtl',
        'org_credit_notes_mst',
        'org_credit_note_txn_dtl',
        'org_loyalty_txn_dtl',
        'org_order_piece_hist_tr',
        'org_domain_events_outbox',
        'org_customer_ar_ledger_dtl',
        'org_invoice_payments_dtl',
        'org_invoice_adjustments_dtl',
        'org_invoice_status_history_dtl',
        'org_fin_voucher_trx_lines_dtl',
        'org_payment_audit_log'
      )
  LOOP
    v_predicate := CASE r.column_name
      WHEN 'order_id'                THEN 't.order_id IN (SELECT order_id FROM tmp_target_orders)'
      WHEN 'source_order_id'         THEN 't.source_order_id IN (SELECT order_id FROM tmp_target_orders)'
      WHEN 'related_order_id'        THEN 't.related_order_id IN (SELECT order_id FROM tmp_target_orders)'
      WHEN 'invoice_id'              THEN 't.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)'
      WHEN 'payment_id'              THEN 't.payment_id IN (SELECT payment_id FROM tmp_target_legacy_payments)'
      WHEN 'order_payment_id'        THEN 't.order_payment_id IN (SELECT order_payment_id FROM tmp_target_order_payments)'
      WHEN 'voucher_id'              THEN 't.voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)'
      WHEN 'fin_voucher_id'          THEN 't.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)'
      WHEN 'fin_voucher_trx_line_id' THEN 't.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)'
      WHEN 'outbox_event_id'         THEN 't.outbox_event_id IN (SELECT outbox_event_id FROM tmp_target_outbox_events)'
      WHEN 'credit_note_id'          THEN 't.credit_note_id IN (SELECT credit_note_id FROM tmp_target_credit_notes)'
      WHEN 'gift_card_id'            THEN 't.gift_card_id IN (SELECT gift_card_id FROM tmp_target_gift_cards)'
      WHEN 'wallet_id'               THEN 't.wallet_id IN (SELECT wallet_id FROM tmp_target_wallets)'
      WHEN 'advance_id'              THEN 't.advance_id IN (SELECT advance_id FROM tmp_target_advances)'
      WHEN 'account_id'              THEN 't.account_id IN (SELECT account_id FROM tmp_target_loyalty_accounts)'
      ELSE null
    END;

    IF v_predicate IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t
       WHERE t.tenant_org_id = $1
         AND %s',
      r.table_name,
      v_predicate
    )
    INTO v_count
    USING v_tenant_org_id;

    IF v_count > 0 THEN
      INSERT INTO tmp_uncovered_related_refs (reference_scope, table_name, link_column, row_count)
      VALUES (r.reference_scope, r.table_name, r.column_name, v_count);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Guard rails
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_cfg cleanup_config%ROWTYPE;
  v_target_count INTEGER;
  v_uncovered_count BIGINT;
  v_wallet_rows BIGINT;
  v_advance_rows BIGINT;
  v_gift_card_rows BIGINT;
  v_credit_note_rows BIGINT;
  v_loyalty_rows BIGINT;
BEGIN
  SELECT *
  INTO v_cfg
  FROM cleanup_config
  LIMIT 1;

  IF v_cfg.tenant_org_id = '11111111-1111-1111-1111-111111111111'::uuid THEN
    null;--RAISE EXCEPTION 'Set cleanup_config.tenant_org_id before running this script.';
  END IF;

  IF v_cfg.auto_target_mode NOT IN ('ALL_TENANT_ORDERS', 'ORDER_NO_PATTERN', 'CREATED_RANGE') THEN
    RAISE EXCEPTION
      'Invalid cleanup_config.auto_target_mode: %. Allowed: ALL_TENANT_ORDERS, ORDER_NO_PATTERN, CREATED_RANGE.',
      v_cfg.auto_target_mode;
  END IF;

  IF v_cfg.auto_target_mode = 'ORDER_NO_PATTERN'
     AND v_cfg.auto_order_no_like IS NULL
     AND NOT EXISTS (SELECT 1 FROM cleanup_order_ids) THEN
    RAISE EXCEPTION 'auto_target_mode = ORDER_NO_PATTERN requires auto_order_no_like or manual cleanup_order_ids.';
  END IF;

  IF NOT v_cfg.auto_target_orders
     AND NOT EXISTS (SELECT 1 FROM cleanup_order_ids) THEN
    RAISE EXCEPTION 'No target orders provided. Enable auto_target_orders or insert cleanup_order_ids/order_nos.';
  END IF;

  SELECT count(*)
  INTO v_target_count
  FROM tmp_target_orders;

  IF v_target_count = 0 THEN
    RAISE EXCEPTION 'No matching orders found for tenant %.', v_cfg.tenant_org_id;
  END IF;

  IF v_target_count > v_cfg.max_target_orders THEN
    RAISE EXCEPTION
      'Refusing to target % orders because max_target_orders is %.',
      v_target_count,
      v_cfg.max_target_orders;
  END IF;

  SELECT COALESCE(sum(row_count), 0)
  INTO v_uncovered_count
  FROM tmp_uncovered_related_refs;

  SELECT count(*) INTO v_wallet_rows      FROM tmp_target_wallet_txns;
  SELECT count(*) INTO v_advance_rows     FROM tmp_target_advance_txns;
  SELECT count(*) INTO v_gift_card_rows   FROM tmp_target_gift_card_txns;
  SELECT count(*) INTO v_credit_note_rows FROM tmp_target_credit_note_txns;
  SELECT count(*) INTO v_loyalty_rows     FROM tmp_target_loyalty_txns;

  IF NOT v_cfg.execute THEN
    RAISE NOTICE 'Dry run only. Review preview result sets, then set cleanup_config.execute = true.';
    RETURN;
  END IF;

  IF v_cfg.fail_on_uncovered_refs AND v_uncovered_count > 0 THEN
    RAISE EXCEPTION
      'Execution blocked: uncovered related org_* rows exist. Review the uncovered_related_refs result set first.';
  END IF;

  IF v_wallet_rows > 0 THEN
    IF NOT v_cfg.include_wallet_rows THEN
      RAISE EXCEPTION 'Execution blocked: target wallet txn rows exist, but include_wallet_rows = false.';
    END IF;
    IF NOT v_cfg.update_wallet_masters THEN
      RAISE EXCEPTION 'Execution blocked: wallet txn cleanup requires update_wallet_masters = true.';
    END IF;
  END IF;

  IF v_advance_rows > 0 THEN
    IF NOT v_cfg.include_advance_rows THEN
      RAISE EXCEPTION 'Execution blocked: target advance txn rows exist, but include_advance_rows = false.';
    END IF;
    IF NOT v_cfg.update_advance_masters THEN
      RAISE EXCEPTION 'Execution blocked: advance txn cleanup requires update_advance_masters = true.';
    END IF;
  END IF;

  IF v_gift_card_rows > 0 THEN
    IF NOT v_cfg.include_gift_card_rows THEN
      RAISE EXCEPTION 'Execution blocked: target gift-card txn rows exist, but include_gift_card_rows = false.';
    END IF;
    IF NOT v_cfg.update_gift_card_masters THEN
      RAISE EXCEPTION 'Execution blocked: gift-card txn cleanup requires update_gift_card_masters = true.';
    END IF;
  END IF;

  IF v_credit_note_rows > 0 OR EXISTS (SELECT 1 FROM tmp_target_credit_notes) THEN
    IF NOT v_cfg.include_credit_note_rows THEN
      RAISE EXCEPTION 'Execution blocked: target credit-note rows exist, but include_credit_note_rows = false.';
    END IF;
    IF v_credit_note_rows > 0 AND NOT v_cfg.update_credit_note_masters THEN
      RAISE EXCEPTION 'Execution blocked: credit-note txn cleanup requires update_credit_note_masters = true.';
    END IF;
  END IF;

  IF v_loyalty_rows > 0 THEN
    IF NOT v_cfg.include_loyalty_rows THEN
      RAISE EXCEPTION 'Execution blocked: target loyalty rows exist, but include_loyalty_rows = false.';
    END IF;
    IF NOT v_cfg.update_loyalty_masters THEN
      RAISE EXCEPTION 'Execution blocked: loyalty txn cleanup requires update_loyalty_masters = true.';
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Preview
-- -----------------------------------------------------------------------------
SELECT
  'cleanup_config' AS section,
  execute,
  tenant_org_id,
  auto_target_orders,
  auto_target_mode,
  auto_order_no_like,
  auto_created_from,
  auto_created_to,
  max_target_orders
FROM cleanup_config;

SELECT
  'target_orders_preview' AS section,
  order_id,
  order_no,
  customer_id,
  created_at,
  status,
  payment_status
FROM tmp_target_orders
ORDER BY created_at DESC, order_no
LIMIT 200;


SELECT
  'target_summary' AS section,
  table_name,
  row_count
FROM (
  VALUES
    ('org_orders_mst',                (SELECT count(*)::bigint FROM tmp_target_orders)),
    ('org_order_items_dtl',           (SELECT count(*)::bigint FROM tmp_target_order_items)),
    ('org_asm_tasks_mst',             (SELECT count(*)::bigint FROM tmp_target_asm_tasks)),
    ('org_invoice_mst',               (SELECT count(*)::bigint FROM tmp_target_invoices)),
    ('org_payments_dtl_tr',           (SELECT count(*)::bigint FROM tmp_target_legacy_payments)),
    ('org_order_payments_dtl',        (SELECT count(*)::bigint FROM tmp_target_order_payments)),
    ('org_order_refunds_dtl',         (SELECT count(*)::bigint FROM tmp_target_order_refunds)),
    ('org_order_credit_apps_dtl',     (SELECT count(*)::bigint FROM tmp_target_credit_apps)),
    ('org_order_adjustments_dtl',     (SELECT count(*)::bigint FROM tmp_target_order_adjustments)),
    ('org_fin_vouchers_mst',          (SELECT count(*)::bigint FROM tmp_target_vouchers)),
    ('org_fin_voucher_trx_lines_dtl', (SELECT count(*)::bigint FROM tmp_target_voucher_lines)),
    ('org_credit_notes_mst',          (SELECT count(*)::bigint FROM tmp_target_credit_notes)),
    ('org_wallet_txn_dtl',            (SELECT count(*)::bigint FROM tmp_target_wallet_txns)),
    ('org_advance_txn_dtl',           (SELECT count(*)::bigint FROM tmp_target_advance_txns)),
    ('org_gift_card_txn_dtl',         (SELECT count(*)::bigint FROM tmp_target_gift_card_txns)),
    ('org_credit_note_txn_dtl',       (SELECT count(*)::bigint FROM tmp_target_credit_note_txns)),
    ('org_loyalty_txn_dtl',           (SELECT count(*)::bigint FROM tmp_target_loyalty_txns)),
    ('org_domain_events_outbox',      (SELECT count(*)::bigint FROM tmp_target_outbox_events))
) AS preview(table_name, row_count)
WHERE row_count > 0
ORDER BY table_name;

SELECT
  'master_repair_preview' AS section,
  table_name,
  target_master_count,
  affected_txn_count
FROM (
  VALUES
    ('org_customer_wallets_mst',   (SELECT count(*)::bigint FROM tmp_target_wallets),          (SELECT count(*)::bigint FROM tmp_target_wallet_txns)),
    ('org_customer_advances_mst',  (SELECT count(*)::bigint FROM tmp_target_advances),         (SELECT count(*)::bigint FROM tmp_target_advance_txns)),
    ('org_gift_cards_mst',         (SELECT count(*)::bigint FROM tmp_target_gift_cards),       (SELECT count(*)::bigint FROM tmp_target_gift_card_txns)),
    ('org_credit_notes_mst',       (SELECT count(*)::bigint FROM tmp_target_credit_notes),     (SELECT count(*)::bigint FROM tmp_target_credit_note_txns)),
    ('org_loyalty_accounts_mst',   (SELECT count(*)::bigint FROM tmp_target_loyalty_accounts), (SELECT count(*)::bigint FROM tmp_target_loyalty_txns))
) AS preview(table_name, target_master_count, affected_txn_count)
WHERE target_master_count > 0 OR affected_txn_count > 0
ORDER BY table_name;

SELECT
  'uncovered_related_refs' AS section,
  reference_scope,
  table_name,
  link_column,
  row_count
FROM tmp_uncovered_related_refs
ORDER BY reference_scope, table_name, link_column;

-- -----------------------------------------------------------------------------
-- Delete dependent rows first
-- -----------------------------------------------------------------------------
DELETE FROM public.org_customer_ar_ledger_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
    OR x.payment_alloc_id IN (
      SELECT id
      FROM public.org_invoice_payments_dtl
      WHERE tenant_org_id = cfg.tenant_org_id
        AND invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
    )
    OR x.adjustment_id IN (
      SELECT id
      FROM public.org_invoice_adjustments_dtl
      WHERE tenant_org_id = cfg.tenant_org_id
        AND invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
    )
    OR x.voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
  );

DELETE FROM public.org_invoice_payments_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices);

DELETE FROM public.org_invoice_status_history_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices);

DELETE FROM public.org_invoice_adjustments_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices);

DELETE FROM public.org_invoice_lines_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
    OR x.source_order_id IN (SELECT order_id FROM tmp_target_orders)
  );

DELETE FROM public.org_invoice_orders_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
    OR x.order_id IN (SELECT order_id FROM tmp_target_orders)
  );

DELETE FROM public.org_payment_audit_log AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_legacy_payment_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.payment_id IN (SELECT payment_id FROM tmp_target_legacy_payments);

DELETE FROM public.org_cash_drawer_movements_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_voucher_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.order_payment_id IN (SELECT order_payment_id FROM tmp_target_order_payments)
    OR x.fin_voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers)
    OR x.fin_voucher_trx_line_id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines)
  );

DELETE FROM public.org_rcpt_receipts_mst AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR (cfg.include_voucher_rows AND x.voucher_id IN (SELECT voucher_id FROM tmp_target_vouchers))
  );

DELETE FROM public.org_promotion_usage_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.order_id IN (SELECT order_id FROM tmp_target_orders)
    OR x.invoice_id IN (SELECT invoice_id FROM tmp_target_invoices)
  );

DELETE FROM public.org_order_refunds_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_order_payment_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT refund_id FROM tmp_target_order_refunds);

DELETE FROM public.org_order_credit_apps_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT credit_app_id FROM tmp_target_credit_apps);

DELETE FROM public.org_order_adjustments_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT adjustment_id FROM tmp_target_order_adjustments);

DELETE FROM public.org_wallet_txn_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_wallet_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT id FROM tmp_target_wallet_txns);

DELETE FROM public.org_advance_txn_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_advance_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT id FROM tmp_target_advance_txns);

DELETE FROM public.org_gift_card_txn_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_gift_card_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT id FROM tmp_target_gift_card_txns);

DELETE FROM public.org_credit_note_txn_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_credit_note_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT id FROM tmp_target_credit_note_txns);

DELETE FROM public.org_loyalty_txn_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_loyalty_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT id FROM tmp_target_loyalty_txns);

DELETE FROM public.org_order_payments_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_order_payment_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT order_payment_id FROM tmp_target_order_payments);

DELETE FROM public.org_payments_dtl_tr AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_legacy_payment_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT payment_id FROM tmp_target_legacy_payments);

DELETE FROM public.org_fin_voucher_trx_lines_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_voucher_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT voucher_line_id FROM tmp_target_voucher_lines);

DELETE FROM public.org_fin_vouchers_mst AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_voucher_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT voucher_id FROM tmp_target_vouchers);

-- -----------------------------------------------------------------------------
-- Repair stored-value / loyalty masters from deleted row deltas
-- -----------------------------------------------------------------------------
UPDATE public.org_customer_wallets_mst AS m
SET
  balance = GREATEST(0, m.balance - d.balance_delta),
  last_activity_at = (
    SELECT max(t.created_at)
    FROM public.org_wallet_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.wallet_id = m.id
  ),
  updated_at = now(),
  updated_info = 'cleanup_test_orders.sql: reverse deleted wallet txn effects'
FROM tmp_wallet_master_delta AS d
JOIN cleanup_config AS cfg ON true
WHERE cfg.execute
  AND cfg.include_wallet_rows
  AND cfg.update_wallet_masters
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id = d.wallet_id;

UPDATE public.org_customer_advances_mst AS m
SET
  balance = GREATEST(0, m.balance - d.balance_delta),
  last_activity_at = (
    SELECT max(t.created_at)
    FROM public.org_advance_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.advance_id = m.id
  ),
  updated_at = now(),
  updated_info = 'cleanup_test_orders.sql: reverse deleted advance txn effects'
FROM tmp_advance_master_delta AS d
JOIN cleanup_config AS cfg ON true
WHERE cfg.execute
  AND cfg.include_advance_rows
  AND cfg.update_advance_masters
  AND m.tenant_org_id = cfg.tenant_org_id
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
  updated_info = 'cleanup_test_orders.sql: reverse deleted credit-note txn effects'
FROM tmp_credit_note_master_delta AS d
JOIN cleanup_config AS cfg ON true
WHERE cfg.execute
  AND cfg.include_credit_note_rows
  AND cfg.update_credit_note_masters
  AND m.tenant_org_id = cfg.tenant_org_id
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
  updated_info = 'cleanup_test_orders.sql: reverse deleted gift-card txn effects'
FROM tmp_gift_card_master_delta AS d
JOIN cleanup_config AS cfg ON true
WHERE cfg.execute
  AND cfg.include_gift_card_rows
  AND cfg.update_gift_card_masters
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id = d.gift_card_id;

UPDATE public.org_loyalty_accounts_mst AS m
SET
  points_balance = GREATEST(0, m.points_balance - d.points_delta),
  lifetime_earned = GREATEST(0, m.lifetime_earned - d.lifetime_earned_delta),
  current_tier_id = (
    SELECT t.id
    FROM public.org_loyalty_tiers_cf AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.program_id = m.program_id
      AND t.is_active = true
      AND t.min_points <= GREATEST(0, m.lifetime_earned - d.lifetime_earned_delta)
    ORDER BY t.min_points DESC, t.sort_order DESC, t.id DESC
    LIMIT 1
  ),
  last_activity_at = (
    SELECT max(t.created_at)
    FROM public.org_loyalty_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.account_id = m.id
  ),
  updated_at = now(),
  updated_info = 'cleanup_test_orders.sql: reverse deleted loyalty txn effects'
FROM tmp_loyalty_master_delta AS d
JOIN cleanup_config AS cfg ON true
WHERE cfg.execute
  AND cfg.include_loyalty_rows
  AND cfg.update_loyalty_masters
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id = d.account_id;

UPDATE public.org_customers_mst AS c
SET
  loyalty_points = COALESCE((
    SELECT sum(a.points_balance)
    FROM public.org_loyalty_accounts_mst AS a
    WHERE a.tenant_org_id = c.tenant_org_id
      AND a.customer_id = c.id
      AND a.is_active = true
  ), 0),
  updated_at = now(),
  updated_info = 'cleanup_test_orders.sql: sync loyalty_points from loyalty accounts'
FROM cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_loyalty_rows
  AND cfg.update_loyalty_masters
  AND c.tenant_org_id = cfg.tenant_org_id
  AND c.id IN (
    SELECT customer_id FROM tmp_target_loyalty_txns
    UNION
    SELECT customer_id FROM tmp_target_customers
  );

-- -----------------------------------------------------------------------------
-- Optional orphan / empty master deletes after balance repair
-- -----------------------------------------------------------------------------
DELETE FROM public.org_credit_notes_mst AS m
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_credit_note_rows
  AND cfg.delete_orphan_credit_note_headers
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id IN (SELECT credit_note_id FROM tmp_target_credit_notes)
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_credit_note_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.credit_note_id = m.id
  );

DELETE FROM public.org_gift_cards_mst AS m
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_gift_card_rows
  AND cfg.delete_orphan_gift_card_masters
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id IN (SELECT gift_card_id FROM tmp_target_gift_cards)
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_gift_card_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.gift_card_id = m.id
  );

DELETE FROM public.org_customer_wallets_mst AS m
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_wallet_rows
  AND cfg.delete_empty_wallet_accounts
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id IN (SELECT wallet_id FROM tmp_target_wallets)
  AND coalesce(m.balance, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_wallet_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.wallet_id = m.id
  );

DELETE FROM public.org_customer_advances_mst AS m
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_advance_rows
  AND cfg.delete_empty_advance_accounts
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id IN (SELECT advance_id FROM tmp_target_advances)
  AND coalesce(m.balance, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_advance_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.advance_id = m.id
  );

DELETE FROM public.org_loyalty_accounts_mst AS m
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_loyalty_rows
  AND cfg.delete_empty_loyalty_accounts
  AND m.tenant_org_id = cfg.tenant_org_id
  AND m.id IN (SELECT account_id FROM tmp_target_loyalty_accounts)
  AND coalesce(m.points_balance, 0) = 0
  AND coalesce(m.lifetime_earned, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_loyalty_txn_dtl AS t
    WHERE t.tenant_org_id = m.tenant_org_id
      AND t.account_id = m.id
  );

-- -----------------------------------------------------------------------------
-- Remaining operational deletes
-- -----------------------------------------------------------------------------
DELETE FROM public.org_invoice_mst AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND cfg.include_invoice_rows
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT invoice_id FROM tmp_target_invoices);

DELETE FROM public.org_asm_items_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND (
    x.task_id IN (SELECT task_id FROM tmp_target_asm_tasks)
    OR x.order_item_id IN (SELECT order_item_id FROM tmp_target_order_items)
  );

DELETE FROM public.org_qa_decisions_tr AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_pck_packing_lists_mst AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_asm_tasks_mst AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT task_id FROM tmp_target_asm_tasks);

DELETE FROM public.org_dlv_stops_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_piece_hist_tr AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_ord_transition_events AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_edit_history AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_edit_locks AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_history AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_item_processing_steps AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_item_issues AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_preferences_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_item_pieces_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_discounts_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_charges_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_taxes_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_status_history AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_order_items_dtl AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.order_id IN (SELECT order_id FROM tmp_target_orders);

DELETE FROM public.org_domain_events_outbox AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT outbox_event_id FROM tmp_target_outbox_events);

DELETE FROM public.org_orders_mst AS x
USING cleanup_config AS cfg
WHERE cfg.execute
  AND x.tenant_org_id = cfg.tenant_org_id
  AND x.id IN (SELECT order_id FROM tmp_target_orders);

-- -----------------------------------------------------------------------------
-- Final verification snapshot
-- -----------------------------------------------------------------------------
SELECT
  (SELECT execute FROM cleanup_config LIMIT 1) AS executed,
  (SELECT count(*) FROM tmp_target_orders) AS targeted_orders,
  (SELECT count(*) FROM public.org_orders_mst         WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT order_id FROM tmp_target_orders)) AS remaining_orders,
  (SELECT count(*) FROM public.org_invoice_mst        WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT invoice_id FROM tmp_target_invoices)) AS remaining_invoices,
  (SELECT count(*) FROM public.org_order_payments_dtl WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT order_payment_id FROM tmp_target_order_payments)) AS remaining_order_payments,
  (SELECT count(*) FROM public.org_payments_dtl_tr    WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT payment_id FROM tmp_target_legacy_payments)) AS remaining_legacy_payments,
  (SELECT count(*) FROM public.org_fin_vouchers_mst   WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT voucher_id FROM tmp_target_vouchers)) AS remaining_vouchers,
  (SELECT count(*) FROM public.org_wallet_txn_dtl     WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT id FROM tmp_target_wallet_txns)) AS remaining_wallet_txns,
  (SELECT count(*) FROM public.org_advance_txn_dtl    WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT id FROM tmp_target_advance_txns)) AS remaining_advance_txns,
  (SELECT count(*) FROM public.org_gift_card_txn_dtl  WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT id FROM tmp_target_gift_card_txns)) AS remaining_gift_card_txns,
  (SELECT count(*) FROM public.org_credit_note_txn_dtl WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT id FROM tmp_target_credit_note_txns)) AS remaining_credit_note_txns,
  (SELECT count(*) FROM public.org_loyalty_txn_dtl    WHERE tenant_org_id = (SELECT tenant_org_id FROM cleanup_config LIMIT 1) AND id IN (SELECT id FROM tmp_target_loyalty_txns)) AS remaining_loyalty_txns;

COMMIT;
