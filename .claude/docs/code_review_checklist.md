# Code Review Checklist

**Security**

- Tenant filter, RLS tested, no secrets, input validation, CSRF/XSS
- **Centralized tenant context**: No duplicate `getTenantIdFromSession()` implementations
- **Prisma services**: All queries wrapped with `withTenantContext()` (for `org_*` tables)
- **Supabase services**: All queries include `.eq('tenant_org_id', tenantId)`

**Isolation**

- Composite FKs, cross-tenant access impossible

**Performance**

- No N+1, indexes, pagination, caching considered

**Quality**

- Strong typing, error handling, logging, conventions

**Testing**

- Unit + integration, edge cases, error scenarios

**i18n**

- Translation keys, bilingual fields, RTL checks, locale currency/date

**Docs**

- API docs, comments, migration notes, README/CHANGELOG
