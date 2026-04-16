-- Migration: 0238_fix_org_preference_kind_cf_rls.sql
-- Fix RLS policy on org_preference_kind_cf to allow UPDATE/INSERT by adding WITH CHECK clause.
-- The original policy in 0171 only had USING (read check), causing "new row violates RLS" on save.

DROP POLICY IF EXISTS tenant_isolation ON org_preference_kind_cf;

CREATE POLICY tenant_isolation ON org_preference_kind_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
