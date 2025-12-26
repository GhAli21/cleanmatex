-- 0001_core.sql — CleanMateX Phase-1 Operational Core (Supabase)
-- Uses names from schema_06.sql. No RLS here. Policies come in 0002_rls_core.sql.

-- Extensions
create extension if not exists "pgcrypto";

-- =========================
-- CODE / LOOKUP TABLES (MIN)
-- =========================

create table if not exists sys_order_type_cd (
  order_type_id         varchar(30) primary key,
  order_type_name       varchar(250),
  order_type_name2      varchar(250),
  is_active             boolean not null default true,
  rec_notes             varchar(200),
  created_at            timestamp default current_timestamp,
  updated_at            timestamp,
  order_type_color1     varchar(60),
  order_type_color2     varchar(60),
  order_type_color3     varchar(60),
  order_type_icon       varchar(120),
  order_type_image      varchar(120)
);

create table if not exists sys_service_category_cd (
  service_category_code varchar(120) primary key,
  ctg_name              varchar(250) not null,
  ctg_name2             varchar(250),
  ctg_desc              varchar(600),
  turnaround_hh         numeric(4,2),
  turnaround_hh_express numeric(4,2),
  multiplier_express    numeric(4,2),
  is_builtin            boolean not null default false,
  has_fee               boolean not null default false,
  is_mandatory          boolean not null default false,
  is_active             boolean not null default true,
  rec_notes             varchar(200),
  created_at            timestamp default current_timestamp,
  updated_at            timestamp,
  service_category_color1 varchar(60),
  service_category_color2 varchar(60),
  service_category_color3 varchar(60),
  service_category_icon  varchar(120),
  service_category_image varchar(120)
);

-- =========================
-- GLOBAL CUSTOMERS (MASTER)
-- =========================

create table if not exists sys_customers_mst (
  id                 uuid primary key default gen_random_uuid(),
  first_name         text not null,
  last_name          text,
  disply_name        text,
  name               varchar(255),
  name2              varchar(255),
  phone              varchar(50),
  email              varchar(255),
  type               varchar(20) default 'walk_in',
  address            text,
  area               varchar(100),
  building           varchar(100),
  floor              varchar(50),
  preferences        jsonb default '{}'::jsonb,
  first_tenant_org_id uuid,
  created_at         timestamp default current_timestamp,
  updated_at         timestamp default current_timestamp
);

-- =========================
-- TENANT / ORG
-- =========================

create table if not exists org_tenants_mst (
  id             uuid primary key default gen_random_uuid(),
  name           varchar(255) not null,
  name2          varchar(255),
  slug           varchar(100) not null,
  email          varchar(255) not null,
  phone          varchar(50)  not null,
  s_current_plan varchar(120) default 'FREE_TRIAL',
  address        text,
  city           varchar(100),
  country        varchar(2)   default 'OM',
  currency       varchar(3)   default 'OMR',
  timezone       varchar(50)  default 'Asia/Muscat',
  language       varchar(5)   default 'en',
  is_active      boolean       default true,
  status         varchar(20)   default 'trial',
  created_at     timestamp     default current_timestamp,
  updated_at     timestamp     default current_timestamp,
  unique(slug),
  unique(email)
);

create table if not exists org_subscriptions_mst (
  id                   uuid primary key default gen_random_uuid(),
  tenant_org_id            uuid not null,
  plan                 varchar(20)  default 'free',
  status               varchar(20)  default 'trial',
  orders_limit         integer      default 20,
  orders_used          integer      default 0,
  branch_limit         integer      default 1,
  user_limit           integer      default 2,
  start_date           timestamp    default current_timestamp,
  end_date             timestamp    not null,
  trial_ends           timestamp,
  last_payment_date    timestamp,
  last_payment_amount  numeric(10,2),
  last_payment_method  varchar(50),
  payment_reference    varchar(100),
  payment_notes        text,
  last_invoice_number  varchar(50),
  last_invoice_date    timestamp,
  created_at           timestamp    default current_timestamp,
  updated_at           timestamp    default current_timestamp
);

