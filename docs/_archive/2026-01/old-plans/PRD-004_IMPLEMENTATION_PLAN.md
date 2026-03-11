# PRD-004: Order Creation & Itemization - Implementation Plan

**Document ID**: PRD-004_IMPLEMENTATION_PLAN
**Created**: 2025-10-25
**Status**: Ready for Implementation
**Estimated Duration**: 2 weeks (80 hours)
**Dependencies**: PRD-001 (Auth), PRD-002 (Tenant), PRD-003 (Customer)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Implementation Phases](#implementation-phases)
3. [Database Changes](#database-changes)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Plan](#deployment-plan)
8. [Success Criteria](#success-criteria)

---

## Executive Summary

### Objective
Implement a complete order intake system with Quick Drop workflow and preparation/itemization capability, enabling sub-5 minute order creation with accurate pricing and tracking.

### Key Features
- ✅ Quick Drop order creation (< 3 minutes)
- ✅ Unique order number generation (ORD-YYYYMMDD-XXXX)
- ✅ QR code and barcode generation
- ✅ Order preparation/itemization workflow
- ✅ Bulk item addition
- ✅ Automatic pricing calculation
- ✅ Ready-By date calculation
- ✅ Photo upload capability
- ✅ Print label functionality 

### Technical Stack
- **Database**: PostgreSQL (Supabase) with RLS
- **ORM**: Prisma + Supabase Client (Hybrid)
- **Backend**: Next.js API Routes + Server Actions
- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS v4
- **Storage**: MinIO (S3-compatible) for photos
- **QR/Barcode**: qrcode + jsbarcode libraries

---

## Implementation Phases

### Phase 1: Database Schema & Migrations (Day 1-2)
**Duration**: 8 hours
**Owner**: Backend Developer

#### Tasks:
1. Create migration `0012_order_intake_enhancements.sql`
2. Add new columns to `org_orders_mst`:
   - `preparation_status` (pending/in_progress/completed)
   - `prepared_at`, `prepared_by`
   - `ready_by_override`
   - `priority_multiplier`
   - `photo_urls` (JSONB)
   - `bag_count`
   - `qr_code`, `barcode`

3. Add new columns to `org_order_items_dtl`:
   - `product_name`, `product_name2` (denormalized for performance)
   - `stain_notes`, `damage_notes`

4. Create indexes:
   - `idx_orders_preparation_status`
   - `idx_orders_received_at`
   - `idx_orders_ready_by`
   - `idx_orders_status`

5. Create order number sequence function
6. Test migration rollback

**Deliverables**:
- ✅ Migration file tested locally
- ✅ Rollback script created
- ✅ Schema documentation updated

---

### Phase 2: Utilities & Core Logic (Day 3-4)
**Duration**: 12 hours
**Owner**: Backend Developer

#### 2.1 Order Number Generator
**File**: `web-admin/lib/utils/order-number-generator.ts`

```typescript
/**
 * Generate unique order number for tenant
 * Format: ORD-YYYYMMDD-XXXX
 * Example: ORD-20251025-0001
 */
export async function generateOrderNumber(tenantOrgId: string): Promise<string>
```

**Features**:
- Sequential numbering per tenant per day
- Resets daily at midnight
- Thread-safe via PostgreSQL sequence
- Tenant isolation guaranteed

#### 2.2 QR Code & Barcode Generator
**File**: `web-admin/lib/utils/barcode-generator.ts`

```typescript
export async function generateQRCode(data: string): Promise<string>
export async function generateBarcode(orderNumber: string): Promise<string>
```

**Dependencies**:
```bash
npm install qrcode jsbarcode
npm install --save-dev @types/qrcode @types/jsbarcode
```

#### 2.3 Ready-By Calculator
**File**: `web-admin/lib/utils/ready-by-calculator.ts`

```typescript
export function calculateReadyBy(params: {
  receivedAt: Date;
  serviceCategoryCode: string;
  priority: 'normal' | 'urgent' | 'express';
  turnaroundHours: number;
  businessHours: BusinessHours;
}): Date
```

**Logic**:
- Get turnaround hours from service category
- Apply priority multiplier (normal: 1.0, urgent: 0.7, express: 0.5)
- Round to business hours (use tenant settings)
- Skip weekends/holidays (future enhancement)

#### 2.4 Pricing Calculator
**File**: `web-admin/lib/utils/pricing-calculator.ts`

```typescript
export function calculateItemPrice(params: {
  basePrice: number;
  quantity: number;
  isExpress: boolean;
  expressMultiplier: number;
  taxRate: number;
}): {
  subtotal: number;
  tax: number;
  total: number;
}
```

**Deliverables**:
- ✅ All utilities with TypeScript types
- ✅ Unit tests for each utility (80%+ coverage)
- ✅ JSDoc documentation

---

### Phase 3: Backend API Implementation (Day 5-7)
**Duration**: 20 hours
**Owner**: Backend Developer

#### 3.1 Server Actions (Recommended for Next.js 15)
**Directory**: `web-admin/app/actions/orders/`

**Files**:
- `create-order.ts` - Create Quick Drop order
- `add-order-items.ts` - Add items during preparation
- `complete-preparation.ts` - Complete preparation workflow
- `get-order.ts` - Fetch order details
- `list-orders.ts` - List orders with filters
- `upload-order-photo.ts` - Upload order photos to MinIO

#### 3.2 API Routes (Alternative/Legacy)
**Directory**: `web-admin/app/api/orders/`

**Endpoints**:
```
POST   /api/orders                    - Create Quick Drop order
GET    /api/orders                    - List orders
GET    /api/orders/:id                - Get order details
GET    /api/orders/:id/preparation    - Get order for preparation
POST   /api/orders/:id/items          - Add items
PATCH  /api/orders/:id/preparation/complete - Complete preparation
POST   /api/orders/:id/photos         - Upload photo
```

#### 3.3 Data Access Layer
**File**: `web-admin/lib/db/orders.ts`

```typescript
// Prisma-based queries with auto tenant filtering via middleware
export async function createOrder(data: CreateOrderData)
export async function getOrder(orderId: string)
export async function listOrders(filters: OrderFilters)
export async function addOrderItems(orderId: string, items: OrderItem[])
export async function completePreparation(orderId: string)
```

#### 3.4 Validation Layer
**File**: `web-admin/lib/validations/order-schema.ts`

Use Zod for runtime validation:
```typescript
export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  orderType: z.enum(['quick_drop', 'pickup', 'delivery']),
  serviceCategory: z.string(),
  bagCount: z.number().min(1).max(50),
  priority: z.enum(['normal', 'urgent', 'express']),
  customerNotes: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional()
})
```

**Deliverables**:
- ✅ All API endpoints implemented
- ✅ Input validation with Zod
- ✅ Error handling with proper HTTP codes
- ✅ Integration tests (Supertest or Playwright)

---

### Phase 4: Frontend - Order List & Search (Day 8-9)
**Duration**: 12 hours
**Owner**: Frontend Developer

#### 4.1 Order List Page
**File**: `web-admin/app/dashboard/orders/page.tsx`

**Features**:
- Server-side pagination
- Real-time data with React Query
- Filter by status, date range, customer
- Search by order number, customer name/phone
- Bulk actions (future: print labels, export)

**Components**:
- `OrderTable` - Data table with sorting
- `OrderFiltersBar` - Filters and search
- `OrderStatsCards` - Summary cards (total, pending prep, ready, etc.)
- `OrderStatusBadge` - Status indicator

#### 4.2 Order Detail Page
**File**: `web-admin/app/dashboard/orders/[id]/page.tsx`

**Sections**:
- Order summary (number, customer, status, totals)
- Customer information
- Items table
- Timeline (created → prepared → processing → ready → delivered)
- Actions (edit, print label, print invoice, cancel)

**Deliverables**:
- ✅ Responsive UI (mobile-first)
- ✅ Loading states
- ✅ Error boundaries
- ✅ Accessibility (WCAG 2.1 AA)

---

### Phase 5: Frontend - Quick Drop Intake (Day 10-11)
**Duration**: 12 hours
**Owner**: Frontend Developer

#### 5.1 Quick Drop Form
**File**: `web-admin/app/dashboard/orders/new/page.tsx`

**Form Fields**:
1. **Customer Selection**
   - Autocomplete search (by phone, name, customer number)
   - "Create New Customer" quick action
   - Display customer preferences (if exists)

2. **Order Details**
   - Service category dropdown (from enabled categories)
   - Bag count input (default: 1)
   - Priority toggle (normal/urgent/express with price impact)
   - Order type (quick_drop, pickup, delivery)

3. **Additional Info**
   - Customer notes (text area)
   - Internal notes (staff only)
   - Photo upload (drag-drop or camera)

4. **Actions**
   - "Save & Print Label" (primary)
   - "Save Draft" (secondary)
   - "Cancel"

**UX Requirements**:
- Auto-save draft to local storage
- Real-time order number preview
- Show estimated Ready-By date
- Keyboard shortcuts (future)
- Time target: < 3 minutes to complete

**Validation**:
- Required fields highlighted
- Inline error messages
- Toast notifications for success/error

**Deliverables**:
- ✅ Form with validation
- ✅ Customer search autocomplete
- ✅ Photo upload component
- ✅ Print label integration

---

### Phase 6: Frontend - Preparation Workflow (Day 12-13)
**Duration**: 12 hours
**Owner**: Frontend Developer

#### 6.1 Preparation Screen
**File**: `web-admin/app/dashboard/orders/[id]/prepare/page.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Order Header: ORD-20251025-0001 | Ahmed Al-Said │
│ Service: Wash & Fold | Bags: 2 | Priority: Normal│
├─────────────────────────────────────────────────┤
│ Product Catalog (Grid/List)    │  Shopping Cart  │
│ ┌──────┐ ┌──────┐ ┌──────┐   │  Items Added: 8  │
│ │Shirt │ │Pants │ │Dress │   │  Subtotal: 13.50 │
│ │ 1.50 │ │ 2.00 │ │ 5.00 │   │  Tax: 0.68       │
│ └──────┘ └──────┘ └──────┘   │  Total: 14.18    │
│                                │  Ready By:       │
│ Search: [________]             │  Oct 27, 6:00 PM │
│ Filter: [All Categories ▼]    │                  │
│                                │ [Complete Prep]  │
└────────────────────────────────┴──────────────────┘
```

**Product Catalog Section**:
- Grid or list view toggle
- Search by product name
- Filter by service category
- Click product → quantity modal → add to cart
- Bulk add shortcuts ("5 Shirts" button)

**Shopping Cart Section**:
- Live pricing updates
- Edit quantity
- Remove item
- Item details (color, brand, stain, damage notes)
- Auto-calculate Ready-By date
- Override Ready-By (optional)

**Item Detail Modal**:
- Product name (auto-filled)
- Quantity input
- Color input
- Brand input
- Has stain? (checkbox → stain notes text area)
- Has damage? (checkbox → damage notes text area)
- Service category override (if needed)

**Performance Target**:
- 10 items added in < 3 minutes
- Real-time price calculation (debounced)

**Deliverables**:
- ✅ Product catalog with search/filter
- ✅ Shopping cart with live totals
- ✅ Item detail modal
- ✅ Bulk add shortcuts
- ✅ Complete preparation action

---

### Phase 7: Photo Upload & Label Printing (Day 14)
**Duration**: 6 hours
**Owner**: Full-Stack Developer

#### 7.1 Photo Upload
**Integration**: MinIO (S3-compatible storage)

**File**: `web-admin/lib/storage/upload-photo.ts`

```typescript
export async function uploadOrderPhoto(
  file: File,
  tenantOrgId: string,
  orderId: string
): Promise<string> // Returns URL
```

**Features**:
- Upload to MinIO bucket: `orders/{tenantOrgId}/{orderId}/photos/`
- Auto-generate unique filename
- Image optimization (resize, compress)
- Progress indicator
- Error handling

**UI Component**: `PhotoUploadField`
- Drag-and-drop
- Click to browse
- Camera capture (mobile)
- Preview thumbnails
- Delete uploaded photo

#### 7.2 Label Printing
**File**: `web-admin/lib/printing/label-printer.ts`

**Label Content**:
- Order number (large, bold)
- QR code (customer can scan to track)
- Barcode (staff can scan for processing)
- Customer name
- Service category
- Bag count
- Ready-By date

**Print Methods**:
1. **Browser Print** (default)
   - Generate printable HTML page
   - Open in new window → window.print()
   - Close after print

2. **Thermal Printer** (future)
   - ESC/POS commands
   - Direct USB/Bluetooth connection

**Deliverables**:
- ✅ Photo upload to MinIO
- ✅ Label template (HTML/CSS)
- ✅ Print functionality

---

### Phase 8: Testing (Day 15-16)
**Duration**: 12 hours
**Owner**: QA + Developers

#### 8.1 Unit Tests
**Coverage Target**: 80%+

**Files to Test**:
- `order-number-generator.test.ts`
- `barcode-generator.test.ts`
- `ready-by-calculator.test.ts`
- `pricing-calculator.test.ts`

**Test Cases**:
- Order number uniqueness per tenant
- Order number format validation
- Ready-By calculation with business hours
- Pricing with express multiplier
- QR/barcode generation

#### 8.2 Integration Tests
**Framework**: Playwright or Supertest

**Test Scenarios**:
- POST /api/orders → creates order with correct tenant isolation
- POST /api/orders/:id/items → adds items with pricing
- PATCH /api/orders/:id/preparation/complete → updates status
- Verify composite FK enforcement
- Verify RLS policies active

#### 8.3 E2E Tests
**Framework**: Playwright

**Critical User Flows**:
1. **Quick Drop Intake**
   - Login → Navigate to Orders → New Order
   - Search customer → Select service → Upload photo
   - Save → Verify order created → Print label

2. **Preparation Workflow**
   - Navigate to order → Start Preparation
   - Add 10 items (mix of products)
   - Complete preparation → Verify pricing and Ready-By
   - Verify status transition

3. **Order Search & Filter**
   - Navigate to orders list
   - Filter by status, date range
   - Search by order number
   - Open order detail

**Deliverables**:
- ✅ 80%+ code coverage
- ✅ All integration tests passing
- ✅ E2E tests for critical flows
- ✅ Performance tests (< 3 min for intake)

---

### Phase 9: Documentation & Deployment (Day 17-18)
**Duration**: 8 hours
**Owner**: Tech Lead

#### 9.1 Documentation Updates
- Update API documentation (Swagger/OpenAPI)
- Update README with order intake workflow
- Create user guide for Quick Drop intake
- Create user guide for preparation workflow
- Update database schema documentation

#### 9.2 Deployment Checklist
- [ ] Run all migrations in staging
- [ ] Test RLS policies in staging
- [ ] Verify MinIO bucket permissions
- [ ] Test print functionality in staging
- [ ] Run performance tests
- [ ] Smoke test all endpoints
- [ ] Deploy to production
- [ ] Monitor error logs (first 24 hours)

**Deliverables**:
- ✅ Complete documentation
- ✅ Deployment successful
- ✅ Monitoring dashboards configured

---

## Database Changes

### Migration: `0012_order_intake_enhancements.sql`

```sql
-- ==================================================================
-- 0012_order_intake_enhancements.sql
-- Purpose: Order intake and preparation enhancements for PRD-004
-- Author: CleanMateX Development Team
-- Created: 2025-10-25
-- Dependencies: 0001_core_schema.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- ALTER org_orders_mst
-- ==================================================================

-- Preparation workflow fields
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(20) DEFAULT 'pending';
COMMENT ON COLUMN org_orders_mst.preparation_status IS 'Preparation status: pending, in_progress, completed';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;
COMMENT ON COLUMN org_orders_mst.prepared_at IS 'When preparation was completed';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS prepared_by UUID;
COMMENT ON COLUMN org_orders_mst.prepared_by IS 'User who completed preparation';

-- Ready-By override
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS ready_by_override TIMESTAMP;
COMMENT ON COLUMN org_orders_mst.ready_by_override IS 'Manual override for Ready-By date';

-- Priority multiplier
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS priority_multiplier NUMERIC(4,2) DEFAULT 1.0;
COMMENT ON COLUMN org_orders_mst.priority_multiplier IS 'Priority multiplier (normal: 1.0, urgent: 0.7, express: 0.5)';

-- Photo URLs (JSONB array)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::JSONB;
COMMENT ON COLUMN org_orders_mst.photo_urls IS 'Array of photo URLs from MinIO';

-- Bag count
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS bag_count INTEGER DEFAULT 1;
COMMENT ON COLUMN org_orders_mst.bag_count IS 'Number of bags received';

-- QR Code and Barcode
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS qr_code TEXT;
COMMENT ON COLUMN org_orders_mst.qr_code IS 'QR code data URL for label printing';

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS barcode TEXT;
COMMENT ON COLUMN org_orders_mst.barcode IS 'Barcode data URL for label printing';

-- Service category code
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS service_category_code VARCHAR(120);
COMMENT ON COLUMN org_orders_mst.service_category_code IS 'Primary service category for order';

-- ==================================================================
-- ALTER org_order_items_dtl
-- ==================================================================

-- Denormalized product names (for performance)
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(250);
COMMENT ON COLUMN org_order_items_dtl.product_name IS 'Product name (English) - denormalized';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS product_name2 VARCHAR(250);
COMMENT ON COLUMN org_order_items_dtl.product_name2 IS 'Product name (Arabic) - denormalized';

-- Stain and damage notes
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS stain_notes TEXT;
COMMENT ON COLUMN org_order_items_dtl.stain_notes IS 'Details about stains on item';

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS damage_notes TEXT;
COMMENT ON COLUMN org_order_items_dtl.damage_notes IS 'Details about damage to item';

-- ==================================================================
-- INDEXES
-- ==================================================================

-- Preparation status index
CREATE INDEX IF NOT EXISTS idx_orders_preparation_status
  ON org_orders_mst(tenant_org_id, preparation_status);

-- Received at index (for sorting)
CREATE INDEX IF NOT EXISTS idx_orders_received_at
  ON org_orders_mst(tenant_org_id, received_at DESC);

-- Ready by index (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_orders_ready_by
  ON org_orders_mst(tenant_org_id, ready_by);

-- Status index
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON org_orders_mst(tenant_org_id, status);

-- Service category index
CREATE INDEX IF NOT EXISTS idx_orders_service_category
  ON org_orders_mst(tenant_org_id, service_category_code);

-- Order items tenant index
CREATE INDEX IF NOT EXISTS idx_order_items_tenant
  ON org_order_items_dtl(tenant_org_id);

-- ==================================================================
-- ORDER NUMBER GENERATION FUNCTION
-- ==================================================================

-- Function to generate unique order number per tenant per day
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date TEXT;
  v_sequence INTEGER;
  v_order_number TEXT;
BEGIN
  -- Get current date in YYYYMMDD format
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get next sequence number for this tenant and date
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM 14) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM org_orders_mst
  WHERE tenant_org_id = p_tenant_org_id
    AND order_no LIKE 'ORD-' || v_date || '-%';

  -- Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20251025-0001)
  v_order_number := 'ORD-' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_order_number;
END;
$$;

COMMENT ON FUNCTION generate_order_number(UUID) IS 'Generate unique order number per tenant per day';

-- ==================================================================
-- VALIDATION
-- ==================================================================

DO $$
BEGIN
  -- Verify new columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_orders_mst' AND column_name = 'preparation_status'
  ) THEN
    RAISE EXCEPTION 'Column preparation_status not created';
  END IF;

  -- Verify indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_orders_preparation_status'
  ) THEN
    RAISE EXCEPTION 'Index idx_orders_preparation_status not created';
  END IF;

  RAISE NOTICE 'Migration 0012 validation passed';
END $$;

COMMIT;
```

### Rollback Script: `0012_order_intake_enhancements_rollback.sql`

```sql
BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS idx_orders_preparation_status;
DROP INDEX IF EXISTS idx_orders_received_at;
DROP INDEX IF EXISTS idx_orders_ready_by;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_service_category;
DROP INDEX IF EXISTS idx_order_items_tenant;

-- Drop function
DROP FUNCTION IF EXISTS generate_order_number(UUID);

-- Remove columns from org_orders_mst
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS preparation_status;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS prepared_at;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS prepared_by;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS ready_by_override;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS priority_multiplier;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS photo_urls;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS bag_count;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS qr_code;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS barcode;
ALTER TABLE org_orders_mst DROP COLUMN IF EXISTS service_category_code;

-- Remove columns from org_order_items_dtl
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS product_name;
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS product_name2;
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS stain_notes;
ALTER TABLE org_order_items_dtl DROP COLUMN IF EXISTS damage_notes;

COMMIT;
```

---

## Backend Implementation

### Directory Structure

```
web-admin/
├── app/
│   ├── actions/
│   │   └── orders/
│   │       ├── create-order.ts
│   │       ├── add-order-items.ts
│   │       ├── complete-preparation.ts
│   │       ├── get-order.ts
│   │       ├── list-orders.ts
│   │       └── upload-photo.ts
│   └── api/
│       └── orders/
│           ├── route.ts (POST /api/orders, GET /api/orders)
│           └── [id]/
│               ├── route.ts (GET, PATCH, DELETE)
│               ├── items/route.ts
│               ├── preparation/route.ts
│               └── photos/route.ts
├── lib/
│   ├── db/
│   │   └── orders.ts (Prisma queries)
│   ├── utils/
│   │   ├── order-number-generator.ts
│   │   ├── barcode-generator.ts
│   │   ├── ready-by-calculator.ts
│   │   └── pricing-calculator.ts
│   ├── validations/
│   │   └── order-schema.ts (Zod schemas)
│   └── storage/
│       └── upload-photo.ts (MinIO integration)
└── types/
    └── order.ts (TypeScript types)
```

### Key Implementation Files

#### 1. Order Number Generator

**File**: `web-admin/lib/utils/order-number-generator.ts`

```typescript
import { prisma } from '@/lib/db/prisma';

/**
 * Generate unique order number for tenant
 * Format: ORD-YYYYMMDD-XXXX
 * Example: ORD-20251025-0001
 */
export async function generateOrderNumber(tenantOrgId: string): Promise<string> {
  // Use PostgreSQL function for atomicity
  const result = await prisma.$queryRaw<[{ generate_order_number: string }]>`
    SELECT generate_order_number(${tenantOrgId}::uuid) as generate_order_number
  `;

  return result[0].generate_order_number;
}

/**
 * Validate order number format
 */
export function isValidOrderNumber(orderNumber: string): boolean {
  const pattern = /^ORD-\d{8}-\d{4}$/;
  return pattern.test(orderNumber);
}
```

#### 2. QR Code & Barcode Generator

**File**: `web-admin/lib/utils/barcode-generator.ts`

```typescript
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';

/**
 * Generate QR code as data URL
 * Contains: orderNumber, tenantId, customerPhone
 */
export async function generateQRCode(params: {
  orderNumber: string;
  tenantOrgId: string;
  customerPhone: string;
}): Promise<string> {
  const data = JSON.stringify({
    order: params.orderNumber,
    tenant: params.tenantOrgId,
    phone: params.customerPhone,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 1,
  });

  return qrCodeDataUrl;
}

/**
 * Generate barcode as data URL
 * Format: EAN-13 or CODE128
 */
export async function generateBarcode(orderNumber: string): Promise<string> {
  // Remove hyphens for barcode: ORD-20251025-0001 → ORD202510250001
  const barcodeValue = orderNumber.replace(/-/g, '');

  const canvas = createCanvas(200, 100);

  JsBarcode(canvas, barcodeValue, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: true,
  });

  return canvas.toDataURL();
}
```

#### 3. Ready-By Calculator

**File**: `web-admin/lib/utils/ready-by-calculator.ts`

```typescript
import { addHours, addDays, setHours, setMinutes, isWeekend } from 'date-fns';

interface BusinessHours {
  open: number; // 9 (9 AM)
  close: number; // 18 (6 PM)
  workingDays: number[]; // [1, 2, 3, 4, 5, 6] (Mon-Sat)
}

const PRIORITY_MULTIPLIERS = {
  normal: 1.0,
  urgent: 0.7,
  express: 0.5,
};

/**
 * Calculate Ready-By date based on turnaround time and priority
 */
export function calculateReadyBy(params: {
  receivedAt: Date;
  turnaroundHours: number;
  priority: 'normal' | 'urgent' | 'express';
  businessHours: BusinessHours;
}): Date {
  const { receivedAt, turnaroundHours, priority, businessHours } = params;

  // Apply priority multiplier
  const multiplier = PRIORITY_MULTIPLIERS[priority];
  const adjustedHours = turnaroundHours * multiplier;

  // Calculate target date/time
  let targetDate = addHours(receivedAt, adjustedHours);

  // Round to business hours
  targetDate = roundToBusinessHours(targetDate, businessHours);

  return targetDate;
}

/**
 * Round date to next business hour
 */
function roundToBusinessHours(date: Date, businessHours: BusinessHours): Date {
  let result = new Date(date);

  // If weekend, move to Monday
  while (!businessHours.workingDays.includes(result.getDay())) {
    result = addDays(result, 1);
  }

  // If before opening hours, set to opening time
  if (result.getHours() < businessHours.open) {
    result = setHours(setMinutes(result, 0), businessHours.open);
  }

  // If after closing hours, move to next day opening
  if (result.getHours() >= businessHours.close) {
    result = addDays(result, 1);
    result = setHours(setMinutes(result, 0), businessHours.open);

    // Check if new day is weekend
    while (!businessHours.workingDays.includes(result.getDay())) {
      result = addDays(result, 1);
    }
  }

  return result;
}
```

#### 4. Pricing Calculator

**File**: `web-admin/lib/utils/pricing-calculator.ts`

```typescript
/**
 * Calculate item price with tax
 */
export function calculateItemPrice(params: {
  basePrice: number;
  quantity: number;
  isExpress: boolean;
  expressMultiplier: number;
  taxRate: number; // 0.05 for 5% VAT
}): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const { basePrice, quantity, isExpress, expressMultiplier, taxRate } = params;

  // Calculate unit price
  const unitPrice = isExpress ? basePrice * expressMultiplier : basePrice;

  // Calculate subtotal
  const subtotal = unitPrice * quantity;

  // Calculate tax
  const tax = subtotal * taxRate;

  // Calculate total
  const total = subtotal + tax;

  return {
    subtotal: parseFloat(subtotal.toFixed(3)),
    tax: parseFloat(tax.toFixed(3)),
    total: parseFloat(total.toFixed(3)),
  };
}

/**
 * Calculate order total from multiple items
 */
export function calculateOrderTotal(items: {
  subtotal: number;
  tax: number;
  total: number;
}[]): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const totals = items.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      tax: acc.tax + item.tax,
      total: acc.total + item.total,
    }),
    { subtotal: 0, tax: 0, total: 0 }
  );

  return {
    subtotal: parseFloat(totals.subtotal.toFixed(3)),
    tax: parseFloat(totals.tax.toFixed(3)),
    total: parseFloat(totals.total.toFixed(3)),
  };
}
```

---

## Frontend Implementation

### Page Structure

```
web-admin/app/dashboard/orders/
├── page.tsx                    # Order list
├── new/page.tsx                # Quick Drop intake
├── [id]/
│   ├── page.tsx                # Order details
│   └── prepare/page.tsx        # Preparation workflow
└── components/
    ├── order-table.tsx
    ├── order-filters-bar.tsx
    ├── order-stats-cards.tsx
    ├── order-status-badge.tsx
    ├── quick-drop-form.tsx
    ├── product-catalog.tsx
    ├── shopping-cart.tsx
    ├── item-detail-modal.tsx
    ├── photo-upload.tsx
    └── print-label.tsx
```

### Key Components

#### 1. Quick Drop Form

**File**: `web-admin/app/dashboard/orders/new/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder } from '@/app/actions/orders/create-order';
import { CustomerSearch } from '../components/customer-search';
import { PhotoUpload } from '../components/photo-upload';

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const result = await createOrder(formData);
      // Print label
      // Navigate to order details or preparation
      router.push(`/dashboard/orders/${result.id}/prepare`);
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">New Order - Quick Drop</h1>

      <form action={handleSubmit}>
        {/* Customer Selection */}
        <CustomerSearch name="customerId" required />

        {/* Service Category */}
        <select name="serviceCategory" required>
          <option value="">Select Service</option>
          <option value="wash_fold">Wash & Fold</option>
          <option value="dry_clean">Dry Cleaning</option>
          <option value="iron_only">Iron Only</option>
        </select>

        {/* Bag Count */}
        <input
          type="number"
          name="bagCount"
          min="1"
          defaultValue="1"
          required
        />

        {/* Priority */}
        <select name="priority" defaultValue="normal">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent (+30%)</option>
          <option value="express">Express (+50%)</option>
        </select>

        {/* Notes */}
        <textarea name="customerNotes" placeholder="Customer notes" />

        {/* Photo Upload */}
        <PhotoUpload name="photos" />

        {/* Actions */}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Save & Print Label'}
        </button>
      </form>
    </div>
  );
}
```

---

## Testing Strategy

### 1. Unit Tests (Jest)

**Coverage Target**: 80%+

**Test Files**:
- `__tests__/utils/order-number-generator.test.ts`
- `__tests__/utils/barcode-generator.test.ts`
- `__tests__/utils/ready-by-calculator.test.ts`
- `__tests__/utils/pricing-calculator.test.ts`

**Example Test**:

```typescript
// __tests__/utils/order-number-generator.test.ts
import { generateOrderNumber, isValidOrderNumber } from '@/lib/utils/order-number-generator';

describe('Order Number Generator', () => {
  it('should generate order number in correct format', async () => {
    const tenantId = 'test-tenant-uuid';
    const orderNumber = await generateOrderNumber(tenantId);

    expect(orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
  });

  it('should validate order number format', () => {
    expect(isValidOrderNumber('ORD-20251025-0001')).toBe(true);
    expect(isValidOrderNumber('INVALID')).toBe(false);
  });
});
```

### 2. Integration Tests (Playwright)

**Test Scenarios**:
- Create order via API
- Add items to order
- Complete preparation
- Verify tenant isolation

### 3. E2E Tests (Playwright)

**Critical Flows**:
- Quick Drop intake (< 3 minutes)
- Preparation workflow (10 items)
- Order search and filter

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] Run all tests locally
- [ ] Code review completed
- [ ] Migration tested in staging
- [ ] RLS policies verified
- [ ] MinIO bucket configured
- [ ] Performance benchmarks met

### Deployment Steps

1. **Database Migration**
   ```bash
   npx supabase migration up
   ```

2. **Verify RLS Policies**
   ```bash
   npx supabase db test
   ```

3. **Deploy Frontend**
   ```bash
   cd web-admin
   npm run build
   npm run start
   ```

4. **Smoke Tests**
   - Create test order
   - Add items
   - Complete preparation
   - Print label

5. **Monitor**
   - Watch error logs (first 24 hours)
   - Check performance metrics
   - Gather user feedback

---

## Success Criteria

### Performance Metrics
- ✅ Quick Drop intake < 3 minutes
- ✅ Preparation of 10 items < 3 minutes
- ✅ Order number generation < 100ms
- ✅ API response time p95 < 500ms
- ✅ Photo upload < 5 seconds

### Functionality
- ✅ Unique order numbers per tenant per day
- ✅ QR code and barcode generation working
- ✅ Ready-By calculation accurate
- ✅ Pricing calculation correct (base + express + tax)
- ✅ Photo upload to MinIO successful
- ✅ Label printing functional

### Quality
- ✅ 80%+ code coverage
- ✅ All integration tests passing
- ✅ E2E tests for critical flows passing
- ✅ Zero RLS policy violations
- ✅ Zero cross-tenant data leaks

### User Acceptance
- ✅ 3 pilot users successfully create orders
- ✅ Average intake time < 3 minutes
- ✅ Zero critical bugs reported
- ✅ Positive user feedback

---

## Next Steps

After PRD-004 completion:
1. **PRD-005**: Basic Workflow State Machine
2. **PRD-006**: Digital Receipts (WhatsApp + In-App)
3. **PRD-007**: Admin Dashboard Enhancements

---

**Document Status**: Ready for Implementation
**Last Updated**: 2025-10-25
**Next Review**: 2025-11-08 (after completion)
