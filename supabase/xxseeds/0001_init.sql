-- 0001_init.sql — CleanMateX Phase-1 MVP (names from schema_06.sql)
-- Extensions (Supabase usually has these enabled)
create extension if not exists "pgcrypto";

-- ========== CORE CODE TABLES (referenced by FKs) ==========
create table if not exists sys_order_type_cd (
  order_type_id        varchar(30)  primary key,
  order_type_name      varchar(250),
  order_type_name2     varchar(250),
  is_active            boolean not null default true,
  rec_notes            varchar(200),
  created_at           timestamp default current_timestamp,
  updated_at           timestamp,
  order_type_color1    varchar(60),
  order_type_color2    varchar(60),
  order_type_color3    varchar(60),
  order_type_icon      varchar(120),
  order_type_image     varchar(120)
);

create table if not exists sys_service_category_cd (
  service_category_code varchar(120) primary key,
  ctg_name             varchar(250) not null,
  ctg_name2            varchar(250),
  ctg_desc             varchar(600),
  turnaround_hh        numeric(4,2),
  turnaround_hh_express numeric(4,2),
  multiplier_express   numeric(4,2),
  is_builtin           boolean not null default false,
  has_fee              boolean not null default false,
  is_mandatory         boolean not null default false,
  is_active            boolean not null default true,
  rec_notes            varchar(200),
  created_at           timestamp default current_timestamp,
  updated_at           timestamp,
  service_category_color1 varchar(60),
  service_category_color2 varchar(60),
  service_category_color3 varchar(60),
  service_category_icon varchar(120),
  service_category_image varchar(120)
);

-- ========== CORE ENTITIES ==========
create table if not exists auth_users (
  id uuid primary key    -- supabase auth.users.id mirror
);

create table if not exists sys_customers_mst (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text,
  disply_name     text,
  name            varchar(255),
  name2           varchar(255),
  phone           varchar(50),
  email           varchar(255),
  type            varchar(20) default 'walk_in',
  address         text,
  area            varchar(100),
  building        varchar(100),
  floor           varchar(50),
  preferences     jsonb default '{}',
  first_tenant_org_id uuid,
  created_at      timestamp default current_timestamp,
  updated_at      timestamp default current_timestamp
);

create table if not exists org_tenants_mst (
  id              uuid primary key default gen_random_uuid(),
  name            varchar(255) not null,
  name2           varchar(255),
  slug            varchar(100) not null,
  email           varchar(255) not null,
  phone           varchar(50)  not null,
  s_cureent_plan  varchar(120) default 'plan_freemium',
  address         text,
  city            varchar(100),
  country         varchar(2)   default 'OM',
  currency        varchar(3)   default 'OMR',
  timezone        varchar(50)  default 'Asia/Muscat',
  language        varchar(5)   default 'en',
  is_active       boolean       default true,
  status          varchar(20)   default 'trial',
  created_at      timestamp     default now(),
  updated_at      timestamp     default current_timestamp,
  unique(slug),
  unique(email)
);

create table if not exists org_subscriptions_mst(
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null,
  plan                 varchar(20
