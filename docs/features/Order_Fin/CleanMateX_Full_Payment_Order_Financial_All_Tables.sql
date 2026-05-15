-- =============================================================================
-- CleanMateX Full Payment + Order Financial Architecture SQL Pack
-- Version: 1.0
-- Target: PostgreSQL / Supabase
-- Scope:
--   HQ payment setup, tenant payment configuration, cash drawer,
--   order financial facts, stored-value ledgers, promotions, tax,
--   product piece templates, outbox, idempotency, reconciliation.
--
-- Migration style:
--   Additive and compatibility-first. Existing tables are preserved.
--   Existing tables are hardened with ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
--
-- IMPORTANT:
--   Run in staging first. Review FK sections against your exact schema.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

-- =============================================================================
-- 1. HQ PAYMENT TABLE HARDENING
-- Existing tables retained:
--   sys_payment_type_cd      = payment timing / settlement agreement
--   sys_payment_status_cd    = payment transaction status
--   sys_payment_method_cd    = tender/payment method
--   sys_payment_gateway_cd   = gateway/provider catalog
-- =============================================================================

-- 1.1 Harden sys_payment_method_cd with classification columns.
alter table if exists public.sys_payment_method_cd
  add column if not exists payment_nature varchar(50) default 'REAL_PAYMENT',
  add column if not exists method_category varchar(50),
  add column if not exists is_deprecated boolean not null default false,
  add column if not exists replacement_code varchar(100),
  add column if not exists gateway_code varchar(80);

do $$
begin
  if to_regclass('public.sys_payment_method_cd') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'chk_sys_payment_method_payment_nature'
         and conrelid = 'public.sys_payment_method_cd'::regclass
     )
  then
    alter table public.sys_payment_method_cd
      add constraint chk_sys_payment_method_payment_nature
      check (
        payment_nature in (
          'REAL_PAYMENT',
          'CREDIT_APPLICATION',
          'AR_ALLOCATION',
          'DEFERRED_SETTLEMENT',
          'PROVIDER',
          'INTERNAL_ADJUSTMENT'
        )
      );
  end if;
end $$;

-- 1.2 Classify existing payment method rows.
update public.sys_payment_method_cd
set payment_nature = 'REAL_PAYMENT', method_category = 'CASH', is_deprecated = false,
    replacement_code = null, gateway_code = null
where payment_method_code = 'CASH';

update public.sys_payment_method_cd
set payment_nature = 'REAL_PAYMENT', method_category = 'CARD', is_deprecated = false,
    replacement_code = null, gateway_code = null
where payment_method_code = 'CARD';

update public.sys_payment_method_cd
set payment_nature = 'REAL_PAYMENT', method_category = 'CHECK', is_deprecated = false,
    replacement_code = null, gateway_code = null
where payment_method_code = 'CHECK';

update public.sys_payment_method_cd
set payment_nature = 'REAL_PAYMENT', method_category = 'BANK', is_deprecated = false,
    replacement_code = null, gateway_code = null
where payment_method_code = 'BANK_TRANSFER';

update public.sys_payment_method_cd
set payment_nature = 'REAL_PAYMENT', method_category = 'MOBILE', is_deprecated = false,
    replacement_code = null, gateway_code = null
where payment_method_code = 'MOBILE_PAYMENT';

update public.sys_payment_method_cd
set payment_nature = 'DEFERRED_SETTLEMENT', method_category = 'TIMING', is_deprecated = true,
    replacement_code = 'sys_payment_type_cd.PAY_ON_COLLECTION', gateway_code = null
where payment_method_code = 'PAY_ON_COLLECTION';

update public.sys_payment_method_cd
set payment_nature = 'AR_ALLOCATION', method_category = 'INVOICE', is_deprecated = true,
    replacement_code = 'sys_payment_type_cd.CREDIT_INVOICE', gateway_code = null
where payment_method_code = 'INVOICE';

update public.sys_payment_method_cd
set payment_nature = 'PROVIDER', method_category = 'GATEWAY_PROVIDER', is_deprecated = true,
    replacement_code = 'sys_payment_gateway_cd.HYPERPAY', gateway_code = 'HYPERPAY'
where payment_method_code = 'HYPERPAY';

update public.sys_payment_method_cd
set payment_nature = 'PROVIDER', method_category = 'GATEWAY_PROVIDER', is_deprecated = true,
    replacement_code = 'sys_payment_gateway_cd.PAYTABS', gateway_code = 'PAYTABS'
where payment_method_code = 'PAYTABS';

update public.sys_payment_method_cd
set payment_nature = 'PROVIDER', method_category = 'GATEWAY_PROVIDER', is_deprecated = true,
    replacement_code = 'sys_payment_gateway_cd.STRIPE', gateway_code = 'STRIPE'
where payment_method_code = 'STRIPE';

-- 1.3 Add clean generic gateway payment method.
insert into public.sys_payment_method_cd (
  payment_method_code, payment_method_name, payment_method_name2,
  is_enabled, is_active, rec_notes, payment_method_color1, payment_method_icon,
  payment_nature, method_category, is_deprecated, rec_status
)
values (
  'PAYMENT_GATEWAY', 'Payment Gateway', 'بوابة دفع',
  true, true,
  'Online payment gateway method; provider is stored separately in sys_payment_gateway_cd.',
  '#6366f1', 'credit-card', 'REAL_PAYMENT', 'GATEWAY', false, 1
)
on conflict (payment_method_code) do update set
  payment_method_name = excluded.payment_method_name,
  payment_method_name2 = excluded.payment_method_name2,
  rec_notes = excluded.rec_notes,
  payment_nature = excluded.payment_nature,
  method_category = excluded.method_category,
  is_deprecated = excluded.is_deprecated;

-- 1.4 Card brands.
create table if not exists public.sys_card_brand_cd (
  code varchar(50) primary key,
  name varchar(250) not null,
  name2 varchar(250),
  description text,
  description2 text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint chk_sys_card_brand_rec_status check (rec_status in (0, 1, 2))
);

