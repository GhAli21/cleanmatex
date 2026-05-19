-- ==================================================================
-- 0300_extend_fin_vouchers_mst.sql
-- Business Voucher Module (BVM) — Phase 1, Step 1
-- Additive extension of org_fin_vouchers_mst with BVM columns.
-- No DROP, no CASCADE, no structural changes — additive only.
-- biz_voucher_type is transitional; renamed to voucher_type in 0306.
-- ==================================================================

BEGIN;

-- ── New BVM columns ──────────────────────────────────────────────

ALTER TABLE org_fin_vouchers_mst
  -- transitional: rename to voucher_type once old column deprecated (migration 0306)
  ADD COLUMN IF NOT EXISTS biz_voucher_type   TEXT,
  ADD COLUMN IF NOT EXISTS voucher_status     TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS posting_status     TEXT NOT NULL DEFAULT 'NOT_POSTED',
  ADD COLUMN IF NOT EXISTS voucher_date       DATE,
  ADD COLUMN IF NOT EXISTS voucher_datetime   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS direction          TEXT,
  ADD COLUMN IF NOT EXISTS party_type         TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id        UUID,
  ADD COLUMN IF NOT EXISTS employee_id        UUID,
  ADD COLUMN IF NOT EXISTS party_name         TEXT,
  ADD COLUMN IF NOT EXISTS currency_ex_rate   DECIMAL(19,6),
  ADD COLUMN IF NOT EXISTS subtotal_amount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS discount_amount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS tax_amount         DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS fee_amount         DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS paid_amount        DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS refunded_amount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS outstanding_amount DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS source_module      TEXT,
  ADD COLUMN IF NOT EXISTS source_ref_type    TEXT,
  ADD COLUMN IF NOT EXISTS source_ref_id      UUID,
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS notes              TEXT,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by        TEXT,
  ADD COLUMN IF NOT EXISTS posted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_by          TEXT,
  ADD COLUMN IF NOT EXISTS reversed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by        TEXT,
  ADD COLUMN IF NOT EXISTS reversal_reason    TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key    TEXT;

-- ── CHECK constraints ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_fin_biz_voucher_type'
  ) THEN
    ALTER TABLE org_fin_vouchers_mst
      ADD CONSTRAINT chk_fin_biz_voucher_type
        CHECK (biz_voucher_type IN (
          'RECEIPT_VOUCHER','PAYMENT_VOUCHER','REFUND_VOUCHER',
          'ADJUSTMENT_VOUCHER','TRANSFER_VOUCHER'
        ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_fin_voucher_status'
  ) THEN
    ALTER TABLE org_fin_vouchers_mst
      ADD CONSTRAINT chk_fin_voucher_status
        CHECK (voucher_status IN (
          'DRAFT','POSTED','CANCELLED','REVERSED','PARTIALLY_REVERSED'
        ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_fin_posting_status'
  ) THEN
    ALTER TABLE org_fin_vouchers_mst
      ADD CONSTRAINT chk_fin_posting_status
        CHECK (posting_status IN ('NOT_POSTED','POSTED','POSTING_FAILED'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_fin_direction'
  ) THEN
    ALTER TABLE org_fin_vouchers_mst
      ADD CONSTRAINT chk_fin_direction
        CHECK (direction IN ('IN','OUT','NEUTRAL'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_fin_party_type'
  ) THEN
    ALTER TABLE org_fin_vouchers_mst
      ADD CONSTRAINT chk_fin_party_type
        CHECK (party_type IN ('CUSTOMER','SUPPLIER','EMPLOYEE','OTHER'));
  END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_vouchers_idempotency
  ON org_fin_vouchers_mst (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_vouchers_biz_type
  ON org_fin_vouchers_mst (tenant_org_id, biz_voucher_type, voucher_status);

CREATE INDEX IF NOT EXISTS idx_fin_vouchers_direction
  ON org_fin_vouchers_mst (tenant_org_id, direction)
  WHERE direction IS NOT NULL;

-- ── Column comments ───────────────────────────────────────────────

COMMENT ON COLUMN org_fin_vouchers_mst.biz_voucher_type IS 'Transitional bridge — renamed to voucher_type in migration 0306. Values: RECEIPT_VOUCHER, PAYMENT_VOUCHER, REFUND_VOUCHER, ADJUSTMENT_VOUCHER, TRANSFER_VOUCHER';
COMMENT ON COLUMN org_fin_vouchers_mst.voucher_status   IS 'Business lifecycle axis (set by BVM only): DRAFT → POSTED → REVERSED/PARTIALLY_REVERSED/CANCELLED';
COMMENT ON COLUMN org_fin_vouchers_mst.posting_status   IS 'Accounting/GL axis (set by future GL posting service only — BVM never writes this): NOT_POSTED → POSTED → POSTING_FAILED';
COMMENT ON COLUMN org_fin_vouchers_mst.paid_amount      IS 'BVM: total amount paid across all payment lines on this voucher';

COMMIT;
