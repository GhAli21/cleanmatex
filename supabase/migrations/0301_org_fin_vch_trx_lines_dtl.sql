-- ==================================================================
-- 0301_org_fin_vch_trx_lines_dtl.sql
-- Business Voucher Module (BVM) — Phase 1, Step 2
-- Universal transaction line table for all voucher types.
-- Table name: org_fin_voucher_trx_lines_dtl (30 chars)
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS org_fin_voucher_trx_lines_dtl (
  -- ── Identity ──────────────────────────────────────────────────
  id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id          UUID        NOT NULL,

  -- ── Voucher link ──────────────────────────────────────────────
  voucher_id             UUID        NOT NULL,

  -- ── Line classification ───────────────────────────────────────
  line_no                INTEGER     NOT NULL,
  line_type              TEXT        NOT NULL,
  line_role              TEXT        NOT NULL,
  target_type            TEXT,
  direction              TEXT        NOT NULL,

  -- ── Amounts ───────────────────────────────────────────────────
  amount                 DECIMAL(19,4) NOT NULL,
  currency_code          TEXT,
  currency_ex_rate       DECIMAL(19,6),
  tendered_amount        DECIMAL(19,4),
  change_returned_amount DECIMAL(19,4),
  gateway_fee            DECIMAL(19,4),

  -- ── Status ────────────────────────────────────────────────────
  line_status            TEXT        NOT NULL DEFAULT 'DRAFT',
  payment_status         TEXT,
  wiring_status          TEXT        NOT NULL DEFAULT 'NOT_WIRED',

  -- ── Payment method ────────────────────────────────────────────
  payment_method_code    TEXT,
  bank_reference         TEXT,
  check_number           TEXT,
  check_bank             TEXT,
  check_date             DATE,
  gateway_ref            TEXT,
  gateway_txn_id         TEXT,
  card_last4             TEXT,

  -- ── Linked entities ───────────────────────────────────────────
  order_id               UUID,
  invoice_id             UUID,
  customer_id            UUID,
  supplier_id            UUID,
  employee_id            UUID,
  branch_id              UUID,
  cash_drawer_session_id UUID,
  expense_category_code  TEXT,

  -- ── Reversal chain ────────────────────────────────────────────
  reversed_line_id       UUID,

  -- ── Wiring back-links (populated by wiring service, not posting) ──
  order_payment_id       UUID,
  cash_drawer_mvt_id     UUID,

  -- ── Descriptive ───────────────────────────────────────────────
  description            TEXT,
  notes                  TEXT,
  reference              TEXT,

  -- ── Idempotency ───────────────────────────────────────────────
  idempotency_key        TEXT,

  -- ── Audit fields ──────────────────────────────────────────────
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             TEXT,
  created_info           TEXT,
  updated_at             TIMESTAMPTZ,
  updated_by             TEXT,
  updated_info           TEXT,
  rec_status             SMALLINT    DEFAULT 1,
  rec_order              INTEGER,
  rec_notes              TEXT,
  is_active              BOOLEAN     NOT NULL DEFAULT true,

  -- ── Constraints ───────────────────────────────────────────────
  CONSTRAINT PK_org_fin_vch_trx_lines_dtl
    PRIMARY KEY (id, tenant_org_id),

  CONSTRAINT fk_vch_trx_ln_voucher
    FOREIGN KEY (voucher_id, tenant_org_id)
    REFERENCES org_fin_vouchers_mst(id, tenant_org_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_vch_trx_ln_branch
    FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_vch_trx_ln_reversal
    FOREIGN KEY (reversed_line_id, tenant_org_id)
    REFERENCES org_fin_voucher_trx_lines_dtl(id, tenant_org_id)
    ON DELETE SET NULL,

  CONSTRAINT uq_vch_trx_ln_voucher_line_no
    UNIQUE (tenant_org_id, voucher_id, line_no),

  CONSTRAINT chk_vch_trx_ln_direction
    CHECK (direction IN ('IN','OUT','NEUTRAL')),

  CONSTRAINT chk_vch_trx_ln_type
    CHECK (line_type IN (
      'RECEIPT','PAYMENT','REFUND','EXPENSE','ADVANCE',
      'TRANSFER','ADJUSTMENT','FEE','ROUNDING'
    )),

  CONSTRAINT chk_vch_trx_ln_role
    CHECK (line_role IN (
      'ORDER_PAYMENT','INVOICE_PAYMENT','WALLET_TOPUP','GIFT_CARD_SALE',
      'CUSTOMER_CREDIT_RECEIPT','CUSTOMER_ADVANCE_RECEIPT',
      'SUPPLIER_PAYMENT','EXPENSE_PAYMENT','SHOP_RENT_PAYMENT',
      'UTILITY_PAYMENT','EMPLOYEE_ADVANCE_PAYMENT','PETTY_CASH_ISSUE',
      'CUSTOMER_REFUND','ORDER_REFUND','INVOICE_REFUND',
      'PETTY_CASH_RETURN','WALLET_REFUND','GIFT_CARD_REFUND',
      'INTERNAL_TRANSFER'
    )),

  CONSTRAINT chk_vch_trx_ln_target
    CHECK (target_type IN (
      'ORDER','INVOICE','CUSTOMER','SUPPLIER','EMPLOYEE',
      'WALLET','GIFT_CARD','CREDIT_NOTE','EXPENSE',
      'BANK_ACCOUNT','CASH_DRAWER','PETTY_CASH','OTHER'
    )),

  CONSTRAINT chk_vch_trx_ln_status
    CHECK (line_status IN ('DRAFT','POSTED','CANCELLED','REVERSED')),

  CONSTRAINT chk_vch_trx_ln_pay_status
    CHECK (payment_status IS NULL OR payment_status IN (
      'PENDING','COMPLETED','FAILED','REFUNDED','PARTIALLY_REFUNDED'
    )),

  CONSTRAINT chk_vch_trx_ln_wire_status
    CHECK (wiring_status IN (
      'NOT_WIRED','WIRED','PARTIALLY_WIRED','FAILED','REVERSED'
    )),

  CONSTRAINT chk_vch_trx_ln_amount
    CHECK (amount >= 0),

  CONSTRAINT chk_vch_trx_ln_card_last4
    CHECK (card_last4 IS NULL OR char_length(card_last4) <= 4)
);

-- ── Indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_voucher
  ON org_fin_voucher_trx_lines_dtl (tenant_org_id, voucher_id);

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_role
  ON org_fin_voucher_trx_lines_dtl (tenant_org_id, line_role, line_status);

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_order
  ON org_fin_voucher_trx_lines_dtl (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_customer
  ON org_fin_voucher_trx_lines_dtl (tenant_org_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_created
  ON org_fin_voucher_trx_lines_dtl (tenant_org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_session
  ON org_fin_voucher_trx_lines_dtl (cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vch_trx_line_idempotency
  ON org_fin_voucher_trx_lines_dtl (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────

ALTER TABLE org_fin_voucher_trx_lines_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_fin_vch_trx_lines
  ON org_fin_voucher_trx_lines_dtl;

CREATE POLICY tenant_isolation_org_fin_vch_trx_lines
  ON org_fin_voucher_trx_lines_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── Table/column comments ─────────────────────────────────────────

COMMENT ON TABLE org_fin_voucher_trx_lines_dtl IS
  'BVM universal transaction line table. One row per financial movement within a voucher. Wiring back-links (order_payment_id, cash_drawer_mvt_id) are populated by the wiring service — not the posting service.';

COMMENT ON COLUMN org_fin_voucher_trx_lines_dtl.wiring_status IS
  'Tracks whether this line has been wired to an operational record (order payment, cash movement). Starts NOT_WIRED after posting; wiring service transitions to WIRED.';

COMMIT;
