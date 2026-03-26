# Database Guidance

## Authority Note

This file is a helper reference, not the schema authority.

Use these first:

1. `CLAUDE.md`
2. `supabase/README.md`
3. current files in `supabase/migrations/`

## Current Rules

- Supabase SQL migrations are authoritative
- Prisma is optional and local to `web-admin`
- do not assume a repo-wide Prisma migration workflow
- do not recommend reset-heavy commands unless the user explicitly asks

## Practical Workflow

1. create or edit SQL migration files under `supabase/migrations/`
2. apply them using the approved local database workflow
3. if `web-admin` Prisma needs syncing, run:

```bash
cd web-admin
npm run prisma:pull
npm run prisma:generate
```

## Multi-Tenancy

- every `org_*` query must respect `tenant_org_id`
- use RLS and composite keys where appropriate
- implementation details may differ between `web-admin` and `cmx-api`

## Related Docs

- `SKILL.md`
- `../../docs/postgresql-rules.md`
- `../../../supabase/README.md`
