---
name: pull-prisma
description: Sync web-admin Prisma from local Postgres (db pull + post-pull @ignore/1:1 unique patch + validate). Use when the agent needs a current Prisma schema after a migration was applied, after P1012/schema drift, or when the user asks to pull/sync Prisma. Not a mandatory preload. Run from the repo root — no cd into web-admin.
---

# Pull Prisma

When this skill is needed, run from the **repo root** and wait for it to finish:

```powershell
cd F:\jhapp\cleanmatex
npm run prisma:pull
```

Do not `cd web-admin`. The root script already calls the `web-admin` workspace (`prisma db pull` + `prisma-patch-after-pull.mjs` + `prisma validate`).

Do not run raw `npx prisma db pull`. Do not apply database migrations.

The patch already restores `@@ignore` / relation `@ignore` for `cmx_effective_permissions`, unique-order for `uq_ofba_acct` / `uq_ofps_log`, and the funding 1:1 unique only when `uq_svft_vch_line_tenant` is missing.

If `npm run prisma:pull` still fails after the patch: **STOP**. Print the validate errors to the user. Do not rerun pull in a loop. Do not flip packing/assembly `?` to `[]`. Do not make `tenant_org_id` optional. Next step is a human decision (extend the patch script for a new ignored object, or a new SQL migration for a new 1:1 unique-order mismatch).

After a successful pull, stop unless generate is also required (`npm run web-admin:prisma:generate` from the repo root).
