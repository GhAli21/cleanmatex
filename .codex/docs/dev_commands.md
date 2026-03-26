# Development Commands

## Authority Note

Use this as a helper summary. Confirm commands against:

- `README.md`
- `web-admin/package.json`
- `cmx-api/package.json`
- `supabase/README.md`

## Root Helpers

```powershell
.\scripts\dev\start-services.ps1
.\scripts\dev\status-services.ps1
.\scripts\dev\stop-services.ps1
```

## Web Admin

```bash
cd web-admin
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## Prisma Inside Web Admin

```bash
cd web-admin
npm run prisma:pull
npm run prisma:generate
npm run prisma:studio
```

## cmx-api

```bash
cd cmx-api
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Supabase

```bash
supabase start
supabase stop
supabase status
supabase migration new descriptive_name
```

Do not recommend `supabase db reset` unless the user explicitly approves running a reset workflow.

## Rule

- prefer safe additive workflows
- do not default to destructive reset commands
- do not present Prisma migrate commands as the primary schema workflow
