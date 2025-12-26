# PRD Structure: CleanMateX HQ SaaS Platform Management (Complete)

## Overview

This plan organizes all SaaS Platform Management features into numbered PRD modules (PRD-SAAS-MNG-00xx) for the internal HQ Console used by the development team to manage the multi-tenant platform.

**Architecture**: The HQ Console is a **standalone module** with separate applications:

- **platform-web**: Next.js frontend application (HQ Console UI)
- **platform-api**: Backend API (NestJS or Next.js API routes)
- Independent authentication system and login
- Separate dashboard and UI
- Isolated from tenant-facing web-admin application
- Independent routing and navigation (separate domain or `/hq/*` routes)
- HQ-specific database access patterns (bypassing tenant RLS)
- Independent deployment pipelines for each module

**Project Structure**:

```
cleanmatex/
├── platform-web/          # HQ Console Frontend (Next.js)
├── platform-api/           # HQ Console Backend API
├── platform-workers/       # Background workers (optional)
├── web-admin/              # Tenant-facing admin (existing)
├── backend/               # Tenant-facing backend (existing)
└── ...
```

## PRD Module Structure

### PRD-SAAS-MNG-0001: Tenant Lifecycle Management

**Scope**: Complete tenant/organization creation, configuration, and lifecycle management

**Key Features**:

- Create new tenant organizations with initial setup
- Tenant profile management (name, contact, branding, settings)
- Tenant status management (active, suspended, trial, expired)
- Tenant initialization automation (subscription, branch, service categories)
- Tenant deletion/archival with data retention policies
- Bulk tenant operations
- Tenant search, filtering, and analytics
- Tenant impersonation for support debugging

**Database Tables**:

- `org_tenants_mst` (main tenant table)
- `org_subscriptions_mst` (subscription records)
- `org_branches_mst` (default branch creation)
- `org_service_category_cf` (service category enablement)

**API Endpoints**:

- `POST /api/hq/v1/tenants` - Create tenant
- `GET /api/hq/v1/tenants` - List tenants with filters
- `GET /api/hq/v1/tenants/:id` - Get tenant details
- `PATCH /api/hq/v1/tenants/:id` - Update tenant
- `POST /api/hq/v1/tenants/:id/initialize` - Trigger initialization
- `POST /api/hq/v1/tenants/:id/suspend` - Suspend tenant
- `POST /api/hq/v1/tenants/:id/activate` - Activate tenant
- `DELETE /api/hq/v1/tenants/:id` - Archive tenant

---

### PRD-SAAS-MNG-0002: Plans & Subscriptions Management

**Scope**: Plan definitions, subscription assignment, and limit enforcement

**Key Features**:

- Manage plan definitions (freemium, basic, pro, plus, enterprise)
- Plan feature flags and limits configuration
- Assign/modify/activate/stop subscriptions for tenants
- Subscription approval workflow
- Plan upgrade/downgrade management
- Usage tracking and limit enforcement
- Billing cycle management
- Trial period management
- Plan override capabilities (custom limits for specific tenants)

**Database Tables**:

- `sys_plan_subscriptions_types_cf` (plan definitions)
- `sys_plan_limits_cd` (plan limit definitions)
- `sys_features_code_cd` (feature code definitions)
- `sys_plan_features_cf` (plan-feature mappings)
- `sys_plan_limits_cf` (plan-limit mappings)
- `org_subscriptions_mst` (tenant subscriptions)

**API Endpoints**:

- `GET /api/hq/v1/plans` - List all plans
- `POST /api/hq/v1/plans` - Create new plan
- `PATCH /api/hq/v1/plans/:code` - Update plan
- `GET /api/hq/v1/tenants/:id/subscription` - Get tenant subscription
- `POST /api/hq/v1/tenants/:id/subscription` - Assign subscription
- `PATCH /api/hq/v1/tenants/:id/subscription` - Modify subscription
- `POST /api/hq/v1/tenants/:id/subscription/approve` - Approve subscription
- `POST /api/hq/v1/tenants/:id/subscription/activate` - Activate subscription
- `POST /api/hq/v1/tenants/:id/subscription/stop` - Stop subscription
- `GET /api/hq/v1/tenants/:id/usage` - Get usage statistics

---

### PRD-SAAS-MNG-0003: Workflow Engine Management

**Scope**: Global workflow templates, stages, and transitions management

**Key Features**:

- Create/edit/disable workflow templates (WF_STANDARD, WF_ASSEMBLY_QA, etc.)
- Manage workflow stages per template with sequence ordering
- Configure allowed transitions between stages with rules
- Transition validation rules (requires_scan_ok, requires_invoice, requires_pod)
- Workflow template versioning and rollback
- Assign workflow templates to tenants/service categories
- Visual workflow editor
- Workflow template cloning and customization

**Database Tables**:

- `sys_workflow_template_cd` (template definitions)
- `sys_workflow_template_stages` (stages per template)
- `sys_workflow_template_transitions` (allowed transitions)
- `org_tenant_workflow_templates_cf` (tenant-template assignments)
- `org_tenant_service_category_workflow_cf` (service category workflow assignments)

**API Endpoints**:

- `GET /api/hq/v1/workflow-templates` - List templates
- `POST /api/hq/v1/workflow-templates` - Create template
- `GET /api/hq/v1/workflow-templates/:id` - Get template details
- `PATCH /api/hq/v1/workflow-templates/:id` - Update template
- `POST /api/hq/v1/workflow-templates/:id/stages` - Add stage
- `PATCH /api/hq/v1/workflow-templates/:id/stages/:stageId` - Update stage
- `POST /api/hq/v1/workflow-templates/:id/transitions` - Add transition
- `POST /api/hq/v1/workflow-templates/:id/clone` - Clone template
- `POST /api/hq/v1/workflow-templates/:id/assign` - Assign to tenant

---

### PRD-SAAS-MNG-0004: Customer Data Management (Global & Tenant)

**Scope**: Two-layer customer management system

**Key Features**:

- Manage global customers (`sys_customers_mst`) - shared identity across tenants
- Manage tenant-specific customers (`org_customers_mst`)
- Link/unlink global customers to tenant customers
- Customer deduplication and merging
- Customer search across all tenants (with privacy controls)
- Customer data export and import
- Customer type management (`sys_customer_type_cd`)
- Customer preference management
- Customer activity tracking across tenants

**Database Tables**:

- `sys_customers_mst` (global customer master)
- `org_customers_mst` (tenant-scoped customers)
- `sys_customer_type_cd` (customer type codes)
- `org_customer_addresses` (customer addresses)

**API Endpoints**:

- `GET /api/hq/v1/customers/global` - List global customers
- `GET /api/hq/v1/customers/global/:id` - Get global customer
- `POST /api/hq/v1/customers/global/merge` - Merge duplicate customers
- `GET /api/hq/v1/tenants/:id/customers` - List tenant customers
- `POST /api/hq/v1/customers/global/:globalId/link/:tenantId` - Link global to tenant customer
- `GET /api/hq/v1/customers/search` - Search across all customers

---

### PRD-SAAS-MNG-0005: Authentication & User Management

**Scope**: Platform user management, roles, and permissions

**Key Features**:

- Manage HQ console users (internal team members)
- Role management (`sys_user_type_cd`)
- Permission assignment and RBAC
- User invitation and activation
- User deactivation and access revocation
- Audit logging of user actions
- Multi-factor authentication management
- Session management and security policies

