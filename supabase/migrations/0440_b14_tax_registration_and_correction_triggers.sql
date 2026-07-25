-- ==================================================================
-- 0440_b14_tax_registration_and_correction_triggers.sql
-- Purpose: B14 (Tax Document Runtime Integration) — the two genuinely
--          missing pieces of schema needed to wire the already-built
--          (Phase 7 / migration 0341) tax-document writer/decision/
--          sequence chain into live trigger points.
--
-- 1. Tenant/branch tax-registration prerequisite. Nothing currently
--    records whether a tenant is legally registered to issue tax
--    documents. A tax document must never be issued for a tenant with
--    no registration number — this column is the gate. Branch-level
--    override is nullable and falls back to the tenant value, mirroring
--    the existing org_branches_mst.tax_pricing_mode pattern (migration
--    0339, B11).
--
-- 2. Two new trigger_event values on org_tax_documents_mst — ON_REFUND
--    and ON_AMENDMENT — for the audit trail on credit/debit-note
--    correction documents issued from the refund (B34) and order-
--    amendment (B12) flows. These are NOT added to
--    org_tax_doc_triggers_cfg's trigger_event CHECK: that table gates
--    the *primary* invoice-issuance triggers a tenant opts into per
--    business event; a correction document is an unconditional
--    consequence of a financial delta on an order that already has an
--    ISSUED tax document, not a separately configurable trigger.
--
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0341_tax_documents_master_and_lines.sql
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS tax_registration_no TEXT;

COMMENT ON COLUMN public.org_tenants_mst.tax_registration_no IS
  'VAT/tax registration number. NULL = tenant is not registered and no '
  'tax document may be issued for it (B14 issuance prerequisite gate).';

ALTER TABLE public.org_branches_mst
  ADD COLUMN IF NOT EXISTS tax_registration_no TEXT;

COMMENT ON COLUMN public.org_branches_mst.tax_registration_no IS
  'Per-branch VAT/tax registration override. NULL falls back to '
  'org_tenants_mst.tax_registration_no (mirrors tax_pricing_mode, mig 0339).';

ALTER TABLE public.org_tax_documents_mst
  DROP CONSTRAINT chk_tax_doc_trigger;

ALTER TABLE public.org_tax_documents_mst
  ADD CONSTRAINT chk_tax_doc_trigger CHECK (trigger_event IN (
    'ON_ORDER_SUBMIT',
    'ON_PAYMENT_CONFIRMATION',
    'ON_SERVICE_COMPLETION',
    'ON_DELIVERY',
    'ON_AR_INVOICE_ISSUE',
    'ON_REFUND',
    'ON_AMENDMENT',
    'LEGACY_BACKFILL'
  ));

COMMIT;
