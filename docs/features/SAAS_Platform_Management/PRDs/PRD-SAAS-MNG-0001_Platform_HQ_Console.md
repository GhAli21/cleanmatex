---
prd_code: PRD-SAAS-MNG-0001
title: Platform HQ Console (Master PRD)
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: Critical
category: Platform Management
---

# PRD-SAAS-MNG-0001: Platform HQ Console (Master PRD)

## Executive Summary

The **Platform HQ Console** is a standalone, enterprise-grade administrative application for managing the entire CleanMateX SaaS platform. It serves as the central command center for platform administrators to manage tenants, billing, analytics, compliance, security, and infrastructure operations.

### Problem Statement

Currently, CleanMateX has:
- ✅ Excellent tenant-facing `web-admin` dashboard
- ✅ Robust multi-tenancy database architecture
- ✅ Comprehensive subscription/plan system
- ❌ **NO platform administration interface**
- ❌ **NO way to manage all tenants from central console**
- ❌ **NO platform billing or analytics tools**
- ❌ **NO support ticketing system**
- ❌ **NO infrastructure monitoring dashboard**

### Solution

Build a **standalone platform-admin application** completely separate from the tenant-facing web-admin, providing comprehensive SaaS platform management capabilities.

---

## 1. Internal SaaS HQ Model

### 1.1 Not a Public Self-Serve System

**Key Characteristics:**
- **Internal Use Only**: Accessible only to platform team members
- **Curated Onboarding**: You control tenant creation and activation
- **Manual Approval**: Subscription changes reviewed and approved by team
- **White-Glove Service**: High-touch customer relationships (GCC market preference)
- **Quality Control**: Ensure all tenants meet platform standards

### 1.2 Why Internal Model?

**Business Reasons:**
1. **Market Fit**: GCC B2B customers prefer relationship-based sales
2. **Quality Assurance**: Maintain platform reputation
3. **Revenue Protection**: Prevent fraudulent signups
4. **Compliance**: Verify business licenses and regulatory requirements
5. **Pricing Flexibility**: Negotiate custom enterprise deals

**Technical Reasons:**
1. **Simpler Implementation**: No self-serve signup flows
2. **Better Security**: Reduced attack surface
3. **Resource Control**: Prevent platform abuse
4. **Support Quality**: Know every customer personally

---

## 2. User Personas (Internal Team)

### 2.1 Super Admin (You - Platform Owner)

**Responsibilities:**
- Overall platform strategy
- Tenant approval and provisioning
- Subscription plan management
- Financial oversight
- System configuration
- Team management

**Access Level**: Full platform access (all permissions)

**Typical Tasks:**
- Create new tenant organizations
- Approve subscription upgrades
- Configure platform-wide settings
- Review revenue reports
- Manage platform admin users
- Override tenant limits (enterprise custom deals)

### 2.2 Support Staff

**Responsibilities:**
- Customer support
- Ticket management
- Issue resolution
- Tenant assistance
- Data corrections

**Access Level**: Limited (support permissions only)

**Typical Tasks:**
- Respond to support tickets
- Impersonate tenants for troubleshooting
- View tenant activity logs
- Reset passwords
- Resolve data issues

### 2.3 Billing Manager

**Responsibilities:**
- Invoice management
- Payment tracking
- Revenue reconciliation
- Subscription management
- Failed payment handling

**Access Level**: Billing module only

**Typical Tasks:**
- Generate monthly invoices
- Process payments
- Handle failed payment issues (dunning)
- Create custom pricing agreements
- Export financial reports

### 2.4 Analyst

**Responsibilities:**
- Data analysis
- Reporting
- Trend identification
- Business intelligence
- Performance tracking

**Access Level**: Read-only analytics access

**Typical Tasks:**
- Create custom reports
- Analyze usage trends
- Identify churn risks
- Generate executive dashboards
- Export data for analysis

---

## 3. Feature Categories Overview

### 3.1 Core Platform Management

