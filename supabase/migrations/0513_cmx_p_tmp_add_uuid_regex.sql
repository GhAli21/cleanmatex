-- ==================================================================
-- 0513_cmx_p_tmp_add_uuid_regex.sql
-- Purpose: Add uuid_regex column to cmx_p_tmp so the UUID format pattern
--          checked when chk_isuuid is true is DB-configurable instead of
--          hardcoded in application code.
-- Scope: platform HQ (service role). Not tenant-facing.
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

ALTER TABLE public.cmx_p_tmp
  ADD COLUMN IF NOT EXISTS uuid_regex TEXT;

COMMENT ON COLUMN public.cmx_p_tmp.uuid_regex IS
  'RFC 4122 UUID regex pattern (bare pattern, no delimiters/flags), matched case-insensitively against fields such as tenant_org_id when chk_isuuid is true. NULL/empty falls back to the app default pattern.';

-- Seed the existing row with the pattern currently hardcoded in
-- web-admin/lib/validations/cmx-temp-utils-para/validators/is-uuid-if-enabled.ts
UPDATE public.cmx_p_tmp
SET uuid_regex = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
WHERE uuid_regex IS NULL;

COMMIT;
