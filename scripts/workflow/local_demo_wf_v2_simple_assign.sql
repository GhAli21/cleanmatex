-- ============================================================
-- Script:    local_demo_wf_v2_simple_assign.sql
-- Purpose:   Local-only default assignment of WF_V2_SIMPLE (latest
--            Published) to the HQ test/demo tenant so new orders can
--            bind live policy. Matches remote: unpinned wf_version_no.
-- Affected:  org_wf_profile_assign_cf (one demo tenant row)
-- Related:   0445 (WF_V2_SIMPLE), 0470 (assign guard), 0472 (v2 live policy)
-- NOT a migration. Do not apply to remote/production. Agents never run this.
-- New orders only. Does not rewrite in-flight order profile versions.
-- ============================================================
-- Review, then run locally as postgres, for example:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/workflow/local_demo_wf_v2_simple_assign.sql
-- ============================================================

BEGIN;

DO $$
DECLARE
  c_tenant_id   CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
  c_assign_id   CONSTANT UUID := 'a2000000-0000-4000-8000-000000000011';
  v_found_id    UUID;
  v_profile_id  UUID;
  v_is_demo     BOOLEAN;
  v_published   INTEGER;
  v_existing    public.org_wf_profile_assign_cf%ROWTYPE;
BEGIN
  SELECT t.id, COALESCE(t.is_hq_test_demo, false)
  INTO v_found_id, v_is_demo
  FROM public.org_tenants_mst t
  WHERE t.id = c_tenant_id;

  IF v_found_id IS NULL THEN
    RAISE EXCEPTION
      'local demo assign refused: tenant % is missing',
      c_tenant_id;
  END IF;

  IF v_is_demo IS NOT TRUE THEN
    RAISE EXCEPTION
      'local demo assign refused: tenant % is not is_hq_test_demo',
      c_tenant_id;
  END IF;

  SELECT p.profile_id
  INTO v_profile_id
  FROM public.sys_wf_profiles_cd p
  WHERE p.profile_code = 'WF_V2_SIMPLE'
    AND p.is_active = true
    AND p.rec_status = 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'local demo assign refused: WF_V2_SIMPLE profile is missing or inactive';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_published
  FROM public.sys_wf_profile_ver_mst v
  WHERE v.profile_id = v_profile_id
    AND v.version_status = 'PUBLISHED'
    AND v.is_active = true
    AND v.rec_status = 1;

  IF COALESCE(v_published, 0) < 1 THEN
    RAISE EXCEPTION
      'local demo assign refused: WF_V2_SIMPLE has no PUBLISHED version (apply 0472 locally first)';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.org_wf_profile_assign_cf a
  WHERE a.tenant_org_id = c_tenant_id
    AND a.is_active = true
    AND a.rec_status = 1
    AND a.branch_id IS NULL
    AND a.service_code IS NULL
  ORDER BY a.created_at
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.wf_profile_id = v_profile_id
       AND v_existing.wf_version_no IS NULL
       AND v_existing.is_default = true
    THEN
      RAISE NOTICE
        'local demo assign skipped: tenant % already has unpinned default WF_V2_SIMPLE (%)',
        c_tenant_id,
        v_existing.id;
      RETURN;
    END IF;

    RAISE EXCEPTION
      'local demo assign refused: tenant % already has an active default-scope assignment % (profile %, version %)',
      c_tenant_id,
      v_existing.id,
      v_existing.wf_profile_id,
      v_existing.wf_version_no;
  END IF;

  INSERT INTO public.org_wf_profile_assign_cf (
    id,
    tenant_org_id,
    wf_profile_id,
    wf_version_no,
    branch_id,
    service_code,
    is_default,
    is_active,
    rec_status
  ) VALUES (
    c_assign_id,
    c_tenant_id,
    v_profile_id,
    NULL,
    NULL,
    NULL,
    true,
    true,
    1
  );
END $$;

SELECT
  a.id,
  a.tenant_org_id,
  p.profile_code,
  a.wf_version_no AS pinned_version_no,
  (
    SELECT v.version_no
    FROM public.sys_wf_profile_ver_mst v
    WHERE v.profile_id = a.wf_profile_id
      AND v.version_status = 'PUBLISHED'
      AND v.is_active = true
      AND v.rec_status = 1
    ORDER BY v.version_no DESC
    LIMIT 1
  ) AS resolves_to_published_version_no,
  a.is_default,
  a.is_active
FROM public.org_wf_profile_assign_cf a
JOIN public.sys_wf_profiles_cd p ON p.profile_id = a.wf_profile_id
WHERE a.tenant_org_id = '11111111-1111-1111-1111-111111111111'
  AND a.is_active = true
  AND a.rec_status = 1;

COMMIT;
