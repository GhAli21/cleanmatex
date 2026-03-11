# Orders Complete Workflow Implementation Plan

**Version:** 1.0.0
**Created:** 2026-01-14
**Status:** Planning Phase
**Author:** AI-Generated from Documentation Analysis

---

## Executive Summary

This plan outlines the complete implementation of the Orders workflow system for CleanMateX, covering all 14 stages from DRAFT to CLOSED. The workflow is **configuration-driven**, allowing per-tenant and per-service-category customization.

---

## 1. Current Implementation Status

### 1.1 Existing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Orders List Page | ✅ Implemented | `/dashboard/orders/page.tsx` |
| New Order Screen | ✅ Implemented | `/dashboard/orders/new/page.tsx` |
| Order Detail Page | ✅ Implemented | `/dashboard/orders/[id]/page.tsx` |
| Preparation Page | ✅ Implemented | `/dashboard/preparation/page.tsx` |
| Processing Page | ✅ Implemented | `/dashboard/processing/page.tsx` |
| Assembly Page | 🚧 Partial | `/dashboard/assembly/page.tsx` |
| QA Page | 🚧 Partial | `/dashboard/qa/page.tsx` |
| Ready Page | 🚧 Partial | `/dashboard/ready/page.tsx` |
| Status Transition API | ✅ Implemented | `/api/v1/orders/[id]/transition/route.ts` |
| Status History API | ✅ Implemented | `/api/orders/[orderId]/status-history/route.ts` |
| Bulk Status Update | ✅ Implemented | `/api/orders/bulk-status/route.ts` |

### 1.2 Critical Gaps (Blocking Production)

1. **Assembly & QA Workflow** - 0% Complete
2. **Quality Gates Enforcement** - Not implemented
3. **Per-Piece Scanning** - 0% Complete
4. **Digital Receipts** - 10% Complete
5. **Delivery Management & POD** - 0% Complete

---

## 2. Order Workflow - 14 Stages

### 2.1 Complete Status Flow

```
DRAFT → INTAKE → PREPARATION → SORTING → WASHING → DRYING →
FINISHING → ASSEMBLY → QA → PACKING → READY → OUT_FOR_DELIVERY →
DELIVERED → CLOSED

Terminal States: CANCELLED, ON_HOLD
```

### 2.2 Stage Definitions

| # | Stage | Status Code | Description | Dashboard Page | Primary Actions |
|---|-------|-------------|-------------|----------------|-----------------|
| 1 | Draft | `DRAFT` | Order created, not submitted | All Orders | Edit, Submit, Cancel |
| 2 | Intake | `INTAKE` | Order received at counter | All Orders | Start Preparation |
| 3 | Preparation | `PREPARATION` | Items being tagged/photographed | `/preparation` | Add Items, Complete |
| 4 | Sorting | `SORTING` | Items sorted by type | All Orders | Auto-advance |
| 5 | Washing | `WASHING` | Main wash cycle | Processing | Mark Complete |
| 6 | Drying | `DRYING` | Drying process | Processing | Mark Complete |
| 7 | Finishing | `FINISHING` | Ironing/pressing | Processing | Mark Complete |
| 8 | Assembly | `ASSEMBLY` | Items grouped back | `/assembly` | Scan, Verify |
| 9 | QA | `QA` | Quality inspection | `/qa` | Pass/Fail |
| 10 | Packing | `PACKING` | Bagging items | All Orders | Generate List |
| 11 | Ready | `READY` | Awaiting pickup/delivery | `/ready` | Dispatch, Pickup |
| 12 | Out for Delivery | `OUT_FOR_DELIVERY` | Driver en route | All Orders | Track, POD |
| 13 | Delivered | `DELIVERED` | Customer received | All Orders | Close, Issue |
| 14 | Closed | `CLOSED` | Order archived | All Orders | View Only |

### 2.3 Status Transition Matrix

