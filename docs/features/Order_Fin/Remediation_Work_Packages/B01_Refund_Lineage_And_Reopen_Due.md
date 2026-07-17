# B01 — Refund Lineage and Reopen-Due

## Metadata
Backlog ID: B1
Severity: CRITICAL
Classification: BLOCKS_PRODUCTION
Status: **IN_IMPLEMENTATION** — D002, D003, D004, D005, D010 APPROVED (Expert) 2026-07-16 (v2 semantics below are binding). **B01 is the named next package under the owner continuation directive recorded 2026-07-17 in [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md).** Migration `0404_b01_refund_lineage_and_context.sql` authored 2026-07-17 — **STOP-AND-WAIT: owner applies it before the service/tests phases continue.** See §1a for the verified actual-DB state corrections discovered at migration authoring.
Authoritative report sections: C1, §8 / §8.1 / §8.2, §13, §21, §34, §50-B1
Required decisions: [D002](00_Phase_0_Financial_Semantics/D002_Refund_Source_Classification.md) · [D003](00_Phase_0_Financial_Semantics/D003_Refund_Reopen_Due_Rules.md) · [D004](00_Phase_0_Financial_Semantics/D004_Refund_Vs_Reversal_Vs_Void.md) · [D005](00_Phase_0_Financial_Semantics/D005_Canonical_Outstanding_Formula.md) · [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md) — [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md) referenced for boundary clarity only (no approval needed unless B1 scope grows into BVM/GL execution)
Dependencies: none (first implementation package); [B27](B27_Financial_Permissions_And_Approvals.md) supplies the order-reopen/rebill permission code — until it ships, the API rejects REFUND_AND_REBILL (see §13)
Blocks: B2 (hard — consumes B1 facts), B9 (hard — classification input), B28 (test)
Recommended phase: Seq 1 (first implementation wave)

---

## 1. Current-state analysis

**Refund stages (implemented, controls only):** `initiateRefund` → `approveRefund` → `processRefund` (order-refund.service.ts:142 / :365 / :418). Maker-checker, REF- numbering via `fn_next_fin_doc_no` (:303), caps (overall :203; per-payment :231–248; per-credit-app :251–295), FOR UPDATE process lock (:430), `uq_refund_idempotency`.

**Existing database columns (org_order_refunds_dtl, mig 0340):** `refund_source_type` (never written), `reopens_due_amount` (never written, default 0), `original_payment_id` (written when provided), `refund_method_code`, `refund_status`, `idempotency_key`, `metadata` (JSON — currently holds `refund_scope`, `original_payment_id`, `original_credit_app_id`, requested/approved/processed_by).

**Heuristic classification (snapshot-side):** `classifyRefunds` (order-financial-write.service.ts:193–248) — column-first when present; else method/metadata heuristic (CASH/ORIGINAL/has-payment-id → real-payment; WALLET/stored-value markers → restore; CREDIT_NOTE markers → credit issue; else `hasUnclassifiedRefundSource` → warning `REFUND_SOURCE_UNCLASSIFIED` → snapshot `RECALCULATION_REQUIRED`).

**Metadata lineage:** `original_credit_app_id` exists **only** in metadata JSON — cap validation for credit-app refunds iterates all rows parsing metadata (:282–287).

**Snapshot behavior:** `outstanding = max(0, total − paid − credits + refund_reopens_due + credit_reversal_reopens_due)` (:779–786); with reopen always 0, refunds have no due effect and no explicit rebill/reversal mechanism exists (C1 facts).

**Reconciliation divergence:** recon adds ALL processed refunds (order-checks.ts:200) → permanent OUTSTANDING_TOTAL_MATCH blocker after any refund (C2; fixed by D005/B2, prepared by B1).

**Locks/idempotency:** initiate replay-safe by key (:183–188); process serialized FOR UPDATE; CN destination keyed `refund-${refundId}-cn`; wallet destination relies on the row lock (no own key).

**Destinations:** WALLET → `topUpWalletTx` executes; CREDIT_NOTE → `issueCreditNoteTx` executes; CASH / ORIGINAL_METHOD → **record-only** (no drawer OUT, no gateway call — stays record-only in B1; execution parity is B9).

