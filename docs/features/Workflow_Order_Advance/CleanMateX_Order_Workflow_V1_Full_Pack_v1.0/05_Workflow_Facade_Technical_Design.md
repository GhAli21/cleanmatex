# CleanMateX Order Workflow V1 — Unified Workflow Facade Technical Design

**Document ID:** CMX-OW-V1-PACK-005  
**Version:** 1.0  
**Status:** Implementation specification

## 1. Architecture

```text
API/UI/Driver/Job
→ OrderWorkflowFacade
→ Command handler
→ Context loader
→ Available-action resolver
→ Transition resolver
→ Domain policy pipeline
→ Transactional repository
→ Projection aggregator
→ History + Outbox
```

No caller submits a target status.

## 2. Command envelope

```typescript
type WorkflowCommand<T = unknown> = {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  tenantOrgId: string;
  branchId?: string;
  orderId: string;
  workGroupId?: string;
  actionCode: WorkflowActionCode;
  expectedStateVersion: number;
  actor: {
    userId: string;
    source: 'WEB_ADMIN' | 'DRIVER_APP' | 'CUSTOMER_APP' | 'API' | 'JOB';
    deviceId?: string;
  };
  reasonCode?: string;
  notes?: string;
  payload: T;
};
```

Authenticated tenant is authoritative and must match request context.

## 3. Result

Returns command/correlation IDs, order/work group, action, previous/current multidimensional state, transition/history IDs, outbox IDs, new `state_version`, available actions, and warnings.

## 4. Action catalog

- CONFIRM_ORDER
- CONFIRM_PHYSICAL_INTAKE
- START/COMPLETE_PREPARATION
- START/COMPLETE_PROCESSING
- START/COMPLETE_ASSEMBLY
- START_QA / PASS_QA / FAIL_QA
- START/COMPLETE_PACKING
- ASSIGN_STORAGE / MARK_READY
- REQUEST/APPROVE_OUTSOURCING
- SEND_TO_VENDOR / CONFIRM_VENDOR_RECEIPT
- RECEIVE_FROM_VENDOR / RECONCILE_VENDOR_RETURN
- COMPLETE_OUTSOURCE_QA
- CREATE_RELEASE / VERIFY_RELEASE
- CONFIRM_COLLECTION
- DISPATCH_RELEASE / MARK_OUT_FOR_DELIVERY
- CONFIRM_DELIVERY / REPORT_DELIVERY_FAILURE
- RETURN_RELEASE_TO_BRANCH
- PLACE_ON_HOLD / RESUME_FROM_HOLD
- APPROVE_OVERRIDE / RETURN_FOR_REWORK
- CANCEL_ORDER / VOID_DRAFT / CLOSE_ORDER / CUSTOMER_RETURN

## 5. Pipeline

1. Authenticate.
2. Resolve tenant/branch.
3. Reserve idempotency.
4. Load order, work groups, snapshot, permissions, items/pieces, holds/issues, releases, outsourcing, and finance facts.
5. Validate expected state version.
6. Resolve action availability.
7. Evaluate conditional transition.
8. Run policies.
9. Apply authoritative changes.
10. Recalculate summaries.
11. Increment state version.
12. Append history.
13. Append outbox.
14. Commit.
15. Return state and actions.

## 6. Policy examples

- Tenant
- Permission
- Workflow version
- Stage edge
- Physical intake
- Preparation completion
- Piece accounting
- QA
- Packing
- Ready
- Release eligibility
- Customer identity
- B2B
- Outsource reconciliation
- Delivery POD
- Cancellation
- Closure
- Hold/approval

Policy result contains allowed, blocker, severity, required fields, override permission, and evidence.

## 7. Idempotency

Key scope: tenant + action + idempotency key.

- Same key/same payload returns original result.
- Same key/different payload returns `IDEMPOTENCY_KEY_REUSED`.
- External effects use outbox.
- Result remains queryable.

## 8. Concurrency

Every order has `state_version`. Update succeeds only when the expected version matches. Conflict returns `STALE_ORDER_STATE`; client reloads state/actions. Work groups/releases may have their own versions.

## 9. Transaction

One transaction commits authoritative domain writes, required projections, state version, history, idempotency result, and outbox. Provider calls occur after commit.

## 10. Conditional resolver

Input: published snapshot, action, facts.  
Output: selected transition/stage, rule ID, evaluation trace, and default flag.

Unpublished rules cannot execute.

## 11. Available actions

Produced from the same rule and policy sources as execution. Response includes localized labels, primary/secondary, enabled, blockers, warnings, required fields, permission, confirmation, and override possibility.

## 12. Aggregation

Recalculate:

- operational_status
- fulfilment_status
- exception_status
- custody_summary_status
- customer milestone
- commercial completion/closure eligibility

The logic is shared by runtime, rebuild, drift checks, and tests.

## 13. Final legacy removal

Final architecture has no permanent Legacy/Enhanced adapters. Remove:

- Legacy `changeStatus`
- Enhanced execute
- direct PATCH/bulk/batch writers
- target-status UI submissions
- invalid previous_status SQL
- duplicate history triggers

## 14. Error codes

AUTH_REQUIRED, TENANT_MISMATCH, ORDER_NOT_FOUND, PERMISSION_DENIED, ACTION_NOT_AVAILABLE, TRANSITION_NOT_ALLOWED, WORKFLOW_NOT_ASSIGNED, STALE_ORDER_STATE, IDEMPOTENCY_KEY_REUSED, VALIDATION_FAILED, PHYSICAL_INTAKE_REQUIRED, PIECES_NOT_ACCOUNTED, QA_REQUIRED, RACK_REQUIRED, RELEASE_BLOCKED, PAYMENT_REQUIRED, OUTSOURCE_RECONCILIATION_REQUIRED, DELIVERY_POD_REQUIRED, ACTIVE_HOLD, APPROVAL_REQUIRED, CANCELLATION_NOT_ALLOWED, CLOSURE_NOT_ALLOWED.

## 15. Observability

Log tenant, order/work group/release/job, action, actor/source, correlation, duration, rule, blockers, old/new summaries, state version, and result. Do not log secrets, OTPs, or unnecessary PII.

Metrics include action volume, failures, p50/p95, conflicts, replays, blocker rates, drift, and outbox lag.

## 16. Acceptance criteria

- Every workflow write uses facade.
- Client never controls target status.
- Retries do not duplicate effects.
- Stale commands cannot overwrite newer state.
- History/outbox are atomic.
- Available actions and execution use identical policy sources.
