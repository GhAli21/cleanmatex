-- =============================================================================
-- Migration: 0708_tax_doc_identity.sql
-- Program:   Tax Engine T1 / M1 — document identity (ADR-062)
-- Plan:      docs/features/Tax_Config/TAX_ENGINE_PLAN.md §3
-- Purpose:
--   1. sys_doc_seq_type_cd becomes the single document-type registry for tax:
--      adds tax_flow_code (OUTPUT / INPUT / WITHHOLDING / NONE) and
--      is_tax_relevant, seeded for every row.
--   2. Every org_* transaction header table in the registry gets
--      doc_type_code TEXT NOT NULL, FK to the registry.
--        - single-type tables: DEFAULT <its code> + CHECK on that one value,
--          so existing writers need no change and every row is backfilled.
--        - multi-type tables (org_fin_vouchers_mst, org_tax_documents_mst):
--          a BEFORE INSERT/UPDATE trigger derives it from the existing subtype
--          column; a CHECK keeps the two consistent.
-- Not in scope: line tables (ORDER_ITEM, ORDER_PIECE — they belong to the
--   order), HQ platform billing (sys_bill_invoices_mst).
-- Rollback: drop the triggers/functions, then ALTER TABLE … DROP COLUMN
--   doc_type_code RESTRICT on each table, then drop the two registry columns.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Registry: tax flow per document type ────────────────────────────────

ALTER TABLE public.sys_doc_seq_type_cd
  ADD COLUMN IF NOT EXISTS tax_flow_code   TEXT    NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS is_tax_relevant BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sys_doc_seq_type_cd.tax_flow_code IS
  'Tax direction of this document type: OUTPUT (sales tax charged), INPUT (purchase tax paid), WITHHOLDING (tax withheld on a payout), NONE. Tax rules can match on it (ADR-062).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.is_tax_relevant IS
  'True when documents of this type can carry tax lines. Must be false when tax_flow_code = NONE.';

