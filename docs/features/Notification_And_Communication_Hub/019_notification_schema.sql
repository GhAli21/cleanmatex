
-- CMX-PRD-019 Notification & Communication Hub - Enterprise Edition
-- PostgreSQL 16 / Supabase-ready DDL
-- Naming: sys_* for global catalogs, org_* for tenant data.
-- All org_* tables must have RLS enabled in production.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. Global Catalogs
-- ============================================================

create table if not exists public.sys_notification_categories_cd (
  category_code text primary key,
  name text not null,
  name2 text,
  description text,
  display_order int not null default 0,
  is_system boolean not null default true,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.sys_notification_channels_cd (
  channel_code text primary key,
  name text not null,
  name2 text,
  channel_type text not null,
  supports_rich_content boolean not null default false,
  supports_attachments boolean not null default false,
  supports_delivery_receipt boolean not null default false,
  supports_read_receipt boolean not null default false,
  max_body_length int,
  requires_destination boolean not null default true,
  is_paid_channel boolean not null default false,
  display_order int not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_sys_notification_channels_type check (channel_type in ('IN_APP','PUSH','WHATSAPP','SMS','EMAIL','WEB_SOCKET'))
);

create table if not exists public.sys_notification_providers_cd (
  provider_code text primary key,
  provider_name text not null,
  provider_type text not null,
  channel_code text not null references public.sys_notification_channels_cd(channel_code),
  is_default boolean not null default false,
  is_system boolean not null default true,
  is_active boolean not null default true,
  rate_limit_per_minute int,
  rate_limit_per_hour int,
  rate_limit_per_day int,
  supports_webhook boolean not null default false,
  supports_template_sync boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_sys_notification_provider_type check (provider_type in ('FCM','META_WHATSAPP','TWILIO','LOCAL_SMS','SENDGRID','AWS_SES','SMTP','INTERNAL'))
);

create table if not exists public.sys_notification_events_cd (
  event_code text primary key,
  category_code text not null references public.sys_notification_categories_cd(category_code),
  name text not null,
  name2 text,
  description text,
  source_module text not null,
  default_priority text not null default 'NORMAL',
  is_customer_visible boolean not null default true,
  is_transactional boolean not null default true,
  is_marketing boolean not null default false,
  requires_consent boolean not null default false,
  default_channels text[] not null default array['IN_APP'],
  payload_schema jsonb not null default '{}'::jsonb,
  recipient_rules jsonb not null default '{}'::jsonb,
  fallback_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_sys_notification_events_priority check (default_priority in ('LOW','NORMAL','HIGH','URGENT','CRITICAL'))
);

-- ============================================================
-- 2. Templates
-- ============================================================

create table if not exists public.sys_notification_templates (
  template_id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  category_code text not null references public.sys_notification_categories_cd(category_code),
  event_code text references public.sys_notification_events_cd(event_code),
  name text not null,
  name2 text,
  description text,
  is_transactional boolean not null default true,
  is_marketing boolean not null default false,
  requires_consent boolean not null default false,
  default_priority text not null default 'NORMAL',
  is_system boolean not null default true,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_sys_notification_templates_priority check (default_priority in ('LOW','NORMAL','HIGH','URGENT','CRITICAL'))
);

create table if not exists public.sys_notification_template_versions (
  template_version_id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.sys_notification_templates(template_id) on delete cascade,
  version_no int not null,
  change_summary text,
  status text not null default 'DRAFT',
  approved_by uuid,
  approved_at timestamptz,
  is_active_version boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint uq_sys_notification_template_version unique(template_id, version_no),
  constraint chk_template_version_status check (status in ('DRAFT','APPROVED','RETIRED'))
);

create table if not exists public.sys_notification_template_channels (
  template_channel_id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.sys_notification_template_versions(template_version_id) on delete cascade,
  channel_code text not null references public.sys_notification_channels_cd(channel_code),
  lang_code text not null,
  title_template text,
  body_template text not null,
  short_body_template text,
  action_url_template text,
  image_url_template text,
  provider_template_code text,
  provider_template_status text,
  variables_schema jsonb not null default '{}'::jsonb,
  rendering_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint uq_template_channel_lang unique(template_version_id, channel_code, lang_code),
  constraint chk_template_lang check (lang_code in ('en','ar')),
  constraint chk_provider_template_status check (provider_template_status is null or provider_template_status in ('NOT_REQUIRED','DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','PAUSED'))
);

-- ============================================================
-- 3. Tenant Settings and Preferences
-- ============================================================

create table if not exists public.org_notification_settings_cf (
  tenant_org_id uuid primary key,
  default_language text not null default 'en',
  enabled_channels text[] not null default array['IN_APP','PUSH','WHATSAPP'],
  fallback_rules jsonb not null default '{"PUSH":["WHATSAPP","SMS","EMAIL"],"WHATSAPP":["SMS","EMAIL"],"SMS":["EMAIL"]}'::jsonb,
  quiet_hours_jsonb jsonb not null default '{}'::jsonb,
  digest_rules_jsonb jsonb not null default '{}'::jsonb,
  marketing_enabled boolean not null default false,
  require_marketing_consent boolean not null default true,
  allow_customer_channel_choice boolean not null default true,
  sms_monthly_limit int,
  whatsapp_monthly_limit int,
  push_monthly_limit int,
  email_monthly_limit int,
  provider_config_jsonb jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_org_notification_settings_lang check (default_language in ('en','ar'))
);

create table if not exists public.org_notification_preferences (
  preference_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  user_id uuid,
  customer_id uuid,
  staff_user_id uuid,
  recipient_type text not null,
  preferred_language text,
  allow_in_app boolean not null default true,
  allow_push boolean not null default true,
  allow_whatsapp boolean not null default true,
  allow_sms boolean not null default true,
  allow_email boolean not null default true,
  allow_marketing boolean not null default false,
  quiet_hours_jsonb jsonb not null default '{}'::jsonb,
  category_preferences_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_org_notification_preferences_recipient_type check (recipient_type in ('CUSTOMER','STAFF','DRIVER','TENANT_ADMIN','PLATFORM_USER')),
  constraint chk_org_notification_preferences_lang check (preferred_language is null or preferred_language in ('en','ar')),
  constraint chk_org_notification_preferences_one_identity check (
    (customer_id is not null)::int + (staff_user_id is not null)::int + (user_id is not null)::int >= 1
  )
);

create index if not exists idx_org_notification_preferences_tenant_customer on public.org_notification_preferences(tenant_org_id, customer_id);
create index if not exists idx_org_notification_preferences_tenant_staff on public.org_notification_preferences(tenant_org_id, staff_user_id);

-- ============================================================
-- 4. Runtime Events, Outbox, Logs
-- ============================================================

create table if not exists public.org_notification_events (
  event_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  event_code text not null references public.sys_notification_events_cd(event_code),
  source_module text not null,
  source_entity_type text,
  source_entity_id uuid,
  idempotency_key text,
  payload_jsonb jsonb not null,
  status text not null default 'PENDING',
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint uq_org_notification_event_idempotency unique(tenant_org_id, idempotency_key),
  constraint chk_org_notification_events_status check (status in ('PENDING','PROCESSING','PROCESSED','FAILED','IGNORED'))
);

create index if not exists idx_org_notification_events_tenant_status on public.org_notification_events(tenant_org_id, status, created_at desc);
create index if not exists idx_org_notification_events_entity on public.org_notification_events(tenant_org_id, source_entity_type, source_entity_id);

create table if not exists public.org_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  event_id uuid references public.org_notification_events(event_id),
  recipient_type text not null,
  recipient_id uuid,
  user_id uuid,
  customer_id uuid,
  staff_user_id uuid,
  category_code text not null,
  event_code text not null,
  title text,
  body text not null,
  deep_link text,
  payload_jsonb jsonb not null default '{}'::jsonb,
  priority text not null default 'NORMAL',
  status text not null default 'UNREAD',
  pinned_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_org_notifications_priority check (priority in ('LOW','NORMAL','HIGH','URGENT','CRITICAL')),
  constraint chk_org_notifications_status check (status in ('UNREAD','READ','ARCHIVED','DELETED'))
);

