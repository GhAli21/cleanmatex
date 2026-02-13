# CLAUDE.md — CleanMateX AI Assistant

**Project:** CleanMateX — Multi-Tenant Laundry SaaS Platform (World Wide starting in GCC region, EN/AR bilingual)

## CRITICAL RULES

1. **Never do Supabase db reset** - tell me, I'll run db migrations
2. **Every query MUST filter by `tenant_org_id`** - NO EXCEPTIONS (unless table doesn't have tenant_org_id)
3. **After frontend changes: run `npm run build`** and fix until success
4. **Bilingual support (EN/AR + RTL) is mandatory**
5. **Use agents for exploration** - See efficiency guide below
6. **Use `/clear` frequently** - When switching topics or context >70%
7. **Check skills for detailed rules** - Use `/skill-name` for specifics

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
- **Migrations: always use last seq** — list `supabase/migrations/`, take next version (e.g. after `0082` use `0083`), name file `{version}_{descriptive_snake_case}.sql`
- Audit fields: `created_at/_by/_info`, `updated_at/_by/_info`
- Bilingual: `name/name2`, `description/description2`
- Soft delete: `is_active=false`, `rec_status=0`
- Money Fields Datatype and Size `DECIMAL(19, 4)`
- No default value for currency_code
- No default value for any countery or locale related such as currency_code, country, city, timezone ...etc

**See:** `/database` skill for complete rules

## Code Quick Rules

- TypeScript strict, no `any`
- No hardcoded secrets
- Tenant context: `getTenantIdFromSession()` from `@/lib/db/tenant-context`
- Wrap queries: `withTenantContext()`

**See:** `/implementation` skill for coding standards

## Constants & Types (single source of truth)

- **Constants live in `lib/constants/`** — one file per domain (e.g. `payment.ts`, `order-types.ts`). Define const objects (`as const`) and derive types from them: `type X = (typeof CONST)[keyof typeof CONST]`.
- **Types/interfaces live in `lib/types/`** — import const-derived types from constants; re-export types and optionally key consts so app code can use one import (e.g. `@/lib/types/payment` for both types and `PAYMENT_METHODS`, `INVOICE_STATUSES`, etc.).
- **Do not duplicate** — same concept (e.g. payment method codes) in one place only; other files re-export or import. Validation (Zod) should align with the same constants where possible.
- **Order status:** workflow order status → `lib/types/workflow.ts`; payment-related → `lib/constants/payment.ts` and `lib/types/payment.ts`.

**See:** `docs/dev/unification_types_order_payment_audit.md` for the payment/order unification audit.

## UI Quick Rules

- Search existing message keys before adding new
- Reuse `common.*` keys for shared UI
- Use `cmxMessages` when applicable
- Run `npm run check:i18n` after translation changes
- When building/Implementing A New report then put at the beginig the main feature name then the report name then at the end `rprt` in Naming any reports components/tools/screens/UI/... so on for example orders-payments-print-rprt.tsx

**See:** `/i18n` skill for complete i18n rules

## Skills (Auto-loaded on demand)

### Core Development (Auto-invoked)

- `/multitenancy` - **CRITICAL** - Tenant isolation, RLS policies
- `/database` - Schema conventions, migrations, naming
- `/frontend` - Next.js 15, React 19, Cmx Design System
- `/backend` - API routes, service layer, Supabase patterns
- `/i18n` - Bilingual support (EN/AR), RTL layout

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
- **Master Plan:** `docs/plan/master_plan_cc_01.md`
- **Constants & types (unification):** `docs/dev/unification_types_order_payment_audit.md`
- **TODO completion docs:** `docs/dev/CompletePendingAndTODOCodes_13022026/` — per-item implementation details
- **Common Issues:** `.claude/skills/debugging/common-issues.md`

## Key Guardrails

- **Security:** RLS on all `org_*` tables, composite FKs, no hardcoded secrets
- **Performance:** Indexes, avoid N+1 queries, paginate results
- **Testing:** Cover business logic and tenant isolation
- **Validation:** Validate all inputs at system boundaries

## Supabase MCPs

- do not use to apply database migrations before you confirm with me if create db migration files only or apply them also
- Local: `supabase_local MCP`
- Remote: `supabase_remote MCP`