ALTER TABLE public.sys_doc_seq_type_cd
  ADD CONSTRAINT ck_dst_tax_flow
    CHECK (tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING', 'NONE')),
  ADD CONSTRAINT ck_dst_tax_relevant
    CHECK (NOT is_tax_relevant OR tax_flow_code <> 'NONE');

COMMENT ON CONSTRAINT ck_dst_tax_flow ON public.sys_doc_seq_type_cd IS
  'Allowed tax flow codes.';
COMMENT ON CONSTRAINT ck_dst_tax_relevant ON public.sys_doc_seq_type_cd IS
  'A tax-relevant document type must have a tax flow.';

-- Sales side: orders and their lines, AR / tax invoices and notes, refunds,
-- store credit, receipts (advance payments can be a tax point), gift cards
-- (single-purpose cards are taxed at sale).
UPDATE public.sys_doc_seq_type_cd
   SET tax_flow_code = 'OUTPUT', is_tax_relevant = true,
       updated_at = now(), updated_by = 'migration_0708', updated_info = 'Tax engine M1: tax flow seed'
 WHERE doc_type_code IN ('ORDER', 'ORDER_ITEM', 'ORDER_PIECE', 'AR_INVOICE',
                         'TAX_INVOICE', 'TAX_SIMPLIFIED', 'TAX_CREDIT_NOTE', 'TAX_DEBIT_NOTE',
                         'REFUND', 'REFUND_VOUCHER', 'STORE_CREDIT_NOTE',
                         'RECEIPT_VOUCHER', 'GIFT_CARD');

-- Purchase side: expenses, AP invoices and petty-cash spends carry input tax.
UPDATE public.sys_doc_seq_type_cd
   SET tax_flow_code = 'INPUT', is_tax_relevant = true,
       updated_at = now(), updated_by = 'migration_0708', updated_info = 'Tax engine M1: tax flow seed'
 WHERE doc_type_code IN ('ERP_EXPENSE', 'ERP_AP_INVOICE', 'ERP_PETTY_CASH_TXN');

-- A purchase order is not a tax point: it has an input flow but no tax lines.
UPDATE public.sys_doc_seq_type_cd
   SET tax_flow_code = 'INPUT', is_tax_relevant = false,
       updated_at = now(), updated_by = 'migration_0708', updated_info = 'Tax engine M1: tax flow seed'
 WHERE doc_type_code = 'ERP_PO';

-- Payouts: withholding tax may be deducted from supplier / other payments.
UPDATE public.sys_doc_seq_type_cd
   SET tax_flow_code = 'WITHHOLDING', is_tax_relevant = true,
       updated_at = now(), updated_by = 'migration_0708', updated_info = 'Tax engine M1: tax flow seed'
 WHERE doc_type_code IN ('ERP_AP_PAYMENT', 'PAYMENT_VOUCHER');

-- Every other type (master data, runs, sessions, journals, transfers,
-- adjustments, routes, stock, HQ billing) keeps NONE / false from the DEFAULT.

-- ─── 2. Single-type headers: DEFAULT + CHECK + FK ───────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('org_ar_disputes_mst',          'AR_DISPUTE',           'ard'),
      ('org_ar_dunning_runs_mst',      'AR_DUNNING_RUN',       'adr'),
      ('org_b2b_statements_mst',       'B2B_STATEMENT',        'b2s'),
      ('org_cash_drawer_sessions_mst', 'CASH_DRAWER_SESSION',  'cds'),
      ('org_cash_drawer_trx_mst',      'CASH_DRAWER_TRX',      'cdt'),
      ('org_credit_notes_mst',         'STORE_CREDIT_NOTE',    'crn'),
      ('org_dlv_routes_mst',           'DELIVERY_ROUTE',       'dlr'),
      ('org_fin_alloc_run_mst',        'ERP_ALLOC_RUN',        'far'),
      ('org_fin_ap_inv_mst',           'ERP_AP_INVOICE',       'fai'),
      ('org_fin_ap_pmt_mst',           'ERP_AP_PAYMENT',       'fap'),
      ('org_fin_bank_recon_mst',       'ERP_BANK_RECON',       'fbr'),
      ('org_fin_bank_stmt_mst',        'ERP_BANK_STATEMENT',   'fbs'),
      ('org_fin_cash_rec_mst',         'ERP_PETTY_CASH_RECON', 'fcr'),
      ('org_fin_cash_txn_tr',          'ERP_PETTY_CASH_TXN',   'fct'),
      ('org_fin_cost_run_mst',         'ERP_COST_RUN',         'fcn'),
      ('org_fin_exp_mst',              'ERP_EXPENSE',          'fex'),
      ('org_fin_journal_mst',          'FIN_JOURNAL',          'fjr'),
      ('org_fin_po_mst',               'ERP_PO',               'fpo'),
      ('org_fin_recon_runs_mst',       'AR_RECON_RUN',         'frr'),
      ('org_inv_stock_tr',             'STOCK_TRANSACTION',    'ist'),
      ('org_invoice_mst',              'AR_INVOICE',           'oim'),
      ('org_order_refunds_dtl',        'REFUND',               'orf'),
      ('org_orders_mst',               'ORDER',                'oom'),
      ('org_pos_sessions_mst',         'POS_SESSION',          'pss'),
      ('org_pos_shift_z_rpt_tr',       'POS_Z_REPORT',         'pzr')
    ) AS v(tbl, code, alias)
  LOOP
    -- Constant DEFAULT: metadata-only add; every existing row gets the code.
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS doc_type_code TEXT NOT NULL DEFAULT %L',
                   r.tbl, r.code);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (doc_type_code = %L)',
                   r.tbl, 'ck_' || r.alias || '_doc_type', r.code);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (doc_type_code) '
                   'REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON UPDATE RESTRICT ON DELETE RESTRICT',
                   r.tbl, 'fk_' || r.alias || '_doc_type');
    EXECUTE format('COMMENT ON COLUMN public.%I.doc_type_code IS %L', r.tbl,
                   'Document type from sys_doc_seq_type_cd (ADR-062). This table holds one type only: always '
                   || r.code || ' (DEFAULT + CHECK). Tax rules and reports key on it.');
    EXECUTE format('COMMENT ON CONSTRAINT %I ON public.%I IS %L', 'ck_' || r.alias || '_doc_type', r.tbl,
                   'Single-type table: doc_type_code must be ' || r.code || '.');
    EXECUTE format('COMMENT ON CONSTRAINT %I ON public.%I IS %L', 'fk_' || r.alias || '_doc_type', r.tbl,
                   'Document type must exist in the registry sys_doc_seq_type_cd.');
  END LOOP;
