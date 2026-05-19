-- ==================================================================
-- 0303_operational_vch_links.sql
-- Business Voucher Module (BVM) — Phase 1, Step 4
-- Add fin_voucher_id + fin_voucher_trx_line_id back-link columns
-- to all operational transaction tables.
--
-- These columns are nullable — legacy rows have no voucher link.
-- They are populated by the BVM wiring service (NOT the posting
-- service). The posting service only sets voucher_status on the
-- voucher header; wiring is a separate explicit phase.
--
-- Sparse UNIQUE indexes on fin_voucher_trx_line_id prevent a single
-- voucher line from being wired to more than one operational record.
-- ==================================================================

BEGIN;

-- ==================================================================
-- 1. org_order_payments_dtl
-- ==================================================================

ALTER TABLE org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ord_pay_vch_line
  ON org_order_payments_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ord_pay_fin_voucher
  ON org_order_payments_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

-- ==================================================================
-- 2. org_cash_drawer_movements_dtl
-- ==================================================================

ALTER TABLE org_cash_drawer_movements_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cd_mov_vch_line
  ON org_cash_drawer_movements_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cd_mov_fin_voucher
  ON org_cash_drawer_movements_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

-- ==================================================================
-- 3. org_wallet_txn_dtl
-- ==================================================================

ALTER TABLE org_wallet_txn_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_txn_vch_line
  ON org_wallet_txn_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_txn_fin_voucher
  ON org_wallet_txn_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

-- ==================================================================
-- 4. org_advance_txn_dtl
-- ==================================================================

ALTER TABLE org_advance_txn_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_advance_txn_vch_line
  ON org_advance_txn_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_advance_txn_fin_voucher
  ON org_advance_txn_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

-- ==================================================================
-- 5. org_gift_card_txn_dtl
-- ==================================================================

ALTER TABLE org_gift_card_txn_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_gc_txn_vch_line
  ON org_gift_card_txn_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gc_txn_fin_voucher
  ON org_gift_card_txn_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

-- ==================================================================
-- 6. org_credit_note_txn_dtl
-- ==================================================================

ALTER TABLE org_credit_note_txn_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cn_txn_vch_line
  ON org_credit_note_txn_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cn_txn_fin_voucher
  ON org_credit_note_txn_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

COMMIT;
