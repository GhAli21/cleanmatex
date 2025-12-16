---
prd_code: PRD-SAAS-MNG-0006
title: Core Data & Code Management
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: High
category: Platform Management - Core Data
related_prds:
  - PRD-SAAS-MNG-0001 (Platform HQ Console)
  - PRD-SAAS-MNG-0002 (Tenant Lifecycle)
  - PRD-SAAS-MNG-0007 (Workflow Engine)
  - PRD-SAAS-MNG-0010 (Platform Configuration)
---

# PRD-SAAS-MNG-0006: Core Data & Code Management

## Executive Summary

The **Core Data & Code Management** module is the foundational system that manages all platform-wide reference data, code tables, and master data that powers the CleanMateX SaaS platform. This includes service categories, order statuses, payment methods, plan configurations, and all other enumerated values that are shared across all tenants. Proper management of this core data is critical for platform consistency, scalability, and maintainability.

### Problem Statement

Currently, the platform lacks:
- ❌ **Centralized management** of reference data and code tables
- ❌ **Version control** for core data changes
- ❌ **Multi-language support** for code values (EN/AR)
- ❌ **Validation rules** for code table usage
- ❌ **Audit trail** for core data modifications
- ❌ **Seeding mechanism** for new tenants
- ❌ **Migration management** for code table updates
- ❌ **Tenant-specific overrides** for configurable codes

### Solution Overview

Build a **comprehensive core data management system** that:
- ✅ Centralizes all reference data in system tables (sys_*)
- ✅ Provides UI for managing code tables and master data
- ✅ Supports bilingual (EN/AR) values for all user-facing codes
- ✅ Maintains version history and audit trails
- ✅ Enables tenant-specific customizations where appropriate
- ✅ Validates data integrity and relationships
- ✅ Provides seeding scripts for new installations
- ✅ Supports bulk import/export of core data

### Business Value

**For Platform Administrators:**
- Manage all reference data from a single interface
- Track changes to critical system configurations
- Roll back problematic changes quickly
- Ensure data consistency across all tenants

**For Development Team:**
- Clear separation of system data vs tenant data
- Reduced code duplication
- Easier testing with seed data
- Simplified deployment of data changes

**For Tenants:**
- Consistent platform behavior
- Multi-language support (EN/AR)
- Customizable options where appropriate
- Reliable service categories and pricing

---

## Table of Contents

