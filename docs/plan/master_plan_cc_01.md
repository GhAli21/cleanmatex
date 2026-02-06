# CleanMateX - Master Development Plan v1.0

**Document ID**: master_plan_cc_01
**Last Updated**: 2025-10-10
**Status**: Active Development Plan
**Owner**: Development Team

---

## Executive Summary

### Vision

CleanMateX is a mobile-first, multi-tenant SaaS platform for laundry and dry cleaning operations targeting the GCC region. The platform minimizes operational errors, accelerates workflows, and delivers exceptional digital customer experiences with full English/Arabic bilingual support.

### Key Differentiators

1. **Mobile-First Architecture**: Flutter apps for customers and drivers, responsive Next.js admin
2. **True Multi-Tenancy**: PostgreSQL RLS-based tenant isolation with composite FK patterns
3. **Bilingual by Design**: EN/AR support with RTL, using name/name2 pattern throughout
4. **Progressive Customer Engagement**: Guest → Stub → Full profile journey
5. **Configurable Workflows**: Service category-based workflow engine with feature flags
6. **Digital-First Operations**: WhatsApp receipts, QR tracking, OTP delivery proof
7. **GCC-Optimized**: Multi-currency, VAT-ready, local payment gateway integrations
8. **Assembly-Quality Gates**: Minimize mix-ups with scan-verify-pack workflow
9. **Marketplace Ready**: Built-in multi-tenant marketplace with commission/escrow
10. **Enterprise Scale**: B2B contracts, white-label, franchise management

### Success Metrics

- **Counter Speed**: Intake to receipt < 5 minutes
- **Quality**: Mix-up rate < 0.5%
- **Digital Adoption**: 80%+ digital receipts (WhatsApp/App/PDF)
- **Delivery Accuracy**: 95%+ OTP POD adoption
- **Reliability**: 99.9%+ API availability
- **SLA Compliance**: < 3% Ready-By breaches

---

## Technical Architecture Stack

### Frontend Layer

```
Customer Apps:
├── Flutter (iOS/Android)
├── FCM Push Notifications
├── Offline Queue Support
├── AR/EN RTL Support
└── Firebase Crashlytics

Driver App:
├── Flutter (iOS/Android)
├── Online/Offline Route Support
├── OTP/Signature/Photo POD
└── Geofencing & Live Tracking

Web Admin:
├── Next.js 15 (App Router)
├── React 18 + TypeScript
├── Tailwind CSS
├── i18next (EN/AR)
├── shadcn/ui Components
└── React Query (TanStack)
```

### Backend Layer

```
API Services:
├── NestJS (REST + OpenAPI)
├── TypeScript
├── Prisma ORM
├── Redis/BullMQ (Job Queues)
├── JWT + Supabase Auth
├── Idempotency Middleware
└── Feature Flag Engine

Business Logic:
├── Service-Based Architecture
├── Event-Driven Patterns
├── CQRS for Analytics
├── Plugin Architecture (Payments)
└── Webhook Publisher
```

### Data Layer

```
Primary Database:
├── PostgreSQL 16
├── Row-Level Security (RLS)
├── JSONB for Flexible Data
├── Partitioning Strategy
├── PITR Backups
└── Read Replicas (Production)

Caching & Queues:
├── Redis (Cache)
├── BullMQ (Job Processing)
└── Session Storage

File Storage:
├── MinIO (S3-compatible)
├── Image Processing
└── Receipt Generation
```

### Integration Layer

```
Payment Gateways:
├── HyperPay (GCC)
├── PayTabs (GCC)
├── Stripe (International)
└── Plugin Architecture

Communication:
├── WhatsApp Business API
├── Twilio SMS
├── SendGrid Email
└── Multi-Provider Fallbacks

Third-Party:
├── Google Maps API
├── FCM (Push)
├── Accounting Export (CSV→API)
└── Future: ERP Integrations
```

### DevOps & Infrastructure

```
Container Orchestration:
├── Docker & Docker Compose (Dev)
├── Kubernetes/EKS (Production)
├── Helm Charts
└── Terraform IaC

CI/CD:
├── GitHub Actions
├── Automated Testing
├── Database Migrations
└── Multi-Environment Deploys

Observability:
├── OpenTelemetry (Traces/Metrics)
├── Prometheus + Grafana
├── Sentry (Error Tracking)
├── Structured Logging (JSON)
└── SLO Alerting
```

---

## Database Schema Overview

### Schema Patterns

#### System-Level Tables (sys\_\*)

Global, shared across all tenants. Examples:

- `sys_customers_mst`: Global customer identity registry
- `sys_order_type_cd`: Order type codes/lookups
- `sys_service_category_cd`: Service category master data

#### Organization-Level Tables (org\_\*)

Tenant-specific data with mandatory `tenant_org_id`. Examples:

