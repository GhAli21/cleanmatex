# Phase 7 — Tax-Document Full Lifecycle

**Status:** Done — 2026-06-05  
**ADR reference:** ADR-041 (Tax-Document Fiscal Lifecycle)  
**Migration:** `0341_tax_documents_master_and_lines.sql`

---

## What was done

Implemented the complete tax-document issuance, correction, and reconciliation lifecycle for ZATCA / UAE VAT / Oman fiscal compliance.

### DB changes (migration 0341)

Four new tables:

| Table | Purpose |
|---|---|
| `org_tax_documents_mst` | Master document record — DRAFT → ISSUED (fiscally immutable) |
| `org_tax_doc_lines_dtl` | Per-document tax line snapshot |
| `org_tax_doc_seq_counters` | Row-locked monotonic sequence counter per (tenant, type, fiscal_year) |
| `org_tax_doc_triggers_cfg` | Per-tenant config: which trigger events produce which document type |

Key schema decisions:
- `sequence_number = 0` reserved for legacy backfill rows; partial unique index enforces uniqueness for `sequence_number > 0`
- `supersedes_id` self-FK with `ON DELETE RESTRICT` — credit/debit note chain
- `currency_ex_rate DECIMAL(10,6)` + `base_currency_code TEXT` for multi-currency snapshot (user-added fields, consistent with `org_orders_mst` convention)
- DB immutability trigger `trg_tax_doc_immutable` / `fn_tax_doc_immut_guard`: blocks all UPDATEs on ISSUED rows except `status → SUPERSEDED`
- RLS via `current_tenant_id()` on both `org_tax_documents_mst` and `org_tax_doc_triggers_cfg`
- No RLS on `org_tax_doc_seq_counters` — accessed via `service_role` only (locking pattern requires elevated access)

Permissions seeded (5):
- `tax_document:create/issue/cancel/supersede` — super_admin + tenant_admin
- `tax_document:configure_triggers` — super_admin only

### Services created

**`tax-document-sequence.service.ts`**  
- `allocateTaxDocumentSequence(tx, tenantId, documentType, fiscalYear): Promise<number>`  
  Uses `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` + `UPDATE` inside caller's transaction for gap-free numbering under concurrency.
- `formatTaxDocumentNo(type, year, seq): string`  
  Produces `INV-2026-000001`, `SIM-2026-000042`, `CN-2025-000003`, `DN-2026-000001`.

**`tax-document-decision.service.ts`** (pure — no DB, no `server-only`)  
- `decideTaxDocumentIssuance(triggerEvent, orderState, tenantConfigs): TaxDocumentDecision`  
  Decision matrix: enabled config + eligible order status + hasTaxLines → shouldIssue.
- `decideCorrectionDocumentType(netDelta): TaxDocumentType | null`  
  `netDelta > 0 → DEBIT_NOTE`, `< 0 → CREDIT_NOTE`, `= 0 → null`.

**`tax-document-write.service.ts`**  
- `createTaxDocumentTx(tx, input): Promise<string>` — creates DRAFT doc + lines inside caller's TX
- `issueTaxDocumentTx(tx, documentId, tenantId, issuedBy)` — validates DRAFT, allocates sequence, transitions to ISSUED
- `createAndIssueTaxDocument(input, issuedBy)` — convenience wrapper in `prisma.$transaction`
- `supersedeTaxDocument(originalDocumentId, correctionInput, issuedBy)` — creates correction, issues it, marks original SUPERSEDED
- `getTaxDocumentTriggerConfigs(tenantId)` — loads enabled trigger configs for decision service

### Constants / types

Added to `lib/constants/order-financial.ts`:
- `TAX_DOCUMENT_TYPES`, `TaxDocumentType`
- `TAX_DOCUMENT_STATUSES`, `TaxDocumentStatus`
- `TAX_DOCUMENT_TRIGGER_EVENTS`, `TaxDocumentTriggerEvent`
- Three new `RECONCILIATION_CHECK_NAMES`: `RECON_TAX_DOC_SEQUENCE_GAPS`, `RECON_TAX_DOC_IMMUTABILITY`, `RECON_TAX_DOC_VS_ORDER_TOTALS`

Added to `lib/types/order-financial.ts`:
- `TaxDocumentDecision`, `TaxDocumentCreateInput`, `TaxDocumentLineInput`

### Reconciliation checks (order-checks.ts)

- `checkTaxDocSequenceGaps(tenantId, window)` — WARNING: counts gaps in `1..last_sequence` across all doc types / fiscal years
- `checkTaxDocImmutability(tenantId, window)` — BLOCKER: finds ISSUED docs with `updated_at > issued_at` (should never happen; trigger enforces this)
- `checkTaxDocVsOrderTotals(tenantId, window)` — WARNING: doc total vs order total drift check

### i18n keys

Added `taxDocuments` namespace to `en.json` and `ar.json`:
- `status.*` — DRAFT / ISSUED / CANCELLED / SUPERSEDED
- `type.*` — INVOICE / SIMPLIFIED_INVOICE / CREDIT_NOTE / DEBIT_NOTE
- `triggerEvent.*` — all 5 operational events + LEGACY_BACKFILL
- Field labels: documentNo, issuedAt, issuedBy, supersedes, fiscalYear, sequenceNo, totalAmount, taxAmount
- UX labels: notAvailable, configureTitle, configureHint

### Tests

`__tests__/services/tax-document-decision.service.test.ts` — **33 tests, all passing**

Coverage:
- Decision matrix: 5 triggers × eligible/ineligible statuses
- Disabled config → shouldIssue=false
- No config → shouldIssue=false
- hasTaxLines=false → shouldIssue=false
- documentType propagated from config
- Reason field contains trigger name
- `decideCorrectionDocumentType`: positive/negative/zero delta
- `formatTaxDocumentNo`: all 4 types, padding, boundary values

---

## Validation gates

| Gate | Result |
|---|---|
| `tsc --noEmit` (Phase 7 files) | ✅ 0 errors |
| `npm run check:i18n` | ✅ parity passed |
| Jest (tax-document tests) | ✅ 33/33 |
| Pre-existing tsc errors | Unrelated to Phase 7 (PieceBaseCard, Pieces.stories, QCPieceCard) |

---

## Key design constraints preserved

1. **Fiscal immutability**: DB trigger is the hard enforcement layer — service-layer checks are defence-in-depth only.
2. **Gap-free sequences**: `SELECT ... FOR UPDATE` inside the same transaction as document creation.
3. **Legacy backfill**: `sequence_number = 0` rows are excluded from the uniqueness constraint, allowing multiple legacy rows per (tenant, type, year).
4. **Pure decision function**: `decideTaxDocumentIssuance` has no DB access — can be unit-tested and reused client-side for UI gating.
5. **Tenant isolation**: Every write path includes `tenant_org_id`; every query filters by it; RLS adds database-level enforcement.
