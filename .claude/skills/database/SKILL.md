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
