-- ============================================================
-- Migration: 0473_wf_gate_decision_profile_version.sql
-- Purpose:   Gate warning/override ledger must name the live profile
--            version used at command time. New orders persist version
--            binding only, so requiring compiled artifact id blocks
--            acknowledgement/override inserts after 0470/0472.
-- Affected:  org_wf_gate_decision_mst
-- Related:   0462 (ledger), 0470 (live runtime), 0472 (business-level seed)
-- ============================================================

BEGIN;

ALTER TABLE public.org_wf_gate_decision_mst
  ADD COLUMN IF NOT EXISTS profile_version_id UUID;

COMMENT ON COLUMN public.org_wf_gate_decision_mst.profile_version_id IS
  'Live profile version evaluated when the warning or override was accepted.';

COMMENT ON COLUMN public.org_wf_gate_decision_mst.profile_artifact_id IS
  'Historical compiled artifact when the order still had one; nullable for live-version orders.';

-- Prefer the artifact's own version, then the order binding, so existing
-- acknowledgement rows keep a recoverable policy identity.
UPDATE public.org_wf_gate_decision_mst AS decision
SET profile_version_id = artifact.version_id
FROM public.sys_wf_prof_ver_artifact_cf AS artifact
WHERE decision.profile_artifact_id = artifact.artifact_id
  AND decision.profile_version_id IS NULL;

UPDATE public.org_wf_gate_decision_mst AS decision
SET profile_version_id = ord.wf_profile_version_id
FROM public.org_orders_mst AS ord
WHERE decision.order_id = ord.id
  AND decision.tenant_org_id = ord.tenant_org_id
  AND decision.profile_version_id IS NULL
  AND ord.wf_profile_version_id IS NOT NULL;

ALTER TABLE public.org_wf_gate_decision_mst
  ALTER COLUMN profile_artifact_id DROP NOT NULL;

ALTER TABLE public.org_wf_gate_decision_mst
  DROP CONSTRAINT IF EXISTS fk_wfgd_version,
  DROP CONSTRAINT IF EXISTS chk_wfgd_policy_ref;

ALTER TABLE public.org_wf_gate_decision_mst
  ADD CONSTRAINT fk_wfgd_version
    FOREIGN KEY (profile_version_id)
    REFERENCES public.sys_wf_profile_ver_mst (version_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT chk_wfgd_policy_ref
    CHECK (
      profile_version_id IS NOT NULL
      OR profile_artifact_id IS NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_wfgd_tn_ver
  ON public.org_wf_gate_decision_mst (tenant_org_id, profile_version_id);

COMMIT;