```typescript
const STATUS_TRANSITIONS = {
  DRAFT: ['INTAKE', 'CANCELLED'],
  INTAKE: ['PREPARATION', 'CANCELLED'],
  PREPARATION: ['SORTING', 'CANCELLED'],
  SORTING: ['WASHING', 'FINISHING'], // Service-dependent
  WASHING: ['DRYING', 'ON_HOLD'],
  DRYING: ['FINISHING', 'ON_HOLD'],
  FINISHING: ['ASSEMBLY', 'QA'], // Config: skip assembly if disabled
  ASSEMBLY: ['QA'],
  QA: ['PACKING', 'WASHING'], // Pass → PACKING, Fail → WASHING (rework)
  PACKING: ['READY'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED'], // Delivery vs Pickup
  OUT_FOR_DELIVERY: ['DELIVERED', 'READY'], // Delivered or Failed
  DELIVERED: ['CLOSED', 'INTAKE'], // Issue → back to INTAKE
  CLOSED: [], // Terminal
  CANCELLED: [], // Terminal
  ON_HOLD: ['WASHING', 'DRYING', 'FINISHING'] // Resume to previous
};
```

---

## 3. Screen-by-Screen Implementation

### 3.1 All Orders Page (`/dashboard/orders`)

**Purpose:** Master order list showing all orders regardless of status

**Current Status:** ✅ Implemented

**Enhancements Needed:**
- [ ] Add workflow status color coding
- [ ] Add SLA countdown timers
- [ ] Add bulk action bar
- [ ] Add overdue order highlighting
- [ ] Add quick status filter chips

**Components:**
- `OrderTable` - Main data table with columns
- `OrderFiltersBar` - Status, date, search filters
- `OrderStatsCards` - Count per status
- `BulkStatusUpdate` - Modal for bulk changes
- `OrderStatusBadge` - Color-coded status display

**API Endpoints:**
```
GET  /api/v1/orders                    - List orders with filters
GET  /api/v1/orders/[id]               - Get order details
POST /api/orders/bulk-status           - Bulk update status
GET  /api/orders/overdue               - Get overdue orders
```

### 3.2 New Order Screen (`/dashboard/orders/new`)

**Purpose:** Create new orders with customer selection, items, and scheduling

**Current Status:** ✅ Implemented

**Enhancements Needed:**
- [ ] Connect to workflow configuration for initial status
- [ ] Add Quick Drop mode (sets status to PREPARATION)
- [ ] Add normal mode (sets status to INTAKE or PROCESSING)
- [ ] Calculate `ready_by_at` from workflow configuration
- [ ] Add receipt preview before submission

**Flow Logic:**
```typescript
// Determine initial status based on order type
function getInitialStatus(orderType: string, hasItems: boolean): string {
  if (orderType === 'QUICK_DROP') {
    return hasItems ? 'PROCESSING' : 'PREPARATION';
  }
  return 'INTAKE';
}
```

**Components:**
- `CustomerPickerModal` - Select/create customer
- `CategoryTabs` - Service category selection
- `ProductGrid` - Item selection grid
- `ItemCartList` - Selected items summary
- `OrderSummaryPanel` - Totals and ready date
- `ReadyDatePickerModal` - Schedule selection
- `PaymentModal` - Payment collection

### 3.3 Preparation Page (`/dashboard/preparation`)

**Purpose:** Itemize Quick Drop orders - add individual items with details

**Current Status:** ✅ Implemented

**Filter:** `current_status = 'PREPARATION'`

**Enhancements Needed:**
- [ ] Add photo upload for items
- [ ] Add barcode/QR generation per item
- [ ] Add stain/condition tagging
- [ ] Add item label printing
- [ ] Add voice notes capture
- [ ] Connect transition to next status

**Components:**
- `FastItemizer` - Quick item addition interface
- `ItemList` - List of added items
- `PresetButtons` - Common item presets
- `PricePreview` - Running total
- `PrintItemLabels` - Label printing

**Flow:**
1. Order arrives with Quick Drop flag
2. Staff scans/receives items
3. Add each item with: garment type, service, stains, notes, photo
4. Generate barcode for each item
5. Print labels
6. Complete → Status changes to `SORTING`

