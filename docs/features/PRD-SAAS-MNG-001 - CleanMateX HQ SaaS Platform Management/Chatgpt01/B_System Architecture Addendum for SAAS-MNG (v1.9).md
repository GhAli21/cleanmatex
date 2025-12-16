B — System Architecture Addendum for SAAS-MNG (v1.9)

Document Type: Architecture Addendum
Version: 1.9
Format: Markdown
Audience: CTO, Solution Architects, Backend/DevOps Leads
Scope: Headquarters SaaS Platform Layer (System-Level)

0. Purpose

This Architecture Addendum extends the PRD-SAAS-MNG-001 by defining:

System architecture

Logical and physical components

Deployment topology

Module boundaries

Data flows

Multi-tenant enforcement architecture

API gateway + rate limits

Integration architecture

Observability stack

Scaling strategy

Design trade-offs and rationale

This addendum is the technical blueprint for future engineering decisions.

1. Architectural Principles

System-Level Ownership

All HQ-managed behavior lives under the SAAS-MNG module.

No tenant can override global rules unless explicitly permitted.

Strong Multi-Tenancy

PostgreSQL RLS is the core enforcement.

Composite foreign keys guarantee referential integrity.

API-First

All platform functions are exposed via OpenAPI endpoints.

Backoffice UI (HQ Console) consumes the same APIs.

Modular & Scalable

Decoupled services with clear responsibility.

Redis queues for heavy jobs.

File storage externalized (MinIO/S3).

Observable by Default

OpenTelemetry instrumentation everywhere.

Metrics, logs, traces, dashboards standard.

Security & Compliance

RLS at database level

JWT + signed webhooks

Idempotency on all write operations

Secrets manager usage mandatory

2. High-Level Architecture Diagram (Logical)
 ┌─────────────────────────────────────────────────────────┐
 │                     CleanMateX HQ Layer                 │
 │                   (SAAS-MNG System-Level)               │
 ├─────────────────────────────────────────────────────────┤
 │    Global Settings Engine     ┃     Subscription Engine  │
 │    Feature Flags Engine       ┃     Entitlements Engine  │
 │    Workflow Templates         ┃     Catalog Master Data  │
 │    Global Customers Registry  ┃     Billing/Plans        │
 │    RBAC Governance            ┃     Platform Analytics   │
 └─────────────────────────────────────────────────────────┘

                       ▼                 ▲
             ┌────────────────────────────────┐
             │       API Gateway + RateLimits │
             └────────────────────────────────┘

                       ▼
        ┌─────────────────────────────────────────┐
        │               NestJS API Layer           │
        │ Modules:                                 │
        │  - tenants                               │
        │  - subscriptions                         │
        │  - feature-flags                         │
        │  - workflows                             │
        │  - catalogs                              │
        │  - global-customers                      │
        │  - platform-metrics                      │
        │  - rbac                                  │
        │  - auth-middleware                       │
        └─────────────────────────────────────────┘

                       ▼
    ┌─────────────────────────────────────────────────────────┐
    │                PostgreSQL 16 (RLS Enabled)              │
    │ Schemas:                                                │
    │   sys_* (global tables)                                 │
    │   org_* (tenant-isolated tables)                        │
    │ Tenant enforcement: RLS + app.current_tenant_id         │
    │ FKs: composite keys (id, tenant_org_id)                 │
    └─────────────────────────────────────────────────────────┘

                 ▼                    ▼                    ▼
 ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
 │   Redis / BullMQ     │  │     MinIO / S3      │  │   External Systems  │
 │  queues/schedules    │  │  receipts/images    │  │ Payments/WA/SMS/Maps│
 └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

3. Component Breakdown
3.1 SAAS-MNG Core Services
3.1.1 Tenant Service

Responsibilities:

Create/update tenants

Assign subscription plan

Suspend/reactivate

Seed tenant configurations

Clone settings from system templates

3.1.2 Subscription Engine

Plan purchase

Billing schedule

Grace period logic

Over-limit detection

Feature entitlements activation

3.1.3 Entitlements & Feature Flags Engine

Evaluate feature availability

API gating middleware

UI gating with feature metadata

Quota management (orders, branches, users)

WhatsApp/PDF/API rate limits

3.1.4 Global Catalog Engine

Global categories

Lookups (issue codes, service types, etc.)

System workflows

VAT rules

Notification templates

3.1.5 Workflow Templates Engine

Template create/edit

Template activation

Stage/transition ruleset

Integration with order flows

Override per tenant/branch

3.1.6 Global Customer Registry

Unified identity resolution

Tenant link/unlink

Contact normalization

Cross-tenant engagement tracking

3.1.7 RBAC & Security Engine

Permissions matrix

Default role profiles

Tenant role overrides

Branch-level access

3.1.8 Observability & Metrics Engine

Aggregated tenant usage

Platform SLO metrics

Audit events

