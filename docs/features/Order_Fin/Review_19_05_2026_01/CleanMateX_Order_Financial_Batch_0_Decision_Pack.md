# CleanMateX Order Financial Platform — Batch 0 Decision Pack

## 0. Purpose

- This document freezes the business and technical decisions required before implementation starts.
- This batch contains no code changes.
- This batch contains no migrations.
- This batch contains no architecture redesign.
- This batch is decisions only.
- The approved decisions in this document will control the scope and sequencing of the next implementation batches.
- The source of truth for these decisions is [CleanMateX_Order_Financial_Implementation_Gap_Action_Plan.md](F:/jhapp/cleanmatex/docs/features/Order_Fin/Review_19_05_2026_01/CleanMateX_Order_Financial_Implementation_Gap_Action_Plan.md).

## 1. Decision Summary

| Decision ID | Decision | Recommended Option | Blocking? | Owner | Status |
|---|---|---|---|---|---|
| D-001 | Is `org_order_*` the official financial source of truth going forward? | Make `org_order_*` authoritative and treat legacy as transitional. | Yes | Solution Architect + Finance Lead + Backend Lead | Pending Approval |
| D-002 | What is the retirement/mapping plan for legacy `org_payments_dtl_tr`? | Keep legacy read-only during transition with explicit mapping and reconciliation. | Yes | Solution Architect + Finance Lead + Backend Lead | Pending Approval |
| D-003 | Should persisted settlement header/leg tables be added now, later, or not at all? | Defer for now and document the runtime settlement model first. | Yes | Solution Architect + Finance Lead | Pending Approval |
| D-004 | Should retail default be `PAY_ON_COLLECTION` or current `CASH`? | Keep current `CASH` until business explicitly approves a change. | Yes | Product Owner + Operations Lead | Pending Approval |
| D-005 | Should `PAY_ON_DELIVERY` be supported in V1? | No for V1 unless delivery operations require it before go-live. | Yes | Product Owner + Operations Lead | Pending Approval |
| D-006 | Is payment-row-level refund linkage enough, or is original settlement-leg linkage required? | Accept payment-row linkage for V1 and revisit only if split-refund reporting proves insufficient. | Yes | Finance Lead + Backend Lead | Pending Approval |
| D-007 | Should gift card be removed from discount lines and shown only as credit/stored-value application? | Yes. Show it only as credit/stored-value application. | Yes | Finance Product Owner + Frontend Lead + Backend Lead | Pending Approval |
| D-008 | Should gateway payments be treated as completed only after external confirmation? | Yes. Gateway methods should remain pending until confirmed externally. | Yes | Finance Systems Lead + Backend Lead | Pending Approval |
| D-009 | Which reconciliation checks are required before production? | Approve the targeted minimum set: dual-ledger, retained-cash, gateway-state, and credit-application completeness checks. | Yes | Finance Operations Lead + Backend Lead | Pending Approval |

## 2. Decision Principles

- Preserve the current implementation where it already works.
- Prefer additive clarification over redesign.
- Separate policy decisions from implementation tasks.
- Do not expand scope just because a future-state design exists.
- Approve only the minimum set of decisions needed to unblock Batch 1.

## 3. Decision Details

### D-001 — Official Financial Source of Truth

- Decision:
  - Is `org_order_*` the official order-financial source of truth going forward?
- Current situation:
  - The action plan identifies dual-ledger coexistence between `org_order_*` and legacy `org_payments_dtl_tr` as the clearest production blocker.
- Options:
  - Keep both paths equally active.
  - Make `org_order_*` authoritative and treat legacy as transitional.
  - Keep legacy authoritative.
- Recommended option:
  - Make `org_order_*` authoritative and treat legacy as transitional.
- Why:
  - The current implementation review found the new order-financial path substantially implemented already.
  - This preserves forward progress without forcing a rewrite.
- If approved:
  - Batch 1 can align fixes, reporting, and reconciliation to the new ledger path.
- If rejected:
  - Batch 1 remains ambiguous and dual-ledger risks stay unresolved.

### D-002 — Legacy Payment Path Transition Policy

