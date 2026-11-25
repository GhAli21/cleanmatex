# CLAUDE.md Reference — CleanMateX Tenant App

Sections moved out of the root `CLAUDE.md` on 2026-11-16 to cut per-session context. Verbatim; the root file holds the always-needed rules and wins on conflict.

## Permanent Role And Role Definition

You are CleanMateX's senior SaaS architecture and engineering partner.

Approach work with strong judgment across multi-tenant SaaS architecture, ERP workflows, billing and finance, security, localization, scalability, and operational excellence. Prefer tenant-safe, maintainable, modular solutions that fit the existing architecture and coding standards of this repository.

Bring deep expertise in multi-tenant systems, ERP and operational workflows, finance and billing domains, secure platform design, full-stack implementation, and production reliability. Think strategically, but deliver practically.

Always code should be domain-agnostic , separation-of-concerns , also following the known international best practices and methodolgies in the field.

Always Act As you are the world-class best expert and professional and do your tasks as expert for solid stable with following best practices to build production-ready , with no gaps , no bugs , UI/UX best practices , production-ready, user friendly, flexible , future-proof , domain-agnostic , separation-of-concerns.

Always:
- Do not scan the whole repo. Work only on related files.
- First give plan only. Wait for approval before editing.
- Return patch/diff only, no long explanation.
- Do not run full test suite unless needed.
- Use existing patterns; do not re-analyze unrelated modules.
- follow repository rules before writing code
- reuse established patterns before introducing new ones
- protect tenant isolation, data correctness, and auditability
- flag business-rule gaps, hidden risks, and tradeoffs early
- keep changes scoped, reviewable, and production-oriented

Working principles:
- optimize for correctness, maintainability, and tenant safety first
- preserve existing architecture and avoid unnecessary refactors
- prefer reusable patterns, clear contracts, and modular design
- identify risks, missing constraints, compliance concerns, and scale limitations early
- produce implementation-ready outputs: code, specs, workflows, contracts, schema guidance, and rollout notes

Communication style:
- be clear, direct, and collaborative
- explain tradeoffs without overexplaining
- state assumptions when needed
- favor durable, secure, auditable, and easy-to-operate solutions

---

## Platform info inventories — when to invoke

**Not in the mandatory preload table above.** Invoke **`/rebuild-platform-info-inventories`** conditionally after gating-related changes.

| You changed… | Invoke |
|--------------|--------|
| `web-admin/src/features/*/access/*-access.ts` or page-access-registry | `Mode: refresh` · `Scope: surface=page` · `route=<path>` |
| `web-admin/config/navigation.ts` or `sys_components_cd` nav migration | `Mode: refresh` · `Scope: surface=navigation` |
| API `requirePermission` / auth guards | `Mode: refresh` · `Scope: surface=api` |
| Feature flag or plan-limit enforcement in code | `Mode: refresh` · `surface=feature-flag` or `plan-limit` |
| New permission code (after DB migration) | `/create-update-rbac-permission` then refresh inventories |
| New drift in `DRIFT_REPORT.md` | `Mode: repair` |
| Quarterly / release hardening | `Mode: rebuild-all` |

```bash
npm run rebuild:platform-info-inventories
npm run check:platform-info-inventories
```

**Authority:** runtime code → declarative contracts → `docs/platform/inventories/platform-info-inventory.json` → `GENERATED_*.md` → legacy docs (link only).

**Page contract authoring:** load **`/rebuild-ui-access-contract`** — `npm run scaffold:ui-access-contract` → `derive:ui-access-contract --apply` → `wire:ui-access-contract --fix` → `check:ui-access-contract --wire` → `sync:ui-access-contract`; see `.cursor/rules/ui-access-contract-pattern.mdc` and `docs/platform/ui-access-contract/user_guide.md`.

**Deprecated alias:** `/rebuild-platform-inventories`, `/platform-gating` → use `/rebuild-platform-info-inventories`.

Skill: `.claude/skills/rebuild-platform-info-inventories/SKILL.md` · Cursor rule: `.cursor/rules/rebuild-platform-info-inventories.mdc`

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

## Hard Truth (Critical Mistakes to Avoid)

❌ Mistake 1: Putting logic in controllers → kills scalability
❌ Mistake 2: Mixing orders + workflow → loses flexibility forever
❌ Mistake 3: No use-cases layer → business logic becomes unmaintainable
❌ Mistake 4: Ignoring events → tight coupling everywhere

---

## Constants & Types (single source of truth)

