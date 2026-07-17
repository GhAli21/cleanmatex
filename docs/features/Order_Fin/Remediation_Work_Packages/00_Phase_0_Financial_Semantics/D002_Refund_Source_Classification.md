# D002 — Refund Source Classification

## Metadata
Decision ID: D002
Status: APPROVED (Expert)
Approval type: Expert
Selected option: Option A (v2 — five-facet vocabulary, origin-only source registry)
Approved decision: Option A (v2) — service-derived classification from lineage at initiation, immutable after processing; the five refund facets (transaction_type, source_type, destination_type, execution_method, reason_context) are recorded independently; `refund_source_type` uses the origin-only registry defined below (credit-note and customer-credit **issuance** are destinations/outcomes, never sources); legacy rows never guess-backfilled; goodwill concession is lineage-free with a mandatory reason
Rationale summary: classification must exist from the first financial fact, be derived only from verifiable lineage, and name the **origin of the value being returned** — never the resulting instrument — so that reopen policy (D003), net-collected, refund reporting, and future GL mapping stay deterministic and auditable
Decision type: Financial-fact classification policy
Authoritative report sections: §8 / §8.1 / §8.2, §34, C1
Blocks: B1, B9
Affects: B2 (aggregation reads classification)
Owner: Expert (see Approval record)
Approval date: 2026-07-16
Supersedes: —

## Problem
The refund vocabulary (`REFUND_SOURCE_TYPES`) exists in code but the refund write path never populates the `refund_source_type` column. The snapshot classifies refunds through a legacy heuristic (method/metadata guesswork), and the concepts **source** (what value is being returned), **destination** (where the value goes), and **execution method** (how it physically moves) are conflated in a single `refund_method_code` field. A refund of a cash payment paid out to a wallet is simultaneously "source = real cash payment", "destination = wallet", "execution = wallet credit" — today only the last is recorded. Additionally, the v1 registry itself mixed origins with outcomes: `CUSTOMER_CREDIT_ISSUE` and `CREDIT_NOTE_ISSUE` name the **instrument the customer receives** (an issuance outcome), not where the returned value came from.

## Refund fact vocabulary (the five facets)

Five independent facts are recorded per refund; none is ever inferred from another:

```text
transaction_type   = REFUND | PAYMENT_REVERSAL | PAYMENT_VOID   (taxonomy owned by D004;
                     every row in org_order_refunds_dtl is transaction_type REFUND)
source_type        = origin of the value being returned          (refund_source_type;
                     origin-only registry below)
destination_type   = where the customer receives the value       (CASH | ORIGINAL_METHOD |
                     WALLET | CREDIT_NOTE | CUSTOMER_CREDIT — today carried by refund_method_code)
execution_method   = the physical mechanism                      (DRAWER_CASH_OUT | GATEWAY_REFUND |
                     WALLET_LEDGER_CREDIT | CREDIT_NOTE_DOCUMENT | CUSTOMER_CREDIT_LEDGER |
                     RECORD_ONLY — execution artifacts land with B9)
reason_context     = why the refund occurs                       (STANDARD | PRICE_ADJUSTMENT_GOODWILL |
                     CANCELLATION_UNWIND | REFUND_AND_REBILL | MANUAL_EXCEPTION — consumed by D003)
```

### Origin-only source registry (v2 — the decision)

| `refund_source_type` | Origin of the returned value | Mandatory lineage |
|---|---|---|
| REAL_PAYMENT_REFUND | a completed real payment leg (cash/card/check/bank) | `original_payment_id` |
| GIFT_CARD_RESTORE | a gift-card credit application | `original_credit_app_id` (credit_type GIFT_CARD) |
| WALLET_RESTORE | a wallet credit application | `original_credit_app_id` (WALLET) |
| CUSTOMER_ADVANCE_RESTORE | a customer-advance credit application | `original_credit_app_id` (CUSTOMER_ADVANCE) |
| CUSTOMER_CREDIT_RESTORE | a customer-credit or loyalty credit application | `original_credit_app_id` (CUSTOMER_CREDIT / LOYALTY_CREDIT) |
| GOODWILL_CONCESSION | no prior settlement leg — price concession/goodwill | none; reason mandatory |
| MANUAL_EXCEPTION | unattributable; operator-attested | none (lineage forbidden); reason mandatory |

