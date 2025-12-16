A — PRD-SAAS-MNG-001 v1.9 (Ultimate Full Spec)

Format: Markdown
Style: Executive + Technical Hybrid
Depth: Enterprise-Level (Level 4)

This will be the master PRD governing CleanMateX HQ SaaS Platform Management.
It will be long, comprehensive, and ready for direct use in your /docs/ folder.

PRD-SAAS-MNG-001 v1.9 — CleanMateX SaaS Platform Management

Document Type: Product Requirements Document
Format: Markdown (.md)
Version: 1.9
Owner: CleanMateX HQ
Audience: CTO, Architects, Backend, DevOps, Platform Ops, QA
Status: Active
Scope: Entire SaaS HQ Platform Layer (System-Level)

0. Executive Summary

CleanMateX is a multi-tenant SaaS for laundry/dry cleaning operations across GCC and global markets.
The SAAS-MNG module is the headquarters layer managing everything across tenants:

Multi-tenant provisioning

Plans, billing, subscription engine

Feature flags & usage limits

Global catalogs & system data

Global customers registry

Platform governance

Platform monitoring, compliance, RLS

Workflow templates

Security, audits, and integrations

Marketplace enablement

API rate limits, quotas, entitlements

This PRD defines the HQ-owned system layer.
All tenant apps (Admin, Customer, Driver) depend on the platform behaviors defined here.

1. Goals & Non-Goals
1.1 Goals

Centralize tenant lifecycle, billing, subscriptions, limits, and feature governance.

Maintain global registry for customers, catalog, workflows, and system rules.

Provide cross-tenant analytics and usage visibility.

Enforce strong multi-tenancy security via RLS + composite keys.

Support SaaS scaling model (1000+ tenants).

Provide platform-wide compliance and observability.

Enable modular add-ons (WhatsApp, PDF, Drivers, Marketplace, B2B).

Provide foundation for marketplace ecosystem (reviews, disputes).

1.2 Non-Goals

Not defining tenant-level operational functions (orders, invoicing, QA, assembly).

Not defining UI design for tenant-level apps (covered in other PRDs).

Not defining marketplace order flows (separate PRD-MKT).

2. Platform Architecture & Ownership
2.1 Layer Ownership
Layer	Owner	Description
System-Level (sys_*)	HQ	Global shared data; single-instance
Org-Level (org_*)	Tenant	Isolated per tenant (RLS)
Platform Services	HQ	Billing, limits, flags, identity, workflows
Operations Apps	Tenant	Admin Web, Mobile Apps
2.2 Core Platform Components

Tenant Engine: Onboarding, activation, subscription.

Entitlements Engine: Plan features, limits, gating.

Catalog Engine: System-level categories / lookups.

Identity Engine: Global customers registry.

Security Engine: RLS, RBAC, audit logs, permissions.

Workflow Engine: Templates and overrides.

Integration Engine: Payments, WhatsApp, SMS, Email, Maps.

Observability Layer: Metrics, logs, alerts.

3. Multi-Tenant Governance
3.1 Tenant Lifecycle

HQ can:

Create tenant (manual/auto)

Suspend/reactivate tenant

Assign subscription plan

Reset tenant data (demo)

Clone tenant configuration

Export tenant data

States:

Draft → Active → Grace Period → Suspended → Archived

3.2 Tenant Profile

Fields:

Legal Name (EN/AR)

Country, City

VAT Number

Corporate Email

Support Phone

Branding (logo, receipts)

Currency & timezone

Default WhatsApp template pack

3.3 Branch Management

A tenant can have 1..N branches based on plan.

Branch settings:

Delivery availability

Driver assignment

SLA rules

Cutoff times

Branding override

Workflow override

4. Subscriptions, Plans & Feature Flags
4.1 Plans Structure

Free Trial

Starter

Growth

Pro

Enterprise

4.2 Feature Flag Engine

Stored in org_tenants_mst.feature_flags (JSONB)

Examples:

{
  "pdf_invoices": true,
  "driver_app": false,
  "whatsapp_receipts": true,
  "b2b_contracts": false,
  "marketplace_listings": true,
  "advanced_analytics": false
}

Gating Rules

UI gating – Next.js/Flutter hides restricted features.

API gating – NestJS middlewares enforce.

DB gating – RLS prevents unauthorized writes.

4.3 Usage Limits

Limits per plan:

Orders / month
Users
Branches

File storage quota

API rate limit

WhatsApp sends

PDF render limit

Exceeding limit → soft block (warning) → hard block.

5. Global Catalog & Lookup System
5.1 System-Level Catalogs (sys_*)

Service Categories (washing, dry clean, ironing…)

Issue Codes

Solution Codes

Price Units (piece/kg)

Tax/VAT rules

Workflow templates

Payment methods

Notification templates

HQ creates & maintains.
Tenants approve or override localization or pricing.

5.2 Catalog Propagation

Upon tenant creation:

copy system settings to tenant-level

initialize price lists

initialize workflow settings