1. [Scope & Objectives](#1-scope--objectives)
2. [Core Data Architecture](#2-core-data-architecture)
3. [Code Table Categories](#3-code-table-categories)
4. [Database Schema](#4-database-schema)
5. [Data Management UI](#5-data-management-ui)
6. [API Specifications](#6-api-specifications)
7. [Versioning & Audit](#7-versioning--audit)
8. [Seeding & Migration](#8-seeding--migration)
9. [Validation Rules](#9-validation-rules)
10. [Tenant Customization](#10-tenant-customization)
11. [Bulk Operations](#11-bulk-operations)
12. [Multi-Language Support](#12-multi-language-support)
13. [Data Dependencies](#13-data-dependencies)
14. [Security & Access Control](#14-security--access-control)
15. [Integration Points](#15-integration-points)
16. [Implementation Plan](#16-implementation-plan)
17. [Testing Strategy](#17-testing-strategy)
18. [Future Enhancements](#18-future-enhancements)

---

## 1. Scope & Objectives

### 1.1 In Scope

**System-Level Code Tables (sys_*):**
- Service categories and subcategories
- Order statuses and types
- Payment methods and gateways
- Subscription plans and features
- User roles and permissions
- Garment types and attributes
- Quality check parameters
- Pricing rules and modifiers
- Notification templates
- Report categories

**Management Features:**
- CRUD operations for all code tables
- Bulk import/export (CSV, JSON)
- Version history and rollback
- Audit logging
- Data validation and integrity checks
- Multi-language content management
- Tenant-specific overrides
- Seeding and migration tools

**Integration Features:**
- API for accessing code values
- Webhook notifications on changes
- Cache invalidation strategies
- Validation endpoints

### 1.2 Out of Scope

- ❌ Tenant-specific data management (covered in respective PRDs)
- ❌ Transaction data management
- ❌ User data management
- ❌ File/media management
- ❌ Real-time collaboration features

### 1.3 Success Criteria

**Data Quality:**
- 100% of code tables have bilingual support
- Zero orphaned references
- All changes tracked in audit log
- < 1% data validation errors

**System Performance:**
- Code table queries < 50ms (cached)
- Bulk operations support 10,000+ records
- Zero downtime for code table updates
- Cache hit rate > 95%

**Developer Experience:**
- Easy seeding of new environments
- Clear documentation for all code tables
- Type-safe API access
- Simple migration process

---

## 2. Core Data Architecture

### 2.1 Data Layer Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│         PLATFORM CORE DATA ARCHITECTURE                 │
└─────────────────────────────────────────────────────────┘

Layer 1: GLOBAL SYSTEM DATA (sys_*)
├─ Never has tenant_org_id
├─ Shared across all tenants
├─ Managed only by platform admins
└─ Examples: sys_order_status_cd, sys_payment_method_cd

Layer 2: TENANT CONFIGURATION (org_*_cf)
├─ Has tenant_org_id
├─ Links to system data
├─ Allows tenant-specific customization
└─ Examples: org_service_category_cf, org_workflow_settings_cf

Layer 3: TENANT TRANSACTION DATA (org_*)
├─ Has tenant_org_id
├─ References both system and config data
├─ Tenant's operational data
└─ Examples: org_orders_mst, org_payments_dtl_tr
```

### 2.2 Naming Conventions

**System Tables:**
- Prefix: `sys_`
- Suffix: `_cd` for code tables (lookup values)
- Suffix: `_mst` for master data
- Examples:
  - `sys_order_status_cd` - Order status codes
  - `sys_service_category_cd` - Service categories
  - `sys_plans_mst` - Subscription plans

**Configuration Tables:**
- Prefix: `org_`
- Suffix: `_cf` for configuration
- Examples:
  - `org_service_category_cf` - Tenant-specific service categories
  - `org_workflow_settings_cf` - Tenant workflow configuration

### 2.3 Standard Code Table Structure

All code tables follow this pattern:

```sql
CREATE TABLE sys_{entity}_cd (
  -- Primary key
  code VARCHAR(50) PRIMARY KEY,

  -- Display values (bilingual)
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),              -- Arabic
  description TEXT,
  description2 TEXT,                -- Arabic

  -- UI/Branding
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),

  -- Behavior flags
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,  -- Cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata (optional)
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);
```

---

## 3. Code Table Categories

### 3.1 Order Management Codes

**sys_order_status_cd**
- Order lifecycle statuses
- Examples: DRAFT, INTAKE, WASHING, READY, DELIVERED, CLOSED

**sys_order_type_cd**
- Order types
- Examples: REGULAR, EXPRESS, SUBSCRIPTION, BULK

**sys_service_type_cd**
- Service types
- Examples: WASH_AND_IRON, DRY_CLEAN, IRON_ONLY, ALTERATIONS

### 3.2 Payment Codes

**sys_payment_method_cd**
- Payment methods
- Examples: CASH, CARD, ONLINE, WALLET, INVOICE

**sys_payment_status_cd**
- Payment statuses
- Examples: PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED

**sys_payment_gateway_cd**
- Payment gateways
- Examples: STRIPE, HYPERPAY, PAYTABS, MANUAL

### 3.3 Subscription & Billing Codes

**sys_plans_mst**
- Subscription plans
- Examples: FREE, STARTER, GROWTH, PRO, ENTERPRISE

**sys_plan_features_cd**
- Available features
- Examples: MULTI_BRANCH, ADVANCED_REPORTING, API_ACCESS, CUSTOM_BRANDING

**sys_billing_cycle_cd**
- Billing cycles
- Examples: MONTHLY, QUARTERLY, ANNUAL

### 3.4 Garment & Service Codes

**sys_garment_type_cd**
- Garment types
- Examples: SHIRT, PANTS, SUIT, DRESS, BLANKET, CURTAIN

**sys_fabric_type_cd**
- Fabric types
- Examples: COTTON, SILK, WOOL, SYNTHETIC, LEATHER

**sys_service_category_cd**
- Service categories
- Examples: LAUNDRY, DRY_CLEANING, IRONING, ALTERATION, REPAIR

### 3.5 Quality & Workflow Codes

**sys_quality_check_status_cd**
- QA statuses
- Examples: PASSED, FAILED, PENDING, NEEDS_REVIEW

**sys_issue_type_cd**
- Issue types
- Examples: STAIN, DAMAGE, MISSING_ITEM, COLOR_BLEED

**sys_workflow_step_cd**
- Workflow steps
- Examples: INTAKE, SORTING, WASHING, DRYING, FINISHING, QA, PACKING

### 3.6 User & Access Codes

**sys_user_role_cd**
- User roles
- Examples: OWNER, ADMIN, MANAGER, OPERATOR, VIEWER

**sys_permission_cd**
- Permissions
- Examples: VIEW_ORDERS, CREATE_ORDERS, EDIT_SETTINGS, MANAGE_USERS

### 3.7 Notification Codes

**sys_notification_type_cd**
- Notification types
- Examples: ORDER_READY, PAYMENT_RECEIVED, STATUS_CHANGE, REMINDER

**sys_notification_channel_cd**
- Delivery channels
- Examples: EMAIL, SMS, WHATSAPP, PUSH, IN_APP

### 3.8 Report & Analytics Codes

**sys_report_category_cd**
- Report categories
- Examples: FINANCIAL, OPERATIONAL, CUSTOMER, INVENTORY

**sys_metric_type_cd**
- Metric types
- Examples: REVENUE, ORDERS_COUNT, CUSTOMER_COUNT, CONVERSION_RATE

---

## 4. Database Schema

### 4.1 Core Code Tables

**Table: sys_order_status_cd**
```sql
CREATE TABLE sys_order_status_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                    -- Hex color for UI

  -- Workflow
  is_initial_status BOOLEAN DEFAULT false,
  is_final_status BOOLEAN DEFAULT false,
  allowed_next_statuses VARCHAR(50)[],  -- Array of status codes

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,       -- System statuses cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- SLA
  default_sla_hours INTEGER,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "requires_qa": true,
      "sends_notification": true,
      "notification_template": "order_ready"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Sample data
INSERT INTO sys_order_status_cd (code, name, name2, display_order, color, is_initial_status, is_final_status, allowed_next_statuses) VALUES
('DRAFT', 'Draft', 'مسودة', 1, '#9CA3AF', true, false, ARRAY['INTAKE', 'CANCELLED']),
('INTAKE', 'Intake', 'استلام', 2, '#3B82F6', false, false, ARRAY['PREPARATION', 'CANCELLED']),
('PREPARATION', 'Preparation', 'تحضير', 3, '#8B5CF6', false, false, ARRAY['SORTING']),
('SORTING', 'Sorting', 'فرز', 4, '#6366F1', false, false, ARRAY['WASHING']),
('WASHING', 'Washing', 'غسيل', 5, '#06B6D4', false, false, ARRAY['DRYING']),
('DRYING', 'Drying', 'تجفيف', 6, '#14B8A6', false, false, ARRAY['FINISHING']),
('FINISHING', 'Finishing', 'كوي', 7, '#10B981', false, false, ARRAY['ASSEMBLY']),
('ASSEMBLY', 'Assembly', 'تجميع', 8, '#22C55E', false, false, ARRAY['QA']),
('QA', 'Quality Check', 'فحص الجودة', 9, '#84CC16', false, false, ARRAY['PACKING', 'WASHING']),
('PACKING', 'Packing', 'تغليف', 10, '#EAB308', false, false, ARRAY['READY']),
('READY', 'Ready', 'جاهز', 11, '#F59E0B', false, false, ARRAY['OUT_FOR_DELIVERY']),
('OUT_FOR_DELIVERY', 'Out for Delivery', 'قيد التوصيل', 12, '#F97316', false, false, ARRAY['DELIVERED']),
('DELIVERED', 'Delivered', 'تم التسليم', 13, '#10B981', false, true, ARRAY['CLOSED']),
('CLOSED', 'Closed', 'مغلق', 14, '#6B7280', false, true, ARRAY[]),
('CANCELLED', 'Cancelled', 'ملغي', 15, '#EF4444', false, true, ARRAY[]);

CREATE INDEX idx_order_status_active ON sys_order_status_cd(is_active, display_order);
```

**Table: sys_service_category_cd**
```sql
CREATE TABLE sys_service_category_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,

  -- Hierarchy
  parent_category_code VARCHAR(50) REFERENCES sys_service_category_cd(code),
  display_order INTEGER DEFAULT 0,

  -- UI
  icon VARCHAR(100),
  color VARCHAR(60),
  image_url VARCHAR(500),

  -- Pricing
  default_pricing_unit VARCHAR(20),    -- 'per_item', 'per_kg', 'per_sqm'
  requires_weight BOOLEAN DEFAULT false,
  requires_dimensions BOOLEAN DEFAULT false,

  -- Workflow
  default_workflow_steps VARCHAR(50)[], -- Array of workflow step codes
  estimated_turnaround_hours INTEGER,

  -- Availability
  is_express_available BOOLEAN DEFAULT true,
  is_subscription_available BOOLEAN DEFAULT true,

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Sample data
INSERT INTO sys_service_category_cd (code, name, name2, display_order, icon, default_pricing_unit, estimated_turnaround_hours) VALUES
('WASH_IRON', 'Wash & Iron', 'غسيل وكوي', 1, 'wash', 'per_item', 48),
('DRY_CLEAN', 'Dry Cleaning', 'تنظيف جاف', 2, 'dry-clean', 'per_item', 72),
('IRON_ONLY', 'Iron Only', 'كوي فقط', 3, 'iron', 'per_item', 24),
('ALTERATION', 'Alterations', 'تعديلات', 4, 'scissors', 'per_item', 96),
('REPAIR', 'Repairs', 'إصلاحات', 5, 'wrench', 'per_item', 120),
('CURTAIN', 'Curtain Cleaning', 'تنظيف ستائر', 6, 'curtain', 'per_sqm', 96),
('CARPET', 'Carpet Cleaning', 'تنظيف سجاد', 7, 'carpet', 'per_sqm', 120),
('LEATHER', 'Leather Care', 'عناية بالجلود', 8, 'leather', 'per_item', 168);

CREATE INDEX idx_service_cat_parent ON sys_service_category_cd(parent_category_code, display_order);
CREATE INDEX idx_service_cat_active ON sys_service_category_cd(is_active, display_order);
```

**Table: sys_payment_method_cd**
```sql
CREATE TABLE sys_payment_method_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),

  -- Configuration
  payment_type VARCHAR(20) NOT NULL,   -- 'cash', 'card', 'online', 'wallet', 'credit'
  requires_gateway BOOLEAN DEFAULT false,
  default_gateway_code VARCHAR(50) REFERENCES sys_payment_gateway_cd(code),

  -- Processing
  is_instant BOOLEAN DEFAULT true,
  requires_verification BOOLEAN DEFAULT false,
  supports_partial BOOLEAN DEFAULT false,
  supports_refund BOOLEAN DEFAULT true,

  -- Fees
  has_processing_fee BOOLEAN DEFAULT false,
  fee_percentage DECIMAL(5,2),
  fee_fixed_amount DECIMAL(10,3),

  -- Availability
  available_for_plans VARCHAR(50)[],   -- Array of plan codes, NULL = all
  min_amount DECIMAL(10,3),
  max_amount DECIMAL(10,3),

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Sample data
INSERT INTO sys_payment_method_cd (code, name, name2, display_order, payment_type, is_instant, supports_refund) VALUES
('CASH', 'Cash', 'نقدي', 1, 'cash', true, false),
('CARD', 'Credit/Debit Card', 'بطاقة ائتمان', 2, 'card', true, true),
('ONLINE', 'Online Payment', 'دفع إلكتروني', 3, 'online', true, true),
('WALLET', 'Mobile Wallet', 'محفظة إلكترونية', 4, 'wallet', true, true),
('INVOICE', 'Invoice (Pay Later)', 'فاتورة آجلة', 5, 'credit', false, true);

CREATE INDEX idx_payment_method_active ON sys_payment_method_cd(is_active, display_order);
```

**Table: sys_plans_mst**
```sql
CREATE TABLE sys_plans_mst (
  plan_code VARCHAR(50) PRIMARY KEY,

  -- Display
  plan_name VARCHAR(250) NOT NULL,
  plan_name2 VARCHAR(250),
  plan_description TEXT,
  plan_description2 TEXT,

  -- Pricing
  monthly_price DECIMAL(10,3) NOT NULL,
  annual_price DECIMAL(10,3),
  setup_fee DECIMAL(10,3) DEFAULT 0,

  -- Discounts
  annual_discount_percentage DECIMAL(5,2),
  trial_days INTEGER DEFAULT 0,

  -- Limits
  order_limit INTEGER,                  -- NULL = unlimited
  user_limit INTEGER,
  branch_limit INTEGER,
  storage_limit_gb INTEGER,
  api_calls_per_month INTEGER,

  -- Features (references sys_plan_features_cd)
  included_features VARCHAR(50)[],

  -- Availability
  is_publicly_available BOOLEAN DEFAULT true,
  is_enterprise_only BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT false,

  -- Display
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  badge_text VARCHAR(50),               -- 'Popular', 'Best Value', etc.

  -- UI
  plan_color VARCHAR(60),
  plan_icon VARCHAR(100),

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Sample data
INSERT INTO sys_plans_mst (
  plan_code, plan_name, plan_name2, monthly_price, annual_price,
  order_limit, user_limit, branch_limit, storage_limit_gb,
  included_features, display_order
) VALUES
('FREE', 'Free', 'مجاني', 0, 0, 50, 2, 1, 1, ARRAY['BASIC_REPORTING'], 1),
('STARTER', 'Starter', 'مبتدئ', 99, 950, 500, 5, 1, 10, ARRAY['BASIC_REPORTING', 'EMAIL_SUPPORT'], 2),
('GROWTH', 'Growth', 'نمو', 299, 2870, 2000, 15, 3, 50, ARRAY['BASIC_REPORTING', 'ADVANCED_REPORTING', 'EMAIL_SUPPORT', 'MULTI_BRANCH'], 3),
('PRO', 'Pro', 'احترافي', 599, 5750, NULL, 50, 10, 200, ARRAY['BASIC_REPORTING', 'ADVANCED_REPORTING', 'EMAIL_SUPPORT', 'PHONE_SUPPORT', 'MULTI_BRANCH', 'API_ACCESS'], 4),
('ENTERPRISE', 'Enterprise', 'مؤسسات', 0, 0, NULL, NULL, NULL, NULL, ARRAY['BASIC_REPORTING', 'ADVANCED_REPORTING', 'EMAIL_SUPPORT', 'PHONE_SUPPORT', 'PRIORITY_SUPPORT', 'MULTI_BRANCH', 'API_ACCESS', 'CUSTOM_BRANDING', 'WHITE_LABEL'], 5);

CREATE INDEX idx_plans_active ON sys_plans_mst(is_active, display_order);
CREATE INDEX idx_plans_public ON sys_plans_mst(is_publicly_available, display_order);
```

### 4.2 Code Table Metadata

**Table: sys_code_tables_registry**
```sql
CREATE TABLE sys_code_tables_registry (
  table_name VARCHAR(100) PRIMARY KEY,

  -- Description
  display_name VARCHAR(250) NOT NULL,
  display_name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,

  -- Configuration
  is_editable BOOLEAN DEFAULT true,     -- Can admins edit values?
  is_extensible BOOLEAN DEFAULT false,  -- Can admins add new values?
  supports_tenant_override BOOLEAN DEFAULT false,

  -- Validation
  code_pattern VARCHAR(100),            -- Regex for code validation
  max_code_length INTEGER DEFAULT 50,
  requires_unique_name BOOLEAN DEFAULT true,

  -- Display
  category VARCHAR(50),                 -- Group related tables
  display_order INTEGER DEFAULT 0,

  -- Version
  current_version INTEGER DEFAULT 1,
  last_seeded_at TIMESTAMP,

  -- Metadata
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Sample registry entries
INSERT INTO sys_code_tables_registry (table_name, display_name, display_name2, category, is_editable, is_extensible) VALUES
('sys_order_status_cd', 'Order Statuses', 'حالات الطلب', 'order_management', false, false),
('sys_service_category_cd', 'Service Categories', 'فئات الخدمات', 'services', true, true),
('sys_payment_method_cd', 'Payment Methods', 'طرق الدفع', 'billing', true, true),
('sys_plans_mst', 'Subscription Plans', 'خطط الاشتراك', 'billing', true, false),
('sys_garment_type_cd', 'Garment Types', 'أنواع الملابس', 'services', true, true);

CREATE INDEX idx_code_registry_category ON sys_code_tables_registry(category, display_order);
```

**Table: sys_code_table_audit_log**
```sql
CREATE TABLE sys_code_table_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What changed
  table_name VARCHAR(100) NOT NULL,
  record_code VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,          -- 'INSERT', 'UPDATE', 'DELETE', 'RESTORE'

  -- Before/After
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Who & When
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Context
  change_reason TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Rollback support
  is_rollback BOOLEAN DEFAULT false,
  rollback_of_id UUID REFERENCES sys_code_table_audit_log(id)
);

CREATE INDEX idx_audit_table ON sys_code_table_audit_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_record ON sys_code_table_audit_log(table_name, record_code, changed_at DESC);
CREATE INDEX idx_audit_user ON sys_code_table_audit_log(changed_by, changed_at DESC);
```

### 4.3 Tenant Configuration Override Tables

**Table: org_service_category_cf**
```sql
CREATE TABLE org_service_category_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Reference to system category
  service_category_code VARCHAR(50) NOT NULL REFERENCES sys_service_category_cd(code),

  -- Tenant-specific overrides
  custom_name VARCHAR(250),             -- Override display name
  custom_name2 VARCHAR(250),
  custom_pricing_unit VARCHAR(20),
  custom_turnaround_hours INTEGER,

  -- Pricing (tenant-specific)
  base_price DECIMAL(10,3),
  express_multiplier DECIMAL(5,2) DEFAULT 1.5,

  -- Availability
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER,

  -- Workflow override
  custom_workflow_steps VARCHAR(50)[],

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT unique_tenant_category UNIQUE (tenant_org_id, service_category_code)
);

CREATE INDEX idx_service_cf_tenant ON org_service_category_cf(tenant_org_id, is_active);
CREATE INDEX idx_service_cf_category ON org_service_category_cf(service_category_code);
```

---

## 5. Data Management UI

### 5.1 Code Tables Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Core Data & Code Management                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │  Code Tables Overview  │  │  Recent Changes        │    │
│  ├────────────────────────┤  ├────────────────────────┤    │
│  │  Total Tables: 45      │  │  Today: 3 changes      │    │
│  │  Active Values: 1,234  │  │  This Week: 12 changes │    │
│  │  Inactive: 23          │  │  This Month: 45 changes│    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Categories                                          │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │ 📦 Order Management (8 tables)            │     │    │
│  │  │ 💰 Billing & Payments (6 tables)          │     │    │
│  │  │ 👔 Services & Garments (12 tables)        │     │    │
│  │  │ 📊 Analytics & Reports (5 tables)         │     │    │
│  │  │ 👥 Users & Permissions (4 tables)         │     │    │
│  │  │ 🔔 Notifications (3 tables)               │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Code Table Editor

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  sys_order_status_cd - Order Statuses         [+ Add New]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [🔍 Search...] [Filter: All ▼] [Export CSV] [Import CSV]  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Code     │ Name (EN)    │ Name (AR) │ Order │ 🎨    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ DRAFT    │ Draft        │ مسودة     │   1   │ Gray  │    │
│  │ INTAKE   │ Intake       │ استلام    │   2   │ Blue  │    │
│  │ WASHING  │ Washing      │ غسيل      │   5   │ Cyan  │    │
│  │ READY    │ Ready        │ جاهز      │  11   │ Amber │    │
│  │ [Actions: Edit | Deactivate | View History]         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Showing 15 of 15 active statuses                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Edit Dialog:**
```
┌─────────────────────────────────────────────────────────────┐
│  Edit Order Status: WASHING                       [Save] [X]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Code (read-only): WASHING                                  │
│                                                              │
│  English Name: [Washing                          ]          │
│  Arabic Name:  [غسيل                              ]          │
│                                                              │
│  Description (EN):                                          │
│  ┌────────────────────────────────────────────────┐         │
│  │ Order is being washed                          │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  Description (AR):                                          │
│  ┌────────────────────────────────────────────────┐         │
│  │ الطلب قيد الغسيل                               │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  Display Order: [5    ]                                     │
│  Icon: [wash-icon ▼]                                        │
│  Color: [#06B6D4] 🎨                                        │
│                                                              │
│  Workflow Settings:                                         │
│  ☑ Is System Status (cannot be deleted)                    │
│  ☐ Is Default Status                                        │
│  ☑ Is Active                                                │
│                                                              │
│  Allowed Next Statuses:                                     │
│  ☑ DRYING                                                   │
│  ☑ QA (if quality issues found)                            │
│  ☑ CANCELLED                                                │
│                                                              │
│  SLA: [24] hours                                            │
│                                                              │
│  [Cancel]                                     [Save Changes] │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Audit History View

```
┌─────────────────────────────────────────────────────────────┐
│  Change History: sys_order_status_cd / WASHING              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Change #1                              Jan 10, 2025  │    │
│  │ Changed by: Sarah Admin                10:30 AM      │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Action: UPDATE                                       │    │
│  │                                                       │    │
│  │ Changed Fields:                                      │    │
│  │ • name2: "غسل" → "غسيل"                             │    │
│  │ • display_order: 4 → 5                              │    │
│  │                                                       │    │
│  │ Reason: Fixed Arabic translation                    │    │
│  │                                                       │    │
│  │ [View Full Diff] [Rollback to This Version]        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Change #2                              Jan 5, 2025   │    │
│  │ Changed by: Admin User                 2:15 PM       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Action: INSERT                                       │    │
│  │                                                       │    │
│  │ Initial creation of WASHING status                  │    │
│  │                                                       │    │
│  │ [View Details]                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. API Specifications

### 6.1 Code Table APIs

**Get Code Tables List**

```http
GET /api/v1/platform/core-data/tables
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "table_name": "sys_order_status_cd",
      "display_name": "Order Statuses",
      "display_name2": "حالات الطلب",
      "category": "order_management",
      "total_records": 15,
      "active_records": 15,
      "is_editable": false,
      "is_extensible": false,
      "last_updated": "2025-01-10T10:30:00Z"
    }
  ]
}
```

**Get Code Values**

```http
GET /api/v1/platform/core-data/tables/{table_name}/values
```

**Query Parameters:**
- `active_only` (boolean) - Return only active values
- `language` (string) - Filter by language preference
- `search` (string) - Search in name/description
- `sort` (string) - Sort field
- `order` (string) - asc/desc

**Response:**
```json
{
  "success": true,
  "data": {
    "table_name": "sys_order_status_cd",
    "total_count": 15,
    "values": [
      {
        "code": "WASHING",
        "name": "Washing",
        "name2": "غسيل",
        "description": "Order is being washed",
        "description2": "الطلب قيد الغسيل",
        "display_order": 5,
        "icon": "wash-icon",
        "color": "#06B6D4",
        "is_active": true,
        "is_system": true,
        "metadata": {
          "requires_qa": false,
          "sends_notification": false
        }
      }
    ]
  }
}
```

**Create Code Value**

```http
POST /api/v1/platform/core-data/tables/{table_name}/values
```

**Request:**
```json
{
  "code": "CUSTOM_STATUS",
  "name": "Custom Status",
  "name2": "حالة مخصصة",
  "description": "A custom order status",
  "display_order": 99,
  "icon": "custom-icon",
  "color": "#FF5733",
  "is_active": true,
  "metadata": {
    "custom_field": "value"
  }
}
```

**Update Code Value**

```http
PATCH /api/v1/platform/core-data/tables/{table_name}/values/{code}
```

**Request:**
```json
{
  "name": "Updated Name",
  "name2": "اسم محدث",
  "display_order": 6,
  "change_reason": "Updated for clarity"
}
```

**Delete (Deactivate) Code Value**

```http
DELETE /api/v1/platform/core-data/tables/{table_name}/values/{code}
```

**Response:**
```json
{
  "success": true,
  "message": "Code value deactivated",
  "data": {
    "code": "CUSTOM_STATUS",
    "is_active": false,
    "deactivated_at": "2025-01-14T15:30:00Z"
  }
}
```

### 6.2 Bulk Operations APIs

**Bulk Import**

```http
POST /api/v1/platform/core-data/tables/{table_name}/import
Content-Type: multipart/form-data
```

**Request (form-data):**
- `file`: CSV file
- `format`: "csv" | "json"
- `mode`: "insert" | "upsert" | "replace"
- `validate_only`: boolean

**Response:**
```json
{
  "success": true,
  "data": {
    "total_rows": 100,
    "inserted": 85,
    "updated": 12,
    "errors": 3,
    "validation_errors": [
      {
        "row": 23,
        "field": "code",
        "error": "Code already exists"
      }
    ]
  }
}
```

**Bulk Export**

```http
GET /api/v1/platform/core-data/tables/{table_name}/export?format=csv
```

**Query Parameters:**
- `format`: "csv" | "json" | "xlsx"
- `include_inactive`: boolean
- `columns`: comma-separated field names

**Response:** File download

### 6.3 Audit & History APIs

**Get Change History**

```http
GET /api/v1/platform/core-data/tables/{table_name}/values/{code}/history
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "action": "UPDATE",
      "changed_by": {
        "id": "uuid-admin",
        "name": "Sarah Admin"
      },
      "changed_at": "2025-01-10T10:30:00Z",
      "changed_fields": ["name2", "display_order"],
      "old_values": {
        "name2": "غسل",
        "display_order": 4
      },
      "new_values": {
        "name2": "غسيل",
        "display_order": 5
      },
      "change_reason": "Fixed Arabic translation"
    }
  ]
}
```

**Rollback to Version**

```http
POST /api/v1/platform/core-data/tables/{table_name}/values/{code}/rollback
```

**Request:**
```json
{
  "audit_log_id": "uuid-123",
  "reason": "Reverting incorrect change"
}
```

---

## 7. Versioning & Audit

### 7.1 Change Tracking

**Automatic Audit Logging:**
```typescript
// Trigger function for audit logging
async function logCodeTableChange(
  tableName: string,
  code: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  oldValues: any,
  newValues: any,
  userId: string,
  reason?: string
) {
  const changedFields = action === 'UPDATE'
    ? Object.keys(newValues).filter(key => oldValues[key] !== newValues[key])
    : [];

  await prisma.sys_code_table_audit_log.create({
    data: {
      table_name: tableName,
      record_code: code,
      action,
      old_values: oldValues,
      new_values: newValues,
      changed_fields: changedFields,
      changed_by: userId,
      change_reason: reason,
      ip_address: getCurrentIP(),
      user_agent: getCurrentUserAgent()
    }
  });
}
```

### 7.2 Version Rollback

**Rollback Implementation:**
```typescript
async function rollbackCodeValue(
  tableName: string,
  code: string,
  auditLogId: string,
  userId: string,
  reason: string
) {
  // Get the audit log entry
  const auditEntry = await prisma.sys_code_table_audit_log.findUnique({
    where: { id: auditLogId }
  });

  if (!auditEntry) {
    throw new Error('Audit entry not found');
  }

  // Get current values
  const currentValues = await getCodeValue(tableName, code);

  // Restore old values
  await updateCodeValue(tableName, code, auditEntry.old_values);

  // Log the rollback
  await logCodeTableChange(
    tableName,
    code,
    'UPDATE',
    currentValues,
    auditEntry.old_values,
    userId,
    `Rollback: ${reason}`
  );

  // Mark as rollback in audit log
  await prisma.sys_code_table_audit_log.update({
    where: { id: auditLogId },
    data: {
      is_rollback: true,
      rollback_of_id: auditEntry.id
    }
  });

  return auditEntry.old_values;
}
```

### 7.3 Change Approval Workflow (Future)

**For critical tables:**
```typescript
interface ChangeApproval {
  id: string;
  table_name: string;
  record_code: string;
  proposed_changes: any;
  requested_by: string;
  requested_at: Date;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: Date;
  rejection_reason?: string;
}

async function requestCodeValueChange(
  tableName: string,
  code: string,
  proposedChanges: any,
  userId: string
) {
  // Check if table requires approval
  const registry = await getTableRegistry(tableName);

  if (registry.requires_approval) {
    return await createChangeApproval({
      table_name: tableName,
      record_code: code,
      proposed_changes: proposedChanges,
      requested_by: userId,
      status: 'pending'
    });
  }

  // Apply directly if no approval needed
  return await updateCodeValue(tableName, code, proposedChanges);
}
```

---

## 8. Seeding & Migration

### 8.1 Seed Data Scripts

**Seed Script Structure:**
```typescript
// scripts/seed-core-data.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedData {
  table: string;
  data: any[];
}

const seedData: SeedData[] = [
  {
    table: 'sys_order_status_cd',
    data: [
      {
        code: 'DRAFT',
        name: 'Draft',
        name2: 'مسودة',
        display_order: 1,
        color: '#9CA3AF',
        is_initial_status: true,
        is_system: true
      }
      // ... more statuses
    ]
  },
  {
    table: 'sys_service_category_cd',
    data: [
      // ... service categories
    ]
  }
  // ... more tables
];

async function seedCoreData() {
  console.log('🌱 Seeding core data...');

  for (const { table, data } of seedData) {
    console.log(`  Seeding ${table}...`);

    for (const record of data) {
      await prisma[table].upsert({
        where: { code: record.code },
        update: record,
        create: record
      });
    }

    console.log(`  ✓ Seeded ${data.length} records in ${table}`);

    // Update registry
    await prisma.sys_code_tables_registry.update({
      where: { table_name: table },
      data: {
        last_seeded_at: new Date(),
        current_version: {
          increment: 1
        }
      }
    });
  }

  console.log('✓ Core data seeding complete');
}

seedCoreData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run Seeding:**
```bash
# Development
npm run seed:core-data

# Production (with confirmation)
npm run seed:core-data:prod
```

### 8.2 Migration Scripts

**Migration for Code Table Updates:**
```sql
-- migrations/0015_update_order_statuses.sql

BEGIN;

-- Add new status
INSERT INTO sys_order_status_cd (
  code, name, name2, display_order, color,
  is_system, allowed_next_statuses
) VALUES (
  'QUALITY_HOLD',
  'Quality Hold',
  'تعليق الجودة',
  10,
  '#F59E0B',
  true,
  ARRAY['QA', 'WASHING']
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order;

-- Update existing status
UPDATE sys_order_status_cd
SET allowed_next_statuses = array_append(allowed_next_statuses, 'QUALITY_HOLD')
WHERE code = 'WASHING'
  AND NOT 'QUALITY_HOLD' = ANY(allowed_next_statuses);

-- Log migration
INSERT INTO sys_code_table_audit_log (
  table_name, record_code, action,
  new_values, changed_by, change_reason
) VALUES (
  'sys_order_status_cd',
  'QUALITY_HOLD',
  'INSERT',
  '{"name": "Quality Hold", "name2": "تعليق الجودة"}'::jsonb,
  '00000000-0000-0000-0000-000000000000',
  'Migration: Added quality hold status'
);

COMMIT;
```

### 8.3 Environment-Specific Seeds

**Development:**
```typescript
// seeds/development.ts
export const developmentSeeds = {
  sys_plans_mst: [
    // Include all plans including test plans
    { plan_code: 'DEV_TEST', plan_name: 'Development Test Plan', ... }
  ]
};
```

**Production:**
```typescript
// seeds/production.ts
export const productionSeeds = {
  sys_plans_mst: [
    // Only production plans
    // No test/dev plans
  ]
};
```

---

## 9. Validation Rules

### 9.1 Code Validation

**Validation Rules:**
```typescript
interface ValidationRule {
  field: string;
  rule: 'required' | 'unique' | 'pattern' | 'length' | 'reference';
  params?: any;
  errorMessage: string;
}

const codeTableValidationRules: Record<string, ValidationRule[]> = {
  sys_order_status_cd: [
    {
      field: 'code',
      rule: 'required',
      errorMessage: 'Code is required'
    },
    {
      field: 'code',
      rule: 'pattern',
      params: /^[A-Z_]+$/,
      errorMessage: 'Code must be uppercase letters and underscores only'
    },
    {
      field: 'code',
      rule: 'unique',
      errorMessage: 'Code already exists'
    },
    {
      field: 'name',
      rule: 'required',
      errorMessage: 'English name is required'
    },
    {
      field: 'display_order',
      rule: 'required',
      errorMessage: 'Display order is required'
    }
  ]
};

async function validateCodeValue(
  tableName: string,
  values: any,
  existingCode?: string
): Promise<ValidationError[]> {
  const rules = codeTableValidationRules[tableName] || [];
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const value = values[rule.field];

    switch (rule.rule) {
      case 'required':
        if (!value) {
          errors.push({
            field: rule.field,
            error: rule.errorMessage
          });
        }
        break;

      case 'unique':
        if (rule.field === 'code' && value !== existingCode) {
          const exists = await checkCodeExists(tableName, value);
          if (exists) {
            errors.push({
              field: rule.field,
              error: rule.errorMessage
            });
          }
        }
        break;

      case 'pattern':
        if (value && !rule.params.test(value)) {
          errors.push({
            field: rule.field,
            error: rule.errorMessage
          });
        }
        break;

      case 'length':
        if (value && value.length > rule.params.max) {
          errors.push({
            field: rule.field,
            error: `${rule.field} must be less than ${rule.params.max} characters`
          });
        }
        break;
    }
  }

  return errors;
}
```

### 9.2 Referential Integrity

**Check References Before Delete:**
```typescript
async function checkCodeValueReferences(
  tableName: string,
  code: string
): Promise<{ hasReferences: boolean; references: any[] }> {
  // Define reference mappings
  const referenceMappings: Record<string, any[]> = {
    sys_order_status_cd: [
      { table: 'org_orders_mst', column: 'status' },
      { table: 'sys_workflow_step_cd', column: 'target_status' }
    ],
    sys_service_category_cd: [
      { table: 'org_service_category_cf', column: 'service_category_code' },
      { table: 'org_product_data_mst', column: 'service_category_code' }
    ],
    sys_payment_method_cd: [
      { table: 'org_payments_dtl_tr', column: 'payment_method' }
    ]
  };

  const references = referenceMappings[tableName] || [];
  const foundReferences: any[] = [];

  for (const ref of references) {
    const count = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM ${ref.table}
      WHERE ${ref.column} = $1
    `, code);

    if (count[0].count > 0) {
      foundReferences.push({
        table: ref.table,
        column: ref.column,
        count: parseInt(count[0].count)
      });
    }
  }

  return {
    hasReferences: foundReferences.length > 0,
    references: foundReferences
  };
}
```

---

## 10. Tenant Customization

### 10.1 Override Mechanism

**Get Effective Code Value (with tenant override):**
```typescript
async function getEffectiveServiceCategory(
  tenantId: string,
  categoryCode: string
) {
  // Get system category
  const systemCategory = await prisma.sys_service_category_cd.findUnique({
    where: { code: categoryCode }
  });

  // Check for tenant override
  const tenantOverride = await prisma.org_service_category_cf.findFirst({
    where: {
      tenant_org_id: tenantId,
      service_category_code: categoryCode,
      is_active: true
    }
  });

  if (!tenantOverride) {
    return systemCategory;
  }

  // Merge system values with tenant overrides
  return {
    ...systemCategory,
    name: tenantOverride.custom_name || systemCategory.name,
    name2: tenantOverride.custom_name2 || systemCategory.name2,
    pricing_unit: tenantOverride.custom_pricing_unit || systemCategory.default_pricing_unit,
    turnaround_hours: tenantOverride.custom_turnaround_hours || systemCategory.estimated_turnaround_hours,
    base_price: tenantOverride.base_price,
    is_available: tenantOverride.is_available
  };
}
```

### 10.2 Tenant-Specific Additions

**Add Custom Service Category:**
```typescript
async function addTenantCustomCategory(
  tenantId: string,
  customCategory: {
    name: string;
    name2: string;
    base_price: number;
    turnaround_hours: number;
  }
) {
  // Create custom category code
  const customCode = `CUSTOM_${generateUniqueId()}`;

  // First create in system table (marked as custom)
  await prisma.sys_service_category_cd.create({
    data: {
      code: customCode,
      name: customCategory.name,
      name2: customCategory.name2,
      is_system: false,
      is_active: true
    }
  });

  // Then create tenant configuration
  await prisma.org_service_category_cf.create({
    data: {
      tenant_org_id: tenantId,
      service_category_code: customCode,
      base_price: customCategory.base_price,
      custom_turnaround_hours: customCategory.turnaround_hours,
      is_active: true
    }
  });

  return customCode;
}
```

---

## 11. Bulk Operations

### 11.1 CSV Import

**Import Flow:**
```typescript
import Papa from 'papaparse';

async function importCodeValuesFromCSV(
  tableName: string,
  file: File,
  mode: 'insert' | 'upsert' | 'replace',
  validateOnly: boolean = false
): Promise<ImportResult> {
  // Parse CSV
  const parsed = await new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: resolve,
      error: reject
    });
  });

  const rows = parsed.data;
  const results = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Validate row
      const errors = await validateCodeValue(tableName, row);

      if (errors.length > 0) {
        results.errors.push({
          row: i + 2, // +2 for header and 0-index
          errors
        });
        results.skipped++;
        continue;
      }

      if (validateOnly) {
        results.inserted++; // Would be inserted
        continue;
      }

      // Apply based on mode
      if (mode === 'insert') {
        await insertCodeValue(tableName, row);
        results.inserted++;
      } else if (mode === 'upsert') {
        const exists = await checkCodeExists(tableName, row.code);
        if (exists) {
          await updateCodeValue(tableName, row.code, row);
          results.updated++;
        } else {
          await insertCodeValue(tableName, row);
          results.inserted++;
        }
      }
    } catch (error) {
      results.errors.push({
        row: i + 2,
        error: error.message
      });
      results.skipped++;
    }
  }

  return results;
}
```

**CSV Format Example:**
```csv
code,name,name2,description,display_order,color,is_active
DRAFT,Draft,مسودة,Order is in draft state,1,#9CA3AF,true
INTAKE,Intake,استلام,Order received from customer,2,#3B82F6,true
```

### 11.2 Export

**Export to CSV:**
```typescript
async function exportCodeValuesToCSV(
  tableName: string,
  options: {
    includeInactive?: boolean;
    columns?: string[];
  }
): Promise<string> {
  // Get data
  const values = await getCodeValues(tableName, {
    active_only: !options.includeInactive
  });

  // Select columns
  const columns = options.columns || [
    'code', 'name', 'name2', 'description', 'description2',
    'display_order', 'icon', 'color', 'is_active'
  ];

  // Convert to CSV
  const csv = Papa.unparse(values, {
    columns,
    header: true
  });

  return csv;
}
```

---

## 12. Multi-Language Support

### 12.1 Language Fields

**All user-facing code tables must have:**
- `name` - English name
- `name2` - Arabic name
- `description` - English description (optional)
- `description2` - Arabic description (optional)

### 12.2 Language Selection API

**Get localized values:**
```typescript
async function getLocalizedCodeValues(
  tableName: string,
  locale: 'en' | 'ar'
) {
  const values = await getCodeValues(tableName);

  return values.map(value => ({
    code: value.code,
    name: locale === 'ar' && value.name2 ? value.name2 : value.name,
    description: locale === 'ar' && value.description2 ? value.description2 : value.description,
    ...value
  }));
}
```

### 12.3 Translation Completeness

**Check translation coverage:**
```typescript
async function checkTranslationCompleteness(tableName: string) {
  const values = await prisma[tableName].findMany();

  const stats = {
    total: values.length,
    missing_arabic_name: 0,
    missing_arabic_description: 0,
    complete: 0
  };

  for (const value of values) {
    if (!value.name2) stats.missing_arabic_name++;
    if (value.description && !value.description2) stats.missing_arabic_description++;
    if (value.name2 && (!value.description || value.description2)) stats.complete++;
  }

  return {
    ...stats,
    completion_percentage: (stats.complete / stats.total) * 100
  };
}
```

---

## 13. Data Dependencies

### 13.1 Dependency Graph

```typescript
interface CodeTableDependency {
  table: string;
  dependsOn: string[];
  dependents: string[];
}