| Feature Category | PRD Reference | Priority | Description |
|-----------------|---------------|----------|-------------|
| Tenant Lifecycle | PRD-SAAS-MNG-0002 | Critical | Create, manage, suspend, delete tenants |
| Billing & Subscriptions | PRD-SAAS-MNG-0003 | Critical | Invoice generation, payment processing |
| Analytics & Reporting | PRD-SAAS-MNG-0004 | High | Cross-tenant metrics, revenue tracking |
| Support & Ticketing | PRD-SAAS-MNG-0005 | High | Support ticket system, impersonation |
| Core Data Management | PRD-SAAS-MNG-0006 | Critical | System code tables, seed data |
| Workflow Engine | PRD-SAAS-MNG-0007 | Medium | Workflow template management |
| Customer Master Data | PRD-SAAS-MNG-0008 | Medium | Global customer registry |
| Auth & Authorization | PRD-SAAS-MNG-0009 | Critical | Platform admin users, permissions |
| Platform Configuration | PRD-SAAS-MNG-0010 | High | System settings, feature flags |

### 3.2 Infrastructure & Operations

| Feature Category | PRD Reference | Priority | Description |
|-----------------|---------------|----------|-------------|
| Automation & Workers | PRD-SAAS-MNG-0011 | High | Background jobs, scheduled tasks |
| Observability & SLO | PRD-SAAS-MNG-0012 | Critical | Monitoring, alerting, performance |
| Security & Governance | PRD-SAAS-MNG-0013 | Critical | Audit logs, RLS management, security |
| AI / Automation | PRD-SAAS-MNG-0014 | Medium | Churn prediction, ML features |
| CI/CD & Schema Control | PRD-SAAS-MNG-0015 | High | Deployment pipelines, migrations |
| Deployment & Ops | PRD-SAAS-MNG-0016 | High | Deployment strategies, operations |

### 3.3 Data & Compliance

| Feature Category | PRD Reference | Priority | Description |
|-----------------|---------------|----------|-------------|
| Data Residency & Multi-Region | PRD-SAAS-MNG-0017 | Medium | GCC focus, international capability |
| Backup, BCDR & Restore | PRD-SAAS-MNG-0018 | Critical | Backup, disaster recovery, tenant restore |
| Import / Export & Onboarding | PRD-SAAS-MNG-0019 | High | Data import/export, onboarding automation |
| Compliance & Policy | PRD-SAAS-MNG-0020 | High | GDPR, SOC 2, policy management |

### 3.4 Developer & Testing

| Feature Category | PRD Reference | Priority | Description |
|-----------------|---------------|----------|-------------|
| Developer Portal | PRD-SAAS-MNG-0021 | Medium | Internal API docs, integration tools |
| Testing & QA Matrix | PRD-SAAS-MNG-0022 | High | Test coverage, QA processes |
| Performance Guardrails | PRD-SAAS-MNG-0023 | High | Performance monitoring, load limits |

---

## 4. Architecture Decisions

### 4.1 Standalone Application (Confirmed)
- **Description**: Separate applications for frontend and backend
- **Decision and Acceptance Criteria**:
  - `platform-web`: as a completely separate Next.js frontend application
  - `platform-api`: as a completely separate Backend API (NestJS or Next.js API routes)
  - `platform-workers`: as a completely separate Background workers (optional)
  - Independent codebases
  - No shared code with web-admin

**Rationale:**
1. **Security Isolation**: Zero risk of tenant users accessing platform features
2. **Clear Separation**: No route conflicts or permission confusion
3. **Independent Deployment**: Update platform tools without affecting tenants
4. **Different Authentication**: Platform admins use separate auth realm
5. **Custom Branding**: Internal tool aesthetic vs customer-facing polish

**Trade-offs:**
- ✅ **Pro**: Better security, clearer code organization
- ✅ **Pro**: Independent scaling and deployment
- ❌ **Con**: Some code duplication (mitigated by shared packages)
- ❌ **Con**: Two applications to maintain (acceptable for security gain)

### 4.2 Application Structure

```
cleanmatex/
├── web-admin/              # Tenant-facing (existing)
│   ├── Port: 3000
│   ├── Auth: Tenant-scoped JWT
│   ├── RLS: Enforced
│   └── Users: Tenant staff
│
├── platform-admin/         # Platform HQ (NEW)
│   ├── Port: 3001
│   ├── Auth: Platform admin JWT
│   ├── RLS: Bypassed with service role
│   └── Users: Internal team
│
├── platform-api/                # Shared API (NestJS)
│   ├── Port: 3002
│   ├── Serves both web-admin and platform-admin
│   └── Separate API endpoints for platform
│
├── platform-workers/                # Background Jobs 
│   ├── BullMQ + Redis
│   └── Scheduled tasks
│
└── packages/               # Shared Libraries
    ├── @cleanmatex/types
    ├── @cleanmatex/utils
    └── @cleanmatex/database
```