initialize categories enablement

6. Global Customer Identity Registry
6.1 Purpose

Provide a unified identity across all tenants.

6.2 Flow

Search by phone → global match.

Link global customer to tenant via org_customers_mst.

Sync updates from tenant → sys layer.

Maintain unified engagement history per global customer.

6.3 Customer Types

Guest (only in tenant)

Stub (POS-created, phone only)

Full (OTP verified)

App User

B2B Customer

Marketplace User

7. Workflow Templates (System-Level)
7.1 Templates

WF_SIMPLE

WF_STANDARD

WF_ASSEMBLY_QA

WF_PICKUP_DELIVERY

WF_ISSUE_REPROCESS

7.2 Elements

Stages

Stage types

Transitions

Guard conditions

Auto-transition logic

7.3 Tenant Overrides

Allowed per:

Tenant

Branch

Service category

8. RBAC & User Governance
8.1 System Roles

HQ Admin

HQ Finance

HQ Support

HQ Moderator

Tenant Admin

Branch Manager

Operator

QA

Packing

Driver

Finance

8.2 Permissions

System-level:

Manage tenants

Manage plans

Modify settings

Access platform analytics

Org-level:

Manage orders

Manage customers

Manage price lists

Manage drivers

Manage workflows

8.3 Resource-Based Permissions

For branch/store constraints:
org_user_resource_permissions

9. Security, Compliance & Data Governance
9.1 RLS Model

Each org_* table includes:

tenant_org_id = current_setting('app.current_tenant_id')

9.2 Composite Key Pattern

Ensures tenant isolation:

(customer_id, tenant_org_id)

9.3 Mandatory Encryption

TLS 1.2+

At-rest encryption (Postgres + S3/MinIO)

9.4 Compliance

GCC VAT

Privacy (GDPR-like)

Opt-in/out logs

Data deletion & portability

Residency options for enterprise

10. Integrations Governance
10.1 Payment Gateways

HyperPay

PayTabs

Stripe

Fatoorah (optional)

10.2 Communication Channels

WhatsApp Business API

SMS Providers

Email (SendGrid/Mailgun)

10.3 Maps

Google Maps API

Distance matrix for routing

10.4 Printing & POS

ESC/POS printers

Thermal PDF receipts

11. Observability, Monitoring & SLOs
11.1 SLO Targets

API latency:

p50 < 300ms

p95 < 800ms

99.9% availability

Search < 1s @ 100k orders

PDF generation < 1s

WhatsApp delivery success > 98%

11.2 Metrics

Tenant usage

Subscription renewal

Error rates

Whatsapp latency

Payment gateway uptime

Queue processing times

11.3 Logging

OpenTelemetry traces

Correlation IDs

Error logs → Sentry

Crash logs → Crashlytics (mobile)

12. API Governance Layer

APIs under SAAS-MNG:

12.1 Tenant APIs
POST /tenants
GET /tenants/{id}
PATCH /tenants/{id}/settings
POST /tenants/{id}/activate
POST /tenants/{id}/suspend

12.2 Subscription APIs
POST /subscriptions
PATCH /subscriptions/{id}
GET /subscriptions/{tenantId}

12.3 Feature Flag API
GET /tenants/{id}/features
PATCH /tenants/{id}/features

12.4 Global Catalog APIs
GET /catalog/categories
POST /catalog/categories
PATCH /catalog/categories/{id}

12.5 Workflow APIs
GET /workflow/templates
POST /workflow/templates

12.6 Observability APIs
GET /platform/metrics
GET /platform/usage
GET /platform/errors

13. Seed Logic (System Level)

System seed includes:

Global settings

Workflow templates

Categories

Price units

VAT rules

Notification templates

System roles

System permissions

Tenant seed upon creation:

Settings copied from system

Categories enabled

Workflow default template

Feature flags from plan

Branch defaults

14. Migration & Evolution
14.1 Safe Migration Pattern

Add columns as nullable

Backfill

Switch in code

Enforce NOT NULL

Remove deprecated fields later

14.2 Backward Compatibility

Every change must:

Maintain API signature

Maintain RLS envelope

Avoid breaking existing tenants

15. Platform UI (HQ Admin Console)
Screens:

Dashboard (tenants, revenue, usage, alerts)

Tenants management

Subscriptions & billing

Global customers registry

Global catalogs

Workflows

Feature flags manager

Limits & quotas screen

Integrations management

Notifications templates

Audit logs

Observability dashboards

16. KPIs & Success Criteria
Platform KPIs:

Tenant churn < 5%

Plan upgrades/month +10%

API uptime > 99.9%

Support tickets reduced < 48h

SLA breach rate < 3%

17. Release Roadmap (HQ Layer)
Phase 1

Tenants

Plans

Subscriptions

Feature flags

Global settings

Phase 2

Global customers

Catalogs

Workflow templates

RLS hardening

Phase 3

Observability dashboards

HQ Admin Console

Marketplace governance

Phase 4

Integrations management

SLA automation

Multi-region replication