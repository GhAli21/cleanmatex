Claude’s Plan
Complete SaaS Platform Management Implementation Plan
PRD-SAAS-MNG-0001: CleanMateX Platform HQ Console (Master PRD)
Executive Summary
Build a standalone, enterprise-grade Platform HQ Console for managing the entire CleanMateX SaaS platform with production-ready capabilities including automation, observability, security governance, AI/ML integration, multi-region support, and compliance management.
Architecture: Standalone Module
Confirmed Design
cleanmatex/
├── web-admin/              # Tenant-facing dashboard
├── platform-admin/         # NEW: Standalone HQ Console
│   ├── Separate login/auth
│   ├── Separate dashboard
│   ├── Platform-specific features
│   └── Independent deployment
├── backend/                # Shared API (NestJS)
├── workers/                # NEW: Background job processors
├── observability/          # NEW: Monitoring stack
└── packages/               # Shared code
Complete Feature Breakdown & PRD Structure
Core Platform Management (Weeks 1-12)
PRD-SAAS-MNG-0001: Master PRD - Platform HQ Console Architecture
Standalone application design
Internal team-only access (you + team)
Authentication & authorization strategy
Overall system architecture
Integration points
PRD-SAAS-MNG-0002: Tenant Lifecycle Management
Tenant creation, registration, provisioning
Onboarding workflows & checklists
Lifecycle stages: trial → active → suspended → cancelled → churned
Health scoring & churn prediction
Tenant metadata & branding management
Tenant/Org Customization Layer:
Per-tenant feature flags
Custom workflow configurations
Branding (logos, colors, domains)
Regional settings (timezone, currency, language)
Custom field definitions
PRD-SAAS-MNG-0003: Billing & Subscription Management
Subscription plan management (Free, Starter, Growth, Pro, Enterprise)
Invoice generation & payment processing
Usage-based billing & metering
Dunning management (failed payments)
Discount codes & promotions
Revenue recognition
Licensing & Entitlements (Internal):
License key generation
Feature entitlement matrix
Plan upgrade/downgrade logic
Custom enterprise agreements
White-label licensing
PRD-SAAS-MNG-0004: Platform Analytics & Reporting
Cross-tenant KPIs & metrics
Revenue analytics & forecasting
Usage patterns & trends
Churn analysis & cohort reports
Reporting, Analytics, and Billing Insights:
Real-time dashboards
MRR/ARR tracking
Customer LTV calculations
Billing reconciliation reports
Usage anomaly detection
Export to Excel/CSV/PDF
PRD-SAAS-MNG-0005: Support & Ticketing System
Support ticket management
Tenant communication log
SLA tracking & escalation
Knowledge base management
Support & Impersonation:
Secure tenant impersonation (time-limited, audited)
Support session recording
Customer context panel
Impersonation watermark
Access audit trail
PRD-SAAS-MNG-0006: Core Data & Code Management
System code tables (sys_*_cd)
Service catalog management
Product/item defaults
Payment methods
Workflow templates
Currency & regional settings
Seed data administration
PRD-SAAS-MNG-0007: Workflow Engine Management
Workflow template definitions
Stage configuration per service category
Transition rules & quality gates
Tenant-specific workflow customization
Workflow analytics & bottleneck detection
PRD-SAAS-MNG-0008: Customer Master Data Management
Global customer registry (sys_customers_mst)
Cross-tenant customer visibility
Customer-tenant associations
Duplicate detection & merging
Privacy & GDPR compliance
PRD-SAAS-MNG-0009: Authentication & Authorization
Platform admin user management
Permission-based access control (PBAC)
Role definitions (super_admin, support, billing, analyst)
Multi-factor authentication (MFA) enforcement
Session management
API key management
PRD-SAAS-MNG-0010: Platform Configuration & Settings
System-wide settings
Maintenance mode control
Feature rollout management
Platform notifications
Integration configurations
Infrastructure & Operations (Weeks 13-20)
PRD-SAAS-MNG-0011: Automation & Worker Architecture
Background Job Processing:
BullMQ + Redis for job queues
Worker pools (billing, notifications, analytics, cleanup)
Job scheduling (cron jobs)
Retry & error handling strategies
Automated Workflows:
Automated invoice generation (monthly)
Payment retry/dunning automation
Subscription lifecycle automation (trial expiry, renewals)
Tenant suspension/reactivation automation
Daily metric aggregation jobs
Cleanup jobs (old logs, temp data)
Event-Driven Architecture:
Event bus (Supabase Realtime or Redis Pub/Sub)
Event handlers for tenant.created, subscription.upgraded, etc.
Webhook dispatchers
PRD-SAAS-MNG-0012: Observability & SLO Enforcement
Monitoring Stack:
Prometheus + Grafana for metrics
OpenTelemetry for distributed tracing
Structured logging (Winston/Pino)
Error tracking (Sentry)
Dashboards:
System health dashboard
Per-tenant performance metrics
Database query performance
API endpoint latency (p50, p95, p99)
Worker queue depths
SLO Enforcement:
Define SLOs (99.9% uptime, <800ms p95 response time)
Automated alerting (PagerDuty, Slack)
SLO violation tracking
Incident response workflows
APM (Application Performance Monitoring):
New Relic or Datadog integration
Real-time transaction tracing
Database slow query detection
PRD-SAAS-MNG-0013: Security, RLS & Governance
Row-Level Security (RLS):
RLS policy management UI
Policy testing & validation
RLS policy templates
Automated RLS policy generation
Security Governance:
Security audit logs (all admin actions)
Access control reviews
Permission audits
Anomaly detection (unusual access patterns)
IP whitelisting for platform admins
Rate limiting & DDoS protection
Data Governance:
PII data masking
Data retention policies
Data classification (public, internal, confidential, restricted)
Encryption key management
Secret rotation automation
PRD-SAAS-MNG-0014: AI / Automation Layer
AI-Powered Features:
Churn prediction models (ML-based)
Revenue forecasting
Anomaly detection (usage spikes, fraud)
Support ticket auto-routing
Sentiment analysis on tickets
Intelligent plan recommendations
Automation:
Auto-scaling tenant resources
Intelligent alerting (reduce noise)
Predictive maintenance
Auto-categorization of support tickets
AI Tools Integration:
OpenAI API for text generation (email templates, etc.)
ML models for churn/revenue prediction
Natural language query interface for analytics
PRD-SAAS-MNG-0015: CI/CD & Schema Control
Continuous Integration/Deployment:
GitHub Actions workflows
Automated testing (unit, integration, E2E)
Staging environment mirroring production
Blue-green deployments
Rollback strategies
Schema Migration Control:
Supabase migration version control
Pre-deployment schema validation
Automated migration testing
Schema diff visualization
Migration approval workflow
Rollback scripts for migrations
Infrastructure as Code:
Terraform for cloud resources
Docker Compose for local dev
Kubernetes manifests for production (future)
PRD-SAAS-MNG-0016: Deployment & Ops
Deployment Strategy:
Platform-admin: Vercel or dedicated VPS
Web-admin: Vercel edge functions
Backend API: Railway, Fly.io, or AWS ECS
Workers: Separate containers/instances
Environment Management:
Local (Supabase Local + Docker)
Staging (full production mirror)
Production (multi-region capable)
Operational Dashboards:
Deployment status & history
Environment health checks
Service uptime monitoring
Cost tracking per environment
Data & Compliance (Weeks 21-26)
PRD-SAAS-MNG-0017: Data Residency & Multi-Region
Initial: GCC Focus:
Primary region: Middle East (Bahrain AWS or similar)
Data residency compliance (Saudi Arabia, UAE requirements)
Regional Supabase instance configuration
International Capability:
Multi-region database architecture design
Read replicas for global performance
Data replication strategies
Region selection for new tenants
Cross-region backup strategy
Compliance:
GDPR compliance (EU data residency)
Data sovereignty rules
Regional data laws (Saudi Arabia PDPL, UAE DPDL)
PRD-SAAS-MNG-0018: Backup, BCDR, and Tenant-Level Restore
Backup Strategy:
Automated daily backups (Supabase PITR - Point-in-Time Recovery)
Weekly full backups to S3
Retention: 30 days incremental, 1 year annual
Tenant-Level Restore:
Per-tenant backup snapshots
Selective tenant data restore
"Undelete tenant" feature (soft delete with 30-day grace)
Tenant data export on cancellation
Business Continuity/Disaster Recovery (BCDR):
RTO (Recovery Time Objective): 4 hours
RPO (Recovery Point Objective): 1 hour
Disaster recovery runbooks
Failover procedures
Regular DR drills (quarterly)
Data Loss Prevention:
Soft delete everywhere (no hard deletes)
Audit trail for all deletions
Recycle bin UI for accidental deletions
PRD-SAAS-MNG-0019: Import / Export & Onboarding Tooling
Data Import Tools:
CSV/Excel import for customers, products, orders
Bulk data validation & preview
Error handling & retry
Import history & audit trail
Data Export Tools:
Full tenant data export (GDPR compliance)
Scheduled export jobs
Export formats: CSV, JSON, Excel
Filtered exports (date ranges, entity types)
Migration Tools:
Competitor data import (from other laundry software)
Data mapping wizards
Test imports before production
Onboarding Automation:
Automated welcome emails
Guided setup wizard
Sample data generation
Training resources delivery
PRD-SAAS-MNG-0020: Compliance & Policy Management
Compliance Frameworks:
SOC 2 Type II preparation
ISO 27001 alignment
GDPR compliance tools
PCI DSS (for payment data)
Local regulations (Saudi PDPL, UAE DPDL)
Policy Management:
Data retention policies
Privacy policy versioning
Terms of service management
Cookie consent management
GDPR data subject requests (DSR)
Audit & Reporting:
Compliance dashboard
Automated compliance reports
Risk assessments
Security questionnaire responses
Vendor due diligence documentation
Developer & Testing (Weeks 27-30)
PRD-SAAS-MNG-0021: Developer & Integration Portal (Internal)
Internal Dev Portal:
API documentation (auto-generated from OpenAPI/Swagger)
SDK downloads (TypeScript, JavaScript)
Code samples & tutorials
Webhook documentation
Changelog & release notes
Integration Management:
API key management for integrations
Webhook endpoint configuration
Integration health monitoring
Rate limit management per integration
Integration analytics (usage, errors)
Sandbox Environment:
Test tenant provisioning
Mock payment gateway
Sample data generators
PRD-SAAS-MNG-0022: Testing & QA Matrix
Test Coverage:
Unit tests (80%+ coverage target)
Integration tests (API endpoints)
E2E tests (critical user flows)
Load tests (k6, 1000 concurrent users)
Security tests (OWASP top 10)
QA Matrix:
Multi-tenancy isolation testing
Cross-browser testing (Chrome, Safari, Firefox)
Mobile responsive testing
RTL/Arabic UI testing
Accessibility testing (WCAG 2.1 AA)
Automated Testing:
Pre-deployment test suite
Regression test automation
Visual regression testing (Percy, Chromatic)
Performance regression detection
PRD-SAAS-MNG-0023: Performance & Load Guardrails
Performance Targets:
API response p50 < 300ms, p95 < 800ms
Database queries < 100ms (indexed)
Order search < 1s at 100k records
Page load < 2s (LCP)
Load Guardrails:
Auto-scaling triggers (CPU > 70%)
Database connection pooling (PgBouncer)
Redis caching for hot data
CDN for static assets
Rate limiting per tenant (prevent noisy neighbor)
Monitoring:
Real-time performance dashboards
Automated performance testing in CI
Performance budgets enforcement
Slow query alerting
Implementation Roadmap
Phase 1: Foundation (Weeks 1-4)
✅ Scaffold standalone platform-admin/ app
✅ Core database schema (platform tables)
✅ Authentication & authorization
✅ Platform dashboard & tenant management
✅ Audit logging infrastructure
Phase 2: Core Features (Weeks 5-12)
✅ Billing & subscription management
✅ Analytics & reporting
✅ Support & ticketing
✅ Core data management
✅ Workflow engine management
✅ Customer master data management
Phase 3: Infrastructure & Automation (Weeks 13-20)
✅ Worker architecture (BullMQ)
✅ Observability stack (Prometheus, Grafana, Sentry)
✅ Security & governance tools
✅ AI/ML integration (churn prediction, forecasting)
✅ CI/CD pipelines
✅ Deployment automation
Phase 4: Data & Compliance (Weeks 21-26)
✅ Multi-region setup (GCC primary)
✅ Backup & BCDR implementation
✅ Import/export tools
✅ Compliance framework (GDPR, SOC 2 prep)
✅ Tenant-level restore
Phase 5: Developer & Testing (Weeks 27-30)
✅ Internal developer portal
✅ Comprehensive test suite
✅ Performance guardrails
✅ Load testing & optimization
Phase 6: Polish & Launch (Weeks 31-32)
✅ Security audit
✅ Performance optimization
✅ Documentation finalization
✅ Team training
✅ Production deployment
PRD Document Structure (All PRDs)
Each PRD will follow this structure per .claude/docs/documentation_rules.md:
docs/features/SAAS_Platform_Management/
├── SAAS_Platform_Management_lookup.md
├── README.md
├── development_plan.md
├── progress_summary.md
├── current_status.md
├── developer_guide.md
├── developer_guide_mermaid.md
├── user_guide.md
├── user_guide_mermaid.md
├── testing_scenarios.md
├── CHANGELOG.md
├── version.txt
├── technical_docs/
│   ├── tech_architecture.md
│   ├── tech_database_schema.md
│   ├── tech_api_specs.md
│   ├── tech_security_model.md
│   └── tech_deployment.md
└── PRDs/
    ├── PRD-SAAS-MNG-0001_Platform_HQ_Console.md
    ├── PRD-SAAS-MNG-0002_Tenant_Lifecycle.md
    ├── PRD-SAAS-MNG-0003_Billing_Subscriptions.md
    ├── PRD-SAAS-MNG-0004_Analytics_Reporting.md
    ├── PRD-SAAS-MNG-0005_Support_Ticketing.md
    ├── PRD-SAAS-MNG-0006_Core_Data_Management.md
    ├── PRD-SAAS-MNG-0007_Workflow_Engine.md
    ├── PRD-SAAS-MNG-0008_Customer_Master_Data.md
    ├── PRD-SAAS-MNG-0009_Auth_Authorization.md
    ├── PRD-SAAS-MNG-0010_Platform_Configuration.md
    ├── PRD-SAAS-MNG-0011_Automation_Workers.md
    ├── PRD-SAAS-MNG-0012_Observability_SLO.md
    ├── PRD-SAAS-MNG-0013_Security_Governance.md
    ├── PRD-SAAS-MNG-0014_AI_Automation.md
    ├── PRD-SAAS-MNG-0015_CICD_Schema_Control.md
    ├── PRD-SAAS-MNG-0016_Deployment_Ops.md
    ├── PRD-SAAS-MNG-0017_Data_Residency_MultiRegion.md
    ├── PRD-SAAS-MNG-0018_Backup_BCDR.md
    ├── PRD-SAAS-MNG-0019_Import_Export_Onboarding.md
    ├── PRD-SAAS-MNG-0020_Compliance_Policy.md
    ├── PRD-SAAS-MNG-0021_Developer_Portal.md
    ├── PRD-SAAS-MNG-0022_Testing_QA.md
    └── PRD-SAAS-MNG-0023_Performance_Guardrails.md
