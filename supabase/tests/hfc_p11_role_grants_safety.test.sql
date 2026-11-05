-- =============================================================================
-- hfc_p11_role_grants_safety.test.sql
-- Read-only checks for migration 0690_hq_doc_seq_role_grants (HFC P11, A-71).
-- Run after 0690 is applied. Fails with an exception; changes nothing (ROLLBACK).
-- A role that does not exist in this database is reported and skipped,
-- matching the migration's own guard.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  g RECORD;
  v_bad INTEGER;
BEGIN
  FOR g IN
    SELECT * FROM (
      VALUES
        ('TECH_ADMIN', 'hq_doc_seq:read'),
        ('TECH_ADMIN', 'hq_general_config:read'),
        ('TECH_ADMIN', 'hq_general_config:manage'),
        ('SUPPORT',    'hq_doc_seq:read')
    ) AS t(role_code, permission_code)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.hq_roles WHERE role_code = g.role_code) THEN
      RAISE NOTICE 'skip: role % not in this database', g.role_code;
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.hq_role_permissions
       WHERE role_code = g.role_code AND permission_code = g.permission_code
    ) THEN
      RAISE EXCEPTION 'FAIL: % is missing grant % in hq_role_permissions', g.role_code, g.permission_code;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.hq_roles
       WHERE role_code = g.role_code
         AND COALESCE(permissions, '[]'::jsonb) @> jsonb_build_array(g.permission_code)
    ) THEN
      RAISE EXCEPTION 'FAIL: hq_roles.permissions for % does not list %', g.role_code, g.permission_code;
    END IF;
  END LOOP;

  -- SUPPORT must not get the GENERAL config codes from 0690.
  SELECT count(*) INTO v_bad FROM public.hq_role_permissions
   WHERE role_code = 'SUPPORT'
     AND permission_code IN ('hq_general_config:read', 'hq_general_config:manage')
     AND created_info = '0690 HFC doc seq role grants';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'FAIL: 0690 granted GENERAL config codes to SUPPORT';
  END IF;

  -- 0690 writes only the four expected grants.
  SELECT count(*) INTO v_bad FROM public.hq_role_permissions
   WHERE created_info = '0690 HFC doc seq role grants'
     AND (role_code, permission_code) NOT IN (
       ('TECH_ADMIN', 'hq_doc_seq:read'),
       ('TECH_ADMIN', 'hq_general_config:read'),
       ('TECH_ADMIN', 'hq_general_config:manage'),
       ('SUPPORT',    'hq_doc_seq:read'));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'FAIL: 0690 wrote % unexpected grant(s)', v_bad;
  END IF;

  -- No duplicate codes in the JSON copy.
  SELECT count(*) INTO v_bad FROM (
    SELECT r.role_code, e.code
      FROM public.hq_roles r
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.permissions, '[]'::jsonb)) AS e(code)
     WHERE r.role_code IN ('TECH_ADMIN', 'SUPPORT')
     GROUP BY r.role_code, e.code HAVING count(*) > 1) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'FAIL: duplicate codes in hq_roles.permissions';
  END IF;

  RAISE NOTICE 'PASS: hfc_p11_role_grants_safety';
END
$$;

ROLLBACK;