**Database Tables**:

- `auth_users` (Supabase auth users)
- `sys_user_type_cd` (user type codes)
- `org_users_mst` (tenant users - if needed for HQ visibility)
- Audit tables for user actions

**API Endpoints**:

- `GET /api/hq/v1/users` - List HQ users
- `POST /api/hq/v1/users` - Create HQ user
- `PATCH /api/hq/v1/users/:id` - Update user
- `POST /api/hq/v1/users/:id/invite` - Send invitation
- `POST /api/hq/v1/users/:id/deactivate` - Deactivate user
- `GET /api/hq/v1/roles` - List roles
- `POST /api/hq/v1/roles` - Create role
- `GET /api/hq/v1/users/:id/permissions` - Get user permissions

---

### PRD-SAAS-MNG-0006: Core Data Management - Service Catalog

**Scope**: Service categories, types, and catalog management

**Key Features**:

- Manage service categories (`sys_service_category_cd`): DRY_CLEAN, LAUNDRY, IRON_ONLY, REPAIRS, ALTERATION
- Manage service types (`sys_service_type_cd`)
- Manage item fabric types (`sys_item_fabric_type_cd`)
- Manage item types (`sys_item_type_cd`)
- Manage default products/items (`sys_products_init_data_mst`)
- Manage item notes categories and codes (`sys_item_notes_ctg_cd`, `sys_item_notes_cd`)
- Manage stain types (`sys_item_stain_type_cd`)
- Manage preferences (`sys_preference_ctg_cd`, `sys_preference_options_cd`)
- Bilingual support (EN/AR) for all catalog items
- Catalog versioning and rollback
- Push catalog updates to tenants

**Database Tables**:

- `sys_service_category_cd`
- `sys_service_type_cd`
- `sys_item_fabric_type_cd`
- `sys_item_type_cd`
- `sys_products_init_data_mst`
- `sys_item_notes_ctg_cd`
- `sys_item_notes_cd`
- `sys_item_stain_type_cd`
- `sys_preference_ctg_cd`
- `sys_preference_options_cd`

**API Endpoints**:

- `GET /api/hq/v1/catalog/service-categories` - List service categories
- `POST /api/hq/v1/catalog/service-categories` - Create service category
- `PATCH /api/hq/v1/catalog/service-categories/:code` - Update category
- Similar endpoints for all catalog tables
- `POST /api/hq/v1/catalog/push/:tenantId` - Push updates to tenant

---

### PRD-SAAS-MNG-0007: Core Data Management - System Codes

**Scope**: All system reference codes and lookup tables

**Key Features**:

- Currency management (`sys_currency_cd`)
- Color codes (`sys_color_cd`)
- Icon codes (`sys_icons_cd`)
- Priority codes (`sys_priority_cd`)
- Product unit codes (`sys_product_unit_cd`) - Measurement Units
- Invoice type codes (`sys_invoice_type_cd`)
- Order status codes (`sys_order_status_cd`)
- Organization type codes (`sys_org_type_cd`)
- Payment method codes (`sys_payment_method_cd`): Pay on collect, cash, card, payment gateways
- Payment type codes (`sys_payment_type_cd`): Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup
- Order type codes (`sys_order_type_cd`)
- Bilingual support for all codes
- Code locking mechanism (prevent accidental edits)
- Code dependency validation

**Database Tables**:

- All `sys_*_cd` tables listed above

**API Endpoints**:

- `GET /api/hq/v1/codes/:tableName` - List codes for table
- `POST /api/hq/v1/codes/:tableName` - Create code
- `PATCH /api/hq/v1/codes/:tableName/:code` - Update code
- `DELETE /api/hq/v1/codes/:tableName/:code` - Delete code (soft delete)
- `POST /api/hq/v1/codes/:tableName/:code/lock` - Lock code from editing

---

### PRD-SAAS-MNG-0008: Data Seeding & Initialization

**Scope**: Automated data seeding and tenant initialization

**Key Features**:

- Seed script management for core data
- Tenant initialization automation
- Default data templates
- Seed data versioning
- Rollback capabilities
- Bulk seed operations
- Seed data validation
- Migration integration

**Database Tables**:

- All `sys_*` tables for seeding
- Seed version tracking table

**API Endpoints**:

- `POST /api/hq/v1/seeds/run` - Run seed scripts
- `POST /api/hq/v1/seeds/validate` - Validate seed data
- `GET /api/hq/v1/seeds/versions` - List seed versions
- `POST /api/hq/v1/seeds/rollback/:version` - Rollback to version

---

### PRD-SAAS-MNG-0009: Platform Analytics & Monitoring

**Scope**: Platform-wide metrics, monitoring, and observability

**Key Features**:

- Platform KPIs dashboard (active tenants, orders processed, system latency)
- Tenant usage analytics
- Subscription health monitoring
- Alert center (expired plans, storage overuse, missing payments)
- System performance metrics
- Error tracking and reporting
- Audit log viewer
- Export capabilities for reports

**Database Tables**:

- Audit/logging tables
- Metrics aggregation tables

**API Endpoints**:

- `GET /api/hq/v1/analytics/platform` - Platform KPIs
- `GET /api/hq/v1/analytics/tenants` - Tenant analytics
- `GET /api/hq/v1/analytics/subscriptions` - Subscription analytics
- `GET /api/hq/v1/alerts` - List alerts
- `GET /api/hq/v1/audit-logs` - Audit logs with filters

---

### PRD-SAAS-MNG-0010: HQ Console UI Framework

**Scope**: Base UI components and navigation for HQ Console

**Key Features**:

- HQ Console layout and navigation
- Role-based UI rendering
- Dashboard widgets
- Data tables with advanced filtering
- Form builders for dynamic forms
- Bulk action interfaces
- Search and filter components
- Export/import UI components
- Audit log viewer UI
- Alert notification system

**UI Components**:

- Tenant management pages
- Plan management pages
- Workflow template editor
- Customer management pages
- Code management pages
- Analytics dashboards
- Settings pages

---

### PRD-SAAS-MNG-0011: Standalone Module Architecture

**Scope**: Complete isolation and independence of HQ Console

**Key Features**:

- Separate Next.js application (`hq-console/` directory)
- Independent authentication system (separate Supabase project or isolated auth)
- Separate login page and session management
- Independent routing (`/hq/*` routes or separate domain)
- Separate dashboard and navigation
- HQ-specific middleware and guards
- Isolated API routes (`/api/hq/*`)
- Separate environment configuration
- Independent deployment pipeline
- No dependency on tenant web-admin codebase

**Architecture**:

- Standalone Next.js app in `hq-console/` directory
- Separate Supabase client configuration
- Bypass tenant RLS policies for HQ operations
- Independent UI component library
- Separate build and deployment process

---

### PRD-SAAS-MNG-0012: Automation & Worker Architecture

**Scope**: Background jobs, queues, and automated workflows

**Key Features**:

- Job queue system (BullMQ, Bull, or similar)
- Scheduled tasks (subscription renewals, trial expirations, usage resets)
- Background workers for heavy operations
- Email notification workers
- Report generation workers
- Data synchronization workers
- Retry mechanisms and error handling
- Job monitoring and dashboard
- Worker scaling and load balancing
- Dead letter queue management

**Components**:

- Job queue infrastructure
- Worker processes
- Scheduler service
- Job monitoring dashboard
- Alert system for failed jobs

