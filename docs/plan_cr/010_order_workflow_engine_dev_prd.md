# Order Workflow Engine - Development Plan & PRD

**Document ID**: 010_order_workflow_engine_dev_prd  
**Version**: 1.0  
**Owner**: Backend Team  
**Dependencies**: 001-009  
**Related Requirements**: Workflow state machine

---

## 1. Overview

Implement configurable workflow state machine for order processing with quality gates, validation rules, and audit logging.

### Workflow States

```
intake → preparation → sorting → washing → drying →
finishing → assembly → qa → packing → ready →
out_for_delivery → delivered → closed
```

---

## 2. Functional Requirements

### FR-WF-001: State Machine

- Define valid state transitions
- Enforce transition rules
- Quality gates (assembly complete + QA pass → ready)
- Configurable workflows per service category

### FR-WF-002: Transition Validation

- Check prerequisites before transition
- Validate required data
- Enforce role permissions
- Log all transitions

### FR-WF-003: Configurable Workflows

- Skip steps based on features (no assembly, no QA)
- Different flows per service (dry cleaning vs ironing)
- Express workflow shortcuts
- B2B custom workflows

### FR-WF-004: Workflow Hooks

- Trigger notifications on state change
- Update metrics/analytics
- Run background jobs
- Integration webhooks

---

## 3. Technical Design

### State Transition Matrix

```typescript
const WORKFLOW_TRANSITIONS = {
  intake: ["preparation", "cancelled"],
  preparation: ["sorting", "issue_to_solve"],
  sorting: ["washing", "ironing"], // branch based on service
  washing: ["drying"],
  drying: ["finishing"],
  finishing: ["assembly", "qa"], // skip assembly if disabled
  assembly: ["qa"],
  qa: ["packing", "rework"],
  rework: ["sorting"], // back to processing
  packing: ["ready"],
  ready: ["out_for_delivery", "pickup"],
  out_for_delivery: ["delivered", "failed_delivery"],
  failed_delivery: ["out_for_delivery", "ready"],
  delivered: ["closed", "issue_to_solve"],
  issue_to_solve: ["sorting", "closed"],
  closed: [],
};
```

### Quality Gates

```typescript
const QUALITY_GATES = {
  ready: async (orderId) => {
    // Gate 1: Assembly must be 100% complete
    const assemblyComplete = await checkAssemblyComplete(orderId);
    if (!assemblyComplete) {
      throw new Error("Assembly not complete");
    }

    // Gate 2: QA must pass
    const qaPass = await checkQAPass(orderId);
    if (!qaPass) {
      throw new Error("QA check not passed");
    }

    return true;
  },
};
```

### Workflow Execution

```typescript
async function transitionOrder(
  orderId: string,
  toStatus: string,
  context: {
    userId: string;
    notes?: string;
    metadata?: Record<string, any>;
  }
): Promise<Order> {
  const order = await getOrder(orderId);

  // 1. Validate transition is allowed
  const allowedTransitions = WORKFLOW_TRANSITIONS[order.status];
  if (!allowedTransitions.includes(toStatus)) {
    throw new Error(`Cannot transition from ${order.status} to ${toStatus}`);
  }

  // 2. Check quality gates
  if (QUALITY_GATES[toStatus]) {
    await QUALITY_GATES[toStatus](orderId);
  }

  // 3. Update order status
  await db.update("org_orders_mst", {
    where: { id: orderId },
    data: { status: toStatus, updated_at: new Date() },
  });

  // 4. Log transition
  await db.insert("org_workflow_states_log", {
    order_id: orderId,
    tenant_org_id: order.tenant_org_id,
    from_status: order.status,
    to_status: toStatus,
    transition_by: context.userId,
    notes: context.notes,
    metadata: context.metadata,
  });

  // 5. Trigger hooks
  await triggerWorkflowHooks(orderId, toStatus);

  return await getOrder(orderId);
}
```

---

## 4. Implementation Plan (5 days)

### Phase 1: State Machine Core (2 days)

- Define transition matrix
- Implement validation logic
- Quality gate framework
- Transition function

### Phase 2: Workflow Configuration (2 days)

- Configurable workflows per tenant
- Service-specific flows
- Feature flag integration
- Configuration UI

### Phase 3: Hooks & Logging (1 day)

- Workflow hooks system
- Audit logging
- Webhook triggers
- Analytics events

---

## 5. API Endpoints

```typescript
POST   /api/v1/orders/:id/transition    // Transition to new status
GET    /api/v1/orders/:id/transitions   // Get available transitions
GET    /api/v1/orders/:id/history       // Get state history
GET    /api/v1/workflows/config         // Get workflow config
PATCH  /api/v1/workflows/config         // Update workflow config
```

---

## 6. Success Metrics

| Metric                   | Target |
| ------------------------ | ------ |
| Transition Time          | < 50ms |
| Quality Gate Enforcement | 100%   |
| Audit Log Complete       | 100%   |

---

## 7. Acceptance Checklist

- [ ] State machine implemented
- [ ] Transition validation working
- [ ] Quality gates enforced
- [ ] Audit logging complete
- [ ] Configurable workflows
- [ ] Hooks triggering correctly

---

**Document Version**: 1.0