### 4.3 Data Access Strategy

**Platform Admin Database Access:**

```typescript
// Platform admins bypass RLS using service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role key
);

// All platform admin actions are audited
await auditLog({
  admin_id: session.user.id,
  action: 'view_tenant_details',
  tenant_id: targetTenantId,
  ip_address: req.ip,
  metadata: { /* context */ }
});

// Query across all tenants
const allTenants = await supabaseAdmin
  .from('org_tenants_mst')
  .select('*')
  .order('created_at', { ascending: false });
```

**Why Service Role?**
- Platform admins need cross-tenant visibility
- RLS would block necessary operations
- Audit logging provides accountability
- Defense-in-depth: application-level permissions still enforced

### 4.4 Authentication Architecture

**Separate Authentication Realms:**

| Aspect | Web-Admin (Tenant) | Platform-Admin (HQ) |
|--------|-------------------|---------------------|
| **Supabase Project** | Same Supabase instance | Same instance, different metadata |
| **JWT Claims** | `{ tenant_org_id, role: 'admin' }` | `{ platform_role: 'super_admin', permissions: [...] }` |
| **User Table** | `org_users_mst` | `sys_platform_users` (NEW) |
| **Login URL** | `/login` | `/platform-admin/login` |
| **Session Storage** | `supabase-auth-token` | `platform-auth-token` |
| **MFA** | Optional | **Mandatory** |

**Implementation:**

```typescript
// Platform admin user creation
await supabase.auth.admin.createUser({
  email: 'admin@cleanmatex.com',
  password: securePassword,
  email_confirm: true,
  user_metadata: {
    platform_admin: true,
    platform_role: 'super_admin',
    permissions: ['*'], // All permissions
    full_name: 'Platform Admin',
    created_by: currentAdminId
  }
});

// Separate from tenant users
await db.sys_platform_users.insert({
  id: userId,
  auth_user_id: authUser.id,
  platform_role: 'super_admin',
  permissions: ['tenants:*', 'billing:*', 'support:*', 'system:*'],
  is_active: true,
  mfa_enabled: true
});
```

---

## 5. Security & Compliance

### 5.1 Access Control

**Permission-Based Access Control (PBAC):**

```typescript
// Permission format: resource:action
// Examples:
// - tenants:read, tenants:write, tenants:delete
// - billing:read, billing:write
// - support:impersonate
// - system:configure

interface PlatformAdminPermissions {
  super_admin: ['*'];  // All permissions
  support: [
    'tenants:read',
    'support:*',
    'customers:read',
    'orders:read',
    'impersonate:tenant'
  ];
  billing: [
    'tenants:read',
    'billing:*',
    'subscriptions:*',
    'invoices:*'
  ];
  analyst: [
    'analytics:read',
    'tenants:read',
    'reports:generate'
  ];
}
```

### 5.2 Audit Trail

**All Platform Admin Actions Logged:**

```sql
CREATE TABLE sys_platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES sys_platform_users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),  -- 'tenant', 'invoice', 'user', etc.
  resource_id UUID,
  tenant_org_id UUID,  -- If action affects specific tenant
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit queries
CREATE INDEX idx_platform_audit_admin ON sys_platform_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_platform_audit_tenant ON sys_platform_audit_log(tenant_org_id, created_at DESC);
CREATE INDEX idx_platform_audit_action ON sys_platform_audit_log(action, created_at DESC);
```

**Auditable Actions:**
- Tenant creation/deletion/suspension
- Subscription changes
- Billing operations
- Tenant impersonation (CRITICAL)
- System configuration changes
- User permission changes
- Data exports
- Support ticket access

### 5.3 Tenant Impersonation Security

**Secure Impersonation Pattern:**

