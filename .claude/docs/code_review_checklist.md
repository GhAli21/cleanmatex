# Code Review Checklist

**Security**

- Tenant filter, RLS tested, no secrets, input validation, CSRF/XSS
- **Centralized tenant context**: No duplicate `getTenantIdFromSession()` implementations
- **Prisma services**: All queries wrapped with `withTenantContext()` (for `org_*` tables)
- **Tenant enforcement**: every `org_*` query (Prisma, Supabase client, raw SQL, SQL functions, joins, and INSERT/UPDATE/DELETE writes) MUST include `tenant_org_id` directly in the query when the table has that column; by-`id`-only access is a violation. RLS and any Prisma guard are defense in depth only. Check Supabase `.eq('tenant_org_id', tenantId)`, Prisma `where`, raw SQL, and each joined `org_*` table.

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
