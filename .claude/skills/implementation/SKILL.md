---
name: implementation
description: PRD implementation rules, coding standards, and feature development workflow. Use when implementing new features or understanding coding conventions.
user-invocable: true
effort: medium
agents:
---

# Feature Implementation Workflow

## Before Starting Implementation

1. **Check implementation plans**: `docs/plan/master_plan_cc_01.md`
2. **Review architecture**: Use `/architecture` skill
3. **Understand multi-tenancy**: Use `/multitenancy` skill
4. **Review database conventions**: Use `/database` skill
5. **for frontend rules follow**: Use `/frontend` skill

## Implementation Checklist

### Phase 1: Planning
- [ ] Read PRD/feature spec thoroughly
- [ ] Identify affected tables and models
- [ ] Check for existing similar features
- [ ] Design database schema if needed
- [ ] Plan API endpoints structure
- [ ] Design UI components structure

### Phase 2: Database
- [ ] Check if tables exist (use table-check-workflow)
- [ ] Create migrations for new tables
- [ ] Add composite foreign keys for tenant isolation
- [ ] Enable RLS policies
- [ ] Add standard indexes
- [ ] Update Prisma schema
- [ ] **Permissions** — migration seeds DB; add `{DOMAIN}_PERMISSIONS` in `lib/constants/permissions/{domain}-perm.ts`
- [ ] **Navigation** (menu-visible routes) — `/navigation` dual-write: `navigation.ts` + `sys_components_cd` migration **before** derive (derive reads `navigation.ts` for `page.permissions`)
- [ ] **Access contract** — load `/rebuild-ui-access-contract`; do **not** hand-write full `*-access.ts` from scratch:

```bash
npm run scaffold:ui-access-contract -- --feature=<feature>   # or --route=/dashboard/...
npm run derive:ui-access-contract -- --feature=<feature> --apply --refresh-extract
npm run register:ui-access-contract -- --fix                  # new *-access.ts module only
```

- [ ] **Page + API gates** — `npm run wire:ui-access-contract -- --feature=<feature> --fix` then manual fix for `async`/redirect pages; API `requirePermission` on each local `/api/*` in `apiDependencies`
- [ ] **Validate** — `npm run check:ui-access-contract -- --feature=<feature> --wire --verbose` then `npm run sync:ui-access-contract`
- [ ] Rules: `.cursor/rules/ui-access-contract-pattern.mdc` · guide: `docs/platform/ui-access-contract/user_guide.md`

### Phase 3: Backend/API
- [ ] Implement service layer with tenant context
- [ ] Create API routes with validation
- [ ] Add error handling and logging
- [ ] Implement business logic
- [ ] Add input validation (Zod)
- [ ] **API gate** — `requirePermission` on each `/api/*` route listed in `*-access.ts` `apiDependencies` (load `/rebuild-ui-access-contract`; `wire --fix` adds guards for local `/api/*` only)
- [ ] **Server actions** — `hasPermissionServer` in `app/actions/**`; document module in contract `apiDependencies` as `/app/actions/...` (derive picks these up on `--apply`)

### Phase 4: Frontend
- [ ] Create feature module in `src/features/<feature>/`
- [ ] Implement UI components
- [ ] Add i18n translations under `web-admin/messages/en/**` and `web-admin/messages/ar/**`
- [ ] Support RTL layout
- [ ] Use Cmx Design System components

### Phase 5: Testing & Build
- [ ] Run `npm run build` and fix issues
- [ ] Test multi-tenant isolation
- [ ] Test CRUD operations
- [ ] Test edge cases
- [ ] Update common_issues.md if new issues found

### Phase 6: Documentation
- [ ] Update feature documentation
- [ ] Document API endpoints
- [ ] Add inline code comments for complex logic
- [ ] Update pending work docs
- [ ] **Feature Implementation Requirements** — Document all implementation details (use `/documentation` skill):
  - **Security & Access:** Permissions, RBAC roles
  - **Navigation:** Navigation tree entries, screen paths, menu items
  - **Configuration:** Tenant settings, system settings, environment variables
  - **Feature Management:** Feature flags, plan limits/constraints
  - **i18n:** New translation keys (EN/AR)
  - **API:** New routes, endpoints, request/response schemas
  - **Database:** Migrations, tables, indexes, RLS policies
  - **Constants & Types:** New constants, TypeScript types, Zod schemas
  - **Infrastructure:** Dependencies, external services, monitoring/logging
  - See complete checklist in `/documentation` skill

## Coding Standards

### TypeScript
- Strict mode enabled
- No `any` types
- Proper type definitions

### Constants — DB-Mirror Rule
- Before defining any constant whose value is stored in the DB (status codes, permission codes, type codes, lookup codes), **check the DB first**
- The TS constant value MUST be the exact same string as the DB value — same case, separators, spelling
- Example: DB stores `'PENDING_PAYMENT'` → constant must be `PENDING_PAYMENT: 'PENDING_PAYMENT'`, not `'pending-payment'`
- Applies to `lib/constants/`, Zod enums, and any value that round-trips to/from the DB

### Database
- Always use tenant_org_id filtering
- Use centralized `getTenantIdFromSession()`
- Wrap Prisma with `withTenantContext()`

### Frontend
- Use Cmx Design System (`src/ui/`)
- Feature-specific code in `src/features/`
- Always use i18n for text
- Support RTL

### Error Handling
- Use centralized logger (`@/lib/utils/logger`)
- Never use `console.log` directly
- Log with proper context (tenantId, userId, etc.)

## Code Review Checklist

- [ ] No hardcoded secrets
- [ ] All queries filter by tenant_org_id
- [ ] No `any` types in TypeScript
- [ ] Proper error handling
- [ ] Bilingual support (EN/AR)
- [ ] RTL layout support
- [ ] Logging uses centralized logger
- [ ] API routes have input validation
- [ ] Build succeeds without errors
- [ ] New constants match exact DB string values (no reformatting)
- [ ] New navigation entries updated in both `navigation.ts` AND `sys_components_cd` migration
- [ ] New permission codes have a DB seed migration

## Platform info inventories (conditional)

After permissions, navigation, feature flags, plan limits, or access contracts change:

1. Load **`/rebuild-platform-info-inventories`** — pick `refresh` / `repair` / `rebuild-all` per scope
2. Run `npm run rebuild:platform-info-inventories` and `npm run check:platform-info-inventories`
3. Document remaining allowlisted drift in PR notes

See `docs/features/_templates/implementation_requirements.md` for feature-level gating sections.

## Additional Resources

- [prd-rules.md](./prd-rules.md) - PRD implementation rules
- [code-review.md](./code-review.md) - Code review checklist
