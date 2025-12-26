-- ==================================================================
-- 0001_core_schema.sql
-- Purpose: Core database schema for CleanMateX multi-tenant SaaS
-- Author: CleanMateX Development Team
-- Created: 2025-10-17
-- Dependencies: None
-- ==================================================================
-- This migration creates the foundational tables for:
-- - System-level lookup tables (sys_*)
-- - Tenant organization tables (org_*)
-- - Multi-tenant data isolation via composite keys
-- ==================================================================

BEGIN;

-- ==================================================================
-- EXTENSIONS
-- ==================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions (gen_random_uuid, etc.)';

-- ==================================================================
-- SYSTEM LOOKUP TABLES (sys_*)
-- Global reference data shared across all tenants
-- ==================================================================


/*==============================================================*/
/* Table: sys_payment_method_cd                                 */
/*==============================================================*/

CREATE TABLE IF NOT EXISTS sys_payment_method_cd (
   payment_method_code  TEXT          not null,
   payment_method_name  TEXT         null,
   payment_method_name2 TEXT         null,
   is_enabled           BOOLEAN              not null default true,
   is_active            BOOLEAN              not null default true,
   rec_notes            TEXT         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   payment_type_color1  TEXT          null,
   payment_type_color2  TEXT          null,
   payment_type_color3  TEXT          null,
   payment_type_icon    TEXT         null,
   payment_type_image   TEXT         null,
   constraint PK_SYS_PAYMENT_METHOD_CD primary key (payment_method_code)
);

comment on table sys_payment_method_cd is
'ALL payment_methods in the system: Pay on collect, cash, card, paymet gateways...';

/*==============================================================*/
/* Table: sys_payment_type_cd                                   */
/*==============================================================*/

CREATE TABLE IF NOT EXISTS sys_payment_type_cd (
   payment_type_id      TEXT          not null,
   payment_type_name    TEXT         null,
   payment_type_name2   TEXT         null,
   is_enabled           BOOLEAN              not null default false,
   has_plan             BOOLEAN              not null default false,
   is_active            BOOLEAN              not null default true,
   rec_notes            TEXT         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   payment_type_color1  TEXT          null,
   payment_type_color2  TEXT          null,
   payment_type_color3  TEXT          null,
   payment_type_icon    TEXT         null,
   payment_type_image   TEXT         null,
   constraint PK_SYS_PAYMENT_TYPE_CD primary key (payment_type_id)
);

comment on table sys_payment_type_cd is
'Payment type such as: Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup';

comment on column sys_payment_type_cd.is_enabled is
'such as Pay on Delivery, Pay on Pickup should be false';

comment on column sys_payment_type_cd.has_plan is
'such as Pay on Delivery, Pay on Pickup should be true';

-----------------------------------------

-- Order Types (POS, PICKUP, DELIVERY)
CREATE TABLE IF NOT EXISTS sys_order_type_cd (
  order_type_id         VARCHAR(30) PRIMARY KEY,
  order_type_name       VARCHAR(250),
  order_type_name2      VARCHAR(250),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  rec_notes             VARCHAR(200),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP,
  order_type_color1     VARCHAR(60),
  order_type_color2     VARCHAR(60),
  order_type_color3     VARCHAR(60),
  order_type_icon       VARCHAR(120),
  order_type_image      VARCHAR(120)
);

COMMENT ON TABLE sys_order_type_cd IS 'Global order types (POS, pickup, delivery)';
COMMENT ON COLUMN sys_order_type_cd.order_type_name IS 'Order type name (English)';
COMMENT ON COLUMN sys_order_type_cd.order_type_name2 IS 'Order type name (Arabic)';

-- Service Categories (LAUNDRY, DRY_CLEAN, IRON, REPAIRS)
CREATE TABLE IF NOT EXISTS sys_service_category_cd (
  service_category_code VARCHAR(120) PRIMARY KEY,
  ctg_name              VARCHAR(250) NOT NULL,
  ctg_name2             VARCHAR(250),
  ctg_desc              VARCHAR(600),
  turnaround_hh         NUMERIC(4,2),
  turnaround_hh_express NUMERIC(4,2),
  multiplier_express    NUMERIC(4,2),
  is_builtin            BOOLEAN NOT NULL DEFAULT false,
  has_fee               BOOLEAN NOT NULL DEFAULT false,
  is_mandatory          BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  rec_order            INTEGER              null default 1,
  rec_status           SMALLINT             null default 1,
  rec_notes             VARCHAR(200),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP,
  service_category_color1 VARCHAR(60),
  service_category_color2 VARCHAR(60),
  service_category_color3 VARCHAR(60),
  service_category_icon  VARCHAR(120),
  service_category_image VARCHAR(120)
);

