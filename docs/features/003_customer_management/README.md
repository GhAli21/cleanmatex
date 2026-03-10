# PRD-003: Customer Management Feature

**Status**: Largely implemented with important runtime caveats
**Priority**: Must Have (MVP)
**Dependencies**: PRD-001 (Auth), PRD-002 (Tenant Management)

---

## 📖 Overview

Progressive customer engagement system supporting three customer types:

| Type | Description | Registration Time | Requirements |
|------|-------------|-------------------|--------------|
| **Guest** | Temporary customer | Instant | None |
| **Stub** | Basic profile for POS | < 30 seconds | Name + Phone |
| **Full** | Complete app profile | 2-3 minutes | Phone + OTP + Email + Preferences |

---

## 🎯 Business Value

- **Flexibility**: Support walk-ins without app registration
- **Conversion**: Clear upgrade path (Guest → Stub → Full)
- **Retention**: Full profiles enable loyalty programs
- **Efficiency**: Quick stub creation at POS
- **Data Quality**: Progressive profiling reduces friction

---

## ✅ Implementation Status

### Phase 1: Database Schema ✅ Mostly Landed
- customer-domain schema work exists across system and tenant layers
- Created `org_customer_addresses` for multi-address support
- Created `sys_otp_codes` for phone verification
- Created `org_customer_merge_log` for audit trail
- Added RLS policies and indexes
- **File**: `supabase/migrations/0011_customer_enhancements.sql`

### Phase 2: Backend Services ✅ Largely Implemented
- **Customer Service**: CRUD, search, merge, upgrade, statistics
- **OTP Service**: Generation, SMS, verification, rate limiting
- **Address Service**: CRUD, default management, GPS validation
- **Files**:
  - `web-admin/lib/services/customers.service.ts`
  - `web-admin/lib/services/otp.service.ts`
  - `web-admin/lib/services/customer-addresses.service.ts`

### Phase 3: API Endpoints ✅ Largely Implemented
- Main customer routes implemented
- Individual customer routes implemented
- Profile upgrade endpoint implemented
- Address management routes implemented
- OTP verification routes implemented
- Admin routes implemented

### Phase 4: Frontend UI ✅ Largely Implemented
- Customer list page with search and filters
- Customer detail page with tabbed interface
- Quick customer creation modal
- OTP verification modal
- Address management components

### Phase 5: TypeScript Types ✅ COMPLETE
- Comprehensive type definitions
- **File**: `web-admin/lib/types/customer.ts`

### Phase 6: Testing 🟡 PARTIAL
- Testing work exists but was not documented here as fully complete
- Validate current automated coverage before making stronger completion claims

### Phase 7: Documentation ✅ SUBSTANTIAL
- Multiple implementation and completion docs exist in this folder
- API and testing references exist, though some file names in this README were never updated fully

---

## 📁 File Structure

```
003_customer_management/
├── README.md                          # This file
├── IMPLEMENTATION_PROGRESS.md         # Detailed progress tracking
├── NEXT_SESSION_PROMPT.md            # Quick start for next session
├── CRUD_API.md                        # API documentation
├── API_TESTING.md                     # Testing notes
├── USER_GUIDE.md                      # End-user documentation
└── FINAL_COMPLETION_SUMMARY.md        # Near-final implementation summary
```

---

## 🔑 Key Features

## Current Runtime Rule

Treat tenant-scoped customer handling through `org_customers_mst` as the primary current runtime path.

- references to guaranteed global-customer linking via `sys_customers_mst` should be read as historical design intent or partial capability, not as something every live flow fully depends on
- references to cross-tenant or "search all tenants" customer discovery should be verified against current code before relying on them operationally
- references to guaranteed sequential `CUST-xxxxx` numbering should be treated as implementation intent unless verified in the current runtime path

### Progressive Customer Types

#### Guest Customer
```typescript
{
  type: 'guest',
  firstName: 'Walk-in Customer'
}
```
- No phone or email required
- Temporary record
- For one-time transactions

#### Stub Customer
```typescript
{
  type: 'stub',
  firstName: 'Ahmed',
  lastName: 'Al-Said',
  phone: '+96890123456'
}
```
- Quick POS creation (< 30 seconds)
- Name + phone only
- Can upgrade to full profile later

#### Full Customer
```typescript
{
  type: 'full',
  firstName: 'Ahmed',
  lastName: 'Al-Said',
  phone: '+96890123456',
  email: 'ahmed@example.com',
  otpCode: '123456',
  preferences: {
    folding: 'hang',
    fragrance: 'lavender',
    ecoFriendly: true
  },
  addresses: [...]
}
```
- Complete profile with OTP verification
- App access enabled
- Loyalty points tracking
- Multiple addresses
- Preferences saved

### Phone Verification (OTP)
- 6-digit codes
- 5-minute expiration
- 3 verification attempts max
- 60-second resend cooldown
- SMS is mock-capable and Twilio-dependent; production SMS readiness depends on environment configuration

### Address Management
- Multiple addresses per customer
- Single default address (enforced by database trigger)
- GPS coordinates support
- Distance calculation (Haversine formula)
- Delivery notes