---

### PRD-SAAS-MNG-0013: Observability & SLO Enforcement

**Scope**: Monitoring, logging, and service level objectives

**Key Features**:

- Application performance monitoring (APM)
- Error tracking and alerting (Sentry integration)
- Log aggregation and analysis
- Service level indicators (SLIs) tracking
- Service level objectives (SLOs) enforcement
- Uptime monitoring
- Response time tracking
- Database query performance monitoring
- API endpoint monitoring
- Custom metrics and dashboards
- Alert rules and notifications
- SLA compliance reporting

**Tools Integration**:

- Sentry for error tracking
- Grafana for metrics visualization
- Prometheus for metrics collection
- ELK stack or similar for log aggregation

---

### PRD-SAAS-MNG-0014: Security, RLS & Governance

**Scope**: Security policies, RLS management, and governance controls

**Key Features**:

- Row Level Security (RLS) policy management
- RLS policy testing and validation
- Security audit logging
- Access control policy management
- Data encryption at rest and in transit
- Secrets management
- API rate limiting
- DDoS protection
- Security vulnerability scanning
- Compliance policy enforcement
- Data access governance
- Security incident response
- Penetration testing framework
- Security policy versioning

**Database**:

- RLS policy management interface
- Policy deployment automation
- Policy testing framework

---

### PRD-SAAS-MNG-0015: AI / Automation Layer

**Scope**: AI-powered features and intelligent automation

**Key Features**:

- AI-powered customer support (chatbot)
- Automated anomaly detection
- Predictive analytics for tenant churn
- Intelligent resource allocation
- Automated workflow suggestions
- Natural language processing for support tickets
- Image recognition for order items
- Automated data quality checks
- Smart alerting (reduce false positives)
- AI-powered recommendations
- Automated report generation
- Intelligent capacity planning

**AI Services**:

- OpenAI/Claude integration
- Custom ML models
- Vector database for embeddings
- Training data management

---

### PRD-SAAS-MNG-0016: CI/CD & Schema Control

**Scope**: Continuous integration, deployment, and database schema management

**Key Features**:

- CI/CD pipeline for HQ Console
- Automated testing in CI
- Database migration management
- Schema versioning and rollback
- Migration testing framework
- Staging environment management
- Production deployment automation
- Blue-green deployment support
- Database migration approval workflow
- Migration conflict detection
- Schema diff tools
- Migration rollback procedures
- Environment-specific configuration management

**Tools**:

- GitHub Actions / GitLab CI
- Supabase migration system
- Database migration testing framework

---

### PRD-SAAS-MNG-0017: Deployment & Ops

**Scope**: Production deployment and operational management

**Key Features**:

- Production deployment procedures
- Environment management (dev, staging, prod)
- Infrastructure as Code (IaC)
- Container orchestration (if applicable)
- Health check endpoints
- Graceful shutdown handling
- Zero-downtime deployments
- Rollback procedures
- Configuration management
- Secrets management in production
- SSL/TLS certificate management
- CDN configuration
- Load balancing configuration
- Auto-scaling policies

**Infrastructure**:

- Vercel/Netlify for Next.js deployment
- Supabase for database
- Infrastructure monitoring

---

### PRD-SAAS-MNG-0018: Licensing & Entitlements (Internal)

**Scope**: Internal licensing and feature entitlement management

**Key Features**:

- License key generation and management
- Feature entitlement tracking
- License validation
- Trial license management
- Enterprise license management
- License expiration handling
- Feature flag integration with licensing
- Usage-based licensing support
- License audit and reporting
- License compliance monitoring

**Database**:

- License management tables
- Entitlement tracking
- Usage metering

---

### PRD-SAAS-MNG-0019: Tenant/Org Customization Layer

**Scope**: Tenant-specific customizations and configurations

**Key Features**:

- Tenant-specific branding (logo, colors, domain)
- Custom field management per tenant
- Tenant-specific workflow customizations
- Custom report templates per tenant
- Tenant-specific integrations
- White-label configuration
- Custom domain management
- Tenant-specific feature toggles
- Custom notification templates
- Tenant-specific business rules

**Database**:

- Tenant customization tables
- Custom field definitions
- Tenant-specific configurations

---

### PRD-SAAS-MNG-0020: Data Residency & Multi-Region

**Scope**: Data residency compliance and multi-region support

**Key Features**:

- GCC region data residency compliance
- Multi-region database support
- Region selection per tenant
- Data replication across regions
- Region-specific compliance (GDPR, local regulations)
- Data transfer controls
- Regional failover capabilities
- Cross-region data synchronization
- Region-specific performance optimization
- Compliance reporting per region

**Regions**:

- GCC (Primary focus)
- International expansion capability
- Region-specific Supabase projects

---

### PRD-SAAS-MNG-0021: Backup, BCDR, and Tenant-Level Restore

**Scope**: Backup, disaster recovery, and tenant data restoration

**Key Features**:

- Automated database backups
- Point-in-time recovery (PITR)
- Tenant-level backup and restore
- Backup retention policies
- Disaster recovery procedures
- Backup verification and testing
- Cross-region backup replication
- Tenant data export for backups
- Restore testing framework
- Backup monitoring and alerts
- RTO/RPO management
- Business continuity planning

**Tools**:

- Supabase backup system
- Custom backup scripts
- Restore automation

---

### PRD-SAAS-MNG-0022: Import / Export & Onboarding Tooling

**Scope**: Data import/export and tenant onboarding automation

**Key Features**:

- Tenant data import (CSV, JSON, Excel)
- Tenant data export (full or partial)
- Bulk tenant onboarding
- Data migration tools
- Import validation and error handling
- Import progress tracking
- Export scheduling
- Data transformation tools
- Onboarding checklist management
- Automated onboarding workflows
- Template-based onboarding
- Onboarding analytics

**Formats**:

- CSV import/export
- JSON import/export
- Excel import/export
- API-based import/export

---

### PRD-SAAS-MNG-0023: Developer & Integration Portal (Internal)

**Scope**: Internal developer tools and integration management

**Key Features**:

- API key management
- API documentation (Swagger/OpenAPI)
- Webhook management
- Integration testing tools
- API usage analytics
- Rate limit management
- API versioning
- Integration templates
- Webhook delivery monitoring
- API debugging tools
- Integration health monitoring
- Developer sandbox environment

**Components**:

- API documentation portal
- Webhook management UI
- Integration dashboard

---

### PRD-SAAS-MNG-0024: Support & Impersonation

**Scope**: Customer support tools and tenant impersonation

**Key Features**:

- Tenant impersonation for support
- Support ticket management
- Customer communication tools
- Support agent dashboard
- Impersonation audit logging
- Session recording (with consent)
- Support knowledge base
- Escalation workflows
- Support metrics and analytics
- Multi-channel support (email, chat, phone)
- Support SLA tracking

**Security**:

- Impersonation requires approval
- Full audit trail
- Time-limited impersonation sessions

---

### PRD-SAAS-MNG-0025: Performance & Load Guardrails

**Scope**: Performance monitoring and load management

**Key Features**:

- Performance benchmarking
- Load testing framework
- Resource usage monitoring
- Query performance optimization
- Database connection pooling management
- Cache management
- CDN optimization
- API response time monitoring
- Slow query detection
- Resource throttling
- Auto-scaling triggers
- Performance budgets
- Load testing automation

**Metrics**:

