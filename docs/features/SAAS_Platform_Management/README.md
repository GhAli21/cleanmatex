---
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
---

# CleanMateX Platform HQ Console

## Overview

The **Platform HQ Console** is a standalone, enterprise-grade administrative application for managing the entire CleanMateX SaaS platform. It provides comprehensive tools for tenant lifecycle management, billing, analytics, security governance, compliance, and infrastructure operations.

### Key Characteristics

- **Standalone Module**: Completely separate from tenant-facing `web-admin` application
- **Internal Use Only**: Designed for platform administrators and team members
- **Enterprise-Grade**: Production-ready with observability, security, and compliance features
- **Comprehensive**: Covers all aspects of SaaS platform management

---

## Architecture

```
cleanmatex/
├── web-admin/          # Tenant-facing dashboard (existing)
├── platform-admin/     # NEW: Standalone HQ Console
│   ├── Separate login
│   ├── Separate authentication realm
│   ├── Platform-specific features
│   └── Independent deployment
├── backend/            # Shared API (NestJS)
├── workers/            # Background job processors
└── packages/           # Shared code libraries
```

---

## Core Features

### 1. Tenant Management
- Tenant lifecycle (trial → active → suspended → cancelled)
- Tenant provisioning & onboarding
- Health scoring & churn prediction
- Tenant impersonation for support
- Custom tenant configurations

### 2. Billing & Subscriptions
- Subscription plan management
- Automated invoice generation
- Payment processing & reconciliation
- Usage-based billing
- Dunning & failed payment handling

### 3. Analytics & Reporting
- Cross-tenant KPIs & metrics
- Revenue analytics (MRR, ARR, LTV)
- Usage patterns & trends
- Churn analysis & cohort reports
- Custom dashboards

### 4. Support & Ticketing
- Support ticket management
- SLA tracking & escalation
- Secure tenant impersonation
- Customer communication log
- Knowledge base management

### 5. Infrastructure & Operations
- Background job management
- System monitoring & alerting
- Performance metrics
- Security governance
- Deployment automation

### 6. Compliance & Governance
- GDPR, SOC 2, ISO 27001 tools
- Data residency management
- Backup & disaster recovery
- Audit trails
- Policy management

---

## User Personas

### 1. Super Admin (You)
- Full platform access
- System configuration
- Tenant management
- Billing oversight

### 2. Support Staff
- Tenant impersonation
- Ticket management
- Customer communication
- Issue resolution

### 3. Billing Manager
- Invoice management
- Payment processing
- Revenue reporting
- Subscription management

### 4. Analyst
- Analytics dashboards
- Report generation
- Data exports
- Trend analysis

---

## Technology Stack

### Frontend (Platform-Admin)
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5+
- **UI**: React 19, Tailwind CSS v4
- **State**: React Query + Zustand
- **Charts**: Recharts, Chart.js

### Backend Services
- **API**: NestJS (shared with web-admin)
- **Database**: PostgreSQL 16 (Supabase)
- **Workers**: BullMQ + Redis
- **Cache**: Redis 7+

### Infrastructure
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston/Pino
- **Tracing**: OpenTelemetry
- **Error Tracking**: Sentry
- **APM**: New Relic (optional)

---

## Key Differences from Web-Admin

| Aspect | Web-Admin (Tenant) | Platform-Admin (HQ) |
|--------|-------------------|---------------------|
| **Users** | Tenant staff | Platform admins |
| **Data Scope** | Single tenant (RLS) | All tenants (service role) |
| **Authentication** | Tenant-scoped JWT | Platform admin JWT |
| **Purpose** | Run laundry business | Manage SaaS platform |
| **URL** | `/dashboard/*` | `/platform-admin/*` |
| **Deployment** | Vercel | Separate instance |

---

## Security & Access Control

### Authentication
- Separate authentication realm
- Multi-factor authentication (MFA) mandatory
- Session management
- IP whitelisting (optional)

### Authorization
- Permission-based access control (PBAC)
- Role-based permissions (super_admin, support, billing, analyst)
- Granular permission system (e.g., `tenants:read`, `billing:write`)

### Audit & Compliance
- All admin actions logged
- Tenant impersonation tracking
- Data access audit trail
- Compliance reporting

---

## Implementation Status

### Current Status: Planning & Design Phase

**Completed:**
- ✅ Requirements gathering
- ✅ Architecture design
- ✅ PRD structure definition
- ✅ Documentation framework

**In Progress:**
- 🚧 PRD documentation (0001-0023)
- 🚧 Database schema design
- 🚧 Technical architecture diagrams

**Planned:**
- ⏳ Database migrations
- ⏳ Platform-admin application scaffold
- ⏳ Core services implementation
- ⏳ UI development
- ⏳ Testing & QA

---

## Quick Links

### Documentation
- [Development Plan](development_plan.md) - 32-week implementation roadmap
- [PRDs](PRDs/) - Detailed product requirements (23 PRDs)
- [Technical Docs](technical_docs/) - Architecture & design specs
- [Developer Guide](developer_guide.md) - Implementation guide
- [User Guide](user_guide.md) - Platform admin user manual

### Related Resources
- [Project Root CLAUDE.md](../../../CLAUDE.md)
- [Architecture Documentation](../../../.claude/docs/architecture.md)
- [Multi-Tenancy Rules](../../../.claude/docs/multitenancy.md)
- [Database Conventions](../../../.claude/docs/database_conventions.md)

---

## Getting Started (Future)

Once implemented, platform admins will:

1. **Access Platform Console**: Navigate to `https://platform.cleanmatex.com`
2. **Login**: Use platform admin credentials (separate from tenant logins)
3. **Dashboard**: View platform-wide metrics and health
4. **Manage Tenants**: Create, configure, suspend, or delete tenants
5. **Monitor Billing**: Track subscriptions, invoices, and revenue
6. **Provide Support**: Impersonate tenants, manage tickets
7. **Configure System**: Manage plans, features, settings

---

## Roadmap

### Phase 1: Foundation (Weeks 1-4)
- Database schema & migrations
- Authentication & authorization
- Platform-admin application scaffold
- Core tenant management

### Phase 2: Core Features (Weeks 5-12)
- Billing & subscriptions
- Analytics & reporting
- Support & ticketing
- Data management

### Phase 3: Infrastructure (Weeks 13-20)
- Workers & automation
- Observability
- Security & governance
- AI/ML integration
- CI/CD pipelines

### Phase 4: Data & Compliance (Weeks 21-26)
- Multi-region support
- Backup & BCDR
- Import/export tools
- Compliance framework

### Phase 5: Developer & Testing (Weeks 27-30)
- Developer portal
- Comprehensive testing
- Performance optimization

### Phase 6: Launch (Weeks 31-32)
- Security audit
- Production deployment
- Team training

---

## Support & Contact

**Project Lead**: Gehad Abdo Mohammed Ali
**Documentation Standards**: `.claude/docs/documentation_rules.md`
**Questions**: Refer to specific PRDs in `PRDs/` directory

---

**Version**: v0.1.0
**Status**: Planning & Design Phase
**Last Updated**: 2025-01-14