**API Endpoints:**
```
GET  /api/v1/preparation               - List orders in preparation
POST /api/v1/preparation/[id]/start    - Start preparation
POST /api/v1/preparation/[id]/items    - Add item
PUT  /api/v1/preparation/[id]/items/[itemId] - Update item
POST /api/v1/preparation/[id]/complete - Complete preparation
```

### 3.4 Processing Page (`/dashboard/processing`)

**Purpose:** Track items through cleaning stages (Sorting → Washing → Drying → Finishing)

**Current Status:** ✅ Implemented

**Filter:** `current_status IN ('SORTING', 'WASHING', 'DRYING', 'FINISHING')`

**Enhancements Needed:**
- [ ] Add per-piece tracking
- [ ] Add step completion buttons
- [ ] Add issue flagging per item
- [ ] Add machine assignment
- [ ] Add batch processing support

**Sub-Stages (Per Item):**
```typescript
const PROCESSING_STEPS = [
  'sorting',    // Step 1: Sort by fabric/color
  'washing',    // Step 2: Wash cycle
  'drying',     // Step 3: Dry
  'finishing',  // Step 4: Iron/press
  'complete'    // Step 5: Ready for assembly
];
```

**Components:**
- `ProcessingTable` - Orders in processing
- `ProcessingModal` - Item-level processing
- `ProcessingItemRow` - Individual item with steps
- `ProcessingPieceRow` - Per-piece tracking
- `ProcessingFiltersBar` - Status/stage filters
- `ProcessingStatsCards` - Counts per stage

**Flow:**
1. Order enters Processing queue
2. For each item:
   - Sort by fabric/color → Mark sorted
   - Wash → Mark washed
   - Dry → Mark dried
   - Finish → Mark finished
3. When all items complete → Status changes to `ASSEMBLY`

**API Endpoints:**
```
GET  /api/v1/orders?status=processing  - List processing orders
PUT  /api/v1/orders/[id]/items/[itemId]/step - Update item step
POST /api/v1/orders/[id]/items/[itemId]/complete - Complete item
POST /api/v1/orders/[id]/batch-update  - Batch update items
```

### 3.5 Assembly Page (`/dashboard/assembly`)

**Purpose:** Verify all pieces are assembled back into the order

**Current Status:** 🚧 Partial (API exists, UI incomplete)

**Filter:** `current_status = 'ASSEMBLY'`

**Implementation Required:**
- [ ] Create assembly task from order
- [ ] Per-piece scanning verification
- [ ] Exception handling (missing/wrong/damaged)
- [ ] Location/bin assignment
- [ ] Assembly completion validation
- [ ] Auto-transition to QA when complete

**Components (To Create):**
- `AssemblyDashboard` - Orders awaiting assembly
- `AssemblyTaskCard` - Individual order assembly task
- `PieceScannerInterface` - Barcode/QR scanner
- `AssemblyChecklist` - Items to verify
- `ExceptionDialog` - Report missing/damaged
- `BinAssignment` - Location management

**Flow:**
1. Order enters Assembly queue after Processing
2. Create Assembly Task for order
3. Staff scans each piece barcode
4. System verifies against expected pieces
5. Handle exceptions:
   - Missing piece → Log exception, notify
   - Wrong piece → Flag for investigation
   - Damaged piece → Log with photo
6. When 100% pieces scanned → Mark complete
7. Auto-transition to `QA`

**Database Tables:**
```sql
-- Assembly tasks
CREATE TABLE org_assembly_tasks_mst (
  id UUID PRIMARY KEY,
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed
  expected_pieces INTEGER,
  scanned_pieces INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  assigned_to UUID,
  bin_location VARCHAR(50),
  -- Audit fields
);

-- Assembly exceptions
CREATE TABLE org_assembly_exceptions (
  id UUID PRIMARY KEY,
  tenant_org_id UUID NOT NULL,
  task_id UUID NOT NULL,
  exception_type VARCHAR(20), -- missing, wrong, damaged
  piece_id UUID,
  notes TEXT,
  photo_url VARCHAR(500),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP,
  -- Audit fields
);
```

