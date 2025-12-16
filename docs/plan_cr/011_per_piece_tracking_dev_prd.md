# Per-Piece Tracking - Development Plan & PRD

**Document ID**: 011  
**Version**: 1.0  
**Dependencies**: 001-010  
**Related Requirements**: FR-TRK-001, UC04

---

## Overview

Implement barcode/RFID scanning system for tracking each item through workflow stages with missing item alerts and complete audit trail.

## Functional Requirements

- **FR-TRK-001**: Barcode scanning at each transition
- **FR-TRK-002**: Expected vs scanned validation
- **FR-TRK-003**: Missing item alerts
- **FR-TRK-004**: Item location tracking
- **FR-TRK-005**: Piece history timeline

## Technical Design

### Scanning Events Table

```sql
CREATE TABLE org_item_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scanned_by VARCHAR(120),
  workflow_stage VARCHAR(50) NOT NULL,
  location_code VARCHAR(50),
  scan_type VARCHAR(20), -- in, out, verify
  device_info JSONB,
  FOREIGN KEY (order_item_id) REFERENCES org_order_items_dtl(id),
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id)
);
```

### API Endpoints

```typescript
POST   /api/v1/tracking/scan              // Record scan event
GET    /api/v1/tracking/items/:barcode    // Get item details
GET    /api/v1/tracking/items/:id/history // Scan history
GET    /api/v1/tracking/missing           // Missing items report
```

## Implementation (4 days)

1. Scan event logging (1 day)
2. Validation logic (1 day)
3. Missing item alerts (1 day)
4. UI: Scanning interface (1 day)

## Success Metrics

- Scan time: < 1 second
- Missing detection: 100%
- Audit completeness: 100%

## Acceptance Checklist

- [ ] Barcode scanning functional
- [ ] Item tracking per stage
- [ ] Missing alerts working
- [ ] History timeline display

---

**Last Updated**: 2025-10-09