- Decision:
  - What is the retirement or mapping plan for `org_payments_dtl_tr`?
- Current situation:
  - The legacy path still exists and may continue to influence reports, refunds, and reconciliation outcomes.
- Options:
  - Immediate cutover away from legacy.
  - Legacy stays read-only during transition with explicit mapping and reconciliation.
  - Long-term coexistence.
- Recommended option:
  - Keep legacy read-only during transition with explicit mapping and reconciliation.
- Why:
  - This is the safest path for production stabilization and avoids breaking already working flows.
- If approved:
  - The next implementation batch can create mapping artifacts and reconciliation checks without forcing table retirement.
- If rejected:
  - Engineering will need a different transition model before starting P0 fixes.

### D-003 — Persisted Settlement Header/Leg Tables

- Decision:
  - Should persisted settlement header/leg tables be added now, later, or not at all?
- Current situation:
  - The review found runtime settlement-leg behavior in services but no persisted settlement header/leg tables.
- Options:
  - Add now.
  - Defer until audit/reporting need is proven.
  - Decide not to add them.
- Recommended option:
  - Defer for now and document the runtime settlement model first.
- Why:
  - The action plan explicitly does not classify this as an immediate blocker.
  - Adding persistence now would reopen architecture and widen scope.
- If approved:
  - Batch 1 and Batch 2 stay focused on integrity fixes and usability gaps.
- If rejected:
  - A new scoped architecture-hardening discussion is required before implementation starts.

### D-004 — Retail Default Payment Behavior

- Decision:
  - Should retail default to `PAY_ON_COLLECTION` or remain the current `CASH` behavior?
- Current situation:
  - The review found current retail default behavior in UI as `CASH`, while the locked baseline expected `PAY_ON_COLLECTION`.
- Options:
  - Change default to `PAY_ON_COLLECTION`.
  - Keep current `CASH`.
  - Make it configurable by org or branch later.
- Recommended option:
  - Keep current `CASH` until business explicitly approves a change.
- Why:
  - The current behavior exists and works.
  - This is a business policy choice, not a proven implementation defect.
- If approved:
  - Engineering does not spend time changing defaults during the integrity-fix phase.
- If rejected:
  - Batch 1 or Batch 2 will need a scoped behavior change and test updates.

### D-005 — `PAY_ON_DELIVERY` in V1

- Decision:
  - Should `PAY_ON_DELIVERY` be supported in V1?
- Current situation:
  - The review found no confirmed V1 delivery-default flow in the current implementation.
- Options:
  - Support it now.
  - Exclude it from V1.
  - Defer and re-evaluate after go-live.
- Recommended option:
  - Exclude it from V1 unless delivery operations require it before go-live.
- Why:
  - It increases scope without being shown as a current production blocker.
- If approved:
  - Batch 1 stays narrow and avoids introducing a new payment mode.
- If rejected:
  - Delivery finance behavior must be defined before engineering begins coding.

### D-006 — Refund Lineage Requirement

- Decision:
  - Is payment-row-level refund linkage enough for V1, or is original settlement-leg linkage required?
- Current situation:
  - The review found refunds linked to payment rows, not to settlement legs.
- Options:
  - Accept payment-row linkage for V1.
  - Require original settlement-leg linkage now.
  - Use a hybrid approach later.
- Recommended option:
  - Accept payment-row linkage for V1 and revisit only if split-refund reporting proves insufficient.
- Why:
  - The current refund flow works, and the action plan does not classify missing settlement-leg linkage as an immediate blocker.
- If approved:
  - Refund work stays incremental and test-focused.
- If rejected:
  - Refund model hardening becomes a pre-implementation design dependency.

### D-007 — Gift Card Classification Policy

- Decision:
  - Should gift card application be removed from discount lines and shown only as credit/stored-value application?
- Current situation:
  - The review found the gift card ledger implemented, but reporting/calculation still pushes `giftCardApplied` into discount-style presentation in some places.
- Options:
  - Keep mixed presentation.
  - Move fully to credit/stored-value treatment.
  - Show it both ways.
- Recommended option:
  - Move fully to credit/stored-value treatment.