insert into public.sys_card_brand_cd (code, name, name2, display_order)
values
('VISA', 'Visa', 'فيزا', 1),
('MASTERCARD', 'Mastercard', 'ماستركارد', 2),
('AMEX', 'American Express', 'أمريكان إكسبريس', 3),
('MADA', 'Mada', 'مدى', 4),
('OMANNET', 'OmanNet', 'عمان نت', 5),
('APPLE_PAY', 'Apple Pay', 'Apple Pay', 6),
('GOOGLE_PAY', 'Google Pay', 'Google Pay', 7),
('UNKNOWN', 'Unknown', 'غير معروف', 999)
on conflict (code) do update set
  name = excluded.name,
  name2 = excluded.name2,
  display_order = excluded.display_order;

-- 1.5 Cash drawer session statuses.
create table if not exists public.sys_cash_drawer_session_status_cd (
  code varchar(50) primary key,
  name varchar(250) not null,
  name2 varchar(250),
  description text,
  description2 text,
  is_final boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint chk_sys_cash_drawer_session_status_rec_status check (rec_status in (0, 1, 2))
);

insert into public.sys_cash_drawer_session_status_cd
(code, name, name2, is_final, display_order)
values
('OPEN', 'Open', 'مفتوحة', false, 1),
('CLOSED', 'Closed', 'مغلقة', true, 2),
('FORCE_CLOSED', 'Force Closed', 'مغلقة إجبارياً', true, 3),
('CANCELLED', 'Cancelled', 'ملغاة', true, 4)
on conflict (code) do update set
  name = excluded.name,
  name2 = excluded.name2,
  is_final = excluded.is_final,
  display_order = excluded.display_order;

-- 1.6 Cash drawer movement types.
create table if not exists public.sys_cash_drawer_movement_type_cd (
  code varchar(50) primary key,
  name varchar(250) not null,
  name2 varchar(250),
  description text,
  description2 text,
  default_direction varchar(10) not null,
  affects_expected_cash boolean not null default true,
  display_order integer not null default 0,
  is_active boolean not null default true,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint chk_sys_cash_drawer_movement_type_direction check (default_direction in ('IN', 'OUT', 'NONE')),
  constraint chk_sys_cash_drawer_movement_type_rec_status check (rec_status in (0, 1, 2))
);

insert into public.sys_cash_drawer_movement_type_cd
(code, name, name2, default_direction, affects_expected_cash, display_order)
values
('OPENING_FLOAT', 'Opening Float', 'رصيد افتتاحي', 'IN', true, 1),
('CASH_SALE', 'Cash Sale', 'بيع نقدي', 'IN', true, 2),
('CASH_REFUND', 'Cash Refund', 'استرداد نقدي', 'OUT', true, 3),
('CASH_IN', 'Cash In', 'إدخال نقدي', 'IN', true, 4),
('CASH_OUT', 'Cash Out', 'إخراج نقدي', 'OUT', true, 5),
('CASH_DROP', 'Cash Drop', 'توريد نقدي', 'OUT', true, 6),
('CLOSING_COUNT', 'Closing Count', 'جرد الإغلاق', 'NONE', false, 7),
('SHORTAGE', 'Shortage', 'عجز', 'NONE', false, 8),
('OVERAGE', 'Overage', 'زيادة', 'NONE', false, 9),
('ADJUSTMENT', 'Adjustment', 'تسوية', 'NONE', false, 10)
on conflict (code) do update set
  name = excluded.name,
  name2 = excluded.name2,
  default_direction = excluded.default_direction,
  affects_expected_cash = excluded.affects_expected_cash,
  display_order = excluded.display_order;

-- =============================================================================
-- 2. CLIENT/TENANT PAYMENT CONFIGURATION
-- =============================================================================

create table if not exists public.org_payment_methods_cf (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  payment_method_code varchar(50) not null,
  gateway_code varchar(80),
  display_name varchar(250) not null,
  display_name2 varchar(250),
  description text,
  description2 text,
  payment_nature varchar(50) not null default 'REAL_PAYMENT',
  is_enabled boolean not null default true,
  allowed_in_pos boolean not null default true,
  allowed_in_customer_app boolean not null default false,
  allowed_in_staff_app boolean not null default true,
  allowed_in_admin_app boolean not null default true,
  allowed_for_pay_now boolean not null default true,
  allowed_for_pay_on_collection boolean not null default true,
  allowed_for_invoice_payment boolean not null default true,
  allowed_for_refund boolean not null default true,
  supports_partial_payment boolean not null default true,
  supports_overpayment boolean not null default false,
  supports_change_return boolean not null default false,
  requires_reference boolean not null default false,
  requires_approval boolean not null default false,
  min_amount DECIMAL(19,4),
  max_amount DECIMAL(19,4),
  currency_code char(3),
  fee_type varchar(30) not null default 'NONE',
  fee_amount DECIMAL(19,4) not null default 0,
  fee_rate numeric(9,4) not null default 0,
  settlement_account_hint text,
  clearing_account_hint text,
  gateway_config jsonb not null default '{}'::jsonb,
  ui_config jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint chk_org_payment_methods_cf_payment_nature
    check (payment_nature in ('REAL_PAYMENT','CREDIT_APPLICATION','AR_ALLOCATION','DEFERRED_SETTLEMENT','INTERNAL_ADJUSTMENT')),
  constraint chk_org_payment_methods_cf_fee_type check (fee_type in ('NONE', 'FIXED', 'PERCENTAGE')),
  constraint chk_org_payment_methods_cf_amounts check (
    (min_amount is null or min_amount >= 0)
    and (max_amount is null or max_amount >= 0)
    and (max_amount is null or min_amount is null or max_amount >= min_amount)
  ),
  constraint chk_org_payment_methods_cf_fees check (fee_amount >= 0 and fee_rate >= 0),
  constraint chk_org_payment_methods_cf_rec_status check (rec_status in (0, 1, 2))
);

create unique index if not exists uq_org_payment_methods_cf_method_gateway
on public.org_payment_methods_cf (tenant_org_id, payment_method_code, coalesce(gateway_code, ''));
create index if not exists idx_org_payment_methods_cf_tenant_active
on public.org_payment_methods_cf (tenant_org_id, rec_status, is_enabled, display_order);

