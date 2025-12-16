# SAAS Platform Management - Lookup File

**Feature Name:** CleanMateX Platform HQ Console
**Folder Path:** `docs/features/SAAS_Platform_Management/`
**Description:** Enterprise-grade standalone platform management console for managing tenants, billing, analytics, compliance, and infrastructure
**Version:** v0.1.0
**Last Updated:** 2025-01-14

---

## Sub-Components

### PRDs (Product Requirement Documents)

| PRD Code | Name | Folder Path | Version | Status |
|----------|------|-------------|---------|--------|
| PRD-SAAS-MNG-0001 | Platform HQ Console (Master) | PRDs/PRD-SAAS-MNG-0001_Platform_HQ_Console.md | v0.1.0 | In Progress |
| PRD-SAAS-MNG-0002 | Tenant Lifecycle Management | PRDs/PRD-SAAS-MNG-0002_Tenant_Lifecycle.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0003 | Billing & Subscription Management | PRDs/PRD-SAAS-MNG-0003_Billing_Subscriptions.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0004 | Analytics & Reporting | PRDs/PRD-SAAS-MNG-0004_Analytics_Reporting.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0005 | Support & Ticketing System | PRDs/PRD-SAAS-MNG-0005_Support_Ticketing.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0006 | Core Data & Code Management | PRDs/PRD-SAAS-MNG-0006_Core_Data_Management.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0007 | Workflow Engine Management | PRDs/PRD-SAAS-MNG-0007_Workflow_Engine.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0008 | Customer Master Data Management | PRDs/PRD-SAAS-MNG-0008_Customer_Master_Data.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0009 | Auth & Authorization | PRDs/PRD-SAAS-MNG-0009_Auth_Authorization.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0010 | Platform Configuration | PRDs/PRD-SAAS-MNG-0010_Platform_Configuration.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0011 | Automation & Workers | PRDs/PRD-SAAS-MNG-0011_Automation_Workers.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0012 | Observability & SLO | PRDs/PRD-SAAS-MNG-0012_Observability_SLO.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0013 | Security & Governance | PRDs/PRD-SAAS-MNG-0013_Security_Governance.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0014 | AI / Automation Layer | PRDs/PRD-SAAS-MNG-0014_AI_Automation.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0015 | CI/CD & Schema Control | PRDs/PRD-SAAS-MNG-0015_CICD_Schema_Control.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0016 | Deployment & Ops | PRDs/PRD-SAAS-MNG-0016_Deployment_Ops.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0017 | Data Residency & Multi-Region | PRDs/PRD-SAAS-MNG-0017_Data_Residency_MultiRegion.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0018 | Backup, BCDR & Restore | PRDs/PRD-SAAS-MNG-0018_Backup_BCDR.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0019 | Import / Export & Onboarding | PRDs/PRD-SAAS-MNG-0019_Import_Export_Onboarding.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0020 | Compliance & Policy Management | PRDs/PRD-SAAS-MNG-0020_Compliance_Policy.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0021 | Developer & Integration Portal | PRDs/PRD-SAAS-MNG-0021_Developer_Portal.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0022 | Testing & QA Matrix | PRDs/PRD-SAAS-MNG-0022_Testing_QA.md | v0.1.0 | Planned |
| PRD-SAAS-MNG-0023 | Performance & Load Guardrails | PRDs/PRD-SAAS-MNG-0023_Performance_Guardrails.md | v0.1.0 | Planned |

### Technical Documentation

| Document | Description | Path |
|----------|-------------|------|
| Architecture | System architecture & design patterns | technical_docs/tech_architecture.md |
| Database Schema | Platform database schema design | technical_docs/tech_database_schema.md |
| API Specifications | Platform API endpoints | technical_docs/tech_api_specs.md |
| Security Model | Security architecture & RLS policies | technical_docs/tech_security_model.md |
| Deployment Guide | Deployment strategies & operations | technical_docs/tech_deployment.md |

---

## Quick Navigation

- [README](README.md) - Feature overview
- [Development Plan](development_plan.md) - Implementation roadmap
- [Progress Summary](progress_summary.md) - Current progress
- [Current Status](current_status.md) - Latest status
- [Developer Guide](developer_guide.md) - For developers
- [User Guide](user_guide.md) - For platform admin users
- [Testing Scenarios](testing_scenarios.md) - Test cases
- [CHANGELOG](CHANGELOG.md) - Version history

---

## Related Features

- Web Admin Dashboard (`web-admin/`) - Tenant-facing application
- Subscription Management (`web-admin/lib/services/subscriptions.service.ts`)
- Tenant Services (`web-admin/lib/services/tenants.service.ts`)
- Database Schema (`supabase/migrations/`)

---

## Contact & Support

- **Project Lead:** Gehad Abdo Mohammed Ali
- **Documentation:** `.claude/docs/documentation_rules.md`
- **Architecture:** `.claude/docs/architecture.md`