## 1a. Actual-DB corrections (verified at migration authoring, 2026-07-17)

Live-schema discovery (read-only) plus owner confirmation corrected the §1/§9 premises; the approved v2 **semantics are unchanged**, and the enforcement mechanism got **simpler and stronger**:

1. **`org_order_refunds_dtl` is EMPTY** — 0 rows verified locally (read-only query) and owner-confirmed empty in the deployed database (2026-07-17). No refund was ever successfully created (consistent with defect 4 below). **There are no legacy rows anywhere**, so every legacy-tolerance clause in this file is vacuous: no cutover timestamp, no conditional CHECK arms, no NULL-row heuristic population. The 0404 constraints are **unconditional**; §9.2's cutover-conditional pattern was superseded at authoring (kept below as the documented mechanism for the assumed-legacy case). §10's heuristic-removal criteria and §14 scenario 17 remain as pure-function safety-net coverage of `classifyRefunds`' NULL branch only (synthetic input — no real row can be NULL).
2. Schema facts: migration 0340 had already made `refund_source_type` NOT NULL with the old 7-value CHECK (replaced by the v2 registry CHECK in 0404); Prisma applies a client-side default `MANUAL_EXCEPTION` on insert (the service never writes the column) — that default is removed in the B01 service phase so a missing classification fails loudly. `refund_context` is added **NOT NULL** (possible because the table is empty).
3. **`chk_reopens_due_lte_refund` already exists** (0340) — ensured idempotently in 0404, not re-added. **`original_payment_id` FK was single-column** — replaced by tenant-composite `fk_refund_orig_payment_tenant` per §9.3; unique `(tenant_org_id, id)` indexes added on both lineage target tables.
4. **Defect found and fixed in 0404:** the `refund_status` CHECK (0271) never allowed `PENDING_APPROVAL`, which the maker-checker write path inserts by default — approval-required initiation failed on a real DB (masked in jest by mocked Prisma; also explains why the table stayed empty). CHECK widened; §14 initiate→approve→process scenarios depend on it.

## 2. Approved-decision dependencies

**D002, D003, D004, D005, D010 are APPROVED (Expert), 2026-07-16 — v2 semantics** — the sections below are binding policy. Two approved rules flow into scope: (a) D002 v2 requires a **reason_context** input on every refund (STANDARD | PRICE_ADJUSTMENT_GOODWILL | CANCELLATION_UNWIND | REFUND_AND_REBILL | MANUAL_EXCEPTION); the API gains the field in B1 and the B34 UI surfaces it as a required selector; (b) D003 v2 means a normal commercial refund **never** reopens due — a positive `reopens_due_amount` exists only on explicit REFUND_AND_REBILL (permissioned + mandatory reason) or MANUAL_EXCEPTION rows.

## 3. Refund fact vocabulary (per D002 v2 — five facets)

Five independent facts, never conflated and never inferred from one another:

```text
transaction_type   = REFUND (all rows in org_order_refunds_dtl; reversal/void are B10, per D004)
source_type        = origin of the returned value (refund_source_type — origin-only registry)
destination_type   = where the customer receives value (refund_method_code today:
                     CASH | ORIGINAL_METHOD | WALLET | CREDIT_NOTE | CUSTOMER_CREDIT)
execution_method   = physical mechanism (drawer payout / gateway API / wallet ledger credit /
                     CN document / customer-credit ledger / RECORD_ONLY — artifacts land with B9)
reason_context     = STANDARD | PRICE_ADJUSTMENT_GOODWILL | CANCELLATION_UNWIND |
                     REFUND_AND_REBILL | MANUAL_EXCEPTION (drives D003 v2 reopen)
```

Origin-only source mapping (D002 v2):

