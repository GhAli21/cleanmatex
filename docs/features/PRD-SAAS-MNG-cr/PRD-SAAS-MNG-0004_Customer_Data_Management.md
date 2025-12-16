# PRD-SAAS-MNG-0004: Customer Data Management (Global & Tenant)

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 3 - Medium Priority

---

## Overview & Purpose

This PRD defines the two-layer customer management system: global customers (shared identity across tenants) and tenant-specific customers, with tools to manage, link, and deduplicate customer data.

**Business Value:**
- Unified customer identity across tenants
- Customer deduplication and merging
- Cross-tenant customer insights
- Privacy-compliant customer management
- Efficient customer data operations

---

## Functional Requirements

### FR-CUST-001: Global Customer Management
- **Description**: Manage global customer master data
- **Acceptance Criteria**:
  - View all global customers (`sys_customers_mst`)
  - Search global customers by phone, email, name
  - Edit global customer information
  - View tenant associations

### FR-CUST-002: Tenant Customer Management
- **Description**: Manage tenant-specific customers
- **Acceptance Criteria**:
  - View customers per tenant
  - Search customers within tenant
  - Link/unlink global customers to tenant customers
  - View customer activity per tenant

### FR-CUST-003: Customer Linking
- **Description**: Link global customers to tenant customers
- **Acceptance Criteria**:
  - Link existing global customer to tenant customer
  - Create new global customer from tenant customer
  - Unlink customer associations
  - View link history

### FR-CUST-004: Customer Deduplication
- **Description**: Identify and merge duplicate customers
- **Acceptance Criteria**:
  - Detect duplicate customers (by phone, email)
  - Merge duplicate global customers
  - Merge duplicate tenant customers
  - Preserve all historical data

### FR-CUST-005: Cross-Tenant Search
- **Description**: Search customers across all tenants
- **Acceptance Criteria**:
  - Search with privacy controls
  - Filter by tenant
  - View customer activity across tenants
  - Export search results

### FR-CUST-006: Customer Export/Import
- **Description**: Export and import customer data
- **Acceptance Criteria**:
  - Export customer data (CSV, JSON)
  - Import customer data with validation
  - Bulk customer operations
  - Import error handling

---

## Technical Requirements

### Database Schema

Uses existing tables:
- `sys_customers_mst` (global customers)
- `org_customers_mst` (tenant customers)
- `sys_customer_type_cd` (customer types)
- `org_customer_addresses` (customer addresses)

---

## API Endpoints

### Global Customers

#### List Global Customers
```
GET /api/hq/v1/customers/global?page=1&limit=20&search=keyword
Response: { data: GlobalCustomer[], pagination }
```

#### Get Global Customer
```
GET /api/hq/v1/customers/global/:id
Response: { data: GlobalCustomerWithTenants }
```

#### Merge Duplicate Customers
```
POST /api/hq/v1/customers/global/merge
Body: { primary_customer_id, duplicate_customer_ids[] }
Response: { success: boolean, data: MergedCustomer }
```

### Tenant Customers

#### List Tenant Customers
```
GET /api/hq/v1/tenants/:id/customers?page=1&limit=20
Response: { data: TenantCustomer[], pagination }
```

#### Link Global to Tenant Customer
```
POST /api/hq/v1/customers/global/:globalId/link/:tenantId
Body: { tenant_customer_id?, create_new?: boolean }
Response: { success: boolean, data: LinkedCustomer }
```

### Cross-Tenant Search

#### Search All Customers
```
GET /api/hq/v1/customers/search?q=keyword&tenant_id?&limit=50
Response: { data: CustomerSearchResult[] }
```

---

## UI/UX Requirements

### Global Customer List
- Table view with search and filters
- Customer details modal
- Tenant associations view
- Merge duplicate action

### Tenant Customer List
- Filtered by tenant
- Link to global customer action
- Customer activity timeline

### Customer Detail View
- Global customer information
- Associated tenant customers
- Activity across tenants
- Merge/duplicate detection

---

## Security Considerations

1. **Privacy**: Respect customer data privacy
2. **Access Control**: HQ users only
3. **Audit Trail**: Log all customer operations
4. **Data Protection**: Mask sensitive data in exports

---

## Testing Requirements

- Unit tests for customer linking
- Integration tests for merge operations
- E2E tests for customer management flows

---

## Implementation Checklist

- [ ] Review existing customer tables
- [ ] Implement global customer API
- [ ] Implement tenant customer API
- [ ] Implement linking API
- [ ] Implement deduplication logic
- [ ] Create customer management UI
- [ ] Add search functionality
- [ ] Add export/import features
- [ ] Write tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0001: Tenant Lifecycle Management