create table if not exists public.org_branch_payment_methods_cf (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid not null,
  org_payment_method_id uuid not null references public.org_payment_methods_cf(id) on delete cascade,
  is_enabled boolean not null default true,
  allowed_in_pos boolean,
  allowed_in_customer_app boolean,
  allowed_in_staff_app boolean,
  allowed_for_pay_now boolean,
  allowed_for_pay_on_collection boolean,
  allowed_for_invoice_payment boolean,
  allowed_for_refund boolean,
  cash_drawer_required boolean not null default false,
  terminal_required boolean not null default false,
  min_amount DECIMAL(19,4),
  max_amount DECIMAL(19,4),
  branch_gateway_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_branch_payment_methods_cf unique (tenant_org_id, branch_id, org_payment_method_id),
  constraint chk_org_branch_payment_methods_amounts check (
    (min_amount is null or min_amount >= 0)
    and (max_amount is null or max_amount >= 0)
    and (max_amount is null or min_amount is null or max_amount >= min_amount)
  ),
  constraint chk_org_branch_payment_methods_rec_status check (rec_status in (0, 1, 2))
);

create index if not exists idx_org_branch_payment_methods_branch
on public.org_branch_payment_methods_cf (tenant_org_id, branch_id, rec_status, is_enabled);

create table if not exists public.org_payment_terminals_cf (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  terminal_code varchar(80) not null,
  terminal_name varchar(250) not null,
  terminal_name2 varchar(250),
  terminal_type varchar(50) not null,
  gateway_code varchar(80),
  serial_no varchar(120),
  merchant_id varchar(120),
  terminal_external_id varchar(120),
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_payment_terminals_cf_code unique (tenant_org_id, terminal_code),
  constraint chk_org_payment_terminals_type check (terminal_type in ('POS_CARD_TERMINAL','CASH_DRAWER','ONLINE_GATEWAY','BANK_DEVICE','OTHER')),
  constraint chk_org_payment_terminals_rec_status check (rec_status in (0, 1, 2))
);

create index if not exists idx_org_payment_terminals_branch
on public.org_payment_terminals_cf (tenant_org_id, branch_id, rec_status, is_enabled);

-- =============================================================================
-- 3. CASH DRAWER
-- =============================================================================

create table if not exists public.org_cash_drawers_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid not null,
  drawer_code varchar(80) not null,
  drawer_name varchar(250) not null,
  drawer_name2 varchar(250),
  drawer_type varchar(50) not null default 'COUNTER',
  currency_code char(3) not null,
  is_active boolean not null default true,
  requires_session boolean not null default true,
  assigned_user_id uuid,
  assigned_terminal_id uuid references public.org_payment_terminals_cf(id),
  opening_float_required boolean not null default true,
  max_cash_limit DECIMAL(19,4),
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_cash_drawers_mst_code unique (tenant_org_id, drawer_code),
  constraint chk_org_cash_drawers_type check (drawer_type in ('COUNTER','SAFE','DRIVER_BAG','TEMPORARY')),
  constraint chk_org_cash_drawers_max_cash check (max_cash_limit is null or max_cash_limit >= 0),
  constraint chk_org_cash_drawers_rec_status check (rec_status in (0, 1, 2))
);

create table if not exists public.org_cash_drawer_sessions_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid not null,
  cash_drawer_id uuid not null references public.org_cash_drawers_mst(id),
  session_no varchar(80) not null,
  opened_by uuid not null,
  opened_at timestamp with time zone not null default now(),
  opening_float_amount DECIMAL(19,4) not null default 0,
  currency_code char(3) not null,
  status varchar(50) not null default 'OPEN' references public.sys_cash_drawer_session_status_cd(code),
  expected_cash_amount DECIMAL(19,4) not null default 0,
  counted_cash_amount DECIMAL(19,4),
  difference_amount DECIMAL(19,4),
  closed_by uuid,
  closed_at timestamp with time zone,
  close_notes text,
  force_close_reason text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_cash_drawer_sessions_mst_session_no unique (tenant_org_id, session_no),
  constraint chk_org_cash_drawer_sessions_amounts check (
    opening_float_amount >= 0 and expected_cash_amount >= 0 and (counted_cash_amount is null or counted_cash_amount >= 0)
  ),
  constraint chk_org_cash_drawer_sessions_rec_status check (rec_status in (0, 1, 2))
);

create unique index if not exists uq_open_cash_drawer_session
on public.org_cash_drawer_sessions_mst (tenant_org_id, cash_drawer_id)
where status = 'OPEN' and rec_status = 1;

create table if not exists public.org_cash_drawer_movements_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid not null,
  cash_drawer_id uuid not null references public.org_cash_drawers_mst(id),
  cash_drawer_session_id uuid not null references public.org_cash_drawer_sessions_mst(id),
  movement_type varchar(50) not null references public.sys_cash_drawer_movement_type_cd(code),
  direction varchar(10) not null,
  amount DECIMAL(19,4) not null,
  currency_code char(3) not null,
  order_id uuid,
  order_payment_id uuid,
  refund_id uuid,
  reference_no varchar(120),
  reason text,
  performed_by uuid not null,
  performed_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  constraint chk_org_cash_drawer_movements_direction check (direction in ('IN', 'OUT', 'NONE')),
  constraint chk_org_cash_drawer_movements_amount check (amount >= 0),
  constraint chk_org_cash_drawer_movements_rec_status check (rec_status in (0, 1, 2))
);

create index if not exists idx_cash_drawer_movements_session
on public.org_cash_drawer_movements_dtl (tenant_org_id, cash_drawer_session_id, performed_at);

-- =============================================================================
-- 4. ORDER FINANCIAL FACTS
-- =============================================================================

