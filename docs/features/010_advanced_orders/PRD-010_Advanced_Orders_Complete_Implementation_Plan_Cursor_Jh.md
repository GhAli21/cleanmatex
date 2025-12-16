# This Plan Already Implemented for new order part

# PRD-010 Advanced Orders - Complete Implementation Plan- Already Implemented for new order part

## Overview

Implement comprehensive workflow-based order management system with configurable templates, role-based screens, split orders, issue tracking, and full audit trail. Replace existing order implementation entirely.

## Phase 1: Database Layer & Workflow Engine (Foundation)

### 1.1 Create Workflow Template Tables

**File**: `supabase/migrations/0018_workflow_templates.sql`

Create global workflow template system:

- `sys_workflow_template_cd` - Template definitions (WF_STANDARD, WF_ASSEMBLY_QA, etc.)
- `sys_workflow_template_stages` - Stages per template with sequence
- `sys_workflow_template_transitions` - Allowed transitions with rules
- Seed 5 default templates as specified in implementation plan
- Add RLS policies for system tables

### 1.2 Create Tenant Workflow Configuration Tables

**File**: `supabase/migrations/0019_tenant_workflow_config.sql`

Tenant-level workflow customization:

- `org_tenant_workflow_templates_cf` - Tenant template assignments
- `org_tenant_workflow_settings_cf` - Feature flags (preparation_screen, assembly_screen, qa_screen, track_individual_piece, orders_split_enabled)
- `org_tenant_service_category_workflow_cf` - Per-category workflow overrides
- Composite FKs with tenant_org_id
- RLS policies for tenant isolation

### 1.3 Extend Orders Tables for Advanced Workflow

**File**: `supabase/migrations/0020_orders_workflow_extensions.sql`

Extend `org_orders_mst`:

- `workflow_template_id` (UUID FK)
- `current_status` (TEXT, replaces old status)
- `current_stage` (TEXT)
- `parent_order_id` (UUID, for split orders)
- `order_subtype` (TEXT)
- `is_rejected` (BOOLEAN)
- `rejected_from_stage` (TEXT)
- `issue_id` (UUID)
- `ready_by_at_new` (TIMESTAMPTZ, for recalculated SLA)
- `has_split` (BOOLEAN)
- `has_issue` (BOOLEAN)
- `last_transition_at` (TIMESTAMPTZ)
- `last_transition_by` (UUID)
- `is_order_quick_drop` (BOOLEAN)
- `quick_drop_quantity` (INT)
- `rack_location` (VARCHAR, required for READY status)

Extend `org_order_items_dtl`:

- `item_status` (TEXT)
- `item_stage` (TEXT)
- `item_is_rejected` (BOOLEAN)
- `item_issue_id` (UUID)
- `item_last_step` (TEXT)
- `item_last_step_at` (TIMESTAMPTZ)
- `item_last_step_by` (UUID)

### 1.4 Create Issue & Processing Steps Tables

**File**: `supabase/migrations/0021_order_issues_steps.sql`

- `org_order_item_issues` - Issue tracking (issue_code, issue_text, photo_url, priority, solved_at, solved_by)
- `org_order_item_processing_steps` - 5-step tracking (sorting, pretreatment, washing, drying, finishing)
- Composite FKs with tenant_org_id
- RLS policies

### 1.5 Create Order History Table

**File**: `supabase/migrations/0022_order_history_canonical.sql`

Replace `org_order_status_history` with comprehensive `org_order_history`:

- `action_type` (ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED)
- `from_value`, `to_value` (TEXT)
- `payload` (JSONB)
- `done_by`, `done_at`
- Indexes on tenant_org_id, order_id, action_type, done_at

### 1.6 Create Workflow Transition Function

**File**: `supabase/migrations/0023_workflow_transition_function.sql`

PostgreSQL function `cmx_order_transition()`:

```sql
cmx_order_transition(
  p_tenant uuid,
  p_order uuid,
  p_from text,
  p_to text,
  p_user uuid,
  p_payload jsonb
) RETURNS jsonb
```

Logic:

1. Resolve order's workflow_template_id
2. Validate transition in sys_workflow_template_transitions
3. Check quality gates (e.g., rack_location for READY)
4. Update org_orders_mst (current_status, current_stage, last_transition_*)
5. Optionally bulk-update items
6. Insert into org_order_history
7. Return success/error JSON

## Phase 2: Backend API Services (NestJS-style in Next.js)

### 2.1 Workflow Service Enhancement

**File**: `web-admin/lib/services/workflow-service.ts`

