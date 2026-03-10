# Customer CRUD API

## Endpoints (Documented API Surface)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/customers` | `customers:read` | List customers with search, filters, pagination |
| POST | `/api/v1/customers` | `customers:create` | Create customer (guest/stub/full) |
| GET | `/api/v1/customers/:id` | `customers:read` | Get customer detail with addresses |
| PATCH | `/api/v1/customers/:id` | `customers:update` | Update customer profile |
| DELETE | `/api/v1/customers/:id` | `customers:delete` | Soft-deactivate customer |

## Security

- **Permissions**: All routes use `requirePermission()`; permissions are `customers:read`, `customers:create`, `customers:update`, `customers:delete`.
- **Tenant isolation**: Service layer uses `getTenantIdFromSession()`; all queries on `org_customers_mst` filter by `tenant_org_id`. RLS policies enforce tenant isolation at the database.
- **CSRF**: POST, PATCH, DELETE validate CSRF via `validateCSRF(request)`.
- **Rate limiting**: Applied per tenant via `checkAPIRateLimitTenant(tenantId)`.

## Soft delete

- DELETE sets `is_active = false` and `rec_status = 0` on `org_customers_mst`; no rows are physically removed.
- List and get operations respect `is_active` where applicable (e.g. list can filter by status active/inactive).

## List query parameters

- `page`, `limit` (1–100), `search`, `type` (guest|stub|walk_in|full), `status` (active|inactive), `sortBy` (name|createdAt|lastOrderAt|totalOrders), `sortOrder` (asc|desc).
- optional broader search flags in older customer docs should be treated as implementation-dependent and verified in current code before being exposed as user-facing guarantees

## Response format

- Success: `{ success: true, data?, message?, pagination? }`.
- Error: `{ success: false, error: string }` with HTTP 400/401/403/404/409/500.