| Original settlement leg (origin) | `refund_source_type` | Mandatory lineage |
|---|---|---|
| Cash payment | REAL_PAYMENT_REFUND | original_payment_id |
| Card payment | REAL_PAYMENT_REFUND | original_payment_id |
| Check payment | REAL_PAYMENT_REFUND | original_payment_id |
| Bank-transfer payment | REAL_PAYMENT_REFUND | original_payment_id |
| Gift-card application | GIFT_CARD_RESTORE | original_credit_app_id (credit_type = GIFT_CARD) |
| Wallet application | WALLET_RESTORE | original_credit_app_id (WALLET) |
| Customer-advance application | CUSTOMER_ADVANCE_RESTORE | original_credit_app_id (CUSTOMER_ADVANCE) |
| Customer-credit application | CUSTOMER_CREDIT_RESTORE | original_credit_app_id (CUSTOMER_CREDIT) |
| Loyalty application | CUSTOMER_CREDIT_RESTORE | original_credit_app_id (LOYALTY_CREDIT) |
| No prior settlement leg (goodwill/price concession) | GOODWILL_CONCESSION | none; reason mandatory |
| Unattributable, operator exception | MANUAL_EXCEPTION | none (lineage forbidden — existing rule); reason mandatory |

**Registry alignment (D002 v2):** `CUSTOMER_CREDIT_ISSUE` / `CREDIT_NOTE_ISSUE` are retired as **source** values (they name destinations). `REFUND_SOURCE_TYPES` constants are updated to the origin-only registry in the same B1 change (DB-mirror rule); the column has never been written, so no data conversion exists. Issuing a CN / customer credit remains a `destination_type` available to any source.

## 4. `refund_source_type`

- **Who determines:** the refund service only (`initiateRefund`), derived from lineage per the table above. UI/API supply lineage + reason_context, never the classification.
- **When written:** at initiation, on the INSERT. Re-validated in `processRefund` before any destination executes.
- **Mutability:** immutable once written; hard-immutable at `PROCESSED` (D002 invariant 3). Corrections before processing = cancel + new refund row.
- **Allowed values:** exactly the D002 v2 origin-only registry. No new values without a superseding D002.
- **Validation against lineage:** STANDARD scope requires exactly one lineage (payment XOR credit app) matching the declared source; mismatch → explicit 4xx error (`REFUND_SOURCE_LINEAGE_MISMATCH`), no defaulting.
- **Legacy rows:** pre-B1 rows stay NULL; heuristic remains for them only; `REFUND_SOURCE_UNCLASSIFIED` warning retained; excluded from strict validation paths. New rows with NULL are a defect (service + persistence-boundary + conditional DB constraint, §9).
- **Manual exception:** operator-explicit, lineage-free, mandatory note (existing rules :167–176 kept); always flagged in snapshot as today.

## 5. `reopens_due_amount` (per D003 v2 — expert model)

| Scenario | Reopen value |
|---|---|
| Commercial refund of a real payment (reason_context STANDARD or PRICE_ADJUSTMENT_GOODWILL), **any destination** | **0** — value returned, sale commercially reduced/returned; the customer is never silently made to owe again |
| Refund-and-rebill (reason_context = REFUND_AND_REBILL) | = refund_amount — explicit permissioned transaction (§13), mandatory reason, its own auditable fact |
| Gift-card / wallet / advance / customer-credit restoration | 0 on the refund row — outstanding moves **only** via the paired credit-application reversal (credits term); never both (invariant 4) |
| Goodwill concession (GOODWILL_CONCESSION) | 0 — nothing collectible |
| Refund after order CANCELLED (reason_context = CANCELLATION_UNWIND) | 0 — sale is dead |
| Payment reversal / void / bounced / rejected / chargeback | out of B1 scope (B10/B26); per D004 + D003 v2 they reopen automatically via payment-status change (leg leaves the COMPLETED set in the D005 formula), never via refund rows |
| Refund to wallet/CN as **destination** of a real-payment source | per the **reason_context** rule above (destination irrelevant to reopen) |
| Partial refund | each row carries its own value under the same rules |
| Repeated refunds | accumulate row-by-row; Σ capped by invariants below |
| Refund after amendment | cap base = post-amendment total (D011); rule unchanged |
| Manual exception | operator-entered (default 0), mandatory reason |