Enhance existing WorkflowService with:

- `transitionOrder()` - Call cmx_order_transition function
- `getWorkflowTemplate()` - Get template for tenant/category
- `getAllowedTransitions()` - Get valid next states
- `validateQualityGates()` - Check READY requirements
- `getOrderState()` - Current status + flags + allowed transitions

### 2.2 Order Service (New)

**File**: `web-admin/lib/services/order-service.ts`

Core order operations:

- `createOrder()` - Create with workflow logic (Quick Drop vs Normal)
- `estimateReadyBy()` - Calculate SLA based on items + category
- `splitOrder()` - Create suborder, move items, set has_split
- `createIssue()` - Log issue, optionally return to processing
- `resolveIssue()` - Mark issue solved
- `getOrderHistory()` - Fetch timeline

### 2.3 Item Processing Service (New)

**File**: `web-admin/lib/services/item-processing-service.ts`

Per-item workflow:

- `recordProcessingStep()` - Log 5-step progress
- `markItemComplete()` - Update item status
- `checkAllItemsReady()` - Auto-transition order to READY
- `getItemSteps()` - Fetch step history

### 2.4 API Routes - Orders

**Files**:

- `web-admin/app/api/v1/orders/route.ts` (POST - create order)
- `web-admin/app/api/v1/orders/[id]/state/route.ts` (GET - order state)
- `web-admin/app/api/v1/orders/[id]/transition/route.ts` (POST - status change)
- `web-admin/app/api/v1/orders/[id]/split/route.ts` (POST - split order)
- `web-admin/app/api/v1/orders/[id]/issue/route.ts` (POST - create issue)
- `web-admin/app/api/v1/orders/[id]/history/route.ts` (GET - history timeline)
- `web-admin/app/api/v1/orders/estimate-ready-by/route.ts` (POST - SLA calculation)

### 2.5 API Routes - Items

**Files**:

- `web-admin/app/api/v1/orders/[id]/items/[itemId]/step/route.ts` (POST - record step)
- `web-admin/app/api/v1/orders/[id]/items/[itemId]/complete/route.ts` (POST - mark done)

## Phase 3: Frontend - New Order Screen (Complete Replacement)

### 3.1 New Order Page (Main)

**File**: `web-admin/app/dashboard/orders/new/page.tsx`

Replace existing Quick Drop form with full New Order UI matching screenshots:

- Service category tabs (horizontal)
- Product grid per category (with images, prices)
- Defect/damage row
- Right panel: customer picker, Quick Drop toggle, Express toggle, notes, ready-by preview
- Bottom button: "Submit [date] [amount]"

### 3.2 New Order Form Component

**File**: `web-admin/app/dashboard/orders/new/components/new-order-form.tsx`

State management:

- Selected category
- Items array with quantities
- Customer selection
- Quick Drop mode + quantity
- Express mode
- Notes
- Estimated ready_by_at

Actions:

- Call `/api/v1/orders/estimate-ready-by` on item changes
- Submit to `/api/v1/orders` (POST)
- Handle Quick Drop logic (status = preparing if items missing)

### 3.3 Service Category Tabs

**File**: `web-admin/app/dashboard/orders/new/components/category-tabs.tsx`

Horizontal tabs with icons, colors from UI samples.

### 3.4 Product Grid

**File**: `web-admin/app/dashboard/orders/new/components/product-grid.tsx`

Grid layout with:

- Product image
- Name (EN/AR)
- Price
- Add/Remove buttons
- Quantity badge

### 3.5 Order Summary Panel

**File**: `web-admin/app/dashboard/orders/new/components/order-summary-panel.tsx`

Right-side panel:

- Customer search/select
- Quick Drop toggle
- Express toggle
- Notes textarea
- Ready-by date display
- Total amount
- Submit button

### 3.6 Customer Picker Modal

**File**: `web-admin/app/dashboard/orders/new/components/customer-picker-modal.tsx`

Search customers, create stub profile.

## Phase 4: Frontend - Preparation Screen

### 4.1 Preparation List Page

**File**: `web-admin/app/dashboard/preparation/page.tsx`

Query orders where:

- `current_status = 'preparing'`
- `is_order_quick_drop = true`

Display cards with order_no, customer, bag_count, received_at.

### 4.2 Preparation Detail Page

**File**: `web-admin/app/dashboard/preparation/[id]/page.tsx`

Item entry form:

- Add items (product, quantity, stain notes, damage notes)
- Photo upload
- Submit button → transition to PROCESSING

