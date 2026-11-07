# ADR-062: One Document-Type Registry for Every Transaction

**Status:** Accepted (owner-approved 2026-11-07) · **Date:** 2026-11-07
**Plan:** [TAX_ENGINE_PLAN.md §3](../TAX_ENGINE_PLAN.md) · **Related:** [ADR-061](ADR-061-Tax-Engine.md)

## Context

Tax rules, reports and postings must know what kind of document a line belongs to (sale, return, purchase, payout …). Transaction tables do not carry a common type today. `sys_doc_seq_type_cd` already lists every numbered document type, and `org_fin_journal_mst` already references documents with `source_doc_type_code` / `source_doc_id` / `source_doc_no`.

## Decisions

1. **Reuse `sys_doc_seq_type_cd` as the only registry.** No new `sys_doc_type_cd`. Add `tax_flow_code` (`OUTPUT` / `INPUT` / `WITHHOLDING` / `NONE`) and `is_tax_relevant`, seeded for every row.
2. **Every transaction header carries `doc_type_code TEXT NOT NULL`** with an FK to the registry.
   - Single-type tables: DEFAULT plus a CHECK on their one value.
   - Multi-type tables (`org_fin_vouchers_mst`, `org_tax_documents_mst`, `org_invoice_mst`): set by a trigger from the existing subtype column, with a consistency CHECK.
3. **Tables that point to any document use the journal's names:** `source_doc_type_code`, `source_doc_id`, `source_doc_no`, plus `source_doc_line_id` where a line is meant.
4. **No copied `doc_id` / `doc_no` columns on headers:** `id` and the registry's `target_column` already identify them.
5. `web-admin/lib/constants/doc-types.ts` mirrors the codes used in code (DB-mirror rule).

## Consequences

- Tax rules can be configured per document type, and reports can group by tax flow.
- Writers that insert headers must set `doc_type_code`, or rely on the DEFAULT or trigger.
- HQ platform billing (`sys_bill_invoices_mst`) is out of scope.