- Response times
- Throughput
- Error rates
- Resource utilization

---

### PRD-SAAS-MNG-0026: Testing & QA Matrix

**Scope**: Comprehensive testing framework and quality assurance

**Key Features**:

- Unit testing framework
- Integration testing
- End-to-end testing (Playwright/Cypress)
- Performance testing
- Security testing
- Load testing
- Regression testing automation
- Test data management
- Test environment management
- Coverage reporting
- QA dashboard
- Bug tracking integration
- Test case management

**Tools**:

- Jest for unit tests
- Playwright for E2E tests
- k6 for load testing
- Test coverage tools

---

### PRD-SAAS-MNG-0027: Reporting, Analytics, and Billing Insights

**Scope**: Advanced reporting and billing analytics

**Key Features**:

- Platform-wide analytics dashboard
- Tenant usage reports
- Revenue analytics
- Subscription health reports
- Churn analysis
- Growth metrics
- Custom report builder
- Scheduled reports
- Report export (PDF, Excel, CSV)
- Billing insights and forecasting
- Cost analysis per tenant
- Profitability analysis
- Trend analysis

**Reports**:

- Tenant activity reports
- Revenue reports
- Usage reports
- Churn reports
- Growth reports

---

### PRD-SAAS-MNG-0028: Compliance & Policy Management

**Scope**: Compliance tracking and policy enforcement

**Key Features**:

- GDPR compliance management
- Data retention policy enforcement
- Privacy policy management
- Terms of service management
- Compliance audit trails
- Policy versioning
- Consent management
- Data deletion workflows
- Right to be forgotten implementation
- Compliance reporting
- Policy change notifications
- Compliance checklist
- Regulatory change tracking

**Compliance Areas**:

- GDPR
- GCC data protection regulations
- Industry-specific compliance

---

## Implementation Priority

**Phase 1 (Critical - Foundation)**:

1. PRD-SAAS-MNG-0011: Standalone Module Architecture
2. PRD-SAAS-MNG-0001: Tenant Lifecycle Management
3. PRD-SAAS-MNG-0002: Plans & Subscriptions Management
4. PRD-SAAS-MNG-0010: HQ Console UI Framework
5. PRD-SAAS-MNG-0005: Authentication & User Management

**Phase 2 (High Priority - Core Operations)**:

6. PRD-SAAS-MNG-0003: Workflow Engine Management
7. PRD-SAAS-MNG-0006: Core Data Management - Service Catalog
8. PRD-SAAS-MNG-0007: Core Data Management - System Codes
9. PRD-SAAS-MNG-0014: Security, RLS & Governance
10. PRD-SAAS-MNG-0013: Observability & SLO Enforcement

**Phase 3 (Medium Priority - Advanced Features)**:

11. PRD-SAAS-MNG-0004: Customer Data Management
12. PRD-SAAS-MNG-0008: Data Seeding & Initialization
13. PRD-SAAS-MNG-0009: Platform Analytics & Monitoring
14. PRD-SAAS-MNG-0012: Automation & Worker Architecture
15. PRD-SAAS-MNG-0024: Support & Impersonation
16. PRD-SAAS-MNG-0022: Import / Export & Onboarding Tooling

**Phase 4 (Infrastructure & Scale)**:

17. PRD-SAAS-MNG-0016: CI/CD & Schema Control
18. PRD-SAAS-MNG-0017: Deployment & Ops
19. PRD-SAAS-MNG-0021: Backup, BCDR, and Tenant-Level Restore
20. PRD-SAAS-MNG-0025: Performance & Load Guardrails
21. PRD-SAAS-MNG-0020: Data Residency & Multi-Region

**Phase 5 (Advanced Capabilities)**:

22. PRD-SAAS-MNG-0015: AI / Automation Layer
23. PRD-SAAS-MNG-0018: Licensing & Entitlements
24. PRD-SAAS-MNG-0019: Tenant/Org Customization Layer
25. PRD-SAAS-MNG-0023: Developer & Integration Portal
26. PRD-SAAS-MNG-0027: Reporting, Analytics, and Billing Insights

**Phase 6 (Quality & Compliance)**:

27. PRD-SAAS-MNG-0026: Testing & QA Matrix
28. PRD-SAAS-MNG-0028: Compliance & Policy Management

---

## Technical Considerations

1. **Security**: All HQ endpoints must enforce role-based access control
2. **Audit Logging**: Every action must be logged with user, timestamp, and changes
3. **Data Isolation**: HQ can view all tenants but must respect data privacy
4. **Performance**: Bulk operations should be async with job queues
5. **Validation**: All data changes must be validated before persistence
6. **Bilingual**: All user-facing text must support EN/AR
7. **Versioning**: Critical data (workflows, plans) should support versioning
8. **Standalone**: Complete separation from tenant web-admin application

---

## File Structure

```
docs/features/PRD-SAAS-MNG-cr/
├── PRD-SAAS-MNG-0001_Tenant_Lifecycle_Management.md
├── PRD-SAAS-MNG-0002_Plans_Subscriptions_Management.md
├── PRD-SAAS-MNG-0003_Workflow_Engine_Management.md
├── PRD-SAAS-MNG-0004_Customer_Data_Management.md
├── PRD-SAAS-MNG-0005_Auth_User_Management.md
├── PRD-SAAS-MNG-0006_Core_Data_Service_Catalog.md
├── PRD-SAAS-MNG-0007_Core_Data_System_Codes.md
├── PRD-SAAS-MNG-0008_Data_Seeding_Initialization.md
├── PRD-SAAS-MNG-0009_Platform_Analytics_Monitoring.md
├── PRD-SAAS-MNG-0010_HQ_Console_UI_Framework.md
├── PRD-SAAS-MNG-0011_Standalone_Module_Architecture.md
├── PRD-SAAS-MNG-0012_Automation_Worker_Architecture.md
├── PRD-SAAS-MNG-0013_Observability_SLO_Enforcement.md
├── PRD-SAAS-MNG-0014_Security_RLS_Governance.md
├── PRD-SAAS-MNG-0015_AI_Automation_Layer.md
├── PRD-SAAS-MNG-0016_CI_CD_Schema_Control.md
├── PRD-SAAS-MNG-0017_Deployment_Ops.md
├── PRD-SAAS-MNG-0018_Licensing_Entitlements.md
├── PRD-SAAS-MNG-0019_Tenant_Org_Customization_Layer.md
├── PRD-SAAS-MNG-0020_Data_Residency_Multi_Region.md
├── PRD-SAAS-MNG-0021_Backup_BCDR_Tenant_Restore.md
├── PRD-SAAS-MNG-0022_Import_Export_Onboarding.md
├── PRD-SAAS-MNG-0023_Developer_Integration_Portal.md
├── PRD-SAAS-MNG-0024_Support_Impersonation.md
├── PRD-SAAS-MNG-0025_Performance_Load_Guardrails.md
├── PRD-SAAS-MNG-0026_Testing_QA_Matrix.md
├── PRD-SAAS-MNG-0027_Reporting_Analytics_Billing.md
├── PRD-SAAS-MNG-0028_Compliance_Policy_Management.md
└── README.md (index/overview of all PRDs)
```

Each PRD will follow a standard structure:

- Overview & Purpose
- Functional Requirements
- Technical Requirements
- Database Schema
- API Endpoints
- UI/UX Requirements
- Security Considerations
- Testing Requirements
- Implementation Checklist

