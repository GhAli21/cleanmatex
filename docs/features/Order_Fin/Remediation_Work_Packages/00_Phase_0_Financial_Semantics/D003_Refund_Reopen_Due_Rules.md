# D003 — Refund Reopen-Due Rules

## Metadata
Decision ID: D003
Status: APPROVED (Expert)
Approval type: Expert
Selected option: Expert model (v2 — transaction-type–driven reopen; supersedes Option B v1 within this file)
Approved decision: Expert model (v2) — a **commercial refund never reopens due by default** (the customer is not made to owe a normally refunded amount again); **payment reversal, void, bounced payment, rejected payment, and chargeback reopen due** automatically via payment-status change (the leg leaves the COMPLETED set in the D005 formula); **refund-and-rebill** is a separate explicit transaction requiring permission and a mandatory reason, and is the only refund-row path that writes a positive `reopens_due_amount` besides MANUAL_EXCEPTION; **stored-value application reversal** changes outstanding solely through removal of the applied credit (credits term) with no duplicate reopen on the refund row
Rationale summary: a normal refund means value was returned and the sale was commercially reduced or returned — the order must not silently become payable again; only invalidated settlements (reversal/void/bounce/chargeback) or an explicit, permissioned re-collection intent (rebill) may recreate a receivable
Decision type: Settlement-semantics policy
Authoritative report sections: C1, §5, §8.2, §13, §34
Blocks: B1, B2, B9
Affects: B12 (amendment refunds), B33
Owner: Expert (see Approval record)
Approval date: 2026-07-16
Supersedes: — (v1 Option B superseded in-file, recorded in Revision history)

## Problem
`reopens_due_amount` is read by the snapshot outstanding formula but never written, and no reversal/void/bounce path exists — so the platform has **no mechanism at all** for making an order payable again after money moves back (C1 records the current-state facts). Reconciliation assumes the opposite extreme (every processed refund reopens). The business question is unanswered: *when does returning value make the order payable again?*

**Reframing of C1 (v2):** C1's factual finding stands — the mechanism is absent and the column is dead. The v2 policy resolution is that for a **normal commercial refund** the resulting `outstanding = 0 / settled` header is the *correct* end state (with `refunded_amount`/`net_collected_amount` telling the story); the genuine defects are (a) the missing reversal/void/bounce reopen path, (b) the missing explicit rebill path, and (c) reconciliation's blanket "all refunds reopen" assumption.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-refund.service.ts:311–335 | refund create never sets `reopens_due_amount` (DB default 0) | Writer needs an approved rule |
| order-financial-write.service.ts:779–786 | `outstanding = max(0, total − paid − credits + refund_reopens_due + credit_reversal_reopens_due)` | Formula is correct only if the column is populated per policy |
| reconciliation/order-checks.ts:198–200 | recon adds **all** PROCESSED refunds to expected outstanding | Contradicts the v2 model; aligned via D005/B2 |
| order-financial-write.service.ts:450–472 | header `PAID` derived from gross paid+credits vs outstanding | Reopen and status-change are the only mechanisms that can un-PAY an order |
| order-cancel-financials.service.ts:206+ | cancel unwind creates refunds post-tx | Refund-after-cancellation must not re-open a dead order |

## Invariants
1. `0 ≤ reopens_due_amount ≤ refund_amount` per row.
2. Σ(reopen amounts) can never push `outstanding` above the order total.
3. Reopen-due is set **once**, at processing, from the approved rule + declared source and reason_context (D002); immutable afterwards.
4. No double counting: a refund paired with a credit-application reversal must not reopen what the credit exclusion already reopens.
5. A refund on a CANCELLED order never reopens due (there is no collectible service).
6. Over-refund protection (existing caps) remains authoritative regardless of reopen policy.
7. **No silent receivable creation:** a positive `reopens_due_amount` on a refund row exists only when an operator explicitly chose REFUND_AND_REBILL (permission + mandatory reason) or MANUAL_EXCEPTION (mandatory reason). Never as a side effect of a normal refund.

## The approved model (v2 — the decision)

| Trigger | Default effect on outstanding | Mechanism |
|---|---|---|
| Commercial refund — source REAL_PAYMENT_REFUND, reason_context STANDARD or PRICE_ADJUSTMENT_GOODWILL, any destination | **no reopen (0)** — value returned; sale commercially reduced/returned; the customer does not owe again | `reopens_due_amount = 0` |
| Payment **reversal**, **void**, bounced payment, rejected payment, **chargeback** | **reopen due fully and automatically** — the settlement never validly happened or was invalidated | payment-status change: the leg leaves the COMPLETED set, so `effectivePayments` drops in the D005 formula (B10/B26 flows — never via refund rows) |
| **Refund-and-rebill** — reason_context REFUND_AND_REBILL | reopen = refund_amount, **explicitly** | separate explicit transaction path: requires a dedicated permission (order-reopen family, B27) + mandatory reason; writes `reopens_due_amount = refund_amount` as its own auditable fact |
| **Stored-value application reversal** — sources GIFT_CARD_RESTORE / WALLET_RESTORE / CUSTOMER_ADVANCE_RESTORE / CUSTOMER_CREDIT_RESTORE | outstanding changes **only** through removal of the applied credit (credits term); refund row reopen = 0 | paired credit-application reversal (status ≠ APPLIED) — invariant 4 forbids duplicate reopen |
| GOODWILL_CONCESSION (no prior settlement leg) | 0 — a concession, nothing collectible | `reopens_due_amount = 0` |
| Refund after order CANCELLED — reason_context CANCELLATION_UNWIND | 0 — sale is dead | `reopens_due_amount = 0` |
| MANUAL_EXCEPTION | operator-entered value (default 0), mandatory reason | explicit, flagged, audited |

