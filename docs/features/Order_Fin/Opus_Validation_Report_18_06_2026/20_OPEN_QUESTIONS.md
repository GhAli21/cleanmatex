# 20 — Open Questions (need product / architecture / accounting decision)

## Product / scope
1. **Feature flags (F-03):** Wire `overpayment_disposition_v1` / `customer_receipt_allocation_v1` as real kill-switches, or retire them and update ADR-047 to "permission-gated only"? (They are currently dead seed data.)
2. **Tax compliance scope (F-05):** Is GCC e-invoicing / multi-category tax (exempt/zero-rated/out-of-scope) in the **launch** scope? If yes, F-05 becomes a Phase-1 blocker; if no, it can be accepted/deferred with a documented risk.
3. **Credit-note disposition at checkout:** `VOID_OR_REFUND_EXCESS` and `RESTORE_STORED_VALUE` are catalog codes the validator currently rejects at submit (`NOT_ALLOWED`). Intended permanent scope, or to be wired? (Card/gateway over-capture refund path.)

## Accounting / finance
4. **B2B statement audit model (F-04):** Is the BVM voucher line an acceptable canonical audit for statement payments, or is a dedicated `org_b2b_statement_payments_dtl` required for AR/B2B symmetry and granular reversal?
5. **Collect-payment idempotency (F-10):** Should a per-collection-event idempotency key be **required** (client-generated), matching submit-order? Confirm the accounting intent for repeated partial collections by the same cashier.
6. **Refund-create idempotency:** Should refund creation be idempotent (dedupe duplicate refund requests), beyond the existing over-refund cap? (Not verified.)
7. **Multi-currency:** base-currency mirrors are persisted; is there a defined revaluation / FX-gain-loss policy for AR aging across currencies, or is point-in-time `currency_ex_rate` sufficient for launch?

## Security / ops
8. **`org_tax_doc_seq_counters` RLS (F-01):** Confirm the server connection role for the sequence service so the new RLS policies (tenant_isolation + service_role) don't block legitimate server writes.
9. **Reconciliation reporting:** The plan backlog lists an "unallocated excess > 0" report and statement reconciliation — are these launch-required or post-launch?

## Testing / release
10. **DB-level test harness (F-T5):** Approve standing up a real test DB (migrations applied) for the finance suite? This is the highest-leverage reliability investment (it would have caught the wallet blocker).
11. **Re-validation:** After Phase-1 fixes, run a focused re-validation (RLS live, B2B idempotency replay, the still-❓ areas in [22](./22_FOLLOWUP_DEEP_DIVE.md): reverse/void, cash-drawer close, promotions/loyalty, gateway callbacks, allocation drawers, mobile/offline)?

## Still-unverified areas requiring a decision on depth
12. Do you want a **third pass** to close the remaining ❓ ([22 §Still not verified](./22_FOLLOWUP_DEEP_DIVE.md): refund-create idempotency, AR reverse accounting, `voucher-reversal.service`, cash-drawer Z-report, promotion/loyalty engines, gateway capture/callback, allocation drawer UX, mobile/offline POS)? These are not assumed-good — they are simply not yet inspected.