====================

# PRD Structure: CleanMateX HQ SaaS Platform Management (Complete)

## Overview

This plan organizes all SaaS Platform Management features into numbered PRD modules (PRD-SAAS-MNG-00xx) for the internal HQ Console used by the development team to manage the multi-tenant platform.

**Architecture**: The HQ Console is a **standalone module** with separate applications:

- **platform-web**: Next.js frontend application (HQ Console UI)
- **platform-api**: Backend API (NestJS or Next.js API routes)
- Independent authentication system and login
- Separate dashboard and UI
- Isolated from tenant-facing web-admin application
- Independent routing and navigation (separate domain or `/hq/*` routes)
- HQ-specific database access patterns (bypassing tenant RLS)
- Independent deployment pipelines for each module

**Project Structure**:

```
cleanmatex/
├── platform-web/          # HQ Console Frontend (Next.js)
├── platform-api/           # HQ Console Backend API
├── platform-workers/       # Background workers (optional)
├── web-admin/              # Tenant-facing admin (existing)
├── backend/               # Tenant-facing backend (existing)
└── ...
```

## PRD Module Structure

### PRD-SAAS-MNG-0001: Tenant Lifecycle Management

**Scope**: Complete tenant/organization creation, configuration, and lifecycle management

**Key Features**:

- Create new tenant organizations with initial setup
- Tenant profile management (name, contact, branding, settings)
- Tenant status management (active, suspended, trial, expired)
- Tenant initialization automation (subscription, branch, service categories)
- Tenant deletion/archival with data retention policies
- Bulk tenant operations
- Tenant search, filtering, and analytics
- Tenant impersonation for support debugging

**Database Tables**:

- `org_tenants_mst` (main tenant table)
- `org_subscriptions_mst` (subscription records)
- `org_branches_mst` (default branch creation)
- `org_service_category_cf` (service category enablement)

**API Endpoints**:

- `POST /api/hq/v1/tenants` - Create tenant
- `GET /api/hq/v1/tenants` - List tenants with filters
- `GET /api/hq/v1/tenants/:id` - Get tenant details
- `PATCH /api/hq/v1/tenants/:id` - Update tenant
- `POST /api/hq/v1/tenants/:id/initialize` - Trigger initialization
- `POST /api/hq/v1/tenants/:id/suspend` - Suspend tenant
- `POST /api/hq/v1/tenants/:id/activate` - Activate tenant
- `DELETE /api/hq/v1/tenants/:id` - Archive tenant

---

### PRD-SAAS-MNG-0002: Plans & Subscriptions Management

**Scope**: Plan definitions, subscription assignment, and limit enforcement

**Key Features**:

- Manage plan definitions (freemium, basic, pro, plus, enterprise)
- Plan feature flags and limits configuration
- Assign/modify/activate/stop subscriptions for tenants
- Subscription approval workflow
- Plan upgrade/downgrade management
- Usage tracking and limit enforcement
- Billing cycle management
- Trial period management
- Plan override capabilities (custom limits for specific tenants)

**Database Tables**:

- `sys_plan_subscriptions_types_cf` (plan definitions)
- `sys_plan_limits_cd` (plan limit definitions)
- `sys_features_code_cd` (feature code definitions)
- `sys_plan_features_cf` (plan-feature mappings)
- `sys_plan_limits_cf` (plan-limit mappings)
- `org_subscriptions_mst` (tenant subscriptions)

**API Endpoints**:

- `GET /api/hq/v1/plans` - List all plans
- `POST /api/hq/v1/plans` - Create new plan
- `PATCH /api/hq/v1/plans/:code` - Update plan
- `GET /api/hq/v1/tenants/:id/subscription` - Get tenant subscription
- `POST /api/hq/v1/tenants/:id/subscription` - Assign subscription
- `PATCH /api/hq/v1/tenants/:id/subscription` - Modify subscription
- `POST /api/hq/v1/tenants/:id/subscription/approve` - Approve subscription
- `POST /api/hq/v1/tenants/:id/subscription/activate` - Activate subscription
- `POST /api/hq/v1/tenants/:id/subscription/stop` - Stop subscription
- `GET /api/hq/v1/tenants/:id/usage` - Get usage statistics

---

### PRD-SAAS-MNG-0003: Workflow Engine Management

**Scope**: Global workflow templates, stages, and transitions management

**Key Features**:

- Create/edit/disable workflow templates (WF_STANDARD, WF_ASSEMBLY_QA, etc.)
- Manage workflow stages per template with sequence ordering
- Configure allowed transitions between stages with rules
- Transition validation rules (requires_scan_ok, requires_invoice, requires_pod)
- Workflow template versioning and rollback
- Assign workflow templates to tenants/service categories
- Visual workflow editor
- Workflow template cloning and customization

**Database Tables**:

- `sys_workflow_template_cd` (template definitions)
- `sys_workflow_template_stages` (stages per template)
- `sys_workflow_template_transitions` (allowed transitions)
- `org_tenant_workflow_templates_cf` (tenant-template assignments)
- `org_tenant_service_category_workflow_cf` (service category workflow assignments)

**API Endpoints**:

- `GET /api/hq/v1/workflow-templates` - List templates
- `POST /api/hq/v1/workflow-templates` - Create template
- `GET /api/hq/v1/workflow-templates/:id` - Get template details
- `PATCH /api/hq/v1/workflow-templates/:id` - Update template
- `POST /api/hq/v1/workflow-templates/:id/stages` - Add stage
- `PATCH /api/hq/v1/workflow-templates/:id/stages/:stageId` - Update stage
- `POST /api/hq/v1/workflow-templates/:id/transitions` - Add transition
- `POST /api/hq/v1/workflow-templates/:id/clone` - Clone template
- `POST /api/hq/v1/workflow-templates/:id/assign` - Assign to tenant

---

### PRD-SAAS-MNG-0004: Customer Data Management (Global & Tenant)

**Scope**: Two-layer customer management system

**Key Features**:

- Manage global customers (`sys_customers_mst`) - shared identity across tenants
- Manage tenant-specific customers (`org_customers_mst`)
- Link/unlink global customers to tenant customers
- Customer deduplication and merging
- Customer search across all tenants (with privacy controls)
- Customer data export and import
- Customer type management (`sys_customer_type_cd`)
- Customer preference management
- Customer activity tracking across tenants

**Database Tables**:

- `sys_customers_mst` (global customer master)
- `org_customers_mst` (tenant-scoped customers)
- `sys_customer_type_cd` (customer type codes)
- `org_customer_addresses` (customer addresses)

**API Endpoints**:

- `GET /api/hq/v1/customers/global` - List global customers
- `GET /api/hq/v1/customers/global/:id` - Get global customer
- `POST /api/hq/v1/customers/global/merge` - Merge duplicate customers
- `GET /api/hq/v1/tenants/:id/customers` - List tenant customers
- `POST /api/hq/v1/customers/global/:globalId/link/:tenantId` - Link global to tenant customer
- `GET /api/hq/v1/customers/search` - Search across all customers

---

### PRD-SAAS-MNG-0005: Authentication & User Management

**Scope**: Platform user management, roles, and permissions

**Key Features**:

- Manage HQ console users (internal team members)
- Role management (`sys_user_type_cd`)
- Permission assignment and RBAC
- User invitation and activation
- User deactivation and access revocation
- Audit logging of user actions
- Multi-factor authentication management
- Session management and security policies

