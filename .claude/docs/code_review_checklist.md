
# Code Review Checklist

**Security**
- Tenant filter, RLS tested, no secrets, input validation, CSRF/XSS

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
