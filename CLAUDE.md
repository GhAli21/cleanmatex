# CLAUDE.md — CleanMateX AI Assistant

**Project:** CleanMateX — Multi-Tenant Laundry SaaS Platform (World Wide starting in GCC region, EN/AR bilingual)

## CRITICAL RULES

1. **Never do Supabase db reset** - tell me, I'll run migrations
2. **Every query MUST filter by `tenant_org_id`** - NO EXCEPTIONS only if table not having tenant_org_id column
3. **After frontend changes: run `npm run build`** and fix until success - keep fixing until build succeeds
4. **Bilingual support (EN/AR + RTL) is mandatory**
5. **Check plans first:** `docs/plan/master_plan_cc_01.md`
6. **Use free/open-source tools whenever possible**
7. **All documentation files must be placed under `docs/` directory**
8. **When build fails, fix issues and update:** `.claude/docs/common_issues.md`

## Supabase MCPs
- Local: `supabase_local MCP`
- Remote: `supabase_remote MCP`

## Database Rules
- Names should not exceed 30 characters for All database objects such as Tables, columns, functions, .. so on 
- Tables: `sys_*` (global), `org_*` (tenant with RLS)
- Audit fields: `created_at/_by/_info`, `updated_at/_by/_info`, `rec_status default 1`, `is_active`, `rec_notes`, `rec_order`
- Bilingual: `name/name2`, `description/description2`
- Composite FKs for tenant joins
- Soft delete: `is_active=false` `rec_status=0`

## Code Rules
- TypeScript strict, no `any`
- No hardcoded secrets
- Use centralized `getTenantIdFromSession()` from `@/lib/db/tenant-context`
- Wrap Prisma queries with `withTenantContext()`

## UI Rules
- Always search for exist messages keys and reuse or add new messages keys into en.json and ar.json
- Always use common keys for common messages keys
- use cmxMessages when applicable

## Documentation (load on-demand via Skills)
Use `/skill-name` to load specific rules when needed:
- `/architecture` - System design, stack, data access
- `/database_conventions` - Schema patterns, naming
- `/frontend_standards` - Next.js, React, Tailwind
- `/backend_standards` - NestJS, API patterns
- `/multitenancy` - RLS, tenant isolation
- `/i18n` - Internationalization, RTL
- `/common_issues` - Debugging, build errors

**Important docs:**
- Documentation rules: `.claude/docs/documentation_rules.md`
- Implementation rules: `.claude/docs/prd-implementation_rules.md`
- For sessions: Update docs capturing remaining work to prevent context loss

## Quick Commands
```bash
.\scripts\dev\start-services.ps1  # Start all services
cd web-admin && npm run dev       # Start web admin
npm run build                     # Build (run after changes)
```

## Structure
```
supabase/     # Database + RLS (PostgreSQL port 54322)
web-admin/    # Next.js Admin (Active)
backend/      # NestJS API (Phase 2)
docs/         # All documentation
```

## Key Guardrails
- **Security:** RLS on all `org_*` tables, composite FKs, no hardcoded secrets
- **Performance:** Indexes, avoid N+1 queries, paginate results
- **Testing:** Cover business logic and tenant isolation
- **Validation:** Validate all inputs at system boundaries
