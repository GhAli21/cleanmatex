# Customer Management - Implementation Plan

**PRD ID**: 003_customer_management_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 1.5 weeks
**Dependencies**: PRD-001 (Auth), PRD-002 (Tenant Management)

---

## Overview

Implement a progressive customer engagement system supporting three customer types: Guest (no profile), Stub (basic profile with phone), and Full (app user with complete profile). This enables flexible customer onboarding while encouraging app adoption and loyalty program participation.

---

## Business Value

- **Flexibility**: Support walk-ins without requiring app registration
- **Conversion**: Clear upgrade path from Guest → Stub → Full profile
- **Retention**: Full profiles enable loyalty programs and personalized experiences
- **Efficiency**: Quick stub profile creation at POS (< 30 seconds)
- **Data Quality**: Progressive profiling reduces initial friction, improves data over time

---

## Requirements

### Functional Requirements

- **FR-CUST-001**: Create guest customer (no phone/email required) - temporary record
- **FR-CUST-002**: Create stub customer profile (name + phone) at POS
- **FR-CUST-003**: Create full customer profile with OTP phone verification
- **FR-CUST-004**: Upgrade stub → full profile via app registration
- **FR-CUST-005**: Customer search by phone, name, or customer number
- **FR-CUST-006**: Link global customer (sys_customers_mst) to tenant (org_customers_mst)
- **FR-CUST-007**: Customer profile editing (by customer or admin)
- **FR-CUST-008**: Customer preferences (fold/hang, fragrance, eco options)
- **FR-CUST-009**: Customer address management (multiple addresses)
- **FR-CUST-010**: Customer order history view
- **FR-CUST-011**: Merge duplicate customers (admin only)
- **FR-CUST-012**: Customer deactivation (soft delete)
- **FR-CUST-013**: B2B customer flag and contract linking (future)
- **FR-CUST-014**: Family account linking (future - Phase 2)
- **FR-CUST-015**: Export customer list to CSV

### Non-Functional Requirements

- **NFR-CUST-001**: Stub profile creation time < 30 seconds
- **NFR-CUST-002**: Phone number uniqueness enforced per tenant
- **NFR-CUST-003**: Customer search response time < 200ms (p95)
- **NFR-CUST-004**: Support 100,000+ customers per tenant
- **NFR-CUST-005**: OTP delivery time < 5 seconds (p95)
- **NFR-CUST-006**: Customer PII encrypted at rest
- **NFR-CUST-007**: Audit trail for profile changes

---

## Database Schema

### Customer Tables

