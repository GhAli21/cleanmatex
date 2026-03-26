# Supabase PostgreSQL Rules

## Authority Note

Use this as supporting database guidance only.

- `CLAUDE.md`
- `supabase/README.md`
- current SQL migrations in `supabase/migrations/`

are higher authority when guidance conflicts.

## Current Repo Reality

- shared database authority lives in `supabase/`
- SQL migrations are the schema source of truth
- Prisma is secondary and local to `web-admin`
- `cmx-api` is NestJS plus Supabase, not Prisma-first

## Core Rules

1. Always enforce `tenant_org_id` on tenant-scoped data.
2. Use composite foreign keys for tenant isolation where appropriate.
3. Enable RLS on new `org_*` tables.
4. Use bilingual fields such as `name` and `name2` where user-facing data requires EN/AR support.
5. Prefer additive SQL migrations over destructive reset workflows.

## Migrations

- create new SQL migrations in `supabase/migrations/`
- follow the repo naming/version sequence already in use
- do not treat Prisma migrations as the primary schema workflow
- do not use reset commands unless the user explicitly approves

## Prisma Scope

Prisma may still be used inside `web-admin` for generated types and module-local server-side access, but that does not replace Supabase migration authority.

## Related Docs

- `../../CLAUDE.md`
- `../../supabase/README.md`
- `../docs/architecture.md`