create index if not exists idx_org_notifications_recipient on public.org_notifications(tenant_org_id, recipient_type, recipient_id, status, created_at desc);
create index if not exists idx_org_notifications_category on public.org_notifications(tenant_org_id, category_code, created_at desc);

create table if not exists public.org_notification_outbox (
  outbox_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  event_id uuid references public.org_notification_events(event_id),
  notification_id uuid references public.org_notifications(notification_id),
  recipient_type text not null,
  recipient_id uuid,
  channel_code text not null references public.sys_notification_channels_cd(channel_code),
  template_code text not null,
  lang_code text not null,
  destination text,
  title text,
  body text not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  priority text not null default 'NORMAL',
  scheduled_at timestamptz not null default now(),
  status text not null default 'QUEUED',
  retry_count int not null default 0,
  max_retries int not null default 5,
  next_retry_at timestamptz,
  provider_code text references public.sys_notification_providers_cd(provider_code),
  provider_message_id text,
  provider_response_jsonb jsonb,
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint chk_org_notification_outbox_priority check (priority in ('LOW','NORMAL','HIGH','URGENT','CRITICAL')),
  constraint chk_org_notification_outbox_status check (status in ('QUEUED','PROCESSING','SENT','DELIVERED','READ','FAILED_TEMPORARY','RETRYING','FAILED_PERMANENT','CANCELLED','SKIPPED')),
  constraint chk_org_notification_outbox_lang check (lang_code in ('en','ar'))
);

