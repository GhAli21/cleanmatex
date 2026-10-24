-- =============================================================================
-- 0645_tax_doc_items_dtl.sql
-- Line-Level Money Snapshot — Phase 3, M7 (PLAN.md §6.7, §6.8), the last
-- migration of Phase 3.
--
-- Why: closes the e-invoicing item-line gap. A tax document today has no
-- item lines at all -- a credit/debit note or a GCC simplified tax invoice
-- cannot show what it covers without re-reading live (and mutable) order
-- items. org_tax_doc_items_dtl is an immutable copy of each item's line
-- money, written once when the tax document is issued (Phase 8 writer);
-- a credit note references these rows, never live order items.
--
-- Unlike M5/M6 (ALTER TABLE ADD COLUMN on existing tables with existing
-- rows, staged nullable until the Phase 10 recompute), this is a brand-new
-- table with zero rows today -- every row from here on is created fresh by
-- its one writer (Phase 8). There is no legacy-data problem to stage
-- around, so its core columns are NOT NULL with real CHECKs from day one.
--
-- Immutability: this table has no updated_at / updated_by / updated_info.
-- Omitted deliberately, not forgotten -- "never updated after issue" (§6.7)
-- means there is nothing for those columns to ever record. rec_status is
-- kept for schema consistency with every other org_* table, but a row
-- should never move off 1 in practice; a wrong fiscal line is corrected by
-- issuing a credit/debit note that references it, never by editing or
-- deactivating it.
--
-- One combined tax per line (§6.8 known limit): no child table for
-- multiple tax types per line. Line money is in order currency only
-- (§6.8): no base-currency columns here (header-only, FX program).
--
-- The exact GCC per-country field list (PINT OM, ZATCA) is Phase 8 scope
-- (P0-12, P8-02) -- this migration implements exactly the column set
-- PLAN.md §6.7 already specifies, nothing more.
--
-- Composite-FK prerequisite: org_tax_documents_mst has no (tenant_org_id,
-- id) unique yet (only a plain PK(id)), so this migration adds one,
-- tenant-first -- the same choice already made for org_tax_profiles_cf and
-- org_price_lists_mst in M5.
--
-- Rollback (forward-only): DROP TABLE org_tax_doc_items_dtl RESTRICT (no
-- dependents yet); drop the prerequisite unique on org_tax_documents_mst.
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 0. Composite-FK prerequisite
-- ------------------------------------------------------------------
ALTER TABLE public.org_tax_documents_mst
  ADD CONSTRAINT uq_org_tax_docs_tenant_id UNIQUE (tenant_org_id, id);

-- ------------------------------------------------------------------
-- 1. org_tax_doc_items_dtl
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_tax_doc_items_dtl (
  id                     UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id          UUID NOT NULL,
  tax_document_id        UUID NOT NULL,
  order_item_id          UUID NOT NULL,
  line_no                SMALLINT NOT NULL,

  -- immutable name snapshot (the live product can be renamed later)
  product_name           TEXT NOT NULL,
  product_name2          TEXT,

  quantity               INTEGER NOT NULL,
  price_per_unit         DECIMAL(19,4) NOT NULL,
  discount_amount        DECIMAL(19,4) NOT NULL DEFAULT 0,
  net_amount             DECIMAL(19,4) NOT NULL,
  tax_category_code      TEXT NOT NULL,
  tax_rate               NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount             DECIMAL(19,4) NOT NULL DEFAULT 0,
  line_total_amount      DECIMAL(19,4) NOT NULL,

  rec_status             SMALLINT NOT NULL DEFAULT 1,
  rec_order              INTEGER,
  rec_notes              TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             TEXT,
  created_info           TEXT,

  CONSTRAINT pk_org_tax_doc_items PRIMARY KEY (id),
  CONSTRAINT fk_otdi_tax_document
    FOREIGN KEY (tenant_org_id, tax_document_id) REFERENCES public.org_tax_documents_mst(tenant_org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_otdi_order_item
    FOREIGN KEY (order_item_id, tenant_org_id) REFERENCES public.org_order_items_dtl(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_otdi_tax_category
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  CONSTRAINT uq_otdi_document_line UNIQUE (tax_document_id, line_no),
  CONSTRAINT chk_otdi_line_no_pos CHECK (line_no > 0),
  CONSTRAINT chk_otdi_quantity_pos CHECK (quantity > 0),
  CONSTRAINT chk_otdi_price_nonneg CHECK (price_per_unit >= 0),
  CONSTRAINT chk_otdi_discount_nonneg CHECK (discount_amount >= 0),
  CONSTRAINT chk_otdi_tax_rate_nonneg CHECK (tax_rate >= 0),
  CONSTRAINT chk_otdi_tax_amount_nonneg CHECK (tax_amount >= 0),
  CONSTRAINT chk_otdi_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE INDEX IF NOT EXISTS idx_otdi_document
  ON public.org_tax_doc_items_dtl (tenant_org_id, tax_document_id, line_no);

CREATE INDEX IF NOT EXISTS idx_otdi_order_item
  ON public.org_tax_doc_items_dtl (tenant_org_id, order_item_id);

ALTER TABLE public.org_tax_doc_items_dtl ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_otdi_tenant ON public.org_tax_doc_items_dtl;
CREATE POLICY pol_otdi_tenant ON public.org_tax_doc_items_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_tax_doc_items_dtl IS
  'Line-Level Money Snapshot (PLAN.md §6.7): an immutable copy of each item''s line money, written once when a tax document is issued (Phase 8). Closes the e-invoicing item-line gap -- a tax document print or a credit/debit note reads these rows, never live (and mutable) order items. Never updated after insert (no updated_at/updated_by/updated_info columns -- see this migration''s header note).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.tax_document_id IS 'The tax document this line was issued on. Composite FK (tenant_org_id, id) on org_tax_documents_mst. ON DELETE RESTRICT: a fiscal line must never disappear.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.order_item_id IS 'The order line this fiscal line was copied from, at the moment of issue. Composite FK (id, tenant_org_id) on org_order_items_dtl. ON DELETE RESTRICT.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.line_no IS 'Print order within the document (1-based). Unique per tax_document_id.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.product_name IS 'English product name at the time of issue -- a snapshot, independent of later catalog renames.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.product_name2 IS 'Arabic product name snapshot.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.quantity IS 'Quantity billed on this fiscal line.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.price_per_unit IS 'Unit price at the time of issue.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.discount_amount IS 'This line''s own discount plus its order-discount share at issue time (org_order_items_dtl.line_disc_amount + order_disc_alloc_amount, combined into one figure for the fiscal line, per PLAN.md §6.7).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.net_amount IS 'Taxable base after discount_amount (mirrors org_order_items_dtl.net_amount at issue time).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.tax_category_code IS 'FK sys_tax_category_cd. This line''s tax category at the time of issue.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.tax_rate IS 'The rate applied, as a percentage (same convention as org_order_taxes_dtl.rate).';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.tax_amount IS 'This line''s own tax amount on the document.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.line_total_amount IS 'net_amount + tax_amount (or net_amount alone if tax-inclusive) at issue time.';
COMMENT ON COLUMN public.org_tax_doc_items_dtl.rec_status IS 'Standard soft-delete status. Expected to stay 1 in practice -- a wrong fiscal line is corrected by a credit/debit note referencing it, never by editing or deactivating this row.';

COMMIT;
