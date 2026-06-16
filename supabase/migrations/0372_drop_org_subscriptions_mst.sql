-- Migration: Drop obsolete org_subscriptions_mst table
-- All subscription data is now managed via org_pln_subscriptions_mst (created in 0041).
-- All code references have been updated to use org_pln_subscriptions_mst.

-- Drop RLS policies first
DROP POLICY IF EXISTS tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst;

-- Drop the table (CASCADE removes any dependent objects)
DROP TABLE IF EXISTS org_subscriptions_mst CASCADE;
