-- 0011_seed_core_02.sql — Second Demo Tenant core data (numeric UUID pattern)
-- Pattern base: 20000002-2222-2222-2222-22222222222X
-- Tenant: Demo2 Laundry Co. (different data than Tenant #1)

BEGIN;

-- ===== Tenant =====
INSERT INTO org_tenants_mst (
  id, name, name2, slug, email, phone, s_current_plan, address, city, country, currency, timezone, language, is_active, status, created_at, updated_at
) VALUES (
  '20000002-2222-2222-2222-222222222221', 'Demo2 Laundry Co.', 'شركة بلو ويف للغسيل', 'bluewave-laundry',
  'hq@bluewave.example', '+96871112230', 'FREE_TRIAL',
  'Way 1234, Qurum Heights, Muscat', 'Muscat', 'OM', 'OMR', 'Asia/Muscat', 'en', true, 'trial', now(), now()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  slug = EXCLUDED.slug,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  updated_at = now();

-- ===== Branch =====
INSERT INTO org_branches_mst (
  id, tenant_org_id, branch_name, phone, email, type, address, country, city, area, latitude, longitude, is_active, created_at
) VALUES (
  '20000002-2222-2222-2222-222222222222', '20000002-2222-2222-2222-222222222221', 'BlueWave Qurum Branch', '+96871112231', 'qurum@bluewave.example',
  'walk_in', 'Qurum Heights Plaza, Shop 12', 'OM', 'Muscat', 'Qurum', 23.602, 58.470, true, now()
) ON CONFLICT (id, tenant_org_id) DO UPDATE SET
  branch_name = EXCLUDED.branch_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  area = EXCLUDED.area,
  updated_at = now();

-- ===== Service Categories (tenant scope) =====
INSERT INTO org_service_category_cf (tenant_org_id, service_category_code) VALUES
  ('20000002-2222-2222-2222-222222222221', 'LAUNDRY'),
  ('20000002-2222-2222-2222-222222222221', 'DRY_CLEAN'),
  ('20000002-2222-2222-2222-222222222221', 'IRON'),
  ('20000002-2222-2222-2222-222222222221', 'REPAIRS')
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- ===== Catalog / Products =====
INSERT INTO org_product_data_mst (
  id, tenant_org_id, service_category_code, product_code, product_name, product_name2, is_retail_item,
  product_type, price_type, product_unit, default_sell_price, default_express_sell_price, min_sell_price,
  min_quantity, pieces_per_product, extra_days, turnaround_hh, turnaround_hh_express, multiplier_express,
  product_order, is_tax_exempt, is_active, created_at2
) VALUES
  ('20000002-2222-2222-2222-222222222226', '20000002-2222-2222-2222-222222222221', 'LAUNDRY',  'BW-SHIRT-WASH',   'Shirt Wash',            'غسيل قميص', false, 1, 'per_piece', 'unit', 0.800, 1.600, 0.700, 1, 1, 0, 24, 12, 2.0, 1, 0, true, now()),
  ('20000002-2222-2222-2222-222222222227', '20000002-2222-2222-2222-222222222221', 'DRY_CLEAN','BW-SUIT-DRY',     'Suit Dry Clean',        'تنظيف بدلة', false, 1, 'per_piece', 'unit', 3.200, 6.000, 2.800, 1, 2, 1, 48, 24, 1.8, 2, 0, true, now()),
  ('20000002-2222-2222-2222-222222222228', '20000002-2222-2222-2222-222222222221', 'IRON',    'BW-TROUSER-PRESS','Trouser Press',         'كي بنطلون',  false, 1, 'per_piece', 'unit', 0.600, 1.200, 0.500, 1, 1, 0, 12, 6,  2.0, 3, 0, true, now())
ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  product_name2 = EXCLUDED.product_name2,
  default_sell_price = EXCLUDED.default_sell_price,
  default_express_sell_price = EXCLUDED.default_express_sell_price,
  is_active = EXCLUDED.is_active;

-- ===== Global customer (sys) + tenant link =====
insert into sys_customers_mst (id, first_name, last_name, phone, email, type, address, created_at, updated_at)
values (
  '20000002-2222-2222-2222-222222222225',
  'Jh Test Customer', 'GhDev', '+96896662624', 'jhtest.dev21@gmail.com', 'walk_in',
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

-- ===== Customer =====
INSERT INTO org_customers_mst (customer_id, tenant_org_id, loyalty_points, is_active, created_at)
VALUES ('20000002-2222-2222-2222-222222222225', '20000002-2222-2222-2222-222222222221', 0, true, now())
ON CONFLICT (customer_id, tenant_org_id) DO NOTHING;

-- ===== Order (Quick Drop → Preparation) =====
INSERT INTO org_orders_mst (
  id, tenant_org_id, branch_id, customer_id, order_type_id, order_no, status, priority,
  subtotal, discount, tax, total, payment_status, received_at, ready_by, customer_notes, internal_notes, created_at, updated_at
) VALUES (
  '20000002-2222-2222-2222-222222222229', '20000002-2222-2222-2222-222222222221', '20000002-2222-2222-2222-222222222222', '20000002-2222-2222-2222-222222222225', 'POS', 'BW-2025-0001', 'intake', 'high',
  0, 0, 0, 0, 'pending', now(), now() + interval '2 days', 'Handle with care', 'Quick drop bag', now(), now()
) ON CONFLICT (id) DO NOTHING;

-- ===== Order Items =====
INSERT INTO org_order_items_dtl (
  id, order_id, tenant_org_id, service_category_code, order_item_srno, product_id, quantity,
  price_per_unit, total_price, status, notes, metadata, created_at
) VALUES
  ('20000002-2222-2222-2222-222222222230', '20000002-2222-2222-2222-222222222229', '20000002-2222-2222-2222-222222222221', 'LAUNDRY',  '001', '20000002-2222-2222-2222-222222222226', 3, 0.800, 2.400, 'pending', 'White shirts', '{"starch":"light"}', now()),
  ('20000002-2222-2222-2222-222222222231', '20000002-2222-2222-2222-222222222229', '20000002-2222-2222-2222-222222222221', 'IRON',    '002', '20000002-2222-2222-2222-222222222228', 2, 0.600, 1.200, 'pending', 'Office trousers', '{"crease":"sharp"}', now())
ON CONFLICT (id) DO NOTHING;

-- Recalculate order totals
UPDATE org_orders_mst o
SET subtotal = i.subtotal,
    tax = round(i.subtotal * 0.05, 3),
    total = round(i.subtotal * 1.05, 3),
    updated_at = now()
FROM (
  SELECT order_id, sum(total_price) AS subtotal
  FROM org_order_items_dtl
  WHERE order_id = '20000002-2222-2222-2222-222222222229'
  GROUP BY order_id
) i
WHERE o.id = i.order_id;

-- ===== Invoice =====
INSERT INTO org_invoice_mst (
  id, order_id, tenant_org_id, invoice_no, subtotal, discount, tax, total, status, due_date, payment_method, paid_amount, created_at
) VALUES (
  '20000002-2222-2222-2222-222222222232', '20000002-2222-2222-2222-222222222229', '20000002-2222-2222-2222-222222222221', 'INV-BW-2025-0001',
  (SELECT subtotal FROM org_orders_mst WHERE id = '20000002-2222-2222-2222-222222222229'),
  0,
  (SELECT tax FROM org_orders_mst WHERE id = '20000002-2222-2222-2222-222222222229'),
  (SELECT total FROM org_orders_mst WHERE id = '20000002-2222-2222-2222-222222222229'),
  'pending', now() + interval '7 days', 'cash', 0, now()
) ON CONFLICT (id) DO NOTHING;

-- ===== Payment (partial, unpaid) =====
INSERT INTO org_payments_dtl_tr (
  id, invoice_id, tenant_org_id, paid_amount, status, payment_method, metadata, created_at
) VALUES ('20000002-2222-2222-2222-222222222233', '20000002-2222-2222-2222-222222222232', '20000002-2222-2222-2222-222222222221', 0.000, 'pending', 'cash', '{"note":"to be paid on collection"}', now())
ON CONFLICT (id) DO NOTHING;

COMMIT;
