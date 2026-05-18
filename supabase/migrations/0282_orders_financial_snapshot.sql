-- =============================================================================
-- Migration 0282: Financial Snapshot Columns on org_orders_mst
-- Adds denormalized financial summary columns for fast reads.
-- No behavior change — columns default to NULL/0 until settlement service writes them.
-- =============================================================================

BEGIN;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS total_charges_amount        DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS total_discount_amount       DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS total_tax_amount            DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS total_credit_applied_amount DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS total_paid_amount           DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS net_receivable_amount       DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS pay_on_collection_amount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS rounding_adjustment_amount  DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_returned_amount      DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_amount          DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS financial_engine_version    SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payment_status              TEXT DEFAULT 'PENDING'
    /*
	CHECK (payment_status IN (
      'PENDING',
	  'UNPAID',
      'PENDING_COLLECTION',
      'PARTIALLY_PAID',
      'PAID',
      'OVERPAID',
      'REFUNDED',
      'PARTIALLY_REFUNDED'
    ))*/
	;

-- Index for common payment status queries (e.g. find all PENDING_COLLECTION orders)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.org_orders_mst (tenant_org_id, payment_status)
  WHERE payment_status IS NOT NULL;

COMMIT;
