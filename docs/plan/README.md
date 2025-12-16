# CleanMateX Development Planning Documents

This directory contains comprehensive development planning documents for the CleanMateX project.

## Directory Contents

### Master Plan
- **[master_plan_cc_01.md](./master_plan_cc_01.md)** - Comprehensive master development plan covering all 10 phases, technical architecture, feature flags, testing strategy, and implementation roadmap for all 48 PRDs.

### MVP Phase PRDs (Phase 1: Weeks 3-8)

1. **[001_auth_dev_prd.md](./001_auth_dev_prd.md)** - Authentication & Authorization
   - Duration: 2 weeks
   - Supabase Auth integration, RLS policies, RBAC, JWT tokens
   - Dependencies: None (Foundation)

2. **[002_tenant_management_dev_prd.md](./002_tenant_management_dev_prd.md)** - Tenant Onboarding & Management
   - Duration: 1.5 weeks
   - Self-service registration, subscription management, feature flags, settings
   - Dependencies: PRD-001

3. **[003_customer_management_dev_prd.md](./003_customer_management_dev_prd.md)** - Customer Profiles
   - Duration: 1.5 weeks
   - Progressive engagement (Guest → Stub → Full), OTP verification, addresses
   - Dependencies: PRD-001, PRD-002

4. **[004_order_intake_dev_prd.md](./004_order_intake_dev_prd.md)** - Order Creation & Itemization
   - Duration: 2 weeks
   - Quick Drop workflow, preparation/itemization, pricing, Ready-By calculation
   - Dependencies: PRD-001, PRD-002, PRD-003

5. **[005_basic_workflow_dev_prd.md](./005_basic_workflow_dev_prd.md)** - Workflow & Status Transitions
   - Duration: 1 week
   - Status state machine, audit trail, SLA tracking, bulk updates
   - Dependencies: PRD-001, PRD-004

6. **[006_digital_receipts_dev_prd.md](./006_digital_receipts_dev_prd.md)** - WhatsApp & In-App Receipts
   - Duration: 1.5 weeks
   - WhatsApp text receipts, QR codes, in-app viewing, delivery tracking
   - Dependencies: PRD-001, PRD-003, PRD-004

7. **[007_admin_dashboard_dev_prd.md](./007_admin_dashboard_dev_prd.md)** - Basic Admin UI
   - Duration: 1.5 weeks
   - Next.js dashboard, order/customer management, settings, basic reporting
   - Dependencies: PRD-001, PRD-002, PRD-003, PRD-004, PRD-005

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
- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript, Prisma ORM
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
4. Set up development environment (Docker Compose)
5. Begin Phase 1 implementation following PRD sequence

## Document Maintenance

- **Owner**: Development Team
- **Last Updated**: 2025-10-10
- **Status**: Active Development Plan
- **Change Process**: Update PRDs via pull request with team review

---

For questions or clarifications, refer to the main requirements document:
- `docs/Requirments Specifications/clean_mate_x_unified_requirements_pack_v_0.12.1.md`
