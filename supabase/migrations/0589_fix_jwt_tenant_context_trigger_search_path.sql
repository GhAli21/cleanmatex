-- ============================================================
-- Migration: 0589_fix_jwt_tenant_context_trigger_search_path.sql
-- Purpose:   Fix a production outage: every new auth user creation (HQ console
--            "Create User", tenant self sign-up) fails with GoTrue's generic
--            "Database error creating new user".
-- Root cause: ensure_jwt_tenant_context_on_auth_user() (migration 0080) is a
--            SECURITY DEFINER trigger function on auth.users but never pinned
--            its search_path. supabase_auth_admin (the role GoTrue connects
--            as) has rolconfig search_path='auth' only, so when the function's
--            unqualified reference to org_users_mst (lives in public) is
--            reached, Postgres raises "relation org_users_mst does not exist"
--            inside the INSERT transaction; GoTrue swallows it and reports the
--            generic error.
--            Before 0561 this path was never reached on INSERT: the function
--            only queries org_users_mst when raw_user_meta_data is missing
--            'tenant_org_id', and callers (e.g. cleanmatexsaas-api
--            tenant-users.service.ts) always supplied it. Migration 0561 added
--            trg_auth_guard_user_tenant_meta, which (by design) strips
--            tenant_org_id from raw_user_meta_data on every INSERT. Trigger
--            execution order is alphabetical by name, and
--            'trg_auth_guard_user_tenant_meta' sorts before
--            'trg_ensure_jwt_tenant_context', so by the time the 0080 trigger
--            runs the key is always gone, the previously-dormant query path
--            now always executes, and the latent search_path bug now fires on
--            every single auth user creation/raw_user_meta_data update.
-- Fix:       Add SET search_path = public, auth, pg_temp to
--            ensure_jwt_tenant_context_on_auth_user(), identical to the
--            pattern already used by fn_auth_guard_user_tenant_meta() (0561).
--            No behavior change beyond making the existing, intended logic
--            resolve org_users_mst correctly; the trigger remains a no-op on
--            fresh INSERTs (the new user has no org_users_mst row yet) and
--            only populates tenant_org_id for existing users whose metadata
--            is later updated without it.
-- Affected:  ensure_jwt_tenant_context_on_auth_user()
-- Related:   0080 (introduced the function/trigger), 0561 (introduced the
--            INSERT-time strip that exposed this bug)
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_jwt_tenant_context_on_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_metadata JSONB;
  v_org_user_id UUID;
  v_auth_user_id UUID;

BEGIN
  -- Only process if user_metadata doesn't have tenant_org_id or it's being updated
  IF NEW.raw_user_meta_data IS NULL
     OR NOT (NEW.raw_user_meta_data ? 'tenant_org_id')
     OR (OLD.raw_user_meta_data IS NOT NULL
         AND OLD.raw_user_meta_data->>'tenant_org_id' IS DISTINCT FROM NEW.raw_user_meta_data->>'tenant_org_id') THEN

    -- Get the most recently accessed tenant for this user
    SELECT tenant_org_id, id --, user_id
    INTO v_tenant_id, v_org_user_id -- , v_auth_user_id
    FROM org_users_mst
    WHERE user_id = NEW.id
      AND is_active = true
    ORDER BY last_login_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    -- If user has a tenant, ensure it's in metadata
    IF v_tenant_id IS NOT NULL THEN
      -- Get current user_metadata or initialize empty object
      v_user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

      -- Update tenant_org_id in metadata if missing or different
      IF NOT (v_user_metadata ? 'tenant_org_id')
         OR v_user_metadata->>'tenant_org_id' IS DISTINCT FROM v_tenant_id::text THEN
        v_user_metadata := jsonb_set(
          v_user_metadata,
          '{tenant_org_id}',
          to_jsonb(v_tenant_id::text),
          true -- Create if doesn't exist
        );
        v_user_metadata := jsonb_set(
          v_user_metadata,
          '{org_user_id}',
          to_jsonb(v_org_user_id::text),
          true -- Create if doesn't exist
        );

        -- Update the user record
        NEW.raw_user_meta_data := v_user_metadata;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp;

COMMENT ON FUNCTION ensure_jwt_tenant_context_on_auth_user IS
  'BEFORE INSERT/UPDATE OF raw_user_meta_data trigger on auth.users: backfills tenant_org_id (and org_user_id) into metadata from the caller''s most recently used active org_users_mst membership when the key is absent. SECURITY DEFINER with search_path pinned to public, auth, pg_temp (fix: supabase_auth_admin''s session search_path is auth-only, so the prior unpinned function raised "relation org_users_mst does not exist" on every auth.users INSERT once 0561''s guard trigger started stripping tenant_org_id first, breaking all new-user creation). No-op on a brand-new INSERT (no org_users_mst row yet); populates it on a later metadata update once membership exists.';
