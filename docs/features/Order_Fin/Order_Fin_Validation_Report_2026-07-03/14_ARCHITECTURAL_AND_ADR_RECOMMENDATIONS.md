# 14 — Architectural and ADR Recommendations

## Architecture verdict

The layered design is right and should not change: thin routes → domain services → single-writer snapshot recalc → fact tables + voucher spine, with idempotency at both service and DB level, and previews sharing the posting calculation. The remaining architectural debt is **unfinished migration**, not wrong design.

## ADRs to CREATE

| Proposed | Decision to capture | Trigger |
|---|---|---|
| **ADR — Order Cancellation Financial Disposition** | Cancelling a paid order requires an explicit disposition (refund / store credit / keep-on-account w/ approval); unwind is settlement-owned (`unwindOrderFinancialsTx`); credit apps get REVERSED; snapshot recalc mandatory; no silent `console.warn` on money paths. | FN-02 |
| **ADR — Single Payment Read Model** | All payment displays/reports/exports read `org_order_payments_dtl` + voucher trx lines (+ AR/B2B ledgers); `org_payments_dtl_tr` is read-only history with a stated cutoff; defines how historical rows are presented. Completes ADR-002. | FN-01 |
| **ADR — Report/Print Endpoint Access Contract** | Every endpoint that returns money data uses `requirePermission` + centralized tenant context; print/report endpoints inherit the strictest permission of the data they expose. | FN-04 |
| **ADR — Tenant Locale & Money Formatting for Documents** | One formatter (`lib/money/format-money`) + tenant-derived locale/region for all customer-facing documents; region literals banned. | FN-11 |

## ADRs to UPDATE / AMEND

| ADR | Amendment |
|---|---|
| `ADR-002-Deprecate-org-payments-dtl-tr.md` | Add the migration end-state: which flows still write it today (invoice/customer payments), the cutoff plan, and the read-only enforcement date. Right now the ADR reads as done while code contradicts it. |
| `ADR-052-E-Invoicing-Launch-Scope.md` | Add FN-03 closure (fiscal-total comparand now readable) and re-affirm the decomposition gate for e-invoice go-live. |
| `ADR-047` (overpayment disposition) / `ADR-051` (flags deferred) | No change — re-validated as still-correct decisions this pass. |

## ADR governance (FN-07)

`docs/features/Order_Fin/ADR/` holds two colliding numbering series (two ADR-001s through two ADR-015s; 84 files; several near-duplicate pairs like `ADR-004-BVM-Owns-Operational-Financial-Effects.md` vs `ADR-004-business-voucher-wiring-owns-effects.md`). Recommend:
1. Prefix split (`ADR-BVM-nnn`, `ADR-FIN-nnn`) or one renumbered sequence — pick one, apply once.
2. Merge/supersede the duplicate pairs (keep one, mark the other "Superseded by …").
3. Regenerate `ADR/README.md` as the single index; future ADRs take the next free number from the index.

## Formalizations worth writing down (not new decisions — existing practice that should be citable)

- **Single-writer snapshot rule:** only `recalculateOrderFinancialSnapshotTx` writes the canonical order money columns (already true; make it an ADR so nobody adds a second writer).
- **Idempotency ladder:** client key → route → `withIdempotency(Resource)` → partial unique index — the four-layer pattern now used by refunds/AR/B2B/collect; document as the required pattern for any new money mutation.
- **Preview = posting calculation:** previews must call the same service as submit (`calculateOrderTotals`) — already true, oracle-adjacent, worth pinning.

## Explicitly rejected directions (so they don't resurface)

- General-ledger/journal layer now — disproportionate to current business need; revisit only with an ERP-integration program.
- Reintroducing feature-flag kill-switches for overpayment/allocation — ADR-051 stands.
- Widening leg method schema to gateway provider codes — settled 2026-06-25: providers are metadata, method = `PAYMENT_GATEWAY` (`toCanonicalLegMethod`).
