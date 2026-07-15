# D002 — Refund Source Classification

## Metadata
Decision ID: D002
Status: PROPOSED
Decision type: Financial-fact classification policy
Authoritative report sections: §8 / §8.1 / §8.2, §34, C1
Blocks: B1, B9
Affects: B2 (aggregation reads classification)
Owner: —
Approval date: —
Supersedes: —

## Problem
The refund vocabulary (`REFUND_SOURCE_TYPES`) exists in code but the refund write path never populates the `refund_source_type` column. The snapshot classifies refunds through a legacy heuristic (method/metadata guesswork), and the concepts **source** (what value is being returned), **destination** (where the value goes), and **execution method** (how it physically moves) are conflated in a single `refund_method_code` field. A refund of a cash payment paid out to a wallet is simultaneously "source = real cash payment", "destination = wallet", "execution = wallet credit" — today only the last is recorded.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-refund.service.ts:311–335 | `initiateRefund` creates the row without `refund_source_type` or `reopens_due_amount`; lineage only in metadata JSON | Someone must own classification and write it as a first-class column |
| order-financial-write.service.ts:193–248 | `classifyRefunds` uses the column when present, else a heuristic over method/metadata; unknown → `REFUND_SOURCE_UNCLASSIFIED` | Heuristic must become fallback-only for legacy rows, never for new rows |
| constants/order-financial.ts:148–156 | `REFUND_SOURCE_TYPES` = REAL_PAYMENT_REFUND, GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE, MANUAL_EXCEPTION | Registry exists; allowed-value set must be confirmed as the closed list |
| constants/order-financial.ts:181–186 | `REFUND_METHODS` = ORIGINAL_METHOD, CASH, CREDIT_NOTE, WALLET | Method is a **destination/execution** field; must not be reused as source |
| order-refund.service.ts:209–295 | Lineage validation exists for `originalPaymentId` / `originalCreditAppId` (caps) but is optional | Mandatory-lineage rule must be decided |

## Invariants
1. Every **new** refund row carries an explicit `refund_source_type` from the closed registry — no NULL, no heuristic.
2. **Source ≠ destination ≠ execution method.** All three are recorded independently; none is inferred from another.
3. `refund_source_type` is immutable once the refund reaches `PROCESSED`.
4. STANDARD-scope refunds require lineage consistent with the declared source (source = REAL_PAYMENT_REFUND ⇒ `original_payment_id` present; source = *_RESTORE / CUSTOMER_CREDIT_ISSUE from a credit app ⇒ `original_credit_app_id` present).
5. `MANUAL_EXCEPTION` is an explicit operator choice with a mandatory reason — never a silent default and never combined with lineage (existing rule, kept).
6. Legacy rows (pre-B1) may remain unclassified; they surface `REFUND_SOURCE_UNCLASSIFIED` and are never silently backfilled with guesses.

## Options

### Option A — Classify at initiation, validate at processing (derived from lineage)
Service derives the source at `initiateRefund` from the provided lineage: `original_payment_id` → REAL_PAYMENT_REFUND; `original_credit_app_id` → map `credit_type` (GIFT_CARD→GIFT_CARD_RESTORE, WALLET→WALLET_RESTORE, CUSTOMER_ADVANCE→CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT/LOYALTY→CUSTOMER_CREDIT_ISSUE); destination CREDIT_NOTE with no lineage → CREDIT_NOTE_ISSUE; no lineage + MANUAL_EXCEPTION scope → MANUAL_EXCEPTION. `processRefund` re-validates before executing.
*Benefits:* classification exists from the first fact; approval reviews see it; deterministic; no UI dependency. *Risks:* initiation must reject ambiguous input (both lineages, or neither, in STANDARD scope). *Compatibility:* no change to API shape — lineage params already exist.

### Option B — Classify at processing time
Source computed when the refund is executed.
*Benefits:* latest information. *Risks:* PENDING_APPROVAL rows unclassified (approvers judge blind); classification could change between stages, breaking audit; snapshot sees unclassified in-flight rows. 

### Option C — Client/UI supplies the classification
*Benefits:* none material. *Risks:* trusts the caller with a financial classification; drift between UI variants. Rejected on control grounds.

## Recommended decision
**Option A.** The refund service is the single classification owner; it derives `refund_source_type` deterministically from mandatory lineage at initiation, persists it on the row, and re-validates at processing. Ambiguous input is rejected with an explicit error, not defaulted.

## Financial rationale
Classification drives reopen-due (D003), `net_collected_amount`, refund reporting, and future GL mapping (real-payment refund reverses cash; restores reverse liability). An audit trail is only defensible if the classification is fixed at the moment the financial intent is declared and immutable once money moves.

## Runtime impact
`initiateRefund`/`processRefund` (write + validate); `classifyRefunds` (column-first, heuristic demoted to legacy fallback); refund APIs (`/orders/[id]/refund(s)`) unchanged in shape; refund UI shows classification read-only.

## Database impact
Uses existing `org_order_refunds_dtl.refund_source_type` (mig 0340). Potential: CHECK constraint to the closed registry; NOT NULL for rows created after cutover (B1 assesses).

## Existing-data compatibility
Legacy NULL rows stay NULL; heuristic remains for them only; `REFUND_SOURCE_UNCLASSIFIED` warning retained. No speculative backfill; optional evidence-based backfill is a separate, reviewed task.

## Related decisions
[D003](D003_Refund_Reopen_Due_Rules.md) (consumes classification), [D004](D004_Refund_Vs_Reversal_Vs_Void.md) (concept boundaries), [D010](D010_Financial_Idempotency_And_Lineage.md) (lineage immutability).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B09](../B09_Refund_Execution_Parity.md), [B02](../B02_Shared_Financial_Aggregation.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