END $$;

-- ─── 3. Payment / receipt vouchers: type = voucher_type (NULL → VOUCHER_OTHER) ───────────────────────

-- The DEFAULT is only a placeholder so ORM inserts may omit the column;
-- the trigger below always overwrites it from voucher_type before the CHECK runs.
ALTER TABLE public.org_fin_vouchers_mst
  ADD COLUMN IF NOT EXISTS doc_type_code TEXT NOT NULL DEFAULT 'RECEIPT_VOUCHER';

UPDATE public.org_fin_vouchers_mst
   SET doc_type_code = COALESCE(voucher_type, 'VOUCHER_OTHER')
 WHERE tenant_org_id IS NOT NULL                -- every tenant's rows (explicit tenant predicate)
   AND doc_type_code IS DISTINCT FROM COALESCE(voucher_type, 'VOUCHER_OTHER');

COMMENT ON COLUMN public.org_fin_vouchers_mst.doc_type_code IS
  'Document type from sys_doc_seq_type_cd (ADR-062). Equal to voucher_type, or VOUCHER_OTHER when voucher_type is NULL; set by trg_fvo_doc_type. The DEFAULT is a placeholder that the trigger overwrites.';

CREATE OR REPLACE FUNCTION public.fn_fvo_set_doc_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  NEW.doc_type_code := COALESCE(NEW.voucher_type, 'VOUCHER_OTHER');  -- voucher_type is nullable (old/test rows)
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_fvo_set_doc_type() IS
  'Keeps org_fin_vouchers_mst.doc_type_code equal to voucher_type (voucher types are registry codes), or VOUCHER_OTHER when voucher_type is NULL.';

CREATE TRIGGER trg_fvo_doc_type
  BEFORE INSERT OR UPDATE OF voucher_type, doc_type_code ON public.org_fin_vouchers_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_fvo_set_doc_type();

COMMENT ON TRIGGER trg_fvo_doc_type ON public.org_fin_vouchers_mst IS
  'Derives doc_type_code from voucher_type on every insert and on any change of either column.';

ALTER TABLE public.org_fin_vouchers_mst
  ADD CONSTRAINT ck_fvo_doc_type CHECK (doc_type_code = COALESCE(voucher_type, 'VOUCHER_OTHER')),
  ADD CONSTRAINT fk_fvo_doc_type FOREIGN KEY (doc_type_code)
    REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMENT ON CONSTRAINT ck_fvo_doc_type ON public.org_fin_vouchers_mst IS
  'doc_type_code mirrors voucher_type; NULL voucher_type maps to VOUCHER_OTHER.';
COMMENT ON CONSTRAINT fk_fvo_doc_type ON public.org_fin_vouchers_mst IS
  'Document type must exist in the registry sys_doc_seq_type_cd.';

-- ─── 4. Tax documents: type derived from document_type ──────────────────────

ALTER TABLE public.org_tax_documents_mst
  ADD COLUMN IF NOT EXISTS doc_type_code TEXT NOT NULL DEFAULT 'TAX_INVOICE';