COMMENT ON TABLE sys_service_category_cd IS 'Global service categories';
COMMENT ON COLUMN sys_service_category_cd.ctg_name IS 'Category name (English)';
COMMENT ON COLUMN sys_service_category_cd.ctg_name2 IS 'Category name (Arabic)';

-- Global Customers (shared identity across tenants)
CREATE TABLE IF NOT EXISTS sys_customers_mst (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_source_type    TEXT                 not null default 'DIRECT',
  first_name         TEXT  ,
  last_name          TEXT,
  display_name        TEXT,
  name               TEXT,
  name2              TEXT,
  phone              TEXT,
  email              TEXT,
  type               TEXT DEFAULT 'walk_in',
  address            TEXT,
  area               TEXT,
  building           TEXT,
  floor              TEXT,
  preferences        JSONB DEFAULT '{}'::jsonb,
  first_tenant_org_id UUID,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_by     TEXT,
  updated_info   TEXT
  
);

COMMENT ON TABLE sys_customers_mst IS 'Global customer identities (shared across tenants)';
COMMENT ON COLUMN sys_customers_mst.first_tenant_org_id IS 'First tenant that created this customer';

-- ==================================================================
-- TENANT / ORGANIZATION TABLES (org_*)
-- Multi-tenant data with tenant_org_id for isolation
-- ==================================================================

-- Tenant Organizations
CREATE TABLE IF NOT EXISTS org_tenants_mst (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  name2          VARCHAR(255),
  slug           VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  phone          VARCHAR(50)  NOT NULL,
  s_current_plan VARCHAR(120) DEFAULT 'FREE_TRIAL',
  address        TEXT,
  city           VARCHAR(100),
  country        VARCHAR(2)   DEFAULT 'OM',
  currency       VARCHAR(3)   DEFAULT 'OMR',
  timezone       VARCHAR(50)  DEFAULT 'Asia/Muscat',
  language       VARCHAR(5)   DEFAULT 'en',
  is_active      BOOLEAN       DEFAULT true,
  status         VARCHAR(20)   DEFAULT 'trial',
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slug),
  UNIQUE(email)
);

COMMENT ON TABLE org_tenants_mst IS 'Tenant organizations (laundry businesses)';
COMMENT ON COLUMN org_tenants_mst.slug IS 'URL-friendly identifier (e.g., demo-laundry)';
COMMENT ON COLUMN org_tenants_mst.s_current_plan IS 'Current subscription plan';

-- Tenant Subscriptions
CREATE TABLE IF NOT EXISTS org_subscriptions_mst (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id            UUID NOT NULL,
  plan                 VARCHAR(20)  ,
  status               VARCHAR(20)  DEFAULT 'trial',
  orders_limit         INTEGER      DEFAULT 20,
  orders_used          INTEGER      DEFAULT 0,
  branch_limit         INTEGER      DEFAULT 1,
  user_limit           INTEGER      DEFAULT 2,
  start_date           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  end_date             TIMESTAMP    NOT NULL,
  trial_ends           TIMESTAMP,
  last_payment_date    TIMESTAMP,
  last_payment_amount  NUMERIC(10,2),
  last_payment_method  VARCHAR(50),
  payment_reference    VARCHAR(100),
  payment_notes        TEXT,
  last_invoice_number  VARCHAR(50),
  last_invoice_date    TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  is_enabled BOOLEAN DEFAULT true,
  rec_status     SMALLINT DEFAULT 1,
  rec_notes      TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMP,
  updated_by     TEXT,
  updated_info   TEXT
  
);

COMMENT ON TABLE org_subscriptions_mst IS 'Tenant subscription plans and limits';
COMMENT ON COLUMN org_subscriptions_mst.orders_limit IS 'Maximum orders per month';
COMMENT ON COLUMN org_subscriptions_mst.orders_used IS 'Orders used this billing cycle';

