# pull-prisma

**On demand only** (not a mandatory preload). Use when the agent needs a current Prisma schema after a migration was applied, on P1012/schema drift, or when the user asks to pull/sync Prisma.

1. Load `.cursor/skills/pull-prisma/SKILL.md` (same text in `.claude/skills/pull-prisma/SKILL.md`).
2. From the **repo root** run `npm run prisma:pull`. Do not `cd web-admin`.
3. That command is `prisma db pull` + `prisma-patch-after-pull.mjs` + `prisma validate`.
4. Do not run raw `npx prisma db pull`. Do not apply database migrations.
5. The patch restores `cmx_effective_permissions` ignore markers and known 1:1 unique order. If validate still fails after that: STOP. Report the errors. Do not rerun in a loop. Do not flip packing/assembly `?` to `[]`.

This command is available in chat with /pull-prisma.