```typescript
async function impersonateTenant(adminId: string, tenantId: string) {
  // 1. Verify admin has permission
  const admin = await getAdminUser(adminId);
  if (!admin.permissions.includes('impersonate:tenant')) {
    throw new Error('Permission denied');
  }

  // 2. Audit the impersonation START
  await auditLog({
    admin_user_id: adminId,
    action: 'impersonate_start',
    tenant_org_id: tenantId,
    metadata: { reason: 'Support assistance' }
  });

  // 3. Create time-limited impersonation token
  const impersonationToken = await createToken({
    admin_id: adminId,
    tenant_id: tenantId,
    impersonation: true,
    expires_at: Date.now() + (30 * 60 * 1000), // 30 minutes
  });

  // 4. Return modified session
  return {
    token: impersonationToken,
    watermark: 'IMPERSONATING: Tenant XYZ',
    expires_at: impersonationToken.expires_at
  };
}

// Auto-expire and log end
async function endImpersonation(adminId: string, tenantId: string) {
  await auditLog({
    admin_user_id: adminId,
    action: 'impersonate_end',
    tenant_org_id: tenantId
  });
}
```

**Impersonation UI Requirements:**
- Prominent red banner: "IMPERSONATING TENANT: {name}"
- Countdown timer showing remaining session time
- "End Impersonation" button always visible
- All actions logged during impersonation
- Automatic session termination after 30 minutes

---

## 6. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Goals:**
- Scaffold platform-admin application
- Create platform database schema
- Implement authentication
- Build core tenant management

**Deliverables:**
- ✅ `platform-admin/` Next.js application
- ✅ Database migrations for `sys_platform_*` tables
- ✅ Platform admin authentication flow
- ✅ Basic tenant list and detail pages
- ✅ Audit logging infrastructure

**Success Criteria:**
- Platform admin can log in
- View list of all tenants
- View individual tenant details
- All actions are audited

### Phase 2: Core Features (Weeks 5-12)

**Goals:**
- Billing & subscription management
- Analytics & reporting
- Support & ticketing
- Data management tools

**Deliverables:**
- ✅ Billing dashboard with invoice management
- ✅ Analytics dashboards (revenue, usage, churn)
- ✅ Support ticketing system
- ✅ Core data management UI (code tables)
- ✅ Tenant impersonation functionality

**Success Criteria:**
- Generate monthly invoices automatically
- View platform-wide analytics
- Create and manage support tickets
- Impersonate tenants securely
- Manage system code tables

### Phase 3: Infrastructure (Weeks 13-20)

**Goals:**
- Workers & automation
- Observability stack
- Security & governance
- AI/ML features
- CI/CD pipelines

**Deliverables:**
- ✅ BullMQ worker infrastructure
- ✅ Prometheus + Grafana monitoring
- ✅ Sentry error tracking
- ✅ Churn prediction model
- ✅ Automated deployment pipeline

**Success Criteria:**
- Background jobs processing reliably
- Real-time monitoring dashboards
- Errors automatically tracked
- Churn predictions available
- One-click deployments

### Phase 4: Data & Compliance (Weeks 21-26)

**Goals:**
- Multi-region support
- Backup & disaster recovery
- Import/export tools
- Compliance framework

**Deliverables:**
- ✅ Multi-region database setup (GCC primary)
- ✅ Automated backup system
- ✅ Tenant data import/export tools
- ✅ GDPR compliance tools
- ✅ SOC 2 preparation documentation

**Success Criteria:**
- Data stored in GCC region
- Daily automated backups
- Tenant data exportable
- GDPR requests handled
- Compliance reports generated

### Phase 5: Developer & Testing (Weeks 27-30)

**Goals:**
- Internal developer portal
- Comprehensive testing
- Performance optimization

**Deliverables:**
- ✅ API documentation portal
- ✅ Complete test suite (unit, integration, E2E)
- ✅ Performance monitoring
- ✅ Load testing results

**Success Criteria:**
- 80%+ test coverage
- All API endpoints documented
- Performance targets met
- Load testing passed

### Phase 6: Launch (Weeks 31-32)

**Goals:**
- Security audit
- Production deployment
- Team training

**Deliverables:**
- ✅ Security audit report
- ✅ Production deployment
- ✅ Team training materials
- ✅ User documentation

**Success Criteria:**
- Security audit passed
- Platform live in production
- Team trained on all features

---

## 7. Dependencies & Integration Points

### 7.1 Existing Systems