**API Endpoints:**
```
GET  /api/v1/assembly/dashboard        - Assembly dashboard stats
GET  /api/v1/assembly/tasks            - List assembly tasks
POST /api/v1/assembly/tasks/[taskId]/start - Start assembly
POST /api/v1/assembly/tasks/[taskId]/scan  - Scan piece
POST /api/v1/assembly/tasks/[taskId]/exceptions - Report exception
POST /api/v1/assembly/tasks/[taskId]/pack  - Complete assembly
```

### 3.6 QA Page (`/dashboard/qa`)

**Purpose:** Quality inspection gate - pass or fail orders

**Current Status:** 🚧 Partial (API exists, UI incomplete)

**Filter:** `current_status = 'QA'`

**Implementation Required:**
- [ ] QA inspection checklist per item
- [ ] Pass/Fail decision with notes
- [ ] Photo documentation for failures
- [ ] Rework routing (fail → back to WASHING)
- [ ] Quality gates enforcement

**Components (To Create):**
- `QADashboard` - Orders awaiting QA
- `QAInspectionForm` - Per-item inspection
- `QAChecklist` - Standard quality checks
- `QAFailureDialog` - Document failures with photos
- `QAReworkConfirm` - Confirm rework routing

**Quality Checks:**
```typescript
const QA_CHECKLIST = [
  { id: 'cleanliness', label: 'Cleanliness', required: true },
  { id: 'stain_removal', label: 'Stain Removal', required: true },
  { id: 'pressing', label: 'Pressing Quality', required: true },
  { id: 'damage', label: 'No Damage', required: true },
  { id: 'odor', label: 'No Odor', required: true },
  { id: 'packaging', label: 'Ready for Packing', required: true },
];
```

**Flow:**
1. Order enters QA queue after Assembly
2. Inspector reviews each item:
   - Check cleanliness ✓
   - Check stain removal ✓
   - Check pressing quality ✓
   - Check for damage ✓
   - Check no odor ✓
3. Decision:
   - **Pass** → All checks passed → Status → `PACKING`
   - **Fail** → Log failure reason + photo → Status → `WASHING` (rework)

**API Endpoints:**
```
GET  /api/v1/qa/orders                 - List QA orders
POST /api/v1/assembly/tasks/[taskId]/qa - Submit QA decision
GET  /api/v1/qa/stats                  - QA statistics
```

### 3.7 Ready Page (`/dashboard/ready`)

**Purpose:** Orders ready for customer pickup or delivery dispatch

**Current Status:** 🚧 Partial (Basic page exists)

**Filter:** `current_status = 'READY'`

**Implementation Required:**
- [ ] Customer notification triggers
- [ ] Delivery scheduling interface
- [ ] Pickup confirmation flow
- [ ] OTP generation for delivery
- [ ] Packing list generation
- [ ] Receipt printing

**Components (To Create):**
- `ReadyOrdersList` - Orders awaiting pickup/delivery
- `CustomerNotifyButton` - Send ready notification
- `DeliveryScheduleModal` - Schedule delivery
- `PickupConfirmDialog` - Confirm in-store pickup
- `PackingListPrint` - Generate packing list
- `ReceiptPreview` - Preview/print receipt

**Flow:**
1. Order enters Ready queue after QA
2. System sends notification to customer (WhatsApp/SMS)
3. For **Pickup**:
   - Customer arrives
   - Staff confirms pickup → Status → `DELIVERED`
4. For **Delivery**:
   - Assign to driver/route
   - Generate OTP
   - Dispatch → Status → `OUT_FOR_DELIVERY`

**API Endpoints:**
```
GET  /api/v1/orders?status=ready       - List ready orders
POST /api/v1/delivery/orders/[orderId]/generate-otp - Generate OTP
POST /api/v1/orders/[id]/transition    - Transition to next status
POST /api/v1/receipts/orders/[orderId] - Generate receipt
```

---

## 4. Configuration-Driven Workflow System

### 4.1 Workflow Configuration Schema

