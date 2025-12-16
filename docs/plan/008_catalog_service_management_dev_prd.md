# Catalog & Service Management - Development Plan & PRD

**Document ID**: 008_catalog_service_management_dev_prd  
**Version**: 1.0  
**Status**: Ready  
**Owner**: Backend + Frontend Team  
**Dependencies**: 001-005  
**Related Requirements**: Service catalog management

---

## 1. Overview

Implement service catalog management including service categories, product/service items, pricing (regular, express, VIP), and bulk import/export capabilities.

---

## 2. Functional Requirements

### FR-CAT-001: Service Categories

- Enable/disable global service categories per tenant
- Categories: Dry Cleaning, Laundry, Ironing, Repairs, Alterations
- Custom categories (optional)
- Bilingual names (EN/AR)

### FR-CAT-002: Product Management

- Create products with codes, names, descriptions
- Multiple pricing levels (regular, express)
- Unit types (per piece, per kg)
- Min/max quantities
- Turnaround times
- Active/inactive status

### FR-CAT-003: Pricing Management

- Price lists per service level
- Seasonal pricing
- Customer type pricing (B2C vs B2B)
- Bulk pricing discounts

### FR-CAT-004: Bulk Operations

- CSV import/export
- Template download
- Validation on import
- Bulk activate/deactivate
- Price update wizards

---

## 3. Technical Design

### Database Schema

Uses existing:

- `sys_service_category_cd` (global categories)
- `org_service_category_cf` (tenant enablement)
- `org_product_data_mst` (products)

Additional:

```sql
CREATE TABLE org_price_lists_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- standard, express, vip, seasonal
  effective_from DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE TABLE org_price_list_items_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL,
  product_id UUID NOT NULL,
  price NUMERIC(10,3) NOT NULL,
  FOREIGN KEY (price_list_id) REFERENCES org_price_lists_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES org_product_data_mst(id) ON DELETE CASCADE
);
```

### API Endpoints

```typescript
// Categories
GET    /api/v1/categories                 // List available categories
POST   /api/v1/categories/enable          // Enable categories for tenant

// Products
GET    /api/v1/products                   // List products
POST   /api/v1/products                   // Create product
GET    /api/v1/products/:id               // Get product
PATCH  /api/v1/products/:id               // Update product
DELETE /api/v1/products/:id               // Delete product
POST   /api/v1/products/import            // Bulk import
GET    /api/v1/products/export            // Bulk export
```

---

## 4. Implementation Plan (6 days)

### Phase 1: Category Management (1 day)

- Category enablement API
- UI for selecting categories

### Phase 2: Product CRUD (2 days)

- Product APIs
- Product form UI
- Validation logic

### Phase 3: Pricing (2 days)

- Price list management
- Multiple pricing levels
- Price calculation logic

### Phase 4: Bulk Operations (1 day)

- CSV import/export
- Validation
- Bulk update wizards

---

## 5. Success Metrics

| Metric            | Target                 |
| ----------------- | ---------------------- |
| Product Load Time | < 1s for 1000 products |
| Import Speed      | > 100 products/second  |
| Search Response   | < 300ms                |

---

## 6. Acceptance Checklist

- [ ] Category management working
- [ ] Product CRUD functional
- [ ] Pricing levels supported
- [ ] Bulk import/export
- [ ] Validation comprehensive
- [ ] UI responsive

---

**Document Version**: 1.0
