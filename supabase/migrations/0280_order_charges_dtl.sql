-- =============================================================================
-- Migration 0280: org_order_charges_dtl
-- Per-order charge lines (preference, express, bulk surcharge, special handling).
-- Immutable ledger rows — use is_voided flag instead of soft-delete columns.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_order_charges_dtl (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID        NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  order_id         UUID        NOT NULL REFERENCES public.org_orders_mst(id) ON DELETE CASCADE,

  charge_type      TEXT        NOT NULL
    CHECK (charge_type IN ('PREFERENCE','EXPRESS','BULK_SURCHARGE','SPECIAL_HANDLING')),

  charge_source_id UUID,                          -- preference ID or rule ID that triggered this charge
  label            TEXT        NOT NULL,
  label2           TEXT,                          -- Arabic label

  amount           DECIMAL(19,4) NOT NULL CHECK (amount >= 0),
  currency_code    TEXT        NOT NULL,
  exchange_rate    DECIMAL(19,6) NOT NULL DEFAULT 1,  -- rate to tenant base currency

  applied_seq      SMALLINT    NOT NULL DEFAULT 1,

  is_voided        BOOLEAN     NOT NULL DEFAULT FALSE,
  voided_at        TIMESTAMPTZ,
  voided_by        UUID,
  void_reason      TEXT,

  metadata         JSONB,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID,
  updated_info     TEXT,
  rec_status       SMALLINT    NOT NULL DEFAULT 1,
  rec_order        INTEGER,
  rec_notes        TEXT

  -- Note: no is_active — immutable ledger rows use is_voided instead
);

CREATE INDEX IF NOT EXISTS idx_order_charges_order
  ON public.org_order_charges_dtl (tenant_org_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_charges_type
  ON public.org_order_charges_dtl (tenant_org_id, charge_type);

ALTER TABLE public.org_order_charges_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_order_charges_dtl
  ON public.org_order_charges_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