- `org_tenants_mst`: Tenant/organization master
- `org_customers_mst`: Tenant-customer links
- `org_orders_mst`: Orders per tenant
- `org_branches_mst`: Branches per tenant

#### Composite Foreign Key Pattern

All tenant data uses composite FKs for data isolation:

```sql
-- Example: Order references customer
ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_org_order_customer
  FOREIGN KEY (customer_id, tenant_org_id)
  REFERENCES org_customers_mst(customer_id, tenant_org_id);
```

#### Bilingual Support Pattern

All user-facing text uses dual columns:

- `name`: English (primary)
- `name2`: Arabic (secondary)

#### RLS (Row-Level Security)

Every org\_\* table has RLS policies filtering by `tenant_org_id`:

```sql
CREATE POLICY tenant_isolation ON org_orders_mst
  USING (tenant_org_id = current_setting('app.current_tenant_id')::uuid);
```

### Core Tables Summary

**Tenant Management**

- org_tenants_mst
- org_subscriptions_mst
- org_branches_mst

**Customer Management**

- sys_customers_mst (global)
- org_customers_mst (tenant link)

**Catalog & Products**

- sys_service_category_cd (global)
- org_service_category_cf (tenant enablement)
- org_product_data_mst (tenant products)

**Orders & Operations**

- org_orders_mst
- org_order_items_dtl
- org_workflow_states (planned)
- org_assembly_tasks (planned)

**Finance**

- org_invoice_mst
- org_payments_dtl_tr

**Logistics**

- org_delivery_routes (planned)
- org_delivery_pod (planned)

---

## Development Workflow & Standards

### Git Workflow

```
main (production-ready)
  └── develop (integration branch)
      └── feature/PRD-XXX-description
      └── bugfix/issue-description
      └── hotfix/critical-fix
```

### Branch Naming

- `feature/001-auth-setup` (PRD-based)
- `bugfix/customer-phone-validation`
- `hotfix/payment-gateway-timeout`

### Commit Standards

Follow Conventional Commits:

- `feat(auth): implement Supabase RLS policies`
- `fix(orders): correct composite FK references`
- `docs(prd): add 001_auth_dev_prd.md`
- `test(customers): add stub profile creation tests`

### Code Review Process

1. Self-review before PR
2. Automated checks (lint, format, tests)
3. Peer review (1+ approvals)
4. QA validation in staging
5. Merge to develop
6. Release from develop → main

### Database Migration Workflow

```
1. Create migration file: NNNN_description.sql
2. Test in local Docker: cmx_db
3. Apply to dev environment
4. Review in PR
5. Apply to staging
6. Apply to production (with rollback plan)
```

### Environment Variables

```
Development: .env.local
Staging: .env.staging
Production: .env.production (secrets management)

Required:
- DATABASE_URL (postgres://cmx_user:cmx_pass_dev@localhost:5432/cmx_db)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- REDIS_URL
- MINIO_ENDPOINT
```

### Code Quality Standards

- TypeScript strict mode enabled
- ESLint + Prettier configured
- 80%+ test coverage target
- No console.log in production
- Error boundary implementations
- Proper TypeScript types (no 'any')

---

## Feature Flags & Plan Tiers

### Feature Flag System

Each tenant has configurable feature flags stored in `org_tenants_mst.feature_flags` (JSONB):

```json
{
  "pdf_invoices": true,
  "whatsapp_receipts": true,
  "in_app_receipts": true,
  "printing": false,
  "b2b_contracts": false,
  "white_label": false,
  "marketplace_listings": true,
  "loyalty_programs": true,
  "driver_app": true,
  "multi_branch": false,
  "advanced_analytics": false,
  "api_access": false
}
```

### Plan Tiers

#### Free Tier (Trial - 14 days)

- **Price**: OMR 0/month
- **Orders**: 20/month
- **Users**: 2
- **Branches**: 1
- **Features**:
  - ✅ Basic order intake (Quick Drop)
  - ✅ WhatsApp text receipts
  - ✅ Simple workflow (intake → ready → delivered)
  - ✅ Basic customer profiles (stub only)
  - ❌ No PDF receipts
  - ❌ No in-app receipts
  - ❌ No loyalty programs
  - ❌ No driver app

#### Starter Plan

- **Price**: OMR 29/month
- **Orders**: 100/month
- **Users**: 5
- **Branches**: 1
- **Features**:
  - ✅ Everything in Free
  - ✅ PDF receipts (EN/AR)
  - ✅ In-app digital receipts
  - ✅ Full customer profiles
  - ✅ Basic loyalty points
  - ✅ Email notifications
  - ✅ Basic reporting
  - ❌ No driver app
  - ❌ No multi-branch

#### Growth Plan

- **Price**: OMR 79/month
- **Orders**: 500/month
- **Users**: 15
- **Branches**: 3
- **Features**:
  - ✅ Everything in Starter
  - ✅ Driver app with routing
  - ✅ Multi-branch support
  - ✅ Advanced loyalty (tiers/referrals)
  - ✅ Marketing campaigns
  - ✅ Inventory tracking
  - ✅ Assembly & QA workflow
  - ✅ WhatsApp Business API
  - ❌ No B2B contracts
  - ❌ No white-label

