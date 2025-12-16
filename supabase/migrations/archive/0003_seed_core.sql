-- 0003_seed_core.sql — CleanMateX Phase-1 core seed (idempotent-ish)

-- ===== Keys (fixed UUIDs for reproducibility) =====
-- Tenant / branch / customer / product / order / invoice / payment
-- Adjust if you prefer gen_random_uuid() at runtime.
-- Demo tenant
--   11111111-1111-1111-1111-111111111111
-- Branch
--   22222222-2222-2222-2222-222222222222
-- Global customer (sys)
--   33333333-3333-3333-3333-333333333333
-- Product
--   44444444-4444-4444-4444-444444444444
-- Order
--   55555555-5555-5555-5555-555555555555
-- Invoice
--   66666666-6666-6666-6666-666666666666
-- Payment
--   77777777-7777-7777-7777-777777777777

-- ===== Code tables =====
insert into sys_order_type_cd (order_type_id, order_type_name, order_type_name2, is_active)
values
  ('POS',      'Point of Sale',         'نقطة بيع',         true),
  ('PICKUP',   'Pickup Request',        'طلب استلام',       true),
  ('DELIVERY', 'Delivery to Customer',  'توصيل للعميل',     true)
on conflict (order_type_id) do update
set order_type_name=excluded.order_type_name,
    order_type_name2=excluded.order_type_name2,
    is_active=excluded.is_active;

insert into sys_service_category_cd (service_category_code, ctg_name, ctg_name2, is_active)
values
  ('LAUNDRY',     'Laundry',        'غسيل',        true),
  ('DRY_CLEAN',   'Dry Cleaning',   'دراي كلين',   true),
  ('IRON',        'Ironing',        'كي',          true),
  ('REPAIRS',        'Repairing',        'إصلاح',          true)
  
on conflict (service_category_code) do update
set ctg_name=excluded.ctg_name,
    ctg_name2=excluded.ctg_name2,
    is_active=excluded.is_active;

-- ===== Tenant and subscription =====
insert into org_tenants_mst (id, name, name2, slug, email, phone, s_current_plan, country, currency, timezone, language, is_active, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'Demo Laundry LLC', 'شركة ديمو للغسيل',
  'demo-laundry',
  'owner@demo-laundry.example',
  '+96870000000',
  'FREE_TRIAL',
  'OM','OMR','Asia/Muscat','en', true, 'trial'
)
on conflict (id) do update
set name=excluded.name,
    name2=excluded.name2,
    slug=excluded.slug,
    email=excluded.email,
    phone=excluded.phone,
    s_current_plan=excluded.s_current_plan,
    is_active=excluded.is_active,
    status=excluded.status;

insert into org_subscriptions_mst (id, tenant_org_id, plan, status, orders_limit, orders_used, branch_limit, user_limit, start_date, end_date)
values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  'free','trial', 100, 0, 2, 5, now(), now() + interval '30 days'
)
on conflict do nothing;

-- ===== Branch =====
insert into org_branches_mst (
  id, tenant_org_id, branch_name, phone, email, address, city, area, latitude, longitude, is_active
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Main Branch', '+96871111111', 'main@demo-laundry.example',
  'Way 1234, Muscat', 'Muscat', 'Al Khuwair', 23.5859, 58.4059, true
)
on conflict (id, tenant_org_id) do update
set branch_name=excluded.branch_name,
    phone=excluded.phone,
    email=excluded.email,
    address=excluded.address,
    city=excluded.city,
    area=excluded.area,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    is_active=excluded.is_active;

-- ===== Global customer (sys) + tenant link =====
insert into sys_customers_mst (id, first_name, last_name, phone, email, type, address, created_at, updated_at)
values (
  '33333333-3333-3333-3333-333333333333',
  'Gehad Cusomer', 'Ali', '+96877182624', 'agehad21@gmail.com', 'walk_in',
  'Muscat', now(), now()
)
on conflict (id) do update
set first_name=excluded.first_name,
    last_name=excluded.last_name,
    phone=excluded.phone,
    email=excluded.email,
    type=excluded.type,
    address=excluded.address,
    updated_at=now();

insert into org_customers_mst (customer_id, tenant_org_id, is_active, created_at)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  true, now()
)
on conflict (customer_id, tenant_org_id) do nothing;

-- ===== Enable service categories for tenant =====
insert into org_service_category_cf (tenant_org_id, service_category_code)
values
  ('11111111-1111-1111-1111-111111111111','LAUNDRY'),
  ('11111111-1111-1111-1111-111111111111','DRY_CLEAN'),
  ('11111111-1111-1111-1111-111111111111','IRON')
on conflict (tenant_org_id, service_category_code) do nothing;

-- ===== Product =====
insert into org_product_data_mst (
  id, tenant_org_id, service_category_code, product_code, product_name, product_name2,
  default_sell_price, default_express_sell_price, is_active, created_at2
) values (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'LAUNDRY',
  'PROD-SHIRT-WI',
  'Shirt - Wash & Iron',
  'قميص - غسيل وكي',
  0.800, 1.200, true, now()
)
on conflict (tenant_org_id, product_code) do update
set product_name=excluded.product_name,
    product_name2=excluded.product_name2,
    default_sell_price=excluded.default_sell_price,
    default_express_sell_price=excluded.default_express_sell_price,
    is_active=excluded.is_active;

-- ===== Sample order + item =====
insert into org_orders_mst (
  id, tenant_org_id, branch_id, customer_id, order_type_id, order_no,
  status, priority, total_items, subtotal, discount, tax, total,
  payment_status, received_at, created_at, updated_at
) values (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'POS',
  'CMX-2025-0001',
  'intake', 'normal', 1, 0.800, 0.000, 0.040, 0.840,
  'pending', now(), now(), now()
)
on conflict (tenant_org_id, order_no) do nothing;

insert into org_order_items_dtl (
  id, order_id, tenant_org_id, service_category_code, order_item_srno,
  product_id, quantity, price_per_unit, total_price, status, created_at
) values (
  gen_random_uuid(),
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  'LAUNDRY',
  '001',
  '44444444-4444-4444-4444-444444444444',
  1, 0.800, 0.800, 'pending', now()
)
on conflict do nothing;

-- ===== Invoice + payment (optional) =====
insert into org_invoice_mst (
  id, order_id, tenant_org_id, invoice_no, subtotal, discount, tax, total,
  status, created_at
) values (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  'INV-2025-0001',
  0.800, 0.000, 0.040, 0.840,
  'pending', now()
)
on conflict (tenant_org_id, invoice_no) do nothing;

insert into org_payments_dtl_tr (
  id, invoice_id, tenant_org_id, paid_amount, status, payment_method, paid_at, metadata
) values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  0.840, 'paid', 'cash', now(), '{"note":"seed payment"}'::jsonb
)
on conflict do nothing;
