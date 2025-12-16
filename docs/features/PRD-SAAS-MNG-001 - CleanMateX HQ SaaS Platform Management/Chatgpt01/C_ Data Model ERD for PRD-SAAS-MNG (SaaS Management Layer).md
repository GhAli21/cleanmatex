C — Data Model ERD for PRD-SAAS-MNG (SaaS Management Layer)

Scope:

System-level (global) entities: sys_*, workflow templates, plan/limits, permissions.

Organization-level SaaS management entities: org_tenants_*, org_subscriptions, org_tenant_settings_cf, org_*_auth_*, etc.

Key relationships between system- and org-level tables.

RLS & composite key strategy for multi-tenancy.

This is the logical ERD describing entities and relations. Physical DDL is in your schema_06.sql and follow-up migrations.

0. Notation & Conventions

PK = Primary Key

FK = Foreign Key

sys_* = system/global tables (HQ-owned)

org_* = tenant/org tables (RLS-protected, tenant_org_id)

Composite FK pattern: (id, tenant_org_id) for tenant isolation

UUID used as the primary identifier almost everywhere.

1. High-Level ERD Overview
1.1 Logical Groups

We group entities into domains:

Tenant & Subscription Layer

Plans, Limits & Features

Global Customers & Org Customers

Global Settings & Tenant Settings

Workflow Templates & Tenant Overrides

RBAC & Permissions

Platform Audit / History (conceptual)

1.2 Big Picture Diagram (Logical)
                 ┌──────────────────────┐
                 │   sys_plan_cd        │
                 │   plan master        │
                 └─────────┬────────────┘
                           │ 1..*
                           │
                           ▼
             ┌─────────────────────────────┐
             │        org_subscriptions    │
             │  (per tenant subscription)  │
             └─────────┬───────────────────┘
                       │ 1..1
                       │
             ┌─────────▼───────────────────┐
             │       org_tenants_mst       │
             │   (each SaaS tenant/org)    │
             └─────────┬─────────┬─────────┘
                       │         │
              1..*     │         │ 1..1
                       │         │
      ┌────────────────▼─┐   ┌───▼───────────────────────┐
      │ org_tenant_settings_cf│ │  org_tenant_workflow_* │
      │   (tenant config) │   │  workflow overrides      │
      └────────────────────┘   └─────────────────────────┘

   System-level workflows:
 ┌──────────────────────────────────────────────┐
 │ workflow_template_cd / _stages / _transitions│
 └──────────────────────────────────────────────┘

Global customers:
 ┌────────────────────┐         ┌─────────────────────────┐
 │ sys_customers_mst  │ 1..*    │  org_customers_mst      │
 │ (global identity)  │────────▶│ (tenant-customer link)  │
 └────────────────────┘         └─────────┬───────────────┘
                                          │ 1..*
                                          │
                                   ┌──────▼─────────────┐
                                   │   org_orders_mst   │
                                   └────────────────────┘

RBAC:
┌─────────────────────────┐       ┌─────────────────────────────┐
│  sys_auth_permissions   │ 1..*  │ org_auth_user_roles         │
└──────────┬──────────────┘       │ org_user_permissions        │
           │                      └─────────────────────────────┘
           │
    ┌──────▼───────────────┐
    │   sys_role_defaults  │
    └──────────────────────┘


This diagram is conceptual; below we break it down table by table.

2. Tenant & Subscription Entities
2.1 org_tenants_mst — Tenant / Organization Master

Purpose: Represents each subscribed laundry business (tenant).

Core Fields (logical):

id (PK, UUID) — tenant_org_id

code (unique text) — internal tenant code

name, name2 — EN/AR names

country, city, timezone

vat_number

brand_logo_url

feature_flags (JSONB) — feature gate (pdf_invoices, whatsapp_receipts, etc.)

plan_code (FK to sys_plan_cd or denormalized)

status (draft, active, suspended, archived)

created_at, created_by, rec_status, is_active

Relations:

1 : N → org_branches_mst

1 : 1 → org_tenant_settings_cf

1 : N → org_subscriptions

1 : N → org_emp_users / org_auth_*

2.2 org_subscriptions — Tenant Subscription Record

(We saw a version in schema_06.sql.)

Purpose: Tracks plan, billing period, and usage limits per tenant.

Fields (simplified logical):

id (PK, UUID)

tenant_id (FK → org_tenants_mst.id)

plan (free, starter, growth, pro, enterprise)

status (trial, active, cancelled, suspended)

orders_limit, orders_used

branch_limit, user_limit

start_date, end_date, trial_ends

last payment info: last_payment_date, last_payment_amount, last_payment_method, payment_reference, payment_notes

last_invoice_number, last_invoice_date

created_at, updated_at

Relations:

N : 1 → org_tenants_mst

Optionally N : 1 → sys_plan_cd (if you create a separate plan master table)

3. Plans, Limits & Features
3.1 sys_plan_cd (Conceptual) — SaaS Plan Codes

You already have plan_limits_cd, plan_limits_cf, plan_features_cf in schema_06.sql.
At SaaS-HQ level, the logical structure is:

sys_plan_cd — plan master (Free, Starter, Growth, Pro, Enterprise)

plan_limits_cd — limit code master (e.g., monthly_orders, branches_count)

plan_limits_cf — the actual value of each limit per plan

plan_features_cf — which features are enabled per plan

3.1.1 plan_limits_cd

limit_code (PK, text) — e.g. ORDERS_PER_MONTH

limit_name, limit_name2

limit_desc

is_active

3.1.2 plan_limits_cf

id (PK, UUID)

plan_code (FK → sys_plan_cd)

limit_code (FK → plan_limits_cd)

limit_value (integer/decimal)

is_hard_limit (boolean)

rec_status, is_active

3.1.3 plan_features_cf

id (PK, UUID)

plan_code (FK → sys_plan_cd)

feature_code (e.g., pdf_invoices, driver_app)

is_enabled (boolean)

Relations:

sys_plan_cd 1 : N → plan_limits_cf

sys_plan_cd 1 : N → plan_features_cf

plan_limits_cd 1 : N → plan_limits_cf

This is the entitlement matrix that feeds:

default feature_flags in org_tenants_mst

org_subscriptions.*_limit values on creation

4. Global Customers & Org Customers
4.1 sys_customers_mst — Global Customer Master

From schema_06.sql snippet (truncated, but conceptually):

Purpose: Global identity across all tenants.

Key Logical Fields:

id (PK, UUID)

name, name2, display_name

first_name, last_name

phone, email

type (individual, corporate, etc.)

address, area, building, floor

preferences (JSONB)

customer_source_type (walk_in, app, marketplace…)

created_at, updated_at, is_active

This table has no tenant_org_id — it’s global.

4.2 org_customers_mst — Tenant-Customer Link

From schema_06.sql:

create table org_customers_mst (
   customer_id          UUID not null,
   tenant_org_id        UUID not null,
   s_date               TIMESTAMP not null default CURRENT_TIMESTAMP,
   loyalty_points       INTEGER null default '0',
   ...
   constraint PK_ORG_CUSTOMERS_MST primary key (customer_id, tenant_org_id)
);


Purpose: Represents how a global customer is attached to a tenant.

Key Points:

Composite PK: (customer_id, tenant_org_id) — core multi-tenant pattern.

Contains loyalty, local notes, local flags, etc.

RLS will filter by tenant_org_id.

Logical Relation:

sys_customers_mst (id) 1 ────────── N org_customers_mst(customer_id, tenant_org_id)
                                     (but we enforce global uniqueness at app level)


In practice, there’s a logical one-to-many: one global identity in sys_customers_mst, many tenant-specific entries in org_customers_mst.

5. Global Settings & Tenant Settings
5.1 sys_tenant_settings_cd (Conceptual) — System Settings Catalog

Global config catalog:

