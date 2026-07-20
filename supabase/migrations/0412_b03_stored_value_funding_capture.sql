-- =============================================================================
-- 0412_b03_stored_value_funding_capture.sql
-- B3 — Stored-Value Funding Capture (Order Fin Remediation Remediation_Work_Packages)
--
-- Problem: gift-card sale, wallet top-up, and customer-advance receipt write
-- ledger rows only (org_gift_card_txn_dtl / org_wallet_txn_dtl /
-- org_advance_txn_dtl via sellGiftCard / topUpWalletTx / issueAdvanceTx) — no
-- tender/payment fact, no BVM voucher, no drawer movement. A customer could be
-- "credited" with stored value that was never actually paid for (C3, §7, §33).
--
-- Locked design v2/v3 (see B03's own "Architecture decision" section for the
-- full research + two documented revisions — v2 dropped a header table since
-- the BVM RECEIPT voucher this migration's tender table hangs off of already
-- serves as the funding aggregate; v3 added tendered_amount/
-- change_returned_amount/payment_status after a review correctly pointed out
-- the schema had no way to record cash change or the canonical resolved
-- payment status per leg):
--   1. org_sv_funding_tenders_dtl — one row per real-money tender leg. A
--      funding event with N tender legs (e.g. part-cash/part-card top-up)
--      gets one RECEIPT voucher (org_fin_vouchers_mst, existing table) with N
--      voucher lines (org_fin_voucher_trx_lines_dtl, existing table, existing
--      WALLET_TOPUP/GIFT_CARD_SALE/CUSTOMER_ADVANCE_RECEIPT line_role/target
--      values already allowed by its CHECK constraints — verified against the
--      live schema, no CHECK change needed here) and N tender rows in this
--      new table, keyed 1:1 to their voucher line. payment_status mirrors
--      org_fin_voucher_trx_lines_dtl's own CHECK set (chk_vch_trx_ln_pay_status)
--      for consistency, even though v1 application logic only ever writes a
--      leg once it resolves into the COMPLETED/CAPTURED/SETTLED set (a
--      non-immediately-settling method is rejected before any row exists —
--      no async completion path ships in this package).
--   2. org_fin_voucher_trx_lines_dtl.sv_funding_tender_id — nullable back-link
--      column, written by stored-value-funding-wiring.handler.ts so the
--      stored-value-cash-drawer-wiring.handler.ts that runs immediately after
--      it (same line, same handler-registry loop) can read the just-created
--      tender-leg id as a FK — the exact pattern order_payment_id already
--      plays for cashDrawerWiringHandler (migration 0303).
--   3. org_cash_drawer_movements_dtl.funding_tender_id — nullable back-link so
--      a cash tender leg's drawer movement is traceable to its tender row,
--      mirroring order_payment_id on the same table.
--   4. sys_cash_drawer_movement_type_cd gains SV_FUNDING_TENDER. Verified
--      against B16/B35's unified expected-cash formula
--      (cash-drawer.service.ts): the movement term only excludes rows where
--      order_payment_id IS NOT NULL (sale-mirror movements already counted via
--      the order-payment-ledger term). A SV_FUNDING_TENDER row always has
--      order_payment_id = NULL and nothing else double-counts it, so it is
--      picked up correctly with NO change needed to B16/B35's drawer-close
--      code.
--   5. Sparse unique index on org_gift_card_txn_dtl(tenant_org_id,
--      idempotency_key) — the one of the three stored-value ledger tables
--      with no such protection today (org_wallet_txn_dtl / org_advance_txn_dtl
--      already have it from an earlier migration).
--
-- Out of scope (see B03 for full reasoning): GL/liability posting (B6's job —
-- this package only emits a plain completion outbox event, same pattern as
-- every other financial write path); GIFT_CARD_RELOAD (no such transaction
-- exists in the codebase today); async gateway-callback funding (no gateway
-- integration exists for these 3 entry points today).
--
-- Authoritative report: C3, §7, §33, §50-B3.
-- Work package: docs/features/Order_Fin/Remediation_Work_Packages/B03_Stored_Value_Funding_Capture.md
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. org_sv_funding_tenders_dtl — tender-leg fact table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.org_sv_funding_tenders_dtl (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id            UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                UUID,
  -- org_fin_vouchers_mst / org_fin_voucher_trx_lines_dtl both have a
  -- COMPOSITE primary key (id, tenant_org_id) with no standalone unique
  -- constraint on id alone — a single-column FK cannot resolve against them
  -- (confirmed via pg_constraint after the first apply attempt failed with
  -- SQLSTATE 42830). Both FKs below are composite (fk_svft_voucher /
  -- fk_svft_vch_line further down); these two columns intentionally carry no
  -- inline REFERENCES clause.
  fin_voucher_id           UUID NOT NULL,
  fin_voucher_trx_line_id  UUID NOT NULL,
  leg_index                SMALLINT NOT NULL DEFAULT 0,

  -- Denormalized from the voucher line at wire time so this table is
  -- self-sufficient for reporting/history without joining back to the line.
  funding_type             TEXT NOT NULL,
  target_type              TEXT NOT NULL,
  target_id                UUID NOT NULL,
  customer_id              UUID,

  payment_method_code      TEXT NOT NULL,
  org_payment_method_id    UUID REFERENCES public.org_payment_methods_cf(id) ON DELETE SET NULL,
  amount                   DECIMAL(19, 4) NOT NULL,
  tendered_amount          DECIMAL(19, 4),
  change_returned_amount   DECIMAL(19, 4),
  currency_code            TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'COMPLETED',
  -- Canonical resolved payment status the leg cleared at (v3). Mirrors
  -- org_fin_voucher_trx_lines_dtl's own allowed set for consistency; v1
  -- application logic only ever writes a COMPLETED/CAPTURED/SETTLED value —
  -- a leg that would resolve elsewhere is rejected before any row exists.
  payment_status            TEXT,

  cash_drawer_session_id   UUID REFERENCES public.org_cash_drawer_sessions_mst(id) ON DELETE SET NULL,
  pos_session_id           UUID REFERENCES public.org_pos_sessions_mst(id) ON DELETE SET NULL,
  gateway_code              TEXT,
  gateway_reference         TEXT,
  check_number              TEXT,
  check_bank                 TEXT,
  check_date                 DATE,

  idempotency_key          TEXT NOT NULL,

  confirmed_at             TIMESTAMPTZ,
  failed_at                TIMESTAMPTZ,
  reversed_at               TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                TEXT,
  created_info               TEXT,
  updated_at                 TIMESTAMPTZ,
  updated_by                  TEXT,
  updated_info                 TEXT,
  rec_status                SMALLINT NOT NULL DEFAULT 1,
  rec_order                 INTEGER,
  rec_notes                  TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_svft_tenant_id
    UNIQUE (tenant_org_id, id),

  CONSTRAINT uq_svft_vch_line
    UNIQUE (fin_voucher_trx_line_id),

  CONSTRAINT uq_svft_leg
    UNIQUE (tenant_org_id, fin_voucher_id, leg_index),

  CONSTRAINT uq_svft_idem
    UNIQUE (tenant_org_id, idempotency_key),

  CONSTRAINT chk_svft_amount
    CHECK (amount > 0),

  CONSTRAINT chk_svft_funding_type
    CHECK (funding_type IN ('GIFT_CARD_SALE', 'WALLET_TOPUP', 'CUSTOMER_ADVANCE_RECEIPT')),

  CONSTRAINT chk_svft_target_type
    CHECK (target_type IN ('GIFT_CARD', 'WALLET', 'CUSTOMER')),

  CONSTRAINT chk_svft_status
    CHECK (status IN ('COMPLETED', 'FAILED', 'REVERSED')),

  CONSTRAINT chk_svft_pay_status
    CHECK (payment_status IS NULL OR payment_status IN (
      'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PROCESSING', 'CAPTURE_PENDING'
    )),

  CONSTRAINT fk_svft_branch
    FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_svft_voucher
    FOREIGN KEY (fin_voucher_id, tenant_org_id)
    REFERENCES public.org_fin_vouchers_mst(id, tenant_org_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_svft_vch_line
    FOREIGN KEY (fin_voucher_trx_line_id, tenant_org_id)
    REFERENCES public.org_fin_voucher_trx_lines_dtl(id, tenant_org_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_svft_voucher
  ON public.org_sv_funding_tenders_dtl (tenant_org_id, fin_voucher_id);

CREATE INDEX IF NOT EXISTS idx_svft_target
  ON public.org_sv_funding_tenders_dtl (tenant_org_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_svft_customer
  ON public.org_sv_funding_tenders_dtl (tenant_org_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_svft_drawer_session
  ON public.org_sv_funding_tenders_dtl (tenant_org_id, cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

ALTER TABLE public.org_sv_funding_tenders_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_svft_tenant ON public.org_sv_funding_tenders_dtl;
CREATE POLICY pol_svft_tenant
  ON public.org_sv_funding_tenders_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 2. org_fin_voucher_trx_lines_dtl — back-link to the tender leg it produced
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD COLUMN IF NOT EXISTS sv_funding_tender_id UUID;

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT fk_vch_trx_ln_svft
  FOREIGN KEY (sv_funding_tender_id)
  REFERENCES public.org_sv_funding_tenders_dtl(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vch_trx_ln_svft
  ON public.org_fin_voucher_trx_lines_dtl (sv_funding_tender_id)
  WHERE sv_funding_tender_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. org_cash_drawer_movements_dtl — back-link + new movement type
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_cash_drawer_movements_dtl
  ADD COLUMN IF NOT EXISTS funding_tender_id UUID;

ALTER TABLE public.org_cash_drawer_movements_dtl
  ADD CONSTRAINT fk_org_cdm_funding_tender
  FOREIGN KEY (funding_tender_id)
  REFERENCES public.org_sv_funding_tenders_dtl(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_cdm_funding_tender
  ON public.org_cash_drawer_movements_dtl (funding_tender_id)
  WHERE funding_tender_id IS NOT NULL;

INSERT INTO public.sys_cash_drawer_movement_type_cd (
  code, name, name2, description, description2,
  default_direction, affects_expected_cash, display_order, is_active, rec_status, created_at
) VALUES (
  'SV_FUNDING_TENDER', 'Stored-Value Funding Tender', 'دفعة تمويل رصيد مخزّن',
  'Real-money tender received for a gift-card sale, wallet top-up, or customer-advance receipt',
  'دفعة نقدية فعلية مقابل بيع بطاقة هدايا أو شحن محفظة أو استلام دفعة مقدمة من العميل',
  'IN', TRUE, 60, TRUE, 1, CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO UPDATE SET
  name                  = EXCLUDED.name,
  name2                 = EXCLUDED.name2,
  description           = EXCLUDED.description,
  description2          = EXCLUDED.description2,
  default_direction     = EXCLUDED.default_direction,
  affects_expected_cash = EXCLUDED.affects_expected_cash,
  is_active             = EXCLUDED.is_active,
  rec_status            = EXCLUDED.rec_status;

-- -----------------------------------------------------------------------------
-- 4. org_gift_card_txn_dtl — sparse idempotency-key uniqueness (defect fix;
--    org_wallet_txn_dtl / org_advance_txn_dtl already have this)
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_gc_txn_idem
  ON public.org_gift_card_txn_dtl (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Verify
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  ASSERT (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_sv_funding_tenders_dtl'
  ) = 1, 'org_sv_funding_tenders_dtl was not created';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_fin_voucher_trx_lines_dtl'
      AND column_name = 'sv_funding_tender_id'
  ), 'org_fin_voucher_trx_lines_dtl.sv_funding_tender_id was not added';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_cash_drawer_movements_dtl'
      AND column_name = 'funding_tender_id'
  ), 'org_cash_drawer_movements_dtl.funding_tender_id was not added';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_cash_drawer_movement_type_cd WHERE code = 'SV_FUNDING_TENDER'
  ), 'SV_FUNDING_TENDER movement type was not seeded';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'org_gift_card_txn_dtl' AND indexname = 'uq_gc_txn_idem'
  ), 'uq_gc_txn_idem index was not created';
END;
$$;

COMMIT;
