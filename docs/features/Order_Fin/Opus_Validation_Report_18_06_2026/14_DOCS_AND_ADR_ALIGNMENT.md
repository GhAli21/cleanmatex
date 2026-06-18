# 14 — Documentation / ADR Alignment

Classification per doc: Aligned · Outdated · Contradictory · Missing · Misleading · **Code-ahead** (implementation better than doc) · **Doc-ahead** (doc describes unimplemented feature).

| Document | Classification | Detail |
|---|---|---|
| `Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md` | Mostly aligned / slightly optimistic | Marks all 6 phases ✅ complete. True for the happy paths, but it does **not** surface F-01 (RLS), F-02 (B2B-only allocation idempotency), or F-03 (flags unwired). The plan's own "feature flags ⬜ pending (cleanmatexsaas)" line is consistent with F-03. |
| `ADR/ADR-047-Overpayment-Disposition.md` | **Outdated + Contradictory** (F-06) | Status "Proposed — pending Approved_By_Jh"; uses old vocabulary (`RETURN_CHANGE`/`TO_WALLET`/`TO_ADVANCE`/`TO_CREDIT_NOTE`). Code uses catalog vocabulary and is live. Says the feature flag "gates UI panel and server validation" — **not implemented** (F-03). Update to Accepted + new vocabulary + note 0378 FK + correct the flag statement. |
| `ADR/ADR-046-Payment-Method-Overpayment-Policy.md` | Aligned | Payment-method flag policy matches code (`supports_change_return`, `supports_overpayment`). |
| `Order_Financial_Validation_Report_2026-06-18.md` (prior, mine) | Aligned / superseded for the blocker | Correctly found F-00; Phase 1 status section reflects the FK fix. This forensic report supersedes it with the broader findings (F-01…F-09). |
| Settlement catalog tech docs (`technical_docs/tech_settlement_catalogs.md`) | **Missing the FK decision** | Should document 0378 (FK replaces CHECK) and the `org_fin_voucher_*` vs `sys_fin_vch_*` naming map (F-08). |
| BVM wiring docs / ADRs (ADR-001…ADR-006 BVM set) | Aligned (spot-checked) | Voucher master/detail, target types, line roles match `0301`/`0357` + handlers. |
| AR ADRs (ADR-006/020 receivable-only; ADR-021 pay-on-collection) | **Code-ahead / aligned** | Code enforces AR-receivable-only and PAY_ON_COLLECTION≠AR cleanly (write svc split). |
| Tax-document ADRs (ADR-007/028/043) | **Doc-ahead** (partial) | Tax documents table exists (`0341`) but fiscal-total reconciliation + category decomposition are stubbed (F-05). Docs describe more than is computed. |

## Where implementation is BETTER than the docs (call-outs)

- **Idempotency on submit** is far more robust than any doc describes (stake/heal/unstake lifecycle, payload-hash conflict). Worth documenting as a reference pattern.
- **Financial-truth engine** (nature snapshot, lifecycle buckets, warning codes, calculation hash/trace) exceeds the ADR descriptions.
- **FK-over-CHECK catalog binding** (0378) is a stronger pattern than the plan's original "extend the CHECK" recommendation.

## Where docs describe features NOT (fully) implemented

- **Feature-flag gating** (ADR-047) — not implemented (F-03).
- **Tax-category decomposition / e-invoicing fiscal totals** (tax ADRs) — stubbed (F-05).
- **Statement-payment audit symmetry** — implied by AR parity but B2B has no detail table (F-04).

## Recommended doc actions

1. Update ADR-047 → Accepted; fix vocabulary; correct the flag claim; reference 0378.
2. Add 0378 + naming map to `tech_settlement_catalogs.md`.
3. Add a "Known deferred / compliance gaps" note (F-03, F-05) to the implementation plan so they are tracked, not lost.
4. Cross-link this forensic report from the plan's status tracker.