create table if not exists org_branches_mst (
  id             uuid not null default gen_random_uuid(),
  tenant_org_id  uuid not null,
  branch_name    text,
  s_date         timestamp default current_timestamp,
  phone          varchar(50),
  email          varchar(255),
  type           varchar(20) default 'walk_in',
  address        text,
  country        text,
  city           text,
  area           text,
  street         text,
  building       text,
  floor          text,
  latitude       float,
  longitude      float,
  rec_order      integer,
  rec_status     smallint default 1,
  is_active      boolean not null default true,
  rec_notes      varchar(200),
  created_at     timestamp default current_timestamp,
  created_by     varchar(120),
  created_info   text,
  updated_at     timestamp,
  updated_by     varchar(120),
  updated_info   text,
  primary key (id, tenant_org_id)
);

-- Per-tenant enablement of global categories
create table if not exists org_service_category_cf (
  tenant_org_id         uuid not null,
  service_category_code varchar(120) not null,
  primary key (tenant_org_id, service_category_code)
);

-- =========================
-- CATALOG / PRODUCTS
-- =========================

create table if not exists org_product_data_mst (
  id                         uuid primary key default gen_random_uuid(),
  tenant_org_id              uuid not null,
  service_category_code      varchar(120),
  product_code               varchar(120) not null,
  product_name               varchar(250),
  product_name2              varchar(250),
  hint_text                  text,
  is_retail_item             boolean default false,
  product_type               integer,
  price_type                 text,
  product_unit               varchar(60),
  default_sell_price         decimal(10,3),
  default_express_sell_price decimal(10,3),
  product_cost               decimal(10,3),
  min_sell_price             decimal(10,3),
  min_quantity               integer,
  pieces_per_product         integer,
  extra_days                 integer,
  turnaround_hh              numeric(4,2),
  turnaround_hh_express      numeric(4,2),
  multiplier_express         numeric(4,2),
  product_order              integer,
  is_tax_exempt              integer,
  tags                       json,
  id_sku                     varchar(100),
  is_active                  boolean not null default true,
  service_category_color1    varchar(60),
  service_category_color2    varchar(60),
  service_category_color3    varchar(60),
  service_category_icon      varchar(120),
  service_category_image     varchar(120),
  rec_order                  integer,
  rec_notes2                 varchar(1000),
  rec_status                 smallint default 1,
  created_at2                timestamp default current_timestamp,
  created_by                 varchar(120),
  created_info               text,
  updated_at2                timestamp,
  updated_by                 varchar(120),
  updated_info               text,
  unique(tenant_org_id, product_code)
);

-- =========================
-- TENANT-CUSTOMER LINK
-- =========================

create table if not exists org_customers_mst (
  customer_id   uuid not null,
  tenant_org_id uuid not null,
  s_date        timestamp default current_timestamp,
  loyalty_points integer default 0,
  rec_order     integer,
  rec_status    smallint default 1,
  is_active     boolean not null default true,
  rec_notes     varchar(200),
  created_at    timestamp default current_timestamp,
  created_by    varchar(120),
  created_info  text,
  updated_at    timestamp,
  updated_by    varchar(120),
  updated_info  text,
  primary key (customer_id, tenant_org_id)
);

-- =========================
-- ORDERS
-- =========================

create table if not exists org_orders_mst (
  id                 uuid primary key default gen_random_uuid(),
  tenant_org_id      uuid not null,
  branch_id          uuid,
  customer_id        uuid not null,
  order_type_id      varchar(30),
  order_no           varchar(100) not null,
  status             text default 'intake',
  priority           text default 'normal',
  total_items        integer default 0,
  subtotal           decimal(10,3) default 0,
  discount           decimal(10,3) default 0,
  tax                decimal(10,3) default 0,
  total              decimal(10,3) default 0,
  payment_status     varchar(20) default 'pending',
  payment_method     varchar(50),
  paid_amount        decimal(10,3) default 0,
  paid_at            timestamp,
  paid_by            varchar(255),
  payment_notes      text,
  received_at        timestamp default current_timestamp,
  ready_by           timestamp,
  ready_at           timestamp,
  delivered_at       timestamp,
  customer_notes     text,
  internal_notes     text,
  created_at         timestamp default current_timestamp,
  updated_at         timestamp default current_timestamp,
  unique(tenant_org_id, order_no)
);

create table if not exists org_order_items_dtl (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null,
  tenant_org_id         uuid not null,
  service_category_code varchar(120),
  order_item_srno       text,
  product_id            uuid,
  barcode               text,
  quantity              integer default 1,
  price_per_unit        decimal(10,3) not null,
  total_price           decimal(10,3) not null,
  status                text default 'pending',
  notes                 text,
  color                 varchar(50),
  brand                 varchar(100),
  has_stain             boolean,
  has_damage            boolean,
  metadata              jsonb default '{}'::jsonb,
  created_at            timestamp default current_timestamp
);

