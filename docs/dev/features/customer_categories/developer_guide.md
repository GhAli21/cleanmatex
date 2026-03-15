# Customer Category Categorization - Developer Guide (Tenant App)

## Overview

Tenant app uses `org_customer_category_cf` for customer categories. API and UI allow CRUD of tenant-specific categories and selection when creating customers.

## API Endpoints

- `GET /api/v1/customer-categories` - List (?is_b2b=true, ?active_only=false)
- `GET /api/v1/customer-categories/check-code?code=X` - Check code availability
- `GET /api/v1/customer-categories/:code` - Get by code
- `POST /api/v1/customer-categories` - Create
- `PATCH /api/v1/customer-categories/:code` - Update
- `DELETE /api/v1/customer-categories/:code` - Delete (blocked for system categories)

## Permissions

- List/Get: `customers:read`
- Create/Update/Delete/Check-code: `config:preferences_manage`

## Customer Create

- `CustomerCreateRequest` accepts optional `categoryId`
- For B2B: backend validates category has `is_b2b = true` when categoryId provided
- `customers.service.createCustomer` adds `customer_category_id` to insert

## Key Files

- `lib/api/customer-categories.ts` - API client
- `lib/services/customer-category.service.ts` - Service layer
- `app/api/v1/customer-categories/` - API routes
- `app/dashboard/catalog/customer-categories/page.tsx` - Catalog UI
- `src/features/customers/ui/customer-create-modal.tsx` - Category dropdowns