**Guards:** `0 ≤ reopens_due_amount ≤ refund_amount` per row; recomputed outstanding never exceeds order total (D003 invariants 1–2); a positive value requires reason_context ∈ {REFUND_AND_REBILL, MANUAL_EXCEPTION} (D003 invariant 7). Written once in `processRefund`; immutable afterwards.

## 6. Lineage (dedicated columns, per D010 invariant 6)

| Reference | Treatment in B1 |
|---|---|
| `original_payment_id` | existing column — becomes mandatory for REAL_PAYMENT_REFUND; tenant-composite FK pattern verified at migration authoring (align with §9 if single-column today) |
| `original_credit_app_id` | **promoted from metadata to a dedicated column** (§9) — mandatory for all `*_RESTORE` sources; tenant-safe composite FK |
| Original voucher (`fin_voucher_id` / line) | recorded when resolvable from the original fact row (payments/credit apps already carry backlinks); read-through, no new join table |
| Original stored-value txn | resolvable via credit app → ledger backlinks; not duplicated on the refund row |
| Original gateway transaction | copied read-only from the payment row for audit display (no gateway call in B1) |
| Related cancellation/amendment | cancel unwind passes reason_context = CANCELLATION_UNWIND (⇒ reopen 0); amendment linkage lands with B12 |
| Source transaction amount + cumulative refunded | derived by the existing cap queries; cumulative validation moves to indexed column lookups once `original_credit_app_id` is a column |

## 7. Snapshot effects (expected after B1)

| Field | Effect |
|---|---|
| `total_paid_amount` / `total_credit_applied_amount` | unchanged by refund rows (payments stay COMPLETED; credit-app status changes remain the cancel/D006 mechanism) |
| `refunded_amount` / `real_payment_refunded_amount` / `stored_value_restored_amount` / `customer_credit_issued_amount` | now driven by explicit classification, heuristic only for legacy rows |
| `net_collected_amount` | correct by construction (classified real-payment refunds reduce it) |
| `outstanding_amount` | unchanged by commercial refunds (stays settled); rises only for explicit REFUND_AND_REBILL / MANUAL_EXCEPTION reopen rows per D003 v2 |
| `pay_on_collection_amount` / `ar_receivable_amount` | follow outstanding via existing payment_type logic (moves only on explicit reopen) |
| `overpaid_amount` | unchanged formula; interacts only through outstanding clamp |
| `payment_status` | commercial refund: order **stays settled** (refund story told by refunded/net-collected fields); explicit rebill/manual reopen reverts PAID → PARTIALLY_PAID/UNPAID via the existing ladder (no ladder change) |
| Warning codes | `REFUND_SOURCE_UNCLASSIFIED` fires **only** for legacy NULL rows; new-row NULL impossible |
| Snapshot status | refund-bearing orders return to CURRENT (no forced RECALCULATION_REQUIRED) when classified |

**C1 closure (reframed per D003 v2):** the dead mechanism is delivered — classification, context, and reopen are written per policy; a normal refund correctly leaves the order settled, and every reopened amount traces to an explicit invalidation (B10/B26 status paths) or explicit operator intent (rebill/manual).

## 8. Reconciliation effects (preparing B2, not doing it)

B1 **writes correct facts**; B2 makes snapshot + reconciliation consume one shared aggregation (D005). Until B2 lands, recon's `+ processedRefunds` term keeps flagging refund-bearing orders — accepted, documented interim state (and under D003 v2 that term is wrong policy, not merely divergent). B1 adds no recon code, but its tests assert the D005 expected values so B2 can flip consumers without re-deriving policy.

## 9. Database strategy (assessment — **no migration is created in this planning task**)

### 9.1 New-row enforcement vs legacy tolerance (the exact mechanism)

