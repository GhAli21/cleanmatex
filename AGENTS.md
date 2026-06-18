# ⛔ HARD STOP — READ BEFORE ANYTHING ELSE

**Before writing ANY code, SQL, migration, component, route, or translation — apply the mandatory rules below. No exceptions.**

| Writing... | Mandatory rule |
|---|---|
| SQL / migration / function | Apply **Database Quick Rules** (see below) |
| Frontend / component / JSX | **Use Cmx components ONLY** — see **UI Component Rules** (see below) |
| i18n / translation | Add key to `messages/en.json` AND `messages/ar.json` |
| API route / service / backend | Use service layer, always filter by `tenant_org_id` |
| Any `org_*` table query | Filter by `tenant_org_id` — NO EXCEPTIONS |
| New navigation entry | Dual-write: `navigation.ts` + `sys_components_cd` DB migration |
| New permission code | Seed into DB via migration — see CRITICAL RULE #11 |

**Skipping these rules = build failure and rejected PR.**

---

# AGENTS.md — CleanMateX Tenant App · F:\jhapp\cleanmatex

**Project:** CleanMateX — Multi-Tenant Laundry SaaS Platform (GCC-first, EN/AR bilingual)
**Last Update:** 22-03-2026
**Last Update Description:** Added /storybook skill + storybook-generator agent to mandatory loading table

---

## CRITICAL RULES

1. **Never do Supabase db reset** — tell the user, they'll run db migrations
2. **Never modify existing migration files** — always create a NEW migration for fixes or changes
3. **NEVER apply/run database migrations** — create migration SQL files only, then STOP and ask to review. Do NOT use Supabase MCP, CLI, or any tool to execute migrations.
4. **Every query MUST filter by `tenant_org_id`** — NO EXCEPTIONS (unless table has no tenant_org_id)
5. **After frontend changes: run `npm run build`** and fix until success
6. **Bilingual support (EN/AR + RTL) is mandatory**
7. **Use agents for exploration** — see efficiency guide below
8. **Use `/clear` frequently** — when switching topics or context >70%
9. **Check skills for detailed rules** — use `/skill-name` for specifics
10. **Navigation changes are DUAL-WRITE** — any add/modify to navigation MUST update BOTH `web-admin/config/navigation.ts` (frontend sidebar) AND generate a DB migration for `sys_components_cd`. Neither alone is complete.
11. **New permissions MUST have a migration** — every new permission code requires a corresponding DB migration file that seeds it into the permissions table. Never define a permission only in TypeScript without the DB migration.
12. **Constants MUST mirror DB names** — when a constant value already exists as a column value, status code, or enum in the database, the TypeScript constant MUST use the exact same string (case, spelling, separator). Drift between DB values and TS constants causes silent bugs.
13. **Permission codes MUST follow `resource:action` format** — every permission code must match `^[a-z0-9_]+:([a-z0-9_]+|\*)$|^\*:\*$`. Lowercase letters, digits, and underscores only. Wildcard actions (`orders:*`) and global wildcard (`*:*`) are the only allowed `*` forms. Examples: `orders:read` ✅  `customers:*` ✅  `Orders:Read` ❌  `orders.read` ❌

---

## Identity & Cross-Project Awareness

**YOU ARE IN:** `cleanmatex` (Tenant-Facing Application) · `F:\jhapp\cleanmatex`
**SIBLING PROJECT:** `cleanmatexsaas` (Platform HQ Console) · `F:\jhapp\cleanmatexsaas`

This project owns **all database migrations**. cleanmatexsaas never creates migrations.

**Quick decision:**
- Tenant Operations (Orders, Customers, Inventory, Lite ERP) → **here**
- Platform Admin (Tenant Management, Billing, Analytics) → **cleanmatexsaas**
- Dual-Purpose (Settings, Feature Flags, Audit Logs) → **both** (see contracts)

**For cross-project work, context switches, migration protocol, ADR approval, and integration contracts:**
→ **`docs/dev/rules/integration-contracts.md`** is the single source of truth.

**API-Based Consumption (MANDATORY):**
- Settings (`sys_stng_*`) → managed by cleanmatexsaas, consumed here via HQ API
- Feature Flags (`sys_feature_flags_*`) → managed by cleanmatexsaas, consumed here via HQ API
- ❌ NEVER query `sys_stng_*` or `sys_feature_flags_*` directly from this project

