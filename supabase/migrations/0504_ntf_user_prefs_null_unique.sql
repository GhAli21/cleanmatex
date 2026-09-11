-- ============================================================
-- Migration: 0504_ntf_user_prefs_null_unique.sql
-- Purpose:   One user preference row per channel/event/branch,
--            including NULL event_code / branch_id (coarse prefs).
--            Legacy UNIQUE treated NULLs as distinct, so toggling
--            WhatsApp inserted a new row and the UI kept reading
--            the oldest disabled row.
-- Affected:  org_ntf_user_prefs_dtl
-- Related:   0347_ntf_tenant_settings.sql
-- ============================================================
-- Do not apply automatically. Review first.
-- ROLLBACK PLAN: DROP CONSTRAINT org_ntf_uprefs_scope_uk RESTRICT;
--                restore UNIQUE (tenant_org_id, user_id, channel_code, event_code, branch_id).
--                Deleted duplicate rows cannot be restored from this file.

BEGIN;

-- Keep the newest write per scope; extras made the settings toggle appear unsaved.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        tenant_org_id,
        user_id,
        channel_code,
        COALESCE(event_code, ''),
        COALESCE(branch_id::text, '')
      ORDER BY
        COALESCE(updated_at, created_at) DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.org_ntf_user_prefs_dtl
)
DELETE FROM public.org_ntf_user_prefs_dtl
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Replace NULLS DISTINCT unique so ON CONFLICT / inserts cannot create another coarse row.
ALTER TABLE public.org_ntf_user_prefs_dtl
  DROP CONSTRAINT IF EXISTS org_ntf_user_prefs_dtl_tenant_org_id_user_id_channel_code_e_key
  RESTRICT;

-- Enforces one coarse (NULL event/branch) or fine-grained pref per user.
ALTER TABLE public.org_ntf_user_prefs_dtl
  ADD CONSTRAINT org_ntf_uprefs_scope_uk
  UNIQUE NULLS NOT DISTINCT (tenant_org_id, user_id, channel_code, event_code, branch_id);

COMMENT ON CONSTRAINT org_ntf_uprefs_scope_uk ON public.org_ntf_user_prefs_dtl IS
  'One preference per user/channel/event/branch. NULL event_code or branch_id is a real coarse-scope key.';

COMMIT;
