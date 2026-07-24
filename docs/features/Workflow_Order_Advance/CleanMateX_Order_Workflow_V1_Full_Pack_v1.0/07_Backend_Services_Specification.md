# CleanMateX Order Workflow V1 — Backend Services Specification

**Document ID:** CMX-OW-V1-PACK-007  
**Version:** 1.0  
**Status:** Implementation specification

## 1. Module structure

```text
order-workflow/
├── application/
│   ├── facade
│   ├── commands
│   ├── queries
│   ├── policies
│   └── dto
├── domain/
│   ├── workflow
│   ├── work-group
│   ├── stage-execution
│   ├── release
│   ├── outsourcing
│   ├── custody
│   └── errors
├── infrastructure/
│   ├── repositories
│   ├── supabase
│   ├── outbox
│   └── telemetry
└── presentation/api
```

Use current backend runtime initially, but keep boundaries suitable for later NestJS extraction.

## 2. Core services

- `OrderWorkflowFacade`: only public workflow command entry
- `WorkflowContextService`: loads order, groups, items/pieces, snapshot, permissions, holds/issues, releases, outsourcing, and finance facts
- `AvailableActionsService`: computes actions and blockers
- `TransitionResolverService`: evaluates conditions
- `WorkflowPolicyService`: runs action policies
- `WorkflowPersistenceService`: atomic writes
- `OrderStateAggregationService`: rebuilds summaries
- `WorkflowHistoryService`: canonical history
- `WorkflowOutboxService`: integration events

## 3. HQ services

- HqWorkflowDefinitionService
- HqWorkflowVersionService
- HqWorkflowValidationService
- HqWorkflowSimulationService
- HqWorkflowPublishingService
- HqWorkflowAssignmentService
- WorkflowResolutionService

Tenant endpoints call read-resolution services only.

## 4. Work-group services

- WorkGroupResolutionService
- WorkGroupSplitService
- WorkGroupItemAssignmentService
- StageExecutionService
- StageAttemptService

Group compatible items by version, route, location, outsourcing, and required sequence. Reassignment after start requires controlled command.

## 5. Outsourcing services

- OutsourceVendorService
- OutsourceJobService
- OutsourceDispatchService
- OutsourceReceiptService
- OutsourceReconciliationService
- OutsourceQaService

## 6. Release services

- ReleaseDraftService
- ReleaseEligibilityService
- ReleaseVerificationService
- CollectionService
- DeliveryReleaseService
- ReleaseAttemptService
- ReleaseReconciliationService

## 7. Custody services

- CustodyEventService
- CustodySummaryService
- PhysicalIntakeService
- PickupCustodyService
- VendorCustodyService
- ReleaseCustodyService

Custody events are append-only.

## 8. Integration gateways

- OrderFinanceGateway
- NotificationEventPublisher
- DeliveryGateway
- PickupGateway
- StorageEvidenceGateway
- CustomerIdentityGateway
- AuditGateway

Use interfaces to prevent direct cross-module coupling.

## 9. Finance gateway

Release eligibility request includes tenant/order, release type, selected value snapshot, items/pieces, and actor.

Decision returns allowed plus one code:

- allowed
- payment_required
- invoice_required
- credit_approval_required
- manager_override_available
- blocked

Money uses decimal-safe strings at API boundaries.

## 10. Repository rules

- Every method requires tenant context.
- No unscoped `findById`.
- Updates require expected version.
- No method accepts arbitrary target status.
- No provider call inside transaction.
- No hidden order-to-all-items status cascade.

## 11. Transaction pattern

```typescript
await transaction(async (tx) => {
  await idempotency.reserve(tx, command);
  const context = await contextLoader.loadForUpdate(tx, command);
  const decision = await handler.validateAndResolve(context, command);
  await handler.apply(tx, context, decision);
  await aggregator.refresh(tx, context.orderId);
  await history.append(tx, context, decision);
  await outbox.append(tx, context, decision);
  await idempotency.complete(tx, result);
});
```

## 12. Validation

Boundary and domain validation reject unknown action/status, invalid IDs, wrong tenant, negative quantity, duplicate piece, invalid reason, missing evidence, unsupported condition, and stale version.

## 13. Background jobs

BullMQ/Redis may handle notifications, webhooks, drift scans, SLA alerts, vendor overdue, delivery reconciliation, evidence processing, and reports. Core transition commit does not depend on the queue.

## 14. Caching

Cache immutable/versioned published workflows, catalogs, and labels. Include version in key. Do not cache mutable order state without explicit invalidation.

## 15. Logging/tracing

Log tenant, order, group, release/job, action, actor/source, correlation, state version, duration, and result. Never log payment secrets, OTP, or unnecessary PII.

## 16. Tests

- Service unit tests
- Gateway contract tests
- Repository integration
- Transaction rollback
- RLS
- Idempotency/concurrency
- Cross-domain orchestration
- Error mapping
- Telemetry assertions

## 17. Acceptance criteria

- No business screen writes status directly.
- Every service is tenant-scoped.
- Finance is accessed through gateway.
- Provider effects are outbox-driven.
- Policies are shared by available-actions and execution.
