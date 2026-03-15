# Customer Category Categorization - Test Guide

## Overview

This guide covers test scenarios for the Customer Category feature across Platform HQ (cleanmatexsaas) and Tenant App (cleanmatex web-admin).

---

## 1. Unit Tests

### 1.1 generateCode Utility

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Simple name | `"Walk in"` | `"WALK_IN"` |
| Multiple words | `"Hotel B2B"` | `"HOTEL_B2B"` |
| With special chars | `"Guest (VIP)"` | `"GUEST_VIP"` |
| Numbers + words | `"B2B Corp"` | `"B2B_CORP"` |
| Trimmed spaces | `"  Stub  "` | `"STUB"` |
| Empty string | `""` | `""` |

### 1.2 Customer Categories API Client (web-admin)

| Scenario | Action | Expected |
|----------|--------|----------|
| `fetchCustomerCategories()` | No params | GET `/api/v1/customer-categories` |
| `fetchCustomerCategories({ is_b2b: true })` | B2B filter | GET with `?is_b2b=true` |
| `fetchCustomerCategoryByCode('B2B')` | Get by code | GET `/api/v1/customer-categories/B2B` |
| `checkCodeAvailable('HOTEL')` | Check code | GET `/api/v1/customer-categories/check-code?code=HOTEL` |
| `createCustomerCategory()` | Create | POST with body |
| `updateCustomerCategory('B2B', { name })` | Update | PATCH |
| `deleteCustomerCategory('B2B')` | Delete | DELETE |
| Error handling | 4xx/5xx response | Throws with error message |

### 1.3 CustomerCategoryService (mocked Supabase)

| Scenario | Method | Expected |
|----------|--------|----------|
| List with tenant filter | `list(supabase, tenantId)` | Returns array of categories |
| List with is_b2b filter | `list(..., { is_b2b: true })` | B2B filter applied |
| Get by code | `getByCode(supabase, tenantId, 'B2B')` | Returns category or null |
| isCodeAvailable | `isCodeAvailable(supabase, tenantId, 'HOTEL')` | Returns boolean |
| Create | `create(...)` | Inserts and returns |
| Update | `update(...)` | Updates and returns |
| Delete system category | `delete(supabase, tenantId, 'B2B')` | Throws (cannot delete) |

---

## 2. Integration / API Tests

### 2.1 Tenant API (web-admin)

| Scenario | Method | Auth | Expected |
|----------|--------|------|----------|
| List categories | GET `/api/v1/customer-categories` | customers:read | 200, array |
| List B2B only | GET `?is_b2b=true` | customers:read | 200, B2B categories |
| Get by code | GET `/api/v1/customer-categories/B2B` | customers:read | 200 or 404 |
| Check code | GET `/check-code?code=HOTEL` | config:preferences_manage | 200, `{ available }` |
| Create | POST | config:preferences_manage | 201 or 400 |
| Update | PATCH | config:preferences_manage | 200 or 400 |
| Delete system | DELETE | config:preferences_manage | 400 (cannot delete) |
| Delete custom | DELETE | config:preferences_manage | 200 |

### 2.2 Customer Create with categoryId

| Scenario | Request | Expected |
|----------|---------|----------|
| B2B with valid categoryId | `{ type: 'b2b', categoryId: '<b2b-cat-id>', ... }` | 201, customer created |
| B2B with invalid categoryId | `{ type: 'b2b', categoryId: '<non-b2b-id>' }` | 400, "Invalid category" |
| B2B with non-existent categoryId | `{ type: 'b2b', categoryId: '<uuid>' }` | 400 |
| Guest with categoryId | `{ type: 'guest', categoryId: '<individual-id>' }` | 201 |

---

## 3. E2E Tests

### 3.1 Tenant Catalog - Customer Categories Page

| Scenario | Steps | Expected |
|----------|-------|----------|
| Page loads | Navigate to `/dashboard/catalog/customer-categories` | Page title visible, table or empty state |
| List shows categories | Page loads | GUEST, WALK_IN, STUB, B2B visible |
| System badge | View table | System categories show "System" badge |
| Create (with permission) | Click Add, fill form, submit | New category in list |
| Edit system category | Edit B2B, change name | Name updated; code locked |
| Delete system category | Click Delete on B2B | Delete disabled or error |
| Delete custom category | Create custom, then delete | Delete succeeds |

### 3.2 Customer Create Modal - Category Dropdown

| Scenario | Steps | Expected |
|----------|-------|----------|
| B2B type shows B2B dropdown | Select B2B, view form | B2B Category dropdown visible |
| Guest/stub shows optional dropdown | Select Guest, view form | Customer Category dropdown (optional) |
| B2B requires category | Submit B2B without category | Validation error |
| Submit with category | Select category, submit | Customer created with category |

---

## 4. Platform HQ (cleanmatexsaas)

### 4.1 Catalog - Customer Categories

| Scenario | Steps | Expected |
|----------|-------|----------|
| List | Navigate to `/catalog/customer-categories` | System categories listed |
| Create | New category, code suggestion | Code auto-generated from name |
| Edit reserved | Edit GUEST | Code, is_b2b locked |
| Delete reserved | Delete GUEST | Delete disabled |

### 4.2 Tenant Maintenance

| Scenario | Steps | Expected |
|----------|-------|----------|
| Check customer categories | Tenant maintenance, run check | Reports missing if any |
| Fix customer categories | Run fix | Seeds missing categories |

---

## 5. Test Commands

```bash
# web-admin (cleanmatex)
cd web-admin

# Unit/API tests (Jest)
npm test                                    # All Jest tests
npm test -- __tests__/api/customer-categories.test.ts
npm test -- __tests__/utils/generate-code.test.ts
npm test -- __tests__/services/customer-category.service.test.ts

# E2E tests (Playwright) - requires app running and browsers installed
npx playwright install                      # First-time: install browsers
npm run test:e2e -- e2e/customer-categories.spec.ts

# platform-web (cleanmatexsaas) - if tests exist
cd platform-web
npm test
```

---

## 6. Manual Test Checklist

- [ ] Migration 0162 applied; types regenerated
- [ ] Platform HQ: Create customer category, edit reserved, delete custom
- [ ] Tenant maintenance: Check and fix customer categories
- [ ] Tenant catalog: CRUD customer categories; system categories locked
- [ ] Customer create: B2B with category dropdown; guest/stub with optional
- [ ] B2B validation: Invalid category rejected on create