create table if not exists public.org_order_charges_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  order_item_id uuid,
  order_item_piece_id uuid,
  source_preference_id uuid,
  charge_level varchar(20) not null default 'ORDER',
  charge_source varchar(50) not null default 'MANUAL',
  charge_type varchar(80) not null,
  charge_code varchar(120),
  charge_name varchar(250),
  charge_name2 varchar(250),
  amount DECIMAL(19,4) not null default 0,
  currency_code char(3) not null,
  is_taxable boolean not null default true,
  tax_code varchar(80),
  tax_amount DECIMAL(19,4) not null default 0,
  approval_status varchar(50),
  approved_by uuid,
  approved_at timestamp with time zone,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_charges_level check (charge_level in ('ORDER', 'ITEM', 'PIECE')),
  constraint chk_order_charges_amount check (amount >= 0 and tax_amount >= 0),
  constraint chk_order_charges_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_order_discounts_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  order_item_id uuid,
  order_item_piece_id uuid,
  discount_level varchar(20) not null default 'ORDER',
  discount_type varchar(80) not null,
  discount_code varchar(120),
  discount_name varchar(250),
  discount_name2 varchar(250),
  promotion_id uuid,
  coupon_id uuid,
  basis_amount DECIMAL(19,4) not null default 0,
  discount_rate numeric(9,4),
  discount_amount DECIMAL(19,4) not null default 0,
  applied_before_tax boolean not null default true,
  is_taxable_discount boolean not null default true,
  reason text,
  approval_status varchar(50),
  approved_by uuid,
  approved_at timestamp with time zone,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_discounts_level check (discount_level in ('ORDER', 'ITEM', 'PIECE')),
  constraint chk_order_discounts_amount check (basis_amount >= 0 and discount_amount >= 0),
  constraint chk_order_discounts_rate check (discount_rate is null or discount_rate >= 0),
  constraint chk_order_discounts_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_order_taxes_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  order_item_id uuid,
  order_item_piece_id uuid,
  charge_id uuid,
  tax_level varchar(30) not null default 'ORDER',
  tax_type varchar(80) not null default 'VAT',
  tax_code varchar(80) not null,
  tax_name varchar(250),
  tax_name2 varchar(250),
  tax_rate numeric(9,4) not null,
  taxable_amount DECIMAL(19,4) not null default 0,
  tax_amount DECIMAL(19,4) not null default 0,
  tax_inclusive boolean not null default false,
  jurisdiction_code varchar(80),
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_taxes_level check (tax_level in ('ORDER','ITEM','PIECE','CHARGE')),
  constraint chk_order_taxes_amount check (tax_rate >= 0 and taxable_amount >= 0 and tax_amount >= 0),
  constraint chk_order_taxes_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_order_credit_applications_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  customer_id uuid,
  credit_type varchar(50) not null,
  source_id uuid not null,
  source_txn_id uuid,
  applied_amount DECIMAL(19,4) not null,
  currency_code char(3) not null,
  application_status varchar(50) not null default 'APPLIED',
  applied_at timestamp with time zone not null default now(),
  applied_by uuid,
  reversal_txn_id uuid,
  reversed_at timestamp with time zone,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key text,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_credit_app_type check (credit_type in ('GIFT_CARD','WALLET','ADVANCE','CUSTOMER_CREDIT','LOYALTY_CREDIT')),
  constraint chk_order_credit_app_amount check (applied_amount >= 0),
  constraint chk_order_credit_app_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_order_payments_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  customer_id uuid,
  org_payment_method_id uuid,
  branch_payment_method_id uuid,
  payment_terminal_id uuid,
  cash_drawer_id uuid,
  cash_drawer_session_id uuid,
  payment_method_code varchar(50) not null,
  payment_method_name_snapshot varchar(250),
  payment_status varchar(50) not null default 'COMPLETED',
  amount DECIMAL(19,4) not null,
  currency_code char(3) not null,
  tendered_amount DECIMAL(19,4),
  change_returned_amount DECIMAL(19,4),
  card_brand_code varchar(50),
  card_last4 varchar(4),
  auth_code varchar(120),
  gateway_code varchar(80),
  gateway_transaction_id varchar(200),
  gateway_reference varchar(200),
  check_no varchar(120),
  check_bank_name varchar(250),
  check_due_date date,
  check_status varchar(50),
  bank_reference varchar(200),
  idempotency_key text,
  paid_at timestamp with time zone,
  received_by uuid,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_payments_amount check (amount >= 0),
  constraint chk_order_payments_tendered check (tendered_amount is null or tendered_amount >= 0),
  constraint chk_order_payments_change check (change_returned_amount is null or change_returned_amount >= 0),
  constraint chk_order_payments_rec_status check (rec_status in (0,1,2))
);

-- Harden org_order_payments_dtl if it already existed.
alter table public.org_order_payments_dtl
  add column if not exists org_payment_method_id uuid,
  add column if not exists branch_payment_method_id uuid,
  add column if not exists payment_terminal_id uuid,
  add column if not exists cash_drawer_id uuid,
  add column if not exists cash_drawer_session_id uuid,
  add column if not exists payment_method_code varchar(50),
  add column if not exists payment_method_name_snapshot varchar(250),
  add column if not exists payment_status varchar(50) default 'COMPLETED',
  add column if not exists amount DECIMAL(19,4),
  add column if not exists currency_code char(3),
  add column if not exists tendered_amount DECIMAL(19,4),
  add column if not exists change_returned_amount DECIMAL(19,4),
  add column if not exists card_brand_code varchar(50),
  add column if not exists card_last4 varchar(4),
  add column if not exists auth_code varchar(120),
  add column if not exists gateway_code varchar(80),
  add column if not exists gateway_transaction_id varchar(200),
  add column if not exists gateway_reference varchar(200),
  add column if not exists check_no varchar(120),
  add column if not exists check_bank_name varchar(250),
  add column if not exists check_due_date date,
  add column if not exists check_status varchar(50),
  add column if not exists bank_reference varchar(200),
  add column if not exists idempotency_key text,
  add column if not exists paid_at timestamp with time zone,
  add column if not exists received_by uuid,
  add column if not exists branch_id uuid,
  add column if not exists metadata jsonb default '{}'::jsonb;

