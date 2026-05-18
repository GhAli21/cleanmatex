-- =============================================================================
-- Migration 0286: Credit Notes
-- org_credit_notes_mst — formal document-based credit instrument (V1 only)
-- org_credit_note_txn_dtl — append-only credit note ledger
-- Credit Note = document tied to a specific issuance event (refund, goodwill, etc.)
-- Distinct from Wallet (generic reloadable balance).
-- Balance mutations use SELECT FOR UPDATE on the master row.
-- =============================================================================

BEGIN;

-- ── Credit note master (one doc per issuance) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_credit_notes_mst (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID          NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  customer_id       UUID          NOT NULL REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT,

  credit_note_no    TEXT          NOT NULL,
  original_amount   DECIMAL(19,4) NOT NULL CHECK (original_amount > 0),
  remaining_balance DECIMAL(19,4) NOT NULL CHECK (remaining_balance >= 0),
  currency_code     TEXT          NOT NULL,

  reason            TEXT          NOT NULL,
  related_order_id  UUID,

  expires_at        DATE,

  status            TEXT          NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','EXHAUSTED','EXPIRED','CANCELLED')),

  issued_by         UUID,
  issued_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  cancelled_by      UUID,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,

  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  rec_status        SMALLINT      NOT NULL DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT,
  updated_info      TEXT,

  metadata          JSONB,

  CONSTRAINT uq_credit_note_no UNIQUE (tenant_org_id, credit_note_no)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer
  ON public.org_credit_notes_mst (tenant_org_id, customer_id, status);

CREATE INDEX IF NOT EXISTS idx_credit_notes_no
  ON public.org_credit_notes_mst (tenant_org_id, credit_note_no);

CREATE INDEX IF NOT EXISTS idx_credit_notes_order
  ON public.org_credit_notes_mst (tenant_org_id, related_order_id)
  WHERE related_order_id IS NOT NULL;

ALTER TABLE public.org_credit_notes_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_credit_notes_mst
  ON public.org_credit_notes_mst
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── Credit note ledger (append-only — no updated_at) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.org_credit_note_txn_dtl (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID          NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  credit_note_id  UUID          NOT NULL REFERENCES public.org_credit_notes_mst(id) ON DELETE RESTRICT,
  customer_id     UUID          NOT NULL,

  txn_type        TEXT          NOT NULL
    CHECK (txn_type IN ('ISSUE','REDEMPTION','REFUND','EXPIRY','CORRECTION')),

  amount          DECIMAL(19,4) NOT NULL,
  currency_code   TEXT          NOT NULL,
  exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,

  balance_before  DECIMAL(19,4) NOT NULL,
  balance_after   DECIMAL(19,4) NOT NULL,

  order_id        UUID,
  credit_app_id   UUID,

  idempotency_key TEXT,
  notes           TEXT,
  performed_by    UUID,

  rec_status       SMALLINT      NOT NULL DEFAULT 1,
  rec_order        INTEGER,
  rec_notes        TEXT,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  created_info    TEXT,

  CONSTRAINT uq_cn_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_cn_txn_note
  ON public.org_credit_note_txn_dtl (tenant_org_id, credit_note_id);

CREATE INDEX IF NOT EXISTS idx_cn_txn_order
  ON public.org_credit_note_txn_dtl (tenant_org_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cn_txn_customer
  ON public.org_credit_note_txn_dtl (tenant_org_id, customer_id);

ALTER TABLE public.org_credit_note_txn_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_credit_note_txn_dtl
  ON public.org_credit_note_txn_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
