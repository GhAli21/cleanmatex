-- =============================================================================
-- 0410_b07_financial_outbox_processor.sql
-- B7 — Financial Outbox Processor (Order Fin Remediation Remediation_Work_Packages)
--
-- Purpose: the financial outbox (org_domain_events_outbox) has been emitted
-- into since migration 0292 but never consumed — claimBatch()/markProcessed()/
-- markFailed() exist in lib/services/outbox.service.ts but nothing ever calls
-- them. The only scheduled consumer, the `outbox-worker` cron job (0296),
-- calls a Supabase Edge Function whose handlers are placeholders and whose
-- own cron body is gated on an `app.settings.supabase_project_ref` GUC that
-- can never be set (Supabase's `postgres` role is not SUPERUSER — see 0355's
-- header comment, which hit and fixed the identical problem for the
-- notifications outbox). Net effect: the job has fired every minute since
-- 0296 and done nothing.
--
-- This migration:
--   1. Adds a DEAD_LETTERED status so an event that exhausts its retry
--      budget is unambiguous (today it stays FAILED with next_retry_at=NULL,
--      indistinguishable from "about to retry" without inspecting that column).
--   2. Seeds finance_outbox:view / finance_outbox:retry permissions + role
--      grants (super_admin, tenant_admin, admin, finance_manager) and a
--      sys_components_cd nav entry for the new ops-visibility screen.
--   3. Creates sys_fin_runtime_cf (mirrors sys_ntf_runtime_cf) holding the
--      base URL + a bearer secret for the new processor route, and schedules
--      `fin-outbox-processor` (every minute) via a SECURITY DEFINER wrapper +
--      net.http_post, the same working pattern 0355 established.
--   4. Unschedules the dead `outbox-worker` cron job (0296) so it stops
--      firing pointlessly and can never race the new processor over the same
--      table.
--
-- Unlike 0355, the bearer secret is generated HERE via gen_random_bytes() at
-- apply time rather than hardcoded in the migration file (CLAUDE.md: no
-- hardcoded secrets). After applying, retrieve it and copy it into
-- FINANCE_OUTBOX_SECRET in .env.local / .env.dbcloudjh:
--   SELECT value FROM sys_fin_runtime_cf WHERE key = 'outbox_secret_key';
-- To change the target URL later (e.g. local dev via pg_cron running in
-- Docker — see 0355's note on host.docker.internal):
--   UPDATE sys_fin_runtime_cf SET value = '...' WHERE key = 'base_url';
--
-- Authoritative report: H6, H7, §45, §50-B7.
-- Work package: docs/features/Order_Fin/Remediation_Work_Packages/B07_Financial_Outbox_Processor.md
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DEAD_LETTERED status
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_domain_events_outbox
  DROP CONSTRAINT IF EXISTS org_domain_events_outbox_status_check RESTRICT;

ALTER TABLE public.org_domain_events_outbox
  ADD CONSTRAINT org_domain_events_outbox_status_check
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTERED'));

-- -----------------------------------------------------------------------------
-- 2. Permissions + nav
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('finance_outbox:view', 'View Financial Outbox Health', 'عرض حالة صندوق الأحداث المالية',
   'crud', 'View pending/failed/dead-lettered financial outbox event counts and detail',
   'عرض عدد أحداث صندوق الأحداث المالية المعلقة والفاشلة والمتوقفة نهائيًا وتفاصيلها',
   'FinanceOps', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('finance_outbox:retry', 'Manually Retry Financial Outbox Event', 'إعادة محاولة حدث صندوق الأحداث المالية يدويًا',
   'actions', 'Manually re-queue a failed or dead-lettered financial outbox event',
   'إعادة جدولة حدث فاشل أو متوقف نهائيًا في صندوق الأحداث المالية يدويًا',
   'FinanceOps', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status;

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'finance_manager')
  AND p.code IN ('finance_outbox:view', 'finance_outbox:retry')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, metadata, rec_status
) VALUES (
  'finance_outbox_monitor', 'billing',
  'Outbox Monitor', 'مراقبة صندوق الأحداث',
  'Financial domain-event outbox health — pending/failed/dead-lettered counts and manual retry',
  'حالة صندوق أحداث النطاق المالي — عدد الأحداث المعلقة والفاشلة والمتوقفة نهائيًا وإعادة المحاولة يدويًا',
  '/dashboard/internal_fin/outbox', 'ServerCog',
  1, 71,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin","finance_manager"]'::jsonb,
  'finance_outbox:view',
  '{"feature":"financial_outbox_processor_b7"}'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code = EXCLUDED.parent_comp_code, label = EXCLUDED.label, label2 = EXCLUDED.label2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path, comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level, display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf, is_navigable = EXCLUDED.is_navigable, is_active = EXCLUDED.is_active,
  is_system = EXCLUDED.is_system, is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles, main_permission_code = EXCLUDED.main_permission_code,
  metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'finance_outbox_monitor'
  AND c.parent_comp_code = p.comp_code
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- -----------------------------------------------------------------------------
-- 3. Runtime config table + scheduled processor
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sys_fin_runtime_cf (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

REVOKE ALL ON public.sys_fin_runtime_cf FROM anon, authenticated;

INSERT INTO public.sys_fin_runtime_cf (key, value) VALUES
  ('base_url', 'https://cmx.cleanmatex.com')
ON CONFLICT (key) DO NOTHING;

-- Random per-environment secret — never hardcoded in the migration file.
-- Retrieve it after apply (see header comment) and copy into
-- FINANCE_OUTBOX_SECRET locally / in the deploy environment.
INSERT INTO public.sys_fin_runtime_cf (key, value) VALUES
  ('outbox_secret_key', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fin_trigger_outbox_proc()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  SELECT value INTO v_url    FROM sys_fin_runtime_cf WHERE key = 'base_url';
  SELECT value INTO v_secret FROM sys_fin_runtime_cf WHERE key = 'outbox_secret_key';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING '[fin_trigger_outbox_proc] sys_fin_runtime_cf is missing base_url or outbox_secret_key — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/api/finance/process-outbox',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret
               ),
    body    := '{}'::jsonb
  );
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'fin-outbox-processor';

SELECT cron.schedule(
  'fin-outbox-processor',
  '* * * * *',
  'SELECT public.fin_trigger_outbox_proc()'
);

-- -----------------------------------------------------------------------------
-- 4. Retire the dead outbox-worker cron job (0296) — superseded by the above.
--    Its edge-function handlers are placeholders and its own cron body has
--    been a permanent no-op since 0296 (gated on a GUC that can never be set
--    on Supabase's non-superuser postgres role). Leaving it scheduled would
--    only risk a future double-claim race once someone "fixes" the GUC.
-- -----------------------------------------------------------------------------

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'outbox-worker';

-- -----------------------------------------------------------------------------
-- 5. Verify
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_domain_events_outbox'::regclass
      AND conname = 'org_domain_events_outbox_status_check'
      AND pg_get_constraintdef(oid) ILIKE '%DEAD_LETTERED%'
  ), 'DEAD_LETTERED not added to org_domain_events_outbox status check';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_permissions WHERE code = 'finance_outbox:view'
  ), 'finance_outbox:view permission not seeded';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_permissions WHERE code = 'finance_outbox:retry'
  ), 'finance_outbox:retry permission not seeded';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'finance_outbox_monitor'
  ), 'finance_outbox_monitor nav component not seeded';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_fin_runtime_cf WHERE key = 'base_url'
  ), 'base_url config missing';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_fin_runtime_cf WHERE key = 'outbox_secret_key'
  ), 'outbox_secret_key config missing';

  ASSERT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'fin-outbox-processor' AND active = true
  ), 'fin-outbox-processor cron job not registered';

  ASSERT NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'outbox-worker'
  ), 'outbox-worker cron job was not unscheduled';
END;
$$;

COMMIT;