Error tracking

4. Multi-Tenancy Enforcement Model
4.1 Tenant Context Propagation

Set via:

SET app.current_tenant_id = '<uuid>';

4.2 RLS Policy Example
CREATE POLICY tenant_isolation ON org_orders_mst
  USING (tenant_org_id = current_setting('app.current_tenant_id')::uuid);

4.3 Composite FK Pattern

Ensures row belongs to the same tenant:

(customer_id, tenant_org_id) 
   REFERENCES org_customers_mst(customer_id, tenant_org_id)


Mandatory for:

customers

orders

invoices

workflow entities

logs

5. Data Architecture
5.1 Schemas
Schema	Purpose
sys_*	Global reference data
org_*	Tenant-specific operational data
5.2 System-Level Tables

sys_customers_mst

sys_service_category_cd

sys_auth_permissions

sys_settings_cd

workflow_template_cd

workflow_template_transitions

5.3 Tenant-Level Tables

org_tenants_mst

org_customers_mst

org_orders_mst

org_branches_mst

org_tenant_settings_cf

org_subscriptions_mst

org_auth_user_roles

org_user_permissions

5.4 Event Logging Tables

org_audit_log

org_order_history (if cross-used)

sys_platform_events

6. Deployment Architecture (Physical)
───────────────────────────────────────────────────────────
 Region: Middle East (Primary)  
───────────────────────────────────────────────────────────

 Users → CDN → API Gateway → NestJS Cluster → Postgres
                                          ↘ Redis
                                          ↘ MinIO
                                          ↘ External Providers
───────────────────────────────────────────────────────────

6.1 Components
A. API Gateway (NGINX / AWS ALB)

Rate limiting

TLS termination

Routing per service

DDoS protection (Cloudflare optional)

B. NestJS Containers (Kubernetes)

Horizontal autoscaling

Health checks

Rolling deployments

C. PostgreSQL Cluster

Primary + 2 replicas

PITR backups

PgBouncer connection pooling

D. Redis

Queue processing

Caching

Scheduled jobs

E. MinIO/S3

Storage for:

receipts

images

packing lists

tenant branding assets

F. Observability Stack

Prometheus

Grafana

OpenTelemetry collector

Loki (optional)

Sentry (errors)

7. Integration Architecture
7.1 Payment Gateway Integration

Pattern:

Tenant Admin → Payment Checkout URL → Provider → Webhook → NestJS → Postgres


Key requirements:

Idempotent webhook handlers

Signature verification (HMAC)

Mapping transactions to tenants

7.2 WhatsApp Integration

Flow:

Order/Event → Worker Queue → Template Render → WhatsApp API → Delivery Callback → db

7.3 Maps Integration

Distance matrix for delivery

Geocode normalization

Autofill city/area for customers

8. API Design Standards
8.1 Versioning
/v1/saas/tenants
/v1/saas/subscriptions

8.2 Naming Conventions

snake_case for DB fields

kebab-case for URLs

camelCase for JSON payloads

PascalCase for DTOs

8.3 Response Wrapper

All responses use:

{
  "success": true,
  "data": {...},
  "meta": {...}
}

8.4 Error Model
{
  "success": false,
  "error": {
    "code": "TENANT_SUSPENDED",
    "message": "Tenant is not active."
  }
}

9. Scaling Strategy
9.1 Horizontal Scaling

NestJS via Kubernetes HPA

Redis cluster if >50 tenants

Postgres read replicas for reporting

9.2 Database Partitioning

Partition large tables (orders, invoices) by tenant or month

Reduces bloat, improves indexed search

9.3 Queue Scaling

Scale workers separately for heavy workloads (WhatsApp/PDF)

10. Failure Scenarios & Recovery
10.1 Tenant Suspension

APIs return:

403 TENANT_SUSPENDED


Feature usage halted but data preserved.

10.2 Over-Limit Usage

Soft warning → log event

Hard block → prevent new orders

10.3 Data Corruption

PITR restore

Tenant-scoped restore per-table (if needed)

10.4 Third-Party Failure

Circuit breakers

Retry + exponential backoff

Graceful degradation

11. Architecture Decision Records (ADR)
ADR-001: Use PostgreSQL RLS for Multi-Tenancy

Rejected alternatives: separate DB per tenant, schema per tenant.

ADR-002: Feature Flags in JSONB

Chosen for dynamic gating.
Rejected: double-join tables per feature.

ADR-003: Composite Keys for Tenant FK Enforcement

Prevents cross-tenant leakage.

ADR-004: Centralized Workflow Templates

Allows universal quality control.

ADR-005: API Gateway Rate Limiting

Protects platform from abusive tenants.

12. Future Enhancements

Multi-region replication

AI-led anomaly detection

Event Sourcing (optional migration)

Usage-based billing (pay-per-order)

Per-tenant S3 buckets

End of Architecture Addendum (B)