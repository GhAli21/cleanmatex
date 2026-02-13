# Plan: Workflow averageTimePerStage and checkAutoTransitions

## Overview

Two TODOs in `workflow-service.ts`:
1. `averageTimePerStage: []` – should calculate from status history
2. `checkAutoTransitions` – placeholder for business-rule-based auto-transitions

## Current State

- **File:** `web-admin/lib/services/workflow-service.ts`
- **Method:** `getWorkflowStats()` returns `averageTimePerStage: []`
- **Method:** `checkAutoTransitions(orderId, tenantId)` – logs and does nothing

## Prerequisites

- `org_order_status_history_tr` (or equivalent) stores status changes with timestamps
- Workflow stages defined (e.g. PREPARATION → PROCESSING → ASSEMBLY → READY → DELIVERED)
- Business rules for auto-transitions (if any) documented

## Implementation Steps

### Part A: averageTimePerStage

#### 1. Inspect status history schema

- Table/columns for order_id, from_status, to_status, changed_at (or created_at)
- Ensure tenant_org_id filter exists

#### 2. Write aggregation query

- For each stage transition (e.g. PREPARATION→PROCESSING), compute avg duration
- SQL: Group by (from_status, to_status), avg(to_timestamp - from_timestamp)
- Filter by tenant, date range (e.g. last 30 days)

#### 3. Integrate into getWorkflowStats

- Replace `averageTimePerStage: []` with result of aggregation
- Return shape: `{ fromStage, toStage, avgHours }[]` or equivalent

### Part B: checkAutoTransitions

#### 1. Document business rules

- When can an order auto-transition? (e.g. all items prepared → PROCESSING)
- Which transitions are automatic vs manual?
- Reference: `workflow-service-enhanced.ts`, PRD docs

#### 2. Implement rule checks

- Load order and related data (assembly task, preparation status, etc.)
- For each auto-transition rule:
  - If conditions met: call `changeStatus` (or transition function)
  - Log transition for audit
- Handle idempotency (don’t re-apply if already in target status)

#### 3. Decide when to call checkAutoTransitions

- On order update (webhook/cron) or
- On specific user actions (e.g. after scan)
- May be called from `changeStatus` or from a separate scheduler

## Acceptance Criteria

- [ ] `averageTimePerStage` returns real avg hours per stage transition
- [ ] `checkAutoTransitions` enforces at least one documented rule (or is clearly no-op if no rules)
- [ ] No breaking changes to `getWorkflowStats` response shape for consumers

## Production Checklist

- [ ] Status history table has required columns and indexes
- [ ] Tenant isolation on aggregation query
- [ ] Auto-transition rules documented and tested
- [ ] Build passes

## References

- `web-admin/lib/services/workflow-service.ts`
- `web-admin/lib/services/workflow-service-enhanced.ts`
- `docs/features/` (workflow PRDs)
- Status history table schema