Next Steps - What Should I Create?
✅ Create all 23 PRD documents (PRD-SAAS-MNG-0001 through 0023)?
✅ Create master documentation folder with all required files per documentation rules?
✅ Generate database migration files for all platform tables?
✅ Create architecture diagrams (Mermaid.js flowcharts)?
✅ Scaffold platform-admin application structure?
✅ Create implementation task breakdown (detailed TODO lists)?
Recommendation: Start with creating all PRD documents first to have complete specifications, then proceed with implementation planning and scaffolding. Ready to proceed when you confirm!

--------------

Claude’s Plan
SaaS Platform Management Implementation Plan
Overview
Create a comprehensive Platform HQ Console (separate from tenant-facing dashboard) to manage the entire CleanMateX SaaS platform, including tenant lifecycle, billing, subscriptions, support, and system configuration.
Key Findings from Analysis
✅ Strong Foundation Exists
Excellent multi-tenancy architecture (sys_/org_ separation)
Comprehensive subscription/plan system with feature flags
Advanced workflow engine with configurable stages
Robust authentication and RLS policies
Well-structured web-admin for tenant-facing features
❌ Critical Gaps
NO platform admin interface - web-admin is 100% tenant-facing
NO platform admin user system - only tenant users exist
NO platform billing - no invoice generation for subscriptions
NO support ticketing - no formal support system
NO platform analytics - no cross-tenant metrics
NO tenant lifecycle management - no onboarding/health tracking
Proposed Solution: PRD-SAAS-MNG-0001 Structure
Phase 1: Foundation (Weeks 1-2)
Database Schema Extensions:
Create sys_platform_users (platform admins separate from tenant users)
Create sys_platform_audit_log (audit all HQ actions)
Create sys_tenant_invoices (platform billing for subscriptions)
Create sys_tenant_lifecycle (onboarding, health scores, churn prediction)
Create sys_tenant_metrics_daily (aggregated analytics)
Create sys_platform_features (platform-level feature flags)
Create sys_support_tickets (support ticketing system)
Authentication & Authorization:
Extend JWT for platform admin role (separate from tenant roles)
Implement permission-based access control (PBAC)
Build secure tenant impersonation system with audit trail
Create platform admin registration/login flow
Core Services:
platform-admin.service.ts - Tenant management
platform-auth.service.ts - Platform admin authentication
platform-audit.service.ts - Audit logging
Phase 2: Platform Admin UI (Weeks 3-4)
New Application: platform-admin/
Separate Next.js app (NOT part of web-admin)
Dedicated authentication realm
Platform branding (different from tenant dashboard)
Core Pages:
/platform-admin/login - Admin login
/platform-admin/dashboard - Platform overview (KPIs, health)
/platform-admin/tenants - All tenants list with filters
/platform-admin/tenants/[id] - Tenant details & management
/platform-admin/tenants/[id]/impersonate - Support access
Components:
Tenant list with advanced filtering
Health score indicators
Impersonation watermark banner
Platform metrics dashboard
Phase 3: Billing & Subscriptions (Weeks 5-6)
Services:
platform-billing.service.ts - Invoice generation, payment processing
platform-subscriptions.service.ts - Plan management, upgrades
platform-metrics.service.ts - Usage aggregation
UI Pages:
/platform-admin/billing/invoices - All subscription invoices
/platform-admin/billing/payments - Payment tracking
/platform-admin/billing/failed-payments - Dunning management
/platform-admin/plans - Manage subscription plans
/platform-admin/plans/[code]/edit - Edit plan details
Phase 4: Analytics & Reporting (Weeks 7-8)
Services:
platform-analytics.service.ts - Cross-tenant analytics
Scheduled jobs for daily metric aggregation
Churn prediction algorithms
UI Pages:
/platform-admin/analytics/overview - Platform KPIs
/platform-admin/analytics/revenue - Revenue analytics
/platform-admin/analytics/usage - Usage patterns
/platform-admin/analytics/churn - Churn prediction dashboard
Phase 5: Support & Lifecycle (Weeks 9-10)
Services:
platform-support.service.ts - Ticketing system
platform-onboarding.service.ts - Onboarding workflows
platform-notifications.service.ts - Admin notifications
UI Pages:
/platform-admin/support/tickets - All support tickets
/platform-admin/support/[id] - Ticket details
/platform-admin/onboarding - Tenant onboarding tracker
/platform-admin/system - Platform configuration
Phase 6: Core Data Management (Weeks 11-12)
System Code Tables UI:
Manage all sys_*_cd tables (service categories, payment methods, etc.)
Seed data management interface
Workflow template configuration
Default product catalog management
Pages:
/platform-admin/system/codes - Code tables management
/platform-admin/system/workflows - Workflow templates
/platform-admin/system/features - Feature flag management
/platform-admin/system/settings - Platform settings
PRD Document Structure
PRD-SAAS-MNG-0001: Platform HQ Console (Master PRD)
Executive Summary
Internal SaaS HQ Model (not public self-serve)
User Personas (You + Team)
Feature Categories Overview
Architecture Decisions (Separate App vs Unified)
Security & Compliance
Implementation Phases
Dependencies & Integration Points
Sub-PRDs (Detailed Feature Sets):
PRD-SAAS-MNG-0002: Tenant Lifecycle Management
PRD-SAAS-MNG-0003: Billing & Subscription Management
PRD-SAAS-MNG-0004: Platform Analytics & Reporting
PRD-SAAS-MNG-0005: Support & Ticketing System
PRD-SAAS-MNG-0006: Core Data & Code Management
PRD-SAAS-MNG-0007: Workflow Engine Management
PRD-SAAS-MNG-0008: Customer Master Data Management (Global + Tenant)
PRD-SAAS-MNG-0009: Authentication & Authorization
PRD-SAAS-MNG-0010: Platform Configuration & Settings
Key Architectural Decisions
Decision 1: Separate Application (Recommended)
Create platform-admin/ as standalone Next.js app
Why: Security isolation, clear separation, no tenant access risk
Trade-off: More code but better security
Decision 2: Service Role Access with Audit
Platform admins bypass RLS using service role
Every action logged in sys_platform_audit_log
Why: Need cross-tenant visibility with accountability
Decision 3: Time-Limited Impersonation
Support can impersonate tenants for 30 minutes max
Full audit trail + visual watermark
Why: Balance support needs with security
Next Steps
Would you like me to:
✅ Create the master PRD (PRD-SAAS-MNG-0001) with complete specifications?
✅ Create detailed sub-PRDs for each feature area (0002-0010)?
✅ Generate database migration files for new platform tables?
✅ Scaffold the platform-admin application structure?
✅ Document the implementation roadmap with detailed tasks?
All PRDs will follow your documentation standards from .claude/docs/documentation_rules.md and be placed in docs/features/SAAS_Platform_Management/.
Stayed in plan mode
Perfect! Thank you for that critical clarification. Let me update the plan with this confirmed architectural decision.
Updated Implementation Plan: Standalone Platform HQ Console
✅ Confirmed Architecture Decision
Standalone Module - Completely separate application with:
✅ Separate login system
✅ Separate dashboard
✅ Separate authentication realm
✅ Separate branding/theme
✅ Independent deployment
✅ No shared routes with tenant dashboard
Proposed Structure
cleanmatex/
├── web-admin/              # Existing: Tenant-facing dashboard
├── platform-admin/         # NEW: Standalone HQ Console
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── tenants/
│   │   │   ├── billing/
│   │   │   ├── analytics/
│   │   │   ├── support/
│   │   │   ├── system/
│   │   │   └── settings/
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   │   ├── services/
│   │   └── auth/
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
├── backend/                # Shared backend (future)
└── packages/               # Shared utilities
    ├── types/
    ├── utils/
    └── database/