**Correction recorded in v2:** `CUSTOMER_CREDIT_ISSUE` and `CREDIT_NOTE_ISSUE` are **removed from the source registry** — they described the resulting instrument (a destination/outcome), not the origin of funds. Their origin-side uses are re-homed: returning a previously applied customer-credit/loyalty application is `CUSTOMER_CREDIT_RESTORE`; a lineage-free goodwill credit note is `GOODWILL_CONCESSION`. Issuing a credit note or customer credit remains available to **any** source as `destination_type = CREDIT_NOTE / CUSTOMER_CREDIT`.

**Registry constraint rule:** the database CHECK constraint on `refund_source_type` must **not** be finalized until this vocabulary is mirrored in the `REFUND_SOURCE_TYPES` constants (DB-mirror rule) within the same B1 change. The column has never been written, so the registry change is constants-only — no data migration and no stored values to convert. Any constraint must be conditional so legacy NULL rows remain valid (see [B01 §9](../B01_Refund_Lineage_And_Reopen_Due.md)).

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-refund.service.ts:311–335 | `initiateRefund` creates the row without `refund_source_type` or `reopens_due_amount`; lineage only in metadata JSON | Someone must own classification and write it as a first-class column |
| order-financial-write.service.ts:193–248 | `classifyRefunds` uses the column when present, else a heuristic over method/metadata; unknown → `REFUND_SOURCE_UNCLASSIFIED` | Heuristic must become fallback-only for legacy rows, never for new rows |
| constants/order-financial.ts:148–156 | `REFUND_SOURCE_TYPES` = REAL_PAYMENT_REFUND, GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE, MANUAL_EXCEPTION | v1 registry mixes origin values with issuance outcomes — replaced by the origin-only registry above (constants updated in B1; column never yet written) |
| constants/order-financial.ts:181–186 | `REFUND_METHODS` = ORIGINAL_METHOD, CASH, CREDIT_NOTE, WALLET | Method is the **destination** facet (destination_type); must not be reused as source |
| order-refund.service.ts:209–295 | Lineage validation exists for `originalPaymentId` / `originalCreditAppId` (caps) but is optional | Mandatory-lineage rule must be decided |

## Invariants
1. Every **new** refund row carries an explicit `refund_source_type` from the origin-only registry — no NULL, no heuristic.
2. The five facets are independent facts. **Source names the origin of value, never the resulting instrument**; destination and execution are recorded separately; none is inferred from another.
3. `refund_source_type` is immutable once the refund reaches `PROCESSED`.
4. STANDARD-scope refunds require lineage consistent with the declared source (REAL_PAYMENT_REFUND ⇒ `original_payment_id` present; any `*_RESTORE` ⇒ `original_credit_app_id` present with matching credit_type). GOODWILL_CONCESSION and MANUAL_EXCEPTION are lineage-free; both require a mandatory reason; MANUAL_EXCEPTION is never combined with lineage (existing rule, kept).
5. Legacy rows (pre-B1) may remain unclassified; they surface `REFUND_SOURCE_UNCLASSIFIED`, are **excluded from strict validation paths**, and are never silently backfilled with guesses.
6. The DB registry constraint is finalized only together with the constants change (DB-mirror rule) and must be conditional so legacy NULL rows stay valid.

## Options

### Option A — Classify at initiation, validate at processing (derived from lineage)
Service derives the source at `initiateRefund` from the provided lineage: `original_payment_id` → REAL_PAYMENT_REFUND; `original_credit_app_id` → map `credit_type` (GIFT_CARD→GIFT_CARD_RESTORE, WALLET→WALLET_RESTORE, CUSTOMER_ADVANCE→CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT/LOYALTY_CREDIT→CUSTOMER_CREDIT_RESTORE); no lineage + declared goodwill/price-concession intent → GOODWILL_CONCESSION (reason mandatory); no lineage + MANUAL_EXCEPTION scope → MANUAL_EXCEPTION (reason mandatory). `processRefund` re-validates before executing.
*Benefits:* classification exists from the first fact; approval reviews see it; deterministic; no UI dependency. *Risks:* initiation must reject ambiguous input (both lineages, or neither, in STANDARD scope). *Compatibility:* no change to API shape — lineage params already exist.