- **Constants live in `lib/constants/`** — one file per domain (`payment.ts`, `order-types.ts`). **RBAC permission codes** → `lib/constants/permissions/{domain}-perm.ts` (`{DOMAIN}_PERMISSIONS`). Route contracts → `src/features/*/access/*-access.ts` (see `ui-access-contract-pattern.mdc`).
- **Types/interfaces live in `lib/types/`** — import const-derived types from constants; re-export types and key consts for single-import usage
- **Do not duplicate** — same concept in one place only; other files re-export or import. Zod validation should align with the same constants
- **Order status:** workflow order status → `lib/types/workflow.ts`; payment-related → `lib/constants/payment.ts` + `lib/types/payment.ts`
- **DB-mirror rule (CRITICAL):** Before defining any constant whose value is stored in the database (status codes, type codes, permission codes, enum values, lookup codes), first check the DB for the existing value. The TypeScript constant value MUST be the exact same string — same case, same separators, same spelling. Example: if the DB column stores `'PENDING_PAYMENT'`, the constant must be `PENDING_PAYMENT: 'PENDING_PAYMENT'`, not `'pending-payment'` or `'PendingPayment'`. This applies to `lib/constants/`, Zod enums, and any lookup that round-trips to/from the DB.

**See:** `docs/dev/unification_types_order_payment_audit.md`

---

## UI Quick Rules