const dependencyGraph: CodeTableDependency[] = [
  {
    table: 'sys_service_category_cd',
    dependsOn: [],
    dependents: ['org_service_category_cf', 'org_product_data_mst']
  },
  {
    table: 'sys_order_status_cd',
    dependsOn: [],
    dependents: ['org_orders_mst', 'sys_workflow_step_cd']
  },
  {
    table: 'sys_payment_method_cd',
    dependsOn: ['sys_payment_gateway_cd'],
    dependents: ['org_payments_dtl_tr']
  }
];
```

### 13.2 Seeding Order

**Determine correct seeding order:**
```typescript
function getSeededOrder(dependencies: CodeTableDependency[]): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(table: string) {
    if (visited.has(table)) return;

    const dep = dependencies.find(d => d.table === table);
    if (dep) {
      // Visit dependencies first
      dep.dependsOn.forEach(visit);
    }

    visited.add(table);
    order.push(table);
  }

  dependencies.forEach(dep => visit(dep.table));

  return order;
}
```

---

## 14. Security & Access Control

### 14.1 Permissions

**Core Data Permissions:**
```typescript
enum CoreDataPermission {
  VIEW_CODE_TABLES = 'core_data:view',
  EDIT_CODE_TABLES = 'core_data:edit',
  CREATE_CODE_VALUES = 'core_data:create',
  DELETE_CODE_VALUES = 'core_data:delete',
  IMPORT_DATA = 'core_data:import',
  EXPORT_DATA = 'core_data:export',
  VIEW_AUDIT_LOG = 'core_data:audit:view',
  ROLLBACK_CHANGES = 'core_data:rollback'
}
```

### 14.2 Protected Tables

**System-critical tables:**
```typescript
const protectedTables = [
  'sys_order_status_cd',
  'sys_plans_mst',
  'sys_user_role_cd',
  'sys_permission_cd'
];