```typescript
interface WorkflowConfig {
  tenant_org_id: string;
  service_category?: string; // Optional: specific to service

  // Enabled stages
  enabled_stages: string[];

  // Transition rules
  transitions: {
    [fromStatus: string]: string[];
  };

  // Feature flags
  features: {
    use_assembly: boolean;      // Enable assembly stage
    use_qa: boolean;            // Enable QA stage
    require_piece_scan: boolean; // Require per-piece scanning
    auto_advance: boolean;      // Auto-advance certain stages
    require_photos: boolean;    // Require photos at intake
  };

  // Quality gates
  quality_gates: {
    before_ready: {
      require_assembly_complete: boolean;
      require_qa_pass: boolean;
      require_all_items_processed: boolean;
    };
  };

  // SLA configuration
  sla: {
    default_hours: number;      // Default ready-by hours
    express_hours: number;      // Express service hours
    by_service: {
      [serviceCode: string]: number;
    };
  };
}
```

### 4.2 Database Table

```sql
CREATE TABLE org_workflow_settings_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  service_category_code VARCHAR(30), -- NULL = default for tenant

  -- Workflow stages (array of enabled stages)
  enabled_stages JSONB NOT NULL DEFAULT '["INTAKE","PREPARATION","PROCESSING","ASSEMBLY","QA","PACKING","READY","DELIVERED","CLOSED"]',

  -- Transition rules
  transitions JSONB NOT NULL DEFAULT '{}',

  -- Feature flags
  features JSONB NOT NULL DEFAULT '{
    "use_assembly": true,
    "use_qa": true,
    "require_piece_scan": false,
    "auto_advance": false,
    "require_photos": false
  }',

  -- Quality gates
  quality_gates JSONB NOT NULL DEFAULT '{
    "before_ready": {
      "require_assembly_complete": true,
      "require_qa_pass": true,
      "require_all_items_processed": true
    }
  }',

  -- SLA configuration
  sla JSONB NOT NULL DEFAULT '{
    "default_hours": 48,
    "express_hours": 24
  }',

  -- Audit fields
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),

  UNIQUE(tenant_org_id, service_category_code)
);
```

### 4.3 Service-Specific Workflow Examples

**Dry Cleaning (Full Workflow):**
```json
{
  "enabled_stages": ["INTAKE", "PREPARATION", "SORTING", "WASHING", "DRYING", "FINISHING", "ASSEMBLY", "QA", "PACKING", "READY", "DELIVERED", "CLOSED"],
  "features": {
    "use_assembly": true,
    "use_qa": true,
    "require_piece_scan": true
  }
}
```

**Press Only (Short Workflow):**
```json
{
  "enabled_stages": ["INTAKE", "FINISHING", "QA", "PACKING", "READY", "DELIVERED", "CLOSED"],
  "features": {
    "use_assembly": false,
    "use_qa": true,
    "require_piece_scan": false
  }
}
```

**Repairs (Custom Workflow):**
```json
{
  "enabled_stages": ["INTAKE", "PREPARATION", "PROCESSING", "QA", "PACKING", "READY", "DELIVERED", "CLOSED"],
  "features": {
    "use_assembly": false,
    "use_qa": true,
    "require_piece_scan": false
  },
  "sla": {
    "default_hours": 72
  }
}
```

### 4.4 Workflow Service Implementation