**Database (Supabase PostgreSQL):**
- Reads/writes all `sys_*` and `org_*` tables
- Uses service role for cross-tenant access
- Respects existing schema conventions

**Web-Admin Application:**
- No direct integration (separate apps)
- Shares database schema
- Platform can impersonate and access tenant views

**Backend API (Future):**
- Platform-admin will call backend APIs
- Shared authentication middleware
- Separate API endpoints for platform operations

### 7.2 External Services

**Payment Gateways:**
- Stripe (international)
- HyperPay (GCC)
- PayTabs (GCC)
- Integration for subscription billing

**Communication:**
- WhatsApp Business API (customer notifications)
- Email (SendGrid/AWS SES)
- SMS (Twilio)

**Monitoring & Observability:**
- Prometheus (metrics)
- Grafana (dashboards)
- Sentry (error tracking)
- New Relic (APM - optional)

**Infrastructure:**
- Vercel (hosting)
- Supabase (database, auth, storage)
- Redis (caching, queues)
- S3 (backups, exports)

---

## 8. Success Metrics

### 8.1 Platform Health

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Monthly availability |
| API Response Time | p95 < 800ms | Prometheus metrics |
| Database Query Time | p95 < 100ms | Supabase logs |
| Error Rate | < 0.1% | Sentry tracking |

### 8.2 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Active Tenants | Track growth | Monthly count |
| MRR (Monthly Recurring Revenue) | Track growth | Billing dashboard |
| Churn Rate | < 5% monthly | Analytics dashboard |
| Customer LTV | Maximize | Revenue analytics |
| Average Support Ticket Resolution | < 24 hours | Support metrics |

### 8.3 Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Deployment Frequency | Weekly | CI/CD logs |
| Failed Deployment Rate | < 5% | Deployment dashboard |
| Mean Time to Recovery (MTTR) | < 1 hour | Incident logs |
| Test Coverage | > 80% | Code coverage reports |

---

## 9. Risks & Mitigations

### 9.1 Security Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Platform admin account compromise | Critical | Low | MFA mandatory, IP whitelisting, audit logs |
| Unauthorized tenant data access | Critical | Medium | PBAC, audit logging, time-limited sessions |
| Cross-tenant data leak | Critical | Low | Service role access logged, code reviews |
| Impersonation abuse | High | Low | Time limits, watermarks, audit trail |

### 9.2 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Platform downtime affecting all tenants | Critical | Low | Multi-region, monitoring, failover |
| Database migration failure | Critical | Medium | Staging tests, rollback scripts, backups |
| Payment gateway issues | High | Medium | Multiple gateways, retry logic, alerts |
| Background job failures | Medium | Medium | Queue monitoring, retry mechanisms, alerts |

### 9.3 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Compliance violations (GDPR, etc.) | Critical | Low | Compliance tools, legal review, audits |
| Tenant churn due to platform issues | High | Medium | Monitoring, proactive support, SLAs |
| Scaling challenges | Medium | Medium | Performance monitoring, load testing |
| Data loss | Critical | Very Low | Automated backups, BCDR, redundancy |

---

## 10. Open Questions & Decisions Needed

### 10.1 Technical Decisions

- [ ] **Hosting**: Vercel, Railway, or self-hosted VPS for platform-admin?
- [ ] **APM**: New Relic, Datadog, or open-source alternative?
- [ ] **Multi-region**: When to implement? (Phase 4 planned)
- [ ] **Kubernetes**: Future migration or stick with simpler deployment?

### 10.2 Business Decisions

- [ ] **Pricing**: Finalize subscription plan pricing for GCC market
- [ ] **Payment Gateway**: Primary gateway (HyperPay vs PayTabs)?
- [ ] **Support SLAs**: Define response/resolution time targets
- [ ] **White-label**: Offer white-label option? (Enterprise plan)

### 10.3 Process Decisions

- [ ] **Tenant Approval**: Manual approval process details?
- [ ] **Billing Cycle**: Monthly, annual, or both?
- [ ] **Onboarding**: Self-service data import or assisted migration?
- [ ] **Support Model**: Ticketing only or include phone/video support?

---

## 11. Related PRDs

This master PRD provides the overall vision and architecture. Detailed specifications for each feature area are in:

### Core Platform (0002-0010)
- [PRD-SAAS-MNG-0002: Tenant Lifecycle Management](PRD-SAAS-MNG-0002_Tenant_Lifecycle.md)
- [PRD-SAAS-MNG-0003: Billing & Subscription Management](PRD-SAAS-MNG-0003_Billing_Subscriptions.md)
- [PRD-SAAS-MNG-0004: Analytics & Reporting](PRD-SAAS-MNG-0004_Analytics_Reporting.md)
- [PRD-SAAS-MNG-0005: Support & Ticketing System](PRD-SAAS-MNG-0005_Support_Ticketing.md)
- [PRD-SAAS-MNG-0006: Core Data & Code Management](PRD-SAAS-MNG-0006_Core_Data_Management.md)
- [PRD-SAAS-MNG-0007: Workflow Engine Management](PRD-SAAS-MNG-0007_Workflow_Engine.md)
- [PRD-SAAS-MNG-0008: Customer Master Data Management](PRD-SAAS-MNG-0008_Customer_Master_Data.md)
- [PRD-SAAS-MNG-0009: Auth & Authorization](PRD-SAAS-MNG-0009_Auth_Authorization.md)
- [PRD-SAAS-MNG-0010: Platform Configuration](PRD-SAAS-MNG-0010_Platform_Configuration.md)

### Infrastructure (0011-0016)
- [PRD-SAAS-MNG-0011: Automation & Workers](PRD-SAAS-MNG-0011_Automation_Workers.md)
- [PRD-SAAS-MNG-0012: Observability & SLO](PRD-SAAS-MNG-0012_Observability_SLO.md)
- [PRD-SAAS-MNG-0013: Security & Governance](PRD-SAAS-MNG-0013_Security_Governance.md)
- [PRD-SAAS-MNG-0014: AI / Automation Layer](PRD-SAAS-MNG-0014_AI_Automation.md)
- [PRD-SAAS-MNG-0015: CI/CD & Schema Control](PRD-SAAS-MNG-0015_CICD_Schema_Control.md)
- [PRD-SAAS-MNG-0016: Deployment & Ops](PRD-SAAS-MNG-0016_Deployment_Ops.md)

### Data & Compliance (0017-0020)
- [PRD-SAAS-MNG-0017: Data Residency & Multi-Region](PRD-SAAS-MNG-0017_Data_Residency_MultiRegion.md)
- [PRD-SAAS-MNG-0018: Backup, BCDR & Restore](PRD-SAAS-MNG-0018_Backup_BCDR.md)
- [PRD-SAAS-MNG-0019: Import / Export & Onboarding](PRD-SAAS-MNG-0019_Import_Export_Onboarding.md)
- [PRD-SAAS-MNG-0020: Compliance & Policy Management](PRD-SAAS-MNG-0020_Compliance_Policy.md)

### Developer & Testing (0021-0023)
- [PRD-SAAS-MNG-0021: Developer & Integration Portal](PRD-SAAS-MNG-0021_Developer_Portal.md)
- [PRD-SAAS-MNG-0022: Testing & QA Matrix](PRD-SAAS-MNG-0022_Testing_QA.md)
- [PRD-SAAS-MNG-0023: Performance & Load Guardrails](PRD-SAAS-MNG-0023_Performance_Guardrails.md)

---

## 12. Approval & Sign-off

**Product Owner**: Gehad Abdo Mohammed Ali
**Status**: Planning Phase - Awaiting Final Approval
**Version**: v0.1.0
**Last Updated**: 2025-01-14

### Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v0.1.0 | 2025-01-14 | Initial PRD creation | Gehad Abdo Mohammed Ali |

---

## Appendix A: Terminology

- **Platform Admin**: Internal team member with access to platform-admin console
- **Tenant**: Customer organization using CleanMateX
- **Impersonation**: Platform admin accessing tenant account for support
- **Service Role**: Supabase admin key that bypasses RLS
- **PBAC**: Permission-Based Access Control
- **SLO**: Service Level Objective
- **BCDR**: Business Continuity & Disaster Recovery
- **MRR**: Monthly Recurring Revenue
- **ARR**: Annual Recurring Revenue
- **LTV**: Customer Lifetime Value

---

**End of PRD-SAAS-MNG-0001**
