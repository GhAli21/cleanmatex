-- ============================================================================
-- Migration 0329 — BVM Wiring Phase 2: stored-value ⇄ voucher FK linkage
-- ============================================================================
--
-- Why this migration exists
-- -------------------------
-- Phase 2 of the Business Voucher (BVM) wiring moves stored-value debits
-- (gift-card, wallet, customer-advance, credit-note, loyalty) INTO the same
-- Prisma transaction that creates the voucher header + lines. To make the
-- linkage queryable and tenant-safe at the schema level, every stored-value
-- ledger row produced by submit-order must point back to both:
--   • the voucher header  (org_fin_vouchers_mst.id)
--   • the voucher line    (org_fin_voucher_trx_lines_dtl.id)
--
-- Discovery (Step 0) found:
--   • 4 of 5 tables already have the two link columns (added in earlier
--     migrations) but NO composite FK and NO partial index.
--   • org_loyalty_txn_dtl has neither the columns nor the FK.
--   • Zero rows currently populate the columns, so ADD CONSTRAINT is safe.
--
-- Composite FKs (tenant_org_id + id) — not single-column — because the
-- referenced tables already have composite PKs `(id, tenant_org_id)` for
-- tenant isolation. The composite FK is defense in depth: even if RLS or
-- middleware fail, the database itself rejects cross-tenant linkage.
--
-- ON DELETE SET NULL — preserves the ledger row when an admin voids the
-- voucher; the audit trail of the redemption stays, only the back-link
-- is cleared.
--
-- All names stay ≤ 30 chars (DB naming rule).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. org_loyalty_txn_dtl — add the two link columns
--    (other 4 stored-value tables already have them.)
-- ---------------------------------------------------------------------------
ALTER TABLE org_loyalty_txn_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID NULL,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID NULL;

COMMENT ON COLUMN org_loyalty_txn_dtl.fin_voucher_id IS
  'Phase 2 BVM: voucher header (org_fin_vouchers_mst.id) that produced this loyalty txn. NULL for legacy / non-order rows.';
COMMENT ON COLUMN org_loyalty_txn_dtl.fin_voucher_trx_line_id IS
  'Phase 2 BVM: voucher line (org_fin_voucher_trx_lines_dtl.id) that produced this loyalty txn. NULL for legacy / non-order rows.';

-- ---------------------------------------------------------------------------
-- 2. Composite FK constraints → org_fin_vouchers_mst (header)
-- ---------------------------------------------------------------------------
ALTER TABLE org_gift_card_txn_dtl
  ADD CONSTRAINT fk_gc_txn_fin_voucher
  FOREIGN KEY (tenant_org_id, fin_voucher_id)
  REFERENCES org_fin_vouchers_mst (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_wallet_txn_dtl
  ADD CONSTRAINT fk_wallet_txn_fin_voucher
  FOREIGN KEY (tenant_org_id, fin_voucher_id)
  REFERENCES org_fin_vouchers_mst (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_advance_txn_dtl
  ADD CONSTRAINT fk_adv_txn_fin_voucher
  FOREIGN KEY (tenant_org_id, fin_voucher_id)
  REFERENCES org_fin_vouchers_mst (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_credit_note_txn_dtl
  ADD CONSTRAINT fk_cn_txn_fin_voucher
  FOREIGN KEY (tenant_org_id, fin_voucher_id)
  REFERENCES org_fin_vouchers_mst (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_loyalty_txn_dtl
  ADD CONSTRAINT fk_loyalty_txn_fin_voucher
  FOREIGN KEY (tenant_org_id, fin_voucher_id)
  REFERENCES org_fin_vouchers_mst (tenant_org_id, id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Composite FK constraints → org_fin_voucher_trx_lines_dtl (line)
-- ---------------------------------------------------------------------------
ALTER TABLE org_gift_card_txn_dtl
  ADD CONSTRAINT fk_gc_txn_voucher_line
  FOREIGN KEY (tenant_org_id, fin_voucher_trx_line_id)
  REFERENCES org_fin_voucher_trx_lines_dtl (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_wallet_txn_dtl
  ADD CONSTRAINT fk_wallet_txn_voucher_line
  FOREIGN KEY (tenant_org_id, fin_voucher_trx_line_id)
  REFERENCES org_fin_voucher_trx_lines_dtl (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_advance_txn_dtl
  ADD CONSTRAINT fk_adv_txn_voucher_line
  FOREIGN KEY (tenant_org_id, fin_voucher_trx_line_id)
  REFERENCES org_fin_voucher_trx_lines_dtl (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_credit_note_txn_dtl
  ADD CONSTRAINT fk_cn_txn_voucher_line
  FOREIGN KEY (tenant_org_id, fin_voucher_trx_line_id)
  REFERENCES org_fin_voucher_trx_lines_dtl (tenant_org_id, id)
  ON DELETE SET NULL;

ALTER TABLE org_loyalty_txn_dtl
  ADD CONSTRAINT fk_loyalty_txn_voucher_line
  FOREIGN KEY (tenant_org_id, fin_voucher_trx_line_id)
  REFERENCES org_fin_voucher_trx_lines_dtl (tenant_org_id, id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. Partial indexes — fast voucher → ledger lookup
--
-- Partial (WHERE col IS NOT NULL) because pre-Phase-2 rows have NULL
-- back-links; indexing them would bloat the index without helping any
-- query.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_gc_txn_fin_voucher
  ON org_gift_card_txn_dtl (tenant_org_id, fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gc_txn_voucher_line
  ON org_gift_card_txn_dtl (tenant_org_id, fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_txn_fin_voucher
  ON org_wallet_txn_dtl (tenant_org_id, fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_txn_voucher_line
  ON org_wallet_txn_dtl (tenant_org_id, fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adv_txn_fin_voucher
  ON org_advance_txn_dtl (tenant_org_id, fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adv_txn_voucher_line
  ON org_advance_txn_dtl (tenant_org_id, fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cn_txn_fin_voucher
  ON org_credit_note_txn_dtl (tenant_org_id, fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cn_txn_voucher_line
  ON org_credit_note_txn_dtl (tenant_org_id, fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_txn_fin_voucher
  ON org_loyalty_txn_dtl (tenant_org_id, fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_txn_voucher_line
  ON org_loyalty_txn_dtl (tenant_org_id, fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

COMMIT;