setting_code (PK, text) — e.g. USE_WHATSAPP_RECEIPTS, READY_BY_FORMULA

setting_name, setting_name2

setting_desc

setting_value_type (string, number, JSON)

default_value

is_editable (can tenant override?)

scope (global, tenant, branch, user)

5.2 org_tenant_settings_cf — Tenant Settings

You have this in your migrations (we saw an insert into org_tenant_settings_cf that failed due to an index name).

Logical fields:

tenant_org_id (PK, FK → org_tenants_mst.id)

setting_code (FK → sys_tenant_settings_cd.setting_code) — if modeled as key/value

OR: a wide config row with many columns (current structure)

setting_value_type

setting_value (JSONB/text)

branch_id, user_id (for scoped overrides, can be NULL)

is_active, rec_status, created_at, etc.

Relationship:

sys_tenant_settings_cd 1 ─── N org_tenant_settings_cf
org_tenants_mst        1 ─── N org_tenant_settings_cf


In your current design you lean towards one row per (tenant, setting_code) or similar key/value pattern enforced by a partial unique index.

6. Workflow Templates & Tenant Overrides

These are partly in CleanMateX_Workflow_NewOrder_ImplementationPlan.docx.

6.1 System-Level Workflow Definitions
6.1.1 workflow_template_cd

template_id (PK, UUID)

template_code (WF_SIMPLE, WF_STANDARD, WF_ASSEMBLY_QA…)

template_name, template_name2

template_desc

is_active, rec_order, rec_status, created_at

6.1.2 workflow_template_stages

id (PK, UUID)

template_id (FK → workflow_template_cd.template_id)

stage_code (intake, processing, assembly, qa, ready, delivered, etc.)

stage_name, stage_name2

stage_type (operational, qa, delivery)

seq_no

is_terminal (boolean)

is_active, created_at

UNIQUE(template_id, stage_code)

6.1.3 workflow_template_transitions

id (PK, UUID)

template_id (FK → workflow_template_cd.template_id)

from_stage_code, to_stage_code

requires_scan_ok, requires_invoice, requires_pod

allow_manual (boolean)

auto_when_done (boolean)

is_active, created_at

Relations:

workflow_template_cd 1 ─── N workflow_template_stages
workflow_template_cd 1 ─── N workflow_template_transitions

6.2 Tenant-Level Workflow Settings
6.2.1 tenant_workflow_templates_cf

id (PK, UUID)

tenant_org_id (FK → org_tenants_mst.id)

template_id (FK → workflow_template_cd.template_id)

is_default (boolean)

allow_back_steps (boolean)

extra_config (JSONB)

is_active, created_at

6.2.2 tenant_workflow_settings_cf

tenant_org_id (PK, FK → org_tenants_mst.id)

use_preparation_screen (boolean)

use_assembly_screen (boolean)

use_qa_screen (boolean)

track_individual_piece (boolean)

orders_split_enabled (boolean)

6.2.3 tenant_service_category_workflow_cf

id (PK, UUID)

tenant_org_id (FK → org_tenants_mst.id)

service_category_id (FK → sys_service_category_cd or org_service_category_cf)

workflow_template_id (FK → workflow_template_cd.template_id)

Per-category overrides: use_preparation_screen, use_assembly_screen, use_qa_screen, track_individual_piece

Relations:

org_tenants_mst                 1 ─── N tenant_workflow_templates_cf
workflow_template_cd            1 ─── N tenant_workflow_templates_cf

org_tenants_mst                 1 ─── 1 tenant_workflow_settings_cf

org_tenants_mst                 1 ─── N tenant_service_category_workflow_cf
sys_service_category_cd / org_service_category_cf
                                1 ─── N tenant_service_category_workflow_cf
workflow_template_cd            1 ─── N tenant_service_category_workflow_cf

7. RBAC & Permissions
7.1 System-Level Permissions (sys_auth_permissions)

Logical structure:

id (PK, UUID)

