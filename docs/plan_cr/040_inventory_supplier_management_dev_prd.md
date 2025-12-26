# Inventory & Supplier Management - Development Plan & PRD

**Document ID**: 040 | **Version**: 1.0 | **Dependencies**: 021  
**FR-INV-101, FR-SUP-001, UC13, UC27**

## Overview

Implement inventory tracking for consumables, supplier management, PO creation, and cost allocation.

## Requirements

- Inventory items (detergents, hangers, bags)
- Stock levels & thresholds
- Low stock alerts
- Supplier records
- Purchase orders
- Receiving goods
- Cost per order allocation

## Database

```sql
CREATE TABLE org_inventory_items (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  item_name VARCHAR(255),
  sku VARCHAR(100),
  quantity_on_hand NUMERIC(10,2),
  reorder_point NUMERIC(10,2),
  unit_cost NUMERIC(10,2)
);

CREATE TABLE org_suppliers (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  name VARCHAR(255),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255)
);

CREATE TABLE org_purchase_orders (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  supplier_id UUID,
  po_number VARCHAR(100),
  status VARCHAR(20),
  total_amount NUMERIC(10,2)
);
```

## Implementation (4 days)

1. Inventory tracking (2 days)
2. Supplier management (1 day)
3. Purchase orders (1 day)

## Acceptance

- [ ] Stock tracking working
- [ ] Alerts firing
- [ ] POs functional

**Last Updated**: 2025-10-09
