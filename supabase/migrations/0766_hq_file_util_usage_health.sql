-- =============================================================================
-- Migration: 0766_hq_file_util_usage_health.sql
-- Program:   File Util — Phase 7.5 (HQ File Setup: Storage usage + File health)
-- Purpose:
--   Three read-only functions for the HQ API (service_role only):
--   1. fn_hq_file_storage_usage     — one row per organization: storage used (READY files,
--      same rule as the tenant quota check), bytes still waiting for purge, file count,
--      and the plan storage limit; most used first; searchable and paginated.
--   2. fn_hq_file_storage_by_category — one organization's storage per file category.
--   3. fn_hq_file_health            — stuck uploads, deleted files not purged, bucket rows
--      whose storage bucket is missing (and storage buckets no row uses), last purge and
--      the last run of the `file-util-expire` cron job.
--   HQ reads across organizations by design: (1) and (3) aggregate every tenant's rows
--   grouped by tenant_org_id; (2) filters tenant_org_id explicitly. Nothing is written.
-- Plan limit: the active subscription's plan_code mapped to sys_plan_limits.plan_code the same
--   way as web-admin lib/constants/plan-codes.ts toLimitsPlanCode (FREE_TRIAL -> free, other
--   codes lower-cased). storage_mb_limit -1 = unlimited; NULL = no active subscription.
-- Target: new functions only (no table change). Indexes used: idx_ofm_quota, idx_ofm_pending,
--   idx_ofm_purge (0743).
-- Rollback: DROP FUNCTION for the three functions below.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Storage used per organization ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_hq_file_storage_usage(
  p_search TEXT DEFAULT NULL,
  p_limit  INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  tenant_org_id     UUID,
  tenant_name       TEXT,
  tenant_name2      TEXT,
  tenant_is_active  BOOLEAN,
  plan_code         TEXT,
  storage_mb_limit  INTEGER,
  used_bytes        BIGINT,
  file_count        BIGINT,
  unpurged_bytes    BIGINT,
  total_count       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH used AS (
    -- Same sum as the tenant quota check (getTenantStorageBytes): READY files plus thumbnails.
    SELECT f.tenant_org_id,
           SUM(f.size_bytes + COALESCE(f.thumb_size_bytes, 0))::BIGINT AS used_bytes,
           COUNT(*)::BIGINT AS file_count
      FROM public.org_file_mst f
     WHERE f.status_code = 'READY'
     GROUP BY f.tenant_org_id
  ), unpurged AS (
    -- Deleted but still in storage until the purge job removes the bytes.
    SELECT f.tenant_org_id, SUM(f.size_bytes + COALESCE(f.thumb_size_bytes, 0))::BIGINT AS bytes
      FROM public.org_file_mst f
     WHERE f.status_code = 'DELETED' AND f.purged_at IS NULL
     GROUP BY f.tenant_org_id
  ), sub AS (
    SELECT DISTINCT ON (s.tenant_org_id) s.tenant_org_id, s.plan_code
      FROM public.org_pln_subscriptions_mst s
     WHERE s.is_active = true
     ORDER BY s.tenant_org_id, s.created_at DESC
  ), rows AS (
    SELECT t.id AS tenant_org_id, t.name AS tenant_name, t.name2 AS tenant_name2, t.is_active AS tenant_is_active,
           sub.plan_code, pl.storage_mb_limit,
           COALESCE(u.used_bytes, 0) AS used_bytes, COALESCE(u.file_count, 0) AS file_count,
           COALESCE(up.bytes, 0) AS unpurged_bytes
      FROM public.org_tenants_mst t
      LEFT JOIN used u ON u.tenant_org_id = t.id
      LEFT JOIN unpurged up ON up.tenant_org_id = t.id
      LEFT JOIN sub ON sub.tenant_org_id = t.id
      LEFT JOIN public.sys_plan_limits pl
        ON pl.plan_code = CASE upper(sub.plan_code) WHEN 'FREE_TRIAL' THEN 'free' ELSE lower(sub.plan_code) END
     WHERE p_search IS NULL OR btrim(p_search) = ''
        OR t.name ILIKE '%' || btrim(p_search) || '%'
        OR t.name2 ILIKE '%' || btrim(p_search) || '%'
        OR t.slug ILIKE '%' || btrim(p_search) || '%'
  )
  SELECT r.tenant_org_id, r.tenant_name, r.tenant_name2, r.tenant_is_active, r.plan_code, r.storage_mb_limit,
         r.used_bytes, r.file_count, r.unpurged_bytes, COUNT(*) OVER ()::BIGINT AS total_count
    FROM rows r
   ORDER BY r.used_bytes DESC, r.tenant_name
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.fn_hq_file_storage_usage(TEXT, INTEGER, INTEGER) IS
  'HQ File Setup: storage used per organization (READY files + thumbnails, same as the tenant quota check), deleted bytes not yet purged, file count and plan storage limit (MB; -1 unlimited; NULL no active subscription). Most used first; p_search matches name, name2 or slug; p_limit 1..200. Read-only, service_role only.';

-- ─── 2. One organization's storage per category ────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_hq_file_storage_by_category(p_tenant_org_id UUID)
RETURNS TABLE (
  category_code  TEXT,
  name           TEXT,
  name2          TEXT,
  file_count     BIGINT,
  used_bytes     BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT c.category_code, c.name, c.name2,
         COUNT(f.id)::BIGINT AS file_count,
         COALESCE(SUM(f.size_bytes + COALESCE(f.thumb_size_bytes, 0)), 0)::BIGINT AS used_bytes
    FROM public.sys_file_category_cd c
    LEFT JOIN public.org_file_mst f
      ON f.category_code = c.category_code
     AND f.tenant_org_id = p_tenant_org_id
     AND f.status_code = 'READY'
   GROUP BY c.category_code, c.name, c.name2, c.rec_order
   ORDER BY used_bytes DESC, c.rec_order NULLS LAST, c.category_code;
$$;

COMMENT ON FUNCTION public.fn_hq_file_storage_by_category(UUID) IS
  'HQ File Setup: one organization''s READY storage per file category (every category listed, zero when unused). Filters tenant_org_id = p_tenant_org_id. Read-only, service_role only.';

-- ─── 3. File health ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_hq_file_health(p_stuck_hours INTEGER DEFAULT 25)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, storage, cron, pg_temp
AS $$
  SELECT jsonb_build_object(
    'stuck_hours', GREATEST(COALESCE(p_stuck_hours, 25), 1),
    -- PENDING uploads are removed by file-util-expire after 24 h; older ones mean that job is not running.
    'pending_total', (SELECT COUNT(*) FROM public.org_file_mst WHERE status_code = 'PENDING'),
    'pending_stuck', (SELECT COUNT(*) FROM public.org_file_mst
                       WHERE status_code = 'PENDING'
                         AND created_at < now() - make_interval(hours => GREATEST(COALESCE(p_stuck_hours, 25), 1))),
    'oldest_pending_at', (SELECT MIN(created_at) FROM public.org_file_mst WHERE status_code = 'PENDING'),
    -- Deleted files whose bytes the platform-workers purge job has not removed yet.
    'deleted_unpurged', (SELECT COUNT(*) FROM public.org_file_mst WHERE status_code = 'DELETED' AND purged_at IS NULL),
    'oldest_unpurged_at', (SELECT MIN(deleted_at) FROM public.org_file_mst WHERE status_code = 'DELETED' AND purged_at IS NULL),
    'last_purged_at', (SELECT MAX(purged_at) FROM public.org_file_mst),
    'buckets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'bucket_code', b.bucket_code, 'storage_bucket_id', b.storage_bucket_id,
               'is_public', b.is_public, 'is_active', b.is_active,
               'storage_exists', sb.id IS NOT NULL, 'storage_public', sb.public)
             ORDER BY b.rec_order NULLS LAST, b.bucket_code)
        FROM public.sys_file_bucket_cd b
        LEFT JOIN storage.buckets sb ON sb.id = b.storage_bucket_id), '[]'::jsonb),
    'unregistered_storage_buckets', COALESCE((
      SELECT jsonb_agg(sb.id ORDER BY sb.id)
        FROM storage.buckets sb
       WHERE NOT EXISTS (SELECT 1 FROM public.sys_file_bucket_cd b WHERE b.storage_bucket_id = sb.id)), '[]'::jsonb),
    'expire_job', (
      SELECT jsonb_build_object(
               'job_name', j.jobname, 'active', j.active, 'schedule', j.schedule,
               'last_run_at', d.start_time, 'last_status', d.status, 'last_message', left(d.return_message, 500))
        FROM cron.job j
        LEFT JOIN LATERAL (
          SELECT r.start_time, r.status, r.return_message
            FROM cron.job_run_details r
           WHERE r.jobid = j.jobid AND r.start_time IS NOT NULL
           ORDER BY r.start_time DESC
           LIMIT 1
        ) d ON true
       WHERE j.jobname = 'file-util-expire')
  );
$$;

COMMENT ON FUNCTION public.fn_hq_file_health(INTEGER) IS
  'HQ File Setup health: PENDING uploads (total, older than p_stuck_hours, oldest), DELETED files not yet purged (count, oldest), last purge time, each bucket row with whether its storage bucket exists and its visibility, storage buckets no row uses, and the last file-util-expire cron run. Read-only, service_role only.';

-- ─── Grants: HQ API (service_role) only ─────────────────────────────────────

REVOKE ALL ON FUNCTION public.fn_hq_file_storage_usage(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hq_file_storage_by_category(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hq_file_health(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_hq_file_storage_usage(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_hq_file_storage_by_category(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_hq_file_health(INTEGER) TO service_role;

COMMIT;
