# PRD-003: Next Session Quick Start

**Status**: Backend Complete → Now Build API Endpoints
**Estimated Time**: 10 hours
**Priority**: Phase 3 - API Layer

---

## 🎯 Quick Context

You've completed:
- ✅ Database migration with all tables and functions
- ✅ Three backend services (customers, OTP, addresses)
- ✅ Complete TypeScript types

Now build: **API Endpoints** that connect frontend to backend services.

---

## 📁 What to Build Next

Create these API route handlers in `web-admin/app/api/v1/customers/`:

### 1. Main Customer Routes (`route.ts`)

```typescript
// web-admin/app/api/v1/customers/route.ts

POST   /api/v1/customers           → Create customer (guest/stub/full)
GET    /api/v1/customers           → List customers with search/filters
```

**Implementation**:
- Import services: `customers.service.ts`, `otp.service.ts`
- Validate request body based on customer type
- For full customers: verify OTP before creation
- Return standardized response format
- Handle errors with proper HTTP status codes

### 2. Individual Customer Routes (`[id]/route.ts`)

```typescript
// web-admin/app/api/v1/customers/[id]/route.ts

GET    /api/v1/customers/:id       → Get customer details
PATCH  /api/v1/customers/:id       → Update customer profile
DELETE /api/v1/customers/:id       → Deactivate customer
```

### 3. Profile Upgrade (`[id]/upgrade/route.ts`)

```typescript
// web-admin/app/api/v1/customers/[id]/upgrade/route.ts

POST   /api/v1/customers/:id/upgrade → Upgrade stub → full profile
```

### 4. Address Routes (`[id]/addresses/route.ts` & `[addressId]/route.ts`)

```typescript
// web-admin/app/api/v1/customers/[id]/addresses/route.ts
GET    /api/v1/customers/:id/addresses    → List addresses
POST   /api/v1/customers/:id/addresses    → Add address

// web-admin/app/api/v1/customers/[id]/addresses/[addressId]/route.ts
PATCH  /api/v1/customers/:id/addresses/:addressId  → Update address
DELETE /api/v1/customers/:id/addresses/:addressId  → Delete address
```

### 5. OTP Routes

```typescript
// web-admin/app/api/v1/customers/send-otp/route.ts
POST   /api/v1/customers/send-otp    → Send OTP to phone

// web-admin/app/api/v1/customers/verify-otp/route.ts
POST   /api/v1/customers/verify-otp  → Verify OTP code
```

### 6. Admin Routes

```typescript
// web-admin/app/api/v1/customers/merge/route.ts (Admin only)
POST   /api/v1/customers/merge      → Merge duplicate customers

// web-admin/app/api/v1/customers/export/route.ts (Admin only)
GET    /api/v1/customers/export     → Export to CSV
```

---

## 🎨 Response Format Pattern

Follow existing API pattern from `app/api/v1/tenants/me/route.ts`:

### Success Response
```typescript
return NextResponse.json({
  success: true,
  data: customerData,
  message: 'Customer created successfully' // optional
});
```

### Error Response
```typescript
return NextResponse.json(
  {
    error: 'Customer not found',
    details: { customerId: '...' } // optional
  },
  { status: 404 }
);
```

### List Response (with pagination)
```typescript
return NextResponse.json({
  success: true,
  data: customers,
  pagination: {
    total: 250,
    page: 1,
    limit: 20,
    totalPages: 13
  }
});
```

---

## 🔐 Security Checklist

For EVERY endpoint:

1. **Authentication**: Use `createClient()` from `@/lib/supabase/server`
2. **Tenant Context**: Verify user has `tenant_org_id` in JWT
3. **Authorization**: Check user role for admin-only endpoints
4. **Input Validation**: Validate all request parameters
5. **Error Handling**: Catch errors and return appropriate status codes

---

## 📋 Example Implementation