-- Tenant Branches
CREATE TABLE IF NOT EXISTS org_branches_mst (
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id  UUID NOT NULL,
  branch_name    TEXT,
  name                 TEXT,
   name2                TEXT,
   is_main              BOOLEAN   default false,
  s_date         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  phone          VARCHAR(50),
  email          VARCHAR(255),
  type           VARCHAR(20) DEFAULT 'walk_in',
  address        TEXT,
  country        TEXT,
  city           TEXT,
  area           TEXT,
  street         TEXT,
  building       TEXT,
  floor          TEXT,
  latitude       FLOAT,
  longitude      FLOAT,
  rec_order      INTEGER,
  rec_status     SMALLINT DEFAULT 1,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  rec_notes      VARCHAR(200),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by     VARCHAR(120),
  created_info   TEXT,
  updated_at     TIMESTAMP,
  updated_by     VARCHAR(120),
  updated_info   TEXT,
  PRIMARY KEY (id, tenant_org_id)
);

COMMENT ON TABLE org_branches_mst IS 'Tenant branch locations';
COMMENT ON COLUMN org_branches_mst.type IS 'Branch type (walk_in, warehouse, etc.)';

-- Tenant Service Category Enablement
CREATE TABLE IF NOT EXISTS org_service_category_cf (
  tenant_org_id         UUID NOT NULL,
  service_category_code VARCHAR(120) NOT NULL,
  name TEXT,
  name2 TEXT,
  display_name TEXT,
is_enabled BOOLEAN DEFAULT true,
is_active BOOLEAN DEFAULT true,
rec_order INTEGER default 1,
rec_notes TEXT,
rec_status SMALLINT DEFAULT 1,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
created_by TEXT,
created_info TEXT,
updated_at TIMESTAMP,
updated_by TEXT,
updated_info TEXT,
  PRIMARY KEY (tenant_org_id, service_category_code)
);

COMMENT ON TABLE org_service_category_cf IS 'Tenant-specific service category enablement';

-- ==================================================================
-- CATALOG / PRODUCTS
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_product_data_mst (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id              UUID NOT NULL,
  service_category_code      TEXT,
  product_code               TEXT NOT NULL,
  product_name               TEXT,
  product_name2              TEXT,
  hint_text                  TEXT,
  is_retail_item             BOOLEAN DEFAULT false,
  product_group1       TEXT                 , -- for example TOP, Bottoms, Full-body, Outerwear, Underwear, Specialized
   product_group2       TEXT                 ,
   product_group3       TEXT                 ,
  product_type               INTEGER,
  price_type                 TEXT,
  product_unit               VARCHAR(60),
  default_sell_price         DECIMAL(10,3),
  default_express_sell_price DECIMAL(10,3),
  product_cost               DECIMAL(10,3),
  min_sell_price             DECIMAL(10,3),
  min_quantity               INTEGER,
  pieces_per_product         INTEGER,
  extra_days                 INTEGER,
  turnaround_hh              NUMERIC(4,2),
  turnaround_hh_express      NUMERIC(4,2),
  multiplier_express         NUMERIC(4,2),
  product_order              INTEGER,
  is_tax_exempt              INTEGER,
  tags                       JSON,
  id_sku                     TEXT,
  is_active                  BOOLEAN NOT NULL DEFAULT true,
  product_color1    TEXT,
  product_color2    TEXT,
  product_color3    TEXT,
  product_icon      TEXT,
  product_image     TEXT,
  rec_order                  INTEGER,
  rec_notes                 TEXT,
  rec_status                 SMALLINT DEFAULT 1,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by                 TEXT,
  created_info               TEXT,
  updated_at                TIMESTAMP,
  updated_by                 TEXT,
  updated_info               TEXT,
  UNIQUE(tenant_org_id, product_code)
);

COMMENT ON TABLE org_product_data_mst IS 'Tenant product/detail service catalog';
COMMENT ON COLUMN org_product_data_mst.product_name IS 'Product name (English)';
COMMENT ON COLUMN org_product_data_mst.product_name2 IS 'Product name (Arabic)';

-- ==================================================================
-- TENANT-CUSTOMER LINK
-- ==================================================================
   
CREATE TABLE IF NOT EXISTS org_customers_mst (
   id                   UUID                 not null default gen_random_uuid(),
   tenant_org_id        UUID                 not null,
   customer_id          UUID                 null,
   name                 TEXT                 null,
   name2                TEXT                 null,
   display_name         TEXT                 null,
   first_name           TEXT                 null,
   last_name            TEXT                 null,
   phone                TEXT                 null,
   email                TEXT                 null,
   type                 TEXT                 null default 'walk_in',
   address              TEXT                 null,
   area                 TEXT                 null,
   building             TEXT                 null,
   floor                TEXT                 null,
   preferences          JSONB                null default '{}',
   customer_source_type TEXT                 not null default 'DIRECT',
   s_date               TIMESTAMP            not null default CURRENT_TIMESTAMP,
   loyalty_points       INTEGER              null default '0',
   rec_order            INTEGER              null,
   rec_status           SMALLINT             null default '1',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            TEXT                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   created_by           UUID                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           UUID                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_CUSTOMERS_MST primary key (id),
   
   constraint AK_GLOBAL_CUSTOMER_ID_ORG_CUST unique (tenant_org_id, customer_id)

);

