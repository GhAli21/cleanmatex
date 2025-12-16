# PRD-SAAS-MNG-0007: Core Data Management - System Codes

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 2 - High Priority

---

## Overview & Purpose

This PRD defines the system codes management system for all reference codes and lookup tables including currencies, colors, icons, priorities, units, invoice types, order statuses, organization types, payment methods, and payment types.

**Business Value:**
- Centralized code management
- Consistent reference data
- Bilingual support
- Code locking mechanism
- Dependency validation

---

## Functional Requirements

### FR-CODE-001: Currency Management
- **Description**: Manage currency codes (`sys_currency_cd`)
- **Acceptance Criteria**:
  - Create/edit currencies
  - Set currency symbols
  - Configure exchange rates
  - Bilingual names

### FR-CODE-002: Color Code Management
- **Description**: Manage color codes (`sys_color_cd`)
- **Acceptance Criteria**:
  - Create/edit colors
  - Set hex codes
  - Bilingual names
  - Color preview

### FR-CODE-003: Icon Code Management
- **Description**: Manage icon codes (`sys_icons_cd`)
- **Acceptance Criteria**:
  - Create/edit icons
  - Upload icon files
  - Set icon categories
  - Preview icons

### FR-CODE-004: Priority Code Management
- **Description**: Manage priority codes (`sys_priority_cd`)
- **Acceptance Criteria**:
  - Create/edit priorities
  - Set priority levels
  - Bilingual names
  - Color coding

### FR-CODE-005: Product Unit Management
- **Description**: Manage measurement units (`sys_product_unit_cd`)
- **Acceptance Criteria**:
  - Create/edit units
  - Set unit types (weight, volume, count)
  - Conversion factors
  - Bilingual names

### FR-CODE-006: Invoice Type Management
- **Description**: Manage invoice types (`sys_invoice_type_cd`)
- **Acceptance Criteria**:
  - Create/edit invoice types
  - Bilingual names
  - Set default templates

### FR-CODE-007: Order Status Management
- **Description**: Manage order status codes (`sys_order_status_cd`)
- **Acceptance Criteria**:
  - Create/edit statuses
  - Bilingual names
  - Set status colors
  - Configure status flow

### FR-CODE-008: Organization Type Management
- **Description**: Manage organization types (`sys_org_type_cd`)
- **Acceptance Criteria**:
  - Create/edit org types
  - Bilingual names
  - Set type-specific settings

### FR-CODE-009: Payment Method Management
- **Description**: Manage payment methods (`sys_payment_method_cd`)
- **Acceptance Criteria**:
  - Create/edit payment methods
  - Bilingual names
  - Configure payment gateways
  - Set processing fees

### FR-CODE-010: Payment Type Management
- **Description**: Manage payment types (`sys_payment_type_cd`)
- **Acceptance Criteria**:
  - Create/edit payment types (Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup)
  - Bilingual names
  - Set default behavior

### FR-CODE-011: Code Locking
- **Description**: Lock codes from accidental edits
- **Acceptance Criteria**:
  - Lock/unlock codes
  - Require approval for locked code changes
  - View locked codes

### FR-CODE-012: Dependency Validation
- **Description**: Validate code dependencies
- **Acceptance Criteria**:
  - Check dependencies before deletion
  - Show dependency warnings
  - Prevent deletion of codes in use

---

## Technical Requirements

### Database Schema

Uses existing `sys_*_cd` tables:
- `sys_currency_cd`
- `sys_color_cd`
- `sys_icons_cd`
- `sys_priority_cd`
- `sys_product_unit_cd`
- `sys_invoice_type_cd`
- `sys_order_status_cd`
- `sys_org_type_cd`
- `sys_payment_method_cd`
- `sys_payment_type_cd`
- `sys_order_type_cd`

---

## API Endpoints

### Generic Code Management

#### List Codes
```
GET /api/hq/v1/codes/:tableName?page=1&limit=20
Response: { data: Code[], pagination }
```

#### Create Code
```
POST /api/hq/v1/codes/:tableName
Body: { code, name, name2?, ... }
Response: { success: boolean, data: Code }
```

#### Update Code
```
PATCH /api/hq/v1/codes/:tableName/:code
Body: { name?, name2?, ... }
Response: { success: boolean, data: Code }
```

#### Delete Code
```
DELETE /api/hq/v1/codes/:tableName/:code
Response: { success: boolean, message: string }
```

#### Lock Code
```
POST /api/hq/v1/codes/:tableName/:code/lock
Response: { success: boolean, message: string }
```

#### Unlock Code
```
POST /api/hq/v1/codes/:tableName/:code/unlock
Response: { success: boolean, message: string }
```

---

## UI/UX Requirements

### Code Management Dashboard
- Navigation to each code table
- Quick stats per code type
- Locked codes indicator

### Code Editor Pages
- List view with search/filter
- Create/edit forms
- Bilingual input fields
- Lock/unlock actions
- Dependency warnings

---

## Security Considerations

1. **Code Locking**: Prevent accidental edits to critical codes
2. **Dependency Check**: Validate before deletion
3. **Audit Trail**: Log all code changes
4. **Approval**: Require approval for locked code changes

---

## Testing Requirements

- Unit tests for code CRUD
- Dependency validation tests
- Locking mechanism tests
- E2E tests for code management

---

## Implementation Checklist

- [ ] Review existing code tables
- [ ] Implement generic code API
- [ ] Create code management UI
- [ ] Add bilingual support
- [ ] Implement code locking
- [ ] Add dependency validation
- [ ] Write tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0006: Core Data Management - Service Catalog