create index if not exists idx_org_notification_outbox_dispatch on public.org_notification_outbox(status, scheduled_at, priority);
create index if not exists idx_org_notification_outbox_tenant_status on public.org_notification_outbox(tenant_org_id, status, created_at desc);
create index if not exists idx_org_notification_outbox_provider_msg on public.org_notification_outbox(provider_code, provider_message_id);

create table if not exists public.org_notification_delivery_log (
  delivery_log_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  outbox_id uuid references public.org_notification_outbox(outbox_id),
  provider_code text,
  channel_code text not null,
  attempt_no int not null,
  status text not null,
  request_payload jsonb,
  response_payload jsonb,
  error_code text,
  error_message text,
  cost_amount numeric(18,6),
  cost_currency text,
  latency_ms int,
  created_at timestamptz not null default now(),
  constraint chk_org_notification_delivery_log_status check (status in ('ATTEMPTED','SENT','DELIVERED','READ','FAILED','BOUNCED','REJECTED','SKIPPED'))
);

create index if not exists idx_org_notification_delivery_log_outbox on public.org_notification_delivery_log(outbox_id, attempt_no);
create index if not exists idx_org_notification_delivery_log_tenant on public.org_notification_delivery_log(tenant_org_id, created_at desc);

-- ============================================================
-- 5. Campaigns and Usage
-- ============================================================

create table if not exists public.org_notification_campaigns (
  campaign_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  campaign_code text not null,
  name text not null,
  name2 text,
  description text,
  campaign_type text not null default 'MARKETING',
  status text not null default 'DRAFT',
  template_code text,
  segment_definition_jsonb jsonb not null default '{}'::jsonb,
  channels text[] not null default array['PUSH'],
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint uq_org_notification_campaign_code unique(tenant_org_id, campaign_code),
  constraint chk_org_notification_campaign_status check (status in ('DRAFT','PENDING_APPROVAL','APPROVED','SCHEDULED','RUNNING','PAUSED','COMPLETED','FAILED','CANCELLED')),
  constraint chk_org_notification_campaign_type check (campaign_type in ('MARKETING','OPERATIONAL_DIGEST','SYSTEM','LOYALTY','WINBACK'))
);

create table if not exists public.org_notification_campaign_recipients (
  campaign_recipient_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  campaign_id uuid not null references public.org_notification_campaigns(campaign_id) on delete cascade,
  recipient_type text not null,
  recipient_id uuid not null,
  status text not null default 'PENDING',
  outbox_id uuid references public.org_notification_outbox(outbox_id),
  opened_at timestamptz,
  clicked_at timestamptz,
  converted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint uq_campaign_recipient unique(campaign_id, recipient_type, recipient_id),
  constraint chk_campaign_recipient_status check (status in ('PENDING','QUEUED','SENT','OPENED','CLICKED','CONVERTED','FAILED','SKIPPED','UNSUBSCRIBED'))
);

