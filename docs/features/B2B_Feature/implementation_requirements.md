---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature Implementation Requirements

Platform-level items for B2B feature. See [docs/platform/README.md](../../platform/README.md) for reference.

## New Permissions

Add to `sys_permission_*` and assign to roles:

| Permission | Description |
| --- | --- |
| `b2b.customers.view` | View B2B customers list |
| `b2b.customers.create` | Create B2B customer |
| `b2b.customers.edit` | Edit B2B customer |
| `b2b.customers.delete` | Delete/deactivate B2B customer |
| `b2b.contacts.view` | View B2B contacts |
| `b2b.contacts.create` | Create contact |
| `b2b.contacts.edit` | Edit contact |
| `b2b.contacts.delete` | Delete contact |
| `b2b.contracts.view` | View contracts |
| `b2b.contracts.create` | Create contract |
| `b2b.contracts.edit` | Edit contract |
| `b2b.contracts.delete` | Delete contract |
| `b2b.statements.view` | View statements |
| `b2b.statements.create` | Generate statement |
| `b2b.statements.edit` | Update statement (e.g. issue) |

## Navigation Tree / Screen

- Add B2B section to sys_components_cd / navigation
- Items: Customers, Contracts, Statements
- `feature_flag: 'b2b_contracts'` — section visible only when flag enabled
- Routes: `/dashboard/b2b/customers`, `/dashboard/b2b/contracts`, `/dashboard/b2b/statements`

## New Tenant Setting

- `b2b_credit_limit_mode`: `warn` | `block` — credit limit behavior
- `b2b_dunning_levels`: JSON array for dunning config (days, action)

## New Feature Flag

- `b2b_contracts` — already exists in sys_tenant_settings_cd
- `b2b_invoicing`, `b2b_invoicing_enabled`, `b2b_statements_enabled`, `credit_limits` — already exist

## New Plan Limit / Constraint

- `credit_limits` — already exists per plan (e.g. PRO: 5000, ENTERPRISE: 50000)
- Per-customer `credit_limit` must be ≤ tenant plan cap

## New i18n Keys

- Add `b2b.*` namespace to `web-admin/messages/en.json`, `ar.json`
- Reuse `common.*` where possible
- Keys: b2b.customers, b2b.contracts, b2b.statements, b2b.contacts, b2b.companyName, b2b.creditLimit, etc.

## New API Routes

- `GET/POST /api/v1/b2b-contacts`, `GET/PATCH/DELETE /api/v1/b2b-contacts/:id`
- `GET/POST /api/v1/b2b-contracts`, `GET/PATCH/DELETE /api/v1/b2b-contracts/:id`
- `GET /api/v1/b2b-statements`, `POST /api/v1/b2b-statements/generate`, `GET/PATCH /api/v1/b2b-statements/:id`

## Database Migration(s)

- **0147_b2b_customers_contracts_contacts.sql**
- Extend `org_customers_mst`: company_name, company_name2, tax_id, credit_limit, payment_terms_days, cost_center_code
- Create `org_b2b_contacts_dtl`
- Create `org_b2b_contracts_mst`
- Create `org_b2b_statements_mst`
- Extend `org_invoice_mst`: invoice_type_cd, b2b_contract_id, statement_id, cost_center_code, po_number
- Extend `org_orders_mst`: b2b_contract_id, cost_center_code, po_number (if not present)
- RLS on all new tables
- **Do NOT apply** — create file only; user applies migrations

## New Constants / Types

- `web-admin/lib/constants/b2b.ts`: INVOICE_TYPES, STATEMENT_STATUSES, PAYMENT_TERMS_OPTIONS, CONTACT_ROLES
- `web-admin/lib/types/b2b.ts`: B2BContract, B2BStatement, B2BContact
- Extend `lib/types/customer.ts`: add `b2b` to CustomerType; B2B fields on Customer interface

## RBAC / Role Changes

- Assign b2b.* permissions to appropriate roles (e.g. ROLE_ADMIN, ROLE_FINANCE)
- Update permission cache if applicable

## Environment Variables

- N/A for B2B feature

## Other

- Prisma: Regenerate schema after migrations applied
- Receipt channel rules: B2B default to formal PDF (tenant setting)
