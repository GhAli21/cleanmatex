# B14 — Tax Document Runtime Integration

## Metadata
Backlog ID: B14 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
Authoritative report sections: §14.3→§41, §50-B14
Required decisions: [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md), [D011](00_Phase_0_Financial_Semantics/D011_Order_Amendment_And_Delta_Rules.md)
Dependencies: none · Blocks: [B12](B12_Order_Amendment_And_Financial_Delta.md) (partial — adjustment docs)
Recommended phase: Seq 11

## Confirmed problem
`tax-document-write.service.ts` (decision/sequence/e-invoice chain) has no production caller: no tax invoices are issued, order lineage stays null, the FN-03 mismatch check is inert, credit/debit notes and submission lifecycle are NOT_FOUND (§41).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| tax-document-write.service.ts | full writer, numbering, e-invoice activation | zero callers |
| order-financial-write.service.ts:924 | lineage taxDocument* fixed null | never populated |
| org_tax_documents_mst | table exists | no rows from order flow |

## Required outcome
Issuance trigger wired per tenant tax-registration config (submit/settle/issue action per decision), lineage stamped on orders, FN-03 live, tax credit/debit notes for refunds/amendments (D011), cancellation/replacement lifecycle, numbering + QR per jurisdiction.

## Scope
Trigger wiring, lineage writes, credit/debit note issuance surface, document lifecycle statuses.
**Frontend surface (rule 7):** tax-document view/print screen (bilingual, QR), issue/cancel/replace actions where policy allows manual issuance, credit/debit-note issuance dialog from refund/amendment flows, document link on order detail and receipts.

## Out of scope
E-invoice authority submission protocol (phased follow-on); GL tax postings (B6); statutory reports (B46-area follow-on).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | YES |
| ERP-Lite GL | POSSIBLE (via B6 events) |
| Snapshot | YES (lineage + FN-03) |
| Reconciliation | YES (TAX_DOCUMENT_TOTAL_MISMATCH live) |
| Customer receipt | YES (fiscal artifact) |
| Audit/outbox | YES |

## Acceptance criteria
Qualifying order produces a numbered tax document with lineage on the order row; refund/amendment produces the correct note type; FN-03 fires on injected mismatch.

## Required tests
integration, database (sequences), reconciliation, regression, i18n (bilingual documents).

## Dependencies and sequencing
After B11 (correct tax splits) recommended; provides adjustment surface to B12.

## Delivery surfaces

Backend services: issuance trigger wiring to tax-document-write.service (decision/sequence chain); lineage stamping on org_orders_mst; credit/debit-note issuance service surface
Database/schema: none new (org_tax_documents_mst + sequences exist); registration config columns per branch
API/endpoints: issue/cancel/replace document endpoints; document fetch for print
Frontend page/screen/dialog/action: tax-document view/print screen (bilingual, QR); document link on order detail + receipts; credit/debit-note issuance dialog invoked from refund (B34) and amendment (B12) flows; manual issue action where policy allows
Reusable components/helpers: report print pattern ({feature}-{name}-rprt.tsx); QR helper
Permissions: issuance/cancel codes via B27
Validation: totals match order snapshot (FN-03 live); registration prerequisites; numbering integrity
i18n/RTL: full bilingual document per GCC requirements; RTL layout
Accessibility: print view structure; document status text
Audit trail: document lifecycle statuses + actor; lineage on order
Observability: TAX_DOCUMENT_TOTAL_MISMATCH recon live; issuance failure alerts
Jobs/workers: resubmission job deferred to e-invoice follow-on
Feature flag: per-tenant tax-document enablement (registration-driven)
Rollout: staging with test registration → verify numbering/lineage/FN-03 → enable per tenant
Rollback: disable tenant flag; issued documents remain immutable

## End-to-end operational flow

1. Qualifying order settles (or operator triggers issue per policy) → numbered tax document created, lineage stamped, QR generated.
2. User opens/prints the document from order detail; refund/amendment triggers the correct note type via its dialog.
3. Mismatch between document total and order total fires FN-03 in recon; cancellation/replacement follows the documented lifecycle with audit.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (issue/cancel disabled with reason), duplicate-click protection (in-flight disable + idempotent replay), processing, success, retry on failure; document lifecycle history visible on the document view.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind tenant flag
Production activation allowed: per tenant after numbering + lineage verification; note types require D011-aligned amendment flow for post-issuance changes
Required backend gates: B11 (correct tax splits) recommended first
Required decision gates: D007 approved (+ D011 for post-issuance credit/debit notes)
Required verification gates: numbering integrity + lineage + FN-03 staging checks passed per tenant

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
