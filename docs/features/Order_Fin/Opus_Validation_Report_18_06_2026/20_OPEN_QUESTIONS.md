# 20 — Open Questions → ✅ DECIDED

**All questions below are now DECIDED.** Binding decisions in [23_DECISIONS_ADDENDUM.md](./23_DECISIONS_ADDENDUM.md). This file is retained for traceability.

## Product / scope
1. **Feature flags (F-03):** ✅ **DECIDED (D-01)** — deferred for V1; features always enabled; RBAC + business validation control access. F-03 removed from GA gate.
2. **Tax compliance scope (F-05):** ✅ **DECIDED (D-02)** — e-invoicing foundation **in launch scope**; F-05 is a GA gate. Country adapters are per-jurisdiction, GA-blocking only for launch jurisdictions.
3. **Credit-note / VOID_OR_REFUND_EXCESS / RESTORE_STORED_VALUE at checkout:** ✅ **DECIDED (D-03)** — stay deferred; validator keeps rejecting; not in UI.

## Accounting / finance
4. **B2B statement audit model (F-04):** ✅ **DECIDED (D-04)** — dedicated `org_b2b_statement_payments_dtl` detail table.
5. **Collect-payment idempotency (F-10):** ✅ **DECIDED (D-05)** — per-event key required; UI generates a stable per-attempt key; server UUID fallback (non-breaking).
6. **Refund-create idempotency:** ✅ **DECIDED (D-06)** — required before GA; third-pass item (D-12).
7. **Multi-currency / FX:** ✅ **DECIDED (D-07)** — point-in-time snapshot sufficient for launch; revaluation deferred.

## Security / ops
8. **`org_tax_doc_seq_counters` RLS (F-01):** ✅ **DECIDED (D-08)** — tenant isolation + service_role policy.
9. **Reconciliation reporting:** ✅ **DECIDED (D-09)** — minimum reports launch-required (unallocated excess, B2B statement, overpayment disposition, cash drawer).

## Testing / release
10. **DB-level test harness (F-T5):** ✅ **DECIDED (D-10)** — approved + required; own phase.
11. **Re-validation:** ✅ **DECIDED (D-11)** — focused re-validation required after Phase 1.
12. **Third pass for remaining ❓:** ✅ **DECIDED (D-12)** — required before GA (refund-create idempotency, AR reverse/void, `voucher-reversal.service`, cash-drawer close/Z-report, promotion/loyalty engines, gateway capture/callback, allocation drawer UX, mobile/offline POS).

## New open implementation decisions (surfaced during decision-application)
- **E-invoice tenant-flag placement** (dedicated columns vs existing `org_tenants_mst.feature_flags` jsonb vs HQ-managed setting) — to decide before the e-invoicing phase. Cross-project. See [23 §Open implementation decisions](./23_DECISIONS_ADDENDUM.md).