Call `/api/v1/orders/[id]/transition` with `to_status: 'PROCESSING'`.

## Phase 5: Frontend - Processing/Cleaning Screen

### 5.1 Processing List Page

**File**: `web-admin/app/dashboard/processing/page.tsx`

Two modes:

- Order-level list: `current_status = 'processing'`
- Item-level list: `item_status = 'processing'` (if track_individual_piece enabled)

### 5.2 Processing Detail Page

**File**: `web-admin/app/dashboard/processing/[id]/page.tsx`

Per-item controls:
- in this screen the user will see all pending/ready to process orders items details.
- if the record is rejected to solve an issue it should be with special color.

- 5-step dropdown (sorting, pretreatment, washing, drying, finishing): this is an optional list without any effect just informative., In-front of each piece a drop down list to implement follow these five steps sorting, pre-treatment Stains, washing, drying, and folding/ironingIn-front of each piece a drop down list to implement follow these five steps sorting, pre-treatment Stains, washing, drying, and folding/ironing
- Ready/Done checkbox: A checkbox In-front of each piece to specify its finished/cleaned/processed when they finish Processing/Cleaning he can click the check box
- Split checkbox: Another checkbox In-front of each piece to click if want to split-order to move it to new order(sub-order) automatically (that new order will contain the main order number and sub-type is split-suborder).
- Rack location input (for order)

Per- All Items down:
- Update Button to update all ready checked items to status ready in order items.
- if the user choose one or more items to be splited in new sub-order then split button should appear when pressed invoke creating new sup-order child contains all checked items in one order.

Actions:

- Record step: `/api/v1/orders/[id]/items/[itemId]/step`
- Mark done: `/api/v1/orders/[id]/items/[itemId]/complete`
- Split: `/api/v1/orders/[id]/split`
- Auto-transition to READY when all items done + rack_location set

## Phase 6: Frontend - Assembly Screen

### 6.1 Assembly List Page

**File**: `web-admin/app/dashboard/assembly/page.tsx`

Show orders where:

- `current_status = 'assembly'`
- Tenant has `use_assembly_screen = true`

### 6.2 Assembly Detail Page

**File**: `web-admin/app/dashboard/assembly/[id]/page.tsx`

Item grouping UI:

- Scan items
- Verify all items present
- Submit → transition to QA or READY (based on workflow)

## Phase 7: Frontend - QA Screen

### 7.1 QA List Page

**File**: `web-admin/app/dashboard/qa/page.tsx`

Show orders where:

- `current_status = 'qa'`
- Tenant has `use_qa_screen = true`

### 7.2 QA Detail Page

**File**: `web-admin/app/dashboard/qa/[id]/page.tsx`

Per-item QA:

- Radio: Accepted / Rejected / Accepted with immediate solve
- Notes textarea
- Photo upload (optional)

Actions:

- Accepted → transition to READY
- Rejected → transition to PROCESSING, set is_rejected=true, create issue
- Call `/api/v1/orders/[id]/transition` or `/api/v1/orders/[id]/issue`

## Phase 8: Frontend - Ready Screen

### 8.1 Ready List Page

**File**: `web-admin/app/dashboard/ready/page.tsx`

Query: `current_status = 'ready'`

Display with rack_location, ready_by date, customer info.

### 8.2 Ready Detail Page

**File**: `web-admin/app/dashboard/ready/[id]/page.tsx`

Actions:

- Deliver button → transition to DELIVERED
- Return to processing (if issue found)
- Collect payment link

## Phase 9: Frontend - Order Details & History

### 9.1 Order Detail Page (Enhanced)

**File**: `web-admin/app/dashboard/orders/[id]/page.tsx`

Replace existing with:

- Order header (status badge, order_no, customer)
- Items table with item_status
- Workflow timeline (from org_order_history)
- Issue log (if has_issue)
- Split order links (if has_split)
- Action buttons based on current_status

### 9.2 Order History Timeline Component

**File**: `web-admin/app/dashboard/orders/[id]/components/history-timeline.tsx`

Fetch from `/api/v1/orders/[id]/history`, display:

- ORDER_CREATED
- STATUS_CHANGE (from → to)
- SPLIT
- ISSUE_CREATED / ISSUE_SOLVED
- ITEM_STEP
- QA_DECISION

## Phase 10: TypeScript Types & Validation

### 10.1 Workflow Types

**File**: `web-admin/lib/types/workflow.ts`

Add types for:

