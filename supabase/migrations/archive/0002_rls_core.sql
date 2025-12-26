-- 0002_rls_core.sql — CleanMateX Phase-1 RLS Policies
-- Assumes Supabase JWT contains claim: auth.jwt() ->> 'tenant_org_id'

-- Enable RLS on all tenant-linked tables
alter table org_tenants_mst           enable row level security;
alter table org_subscriptions_mst         enable row level security;
alter table org_branches_mst          enable row level security;
alter table org_service_category_cf   enable row level security;
alter table org_product_data_mst      enable row level security;
alter table org_customers_mst         enable row level security;
alter table org_orders_mst            enable row level security;
alter table org_order_items_dtl       enable row level security;
alter table org_invoice_mst           enable row level security;
alter table org_payments_dtl_tr       enable row level security;

-- ========== BASE POLICY TEMPLATE ==========
-- Only rows with tenant_org_id matching the JWT claim are accessible.
-- NOTE: For org_subscriptions_mst the column is tenant_org_id, adjust accordingly.

-- Tenants (each user can only see their own tenant record)
create policy tenant_isolation_org_tenants
on org_tenants_mst
for all
using (id::text = auth.jwt() ->> 'tenant_org_id');

-- Subscriptions
create policy tenant_isolation_org_subscriptions_mst
on org_subscriptions_mst
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Branches
create policy tenant_isolation_org_branches
on org_branches_mst
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Service Categories
create policy tenant_isolation_org_service_category
on org_service_category_cf
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Products
create policy tenant_isolation_org_products
on org_product_data_mst
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Customers (link table)
create policy tenant_isolation_org_customers
on org_customers_mst
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Orders
create policy tenant_isolation_org_orders
on org_orders_mst
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Order Items
create policy tenant_isolation_org_order_items
on org_order_items_dtl
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Invoices
create policy tenant_isolation_org_invoices
on org_invoice_mst
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');

-- Payments
create policy tenant_isolation_org_payments
on org_payments_dtl_tr
for all
using (tenant_org_id::text = auth.jwt() ->> 'tenant_org_id');
