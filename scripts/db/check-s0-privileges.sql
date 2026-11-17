-- Fails the session when the public key can still read or write a catalog table,
-- execute a SECURITY DEFINER function, select one of the seven catalog views,
-- or inherit those grants on a future object.
-- Run after 0745, 0746, and 0747, and after
-- scripts/db/s0-supabase-admin-default-privileges.sql:
--   psql "$PRIVILEGE_CHECK_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/check-s0-privileges.sql

DO $check$
DECLARE
  open_tables integer;
  open_definers integer;
  extra_definers integer;
  open_views integer;
  open_defaults integer;
  allowed text[] := ARRAY[
    'fix_order_data(p_tenant_org_id uuid, p_steps text[], p_order_id uuid, p_dry_run boolean)',
    'fn_auth_own_tenants()',
    'fn_auth_session_choose_tenant(p_org_user_id uuid)',
    'fn_auth_session_open_picker(p_remember_me boolean, p_ip_address inet, p_user_agent text, p_device_label text, p_device_id_hash text)',
    'fn_auth_session_validate(p_touch boolean, p_ip_address inet)',
    'fn_label_printing_resolve(p_tenant_id uuid, p_branch_id uuid)',
    'get_user_permissions()',
    'get_user_roles()',
    'get_user_tenants()',
    'has_all_permissions(p_permissions text[])',
    'has_any_permission(p_permissions text[])',
    'has_permission(p_permission text)',
    'has_resource_permission(p_permission text, p_resource_type text, p_resource_id uuid)'
  ];
BEGIN
  SELECT count(*) INTO open_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (
      c.relname LIKE 'sys\_%' ESCAPE '\'
      OR c.relname LIKE 'hq\_%' ESCAPE '\'
      OR c.relname = 'crm_track_test'
    )
    AND (
      NOT c.relrowsecurity
      OR NOT c.relforcerowsecurity
      OR has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('authenticated', c.oid, 'SELECT')
      OR has_table_privilege('authenticated', c.oid, 'INSERT')
      OR has_table_privilege('authenticated', c.oid, 'UPDATE')
      OR has_table_privilege('authenticated', c.oid, 'DELETE')
    );

  IF open_tables > 0 THEN
    RAISE EXCEPTION 's0 invariant failed: % catalog tables are readable or writable by anon or authenticated, or do not force row security', open_tables;
  END IF;

  SELECT count(*) INTO open_definers
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR EXISTS (
        SELECT 1
        FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS acl_item
        WHERE acl_item.grantee = 0
          AND acl_item.privilege_type = 'EXECUTE'
      )
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
    );

  IF open_definers > 0 THEN
    RAISE EXCEPTION 's0 invariant failed: % SECURITY DEFINER functions are executable by anon or PUBLIC, or have no search_path', open_definers;
  END IF;

  SELECT count(*) INTO extra_definers
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') <> ALL (allowed);

  IF extra_definers > 0 THEN
    RAISE EXCEPTION 's0 invariant failed: % SECURITY DEFINER functions are executable by authenticated and are not on the allowlist', extra_definers;
  END IF;

  SELECT count(*) INTO open_views
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND c.relname IN (
      'v_effective_tenant_settings',
      'vw_fin_coa_explorer',
      'vw_fin_effective_gov_for_tenant',
      'vw_fin_missing_required_usage',
      'vw_fin_open_exceptions',
      'vw_fin_tenant_readiness',
      'org_order_status_history_legacy'
    )
    AND (
      NOT coalesce(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
      OR has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('authenticated', c.oid, 'SELECT')
    );

  IF open_views > 0 THEN
    RAISE EXCEPTION 's0 invariant failed: % catalog views are still definer views or still selectable by anon or authenticated', open_views;
  END IF;

  SELECT count(*) INTO open_defaults
  FROM pg_default_acl a
  JOIN pg_namespace n ON n.oid = a.defaclnamespace
  JOIN pg_roles owner_role ON owner_role.oid = a.defaclrole
  CROSS JOIN LATERAL aclexplode(a.defaclacl) AS acl_item
  LEFT JOIN pg_roles grantee_role ON grantee_role.oid = acl_item.grantee
  WHERE n.nspname = 'public'
    AND owner_role.rolname IN ('postgres', 'supabase_admin')
    AND a.defaclobjtype IN ('r', 'S', 'f')
    AND (acl_item.grantee = 0 OR grantee_role.rolname IN ('anon', 'authenticated'));

  IF open_defaults > 0 THEN
    RAISE EXCEPTION 's0 invariant failed: % default privileges in public still grant anon, authenticated, or PUBLIC a table, sequence, or function. Run scripts/db/s0-supabase-admin-default-privileges.sql when the owner is supabase_admin.', open_defaults;
  END IF;
END
$check$;
