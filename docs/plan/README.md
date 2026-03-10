# CleanMateX Development Planning Documents

This directory is the approved planning authority for CleanMateX.

Useful planning material from `docs/plan_cr/` should be reconciled into this directory over time, and `docs/plan_cr/` should no longer be treated as a peer planning authority.

## Directory Contents

### Master Plan
- **[master_plan_cc_01.md](./master_plan_cc_01.md)** - Comprehensive master development plan covering all 10 phases, technical architecture, feature flags, testing strategy, and implementation roadmap for all 48 PRDs.

### Planning Corpus Note

Some older planning references listed here historically pointed to PRD files that are no longer present in this directory. During the current documentation refresh:

- use `master_plan_cc_01.md` as the primary planning entrypoint
- reconcile still-useful PRDs from `docs/plan_cr/` into `docs/plan/`
- avoid treating missing or stale plan references as active authoritative docs

## Document Structure

Each PRD follows a consistent structure:

- **Overview**: Brief description and business value
- **Requirements**: Functional and non-functional requirements
- **Database Schema**: Tables, indexes, and migrations
- **API Endpoints**: REST endpoints with request/response examples
- **UI/UX Requirements**: Screen designs and user flows
- **Technical Implementation**: Backend, frontend, and database tasks
- **Acceptance Criteria**: Testable success conditions
- **Testing Requirements**: Unit, integration, and E2E tests
- **Deployment Notes**: Environment variables, migrations, setup steps
- **References**: Links to requirements and related PRDs

## Key Project Information

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript, Supabase-based backend patterns
- **Database**: PostgreSQL 16 with RLS
- **Mobile**: Flutter (iOS/Android)
- **Infra**: Docker, Redis, MinIO

### Database Pattern
- **System Tables**: `sys_*` (global, shared)
- **Organization Tables**: `org_*` (tenant-specific)
- **Composite FK Pattern**: All tenant data uses `(tenant_org_id, record_id)`
- **Bilingual**: `name` (EN) / `name2` (AR) column pattern
- **RLS**: All `org_*` tables filtered by `tenant_org_id`

### Docker Credentials
- Database: `cmx_user` / `cmx_pass_dev` / `cmx_db`
- Port: `5432` (PostgreSQL), `6379` (Redis), `9000` (MinIO)

### Feature Flag Tiers
- **Free**: 20 orders/month, basic features, 14-day trial
- **Starter**: 100 orders/month, PDF receipts, loyalty (OMR 29/month)
- **Growth**: 500 orders/month, driver app, multi-branch (OMR 79/month)
- **Pro**: 2000 orders/month, B2B, analytics, API (OMR 199/month)
- **Enterprise**: Unlimited, white-label, franchise (Custom pricing)

## Total MVP Effort Estimate

- **Total Duration**: 6 weeks (with parallel development)
- **Total Effort**: ~400 hours
- **Recommended Team**: 2 backend + 2 frontend developers

### Sequential Timeline
- Week 1-2: PRD-001 (Auth) + setup
- Week 3-4: PRD-002 (Tenant) + PRD-003 (Customer) in parallel
- Week 5-6: PRD-004 (Order Intake) + PRD-005 (Workflow) in parallel
- Week 7-8: PRD-006 (Receipts) + PRD-007 (Dashboard) in parallel

## Next Steps

1. Review and approve master plan and PRDs
2. Set up project tracking (Jira/Linear/GitHub Projects)
3. Create database migrations (combine all schema changes)
4. Set up the shared local development environment
5. Begin Phase 1 implementation following PRD sequence

## Document Maintenance

- **Owner**: Development Team
- **Last Updated**: 2026-03-10
- **Status**: Active Development Plan
- **Change Process**: Update PRDs via pull request with team review

---

For questions or clarifications, refer to the main requirements document:
- `docs/Requirments_Specifications/clean_mate_x_unified_requirements_pack_v_0.12.1.md`
