-- =============================================================================
-- 0635_ntf_sender_kind_check_trigger.sql
-- Purpose: DB-level check of sender_kind and capabilities.message_types against
--          sys_ntf_sender_kind_cd (0634) for the provider of the owning account.
--          Applies to sys_ntf_prov_send_mst and org_ntf_prov_send_mst.
--          Providers with no active lookup rows pass (soft rollout, same rule as the API).
-- Error:   ERRCODE 23514 (check_violation), message prefix 'ntf_sender_kind:'.
-- Idempotent: CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS.
-- SECURITY DEFINER: needed because sys_ntf_sender_kind_cd is readable by service_role only
--          and tenant writes may run as other roles. search_path is pinned.
-- =============================================================================

-- Read-only pre-check (run on the REMOTE DB before applying): rows that would fail the trigger.
-- WITH s AS (
--   SELECT 'platform' AS owner, s.id, a.provider_code, s.sender_kind, s.capabilities
--     FROM public.sys_ntf_prov_send_mst s JOIN public.sys_ntf_prov_acct_mst a ON a.id = s.account_id
--   UNION ALL
--   SELECT 'tenant', s.id, a.provider_code, s.sender_kind, s.capabilities
--     FROM public.org_ntf_prov_send_mst s
--     JOIN public.org_ntf_prov_acct_mst a ON a.id = s.account_id AND a.tenant_org_id = s.tenant_org_id
-- )
-- SELECT s.owner, s.id, s.provider_code, s.sender_kind, s.capabilities->'message_types' AS message_types,
--        CASE WHEN k.code IS NULL THEN 'sender_kind not allowed' ELSE 'message_types not allowed' END AS problem
--   FROM s
--   LEFT JOIN public.sys_ntf_sender_kind_cd k
--     ON k.provider_code = s.provider_code AND k.code = s.sender_kind AND k.is_active AND k.rec_status = 1
--  WHERE EXISTS (SELECT 1 FROM public.sys_ntf_sender_kind_cd x
--                 WHERE x.provider_code = s.provider_code AND x.is_active AND x.rec_status = 1)
--    AND (k.code IS NULL
--         OR (s.capabilities ? 'message_types'
--             AND jsonb_typeof(k.allowed_capabilities->'message_types') = 'array'
--             AND (jsonb_typeof(s.capabilities->'message_types') <> 'array'
--                  OR NOT (k.allowed_capabilities->'message_types') @> (s.capabilities->'message_types'))))
--  ORDER BY 1, 3, 4;
-- Expected: 0 rows. Fix any listed rows before applying.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_ntf_sender_kind_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_provider text;
  v_allowed  jsonb;
  v_found    boolean;
  v_types    jsonb;
BEGIN
  IF TG_TABLE_NAME = 'sys_ntf_prov_send_mst' THEN
    SELECT a.provider_code INTO v_provider
      FROM public.sys_ntf_prov_acct_mst a WHERE a.id = NEW.account_id;
  ELSE
    SELECT a.provider_code INTO v_provider
      FROM public.org_ntf_prov_acct_mst a
     WHERE a.id = NEW.account_id AND a.tenant_org_id = NEW.tenant_org_id;
  END IF;

  -- Unknown account: leave it to the FK. Provider without lookup rows: pass.
  IF v_provider IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.sys_ntf_sender_kind_cd k
        WHERE k.provider_code = v_provider AND k.is_active AND k.rec_status = 1) THEN
    RETURN NEW;
  END IF;

  SELECT true, k.allowed_capabilities INTO v_found, v_allowed
    FROM public.sys_ntf_sender_kind_cd k
   WHERE k.provider_code = v_provider AND k.code = NEW.sender_kind AND k.is_active AND k.rec_status = 1;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'ntf_sender_kind: sender kind % is not allowed for provider %', NEW.sender_kind, v_provider
      USING ERRCODE = '23514', HINT = 'Allowed kinds are listed in sys_ntf_sender_kind_cd.';
  END IF;

  IF NEW.capabilities IS NOT NULL AND jsonb_typeof(NEW.capabilities) = 'object'
     AND NEW.capabilities ? 'message_types'
     AND jsonb_typeof(v_allowed->'message_types') = 'array' THEN
    v_types := NEW.capabilities->'message_types';
    IF jsonb_typeof(v_types) <> 'array' OR NOT (v_allowed->'message_types') @> v_types THEN
      RAISE EXCEPTION 'ntf_sender_kind: capability message_types accepts only %', v_allowed->'message_types'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_sender_kind_check() IS
  'Trigger: sender_kind and capabilities.message_types must match sys_ntf_sender_kind_cd for the account provider (0635). Providers without lookup rows pass.';
REVOKE ALL ON FUNCTION public.fn_ntf_sender_kind_check() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_ntf_sender_kind_check ON public.sys_ntf_prov_send_mst;
CREATE TRIGGER trg_ntf_sender_kind_check
  BEFORE INSERT OR UPDATE OF sender_kind, capabilities, account_id ON public.sys_ntf_prov_send_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ntf_sender_kind_check();
COMMENT ON TRIGGER trg_ntf_sender_kind_check ON public.sys_ntf_prov_send_mst IS 'Checks sender_kind/capabilities against sys_ntf_sender_kind_cd (0635).';

DROP TRIGGER IF EXISTS trg_ntf_sender_kind_check ON public.org_ntf_prov_send_mst;
CREATE TRIGGER trg_ntf_sender_kind_check
  BEFORE INSERT OR UPDATE OF sender_kind, capabilities, account_id ON public.org_ntf_prov_send_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ntf_sender_kind_check();
COMMENT ON TRIGGER trg_ntf_sender_kind_check ON public.org_ntf_prov_send_mst IS 'Checks sender_kind/capabilities against sys_ntf_sender_kind_cd (0635).';

COMMIT;