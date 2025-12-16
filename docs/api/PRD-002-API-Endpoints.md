# PRD-002 API Endpoints Documentation

**Base URL**: `/api/v1`
**Authentication**: JWT via Supabase Auth (except registration)

---

## Tenant Endpoints

### POST /tenants/register
**Public** - Register a new tenant with trial subscription

**Request Body**:
```json
{
  "businessName": "Fresh Clean Laundry",
  "businessNameAr": "مغسلة فريش كلين",
  "slug": "fresh-clean",
  "email": "admin@freshclean.com",
  "phone": "+96890123456",
  "country": "OM",
  "currency": "OMR",
  "timezone": "Asia/Muscat",
  "language": "en",
  "adminUser": {
    "email": "admin@freshclean.com",
    "password": "SecurePass123!",
    "displayName": "John Admin"
  }
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "uuid",
      "name": "Fresh Clean Laundry",
      "slug": "fresh-clean",
      "status": "trial"
    },
    "subscription": {
      "plan": "free",
      "status": "trial",
      "trial_ends": "2025-11-01T23:59:59Z",
      "orders_limit": 20
    },
    "user": {
      "id": "uuid",
      "email": "admin@freshclean.com",
      "role": "admin"
    },
    "accessToken": "eyJhbGc..."
  },
  "message": "Tenant registered successfully. Your 14-day trial has started."
}
```

**Errors**:
- `400` - Validation error (missing fields, invalid format)
- `409` - Slug/email already exists
- `500` - Server error

---

### GET /tenants/me
**Protected** - Get current tenant details

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "name": "Fresh Clean Laundry",
    "slug": "fresh-clean",
    "email": "admin@freshclean.com",
    "phone": "+96890123456",
    "logo_url": "https://storage.../logo.png",
    "brand_color_primary": "#3B82F6",
    "brand_color_secondary": "#10B981",
    "business_hours": {
      "mon": { "open": "08:00", "close": "18:00" }
    },
    "feature_flags": {
      "pdf_invoices": false,
      "whatsapp_receipts": true
    },
    "subscription": {
      "plan": "free",
      "status": "trial",
      "trialEnds": "2025-11-01T23:59:59Z",
      "ordersLimit": 20,
      "ordersUsed": 5,
      "usagePercentage": 25
    },
    "usage": {
      "currentPeriod": {
        "start": "2025-10-01T00:00:00Z",
        "end": "2025-10-31T23:59:59Z"
      },
      "limits": {
        "ordersLimit": 20,
        "usersLimit": 2
      },
      "usage": {
        "ordersCount": 5,
        "ordersPercentage": 25
      },
      "warnings": []
    }
  }
}
```

---

### PATCH /tenants/me
**Protected** - Update tenant profile

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Request Body** (all fields optional):
```json
{
  "name": "Fresh Clean Laundry Premium",
  "name2": "مغسلة فريش كلين المتميز",
  "phone": "+96890123457",
  "address": "Building 456, Muscat",
  "city": "Muscat",
  "brand_color_primary": "#FF6B6B",
  "brand_color_secondary": "#4ECDC4",
  "business_hours": {
    "mon": { "open": "07:00", "close": "20:00" },
    "tue": { "open": "07:00", "close": "20:00" }
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Fresh Clean Laundry Premium",
    "updated_at": "2025-10-18T12:00:00Z"
  },
  "message": "Tenant profile updated successfully"
}
```

**Errors**:
- `400` - Invalid color format / business hours format
- `401` - Unauthorized
- `500` - Server error

---

### POST /tenants/me/logo
**Protected** - Upload tenant logo

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data
```

**Request**: Form data with `file` field

**Constraints**:
- Max size: 2MB
- Allowed types: PNG, JPG, SVG

**Response** (200):
```json
{
  "success": true,
  "data": {
    "logoUrl": "https://storage.cleanmatex.com/tenants/uuid/logo-123.png",
    "uploadedAt": "2025-10-18T12:30:00Z"
  },
  "message": "Logo uploaded successfully"
}
```

