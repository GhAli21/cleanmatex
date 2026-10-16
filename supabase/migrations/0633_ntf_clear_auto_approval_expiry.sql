-- Notification Hub: remove the automatic "approval valid until" dates so approved templates have NO time limit by default.
--
-- Until 2026-10-16 every Twilio template import or re-verify wrote approval_fresh_until = now + 24 hours, and route
-- activation was refused once that date had passed. The owner decided there must be no automatic limit: the date is now
-- an optional operator choice (HQ > Notifications > Tenant Config > Routes > "Approval valid until"), empty by default.
-- The HQ code no longer writes the date. This migration clears the dates that the old code wrote, because no operator
-- could have set one before the screen existed, so every existing value is an automatic one.
--
-- Affected: sys_ntf_prov_tmpl_reg_mst.approval_fresh_until (platform registrations) and
--           org_ntf_ptreg_mst.approval_fresh_until (tenant-private registrations, one tenant at a time, always with an
--           explicit tenant_org_id predicate). No other column is touched. Idempotent: a second run finds nothing to clear.
-- Related:  0574_ntf_provider_template_regs.sql, 0582_ntf_private_template_regs.sql
BEGIN;

-- Platform registrations (no tenant column on this global table).
UPDATE public.sys_ntf_prov_tmpl_reg_mst
   SET approval_fresh_until = NULL,
       updated_at = now(),
       updated_info = '0633: automatic approval expiry removed'
 WHERE approval_fresh_until IS NOT NULL;

-- Tenant-private registrations: one explicit tenant predicate per UPDATE.
DO $$
DECLARE
  v_tenant UUID;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT r.tenant_org_id FROM public.org_ntf_ptreg_mst r WHERE r.approval_fresh_until IS NOT NULL
  LOOP
    UPDATE public.org_ntf_ptreg_mst
       SET approval_fresh_until = NULL,
           updated_at = now(),
           updated_info = '0633: automatic approval expiry removed'
     WHERE tenant_org_id = v_tenant
       AND approval_fresh_until IS NOT NULL;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_ntf_prov_tmpl_reg_mst WHERE approval_fresh_until IS NOT NULL) THEN
    RAISE EXCEPTION '0633: a platform registration still has an approval expiry date';
  END IF;
END $$;

COMMIT;