#### Pro Plan

- **Price**: OMR 199/month
- **Orders**: 2000/month
- **Users**: 50
- **Branches**: 10
- **Features**:
  - ✅ Everything in Growth
  - ✅ B2B contracts & statements
  - ✅ Credit control
  - ✅ Advanced analytics & heatmaps
  - ✅ API access (REST)
  - ✅ Marketplace listings
  - ✅ Custom branding
  - ✅ Priority support
  - ❌ No white-label portal

#### Enterprise Plan

- **Price**: Custom pricing
- **Orders**: Unlimited
- **Users**: Unlimited
- **Branches**: Unlimited
- **Features**:
  - ✅ Everything in Pro
  - ✅ White-label portal
  - ✅ Franchise management
  - ✅ Custom integrations
  - ✅ Dedicated support
  - ✅ SLA guarantees
  - ✅ On-premise option
  - ✅ Custom workflows

### Feature Flag Implementation

```typescript
// Example usage in code
async canAccessFeature(tenantId: string, feature: string): Promise<boolean> {
  const tenant = await this.getTenant(tenantId);
  return tenant.feature_flags?.[feature] === true;
}

// Middleware
@UseGuards(FeatureFlagGuard)
@FeatureFlag('pdf_invoices')
async generatePdfReceipt() {
  // Only accessible if feature flag enabled
}
```

---

## Testing Strategy

### Testing Pyramid

#### Unit Tests (70%)

- **Framework**: Jest
- **Coverage**: 80%+ target
- **Focus**: Business logic, utilities, validators
- **Examples**:
  - Price calculation logic
  - Customer profile validation
  - Workflow state transitions
  - RLS query builders

#### Integration Tests (20%)

- **Framework**: Jest + Supertest
- **Coverage**: All API endpoints
- **Focus**: Database interactions, API contracts
- **Examples**:
  - Order creation flow
  - Customer registration
  - Payment processing
  - Tenant isolation (RLS verification)

#### E2E Tests (10%)

- **Framework**: Playwright
- **Coverage**: Critical user journeys
- **Focus**: Complete workflows
- **Examples**:
  - Guest customer → order → WhatsApp receipt
  - Full profile → order → loyalty points
  - Driver → pickup → delivery POD
  - Admin → order management → reporting

### Test Data Strategy

- **Fixtures**: Predefined test data sets
- **Factories**: Dynamic test data generation
- **Seeding**: Automated database seeding for dev/test
- **Isolation**: Each test suite uses separate tenant

### Testing Environments

```
Local:
- Docker Compose (postgres, redis, minio)
- Jest unit/integration tests
- Manual testing

CI/CD:
- GitHub Actions runners
- Automated test suite
- Code coverage reports
- Performance benchmarks

Staging:
- Production-like environment
- E2E test automation
- UAT by stakeholders
- Load testing
```

### Performance Testing

- **Tool**: k6
- **Targets**:
  - p50 response time < 300ms
  - p95 response time < 800ms
  - Order search < 1s @ 100k orders
  - Concurrent users: 100+ simultaneous
- **Scenarios**:
  - Order intake during peak hours
  - Receipt generation under load
  - Multi-tenant isolation overhead
  - Database query performance

### Security Testing

- SQL injection prevention
- XSS protection
- CSRF token validation
- RLS policy verification
- Authentication/authorization tests
- Secrets exposure scanning

---

## DevOps & Deployment

### Development Environment

```bash
# Docker Compose Setup
docker-compose up -d

Services:
- postgres: localhost:5432 (cmx_user/cmx_pass_dev/cmx_db)
- redis: localhost:6379
- minio: localhost:9000 (UI: localhost:9001)
- redis-commander: localhost:8081

# Database Migrations
npm run migration:run
npm run seed:dev

# Start cmx-api (client API)
cd cmx-api
npm run start:dev

# Start Web Admin
cd web-admin
npm run dev
```

### Staging Environment

- **Infrastructure**: Docker Swarm or Kubernetes
- **Database**: PostgreSQL with replication
- **Domain**: staging.cleanmatex.com
- **Purpose**: UAT, integration testing, demo

### Production Environment

```
Infrastructure:
├── Kubernetes (EKS/GKE)
├── Load Balancer (ALB/NGINX)
├── CDN (CloudFlare)
└── Auto-scaling

Database:
├── PostgreSQL Primary
├── Read Replicas (2+)
├── Automated Backups (PITR)
└── Connection Pooling (PgBouncer)

Monitoring:
├── Prometheus (Metrics)
├── Grafana (Dashboards)
├── Sentry (Errors)
└── CloudWatch/Stackdriver (Logs)

Security:
├── SSL/TLS Certificates
├── Secrets Manager
├── WAF Protection
└── DDoS Mitigation
```