| Layer | Rule |
|---|---|
| Service layer (authoritative) | `initiateRefund` derives and writes `refund_source_type` + validates `reason_context` on every INSERT; `processRefund` re-validates both before execution and before writing `reopens_due_amount`. A NULL classification on a new row cannot be produced by the service. |
| Persistence boundary | repository/Zod schemas (aligned to the D002 v2 constants) reject writes lacking a valid `refund_source_type`/`reason_context` for new rows — validation errors surface as explicit 4xx, never silent defaults. |
| Database (backstop) | **conditional CHECK constraints** (below) make invalid new rows impossible while leaving ambiguous legacy rows untouched. |
| Legacy rows | may retain NULL classification permanently; they are **excluded from strict validation paths** (classifyRefunds heuristic fallback + `REFUND_SOURCE_UNCLASSIFIED` warning); never guess-backfilled. |

### 9.2 Forward-compatible conditional constraint (superseded at authoring — see §1a)

> **2026-07-17:** the table was verified empty in all environments, so the authored migration 0404 uses **unconditional** CHECKs (strictly stronger; no cutover). The conditional pattern below is retained as documentation of the mechanism that would have applied had legacy rows existed.

```sql
-- pattern only — actual DDL is authored in the B1 migration, next seq at that moment
ALTER TABLE org_order_refunds_dtl
  ADD CONSTRAINT chk_refund_source_type_v2
  CHECK (created_at < '<cutover-ts fixed at migration authoring>'
         OR refund_source_type IN (<D002 v2 origin-only registry>))
  NOT VALID;
-- then: VALIDATE CONSTRAINT (legacy rows pass vacuously via the created_at arm)
```

Same pattern for `refund_context` (registry: STANDARD | PRICE_ADJUSTMENT_GOODWILL | CANCELLATION_UNWIND | REFUND_AND_REBILL | MANUAL_EXCEPTION) and the unconditional `CHECK (reopens_due_amount BETWEEN 0 AND refund_amount)` (safe unconditionally — legacy rows all hold 0).

*Why conditional-on-created_at over a version column:* deterministic, additive, no new column, the cutover is recorded in the migration header, and `created_at` is service-stamped (not user-editable). The version-aware alternative (`fin_semantics_version` stamp + CHECK on it) was considered and documented; it adds a column without adding safety here. **Constraint freeze rule (D002 v2):** the registry CHECK is only authored together with the constants change that mirrors the origin-only registry — never before.

### 9.3 Columns, keys, and tenant-safe lineage

| Item | Specification |
|---|---|
| `original_credit_app_id` | new nullable column (promotion from metadata JSON) |
| Tenant-safe lineage FK | **composite FK `(tenant_org_id, original_credit_app_id)` REFERENCES `org_order_credit_apps_dtl (tenant_org_id, id)`** — guarantees the referenced credit application belongs to the same tenant; add the required unique index on the target pair if absent (additive) |
| Cap-query index | index on `(tenant_org_id, original_credit_app_id)` for cumulative per-credit-app caps |
| `refund_context` | new nullable TEXT column (reason_context); conditional CHECK per §9.2; legacy NULL = legacy semantics |
| `original_payment_id` FK | verify existing FK shape at migration authoring; if single-column, align to the same tenant-composite pattern (additive) |
| Existing unique | `(tenant_org_id, idempotency_key)` unique retained |
| Backfill | **evidence-preserving copy-only**: `original_credit_app_id` copied from metadata JSON where present (no classification guessing); `refund_source_type`/`refund_context` are NOT backfilled |
| Uncertain legacy rows | must remain unclassified — explicitly forbidden to guess |
| Migration character | **additive and reversible only** (new columns, NOT VALID→VALIDATE checks, indexes); TEXT not VARCHAR; next seq per `supabase/migrations/` at implementation time; created only under an explicit B01 implementation instruction, then **STOP for owner to apply** |

## 10. Compatibility strategy

- **New rows:** full classification + reason_context + lineage + reopen from day one; violations rejected at API boundary.
- **Legacy rows:** heuristic fallback in `classifyRefunds` retained, scoped to `refund_source_type IS NULL`; warning behavior unchanged; excluded from strict validation paths.
- **Heuristic removal criteria:** zero NULL-classified ACTIVE refund rows created after cutover for one full close cycle **and** legacy rows either backfilled by evidence or accepted as permanently warned; removal is its own small change with its own test.
- **Rollout order:** docs/decisions → migration (additive) → service write path → snapshot column-first already exists → tests → enable.