create table if not exists public.org_order_refunds_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  customer_id uuid,
  refund_method varchar(50) not null,
  refund_status varchar(50) not null default 'PENDING',
  amount DECIMAL(19,4) not null,
  currency_code char(3) not null,
  original_payment_id uuid,
  credit_application_id uuid,
  refund_reason text,
  approved_by uuid,
  approved_at timestamp with time zone,
  processed_by uuid,
  processed_at timestamp with time zone,
  reference_txn_id uuid,
  idempotency_key text,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_refunds_amount check (amount >= 0),
  constraint chk_order_refunds_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_order_adjustments_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  adjustment_type varchar(80) not null,
  amount DECIMAL(19,4) not null,
  currency_code char(3) not null,
  affects_tax boolean not null default false,
  affects_revenue boolean not null default true,
  reason text not null,
  approval_status varchar(50),
  approved_by uuid,
  approved_at timestamp with time zone,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_order_adjustments_amount check (amount >= 0),
  constraint chk_order_adjustments_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_order_financial_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  order_id uuid not null,
  entity_name varchar(120) not null,
  entity_id uuid,
  action_type varchar(80) not null,
  field_name varchar(120),
  old_value text,
  new_value text,
  reason text,
  performed_by uuid,
  performed_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- =============================================================================
-- 5. STORED VALUE + LOYALTY
-- =============================================================================

create table if not exists public.org_gift_cards_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid,
  gift_card_code varchar(120) not null,
  gift_card_pin_hash text,
  gift_card_type varchar(50) not null default 'FIXED_VALUE',
  currency_code char(3) not null,
  original_amount DECIMAL(19,4) not null default 0,
  available_amount DECIMAL(19,4) not null default 0,
  redeemed_amount DECIMAL(19,4) not null default 0,
  bonus_amount DECIMAL(19,4) not null default 0,
  bonus_remaining DECIMAL(19,4) not null default 0,
  issue_date date,
  activation_date timestamp with time zone,
  expiry_date date,
  status varchar(50) not null default 'DRAFT',
  issued_to_customer_id uuid,
  purchased_by_customer_id uuid,
  order_id uuid,
  invoice_id uuid,
  batch_id uuid,
  is_reloadable boolean not null default false,
  is_transferable boolean not null default false,
  max_redemptions integer,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_gift_cards_code unique (tenant_org_id, gift_card_code),
  constraint chk_org_gift_cards_status check (status in ('DRAFT','GENERATED','ACTIVE','PARTIALLY_REDEEMED','FULLY_REDEEMED','EXPIRED','VOIDED','SUSPENDED')),
  constraint chk_org_gift_cards_type check (gift_card_type in ('FIXED_VALUE','SERVICE','PROMOTIONAL','CORPORATE')),
  constraint chk_org_gift_cards_amounts check (original_amount >= 0 and available_amount >= 0 and redeemed_amount >= 0 and bonus_amount >= 0 and bonus_remaining >= 0),
  constraint chk_org_gift_cards_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_gift_card_txn_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  gift_card_id uuid not null references public.org_gift_cards_mst(id),
  txn_date timestamp with time zone not null default now(),
  txn_type varchar(50) not null,
  amount DECIMAL(19,4) not null default 0,
  balance_before DECIMAL(19,4) not null default 0,
  balance_after DECIMAL(19,4) not null default 0,
  currency_code char(3) not null,
  reference_type varchar(80),
  reference_id uuid,
  order_id uuid,
  payment_id uuid,
  invoice_id uuid,
  performed_by uuid,
  reason text,
  notes text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint chk_gift_card_txn_type check (txn_type in ('ISSUE','ACTIVATE','REDEEM','REFUND','EXPIRE','ADJUSTMENT','VOID','BONUS_ADD','BONUS_REDEEM')),
  constraint chk_gift_card_txn_amount check (amount >= 0 and balance_before >= 0 and balance_after >= 0),
  constraint chk_gift_card_txn_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_wallet_accounts_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_id uuid not null,
  wallet_no varchar(120) not null,
  currency_code char(3) not null,
  available_balance DECIMAL(19,4) not null default 0,
  held_balance DECIMAL(19,4) not null default 0,
  status varchar(50) not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_wallet_account_customer_currency unique (tenant_org_id, customer_id, currency_code),
  constraint chk_wallet_balances check (available_balance >= 0 and held_balance >= 0),
  constraint chk_wallet_status check (status in ('ACTIVE','SUSPENDED','CLOSED')),
  constraint chk_wallet_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_wallet_txn_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  wallet_account_id uuid not null references public.org_wallet_accounts_mst(id),
  customer_id uuid not null,
  txn_type varchar(50) not null,
  amount DECIMAL(19,4) not null,
  balance_before DECIMAL(19,4) not null,
  balance_after DECIMAL(19,4) not null,
  currency_code char(3) not null,
  reference_type varchar(80),
  reference_id uuid,
  order_id uuid,
  payment_id uuid,
  invoice_id uuid,
  performed_by uuid,
  performed_at timestamp with time zone not null default now(),
  reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  constraint chk_wallet_txn_amounts check (amount >= 0 and balance_before >= 0 and balance_after >= 0),
  constraint chk_wallet_txn_type check (txn_type in ('TOP_UP','APPLY_TO_ORDER','REFUND_TO_WALLET','REVERSAL','ADJUSTMENT','BONUS_ADD','EXPIRY')),
  constraint chk_wallet_txn_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_customer_advances_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_id uuid not null,
  advance_no varchar(120) not null,
  currency_code char(3) not null,
  original_amount DECIMAL(19,4) not null default 0,
  available_amount DECIMAL(19,4) not null default 0,
  applied_amount DECIMAL(19,4) not null default 0,
  status varchar(50) not null default 'ACTIVE',
  source_payment_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_customer_advance_no unique (tenant_org_id, advance_no),
  constraint chk_customer_advance_amounts check (original_amount >= 0 and available_amount >= 0 and applied_amount >= 0),
  constraint chk_customer_advance_status check (status in ('ACTIVE','FULLY_APPLIED','REFUNDED','VOIDED')),
  constraint chk_customer_advance_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_customer_advance_txn_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_advance_id uuid not null references public.org_customer_advances_mst(id),
  customer_id uuid not null,
  txn_type varchar(50) not null,
  amount DECIMAL(19,4) not null,
  balance_before DECIMAL(19,4) not null,
  balance_after DECIMAL(19,4) not null,
  currency_code char(3) not null,
  order_id uuid,
  payment_id uuid,
  reference_type varchar(80),
  reference_id uuid,
  performed_by uuid,
  performed_at timestamp with time zone not null default now(),
  reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  constraint chk_advance_txn_type check (txn_type in ('RECEIVE_ADVANCE','APPLY_TO_ORDER','REFUND_ADVANCE','TRANSFER_TO_CREDIT','REVERSAL','ADJUSTMENT')),
  constraint chk_advance_txn_amounts check (amount >= 0 and balance_before >= 0 and balance_after >= 0),
  constraint chk_advance_txn_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_customer_credits_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_id uuid not null,
  credit_no varchar(120) not null,
  currency_code char(3) not null,
  original_amount DECIMAL(19,4) not null default 0,
  available_amount DECIMAL(19,4) not null default 0,
  applied_amount DECIMAL(19,4) not null default 0,
  status varchar(50) not null default 'ACTIVE',
  source_type varchar(80),
  source_id uuid,
  expiry_date date,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_customer_credit_no unique (tenant_org_id, credit_no),
  constraint chk_customer_credit_amounts check (original_amount >= 0 and available_amount >= 0 and applied_amount >= 0),
  constraint chk_customer_credit_status check (status in ('ACTIVE','FULLY_APPLIED','REFUNDED','EXPIRED','VOIDED')),
  constraint chk_customer_credit_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_customer_credit_txn_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_credit_id uuid not null references public.org_customer_credits_mst(id),
  customer_id uuid not null,
  txn_type varchar(50) not null,
  amount DECIMAL(19,4) not null,
  balance_before DECIMAL(19,4) not null,
  balance_after DECIMAL(19,4) not null,
  currency_code char(3) not null,
  order_id uuid,
  payment_id uuid,
  reference_type varchar(80),
  reference_id uuid,
  performed_by uuid,
  performed_at timestamp with time zone not null default now(),
  reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  constraint chk_credit_txn_type check (txn_type in ('CREATE_CREDIT','APPLY_TO_ORDER','REFUND_CREDIT','REVERSAL','ADJUSTMENT','EXPIRE')),
  constraint chk_credit_txn_amounts check (amount >= 0 and balance_before >= 0 and balance_after >= 0),
  constraint chk_credit_txn_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_loyalty_accounts_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  customer_id uuid not null,
  loyalty_account_no varchar(120) not null,
  status varchar(50) not null default 'ACTIVE',
  points_balance DECIMAL(19,4) not null default 0,
  monetary_balance DECIMAL(19,4) not null default 0,
  lifetime_points_earned DECIMAL(19,4) not null default 0,
  lifetime_points_redeemed DECIMAL(19,4) not null default 0,
  lifetime_points_expired DECIMAL(19,4) not null default 0,
  tier_code varchar(80),
  tier_started_at timestamp with time zone,
  tier_expires_at timestamp with time zone,
  last_earn_at timestamp with time zone,
  last_redeem_at timestamp with time zone,
  currency_code char(3),
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_loyalty_account_customer unique (tenant_org_id, customer_id),
  constraint chk_loyalty_balances check (points_balance >= 0 and monetary_balance >= 0),
  constraint chk_loyalty_status check (status in ('ACTIVE','SUSPENDED','CLOSED')),
  constraint chk_loyalty_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_loyalty_txn_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  loyalty_account_id uuid not null references public.org_loyalty_accounts_mst(id),
  customer_id uuid not null,
  txn_type varchar(50) not null,
  points_amount DECIMAL(19,4) not null default 0,
  monetary_amount DECIMAL(19,4) not null default 0,
  points_balance_before DECIMAL(19,4) not null,
  points_balance_after DECIMAL(19,4) not null,
  reference_type varchar(80),
  reference_id uuid,
  order_id uuid,
  performed_by uuid,
  performed_at timestamp with time zone not null default now(),
  expiry_date date,
  reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  constraint chk_loyalty_txn_amounts check (points_amount >= 0 and monetary_amount >= 0 and points_balance_before >= 0 and points_balance_after >= 0),
  constraint chk_loyalty_txn_type check (txn_type in ('EARN','REDEEM','EXPIRE','ADJUSTMENT','BONUS','REVERSAL')),
  constraint chk_loyalty_txn_rec_status check (rec_status in (0,1,2))
);