### Deployment Process

#### Backend/API Deployment

```yaml
# GitHub Actions Workflow
1. Run tests (unit + integration)
2. Build Docker image
3. Push to registry
4. Run database migrations
5. Deploy to Kubernetes
6. Health check validation
7. Rollback on failure
```

#### Frontend Deployment

```yaml
# Web Admin (Next.js)
1. Run tests
2. Build static assets
3. Deploy to Vercel/CDN
4. Invalidate cache
5. Smoke tests

# Mobile Apps (Flutter)
1. Build Android APK/AAB
2. Build iOS IPA
3. Upload to Play Store/App Store
4. Staged rollout (10% → 50% → 100%)
```

### Database Migration Strategy

```sql
-- Migration File Format: NNNN_description.sql
-- Example: 0004_add_workflow_tables.sql

-- Always include rollback
BEGIN;

-- Forward migration
CREATE TABLE org_workflow_states (...);

-- Validation
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM org_workflow_states) >= 0;
END $$;

COMMIT;

-- Rollback (separate file: NNNN_description_rollback.sql)
-- DROP TABLE org_workflow_states;
```

### Monitoring & Alerting

#### SLO Definitions

```yaml
Order Creation API:
  - Availability: 99.9%
  - Latency p95: < 800ms
  - Error Rate: < 0.1%

Receipt Delivery:
  - Success Rate: > 98%
  - Delivery Time: < 30s

Database:
  - Query Time p95: < 200ms
  - Connection Pool: < 80% utilized
  - Replication Lag: < 5s
```

#### Alert Rules

- API error rate > 1% (5min window)
- Response time p95 > 1s (5min window)
- Database connections > 90%
- Disk usage > 85%
- Failed background jobs > 10/min
- WhatsApp API failures > 5%

---

## 10 Development Phases with Timelines

### Phase 0: Foundation & Setup (Weeks 1-2)

**Duration**: 2 weeks
**Goal**: Development environment and infrastructure baseline

**Deliverables**:

- ✅ Repository structure and tooling
- ✅ Docker Compose setup (postgres, redis, minio)
- ✅ Database schema baseline (0001_core.sql)
- ✅ RLS policies (0002_rls_core.sql)
- ✅ CI/CD pipeline skeleton
- ✅ Development documentation
- ✅ Code quality standards (ESLint, Prettier)

**Status**: COMPLETED

---

### Phase 1: MVP Core (Weeks 3-8)

**Duration**: 6 weeks
**Goal**: Minimum viable product for single-tenant operations

**PRDs**: 001-007

**Features**:

1. **Authentication & Authorization** (PRD-001)

   - Supabase Auth integration
   - RLS policy enforcement
   - Basic RBAC (Admin, Operator, Viewer)
   - JWT token management

2. **Tenant Management** (PRD-002)

   - Tenant onboarding workflow
   - Subscription management (trial → paid)
   - Feature flag configuration
   - Tenant settings (currency, timezone, language)

3. **Customer Management** (PRD-003)

   - Guest customer support
   - Stub profile creation (name + phone)
   - Full profile with OTP verification
   - Customer search and lookup

4. **Order Intake** (PRD-004)

   - Quick Drop workflow
   - Basic itemization (preparation)
   - Service category selection
   - Price calculation (manual)
   - Order number generation

5. **Basic Workflow** (PRD-005)

   - Status transitions: intake → processing → ready → delivered
   - Status update UI
   - Basic validation (no complex gates)
   - Order history tracking

6. **Digital Receipts** (PRD-006)

   - WhatsApp text receipt
   - In-app receipt view
   - Receipt data model
   - Basic templating (EN only first)

7. **Admin Dashboard** (PRD-007)
   - Order listing and search
   - Order details view
   - Customer management UI
   - Basic reporting (order counts)

**Success Criteria**:

- Single tenant can process 10 orders end-to-end
- Receipt delivered via WhatsApp
- Sub-5 minute intake time
- All tests passing (unit + integration)

**Risks**:

- WhatsApp API approval delays
- RLS policy complexity
- Supabase learning curve

---

### Phase 2: Enhanced Operations (Weeks 9-14)

**Duration**: 6 weeks
**Goal**: Production-ready operations with quality gates

**PRDs**: 008-015

**Features**: 

8. **Service Catalog Management** (PRD-008)

	- Product master data
	- Service categories configuration
	- Pricing rules (per-piece, per-kg)
	- Category-specific workflows

23. **Bilingual Support (AR)** (PRD-023) - Moved From Phase 3
    - RTL UI components
    - Arabic translations (all screens)
    - Bilingual PDFs
    - Localized notifications

33. **Staff Management** (PRD-033) - Moved From Phase 5

    - User roles and permissions
    - Activity logging
    - Performance metrics
    - Attendance tracking

