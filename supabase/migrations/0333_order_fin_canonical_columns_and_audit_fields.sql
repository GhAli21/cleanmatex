-- =============================================================================
-- 0333_order_fin_canonical_columns_and_audit_fields.sql
-- =============================================================================
-- Purpose
--   Add the canonical Order Fin snapshot columns on public.org_orders_mst
--   without removing any legacy header fields yet.
--
-- Why additive first
--   The repo still contains legacy reads and writes (`total`, `subtotal`,
--   `gift_card_applied_amount`, `net_receivable_amount`, etc.). Adding the new
--   canonical columns first lets the application dual-write and dual-read during
--   the transition, then prove safe removal in a later cleanup migration.
--
-- Important
--   Create-only for review. Do NOT run automatically.
-- =============================================================================

BEGIN;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_base_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece_extra_price_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preference_extra_price_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charge_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS express_charge_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS real_payment_refunded_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stored_value_restored_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_credit_issued_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_collected_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overpaid_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_payment_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS authorized_payment_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_payment_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reopens_due_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_reversal_reopens_due_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_reversed_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ar_receivable_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ar_invoice_id UUID,
  ADD COLUMN IF NOT EXISTS ar_invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS ar_invoice_status TEXT,
  ADD COLUMN IF NOT EXISTS tax_document_id UUID,
  ADD COLUMN IF NOT EXISTS tax_document_no TEXT,
  ADD COLUMN IF NOT EXISTS tax_document_status TEXT,
  ADD COLUMN IF NOT EXISTS tax_document_type TEXT,
  ADD COLUMN IF NOT EXISTS financial_last_calculated_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS financial_last_calculated_by TEXT,
  ADD COLUMN IF NOT EXISTS financial_snapshot_status TEXT NOT NULL DEFAULT 'RECALCULATION_REQUIRED',
  ADD COLUMN IF NOT EXISTS financial_mismatch_warning_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS financial_calculation_hash TEXT,
  ADD COLUMN IF NOT EXISTS financial_calculation_trace_id UUID;

COMMENT ON COLUMN public.org_orders_mst.subtotal_amount IS
  'Canonical commercial subtotal before discounts, tax, and rounding. In the current pricing mode this matches items_base_amount because extras are already embedded in line totals.';
COMMENT ON COLUMN public.org_orders_mst.items_base_amount IS
  'Canonical item/service base total written from detail lines. In the current pricing mode it equals subtotal_amount because extras are already embedded in line totals.';
COMMENT ON COLUMN public.org_orders_mst.total_amount IS
  'Canonical sale total after commercial discounts, tax, and rounding. Stored-value credits and real payments must never reduce this amount.';
COMMENT ON COLUMN public.org_orders_mst.piece_extra_price_amount IS
  'Informational piece-level extra-price breakdown. Do not add this again to total_charges_amount while current line totals already embed extras.';
COMMENT ON COLUMN public.org_orders_mst.preference_extra_price_amount IS
  'Informational preference-level extra-price breakdown. Do not add this again to total_charges_amount while current line totals already embed extras.';
COMMENT ON COLUMN public.org_orders_mst.service_charge_amount IS
  'Canonical service-charge breakdown for UI/reporting. This is separate from legacy service_charge.';
COMMENT ON COLUMN public.org_orders_mst.delivery_charge_amount IS
  'Canonical delivery-charge breakdown sourced from charge detail rows.';
COMMENT ON COLUMN public.org_orders_mst.express_charge_amount IS
  'Canonical express-charge breakdown sourced from charge detail rows.';
COMMENT ON COLUMN public.org_orders_mst.other_charges_amount IS
  'Catch-all charge breakdown for charge rows that are not service, delivery, or express.';
COMMENT ON COLUMN public.org_orders_mst.taxable_amount IS
  'Canonical taxable base after commercial discounts and before tax amount roll-up.';
COMMENT ON COLUMN public.org_orders_mst.refunded_amount IS
  'Total processed refunds across every destination type (cash/original method, wallet restoration, customer credit issuance).';
COMMENT ON COLUMN public.org_orders_mst.real_payment_refunded_amount IS
  'Processed refunds that reverse real-payment collection only. Used by net_collected_amount.';
COMMENT ON COLUMN public.org_orders_mst.stored_value_restored_amount IS
  'Processed refunds that restore stored value such as wallet or gift-card value.';
COMMENT ON COLUMN public.org_orders_mst.customer_credit_issued_amount IS
  'Processed refunds issued as customer credit / credit note instead of cash or original-method reversal.';
COMMENT ON COLUMN public.org_orders_mst.net_collected_amount IS
  'Net real-money collection: total_paid_amount minus real_payment_refunded_amount. Stored-value credits are excluded.';
COMMENT ON COLUMN public.org_orders_mst.overpaid_amount IS
  'Positive surplus when completed real payments plus applied credits exceed total_amount.';
COMMENT ON COLUMN public.org_orders_mst.pending_payment_amount IS
  'Real-payment amount still pending external completion. Pending/processing legs must not reduce outstanding.';
COMMENT ON COLUMN public.org_orders_mst.authorized_payment_amount IS
  'Real-payment amount only authorized, not yet captured/settled. Authorized legs must not reduce outstanding.';
COMMENT ON COLUMN public.org_orders_mst.failed_payment_amount IS
  'Real-payment amount in failed/cancelled/voided/refused/reversed terminal states. Failed legs must not reduce outstanding.';
COMMENT ON COLUMN public.org_orders_mst.refund_reopens_due_amount IS
  'Amount by which a processed refund explicitly reopens customer due. Added now for future policy support; current backfill keeps zero unless a row proves reopen-due behavior.';