comment on column org_customers_mst.customer_source_type is
'the source type, TENANT, CUSTOMER_APP, MARKET_PLACE, DIRECT, direct is when inserted to this table not from other source';


COMMENT ON TABLE org_customers_mst IS 'Junction table linking global customers to tenants';
COMMENT ON COLUMN org_customers_mst.loyalty_points IS 'Tenant-specific loyalty points';

-- ==================================================================
-- ORDERS
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_orders_mst (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id      UUID NOT NULL,
  branch_id          UUID,
  customer_id        UUID NOT NULL,
  order_type_id      VARCHAR(30),
  order_no           VARCHAR(100) NOT NULL,
  status             TEXT DEFAULT 'intake',
  priority           TEXT DEFAULT 'normal',
  total_items        INTEGER DEFAULT 0,
  subtotal           DECIMAL(10,3) DEFAULT 0,
  discount           DECIMAL(10,3) DEFAULT 0,
  tax                DECIMAL(10,3) DEFAULT 0,
  total              DECIMAL(10,3) DEFAULT 0,
  payment_status     VARCHAR(20) DEFAULT 'pending',
  payment_method     VARCHAR(50),
  paid_amount        DECIMAL(10,3) DEFAULT 0,
  paid_at            TIMESTAMP,
  paid_by            VARCHAR(255),
  payment_notes      TEXT,
  received_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ready_by           TIMESTAMP,
  ready_at           TIMESTAMP,
  delivered_at       TIMESTAMP,
  customer_notes     TEXT,
  internal_notes     TEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_org_id, order_no)
);

COMMENT ON TABLE org_orders_mst IS 'Tenant orders (master)';
COMMENT ON COLUMN org_orders_mst.order_no IS 'Tenant-unique order number';

CREATE TABLE IF NOT EXISTS org_order_items_dtl (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL,
  tenant_org_id         UUID NOT NULL,
  service_category_code VARCHAR(120),
  order_item_srno       TEXT,
  product_id            UUID,
  barcode               TEXT,
  quantity              INTEGER DEFAULT 1,
  price_per_unit        DECIMAL(10,3) NOT NULL,
  total_price           DECIMAL(10,3) NOT NULL,
  status                TEXT DEFAULT 'processing',
  notes                 TEXT,
  color                 VARCHAR(50),
  brand                 VARCHAR(100),
  has_stain             BOOLEAN,
  has_damage            BOOLEAN,
  metadata              JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE org_order_items_dtl IS 'Order line items (detail)';

-- ==================================================================
-- INVOICES / PAYMENTS
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_invoice_mst (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID,
  tenant_org_id  UUID NOT NULL,
  invoice_no     TEXT NOT NULL,
  subtotal       DECIMAL(10,3) DEFAULT 0,
  discount       DECIMAL(10,3) DEFAULT 0,
  tax            DECIMAL(10,3) DEFAULT 0,
  total          DECIMAL(10,3) DEFAULT 0,
  status         TEXT DEFAULT 'pending',
  due_date       DATE,
  payment_method VARCHAR(50),
  paid_amount    DECIMAL(10,3) DEFAULT 0,
  paid_at        TIMESTAMP,
  paid_by        VARCHAR(255),
  metadata       JSONB,
  rec_notes      VARCHAR(1000),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     VARCHAR(120),
  created_info   TEXT,
  updated_at     TIMESTAMP,
  updated_by     VARCHAR(120),
  updated_info   TEXT,
  UNIQUE(tenant_org_id, invoice_no)
);

COMMENT ON TABLE org_invoice_mst IS 'Tenant invoices';

CREATE TABLE IF NOT EXISTS org_payments_dtl_tr (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL,
  tenant_org_id   UUID NOT NULL,
  paid_amount     DECIMAL(10,3) DEFAULT 0,
  status          TEXT DEFAULT 'pending',
  due_date        DATE,
  payment_method  VARCHAR(50),
  paid_at         TIMESTAMP,
  paid_by         VARCHAR(255),
  gateway         TEXT,
  transaction_id  TEXT,
  metadata        JSONB,
  rec_notes       VARCHAR(1000),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      VARCHAR(120),
  created_info    TEXT,
  updated_at      TIMESTAMP,
  updated_by      VARCHAR(120),
  updated_info    TEXT
);

COMMENT ON TABLE org_payments_dtl_tr IS 'Payment transactions';

-- ==================================================================
-- FOREIGN KEYS (Multi-Tenant Isolation via Composite Keys)
-- ==================================================================

ALTER TABLE org_subscriptions_mst
  ADD CONSTRAINT fk_org_subs_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_branches_mst
  ADD CONSTRAINT fk_org_branch_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_service_category_cf
  ADD CONSTRAINT fk_org_ctg_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_service_category_cf
  ADD CONSTRAINT fk_org_ctg_sys
  FOREIGN KEY (service_category_code) REFERENCES sys_service_category_cd(service_category_code);

ALTER TABLE org_product_data_mst
  ADD CONSTRAINT fk_org_prod_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- Composite FK: Product must reference tenant's enabled service category
ALTER TABLE org_product_data_mst
  ADD CONSTRAINT fk_org_prod_ctg
  FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code);

