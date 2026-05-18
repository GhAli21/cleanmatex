-- =============================================================================
-- Migration 0281: org_order_taxes_dtl
-- Per-order tax breakdown lines (VAT, GST, custom).
-- Immutable ledger rows — no soft-delete columns.
-- FK to org_tax_profiles_cf added in migration 0289 after that table is created.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_order_taxes_dtl (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID          NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  order_id         UUID          NOT NULL REFERENCES public.org_orders_mst(id) ON DELETE CASCADE,

  -- FK to org_tax_profiles_cf — added via ALTER in migration 0289
  tax_profile_id   UUID,

  tax_type         TEXT          NOT NULL
    CHECK (tax_type IN ('VAT','GST','CUSTOM')),

  label            TEXT          NOT NULL,
  label2           TEXT,                          -- Arabic label

  rate             DECIMAL(5,2)  NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_compound      BOOLEAN       NOT NULL DEFAULT FALSE,

  taxable_amount   DECIMAL(19,4) NOT NULL,
  tax_amount       DECIMAL(19,4) NOT NULL,

  currency_code    TEXT          NOT NULL,
  exchange_rate    DECIMAL(19,6) NOT NULL DEFAULT 1,  -- rate to tenant base currency

  applied_seq      SMALLINT      NOT NULL DEFAULT 1,

  metadata         JSONB,

  -- Audit
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID,
  updated_info     TEXT,
  rec_status       SMALLINT      NOT NULL DEFAULT 1,
  rec_order        INTEGER,
  rec_notes        TEXT

  -- Note: no is_active — immutable ledger; voiding handled at order level
);

CREATE INDEX IF NOT EXISTS idx_order_taxes_order
  ON public.org_order_taxes_dtl (tenant_org_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_taxes_type
  ON public.org_order_taxes_dtl (tenant_org_id, tax_type);

ALTER TABLE public.org_order_taxes_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_order_taxes_dtl
  ON public.org_order_taxes_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
