# Order Preparation & Itemization - Development Plan & PRD

**Document ID**: 009_order_preparation_itemization_dev_prd  
**Version**: 1.0  
**Owner**: Backend + Frontend Team  
**Dependencies**: 001-008  
**Related Requirements**: FR-PRE-001, UC01

---

## 1. Overview

Implement fast itemization interface for detailed order processing after Quick Drop, including per-piece service assignment, barcode generation, stain/damage notes.

**Performance Target**: 10 items in ≤ 3 minutes

---

## 2. Functional Requirements

### FR-PREP-001: Fast Itemization UI

- Bulk add with presets (e.g., "5x Shirt - Laundry")
- Quick service assignment
- Auto-barcode generation per item
- Color, brand, stain, damage notes
- Photo attachment per item

### FR-PREP-002: Item Presets

- Common item combos (5 shirts, 2 pants, 1 thobe)
- Recent order templates
- Customer favorites
- Category-based quick adds

### FR-PREP-003: Pricing Calculation

- Real-time price display
- Service-level pricing (normal/express)
- Discount application
- Tax calculation
- Total preview

### FR-PREP-004: Completion

- Mark preparation complete
- Generate item labels
- Update order status to "sorting"
- Lock itemization
- Print detailed receipt

---

## 3. Technical Design

### Preparation Flow

```
Preparation Task (pending) →
  Assign to operator →
    Open itemization UI →
      Add items (bulk/individual) →
        Generate barcodes →
          Calculate pricing →
            Review & confirm →
              Mark complete →
                Order → "sorting" status
```

### Database Updates

```sql
-- Populate org_order_items_dtl during preparation
INSERT INTO org_order_items_dtl (
  order_id, tenant_org_id, service_category_code,
  product_id, barcode, quantity, price_per_unit, total_price,
  color, brand, has_stain, has_damage, notes
) VALUES (...);

-- Update order totals
UPDATE org_orders_mst
SET total_items = ?,
    subtotal = ?,
    tax = ?,
    total = ?,
    status = 'sorting'
WHERE id = ?;

-- Mark preparation task complete
UPDATE org_preparation_tasks
SET status = 'completed',
    completed_at = NOW()
WHERE order_id = ?;
```

### API Endpoints

```typescript
GET    /api/v1/preparation/pending      // List pending tasks
POST   /api/v1/preparation/:id/start    // Start preparation
POST   /api/v1/preparation/:id/items    // Add items (bulk)
PATCH  /api/v1/preparation/:id/items/:itemId // Update item
DELETE /api/v1/preparation/:id/items/:itemId // Remove item
POST   /api/v1/preparation/:id/complete // Complete preparation
GET    /api/v1/preparation/:id/preview  // Price preview
```

---

## 4. Implementation Plan (4 days)

### Phase 1: Preparation API (2 days)

- Task management endpoints
- Item addition/update/delete
- Price calculation engine
- Completion logic

### Phase 2: Itemization UI (3 days)

- Fast entry interface
- Preset buttons
- Barcode display
- Price preview
- Item list with inline edit

### Phase 3: Barcode & Labels (1 day)

- Barcode generation
- Item label templates
- Print integration

---

## 5. UI Design

### Fast Itemization Interface

```
┌─────────────────────────────────────────┐
│ Order #12345 - Preparation              │
│ Customer: John Doe | Bags: 2           │
├─────────────────────────────────────────┤
│ Quick Add Presets:                      │
│ [+5 Shirts] [+2 Pants] [+1 Thobe]      │
│ [+Custom Item]                          │
├─────────────────────────────────────────┤
│ Items (12):               Subtotal: 45 OMR│
│ ┌─────────────────────────────────────┐ │
│ │ 1. Shirt (White) - Laundry    3.5  │ │
│ │ 2. Pants (Black) - Dry Clean  5.0  │ │
│ │ ... (scroll)                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Save Draft] [Complete & Continue]     │
└─────────────────────────────────────────┘
```

---

## 6. Success Metrics

| Metric            | Target              |
| ----------------- | ------------------- |
| Itemization Speed | 10 items in ≤ 3 min |
| Accuracy          | ≥ 99% (UAT)         |
| UI Response       | < 100ms per action  |

---

## 7. Acceptance Checklist

- [ ] Fast itemization UI
- [ ] Bulk add working
- [ ] Presets functional
- [ ] Barcode generation
- [ ] Price calculation accurate
- [ ] Item labels print
- [ ] Preparation completion
- [ ] Order transitions to sorting

---

**Document Version**: 1.0
