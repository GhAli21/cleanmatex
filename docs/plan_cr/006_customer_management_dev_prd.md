# Customer Management - Development Plan & PRD

**Document ID**: 006_customer_management_dev_prd  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Owner**: Backend + Frontend Team  
**Dependencies**: 001-005  
**Related Requirements**: FR-CST-001, UC01

---

## 1. Overview

### Purpose

Implement progressive customer engagement model (Guest → Stub → Full Profile) with global customer registry and tenant-specific data linking.

### Business Value

- Frictionless customer onboarding
- Unified customer identity across tenants
- Loyalty program foundation
- Customer history tracking

---

## 2. Functional Requirements

### FR-CUS-001: Progressive Customer Profiles

- **Guest**: No registration, barcode receipt only
- **Stub**: First name + phone captured at POS, can track orders via link
- **Full**: Complete profile with app login, loyalty points, preferences

### FR-CUS-002: Customer Registration

- Quick add at POS (name + phone)
- Self-service mobile app registration
- Email/OTP verification
- Duplicate detection by phone/email

### FR-CUS-003: Customer Profile

- Personal details (name, phone, email, address)
- Preferences (fold/hang, fragrance, eco options)
- Delivery locations (home, office, etc.)
- Communication preferences

### FR-CUS-004: Customer Search

- Search by name, phone, email
- Fuzzy search support
- Recent customers quick access
- Favorite/VIP tagging

### FR-CUS-005: Customer History

- Order history with status
- Payment history
- Loyalty points balance
- Communication log

---

## 3. Technical Design

### Database Schema

**Global Registry** (`sys_customers_mst`):

```sql
-- Existing table, represents unique global customer
id, first_name, last_name, phone, email, type, preferences
```

**Tenant Link** (`org_customers_mst`):

```sql
-- Junction table linking customer to tenant with tenant-specific data
customer_id, tenant_org_id, loyalty_points, s_date, rec_status
```

### Customer Types

```typescript
enum CustomerType {
  GUEST = "guest", // No registration
  STUB = "stub", // Name + phone only
  FULL = "full", // Complete profile with auth
  B2B = "b2b", // Corporate customer
}
```

### API Endpoints

```typescript
// Customer Management
GET    /api/v1/customers              // List customers
POST   /api/v1/customers              // Create customer
GET    /api/v1/customers/search?q=    // Search customers
GET    /api/v1/customers/:id          // Get customer details
PATCH  /api/v1/customers/:id          // Update customer
DELETE /api/v1/customers/:id          // Deactivate

// Customer History
GET    /api/v1/customers/:id/orders   // Order history
GET    /api/v1/customers/:id/loyalty  // Loyalty points
GET    /api/v1/customers/:id/communications // SMS/Email log
```

### Customer Creation Flow

```typescript
async function createCustomer(data: {
  first_name: string;
  last_name?: string;
  phone: string;
  email?: string;
  type: CustomerType;
  tenant_org_id: string;
}): Promise<Customer> {
  // 1. Check if customer exists globally by phone
  let globalCustomer = await findGlobalCustomerByPhone(data.phone);

  if (!globalCustomer) {
    // 2. Create in global registry
    globalCustomer = await db.insert("sys_customers_mst", {
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      email: data.email,
      type: data.type,
    });
  }

  // 3. Link to tenant (if not already linked)
  const existingLink = await db.query(
    `
    SELECT * FROM org_customers_mst
    WHERE customer_id = $1 AND tenant_org_id = $2
  `,
    [globalCustomer.id, data.tenant_org_id]
  );

  if (!existingLink.rows.length) {
    await db.insert("org_customers_mst", {
      customer_id: globalCustomer.id,
      tenant_org_id: data.tenant_org_id,
      loyalty_points: 0,
    });
  }

  return globalCustomer;
}
```

---

## 4. Implementation Plan (6 days)

### Phase 1: Customer APIs (2 days)

- CRUD operations
- Search functionality
- Duplicate detection
- Phone/email validation

### Phase 2: Progressive Engagement (2 days)

- Guest order creation
- Stub profile upgrade
- Full profile registration
- Account linking

### Phase 3: Customer History (1 day)

- Order history API
- Loyalty points display
- Communication log

### Phase 4: UI Implementation (2 days)

- Customer list view
- Customer detail page
- Quick add modal (POS)
- Search interface
- Customer selector component

---

## 5. UI Components

### Customer List Page

- Table/grid view with pagination
- Filters: type, VIP, inactive
- Search bar (name, phone, email)
- Quick actions: view, edit, new order

### Customer Detail Page

- Profile information
- Order history timeline
- Loyalty points summary
- Communication history
- Quick actions: new order, edit, message

### Quick Add Modal (POS)

- Minimal fields: first name, phone
- Optional: last name, email
- Duplicate warning
- Save and use in order

---

## 6. Testing Strategy

**Unit Tests**:

- Customer creation with duplicates
- Tenant linking logic
- Search algorithms
- Phone number normalization

**Integration Tests**:

- Complete registration flow
- Profile upgrade (stub → full)
- Multi-tenant customer scenarios
- Order history retrieval

---

## 7. Success Metrics

| Metric                   | Target         |
| ------------------------ | -------------- |
| Customer Search Time     | < 500ms        |
| Duplicate Detection Rate | > 95%          |
| POS Quick Add Time       | < 15 seconds   |
| Profile Upgrade Rate     | > 20% of stubs |

---

## 8. Acceptance Checklist

- [ ] Global customer registry working
- [ ] Tenant linking functional
- [ ] Progressive profile types
- [ ] Customer search fast and accurate
- [ ] Duplicate detection
- [ ] Customer history display
- [ ] UI components responsive
- [ ] Tests passing

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-09
