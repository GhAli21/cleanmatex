# Phase 0 — Financial Semantics Decisions

**Purpose:** freeze the financial policies and invariants that implementation packages (B01–B33) depend on, so no service encodes ad-hoc semantics. Decisions define **policy and invariants only**; implementation detail belongs to backlog packages (e.g. [D003](D003_Refund_Reopen_Due_Rules.md) decides *when* a refund reopens an order balance; [B01](../B01_Refund_Lineage_And_Reopen_Due.md) defines *how* the approved rule is implemented in services, database writes, snapshots, reconciliation, APIs, and tests).

**Approval and supersession rules:**
- A decision becomes binding at status `APPROVED` with a named owner and date.
- Approved decision files must **not** be silently rewritten. A material policy change is recorded as a new version in the revision history **or** as a new superseding decision (old file → `SUPERSEDED`, with a forward link).
- Backlog packages listing a decision under *Required decisions* stay `DECISION_REQUIRED` until that decision is `APPROVED`.

**Decision status vocabulary:**

```text
PROPOSED · UNDER_REVIEW · APPROVED · REJECTED · SUPERSEDED
```

## Decision index

**B1 blockers (expand + approve first):** D002, D003, D004, D005, D010. All others are concise skeletons and must not delay B1. D007 may be referenced by B1 for boundary clarity but needs final approval only if B1 scope expands into BVM/GL execution.

| ID | Title | Status | Blocks (hard) | Affects | Owner | Approved | Supersedes | File |
|---|---|---|---|---|---|---|---|---|
| D001 | Payment Lifecycle and Status Transitions | PROPOSED | B30 B31 B32 B33 | B4 B5 B8 B10 B16 B22 B26 | — | — | — | [D001](D001_Payment_Lifecycle_And_Status_Transitions.md) |
| D002 | Refund Source Classification | PROPOSED | **B1** B9 | B2 | — | — | — | [D002](D002_Refund_Source_Classification.md) |
| D003 | Refund Reopen-Due Rules | PROPOSED | **B1** B2 B9 | B12 B33 | — | — | — | [D003](D003_Refund_Reopen_Due_Rules.md) |
| D004 | Refund vs Reversal vs Void | PROPOSED | **B1** B9 B10 B13 | B26 | — | — | — | [D004](D004_Refund_Vs_Reversal_Vs_Void.md) |
| D005 | Canonical Outstanding Formula | PROPOSED | **B1** B2 B20 B33 | all snapshot/recon consumers | — | — | — | [D005](D005_Canonical_Outstanding_Formula.md) |
| D006 | Credit Application Reversal Rules | PROPOSED | — | B2 B9 B12 B13 | — | — | — | [D006](D006_Credit_Application_Reversal_Rules.md) |
| D007 | BVM and ERP-Lite Responsibilities | PROPOSED | B6 B13 B14 | B3 B4 B9 B25 | — | — | — | [D007](D007_BVM_And_ERP_Lite_Responsibilities.md) |
| D008 | Stored-Value Funding Treatment | PROPOSED | B3 | B6 B19 B25 | — | — | — | [D008](D008_Stored_Value_Funding_Treatment.md) |
| D009 | Pending-Payment Failure Fallback | PROPOSED | B30 B31 B33 | B8 | — | — | — | [D009](D009_Pending_Payment_Failure_Fallback.md) |
| D010 | Financial Idempotency and Immutable Lineage | PROPOSED | **B1** B3 B4 B5 B7 B9 B10 B30 | B19 | — | — | — | [D010](D010_Financial_Idempotency_And_Lineage.md) |
| D011 | Order Amendment and Financial Delta Rules | PROPOSED | B12 | B14 B25 | — | — | — | [D011](D011_Order_Amendment_And_Delta_Rules.md) |
| D012 | Revenue Recognition Policy | PROPOSED | B25 | B6 | — | — | — | [D012](D012_Revenue_Recognition_Policy.md) |

**Blocking vs non-blocking:** a *Blocks* entry means the backlog package cannot leave `DECISION_REQUIRED`/`READY_FOR_DESIGN` without approval; an *Affects* entry means the package must conform to the decision but may design in parallel while it is `UNDER_REVIEW`.
