# Order Creation & Itemization - Implementation Plan

**PRD ID**: 004_order_intake_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 2 weeks
**Dependencies**: PRD-001 (Auth), PRD-002 (Tenant), PRD-003 (Customer)

---

## Overview

Implement the Quick Drop order intake workflow with preparation/itemization capability. Enables counter staff to rapidly accept laundry bags, generate order numbers, and later itemize contents with service assignments and pricing.

---

## Business Value

- **Speed**: Sub-5 minute intake time (Quick Drop → receipt)
- **Flexibility**: Accept orders without immediate itemization
- **Accuracy**: Preparation step ensures correct pricing and SLA
- **Tracking**: Unique order number for customer tracking
- **Revenue**: Accurate pricing per-piece or per-service

---

## Requirements

### Functional Requirements

- **FR-ORDER-001**: Create Quick Drop order (customer + bag count, no items yet)
- **FR-ORDER-002**: Generate unique order number per tenant (format: ORD-YYYYMMDD-XXXX)
- **FR-ORDER-003**: Assign service category to order (wash-fold, dry-clean, iron, etc.)
- **FR-ORDER-004**: Capture order photos (bag/items condition)
- **FR-ORDER-005**: Print bag label with QR code (order number + barcode)
- **FR-ORDER-006**: Preparation workflow: itemize Quick Drop orders
- **FR-ORDER-007**: Add items with product selection from catalog
- **FR-ORDER-008**: Per-item service assignment (wash, dry-clean, iron, stain removal)
- **FR-ORDER-009**: Bulk item addition (e.g., "10x Shirts")
- **FR-ORDER-010**: Item metadata (color, brand, has stain, has damage)
- **FR-ORDER-011**: Calculate Ready-By date based on service category turnaround
- **FR-ORDER-012**: Calculate pricing (per-piece or per-kg)
- **FR-ORDER-013**: Apply discounts (manual override or promo codes - future)
- **FR-ORDER-014**: Customer notes and internal notes
- **FR-ORDER-015**: Priority setting (normal, urgent, express)

### Non-Functional Requirements

- **NFR-ORDER-001**: Quick Drop intake < 3 minutes
- **NFR-ORDER-002**: Preparation of 10 items < 3 minutes
- **NFR-ORDER-003**: Order number uniqueness guaranteed
- **NFR-ORDER-004**: Support 100,000+ orders per tenant
- **NFR-ORDER-005**: Photo upload < 5 seconds
- **NFR-ORDER-006**: Concurrent order creation (10+ operators)

---

## Database Schema

```sql
-- org_orders_mst (already exists in 0001_core.sql - extended)
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS ready_by_override TIMESTAMP;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS priority_multiplier NUMERIC(4,2) DEFAULT 1.0;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::JSONB;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(20) DEFAULT 'pending'; -- pending, in_progress, completed
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS prepared_by UUID;

-- org_order_items_dtl (already exists - extended)
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS product_name VARCHAR(250);
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS product_name2 VARCHAR(250);
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS stain_notes TEXT;
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS damage_notes TEXT;

-- Order number sequence per tenant
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Indexes
CREATE INDEX idx_orders_preparation_status ON org_orders_mst(tenant_org_id, preparation_status);
CREATE INDEX idx_orders_received_at ON org_orders_mst(tenant_org_id, received_at DESC);
```

---

## API Endpoints

### Quick Drop Order Creation

#### POST /v1/orders
Create new Quick Drop order.

**Request**:
```json
{
  "customerId": "customer-uuid",
  "branchId": "branch-uuid",
  "orderType": "quick_drop",
  "bagCount": 2,
  "serviceCategory": "wash_fold",
  "priority": "normal",
  "customerNotes": "Please use fragrance-free detergent",
  "photoUrls": ["https://storage.../bag1.jpg", "https://storage.../bag2.jpg"]
}
```

