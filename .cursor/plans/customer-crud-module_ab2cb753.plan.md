---
name: customer-crud-module
overview: Enhance and complete the existing customer CRUD module in web-admin, following CleanMateX best practices with Next.js API routes, service layer, and frontend components.
todos:
  - id: analyze-domain-model
    content: Review existing customer tables, types, and constraints to finalize domain model and DTO fields.
    status: completed
  - id: enhance-api-routes
    content: Enhance existing Next.js API routes for customers (ensure all CRUD endpoints follow best practices, validation, error handling).
    status: completed
  - id: enhance-service-layer
    content: Review and enhance customer service layer to ensure tenant context, validation, and soft delete are properly enforced.
    status: completed
  - id: enhance-api-client
    content: Review and enhance web-admin API client wrapper for customer endpoints if needed.
    status: completed
  - id: enhance-frontend-screens
    content: Review and enhance customer list and create/edit screens in web-admin with Cmx components, ensuring best practices.
    status: completed
  - id: add-i18n-rtl
    content: Ensure all customer-related translations exist and forms/tables are fully RTL-aware.
    status: completed
  - id: add-permissions-tests
    content: Integrate permission checks and add backend/frontend tests, including multi-tenant isolation scenarios.
    status: completed
  - id: run-build-and-docs
    content: Run builds/tests, fix issues, and document the customer CRUD feature and API.
    status: completed
isProject: false
---

## Customer CRUD in Customers – Implementation Plan

### 1. Confirm existing customer domain model

- **Review existing tables and types**: Inspect `org_customers_mstt` tables and any related views in Supabase, plus existing TypeScript types under something like `[web-admin]/lib/types/customer.ts`.
- **Align on ID and tenant model**: Confirm primary keys (e.g. `customer_id`, `id`), `tenant_org_id`, soft-delete fields (`is_active`, `rec_status`), bilingual fields (`name/name2`, `description/description2`), and any unique constraints (phone/email).
- **Document core fields**: Define a minimal customer master set (name/name2, phone, email, type, status, notes, created/updated audit fields) as the basis for DTOs and forms.

### 2. Review and enhance API contracts & shared types

- **Verify existing types**: Confirm that `web-admin/lib/types/customer.ts` has all necessary types (`Customer`, `CustomerListItem`, `CustomerCreateRequest`, `CustomerUpdateRequest`, `CustomerSearchParams`) and they align with database schema.
- **Review API response format**: Ensure all API routes return consistent response format `{ success, data?, error?, message? }` consistent with other endpoints.
- **Validate error handling**: Ensure error responses follow standard patterns and use appropriate HTTP status codes.

### 3. Enhance Next.js API routes (existing implementation)

- **Review existing routes**: Verify that `web-admin/app/api/v1/customers/route.ts` and `web-admin/app/api/v1/customers/[id]/route.ts` implement all CRUD operations correctly.
- **Enhance validation**: Ensure all routes use proper input validation (Zod schemas or manual validation) matching the types in `lib/types/customer.ts`.
- **Security & permissions**: Verify all routes use `requirePermission` middleware and enforce proper permissions (`customers:read`, `customers:create`, `customers:update`, `customers:delete`).
- **Rate limiting**: Ensure rate limiting is applied via `checkAPIRateLimitTenant` middleware.
- **CSRF protection**: Verify CSRF validation is applied to mutation endpoints (POST, PATCH, DELETE).
- **Error handling**: Ensure consistent error handling with proper logging via `@/lib/utils/logger`.
- **Response consistency**: Ensure all routes return consistent response format and HTTP status codes.

### 4. Enhance service layer (existing implementation)

- **Review service methods**: Verify `web-admin/lib/services/customers.service.ts` implements all CRUD operations (`createCustomer`, `searchCustomers`, `getCustomerById`, `updateCustomer`, `softDeleteCustomer`).
- **Tenant isolation**: Ensure all service methods use `getTenantIdFromSession()` and filter by `tenant_org_id` for all queries on `org_customers_mst`.
- **Soft delete enforcement**: Verify soft delete uses `is_active=false` and `rec_status=0` instead of hard delete.
- **Business logic**: Review and ensure business rules are properly enforced (e.g., phone normalization, customer number generation, progressive customer types).
- **Error handling**: Ensure service methods throw appropriate errors that can be caught and handled by API routes.

### 5. Review and enhance API client (existing implementation)