## 11. Transactions and locking

- Classification at initiate inside the existing initiate transaction; reopen computation at process inside the existing FOR UPDATE-locked transaction.
- Original-source rows are **read-validated** under the same tx; caps re-checked at process (existing) with the new column-based cumulative query; no new lock on original payment rows (caps + refund-row lock serialize sufficiently — same guarantee as today, now with indexed sums).
- Concurrent partial refunds on one order serialize on the refund row locks + cap re-validation; the loser exceeds remaining cap and fails cleanly.
- Rollback: everything in-tx; destination executions (wallet/CN) already tx-composed and keyed — replay-safe on retry.

## 12. Idempotency (per D010)

| Key | Rule |
|---|---|
| Route key | client-supplied, **required** on refund initiate API (currently optional — tightened by B1) |
| Refund key | existing `uq_refund_idempotency` retained; replay returns the existing row |
| Destination keys | CN: `refund-${refundId}-cn` (exists); wallet: add `refund-${refundId}-wallet` skip-key to `topUpWalletTx` call |
| Repeated request | same key → same refund row, zero new effects |
| Conflict | same key + different payload → 409-class error (generalized S2 pattern) |

## 13. Permissions and audit

- Request `orders:process_refund` (initiate), approve `orders:approve_refund`, process `orders:process_refund` — unchanged codes.
- **REFUND_AND_REBILL** requires a dedicated order-reopen/rebill permission code owned by [B27](B27_Financial_Permissions_And_Approvals.md) (§43 "order reopen" gap). **Until that code is seeded and wired, the B1 API rejects reason_context = REFUND_AND_REBILL with an explicit error** — the mechanics ship in B1, activation arrives with B27 (+ B34 surfaces the action). Mandatory reason in all cases.
- Manual exception additionally requires the mandatory note (existing) and is a candidate for its own code in B27 (not B1 scope).
- Actor fields: requested_by/approved_by/processed_by (existing, row + metadata) plus classification + context stamped by service — no user-editable classification.
- Durable audit: outbox REFUND_PROCESSED stages already emit; user-visible history still depends on B7 — B1 does not claim durable history (report H6 stands).

## 14. Detailed test matrix

| # | Scenario | Must assert |
|---|---|---|
| 1 | Full cash refund, active order, STANDARD | source=REAL_PAYMENT_REFUND, reopen=0, outstanding stays 0, order stays settled, `refunded_amount` rises, `net_collected_amount` drops |
| 2 | Partial cash refund, STANDARD | reopen=0; caps hold; snapshot per §7 |
| 3 | Repeated partial cash refunds | Σ ≤ original payment; each row classified; every reopen=0 |
| 4 | Card refund (record-only execution) | classification + context written; no false drawer/gateway claims |
| 5 | Wallet restoration (source=wallet app) | WALLET_RESTORE, reopen=0, paired credit reversal moves outstanding exactly once (no duplicate), wallet ledger credited once |
| 6 | Gift-card restoration | GIFT_CARD_RESTORE, reopen=0, pairing honored |
| 7 | Advance restoration | CUSTOMER_ADVANCE_RESTORE, reopen=0, pairing honored |
| 8 | Customer-credit / loyalty application restoration | CUSTOMER_CREDIT_RESTORE, reopen=0, pairing honored |
| 9 | Goodwill concession (CN destination, no lineage) | GOODWILL_CONCESSION, destination CREDIT_NOTE, reopen=0, order stays settled, reason mandatory |
| 10 | Refund-and-rebill | without B27 permission → explicit rejection; with permission + reason → reopen=refund_amount, outstanding reopens, status leaves PAID, auditable fact recorded |
| 11 | Manual exception | lineage forbidden, note required, warning fires, operator reopen honored (bounds enforced) |
| 12 | Concurrent refunds (two processors) | one wins; loser clean error; no double ledger credit |
| 13 | Duplicate retry (same key) | zero new rows/effects; original response |
| 14 | Same key, different payload | conflict error |
| 15 | Over-refund attempt | rejected at cap (overall, per-payment, per-credit-app) |
| 16 | Refund after cancellation | reason_context=CANCELLATION_UNWIND, reopen=0 |
| 17 | Legacy NULL row present | heuristic still classifies; warning; snapshot RECALCULATION_REQUIRED preserved; excluded from strict validation |
| 18 | Snapshot + recon preparation + warnings | §7 totals exact per scenario; D005 expected values asserted (B2 flip-ready); UNCLASSIFIED only for legacy rows |