```typescript
// lib/services/workflow-service.ts

export class WorkflowService {
  /**
   * Get workflow configuration for tenant + service category
   */
  async getWorkflowConfig(
    tenantId: string,
    serviceCategory?: string
  ): Promise<WorkflowConfig> {
    // 1. Try service-specific config
    if (serviceCategory) {
      const specific = await this.db.query(`
        SELECT * FROM org_workflow_settings_cf
        WHERE tenant_org_id = $1 AND service_category_code = $2
      `, [tenantId, serviceCategory]);

      if (specific) return specific;
    }

    // 2. Fall back to tenant default
    const tenantDefault = await this.db.query(`
      SELECT * FROM org_workflow_settings_cf
      WHERE tenant_org_id = $1 AND service_category_code IS NULL
    `, [tenantId]);

    if (tenantDefault) return tenantDefault;

    // 3. Fall back to system default
    return this.getSystemDefault();
  }

  /**
   * Check if transition is allowed
   */
  async isTransitionAllowed(
    orderId: string,
    fromStatus: string,
    toStatus: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const order = await this.getOrder(orderId);
    const config = await this.getWorkflowConfig(order.tenant_org_id, order.service_category);

    // Check if toStatus is in allowed transitions
    const allowedTransitions = config.transitions[fromStatus] || [];
    if (!allowedTransitions.includes(toStatus)) {
      return {
        allowed: false,
        reason: `Transition from ${fromStatus} to ${toStatus} not allowed`
      };
    }

    // Check quality gates for READY
    if (toStatus === 'READY') {
      const gateResult = await this.checkQualityGates(orderId, config);
      if (!gateResult.passed) {
        return { allowed: false, reason: gateResult.reason };
      }
    }

    return { allowed: true };
  }

  /**
   * Check quality gates before READY
   */
  async checkQualityGates(
    orderId: string,
    config: WorkflowConfig
  ): Promise<{ passed: boolean; reason?: string; blockers?: string[] }> {
    const gates = config.quality_gates.before_ready;
    const blockers: string[] = [];

    // Gate 1: Assembly complete
    if (gates.require_assembly_complete && config.features.use_assembly) {
      const assemblyComplete = await this.isAssemblyComplete(orderId);
      if (!assemblyComplete) {
        blockers.push('Assembly not complete - not all pieces scanned');
      }
    }

    // Gate 2: QA passed
    if (gates.require_qa_pass && config.features.use_qa) {
      const qaPassed = await this.isQAPassed(orderId);
      if (!qaPassed) {
        blockers.push('QA not passed - quality inspection required');
      }
    }

    // Gate 3: All items processed
    if (gates.require_all_items_processed) {
      const allProcessed = await this.areAllItemsProcessed(orderId);
      if (!allProcessed) {
        blockers.push('Not all items processed');
      }
    }

    return {
      passed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers.join('; ') : undefined,
      blockers
    };
  }

  /**
   * Execute status transition
   */
  async transitionOrder(
    orderId: string,
    toStatus: string,
    userId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const order = await this.getOrder(orderId);
    const fromStatus = order.current_status;

    // Validate transition
    const validation = await this.isTransitionAllowed(orderId, fromStatus, toStatus);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    // Execute transition in transaction
    await this.db.transaction(async (tx) => {
      // Update order status
      await tx.query(`
        UPDATE org_orders_mst
        SET current_status = $1, updated_at = NOW(), updated_by = $2
        WHERE id = $3
      `, [toStatus, userId, orderId]);

      // Log to history
      await tx.query(`
        INSERT INTO org_order_status_history
        (tenant_org_id, order_id, from_status, to_status, changed_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [order.tenant_org_id, orderId, fromStatus, toStatus, userId, notes]);
    });

    // Trigger post-transition hooks
    await this.triggerTransitionHooks(orderId, fromStatus, toStatus);

    return { success: true };
  }
}
```

---

## 5. Quality Gates Implementation

### 5.1 Gate Before READY Status

**Blocking Conditions:**
1. Assembly not 100% complete
2. QA not passed
3. Unresolved item issues
4. Missing required photos (if configured)

**Implementation:**

```typescript
// lib/services/quality-gates.ts

