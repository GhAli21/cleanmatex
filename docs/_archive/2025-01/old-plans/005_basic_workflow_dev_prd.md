# Basic Workflow & Status Transitions - Implementation Plan

**PRD ID**: 005_basic_workflow_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 1 week
**Dependencies**: PRD-001 (Auth), PRD-004 (Order Intake)

** Feature Docs Folder is **  F:\jhapp\cleanmatex\docs\features\005_basic_workflow )

---

## Overview

Implement a simple status-based workflow engine for order lifecycle management. MVP focuses on essential transitions: intake → processing → ready → delivered, with basic validation and status tracking.

---

## Business Value

- **Visibility**: Real-time order status for staff and customers
- **Accountability**: Track who changed status and when
- **Efficiency**: Streamlined workflow reduces bottlenecks
- **SLA Tracking**: Monitor Ready-By compliance

---

## Requirements

### Functional Requirements

- **FR-WORKFLOW-001**: Order status state machine (intake → processing → ready → out_for_delivery → delivered)
- **FR-WORKFLOW-002**: Status transition validation (can't skip states)
- **FR-WORKFLOW-003**: Status change audit trail (who, when, from, to)
- **FR-WORKFLOW-004**: Bulk status update (multiple orders)
- **FR-WORKFLOW-005**: Status filter in order list
- **FR-WORKFLOW-006**: Status timeline visualization
- **FR-WORKFLOW-007**: Auto-transition from preparation complete → processing
- **FR-WORKFLOW-008**: Ready-By date compliance tracking
- **FR-WORKFLOW-009**: Overdue orders alert

### Non-Functional Requirements

- **NFR-WORKFLOW-001**: Status update response time < 200ms
- **NFR-WORKFLOW-002**: Support 10,000+ concurrent status queries
- **NFR-WORKFLOW-003**: Audit trail retention: 2 years

---

## Database Schema

```sql
-- org_orders_mst.status (already exists)
-- Enum values: intake, processing, ready, out_for_delivery, delivered, cancelled

-- Order status history (audit trail)
CREATE TABLE IF NOT EXISTS org_order_status_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  tenant_org_id     UUID NOT NULL,
  from_status       VARCHAR(50),
  to_status         VARCHAR(50) NOT NULL,
  changed_by        UUID REFERENCES auth.users(id),
  changed_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes             TEXT,
  metadata          JSONB
);

CREATE INDEX idx_status_history_order ON org_order_status_history(order_id);
CREATE INDEX idx_status_history_tenant ON org_order_status_history(tenant_org_id, changed_at DESC);

-- Status workflow rules (configurable per tenant - future)
CREATE TABLE IF NOT EXISTS org_workflow_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  from_status       VARCHAR(50) NOT NULL,
  to_status         VARCHAR(50) NOT NULL,
  is_allowed        BOOLEAN DEFAULT true,
  requires_role     VARCHAR(50), -- Optional: role requirement for transition
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default workflow rules
INSERT INTO org_workflow_rules (tenant_org_id, from_status, to_status, is_allowed)
SELECT id, 'intake', 'processing', true FROM org_tenants_mst
ON CONFLICT DO NOTHING;
-- ... (add other default transitions)
```

---

## API Endpoints

### Status Transitions

#### PATCH /v1/orders/:orderId/status
Update order status.

**Request**:
```json
{
  "status": "ready",
  "notes": "All items processed and packed"
}
```

**Response** (200):
```json
{
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-20251010-0001",
    "status": "ready",
    "previousStatus": "processing",
    "readyAt": "2025-10-10T14:30:00Z",
    "changedBy": {
      "id": "user-uuid",
      "name": "Jane Operator"
    },
    "changedAt": "2025-10-10T14:30:00Z"
  }
}
```

#### POST /v1/orders/bulk-status
Bulk update order statuses.

**Request**:
```json
{
  "orderIds": ["order-uuid-1", "order-uuid-2", "order-uuid-3"],
  "status": "processing",
  "notes": "Moved to processing after preparation"
}
```

**Response** (200):
```json
{
  "updated": 3,
  "failed": 0,
  "results": [
    {
      "orderId": "order-uuid-1",
      "orderNumber": "ORD-20251010-0001",
      "status": "processing",
      "success": true
    },
    {
      "orderId": "order-uuid-2",
      "orderNumber": "ORD-20251010-0002",
      "status": "processing",
      "success": true
    },
    {
      "orderId": "order-uuid-3",
      "orderNumber": "ORD-20251010-0003",
      "status": "processing",
      "success": true
    }
  ]
}
```

#### GET /v1/orders/:orderId/status-history
Get order status history.

**Response** (200):
```json
{
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-20251010-0001",
    "currentStatus": "ready"
  },
  "history": [
    {
      "id": "history-uuid-1",
      "fromStatus": null,
      "toStatus": "intake",
      "changedBy": {
        "id": "user-uuid-1",
        "name": "John Admin"
      },
      "changedAt": "2025-10-10T10:00:00Z",
      "notes": "Order created"
    },
    {
      "id": "history-uuid-2",
      "fromStatus": "intake",
      "toStatus": "processing",
      "changedBy": {
        "id": "user-uuid-2",
        "name": "Jane Operator"
      },
      "changedAt": "2025-10-10T10:15:00Z",
      "notes": "Preparation completed"
    },
    {
      "id": "history-uuid-3",
      "fromStatus": "processing",
      "toStatus": "ready",
      "changedBy": {
        "id": "user-uuid-2",
        "name": "Jane Operator"
      },
      "changedAt": "2025-10-10T14:30:00Z",
      "notes": "All items processed and packed"
    }
  ]
}
```

### Workflow Monitoring

#### GET /v1/orders/overdue
Get orders past Ready-By date.

**Query Parameters**:
- `page`, `limit`
- `status`: Filter by status (optional)

**Response** (200):
```json
{
  "overdue": [
    {
      "id": "order-uuid",
      "orderNumber": "ORD-20251009-0015",
      "customer": {
        "name": "Ahmed Al-Said",
        "phone": "+96890123456"
      },
      "status": "processing",
      "readyBy": "2025-10-09T18:00:00Z",
      "overdueHours": 20.5,
      "priority": "urgent"
    }
    // ... more overdue orders
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /v1/dashboard/workflow-stats
Get workflow statistics for dashboard.

**Response** (200):
```json
{
  "statusCounts": {
    "intake": 5,
    "processing": 25,
    "ready": 12,
    "out_for_delivery": 8,
    "delivered": 150
  },
  "overdueOrders": 3,
  "readyToday": 15,
  "deliveredToday": 20,
  "slaCompliance": {
    "onTime": 145,
    "late": 5,
    "percentage": 96.67
  }
}
```

---

## UI/UX Requirements

### Order Status Buttons (Order Detail)
- **Visual**: Status buttons in horizontal flow (intake → processing → ready → delivered)
- **Current Status**: Highlighted in primary color
- **Past Statuses**: Check mark icon, muted color
- **Future Statuses**: Grayed out, disabled
- **Action**: Click next status → Confirm modal → Update
- **Bilingual**: Status names in EN/AR

### Bulk Status Update (Order List)
- **Selection**: Checkbox per row, "Select All"
- **Action Bar**: Appears when items selected → Status dropdown → "Update" button
- **Confirmation**: Modal showing order count and new status
- **Result**: Success toast with count updated/failed

### Status Timeline (Order Detail)
- **Visual**: Vertical timeline with dates/times
- **Entries**: Status change events with user avatar, name, timestamp
- **Details**: Expandable notes per entry
- **Auto-refresh**: Update when status changes

### Overdue Orders Widget (Dashboard)
- **Count**: Red badge with overdue count
- **List**: Table of overdue orders with hours late
- **Action**: Click order → Navigate to detail
- **Alert**: Email notification at 9am daily (future)

---

## Technical Implementation

### Backend Tasks

1. **WorkflowService**
   - `changeStatus()` - Validate and update status
   - `isTransitionAllowed()` - Check workflow rules
   - `bulkChangeStatus()` - Update multiple orders
   - `getStatusHistory()` - Get audit trail
   - `getOverdueOrders()` - Find orders past Ready-By

2. **Status Transition Validation**
   - Validate allowed transitions (e.g., can't go from intake → delivered)
   - Check role permissions (future)
   - Prevent duplicate status updates

3. **Auto-transition Logic**
   - When preparation completed → auto-change to "processing"
   - When payment confirmed → keep status but update payment_status

4. **Audit Trail**
   - Create history record on every status change
   - Store user, timestamp, old/new status, notes

5. **SLA Tracking**
   - Calculate overdue hours: `NOW() - ready_by`
   - Daily job to find overdue orders
   - Notification trigger (future - PRD-019)

### Frontend Tasks

1. **Status Transition Component**
   - Stepper/timeline UI component
   - Click to change status
   - Confirmation modal with notes field

2. **Bulk Actions**
   - Row selection state management
   - Bulk action toolbar
   - Status update modal

3. **Status History Timeline**
   - Vertical timeline component
   - Real-time updates (polling or websocket - future)

4. **Dashboard Widgets**
   - Status counts cards
   - Overdue orders table
   - SLA compliance chart

### Database Migrations

```sql
-- Migration: 0008_workflow_status_history.sql

CREATE TABLE IF NOT EXISTS org_order_status_history (
  -- schema as above
);

CREATE TABLE IF NOT EXISTS org_workflow_rules (
  -- schema as above
);

-- Seed default rules for all existing tenants
INSERT INTO org_workflow_rules (tenant_org_id, from_status, to_status, is_allowed)
SELECT id, 'intake', 'processing', true FROM org_tenants_mst;
-- ... more transitions
```

---

## Acceptance Criteria

- [ ] Order status can be updated via API
- [ ] Status transitions follow workflow rules (can't skip states)
- [ ] Status change creates audit trail entry
- [ ] Bulk status update works for 50+ orders
- [ ] Status history displayed in order detail
- [ ] Overdue orders identified and listed
- [ ] Dashboard shows accurate status counts
- [ ] Auto-transition from preparation → processing works

---

## Testing Requirements

### Unit Tests
- `isTransitionAllowed()` validates transitions correctly
- `changeStatus()` creates audit trail entry
- `getOverdueOrders()` calculates hours correctly

### Integration Tests
- PATCH /v1/orders/:id/status → updates status and creates history
- POST /v1/orders/bulk-status → updates multiple orders
- GET /v1/orders/overdue → returns overdue orders

### E2E Tests
- Order detail → Click "Ready" button → Confirm → Status updated
- Order list → Select 10 orders → Bulk update to "Processing" → Verify

---

## References

- Requirements: Section 3.2 (Workflow & Operations)
- UC04: Per-Piece Scan (future - Assembly workflow)
- Related PRDs: PRD-004 (Order Intake), PRD-009 (Assembly & QA - P1)
- Additional Information in @docs/features/005_basic_workflow_dev_prd/005_additional_info.md

---

**Status**: Ready for Implementation
**Estimated Effort**: 40 hours (1 week with 2 developers)