Partial refunds: each row carries its own value under the same rules; repeated refunds accumulate row-by-row under invariant 2; refund-after-amendment uses the post-amendment total as the cap base (D011).

## Options considered

### Option A — Always reopen for real-payment refunds (reconciliation-compatible)
`REAL_PAYMENT_REFUND → reopen = refund_amount`; everything else 0.
*Risks:* silently makes every normally refunded customer owe the money again — wrong for returns, goodwill, and price concessions; invents phantom receivables that must then be re-collected or written off. **Rejected.**

### Option B (v1) — Source/context-driven defaults with automatic full reopen for real-payment refunds on active orders
The originally recommended model: real-payment refund on an active order reopened due automatically.
*Why superseded:* it still auto-created a receivable after a **normal** commercial refund — the customer would owe the refunded amount again with no explicit operator intent. That contradicts refund semantics (value returned = sale reduced/returned) and the no-silent-money-mutation principle. **Superseded by the v2 expert model.**

### Option C — Operator chooses per refund, no default
*Risks:* inconsistent books across cashiers. **Rejected** as primary (kept only as the MANUAL_EXCEPTION escape hatch).

### Expert model (v2) — transaction-type–driven reopen (approved)
Reopen follows the **nature of the transaction**, not the mere fact of money moving back: commercial refunds never reopen by default; invalidated settlements (reversal/void/bounce/chargeback) always reopen via status change; re-collection intent is a separate explicit permissioned transaction (rebill); stored-value restores move outstanding only through the credits term.
*Benefits:* financially correct per scenario; no phantom receivables; no silent receivable creation; audit-clean (every reopened amount traces to an explicit invalidation or an explicit operator intent); recon aligns via D005. *Risks:* requires the reason_context input (D002) and a B27 permission for rebill — both scoped in B1/B34/B27.

## Recommended decision
The **expert model (v2)** above.

## Approved decision (Expert)
**Expert model (v2)** — see `Approved decision:` in Metadata for the binding text. Approval type: Expert. Selected because it never silently makes a customer owe a normally refunded amount again, while guaranteeing that invalidated settlements always recreate the receivable and that re-collection is an explicit, permissioned, reasoned act.

## Financial rationale
Reopen-due is the bridge between cash movement and receivable truth. A commercial refund is a reduction/return of the sale — cash-out with no new receivable (Dr Refunds-Contra-Revenue or Dr Liability / Cr Cash in target GL). An invalidated settlement (reversal, void, bounce, chargeback) means the receivable never validly died — it must reappear automatically. Re-collecting after a refund (e.g. wrong tender, re-bill to another payer) is a distinct business act that deserves its own permissioned, reasoned transaction. Stored-value restores move liability, not settlement. Option A and Option B v1 both hid this distinction and invented phantom receivables; blanket no-reopen would hide invalidated settlements. The v2 model is the only shape where every reopened dinar traces to an explicit cause.

## Runtime impact
`processRefund` (writes reopen per the v2 table — 0 in all default commercial paths), refund API (required reason_context field per D002; REFUND_AND_REBILL accepted only with the B27 permission), snapshot (no formula change), reconciliation (aligns through D005/B2 — drops "+ all refunds"), cancel unwind (passes CANCELLATION_UNWIND context), B10/B26 (reversal/void/bounce/chargeback reopen via status transitions, not refund rows).

## Database impact
Existing `reopens_due_amount` column suffices; CHECK `0 ≤ reopens_due_amount ≤ refund_amount` (B1); `refund_context` column for reason_context (B1 — see [B01 §9](../B01_Refund_Lineage_And_Reopen_Due.md)).

## Existing-data compatibility
Legacy PROCESSED rows keep 0 (current snapshot behavior unchanged for history); they are flagged via the legacy-classification warning, not retro-valued. No backfill without a reviewed evidence pass. Note: under v2, legacy rows' `reopens_due_amount = 0` is also the correct *policy* value for ordinary commercial refunds — the legacy warning concerns classification, not reopen.

## Related decisions
[D002](D002_Refund_Source_Classification.md) (source + reason_context input), [D004](D004_Refund_Vs_Reversal_Vs_Void.md) (reversal/void reopen via status change by definition), [D005](D005_Canonical_Outstanding_Formula.md) (single consumer formula), [D006](D006_Credit_Application_Reversal_Rules.md) (invariant 4 pairing), [D011](D011_Order_Amendment_And_Delta_Rules.md).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B02](../B02_Shared_Financial_Aggregation.md), [B09](../B09_Refund_Execution_Parity.md), [B12](../B12_Order_Amendment_And_Financial_Delta.md), [B34](../B34_Refund_Backoffice_UI.md) (rebill surfaced as explicit permissioned action), [B27](../B27_Financial_Permissions_And_Approvals.md) (order-reopen/rebill permission code).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — Expert model (v2) | 2026-07-16 | Expert-selected option applied for domain correctness and system integrity; rationale summary in Metadata |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
| 0.2 | 2026-07-16 | Delegated approval recorded, then reverted per folder CLAUDE.md; recommendation unchanged | Claude |
| 1.0 | 2026-07-16 | APPROVED — Option B (v1: automatic full reopen for real-payment refunds on active orders) | — |
| 2.0 | 2026-07-16 | Expert correction pass: v1 Option B superseded — commercial refunds no longer reopen by default; reversal/void/bounce/rejected/chargeback reopen via status change; REFUND_AND_REBILL added as explicit permissioned transaction; stored-value reversal reopens only via credits term; C1 reframed; approval normalized to APPROVED (Expert) | Expert review |
