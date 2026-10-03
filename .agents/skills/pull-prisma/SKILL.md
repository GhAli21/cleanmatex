---
name: pull-prisma
description: Sync web-admin Prisma from local Postgres (db pull + post-pull @ignore/1:1 unique patch + validate). Use when the agent needs a current Prisma schema after a migration was applied, after P1012/schema drift, or when the user asks to pull/sync Prisma. Not a mandatory preload. Run from the repo root — no cd into web-admin.
user-invocable: true
---

# Pull Prisma

When this skill is needed, run from the **repo root** and wait for it to finish:

```powershell
cd F:\jhapp\cleanmatex
npm run prisma:pull
```

Do not `cd web-admin`. The root script already calls the `web-admin` workspace. Do not run raw `npx prisma db pull`. Do not apply database migrations.

The patch restores `cmx_effective_permissions` ignore markers and known 1:1 unique order. If pull still fails after the patch: STOP. Report the validate errors. Do not rerun in a loop. Do not flip packing/assembly `?` to `[]`.
