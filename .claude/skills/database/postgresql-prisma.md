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

Use `npm run prisma:pull` (not raw `prisma db pull`). That command runs `db pull`, then `scripts/prisma-patch-after-pull.mjs` (restores `@ignore` on `cmx_effective_permissions[]` and any 1:1 unique-order safety net), then `prisma validate`.

Raw `npx prisma db pull` still strips `@ignore` and will fail the next pull until you run `npm run prisma:patch-after-pull`.

Mass `onDelete: SetNull` warnings are not P1012.

**Order reminder:** if the parent key is `(id, tenant_org_id)`, the child FK and 1:1 unique are `(parent_id, tenant_org_id)` (tenant **second**). That is what `0553` does. Do not flip those uniques to tenant-first unless you also rebuild the FK and the referenced key.

## Multi-Tenancy

- every `org_*` query must respect `tenant_org_id`
- use RLS and composite keys where appropriate
- implementation details may differ between `web-admin` and `cmx-api`

## Related Docs

- `SKILL.md`
- `../../docs/postgresql-rules.md`
- `../../../supabase/README.md`
