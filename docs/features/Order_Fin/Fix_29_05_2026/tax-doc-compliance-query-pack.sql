-- Tax Document Compliance Verification Query Pack
-- Run via Supabase SQL editor (read-only, staging or production).
-- Purpose: verify sequence integrity, immutability, and document-type distribution
--          before claiming ZATCA/UAE VAT compliance-grade status.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sequence gap check — confirm no gaps within a fiscal year per tenant
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tenant_org_id,
  document_type,
  fiscal_year,
  sequence_number,
  sequence_number - LAG(sequence_number) OVER (
    PARTITION BY tenant_org_id, document_type, fiscal_year
    ORDER BY sequence_number
  ) AS gap
FROM org_tax_documents_mst
WHERE sequence_number > 0
  AND status IN ('ISSUED', 'SUPERSEDED', 'CANCELLED')
ORDER BY tenant_org_id, document_type, fiscal_year, sequence_number;
-- Expected: all gap values = 1 (no missing sequence numbers)

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Duplicate sequence number check
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tenant_org_id,
  document_type,
  fiscal_year,
  sequence_number,
  COUNT(*) AS occurrences
FROM org_tax_documents_mst
WHERE sequence_number > 0
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1;
-- Expected: 0 rows returned

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Immutability trigger test (run in a transaction then ROLLBACK)
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- UPDATE org_tax_documents_mst
--   SET tax_amount = tax_amount + 1
--   WHERE status = 'ISSUED'
--   LIMIT 1;
-- Expected: ERROR from trg_tax_doc_immutable / fn_tax_doc_immut_guard()
-- ROLLBACK;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Document-type distribution — verify only canonical types appear
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  document_type,
  status,
  COUNT(*) AS count
FROM org_tax_documents_mst
GROUP BY 1, 2
ORDER BY 1, 2;
-- Expected: only INVOICE, SIMPLIFIED_INVOICE, CREDIT_NOTE, DEBIT_NOTE in document_type column

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Credit note chain integrity — every credit note links to a valid parent
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  cn.id,
  cn.tenant_org_id,
  cn.document_type,
  cn.supersedes_id,
  parent.status AS parent_status
FROM org_tax_documents_mst cn
LEFT JOIN org_tax_documents_mst parent
  ON cn.supersedes_id = parent.id
  AND cn.tenant_org_id = parent.tenant_org_id
WHERE cn.document_type = 'CREDIT_NOTE'
  AND cn.supersedes_id IS NOT NULL
  AND parent.id IS NULL;
-- Expected: 0 rows (no orphaned credit notes)

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Sequence counter health — all counters match actual max sequence per partition
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.tenant_org_id,
  c.document_type,
  c.fiscal_year,
  c.last_sequence_number AS counter_value,
  COALESCE(MAX(d.sequence_number), 0) AS actual_max
FROM org_tax_doc_seq_counters c
LEFT JOIN org_tax_documents_mst d
  ON d.tenant_org_id = c.tenant_org_id
  AND d.document_type = c.document_type
  AND d.fiscal_year = c.fiscal_year
  AND d.sequence_number > 0
GROUP BY 1, 2, 3, 4
HAVING c.last_sequence_number != COALESCE(MAX(d.sequence_number), 0);
-- Expected: 0 rows (counter never behind or ahead of actual max)
