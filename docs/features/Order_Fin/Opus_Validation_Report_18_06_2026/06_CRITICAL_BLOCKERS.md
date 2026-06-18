# 06 — Critical Blockers

## Open release blockers: **0**

No discovered defect currently forces "must not release" on its own. The one prior critical blocker is resolved and verified.

---

## Resolved this session

### B-01 (was 🔴 Critical) — `SAVE_TO_CUSTOMER_WALLET` disposition rolled back every wallet checkout — ✅ FIXED + VERIFIED

| Field | Detail |
|---|---|
| **Current behavior (now)** | Wallet disposition posts cleanly; FK-validated against the catalog. |
| **Prior behavior** | Disposition service inserted `resolution_code='SAVE_TO_CUSTOMER_WALLET'` into `org_fin_overpay_disp_dtl`; the audit CHECK `org_fin_overpay_disp_res_chk` listed only 8 codes (not wallet) → CHECK violation → entire submit/collect transaction rolled back. |
| **Expected** | Catalog-valid codes accepted; drift structurally impossible. |
| **Business impact (prior)** | Any cashier routing over-tender to a customer wallet got a generic failure; order could not be completed via that path. |
| **Root cause** | `0354` hardcoded CHECK; `0368` added the catalog row but never altered the CHECK; `0360`'s CHECK re-create runs only in a gated legacy-rename branch that is skipped. |
| **Evidence** | `0354:43-53`, `0360:30-62`, `0368`, `overpayment-disposition.service.ts:120-184`; the guard test was a no-op (`settlement-catalog.test.ts` old). |
| **Fix applied** | `0378_overpay_disp_resolution_fk.sql` — dropped the CHECK, added FK `org_fin_overpay_disp_res_fk → sys_fin_overpay_res_cd(resolution_code)` `ON UPDATE/DELETE RESTRICT`. |
| **Verification (live)** | `org_fin_overpay_disp_res_fk` present, `convalidated=true`; `org_fin_overpay_disp_res_chk` count 0; `SAVE_TO_CUSTOMER_WALLET` in catalog; 0 orphan rows. |
| **Tests** | `overpayment-disposition.wallet.test.ts` (wallet credit, audit row, idempotency, no-customer reject, `overpaid→0`); `settlement-catalog.test.ts` rewritten to real parity. |

---

## Items to resolve before GA (HIGH — not hard blockers, but release-gating)

These are detailed in [05](./05_GAPS_AND_BUGS.md); GA gate finalized in [23 — Decisions Addendum](./23_DECISIONS_ADDENDUM.md):

| ID | Phase | Why it gates GA | Smallest safe fix |
|----|-------|-----------------|-------------------|
| **F-01** RLS on `org_tax_doc_seq_counters` | 1A (this batch) | Multi-tenant isolation on a fiscal-numbering table; violates project rule | 1 additive migration (enable RLS + 2 policies) |
| **F-02** B2B statement allocation idempotency *(AR already guarded via `org_idempotency_keys`)* | 1B (this batch) | Retry can double-reduce a **B2B statement** balance | reuse `withIdempotency` in `b2b-statement-payment.service` — **service edit; no AR change** |
| **F-04** B2B statement payment detail/audit table | 1B (this batch) | No granular statement-payment audit/reversal | new `org_b2b_statement_payments_dtl` (D-04) |
| **F-10** collect-payment per-event idempotency key | 1C (this batch) | Stable default key collides across distinct collections | per-event key + server UUID fallback (D-05) |
| **F-T5** DB-level finance test harness | own phase (D-10) | CI can't see CHECK/FK/RLS truth — root cause of F-00 | real migration/DB test harness |
| **F-05** e-invoicing foundation + tax decomposition | own phase (D-02) | Launch scope includes e-invoicing | tenant flag + activation + decomposition (multi-step) |
| **D-09** minimum reconciliation reports | own phase | Ops must reconcile at launch | 4 reports (excess, B2B, disposition, drawer) |

**Removed from GA gate by decision (D-01):** **F-03** feature flags — deferred for V1; features always-on; RBAC controls access. Not a blocker.