- Why:
  - Liability redemption should not be reported as a commercial discount.
  - This is one of the clearest finance-classification risks in the action plan.
- If approved:
  - Batch 1 can implement a narrow classification/reporting correction.
- If rejected:
  - Finance reporting logic remains intentionally mixed and must be documented as such.

### D-008 — Gateway Completion Policy

- Decision:
  - Should gateway payments be treated as completed only after external confirmation?
- Current situation:
  - The review found possible risk that accounting completion can outpace real external capture confirmation.
- Options:
  - Mark completed immediately on local post.
  - Keep pending until external confirmation.
  - Use method-specific behavior.
- Recommended option:
  - Keep gateway methods pending until externally confirmed.
- Why:
  - This is the safest operational and accounting policy.
  - It directly addresses one of the P0 integrity blockers.
- If approved:
  - Batch 1 can implement clear pending, failed, and completed semantics.
- If rejected:
  - Finance must accept the risk of locally completed but externally unconfirmed transactions.

### D-009 — Required Reconciliation Scope Before Production

- Decision:
  - Which reconciliation checks are required before production sign-off?
- Current situation:
  - The review found a reconciliation framework already implemented, but not yet broad enough for confident production sign-off.
- Options:
  - Keep current limited checks only.
  - Add targeted minimum controls.
  - Launch a broad full-suite reconciliation program now.
- Recommended option:
  - Add the targeted minimum set only:
  - dual-ledger consistency
  - retained-cash validation
  - gateway-state validation
  - credit-application completeness
- Why:
  - This closes the highest-risk integrity gaps without triggering a reporting redesign.
- If approved:
  - Batch 1 can extend the existing reconciliation framework in a controlled way.
- If rejected:
  - The production sign-off standard remains undefined.

## 4. Recommended Approval Set

- Approve D-001 through D-009 as a single Batch 0 package if the goal is to unblock Batch 1 without reopening architecture.
- If any item is not approved, mark it `Needs Discussion` rather than allowing implementation teams to infer the policy.
- The most important approvals to unblock P0 work are:
  - D-001
  - D-002
  - D-007
  - D-008
  - D-009

## 5. Implementation Impact by Decision

| Decision ID | If Approved, Next Batch Impact |
|---|---|
| D-001 | Allows Batch 1 and reconciliation work to anchor on `org_order_*` as the operational target. |
| D-002 | Allows legacy handling to remain additive and low-risk instead of forcing immediate retirement. |
| D-003 | Prevents unnecessary settlement-table redesign during integrity stabilization. |
| D-004 | Avoids default-payment behavior churn unless the business explicitly wants it. |
| D-005 | Keeps delivery finance scope out of V1 unless it becomes a real rollout requirement. |
| D-006 | Keeps refund work focused on validation and tests, not model redesign. |
| D-007 | Unblocks gift-card reporting/classification correction in Batch 1. |
| D-008 | Unblocks gateway state enforcement and related tests in Batch 1. |
| D-009 | Unblocks the minimum reconciliation additions needed for production sign-off. |

## 6. Out of Scope for Batch 0

- No source-code changes
- No database migrations
- No table redesign
- No route redesign
- No new reports
- No UI rebuild
- No settlement persistence implementation
- No broader finance architecture rewrite

## 7. Approval Record

| Decision ID | Final Status | Approved By | Date | Notes |
|---|---|---|---|---|
| D-001 | Pending Approval |  |  |  |
| D-002 | Pending Approval |  |  |  |
| D-003 | Pending Approval |  |  |  |
| D-004 | Pending Approval |  |  |  |
| D-005 | Pending Approval |  |  |  |
| D-006 | Pending Approval |  |  |  |
| D-007 | Pending Approval |  |  |  |
| D-008 | Pending Approval |  |  |  |
| D-009 | Pending Approval |  |  |  |

## 8. Exit Criteria for Batch 0

- Every blocking decision has one of these statuses:
  - `Approved`
  - `Rejected`
  - `Needs Discussion`
- No blocking decision remains ambiguous.
- Batch 1 may begin only after the decision statuses are finalized and recorded here.
