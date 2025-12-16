# Claude Code - Continue Development Prompt
**Date**: 2025-10-10
**Session**: MVP Phase 1 - Authentication & Tenant Management
**Status**: Ready to start implementation

---

## Quick Start Prompt

```
I'm ready to start building CleanMateX. Please begin implementation following the development plans in docs/plan/.

Start with PRD-001 (Authentication & Authorization).

Key context:
- Database: PostgreSQL via Supabase (local dev setup ready)
- Credentials: cmx_user / cmx_pass_dev / cmx_db
- Frontend: Next.js 15 in web-admin/
- All plans are in docs/plan/
- Follow CLAUDE.md and related .md files for architecture patterns

Please implement PRD-001 step by step, starting with:
1. Review the PRD at docs/plan/001_auth_dev_prd.md
2. Create the necessary database migrations
3. Implement RLS policies
4. Build the backend API endpoints
5. Create the frontend authentication UI
6. Add tests

Show me your implementation plan before starting, and let me approve it.
```

---

## Alternative: Continue Specific PRD

If you want to continue from a specific PRD:

```
I want to implement [PRD-XXX: Feature Name] from docs/plan/XXX_feature_dev_prd.md.

Prerequisites completed:
- [List any dependent PRDs that are done]

Please:
1. Read the PRD at docs/plan/XXX_feature_dev_prd.md
2. Show me a step-by-step implementation plan
3. Wait for my approval
4. Then implement each step with tests

Context:
- Database: Supabase local (cmx_user/cmx_db)
- Frontend: Next.js 15 in web-admin/
- Follow multi-tenant patterns from CLAUDE.md
```

---

## Alternative: Resume In-Progress Work

If you're continuing work that was partially completed:

```
I need to continue work on [Feature Name].

What's been completed:
- [List completed items]

What's remaining:
- [List remaining items]

Please:
1. Review the current state of the codebase
2. Check what's implemented vs what's in the PRD (docs/plan/XXX_feature_dev_prd.md)
3. Show me a plan to complete the remaining work
4. Implement step by step after I approve

Current issues/blockers:
- [List any issues you encountered]
```

---

## Full MVP Implementation Prompt

For implementing the entire MVP in sequence:

```
I'm ready to implement the full MVP phase of CleanMateX.

Please work through all 7 PRDs in sequence:
1. PRD-001: Authentication & Authorization
2. PRD-002: Tenant Management
3. PRD-003: Customer Management
4. PRD-004: Order Intake
5. PRD-005: Basic Workflow
6. PRD-006: Digital Receipts
7. PRD-007: Admin Dashboard

For each PRD:
- Read the plan from docs/plan/
- Show implementation plan
- Wait for approval
- Implement with tests
- Mark as complete before moving to next

Start with PRD-001. Show me your plan for it first.

Context:
- All plans in docs/plan/
- Architecture patterns in CLAUDE.md
- Database: Supabase local (cmx_user/cmx_db)
- Frontend: Next.js 15 in web-admin/
- Multi-tenant with RLS enforcement
```

---

## Important Context for Any Continuation

### Project Structure
- **Plans**: `docs/plan/` (master_plan_cc_01.md + individual PRDs)
- **Architecture Guide**: `CLAUDE.md` (multi-tenant patterns, conventions)
- **Requirements**: `docs/Req. Spec/clean_mate_x_unified_requirements_pack_v_0.12.1.md`
- **Database Schema**: `supabase/migrations/0001_core.sql`
- **Docker Setup**: `docker-compose.yml` (cmx-postgres, cmx-redis, cmx-minio)

### Critical Patterns to Follow
1. **Multi-tenancy**: Always filter by `tenant_org_id` in queries
2. **Composite FKs**: Use `(tenant_org_id, customer_id)` pattern
3. **Bilingual**: `name` / `name2` for EN/AR
4. **Audit fields**: `created_at/by/info`, `updated_at/by/info`
5. **RLS policies**: Every `org_*` table needs RLS
6. **Feature flags**: Stored in `org_tenants_mst` or separate table