export async function canMoveToReady(orderId: string): Promise<{
  canMove: boolean;
  blockers: QualityBlocker[];
}> {
  const order = await getOrderWithItems(orderId);
  const config = await getWorkflowConfig(order.tenant_org_id);
  const blockers: QualityBlocker[] = [];

  // Gate 1: Assembly completeness
  if (config.features.use_assembly) {
    const assemblyTask = await getAssemblyTask(orderId);
    if (!assemblyTask || assemblyTask.status !== 'completed') {
      blockers.push({
        gate: 'assembly',
        message: 'Assembly not complete',
        details: {
          expected: assemblyTask?.expected_pieces || 0,
          scanned: assemblyTask?.scanned_pieces || 0
        }
      });
    }
  }

  // Gate 2: QA pass
  if (config.features.use_qa) {
    const qaResult = await getQAResult(orderId);
    if (!qaResult || qaResult.decision !== 'PASS') {
      blockers.push({
        gate: 'qa',
        message: 'QA inspection not passed',
        details: {
          status: qaResult?.decision || 'NOT_INSPECTED',
          failedChecks: qaResult?.failed_checks || []
        }
      });
    }
  }

  // Gate 3: No unresolved issues
  const unresolvedIssues = await getUnresolvedIssues(orderId);
  if (unresolvedIssues.length > 0) {
    blockers.push({
      gate: 'issues',
      message: `${unresolvedIssues.length} unresolved issues`,
      details: { issues: unresolvedIssues }
    });
  }

  // Gate 4: All items processed
  const unprocessedItems = order.items.filter(
    item => item.processing_status !== 'complete'
  );
  if (unprocessedItems.length > 0) {
    blockers.push({
      gate: 'processing',
      message: `${unprocessedItems.length} items not fully processed`,
      details: { items: unprocessedItems.map(i => i.id) }
    });
  }

  return {
    canMove: blockers.length === 0,
    blockers
  };
}
```

### 5.2 UI Display of Quality Gates

```tsx
// components/QualityGateStatus.tsx