Key Benefits of Standalone Approach
Security Isolation: Zero risk of tenant users accessing platform features
Different Auth: Platform admins use completely separate authentication
Independent Deployment: Can update platform console without affecting tenants
Different Permissions: Platform RBAC separate from tenant RBAC
Custom Branding: Different look/feel for internal tool
Scalability: Can run on different infrastructure if needed
Implementation Plan
Phase 1: Scaffold Standalone App (Week 1)
Create platform-admin/ Next.js 15 application
Setup separate authentication configuration
Create platform admin login page
Implement platform-specific middleware
Configure environment variables for platform access
Phase 2: Core Database & Services (Week 2)
All platform-specific tables (sys_platform_*)
Platform admin services
Audit logging system
Service role access patterns
Phase 3: Platform Dashboard & Tenant Management (Weeks 3-4)
Platform dashboard with KPIs
Complete tenant management interface
Tenant impersonation system
Health monitoring
Phase 4-6: Billing, Analytics, Support (Weeks 5-10)
As previously outlined
Phase 7: Core Data Management (Weeks 11-12)
System code tables management
Workflow templates
Seed data administration
Updated PRD Structure
PRD-SAAS-MNG-0001: Master PRD - Standalone Platform HQ Console
Emphasize standalone architecture
Separate authentication strategy
Independent deployment model
Team-only access (you + internal team)
Sub-PRDs remain the same (0002-0010) but all scoped to standalone application.
Ready to proceed? Should I now create:
The complete PRD-SAAS-MNG-0001 (Master PRD) with standalone architecture details?
All sub-PRDs (0002-0010) for each feature area?
Database migration files for platform tables?
Initial scaffold plan for platform-admin/ application?
All following your documentation standards in .claude/docs/documentation_rules.md.