---

## Mandatory Rules Before Writing Code

Before writing ANY code, ALWAYS apply the relevant domain rules first. No exceptions.

| Task type | Rule to apply |
|---|---|
| Any SQL, migration, table, index, function | **Database Quick Rules** below |
| Any frontend component, page, hook, JSX | **UI Component Rules** below — Cmx only |
| Any i18n key, translation, bilingual text | Add to `messages/en.json` + `messages/ar.json` |
| Any API route, service, backend logic | Service layer, tenant_org_id filter mandatory |
| Any query touching `org_*` tables | Filter by `tenant_org_id` — NO EXCEPTIONS |
| Any new feature implementation | Follow all CRITICAL RULES |
| Any inline comment, JSDoc, SQL comment, config annotation | Comment the WHY not the WHAT — English only |
| Any `.stories.tsx` file, new Cmx component | Follow Storybook patterns in `src/ui/` |
| Any navigation add/modify (sidebar, routes, menu items) | Dual-write: `navigation.ts` + `sys_components_cd` migration |

---

## Agent-First Workflow

**ALWAYS use agents for:**
- Exploratory questions: "How does X work?" → Explore agent
- Finding code: "Where is Y?" → Explore agent
- Research: "What's the structure of Z?" → Explore agent
- Multi-file tasks: Implementation, debugging, testing → specialized agents

**Direct actions only for:**
- Specific file edits with exact path
- Single file reads
- Precise line-level changes

**See:** `docs/dev/claude-code-efficiency-guide.md`

---

## Quick Commands

```bash
.\scripts\dev\start-services.ps1  # Start all services
cd web-admin; npm run dev          # Start web admin
npm run build                      # Build (run after changes)
```

---

## Database Quick Rules

- Tables: `sys_*` (global), `org_*` (tenant with RLS)
- Max 30 chars for all DB objects
- **NEVER modify existing migration files** — always create a NEW migration
- **Migrations: always use last seq** — list `supabase/migrations/`, take next version (e.g. after `0082` use `0083`), name `{version}_{descriptive_snake_case}.sql`
- **DROP ... CASCADE is BANNED by default** — always use `DROP ... RESTRICT`. CASCADE is only allowed when: (1) no safer alternative exists, (2) a full dependency manifest has been produced, (3) recreate statements + rollback strategy are in the same migration. STOP and get user confirmation before writing any CASCADE migration. See `docs/dev/drop-cascade-migration-workflow.md`
- Audit fields: `created_at/_by/_info`, `updated_at/_by/_info`
- Bilingual: `name/name2`, `description/description2`
- Soft delete: `is_active=false`, `rec_status=0`
- Money fields: `DECIMAL(19, 4)`
- String columns: **always `TEXT`**, never `VARCHAR`
- No default value for `currency_code`, `country`, `city`, `timezone`, or any locale-related field
- **Permissions require a migration** — every new permission code must be seeded into the DB permissions table via a migration file. A permission that exists only in TypeScript/code but not in the DB is incomplete. Include ALL new permissions for a feature in a single dedicated migration.
- **Navigation requires a migration** — every new or modified navigation entry must have a corresponding `sys_components_cd` migration. See CRITICAL RULE #10.

---

## Hard Truth (Critical Mistakes to Avoid)

❌ Mistake 1: Putting logic in controllers → kills scalability
❌ Mistake 2: Mixing orders + workflow → loses flexibility forever
❌ Mistake 3: No use-cases layer → business logic becomes unmaintainable
❌ Mistake 4: Ignoring events → tight coupling everywhere

---

## Code Quick Rules

- TypeScript strict, no `any`
- No hardcoded secrets
- In `web-admin`, use the centralized tenant-context utilities where the implementation requires them
- In `cmx-api`, pass tenant context explicitly through guards/request context and service boundaries

**Feature docs:** When implementing any feature, document: permissions, navigation tree/screen, tenant settings, feature flags, plan limits, i18n keys, API routes, migrations, RBAC changes, env vars. See `.claude/skills/implementation/prd-rules.md`.

---

## Constants & Types (single source of truth)