async function canEditCodeTable(
  tableName: string,
  userId: string
): Promise<boolean> {
  // Check if table is protected
  if (protectedTables.includes(tableName)) {
    // Only super admins can edit
    const user = await getUser(userId);
    return user.role === 'super_admin';
  }

  // Regular admins can edit other tables
  return hasPermission(userId, CoreDataPermission.EDIT_CODE_TABLES);
}
```

---

## 15. Integration Points

### 15.1 Cache Integration

**Redis Caching:**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedCodeValues(tableName: string) {
  const cacheKey = `code_table:${tableName}`;

  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from DB
  const values = await getCodeValues(tableName);

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(values));

  return values;
}

// Invalidate cache on change
async function invalidateCodeTableCache(tableName: string) {
  await redis.del(`code_table:${tableName}`);
  await redis.del(`code_table:${tableName}:*`);
}
```

### 15.2 Webhook Notifications

**Notify on code table changes:**
```typescript
async function notifyCodeTableChange(
  tableName: string,
  code: string,
  action: string
) {
  const webhooks = await getActiveWebhooks('code_table.changed');

  for (const webhook of webhooks) {
    await sendWebhook(webhook.url, {
      event: 'code_table.changed',
      data: {
        table_name: tableName,
        code,
        action,
        timestamp: new Date()
      }
    });
  }
}
```