UPDATE public.org_tax_documents_mst
   SET doc_type_code = CASE document_type
                         WHEN 'INVOICE'            THEN 'TAX_INVOICE'
                         WHEN 'SIMPLIFIED_INVOICE' THEN 'TAX_SIMPLIFIED'
                         WHEN 'CREDIT_NOTE'        THEN 'TAX_CREDIT_NOTE'
                         WHEN 'DEBIT_NOTE'         THEN 'TAX_DEBIT_NOTE'
                       END
 WHERE tenant_org_id IS NOT NULL;               -- every tenant's rows (explicit tenant predicate)

COMMENT ON COLUMN public.org_tax_documents_mst.doc_type_code IS
  'Document type from sys_doc_seq_type_cd (ADR-062): INVOICE→TAX_INVOICE, SIMPLIFIED_INVOICE→TAX_SIMPLIFIED, CREDIT_NOTE→TAX_CREDIT_NOTE, DEBIT_NOTE→TAX_DEBIT_NOTE. Set by trg_tdo_doc_type; the DEFAULT is a placeholder.';

CREATE OR REPLACE FUNCTION public.fn_tdo_set_doc_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  NEW.doc_type_code := CASE NEW.document_type
                         WHEN 'INVOICE'            THEN 'TAX_INVOICE'
                         WHEN 'SIMPLIFIED_INVOICE' THEN 'TAX_SIMPLIFIED'
                         WHEN 'CREDIT_NOTE'        THEN 'TAX_CREDIT_NOTE'
                         WHEN 'DEBIT_NOTE'         THEN 'TAX_DEBIT_NOTE'
                       END;                     -- unknown type → NULL → NOT NULL error (chk_tax_doc_type also guards)
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_tdo_set_doc_type() IS
  'Maps org_tax_documents_mst.document_type to its registry doc_type_code.';

CREATE TRIGGER trg_tdo_doc_type
  BEFORE INSERT OR UPDATE OF document_type, doc_type_code ON public.org_tax_documents_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tdo_set_doc_type();

COMMENT ON TRIGGER trg_tdo_doc_type ON public.org_tax_documents_mst IS
  'Derives doc_type_code from document_type on every insert and on any change of either column.';

ALTER TABLE public.org_tax_documents_mst
  ADD CONSTRAINT ck_tdo_doc_type CHECK (
    doc_type_code = CASE document_type
                      WHEN 'INVOICE'            THEN 'TAX_INVOICE'
                      WHEN 'SIMPLIFIED_INVOICE' THEN 'TAX_SIMPLIFIED'
                      WHEN 'CREDIT_NOTE'        THEN 'TAX_CREDIT_NOTE'
                      WHEN 'DEBIT_NOTE'         THEN 'TAX_DEBIT_NOTE'
                    END),
  ADD CONSTRAINT fk_tdo_doc_type FOREIGN KEY (doc_type_code)
    REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMENT ON CONSTRAINT ck_tdo_doc_type ON public.org_tax_documents_mst IS
  'doc_type_code always matches the mapping of document_type.';
COMMENT ON CONSTRAINT fk_tdo_doc_type ON public.org_tax_documents_mst IS
  'Document type must exist in the registry sys_doc_seq_type_cd.';

-- ─── 5. Self-check ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_missing TEXT;
BEGIN
  -- Every org_* TRANSACTION header in the registry (except order lines) must now carry doc_type_code.
  SELECT string_agg(DISTINCT s.target_table, ', ')
    INTO v_missing
    FROM public.sys_doc_seq_type_cd s
   WHERE s.category_code = 'TRANSACTION'
     AND s.target_table LIKE 'org\_%'
     AND s.doc_type_code NOT IN ('ORDER_ITEM', 'ORDER_PIECE')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public'
                        AND c.table_name = s.target_table
                        AND c.column_name = 'doc_type_code');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'M1 incomplete: doc_type_code missing on %', v_missing;
  END IF;
END $$;

COMMIT;