- **Constants live in `lib/constants/`** — one file per domain (`payment.ts`, `order-types.ts`). Define `as const` objects and derive types: `type X = (typeof CONST)[keyof typeof CONST]`
- **Types/interfaces live in `lib/types/`** — import const-derived types from constants; re-export types and key consts for single-import usage
- **Do not duplicate** — same concept in one place only; other files re-export or import. Zod validation should align with the same constants
- **Order status:** workflow order status → `lib/types/workflow.ts`; payment-related → `lib/constants/payment.ts` + `lib/types/payment.ts`
- **DB-mirror rule (CRITICAL):** Before defining any constant whose value is stored in the database (status codes, type codes, permission codes, enum values, lookup codes), first check the DB for the existing value. The TypeScript constant value MUST be the exact same string — same case, same separators, same spelling. Example: if the DB column stores `'PENDING_PAYMENT'`, the constant must be `PENDING_PAYMENT: 'PENDING_PAYMENT'`, not `'pending-payment'` or `'PendingPayment'`. This applies to `lib/constants/`, Zod enums, and any lookup that round-trips to/from the DB.

**See:** `docs/dev/unification_types_order_payment_audit.md`

---

## UI Quick Rules

- **web-admin UI:** Use **Cmx components only**. Import from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`, `@ui/patterns`. Do **not** use `@ui/compat` (removed).
- **Do NOT use raw `<button>`, `<input>`, `<select>`, `<form>`, `<dialog>`, `<table>`** in feature code — always use the Cmx wrapper.
- **Do NOT import from `@/components/ui` or `@ui/compat`** — ESLint will fail the build.
- Search existing message keys before adding new ones; reuse `common.*` keys for shared UI
- Run `npm run check:i18n` after translation changes
- Reports naming: `{feature-name}-{report-name}-rprt.tsx` (e.g. `orders-payments-print-rprt.tsx`)
- **React lint (mandatory):** `docs/dev/rules/react-lint-verification-checklist.md` · `react-effects-patterns.md` · `react-rhf-and-table-lint.md` — run `cd web-admin && npx eslint . --quiet` before done; no `form.watch()`, no `setState` in `useEffect`, internal links → `next/link`

---

## UI Component Rules (Inline — Always Apply)

> **Use Cmx design system components ONLY.** Never use raw HTML elements or shadcn/radix imports directly in feature code. When in doubt, check `web-admin/src/ui/` for the Cmx wrapper before using anything else.

### Mandatory Imports (copy exact lines)

```typescript
// ── Primitives ──────────────────────────────────────────────────
import { CmxButton } from '@ui/primitives'
import { CmxInput } from '@ui/primitives'
import { CmxTextarea } from '@ui/primitives'
import { CmxSelect } from '@ui/primitives'
import { CmxCheckbox } from '@ui/primitives'
import { CmxSwitch } from '@ui/primitives'
import { CmxSkeleton, CmxSkeletonTable } from '@ui/primitives'
import { CmxSpinner } from '@ui/primitives'
import { LoadingButton } from '@ui/primitives'
import { Label } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { Alert, AlertDescription } from '@ui/primitives'
import { Separator } from '@ui/primitives'
import { Tooltip } from '@ui/primitives'
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent, CmxCardFooter } from '@ui/primitives/cmx-card'

// ── Forms ────────────────────────────────────────────────────────
import { CmxForm, CmxFormField, CmxFormSection, CmxFormActions, CmxFormSkeleton, CmxFormStatusBanner } from '@ui/forms'
import { CmxFieldShell } from '@ui/forms'
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms'
import { CmxCheckboxGroup } from '@ui/forms'
import { CmxHexColorField } from '@ui/forms'

// ── Overlays ─────────────────────────────────────────────────────
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'

// ── Feedback ─────────────────────────────────────────────────────
import { CmxProgressBar } from '@ui/feedback'
import { CmxSummaryMessage } from '@ui/feedback'
import { CmxProgressIndicator } from '@ui/feedback'
import { CmxStatusBadge } from '@ui/feedback'
import { CmxConfirmDialog } from '@ui/feedback'

// ── Data Display ─────────────────────────────────────────────────
import { CmxDataTable } from '@ui/data-display'
import { CmxEmptyState } from '@ui/data-display'
import { CmxKpiStatCard } from '@ui/data-display'