create table if not exists public.org_notification_usage_daily (
  tenant_org_id uuid not null,
  usage_date date not null,
  channel_code text not null,
  provider_code text,
  sent_count int not null default 0,
  delivered_count int not null default 0,
  failed_count int not null default 0,
  cost_amount numeric(18,6) not null default 0,
  cost_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (tenant_org_id, usage_date, channel_code, coalesce(provider_code,''))
);

-- The primary key above with coalesce is not valid PostgreSQL syntax for PK. Use this unique index instead.
alter table if exists public.org_notification_usage_daily drop constraint if exists org_notification_usage_daily_pkey;
create unique index if not exists uq_org_notification_usage_daily on public.org_notification_usage_daily(tenant_org_id, usage_date, channel_code, coalesce(provider_code,''));

create table if not exists public.org_notification_audit (
  audit_id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid,
  actor_user_id uuid,
  action_code text not null,
  entity_type text not null,
  entity_id uuid,
  before_jsonb jsonb,
  after_jsonb jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. RLS - enable here; policies should be aligned with your existing tenant context function.
-- Replace app.current_tenant_id with the exact current_setting key used in CleanMateX.
-- ============================================================

alter table public.org_notification_settings_cf enable row level security;
alter table public.org_notification_preferences enable row level security;
alter table public.org_notification_events enable row level security;
alter table public.org_notifications enable row level security;
alter table public.org_notification_outbox enable row level security;
alter table public.org_notification_delivery_log enable row level security;
alter table public.org_notification_campaigns enable row level security;
alter table public.org_notification_campaign_recipients enable row level security;
alter table public.org_notification_usage_daily enable row level security;
alter table public.org_notification_audit enable row level security;

-- Example RLS policy template:
-- create policy tenant_isolation_org_notification_events on public.org_notification_events
--   using (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- 7. Seed core channels
-- ============================================================

insert into public.sys_notification_channels_cd(channel_code, name, name2, channel_type, supports_rich_content, supports_attachments, supports_delivery_receipt, supports_read_receipt, is_paid_channel, display_order)
values
('IN_APP','In-App','داخل التطبيق','IN_APP',true,false,true,true,false,10),
('PUSH','Push Notification','إشعار فوري','PUSH',true,false,true,true,false,20),
('WHATSAPP','WhatsApp','واتساب','WHATSAPP',true,true,true,true,true,30),
('SMS','SMS','رسالة نصية','SMS',false,false,true,false,true,40),
('EMAIL','Email','البريد الإلكتروني','EMAIL',true,true,true,true,true,50),
('WEB_SOCKET','WebSocket Live Alert','تنبيه مباشر','WEB_SOCKET',true,false,true,false,false,60)
on conflict(channel_code) do update set name = excluded.name, name2 = excluded.name2, updated_at = now();

-- ============================================================
-- 8. Seed categories and event catalog
-- ============================================================
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('ASSEMBLY', 'Assembly', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('CUSTOMER', 'Customer', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('DELIVERY', 'Delivery', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('GIFTCARD', 'Giftcard', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('INVENTORY', 'Inventory', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('INVOICE', 'Invoice', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('LOYALTY', 'Loyalty', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('MACHINE', 'Machine', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('MARKETING', 'Marketing', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('MEMBERSHIP', 'Membership', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('ORDER', 'Order', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('ORDER_ITEM', 'Order Item', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('PACKING', 'Packing', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('PAYMENT', 'Payment', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('PICKUP', 'Pickup', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('PLAN_LIMIT', 'Plan Limit', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('PREPARATION', 'Preparation', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('PROCESSING', 'Processing', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('QA', 'Qa', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('REFUND', 'Refund', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('SECURITY', 'Security', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('STAFF', 'Staff', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('STATEMENT', 'Statement', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('SUBSCRIPTION', 'Subscription', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('SYSTEM', 'System', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('WALLET', 'Wallet', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_categories_cd(category_code, name, name2, display_order) values ('WORKFLOW', 'Workflow', null, 0) on conflict(category_code) do nothing;
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.created', 'ORDER', 'Order created', 'Order record is created from POS, app, marketplace, WhatsApp, or API.', 'order', 'NORMAL', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.quick_drop.created', 'ORDER', 'Quick drop order created', 'Quick drop bag is accepted before full itemization.', 'order', 'NORMAL', array['IN_APP','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.preparation.required', 'ORDER', 'Preparation required', 'Quick drop or incomplete order requires itemization.', 'order', 'HIGH', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.prepared', 'ORDER', 'Order prepared', 'Items are itemized and order is ready for processing.', 'order', 'NORMAL', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.processing.started', 'ORDER', 'Processing started', 'Order enters processing workflow.', 'order', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.ready', 'ORDER', 'Order ready', 'Order is ready for pickup or delivery after QA and packing gates.', 'order', 'HIGH', array['IN_APP','PUSH','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.delayed', 'ORDER', 'Order delayed', 'Ready-by time is at risk or missed.', 'order', 'HIGH', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.cancelled', 'ORDER', 'Order cancelled', 'Order is cancelled by staff, customer, or policy.', 'order', 'HIGH', array['IN_APP','PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.closed', 'ORDER', 'Order closed', 'Order is financially and operationally closed.', 'order', 'NORMAL', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.priority.changed', 'ORDER', 'Order priority changed', 'Priority is changed by authorized user.', 'order', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.split.created', 'ORDER', 'Split order created', 'Parent order is split into child/sub-order.', 'order', 'HIGH', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.issue.created', 'ORDER', 'Order issue created', 'Issue-to-solve is created before or after delivery.', 'order', 'HIGH', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.issue.resolved', 'ORDER', 'Order issue resolved', 'Issue-to-solve is resolved.', 'order', 'NORMAL', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.item.added', 'ORDER_ITEM', 'Order item added', 'Item is added to order during intake or preparation.', 'order_item', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.item.removed', 'ORDER_ITEM', 'Order item removed', 'Item is removed from order with audit.', 'order_item', 'NORMAL', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.item.missing', 'ORDER_ITEM', 'Order item missing', 'Expected scanned item is missing during assembly or QA.', 'order_item', 'URGENT', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.item.damaged', 'ORDER_ITEM', 'Order item damaged', 'Damage is recorded for a garment or piece.', 'order_item', 'URGENT', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('order.item.rework.required', 'ORDER_ITEM', 'Item rework required', 'QA rejects item and sends it back for reprocessing.', 'order_item', 'HIGH', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('preparation.task.created', 'PREPARATION', 'Preparation task created', 'Task is created for quick drop itemization.', 'preparation', 'HIGH', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('preparation.task.completed', 'PREPARATION', 'Preparation task completed', 'All required preparation is done.', 'preparation', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('processing.step.completed', 'PROCESSING', 'Processing step completed', 'Sorting, pretreatment, washing, drying, or finishing step is completed.', 'processing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('assembly.started', 'ASSEMBLY', 'Assembly started', 'Assembly task starts for expected pieces.', 'assembly', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('assembly.exception', 'ASSEMBLY', 'Assembly exception', 'Missing, wrong, damaged, or extra item is detected.', 'assembly', 'URGENT', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('assembly.completed', 'ASSEMBLY', 'Assembly completed', 'All expected items are assembled.', 'assembly', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('qa.started', 'QA', 'QA started', 'Quality assurance inspection is started.', 'qa', 'NORMAL', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('qa.passed', 'QA', 'QA passed', 'Order or item passed quality assurance.', 'qa', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('qa.failed', 'QA', 'QA failed', 'Order or item failed QA.', 'qa', 'HIGH', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('packing.completed', 'PACKING', 'Packing completed', 'Packing list and packaging profile are completed.', 'packing', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('pickup.scheduled', 'PICKUP', 'Pickup scheduled', 'Customer schedules pickup.', 'pickup', 'NORMAL', array['IN_APP','PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('pickup.reminder', 'PICKUP', 'Pickup reminder', 'Reminder before pickup time.', 'pickup', 'NORMAL', array['PUSH','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('pickup.driver_assigned', 'PICKUP', 'Pickup driver assigned', 'Driver is assigned for pickup.', 'pickup', 'NORMAL', array['PUSH','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('pickup.completed', 'PICKUP', 'Pickup completed', 'Pickup proof is captured.', 'pickup', 'NORMAL', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.assigned', 'DELIVERY', 'Delivery assigned', 'Driver receives delivery task.', 'delivery', 'HIGH', array['PUSH','IN_APP','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.out_for_delivery', 'DELIVERY', 'Out for delivery', 'Order leaves branch or plant.', 'delivery', 'HIGH', array['PUSH','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.otp_generated', 'DELIVERY', 'Delivery OTP generated', 'OTP is generated for proof of delivery.', 'delivery', 'URGENT', array['PUSH','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.arrived', 'DELIVERY', 'Driver arrived', 'Driver is at customer location.', 'delivery', 'URGENT', array['PUSH','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.failed', 'DELIVERY', 'Delivery failed', 'Delivery attempt failed due to absence, wrong address, or other issue.', 'delivery', 'HIGH', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.delivered', 'DELIVERY', 'Delivered', 'Delivery proof is captured.', 'delivery', 'NORMAL', array['PUSH','WHATSAPP','EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('delivery.collected', 'DELIVERY', 'Collected', 'Customer collected order from branch.', 'delivery', 'NORMAL', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('payment.requested', 'PAYMENT', 'Payment requested', 'Payment request link or amount is issued.', 'payment', 'HIGH', array['PUSH','WHATSAPP','SMS','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('payment.received', 'PAYMENT', 'Payment received', 'Payment or voucher is successfully recorded.', 'payment', 'NORMAL', array['PUSH','WHATSAPP','EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('payment.failed', 'PAYMENT', 'Payment failed', 'Gateway, card, wallet, or manual payment failed.', 'payment', 'HIGH', array['PUSH','WHATSAPP','SMS','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('payment.partial_received', 'PAYMENT', 'Partial payment received', 'Partial payment is recorded.', 'payment', 'NORMAL', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('payment.collection_due', 'PAYMENT', 'Payment collection due', 'Pay-on-collection amount is outstanding.', 'payment', 'HIGH', array['PUSH','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('refund.requested', 'REFUND', 'Refund requested', 'Refund request is created.', 'refund', 'HIGH', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('refund.approved', 'REFUND', 'Refund approved', 'Refund is approved by authorized role.', 'refund', 'HIGH', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('refund.rejected', 'REFUND', 'Refund rejected', 'Refund is rejected with reason.', 'refund', 'HIGH', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('refund.processed', 'REFUND', 'Refund processed', 'Refund is sent to gateway, wallet, cash, or voucher.', 'refund', 'NORMAL', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('invoice.issued', 'INVOICE', 'Invoice issued', 'Tax invoice or AR invoice is issued.', 'invoice', 'NORMAL', array['PUSH','WHATSAPP','EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('invoice.cancelled', 'INVOICE', 'Invoice cancelled', 'Invoice is cancelled/voided according to policy.', 'invoice', 'HIGH', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('credit_note.issued', 'INVOICE', 'Credit note issued', 'Credit note is issued for reversal/refund.', 'invoice', 'NORMAL', array['EMAIL','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('statement.generated', 'STATEMENT', 'Statement generated', 'B2B or customer statement is generated.', 'statement', 'NORMAL', array['EMAIL','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('statement.overdue', 'STATEMENT', 'Statement overdue', 'Statement due date is passed.', 'statement', 'HIGH', array['EMAIL','WHATSAPP','SMS']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('customer.stub.created', 'CUSTOMER', 'Stub customer created', 'POS creates minimal customer profile.', 'customer', 'NORMAL', array['WHATSAPP','SMS','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('customer.upgraded', 'CUSTOMER', 'Customer upgraded', 'Stub becomes full app profile after OTP.', 'customer', 'NORMAL', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('customer.profile.updated', 'CUSTOMER', 'Customer profile updated', 'Customer updates profile, address, or preference.', 'customer', 'LOW', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('loyalty.points_added', 'LOYALTY', 'Loyalty points added', 'Points are earned after eligible order/payment.', 'loyalty', 'LOW', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('loyalty.points_redeemed', 'LOYALTY', 'Loyalty points redeemed', 'Customer uses points.', 'loyalty', 'NORMAL', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('loyalty.tier_changed', 'LOYALTY', 'Loyalty tier changed', 'Customer moves to new loyalty tier.', 'loyalty', 'NORMAL', array['PUSH','WHATSAPP','EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('wallet.topup', 'WALLET', 'Wallet top-up', 'Wallet receives balance.', 'wallet', 'NORMAL', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('wallet.debited', 'WALLET', 'Wallet debited', 'Wallet is used to pay or adjust.', 'wallet', 'NORMAL', array['PUSH','WHATSAPP','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('giftcard.issued', 'GIFTCARD', 'Gift card issued', 'Gift card code is generated or sold.', 'giftcard', 'NORMAL', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('giftcard.activated', 'GIFTCARD', 'Gift card activated', 'Gift card becomes usable.', 'giftcard', 'NORMAL', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('membership.started', 'MEMBERSHIP', 'Membership started', 'Customer membership/subscription starts.', 'membership', 'NORMAL', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('membership.renewal_due', 'MEMBERSHIP', 'Membership renewal due', 'Renewal date approaches.', 'membership', 'NORMAL', array['PUSH','WHATSAPP','SMS','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('membership.expired', 'MEMBERSHIP', 'Membership expired', 'Membership benefits expire.', 'membership', 'NORMAL', array['PUSH','WHATSAPP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('staff.task.assigned', 'STAFF', 'Staff task assigned', 'Task is assigned to role/user.', 'staff', 'NORMAL', array['PUSH','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('staff.shift.started', 'STAFF', 'Shift started', 'Staff clock-in or shift starts.', 'staff', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('staff.attendance.exception', 'STAFF', 'Attendance exception', 'Late, missing check-out, or absence detected.', 'staff', 'NORMAL', array['IN_APP','PUSH','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('inventory.low_stock', 'INVENTORY', 'Low stock', 'Inventory item reaches threshold.', 'inventory', 'HIGH', array['IN_APP','PUSH','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('inventory.reorder_created', 'INVENTORY', 'Reorder created', 'Purchase request or reorder suggestion is created.', 'inventory', 'NORMAL', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('inventory.stockout', 'INVENTORY', 'Stockout', 'Inventory item is unavailable.', 'inventory', 'URGENT', array['IN_APP','PUSH','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('machine.maintenance_due', 'MACHINE', 'Maintenance due', 'Machine maintenance threshold reached.', 'machine', 'HIGH', array['IN_APP','PUSH','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('machine.downtime_started', 'MACHINE', 'Downtime started', 'Machine is marked down.', 'machine', 'HIGH', array['IN_APP','PUSH','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('machine.downtime_resolved', 'MACHINE', 'Downtime resolved', 'Machine is active again.', 'machine', 'NORMAL', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.created', 'MARKETING', 'Campaign created', 'Marketing campaign draft is created.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.approved', 'MARKETING', 'Campaign approved', 'Campaign is approved and ready to send.', 'marketing', 'NORMAL', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.launched', 'MARKETING', 'Campaign launched', 'Campaign run starts.', 'marketing', 'NORMAL', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.completed', 'MARKETING', 'Campaign completed', 'Campaign run is completed.', 'marketing', 'NORMAL', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.failed', 'MARKETING', 'Campaign failed', 'Campaign cannot continue due to provider, quota, or validation issue.', 'marketing', 'HIGH', array['IN_APP','EMAIL']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('subscription.trial_ending', 'SUBSCRIPTION', 'Trial ending', 'Tenant trial period is near end.', 'subscription', 'NORMAL', array['EMAIL','IN_APP','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('subscription.renewal_due', 'SUBSCRIPTION', 'Subscription renewal due', 'Tenant subscription renewal approaches.', 'subscription', 'NORMAL', array['EMAIL','IN_APP','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('subscription.payment_failed', 'SUBSCRIPTION', 'Subscription payment failed', 'Tenant subscription payment fails.', 'subscription', 'HIGH', array['EMAIL','IN_APP','WHATSAPP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('plan.limit_reached', 'PLAN_LIMIT', 'Plan limit reached', 'Tenant reaches plan quota.', 'plan_limit', 'HIGH', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('plan.limit_warning', 'PLAN_LIMIT', 'Plan limit warning', 'Tenant is near quota limit.', 'plan_limit', 'NORMAL', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('security.login.detected', 'SECURITY', 'Login detected', 'New login or unusual login is detected.', 'security', 'NORMAL', array['EMAIL','IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('security.role.changed', 'SECURITY', 'Role changed', 'User role or permission changes.', 'security', 'HIGH', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('security.password.changed', 'SECURITY', 'Password changed', 'Password or credentials changed.', 'security', 'HIGH', array['EMAIL','PUSH','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('security.suspicious_activity', 'SECURITY', 'Suspicious activity', 'Risky action detected.', 'security', 'CRITICAL', array['EMAIL','IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('system.maintenance.scheduled', 'SYSTEM', 'Maintenance scheduled', 'Scheduled maintenance is announced.', 'system', 'NORMAL', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('system.maintenance.started', 'SYSTEM', 'Maintenance started', 'Maintenance window starts.', 'system', 'HIGH', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('system.maintenance.completed', 'SYSTEM', 'Maintenance completed', 'Maintenance completed.', 'system', 'NORMAL', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('provider.whatsapp.degraded', 'SYSTEM', 'WhatsApp provider degraded', 'WhatsApp provider failure or degraded performance.', 'system', 'HIGH', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('provider.sms.degraded', 'SYSTEM', 'SMS provider degraded', 'SMS provider failure or degraded performance.', 'system', 'HIGH', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('queue.backlog.high', 'SYSTEM', 'Queue backlog high', 'Notification queue backlog crosses threshold.', 'system', 'CRITICAL', array['EMAIL','IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.intake.entered', 'WORKFLOW', 'Workflow stage intake entered', 'Order or item enters intake stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.preparing.entered', 'WORKFLOW', 'Workflow stage preparing entered', 'Order or item enters preparing stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.sorting.entered', 'WORKFLOW', 'Workflow stage sorting entered', 'Order or item enters sorting stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.pretreatment.entered', 'WORKFLOW', 'Workflow stage pretreatment entered', 'Order or item enters pretreatment stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.washing.entered', 'WORKFLOW', 'Workflow stage washing entered', 'Order or item enters washing stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.drying.entered', 'WORKFLOW', 'Workflow stage drying entered', 'Order or item enters drying stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.finishing.entered', 'WORKFLOW', 'Workflow stage finishing entered', 'Order or item enters finishing stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.assembly.entered', 'WORKFLOW', 'Workflow stage assembly entered', 'Order or item enters assembly stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.qa.entered', 'WORKFLOW', 'Workflow stage qa entered', 'Order or item enters qa stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.packing.entered', 'WORKFLOW', 'Workflow stage packing entered', 'Order or item enters packing stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.ready.entered', 'WORKFLOW', 'Workflow stage ready entered', 'Order or item enters ready stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.out_for_delivery.entered', 'WORKFLOW', 'Workflow stage out_for_delivery entered', 'Order or item enters out_for_delivery stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.delivered.entered', 'WORKFLOW', 'Workflow stage delivered entered', 'Order or item enters delivered stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('workflow.stage.closed.entered', 'WORKFLOW', 'Workflow stage closed entered', 'Order or item enters closed stage.', 'workflow', 'NORMAL', array['IN_APP','PUSH']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.recipient.opened', 'MARKETING', 'Campaign recipient opened', 'Campaign recipient opened event is received from provider or app.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.recipient.clicked', 'MARKETING', 'Campaign recipient clicked', 'Campaign recipient clicked event is received from provider or app.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.recipient.bounced', 'MARKETING', 'Campaign recipient bounced', 'Campaign recipient bounced event is received from provider or app.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.recipient.unsubscribed', 'MARKETING', 'Campaign recipient unsubscribed', 'Campaign recipient unsubscribed event is received from provider or app.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.recipient.complained', 'MARKETING', 'Campaign recipient complained', 'Campaign recipient complained event is received from provider or app.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();
insert into public.sys_notification_events_cd(event_code, category_code, name, description, source_module, default_priority, default_channels) values ('campaign.recipient.converted', 'MARKETING', 'Campaign recipient converted', 'Campaign recipient converted event is received from provider or app.', 'marketing', 'LOW', array['IN_APP']) on conflict(event_code) do update set name=excluded.name, description=excluded.description, default_channels=excluded.default_channels, updated_at=now();