### Database Credentials (Local Dev)
- User: `cmx_user`
- Password: `cmx_pass_dev`
- Database: `cmx_db`
- Network: `cmx-network`

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Backend**: NestJS (planned), currently using Supabase API
- **Database**: PostgreSQL 16 via Supabase (local)
- **Auth**: Supabase Auth with RLS
- **Cache/Queue**: Redis
- **Storage**: MinIO (S3-compatible)

### Before Starting Implementation
1. Verify Supabase is running: `supabase status`
2. Check Docker services: `docker-compose ps`
3. Review the specific PRD in `docs/plan/`
4. Check dependencies are complete
5. Create a feature branch: `git checkout -b feature/PRD-XXX-description`

### Development Workflow
1. **Database First**: Create migrations in `supabase/migrations/`
2. **RLS Policies**: Add policies in same migration or `*_rls.sql`
3. **Backend**: API endpoints (NestJS or Supabase Edge Functions)
4. **Frontend**: Next.js pages/components in `web-admin/`
5. **Tests**: Unit + integration + E2E
6. **Documentation**: Update relevant docs

### Common Commands
```bash
# Supabase
cd supabase
supabase start
supabase db reset
supabase migration new <name>
supabase db push

# Web Admin
cd web-admin
npm run dev
npm run build
npm run lint

# Docker
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Success Criteria Checklist
For each PRD, ensure:
- [ ] Database migrations created and applied
- [ ] RLS policies implemented and tested
- [ ] API endpoints created with OpenAPI docs
- [ ] Frontend UI implemented (EN/AR)
- [ ] Unit tests written (80% coverage target)
- [ ] Integration tests for critical paths
- [ ] E2E test for happy path
- [ ] All acceptance criteria checked
- [ ] Code reviewed and linted
- [ ] Documentation updated

---

## Tips for Claude Code

1. **Read First**: Always read the PRD completely before planning
2. **Plan Then Code**: Show implementation plan, wait for approval
3. **Step by Step**: Implement one section at a time, test as you go
4. **Multi-tenant**: Never forget `tenant_org_id` filtering
5. **Bilingual**: All customer-facing text needs EN + AR
6. **Test Coverage**: Write tests alongside implementation
7. **Ask Questions**: If anything is unclear in the PRD, ask before implementing
8. **Reference Docs**: Check CLAUDE.md for patterns, requirements doc for details

---

## Quick Reference Links

- **Master Plan**: `docs/plan/master_plan_cc_01.md`
- **Architecture**: `CLAUDE.md`
- **Requirements**: `docs/Req. Spec/clean_mate_x_unified_requirements_pack_v_0.12.1.md`
- **Database Schema**: `supabase/migrations/0001_core.sql`
- **PRD Index**: `docs/plan/README.md`

---

## Example Session Flow

1. **You provide prompt** (one of the options above)
2. **Claude reads the PRD** and current codebase state
3. **Claude shows implementation plan** broken into steps
4. **You approve** (or request changes)
5. **Claude implements step 1** with code + tests
6. **You verify** it works
7. **Claude implements step 2**, etc.
8. **Claude marks PRD complete** when all acceptance criteria met
9. **Repeat for next PRD**

---

## Status Tracking

Use this to track your progress:

### MVP Phase Status
- [ ] PRD-001: Authentication & Authorization
- [ ] PRD-002: Tenant Management
- [ ] PRD-003: Customer Management
- [ ] PRD-004: Order Intake
- [ ] PRD-005: Basic Workflow
- [ ] PRD-006: Digital Receipts
- [ ] PRD-007: Admin Dashboard

Update this file as you complete each PRD.

---

**Ready to start? Copy one of the prompts above and paste it to begin implementation!**