**Database Tables**:

- `auth_users` (Supabase auth users)
- `sys_user_type_cd` (user type codes)
- `org_users_mst` (tenant users - if needed for HQ visibility)
- Audit tables for user actions

**API Endpoints**:

- `GET /api/hq/v1/users` - List HQ users
- `POST /api/hq/v1/users` - Create HQ user
- `PATCH /api/hq/v1/users/:id` - Update user
- `POST /api/hq/v1/users/:id/invite` - Send invitation
- `POST /api/hq/v1/users/:id/deactivate` - Deactivate user
- `GET /api/hq/v1/roles` - List roles
- `POST /api/hq/v1/roles` - Create role
- `GET /api/hq/v1/users/:id/permissions` - Get user permissions

---

### PRD-SAAS-MNG-0006: Core Data Management - Service Catalog

**Scope**: Service categories, types, and catalog management

**Key Features**:

- Manage service categories (`sys_service_category_cd`): DRY_CLEAN, LAUNDRY, IRON_ONLY, REPAIRS, ALTERATION
- Manage service types (`sys_service_type_cd`)
- Manage item fabric types (`sys_item_fabric_type_cd`)
- Manage item types (`sys_item_type_cd`)
- Manage default products/items (`sys_products_init_data_mst`)
- Manage item notes categories and codes (`sys_item_notes_ctg_cd`, `sys_item_notes_cd`)
- Manage stain types (`sys_item_stain_type_cd`)
- Manage preferences (`sys_preference_ctg_cd`, `sys_preference_options_cd`)
- Bilingual support (EN/AR) for all catalog items
- Catalog versioning and rollback
- Push catalog updates to tenants

**Database Tables**:

- `sys_service_category_cd`
- `sys_service_type_cd`
- `sys_item_fabric_type_cd`
- `sys_item_type_cd`
- `sys_products_init_data_mst`
- `sys_item_notes_ctg_cd`
- `sys_item_notes_cd`
- `sys_item_stain_type_cd`
- `sys_preference_ctg_cd`
- `sys_preference_options_cd`

**API Endpoints**:

- `GET /api/hq/v1/catalog/service-categories` - List service categories
- `POST /api/hq/v1/catalog/service-categories` - Create service category
- `PATCH /api/hq/v1/catalog/service-categories/:code` - Update category
- Similar endpoints for all catalog tables
- `POST /api/hq/v1/catalog/push/:tenantId` - Push updates to tenant

---

### PRD-SAAS-MNG-0007: Core Data Management - System Codes

**Scope**: All system reference codes and lookup tables

**Key Features**:

- Currency management (`sys_currency_cd`)
- Color codes (`sys_color_cd`)
- Icon codes (`sys_icons_cd`)
- Priority codes (`sys_priority_cd`)
- Product unit codes (`sys_product_unit_cd`) - Measurement Units
- Invoice type codes (`sys_invoice_type_cd`)
- Order status codes (`sys_order_status_cd`)
- Organization type codes (`sys_org_type_cd`)
- Payment method codes (`sys_payment_method_cd`): Pay on collect, cash, card, payment gateways
- Payment type codes (`sys_payment_type_cd`): Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup
- Order type codes (`sys_order_type_cd`)
- Bilingual support for all codes
- Code locking mechanism (prevent accidental edits)
- Code dependency validation

**Database Tables**:

- All `sys_*_cd` tables listed above

**API Endpoints**:

- `GET /api/hq/v1/codes/:tableName` - List codes for table
- `POST /api/hq/v1/codes/:tableName` - Create code
- `PATCH /api/hq/v1/codes/:tableName/:code` - Update code
- `DELETE /api/hq/v1/codes/:tableName/:code` - Delete code (soft delete)
- `POST /api/hq/v1/codes/:tableName/:code/lock` - Lock code from editing

---

### PRD-SAAS-MNG-0008: Data Seeding & Initialization

**Scope**: Automated data seeding and tenant initialization

**Key Features**:

- Seed script management for core data
- Tenant initialization automation
- Default data templates
- Seed data versioning
- Rollback capabilities
- Bulk seed operations
- Seed data validation
- Migration integration

**Database Tables**:

- All `sys_*` tables for seeding
- Seed version tracking table

**API Endpoints**:

- `POST /api/hq/v1/seeds/run` - Run seed scripts
- `POST /api/hq/v1/seeds/validate` - Validate seed data
- `GET /api/hq/v1/seeds/versions` - List seed versions
- `POST /api/hq/v1/seeds/rollback/:version` - Rollback to version

---

### PRD-SAAS-MNG-0009: Platform Analytics & Monitoring

**Scope**: Platform-wide metrics, monitoring, and observability

**Key Features**:

- Platform KPIs dashboard (active tenants, orders processed, system latency)
- Tenant usage analytics
- Subscription health monitoring
- Alert center (expired plans, storage overuse, missing payments)
- System performance metrics
- Error tracking and reporting
- Audit log viewer
- Export capabilities for reports

**Database Tables**:

- Audit/logging tables
- Metrics aggregation tables

**API Endpoints**:

- `GET /api/hq/v1/analytics/platform` - Platform KPIs
- `GET /api/hq/v1/analytics/tenants` - Tenant analytics
- `GET /api/hq/v1/analytics/subscriptions` - Subscription analytics
- `GET /api/hq/v1/alerts` - List alerts
- `GET /api/hq/v1/audit-logs` - Audit logs with filters

---

### PRD-SAAS-MNG-0010: HQ Console UI Framework

**Scope**: Base UI components and navigation for HQ Console

**Key Features**:

- HQ Console layout and navigation
- Role-based UI rendering
- Dashboard widgets
- Data tables with advanced filtering
- Form builders for dynamic forms
- Bulk action interfaces
- Search and filter components
- Export/import UI components
- Audit log viewer UI
- Alert notification system

**UI Components**:

- Tenant management pages
- Plan management pages
- Workflow template editor
- Customer management pages
- Code management pages
- Analytics dashboards
- Settings pages

---

### PRD-SAAS-MNG-0011: Standalone Module Architecture

**Scope**: Complete isolation and independence of HQ Console

**Key Features**:

- Separate Next.js application (`hq-console/` directory)
- Independent authentication system (separate Supabase project or isolated auth)
- Separate login page and session management
- Independent routing (`/hq/*` routes or separate domain)
- Separate dashboard and navigation
- HQ-specific middleware and guards
- Isolated API routes (`/api/hq/*`)
- Separate environment configuration
- Independent deployment pipeline
- No dependency on tenant web-admin codebase

**Architecture**:

- Standalone Next.js app in `hq-console/` directory
- Separate Supabase client configuration
- Bypass tenant RLS policies for HQ operations
- Independent UI component library
- Separate build and deployment process

---

### PRD-SAAS-MNG-0012: Automation & Worker Architecture

**Scope**: Background jobs, queues, and automated workflows

**Key Features**:

- Job queue system (BullMQ, Bull, or similar)
- Scheduled tasks (subscription renewals, trial expirations, usage resets)
- Background workers for heavy operations
- Email notification workers
- Report generation workers
- Data synchronization workers
- Retry mechanisms and error handling
- Job monitoring and dashboard
- Worker scaling and load balancing
- Dead letter queue management

**Components**:

- Job queue infrastructure
- Worker processes
- Scheduler service
- Job monitoring dashboard
- Alert system for failed jobs