permission_code (e.g., TENANT_MANAGE, PLAN_VIEW, ORDER_CREATE)

permission_name, permission_name2

module (saas_mng, orders, customers, etc.)

scope_level (system, tenant, branch)

is_active

Used to define what actions exist.

7.2 Role Default Permissions (sys_role_default_permissions)

id (PK, UUID)

role_code (system_admin, tenant_admin, branch_manager, operator, etc.)

permission_id (FK → sys_auth_permissions.id)

is_allowed (boolean)

System-level mapping used for seeding org_auth_user_roles.

7.3 Org-Level Role Assignments (org_auth_user_roles)

id (PK, UUID)

tenant_org_id (FK → org_tenants_mst.id)

user_id (FK → org_emp_users.id)

role_code

branch_id (optional FK → org_branches_mst)

is_active, created_at

7.4 Org-Level User Direct Permissions (org_user_permissions)

id (PK, UUID)

tenant_org_id

user_id

permission_id (FK → sys_auth_permissions.id)

is_allowed (boolean)

scope_type (tenant, branch, resource)

scope_id (branch_id or other resource id)

7.5 Resource-Based Permissions (org_user_resource_permissions)

id (PK, UUID)

tenant_org_id

user_id

resource_type (branch, store, route, etc.)

resource_id

permissions (JSONB or bitset)

Relationships summary:

sys_auth_permissions 1 ─── N sys_role_default_permissions
sys_auth_permissions 1 ─── N org_user_permissions

sys_role_default_permissions → seeds → org_auth_user_roles (per tenant)

org_tenants_mst 1 ─── N org_auth_user_roles
org_tenants_mst 1 ─── N org_user_permissions
org_tenants_mst 1 ─── N org_user_resource_permissions

org_emp_users   1 ─── N org_auth_user_roles
org_emp_users   1 ─── N org_user_permissions
org_emp_users   1 ─── N org_user_resource_permissions

8. Audit / History (Platform-Level)
8.1 sys_platform_events (Conceptual)

id (PK, UUID)

event_code (TENANT_CREATED, SUBSCRIPTION_UPGRADED, PLAN_LIMIT_REACHED, etc.)

tenant_org_id (nullable: some events system-level only)

user_id (nullable)

payload (JSONB)

created_at

8.2 org_audit_log (Conceptual)

Per-tenant log but owned by HQ design:

id (PK, UUID)

tenant_org_id

user_id

entity_type (tenant_settings, workflow, subscription)

entity_id

action_type (CREATE, UPDATE, DELETE)

before_data (JSONB)

after_data (JSONB)

created_at

RLS: enforced by tenant_org_id.

9. RLS & Composite Key Model (Summarized)

All org_* tables carry mandatory tenant_org_id.

Every child row referencing a tenant-specific master uses composite FK:

Examples:

FOREIGN KEY (customer_id, tenant_org_id)
  REFERENCES org_customers_mst (customer_id, tenant_org_id);

FOREIGN KEY (branch_id, tenant_org_id)
  REFERENCES org_branches_mst (id, tenant_org_id);


RLS policies always check:

tenant_org_id = current_setting('app.current_tenant_id')::uuid


This ensures platform-level SAAS-MNG logic (plans, limits, permissions, settings) can be enforced without cross-tenant data leakage.

10. Summary

The PRD-SAAS-MNG data model:

Defines HQ-owned global tables (sys_*, workflows, plans, permissions).

Defines tenant-scoped SaaS management tables (org_tenants_mst, org_subscriptions, org_tenant_settings_cf, org_*_auth_*).

Links global customers with tenant local records via composite keys.

Provides a flexible system of plans, limits, features, workflows that drive behavior for every tenant.

Embeds RBAC and RLS at the schema level to enforce security and isolation.

If you want next:

I can turn this ERD into:

SQL DDL pack for all SAAS-MNG tables, or

Prisma schema for the same entities, or

Mermaid ERD diagram ready to paste into docs.

You asked originally for a sequence A→B→C→D→…