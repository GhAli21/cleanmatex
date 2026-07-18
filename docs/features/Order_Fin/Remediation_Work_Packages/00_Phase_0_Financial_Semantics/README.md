# Phase 0 — Financial Semantics Decisions

**Purpose:** freeze the financial policies and invariants that implementation packages (B01–B34) depend on, so no service encodes ad-hoc semantics. Decisions define **policy and invariants only**; implementation detail belongs to backlog packages (e.g. [D003](D003_Refund_Reopen_Due_Rules.md) decides *when* a refund reopens an order balance; [B01](../B01_Refund_Lineage_And_Reopen_Due.md) defines *how* the approved rule is implemented in services, database writes, snapshots, reconciliation, APIs, and tests).

**Approval and supersession rules:**
- A decision becomes binding at status `APPROVED` with a recorded approval type, approver role, and date. Approval types: `APPROVED (Owner)` — direct owner sign-off; `APPROVED (Expert)` — expert-selected option applied for domain correctness and system integrity, with the selected option and rationale summary recorded explicitly in the decision file.
- Approved decision files must **not** be silently rewritten. A material policy change is recorded as a new version in the revision history **or** as a new superseding decision (old file → `SUPERSEDED`, with a forward link).
- Backlog packages listing a decision under *Required decisions* stay `DECISION_REQUIRED` until that decision is `APPROVED`.

**Decision status vocabulary:**

```text
PROPOSED · UNDER_REVIEW · APPROVED (Owner) · APPROVED (Expert) · REJECTED · SUPERSEDED
```

## Decision index

**All twelve decisions are APPROVED (Expert)** — D002/D003/D004/D005/D010 on 2026-07-16 (B1-blocker wave), D001/D006/D007/D008/D009/D011/D012 on 2026-07-18 (governance finalization pass from the owner's authoritative decision pack). No decision blockers remain anywhere in the backlog; the accounting-owner sign-off inside D012 survives only as an **implementation control** for the entity-specific over-time adjustment, not as an open decision.

| ID | Title | Status | Blocks (hard) | Affects | Owner | Approved | Supersedes | File |
|---|---|---|---|---|---|---|---|---|
| D001 | Payment Lifecycle and Status Transitions | **APPROVED (Expert)** — canonical transition graph + terminal set + controlled override | B30 B31 B32 B33 | B4 B5 B8 B10 B16 B22 B26 | Expert | 2026-07-18 | — | [D001](D001_Payment_Lifecycle_And_Status_Transitions.md) |
| D002 | Refund Source Classification | **APPROVED (Expert)** — Option A (v2, five-facet vocabulary) | **B1** B9 | B2 | Expert | 2026-07-16 | — | [D002](D002_Refund_Source_Classification.md) |
| D003 | Refund Reopen-Due Rules | **APPROVED (Expert)** — Expert model (v2) | **B1** B2 B9 | B12 B33 | Expert | 2026-07-16 | — | [D003](D003_Refund_Reopen_Due_Rules.md) |
| D004 | Refund vs Reversal vs Void | **APPROVED (Expert)** — Option B | **B1** B9 B10 B13 | B26 | Expert | 2026-07-16 | — | [D004](D004_Refund_Vs_Reversal_Vs_Void.md) |
| D005 | Canonical Outstanding Formula | **APPROVED (Expert)** — Option A | **B1** B2 B20 B33 | all snapshot/recon consumers | Expert | 2026-07-16 | — | [D005](D005_Canonical_Outstanding_Formula.md) |
| D006 | Credit Application Reversal Rules | **APPROVED (Expert)** — reusable reversal, single reopen mechanism, governed loyalty restore | — | B2 B9 B12 B13 | Expert | 2026-07-18 | — | [D006](D006_Credit_Application_Reversal_Rules.md) |
| D007 | BVM and ERP-Lite Responsibilities | **APPROVED (Expert)** — five-layer boundaries + responsibility matrix + outbox failure coupling | B6 B13 B14 | B3 B4 B9 B25 | Expert | 2026-07-18 | — | [D007](D007_BVM_And_ERP_Lite_Responsibilities.md) |
| D008 | Stored-Value Funding Treatment | **APPROVED (Expert)** — five-artifact funding capture; funding is liability, never revenue | B3 | B6 B19 B25 | Expert | 2026-07-18 | — | [D008](D008_Stored_Value_Funding_Treatment.md) |
| D009 | Pending-Payment Failure Fallback | **APPROVED (Expert)** — governed fallback set + default policy table | B30 B31 B33 | B8 | Expert | 2026-07-18 | — | [D009](D009_Pending_Payment_Failure_Fallback.md) |
| D010 | Financial Idempotency and Immutable Lineage | **APPROVED (Expert)** — Option A | **B1** B3 B4 B5 B7 B9 B10 B30 | B19 | Expert | 2026-07-16 | — | [D010](D010_Financial_Idempotency_And_Lineage.md) |
| D011 | Order Amendment and Financial Delta Rules | **APPROVED (Expert)** — governed amendment/delta model; fiscal artifacts adjusted, never rewritten | B12 | B14 B25 | Expert | 2026-07-18 | — | [D011](D011_Order_Amendment_And_Delta_Rules.md) |
| D012 | Revenue Recognition Policy | **APPROVED (Expert)** — IFRS 15 obligation model; v1 validated-completion recognition | B25 | B6 | Expert | 2026-07-18 | — | [D012](D012_Revenue_Recognition_Policy.md) |

**Blocking vs non-blocking:** a *Blocks* entry means that once a backlog package is **activated** for design or implementation, it stays `DECISION_REQUIRED` until that decision is `APPROVED` (unactivated packages may remain `NOT_STARTED`); an *Affects* entry means the package must conform to the decision but may design in parallel while it is `UNDER_REVIEW`. With all decisions APPROVED, no package can be `DECISION_REQUIRED` on this basis any longer.
