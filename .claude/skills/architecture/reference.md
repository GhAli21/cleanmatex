# Architecture Reference

## Authority Order

Prefer these sources when describing system architecture:

1. `CLAUDE.md`
2. `README.md`
3. `web-admin/README.md`
4. `cmx-api/README.md`
5. `supabase/README.md`
6. `docs/plan/master_plan_cc_01.md`

## Current Repo Reality

- `web-admin` is active and on Next.js 16 plus React 19
- `cmx-api` exists and is active as NestJS plus Supabase
- `supabase/` owns migrations and shared database structure
- Prisma is not the universal backend architecture for the repo

## Architecture Summary

- system tables: `sys_*`
- tenant tables: `org_*`
- tenant isolation: `tenant_org_id`, composite keys, RLS
- bilingual platform: EN and AR with RTL support
- supporting local infra: Redis and MinIO as needed

## Notes

This file is intentionally short so it does not drift away from the module READMEs and approved planning docs.
