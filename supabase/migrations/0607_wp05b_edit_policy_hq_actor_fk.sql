-- ============================================================================
-- Migration: 0607_wp05b_edit_policy_hq_actor_fk.sql
-- Purpose:   Let an HQ operator start Pilot, publish, or retire an Edit Policy.
--            The lifecycle actor columns were constrained to auth.users, which
--            holds tenant logins. HQ authentication stores the operator in
--            hq_users, so promotion failed fk_wf_edit_pol_pilot_by. No policy
--            currently stores an actor, so the constraints can be retargeted
--            without rewriting rows.
-- Affected:  public.sys_wf_edit_policy_mst
-- Related:   0597_wp05b_order_edit_policy_foundation.sql, 0038_hq_platform_tables.sql
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Remove only the three actor constraints. RESTRICT fails if another object
-- depends on them; none does. The columns and their stored values stay.
ALTER TABLE public.sys_wf_edit_policy_mst
  DROP CONSTRAINT fk_wf_edit_pol_pilot_by RESTRICT,
  DROP CONSTRAINT fk_wf_edit_pol_pub_by RESTRICT,
  DROP CONSTRAINT fk_wf_edit_pol_ret_by RESTRICT;

-- HQ lifecycle evidence must name an HQ operator. RESTRICT keeps that evidence
-- when an operator account is later removed.
ALTER TABLE public.sys_wf_edit_policy_mst
  ADD CONSTRAINT fk_wf_edit_pol_pilot_by FOREIGN KEY (pilot_started_by) REFERENCES public.hq_users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT fk_wf_edit_pol_pub_by FOREIGN KEY (published_by) REFERENCES public.hq_users (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT fk_wf_edit_pol_ret_by FOREIGN KEY (retired_by) REFERENCES public.hq_users (id) ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_wf_edit_pol_pilot_by ON public.sys_wf_edit_policy_mst IS 'Preserves the HQ operator who first approved limited Pilot use.';
COMMENT ON CONSTRAINT fk_wf_edit_pol_pub_by ON public.sys_wf_edit_policy_mst IS 'Preserves the HQ operator who made the policy immutable production authority.';
COMMENT ON CONSTRAINT fk_wf_edit_pol_ret_by ON public.sys_wf_edit_policy_mst IS 'Preserves the HQ operator who stopped new assignments while retaining audit history.';

COMMIT;
