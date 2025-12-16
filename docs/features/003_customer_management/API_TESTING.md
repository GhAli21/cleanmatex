# PRD-003: API Testing Guide

Quick reference for testing all 14 customer management API endpoints.

---

## Prerequisites

1. Start dev server: `cd web-admin && npm run dev`
2. Ensure Supabase is running: `supabase status`
3. Get auth token from browser DevTools after login

---

## Quick Test File (REST Client)

Create `test-customers.http`:

```http
### Variables
@baseUrl = http://localhost:3000/api/v1/customers
@token = YOUR_JWT_TOKEN
@customerId = CUSTOMER_UUID
@addressId = ADDRESS_UUID

### 1. Send OTP
POST {{baseUrl}}/send-otp
Content-Type: application/json

{"phone": "+96890123456", "purpose": "registration"}

### 2. Verify OTP
POST {{baseUrl}}/verify-otp
Content-Type: application/json

{"phone": "+96890123456", "code": "123456"}

### 3. Create Stub Customer
POST {{baseUrl}}
Authorization: Bearer {{token}}
Content-Type: application/json

{"type": "stub", "firstName": "Ahmed", "lastName": "Al-Said", "phone": "+96890123456"}

### 4. List Customers
GET {{baseUrl}}?page=1&limit=20&includeStats=true
Authorization: Bearer {{token}}

### 5. Get Customer Details
GET {{baseUrl}}/{{customerId}}
Authorization: Bearer {{token}}

### 6. Update Customer
PATCH {{baseUrl}}/{{customerId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{"email": "ahmed@example.com", "preferences": {"folding": "hang"}}

### 7. Upgrade Profile
POST {{baseUrl}}/{{customerId}}/upgrade
Authorization: Bearer {{token}}
Content-Type: application/json

{"email": "ahmed@example.com", "otpCode": "123456"}

### 8. List Addresses
GET {{baseUrl}}/{{customerId}}/addresses
Authorization: Bearer {{token}}

### 9. Create Address
POST {{baseUrl}}/{{customerId}}/addresses
Authorization: Bearer {{token}}
Content-Type: application/json

{"addressType": "home", "building": "123", "street": "Main St", "city": "Muscat", "isDefault": true}

### 10. Update Address
PATCH {{baseUrl}}/{{customerId}}/addresses/{{addressId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{"label": "Home Address", "deliveryNotes": "Call when arrived"}

### 11. Delete Address
DELETE {{baseUrl}}/{{customerId}}/addresses/{{addressId}}
Authorization: Bearer {{token}}

### 12. Merge Customers (Admin)
POST {{baseUrl}}/merge
Authorization: Bearer {{token}}
Content-Type: application/json

{"sourceCustomerId": "uuid1", "targetCustomerId": "uuid2", "reason": "Duplicate"}

### 13. Export CSV (Admin)
GET {{baseUrl}}/export?type=full&status=active
Authorization: Bearer {{token}}

### 14. Deactivate Customer (Admin)
DELETE {{baseUrl}}/{{customerId}}
Authorization: Bearer {{token}}
```

---

## Expected Responses

**Success**: `{"success": true, "data": {...}}`
**Error**: `{"error": "message"}`

---

## Common Test Scenarios

### 1. Complete OTP Flow
```bash
1. Send OTP → 200 OK
2. Verify OTP → 200 OK with token
3. Create full customer → 201 Created
```

### 2. Stub Customer Creation
```bash
1. Create stub → 201 Created
2. List customers → 200 OK (includes new customer)
3. Get details → 200 OK
```

### 3. Address Management
```bash
1. Create address → 201 Created
2. List addresses → 200 OK
3. Set another as default → Previous unset automatically
4. Delete address → 200 OK
```

---

## Validation Tests

- ✅ Duplicate phone rejected (409)
- ✅ Invalid OTP fails (400)
- ✅ Missing tenant context (401)
- ✅ Cross-tenant access denied (404)
- ✅ Admin-only endpoints require admin role (403)

---

See `PHASE3_API_COMPLETE.md` for detailed documentation.