9. **Assembly & QA Workflow** (PRD-009)

   - Assembly task creation
   - Item scanning and verification
   - Exception handling (missing/damaged)
   - QA pass/fail gates
   - Packing workflow

10. **Advanced Order Management** (PRD-010)

    - Order splitting
    - Issue-to-solve (pre/post delivery)
    - Customer notes and preferences
    - Priority management

11. **PDF Receipt Generation** (PRD-011)

    - Bilingual PDF (EN/AR)
    - QR code integration
    - Thermal printer support
    - Email delivery

12. **Payment Processing** (PRD-012)

    - Multiple payment methods (cash, card, online)
    - Partial payments
    - Payment history
    - Basic invoice generation

13. **Delivery Management** (PRD-013)

    - Route planning (manual)
    - Delivery status tracking
    - OTP-based proof of delivery
    - Customer notifications

14. **Multi-Branch Support** (PRD-014)

    - Branch master data
    - Branch-specific settings
    - Inter-branch transfers (future)
    - Branch filtering in UI

15. **Reporting & Analytics** (PRD-015)
    - Daily/weekly/monthly reports
    - Revenue dashboards
    - SLA tracking
    - Export to CSV

**Success Criteria**:

- 3 branches operational
- Assembly mix-up rate < 1%
- PDF receipts generated in < 5s
- 50 orders/day throughput per branch

---

### Phase 3: Customer Experience (Weeks 15-20)

**Duration**: 6 weeks
**Goal**: Enhanced customer engagement and self-service

**PRDs**: 016-023

**Features**: 

16. **Customer Mobile App (MVP)** (PRD-016) 
	- Order placement 
	- Order tracking 
	- Receipt access 
	- Profile management

17. **Loyalty Program** (PRD-017)

    - Points earning rules
    - Points redemption
    - Tier system (Bronze/Silver/Gold)
    - Referral program

18. **WhatsApp Business Integration** (PRD-018)

    - Two-way messaging
    - Order status notifications
    - Quick replies
    - Receipt delivery

19. **Customer Notifications** (PRD-019)

    - SMS fallback
    - Email notifications
    - Push notifications (mobile app)
    - Notification preferences

20. **Online Booking** (PRD-020)

    - Pickup slot selection
    - Delivery slot selection
    - Calendar integration
    - Slot capacity management

21. **Promo Codes & Discounts** (PRD-021)

    - Percentage/fixed discounts
    - Conditional promotions
    - First-time customer offers
    - Expiry management

22. **Customer Feedback** (PRD-022)

    - Post-delivery ratings
    - Service reviews
    - Issue reporting
    - Feedback analysis

**Success Criteria**:

- 30% mobile app adoption
- 50% loyalty program enrollment
- 4.0+ average rating
- < 2% notification failures

---

### Phase 4: Driver Operations (Weeks 21-25)

**Duration**: 5 weeks
**Goal**: Streamlined delivery operations

**PRDs**: 024-028

**Features**: 24. **Driver Mobile App** (PRD-024) - Route assignment - Pickup list - Delivery list - Navigation integration

25. **Proof of Delivery** (PRD-025)

    - OTP verification
    - Signature capture
    - Photo capture
    - Delivery exceptions

26. **Route Optimization** (PRD-026)

    - Manual route builder
    - Distance calculation
    - Time estimation
    - Multi-stop routing

27. **Driver Performance** (PRD-027)

    - Delivery metrics
    - On-time percentage
    - Customer ratings
    - Earnings tracking

28. **Live Tracking** (PRD-028)
    - Real-time GPS tracking
    - ETA calculation
    - Customer notifications
    - Geofencing

**Success Criteria**:

- 95% OTP POD adoption
- < 10min average delivery time
- 4.5+ driver ratings
- < 5% failed deliveries

---

### Phase 5: B2B & Enterprise (Weeks 26-32)

**Duration**: 7 weeks
**Goal**: Corporate customer support

**PRDs**: 029-034

**Features**: 29. **B2B Customer Management** (PRD-029) - Corporate profiles - Contract management - Credit limits - Multiple delivery addresses

30. **B2B Billing** (PRD-030)

    - Consolidated invoicing
    - Statement generation
    - Credit control
    - Payment terms

31. **Inventory Management** (PRD-031)

    - Consumables tracking
    - Stock levels
    - Reorder alerts
    - Usage per order

32. **Machine Management** (PRD-032)

    - Equipment registry
    - Maintenance schedules
    - Usage counters
    - Downtime tracking

34. **Advanced Analytics** (PRD-034)
    - Revenue heatmaps
    - Customer cohorts
    - Predictive analytics
    - Export to BI tools

**Success Criteria**:

- 5 B2B contracts active
- < 2% billing disputes
- 90% inventory accuracy
- < 5% machine downtime

---

### Phase 6: Marketplace & Growth (Weeks 33-39)

