-- ============================================================================
-- 0314_ar_invoice_schema.sql
-- Purpose:
--   Upgrade org_invoice_mst for AR Invoice v1 and add AR support tables.
-- Notes:
--   - org_invoice_mst remains the canonical AR invoice header
--   - Business Voucher remains the money-movement source
--   - all org_* tables are tenant-scoped with RLS
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Upgrade org_invoice_mst header fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_invoice_mst
  ALTER COLUMN subtotal TYPE numeric(19,4),
  ALTER COLUMN discount TYPE numeric(19,4),
  ALTER COLUMN tax TYPE numeric(19,4),
  ALTER COLUMN total TYPE numeric(19,4),
  ALTER COLUMN paid_amount TYPE numeric(19,4)
  --ALTER COLUMN outstanding_amount TYPE numeric(19,4) 	
  ;

ALTER TABLE public.org_invoice_mst
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_action_cd varchar(40),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by varchar(120),
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS due_date_source_cd varchar(30),
  ADD COLUMN IF NOT EXISTS due_terms_days integer,
  ADD COLUMN IF NOT EXISTS numbering_doc_type_cd varchar(40) NOT NULL DEFAULT 'AR_INV',
  ADD COLUMN IF NOT EXISTS numbering_seq_no bigint,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_by varchar(120),
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by varchar(120),
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS outstanding_amount numeric(19,4)
  ;

UPDATE public.org_invoice_mst
SET outstanding_amount = GREATEST(
  coalesce(total, 0)::numeric(19,4) - coalesce(paid_amount, 0)::numeric(19,4),
  0
)
WHERE outstanding_amount IS NULL
   OR outstanding_amount <> GREATEST(
     coalesce(total, 0)::numeric(19,4) - coalesce(paid_amount, 0)::numeric(19,4),
     0
   );

-- Final normalization pass before hard constraints.
-- This intentionally repeats the critical cleanup logic from 0313 because
-- legacy databases may still contain ad-hoc values such as "processing" or
-- blank currencies that would otherwise block constraint creation here.
UPDATE public.org_invoice_mst
SET invoice_type_cd = CASE
  WHEN statement_id IS NOT NULL THEN 'B2B_STATEMENT'
  WHEN b2b_contract_id IS NOT NULL THEN 'B2B_ORDER'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'B2B' THEN 'B2B_ORDER'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'B2B_ORDER' THEN 'B2B_ORDER'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'B2B_STATEMENT' THEN 'B2B_STATEMENT'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'ORDER_CREDIT' THEN 'ORDER_CREDIT'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'MANUAL_AR' THEN 'MANUAL_AR'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'CREDIT_MEMO' THEN 'CREDIT_MEMO'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'DEBIT_NOTE' THEN 'DEBIT_NOTE'
  WHEN upper(btrim(coalesce(invoice_type_cd, ''))) = 'PROFORMA' THEN 'PROFORMA'
  WHEN order_id IS NOT NULL THEN 'ORDER_CREDIT'
  ELSE 'MANUAL_AR'
END
WHERE invoice_type_cd IS NULL
   OR btrim(invoice_type_cd) = ''
   OR upper(btrim(invoice_type_cd)) NOT IN (
     'ORDER_CREDIT', 'B2B_ORDER', 'B2B_STATEMENT',
     'MANUAL_AR', 'CREDIT_MEMO', 'DEBIT_NOTE', 'PROFORMA'
   );