```typescript
// web-admin/app/api/v1/customers/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createCustomer,
  searchCustomers,
  getCustomerStatistics
} from '@/lib/services/customers.service';
import { verifyOTP, hasRecentVerifiedOTP } from '@/lib/services/otp.service';
import type { CustomerCreateRequest, CustomerSearchParams } from '@/lib/types/customer';

/**
 * POST /api/v1/customers - Create a new customer
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.user_metadata?.tenant_org_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body: CustomerCreateRequest = await request.json();

    // 3. Type-specific validation
    if (body.type === 'full') {
      // Validate OTP was verified
      if (!body.otpCode || !body.phone) {
        return NextResponse.json(
          { error: 'OTP code and phone required for full profile' },
          { status: 400 }
        );
      }

      // Verify OTP
      const otpResult = await verifyOTP({
        phone: body.phone,
        code: body.otpCode
      });

      if (!otpResult.verified) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP code', details: { message: otpResult.message } },
          { status: 400 }
        );
      }
    }

    // 4. Create customer via service
    const customer = await createCustomer(body);

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating customer:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/customers - List customers with search and filters
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.user_metadata?.tenant_org_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const params: CustomerSearchParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      type: searchParams.get('type') as any || undefined,
      status: searchParams.get('status') as any || undefined,
      sortBy: searchParams.get('sortBy') as any || undefined,
      sortOrder: searchParams.get('sortOrder') as any || undefined,
    };

    // 3. Search customers
    const { customers, total } = await searchCustomers(params);

    // 4. Calculate pagination
    const totalPages = Math.ceil(total / params.limit!);

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: params.page!,
        limit: params.limit!,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching customers:', error);

    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
```

---

## 🧪 Testing Each Endpoint

Use VS Code REST Client or Postman:

```http
### Create Stub Customer
POST http://localhost:3000/api/v1/customers
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "type": "stub",
  "firstName": "Ahmed",
  "lastName": "Al-Said",
  "phone": "+96890123456"
}

### List Customers
GET http://localhost:3000/api/v1/customers?page=1&limit=20&search=Ahmed
Authorization: Bearer YOUR_JWT_TOKEN

### Send OTP
POST http://localhost:3000/api/v1/customers/send-otp
Content-Type: application/json

{
  "phone": "+96890123456",
  "purpose": "registration"
}

### Verify OTP
POST http://localhost:3000/api/v1/customers/verify-otp
Content-Type: application/json

{
  "phone": "+96890123456",
  "code": "123456"
}
```

---

## 📚 Reference Files

**Services** (import from these):
- `@/lib/services/customers.service.ts`
- `@/lib/services/otp.service.ts`
- `@/lib/services/customer-addresses.service.ts`

**Types** (import from these):
- `@/lib/types/customer.ts`

**Existing API Pattern**:
- `app/api/v1/tenants/me/route.ts` ← Copy this structure

**Documentation**:
- `docs/plan/003_customer_management_dev_prd.md` ← Full requirements
- `docs/features/003_customer_management/IMPLEMENTATION_PROGRESS.md` ← Current status

---

## ✅ Acceptance Criteria

Before moving to Phase 4 (Frontend), ensure:

- [ ] All 9 API endpoints created and working
- [ ] Authentication enforced on all endpoints
- [ ] Tenant isolation verified (no cross-tenant access)
- [ ] OTP verification flow works end-to-end
- [ ] Customer creation works for all types (guest, stub, full)
- [ ] Address CRUD operations work correctly
- [ ] Customer merge endpoint works (admin only)
- [ ] Export endpoint generates valid CSV
- [ ] Error handling returns proper status codes
- [ ] All endpoints return consistent response format

---

## 🚀 Quick Start Command

To continue where you left off, use this prompt:

```
Continue implementing PRD-003 Customer Management.
I've completed database migration, backend services, and TypeScript types.
Now I need to build the API endpoints (Phase 3).

Start with:
1. Create web-admin/app/api/v1/customers/route.ts (POST and GET endpoints)
2. Follow the example implementation in NEXT_SESSION_PROMPT.md
3. Reference existing API pattern from app/api/v1/tenants/me/route.ts
4. Test each endpoint as you build it

Reference files:
- Services: @web-admin/lib/services/customers.service.ts
- Types: @web-admin/lib/types/customer.ts
- Progress: @docs/features/003_customer_management/IMPLEMENTATION_PROGRESS.md
```

---

**Good luck! 🚀**