**Duration**: 7 weeks
**Goal**: Multi-tenant marketplace platform

**PRDs**: 035-040

**Features**: 

35. **Marketplace Listings** (PRD-035) 
	- Tenant storefronts 
	- Service listings 
	- Photos and descriptions 
	- Search and discovery

36. **Commission Management** (PRD-036)

    - Commission rates configuration
    - Automatic calculation
    - Payout tracking
    - Escrow handling

37. **Reviews & Ratings** (PRD-037)

    - Verified reviews only
    - Moderation queue
    - Response management
    - Rating aggregation

38. **Dispute Management** (PRD-038)

    - Dispute categories
    - Evidence upload
    - SLA timers
    - Resolution outcomes

39. **Marketing Campaigns** (PRD-039)

    - Segment builder
    - Email/SMS campaigns
    - Voucher distribution
    - Campaign analytics

40. **Membership Programs** (PRD-040)
    - Subscription plans
    - Member benefits
    - Auto-renewal
    - Proration logic

**Success Criteria**:

- 10+ marketplace tenants
- 5% platform commission
- 4.2+ average marketplace rating
- < 3% dispute rate

---

### Phase 7: Payment & Finance (Weeks 40-44)

**Duration**: 5 weeks
**Goal**: Multi-gateway payment integration

**PRDs**: 041-044

**Features**: 

41. **Payment Gateway Integration** (PRD-041) 

	- PayTabs (GCC)
	- HyperPay (GCC) 
	- Stripe (International) 
	- Plugin architecture

42. **Wallet System** (PRD-042)

    - Wallet balance
    - Top-up functionality
    - Wallet payments
    - Transaction history

43. **Family Accounts** (PRD-043)

    - Family linking
    - Shared wallet
    - Spending limits
    - Approval workflows

44. **Accounting Export** (PRD-044)
    - CSV export
    - Accounting API
    - Chart of accounts mapping
    - Reconciliation tools

**Success Criteria**:

- 3 payment gateways live
- 99.5% payment success rate
- < 1% refund rate
- Daily accounting reconciliation

---

### Phase 8: Mobile App Enhancement (Weeks 45-50)

**Duration**: 6 weeks
**Goal**: Feature-complete mobile apps

**PRDs**: 045-048

**Features**: 45. **Offline Support** (PRD-045) - Offline queue - Sync on reconnect - Conflict resolution - Local storage

46. **Push Notifications** (PRD-046)

    - FCM integration
    - Notification categories
    - Deep linking
    - Rich notifications

47. **In-App Messaging** (PRD-047)

    - Customer support chat
    - Order-specific threads
    - File attachments
    - Read receipts

48. **App Customization** (PRD-048)
    - Tenant branding
    - Custom color schemes
    - Logo integration
    - White-label builds

**Success Criteria**:

- < 1% sync failures
- 70% notification open rate
- < 5min support response time
- 10 white-label apps deployed

---

### Phase 9: Enterprise Features (Weeks 51-58)

**Duration**: 8 weeks
**Goal**: Large-scale enterprise deployment

**PRDs**: Not yet defined (placeholder for future expansion)

**Features** (Conceptual):

- Franchise management portal
- Multi-currency support
- Advanced API access
- Custom integrations
- SLA management
- Data residency options
- Advanced security (SSO, SAML)
- Audit compliance tools

**Success Criteria**:

- 3 enterprise clients onboarded
- 99.95% uptime SLA met
- Custom integration delivered
- SOC 2 compliance ready

---

### Phase 10: Scale & Optimization (Weeks 59-65)

**Duration**: 7 weeks
**Goal**: Platform optimization and scaling

**Focus Areas**:

- Performance optimization
- Cost reduction
- Database optimization (partitioning)
- Caching strategies
- Load testing (1000+ concurrent users)
- AI/ML features (pricing prediction, demand forecasting)
- Sustainability metrics
- Advanced analytics

**Success Criteria**:

- 50% cost reduction (infra)
- Sub-200ms p95 latency
- 10,000+ orders/day capacity
- AI features in production

---

## Implementation Sequence - All 48 PRDs

### MVP Phase (Weeks 3-8)

1. **001_auth_dev_prd.md** - Authentication & Authorization
2. **002_tenant_management_dev_prd.md** - Tenant Onboarding
3. **003_customer_management_dev_prd.md** - Customer Profiles
4. **004_order_intake_dev_prd.md** - Order Creation & Itemization
5. **005_basic_workflow_dev_prd.md** - Workflow State Machine
6. **006_digital_receipts_dev_prd.md** - WhatsApp & In-App Receipts
7. **007_admin_dashboard_dev_prd.md** - Admin UI

### P1 - Enhanced Operations (Weeks 9-14)