export function QualityGateStatus({ orderId }: { orderId: string }) {
  const { data: gateStatus } = useQuery({
    queryKey: ['quality-gates', orderId],
    queryFn: () => checkQualityGates(orderId)
  });

  if (!gateStatus) return <Skeleton />;

  return (
    <div className="space-y-2">
      <h4 className="font-medium">Quality Gates</h4>

      {gateStatus.canMove ? (
        <Badge variant="success">All Gates Passed</Badge>
      ) : (
        <div className="space-y-2">
          <Badge variant="warning">
            {gateStatus.blockers.length} Blockers
          </Badge>

          {gateStatus.blockers.map((blocker) => (
            <Alert key={blocker.gate} variant="destructive">
              <AlertTitle>{blocker.gate.toUpperCase()}</AlertTitle>
              <AlertDescription>{blocker.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 6. Implementation Timeline

### Phase 1: Core Workflow (Weeks 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Create `org_workflow_settings_cf` table | High | 2h |
| Implement `WorkflowService` | High | 8h |
| Update status transition API with config | High | 4h |
| Add quality gates check to transitions | High | 4h |
| Update order list with status colors | Medium | 2h |

### Phase 2: Assembly & QA (Weeks 3-6)

| Task | Priority | Effort |
|------|----------|--------|
| Assembly page UI implementation | Critical | 16h |
| Per-piece scanning interface | Critical | 8h |
| Exception handling workflow | Critical | 8h |
| QA inspection form | Critical | 8h |
| Pass/Fail decision flow | Critical | 4h |
| Rework routing | Critical | 4h |
| Quality gates enforcement | Critical | 8h |

### Phase 3: Ready & Delivery (Weeks 7-9)

| Task | Priority | Effort |
|------|----------|--------|
| Ready page enhancements | High | 8h |
| Customer notification triggers | High | 8h |
| Delivery scheduling | High | 8h |
| OTP generation/verification | High | 8h |
| POD capture (signature/photo) | High | 12h |

### Phase 4: Configuration UI (Weeks 10-12)

| Task | Priority | Effort |
|------|----------|--------|
| Workflow configuration admin UI | Medium | 16h |
| Service-specific workflow setup | Medium | 8h |
| SLA configuration UI | Medium | 4h |
| Feature flags management | Medium | 4h |

---

## 7. API Endpoint Summary

### Status Management
```
PATCH /api/v1/orders/[id]/transition     - Transition status (with validation)
GET   /api/v1/orders/[id]/transitions    - Get allowed transitions
GET   /api/v1/orders/[id]/history        - Get status history
POST  /api/orders/bulk-status            - Bulk status update
GET   /api/orders/overdue                - Get overdue orders
```

### Assembly
```
GET   /api/v1/assembly/dashboard         - Assembly dashboard stats
GET   /api/v1/assembly/tasks             - List assembly tasks
POST  /api/v1/assembly/tasks/[id]/start  - Start assembly task
POST  /api/v1/assembly/tasks/[id]/scan   - Scan piece
POST  /api/v1/assembly/tasks/[id]/exceptions - Report exception
POST  /api/v1/assembly/tasks/[id]/pack   - Complete assembly
```

### QA
```
GET   /api/v1/qa/orders                  - List QA orders
POST  /api/v1/assembly/tasks/[id]/qa     - Submit QA decision
GET   /api/v1/qa/stats                   - QA statistics
```

### Configuration
```
GET   /api/v1/workflows/config           - Get workflow config
PATCH /api/v1/workflows/config           - Update workflow config
GET   /api/v1/workflows/transitions      - Get transition matrix
```

### Delivery
```
POST  /api/v1/delivery/orders/[id]/generate-otp - Generate OTP
POST  /api/v1/delivery/orders/[id]/verify-otp   - Verify OTP
POST  /api/v1/delivery/orders/[id]/pod          - Submit POD
```

---

## 8. Testing Strategy

### Unit Tests
- [ ] Workflow transition validation
- [ ] Quality gate checks
- [ ] Configuration loading/merging
- [ ] SLA calculations

### Integration Tests
- [ ] Full order lifecycle (INTAKE → CLOSED)
- [ ] Rework loop (QA fail → WASHING → QA pass)
- [ ] Multi-tenant isolation
- [ ] Bulk operations

### E2E Tests
- [ ] New order creation → Ready flow
- [ ] Quick Drop → Preparation → Processing
- [ ] Assembly scanning workflow
- [ ] QA pass/fail decisions
- [ ] Delivery with OTP verification

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Order creation time | < 5 min | Counter to receipt |
| Assembly incident rate | < 0.5% | Missing/wrong pieces |
| QA pass rate | > 98% | First-time pass |
| OTP adoption | ≥ 95% | Verified deliveries |
| SLA compliance | < 3% breaches | On-time ready |
| Workflow completion | 100% | INTAKE to CLOSED |

---

## 10. Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize** based on current MVP needs
3. **Create database migrations** for new tables
4. **Implement Phase 1** (Core Workflow)
5. **Implement Phase 2** (Assembly & QA - Critical blocker)
6. **Test** with real-world scenarios
7. **Deploy** to staging for validation

---

## Appendix A: Status Color Coding

| Status | Color | Hex |
|--------|-------|-----|
| DRAFT | Gray | `#6B7280` |
| INTAKE | Blue | `#3B82F6` |
| PREPARATION | Blue | `#3B82F6` |
| SORTING | Purple | `#8B5CF6` |
| WASHING | Cyan | `#06B6D4` |
| DRYING | Teal | `#14B8A6` |
| FINISHING | Green | `#22C55E` |
| ASSEMBLY | Green | `#22C55E` |
| QA | Yellow | `#EAB308` |
| PACKING | Yellow | `#EAB308` |
| READY | Green | `#22C55E` |
| OUT_FOR_DELIVERY | Orange | `#F97316` |
| DELIVERED | Green | `#22C55E` |
| CLOSED | Gray | `#6B7280` |
| CANCELLED | Red | `#EF4444` |
| ON_HOLD | Red | `#EF4444` |

---

## Appendix B: i18n Keys

```json
{
  "workflow": {
    "status": {
      "draft": "Draft",
      "intake": "Intake",
      "preparation": "Preparation",
      "sorting": "Sorting",
      "washing": "Washing",
      "drying": "Drying",
      "finishing": "Finishing",
      "assembly": "Assembly",
      "qa": "Quality Check",
      "packing": "Packing",
      "ready": "Ready",
      "out_for_delivery": "Out for Delivery",
      "delivered": "Delivered",
      "closed": "Closed",
      "cancelled": "Cancelled",
      "on_hold": "On Hold"
    },
    "gates": {
      "assembly_required": "Assembly must be completed",
      "qa_required": "QA inspection must pass",
      "issues_pending": "Unresolved issues must be addressed"
    }
  }
}
```

---

**End of Implementation Plan**
