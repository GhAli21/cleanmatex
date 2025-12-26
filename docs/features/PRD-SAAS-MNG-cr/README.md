# CleanMateX HQ SaaS Platform Management - PRD Index

**Owner:** Jehad Ali (Jh Apps HQ)  
**Users:** Jh Apps Core Team (Founders, DevOps, Admins, Auditors)  
**Type:** Internal Management Module  
**Status:** Planning Phase

---

## 🚀 Getting Started

**👉 [MASTER IMPLEMENTATION PLAN](./MASTER_IMPLEMENTATION_PLAN.md)** - Start here!  
The master plan contains the complete implementation guide, architecture, environment setup, and roadmap.

**📋 [IMPLEMENTATION PROMPTS](./IMPLEMENTATION_PROMPTS.md)** - Copy-paste prompts for AI assistants  
Ready-to-use prompts organized by category for smooth, tracked implementation.

**🔢 [SEQUENTIAL IMPLEMENTATION PROMPTS](./SEQUENTIAL_IMPLEMENTATION_PROMPTS.md)** - Step-by-step prompts in exact order  
Follow prompts sequentially from Step 1 - each prompt builds on the previous for guaranteed on-track implementation.

---

## Overview

This directory contains all Product Requirements Documents (PRDs) for the CleanMateX HQ SaaS Platform Management system. The HQ Console is a standalone module used internally by the development team to manage the multi-tenant platform.

**Architecture**: The HQ Console consists of separate applications:
- **platform-web**: Next.js frontend application (HQ Console UI)
- **platform-api**: Backend API (NestJS or Next.js API routes)
- **platform-workers**: Background workers (optional)

---

## PRD Modules

### Phase 1: Foundation (Critical)
- [PRD-SAAS-MNG-0011](PRD-SAAS-MNG-0011_Standalone_Module_Architecture.md) - Standalone Module Architecture
- [PRD-SAAS-MNG-0001](PRD-SAAS-MNG-0001_Tenant_Lifecycle_Management.md) - Tenant Lifecycle Management
- [PRD-SAAS-MNG-0002](PRD-SAAS-MNG-0002_Plans_Subscriptions_Management.md) - Plans & Subscriptions Management
- [PRD-SAAS-MNG-0010](PRD-SAAS-MNG-0010_HQ_Console_UI_Framework.md) - HQ Console UI Framework
- [PRD-SAAS-MNG-0005](PRD-SAAS-MNG-0005_Auth_User_Management.md) - Authentication & User Management

### Phase 2: Core Operations (High Priority)
- [PRD-SAAS-MNG-0003](PRD-SAAS-MNG-0003_Workflow_Engine_Management.md) - Workflow Engine Management
- [PRD-SAAS-MNG-0006](PRD-SAAS-MNG-0006_Core_Data_Service_Catalog.md) - Core Data Management - Service Catalog
- [PRD-SAAS-MNG-0007](PRD-SAAS-MNG-0007_Core_Data_System_Codes.md) - Core Data Management - System Codes
- [PRD-SAAS-MNG-0014](PRD-SAAS-MNG-0014_Security_RLS_Governance.md) - Security, RLS & Governance
- [PRD-SAAS-MNG-0013](PRD-SAAS-MNG-0013_Observability_SLO_Enforcement.md) - Observability & SLO Enforcement

### Phase 3: Advanced Features (Medium Priority)
- [PRD-SAAS-MNG-0004](PRD-SAAS-MNG-0004_Customer_Data_Management.md) - Customer Data Management
- [PRD-SAAS-MNG-0008](PRD-SAAS-MNG-0008_Data_Seeding_Initialization.md) - Data Seeding & Initialization
- [PRD-SAAS-MNG-0009](PRD-SAAS-MNG-0009_Platform_Analytics_Monitoring.md) - Platform Analytics & Monitoring
- [PRD-SAAS-MNG-0012](PRD-SAAS-MNG-0012_Automation_Worker_Architecture.md) - Automation & Worker Architecture
- [PRD-SAAS-MNG-0024](PRD-SAAS-MNG-0024_Support_Impersonation.md) - Support & Impersonation
- [PRD-SAAS-MNG-0022](PRD-SAAS-MNG-0022_Import_Export_Onboarding.md) - Import / Export & Onboarding Tooling