- WorkflowTemplate
- WorkflowStage
- WorkflowTransition
- TenantWorkflowSettings
- OrderIssue
- ProcessingStep

### 10.2 Order Types Enhancement

**File**: `web-admin/lib/types/order.ts`

Update Order type with new fields from Phase 1.3.

### 10.3 Validation Schemas

**File**: `web-admin/lib/validations/order-workflow-schema.ts`

Zod schemas for:

- CreateOrderRequest
- TransitionOrderRequest
- SplitOrderRequest
- CreateIssueRequest
- RecordStepRequest

## Phase 11: Localization (EN/AR)

### 11.1 New Order Translations

**Files**:

- `web-admin/messages/en.json` (add keys: newOrder.*, workflow.*)
- `web-admin/messages/ar.json` (Arabic translations)

Keys:

- Service categories
- Product names
- Workflow statuses
- Action buttons
- Validation messages

### 11.2 Workflow Status Translations

Update STATUS_META in `workflow.ts` with translation keys instead of hardcoded strings.

## Phase 12: Role-Based Access Control

### 12.1 Define Roles

**File**: `web-admin/lib/auth/roles.ts`

```typescript
export const ROLES = {
  RECEPTION: 'ROLE_RECEPTION',
  PREPARATION: 'ROLE_PREPARATION',
  PROCESSING: 'ROLE_PROCESSING',
  QA: 'ROLE_QA',
  DELIVERY: 'ROLE_DELIVERY',
  ADMIN: 'ROLE_ADMIN',
};
```

### 12.2 Screen Access Guards

Add role checks to each screen:

- New Order: RECEPTION, ADMIN
- Preparation: PREPARATION, ADMIN
- Processing: PROCESSING, ADMIN
- Assembly: PROCESSING, ADMIN
- QA: QA, ADMIN
- Ready: RECEPTION, DELIVERY, ADMIN

### 12.3 API Role Validation

Add role checks in transition API to enforce:

- intake → preparing: RECEPTION, PREPARATION
- preparing → processing: PREPARATION
- processing → ready: PROCESSING
- qa → ready: QA
- ready → delivered: RECEPTION, DELIVERY

## Phase 13: Testing & Validation

### 13.1 Database Tests

**File**: `supabase/migrations/tests/workflow_tests.sql`

Test:

- Workflow template seeding
- Transition function validation
- Quality gate enforcement
- History logging

### 13.2 Service Tests

**Files**: `web-admin/__tests__/services/`

- `workflow-service.test.ts`
- `order-service.test.ts`
- `item-processing-service.test.ts`

### 13.3 API Tests

**Files**: `web-admin/__tests__/api/v1/orders/`

Test all endpoints with tenant isolation.

### 13.4 E2E Tests

**File**: `web-admin/e2e/order-workflow.spec.ts`

Test complete flows:

- Normal order creation → processing → ready → delivered
- Quick Drop → preparation → processing → ready
- Split order scenario
- QA rejection scenario
- Issue creation and resolution

## Phase 14: Migration & Cleanup

### 14.1 Data Migration Script

**File**: `scripts/migrate-orders-to-workflow.ts`

Migrate existing orders to new workflow structure:

- Map old status to new current_status
- Set default workflow_template_id
- Preserve history

### 14.2 Remove Old Implementation

Delete/archive:

- Old order status enum
- Old quick-drop specific code
- Deprecated API routes

### 14.3 Update Navigation

**File**: `web-admin/config/navigation.ts`

Add new menu items:

- Preparation
- Processing
- Assembly (conditional)
- QA (conditional)
- Ready

## Success Criteria

- ✅ All 5 workflow templates seeded and functional
- ✅ Tenant can configure workflow per service category
- ✅ New Order screen matches UI samples
- ✅ Quick Drop flow works (intake → preparing → processing)
- ✅ Normal order flow works (intake → processing → ready)
- ✅ Split orders create suborders correctly
- ✅ Issues can be created and resolved
- ✅ Per-item 5-step processing tracked
- ✅ QA rejection returns to processing
- ✅ Rack location required for READY status
- ✅ Complete audit trail in org_order_history
- ✅ Role-based access enforced
- ✅ All screens bilingual (EN/AR)
- ✅ All tests passing (unit, integration, E2E)

## Notes

- Use hybrid approach: core transitions in DB function, complex logic in services
- All queries must filter by tenant_org_id
- Maintain composite FKs for tenant isolation
- Follow existing code patterns (functional components, TypeScript strict)
- Use existing UI components from shadcn/ui
- Match color scheme from new_order_colors_04.JPG