COMMENT ON COLUMN public.org_orders_mst.credit_reversal_reopens_due_amount IS
  'Amount by which reversing an applied credit explicitly reopens customer due. Added now for future policy support; current backfill keeps zero unless a row proves reopen-due behavior.';
COMMENT ON COLUMN public.org_orders_mst.credit_reversed_amount IS
  'Amount of previously applied credit that has been reversed from the order.';
COMMENT ON COLUMN public.org_orders_mst.ar_receivable_amount IS
  'Canonical AR receivable amount. Only receivable settlement types such as CREDIT_INVOICE may populate this; PAY_ON_COLLECTION must stay zero.';
COMMENT ON COLUMN public.org_orders_mst.ar_invoice_id IS
  'Optional denormalized AR invoice link for financial summary reads.';
COMMENT ON COLUMN public.org_orders_mst.ar_invoice_no IS
  'Optional denormalized AR invoice number for financial summary reads.';
COMMENT ON COLUMN public.org_orders_mst.ar_invoice_status IS
  'Optional denormalized AR invoice status for financial summary reads.';
COMMENT ON COLUMN public.org_orders_mst.tax_document_id IS
  'Optional denormalized tax-document link. Tax documents are separate from AR invoices.';
COMMENT ON COLUMN public.org_orders_mst.tax_document_no IS
  'Optional denormalized tax-document number.';
COMMENT ON COLUMN public.org_orders_mst.tax_document_status IS
  'Optional denormalized tax-document status.';
COMMENT ON COLUMN public.org_orders_mst.tax_document_type IS
  'Optional denormalized tax-document type.';
COMMENT ON COLUMN public.org_orders_mst.financial_last_calculated_at IS
  'Timestamp of the latest canonical financial snapshot recalculation.';
COMMENT ON COLUMN public.org_orders_mst.financial_last_calculated_by IS
  'Actor/system marker that last recalculated the canonical financial snapshot.';
COMMENT ON COLUMN public.org_orders_mst.financial_snapshot_status IS
  'Canonical snapshot lifecycle status: CURRENT, MISMATCH, RECALCULATION_REQUIRED, with STALE and LOCKED reserved for future workflows.';
COMMENT ON COLUMN public.org_orders_mst.financial_mismatch_warning_count IS
  'Count of canonical financial warning codes persisted in financial_calculation_snapshot.';
COMMENT ON COLUMN public.org_orders_mst.financial_calculation_snapshot IS
  'Versioned JSONB calculation trace containing source totals, derived totals, warning codes, fallback flags, and lineage notes used to build this snapshot.';
COMMENT ON COLUMN public.org_orders_mst.financial_calculation_hash IS
  'Stable hash of the canonical calculation payload. Volatile fields such as timestamps, trace ids, and batch ids must be excluded.';
COMMENT ON COLUMN public.org_orders_mst.financial_calculation_trace_id IS
  'Trace identifier for the most recent recalculation batch/write. Migration 0334 uses one batch trace id per run.';

COMMENT ON COLUMN public.org_orders_mst.total_charges_amount IS
  'Canonical sum of commercial charge detail rows. Informational extra-price breakdown fields must not be added again when already embedded in line totals.';
COMMENT ON COLUMN public.org_orders_mst.total_discount_amount IS
  'Canonical sum of commercial discounts only. Stored-value credits must never be written here.';
COMMENT ON COLUMN public.org_orders_mst.total_tax_amount IS
  'Canonical sum of tax detail rows. Legacy tax/vat header fields remain compatibility-only.';
COMMENT ON COLUMN public.org_orders_mst.total_credit_applied_amount IS
  'Canonical sum of applied stored-value or customer-credit settlement rows.';
COMMENT ON COLUMN public.org_orders_mst.total_paid_amount IS
  'Canonical sum of completed real-payment rows only.';
COMMENT ON COLUMN public.org_orders_mst.pay_on_collection_amount IS
  'Operational retail amount still due for PAY_ON_COLLECTION orders. This is not AR.';
COMMENT ON COLUMN public.org_orders_mst.rounding_adjustment_amount IS
  'Canonical rounding adjustment included in total_amount.';
COMMENT ON COLUMN public.org_orders_mst.change_returned_amount IS
  'Canonical sum of change returned from completed real-payment rows.';
COMMENT ON COLUMN public.org_orders_mst.outstanding_amount IS
  'Canonical unsettled amount after completed real payments and applied credits, plus any explicit reopen-due adjustments.';
COMMENT ON COLUMN public.org_orders_mst.financial_engine_version IS
  'Snapshot engine version used for the order header financial projection.';
COMMENT ON COLUMN public.org_orders_mst.payment_status IS
  'Order payment settlement snapshot status. Canonical values are uppercase and separate from per-leg payment lifecycle statuses.';
COMMENT ON COLUMN public.org_orders_mst.net_receivable_amount IS
  'Legacy compatibility field. New code must read/write ar_receivable_amount instead and treat this column as temporary until cleanup migration 0335.';
COMMENT ON COLUMN public.org_orders_mst.gift_card_applied_amount IS
  'Legacy compatibility field. New code must treat gift-card redemption as stored-value settlement and prefer total_credit_applied_amount.';
COMMENT ON COLUMN public.org_orders_mst.service_charge IS
  'Legacy compatibility field. New code must prefer service_charge_amount.';
COMMENT ON COLUMN public.org_orders_mst.total IS
  'Legacy compatibility field. New code must prefer total_amount.';
COMMENT ON COLUMN public.org_orders_mst.subtotal IS
  'Legacy compatibility field. New code must prefer subtotal_amount.';

COMMIT;
