# 16 — Recommended Implementation Plan

Prioritized by risk. Phase 1 = the GA gate. No code is to be written until approved (per the task constraints). All migrations are **created for review, never auto-applied**.

---

## Phase 1 — GA blockers (RLS + allocation idempotency)

**Goal:** close the two HIGH items that gate production.

### 1A — RLS on `org_tax_doc_seq_counters` (F-01)
- **Files:** new `supabase/migrations/0379_tax_doc_seq_counters_rls.sql`.
- **Migration:** additive — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `tenant_isolation` (USING/WITH CHECK `tenant_org_id=current_tenant_id()`) + `service_role` policy. No data change.
- **Tests:** T-6 (cross-tenant select returns 0 under tenant context).
- **Risk:** very low; verify the sequence service still works under RLS (it runs server-side; confirm the connection role can write — add service_role policy so server writes are unaffected).
- **Rollback:** `DISABLE ROW LEVEL SECURITY` + drop policies.
- **Acceptance:** `relrowsecurity=true`, ≥1 policy; numbering still gap-free.

### 1B — B2B statement allocation idempotency (F-02, F-04)
- **AR — NO CHANGE:** AR allocation is **already idempotent** via the central `org_idempotency_keys` cache (`withIdempotency`, `ar-invoice.service.ts:290-343`, verified live). **Do NOT add an AR idempotency index or migration.**
- **Files:** `b2b-statement-payment.service.ts` (+ optional migration `0380_*` for a detail table).
- **Service:** wrap `allocateB2bStatementPaymentTx` in the **existing** `withIdempotency`/`org_idempotency_keys` mechanism (reuse the AR pattern; it already receives an `idempotencyKey` it currently ignores). Optionally add `org_b2b_statement_payments_dtl` for audit symmetry (F-04).
- **Migration:** **optional** — only if adding the B2B detail table (`0380_b2b_statement_payment_detail`); the idempotency fix alone needs no migration.
- **Tests:** T-2 (B2B replay → single application); optional T-3 regression-lock for the AR mechanism; T-4/T-5 (wiring handlers).
- **Risk:** low–medium — reuses a proven mechanism; if adding the detail table, use partial unique `WHERE idempotency_key IS NOT NULL` and preview existing dups first ([12 D-1/D-2](./12_DATA_INTEGRITY_AND_BACKFILL_PREVIEWS.md)).
- **Rollback:** revert service edit; drop detail table/index if added.
- **Acceptance:** replaying a B2B allocation key leaves the statement balance unchanged after first apply; preview D-1/D-2 clean.

### 1C — collect-payment idempotency key not event-unique (F-10)
- **Files:** `collect-payment/route.ts`, `order-settlement.service.ts:604`.
- **Change:** require a client-generated per-event `idempotencyKey` (like submit-order), or default to a uuid/time-bearing key — not the stable `${orderId}_collect_${collectedBy}`.
- **Tests:** sequential-partial-collection (two genuine collections both succeed + sum); explicit-key replay (dedupe).
- **Risk:** low. **Rollback:** revert. **Acceptance:** distinct collections never collide; true replays dedupe.

---

## Phase 2 — Test hardening

**Goal:** make the next drift impossible to ship silently.
- T-1: DB-level integration harness (dedicated test DB + applied migrations) for the finance suite — at minimum a smoke suite that inserts a `SAVE_TO_CUSTOMER_WALLET` disposition against the real FK, and an RLS cross-tenant probe.
- Audit remaining `*constants*`/`*catalog*` tests for the F-T1 uniqueness-only anti-pattern.
- Add T-8 (pending/authorized excluded), T-9 (AR-invoice-wins), T-10 (fallback matrix).
- **Acceptance:** CI fails if a catalog/CHECK/FK/RLS invariant regresses.

---

## Phase 3 — Database / catalog hardening

- F-07: cash CASH_OUT change idempotency index (migration `0381_*`) + T-7.
- F-08/F-09: document naming map; optionally align audit columns when touching the seq table.
- **Acceptance:** all effect tables idempotent; naming map documented.

---

## Phase 4 — Service / API: feature flags + verification

- F-03: decide flags — wire `overpayment_disposition_v1` / `customer_receipt_allocation_v1` into routes + UI (consume via HQ feature-flag API per integration contract), **or** retire seeds + update ADR-047.
- Verify ❓ routes: AR allocation + allocation preview routes (permission + CSRF + validation). *(collect-payment already verified: permission `orders:collect_payment` + CSRF + Zod ✅, F-10 noted.)*
- Verify reverse/void accounting (`voucher-reversal.service`, AR reverse-allocation). *(Refund creation is structurally sound — over-refund cap + voucher links + recalc; create-idempotency still to confirm.)*
- **Acceptance:** every finance route has permission (+ flag if retained); refund flows reconcile.

---

## Phase 5 — Frontend / UX verification

- UX-03: review collect-payment modal, allocation drawers (preview-before-post, submit-disabled-until-resolved), order detail financial view, balance widgets.
- Run `npm run check:i18n`; fix AR parity gaps.
- Mobile/RTL pass on allocation drawers.
- **Acceptance:** no UI path exposes a failing backend; EN/AR parity green.

---

## Phase 6 — Reports / reconciliation

- Implement the pending "unallocated excess > 0" reconciliation report (plan backlog).
- Statement-payment reconciliation against the new detail table (Phase 1B).
- **Acceptance:** ops can reconcile cash drawer, AR, B2B, and overpayment dispositions from reports.

---

## Phase 7 — Tax compliance / e-invoicing (scope decision)

- F-05: tax-category decomposition (exempt/zero-rated/out-of-scope), fiscal-total on `org_tax_documents_mst`, tax-doc↔order reconciliation; GCC e-invoicing format if required.
- **Acceptance:** multi-category tax orders produce correct buckets; tax document totals reconcile.

---

## Migrations needed (summary)

| Migration | Purpose | Type | Approval | Rollback |
|---|---|---|---|---|
| `0379_tax_doc_seq_counters_rls` | F-01 RLS enable + policies | additive | required | disable RLS + drop policies |
| `0380_b2b_statement_payment_detail` | **F-04 only** — optional B2B detail table + idempotency unique. **F-02 idempotency fix needs no migration** (reuse `org_idempotency_keys`). **No AR migration.** | additive | required (preview dups first) | drop table/index |
| `0381_cash_out_change_idempotency` | F-07 change-row uniqueness | additive | required | drop index |
| (Phase 7) tax decomposition | F-05 fiscal totals / tax doc lines | additive | required | per-migration |

> **No AR idempotency migration** — AR allocation is already idempotent via `org_idempotency_keys`. F-10 (collect-payment key) is a code change, no migration.

## Tests to add (summary → [11](./11_TEST_COVERAGE_FINDINGS.md) / [19](./19_TESTS_TO_ADD_OR_REWRITE.md))

T-1 DB harness · **T-2 B2B idempotency** · T-3 *(optional)* AR regression-lock (AR already idempotent) · **F-10 collect-payment idempotency** · T-4/T-5 wiring handlers · T-6 RLS isolation · T-7 cash change idempotency · T-8 pending-excluded · T-9 AR-wins · T-10 fallback matrix · T-11 tax decomposition (Phase 7).