---

## 16. Implementation Plan

### 16.1 Phase 1: Core Infrastructure (Weeks 1-2)

**Week 1: Database Schema**
- [ ] Create all sys_*_cd tables
- [ ] Create registry and audit tables
- [ ] Create tenant override tables
- [ ] Add indexes and constraints

**Week 2: Basic APIs**
- [ ] Implement CRUD APIs for code tables
- [ ] Build validation logic
- [ ] Add audit logging
- [ ] Set up caching

### 16.2 Phase 2: Management UI (Weeks 3-4)

**Week 3: Dashboard**
- [ ] Build code tables dashboard
- [ ] Create table list view
- [ ] Add search and filtering
- [ ] Implement table editor

**Week 4: Advanced Features**
- [ ] Build audit history view
- [ ] Add rollback functionality
- [ ] Implement bulk import/export
- [ ] Create validation UI

### 16.3 Phase 3: Seeding & Migration (Week 5)

- [ ] Create seed data scripts
- [ ] Build migration tools
- [ ] Add environment-specific seeds
- [ ] Document seeding process

---

## 17. Testing Strategy

### 17.1 Unit Tests

**Test Validation:**
```typescript
describe('Code Value Validation', () => {
  it('should validate required fields', async () => {
    const errors = await validateCodeValue('sys_order_status_cd', {
      code: '',
      name: ''
    });

    expect(errors).toContainEqual({
      field: 'code',
      error: 'Code is required'
    });
  });

  it('should validate code pattern', async () => {
    const errors = await validateCodeValue('sys_order_status_cd', {
      code: 'invalid-code',
      name: 'Test'
    });

    expect(errors).toContainEqual({
      field: 'code',
      error: expect.stringContaining('uppercase')
    });
  });
});
```