- **Verify API client**: Review `web-admin/lib/api/customers.ts` to ensure all CRUD functions exist (`fetchCustomers`, `getCustomerById`, `createCustomer`, `updateCustomer`, `deleteCustomer`).
- **Error handling**: Ensure API client properly handles errors and surfaces them via `cmxMessage` where appropriate.
- **Type safety**: Verify all API client functions use proper TypeScript types from `lib/types/customer.ts`.

### 6. Review and enhance frontend feature structure

- **Verify existing structure**: Check if `web-admin/src/features/customers/` exists or if components are in `app/dashboard/customers/components/`.
- **Refactor if needed**: If components are in `app/`, consider moving reusable components to `src/features/customers/ui/` following CleanMateX patterns.
- **Create hooks if missing**: Ensure hooks like `use-customers.ts` and `use-customer-form.ts` exist in `src/features/customers/hooks/` to encapsulate fetching, pagination, and form submission logic.
- **Component organization**: Ensure components follow the feature module pattern with clear separation of concerns.

### 7. Customer list screen (read & search)

- **Server-side pagination**: Use API-driven pagination consistent with other modules: `page`, `pageSize`, `search`, and filter params passed to the backend.
- **Table implementation**:
  - Use `CmxDataTable`/`CmxEditableDataTable` from `src/ui/data-display/` with columns for name/name2, phone, email, type, status, created date.
  - Implement sortable columns (e.g., name, createdAt) where supported by backend.
  - Add quick search on name/phone/email and combinations if supported by backend.
- **Filters and bulk actions**:
  - `customer-filters` component with status filter, type filter, and date range (createdAt) as needed.
  - Bulk actions like bulk deactivate can be planned as a later enhancement but keep the table structure flexible.

### 8. Customer create/edit form

- **Form structure**:
  - Implement `customer-form` using `CmxForm`, `CmxFormField`, and Cmx inputs.
  - Fields: English/Arabic names, phone, email, type (select), status (active/inactive), optional notes.
  - Use React Hook Form and Zod schema aligned with backend DTOs for client-side validation.
- **Behavior**:
  - Support both create and edit modes, receiving optional `initialValues`.
  - On submit, call `createCustomer` or `updateCustomer` via hooks and show success/error `cmxMessage` toasts.
  - After success, navigate back to list or stay on detail based on UX decision (e.g., configurable via prop).

### 9. i18n & RTL support

- **Translation keys**:
  - Add `customers` namespace keys in `messages/en.json` and `messages/ar.json` for titles, field labels, validation messages, and table column headers.
  - Reuse `common` keys for generic actions: save, cancel, delete, edit, search, confirm.
- **Direction-aware layout**:
  - Use Tailwind RTL utilities for spacing and alignment (`ml-4 rtl:ml-0 rtl:mr-4`, `text-left rtl:text-right`).
  - Ensure icons (e.g., chevrons in breadcrumbs or buttons) flip in RTL.

### 10. Permissions & roles integration

- **Permission checks**:
  - Decide on permission constants for customer management (e.g., `customers.read`, `customers.create`, `customers.update`, `customers.delete`).
  - On backend, enforce via guards/middleware.
  - In web-admin, hide or disable create/edit/delete controls when the current role lacks permissions (while still gracefully handling 403 from API).

### 11. Testing & validation

- **Backend tests**:
  - Add unit tests for `customers.service.ts` covering tenant isolation, create/update, soft delete, and unique constraints (duplicate phone/email).
  - Add API route tests for `/api/v1/customers` verifying auth, validation, pagination, and error handling.
- **Frontend tests**:
  - Add component tests for `customer-form` validation behavior and error rendering.
  - Add integration tests (if using Playwright/Cypress) for basic flows: list → create → edit → deactivate.
- **Multi-tenant checks**:
  - Create test scenarios ensuring one tenant cannot access or modify another tenant’s customers by manipulating IDs.

### 12. Build, performance, and docs

- **Performance considerations**:
  - Verify appropriate DB indexes exist on `tenant_org_id`, `phone`, `email`, and commonly filtered columns in `org_customers_mst` and `sys_customers_mst`.
  - Ensure list APIs use efficient pagination (limit/offset) and avoid N+1 issues for related data.
- **Build & QA**:
  - Run `npm run build` in `web-admin`; fix all type and lint errors.
  - Smoke test in both English and Arabic locales.
- **Documentation**:
  - Add or update a feature doc under `docs/features/customers/` describing the customer CRUD flows, permissions, and API contracts.
  - Document important design choices (tenant isolation, soft delete, validation rules) for future reference.
