-- =============================================================================
-- 0690_hq_doc_seq_role_grants.sql
-- Human-Friendly Codes (HFC) phase P11: grant the document numbering
-- permissions from 0688 to the HQ roles that need them (decision A-71,
-- replaces the manual DEV_GUIDE step 6a from decision A-54).
--
-- Grants written to hq_role_permissions (the source of truth):
--   TECH_ADMIN  hq_doc_seq:read, hq_general_config:read, hq_general_config:manage
--   SUPPORT     hq_doc_seq:read
-- SUPER_ADMIN is not touched: it holds '*', which matches every code.
-- The code is also appended to hq_roles.permissions (the JSON copy that the
-- HQ Roles screen keeps in sync) when it is not already there.
--
-- Guards: a role or permission that does not exist is skipped with a NOTICE.
-- Safe to run twice: ON CONFLICT DO NOTHING, and the JSON append checks first.
-- Nothing is dropped or deleted.
--
-- Note (decision A-72, comment only): the tenant feature flag 'label_printing'
-- is retired in code; labels are available to every tenant. Its row in
-- hq_ff_feature_flags_mst and its plan mappings are left in place. Removing
-- or deactivating them is a separate follow-up that needs approval.
--
-- Rollback:
--   DELETE FROM hq_role_permissions WHERE created_info = '0690 HFC doc seq role grants';
--   then remove the same codes from hq_roles.permissions for TECH_ADMIN and
--   SUPPORT (or re-save the two roles in the HQ Roles screen).
-- =============================================================================

DO $$
DECLARE
  g RECORD;
  v_rows INTEGER;
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
      RAISE NOTICE '0690: role % not found, skipped grant of %', g.role_code, g.permission_code;
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hq_permissions WHERE permission_code = g.permission_code) THEN
      RAISE NOTICE '0690: permission % not found (apply 0688 first), skipped for role %',
        g.permission_code, g.role_code;
      CONTINUE;
    END IF;

    INSERT INTO public.hq_role_permissions (role_code, permission_code, created_info)
    VALUES (g.role_code, g.permission_code, '0690 HFC doc seq role grants')
    ON CONFLICT (role_code, permission_code) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE NOTICE '0690: % already has %, left as is', g.role_code, g.permission_code;
    END IF;

    UPDATE public.hq_roles
       SET permissions = COALESCE(permissions, '[]'::jsonb) || jsonb_build_array(g.permission_code)
     WHERE role_code = g.role_code
       AND NOT (COALESCE(permissions, '[]'::jsonb) @> jsonb_build_array(g.permission_code));
  END LOOP;
END
$$;