UPDATE public.org_invoice_mst
SET status = CASE
  WHEN upper(btrim(coalesce(status, ''))) = 'DRAFT' THEN 'DRAFT'
  WHEN upper(btrim(coalesce(status, ''))) IN ('VOID', 'VOIDED') THEN 'VOID'
  WHEN upper(btrim(coalesce(status, ''))) IN ('CANCELLED', 'CANCELED') THEN 'CANCELLED'
  WHEN upper(btrim(coalesce(status, ''))) = 'REFUNDED' THEN 'REFUNDED'
  WHEN upper(btrim(coalesce(status, ''))) IN ('PARTIALLY_REFUNDED', 'PARTIAL_REFUNDED') THEN 'PARTIALLY_REFUNDED'
  WHEN upper(btrim(coalesce(status, ''))) = 'WRITTEN_OFF' THEN 'WRITTEN_OFF'
  WHEN upper(btrim(coalesce(status, ''))) = 'DISPUTED' THEN 'DISPUTED'
  WHEN coalesce(paid_amount, 0) >= coalesce(total, 0) AND coalesce(total, 0) > 0 THEN 'PAID'
  WHEN coalesce(paid_amount, 0) > 0 THEN 'PARTIALLY_PAID'
  WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'OVERDUE'
  ELSE 'OPEN'
END
WHERE status IS NULL
   OR btrim(status) = ''
   OR upper(btrim(status)) NOT IN (
     'DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE',
     'CANCELLED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED',
     'WRITTEN_OFF', 'DISPUTED'
   );

UPDATE org_invoice_mst AS inv
SET currency_code = t.currency
, currency_ex_rate=1
FROM org_tenants_mst AS t
WHERE inv.tenant_org_id = t.id
  AND (inv.currency_code IS NULL OR btrim(inv.currency_code) = '')
;

-- Require fully cleaned currency values before hardening the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.org_invoice_mst
    WHERE currency_code IS NULL OR btrim(currency_code) = ''
  ) THEN
    RAISE EXCEPTION
      'AR Invoice migration requires currency_code cleanup in org_invoice_mst before NOT NULL can be applied.';
  END IF;
END $$;

ALTER TABLE public.org_invoice_mst
  ALTER COLUMN currency_code SET NOT NULL;

ALTER TABLE public.org_invoice_mst
  DROP CONSTRAINT IF EXISTS ck_oim_stat,
  DROP CONSTRAINT IF EXISTS ck_oim_type,
  DROP CONSTRAINT IF EXISTS ck_oim_amt;

ALTER TABLE public.org_invoice_mst
  ADD CONSTRAINT ck_oim_stat CHECK (
    status IN (
      'DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE',
      'CANCELLED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED',
      'WRITTEN_OFF', 'DISPUTED'
    )
  ),
  ADD CONSTRAINT ck_oim_type CHECK (
    invoice_type_cd IN (
      'ORDER_CREDIT', 'B2B_ORDER', 'B2B_STATEMENT',
      'MANUAL_AR', 'CREDIT_MEMO', 'DEBIT_NOTE', 'PROFORMA'
    )
  ),
  ADD CONSTRAINT ck_oim_amt CHECK (
    coalesce(subtotal, 0) >= 0
    AND coalesce(discount, 0) >= 0
    AND coalesce(tax, 0) >= 0
    AND coalesce(total, 0) >= 0
    AND coalesce(paid_amount, 0) >= 0
    AND coalesce(outstanding_amount, 0) >= 0
    AND coalesce(vat_amount, 0) >= 0
    AND coalesce(service_charge, 0) >= 0
    AND coalesce(promo_discount_amount, 0) >= 0
  );

CREATE INDEX IF NOT EXISTS idx_oim_t_stat ON public.org_invoice_mst(tenant_org_id, status);
CREATE INDEX IF NOT EXISTS idx_oim_t_type ON public.org_invoice_mst(tenant_org_id, invoice_type_cd);
CREATE INDEX IF NOT EXISTS idx_oim_t_due ON public.org_invoice_mst(tenant_org_id, due_date);

-- Seed AR invoice document sequences for existing tenants.
INSERT INTO public.org_fin_doc_seq_mst (
  tenant_org_id, doc_type_code, prefix, last_no, padding_len,
  created_at, created_by, created_info, rec_status, is_active
)
SELECT
  t.id, 'AR_INV', 'ARI-', 0, 6,
  CURRENT_TIMESTAMP, 'system_admin', 'AR Invoice v1 seed', 1, true