-- =========================
-- INVOICES / PAYMENTS
-- =========================

create table if not exists org_invoice_mst (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid,
  tenant_org_id  uuid not null,
  invoice_no     text not null,
  subtotal       decimal(10,3) default 0,
  discount       decimal(10,3) default 0,
  tax            decimal(10,3) default 0,
  total          decimal(10,3) default 0,
  status         text default 'pending',
  due_date       date,
  payment_method varchar(50),
  paid_amount    decimal(10,3) default 0,
  paid_at        timestamp,
  paid_by        varchar(255),
  metadata       jsonb,
  rec_notes      varchar(1000),
  created_at     timestamp not null default current_timestamp,
  created_by     varchar(120),
  created_info   text,
  updated_at     timestamp,
  updated_by     varchar(120),
  updated_info   text,
  unique(tenant_org_id, invoice_no)
);

create table if not exists org_payments_dtl_tr (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null,
  tenant_org_id   uuid not null,
  paid_amount     decimal(10,3) default 0,
  status          text default 'pending',
  due_date        date,
  payment_method  varchar(50),
  paid_at         timestamp,
  paid_by         varchar(255),
  gateway         text,
  transaction_id  text,
  metadata        jsonb,
  rec_notes       varchar(1000),
  created_at      timestamp not null default current_timestamp,
  created_by      varchar(120),
  created_info    text,
  updated_at      timestamp,
  updated_by      varchar(120),
  updated_info    text
);

-- =========================
-- FOREIGN KEYS
-- =========================

alter table org_subscriptions_mst
  add constraint fk_org_subs_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_branches_mst
  add constraint fk_org_branch_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_service_category_cf
  add constraint fk_org_ctg_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_service_category_cf
  add constraint fk_org_ctg_sys
  foreign key (service_category_code) references sys_service_category_cd(service_category_code);

alter table org_product_data_mst
  add constraint fk_org_prod_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_product_data_mst
  add constraint fk_org_prod_ctg
  foreign key (tenant_org_id, service_category_code)
  references org_service_category_cf(tenant_org_id, service_category_code);

alter table org_customers_mst
  add constraint fk_org_cust_sys
  foreign key (customer_id) references sys_customers_mst(id) on delete cascade;

alter table org_customers_mst
  add constraint fk_org_cust_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_orders_mst
  add constraint fk_org_order_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_orders_mst
  add constraint fk_org_order_branch
  foreign key (branch_id, tenant_org_id) references org_branches_mst(id, tenant_org_id);

alter table org_orders_mst
  add constraint fk_org_order_type
  foreign key (order_type_id) references sys_order_type_cd(order_type_id);

alter table org_orders_mst
  add constraint fk_org_order_customer
  foreign key (customer_id, tenant_org_id) references org_customers_mst(customer_id, tenant_org_id);

alter table org_order_items_dtl
  add constraint fk_org_items_order
  foreign key (order_id) references org_orders_mst(id) on delete cascade;

alter table org_order_items_dtl
  add constraint fk_org_items_prod
  foreign key (product_id) references org_product_data_mst(id);

alter table org_order_items_dtl
  add constraint fk_org_items_ctg
  foreign key (tenant_org_id, service_category_code)
  references org_service_category_cf(tenant_org_id, service_category_code);

alter table org_invoice_mst
  add constraint fk_org_invoice_order
  foreign key (order_id) references org_orders_mst(id) on delete cascade;

alter table org_invoice_mst
  add constraint fk_org_invoice_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

alter table org_payments_dtl_tr
  add constraint fk_org_payment_invoice
  foreign key (invoice_id) references org_invoice_mst(id) on delete cascade;

alter table org_payments_dtl_tr
  add constraint fk_org_payment_tenant
  foreign key (tenant_org_id) references org_tenants_mst(id) on delete cascade;

-- =========================
-- INDEXES (critical paths)
-- =========================

create index if not exists idx_org_orders_tenant_no on org_orders_mst(tenant_org_id, order_no);
create index if not exists idx_org_orders_customer on org_orders_mst(tenant_org_id, customer_id);
create index if not exists idx_org_items_order on org_order_items_dtl(order_id);
create index if not exists idx_org_invoice_tenant_no on org_invoice_mst(tenant_org_id, invoice_no);
create index if not exists idx_org_payments_invoice on org_payments_dtl_tr(invoice_id);

-- Done (core)