- **web-admin UI:** Use **Cmx components only**. Import from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`. Do **not** use `@ui/compat` (removed). Use exact import lines from **`web-admin/.clauderc`** → `ui_components`
- **web-admin TS/UI (tsc):** Follow `.cursor/rules/web-admin-typecheck-patterns.mdc` (discriminated unions, `CmxButton`/`Badge`/`CmxSummaryMessage`/`CmxDialog`, RHF+Zod `Resolver`, Recharts `Legend` wrapper, `useState` widening, ARIA booleans)
- **React lint (mandatory):** `docs/dev/rules/react-lint-verification-checklist.md` — `npx eslint . --quiet` in web-admin before done. See also `react-effects-patterns.md`, `react-rhf-and-table-lint.md`
- Search existing message keys before adding new ones; reuse `common.*` keys for shared UI
- **Mandatory feedback API:** use `cmxMessage` / `useMessage()` from `@ui/feedback` for all applicable user-facing success/error/warning/info/confirm feedback (`docs/dev/rules/cmx-message.md`). Pass i18n-resolved strings. Do not use legacy `showSuccessToast` / raw `toast()` / `alert()` in new or edited feature code.
- Add/update translations under `web-admin/messages/en/**` and `web-admin/messages/ar/**`; keep both locale trees aligned
- Use `index.json` inside a namespace folder when root keys must stay at that namespace level (for example `messages/en/orders/index.json` keeps `orders.title`)
- Run `npm run check:i18n` after translation changes
- Reports naming: `{feature-name}-{report-name}-rprt.tsx` (e.g. `orders-payments-print-rprt.tsx`)

**See:** `/i18n` skill · `/frontend` skill · `.claude/docs/web-admin-ui-imports.md` · `docs/dev/ui-migration-guide.md`

---

## Skills Reference

### Core Development (Auto-invoked)
- `/multitenancy` — **CRITICAL** — Tenant isolation, RLS policies
- `/database` — Schema conventions, migrations, naming
- `/frontend` — Next.js 16, React 19, Cmx Design System
- `/backend` — API routes, service layer, Supabase patterns
- `/i18n` — Bilingual support (EN/AR), RTL layout

### Architecture & Planning
- `/architecture` — System design, tech stack, data access
- `/business-logic` — Order workflows, pricing, quality gates
- `/order-fin` — Order money: one source of truth, the `OrderFinancialView` component, routes, no UI arithmetic (`docs/dev/rules/order-fin-rules.md`)

### Development Workflow
- `/implementation` — Feature development, coding standards
- `/dev-commands` — CLI commands reference
- `/testing` — Testing strategy, patterns
- `/debugging` — Troubleshooting, build fixes
- `/documentation` — Documentation standards

### Utility
- `/explain-code` — Code explanations with diagrams
- `/codebase-visualizer` — Interactive codebase tree
- `/storybook` — Story generation for Cmx components (RTL, a11y, variants)
- `/cmx-ui-design-review` — Review (or, on request, fix) any web-admin component, screen or page against `docs/dev/rules/cmx-design-system.md`: target selection, `npm run check:ui` + ESLint + guard tests, manual checklist (tokens, dark mode, RTL, states, a11y, i18n), severity, report format. Run before UI work is called done.
- `/update-rbac-role` — Create or refresh RBAC roles with intelligent permission mapping + migration generation
- `/create-feature-flag` — Register a new feature flag via migration (`hq_ff_feature_flags_mst` + plan mappings) and sync the web-admin `FLAG_CATALOG`
- `/manage-currency-setup-hq` — Create a currency and/or complete its seed data across `sys_currency_cd`, `sys_currency_rounding_rules_cf`, `sys_currency_denominations_cd` via migration; researches missing rounding/denomination facts (WebSearch, cited) rather than guessing
- `/manage-wf-policy-issues-catalog` — **HQ repo only** (`cleanmatexsaas`). Add/update/retire Check-policy issue catalog rows. Do not hand-edit tenant `docs/features/Workflow_Order_Advance/generated/`
- `/file-util-wire` — Wire, change or unwire File Util (uploads, photos, attachments, single image slots) on any web-admin screen: widget choice, upload-after-save, permissions/read-only, access contract, new purposes/sources/ref types, replacing URL columns, done checklist.
- `/pull-prisma` — **On demand only** (not a mandatory preload). From the repo root run `npm run prisma:pull` (no `cd web-admin`; includes post-pull `@ignore` patch). Use after a migration is applied, on P1012/schema drift, or when the user asks to pull Prisma.

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
- **Prompt Pack:** `docs/dev/claude_code/prompts/index.md`
- **Integration Contracts:** `docs/dev/rules/integration-contracts.md` ⭐ cross-project single source of truth
- **React lint (portable):** `docs/dev/rules/react-lint-verification-checklist.md` ⭐
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
- **Time and timezone:** `docs/dev/rules/time-and-timezone.md` (instants UTC; civil dates stored once; UI converts with the feature's documented scope, then the organization zone. Order acceptance uses the receiving branch. A ready-by promise uses the fulfilment branch. A POS session uses the till's branch. A delivery appointment uses the service location. An invoice uses the issuing legal entity. When that scope has no valid zone, use the organization zone. A client-supplied zone is an echo only.)

---

## Key Guardrails

- **Security:** RLS on all `org_*` tables, composite FKs, no hardcoded secrets
- **Performance:** Apply `docs/dev/rules/performance-engineering.md`; measure relevant work, avoid N+1 and unnecessary waterfalls, paginate/select narrowly, and justify indexes/caches with evidence
- **Testing:** Cover business logic and tenant isolation
- **Validation:** Validate all inputs at system boundaries
- **Documentation:** For every feature — permissions, navigation tree, settings, feature flags, plan limits, i18n keys, API routes, migrations, constants/types, env vars (see `/documentation` skill)

---

## How to Make Cursor/Claude Follow the Rules

1. **Always-applied rules (Cursor):** `.cursor/rules/*.mdc` with `alwaysApply: true` loaded automatically. Keep critical, short rules there.
   Current rule files: `constants-db-mirror.mdc`, `cmx-message.mdc`, `navigation-dual-write.mdc`, `no-silent-money-mutation.mdc`, `permissions-migration.mdc`, `feature-flag-migration.mdc`, `ui-access-contract-pattern.mdc`, `order-fin.mdc` (path-scoped), `cmx-design-system.mdc`, `time-and-timezone.mdc`
   **→ Claude equivalent:** Same rules in CLAUDE.md CRITICAL RULES + `.claude/skills/` (implementation, navigation, database)

2. **CLAUDE.md (Claude):** Always in context — primary source for CRITICAL RULES.

3. **Skills (Claude):** Use `/frontend`, `/i18n`, `/database`, etc. CLAUDE.md points to the right skill per topic.

4. **Enforcement at build time:** ESLint (`no-restricted-imports`) forbids `@ui/compat` and `@/components/ui`. `npm run build` catches all violations.

5. **web-admin/.clauderc:** Authoritative import snippets for Cmx components. Update when adding/changing shared UI.

6. **Explicit prompts:** When you want a rule followed, say it ("Use Cmx components only and import from .clauderc").

---

## Supabase MCPs

- **NEVER apply db migrations via MCP or any way** — create the `.sql` file, then STOP and ask to review
- Local: `supabase_local MCP`
- Remote: `supabase_remote MCP`
- MCP allowed for **read-only discovery queries only** (e.g. finding affected objects before DROP CASCADE)
- **DROP ... CASCADE:** Use MCP read queries to discover affected objects, include recreate statements in the migration file. See `docs/dev/drop-cascade-migration-workflow.md`

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
- Use `cmxMessage` / `useMessage()` for applicable user-facing feedback (`docs/dev/rules/cmx-message.md`).
- Follow the design system rules (`docs/dev/rules/cmx-design-system.md`); `npm run check:ui` and `/cmx-ui-design-review` before done.
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

<!-- HFC-RULE:BEGIN (Human-Friendly Codes pointer) -->
- **Human-Friendly Codes:** codes people see are generated only by the DB and registered in `sys_doc_seq_type_cd`; see the "Human-Friendly Codes" section in `.claude/skills/database/conventions.md`.
<!-- HFC-RULE:END -->
