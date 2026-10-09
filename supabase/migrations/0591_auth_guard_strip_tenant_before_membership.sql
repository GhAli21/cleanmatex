-- ============================================================
-- Migration: 0591_auth_guard_strip_tenant_before_membership.sql
-- Purpose:   HQ "Create User" still fails with GoTrue's generic
--            "Database error creating new user".
-- Root cause: fn_auth_guard_user_tenant_meta() (0561) strips tenant_org_id
--            on INSERT, then raises 42501 on a later UPDATE that sets it
--            when the user has no active org_users_mst row. GoTrue's admin
--            createUser writes raw_user_meta_data again inside the same
--            signup, before HQ inserts the membership, so signup aborts with
--            "tenant_org_id in user metadata must be a tenant the user belongs to".
--            The demo tenant id 11111111-1111-1111-1111-111111111111 also
--            failed the old RFC-only pattern (variant nibble is not 8/9/a/b)
--            even after a real membership existed. Postgres uuid accepts any
--            8-4-4-4-12 hex value.
-- Fix:       When the user has no active membership, drop tenant_org_id
--            instead of aborting the signup. When they already belong to a
--            tenant, a changed tenant_org_id must still be one of those
--            active memberships, matched as a Postgres uuid.
-- Affected:  fn_auth_guard_user_tenant_meta()
-- Related:   0561 (introduced the guard), 0589 (search_path on the other trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_auth_guard_user_tenant_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_new_tenant TEXT;
  v_old_tenant TEXT;
  v_has_membership BOOLEAN;
BEGIN
  v_new_tenant := NULLIF(NEW.raw_user_meta_data ->> 'tenant_org_id', '');

  -- Sign-up cannot prove membership yet. Never store a tenant claim on INSERT.
  IF TG_OP = 'INSERT' THEN
    IF v_new_tenant IS NOT NULL THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'tenant_org_id';
    END IF;
    RETURN NEW;
  END IF;

  v_old_tenant := NULLIF(OLD.raw_user_meta_data ->> 'tenant_org_id', '');

  -- Unchanged or cleared values must not block profile or password updates.
  IF v_new_tenant IS NULL OR v_new_tenant IS NOT DISTINCT FROM v_old_tenant THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst ou
    WHERE ou.user_id = NEW.id
      AND ou.is_active = true
  )
  INTO v_has_membership;

  -- GoTrue applies the signup metadata with an UPDATE before any membership row
  -- exists. Drop the claim so user creation succeeds. HQ stamps the real tenant
  -- after org_users_mst is inserted.
  IF NOT v_has_membership THEN
    NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'tenant_org_id';
    RETURN NEW;
  END IF;

  -- Postgres uuid, not RFC 4122 only: seeded tenant ids are valid uuid values.
  IF v_new_tenant !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR NOT EXISTS (
       SELECT 1
       FROM org_users_mst ou
       WHERE ou.user_id = NEW.id
         AND ou.tenant_org_id = v_new_tenant::uuid
         AND ou.is_active = true
     ) THEN
    RAISE EXCEPTION 'tenant_org_id in user metadata must be a tenant the user belongs to'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_auth_guard_user_tenant_meta() IS
  'BEFORE INSERT/UPDATE guard on auth.users. Strips tenant_org_id on sign-up and on any metadata update while the user has no active org_users_mst row, so GoTrue admin createUser does not abort. After a membership exists, a changed tenant_org_id must be a Postgres uuid of an active membership or the update is rejected (42501).';