**Errors**:
- `400` - File validation error (size, type)
- `401` - Unauthorized
- `500` - Upload failed

---

### DELETE /tenants/me/logo
**Protected** - Remove tenant logo

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Logo removed successfully"
}
```

---

## Subscription Endpoints

### GET /subscriptions/plans
**Protected** - Get available subscription plans

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "plan_code": "free",
        "plan_name": "Free Trial",
        "plan_name2": "تجربة مجانية",
        "orders_limit": 20,
        "users_limit": 2,
        "branches_limit": 1,
        "price_monthly": 0,
        "price_yearly": 0,
        "feature_flags": { ... },
        "isCurrentPlan": true,
        "isRecommended": false
      },
      {
        "plan_code": "starter",
        "plan_name": "Starter",
        "orders_limit": 100,
        "price_monthly": 29,
        "price_yearly": 290,
        "isCurrentPlan": false,
        "isRecommended": false
      },
      {
        "plan_code": "growth",
        "plan_name": "Growth",
        "orders_limit": 500,
        "price_monthly": 79,
        "isCurrentPlan": false,
        "isRecommended": true
      }
    ],
    "currentPlan": "free"
  }
}
```

---

### POST /subscriptions/upgrade
**Protected** - Upgrade to paid plan

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Request Body**:
```json
{
  "planCode": "starter",
  "billingCycle": "monthly",
  "paymentMethodId": "pm_xxx"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "uuid",
      "plan": "starter",
      "status": "active",
      "orders_limit": 100,
      "start_date": "2025-10-18T00:00:00Z",
      "end_date": "2025-11-18T23:59:59Z"
    },
    "featureFlags": {
      "pdf_invoices": true,
      "whatsapp_receipts": true,
      "loyalty_programs": true
    }
  },
  "message": "Successfully upgraded to starter plan"
}
```

**Errors**:
- `400` - Invalid plan code / billing cycle / downgrade attempt
- `401` - Unauthorized
- `500` - Upgrade failed

---

### POST /subscriptions/cancel
**Protected** - Cancel subscription

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Request Body**:
```json
{
  "reason": "Too expensive",
  "feedback": "Would like a plan between Starter and Growth"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "subscription": {
      "status": "canceling",
      "end_date": "2025-11-18T23:59:59Z",
      "cancellation_date": "2025-10-18T14:00:00Z"
    },
    "message": "Subscription will be canceled on 2025-11-18. You'll be downgraded to the Free plan."
  }
}
```

---

### GET /subscriptions/usage
**Protected** - Get usage metrics

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "currentPeriod": {
      "start": "2025-10-01T00:00:00Z",
      "end": "2025-10-31T23:59:59Z"
    },
    "limits": {
      "ordersLimit": 20,
      "usersLimit": 2,
      "branchesLimit": 1,
      "storageMbLimit": 100
    },
    "usage": {
      "ordersCount": 15,
      "ordersPercentage": 75,
      "usersCount": 2,
      "usersPercentage": 100,
      "branchesCount": 1,
      "branchesPercentage": 100,
      "storageMb": 25.5,
      "storagePercentage": 25
    },
    "warnings": [
      {
        "type": "approaching_limit",
        "resource": "orders",
        "message": "You've used 75% of your monthly order limit",
        "percentage": 75
      }
    ]
  }
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `402` - Payment Required (limit exceeded)
- `403` - Forbidden (feature not enabled)
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Obtain the token by:
1. Registering (`POST /tenants/register` - returns `accessToken`)
2. Logging in via Supabase Auth

Token must contain `tenant_org_id` in `user_metadata`.

---

## Rate Limiting

(To be implemented in future)
- Registration: 5 requests per hour per IP
- API calls: 1000 requests per hour per tenant
- Logo uploads: 10 requests per hour per tenant

---

**Last Updated**: 2025-10-18
**Version**: 1.0
