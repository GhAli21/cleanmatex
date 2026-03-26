# AGENTS.md — CleanMateX AI Assistant

**Project:** CleanMateX — Multi-Tenant Laundry SaaS Platform (World Wide starting in GCC region, EN/AR bilingual)
**Last Update** 22-03-2026
**Last Update Description** Added /storybook skill + storybook-generator agent to mandatory loading table

## CRITICAL RULES

1. **Never do Supabase db reset** - tell the user, I'll run db migrations
2. **Never modify existing migration files** - always create a NEW migration for fixes or changes or new objects
3. **NEVER apply/run database migrations** - Create migration SQL files only, then STOP and ask me to review and apply them. Do NOT use Supabase MCP, CLI, or any tool to execute migrations.
4. **Every query MUST filter by `tenant_org_id`** - NO EXCEPTIONS (unless table doesn't have tenant_org_id)
5. **After frontend changes: run `npm run build`** and fix until success
6. **Bilingual support (EN/AR + RTL) is mandatory**
7. **Use agents for exploration** - See efficiency guide below
8. **Use `/clear` frequently** - When switching topics or context >70%
9. **Check skills for detailed rules** - Use `/skill-name` for specifics

## Cross-Project Work Protocol (CRITICAL - MANDATORY)

### Context Awareness Rule

**YOU ARE IN**: `cleanmatex` (Tenant-Facing Application)
**SIBLING PROJECT**: `cleanmatexsaas` (Platform HQ Console)

These are **separate projects** with **different rules**, even though they share the same database.

**This Project cleanmatex Folder**: F:\jhapp\cleanmatex
**Sibling cleanmatexsaas project**: F:\jhapp\cleanmatexsaas

**BEFORE implementing ANY feature**: Use the [Feature Placement Guide](.codex/docs/Dev/FEATURE_PLACEMENT_GUIDE.md) to determine correct placement:
1. Q1: Who are the primary users? (Tenant users / Platform admins / Both)
2. Q2: What is the data scope? (Single tenant / Cross-tenant / Both)
3. Q3: What is the access pattern? (RLS enforced / Service role key / Both)

**Decision Matrix Quick Reference**:
- **Tenant Operations** (Orders, Customers, Inventory, Lite ERP) → **cleanmatex** (this project)
- **Platform Admin** (Tenant Management, Billing, Analytics) → **cleanmatexsaas**
- **Dual-Purpose** (Settings, Feature Flags, Audit Logs) → **Both projects**

**For complex decisions**: Create an ADR using [ADR Template](.codex/docs/Dev/ADR_TEMPLATE.md) and follow [ADR Process](.codex/docs/Dev/ADR_PROCESS.md)

### When Work Spans Both Projects

If a feature requires implementation in BOTH cleanmatex and cleanmatexsaas:

**Use the [Cross-Project Feature Checklist](.codex/docs/Dev/CROSS_PROJECT_FEATURE_CHECKLIST.md)** - 200+ checkpoints covering all phases.

#### MANDATORY STEP 1: Declare Intent First

**BEFORE any implementation**, output this analysis:

```markdown
## Cross-Project Feature: [Feature Name]

### Scope Analysis

**cleanmatex Components** (Tenant App):
- Database: [migrations, tables, RLS policies, functions]
- Backend: [tenant-scoped APIs, services]
- Frontend: [tenant-facing UI components]
- Access Pattern: RLS + anon key (tenant-scoped only)

**cleanmatexsaas Components** (Platform HQ):
- Backend: [platform admin APIs, cross-tenant queries]
- Frontend: [platform admin UI, dashboards]
- Type Regeneration: [Required after cleanmatex migrations? Y/N]
- Access Pattern: Service role key (cross-tenant allowed)

**Shared Resources**:
- Database schema: [list tables, functions, views]
- Settings: [list new settings]
- Feature flags: [list new flags]
- RLS Policies: [list policies - created in cleanmatex]

**User Confirmation Required Before Proceeding**
```

**WAIT for user approval before proceeding.**

#### MANDATORY STEP 2: Context Switch Protocol

**When switching to cleanmatexsaas context:**

```markdown
---
🔄 **CONTEXT SWITCH: cleanmatex → cleanmatexsaas**
---

**New Active Project**: cleanmatexsaas (Platform HQ Console)
**Directory**: F:/jhapp/cleanmatexsaas
**Active AGENTS.md**: F:/jhapp/cleanmatexsaas/AGENTS.md
**Active Skills**: F:/jhapp/cleanmatexsaas/.codex/skills/
**Active Standards**: F:/jhapp/cleanmatexsaas/.codex/docs/

**Rules Now in Effect**:
- ✅ Use service role key Supabase client
- ✅ Cross-tenant queries allowed (for admin features)
- ✅ Regenerate types after cleanmatex migrations
- ✅ Implement platform admin features
- ❌ NEVER create migrations here
- ❌ NEVER use RLS-only patterns (we bypass RLS)
```

**When switching back to cleanmatex context:**

```markdown
---
🔄 **CONTEXT SWITCH: cleanmatexsaas → cleanmatex**
---

**New Active Project**: cleanmatex (Tenant-Facing Application)
**Directory**: F:/jhapp/cleanmatex
**Active AGENTS.md**: F:/jhapp/cleanmatex/AGENTS.md
**Active Skills**: F:/jhapp/cleanmatex/.codex/skills/
**Active Standards**: F:/jhapp/cleanmatex/.codex/docs/

**Rules Now in Effect**:
- ✅ Use RLS policies for ALL org_* tables
- ✅ Use anon key Supabase client
- ✅ Filter ALL queries by tenant_org_id
- ✅ Create migrations HERE (source of truth)
- ✅ Implement tenant-scoped features only
- ❌ NO cross-tenant queries
- ❌ NO service role key usage
```

#### MANDATORY STEP 3: Database Migrations Protocol

**ABSOLUTE RULES (NEVER VIOLATE)**:

| Rule | cleanmatex | cleanmatexsaas |
|------|-----------|----------------|
| **Create migrations** | ✅ ALWAYS HERE (source of truth) | ❌ NEVER HERE |
| **Migration location** | `F:/jhapp/cleanmatex/supabase/migrations/` | N/A |
| **Apply migrations** | ✅ User applies here | ❌ Never |
| **RLS policies** | ✅ MUST implement for org_* tables | ❌ Not applicable (service role bypasses) |
| **Type generation** | ✅ After migration | ✅ After migration (run update-types.ps1) |

**Workflow for database changes**:

1. **Create migration** in `F:/jhapp/cleanmatex/supabase/migrations/` (THIS PROJECT)
2. **Add RLS policies** if creating org_* tables
3. **Stop and tell user** to review and apply migration
4. **Wait for user confirmation** that migration is applied
5. **Tell user** to regenerate types in cleanmatexsaas: Run `F:/jhapp/cleanmatexsaas/scripts/dev/update-types.ps1`
6. **Verify types** in both codebases build successfully

#### MANDATORY STEP 4: Verification After Each Context

**Before executing ANY code**, verify:

```markdown
### Current Context Verification

- **Active Project**: [cleanmatex | cleanmatexsaas]
- **Current Directory**: [F:/jhapp/cleanmatex | F:/jhapp/cleanmatexsaas]
- **Active AGENTS.md**: [project]/AGENTS.md
- **Active Skills Directory**: [project]/.codex/skills/
- **Active Standards Directory**: [project]/.codex/docs/
- **Database Access Pattern**: [RLS + anon key | Service role key]
- **Tenant Filtering**: [ALWAYS filter | Filter only when tenant-specific]
- **Cross-Tenant Queries**: [FORBIDDEN | ALLOWED for admin]

**Action**: [What I'm about to do]
**Correct Context**: [✅ Yes | ❌ No - MUST SWITCH]
```

#### MANDATORY STEP 5: Skills and Standards Selection

**When in cleanmatex context** (THIS PROJECT), use:
- Skills from: `F:/jhapp/cleanmatex/.codex/skills/`
- Standards from: `F:/jhapp/cleanmatex/.codex/docs/`
- Examples: `/database`, `/create-rls-policy`, `/frontend` (cleanmatex version)

**When in cleanmatexsaas context**, use:
- Skills from: `F:/jhapp/cleanmatexsaas/.codex/skills/`
- Standards from: `F:/jhapp/cleanmatexsaas/.codex/docs/`
- Examples: `/backend-hq`, `/frontend` (cleanmatexsaas version), `/cross-project-sync`

**NEVER mix skills/standards across projects.**

#### MANDATORY STEP 6: Code Sharing Strategy

**When code needs to be shared** between projects, follow [Code Sharing Guide](.codex/docs/Dev/CODE_SHARING_GUIDE.md):

**Share (Copy with Source Tracking)**:
- Constants (payment methods, order statuses)
- Types/Interfaces (domain models that match exactly)
- Validation schemas (Zod schemas)
- Utility functions (pure functions, no side effects)
- Cmx Design System components

**Duplicate (Different Implementations)**:
- Business logic (different rules for tenant vs platform)
- API clients (different endpoints, different auth)
- Auth logic (TenantAuthGuard vs PlatformAuthGuard)
- Data access (Prisma + RLS vs Supabase-js + service role)

**API-Based Sharing (MANDATORY for Settings/Feature Flags)**:
- Settings: cleanmatexsaas manages (`sys_stng_*`) → cleanmatex consumes via HQ API
- Feature Flags: cleanmatexsaas manages (`sys_feature_flags_*`) → cleanmatex consumes via HQ API
- ❌ **NEVER** query `sys_stng_*` or `sys_feature_flags_*` directly from cleanmatex

### Error Recovery Protocol

**If I violate context** (e.g., use service role patterns in cleanmatex, forget to filter by tenant_org_id):

1. **User flags violation**: "Wrong context!"
2. **I immediately stop** and acknowledge error
3. **I delete/revert** incorrect work
4. **I announce correct context**
5. **I re-do work** in correct context with correct rules

### Cross-Project Feature Implementation Checklist

**Use the comprehensive [Cross-Project Feature Checklist](.codex/docs/Dev/CROSS_PROJECT_FEATURE_CHECKLIST.md)** for complete implementation guidance (200+ checkpoints across 12 phases).

**Quick Summary**:

- [ ] Feature placement determined using [Feature Placement Guide](.codex/docs/Dev/FEATURE_PLACEMENT_GUIDE.md)
- [ ] ADR created (if complex cross-project feature) using [ADR Template](.codex/docs/Dev/ADR_TEMPLATE.md)
- [ ] Scope analysis completed and user-approved
- [ ] Context switches announced explicitly
- [ ] Migrations created in cleanmatex (THIS PROJECT - if needed)
- [ ] RLS policies added in cleanmatex (if new org_* tables)
- [ ] User applied migrations
- [ ] Types regenerated in both projects (if migrations applied)
- [ ] Code sharing strategy followed ([Code Sharing Guide](.codex/docs/Dev/CODE_SHARING_GUIDE.md))
- [ ] cleanmatex implementation follows cleanmatex rules
- [ ] cleanmatexsaas implementation follows cleanmatexsaas rules
- [ ] Both projects build successfully
- [ ] No context violations occurred

### Quick Reference: Project Differences

| Aspect | cleanmatex (this project) | cleanmatexsaas |
|--------|-----------|----------------|
| **Purpose** | Tenant-facing application | Platform admin console |
| **Users** | Tenant users (managers, operators, staff) | Platform administrators |
| **Database Access** | Anon key + RLS | Service role key (bypasses RLS) |
| **Tenant Scope** | Single tenant only (ALWAYS filter) | All tenants (cross-tenant admin) |
| **Migrations** | ✅ Create here (source of truth) | ❌ Never create, only consume |
| **RLS Policies** | ✅ REQUIRED for org_* tables | ❌ Not applicable |
| **Query Filtering** | ALWAYS by tenant_org_id | Only when tenant-specific |
| **Port** | 3000 | 3001 (web), 3002 (api) |
| **AGENTS.md** | F:/jhapp/cleanmatex/AGENTS.md | F:/jhapp/cleanmatexsaas/AGENTS.md |

## Mandatory Skill Loading Before Writing Code

Before writing ANY code, ALWAYS load the relevant skill(s) first. No exceptions.

| Task type | Load skill first |
|---|---|
| Any SQL, migration, table, index, function | `/database` |
| Any frontend component, page, hook, JSX | `/frontend` |
| Any dashboard route access, permission-gated action, feature-flag gate, workflow-role gate, permissions inspector change | `/rebuild-ui-access-contract` |
| Any i18n key, translation, bilingual text | `/i18n` |
| Any API route, service, backend logic | `/backend` |
| Any query touching `org_*` tables | `/multitenancy` |
| Any new feature implementation | `/implementation` |
| Any inline comment, JSDoc, SQL comment, config annotation | `/code-documentation` |
| Any `.stories.tsx` file, new Cmx component | `/storybook` |

**How to enforce:**
- In plan mode: load skills during Phase 1 exploration, before Phase 2 design
- In execution mode: load skills before writing the first line of code for that domain
- If a skill was not loaded and you wrote code — stop, load the skill, verify compliance, fix if needed

## Agent-First Workflow

**ALWAYS use agents for:**

- Exploratory questions: "How does X work?" → Use Explore agent
- Finding code: "Where is Y?" → Use Explore agent
- Research: "What's the structure of Z?" → Use Explore agent
- Multi-file tasks: Implementation, debugging, testing → Use specialized agents

**Direct actions only for:**

- Specific file edits with exact path
- Single file reads
- Precise line-level changes

**See:** [docs/dev/claude-code-efficiency-guide.md](docs/dev/claude-code-efficiency-guide.md) for complete best practices

## Quick Commands

```bash
.\scripts\dev\start-services.ps1  # Start all services
cd web-admin; npm run dev       # Start web admin
npm run build                     # Build (run after changes)
```

## Database Quick Rules

- Tables: `sys_*` (global), `org_*` (tenant with RLS)
- Max 30 chars for all DB objects
- **NEVER modify existing migration files** — always create a NEW migration for fixes or changes. See `/database` skill.
- **Migrations: always use last seq** — list `supabase/migrations/`, take next version (e.g. after `0082` use `0083`), name file `{version}_{descriptive_snake_case}.sql`
- **DROP ... CASCADE** — Before adding DROP CASCADE, fetch
  affected objects, prepare recreate statements, and include them
  in the same migration. See `docs/dev/
drop-cascade-migration-workflow.md`
  Or, use Supabase MCP to run discovery queries against the target DB, fetch affected objects, prepare recreate statements, and include them in the same migration. See `docs/dev/drop-cascade-migration-workflow.md`.
- Audit fields: `created_at/_by/_info`, `updated_at/_by/_info`
- Bilingual: `name/name2`, `description/description2`
- Soft delete: `is_active=false`, `rec_status=0`
- Money Fields Datatype and Size `DECIMAL(19, 4)`
- No default value for currency_code
- No default value for any countery or locale related such as currency_code, country, city, timezone ...etc

**See:** `/database` skill for complete rules

## Hard Truth (Critical Mistakes to Avoid)

❌ Mistake 1:

Putting logic in controllers
→ You kill scalability

❌ Mistake 2:
Mixing orders + workflow
→ You lose flexibility forever

❌ Mistake 3:

No use-cases layer
→ Business logic becomes unmaintainable

❌ Mistake 4:

Ignoring events
→ Tight coupling everywhere

## Code Quick Rules

- TypeScript strict, no `any`
- No hardcoded secrets
- In `web-admin`, use the centralized tenant-context utilities where the implementation requires them
- In `cmx-api`, pass tenant context explicitly through guards/request context and service boundaries

**See:** `/implementation` skill for coding standards
**See:** `/code-documentation` skill for JSDoc patterns, SQL migration comments, Tailwind annotations, and config file documentation rules.

**Feature docs:** When implementing any feature, document platform-level requirements: new permissions, navigation tree/screen, tenant settings, feature flags, plan limits, i18n keys, API routes, migrations, RBAC changes, env vars. For dashboard UI access changes, also update `docs/platform/permissions/PERMISSIONS_BY_SCREEN.md` and `docs/platform/permissions/all_contract-aligned_UI_Permissions.md`. See `.codex/skills/implementation/prd-rules.md` → Feature Implementation Requirements.

## Constants & Types (single source of truth)

- **Constants live in `lib/constants/`** — one file per domain (e.g. `payment.ts`, `order-types.ts`). Define const objects (`as const`) and derive types from them: `type X = (typeof CONST)[keyof typeof CONST]`.
- **Types/interfaces live in `lib/types/`** — import const-derived types from constants; re-export types and optionally key consts so app code can use one import (e.g. `@/lib/types/payment` for both types and `PAYMENT_METHODS`, `INVOICE_STATUSES`, etc.).
- **Do not duplicate** — same concept (e.g. payment method codes) in one place only; other files re-export or import. Validation (Zod) should align with the same constants where possible.
- **Order status:** workflow order status → `lib/types/workflow.ts`; payment-related → `lib/constants/payment.ts` and `lib/types/payment.ts`.

**See:** `docs/dev/unification_types_order_payment_audit.md` for the payment/order unification audit.

## UI Quick Rules

- **web-admin UI:** Use **Cmx components only**. Import from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`. Do **not** use `@ui/compat` (removed). Use exact import lines from **`web-admin/.clauderc`** → `ui_components` when generating buttons, inputs, cards, dialogs, alerts, selects, etc.
- Search existing message keys before adding new
- Reuse `common.*` keys for shared UI
- Use `cmxMessages` when applicable
- Run `npm run check:i18n` after translation changes
- When building/Implementing A New report then put at the beginning the main feature name then the report name then at the end `rprt` in Naming any reports components/tools/screens/UI/... so on for example orders-payments-print-rprt.tsx

**See:** `/i18n` skill for complete i18n rules
**See:** `/frontend` skill for frontend developing rules
**See:** `.codex/docs/web-admin-ui-imports.md` for exact import snippets per component, `docs/dev/ui-migration-guide.md`

## Skills (Auto-loaded on demand)

### Core Development (Auto-invoked)

- `/multitenancy` - **CRITICAL** - Tenant isolation, RLS policies
- `/database` - Schema conventions, migrations, naming
- `/frontend` - for frontend developing rules, Next.js 16, React 19, Cmx Design System
- `/backend` - API routes, service layer, Supabase patterns
- `/i18n` - Bilingual support (EN/AR), RTL layout
- `/rebuild-ui-access-contract` - dashboard route/action access contracts, permissions inspector alignment, contract-aligned UI permissions docs

### Architecture & Planning

- `/architecture` - System design, tech stack, data access
- `/business-logic` - Order workflows, pricing, quality gates

### Development Workflow (User-invoked)

- `/implementation` - Feature development, coding standards
- `/dev-commands` - CLI commands reference
- `/testing` - Testing strategy, patterns
- `/debugging` - Troubleshooting, build fixes
- `/documentation` - Documentation standards

### Utility

- `/explain-code` - Code explanations with diagrams
- `/codebase-visualizer` - Interactive codebase tree
- `/storybook` - Story generation for Cmx components (RTL, a11y, variants) — also triggers `storybook-generator` agent

## Structure

One **shared Supabase instance** (same DB schema). Separate app/module folders all use it.

```
supabase/     # Shared DB + RLS (PostgreSQL port 54322)
web-admin/    # Next.js Admin (Active)
cmx-api/      # NestJS client API (Phase 2)
docs/         # All documentation
```

## Key Documentation

- **Efficiency Guide:** `docs/dev/claude-code-efficiency-guide.md` ⭐ READ THIS
- **UI Migration Guide:** `docs/dev/ui-migration-guide.md` — `@/components/ui` → `@ui` gradual migration
- **Master Plan:** `docs/plan/master_plan_cc_01.md`
- **Planning Backlog Note:** `docs/plan/` is the approved planning authority; reconcile useful material from `docs/plan_cr/` into `docs/plan/`
- **Constants & types (unification):** `docs/dev/unification_types_order_payment_audit.md`
- **TODO completion docs:** `docs/dev/CompletePendingAndTODOCodes_13022026/` — per-item implementation details
- **Common Issues:** `.codex/skills/debugging/common-issues.md`
- **Settings Reference:** `.codex/docs/settings-reference.md` — when to use `sys_tenant_settings_cd` vs Allsettings files
- **Preferences (unified):** `docs/features/Customer_Order_Item_Pieces_Preferences/README.md` — org_order_preferences_dtl, conditions/colors; migrations 0165–0169 in `docs/dev/preferences-unified-migrations-0165-0169.md`

## Key Guardrails

- **Security:** RLS on all `org_*` tables, composite FKs, no hardcoded secrets
- **Performance:** Indexes, avoid N+1 queries, paginate results
- **Testing:** Cover business logic and tenant isolation
- **Validation:** Validate all inputs at system boundaries
- **Documentation:** For every feature, document permissions, navigation tree, settings, feature flags, plan limits, i18n keys, API routes, migrations, constants/types, and env vars (see `/documentation` skill for complete checklist)

## How to Make Cursor/Claude/Codex Follow the Rules

1. **Always-applied rules (Cursor):** `.cursor/rules/*.mdc` with `alwaysApply: true` (e.g. `uiuxrules.mdc`, `report-implement-or-build.mdc`, `web-admin-ui-imports.mdc`) are loaded into Cursor context automatically. Keep critical, short rules there.
   **→ Claude equivalent:** The same rules are embedded in `.codex/skills/frontend/SKILL.md`, `.codex/skills/frontend/uiux-rules.md`, and `.codex/docs/web-admin-ui-imports.md` — Claude reads these when `/frontend` skill is active.

2. **CLAUDE.md (Claude):** Always in context — primary source for CRITICAL RULES. Any rule that must always be followed must be stated here or referenced here.

3. **AGENTS.md (Codex):** Always in context — primary source for CRITICAL RULES. Any rule that must always be followed must be stated here or referenced here.

4. **Skills (Codex):** Use `/frontend`, `/i18n`, `/database`, etc. so the detailed skill loads. AGENTS.md points to the right skill per topic.

5. **Skills (All):** Use `/frontend`, `/i18n`, `/database`, etc. so the detailed skill loads. CLAUDE.md points to the right skill per topic.

4. **Enforcement at build time (both):** ESLint (`no-restricted-imports`) forbids `@ui/compat` and `@/components/ui`. TypeScript fails on invalid paths. Running `npm run build` in web-admin catches violations regardless of which tool suggested the code.

5. **web-admin/.clauderc (All):** Authoritative import snippets for Cmx components. Update it when adding/changing shared UI. Codex/Claude reads it via `.codex/docs/web-admin-ui-imports.md` (extracted list).

6. **Explicit prompts (All):** When you want a rule followed, say it (e.g. "Use Cmx components only and import from .clauderc" or "Follow frontendstandards").

## Supabase MCPs

- **NEVER apply migrations via MCP** — create the `.sql` migration file, then STOP and ask me to review and apply it
- Local: `supabase_local MCP`
- Remote: `supabase_remote MCP`
- MCP may be used for **read-only discovery queries** (e.g. finding affected objects before DROP CASCADE) — never for writes or migration execution
- **DROP ... CASCADE:** Use MCP read queries to discover affected objects, then include recreate statements in the migration file. See `docs/dev/drop-cascade-migration-workflow.md`.

# CleanMateX Repository Additional Rules - from chatgpt

## Mission
- Maintain production-grade quality.
- Keep changes scoped, reversible, and easy to review.
- Do not create unnecessary churn.

## Architecture guardrails
- Respect current module boundaries and app structure.
- Reuse shared UI, hooks, services, table patterns, utilities, and domain logic whenever possible.
- Avoid moving files, renaming modules, or broad folder reorganization unless explicitly requested.
- Preserve current app/router/data-flow patterns unless the task explicitly requires change.

## Implementation rules
- Fix root causes, not surface symptoms.
- Keep backward compatibility unless explicitly told otherwise.
- Avoid speculative refactors.
- Avoid broad formatting of unrelated files.
- Do not replace existing patterns just because another pattern is possible.

## Frontend rules
- Reuse existing component conventions.
- Maintain responsive behavior.
- Preserve current i18n patterns.
- Preserve accessibility where present and improve it when directly relevant.
- Keep UI changes visually consistent with existing screens.

## Backend / API rules
- Do not change API contracts unless explicitly requested.
- Do not modify auth, tenant isolation, or role/permission logic casually.
- Be careful with validation, pagination, filtering, and sorting behavior.
- Preserve auditability and predictable error handling.

## Database / SaaS safety rules
- Do not create or apply schema migrations without approval.
- Do not modify tenant isolation or row-level access logic without explicit approval.
- Do not change seeded codes, enums, or plan/feature-flag behavior unless explicitly requested.
- Treat billing, plans, permissions, feature flags, and tenant-scoped settings as sensitive areas.

## Validation required before finalizing
- Run lint if available.
- Run typecheck if available.
- Run targeted tests for affected scope if available.
- Run build if the changed area could impact compilation or bundling.

## Output contract
- Always provide:
  1. concise summary
  2. files changed
  3. validation results
  4. risks / follow-ups