### 17.2 Integration Tests

**Test Audit Logging:**
```typescript
describe('Audit Logging', () => {
  it('should log code value changes', async () => {
    const original = await createCodeValue('sys_order_status_cd', {
      code: 'TEST',
      name: 'Test Status'
    });

    await updateCodeValue('sys_order_status_cd', 'TEST', {
      name: 'Updated Test Status'
    });

    const auditLog = await getAuditLog('sys_order_status_cd', 'TEST');

    expect(auditLog).toHaveLength(2); // INSERT + UPDATE
    expect(auditLog[1].action).toBe('UPDATE');
    expect(auditLog[1].changed_fields).toContain('name');
  });
});
```

---

## 18. Future Enhancements

### 18.1 Advanced Features

**Dynamic Code Tables:**
- Allow tenants to create custom code tables
- Visual schema designer
- Automatic API generation

**Workflow Builder:**
- Visual workflow designer using code values
- Drag-and-drop status transitions
- Conditional routing rules

**ML-Powered Suggestions:**
- Suggest missing translations
- Detect inconsistencies
- Auto-categorize new values

---

## Related PRDs

- **[PRD-SAAS-MNG-0001](PRD-SAAS-MNG-0001_Platform_HQ_Console.md)** - Platform HQ Console (Master)
- **[PRD-SAAS-MNG-0002](PRD-SAAS-MNG-0002_Tenant_Lifecycle.md)** - Tenant Lifecycle Management
- **[PRD-SAAS-MNG-0007](PRD-SAAS-MNG-0007_Workflow_Engine.md)** - Workflow Engine Management
- **[PRD-SAAS-MNG-0010](PRD-SAAS-MNG-0010_Platform_Configuration.md)** - Platform Configuration

---

## Glossary

- **Code Table**: Lookup table containing enumerated values
- **System Data (sys_*)**: Platform-wide data shared across all tenants
- **Configuration Data (org_*_cf)**: Tenant-specific customization of system data
- **Seeding**: Process of populating tables with initial/default data
- **Audit Trail**: Historical record of all changes to data
- **Referential Integrity**: Ensuring relationships between tables remain valid

---

**End of PRD-SAAS-MNG-0006: Core Data & Code Management**

---

**Document Status**: Draft v0.1.0
**Next Review**: After implementation of Phase 1
**Approved By**: Pending
**Implementation Start**: TBD