8. **008_service_catalog_dev_prd.md** - Product & Service Catalog
23. **023_bilingual_dev_prd.md** - Full Arabic Support
33. **033_staff_dev_prd.md** - Staff & Permissions
9. **009_assembly_qa_dev_prd.md** - Assembly & QA Workflow
10. **010_advanced_orders_dev_prd.md** - Order Split & Issue Resolution
11. **011_pdf_receipts_dev_prd.md** - PDF Generation & Printing
12. **012_payments_dev_prd.md** - Payment Processing
13. **013_delivery_dev_prd.md** - Delivery Management
14. **014_multi_branch_dev_prd.md** - Multi-Branch Support
15. **015_reporting_dev_prd.md** - Reports & Analytics

### P1 - Customer Experience (Weeks 15-20)

16. **016_customer_app_dev_prd.md** - Customer Mobile App
17. **017_loyalty_dev_prd.md** - Loyalty & Referrals
18. **018_whatsapp_dev_prd.md** - WhatsApp Business API
19. **019_notifications_dev_prd.md** - Multi-Channel Notifications
20. **020_booking_dev_prd.md** - Pickup/Delivery Scheduling
21. **021_promotions_dev_prd.md** - Promo Codes & Discounts
22. **022_feedback_dev_prd.md** - Ratings & Reviews
23. **023_bilingual_dev_prd.md** - Full Arabic Support -- Moved to Previous Phase 2

### P1 - Driver Operations (Weeks 21-25)

24. **024_driver_app_dev_prd.md** - Driver Mobile App
25. **025_pod_dev_prd.md** - Proof of Delivery
26. **026_routing_dev_prd.md** - Route Optimization
27. **027_driver_metrics_dev_prd.md** - Driver Performance
28. **028_live_tracking_dev_prd.md** - GPS Tracking

### P1 - B2B & Enterprise (Weeks 26-32)

29. **029_b2b_customers_dev_prd.md** - Corporate Customers
30. **030_b2b_billing_dev_prd.md** - B2B Invoicing & Statements
31. **031_inventory_dev_prd.md** - Inventory Management
32. **032_machines_dev_prd.md** - Equipment Management
33. **033_staff_dev_prd.md** - Staff & Permissions -- Moved To P1 - Enhanced Operations
34. **034_advanced_analytics_dev_prd.md** - Business Intelligence

### P2 - Marketplace (Weeks 33-39)

35. **035_marketplace_dev_prd.md** - Marketplace Platform
36. **036_commission_dev_prd.md** - Commission & Escrow
37. **037_reviews_dev_prd.md** - Review System
38. **038_disputes_dev_prd.md** - Dispute Resolution
39. **039_campaigns_dev_prd.md** - Marketing Campaigns
40. **040_memberships_dev_prd.md** - Membership Programs

### P2 - Payments (Weeks 40-44)

41. **041_payment_gateways_dev_prd.md** - Multi-Gateway Integration
42. **042_wallet_dev_prd.md** - Wallet System
43. **043_family_accounts_dev_prd.md** - Family Accounts
44. **044_accounting_dev_prd.md** - Accounting Integration

### P2 - Mobile Enhancement (Weeks 45-50)

45. **045_offline_dev_prd.md** - Offline Mode
46. **046_push_dev_prd.md** - Push Notifications
47. **047_messaging_dev_prd.md** - In-App Chat
48. **048_white_label_dev_prd.md** - White-Label Apps

---

## Risk Management

### Technical Risks

| Risk                               | Probability | Impact   | Mitigation                                            |
| ---------------------------------- | ----------- | -------- | ----------------------------------------------------- |
| RLS performance degradation        | Medium      | High     | Early load testing, query optimization, caching layer |
| WhatsApp API rate limits           | Medium      | Medium   | Implement queue with retry, multi-provider fallback   |
| Multi-tenant data leaks            | Low         | Critical | Comprehensive RLS tests, security audits, monitoring  |
| Mobile app store rejections        | Medium      | Medium   | Follow guidelines strictly, pre-submission review     |
| Payment gateway integration delays | High        | Medium   | Parallel integration, phased rollout                  |
| Database migration failures        | Low         | High     | Automated rollback, staging validation, backups       |
| Scalability bottlenecks            | Medium      | High     | Load testing early, horizontal scaling, profiling     |

### Business Risks

| Risk                          | Probability | Impact | Mitigation                                          |
| ----------------------------- | ----------- | ------ | --------------------------------------------------- |
| Low customer adoption         | Medium      | High   | MVP validation, pilot customers, feedback loops     |
| Competitor features           | High        | Medium | Continuous market research, agile pivots            |
| Pricing model rejection       | Medium      | High   | Flexible tiers, pilot programs, value demonstration |
| Regulatory compliance (VAT)   | Medium      | Medium | Legal review, compliance automation, audits         |
| Multi-language quality issues | Medium      | Medium | Native speaker reviews, professional translation    |

### Operational Risks

