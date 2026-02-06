# Customer Domain Model

## Tables

### sys_customers_mst (global)

- **PK**: `id` (UUID)
- **Fields**: first_name, last_name, display_name, name, name2, phone, email, type, address, area, building, floor, preferences (JSONB), first_tenant_org_id, created_at, updated_at, created_by, created_info, updated_by, updated_info
- **Soft delete**: None (global identity)
- **Bilingual**: name / name2

### org_customers_mst (tenant-scoped)

- **PK**: `id` (UUID)
- **tenant_org_id**: UUID, NOT NULL (RLS)
- **customer_id**: UUID, nullable FK → sys_customers_mst(id)
- **Unique**: (tenant_org_id, customer_id)
- **Fields**: name, name2, display_name, first_name, last_name, phone, email, type, address, area, building, floor, preferences, customer_source_type, s_date, loyalty_points, rec_order, rec_status, is_active, rec_notes, created_at, created_by, created_info, updated_at, updated_by, updated_info
- **Soft delete**: is_active (boolean), rec_status (SMALLINT, 0 = deleted)
- **Bilingual**: name / name2

## TypeScript types (web-admin/lib/types/customer.ts)

- **Customer**: Full profile (id, customerNumber, firstName, lastName, displayName, name, name2, phone, email, type, profileStatus, preferences, address fields, timestamps)
- **CustomerListItem**: List row (id, customerNumber, displayName, name, name2, firstName, lastName, phone, email, type, profileStatus, createdAt, totalOrders, lastOrderAt, loyaltyPoints, source metadata)
- **CustomerCreateRequest**: Union of CreateGuestCustomerRequest | CreateStubCustomerRequest | CreateFullCustomerRequest
- **CustomerUpdateRequest**: Partial profile fields for PATCH
- **CustomerSearchParams**: page, limit, search, type, status, sortBy, sortOrder

## API response format

- Success: `{ success: true, data?: T, message?: string, pagination?: { total, page, limit, totalPages } }`
- Error: `{ success?: false, error: string, details?: object }` with appropriate HTTP status (400, 401, 403, 404, 409, 500).