```sql
-- sys_customers_mst (already exists in 0001_core.sql)
-- Global customer identity registry

-- org_customers_mst (already exists in 0001_core.sql)
-- Tenant-customer link with tenant-specific data

-- Add customer preferences and type
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS customer_number VARCHAR(50);
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS profile_status VARCHAR(20) DEFAULT 'guest'; -- guest, stub, full
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Customer addresses
CREATE TABLE IF NOT EXISTS org_customer_addresses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL,
  tenant_org_id     UUID NOT NULL,
  address_type      VARCHAR(20) DEFAULT 'home', -- home, work, other
  label             VARCHAR(100), -- "Home", "Office", "Villa in Muscat"
  building          VARCHAR(100),
  floor             VARCHAR(50),
  apartment         VARCHAR(50),
  street            VARCHAR(200),
  area              VARCHAR(100),
  city              VARCHAR(100),
  country           VARCHAR(2) DEFAULT 'OM',
  postal_code       VARCHAR(20),
  latitude          NUMERIC(10,8),
  longitude         NUMERIC(11,8),
  is_default        BOOLEAN DEFAULT false,
  delivery_notes    TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id, tenant_org_id)
    REFERENCES org_customers_mst(customer_id, tenant_org_id) ON DELETE CASCADE
);

CREATE INDEX idx_addresses_customer ON org_customer_addresses(customer_id, tenant_org_id);

-- OTP verification codes
CREATE TABLE IF NOT EXISTS sys_otp_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             VARCHAR(50) NOT NULL,
  code              VARCHAR(6) NOT NULL,
  purpose           VARCHAR(20) NOT NULL, -- registration, login, verification
  expires_at        TIMESTAMP NOT NULL,
  verified_at       TIMESTAMP,
  attempts          INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_phone ON sys_otp_codes(phone, expires_at);

-- Customer merge audit
CREATE TABLE IF NOT EXISTS org_customer_merge_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL,
  merged_by         UUID NOT NULL,
  merge_reason      TEXT,
  orders_moved      INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Customer Creation

#### POST /v1/customers
Create a customer profile (guest, stub, or full).

**Headers**: `Authorization: Bearer {token}`

**Request (Guest)**:
```json
{
  "type": "guest",
  "firstName": "Walk-in Customer"
}
```

**Request (Stub)**:
```json
{
  "type": "stub",
  "firstName": "Ahmed",
  "lastName": "Al-Said",
  "phone": "+96890123456"
}
```

**Request (Full - requires OTP verification first)**:
```json
{
  "type": "full",
  "firstName": "Ahmed",
  "lastName": "Al-Said",
  "phone": "+96890123456",
  "email": "ahmed@example.com",
  "otpCode": "123456",
  "preferences": {
    "folding": "hang",
    "fragrance": "lavender",
    "ecoFriendly": true
  },
  "addresses": [
    {
      "type": "home",
      "label": "Home",
      "building": "Building 123",
      "street": "Al Khuwair Street",
      "area": "Al Khuwair",
      "city": "Muscat",
      "isDefault": true
    }
  ]
}
```

**Response** (201):
```json
{
  "id": "customer-uuid",
  "customerNumber": "CUST-00001",
  "firstName": "Ahmed",
  "lastName": "Al-Said",
  "displayName": "Ahmed Al-Said",
  "phone": "+96890123456",
  "phoneVerified": true,
  "email": "ahmed@example.com",
  "type": "full",
  "profileStatus": "full",
  "preferences": {
    "folding": "hang",
    "fragrance": "lavender",
    "ecoFriendly": true
  },
  "addresses": [ /* ... */ ],
  "tenantLink": {
    "tenantId": "tenant-uuid",
    "loyaltyPoints": 0,
    "joinedAt": "2025-10-10T10:00:00Z"
  },
  "createdAt": "2025-10-10T10:00:00Z"
}
```

#### POST /v1/customers/send-otp
Send OTP code for phone verification.

**Request**:
```json
{
  "phone": "+96890123456",
  "purpose": "registration" // or "verification"
}
```

**Response** (200):
```json
{
  "message": "OTP sent successfully",
  "expiresAt": "2025-10-10T10:05:00Z",
  "phone": "+968901****56" // masked
}
```

#### POST /v1/customers/verify-otp
Verify OTP code.

**Request**:
```json
{
  "phone": "+96890123456",
  "code": "123456"
}
```

**Response** (200):
```json
{
  "verified": true,
  "token": "verification-token-xyz" // temporary token for registration
}
```

### Customer Management

#### GET /v1/customers
List customers with search and filters.

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search by name, phone, email, customer number
- `type`: Filter by type (guest, stub, full)
- `status`: Filter by status (active, inactive)

**Response** (200):
```json
{
  "customers": [
    {
      "id": "customer-uuid-1",
      "customerNumber": "CUST-00001",
      "firstName": "Ahmed",
      "lastName": "Al-Said",
      "displayName": "Ahmed Al-Said",
      "phone": "+96890123456",
      "email": "ahmed@example.com",
      "type": "full",
      "profileStatus": "full",
      "loyaltyPoints": 150,
      "totalOrders": 12,
      "lastOrderAt": "2025-10-09T14:30:00Z",
      "createdAt": "2025-09-01T10:00:00Z"
    },
    {
      "id": "customer-uuid-2",
      "customerNumber": "CUST-00002",
      "firstName": "Fatima",
      "phone": "+96890123457",
      "type": "stub",
      "profileStatus": "stub",
      "totalOrders": 3,
      "lastOrderAt": "2025-10-08T11:00:00Z",
      "createdAt": "2025-09-15T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 250,
    "page": 1,
    "limit": 20,
    "totalPages": 13
  }
}
```

#### GET /v1/customers/:customerId
Get customer details.

**Headers**: `Authorization: Bearer {token}`

**Response** (200):
```json
{
  "id": "customer-uuid",
  "customerNumber": "CUST-00001",
  "firstName": "Ahmed",
  "lastName": "Al-Said",
  "displayName": "Ahmed Al-Said",
  "name": "Ahmed Al-Said",
  "name2": "أحمد السعيد",
  "phone": "+96890123456",
  "phoneVerified": true,
  "email": "ahmed@example.com",
  "emailVerified": false,
  "type": "full",
  "profileStatus": "full",
  "avatarUrl": "https://storage.cleanmatex.com/avatars/customer-uuid.jpg",
  "preferences": {
    "folding": "hang",
    "fragrance": "lavender",
    "ecoFriendly": true,
    "notifications": {
      "whatsapp": true,
      "sms": false,
      "email": true
    }
  },
  "addresses": [
    {
      "id": "address-uuid-1",
      "type": "home",
      "label": "Home",
      "building": "Building 123",
      "street": "Al Khuwair Street",
      "area": "Al Khuwair",
      "city": "Muscat",
      "isDefault": true
    },
    {
      "id": "address-uuid-2",
      "type": "work",
      "label": "Office",
      "building": "Tower A",
      "area": "Qurum",
      "city": "Muscat",
      "isDefault": false
    }
  ],
  "tenantData": {
    "loyaltyPoints": 150,
    "tier": "silver",
    "totalOrders": 12,
    "totalSpent": 450.500,
    "joinedAt": "2025-09-01T10:00:00Z",
    "lastOrderAt": "2025-10-09T14:30:00Z"
  },
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-10-09T14:30:00Z"
}
```

#### PATCH /v1/customers/:customerId
Update customer profile.

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "firstName": "Ahmed",
  "lastName": "Al-Said Al-Balushi",
  "email": "ahmed.new@example.com",
  "preferences": {
    "folding": "fold",
    "fragrance": "none",
    "ecoFriendly": true
  }
}
```

**Response** (200):
```json
{
  "id": "customer-uuid",
  "firstName": "Ahmed",
  "lastName": "Al-Said Al-Balushi",
  "email": "ahmed.new@example.com",
  "preferences": { /* updated */ },
  "updatedAt": "2025-10-10T11:00:00Z"
}
```

#### POST /v1/customers/:customerId/upgrade
Upgrade stub customer to full profile.

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "email": "fatima@example.com",
  "otpCode": "123456",
  "preferences": {
    "folding": "hang"
  }
}
```

**Response** (200):
```json
{
  "id": "customer-uuid",
  "profileStatus": "full",
  "email": "fatima@example.com",
  "phoneVerified": true,
  "upgradedAt": "2025-10-10T11:30:00Z"
}
```

### Address Management

#### POST /v1/customers/:customerId/addresses
Add new address.

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "type": "work",
  "label": "Office",
  "building": "Tower A, Floor 5",
  "street": "Sultan Qaboos Street",
  "area": "Qurum",
  "city": "Muscat",
  "latitude": 23.5880,
  "longitude": 58.3829,
  "isDefault": false,
  "deliveryNotes": "Call when arrived, office hours 8am-5pm"
}
```