### Phase 4: Infrastructure & Scale
- [PRD-SAAS-MNG-0016](PRD-SAAS-MNG-0016_CI_CD_Schema_Control.md) - CI/CD & Schema Control
- [PRD-SAAS-MNG-0017](PRD-SAAS-MNG-0017_Deployment_Ops.md) - Deployment & Ops
- [PRD-SAAS-MNG-0021](PRD-SAAS-MNG-0021_Backup_BCDR_Tenant_Restore.md) - Backup, BCDR, and Tenant-Level Restore
- [PRD-SAAS-MNG-0025](PRD-SAAS-MNG-0025_Performance_Load_Guardrails.md) - Performance & Load Guardrails
- [PRD-SAAS-MNG-0020](PRD-SAAS-MNG-0020_Data_Residency_Multi_Region.md) - Data Residency & Multi-Region

### Phase 5: Advanced Capabilities
- [PRD-SAAS-MNG-0015](PRD-SAAS-MNG-0015_AI_Automation_Layer.md) - AI / Automation Layer
- [PRD-SAAS-MNG-0018](PRD-SAAS-MNG-0018_Licensing_Entitlements.md) - Licensing & Entitlements
- [PRD-SAAS-MNG-0019](PRD-SAAS-MNG-0019_Tenant_Org_Customization_Layer.md) - Tenant/Org Customization Layer
- [PRD-SAAS-MNG-0023](PRD-SAAS-MNG-0023_Developer_Integration_Portal.md) - Developer & Integration Portal
- [PRD-SAAS-MNG-0027](PRD-SAAS-MNG-0027_Reporting_Analytics_Billing.md) - Reporting, Analytics, and Billing Insights

### Phase 6: Quality & Compliance
- [PRD-SAAS-MNG-0026](PRD-SAAS-MNG-0026_Testing_QA_Matrix.md) - Testing & QA Matrix
- [PRD-SAAS-MNG-0028](PRD-SAAS-MNG-0028_Compliance_Policy_Management.md) - Compliance & Policy Management

---

## Standard PRD Structure

Each PRD follows this structure:
1. **Overview & Purpose** - High-level description and business value
2. **Functional Requirements** - Detailed feature requirements
3. **Technical Requirements** - Technical specifications and architecture
4. **Database Schema** - Database tables and relationships
5. **API Endpoints** - REST API specifications
6. **UI/UX Requirements** - User interface and experience requirements
7. **Security Considerations** - Security measures and best practices
8. **Testing Requirements** - Testing strategy and test cases
9. **Implementation Checklist** - Step-by-step implementation guide

---

## Project Structure

```
cleanmatex/
├── platform-web/              # HQ Console Frontend (Next.js)
├── platform-api/               # HQ Console Backend API
├── platform-workers/           # Background workers (optional)
├── web-admin/                 # Tenant-facing admin (existing)
├── backend/                   # Tenant-facing backend (existing)
└── docs/features/PRD-SAAS-MNG-cr/  # This directory
```

---

## Related Documentation

- **[MASTER IMPLEMENTATION PLAN](./MASTER_IMPLEMENTATION_PLAN.md)** - Complete implementation guide
- [Master Plan](../../plan/master_plan_cc_01.md) - Overall project plan
- [Architecture Documentation](../../.claude/docs/architecture.md) - System architecture
- [Multi-Tenancy Documentation](../../.claude/docs/multitenancy.md) - Multi-tenancy patterns

---

## Quick Links

- **🚀 Start Here**: [MASTER_IMPLEMENTATION_PLAN.md](./MASTER_IMPLEMENTATION_PLAN.md) - Complete implementation guide
- **🔢 Sequential Prompts**: [SEQUENTIAL_IMPLEMENTATION_PROMPTS.md](./SEQUENTIAL_IMPLEMENTATION_PROMPTS.md) - Step-by-step prompts in order (RECOMMENDED)
- **📋 Category Prompts**: [IMPLEMENTATION_PROMPTS.md](./IMPLEMENTATION_PROMPTS.md) - Prompts organized by category
- **📚 All PRDs**: See list below organized by phase

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0

