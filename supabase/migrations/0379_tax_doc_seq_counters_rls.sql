-- ==================================================================
-- Migration: 0379_tax_doc_seq_counters_rls.sql
-- Purpose : F-01 — enable Row Level Security on org_tax_doc_seq_counters,
--           the only finance org_* table found without RLS (forensic
--           validation 2026-06-18). Adds tenant_isolation + service_role
--           policies, matching the pattern used by every other org_* table
--           (see 0357). Decision D-08 (23_DECISIONS_ADDENDUM).
--
-- Why both policies (D-08):
--   * tenant_isolation — normal tenant-scoped connections only see/modify
--     their own counter rows (current_tenant_id() from session/JWT).
--   * service_role     — the server-side tax sequence service
--     (tax-document-sequence.service.ts, runs FOR UPDATE numbering) keeps
--     working under the service role even without a tenant JWT context.
--
-- Safety  : Additive. No data change. No destructive SQL. Idempotent.
-- Verify  : pre-apply read-only — table has tenant_org_id NOT NULL,
--           relrowsecurity=false, 0 policies (confirmed 2026-06-18).
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

ALTER TABLE public.org_tax_doc_seq_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_tax_doc_seq_counters
  ON public.org_tax_doc_seq_counters;
CREATE POLICY tenant_isolation_org_tax_doc_seq_counters
  ON public.org_tax_doc_seq_counters
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_tax_doc_seq_counters
  ON public.org_tax_doc_seq_counters;
CREATE POLICY service_role_org_tax_doc_seq_counters
  ON public.org_tax_doc_seq_counters
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.org_tax_doc_seq_counters IS
  'Per-tenant gap-free fiscal sequence counters (INV/SIM/CN/DN). RLS enabled 0379 (F-01): tenant_isolation + service_role policies.';

COMMIT;

-- ------------------------------------------------------------------
-- Rollback (RESTRICT only — no CASCADE):
--   BEGIN;
--     DROP POLICY IF EXISTS tenant_isolation_org_tax_doc_seq_counters ON public.org_tax_doc_seq_counters;
--     DROP POLICY IF EXISTS service_role_org_tax_doc_seq_counters ON public.org_tax_doc_seq_counters;
--     ALTER TABLE public.org_tax_doc_seq_counters DISABLE ROW LEVEL SECURITY;
--   COMMIT;
-- Before rollback, confirm the sequence service is not relying on RLS.
-- ==================================================================