**Response** (201):
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD-20251010-0001",
  "customerId": "customer-uuid",
  "customerName": "Ahmed Al-Said",
  "customerPhone": "+96890123456",
  "branchId": "branch-uuid",
  "orderType": "quick_drop",
  "serviceCategory": "wash_fold",
  "status": "intake",
  "preparationStatus": "pending",
  "priority": "normal",
  "totalItems": 0,
  "bagCount": 2,
  "receivedAt": "2025-10-10T10:00:00Z",
  "readyBy": null, // Calculated after preparation
  "qrCode": "data:image/png;base64,...",
  "barcode": "ORD202510100001",
  "createdAt": "2025-10-10T10:00:00Z"
}
```

### Preparation / Itemization

#### GET /v1/orders/:orderId/preparation
Get order for preparation.

**Response** (200):
```json
{
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-20251010-0001",
    "customer": {
      "id": "customer-uuid",
      "name": "Ahmed Al-Said",
      "phone": "+96890123456",
      "preferences": {
        "folding": "hang",
        "fragrance": "lavender"
      }
    },
    "serviceCategory": "wash_fold",
    "priority": "normal",
    "bagCount": 2,
    "photoUrls": ["https://storage.../bag1.jpg"],
    "items": [], // Empty for new order
    "preparationStatus": "pending"
  },
  "productCatalog": [
    {
      "id": "product-uuid-1",
      "code": "SHIRT_01",
      "name": "Shirt (Regular)",
      "name2": "قميص عادي",
      "price": 1.500,
      "expressPrice": 2.250,
      "serviceCategory": "wash_fold",
      "unit": "piece"
    },
    {
      "id": "product-uuid-2",
      "code": "PANTS_01",
      "name": "Pants",
      "name2": "بنطلون",
      "price": 2.000,
      "expressPrice": 3.000,
      "serviceCategory": "wash_fold",
      "unit": "piece"
    }
    // ... more products
  ]
}
```

#### POST /v1/orders/:orderId/items
Add items to order during preparation.

**Request** (Bulk Add):
```json
{
  "items": [
    {
      "productId": "product-uuid-1",
      "quantity": 5,
      "serviceCategoryCode": "wash_fold",
      "color": "white",
      "brand": "Nike",
      "hasStain": false,
      "hasDamage": false
    },
    {
      "productId": "product-uuid-2",
      "quantity": 3,
      "serviceCategoryCode": "dry_clean",
      "color": "black",
      "hasStain": true,
      "stainNotes": "Coffee stain on left leg",
      "hasDamage": false
    }
  ],
  "isExpressService": false
}
```

**Response** (201):
```json
{
  "itemsAdded": 8,
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-20251010-0001",
    "totalItems": 8,
    "subtotal": 13.500,
    "tax": 0.675,
    "total": 14.175,
    "readyBy": "2025-10-12T18:00:00Z", // Calculated based on turnaround
    "items": [
      {
        "id": "item-uuid-1",
        "productId": "product-uuid-1",
        "productName": "Shirt (Regular)",
        "productName2": "قميص عادي",
        "quantity": 5,
        "pricePerUnit": 1.500,
        "totalPrice": 7.500,
        "serviceCategory": "wash_fold",
        "color": "white",
        "brand": "Nike"
      }
      // ... more items
    ]
  }
}
```

#### PATCH /v1/orders/:orderId/preparation/complete
Complete preparation and mark order ready for processing.

**Request**:
```json
{
  "readyByOverride": "2025-10-11T18:00:00Z", // Optional: override calculated date
  "internalNotes": "Customer requested extra care for delicate items"
}
```

**Response** (200):
```json
{
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-20251010-0001",
    "preparationStatus": "completed",
    "preparedAt": "2025-10-10T10:15:00Z",
    "preparedBy": "user-uuid",
    "status": "processing", // Auto-transition to processing
    "totalItems": 8,
    "subtotal": 13.500,
    "tax": 0.675,
    "total": 14.175,
    "readyBy": "2025-10-11T18:00:00Z"
  }
}
```

### Order Management

#### GET /v1/orders
List orders with filters.

**Query Parameters**:
- `page`, `limit`
- `status`: Filter by status
- `preparationStatus`: Filter by preparation status
- `customerId`: Filter by customer
- `fromDate`, `toDate`: Date range
- `search`: Search by order number, customer name/phone

**Response** (200):
```json
{
  "orders": [
    {
      "id": "order-uuid",
      "orderNumber": "ORD-20251010-0001",
      "customer": {
        "id": "customer-uuid",
        "name": "Ahmed Al-Said",
        "phone": "+96890123456"
      },
      "status": "processing",
      "preparationStatus": "completed",
      "priority": "normal",
      "totalItems": 8,
      "total": 14.175,
      "receivedAt": "2025-10-10T10:00:00Z",
      "readyBy": "2025-10-11T18:00:00Z"
    }
    // ... more orders
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /v1/orders/:orderId
Get order details.

**Response** (200):
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD-20251010-0001",
  "tenant": {
    "id": "tenant-uuid",
    "name": "Laundry Plus"
  },
  "branch": {
    "id": "branch-uuid",
    "name": "Main Branch"
  },
  "customer": {
    "id": "customer-uuid",
    "customerNumber": "CUST-00001",
    "name": "Ahmed Al-Said",
    "phone": "+96890123456",
    "preferences": {
      "folding": "hang",
      "fragrance": "lavender"
    }
  },
  "orderType": "quick_drop",
  "serviceCategory": "wash_fold",
  "status": "processing",
  "preparationStatus": "completed",
  "priority": "normal",
  "totalItems": 8,
  "subtotal": 13.500,
  "discount": 0,
  "tax": 0.675,
  "total": 14.175,
  "paymentStatus": "pending",
  "receivedAt": "2025-10-10T10:00:00Z",
  "readyBy": "2025-10-11T18:00:00Z",
  "preparedAt": "2025-10-10T10:15:00Z",
  "preparedBy": {
    "id": "user-uuid",
    "name": "Jane Operator"
  },
  "customerNotes": "Please use fragrance-free detergent",
  "internalNotes": "Customer requested extra care for delicate items",
  "photoUrls": ["https://storage.../bag1.jpg"],
  "items": [
    {
      "id": "item-uuid-1",
      "orderItemSrno": "1",
      "productId": "product-uuid-1",
      "productName": "Shirt (Regular)",
      "productName2": "قميص عادي",
      "serviceCategory": "wash_fold",
      "quantity": 5,
      "pricePerUnit": 1.500,
      "totalPrice": 7.500,
      "color": "white",
      "brand": "Nike",
      "hasStain": false,
      "hasDamage": false,
      "status": "pending"
    }
    // ... more items
  ],
  "qrCode": "data:image/png;base64,...",
  "barcode": "ORD202510100001",
  "createdAt": "2025-10-10T10:00:00Z",
  "updatedAt": "2025-10-10T10:15:00Z"
}
```

---

## UI/UX Requirements

### Quick Drop Intake Screen (POS)
- **Customer Selection**: Search/select customer (or create stub)
- **Service Category**: Dropdown (wash-fold, dry-clean, iron, etc.)
- **Bag Count**: Number input (default: 1)
- **Priority**: Toggle (normal/urgent/express)
- **Customer Notes**: Text area
- **Photo Upload**: Drag-drop or camera capture
- **Actions**: Save & Print Label, Cancel
- **Time Target**: Complete in < 3 minutes

### Preparation Screen (POS)
- **Order Summary**: Order number, customer, service category, bag count
- **Product Catalog**: Grid or list view with search
- **Quick Add**: Click product → quantity input → add to cart
- **Bulk Add**: "10x Shirts" shortcut
- **Item Details Form**: Color, brand, stain/damage checkboxes with notes
- **Live Pricing**: Subtotal, tax, total updates in real-time
- **Ready-By Calculator**: Auto-calculated, with override option
- **Actions**: Complete Preparation, Save Draft
- **Time Target**: 10 items in < 3 minutes

### Order List Screen
- **Table Columns**: Order #, Customer, Status, Prep Status, Items, Total, Ready By, Actions
- **Filters**: Status, Date Range, Preparation Status
- **Search**: By order number, customer name/phone
- **Actions**: View Details, Start Preparation (if pending), Print Label

### Order Detail Screen
- **Sections**: Order Info, Customer Info, Items, Timeline, Actions
- **Order Info**: Order #, Type, Service, Priority, Status, Total
- **Customer Info**: Name, phone, preferences, notes
- **Items Table**: Product, Qty, Price, Service, Color/Brand, Stain/Damage
- **Timeline**: Created → Prepared → Processing → Ready → Delivered
- **Actions**: Edit (if not processed), Print Invoice, Print Label

---

## Technical Implementation

### Backend Tasks

1. **OrdersService**
   - `createQuickDrop()` - Create Quick Drop order with order number generation
   - `getForPreparation()` - Get order with product catalog
   - `addItems()` - Bulk add items with pricing calculation
   - `completePreparation()` - Mark preparation done, calculate Ready-By
   - `calculateReadyBy()` - Based on service category turnaround + priority

2. **Order Number Generation**
   - Format: `ORD-YYYYMMDD-XXXX` (e.g., ORD-20251010-0001)
   - Sequential per tenant per day
   - Reset counter daily at midnight
   - Use PostgreSQL sequence with tenant isolation

3. **Pricing Engine**
   - Get product price from catalog
   - Apply express multiplier if priority = express
   - Calculate tax based on tenant country VAT rate
   - Apply discounts (future - PRD-021)

4. **Ready-By Calculator**
   - Get service category turnaround hours (from sys_service_category_cd)
   - Apply priority multiplier (normal: 1.0, urgent: 0.7, express: 0.5)
   - Calculate: receivedAt + (turnaround * multiplier)
   - Round to business hours (use tenant business_hours)
   - Manual override allowed

5. **QR Code & Barcode Generation**
   - QR Code: Contains order number + tenant ID + customer phone
   - Barcode: EAN-13 format with order number
   - Generate on order creation
   - Store as data URL or image URL

### Frontend Tasks (Next.js Admin)

1. **Quick Drop Form**
   - Customer autocomplete search
   - Service category dropdown
   - Photo upload component
   - Real-time order number preview

2. **Preparation Screen**
   - Product catalog grid with search/filter
   - Shopping cart-style interface
   - Bulk add shortcuts (e.g., "5 Shirts")
   - Live pricing calculator
   - Item detail modal (color, stain, damage)

3. **Order List & Details**
   - Data table with server-side pagination
   - Filters and search
   - Order detail page with tabs
   - Print label/invoice functions

### Database Migrations

```sql
-- Migration: 0007_order_intake_enhancements.sql

ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS ready_by_override TIMESTAMP;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS priority_multiplier NUMERIC(4,2) DEFAULT 1.0;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::JSONB;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;
ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS prepared_by UUID;

ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS product_name VARCHAR(250);
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS product_name2 VARCHAR(250);
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS stain_notes TEXT;
ALTER TABLE org_order_items_dtl ADD COLUMN IF NOT EXISTS damage_notes TEXT;

CREATE INDEX idx_orders_preparation_status ON org_orders_mst(tenant_org_id, preparation_status);
CREATE INDEX idx_orders_received_at ON org_orders_mst(tenant_org_id, received_at DESC);
```

---

## Acceptance Criteria

- [ ] Quick Drop order created in < 3 minutes
- [ ] Order number generated uniquely per tenant per day
- [ ] Bag label printed with QR code and barcode
- [ ] Preparation screen loads with product catalog
- [ ] 10 items can be added in < 3 minutes
- [ ] Pricing calculated correctly (per-piece + tax)
- [ ] Ready-By date calculated based on turnaround time
- [ ] Express service applies 1.5x multiplier to price
- [ ] Photo upload works and URLs stored
- [ ] Order transitions to "processing" after preparation complete

---

## Testing Requirements

### Unit Tests
- Order number generation (uniqueness, format)
- Pricing calculation (base + express + tax)
- Ready-By calculator (turnaround + priority + business hours)

### Integration Tests
- POST /v1/orders → creates order with composite FK
- POST /v1/orders/:id/items → adds items with pricing
- PATCH /v1/orders/:id/preparation/complete → updates status

### E2E Tests
- Quick Drop: Select customer → Set service → Upload photo → Save → Print label
- Preparation: Open order → Add 10 items → Complete → Verify pricing

---

## References

- Requirements: Section 3.1 (Orders & Intake)
- UC01: Quick Drop Intake & Preparation
- Related PRDs: PRD-003 (Customer), PRD-005 (Workflow), PRD-006 (Receipts)

---

**Status**: Ready for Implementation
**Estimated Effort**: 80 hours (2 weeks with 2 developers)