-- =============================================================================
-- 6. TENANT PROMOTIONS
-- =============================================================================

create table if not exists public.org_promotions_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  promotion_code varchar(120) not null,
  promotion_name varchar(250) not null,
  promotion_name2 varchar(250),
  promotion_type varchar(80) not null,
  stacking_policy varchar(80) not null default 'EXCLUSIVE',
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  budget_amount DECIMAL(19,4),
  used_budget_amount DECIMAL(19,4) not null default 0,
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_promotions_code unique (tenant_org_id, promotion_code),
  constraint chk_org_promotions_dates check (end_at is null or start_at is null or end_at >= start_at),
  constraint chk_org_promotions_budget check ((budget_amount is null or budget_amount >= 0) and used_budget_amount >= 0),
  constraint chk_org_promotions_usage check ((usage_limit is null or usage_limit >= 0) and used_count >= 0),
  constraint chk_org_promotions_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_promotion_rules_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  promotion_id uuid not null references public.org_promotions_mst(id) on delete cascade,
  rule_type varchar(80) not null,
  rule_operator varchar(50),
  rule_value jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_promotion_eligibility_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  promotion_id uuid not null references public.org_promotions_mst(id) on delete cascade,
  eligibility_type varchar(80) not null,
  eligibility_value jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_promotion_rewards_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  promotion_id uuid not null references public.org_promotions_mst(id) on delete cascade,
  reward_type varchar(80) not null,
  reward_value jsonb not null default '{}'::jsonb,
  max_reward_amount DECIMAL(19,4),
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_promotion_limits_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  promotion_id uuid not null references public.org_promotions_mst(id) on delete cascade,
  limit_type varchar(80) not null,
  limit_value DECIMAL(19,4),
  period_type varchar(50),
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_promotion_exclusions_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  promotion_id uuid not null references public.org_promotions_mst(id) on delete cascade,
  exclusion_type varchar(80) not null,
  exclusion_value jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

