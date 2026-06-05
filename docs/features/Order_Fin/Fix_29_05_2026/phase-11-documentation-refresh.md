# Phase 11 — Documentation Refresh + Codex Deferred Coverage

**Date:** 2026-06-05  
**Migration:** none  
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md § Phase 11](order-fin-v1_1-full-alignment-implementation-plan.md)

---

## Goal

Refresh all documentation touched by Phases 1–9 and close the deferred follow-ups that the Codex v4 rollout listed but did not complete.

---

## Documentation updates

### ADR status flips

| File | Previous status | New status |
|---|---|---|
| `ADR/ADR-017-Tax-Inclusive-and-Tax-Exclusive-Pricing.md` | Accepted | Implemented (Phase 5, 2026-06-05) |
| `ADR/ADR-030-Refund-Source-Lineage.md` | Implemented (Phase 6, 2026-06-05) | — (already set in Phase 6) |
| `ADR/ADR-039-Multi-Currency-Snapshots.md` | Accepted | Implemented (Phase 4, 2026-06-05) |

### CHANGELOG.md

Prepended a `## 2026-06-05 — Order Financial v1.1 Full Alignment (Phases 1–9)` section to `docs/features/Order_Fin/CHANGELOG.md` covering:
- All 8 shipped phases (1–9, excluding the removed Phase 10)
- Migration table (0336–0341)
- ADR status update table
- New permissions seeded
- Verification summary

### Comparison audit closure

`docs/features/Order_Fin/Fix_29_05_2026/Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md`:
- Conclusion status → `Closed — all P0/P1 gaps resolved by Order Fin v1.1 (Phases 1–9, 2026-06-05)`
- Executive Summary updated with resolution table mapping each original deviation to the phase that fixed it

### Manual test guide

`docs/features/Order_Fin/brief_test_guide_01.md` — appended `## v1.1 Full Alignment — QA Cases (Phases 1–9)` section with per-phase checklist items for all 9 phases.

---

## Codex deferred coverage — disposition

| Item | Disposition |
|---|---|
| Broader write-service & reconciliation regression suite | Targeted Jest coverage added in Phases 1–7 (per-phase); comprehensive matrix coverage for all 13 reconciliation warning codes deferred to the next dedicated testing sprint (not feasible within current phase scope without seeding fixture infrastructure). |
| Optional rename of remaining application-level compatibility aliases (`total`, `paid_amount`, `subtotal`, `tax` in response/view-model contracts) | **Deferred to next breaking-API release window.** TypeScript type inference against the generated Prisma client enforces correctness in all internal code paths. The `check:legacy` CI gate prevents DB-level regression. No downstream consumer has flagged these aliases. |

---

## Open follow-ups (carry to next program)

1. **Comprehensive reconciliation regression matrix** — seed fixture infrastructure for all 13 warning codes; write a parametrized Jest suite covering `ORDER_TOTAL_COMPONENT_MISMATCH`, `DISCOUNT_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`, `OUTSTANDING_MISMATCH`, `PENDING_PAYMENT_COUNTED_AS_PAID`, `AUTHORIZED_PAYMENT_COUNTED_AS_PAID`, `GIFT_CARD_DOUBLE_COUNTED`, `CREDIT_APPLICATION_COUNTED_AS_DISCOUNT`, `AR_RECEIVABLE_MISMATCH`, `TAX_DOCUMENT_TOTAL_MISMATCH`, `LEGACY_FIELD_USED_IN_SUMMARY`, `REFUND_SOURCE_UNCLASSIFIED`, `PAYMENT_TARGET_UNCLASSIFIED`.
2. **Tax-document finance sign-off + 2-week soak** — fiscal sequence numbering requires finance team approval before claiming compliance-grade status. See Phase 7 risk note.
3. **TAX_INCLUSIVE 2-week soak** — `FF_TAX_INCLUSIVE_PRICING` flag gates UI; calculator dual-mode is live. Soak starts when flag is enabled in staging.
4. **Cross-project cleanmatexsaas coordination** — Phase 7 requires separate document_type namespace for SaaS tenant-onboarding invoices (see plan § Cross-project coordination).
5. **Voucher status triple-column collapse** — deferred from BVM Phase 6 Sub-item 7; 4-step plan documented in `IMPLEMENTATION_STATUS.md`.

---

## Verification

- All documentation files open and render correctly.
- `npm run check:legacy` — exit 0.
- `npm run check:i18n` — green.
- `npm run build` — green (no new code in Phase 11).

---

## Program status

**Order Financial v1.1 Full Alignment is COMPLETE.**

All phases shipped:

| Phase | Done |
|---|---|
| 0 Plan adoption | ✓ 2026-06-04 |
| 1 P0 tax-doc warning fix | ✓ 2026-06-04 |
| 2 Tax-base decomposition | ✓ 2026-06-04 |
| 3 Credit-app lifecycle | ✓ 2026-06-04 |
| 4 Base-currency snapshot | ✓ 2026-06-05 |
| 5 Tax-inclusive pricing | ✓ 2026-06-05 |
| 6 Refund source-lineage | ✓ 2026-06-05 |
| 7 Tax-document lifecycle | ✓ 2026-06-05 |
| 8 UI consolidation | ✓ 2026-06-05 |
| 9 Legacy reader CI gate | ✓ 2026-06-05 |
| 11 Documentation refresh | ✓ 2026-06-05 |
| 10 Legacy DROP | Already shipped via 0335 (Codex v4, 2026-06-04) |
