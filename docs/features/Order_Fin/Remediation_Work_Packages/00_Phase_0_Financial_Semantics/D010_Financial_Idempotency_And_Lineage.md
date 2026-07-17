# D010 — Financial Idempotency and Immutable Lineage

## Metadata
Decision ID: D010
Status: APPROVED (Expert)
Approval type: Expert
Selected option: Option A
Approved decision: Option A — the submit-order idempotency pattern is generalized platform-wide (deterministic scoped keys, replay = same outcome, conflict on payload change) with unique-constraint backstops; lineage lives in dedicated columns, never metadata; first adopters B5, B3, B30/B10 transitions, B1/B9 destinations, B7 handlers
Rationale summary: duplicate financial effects are indistinguishable from fraud in audit terms; one proven key grammar with replay semantics plus immutable column-based lineage makes caps, reversals, reconciliation, and disputes provable rather than heuristic
Decision type: Integrity-control policy
Authoritative report sections: §16, H5, H8, §28 (Idem column), B5, B30
Blocks: B1, B3, B4, B5, B7, B9, B10, B30
Affects: B19 (key retention/cleanup)
Owner: Expert (see Approval record)
Approval date: 2026-07-16
Supersedes: —

## Problem
Idempotency is strong on submit (staked hash + orderId-scoped sub-keys) but absent or optional elsewhere: collect payment inserts are unguarded (H5), wallet top-up/GC sale have none, transition endpoints rely on status guards alone, and lineage lives partly in metadata JSON. Without one frozen policy, every new package (B1, B3, B4, B9, B10, B30) will invent its own key scheme and retry behavior.

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| submit-order/route.ts:99–257 | staked hash pre-orchestrator; 409 on conflict/prior-failure; heal-on-retry | the reference pattern to generalize |
| order-submit-orchestrator.service.ts:745–938 | deterministic sub-keys `${orderId}_ar / _vch / _vl_* / _sv_* / _vch_post` | sub-key naming convention to freeze |
| order-settlement.service.ts:640, 829+ | collect: optional route key; payment `create` has **no** idempotency column use | the gap the policy must close (H5/B5) |
| order-refund.service.ts:183–188, 430 | refund unique key + FOR UPDATE; destination key `refund-${id}-cn` | per-stage + per-destination key precedent |
| stored-value.service.ts:120–125 | ledger idempotency-skip returns cached row; voucher backlinks (mig 0329) | skip-on-existing + lineage backlink precedent |

## Invariants
1. **Every financial write path** (fact insert, balance mutation, status transition, disposition, job handler) requires a deterministic, tenant-scoped idempotency key. "Optional key" is not permitted on money paths.
2. Key grammar: `{aggregateId}_{operation}[_{legIndex|subRef}]` for derived facts; client-supplied UUID keys for user-initiated requests; job/outbox handlers keyed by event id.
3. **Replay = same outcome:** a repeated key returns the original result (cached row/response), producing zero new financial effects.
4. **Same key + different payload = explicit 409-class conflict** — never silent acceptance (submit-order S2 pattern generalized).
5. Transitions are replay-safe per (row, target-status): re-verifying a COMPLETED row is a no-op; the loser of a concurrent race gets a retryable error, not a duplicate effect.
6. **Immutable lineage in dedicated columns**, not metadata JSON: every derived financial fact stores its source references (`original_payment_id`, `original_credit_app_id`, `fin_voucher_id`, `fin_voucher_trx_line_id`, gateway txn id, source amount) at creation and never rewrites them.
7. Locking order: balance rows via FOR UPDATE inside the owning tx, taken in the frozen STORED_VALUE_LOCK_RANK order; single-row transitions lock the row before deciding.
8. Key retention: keys live at least as long as the business retry window; deletion only via the governed cleanup job (B19) — never inline.

## Options

### Option A — Generalize the submit-order pattern platform-wide (recommended)
One shared helper family (stake/check/store/conflict) + the key grammar above; every package adopts it.
*Benefits:* proven in production on the highest-risk path; uniform audit and support behavior. *Risks:* touches many services over time — mitigated by adopting per package (B5 first).

### Option B — Per-domain schemes as needed
Rejected: this is the current state; it produced H5.

### Option C — DB-only uniqueness (constraints, no response caching)
*Benefits:* minimal code. *Risks:* retries surface raw unique-violations and roll back whole transactions (the exact failure F-R1 fixed for refunds); no cached response for clients. Rejected as sole mechanism; unique indexes remain the **backstop** under Option A.

## Recommended decision
**Option A**, with Option C's unique constraints retained as defense-in-depth. Required first adopters: collect payment legs (B5), stored-value funding (B3), pending-payment transitions (B30/B10), refund destination executions (B1/B9), outbox handlers (B7).

## Approved decision (Expert)
**Option A** as recommended — see `Approved decision:` in Metadata for the binding text. Approval type: Expert. Selected for system integrity (proven production pattern on the highest-risk path, generalized) and domain correctness (immutable column-based lineage as the basis for caps, reversals, and disputes).

## Financial rationale
Duplicate financial effects are indistinguishable from fraud in audit terms, and unkeyed retries are the cheapest way to create them (H5's double payment + double drawer movement). Immutable lineage is what makes caps, reversals, reconciliation, and dispute handling provable rather than heuristic.

## Runtime impact
Shared idempotency utilities (exists: `lib/utils/idempotency` — extended, not duplicated); collect routes make the key **required**; transition endpoints gain replay semantics; outbox consumer marks per-event completion.

## Database impact
Potential per-table sparse unique indexes on `(tenant_org_id, idempotency_key)` where missing (payments-from-collect, funding ledgers); lineage columns where still metadata-only (B1 assesses refunds). Decided per package, additive-only.

## Existing-data compatibility
Existing keys/rows untouched; new requirements apply to new writes. Legacy voucher-era keys keep their current TTLs until B19 unifies retention.

## Related decisions
[D002](D002_Refund_Source_Classification.md)/[D003](D003_Refund_Reopen_Due_Rules.md) (lineage consumers), [D001](D001_Payment_Lifecycle_And_Status_Transitions.md) (transition legality), [D009](D009_Pending_Payment_Failure_Fallback.md).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B03](../B03_Stored_Value_Funding_Capture.md), [B04](../B04_Later_Collection_BVM_Parity.md), [B05](../B05_Later_Collection_Idempotency.md), [B07](../B07_Financial_Outbox_Processor.md), [B09](../B09_Refund_Execution_Parity.md), [B10](../B10_Payment_Reversal_And_Void.md), [B19](../B19_Expiry_And_Idempotency_Jobs.md), [B30](../B30_Pending_Payment_Backoffice_Lifecycle.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — Option A | 2026-07-16 | Expert-selected option applied for domain correctness and system integrity; rationale summary in Metadata |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
| 0.2 | 2026-07-16 | Delegated approval recorded, then reverted per folder CLAUDE.md; recommendation unchanged | Claude |
| 1.0 | 2026-07-16 | APPROVED — Option A | — |
| 1.1 | 2026-07-16 | Expert correction pass: approval normalized to APPROVED (Expert) | Expert review |