-- =============================================================================
-- 7. TAX CONFIGURATION
-- =============================================================================

create table if not exists public.sys_tax_types_cd (
  code varchar(50) primary key,
  name varchar(250) not null,
  name2 varchar(250),
  is_active boolean not null default true,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

insert into public.sys_tax_types_cd (code, name, name2)
values ('VAT','Value Added Tax','ضريبة القيمة المضافة'),
       ('SALES_TAX','Sales Tax','ضريبة المبيعات'),
       ('OTHER','Other Tax','ضريبة أخرى')
on conflict (code) do update set name=excluded.name, name2=excluded.name2;

create table if not exists public.org_tax_profiles_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  tax_profile_code varchar(120) not null,
  tax_profile_name varchar(250) not null,
  country_code char(2),
  currency_code char(3),
  price_tax_mode varchar(30) not null default 'TAX_EXCLUSIVE',
  is_active boolean not null default true,
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_org_tax_profiles_code unique (tenant_org_id, tax_profile_code),
  constraint chk_org_tax_profiles_mode check (price_tax_mode in ('TAX_EXCLUSIVE','TAX_INCLUSIVE')),
  constraint chk_org_tax_profiles_dates check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint chk_org_tax_profiles_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_tax_rates_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  tax_profile_id uuid not null references public.org_tax_profiles_mst(id) on delete cascade,
  tax_type_code varchar(50) not null references public.sys_tax_types_cd(code),
  tax_code varchar(80) not null,
  tax_name varchar(250),
  tax_rate numeric(9,4) not null,
  effective_from date,
  effective_to date,
  is_active boolean not null default true,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint chk_org_tax_rates_rate check (tax_rate >= 0),
  constraint chk_org_tax_rates_dates check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint chk_org_tax_rates_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_tax_rules_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  tax_profile_id uuid not null references public.org_tax_profiles_mst(id) on delete cascade,
  rule_scope varchar(80) not null,
  rule_value jsonb not null default '{}'::jsonb,
  tax_rate_id uuid references public.org_tax_rates_dtl(id),
  is_exempt boolean not null default false,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_product_tax_mappings_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  product_id uuid,
  service_category_code varchar(120),
  tax_profile_id uuid not null references public.org_tax_profiles_mst(id),
  tax_rate_id uuid references public.org_tax_rates_dtl(id),
  is_exempt boolean not null default false,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_branch_tax_mappings_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid not null,
  tax_profile_id uuid not null references public.org_tax_profiles_mst(id),
  is_default boolean not null default false,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

-- =============================================================================
-- 8. PRODUCT PIECE TEMPLATES
-- =============================================================================

create table if not exists public.org_product_piece_templates_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  main_product_id uuid not null,
  template_code varchar(120) not null,
  template_name varchar(250) not null,
  template_name2 varchar(250),
  pieces_per_product integer not null default 1,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  constraint uq_product_piece_template_code unique (tenant_org_id, main_product_id, template_code),
  constraint chk_product_piece_template_pieces check (pieces_per_product > 0),
  constraint chk_product_piece_template_rec_status check (rec_status in (0,1,2))
);

create table if not exists public.org_product_piece_templates_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  template_id uuid not null references public.org_product_piece_templates_mst(id) on delete cascade,
  main_product_id uuid not null,
  piece_product_id uuid,
  piece_type_code varchar(120) not null,
  piece_name varchar(250) not null,
  piece_name2 varchar(250),
  piece_qty integer not null default 1,
  sort_order integer not null default 1,
  is_required boolean not null default true,
  is_price_separate boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint chk_product_piece_template_dtl_qty check (piece_qty > 0),
  constraint chk_product_piece_template_dtl_order check (sort_order > 0),
  constraint chk_product_piece_template_dtl_rec_status check (rec_status in (0,1,2))
);

do $$
begin
  if to_regclass('public.org_product_data_mst') is not null then
    alter table public.org_product_data_mst
      add column if not exists pieces_per_product integer not null default 1,
      add column if not exists has_piece_template boolean not null default false,
      add column if not exists default_piece_template_id uuid;
  end if;
end $$;

-- =============================================================================
-- 9. OUTBOX, IDEMPOTENCY, RECONCILIATION
-- =============================================================================

create table if not exists public.org_domain_events_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  event_type varchar(120) not null,
  aggregate_type varchar(120) not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status varchar(50) not null default 'PENDING',
  retry_count integer not null default 0,
  error_message text,
  created_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  constraint chk_domain_events_status check (status in ('PENDING','PROCESSING','PROCESSED','FAILED')),
  constraint chk_domain_events_retry check (retry_count >= 0)
);

create index if not exists idx_domain_events_pending
on public.org_domain_events_outbox (status, created_at)
where status in ('PENDING','FAILED');

create table if not exists public.org_idempotency_keys_log (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  idempotency_key text not null,
  request_hash text,
  response_payload jsonb,
  status varchar(50) not null default 'PENDING',
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  constraint uq_idempotency_key unique (tenant_org_id, idempotency_key),
  constraint chk_idempotency_status check (status in ('PENDING','COMPLETED','FAILED','EXPIRED'))
);

create table if not exists public.org_fin_reconciliation_runs_mst (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  run_type varchar(80) not null,
  run_scope varchar(80),
  date_from date,
  date_to date,
  status varchar(50) not null default 'STARTED',
  total_checked integer not null default 0,
  total_issues integer not null default 0,
  blocker_count integer not null default 0,
  warning_count integer not null default 0,
  info_count integer not null default 0,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  started_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_recon_run_status check (status in ('STARTED','COMPLETED','FAILED','CANCELLED'))
);

create table if not exists public.org_fin_reconciliation_issues_dtl (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null,
  run_id uuid not null references public.org_fin_reconciliation_runs_mst(id) on delete cascade,
  issue_type varchar(120) not null,
  severity varchar(30) not null,
  entity_type varchar(120),
  entity_id uuid,
  expected_amount DECIMAL(19,4),
  actual_amount DECIMAL(19,4),
  difference_amount DECIMAL(19,4),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint chk_recon_issue_severity check (severity in ('INFO','WARNING','BLOCKER'))
);

