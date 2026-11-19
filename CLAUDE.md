# CLAUDE.md — CleanMateX Tenant App · F:\jhapp\cleanmatex

Multi-tenant laundry SaaS (GCC-first, EN/AR bilingual). This repo is the tenant app (`cleanmatex`) and owns **all DB migrations**. Sibling: HQ (the SaaS Backoffice) = `cleanmatexsaas` at `F:\jhapp\cleanmatexsaas`.

Less-frequent rules, role definition, inventories, skills catalog and doc index: **`docs/dev/rules/claude-md-reference.md`** — read it when the task touches those areas.

## ⛔ Load the skill before writing — no exceptions

| Writing... | Load first |
|---|---|
| SQL / migration / table / index / function | `/database` |
| Frontend / component / page / hook / JSX | `/frontend` |
| i18n key / translation | `/i18n` |
| API route / service / backend logic | `/backend` |
| Any `org_*` table query | `/multitenancy` |
| Order money: read, display, calculation | `/order-fin` |
| New feature | `/implementation` |
| Inline comment, JSDoc, SQL comment | `/code-documentation` |
| `.stories.tsx` / new Cmx component | `/storybook` |
| Navigation add/modify | `/navigation` |
| Files / photos / attachments on a screen (wire, change, unwire) | `/file-util-wire` |
| Dashboard route gating | `/refill-ui-access-contract-permissions` + `/rebuild-ui-access-contract` |
| RBAC role create/update | `/update-rbac-role` |
| New feature flag | `/create-feature-flag` |
| WF Check-policy issue catalog | Switch to HQ, load `/manage-wf-policy-issues-catalog`; never hand-edit tenant `docs/features/Workflow_Order_Advance/generated/` |

If you wrote code without the skill: stop, load it, verify, fix.

## Working style
- Plan first; wait for approval before editing. Return patch/diff, not long explanations.
- Work only on related files; don't scan the whole repo. Reuse existing patterns; no speculative refactors or unrelated formatting.
- Don't run the full test suite unless needed.
- Python: use `python` or `py` (`C:\Python314`), never `python3` (Windows Store stub).
- Final output: summary · files changed · validation results · risks/follow-ups.

## CRITICAL RULES
1. **Never** `supabase db reset`.
2. **Never modify existing migrations** — create a new one.
3. **Never apply migrations** (no MCP/CLI). Write the SQL file, then STOP for review.
4. **Every `org_*` query filters `tenant_org_id` explicitly in the query itself** — Prisma (incl. nested/include, updateMany/deleteMany), Supabase client, raw SQL, every joined `org_*` table, INSERT sets it, UPDATE/DELETE/INSERT…SELECT filter it. Never rely on RLS, the `$extends` guard, or a prior parent lookup. Fetch-by-id alone is a violation.
5. After frontend changes run `npm run build` until green; `npx eslint . --quiet` in web-admin.
6. Bilingual EN/AR + RTL mandatory; keep `messages/en/**` and `messages/ar/**` aligned; `npm run check:i18n`.
7. Navigation is dual-write: `web-admin/config/navigation.ts` + `sys_components_cd` migration (`/navigation`).
8. New permissions need a seeding migration. Format `resource:action` (`^[a-z0-9_]+:([a-z0-9_]+|\*)$|^\*:\*$`).
9. Constants mirror DB values exactly (case, separators, spelling). Check the DB first.
10. Dashboard gating golden path: `scaffold → derive --apply → wire --fix → check --wire → sync` (`:ui-access-contract`). Perms in `lib/constants/permissions/{domain}-perm.ts`; contracts in `src/features/*/access/*-access.ts` + `page-access-registry.ts`.
11. No silent money mutation — `docs/dev/rules/no-silent-money-mutation.md`.
12. User feedback via `cmxMessage` / `useMessage()` from `@ui/feedback` — `docs/dev/rules/cmx-message.md`. No `showSuccessToast`/raw `toast()`/`alert()`.
13. Shared Cmx components only (`src/ui/`, import via `@ui/*` per `web-admin/.clauderc`); extend the shared component rather than copy — `docs/dev/rules/cmx-shared-components.md`. Never `@ui/compat`.
14. "HQ" = the SaaS Backoffice (`cleanmatexsaas`), never a tenant's headquarters. Glossary: `docs/dev/i18n_docs/GLOSSARY.md`.
15. Settings (`sys_stng_*`) and feature flags (`sys_feature_flags_*`) are consumed via HQ API — never queried directly here. Cross-project: `docs/dev/rules/integration-contracts.md`.
16. Performance-relevant changes follow `docs/dev/rules/performance-engineering.md`.

## Database quick rules
- `sys_*` global, `org_*` tenant (RLS). Max 30 chars per object name. TEXT not VARCHAR. Money `DECIMAL(19,4)`.
- Migration name: list `supabase/migrations/` right before writing, take last+1: `{version}_{snake_case}.sql`.
- Comment every object + `COMMENT ON` (see `/code-documentation` sql-migration).
- `DROP … CASCADE` banned by default; use `RESTRICT` (`docs/dev/drop-cascade-migration-workflow.md`, ask first).
- Audit fields `created_at/_by/_info`, `updated_at/_by/_info`; bilingual `name/name2`; soft delete `is_active=false, rec_status=0`.
- No defaults for currency/country/city/timezone/locale columns.
- Prisma-safe composite FKs: child FK, 1:1 UNIQUE and parent key use the same column order; never `ON DELETE SET NULL` on a composite that includes `tenant_org_id`.
- New ERP Lite objects/identifiers carry `erplt` (`org_erplt_fin_acct_mst`, `erplt_fin:read`, `ERPLT_FIN_ENABLED`).
- Human-facing codes are DB-generated via `sys_doc_seq_type_cd` (`.claude/skills/database/conventions.md`).
- Public-key grants: new tables, sequences, and functions do not grant `anon` or `authenticated`. See **Public-key grants** in `.claude/skills/database/conventions.md`. `sys_*` / `hq_*` reads use `catalogReadClient`, not the user JWT.
- Feature flags need a migration (`hq_ff_feature_flags_mst`) + `lib/constants/feature-flags.ts` sync.
- Supabase MCP: read-only discovery only.

## Code quick rules
- TypeScript strict intent, no `any`, no hardcoded secrets.
- Constants in `lib/constants/` (one file per domain), types in `lib/types/`; no duplicates; Zod aligns with the constants.
- Thin routes; logic in services/use-cases; don't mix orders with workflow.
- Feature docs live in `docs/features/<Feature>/` (permissions, nav, settings, flags, plan limits, i18n keys, routes, migrations, env vars).

## Commands
```bash
.\scripts\dev\start-services.ps1   # all services
cd web-admin; npm run dev          # web admin
npm run build
```
