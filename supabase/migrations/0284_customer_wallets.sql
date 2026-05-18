-- =============================================================================
-- Migration 0284: Customer Wallets
-- org_customer_wallets_mst — one wallet per customer per tenant
-- org_wallet_txn_dtl — append-only wallet ledger
-- Balance mutations use SELECT FOR UPDATE on the master row.
-- =============================================================================

BEGIN;

-- ── Master wallet record (one per customer per tenant) ───────────────────────
CREATE TABLE IF NOT EXISTS public.org_customer_wallets_mst (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID          NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  customer_id      UUID          NOT NULL REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT,

  balance          DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code    TEXT          NOT NULL,

  last_activity_at TIMESTAMPTZ,

  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  rec_status       SMALLINT      NOT NULL DEFAULT 1,
  rec_order        INTEGER,
  rec_notes        TEXT,

  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       TEXT,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       TEXT,
  updated_info     TEXT,

  metadata         JSONB,

  CONSTRAINT uq_wallet_per_customer UNIQUE (tenant_org_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_customer
  ON public.org_customer_wallets_mst (tenant_org_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_wallets_tenant_active
  ON public.org_customer_wallets_mst (tenant_org_id, is_active);

ALTER TABLE public.org_customer_wallets_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_customer_wallets_mst
  ON public.org_customer_wallets_mst
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── Wallet ledger (append-only — no updated_at) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_wallet_txn_dtl (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID          NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  wallet_id       UUID          NOT NULL REFERENCES public.org_customer_wallets_mst(id) ON DELETE RESTRICT,
  customer_id     UUID          NOT NULL,

  txn_type        TEXT          NOT NULL
    CHECK (txn_type IN ('TOP_UP','REDEMPTION','REFUND','EXPIRY','CORRECTION')),

  amount          DECIMAL(19,4) NOT NULL,
  currency_code   TEXT          NOT NULL,
  exchange_rate   DECIMAL(19,6) NOT NULL DEFAULT 1,

  balance_before  DECIMAL(19,4) NOT NULL,
  balance_after   DECIMAL(19,4) NOT NULL,

  order_id        UUID,
  credit_app_id   UUID,

  idempotency_key TEXT,
  reference_no    TEXT,
  notes           TEXT,
  performed_by    UUID,

  rec_status       SMALLINT      NOT NULL DEFAULT 1,
  rec_order        INTEGER,
  rec_notes        TEXT,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  created_info    TEXT,

  CONSTRAINT uq_wallet_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet
  ON public.org_wallet_txn_dtl (tenant_org_id, wallet_id);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_order
  ON public.org_wallet_txn_dtl (tenant_org_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_txn_customer
  ON public.org_wallet_txn_dtl (tenant_org_id, customer_id);

ALTER TABLE public.org_wallet_txn_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_wallet_txn_dtl
  ON public.org_wallet_txn_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