-- =============================================================================
-- 10. ORDER SUMMARY COLUMN ADDITIONS
-- =============================================================================

do $$
begin
  if to_regclass('public.org_orders_mst') is not null then
    alter table public.org_orders_mst
      add column if not exists items_gross_amount DECIMAL(19,4) default 0,
      add column if not exists services_gross_amount DECIMAL(19,4) default 0,
      add column if not exists gross_amount DECIMAL(19,4) default 0,
      add column if not exists preference_charges_amount DECIMAL(19,4) default 0,
      add column if not exists other_charges_amount DECIMAL(19,4) default 0,
      add column if not exists total_charges_amount DECIMAL(19,4) default 0,
      add column if not exists auto_discount_amount DECIMAL(19,4) default 0,
      add column if not exists manual_discount_amount DECIMAL(19,4) default 0,
      add column if not exists promotion_discount_amount DECIMAL(19,4) default 0,
      add column if not exists coupon_discount_amount DECIMAL(19,4) default 0,
      add column if not exists loyalty_discount_amount DECIMAL(19,4) default 0,
      add column if not exists total_discount_amount DECIMAL(19,4) default 0,
      add column if not exists net_before_tax_amount DECIMAL(19,4) default 0,
      add column if not exists vat_amount DECIMAL(19,4) default 0,
      add column if not exists other_tax_amount DECIMAL(19,4) default 0,
      add column if not exists total_tax_amount DECIMAL(19,4) default 0,
      add column if not exists grand_total_amount DECIMAL(19,4) default 0,
      add column if not exists gift_card_applied_amount DECIMAL(19,4) default 0,
      add column if not exists wallet_applied_amount DECIMAL(19,4) default 0,
      add column if not exists advance_applied_amount DECIMAL(19,4) default 0,
      add column if not exists customer_credit_applied_amount DECIMAL(19,4) default 0,
      add column if not exists loyalty_credit_applied_amount DECIMAL(19,4) default 0,
      add column if not exists total_credit_applied_amount DECIMAL(19,4) default 0,
      add column if not exists net_receivable_amount DECIMAL(19,4) default 0,
      add column if not exists cash_paid_amount DECIMAL(19,4) default 0,
      add column if not exists card_paid_amount DECIMAL(19,4) default 0,
      add column if not exists check_paid_amount DECIMAL(19,4) default 0,
      add column if not exists bank_transfer_paid_amount DECIMAL(19,4) default 0,
      add column if not exists payment_gateway_paid_amount DECIMAL(19,4) default 0,
      add column if not exists total_paid_amount DECIMAL(19,4) default 0,
      add column if not exists invoice_ar_amount DECIMAL(19,4) default 0,
      add column if not exists pay_on_collection_amount DECIMAL(19,4) default 0,
      add column if not exists rounding_adjustment_amount DECIMAL(19,4) default 0,
      add column if not exists change_returned_amount DECIMAL(19,4) default 0,
      add column if not exists outstanding_amount DECIMAL(19,4) default 0,
      add column if not exists pricing_engine_version text,
      add column if not exists tax_engine_version text,
      add column if not exists promotion_engine_version text,
      add column if not exists settlement_engine_version text;
  end if;
end $$;

-- =============================================================================
-- 11. INDEXES
-- =============================================================================

create index if not exists idx_order_charges_order on public.org_order_charges_dtl (tenant_org_id, order_id, rec_status);
create index if not exists idx_order_discounts_order on public.org_order_discounts_dtl (tenant_org_id, order_id, rec_status);
create index if not exists idx_order_taxes_order on public.org_order_taxes_dtl (tenant_org_id, order_id, rec_status);
create index if not exists idx_order_credit_app_order on public.org_order_credit_applications_dtl (tenant_org_id, order_id, rec_status);
create index if not exists idx_order_payments_order on public.org_order_payments_dtl (tenant_org_id, order_id, rec_status);
create index if not exists idx_order_refunds_order on public.org_order_refunds_dtl (tenant_org_id, order_id, rec_status);

create unique index if not exists uq_order_credit_app_idempotency
on public.org_order_credit_applications_dtl (tenant_org_id, idempotency_key)
where idempotency_key is not null;

create unique index if not exists uq_order_payments_idempotency
on public.org_order_payments_dtl (tenant_org_id, idempotency_key)
where idempotency_key is not null;

create index if not exists idx_order_fin_audit_order
on public.org_order_financial_audit_log (tenant_org_id, order_id, performed_at desc);

-- =============================================================================
-- 12. COMMENTS
-- =============================================================================

comment on table public.org_payment_methods_cf is 'Tenant-level enabled payment method configuration. Defines which HQ payment methods are allowed for the tenant and how they behave.';
comment on table public.org_branch_payment_methods_cf is 'Branch-level payment method override table. Controls local branch availability, cash drawer requirement, terminal requirement, and limits.';
comment on table public.org_payment_terminals_cf is 'Tenant payment terminal/device configuration for POS terminals, online gateways, cash drawer terminals, and bank devices.';
comment on table public.org_cash_drawers_mst is 'Cash drawer master table. Defines physical or logical drawers such as counter drawer, safe, or driver cash bag.';
comment on table public.org_cash_drawer_sessions_mst is 'Cash drawer session table. Tracks cashier opening and closing sessions for cash accountability.';
comment on table public.org_cash_drawer_movements_dtl is 'Cash drawer movement details. Stores every cash movement such as opening float, cash sale, refund, cash in/out, drop, shortage, and overage.';
comment on table public.org_order_payments_dtl is 'Actual order payment transaction rows. Stores real payments only: cash, card, check, bank transfer, payment gateway, COD. Stored-value applications are not stored here.';
comment on table public.org_order_credit_applications_dtl is 'Stored-value applications against orders: gift card, wallet, advance, customer credit, loyalty credit. These are not real payment rows.';
comment on table public.org_gift_cards_mst is 'Gift card stored-value master. Gift cards are liabilities, not discounts.';
comment on table public.org_gift_card_txn_dtl is 'Gift card transaction ledger. Mandatory for audit, accounting, fraud prevention, and reconciliation.';

commit;
