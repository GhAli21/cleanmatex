---
name: database
description: database workflow for CleanMateX Tenant App. Use only when explicitly working on database-related tasks.
user-invocable: true
version: 1.1.0
deprecated: false
effort: medium
references:
  - @.claude/skills/database/reference-original.md
  - CLAUDE.md
agents:
---

# Database Skill

## Mandatory Migration Object Documentation

**Document every database object in migration files** — add concise English comments explaining purpose and important invariants for every object created, altered, or removed, including all columns (standard audit/identity columns too), tables, constraints/FKs, indexes, functions/procedures, triggers, views, sequences, types, schemas and RLS policies. Include PostgreSQL `COMMENT ON` metadata for every created/altered object that supports it; explain grants/revokes and removal intent beside their statements. See the `code-documentation/sql-migration.md` skill. Never rewrite historical/applied migrations to retrofit comments; deployed catalog-comment changes need a new forward migration. Fully document new unapplied drafts before first application; explicitly authorized documentation passes may complete those drafts.

## Purpose

Use this skill only when the task explicitly matches **database**. Keep the active prompt small; read `reference-original.md` only when deeper examples or edge cases are required.

## Operating Rules

- Do not use subagents unless explicitly requested.
- Do not scan the whole repo.
- Search only relevant folders/files.
- Read only required files, functions, or line ranges.
- Before editing, list exact files to touch.
- Modify only files required by the task.
- Preserve CleanMateX Tenant App rules from `CLAUDE.md`.
- Keep output concise.

## Multi-Currency Transaction Standard (base == functional)

Normal monetary transaction:
- `currency_code TEXT NOT NULL` (FK → `sys_currency_cd(code)`, no default)
- `amount DECIMAL(19,4) NOT NULL`

If base-currency valuation is required, also add:
- `base_currency_code TEXT NOT NULL` (FK → `sys_currency_cd(code)`, no default)
- `base_amount DECIMAL(19,4) NOT NULL`
- `fx_rate DECIMAL(22,10) NULL`
- `fx_rate_date DATE NULL`
- `fx_rate_source TEXT NULL`
- `fx_rate_id UUID NULL`

Rules:
- FX direction always: `base_amount = amount × fx_rate`.
- If `currency_code = base_currency_code` → `base_amount = amount`; `fx_rate`, `fx_rate_date`, `fx_rate_source`, `fx_rate_id` = `NULL`.
- Never `FLOAT`/`REAL`/`DOUBLE` for money or FX.
- Currency codes are `TEXT` and must FK to `sys_currency_cd(code)`.

Full detail + CHECK constraint template: `reference-original.md` → "Multi-Currency Transaction Standard".

## Prisma-safe composite FKs (MUST — write-time)

**Invariant:** FK columns + 1:1 UNIQUE + referenced parent key = **same columns, same order**.
Postgres treats `(a,b)` and `(b,a)` as the same unique. Prisma 6 does not (`db pull` → P1012).

| Parent key already in DB | Child FK and 1:1 UNIQUE must be | Tenant position |
|---|---|---|
| `(id, tenant_org_id)` | `(parent_id, tenant_org_id)` | **second** — this is `0553` |
| `(tenant_org_id, id)` | `(tenant_org_id, parent_id)` | first |

**MUST**
- Look up the parent unique/PK **before** writing the child FK. Copy that order. Do not invent a new order.
- If the child is 1:1, add a UNIQUE on the **full** FK column list in that same order (a unique on `parent_id` alone is not enough for Prisma).
- List indexes stay tenant-first: `idx_*(tenant_org_id, …)`. Index order ≠ Prisma 1:1 unique/FK order.

**MUST NOT**
- `UNIQUE (tenant_org_id, parent_id)` + `FOREIGN KEY (parent_id, tenant_org_id)` (order mismatch → P1012).
- Flip an existing FK to tenant-first just to match index style. Either match the FK, or rebuild FK + unique + referenced key together.
- `ON DELETE SET NULL` on a composite FK that includes required `tenant_org_id`. Use `RESTRICT` / `NO ACTION` / `CASCADE`. Optional detach: PG 15+ `ON DELETE SET NULL (branch_id)` only.
- “Fix” P1012 by changing `org_asm_tasks_mst` / `org_pck_packing_lists_mst` on `org_orders_mst` from `?` to `[]`. Those are real 1:1s.
- Make `tenant_org_id` optional to silence Prisma `SetNull` warnings.

**After `db pull`:** re-add `@ignore` on `cmx_effective_permissions[]` back-relations (`users`, `org_tenants_mst`). Mass `onDelete: SetNull` warnings are not P1012.

Details + SQL: `reference-original.md` → "Composite Foreign Keys".

## Workflow

```text
1. Confirm scope and affected domain.
2. Read the minimum required files.
3. Apply this skill's domain rules.
4. Make scoped changes only.
5. Run relevant validation.
6. Report files changed, validation results, and risks.
```

## Detailed Reference

Original full skill content is preserved in:

```text
reference-original.md
```

Read it only when the task requires detailed examples/templates.

## Platform info inventories (conditional)

After permission seed migrations or feature-flag catalog changes:

1. Load **`/rebuild-platform-info-inventories`** — `Mode: refresh` · `Scope: surface=permission` or `feature-flag`
2. Run `npm run rebuild:platform-info-inventories`

## Final Response Contract

```text
- Summary
- Files changed
- Validation result
- Risks / follow-ups
```