---

### PRD-SAAS-MNG-0013: Observability & SLO Enforcement

**Scope**: Monitoring, logging, and service level objectives

**Key Features**:

- Application performance monitoring (APM)
- Error tracking and alerting (Sentry integration)
- Log aggregation and analysis
- Service level indicators (SLIs) tracking
- Service level objectives (SLOs) enforcement
- Uptime monitoring
- Response time tracking
- Database query performance monitoring
- API endpoint monitoring
- Custom metrics and dashboards
- Alert rules and notifications
- SLA compliance reporting

**Tools Integration**:

- Sentry for error tracking
- Grafana for metrics visualization
- Prometheus for metrics collection
- ELK stack or similar for log aggregation

---

### PRD-SAAS-MNG-0014: Security, RLS & Governance

**Scope**: Security policies, RLS management, and governance controls

**Key Features**:

- Row Level Security (RLS) policy management
- RLS policy testing and validation
- Security audit logging
- Access control policy management
- Data encryption at rest and in transit
- Secrets management
- API rate limiting
- DDoS protection
- Security vulnerability scanning
- Compliance policy enforcement
- Data access governance
- Security incident response
- Penetration testing framework
- Security policy versioning

**Database**:

- RLS policy management interface
- Policy deployment automation
- Policy testing framework

---

### PRD-SAAS-MNG-0015: AI / Automation Layer

**Scope**: AI-powered features and intelligent automation

**Key Features**:

- AI-powered customer support (chatbot)
- Automated anomaly detection
- Predictive analytics for tenant churn
- Intelligent resource allocation
- Automated workflow suggestions
- Natural language processing for support tickets
- Image recognition for order items
- Automated data quality checks
- Smart alerting (reduce false positives)
- AI-powered recommendations
- Automated report generation
- Intelligent capacity planning

**AI Services**:

- OpenAI/Claude integration
- Custom ML models
- Vector database for embeddings
- Training data management

---

### PRD-SAAS-MNG-0016: CI/CD & Schema Control

**Scope**: Continuous integration, deployment, and database schema management

**Key Features**:

- CI/CD pipeline for HQ Console
- Automated testing in CI
- Database migration management
- Schema versioning and rollback
- Migration testing framework
- Staging environment management
- Production deployment automation
- Blue-green deployment support
- Database migration approval workflow
- Migration conflict detection
- Schema diff tools
- Migration rollback procedures
- Environment-specific configuration management

**Tools**:

- GitHub Actions / GitLab CI
- Supabase migration system
- Database migration testing framework

---

### PRD-SAAS-MNG-0017: Deployment & Ops

**Scope**: Production deployment and operational management

**Key Features**:

- Production deployment procedures
- Environment management (dev, staging, prod)
- Infrastructure as Code (IaC)
- Container orchestration (if applicable)
- Health check endpoints
- Graceful shutdown handling
- Zero-downtime deployments
- Rollback procedures
- Configuration management
- Secrets management in production
- SSL/TLS certificate management
- CDN configuration
- Load balancing configuration
- Auto-scaling policies

**Infrastructure**:

- Vercel/Netlify for Next.js deployment
- Supabase for database
- Infrastructure monitoring

---

### PRD-SAAS-MNG-0018: Licensing & Entitlements (Internal)

**Scope**: Internal licensing and feature entitlement management

**Key Features**:

- License key generation and management
- Feature entitlement tracking
- License validation
- Trial license management
- Enterprise license management
- License expiration handling
- Feature flag integration with licensing
- Usage-based licensing support
- License audit and reporting
- License compliance monitoring

**Database**:

- License management tables
- Entitlement tracking
- Usage metering

---

### PRD-SAAS-MNG-0019: Tenant/Org Customization Layer

**Scope**: Tenant-specific customizations and configurations

**Key Features**:

- Tenant-specific branding (logo, colors, domain)
- Custom field management per tenant
- Tenant-specific workflow customizations
- Custom report templates per tenant
- Tenant-specific integrations
- White-label configuration
- Custom domain management
- Tenant-specific feature toggles
- Custom notification templates
- Tenant-specific business rules

**Database**:

- Tenant customization tables
- Custom field definitions
- Tenant-specific configurations

---

### PRD-SAAS-MNG-0020: Data Residency & Multi-Region

**Scope**: Data residency compliance and multi-region support

**Key Features**:

- GCC region data residency compliance
- Multi-region database support
- Region selection per tenant
- Data replication across regions
- Region-specific compliance (GDPR, local regulations)
- Data transfer controls
- Regional failover capabilities
- Cross-region data synchronization
- Region-specific performance optimization
- Compliance reporting per region

**Regions**:

- GCC (Primary focus)
- International expansion capability
- Region-specific Supabase projects

---

### PRD-SAAS-MNG-0021: Backup, BCDR, and Tenant-Level Restore

**Scope**: Backup, disaster recovery, and tenant data restoration

**Key Features**:

- Automated database backups
- Point-in-time recovery (PITR)
- Tenant-level backup and restore
- Backup retention policies
- Disaster recovery procedures
- Backup verification and testing
- Cross-region backup replication
- Tenant data export for backups
- Restore testing framework
- Backup monitoring and alerts
- RTO/RPO management
- Business continuity planning

**Tools**:

- Supabase backup system
- Custom backup scripts
- Restore automation

---

### PRD-SAAS-MNG-0022: Import / Export & Onboarding Tooling

**Scope**: Data import/export and tenant onboarding automation

**Key Features**:

- Tenant data import (CSV, JSON, Excel)
- Tenant data export (full or partial)
- Bulk tenant onboarding
- Data migration tools
- Import validation and error handling
- Import progress tracking
- Export scheduling
- Data transformation tools
- Onboarding checklist management
- Automated onboarding workflows
- Template-based onboarding
- Onboarding analytics

**Formats**:

- CSV import/export
- JSON import/export
- Excel import/export
- API-based import/export

---

### PRD-SAAS-MNG-0023: Developer & Integration Portal (Internal)

**Scope**: Internal developer tools and integration management

**Key Features**:

- API key management
- API documentation (Swagger/OpenAPI)
- Webhook management
- Integration testing tools
- API usage analytics
- Rate limit management
- API versioning
- Integration templates
- Webhook delivery monitoring
- API debugging tools
- Integration health monitoring
- Developer sandbox environment

**Components**:

- API documentation portal
- Webhook management UI
- Integration dashboard

---

### PRD-SAAS-MNG-0024: Support & Impersonation

**Scope**: Customer support tools and tenant impersonation

**Key Features**:

- Tenant impersonation for support
- Support ticket management
- Customer communication tools
- Support agent dashboard
- Impersonation audit logging
- Session recording (with consent)
- Support knowledge base
- Escalation workflows
- Support metrics and analytics
- Multi-channel support (email, chat, phone)
- Support SLA tracking

**Security**:

- Impersonation requires approval
- Full audit trail
- Time-limited impersonation sessions

---

### PRD-SAAS-MNG-0025: Performance & Load Guardrails

**Scope**: Performance monitoring and load management

**Key Features**:

- Performance benchmarking
- Load testing framework
- Resource usage monitoring
- Query performance optimization
- Database connection pooling management
- Cache management
- CDN optimization
- API response time monitoring
- Slow query detection
- Resource throttling
- Auto-scaling triggers
- Performance budgets
- Load testing automation

**Metrics**:

- Response times
- Throughput
- Error rates
- Resource utilization

---

### PRD-SAAS-MNG-0026: Testing & QA Matrix

**Scope**: Comprehensive testing framework and quality assurance

**Key Features**:

- Unit testing framework
- Integration testing
- End-to-end testing (Playwright/Cypress)
- Performance testing
- Security testing
- Load testing
- Regression testing automation
- Test data management
- Test environment management
- Coverage reporting
- QA dashboard
- Bug tracking integration
- Test case management

**Tools**:

- Jest for unit tests
- Playwright for E2E tests
- k6 for load testing
- Test coverage tools

---

### PRD-SAAS-MNG-0027: Reporting, Analytics, and Billing Insights

**Scope**: Advanced reporting and billing analytics

**Key Features**:

- Platform-wide analytics dashboard
- Tenant usage reports
- Revenue analytics
- Subscription health reports
- Churn analysis
- Growth metrics
- Custom report builder
- Scheduled reports
- Report export (PDF, Excel, CSV)
- Billing insights and forecasting
- Cost analysis per tenant
- Profitability analysis
- Trend analysis

**Reports**:

- Tenant activity reports
- Revenue reports
- Usage reports
- Churn reports
- Growth reports

---

### PRD-SAAS-MNG-0028: Compliance & Policy Management

**Scope**: Compliance tracking and policy enforcement

**Key Features**:

- GDPR compliance management
- Data retention policy enforcement
- Privacy policy management
- Terms of service management
- Compliance audit trails
- Policy versioning
- Consent management
- Data deletion workflows
- Right to be forgotten implementation
- Compliance reporting
- Policy change notifications
- Compliance checklist
- Regulatory change tracking

**Compliance Areas**:

- GDPR
- GCC data protection regulations
- Industry-specific compliance

---

## Implementation Priority

**Phase 1 (Critical - Foundation)**:

1. PRD-SAAS-MNG-0011: Standalone Module Architecture
2. PRD-SAAS-MNG-0001: Tenant Lifecycle Management
3. PRD-SAAS-MNG-0002: Plans & Subscriptions Management
4. PRD-SAAS-MNG-0010: HQ Console UI Framework
5. PRD-SAAS-MNG-0005: Authentication & User Management

**Phase 2 (High Priority - Core Operations)**:

6. PRD-SAAS-MNG-0003: Workflow Engine Management
7. PRD-SAAS-MNG-0006: Core Data Management - Service Catalog
8. PRD-SAAS-MNG-0007: Core Data Management - System Codes
9. PRD-SAAS-MNG-0014: Security, RLS & Governance
10. PRD-SAAS-MNG-0013: Observability & SLO Enforcement

**Phase 3 (Medium Priority - Advanced Features)**:

11. PRD-SAAS-MNG-0004: Customer Data Management
12. PRD-SAAS-MNG-0008: Data Seeding & Initialization
13. PRD-SAAS-MNG-0009: Platform Analytics & Monitoring
14. PRD-SAAS-MNG-0012: Automation & Worker Architecture
15. PRD-SAAS-MNG-0024: Support & Impersonation
16. PRD-SAAS-MNG-0022: Import / Export & Onboarding Tooling

**Phase 4 (Infrastructure & Scale)**:

17. PRD-SAAS-MNG-0016: CI/CD & Schema Control
18. PRD-SAAS-MNG-0017: Deployment & Ops
19. PRD-SAAS-MNG-0021: Backup, BCDR, and Tenant-Level Restore
20. PRD-SAAS-MNG-0025: Performance & Load Guardrails
21. PRD-SAAS-MNG-0020: Data Residency & Multi-Region

**Phase 5 (Advanced Capabilities)**:

22. PRD-SAAS-MNG-0015: AI / Automation Layer
23. PRD-SAAS-MNG-0018: Licensing & Entitlements
24. PRD-SAAS-MNG-0019: Tenant/Org Customization Layer
25. PRD-SAAS-MNG-0023: Developer & Integration Portal
26. PRD-SAAS-MNG-0027: Reporting, Analytics, and Billing Insights

**Phase 6 (Quality & Compliance)**:

27. PRD-SAAS-MNG-0026: Testing & QA Matrix
28. PRD-SAAS-MNG-0028: Compliance & Policy Management

---

## Technical Considerations

1. **Security**: All HQ endpoints must enforce role-based access control
2. **Audit Logging**: Every action must be logged with user, timestamp, and changes
3. **Data Isolation**: HQ can view all tenants but must respect data privacy
4. **Performance**: Bulk operations should be async with job queues
5. **Validation**: All data changes must be validated before persistence
6. **Bilingual**: All user-facing text must support EN/AR
7. **Versioning**: Critical data (workflows, plans) should support versioning
8. **Standalone**: Complete separation from tenant web-admin application

---

## File Structure

```
docs/features/PRD-SAAS-MNG-cr/
├── PRD-SAAS-MNG-0001_Tenant_Lifecycle_Management.md
├── PRD-SAAS-MNG-0002_Plans_Subscriptions_Management.md
├── PRD-SAAS-MNG-0003_Workflow_Engine_Management.md
├── PRD-SAAS-MNG-0004_Customer_Data_Management.md
├── PRD-SAAS-MNG-0005_Auth_User_Management.md
├── PRD-SAAS-MNG-0006_Core_Data_Service_Catalog.md
├── PRD-SAAS-MNG-0007_Core_Data_System_Codes.md
├── PRD-SAAS-MNG-0008_Data_Seeding_Initialization.md
├── PRD-SAAS-MNG-0009_Platform_Analytics_Monitoring.md
├── PRD-SAAS-MNG-0010_HQ_Console_UI_Framework.md
├── PRD-SAAS-MNG-0011_Standalone_Module_Architecture.md
├── PRD-SAAS-MNG-0012_Automation_Worker_Architecture.md
├── PRD-SAAS-MNG-0013_Observability_SLO_Enforcement.md
├── PRD-SAAS-MNG-0014_Security_RLS_Governance.md
├── PRD-SAAS-MNG-0015_AI_Automation_Layer.md
├── PRD-SAAS-MNG-0016_CI_CD_Schema_Control.md
├── PRD-SAAS-MNG-0017_Deployment_Ops.md
├── PRD-SAAS-MNG-0018_Licensing_Entitlements.md
├── PRD-SAAS-MNG-0019_Tenant_Org_Customization_Layer.md
├── PRD-SAAS-MNG-0020_Data_Residency_Multi_Region.md
├── PRD-SAAS-MNG-0021_Backup_BCDR_Tenant_Restore.md
├── PRD-SAAS-MNG-0022_Import_Export_Onboarding.md
├── PRD-SAAS-MNG-0023_Developer_Integration_Portal.md
├── PRD-SAAS-MNG-0024_Support_Impersonation.md
├── PRD-SAAS-MNG-0025_Performance_Load_Guardrails.md
├── PRD-SAAS-MNG-0026_Testing_QA_Matrix.md
├── PRD-SAAS-MNG-0027_Reporting_Analytics_Billing.md
├── PRD-SAAS-MNG-0028_Compliance_Policy_Management.md
└── README.md (index/overview of all PRDs)
```

Each PRD will follow a standard structure:

- Overview & Purpose
- Functional Requirements
- Technical Requirements
- Database Schema
- API Endpoints
- UI/UX Requirements
- Security Considerations
- Testing Requirements
- Implementation Checklist