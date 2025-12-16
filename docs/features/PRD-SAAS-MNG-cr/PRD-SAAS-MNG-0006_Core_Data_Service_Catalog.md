# PRD-SAAS-MNG-0006: Core Data Management - Service Catalog

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 2 - High Priority

---

## Overview & Purpose

This PRD defines the service catalog management system for managing all service-related reference data including service categories, types, item types, fabric types, products, notes, stains, and preferences.

**Business Value:**
- Centralized catalog management
- Consistent service definitions across tenants
- Bilingual support (EN/AR)
- Catalog versioning and rollback
- Push updates to tenants

---

## Functional Requirements

### FR-CAT-001: Service Category Management
- **Description**: Manage service categories (DRY_CLEAN, LAUNDRY, IRON_ONLY, REPAIRS, ALTERATION)
- **Acceptance Criteria**:
  - Create/edit service categories
  - Bilingual names (EN/AR)
  - Set turnaround times
  - Configure express multipliers
  - Enable/disable categories

### FR-CAT-002: Service Type Management
- **Description**: Manage service types within categories
- **Acceptance Criteria**:
  - Create/edit service types
  - Link to service categories
  - Set pricing rules
  - Bilingual support

### FR-CAT-003: Item Type Management
- **Description**: Manage item types (shirt, pants, dress, etc.)
- **Acceptance Criteria**:
  - Create/edit item types
  - Bilingual names
  - Set default pricing
  - Categorize items

### FR-CAT-004: Fabric Type Management
- **Description**: Manage fabric types (cotton, silk, wool, etc.)
- **Acceptance Criteria**:
  - Create/edit fabric types
  - Bilingual names
  - Set care instructions
  - Link to service categories

### FR-CAT-005: Product/Item Management
- **Description**: Manage default products/items (`sys_products_init_data_mst`)
- **Acceptance Criteria**:
  - Create/edit products
  - Set product codes
  - Configure pricing
  - Bilingual names
  - Push to tenants

### FR-CAT-006: Item Notes Management
- **Description**: Manage item notes categories and codes
- **Acceptance Criteria**:
  - Create note categories
  - Create note codes within categories
  - Bilingual notes
  - Set note priorities

### FR-CAT-007: Stain Type Management
- **Description**: Manage stain types
- **Acceptance Criteria**:
  - Create/edit stain types
  - Bilingual names
  - Set treatment methods
  - Link to service categories

### FR-CAT-008: Preference Management
- **Description**: Manage customer preferences
- **Acceptance Criteria**:
  - Create preference categories
  - Create preference options
  - Bilingual support
  - Set default values

### FR-CAT-009: Catalog Versioning
- **Description**: Version control for catalog changes
- **Acceptance Criteria**:
  - Create catalog versions
  - Rollback to previous version
  - View version history
  - Compare versions

### FR-CAT-010: Push to Tenants
- **Description**: Push catalog updates to tenants
- **Acceptance Criteria**:
  - Select tenants for update
  - Preview changes before push
  - Push catalog updates
  - Track push status

---

## Technical Requirements

### Database Schema

Uses existing tables:
- `sys_service_category_cd`
- `sys_service_type_cd`
- `sys_item_type_cd`
- `sys_item_fabric_type_cd`
- `sys_products_init_data_mst`
- `sys_item_notes_ctg_cd`
- `sys_item_notes_cd`
- `sys_item_stain_type_cd`
- `sys_preference_ctg_cd`
- `sys_preference_options_cd`

---

## API Endpoints

### Service Categories

#### List Service Categories
```
GET /api/hq/v1/catalog/service-categories
Response: { data: ServiceCategory[] }
```

#### Create Service Category
```
POST /api/hq/v1/catalog/service-categories
Body: { service_category_code, ctg_name, ctg_name2, ... }
Response: { success: boolean, data: ServiceCategory }
```

#### Update Service Category
```
PATCH /api/hq/v1/catalog/service-categories/:code
Body: { ctg_name?, ctg_name2?, ... }
Response: { success: boolean, data: ServiceCategory }
```

### Similar endpoints for all catalog tables

### Push to Tenant

#### Push Catalog Updates
```
POST /api/hq/v1/catalog/push/:tenantId
Body: { catalog_types: string[], version_id? }
Response: { success: boolean, message: string }
```

---

## UI/UX Requirements

### Catalog Management Dashboard
- Navigation to each catalog section
- Quick stats per catalog type
- Recent changes timeline

### Catalog Editor Pages
- List view with search/filter
- Create/edit forms
- Bilingual input fields
- Validation feedback

### Push to Tenants Interface
- Tenant selection
- Change preview
- Push confirmation
- Push status tracking

---

## Security Considerations

1. **Catalog Locking**: Lock critical catalog items from editing
2. **Validation**: Validate catalog data before save
3. **Audit Trail**: Log all catalog changes
4. **Dependency Check**: Prevent deletion of items in use

---

## Testing Requirements

- Unit tests for catalog CRUD
- Integration tests for push operations
- Validation tests
- E2E tests for catalog management

---

## Implementation Checklist

- [ ] Review existing catalog tables
- [ ] Implement service category API
- [ ] Implement all catalog APIs
- [ ] Create catalog management UI
- [ ] Add bilingual support
- [ ] Implement versioning
- [ ] Implement push to tenants
- [ ] Add catalog locking
- [ ] Write tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0001: Tenant Lifecycle Management
- PRD-SAAS-MNG-0007: Core Data Management - System Codes