// ── Navigation ───────────────────────────────────────────────────
import { CmxTabsPanel } from '@ui/navigation'
import { CmxPagination } from '@ui/navigation'
import { CmxProgressSteps } from '@ui/navigation'

// ── Page-level Patterns ──────────────────────────────────────────
import { CmxCrudPageShell } from '@ui/patterns'
import { CmxCardWithHeader } from '@ui/patterns'

// ── Toast (imperative) ───────────────────────────────────────────
import { showSuccessToast, showErrorToast, showInfoToast } from '@ui/components/cmx-toast'
```

### Banned Imports (ESLint will fail the build)

```typescript
❌ import { Button } from '@/components/ui/button'   // shadcn raw — use CmxButton
❌ import { Input } from '@/components/ui/input'     // shadcn raw — use CmxInput
❌ import anything from '@ui/compat'                 // removed
❌ import anything from '@/components/ui'            // does not exist
❌ <button>, <input>, <select>, <form>, <dialog>     // raw HTML in feature code — use Cmx wrapper
```

---

## Structure

One **shared Supabase instance** (same DB schema). Separate app/module folders.

```
supabase/     # Shared DB + RLS (PostgreSQL port 54322) ← migrations source of truth
web-admin/    # Next.js Admin (Active)
cmx-api/      # NestJS client API (Phase 2)
docs/         # All documentation
```

---

## Key Documentation

- **Efficiency Guide:** `docs/dev/claude-code-efficiency-guide.md` ⭐
- **Integration Contracts:** `docs/dev/rules/integration-contracts.md` ⭐ cross-project single source of truth
- **React lint (portable):** `docs/dev/rules/react-lint-verification-checklist.md` ⭐ pre-submit gate
- **React effects / Link:** `docs/dev/rules/react-effects-patterns.md`
- **React RHF / table / a11y:** `docs/dev/rules/react-rhf-and-table-lint.md`
- **UI Migration Guide:** `docs/dev/ui-migration-guide.md`
- **Master Plan:** `docs/plan/master_plan_cc_01.md`
- **Planning Backlog:** `docs/plan/` is the approved planning authority
- **Constants & types (unification):** `docs/dev/unification_types_order_payment_audit.md`
- **TODO completion docs:** `docs/dev/CompletePendingAndTODOCodes_13022026/`
- **Common Issues:** `.claude/skills/debugging/common-issues.md`
- **Settings Reference:** `.claude/docs/settings-reference.md`
- **Preferences (unified):** `docs/dev/preferences-architecture-reference.md` (canonical)

---

## Key Guardrails

- **Security:** RLS on all `org_*` tables, composite FKs, no hardcoded secrets
- **Performance:** Indexes, avoid N+1 queries, paginate results
- **Testing:** Cover business logic and tenant isolation
- **Validation:** Validate all inputs at system boundaries
- **Documentation:** For every feature — permissions, navigation tree, settings, feature flags, plan limits, i18n keys, API routes, migrations, constants/types, env vars

---

## Enforcement Summary

1. **Build-time:** ESLint `no-restricted-imports` forbids `@ui/compat` and `@/components/ui`. `npm run build` catches all violations.
2. **`web-admin/.clauderc`:** Authoritative import snippets for Cmx components — always use these exact lines.
3. **UI Component Rules above:** The complete list of allowed imports. If a component you need isn't listed, check `web-admin/src/ui/` — a Cmx wrapper likely exists.
4. **Explicit in your prompt:** When asking for UI changes, always say "Use Cmx components only, import from .clauderc".

---

## Supabase MCPs

- **NEVER apply db migrations via MCP or any way** — create the `.sql` file, then STOP and ask to review
- Local: `supabase_local MCP`
- Remote: `supabase_remote MCP`
- MCP allowed for **read-only discovery queries only** (e.g. finding affected objects before DROP CASCADE)
- **DROP ... CASCADE is BANNED by default** — use `DROP ... RESTRICT`. If CASCADE is unavoidable: STOP, get user confirmation, run discovery queries via MCP to produce the dependency manifest, then include recreate statements in the same migration. See `docs/dev/drop-cascade-migration-workflow.md`

# CleanMateX Repository Additional Rules

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