**Response** (201):
```json
{
  "id": "address-uuid",
  "type": "work",
  "label": "Office",
  "building": "Tower A, Floor 5",
  "isDefault": false,
  "createdAt": "2025-10-10T12:00:00Z"
}
```

#### PATCH /v1/customers/:customerId/addresses/:addressId
Update address.

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "label": "Main Office",
  "isDefault": true
}
```

**Response** (200):
```json
{
  "id": "address-uuid",
  "label": "Main Office",
  "isDefault": true,
  "updatedAt": "2025-10-10T12:15:00Z"
}
```

#### DELETE /v1/customers/:customerId/addresses/:addressId
Delete address.

**Headers**: `Authorization: Bearer {token}`

**Response** (200):
```json
{
  "message": "Address deleted successfully"
}
```

### Admin Operations

#### POST /v1/customers/merge
Merge duplicate customer profiles (admin only).

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "sourceCustomerId": "customer-uuid-2",
  "targetCustomerId": "customer-uuid-1",
  "reason": "Duplicate profile created by mistake"
}
```

**Response** (200):
```json
{
  "message": "Customers merged successfully",
  "mergedCustomer": {
    "id": "customer-uuid-1",
    "ordersMoved": 5,
    "loyaltyPointsMerged": 50
  }
}
```

#### GET /v1/customers/export
Export customer list to CSV (admin only).

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `type`: Filter by type (optional)
- `startDate`: Created after (optional)
- `endDate`: Created before (optional)

**Response** (200):
```
Content-Type: text/csv
Content-Disposition: attachment; filename="customers_2025-10-10.csv"

Customer Number,Name,Phone,Email,Type,Total Orders,Loyalty Points,Joined Date
CUST-00001,Ahmed Al-Said,+96890123456,ahmed@example.com,full,12,150,2025-09-01
CUST-00002,Fatima,+96890123457,,stub,3,0,2025-09-15
...
```