Categories covered: unit, integration, database (constraints incl. conditional CHECK + composite FK), API, permissions (rebill 403), idempotency, concurrency, reconciliation-preparation, regression (jest suite addition).

## 15. Rollout

1. Decision approvals (D002/D003/D004/D005/D010 — APPROVED (Expert), v2) recorded in Phase 0 index.
2. This file revised to the v2 semantics → status `READY_FOR_IMPLEMENTATION`; **implementation starts only on an explicit owner instruction naming B01**.
3. Migration prepared (additive; **stop-and-wait for owner application per project rule**). ✅ DONE 2026-07-17 — `supabase/migrations/0404_b01_refund_lineage_and_context.sql` (columns incl. `refund_context` NOT NULL + defensive copy-only backfill + composite FKs + **unconditional** v2 CHECKs + status-CHECK defect fix; empty-table premise per §1a, no cutover). **Awaiting owner apply.**
4. Service implementation (initiate classification + context, process reopen per D003 v2, wallet destination key, API required key + reason_context, constants v2 alignment).
5. Test matrix implemented; full jest + build gates green.
6. Compatibility mode verified on staging data (legacy rows unaffected).
7. Data verification: sample refunds across all sources reconcile to §7 expectations.
8. Commit → Preview deployment → QA executes §14 checklist on Preview → owner approval recorded → production promotion (owner release rule) · Rollback = revert service write path; columns/checks are additive and inert.

## 16. Exact completion criteria (VERIFIED gate)

B1 is `VERIFIED` only when **all** hold:
- every new refund row has an explicit valid `refund_source_type` from the D002 v2 origin-only registry and a valid `refund_context`;
- required lineage is stored in dedicated columns (incl. promoted `original_credit_app_id` with tenant-safe composite FK);
- `reopens_due_amount` follows the approved D003 v2 rules in every §14 scenario (positive only for explicit rebill/manual-exception rows);
- partial and repeated refunds remain capped (overall, per-payment, per-credit-app);
- duplicate retries create no duplicate financial effects (route, refund, destination keys);
- snapshot results match §7 approved semantics;
- legacy ambiguity produces explicit warnings (never silent classification);
- no BVM, drawer, gateway, tax, or GL effect is claimed — record-only execution boundaries intact (B9/B10/B13/B14 untouched);
- required tests pass (full matrix + existing regression suite);
- Preview QA executed and owner approval recorded (promotion rule).

## Scope boundaries

**B1 owns:** classification, reason_context, lineage, reopen-due values, validation, compatibility behavior, and tests for those facts.
**B1 does not own:** drawer refund movement / gateway refund API ([B09](B09_Refund_Execution_Parity.md)), refund BVM voucher ([B09](B09_Refund_Execution_Parity.md)), GL refund journal ([B06](B06_ERP_Order_To_Cash_Event_Wiring.md)), aggregation refactor ([B02](B02_Shared_Financial_Aggregation.md)), payment reversal/void service ([B10](B10_Payment_Reversal_And_Void.md)), voucher-reversal unwind ([B13](B13_Voucher_Reversal_Operational_Unwind.md)), tax credit note ([B14](B14_Tax_Document_Runtime_Integration.md)), rebill permission code ([B27](B27_Financial_Permissions_And_Approvals.md)), refund screens ([B34](B34_Refund_Backoffice_UI.md)).

## Delivery surfaces