### Option B — Classify at processing time
Source computed when the refund is executed.
*Benefits:* latest information. *Risks:* PENDING_APPROVAL rows unclassified (approvers judge blind); classification could change between stages, breaking audit; snapshot sees unclassified in-flight rows. Rejected.

### Option C — Client/UI supplies the classification
*Benefits:* none material. *Risks:* trusts the caller with a financial classification; drift between UI variants. Rejected on control grounds.

## Recommended decision
**Option A (v2).** The refund service is the single classification owner; it derives `refund_source_type` deterministically from mandatory lineage at initiation using the origin-only registry, persists it on the row, and re-validates at processing. Ambiguous input is rejected with an explicit error, not defaulted.

## Approved decision (Expert)
**Option A (v2)** as recommended — see `Approved decision:` in Metadata for the binding text. Approval type: Expert. Selected for domain correctness (source = origin of funds, never the resulting instrument) and system integrity (deterministic, service-owned, lineage-derived classification that D003, B2, and B9 can consume without reinterpretation).

## Financial rationale
Classification drives reopen-due (D003), `net_collected_amount`, refund reporting, and future GL mapping (real-payment refund reverses cash; restores reverse liability; concessions are expense/contra-revenue, not liability moves). An audit trail is only defensible if the classification is fixed at the moment the financial intent is declared, names the true origin of the value, and is immutable once money moves.

## Runtime impact
`initiateRefund`/`processRefund` (write + validate); `classifyRefunds` (column-first, heuristic demoted to legacy fallback); refund APIs (`/orders/[id]/refund(s)`) unchanged in shape except the required reason_context input (B1); refund UI shows classification read-only.

## Database impact
Uses existing `org_order_refunds_dtl.refund_source_type` (mig 0340). B1 adds: conditional CHECK to the origin-only registry for new rows (legacy NULLs valid), `refund_context` column for reason_context, and the promoted `original_credit_app_id` lineage column with tenant-safe composite FK — see [B01 §9](../B01_Refund_Lineage_And_Reopen_Due.md). No constraint is finalized before the constants mirror this registry.

## Existing-data compatibility
Legacy NULL rows stay NULL; heuristic remains for them only; `REFUND_SOURCE_UNCLASSIFIED` warning retained. No speculative backfill; optional evidence-based backfill is a separate, reviewed task. Because the column was never written, retiring `CUSTOMER_CREDIT_ISSUE`/`CREDIT_NOTE_ISSUE` as source values requires no data change.

## Related decisions
[D003](D003_Refund_Reopen_Due_Rules.md) (consumes classification + reason_context), [D004](D004_Refund_Vs_Reversal_Vs_Void.md) (transaction_type taxonomy), [D010](D010_Financial_Idempotency_And_Lineage.md) (lineage immutability).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B09](../B09_Refund_Execution_Parity.md), [B02](../B02_Shared_Financial_Aggregation.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — Option A (v2) | 2026-07-16 | Expert-selected option applied for domain correctness and system integrity; rationale summary in Metadata |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
| 0.2 | 2026-07-16 | Delegated approval recorded, then reverted per folder CLAUDE.md; recommendation unchanged | Claude |
| 1.0 | 2026-07-16 | APPROVED — Option A (v1 registry) | — |
| 2.0 | 2026-07-16 | Expert correction pass: five-facet vocabulary (transaction_type / source_type / destination_type / execution_method / reason_context); origin-only source registry — CUSTOMER_CREDIT_ISSUE/CREDIT_NOTE_ISSUE re-homed as destinations, CUSTOMER_CREDIT_RESTORE/GOODWILL_CONCESSION added; registry DB constraint deferred until constants mirror the vocabulary; approval normalized to APPROVED (Expert) | Expert review |
