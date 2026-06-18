# 24 — Implementation Status

**Live log for the post-decision implementation. Updated throughout. Source of decisions:** [23_DECISIONS_ADDENDUM.md](./23_DECISIONS_ADDENDUM.md).

## Current Phase
Tight Phase 1 (per approved scope "Decisions + tight Phase 1"): **1A (F-01 RLS) · 1B (F-02/F-04 B2B) · 1C (F-10 collect-key)**. F-T5, F-05, D-09 reconciliation = own subsequent phases (decided, not this batch).

## Current Status
🟡 In progress — docs/decisions applied; code in progress. **No migrations applied** (created for review).

## Completed Items
- [x] Decisions D-01..D-12 captured → `23_DECISIONS_ADDENDUM.md`
- [x] `20_OPEN_QUESTIONS.md` marked DECIDED
- [x] This status file created

## In Progress Items
- [ ] GA-gate updates across report files (00/06/15/16/18/19/21 + README)
- [ ] ADRs (feature-flags-deferred, e-invoicing-launch-scope) + ADR-047 flag note
- [ ] 1A — migration 0379 RLS + test
- [ ] 1B — migration 0380 B2B detail table + service idempotency + tests
- [ ] 1C — collect-payment per-event key + tests

## Blocked Items
- E-invoicing phase (F-05) — needs tenant-flag-placement decision (see [23 §Open implementation decisions](./23_DECISIONS_ADDENDUM.md)). Not in this batch.

## Migrations Created
_(pending — see below as completed)_
- `0379_tax_doc_seq_counters_rls.sql` — pending
- `0380_b2b_statement_payment_detail.sql` — pending

## Services Changed
- `b2b-statement-payment.service.ts` — pending (idempotency + detail row)
- `order-settlement.service.ts` — pending (collect key)

## APIs Changed
- `collect-payment/route.ts` — pending (per-event key)

## Frontend Changed
- collect-payment UI key generation — pending

## Tests Added
- pending

## Docs Updated
- 23 (new), 24 (new), 20 (decided). GA-gate edits pending.

## Commands Run
- (logged as executed)

## Test Results
- (pending)

## Open Risks
- 1C: making the key *required* would break the existing collect UI → mitigated by **server UUID fallback** (non-breaking) + UI key-gen for retry-dedup.
- F-05 must not be marked complete until tax decomposition is real (engine emits single `taxable_amount` today).
- Tenant-flag placement for e-invoicing is cross-project (cleanmatexsaas owns tenant mgmt).

## Next Steps
1. GA-gate doc edits + ADRs.
2. 1A → 1B → 1C with tests.
3. Run safe local tests/typecheck/lint; record results here.
4. STOP before applying migrations; request focused re-validation (D-11).