---

## UI/UX Requirements

### Customer Creation (POS)
- **Quick Stub Form**:
  - First Name (required)
  - Last Name (optional)
  - Phone (required, with country code selector)
  - Action: Save (creates stub profile in < 30 seconds)
- **Search-First Flow**:
  - Search by phone before creating
  - If found, select existing customer
  - If not found, show "Create New" button
- **Bilingual**: Labels in EN/AR

### Customer List Page (Admin)
- **Table Columns**: Customer #, Name, Phone, Type, Orders, Points, Last Order, Actions
- **Search Bar**: Real-time search by name/phone/email
- **Filters**: Type (guest/stub/full), Status (active/inactive)
- **Actions**: View Details, Edit, Deactivate
- **Export Button**: Download CSV

### Customer Detail Page
- **Sections**: Profile, Addresses, Order History, Loyalty
- **Profile Section**:
  - Avatar (editable)
  - Basic info (name, phone, email)
  - Type badge (Guest/Stub/Full)
  - Edit button
- **Addresses Section**:
  - List of addresses with default badge
  - Add/Edit/Delete address
- **Order History**:
  - Recent orders list with status
  - Link to order details
- **Loyalty Section** (if full profile):
  - Points balance
  - Tier level
  - Redemption history

### Customer Profile (Mobile App - Customer View)
- **Tabs**: Profile, Addresses, Preferences, Orders
- **Edit Profile**: Name, email, avatar
- **Manage Addresses**: Add/edit/delete, set default
- **Preferences**:
  - Folding (hang/fold toggle)
  - Fragrance (dropdown: none, lavender, rose, etc.)
  - Eco-friendly option (toggle)
  - Notifications (WhatsApp/SMS/Email toggles)

### OTP Verification Flow
- **Step 1**: Enter phone number → Send OTP
- **Step 2**: Enter 6-digit code → Verify
- **Resend**: Available after 60 seconds
- **Error Handling**: Invalid code (3 attempts), expired code

---

## Technical Implementation

### Backend Tasks

1. **CustomersService**
   - `create()` - Create customer (guest/stub/full)
   - `findByPhone()` - Search by phone with tenant context
   - `upgrade()` - Upgrade stub to full
   - `merge()` - Merge duplicate customers

2. **OTPService**
   - `sendOTP()` - Generate and send 6-digit code
   - `verifyOTP()` - Validate code (max 3 attempts)
   - Integration with SMS provider (Twilio)

3. **Customer Search**
   - Full-text search on name, phone, email
   - Phone normalization (remove spaces, handle country codes)
   - Fuzzy matching for names

4. **Customer Number Generation**
   - Format: CUST-XXXXX (sequential per tenant)
   - Separate sequence per tenant
   - Padding with zeros (CUST-00001, CUST-00002)

5. **Composite FK Enforcement**
   - All queries include tenant_org_id
   - Example: `WHERE customer_id = ? AND tenant_org_id = ?`

### Frontend Tasks (Next.js Admin)

1. **Customer List Page**
   - Table with pagination
   - Search with debounce (300ms)
   - Filter dropdowns
   - Export CSV button

2. **Customer Detail Page**
   - Tabbed interface
   - Inline editing
   - Address management
   - Order history table

3. **Quick Customer Creation Modal**
   - Form with phone input (with country code)
   - Search-first flow (check duplicates)
   - Success notification

4. **OTP Verification Modal**
   - Phone input
   - Send OTP button
   - 6-digit code input (auto-focus)
   - Resend countdown timer
   - Error states

### Mobile App Tasks (Flutter)

1. **Registration Flow**
   - Phone input screen
   - OTP verification screen
   - Profile completion form
   - Success screen

2. **Profile Management**
   - View/edit profile
   - Avatar upload
   - Preferences editor

3. **Address Management**
   - List addresses
   - Add/edit address form
   - Map integration for location

### Database Migrations

```sql
-- Migration: 0006_customer_enhancements.sql

-- Add new columns to sys_customers_mst
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS customer_number VARCHAR(50);
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS profile_status VARCHAR(20) DEFAULT 'guest';
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Create customer addresses table
CREATE TABLE IF NOT EXISTS org_customer_addresses (
  -- schema as above
);

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS sys_otp_codes (
  -- schema as above
);

-- Create merge log table
CREATE TABLE IF NOT EXISTS org_customer_merge_log (
  -- schema as above
);

-- Create customer number sequence per tenant
CREATE SEQUENCE IF NOT EXISTS customer_number_seq;
```