| Risk                        | Probability | Impact | Mitigation                                              |
| --------------------------- | ----------- | ------ | ------------------------------------------------------- |
| Team capacity constraints   | High        | Medium | Phased hiring, outsourcing, scope prioritization        |
| Knowledge silos             | Medium      | Medium | Documentation, pair programming, knowledge sharing      |
| Infrastructure costs        | Medium      | Medium | Cloud cost monitoring, optimization, reserved instances |
| Third-party service outages | Medium      | High   | Fallback mechanisms, multi-provider, monitoring         |

---

## Success Criteria

### MVP Success (End of Phase 1)

- ✅ 3 pilot customers onboarded
- ✅ 100 orders processed successfully
- ✅ 90%+ WhatsApp receipt delivery
- ✅ Sub-5 minute intake time
- ✅ Zero data leaks (RLS working)
- ✅ All automated tests passing

### P1 Success (End of Phase 6)

- ✅ 50 paying customers
- ✅ 5,000 orders/month
- ✅ 3 payment gateways integrated
- ✅ 30% mobile app adoption
- ✅ < 1% mix-up rate
- ✅ 99% uptime

### P2 Success (End of Phase 8)

- ✅ 200 tenants
- ✅ 50,000 orders/month
- ✅ Marketplace revenue > OMR 10k/month
- ✅ 5 B2B enterprise contracts
- ✅ 10 white-label deployments
- ✅ Profitability achieved

### Long-term Success (Year 2)

- ✅ 1,000+ tenants
- ✅ 500k orders/month
- ✅ Market leader in GCC region
- ✅ Series A funding secured
- ✅ Expansion to new markets
- ✅ Sustainable growth trajectory

---

## Appendix: Key Decisions Log

### Decision 001: Database - PostgreSQL with RLS

**Date**: 2025-10-10
**Context**: Multi-tenant data isolation strategy
**Decision**: Use PostgreSQL RLS instead of separate schemas per tenant
**Rationale**: Better scalability, simpler migrations, proven pattern with Supabase
**Alternatives Considered**: Separate databases, schema-per-tenant, discriminator column

### Decision 002: Auth - Supabase Auth

**Date**: 2025-10-10
**Context**: Authentication and authorization provider
**Decision**: Use Supabase Auth with custom claims for tenant context
**Rationale**: Integrated with PostgreSQL RLS, reduced development time, proven solution
**Alternatives Considered**: Auth0, Firebase Auth, custom JWT implementation

### Decision 003: Backend - NestJS

**Date**: 2025-10-10
**Context**: Backend framework selection
**Decision**: NestJS with TypeScript
**Rationale**: Enterprise-grade, TypeScript-first, excellent documentation, modular architecture
**Alternatives Considered**: Express.js, Fastify, Koa

### Decision 004: Frontend - Next.js 15

**Date**: 2025-10-10
**Context**: Web admin framework
**Decision**: Next.js 15 (App Router) with React Server Components
**Rationale**: Performance, SEO, server-side rendering, excellent DX, large ecosystem
**Alternatives Considered**: Remix, SvelteKit, Nuxt.js

### Decision 005: Mobile - Flutter

**Date**: 2025-10-10
**Context**: Mobile app framework
**Decision**: Flutter for both iOS and Android
**Rationale**: Single codebase, native performance, excellent RTL support, fast development
**Alternatives Considered**: React Native, Native (Swift/Kotlin), Ionic

### Decision 006: Bilingual Pattern - name/name2

**Date**: 2025-10-10
**Context**: Bilingual data storage
**Decision**: Use name (EN) and name2 (AR) column pattern
**Rationale**: Simple, performant queries, no joins required, explicit language handling
**Alternatives Considered**: JSON column, separate translation tables, i18n keys

### Decision 007: Composite FKs for Tenant Isolation

**Date**: 2025-10-10
**Context**: Foreign key relationships in multi-tenant setup
**Decision**: All cross-table references include tenant_org_id in composite FK
**Rationale**: Database-level enforcement of tenant isolation, prevents accidental cross-tenant queries
**Alternatives Considered**: Application-level checks only, triggers

### Decision 008: Docker for Development

**Date**: 2025-10-10
**Context**: Local development environment
**Decision**: Docker Compose with postgres, redis, minio
**Credentials**: cmx_user / cmx_pass_dev / cmx_db
**Rationale**: Consistent dev environment, easy onboarding, matches production architecture
**Alternatives Considered**: Local installs, Docker Desktop, Vagrant

---

## Document Change Log

| Version | Date       | Author           | Changes                                   |
| ------- | ---------- | ---------------- | ----------------------------------------- |
| 1.0     | 2025-10-10 | Development Team | Initial comprehensive master plan created |

---

**Next Steps**:

1. Review and approve this master plan
2. Create detailed PRDs for MVP phase (001-007)
3. Set up project tracking (Jira/Linear/GitHub Projects)
4. Begin Phase 1 implementation
5. Weekly progress reviews against this plan

---

_This document is a living plan and will be updated as the project evolves._
