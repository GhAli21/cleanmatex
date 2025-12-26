# CleanMateX - Master Development Plan

**Document ID**: master_plan_cc_01  
**Version**: 1.0  
**Status**: Active  
**Last Updated**: 2025-10-09  
**Owner**: Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Vision & Business Model](#2-project-vision--business-model)
3. [Architecture Overview](#3-architecture-overview)
4. [Technology Stack](#4-technology-stack)
5. [Complete Feature Inventory](#5-complete-feature-inventory)
6. [Phased Rollout Strategy](#6-phased-rollout-strategy)
7. [Module Index & Dependencies](#7-module-index--dependencies)
8. [Development Timeline](#8-development-timeline)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Team Structure & Responsibilities](#10-team-structure--responsibilities)
11. [Risk Management](#11-risk-management)
12. [Success Metrics & KPIs](#12-success-metrics--kpis)
13. [Quality Assurance Strategy](#13-quality-assurance-strategy)
14. [Communication & Documentation](#14-communication--documentation)

---

## 1. Executive Summary

### Project Overview

**CleanMateX** is a comprehensive, mobile-first, multi-tenant SaaS platform designed for laundry and dry cleaning management, targeting the GCC region with bilingual support (English/Arabic with RTL).

### Core Value Proposition

- **End-to-end workflow management**: From order intake through delivery with quality gates
- **Per-piece tracking**: Barcode/RFID scanning at every workflow transition
- **Multi-tenant architecture**: Isolated data with row-level security
- **Digital-first customer engagement**: Progressive customer profiles, mobile apps, WhatsApp integration
- **Operational excellence**: Assembly quality gates, QA checkpoints, SLA tracking

### Business Model

- **Freemium with paid tiers**: Free trial → Starter → Growth → Pro → Enterprise
- **Usage-based limits**: Orders per month, branches, users
- **Marketplace revenue**: Commission on cross-tenant orders
- **Add-on modules**: B2B contracts, advanced analytics, AI features

### Target Market

- **Primary**: GCC region (Oman, UAE, Saudi Arabia, Qatar, Bahrain, Kuwait)
- **Segments**:
  - Traditional small laundries (mobile-first POS)
  - SMEs (delivery + loyalty programs)
  - Large chains/franchises (enterprise features, white-label)

### Success Criteria

| Goal                 | KPI                    | Target      |
| -------------------- | ---------------------- | ----------- |
| Counter speed        | Intake→receipt median  | < 5 minutes |
| Quality              | Assembly incident rate | < 0.5%      |
| Delivery reliability | OTP POD adoption       | ≥ 95%       |
| Digital adoption     | Digital receipt share  | ≥ 80%       |
| System reliability   | API availability       | ≥ 99.9%     |
| SLA compliance       | Ready-By breaches      | < 3%        |

---

## 2. Project Vision & Business Model

### Vision Statement

Mobile-first, multi-tenant SaaS for laundry & dry cleaning that minimizes errors, accelerates operations, and delights customers with digital experiences. EN/AR out of the box; light hardware footprint; friendly driver app; Assembly-first quality gates.

### Business Objectives

1. **Operational Efficiency**: Reduce order processing time by 60%
2. **Error Reduction**: Minimize mix-ups through per-piece tracking
3. **Customer Satisfaction**: Enable real-time tracking and digital receipts
4. **Revenue Growth**: Marketplace enables cross-tenant business
5. **Market Expansion**: Support multi-language, multi-currency operations

### Revenue Streams

1. **Subscription Plans**

   - Free: 100 orders/month, 1 branch, 2 users
   - Starter: 500 orders/month, 2 branches, 5 users ($49/month)
   - Growth: 2000 orders/month, 5 branches, 15 users ($149/month)
   - Pro: 10000 orders/month, unlimited branches, 50 users ($399/month)
   - Enterprise: Custom limits, white-label, SLA ($999+/month)

2. **Marketplace Commission**: 5-15% on cross-tenant orders

3. **Add-on Modules**
   - B2B contracts module
   - Advanced analytics & reporting
   - AI-powered features (pricing estimator, vision QA)
   - Accounting system integrations

### Competitive Advantages

- **Quality Gates**: Assembly and QA checkpoints prevent mix-ups
- **Progressive Customer Engagement**: Guest → Stub → Full profiles
- **Bilingual RTL Support**: Native Arabic support from day one
- **Marketplace**: Unique cross-tenant business model
- **Configurable Workflows**: Adapt to different service types
- **WhatsApp Integration**: Reach customers on their preferred platform

---

## 3. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PLATFORM LAYER                        │
│  (Super Admin - Manages all tenants, billing, features) │
├─────────────────────────────────────────────────────────┤
│                    TENANT LAYER                          │
│  (Laundry Businesses - Isolated data per tenant)        │
├─────────────────────────────────────────────────────────┤
│                   END-USER LAYER                         │
│  (Customers, Drivers - Mobile-first experience)         │
└─────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Design

**Dual-Layer Data Model**:

1. **System Layer** (`sys_*` tables): Global shared data

   - `sys_customers_mst`: Global customer identities
   - `sys_service_category_cd`: Service category master
   - `sys_order_type_cd`: Order type lookups

2. **Organization Layer** (`org_*` tables): Tenant-specific data
   - `org_tenants_mst`: Tenant organizations
   - `org_customers_mst`: Tenant-customer links
   - `org_orders_mst`: Orders with tenant isolation
   - `org_branches_mst`: Multi-branch support

**Isolation Strategy**:

- Row-Level Security (RLS) on all tenant tables
- JWT claims include `tenant_id`
- Composite foreign keys enforce tenant boundaries
- API middleware validates tenant context

### Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND LAYER                                          │
│  - Web Admin (Next.js 15 - SSR/App Router)             │
│  - Customer Mobile (Flutter)                            │
│  - Driver Mobile (Flutter)                              │
│  - Store POS (Flutter/PWA)                              │
└───────────────────┬─────────────────────────────────────┘
                    │ REST/GraphQL APIs
┌───────────────────▼─────────────────────────────────────┐
│  API LAYER                                               │
│  - Tenant API (NestJS - Core business logic)           │
│  - Platform API (NestJS - Admin operations)            │
│  - Auth Gateway (Supabase Auth)                         │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│  SERVICE LAYER                                           │
│  - Notifications (WhatsApp, SMS, Email, Push)          │
│  - Payments (Gateway abstraction)                       │
│  - Storage (Supabase Storage/MinIO)                     │
│  - Queue (Redis + BullMQ)                               │
│  - Cache (Redis)                                        │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│  DATA LAYER                                              │
│  - PostgreSQL 16 (Primary - Supabase)                  │
│  - Redis (Cache & Queue)                                │
│  - MinIO/S3 (File Storage)                              │
└─────────────────────────────────────────────────────────┘
```

### Workflow State Machine

**Core Order Flow**:

```
Intake → Preparation → Sorting → Washing/Dry-clean →
Drying → Finishing → Assembly → QA → Packing → Ready →
Out-for-Delivery → Delivered → Closed
```

**Quality Gates**:

- Assembly: 100% completeness scan required
- QA: Pass/fail inspection with rework loop
- Packing: Verified packing list before Ready status
- Delivery: OTP/signature/photo POD required

**Configurable Workflows**: Different flows based on:

- Service category (dry cleaning, laundry, ironing, repairs)
- Tenant features (assembly enabled/disabled)
- Order priority (express, normal, bulk)

---

## 4. Technology Stack

### Frontend Technologies

**Web Admin Dashboard**

- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: React Context + Zustand
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **i18n**: next-intl (EN/AR with RTL)
- **UI Components**: shadcn/ui + custom components
- **Charts**: Recharts/Chart.js

**Mobile Applications**

- **Framework**: Flutter 3.x
- **Language**: Dart
- **State Management**: Riverpod/Bloc
- **API Client**: Dio + code generation
- **Local Storage**: Hive/Drift
- **Push Notifications**: Firebase Cloud Messaging
- **Maps**: Google Maps Flutter
- **Camera**: camera + image_picker packages

### Backend Technologies

**API Layer**

- **Framework**: NestJS 10
- **Language**: TypeScript 5
- **ORM**: Prisma 5
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI 3
- **Testing**: Jest + Supertest
- **Architecture**: Domain-Driven Design (DDD)

**Infrastructure Services**

- **Database**: PostgreSQL 16 (Supabase)
- **Cache/Queue**: Redis 7
- **Job Queue**: BullMQ
- **Storage**: MinIO (S3-compatible) / Supabase Storage
- **Auth**: Supabase Auth (JWT)
- **Real-time**: Supabase Realtime (WebSocket)

### DevOps & Infrastructure

**Containerization**

- **Local**: Docker Compose
- **Production**: Kubernetes (EKS/GKE)
- **Registry**: Docker Hub / AWS ECR

**CI/CD**

- **Pipeline**: GitHub Actions
- **Testing**: Automated unit, integration, E2E tests
- **Deployment**: Blue-green deployment strategy
- **Infrastructure**: Terraform (IaC)

**Monitoring & Observability**

- **Tracing**: OpenTelemetry
- **Metrics**: Prometheus + Grafana
- **Logs**: Loki / CloudWatch
- **Error Tracking**: Sentry
- **Uptime**: Better Stack / Pingdom
- **APM**: New Relic / Datadog (optional)

### External Integrations

**Payment Gateways**

- Stripe (Global)
- PayTabs (GCC)
- HyperPay (Middle East)
- Plugin architecture for extensibility

**Communication**

- WhatsApp Business API
- Twilio (SMS)
- SendGrid (Email)
- Firebase Cloud Messaging (Push)

**Maps & Routing**

- Google Maps API
- Distance Matrix API
- Directions API

**Accounting** (Future)

- QuickBooks API
- Xero API
- Custom CSV exports

---

## 5. Complete Feature Inventory

### Phase 0: Foundation (P0 - Critical)

| ID  | Feature                        | Priority | Complexity |
| --- | ------------------------------ | -------- | ---------- |
| 001 | Infrastructure Setup           | P0       | Medium     |
| 002 | Database Core                  | P0       | High       |
| 003 | Authentication & Authorization | P0       | High       |
| 004 | Multi-Tenancy Core             | P0       | High       |

### Phase 1: Core Business Operations MVP (P0 - Critical)

| ID  | Feature                      | Requirements                               | Complexity |
| --- | ---------------------------- | ------------------------------------------ | ---------- |
| 005 | Tenant Management            | UC10                                       | Medium     |
| 006 | Customer Management          | FR-CST-001, UC01                           | Medium     |
| 007 | Catalog & Service Management | -                                          | Medium     |
| 008 | Order Intake (Quick Drop)    | FR-QD-001, UC01                            | High       |
| 009 | Order Preparation            | FR-PRE-001, UC01                           | High       |
| 010 | Order Workflow Engine        | -                                          | High       |
| 011 | Per-Piece Tracking           | FR-TRK-001, UC04                           | High       |
| 012 | Assembly, QA, Packing        | FR-ASM-001, FR-QA-001, FR-PCK-001, UC05-07 | High       |
| 013 | Invoicing & Payments         | FR-INV-001, UC09                           | High       |
| 014 | Delivery & Logistics         | FR-DRV-001, UC08                           | High       |

### Phase 2: Web Admin Dashboard (P0 - Critical)

| ID  | Feature                     | Requirements | Complexity |
| --- | --------------------------- | ------------ | ---------- |
| 015 | Layout & Navigation         | NFR-I18N-001 | Medium     |
| 016 | Dashboard Home              | -            | Medium     |
| 017 | Order Management UI         | -            | High       |
| 018 | Customer Management UI      | -            | Medium     |
| 019 | Catalog Management UI       | -            | Medium     |
| 020 | Settings & Configuration UI | UC10         | Medium     |

### Phase 3: Backend API (P1 - High)

| ID  | Feature                  | Requirements | Complexity |
| --- | ------------------------ | ------------ | ---------- |
| 021 | Backend Architecture     | -            | High       |
| 022 | Auth Middleware          | NFR-SEC-001  | Medium     |
| 023 | Orders API               | Section 6    | High       |
| 024 | Payments & Invoicing API | FR-INV-001   | High       |
| 025 | Notifications System     | Section 11   | High       |
| 026 | Queue & Jobs             | -            | Medium     |

### Phase 4: Customer Mobile App (P1 - High)

| ID  | Feature           | Requirements     | Complexity |
| --- | ----------------- | ---------------- | ---------- |
| 027 | App Architecture  | -                | Medium     |
| 028 | Onboarding & Auth | FR-CST-001       | Medium     |
| 029 | Order Creation    | UC01             | High       |
| 030 | Order Tracking    | -                | Medium     |
| 031 | Payments & Wallet | FR-WLT-001, UC12 | High       |

### Phase 5: Driver & Store Mobile (P2 - Medium)

| ID  | Feature                 | Requirements           | Complexity |
| --- | ----------------------- | ---------------------- | ---------- |
| 032 | Driver App Architecture | -                      | Medium     |
| 033 | Route Management        | FR-DRV-001, UC08, UC22 | High       |
| 034 | Store POS App           | -                      | High       |

### Phase 6: Advanced Features (P2 - Medium)

| ID  | Feature                | Requirements                             | Complexity |
| --- | ---------------------- | ---------------------------------------- | ---------- |
| 035 | Loyalty & Membership   | FR-LOY-001, FR-LOY-002, FR-SUB-001, UC11 | High       |
| 036 | B2B Contracts          | FR-B2B-001, FR-B2B-002, UC14             | High       |
| 037 | Marketplace Listings   | FR-MKT-001, UC23-24                      | High       |
| 038 | Reviews & Ratings      | FR-CX-REV-001, UC25                      | Medium     |
| 039 | Dispute Resolution     | FR-DSP-001, UC26                         | Medium     |
| 040 | Inventory & Supplier   | FR-INV-101, FR-SUP-001, UC13, UC27       | Medium     |
| 041 | Machine Maintenance    | FR-MCH-101                               | Low        |
| 042 | Analytics & Reporting  | FR-ANL-001, UC16                         | High       |
| 043 | Sustainability Metrics | FR-SUS-001, UC21                         | Low        |

### Phase 7: Integrations & Platform (P2 - Medium)

| ID  | Feature                      | Requirements | Complexity |
| --- | ---------------------------- | ------------ | ---------- |
| 044 | Payment Gateway Integrations | UC17         | High       |
| 045 | WhatsApp Business            | UC20         | High       |
| 046 | SMS/Email Providers          | -            | Medium     |
| 047 | Accounting Integration       | -            | Medium     |
| 048 | Maps & Routing               | UC22         | Medium     |

### Phase 8: Shared Packages (P1 - High)

| ID  | Feature              | Requirements | Complexity |
| --- | -------------------- | ------------ | ---------- |
| 049 | Shared Types Package | -            | Low        |
| 050 | i18n Package         | NFR-I18N-001 | Medium     |
| 051 | Utils Package        | -            | Low        |
| 052 | Feature Flags System | FR-INV-002   | Medium     |

### Phase 9: Quality & Deployment (P3 - Low)

| ID  | Feature                    | Requirements | Complexity |
| --- | -------------------------- | ------------ | ---------- |
| 053 | Testing Strategy           | Section 13   | Medium     |
| 054 | Observability & Monitoring | NFR-OBS-001  | Medium     |
| 055 | Security Hardening         | NFR-SEC-001  | High       |
| 056 | Performance Optimization   | NFR-PERF-001 | High       |
| 057 | Deployment Infrastructure  | -            | High       |
| 058 | Documentation & Training   | -            | Medium     |

---

## 6. Phased Rollout Strategy

### Phase 0: Foundation (Weeks 1-6)

**Goal**: Establish development infrastructure and core architecture

**Deliverables**:

- Local development environment (Docker Compose)
- Supabase configuration and connection
- Database schema deployed with RLS
- Authentication system operational
- Multi-tenancy framework implemented

**Success Criteria**:

- Developers can run full stack locally
- Database migrations execute successfully
- JWT authentication working
- Tenant isolation verified

### Phase 1: MVP Core Operations (Weeks 7-22)

**Goal**: Build minimum viable product for single laundry operations

**Deliverables**:

- Tenant and customer management
- Service catalog configuration
- Complete order workflow (intake → delivery)
- Per-piece tracking with barcodes
- Assembly, QA, and packing gates
- Invoicing and payments
- Basic delivery management

**Success Criteria**:

- End-to-end order processing functional
- Quality gates enforcing completeness
- Invoices generated correctly
- POD captured for deliveries

### Phase 2: Web Admin Dashboard (Weeks 23-32)

**Goal**: Provide intuitive web interface for laundry staff

**Deliverables**:

- Responsive admin layout with RTL support
- Dashboard with KPIs and quick actions
- Order management interface
- Customer management interface
- Catalog management interface
- Settings and configuration screens

**Success Criteria**:

- Staff can manage all operations via web
- RTL working correctly for Arabic
- Mobile responsive on tablets
- Performance < 1s page loads

### Phase 3: Backend API (Weeks 33-44)

**Goal**: Formalize and scale backend architecture

**Deliverables**:

- NestJS backend with DDD structure
- RESTful APIs with OpenAPI docs
- Auth middleware with RBAC
- Notification system (email, SMS)
- Background job processing
- API rate limiting

**Success Criteria**:

- API response time p95 < 800ms
- Swagger docs generated
- Job queue processing reliably
- Error handling standardized

### Phase 4: Customer Mobile App (Weeks 45-54)

**Goal**: Enable customers to place and track orders

**Deliverables**:

- Flutter customer app (iOS + Android)
- Onboarding and authentication
- Order creation with photo upload
- Real-time order tracking
- Payment and wallet management
- Push notifications

**Success Criteria**:

- App published on stores
- Smooth onboarding flow
- Real-time updates working
- Payment integration functional

### Phase 5: Driver & Store Mobile (Weeks 55-62)

**Goal**: Equip drivers and store staff with mobile tools

**Deliverables**:

- Driver app with route management
- POD capture (OTP, signature, photo)
- Store POS app for quick intake
- Offline support for poor connectivity

**Success Criteria**:

- Drivers complete routes efficiently
- POD capture rate > 95%
- POS app works offline
- Data sync when online

### Phase 6: Advanced Features (Weeks 63-78)

**Goal**: Add revenue-generating and differentiation features

**Deliverables**:

- Loyalty and membership programs
- B2B contracts and corporate billing
- Marketplace with tenant listings
- Reviews and ratings system
- Dispute resolution center
- Inventory and supplier management
- Machine maintenance tracking
- Analytics and reporting engine
- Sustainability metrics

**Success Criteria**:

- Loyalty program drives engagement
- B2B customers onboarded
- Marketplace transactions flowing
- Analytics providing insights

### Phase 7: Integrations (Weeks 79-88)

**Goal**: Connect to external ecosystems

**Deliverables**:

- Payment gateways (Stripe, PayTabs, HyperPay)
- WhatsApp Business API
- Multi-provider SMS/email
- Accounting system exports
- Maps and routing optimization

**Success Criteria**:

- Multiple payment methods working
- WhatsApp notifications delivered
- Accounting data exportable
- Route optimization functional

### Phase 8: Shared Packages (Weeks 89-94)

**Goal**: Extract and share common code

**Deliverables**:

- TypeScript types package
- i18n package with EN/AR translations
- Common utilities package
- Feature flags system

**Success Criteria**:

- Packages published and consumed
- Type safety across apps
- Translations consistent
- Feature flags controlling access

### Phase 9: Production Readiness (Weeks 95-104)

**Goal**: Prepare for production launch

**Deliverables**:

- Comprehensive test coverage
- Observability and monitoring
- Security audit and hardening
- Performance optimization
- Production infrastructure
- Documentation and training materials

**Success Criteria**:

- Test coverage > 80%
- All security issues resolved
- Performance targets met
- Production environment stable
- Team trained on system

---

## 7. Module Index & Dependencies

### Dependency Graph

```
Foundation (001-004)
    ↓
Core MVP (005-014) ← Shared Packages (049-052)
    ↓
Web Admin (015-020)
    ↓
Backend API (021-026) → Integrations (044-048)
    ↓
Customer Mobile (027-031)
    ↓
Driver/Store Mobile (032-034)
    ↓
Advanced Features (035-043)
    ↓
Production Ready (053-058)
```

### Critical Path

The critical path for MVP launch includes:

1. **001-004**: Foundation (6 weeks)
2. **005-014**: Core MVP (16 weeks)
3. **015-020**: Web Admin (10 weeks)
4. **021-026**: Backend API (12 weeks)
5. **053, 055**: Testing & Security (4 weeks)

**Total Critical Path**: 48 weeks (~ 12 months)

### Parallel Development Opportunities

After Foundation (001-004), these can proceed in parallel:

**Track 1** (Backend Team):

- 021-026: Backend API
- 044-048: Integrations
- 049-052: Shared Packages

**Track 2** (Frontend Web Team):

- 005-014: Core MVP (Supabase direct)
- 015-020: Web Admin UI

**Track 3** (Mobile Team):

- 027-031: Customer Mobile
- 032-034: Driver/Store Mobile

**Track 4** (DevOps Team):

- 053-058: Production Infrastructure

With parallel development, timeline can be reduced to 8-9 months.

### Module Dependencies Matrix

| Module | Depends On         | Blocks                |
| ------ | ------------------ | --------------------- |
| 001    | -                  | 002, 003, 004         |
| 002    | 001                | 003, 004, 005-014     |
| 003    | 001, 002           | 004, 005-014, 015-020 |
| 004    | 001, 002, 003      | 005-014               |
| 005    | 002, 003, 004      | 006-014               |
| 006    | 002, 003, 004, 005 | 008-014               |
| 007    | 002, 003, 004, 005 | 008-014               |
| 008    | 005, 006, 007      | 009-014               |
| 009    | 008                | 010-014               |
| 010    | 009                | 011-014               |
| 011    | 010                | 012                   |
| 012    | 011                | 013                   |
| 013    | 012                | 014                   |
| 014    | 013                | 027-034               |
| 015    | 003, 004, 049, 050 | 016-020               |
| 016    | 015                | -                     |
| 017    | 015, 005-014       | -                     |
| 018    | 015, 006           | -                     |
| 019    | 015, 007           | -                     |
| 020    | 015, 005           | -                     |
| 021    | 002, 003, 004      | 022-026               |
| 022    | 021                | 023-026               |
| 023    | 022                | -                     |
| 024    | 022                | 044                   |
| 025    | 022                | 045, 046              |
| 026    | 022                | -                     |
| 027    | 003, 049-051       | 028-031               |
| 028    | 027                | 029-031               |
| 029    | 028                | 030                   |
| 030    | 029                | 031                   |
| 031    | 030                | -                     |
| 032    | 003, 027           | 033                   |
| 033    | 032                | -                     |
| 034    | 003, 027           | -                     |
| 035    | 021, 024           | -                     |
| 036    | 021, 024           | -                     |
| 037    | 021, 024           | 038, 039              |
| 038    | 037                | -                     |
| 039    | 037                | -                     |
| 040    | 021                | -                     |
| 041    | 021                | -                     |
| 042    | 021                | -                     |
| 043    | 021                | -                     |
| 044    | 024                | -                     |
| 045    | 025                | -                     |
| 046    | 025                | -                     |
| 047    | 021, 024           | -                     |
| 048    | 033                | -                     |
| 049    | -                  | All modules           |
| 050    | -                  | 015-020, 027-034      |
| 051    | -                  | All modules           |
| 052    | 004                | 035-043               |
| 053    | All modules        | -                     |
| 054    | 021                | -                     |
| 055    | All modules        | -                     |
| 056    | All modules        | -                     |
| 057    | All modules        | -                     |
| 058    | All modules        | -                     |

---

## 8. Development Timeline

### Timeline Overview (52 weeks / 12 months)

```
Month 1-2   : Foundation (001-004)
Month 3-5   : Core MVP Backend (005-014)
Month 6-7   : Web Admin UI (015-020)
Month 8-9   : Backend API (021-026) + Shared Packages (049-052)
Month 10-11 : Customer Mobile (027-031)
Month 12    : Testing, Security, Launch Prep (053, 055, 057)

Post-Launch (Months 13-18):
Month 13-14 : Driver/Store Mobile (032-034)
Month 15-17 : Advanced Features (035-043)
Month 18    : Integrations (044-048)
```

### Milestone Schedule

| Milestone                 | Completion Week | Deliverables                             |
| ------------------------- | --------------- | ---------------------------------------- |
| M1: Dev Environment Ready | Week 4          | Local setup, DB migrations, Auth working |
| M2: MVP Backend Complete  | Week 22         | Orders, invoicing, tracking functional   |
| M3: Web Admin Launch      | Week 32         | Staff can manage operations via web      |
| M4: API Layer Complete    | Week 44         | Documented REST APIs, job processing     |
| M5: Customer App Launch   | Week 54         | iOS/Android apps published               |
| M6: Driver App Launch     | Week 62         | Driver POD and routing functional        |
| M7: Advanced Features     | Week 78         | Loyalty, B2B, marketplace live           |
| M8: Full Integration      | Week 88         | All payment, comms integrated            |
| M9: Production Launch     | Week 104        | System production-ready                  |

### Sprint Planning (2-week sprints)

**Sprint Duration**: 2 weeks (10 working days)
**Story Points per Sprint**: 40-50 points (5-person team)

**Sprint 1-3**: Foundation setup
**Sprint 4-11**: Core MVP development
**Sprint 12-16**: Web Admin UI
**Sprint 17-22**: Backend API + Mobile prep
**Sprint 23-27**: Customer Mobile
**Sprint 28-31**: Driver/Store Mobile
**Sprint 32-39**: Advanced features
**Sprint 40-44**: Integrations
**Sprint 45-52**: Polish, testing, launch

### Resource Allocation

**Team Size**: 5-7 developers

- 2 Backend Engineers (NestJS, PostgreSQL)
- 2 Frontend Engineers (Next.js, React)
- 1-2 Mobile Engineers (Flutter)
- 1 DevOps Engineer (part-time, consulting)
- 1 QA Engineer (from Sprint 12)

**Additional Resources**:

- Product Manager (0.5 FTE)
- UX/UI Designer (0.5 FTE)
- Technical Writer (0.25 FTE, from Sprint 40)

---

## 9. Cross-Cutting Concerns

### Security (NFR-SEC-001)

**Authentication & Authorization**:

- JWT-based authentication via Supabase Auth
- Role-Based Access Control (RBAC)
  - Roles: super_admin, tenant_admin, branch_manager, operator, assembly, qa, driver, customer
- Multi-factor authentication (MFA) for admin roles
- Session management with refresh tokens
- API key authentication for integrations

**Data Protection**:

- TLS 1.3 for all communications
- Encryption at rest (database, file storage)
- PII data encryption in database (where applicable)
- Secrets management (environment variables, vault)
- Secure password hashing (bcrypt, Argon2)

**Multi-Tenancy Security**:

- Row-Level Security (RLS) policies on all tenant tables
- Tenant context validation in every API request
- Composite foreign keys for tenant boundaries
- Audit logging of cross-tenant access attempts

**Application Security**:

- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS protection (Content Security Policy)
- CSRF tokens for state-changing operations
- Rate limiting (per user, per tenant, per IP)
- Idempotency keys for financial operations

**API Security**:

- Signed webhooks (HMAC)
- API versioning to prevent breaking changes
- CORS configuration per environment
- Request size limits
- File upload validation (type, size)

**Compliance**:

- GDPR compliance (data portability, right to deletion)
- GCC data residency considerations
- Audit trails for all data access
- Consent management for marketing

### Internationalization & RTL (NFR-I18N-001)

**Language Support**:

- English (default)
- Arabic (RTL support)
- Locale detection from user preferences
- Fallback to English if translation missing

**RTL Considerations**:

- CSS logical properties for layout
- Bidirectional text rendering
- Icon mirroring for directional icons
- Date/time formatting per locale
- Number formatting (1,234.56 vs 1.234,56)
- Currency formatting (OMR, USD, SAR, etc.)

**Translation Management**:

- Centralized translation files in `packages/i18n`
- Translation keys namespaced by feature
- Pluralization support
- Variable interpolation
- Date-fns for date localization
- Use general keys for common UI elements

**Content**:

- Bilingual product names (name, name2)
- Bilingual reports and invoices
- Bilingual packing lists
- Bilingual notifications (email, SMS, WhatsApp)

### Performance (NFR-PERF-001)

**Response Time Targets**:

- API p50: < 300ms
- API p95: < 800ms
- API p99: < 1500ms
- Page load (FCP): < 1.5s
- Page interactive (TTI): < 3s
- Order search (100k records): < 1s

**Optimization Strategies**:

- Database query optimization (indexes, explain analyze)
- Connection pooling (PgBouncer)
- Redis caching (frequently accessed data)
- CDN for static assets
- Image optimization (WebP, lazy loading)
- Code splitting (dynamic imports)
- API response pagination
- Background job processing for heavy operations
- Database read replicas for reporting

**Scalability**:

- Horizontal scaling of API servers
- Stateless API design (no server-side sessions)
- Database partitioning by tenant_id (future)
- Queue-based processing for async operations
- Auto-scaling based on load metrics

### Availability & Reliability (NFR-AVL-001)

**Uptime Target**: 99.9% (< 43 minutes downtime/month)

**High Availability**:

- Multi-AZ deployment
- Database replication (primary + standby)
- Redis clustering for cache
- Load balancer health checks
- Automatic failover
- Circuit breakers for external services

**Disaster Recovery**:

- Automated database backups (daily)
- Point-in-time recovery (PITR)
- Backup retention: 30 days
- Cross-region backup replication
- Disaster recovery runbook
- RTO: 4 hours, RPO: 1 hour

**Graceful Degradation**:

- Offline mode for mobile apps
- Queue failed operations for retry
- Fallback for external service failures
- Cached data when database slow
- Feature flags to disable non-critical features

### Observability (NFR-OBS-001)

**Distributed Tracing**:

- OpenTelemetry instrumentation
- Trace context propagation
- Span attributes for tenant_id, user_id
- Sampling strategy for high-volume endpoints

**Metrics**:

- Application metrics (request rate, latency, error rate)
- Business metrics (orders created, invoices generated)
- Infrastructure metrics (CPU, memory, disk)
- Database metrics (connections, query time)
- Custom metrics via Prometheus

**Logging**:

- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for request tracing
- Log aggregation (Loki/CloudWatch)
- PII redaction in logs
- Log retention: 30 days

**Alerting**:

- SLO-based alerting
- Error rate thresholds
- Latency thresholds
- Database connection pool exhaustion
- Failed job alerts
- PagerDuty/Opsgenie integration

**Dashboards**:

- System health dashboard
- Business metrics dashboard
- Per-tenant usage dashboard
- API performance dashboard
- Error rate dashboard

---

## 10. Team Structure & Responsibilities

### Development Team

**Backend Team (2 engineers)**:

- NestJS API development
- Database schema design and migrations
- Business logic implementation
- Integration with external services
- API documentation
- Performance optimization

**Frontend Web Team (2 engineers)**:

- Next.js admin dashboard
- React component development
- State management
- API integration
- Responsive design
- RTL support

**Mobile Team (1-2 engineers)**:

- Flutter app development (iOS + Android)
- Mobile UI/UX implementation
- Offline support
- Push notifications
- App store submissions
- Mobile-specific optimizations

**DevOps Engineer (0.5 FTE, consultant)**:

- Infrastructure as Code (Terraform)
- CI/CD pipeline setup
- Container orchestration (Kubernetes)
- Monitoring and alerting setup
- Database administration
- Security hardening

**QA Engineer (1 engineer, from Sprint 12)**:

- Test plan creation
- Manual testing
- Automated test development
- Performance testing
- Security testing
- UAT coordination

### Supporting Roles

**Product Manager (0.5 FTE)**:

- Requirements refinement
- Sprint planning
- Stakeholder communication
- Release management
- Product roadmap
- User feedback analysis

**UX/UI Designer (0.5 FTE)**:

- User research
- Wireframes and mockups
- Design system creation
- Usability testing
- Visual design
- Accessibility review

**Technical Writer (0.25 FTE, from Sprint 40)**:

- API documentation
- User guides
- Admin documentation
- Training materials
- Video tutorials
- Knowledge base articles

### Communication Structure

**Daily Standups**: 15 minutes, synchronous or async (Slack/Discord)
**Sprint Planning**: 2 hours at start of sprint
**Sprint Review**: 1 hour at end of sprint
**Sprint Retrospective**: 1 hour at end of sprint
**Technical Design Reviews**: As needed, 1-2 hours
**Architecture Discussions**: Bi-weekly, 2 hours

**Collaboration Tools**:

- Version Control: GitHub
- Project Management: Jira / Linear
- Communication: Slack / Microsoft Teams
- Documentation: Notion / Confluence
- Design: Figma
- API Testing: Postman

---

## 11. Risk Management

### Technical Risks

| Risk                                        | Impact   | Probability | Mitigation                                                   |
| ------------------------------------------- | -------- | ----------- | ------------------------------------------------------------ |
| Database performance degradation with scale | High     | Medium      | Implement caching, optimize queries, partitioning strategy   |
| Supabase vendor lock-in                     | High     | Low         | Use Prisma ORM abstraction, standard PostgreSQL features     |
| Real-time sync conflicts in mobile apps     | Medium   | Medium      | Implement conflict resolution strategy, optimistic locking   |
| WhatsApp API rate limits                    | Medium   | High        | Implement queue with backoff, multi-provider fallback        |
| Complex RLS policies impacting performance  | High     | Medium      | Regular performance testing, query optimization              |
| Multi-tenancy data leakage                  | Critical | Low         | Comprehensive RLS testing, security audits                   |
| Payment gateway integration complexity      | Medium   | High        | Start with one gateway, abstract interface, thorough testing |
| Mobile app offline sync issues              | Medium   | High        | Conservative sync strategy, user education, clear status     |

### Business Risks

| Risk                                        | Impact | Probability | Mitigation                                                   |
| ------------------------------------------- | ------ | ----------- | ------------------------------------------------------------ |
| MVP scope creep delaying launch             | High   | High        | Strict prioritization, MVP definition, stakeholder alignment |
| Market competition launches similar product | High   | Medium      | Focus on differentiators (quality gates, marketplace)        |
| Low adoption in target market               | High   | Low         | Customer development, pilot programs, iterative feedback     |
| Pricing model not attractive                | Medium | Medium      | Market research, flexible pricing, freemium entry            |
| Arabic RTL issues limiting GCC adoption     | High   | Low         | Early RTL testing, native Arabic speaker QA                  |
| B2B customers requiring custom features     | Medium | High        | Configurable workflows, feature flags, clear boundaries      |

### Operational Risks

| Risk                                         | Impact   | Probability | Mitigation                                                   |
| -------------------------------------------- | -------- | ----------- | ------------------------------------------------------------ |
| Key developer leaving mid-project            | High     | Low         | Documentation, pair programming, knowledge sharing           |
| Infrastructure costs exceeding budget        | Medium   | Medium      | Monitor usage, optimize resources, reserved instances        |
| Third-party service outages                  | Medium   | High        | Multi-provider strategy, graceful degradation, SLA awareness |
| Data breach or security incident             | Critical | Low         | Security best practices, audits, incident response plan      |
| Compliance violations (GDPR, data residency) | High     | Low         | Legal review, privacy by design, compliance checklist        |

### Risk Response Plan

**Risk Monitoring**:

- Monthly risk review in retrospective
- Risk register maintained in project docs
- New risks added as discovered
- Risk status updated (probability, impact)

**Escalation Path**:

1. Team identifies risk
2. Tech lead assesses impact
3. High/critical risks escalated to product manager
4. Mitigation plan created
5. Implementation assigned
6. Progress tracked

---

## 12. Success Metrics & KPIs

### System Performance Metrics

| Metric                    | Target        | Measurement          |
| ------------------------- | ------------- | -------------------- |
| API Response Time (p50)   | < 300ms       | APM tools            |
| API Response Time (p95)   | < 800ms       | APM tools            |
| API Response Time (p99)   | < 1500ms      | APM tools            |
| System Availability       | ≥ 99.9%       | Uptime monitoring    |
| Error Rate                | < 0.1%        | Error tracking       |
| Database Query Time       | < 100ms (avg) | Database monitoring  |
| Page Load Time (FCP)      | < 1.5s        | Real user monitoring |
| Time to Interactive (TTI) | < 3s          | Lighthouse           |

### Business Metrics

| Metric                 | Target                      | Measurement                       |
| ---------------------- | --------------------------- | --------------------------------- |
| Order Processing Time  | < 5 min (intake to receipt) | System logs                       |
| Assembly Incident Rate | < 0.5%                      | Assembly exceptions / total items |
| OTP POD Adoption       | ≥ 95%                       | POD records with OTP              |
| Digital Receipt Share  | ≥ 80%                       | Digital / total receipts          |
| Ready-By SLA Breaches  | < 3%                        | Orders late / total orders        |
| Customer Satisfaction  | ≥ 4.0/5.0                   | App store ratings, surveys        |

### Development Metrics

| Metric                       | Target                       | Measurement            |
| ---------------------------- | ---------------------------- | ---------------------- |
| Sprint Velocity              | 40-50 points                 | Jira/Linear            |
| Code Coverage                | ≥ 80%                        | Jest, coverage reports |
| Code Review Time             | < 24 hours                   | GitHub PR metrics      |
| Deployment Frequency         | ≥ 2x per week                | CI/CD logs             |
| Mean Time to Recovery (MTTR) | < 1 hour                     | Incident logs          |
| Bug Resolution Time          | < 3 days (P1), < 1 week (P2) | Issue tracker          |

### User Adoption Metrics

| Metric                     | Target (Month 6) | Measurement      |
| -------------------------- | ---------------- | ---------------- |
| Active Tenants             | 50               | Database count   |
| Total Orders Processed     | 10,000           | System analytics |
| Mobile App Downloads       | 1,000            | App stores       |
| Daily Active Users (DAU)   | 200              | Analytics        |
| Monthly Active Users (MAU) | 500              | Analytics        |
| User Retention (30-day)    | ≥ 60%            | Cohort analysis  |

### Financial Metrics

| Metric                          | Target (Year 1) | Measurement                     |
| ------------------------------- | --------------- | ------------------------------- |
| Monthly Recurring Revenue (MRR) | $25,000         | Billing system                  |
| Customer Acquisition Cost (CAC) | < $500          | Marketing spend / new customers |
| Lifetime Value (LTV)            | > $3,000        | Revenue / churn rate            |
| LTV:CAC Ratio                   | > 6:1           | Calculated                      |
| Gross Margin                    | ≥ 70%           | Financial reports               |
| Churn Rate                      | < 5% monthly    | Subscription cancellations      |

---

## 13. Quality Assurance Strategy

### Testing Pyramid

```
           ┌─────────────┐
           │   Manual    │
           │  E2E Tests  │  ← 10% of tests
           └─────────────┘
         ┌─────────────────┐
         │  Automated E2E  │
         │  & Integration  │  ← 30% of tests
         └─────────────────┘
     ┌───────────────────────┐
     │     Unit Tests        │  ← 60% of tests
     └───────────────────────┘
```

### Unit Testing

**Scope**: Individual functions, components, services
**Target Coverage**: 80%+
**Tools**: Jest, React Testing Library
**Responsibilities**: Developers write alongside code

**What to test**:

- Business logic functions
- Utility functions
- React components (rendering, props, events)
- API service methods
- State management
- Validation logic

### Integration Testing

**Scope**: Multiple components/modules working together
**Target Coverage**: Key user flows
**Tools**: Jest, Supertest, Testcontainers
**Responsibilities**: Developers + QA

**What to test**:

- API endpoints with database
- Service integrations
- Authentication flows
- Multi-step business processes
- Queue job processing
- External API mocks

### End-to-End Testing

**Scope**: Complete user journeys
**Target Coverage**: Critical paths
**Tools**: Playwright, Cypress
**Responsibilities**: QA Engineer

**What to test**:

- Order creation to delivery flow
- User registration and login
- Payment processing
- Mobile app key flows
- Cross-browser compatibility
- Responsive design

### Performance Testing

**Scope**: System under load
**Tools**: k6, Artillery
**Responsibilities**: DevOps + QA

**What to test**:

- API load testing (requests per second)
- Database query performance
- Concurrent user simulation
- Memory leak detection
- Resource utilization

### Security Testing

**Scope**: Vulnerability assessment
**Tools**: OWASP ZAP, SonarQube, Snyk
**Responsibilities**: DevOps + Security Consultant

**What to test**:

- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication bypass attempts
- Authorization checks
- Dependency vulnerabilities
- Secret exposure

### User Acceptance Testing (UAT)

**Scope**: Real-world usage validation
**Participants**: Beta customers, pilot tenants
**Duration**: 2 weeks before launch

**Process**:

1. Recruit pilot customers
2. Provide test credentials and training
3. Define acceptance criteria per use case
4. Collect feedback via forms/interviews
5. Log bugs and enhancement requests
6. Iterate based on feedback
7. Sign-off from stakeholders

---

## 14. Communication & Documentation

### Documentation Standards

**Code Documentation**:

- JSDoc/TSDoc for all public functions
- README in each package/module
- Architecture decision records (ADRs)
- Code comments for complex logic only

**API Documentation**:

- OpenAPI/Swagger specs auto-generated
- Authentication guide
- Rate limiting documentation
- Error codes and handling
- Example requests/responses
- Postman collections

**User Documentation**:

- Admin user guides (web dashboard)
- Customer app tutorials
- Driver app instructions
- Video walkthroughs
- FAQ and troubleshooting
- Release notes

**Developer Documentation**:

- Setup and installation guide
- Local development guide
- Architecture overview
- Database schema documentation
- Deployment runbooks
- Troubleshooting guides

### Knowledge Management

**Central Repository**: Notion / Confluence

**Structure**:

```
/CleanMateX Documentation
  /Architecture
    - System architecture
    - Database design
    - API design
    - Security architecture
  /Development
    - Setup guide
    - Coding standards
    - Git workflow
    - Testing guidelines
  /Operations
    - Deployment guide
    - Monitoring guide
    - Incident response
    - Runbooks
  /Product
    - Requirements
    - User stories
    - Release planning
    - Feature specifications
  /Design
    - Design system
    - UI components
    - UX guidelines
    - Branding assets
```

### Release Communication

**Release Notes Template**:

```markdown
## Version X.Y.Z - YYYY-MM-DD

### New Features

- [Feature name]: Description

### Improvements

- [Area]: What improved

### Bug Fixes

- [Issue #123]: What was fixed

### Breaking Changes

- [API/Feature]: What changed and migration path

### Deprecations

- [Feature]: What's deprecated, timeline for removal
```

**Communication Channels**:

- In-app notifications for customers
- Email to tenant admins
- Changelog page on website
- Blog post for major releases
- Social media announcements

### Support Documentation

**Support Tiers**:

- **Tier 1**: Self-service (FAQ, docs, videos)
- **Tier 2**: Email support (response within 24h)
- **Tier 3**: Phone/video support (premium plans)

**Support Resources**:

- Knowledge base (help.cleanmatex.com)
- Video tutorial library
- Community forum (future)
- Live chat (premium plans)

---

## Appendix

### Glossary

- **Assembly**: Process of collecting all pieces of an order before QA
- **B2B**: Business-to-business (corporate customers)
- **DDD**: Domain-Driven Design
- **POD**: Proof of Delivery
- **QA**: Quality Assurance (inspection checkpoint)
- **Quick Drop**: Rapid order intake where itemization happens later
- **RLS**: Row-Level Security
- **RTL**: Right-to-Left (Arabic text direction)
- **SLA**: Service Level Agreement
- **Stub Profile**: Minimal customer record (name + phone)
- **Tenant**: Individual laundry business using the platform

### Reference Documents

- Requirements: `docs/Requirments Specifications/clean_mate_x_unified_requirements_pack_v_0.12.1.md`
- Database Schema: `supabase/migrations/0001_core.sql`
- RLS Policies: `supabase/migrations/0002_rls_core.sql`
- Seed Data: `supabase/migrations/0003_seed_core.sql`
- Architecture: `docs/Complete Project Structure Documentation_Draft suggestion_01.md`
- Project Context: `CLAUDE.md`

### Version History

| Version | Date       | Changes             | Author           |
| ------- | ---------- | ------------------- | ---------------- |
| 1.0     | 2025-10-09 | Initial master plan | Development Team |

---

**End of Master Development Plan**

For detailed implementation plans, refer to individual module documents:

- `001_infrastructure_setup_dev_prd.md` through `058_documentation_training_dev_prd.md`