---

## Acceptance Criteria

### Customer Creation
- [ ] Guest customer can be created without phone/email
- [ ] Stub customer can be created with name + phone in < 30 seconds
- [ ] Full customer registration requires OTP verification
- [ ] Duplicate phone numbers are rejected (per tenant)
- [ ] Customer number is auto-generated (CUST-XXXXX format)

### OTP Verification
- [ ] OTP code is sent via SMS within 5 seconds
- [ ] OTP code expires after 5 minutes
- [ ] Invalid code shows error after 3 attempts
- [ ] Resend OTP available after 60 seconds cooldown

### Customer Management
- [ ] Search finds customers by phone/name/email
- [ ] Customer details page shows all info (profile, addresses, orders)
- [ ] Admin can edit customer profile
- [ ] Customer can edit own profile via mobile app

### Profile Upgrade
- [ ] Stub customer can upgrade to full profile
- [ ] Upgrade requires OTP verification
- [ ] Existing orders remain linked after upgrade

### Address Management
- [ ] Customer can add multiple addresses
- [ ] One address can be set as default
- [ ] Addresses include delivery notes field
- [ ] Addresses support GPS coordinates

### Customer Merge
- [ ] Admin can merge duplicate customers
- [ ] All orders from source customer move to target
- [ ] Loyalty points are combined
- [ ] Merge is logged in audit trail

---

## Testing Requirements

### Unit Tests

1. **CustomersService**
   - `create()` with guest/stub/full types
   - `findByPhone()` normalizes phone numbers
   - `upgrade()` changes profile status
   - `merge()` transfers orders and points

2. **OTPService**
   - `sendOTP()` generates 6-digit code
   - `verifyOTP()` validates code
   - Expired OTP returns error
   - Max attempts enforcement (3)

3. **Phone Normalization**
   - `+968 9012 3456` → `+96890123456`
   - `90123456` → `+96890123456` (with default country)

### Integration Tests

1. **Customer Endpoints**
   - POST /v1/customers → creates customer with composite FK
   - GET /v1/customers → returns customers filtered by tenant
   - PATCH /v1/customers/:id → updates customer
   - POST /v1/customers/:id/upgrade → upgrades to full

2. **OTP Endpoints**
   - POST /v1/customers/send-otp → sends SMS
   - POST /v1/customers/verify-otp → validates code

3. **Address Endpoints**
   - POST /v1/customers/:id/addresses → creates address
   - PATCH /v1/customers/:id/addresses/:addressId → updates address
   - DELETE /v1/customers/:id/addresses/:addressId → deletes address

### E2E Tests (Playwright)

1. **POS: Stub Customer Creation**
   - Search for phone "90123456" → Not found
   - Click "Create New" → Fill form (name, phone) → Save
   - Customer appears in list → Can create order for this customer

2. **Mobile App: Full Registration**
   - Enter phone → Send OTP → Enter code → Verify
   - Complete profile (name, email, preferences) → Submit
   - Profile created → Can place order

3. **Admin: Customer Merge**
   - Search for duplicate customers → Select 2
   - Click "Merge" → Select target → Confirm
   - Orders moved → Source customer deactivated

---

## Deployment Notes

### Environment Variables

```bash
# SMS Provider (Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+16505551234

# OTP Settings
OTP_LENGTH=6
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RESEND_COOLDOWN_SECONDS=60
```

### Database Migrations

```bash
# Apply customer enhancements
psql -U cmx_user -d cmx_db -f supabase/migrations/0006_customer_enhancements.sql

# Verify tables created
psql -U cmx_user -d cmx_db -c "\dt org_customer_*"
```

### SMS Provider Setup
1. Create Twilio account
2. Get phone number for SMS sending
3. Configure webhook for delivery status
4. Test OTP delivery in staging

---

## References

### Requirements Document
- Addendum C: Customer Model (Progressive Engagement)
- Section 3.1: Orders & Intake (customer types)

### Related PRDs
- PRD-001: Auth (customer can be app user)
- PRD-004: Order Intake (links to customer)
- PRD-017: Loyalty Program (requires full profile)

---

**Status**: Ready for Implementation
**Assigned To**: Backend Team + Frontend Team + Mobile Team
**Estimated Effort**: 60 hours (1.5 weeks with 2 developers)