FROM public.org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.org_fin_doc_seq_mst s
  WHERE s.tenant_org_id = t.id
    AND s.doc_type_code = 'AR_INV'
)
ON CONFLICT (tenant_org_id, doc_type_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Supporting detail tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.org_invoice_lines_dtl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  line_no integer NOT NULL,
  line_type varchar(30) NOT NULL DEFAULT 'SERVICE',
  source_type varchar(30),
  source_order_id uuid,
  source_order_item_id uuid,
  description text NOT NULL,
  description2 text,
  quantity numeric(19,4) NOT NULL DEFAULT 1,
  unit_price numeric(19,4) NOT NULL DEFAULT 0,
  subtotal_amount numeric(19,4) NOT NULL DEFAULT 0,
  discount_amount numeric(19,4) NOT NULL DEFAULT 0,
  taxable_amount numeric(19,4) NOT NULL DEFAULT 0,
  tax_rate numeric(9,4),
  tax_amount numeric(19,4) NOT NULL DEFAULT 0,
  total_amount numeric(19,4) NOT NULL DEFAULT 0,
  currency_code varchar(3) NOT NULL,
  currency_ex_rate numeric(18,6) NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(120),
  created_info text,
  updated_at timestamptz,
  updated_by varchar(120),
  updated_info text,
  rec_status smallint NOT NULL DEFAULT 1,
  rec_order integer,
  rec_notes varchar(200),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_oil PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_oil_no UNIQUE (tenant_org_id, invoice_id, line_no),
  CONSTRAINT fk_oil_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT fk_oil_ord FOREIGN KEY (source_order_id, tenant_org_id)
    REFERENCES public.org_orders_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT ck_oil_type CHECK (
    line_type IN (
      'SERVICE', 'ITEM', 'ORDER_SUMMARY', 'CHARGE', 'DISCOUNT', 'TAX',
      'DELIVERY', 'EXPRESS', 'ROUNDING', 'MANUAL', 'CREDIT_MEMO', 'DEBIT_NOTE'
    )
  ),
  CONSTRAINT ck_oil_amt CHECK (
    quantity >= 0 AND unit_price >= 0 AND subtotal_amount >= 0
    AND discount_amount >= 0 AND taxable_amount >= 0
    AND tax_amount >= 0 AND total_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_oil_inv ON public.org_invoice_lines_dtl(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_oil_ord ON public.org_invoice_lines_dtl(tenant_org_id, source_order_id);

ALTER TABLE public.org_invoice_lines_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_oil_tenant ON public.org_invoice_lines_dtl;
CREATE POLICY pol_oil_tenant ON public.org_invoice_lines_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_invoice_orders_dtl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_total_amount numeric(19,4) NOT NULL DEFAULT 0,
  invoiced_amount numeric(19,4) NOT NULL DEFAULT 0,
  paid_before_amount numeric(19,4) NOT NULL DEFAULT 0,
  credit_before_amount numeric(19,4) NOT NULL DEFAULT 0,
  outstanding_amount numeric(19,4) NOT NULL DEFAULT 0,
  allocation_policy varchar(30) NOT NULL DEFAULT 'REMAINING_ONLY',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(120),
  created_info text,
  updated_at timestamptz,
  updated_by varchar(120),
  updated_info text,
  rec_status smallint NOT NULL DEFAULT 1,
  rec_order integer,
  rec_notes varchar(200),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_oio PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_oio_ref UNIQUE (tenant_org_id, invoice_id, order_id),
  CONSTRAINT fk_oio_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT fk_oio_ord FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES public.org_orders_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT ck_oio_amt CHECK (
    order_total_amount >= 0 AND invoiced_amount >= 0
    AND paid_before_amount >= 0 AND credit_before_amount >= 0
    AND outstanding_amount >= 0
  ),
  CONSTRAINT ck_oio_pol CHECK (
    allocation_policy IN ('FULL_ORDER', 'REMAINING_ONLY', 'CUSTOM_AMOUNT')
  )
);

CREATE INDEX IF NOT EXISTS idx_oio_inv ON public.org_invoice_orders_dtl(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_oio_ord ON public.org_invoice_orders_dtl(tenant_org_id, order_id);

ALTER TABLE public.org_invoice_orders_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_oio_tenant ON public.org_invoice_orders_dtl;
CREATE POLICY pol_oio_tenant ON public.org_invoice_orders_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_invoice_payments_dtl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  payment_id uuid,
  voucher_id uuid,
  allocation_no integer NOT NULL DEFAULT 1,
  allocation_outcome varchar(30) NOT NULL DEFAULT 'APPLIED',
  allocated_amount numeric(19,4) NOT NULL DEFAULT 0,
  unapplied_credit_amount numeric(19,4) NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by varchar(120),
  reversal_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(120),
  created_info text,
  updated_at timestamptz,
  updated_by varchar(120),
  updated_info text,
  rec_status smallint NOT NULL DEFAULT 1,
  rec_order integer,
  rec_notes varchar(200),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_oip PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_oip_no UNIQUE (tenant_org_id, invoice_id, allocation_no),
  CONSTRAINT fk_oip_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT fk_oip_pay FOREIGN KEY (payment_id)
    REFERENCES public.org_payments_dtl_tr(id) ON DELETE SET NULL,
  CONSTRAINT fk_oip_vch FOREIGN KEY (voucher_id, tenant_org_id)
    REFERENCES public.org_fin_vouchers_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT ck_oip_amt CHECK (
    allocated_amount >= 0 AND unapplied_credit_amount >= 0
  ),
  CONSTRAINT ck_oip_out CHECK (
    allocation_outcome IN ('APPLIED', 'PARTIAL', 'UNAPPLIED_CREDIT', 'REVERSED')
  )
);

CREATE INDEX IF NOT EXISTS idx_oip_inv ON public.org_invoice_payments_dtl(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_oip_pay ON public.org_invoice_payments_dtl(tenant_org_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_oip_vch ON public.org_invoice_payments_dtl(tenant_org_id, voucher_id);

ALTER TABLE public.org_invoice_payments_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_oip_tenant ON public.org_invoice_payments_dtl;
CREATE POLICY pol_oip_tenant ON public.org_invoice_payments_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_invoice_adjustments_dtl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  adjustment_no integer NOT NULL DEFAULT 1,
  adjustment_type_cd varchar(30) NOT NULL,
  adjustment_amount numeric(19,4) NOT NULL DEFAULT 0,
  status_cd varchar(20) NOT NULL DEFAULT 'POSTED',
  approval_action_cd varchar(40),
  approved_at timestamptz,
  approved_by varchar(120),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(120),
  created_info text,
  updated_at timestamptz,
  updated_by varchar(120),
  updated_info text,
  rec_status smallint NOT NULL DEFAULT 1,
  rec_order integer,
  rec_notes varchar(200),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_oia PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_oia_no UNIQUE (tenant_org_id, invoice_id, adjustment_no),
  CONSTRAINT fk_oia_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT ck_oia_amt CHECK (adjustment_amount >= 0),
  CONSTRAINT ck_oia_typ CHECK (
    adjustment_type_cd IN (
      'WRITE_OFF', 'ROUNDING', 'PENALTY', 'FINANCE_CHARGE',
      'MANUAL_CORRECTION', 'CREDIT_ADJUSTMENT', 'DEBIT_ADJUSTMENT'
    )
  ),
  CONSTRAINT ck_oia_st CHECK (status_cd IN ('PENDING_APPROVAL', 'POSTED', 'VOID'))
);

CREATE INDEX IF NOT EXISTS idx_oia_inv ON public.org_invoice_adjustments_dtl(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_oia_typ ON public.org_invoice_adjustments_dtl(tenant_org_id, adjustment_type_cd);

ALTER TABLE public.org_invoice_adjustments_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_oia_tenant ON public.org_invoice_adjustments_dtl;
CREATE POLICY pol_oia_tenant ON public.org_invoice_adjustments_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_invoice_status_history_dtl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  from_status varchar(30),
  to_status varchar(30) NOT NULL,
  action_cd varchar(40),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(120),
  created_info text,
  updated_at timestamptz,
  updated_by varchar(120),
  updated_info text,
  rec_status smallint NOT NULL DEFAULT 1,
  rec_order integer,
  rec_notes varchar(200),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_oish PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT fk_oish_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT ck_oish_to CHECK (
    to_status IN (
      'DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE',
      'CANCELLED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED',
      'WRITTEN_OFF', 'DISPUTED'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_oish_inv ON public.org_invoice_status_history_dtl(tenant_org_id, invoice_id, created_at DESC);

ALTER TABLE public.org_invoice_status_history_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_oish_tenant ON public.org_invoice_status_history_dtl;
CREATE POLICY pol_oish_tenant ON public.org_invoice_status_history_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS public.org_customer_ar_ledger_dtl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  invoice_id uuid,
  payment_alloc_id uuid,
  adjustment_id uuid,
  voucher_id uuid,
  entry_no integer NOT NULL DEFAULT 1,
  movement_cd varchar(30) NOT NULL,
  entry_side varchar(10) NOT NULL,
  amount numeric(19,4) NOT NULL DEFAULT 0,
  running_balance numeric(19,4) NOT NULL DEFAULT 0,
  currency_code varchar(3) NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  ref_doc_no varchar(100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(120),
  created_info text,
  updated_at timestamptz,
  updated_by varchar(120),
  updated_info text,
  rec_status smallint NOT NULL DEFAULT 1,
  rec_order integer,
  rec_notes varchar(200),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_ocal PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_ocal_no UNIQUE (tenant_org_id, customer_id, entry_no),
  CONSTRAINT fk_ocal_cus FOREIGN KEY (customer_id)
    REFERENCES public.org_customers_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocal_inv FOREIGN KEY (invoice_id, tenant_org_id)
    REFERENCES public.org_invoice_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_ocal_pay FOREIGN KEY (payment_alloc_id, tenant_org_id)
    REFERENCES public.org_invoice_payments_dtl(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_ocal_adj FOREIGN KEY (adjustment_id, tenant_org_id)
    REFERENCES public.org_invoice_adjustments_dtl(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_ocal_vch FOREIGN KEY (voucher_id, tenant_org_id)
    REFERENCES public.org_fin_vouchers_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT ck_ocal_amt CHECK (amount >= 0),
  CONSTRAINT ck_ocal_mov CHECK (
    movement_cd IN (
      'INVOICE_ISSUED', 'PAYMENT_APPLIED', 'OVERPAY_CREDIT',
      'CREDIT_MEMO', 'DEBIT_NOTE', 'WRITE_OFF', 'PAYMENT_REVERSED',
      'ADJUSTMENT', 'VOID'
    )
  ),
  CONSTRAINT ck_ocal_side CHECK (entry_side IN ('DEBIT', 'CREDIT'))
);

CREATE INDEX IF NOT EXISTS idx_ocal_cus ON public.org_customer_ar_ledger_dtl(tenant_org_id, customer_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocal_inv ON public.org_customer_ar_ledger_dtl(tenant_org_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_ocal_vch ON public.org_customer_ar_ledger_dtl(tenant_org_id, voucher_id);

ALTER TABLE public.org_customer_ar_ledger_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_ocal_tenant ON public.org_customer_ar_ledger_dtl;
CREATE POLICY pol_ocal_tenant ON public.org_customer_ar_ledger_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