Backend services: order-refund.service.ts (initiate classification + context validation, process reopen per D003 v2), classifyRefunds column-first path (order-financial-write.service.ts), REFUND_SOURCE_TYPES constants v2 alignment
Database/schema: org_order_refunds_dtl — promote `original_credit_app_id` (tenant-safe composite FK + index), add `refund_context` (TEXT), CHECK on `reopens_due_amount`, conditional CHECKs per §9.2; additive, reversible migration (created only under explicit B01 instruction; stop-and-wait)
API/endpoints: POST /api/v1/orders/[id]/refund and /refunds — `idempotencyKey` becomes required; new required `refundContext` field (STANDARD | PRICE_ADJUSTMENT_GOODWILL | CANCELLATION_UNWIND | REFUND_AND_REBILL | MANUAL_EXCEPTION); REFUND_AND_REBILL rejected until the B27 code exists
Frontend page/screen/dialog/action: no new screen in B1 — order Financial tab refunds table displays classification, context, and reopen amount (read-only enrichment); the initiate/approve/process screens are [B34](B34_Refund_Backoffice_UI.md)
Reusable components/helpers: refund-source mapping helper (credit_type → source type, v2 registry); cumulative-cap query helper on the new column
Permissions: existing `orders:process_refund` / `orders:approve_refund`; rebill code owned by B27 (B1 rejects REFUND_AND_REBILL until then)
Validation: lineage XOR rule; source↔lineage consistency (`REFUND_SOURCE_LINEAGE_MISMATCH`); reason_context registry; positive-reopen-requires-explicit-context; caps (overall, per-payment, per-credit-app); reopen bounds
i18n/RTL: EN/AR labels for source types (v2), context values, and new error codes in orders/refund namespaces
Accessibility: NOT_APPLICABLE beyond existing table semantics (no new interactive UI in B1)
Audit trail: classification/context stamped by service; requested/approved/processed actors as today; outbox stages unchanged; rebill rows carry permission + reason evidence
Observability: warning-code counts (`REFUND_SOURCE_UNCLASSIFIED` should trend to legacy-only); log on lineage-mismatch and rebill-rejection events
Jobs/workers: none
Feature flag: none — additive semantics; legacy heuristic remains for NULL rows
Rollout: §15 order (decisions → migration [stop-and-wait] → service → tests → staging compatibility check → Preview QA → enable)
Rollback: revert service write path; new columns/checks are inert without the writer

## End-to-end operational flow

1. Operator opens the refund dialog (B34; until then, API caller) and picks the source leg → client sends lineage + amount + reason_context + required idempotency key.
2. API validates schema; service validates lineage XOR, source↔lineage match, context registry, caps → creates the refund row with `refund_source_type` + `refund_context` at initiation (PENDING_APPROVAL).
3. Approver approves (maker≠checker) → APPROVED; replay of either call returns the existing row.
4. Processor runs → FOR UPDATE lock, cap re-check, destination execution (wallet/CN keyed), `reopens_due_amount` written per D003 v2 (0 unless explicit rebill/manual), snapshot recalc in the same tx.
5. Order header: commercial refunds leave the order settled with refunded/net-collected updated; explicit rebill reopens outstanding per §7; Financial tab shows classification + context + reopen; recon-preparation assertions match D005 expectations.
6. Failure at any step rolls the tx back; retry with the same key is side-effect-free; legacy NULL rows keep their warning path.

## Safety

UI design allowed: YES (B34 may design against this contract)
UI implementation allowed: YES behind a disabled feature flag (B34)
Production activation allowed: refund UI production activation is gated on **B01 AND B02 VERIFIED** (facts + one aggregation authority); cash/original-method execution additionally on B09 VERIFIED
Required backend gates: B1 service write path itself; B27 for REFUND_AND_REBILL activation and manual-exception review
Required decision gates: D002, D003, D004, D005, D010 APPROVED (Expert) — recorded
Required verification gates: §14 test matrix fully green; staging legacy-row compatibility check passed; Preview QA approval recorded

## Completion evidence
Migration: `0404_b01_refund_lineage_and_context.sql` (authored 2026-07-17; **not yet applied — owner apply pending**) · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
