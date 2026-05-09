BEGIN;

CREATE TABLE IF NOT EXISTS public.org_ord_discounts_dtl (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  order_id        UUID        NOT NULL,
  applied_seq     SMALLINT    NOT NULL,
  source_type     TEXT        NOT NULL,
  source_id       UUID,
  source_name     TEXT,
  source_name2    TEXT,
  discount_type   TEXT        NOT NULL,
  discount_rate   DECIMAL(5,2),
  discount_amount DECIMAL(19,4) NOT NULL,
  is_voided       BOOLEAN     NOT NULL DEFAULT FALSE,
  voided_at       TIMESTAMPTZ,
  voided_by       TEXT,
  rec_status      SMALLINT    DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT,
  updated_info    TEXT,
  CONSTRAINT pk_org_ord_discounts_dtl PRIMARY KEY (id),
  CONSTRAINT fk_ord_disc_order
    FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES public.org_orders_mst(id, tenant_org_id) ON DELETE CASCADE,
  --CONSTRAINT chk_ord_disc_source_type
    --CHECK (source_type IN ('MANUAL', 'DISCOUNT_RULE', 'PROMO_CODE', 'GIFT_CARD')),
  CONSTRAINT chk_ord_disc_calc_type
    CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  CONSTRAINT chk_ord_disc_amount_pos
    CHECK (discount_amount > 0),
  CONSTRAINT chk_ord_disc_seq_pos
    CHECK (applied_seq > 0)
);

CREATE INDEX IF NOT EXISTS idx_ord_disc_tenant_order
  ON public.org_ord_discounts_dtl (tenant_org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_ord_disc_tenant_source
  ON public.org_ord_discounts_dtl (tenant_org_id, source_type);
-- Filters by source_type within a specific order (e.g. "all rules for order X")
CREATE INDEX IF NOT EXISTS idx_ord_disc_order_source
  ON public.org_ord_discounts_dtl (tenant_org_id, order_id, source_type);

ALTER TABLE public.org_ord_discounts_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_ord_discounts_dtl ON public.org_ord_discounts_dtl;
CREATE POLICY tenant_isolation_org_ord_discounts_dtl
  ON public.org_ord_discounts_dtl FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_ord_discounts_dtl ON public.org_ord_discounts_dtl;
CREATE POLICY service_role_org_ord_discounts_dtl
  ON public.org_ord_discounts_dtl FOR ALL
  USING  (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.org_ord_discounts_dtl IS
  'Audit trail of every discount line applied to an order. '
  'Multiple rows of the same source_type are valid (stacking rules, sequential manual overrides). '
  'Amounts and names denormalized — history survives rule/promo/gift-card deletion.';

COMMIT;