### Customer Number Generation
- intended format: `CUST-00001`, `CUST-00002`, etc.
- verify current runtime generation behavior before treating exact numbering guarantees as contractual

### Customer Merge
- Admin-only operation
- Move all orders to target customer
- Combine loyalty points
- Audit trail logged
- Source customer deactivated

---

## 🔐 Security Features

### Multi-Tenant Isolation
- All queries filter by `tenant_org_id`
- RLS policies on all `org_*` tables
- Composite foreign keys
- No cross-tenant data access

### Phone Normalization
- E.164 format: `+96890123456`
- Handles spaces, hyphens, parentheses
- Default country code: +968 (Oman)

### Data Protection
- Soft delete (preserves history)
- Audit trails for sensitive operations
- Phone masking for display

---

## 📊 Database Schema

### Tables Created

#### sys_customers_mst (Historical Or Partial Global Layer)
```sql
ALTER TABLE sys_customers_mst ADD COLUMN:
- customer_number VARCHAR(50)
- profile_status VARCHAR(20) DEFAULT 'guest'
- phone_verified BOOLEAN DEFAULT false
- email_verified BOOLEAN DEFAULT false
- avatar_url VARCHAR(500)
```

#### org_customer_addresses
```sql
- customer_id, tenant_org_id (Composite FK)
- address_type (home/work/other)
- building, floor, apartment, street, area, city, country
- latitude, longitude (GPS)
- is_default, delivery_notes
```

#### sys_otp_codes
```sql
- phone, code (6 digits)
- purpose (registration/login/verification)
- expires_at, verified_at, attempts
```

#### org_customer_merge_log
```sql
- source_customer_id, target_customer_id
- merged_by, merge_reason
- orders_moved, loyalty_points_merged
```

### Functions

#### generate_customer_number(tenant_org_id)
Intended to generate sequential customer numbers per tenant; verify current runtime usage before relying on exact output guarantees

#### cleanup_expired_otp_codes()
Deletes OTP codes expired more than 1 hour ago

---

## 🚀 API Endpoints

### Customer Management
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/:id` - Get details
- `PATCH /api/v1/customers/:id` - Update profile
- `DELETE /api/v1/customers/:id` - Deactivate
- `POST /api/v1/customers/:id/upgrade` - Upgrade stub → full

### Address Management
- `GET /api/v1/customers/:id/addresses` - List addresses
- `POST /api/v1/customers/:id/addresses` - Add address
- `PATCH /api/v1/customers/:id/addresses/:addressId` - Update
- `DELETE /api/v1/customers/:id/addresses/:addressId` - Delete

### OTP Verification
- `POST /api/v1/customers/send-otp` - Send OTP
- `POST /api/v1/customers/verify-otp` - Verify OTP

### Admin Operations
- `POST /api/v1/customers/merge` - Merge duplicates (Admin)
- `GET /api/v1/customers/export` - Export CSV (Admin)

---

## 🧪 Testing Strategy

### Unit Tests
- Phone normalization (various formats)
- OTP generation and verification
- Customer number generation (sequential, no gaps)
- Address default management
- GPS coordinate validation

### Integration Tests
- Customer creation (all types)
- OTP verification flow
- Multi-tenant isolation
- Address CRUD operations
- Customer merge operation

### E2E Tests
- POS: Stub customer creation (< 30 seconds)
- Mobile: Full registration with OTP
- Admin: Customer merge workflow

---

## 🌍 Internationalization

### Bilingual Fields
- `name` (English) / `name2` (Arabic)
- Customer type badges support RTL
- Address labels in both languages
- SMS messages support Arabic

---

## 📈 Performance Targets

- Stub profile creation: < 30 seconds
- Customer search: < 200ms (p95)
- OTP delivery: < 5 seconds (p95)
- Support: 100,000+ customers per tenant

---

## 🔗 Related Documentation

- **PRD lineage**: reconcile with approved planning material in `docs/plan/`
- **Database Schema**: `supabase/migrations/0011_customer_enhancements.sql`
- **Progress Tracking**: `IMPLEMENTATION_PROGRESS.md`
- **Next Steps**: `NEXT_SESSION_PROMPT.md`
- **Legacy customer-domain grouping**: `history/customer_domain_legacy_index.md`

---

## 📞 Support

For questions about this feature:

1. **Requirements**: See PRD (`docs/plan/003_customer_management_dev_prd.md`)
2. **Implementation**: Check `IMPLEMENTATION_PROGRESS.md`
3. **API Design**: Review service files for inline documentation
4. **Database**: Check migration file for schema details
5. **Conventions**: Consult main `CLAUDE.md`

---

## 🎯 Next Steps

- treat this folder as mostly implemented customer-management documentation
- use `FINAL_COMPLETION_SUMMARY.md` and `IMPLEMENTATION_PROGRESS.md` before relying on older pending-task statements
- focus future updates on testing validation and current-code verification rather than re-documenting basic feature scope

---

**Last Updated**: 2026-03-10
**Version**: 1.1
**Status**: Largely implemented; verify runtime gaps before production-grade claims
