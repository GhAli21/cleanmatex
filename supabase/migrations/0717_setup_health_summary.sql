-- =============================================================================
-- Migration: 0717_setup_health_summary.sql
-- Purpose:   Setup Health step 4b (docs/features/Setup_Health/PLAN.md, owner chose
--            "stored counts", 2026-11-07). Keeps the last Setup Health counts per
--            organization so the HQ Tenant Organizations list can show a "Setup"
--            column and filter "has blockers" with one join, instead of running
--            every check for every listed organization.
--            Also completes the standard audit columns on the two 0709 registry
--            tables (they were created with a partial set).
-- Affected:  org_setup_health_sum_tr (new), fn_setup_health_refresh_sum (new),
--            fn_setup_health_refresh_all (new), pg_cron job setup-health-refresh
--            (new) + its sys_ops_job_cf row, sys_setup_health_domain_cd and
--            sys_setup_health_check_cd (audit columns + trg_audit_touch).
-- Related:   0709 (registry, dispatcher), 0716, 0610/0657 (ops job registry),
--            0712 (fn_audit_touch_row). All must be applied BEFORE this file.
-- Counts are what HQ sees: checks whose feature flag is off for the
-- organization are left out (same rule as the HQ module); HQ-only checks count.
--
-- Rollback (forward-only, manual):
--   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'setup-health-refresh';
--   DELETE FROM sys_ops_job_cf WHERE job_code = 'setup-health-refresh';
--   DROP FUNCTION fn_setup_health_refresh_all() RESTRICT;
--   DROP FUNCTION fn_setup_health_refresh_sum(UUID) RESTRICT;
--   DROP TABLE org_setup_health_sum_tr RESTRICT;
--   (The added registry audit columns are harmless and can stay.)
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Full audit columns on the 0709 registry tables (same set and trigger as 0712)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  c RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_setup_health_domain_cd', 'sys_setup_health_check_cd']
  LOOP
    FOR c IN
      SELECT * FROM (VALUES
        ('updated_count', 'INTEGER NOT NULL DEFAULT 0', 'Number of updates (incremented by trigger).'),
        ('deleted_at',    'TIMESTAMPTZ NULL',           'When the row was soft-deleted.'),
        ('deleted_by',    'TEXT NULL',                  'Who soft-deleted the row.'),
        ('deleted_info',  'TEXT NULL',                  'Soft-delete context.'),
        ('rec_order',     'INTEGER NULL',               'Optional manual sort order.'),
        ('rec_notes',     'TEXT NULL',                  'Free notes about the record.')
      ) AS v(col, ddl, cmt)
    LOOP
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', t, c.col, c.ddl);
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', t, c.col, c.cmt);
    END LOOP;

    -- rec_status CHECK on tables whose CREATE TABLE did not declare one.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = format('public.%I', t)::regclass AND contype = 'c'
                      AND pg_get_constraintdef(oid) LIKE '%rec_status%') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (rec_status IN (0, 1, 2))', t, 'ck_' || left(t, 23) || '_rs');
      EXECUTE format('COMMENT ON CONSTRAINT %I ON public.%I IS %L', 'ck_' || left(t, 23) || '_rs', t, 'Allowed record statuses.');
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t, 'Keeps updated_at and updated_count current.');
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. org_setup_health_sum_tr — last counts per organization
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_setup_health_sum_tr (
  tenant_org_id  UUID        NOT NULL,                              -- Organization (one row each)
  blocker_count  INTEGER     NOT NULL DEFAULT 0,                    -- Failing BLOCKER checks
  warning_count  INTEGER     NOT NULL DEFAULT 0,                    -- Failing WARNING checks
  info_count     INTEGER     NOT NULL DEFAULT 0,                    -- Failing INFO checks
  error_count    INTEGER     NOT NULL DEFAULT 0,                    -- Checks that could not run
  checked_at     TIMESTAMPTZ NOT NULL,                              -- When these counts were computed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,    -- Row creation time
  created_by     TEXT        NULL,                                  -- Creator
  created_info   TEXT        NULL,                                  -- Creation context
  updated_at     TIMESTAMPTZ NULL,                                  -- Last update (trigger)
  updated_by     TEXT        NULL,                                  -- Last updater
  updated_info   TEXT        NULL,                                  -- Last update context
  updated_count  INTEGER     NOT NULL DEFAULT 0,                    -- Update counter (trigger)
  deleted_at     TIMESTAMPTZ NULL,                                  -- Soft-delete time
  deleted_by     TEXT        NULL,                                  -- Soft-delete actor
  deleted_info   TEXT        NULL,                                  -- Soft-delete context
  rec_status     SMALLINT    NOT NULL DEFAULT 1,                    -- 1 active, 0 deleted, 2 archived
  rec_order      INTEGER     NULL,                                  -- Optional sort order
  rec_notes      TEXT        NULL,                                  -- Free notes
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,                 -- Active flag
  CONSTRAINT pk_org_shc_sum PRIMARY KEY (tenant_org_id),
  CONSTRAINT fk_org_shc_sum_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  CONSTRAINT ck_org_shc_sum_counts CHECK (blocker_count >= 0 AND warning_count >= 0 AND info_count >= 0 AND error_count >= 0),
  CONSTRAINT ck_org_shc_sum_rs CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.org_setup_health_sum_tr IS
  'Last Setup Health counts per organization, as HQ sees them (flag-off checks excluded, HQ-only checks included). Written only by fn_setup_health_refresh_sum (HQ page view + nightly job). Read by the HQ Tenant Organizations list.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.tenant_org_id IS 'Organization (PK, FK org_tenants_mst). One row per organization.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.blocker_count IS 'Number of failing BLOCKER checks at checked_at.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.warning_count IS 'Number of failing WARNING checks at checked_at.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.info_count IS 'Number of failing INFO checks at checked_at.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.error_count IS 'Number of checks that returned ERROR at checked_at.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.checked_at IS 'When the counts were computed; HQ shows it so staff know how fresh they are.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.created_info IS 'Creation context (function, migration).';
COMMENT ON COLUMN public.org_setup_health_sum_tr.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_setup_health_sum_tr.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_setup_health_sum_tr.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.org_setup_health_sum_tr.is_active IS 'Active flag.';
COMMENT ON CONSTRAINT pk_org_shc_sum ON public.org_setup_health_sum_tr IS 'One summary row per organization.';
COMMENT ON CONSTRAINT fk_org_shc_sum_tenant ON public.org_setup_health_sum_tr IS 'Summary belongs to an organization; removed with it (derived data).';
COMMENT ON CONSTRAINT ck_org_shc_sum_counts ON public.org_setup_health_sum_tr IS 'Counts are never negative.';
COMMENT ON CONSTRAINT ck_org_shc_sum_rs ON public.org_setup_health_sum_tr IS 'Allowed record statuses.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_setup_health_sum_tr;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_setup_health_sum_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_setup_health_sum_tr IS 'Keeps updated_at and updated_count current.';

-- HQ data: RLS on with no policy, so only roles that bypass RLS (service role,
-- migrations, cron) read or write. Tenant users never need it (their app runs
-- the checks live).
ALTER TABLE public.org_setup_health_sum_tr ENABLE ROW LEVEL SECURITY;
-- Remove Supabase's default table grants for client roles; HQ uses the service role.
REVOKE ALL ON public.org_setup_health_sum_tr FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.org_setup_health_sum_tr TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Refresh functions
-- -----------------------------------------------------------------------------
-- Runs every check for one organization, drops checks whose feature flag is off
-- for it (hq_ff_get_effective_values_batch, same rule as the HQ module), and
-- upserts the counts. Returns the counts.
CREATE OR REPLACE FUNCTION public.fn_setup_health_refresh_sum(p_tenant UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_keys  TEXT[];
  v_flags JSONB := '{}'::jsonb;
  v_b INTEGER; v_w INTEGER; v_i INTEGER; v_e INTEGER;
BEGIN
  SELECT array_agg(DISTINCT c.feature_flag_key) FILTER (WHERE c.feature_flag_key IS NOT NULL)
  INTO v_keys
  FROM sys_setup_health_check_cd c
  WHERE c.is_active AND c.rec_status = 1;

  IF v_keys IS NOT NULL THEN
    v_flags := COALESCE(public.hq_ff_get_effective_values_batch(p_tenant, v_keys), '{}'::jsonb);
  END IF;

  SELECT count(*) FILTER (WHERE r.status = 'FAIL' AND r.severity = 'BLOCKER'),
         count(*) FILTER (WHERE r.status = 'FAIL' AND r.severity = 'WARNING'),
         count(*) FILTER (WHERE r.status = 'FAIL' AND r.severity = 'INFO'),
         count(*) FILTER (WHERE r.status = 'ERROR')
  INTO v_b, v_w, v_i, v_e
  FROM public.fn_setup_health_run(p_tenant, NULL, NULL) r
  -- Flag on = present and not false/null/0/"" (matches the HQ module's Boolean()).
  WHERE r.feature_flag_key IS NULL
     OR COALESCE(v_flags -> r.feature_flag_key, 'null'::jsonb)
        NOT IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb);

  INSERT INTO public.org_setup_health_sum_tr AS s
    (tenant_org_id, blocker_count, warning_count, info_count, error_count, checked_at, created_by, created_info)
  VALUES (p_tenant, v_b, v_w, v_i, v_e, now(), 'system', 'fn_setup_health_refresh_sum')
  ON CONFLICT (tenant_org_id) DO UPDATE
  SET blocker_count = EXCLUDED.blocker_count, warning_count = EXCLUDED.warning_count,
      info_count = EXCLUDED.info_count, error_count = EXCLUDED.error_count,
      checked_at = EXCLUDED.checked_at, updated_by = 'system', updated_info = 'fn_setup_health_refresh_sum';

  RETURN jsonb_build_object('blockers', v_b, 'warnings', v_w, 'infos', v_i, 'errors', v_e);
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_refresh_sum(UUID) IS
  'Setup Health: run all checks for one organization (flag-off checks excluded, HQ-only included) and upsert org_setup_health_sum_tr. Called by HQ when its Setup Health page loads and by fn_setup_health_refresh_all. Returns {blockers, warnings, infos, errors}.';

-- Nightly: refresh every active organization. One failing organization is
-- logged and skipped so the others still refresh. Returns how many refreshed.
CREATE OR REPLACE FUNCTION public.fn_setup_health_refresh_all()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_done   INTEGER := 0;
BEGIN
  FOR v_tenant IN
    SELECT t.id FROM public.org_tenants_mst t WHERE t.is_active AND t.rec_status = 1
  LOOP
    BEGIN
      PERFORM public.fn_setup_health_refresh_sum(v_tenant);
      v_done := v_done + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'fn_setup_health_refresh_all: tenant % failed: [%] %', v_tenant, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  RETURN v_done;
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_refresh_all() IS
  'Setup Health nightly job: fn_setup_health_refresh_sum for every active organization; a failing organization is logged and skipped. Returns the number refreshed.';

-- Writers are HQ (service role) and the cron job only; never client roles.
REVOKE ALL ON FUNCTION public.fn_setup_health_refresh_sum(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_setup_health_refresh_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_refresh_sum(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_refresh_all() TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Nightly job (02:15 UTC), registered in the HQ ops job registry
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2,
  category, module, sub_system, kind, cron_job_name,
  default_schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, restore_command, notes, created_info
) VALUES (
  'setup-health-refresh', 'Setup Health refresh', 'تحديث صحة الإعداد',
  'Every night: runs the Setup Health checks for every active organization and stores the counts shown in the HQ Tenant Organizations list.',
  'كل ليلة: يشغّل فحوصات صحة الإعداد لكل منشأة نشطة ويحفظ الأعداد التي تظهر في قائمة المنشآت في إدارة المنصة.',
  'OPS', 'setup_health', NULL, 'PG_CRON', 'setup-health-refresh',
  '15 2 * * *', true, true, 'SYNC',
  '0717', $cmd$SELECT public.fn_setup_health_refresh_all()$cmd$, NULL, '0717 seed'
)
ON CONFLICT (job_code) DO NOTHING;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'setup-health-refresh';
SELECT cron.schedule('setup-health-refresh', '15 2 * * *', $$ SELECT public.fn_setup_health_refresh_all() $$);

-- -----------------------------------------------------------------------------
-- 5. First fill + verification
-- -----------------------------------------------------------------------------
SELECT public.fn_setup_health_refresh_all();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'setup-health-refresh') THEN
    RAISE EXCEPTION '0717: setup-health-refresh cron job was not registered';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.org_tenants_mst t
    WHERE t.is_active AND t.rec_status = 1
      AND NOT EXISTS (SELECT 1 FROM public.org_setup_health_sum_tr s WHERE s.tenant_org_id = t.id)
  ) THEN
    RAISE EXCEPTION '0717: an active organization has no Setup Health summary row';
  END IF;
END $$;

COMMIT;
