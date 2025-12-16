# Order Intake (Quick Drop) - Development Plan & PRD

**Document ID**: 008_order_intake_quick_drop_dev_prd  
**Version**: 1.0  
**Status**: Ready  
**Owner**: Backend + Frontend Team  
**Dependencies**: 001-007  
**Related Requirements**: FR-QD-001, UC01

---

## 1. Overview

Implement Quick Drop order intake where customers drop off items and itemization happens later during Preparation phase.

### Business Value

- Fast counter service (< 5 min target)
- Minimal customer wait time
- Accurate tracking from intake
- Photo evidence capability

---

## 2. Functional Requirements

### FR-QD-001: Quick Drop Intake

- Capture customer info (quick select or new)
- Capture bag count and photos (optional)
- Generate bag labels/barcodes
- Set expected ready-by date
- Auto-create Preparation task
- Generate temporary receipt

**Acceptance Criteria**:

- Process complete in < 2 minutes
- Bag labels print immediately
- Order in "intake" status
- Preparation task created
- Customer receives SMS/WhatsApp notification

### FR-QD-002: Photo Capture

- Camera integration (web/mobile)
- Multiple photos per bag
- Photo compression
- Cloud storage integration
- Photo viewer in order details

### FR-QD-003: Bag Labeling

- Generate unique barcode per bag
- Print label with: Order #, Customer name, Date, Barcode
- Support multiple bag types
- QR code for mobile scanning

### FR-QD-004: Quick Receipt

- Generate temporary receipt
- Show: Order #, Customer, Bag count, Expected ready date
- Delivery via WhatsApp/SMS/Print
- Digital receipt link

---

## 3. Technical Design

### Order Status Flow

```
Quick Drop → intake → (Preparation Task Created)
           ↓
      Preparation → [detailed itemization]
           ↓
       [rest of workflow...]
```

### Database Schema

Uses existing:

- `org_orders_mst` (status = 'intake')
- `org_order_items_dtl` (added during Preparation)

Additional:

```sql
CREATE TABLE org_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(50), -- intake, assembly, qa, damage
  uploaded_by VARCHAR(120),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE TABLE org_preparation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  tenant_org_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed
  assigned_to UUID,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  bag_count INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);
```

### API Endpoints

```typescript
POST   /api/v1/orders/quick-drop        // Create quick drop order
POST   /api/v1/orders/:id/photos        // Upload photos
GET    /api/v1/orders/:id/receipt       // Get temp receipt
POST   /api/v1/orders/:id/print-labels  // Print bag labels
```

### Quick Drop Creation Flow

```typescript
async function createQuickDropOrder(data: {
  tenant_org_id: string;
  customer_id: string;
  branch_id: string;
  bag_count: number;
  priority: "normal" | "express";
  photos?: File[];
  notes?: string;
}): Promise<Order> {
  // 1. Generate order number
  const orderNo = await generateOrderNumber(data.tenant_org_id);

  // 2. Calculate ready-by date
  const readyBy = calculateReadyBy(data.priority); // +48h normal, +24h express

  // 3. Create order
  const order = await db.insert("org_orders_mst", {
    tenant_org_id: data.tenant_org_id,
    branch_id: data.branch_id,
    customer_id: data.customer_id,
    order_no: orderNo,
    status: "intake",
    priority: data.priority,
    total_items: 0, // Will be set during preparation
    ready_by: readyBy,
    customer_notes: data.notes,
    received_at: new Date(),
  });

  // 4. Create preparation task
  await db.insert("org_preparation_tasks", {
    order_id: order.id,
    tenant_org_id: data.tenant_org_id,
    bag_count: data.bag_count,
    status: "pending",
  });

  // 5. Upload photos if provided
  if (data.photos?.length) {
    for (const photo of data.photos) {
      const photoUrl = await uploadToStorage(photo);
      await db.insert("org_order_photos", {
        order_id: order.id,
        tenant_org_id: data.tenant_org_id,
        photo_url: photoUrl,
        photo_type: "intake",
      });
    }
  }

  // 6. Generate bag labels
  await generateBagLabels(order.id, data.bag_count);

  // 7. Send notification
  await sendOrderCreatedNotification(order.id);

  // 8. Increment usage
  await incrementOrderUsage(data.tenant_org_id);

  return order;
}
```

---

## 4. Implementation Plan (5 days)

### Phase 1: Quick Drop API (2 days)

- Order creation endpoint
- Order number generation
- Ready-by calculation
- Preparation task auto-creation

### Phase 2: Photo Management (1 day)

- Photo upload API
- Storage integration (MinIO/Supabase)
- Photo compression
- Photo viewer component

### Phase 3: Labeling System (1 day)

- Barcode generation
- Label templates (PDF)
- Print integration
- Multi-bag support

### Phase 4: UI Implementation (2 days)

- Quick Drop form
- Customer selector
- Photo capture interface
- Label print preview
- Receipt display

---

## 5. UI Design

### Quick Drop Form

```
┌─────────────────────────────────────┐
│  Quick Drop Order                    │
├─────────────────────────────────────┤
│  Customer: [Search/Select...     ▼] │
│  Bags: [2]  Priority: ○ Normal ● Express │
│  Photos: [Upload] [Capture]         │
│  ┌───────┐ ┌───────┐               │
│  │ Photo │ │ Photo │               │
│  └───────┘ └───────┘               │
│  Notes: [________________________] │
│                                     │
│  Ready By: Wed, Oct 11, 2pm        │
│                                     │
│  [Cancel]  [Create Order & Print]  │
└─────────────────────────────────────┘
```

---

## 6. Success Metrics

| Metric           | Target                |
| ---------------- | --------------------- |
| Intake Time      | < 2 minutes           |
| Label Print Time | < 5 seconds           |
| Photo Upload     | < 3 seconds per photo |
| Receipt Delivery | < 30 seconds          |

---

## 7. Acceptance Checklist

- [ ] Quick drop order creation
- [ ] Auto preparation task
- [ ] Photo upload working
- [ ] Label generation
- [ ] Print integration
- [ ] Receipt delivery (SMS/WhatsApp)
- [ ] UI responsive
- [ ] Performance targets met

---

**Document Version**: 1.0
