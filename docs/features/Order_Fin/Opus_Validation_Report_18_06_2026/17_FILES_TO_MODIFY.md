# 17 — Exact Files Likely to Modify

Grouped by finding. Paths relative to repo root. (No edits made — this is the change map.)

## F-01 — RLS on tax-doc sequence counters
- `supabase/migrations/0379_tax_doc_seq_counters_rls.sql` *(new)* — enable RLS + tenant_isolation + service_role policies.
- `web-admin/__tests__/tenant-isolation/tax-doc-seq-counters-rls.test.ts` *(new)* — cross-tenant probe.

## F-02 / F-04 — B2B statement allocation idempotency + detail/audit
- `web-admin/lib/services/b2b-statement-payment.service.ts` — wrap in `withIdempotency` (reuse the AR pattern via `org_idempotency_keys`) **or** write a detail row; consume the `idempotencyKey` it already receives.
- `web-admin/lib/services/wiring/statement-payment-wiring.handler.ts` — pass/verify the key.
- `supabase/migrations/0380_b2b_statement_payment_detail.sql` *(new, optional)* — `org_b2b_statement_payments_dtl` + idempotency unique index.
- `web-admin/__tests__/services/b2b-statement-payment.idempotency.test.ts` *(new)*.

## F-03 — Feature flag gating (decision-dependent)
- If wiring: `app/api/v1/customer-receipts/allocation/*/route.ts`, `app/api/v1/orders/[id]/collect-payment/route.ts`, `app/api/v1/orders/submit-order/route.ts` (flag check), `web-admin/src/features/orders/ui/payment-modal/**` (UI gate via HQ flag consumer).
- If retiring: `docs/features/Order_Fin/ADR/ADR-047-Overpayment-Disposition.md` (drop the flag claim) + optionally a migration to deactivate the seed rows.

## F-05 — Tax-base decomposition (multi-phase)
- `web-admin/lib/services/order-financial-write.service.ts` (685-688, 815-824 — populate buckets + read fiscal total).
- Tax engine (pricing/calculation service), `tax-document-write.service.ts`.
- `supabase/migrations/0382_tax_doc_fiscal_total.sql` *(new)* — fiscal total column / tax-doc line categories.
- UI tax breakdown component.

## F-06 — Docs
- `docs/features/Order_Fin/ADR/ADR-047-Overpayment-Disposition.md` (status Accepted + vocabulary + 0378 note + flag correction).
- `docs/features/Order_Fin/technical_docs/tech_settlement_catalogs.md` (0378 FK + naming map F-08 + the two idempotency mechanisms).

## F-07 — Cash-out change idempotency
- `web-admin/lib/services/wiring/cash-drawer-wiring.handler.ts` (deterministic change-row key/link).
- `supabase/migrations/0381_cash_out_change_idempotency.sql` *(new)*.

## F-10 — collect-payment idempotency key
- `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts` (require key / generate per-event).
- `web-admin/lib/services/order-settlement.service.ts` (604 default; key derivation).

## F-T5 / tests
- `web-admin/jest.config.js` + a new `__tests__/db-integration/**` harness (real test DB).
- New handler/idempotency tests (see [19](./19_TESTS_TO_ADD_OR_REWRITE.md)).

## Cosmetic
- `web-admin/lib/services/order-submit-orchestrator.service.ts:564` (stale "tx1" comment).