ALTER TABLE org_customers_mst
  ADD CONSTRAINT fk_org_cust_sys
  FOREIGN KEY (customer_id) REFERENCES sys_customers_mst(id) ON DELETE CASCADE;

ALTER TABLE org_customers_mst
  ADD CONSTRAINT fk_org_cust_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_org_order_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- Composite FK: Order must reference tenant's branch
ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_org_order_branch
  FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id);

ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_org_order_type
  FOREIGN KEY (order_type_id) REFERENCES sys_order_type_cd(order_type_id);

-- Composite FK: Order must reference tenant's customer
ALTER TABLE org_orders_mst
  ADD CONSTRAINT fk_org_order_customer
  FOREIGN KEY (customer_id) REFERENCES org_customers_mst(id);

ALTER TABLE org_order_items_dtl
  ADD CONSTRAINT fk_org_items_order
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE;

ALTER TABLE org_order_items_dtl
  ADD CONSTRAINT fk_org_items_prod
  FOREIGN KEY (product_id) REFERENCES org_product_data_mst(id);

-- Composite FK: Order item must reference tenant's service category
ALTER TABLE org_order_items_dtl
  ADD CONSTRAINT fk_org_items_ctg
  FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code);

ALTER TABLE org_invoice_mst
  ADD CONSTRAINT fk_org_invoice_order
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE;

ALTER TABLE org_invoice_mst
  ADD CONSTRAINT fk_org_invoice_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_payments_dtl_tr
  ADD CONSTRAINT fk_org_payment_invoice
  FOREIGN KEY (invoice_id) REFERENCES org_invoice_mst(id) ON DELETE CASCADE;

ALTER TABLE org_payments_dtl_tr
  ADD CONSTRAINT fk_org_payment_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- ==================================================================
-- INDEXES (Performance Optimization)
-- ==================================================================

-- Orders
CREATE INDEX IF NOT EXISTS idx_org_orders_tenant_no ON org_orders_mst(tenant_org_id, order_no);
CREATE INDEX IF NOT EXISTS idx_org_orders_customer ON org_orders_mst(tenant_org_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_org_orders_status ON org_orders_mst(tenant_org_id, status);
CREATE INDEX IF NOT EXISTS idx_org_orders_created ON org_orders_mst(tenant_org_id, created_at DESC);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_org_items_order ON org_order_items_dtl(order_id);
CREATE INDEX IF NOT EXISTS idx_org_items_tenant ON org_order_items_dtl(tenant_org_id);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_org_invoice_tenant_no ON org_invoice_mst(tenant_org_id, invoice_no);
CREATE INDEX IF NOT EXISTS idx_org_invoice_order ON org_invoice_mst(order_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_org_payments_invoice ON org_payments_dtl_tr(invoice_id);
CREATE INDEX IF NOT EXISTS idx_org_payments_tenant ON org_payments_dtl_tr(tenant_org_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_org_customers_tenant ON org_customers_mst(tenant_org_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_org_products_tenant ON org_product_data_mst(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_products_category ON org_product_data_mst(tenant_org_id, service_category_code);

COMMIT;

-- Migration complete: Core schema created
