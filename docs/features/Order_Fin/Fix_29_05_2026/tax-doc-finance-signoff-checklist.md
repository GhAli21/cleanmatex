# Tax Document System — Finance Sign-Off Checklist

**To be completed by:** Finance Lead  
**Before:** production compliance claim (ZATCA / UAE VAT)  
**Reference:** `tax-doc-compliance-query-pack.sql`

---

## Sequence integrity

- [ ] Ran query 1 (gap check) on staging — all gaps = 1, no missing sequence numbers
- [ ] Ran query 2 (duplicate check) on staging — 0 duplicate sequences found
- [ ] Ran immutability test (query 3) — `UPDATE` on an ISSUED row rejected by `trg_tax_doc_immutable`
- [ ] Ran query 4 (type distribution) — only `INVOICE`, `SIMPLIFIED_INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE` appear
- [ ] Ran query 5 (credit note chain) — 0 orphaned credit notes
- [ ] Ran query 6 (counter health) — counters match actual max sequence for every partition

---

## Document chain

- [ ] Credit note issued for a sample order → `supersedes_id` links to the correct cancelled invoice
- [ ] CANCELLED document retains its original sequence number (not reassigned or reused)
- [ ] SUPERSEDED document's replacement credit note has a **new** sequence number
- [ ] DRAFT documents never have a sequence number assigned (sequence_number = 0 or NULL)

---

## Soak period

- [ ] Minimum 2-week soak completed in staging with zero unexpected warnings
- [ ] No `TAX_DOCUMENT_TOTAL_MISMATCH` warnings raised during soak period
- [ ] Reconciliation run on staging shows no new tax-doc issues after Phase 7 migration

---

## Sign-off

- [ ] Finance lead has reviewed at least 3 issued tax documents end-to-end (draft → issued)
- [ ] Finance lead has reviewed at least 1 credit note issuance cycle
- [ ] Finance lead confirms fiscal sequence numbering is gap-free and audit-trail complete

**Sign-off date:** ________________  
**Signed by:** ________________  
**Role:** ________________
