-- ============================================================================
-- 0457_semantic_workflow_profile_runtime.sql
-- Purpose: Replace the future profile-runtime path with a complete semantic
--          workflow policy and immutable compiled artifacts. The P0 graph-pin
--          tables remain historical/audit-only; this migration does not drop
--          them and does not activate any runtime code by itself.
-- Dependencies: 0427, 0444, 0453, 0454, 0456
-- Authority: ADR-SAAS-MNG-0009 and profile_policy_coverage_matrix.md
-- Apply: Review-only. User applies through the normal Supabase workflow.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Profile-version lifecycle and compiled-artifact metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.sys_wf_profile_ver_mst
  ADD COLUMN IF NOT EXISTS policy_revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS compiled_schema_version INTEGER,
  ADD COLUMN IF NOT EXISTS compiled_checksum TEXT,
  ADD COLUMN IF NOT EXISTS compiled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compiled_by UUID,
  ADD COLUMN IF NOT EXISTS current_artifact_id UUID,
  ADD COLUMN IF NOT EXISTS pilot_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pilot_started_by UUID;

ALTER TABLE public.sys_wf_profile_ver_mst
  DROP CONSTRAINT IF EXISTS chk_sys_wf_prof_ver_st,
  ADD CONSTRAINT chk_wf_prof_ver_lifecycle CHECK (
    version_status IN ('DRAFT', 'PILOT', 'PUBLISHED', 'RETIRED')
  ),
  ADD CONSTRAINT chk_wf_prof_ver_revision CHECK (policy_revision >= 1),
  ADD CONSTRAINT chk_wf_prof_ver_schema CHECK (
    compiled_schema_version IS NULL OR compiled_schema_version >= 1
  );

COMMENT ON COLUMN public.sys_wf_profile_ver_mst.policy_revision IS
  'Monotonic revision of editable Draft/Pilot semantic policy. Compiled artifacts bind to one exact revision.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.compiled_schema_version IS
  'Schema version used by the compiler for the current semantic artifact; NULL means no current compiled artifact.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.compiled_checksum IS
  'Deterministic checksum of the current semantic artifact; NULL means no current compiled artifact.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.compiled_at IS
  'Timestamp when the current semantic artifact passed compiler validation.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.compiled_by IS
  'HQ user or service identity that compiled the current semantic artifact.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.current_artifact_id IS
  'Latest valid semantic compiled artifact for this version. Existing orders retain their own artifact snapshot.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.pilot_started_at IS
  'HQ governance timestamp for a candidate version. PILOT assignment is restricted to HQ test/demo tenants.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.pilot_started_by IS
  'HQ user identity that first promoted this version to PILOT.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.version_status IS
  'DRAFT | PILOT | PUBLISHED | RETIRED. There is no unpublish transition.';
COMMENT ON CONSTRAINT chk_wf_prof_ver_lifecycle ON public.sys_wf_profile_ver_mst IS
  'Restricts profile versions to the controlled semantic-policy lifecycle.';
COMMENT ON CONSTRAINT chk_wf_prof_ver_revision ON public.sys_wf_profile_ver_mst IS
  'Prevents invalid zero or negative semantic-policy revisions.';
COMMENT ON CONSTRAINT chk_wf_prof_ver_schema ON public.sys_wf_profile_ver_mst IS
  'Allows no artifact metadata or a positive compiler schema version only.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_wf_prof_ver_id_scope
  ON public.sys_wf_profile_ver_mst (version_id, profile_id, version_no);

CREATE INDEX IF NOT EXISTS idx_wf_prof_ver_status
  ON public.sys_wf_profile_ver_mst (profile_id, version_status, policy_revision DESC)
  WHERE COALESCE(is_active, true) = true
    AND COALESCE(rec_status, 1) = 1;

COMMENT ON INDEX public.uq_wf_prof_ver_id_scope IS
  'Supports composite order snapshots that prove a version belongs to its profile and version number.';
COMMENT ON INDEX public.idx_wf_prof_ver_status IS
  'Supports active lifecycle and revision lookup while compiling, assigning, and resolving profiles.';

-- ---------------------------------------------------------------------------
-- 2) Semantic profile policy records. Module==Screen
-- These are global HQ-managed config rows;
--    they intentionally do not carry tenant_org_id or tenant RLS policies.
-- ---------------------------------------------------------------------------
-- Catalog capabilities remain global grammar. Existing gates default to false
-- so no warning or override behavior can be activated until its evaluator and
-- shared gate-decision service implement the required audited semantics.
ALTER TABLE public.sys_wf_gate_defs_cd
  ADD COLUMN IF NOT EXISTS supports_soft_warning BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_override BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sys_wf_gate_defs_cd.supports_soft_warning IS
  'Whether this registered gate evaluator may produce an acknowledged advisory warning; defaults false for safety.';
COMMENT ON COLUMN public.sys_wf_gate_defs_cd.supports_override IS
  'Whether this registered gate evaluator may be overridden by an authorized, audited command; defaults false for safety.';

-- The global initial-rule catalog is also the grammar for profile-version
-- initial rules. NULL means the selector matches both normal and quick-drop
-- orders; a boolean value makes the selector explicit.
ALTER TABLE public.sys_wf_initial_rules_cd
  ADD COLUMN IF NOT EXISTS is_quick_drop BOOLEAN;

COMMENT ON COLUMN public.sys_wf_initial_rules_cd.is_quick_drop IS
  'Optional quick-drop matcher for initial-status rule selection; NULL means any order, true quick drop, false normal order.';

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_module_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.sys_wf_profile_ver_mst (version_id) ON DELETE RESTRICT,
  screen_key TEXT NOT NULL REFERENCES public.sys_wf_screens_cd (screen_key) ON DELETE RESTRICT,
  module_mode TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_ver_module UNIQUE (version_id, screen_key),
  CONSTRAINT chk_wf_prof_mod_mode CHECK (
    module_mode IN ('primary_owner', 'observer', 'cross_cutting_command')
  )
);

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_mod_st_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  screen_key TEXT NOT NULL,
  status_code TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code) ON DELETE RESTRICT,
  visibility_mode TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_mod_status UNIQUE (version_id, screen_key, status_code),
  CONSTRAINT fk_wf_prof_mod_st_module FOREIGN KEY (version_id, screen_key)
    REFERENCES public.sys_wf_prof_ver_module_cf (version_id, screen_key) ON DELETE RESTRICT,
  CONSTRAINT chk_wf_prof_mod_st_mode CHECK (visibility_mode IN ('owner', 'observer'))
);

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_policy_cf (
  version_id UUID PRIMARY KEY REFERENCES public.sys_wf_profile_ver_mst (version_id) ON DELETE RESTRICT,
  policy_schema_version INTEGER NOT NULL DEFAULT 1,
  stage_sequence TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  use_preparation BOOLEAN NOT NULL DEFAULT true,
  use_assembly BOOLEAN NOT NULL DEFAULT true,
  use_qa BOOLEAN NOT NULL DEFAULT true,
  use_packing BOOLEAN NOT NULL DEFAULT true,
  track_individual_piece BOOLEAN NOT NULL DEFAULT false,
  orders_split_enabled BOOLEAN NOT NULL DEFAULT false,
  allow_back_steps BOOLEAN NOT NULL DEFAULT false,
  pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  public_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
  require_pickup_release BOOLEAN NOT NULL DEFAULT true,
  allow_direct_counter_pickup BOOLEAN NOT NULL DEFAULT false,
  require_collection_for_pickup BOOLEAN NOT NULL DEFAULT true,
  require_delivery_stop BOOLEAN NOT NULL DEFAULT true,
  require_collection_for_delivery BOOLEAN NOT NULL DEFAULT true,
  require_rack_before_release BOOLEAN NOT NULL DEFAULT true,
  pod_policy_code TEXT,
  financial_release_policy_code TEXT,
  partial_pickup_enabled BOOLEAN NOT NULL DEFAULT false,
  partial_delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  returns_enabled BOOLEAN NOT NULL DEFAULT false,
  otp_enabled BOOLEAN NOT NULL DEFAULT false,
  conditional_routing_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_notes TEXT,
  CONSTRAINT chk_wf_prof_policy_schema CHECK (policy_schema_version >= 1),
  CONSTRAINT chk_wf_prof_policy_partial CHECK (
    partial_pickup_enabled = false
    AND partial_delivery_enabled = false
    AND returns_enabled = false
    AND otp_enabled = false
    AND conditional_routing_enabled = false
  )
);

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_exec_cf (
  exec_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  screen_key TEXT NOT NULL,
  action_code TEXT NOT NULL REFERENCES public.sys_wf_actions_cd (action_code) ON DELETE RESTRICT,
  from_status TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code) ON DELETE RESTRICT,
  to_status TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code) ON DELETE RESTRICT,
  transition_kind TEXT NOT NULL DEFAULT 'fixed',
  permission_code TEXT,
  requires_expected_version BOOLEAN NOT NULL DEFAULT true,
  requires_idempotency BOOLEAN NOT NULL DEFAULT true,
  requires_reason BOOLEAN NOT NULL DEFAULT false,
  min_reason_length INTEGER NOT NULL DEFAULT 0,
  requires_evidence BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_exec UNIQUE (version_id, screen_key, action_code, from_status, to_status),
  CONSTRAINT fk_wf_prof_exec_module FOREIGN KEY (version_id, screen_key)
    REFERENCES public.sys_wf_prof_ver_module_cf (version_id, screen_key) ON DELETE RESTRICT,
  CONSTRAINT chk_wf_prof_exec_kind CHECK (transition_kind IN ('fixed', 'resume_from_hold')),
  CONSTRAINT chk_wf_prof_exec_reason CHECK (min_reason_length >= 0)
);

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_exec_ch_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_id UUID NOT NULL REFERENCES public.sys_wf_prof_ver_exec_cf (exec_id) ON DELETE RESTRICT,
  channel_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_exec_channel UNIQUE (exec_id, channel_code),
  CONSTRAINT chk_wf_prof_exec_channel CHECK (
    channel_code IN ('staff_web', 'mobile', 'api', 'integration', 'public_web', 'pos')
  )
);

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_exec_gate_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_id UUID NOT NULL REFERENCES public.sys_wf_prof_ver_exec_cf (exec_id) ON DELETE RESTRICT,
  gate_code TEXT NOT NULL REFERENCES public.sys_wf_gate_defs_cd (gate_code) ON DELETE RESTRICT,
  evaluator_version INTEGER NOT NULL DEFAULT 1,
  parameters_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  blocking_mode TEXT NOT NULL DEFAULT 'hard_block',
  message_key TEXT,
  override_permission_code TEXT,
  override_min_reason_length INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_exec_gate UNIQUE (exec_id, gate_code),
  CONSTRAINT chk_wf_prof_gate_eval CHECK (evaluator_version >= 1),
  -- Compiler must also confirm the selected gate catalog supports the selected
  -- mode. These rows describe policy only; runtime activation remains fail-closed
  -- until the shared gate-decision service is implemented and tested.
  CONSTRAINT chk_wf_prof_gate_mode CHECK (
    blocking_mode IN ('hard_block', 'soft_warning', 'override_allowed')
  ),
  CONSTRAINT chk_wf_prof_gate_override CHECK (
    (
      blocking_mode = 'override_allowed'
      AND override_permission_code IS NOT NULL
      AND override_min_reason_length >= 10
    ) OR (
      blocking_mode <> 'override_allowed'
      AND override_permission_code IS NULL
      AND override_min_reason_length = 0
    )
  ),
  CONSTRAINT chk_wf_prof_gate_message CHECK (
    blocking_mode = 'hard_block'
    OR NULLIF(BTRIM(message_key), '') IS NOT NULL
  ),
  CONSTRAINT fk_wf_prof_gate_override_perm FOREIGN KEY (override_permission_code)
    REFERENCES public.sys_auth_permissions (code) ON DELETE RESTRICT,
  CONSTRAINT chk_wf_prof_gate_params CHECK (jsonb_typeof(parameters_json) = 'object')
);

-- Version-specific use of a catalog initial rule. The catalog owns the rule
-- identity and evaluator support; this row owns the compiled profile behavior.
CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_init_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.sys_wf_profile_ver_mst (version_id) ON DELETE RESTRICT,
  rule_code TEXT NOT NULL REFERENCES public.sys_wf_initial_rules_cd (rule_code) ON DELETE RESTRICT,
  order_source_code TEXT,
  order_type_id TEXT,
  is_retail BOOLEAN,
  is_quick_drop BOOLEAN,
  initial_status TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  name TEXT,
  name2 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_init_rule UNIQUE (version_id, rule_code)
);

CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_evidence_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.sys_wf_profile_ver_mst (version_id) ON DELETE RESTRICT,
  fulfilment_channel TEXT NOT NULL,
  evidence_method_code TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  minimum_count INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_evidence UNIQUE (version_id, fulfilment_channel, evidence_method_code),
  CONSTRAINT chk_wf_prof_ev_channel CHECK (fulfilment_channel IN ('pickup', 'delivery')),
  CONSTRAINT chk_wf_prof_ev_count CHECK (minimum_count >= 0)
);

-- Persistent schema dictionary: module ownership, status visibility, and the
-- policy switches are read by the compiler; they are not runtime fallbacks.
COMMENT ON TABLE public.sys_wf_prof_ver_module_cf IS
  'Profile-version module policy. A module is the policy representation of one workflow screen.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.id IS 'Stable module-policy row identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.version_id IS 'Profile version that owns this module policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.screen_key IS 'Global workflow screen governed by this module policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.module_mode IS 'Screen role: primary_owner, observer, or cross_cutting_command.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.is_enabled IS 'Whether this screen is enabled for the profile version.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.display_order IS 'Deterministic display and compiler ordering for the module.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_module_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_ver_module ON public.sys_wf_prof_ver_module_cf IS
  'Prevents two policy roles for the same screen in one profile version.';
COMMENT ON CONSTRAINT chk_wf_prof_mod_mode ON public.sys_wf_prof_ver_module_cf IS
  'Restricts module role to runtime semantics implemented by the compiler.';

COMMENT ON TABLE public.sys_wf_prof_ver_mod_st_cf IS
  'Profile-version ownership or observer visibility for a specific workflow status on a module.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.id IS 'Stable module-status policy row identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.version_id IS 'Profile version that owns this status policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.screen_key IS 'Module screen to which the status visibility applies.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.status_code IS 'Workflow status governed by this module visibility policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.visibility_mode IS 'Whether the module owns the status or observes it read-only.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.display_order IS 'Deterministic ordering for stage and workboard projections.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_mod_st_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_mod_status ON public.sys_wf_prof_ver_mod_st_cf IS
  'Prevents duplicate module-status policy rows within one profile version.';
COMMENT ON CONSTRAINT fk_wf_prof_mod_st_module ON public.sys_wf_prof_ver_mod_st_cf IS
  'Requires every status policy to belong to an existing profile module.';
COMMENT ON CONSTRAINT chk_wf_prof_mod_st_mode ON public.sys_wf_prof_ver_mod_st_cf IS
  'Restricts status visibility to the implemented owner or observer semantics.';

COMMENT ON TABLE public.sys_wf_prof_ver_policy_cf IS
  'One semantic operational policy per workflow profile version, compiled into the immutable artifact.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.version_id IS 'Profile version that owns this one-to-one policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.policy_schema_version IS 'Authoring-policy schema version understood by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.stage_sequence IS 'Ordered canonical stages allowed by this profile version.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.use_preparation IS 'Enables the preparation operational stage.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.use_assembly IS 'Enables the assembly operational stage.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.use_qa IS 'Enables the quality-assurance operational stage.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.use_packing IS 'Enables the packing operational stage.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.track_individual_piece IS 'Enables piece-level tracking semantics.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.orders_split_enabled IS 'Enables order-split semantics when compiler support exists.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.allow_back_steps IS 'Enables configured, audited backward transitions.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.pickup_enabled IS 'Enables customer counter-pickup fulfilment.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.delivery_enabled IS 'Enables delivery-route fulfilment.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.public_tracking_enabled IS 'Enables public tracking links for this profile version.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.require_pickup_release IS 'Requires a release record before customer pickup handover.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.allow_direct_counter_pickup IS 'Allows immediate counter handover without an earlier pickup release.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.require_collection_for_pickup IS 'Requires configured financial clearance before pickup completion.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.require_delivery_stop IS 'Requires an assigned delivery stop before delivery completion.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.require_collection_for_delivery IS 'Requires configured financial clearance before delivery completion.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.require_rack_before_release IS 'Requires a recorded rack location before pickup or delivery release.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.pod_policy_code IS 'Optional configured proof-of-delivery policy code.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.financial_release_policy_code IS 'Optional configured financial release policy code.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.partial_pickup_enabled IS 'Reserved capability; must remain false until partial pickup is implemented end-to-end.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.partial_delivery_enabled IS 'Reserved capability; must remain false until partial delivery is implemented end-to-end.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.returns_enabled IS 'Reserved capability; must remain false until returns are implemented end-to-end.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.otp_enabled IS 'Reserved capability; must remain false until OTP is explicitly introduced.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.conditional_routing_enabled IS 'Reserved capability; must remain false until conditional routing has deterministic runtime semantics.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT chk_wf_prof_policy_schema ON public.sys_wf_prof_ver_policy_cf IS
  'Requires a positive authoring-policy schema version.';
COMMENT ON CONSTRAINT chk_wf_prof_policy_partial ON public.sys_wf_prof_ver_policy_cf IS
  'Prevents unsupported partial fulfilment, returns, OTP, and conditional routing from being enabled prematurely.';

COMMENT ON TABLE public.sys_wf_prof_ver_exec_cf IS
  'Explicit executable workflow transition policy for a profile version and owning screen.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.exec_id IS 'Stable executable-transition policy identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.version_id IS 'Profile version that owns this executable transition.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.screen_key IS 'Owning workflow screen that may expose this action.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.action_code IS 'Catalog action invoked by this transition.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.from_status IS 'Required current workflow status before the action executes.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.to_status IS 'Resulting workflow status after successful action execution.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.transition_kind IS 'Transition behavior: fixed destination or resume-from-hold.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.permission_code IS 'Optional RBAC permission required in addition to the action contract.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.requires_expected_version IS 'Requires optimistic-concurrency state version from the caller.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.requires_idempotency IS 'Requires an idempotency key for replay-safe command execution.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.requires_reason IS 'Requires an auditable staff reason before execution.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.min_reason_length IS 'Minimum permitted reason length when a reason is required.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.requires_evidence IS 'Requires evidence policy satisfaction before execution.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.display_order IS 'Deterministic display ordering for stage action panels.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_exec ON public.sys_wf_prof_ver_exec_cf IS
  'Prevents duplicate action transitions for the same profile context.';
COMMENT ON CONSTRAINT fk_wf_prof_exec_module ON public.sys_wf_prof_ver_exec_cf IS
  'Requires every executable transition to belong to an enabled profile module definition.';
COMMENT ON CONSTRAINT chk_wf_prof_exec_kind ON public.sys_wf_prof_ver_exec_cf IS
  'Restricts transition behavior to runtime semantics currently implemented.';
COMMENT ON CONSTRAINT chk_wf_prof_exec_reason ON public.sys_wf_prof_ver_exec_cf IS
  'Prevents invalid negative reason-length requirements.';

CREATE INDEX IF NOT EXISTS idx_wf_prof_mod_version
  ON public.sys_wf_prof_ver_module_cf (version_id, display_order)
  WHERE COALESCE(is_active, true) = true
    AND COALESCE(rec_status, 1) = 1;

CREATE INDEX IF NOT EXISTS idx_wf_prof_mod_st_status
  ON public.sys_wf_prof_ver_mod_st_cf (version_id, status_code, display_order)
  WHERE COALESCE(is_active, true) = true
    AND COALESCE(rec_status, 1) = 1;

CREATE INDEX IF NOT EXISTS idx_wf_prof_exec_lookup
  ON public.sys_wf_prof_ver_exec_cf (version_id, screen_key, from_status, action_code)
  WHERE COALESCE(is_active, true) = true
    AND COALESCE(rec_status, 1) = 1;

CREATE INDEX IF NOT EXISTS idx_wf_prof_init_lookup
  ON public.sys_wf_prof_ver_init_cf (version_id, priority, rule_code)
  WHERE COALESCE(is_active, true) = true
    AND COALESCE(rec_status, 1) = 1;

COMMENT ON TABLE public.sys_wf_prof_ver_exec_ch_cf IS
  'Allowed command channels for one executable transition policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.id IS 'Stable executable-channel policy row identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.exec_id IS 'Executable transition allowed through this channel.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.channel_code IS 'Caller channel: staff_web, mobile, api, integration, public_web, or pos.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_ch_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_exec_channel ON public.sys_wf_prof_ver_exec_ch_cf IS
  'Prevents duplicate channel policy for one executable transition.';
COMMENT ON CONSTRAINT chk_wf_prof_exec_channel ON public.sys_wf_prof_ver_exec_ch_cf IS
  'Restricts channels to transport semantics implemented by the shared command runtime.';

COMMENT ON TABLE public.sys_wf_prof_ver_exec_gate_cf IS
  'Configured hard gate applied to one executable transition before state mutation.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.id IS 'Stable executable-gate policy row identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.exec_id IS 'Executable transition protected by this gate.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.gate_code IS 'Global gate evaluator selected for this transition.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.evaluator_version IS 'Positive evaluator contract version expected by the runtime.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.parameters_json IS 'Validated object parameters supplied to the selected gate evaluator.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.blocking_mode IS
  'Gate failure behavior: hard_block, acknowledged soft_warning, or authorized override_allowed.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.message_key IS 'Optional i18n key for a safe user-facing gate failure message.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.override_permission_code IS
  'Required RBAC permission for override_allowed gate decisions; must reference an active platform permission.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.override_min_reason_length IS
  'Minimum audited override-reason length; zero is permitted only when override is not allowed.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.display_order IS 'Deterministic gate evaluation and display ordering.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_exec_gate ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Prevents duplicate gate selection for one executable transition.';
COMMENT ON CONSTRAINT chk_wf_prof_gate_eval ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Requires a positive evaluator contract version.';
COMMENT ON CONSTRAINT chk_wf_prof_gate_mode ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Restricts gate behavior to hard block, acknowledged warning, or authorized override semantics.';
COMMENT ON CONSTRAINT chk_wf_prof_gate_override ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Requires an RBAC permission and a meaningful reason for override mode; forbids override fields for other modes.';
COMMENT ON CONSTRAINT chk_wf_prof_gate_message ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Requires an i18n message key for warning or override interactions.';
COMMENT ON CONSTRAINT fk_wf_prof_gate_override_perm ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Requires override authorization to reference a registered platform permission.';
COMMENT ON CONSTRAINT chk_wf_prof_gate_params ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Requires gate parameters to be a JSON object, not an array or scalar.';

COMMENT ON TABLE public.sys_wf_prof_ver_init_cf IS
  'Version-specific initial-status policy selected from the global initial-rule catalog.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.id IS 'Stable profile initial-rule policy row identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.version_id IS 'Profile version that owns this initial-rule policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.rule_code IS 'Required global initial-rule catalog identity and evaluator contract.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.order_source_code IS 'Optional source matcher; NULL means any order source.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.order_type_id IS 'Optional order-type matcher; NULL means any order type.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.is_retail IS 'Optional retail matcher; NULL means retail and non-retail orders.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.is_quick_drop IS 'Optional quick-drop matcher; NULL means normal and quick-drop orders.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.initial_status IS 'Initial workflow status assigned when this rule is selected.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.priority IS 'Ascending deterministic precedence when multiple initial rules match.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.name IS 'Optional HQ display name for the version-specific rule policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.name2 IS 'Optional Arabic HQ display name for the version-specific rule policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_init_rule ON public.sys_wf_prof_ver_init_cf IS
  'Prevents duplicate use of the same catalog rule in one profile version.';

COMMENT ON TABLE public.sys_wf_prof_ver_evidence_cf IS
  'Profile-version proof requirements for pickup or delivery fulfilment.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.id IS 'Stable fulfilment-evidence policy row identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.version_id IS 'Profile version that owns this evidence policy.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.fulfilment_channel IS 'Fulfilment path: pickup or delivery.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.evidence_method_code IS 'Evidence method recognized by the shared fulfilment evidence service.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.is_required IS 'Whether this evidence method is mandatory for completion.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.minimum_count IS 'Minimum number of evidence records required for this method.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.display_order IS 'Deterministic evidence collection and display ordering.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.created_at IS 'UTC timestamp when the policy row was created.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.created_by IS 'Actor that created the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.created_info IS 'Optional request or source context for creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.updated_at IS 'UTC timestamp of the most recent policy-row update.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.updated_by IS 'Actor that last updated the policy row.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.updated_info IS 'Optional request or source context for update audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.rec_status IS 'Standard record lifecycle status; active compiler inputs use value 1.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.is_active IS 'Soft-enable flag evaluated by the compiler.';
COMMENT ON COLUMN public.sys_wf_prof_ver_evidence_cf.rec_notes IS 'Auditable HQ notes about this policy row.';
COMMENT ON CONSTRAINT uq_wf_prof_evidence ON public.sys_wf_prof_ver_evidence_cf IS
  'Prevents duplicate evidence-method policy for one fulfilment channel.';
COMMENT ON CONSTRAINT chk_wf_prof_ev_channel ON public.sys_wf_prof_ver_evidence_cf IS
  'Restricts evidence policy to pickup or delivery fulfilment.';
COMMENT ON CONSTRAINT chk_wf_prof_ev_count ON public.sys_wf_prof_ver_evidence_cf IS
  'Prevents invalid negative evidence-count requirements.';

COMMENT ON INDEX public.idx_wf_prof_mod_version IS
  'Supports active ordered module lookup while compiling a profile version.';
COMMENT ON INDEX public.idx_wf_prof_mod_st_status IS
  'Supports active status ownership and observer lookup while compiling a profile version.';
COMMENT ON INDEX public.idx_wf_prof_exec_lookup IS
  'Supports active action lookup by profile version, screen, current status, and action.';
COMMENT ON INDEX public.idx_wf_prof_init_lookup IS
  'Supports deterministic active initial-rule resolution by profile version and priority.';

-- ---------------------------------------------------------------------------
-- 3) Immutable compiler output. JSONB is permitted here because it is a
--    validated, canonical artifact, never tenant-authored executable logic.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_artifact_cf (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.sys_wf_profile_ver_mst (version_id) ON DELETE RESTRICT,
  policy_revision INTEGER NOT NULL,
  artifact_schema_version INTEGER NOT NULL,
  artifact_checksum TEXT NOT NULL,
  compile_state TEXT NOT NULL,
  compiled_artifact JSONB NOT NULL,
  validation_report JSONB NOT NULL DEFAULT '{}'::JSONB,
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  compiled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT uq_wf_prof_art_revision UNIQUE (version_id, policy_revision),
  CONSTRAINT uq_wf_prof_art_snapshot UNIQUE (
    artifact_id,
    version_id,
    policy_revision,
    artifact_schema_version,
    artifact_checksum
  ),
  CONSTRAINT chk_wf_prof_art_revision CHECK (policy_revision >= 1),
  CONSTRAINT chk_wf_prof_art_schema CHECK (artifact_schema_version >= 1),
  CONSTRAINT chk_wf_prof_art_state CHECK (compile_state IN ('VALID', 'INVALID')),
  CONSTRAINT chk_wf_prof_art_body CHECK (jsonb_typeof(compiled_artifact) = 'object'),
  CONSTRAINT chk_wf_prof_art_report CHECK (jsonb_typeof(validation_report) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_wf_prof_art_version
  ON public.sys_wf_prof_ver_artifact_cf (version_id, policy_revision DESC, compiled_at DESC);

COMMENT ON TABLE public.sys_wf_prof_ver_artifact_cf IS
  'Append-only validated compiler output for one exact semantic profile policy revision.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.artifact_id IS 'Stable immutable compiled-artifact identifier.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.version_id IS 'Profile version compiled into this artifact.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.policy_revision IS 'Exact editable-policy revision compiled into this artifact.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.artifact_schema_version IS 'Artifact serialization schema understood by semantic runtime consumers.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.artifact_checksum IS 'Deterministic checksum proving the exact compiled artifact content.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.compile_state IS 'Compiler result: VALID artifacts may be assigned or published; INVALID artifacts are audit-only.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.compiled_artifact IS 'Canonical compiler output consumed by the tenant runtime; never free-form authoring input.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.validation_report IS 'Structured compiler diagnostics for HQ review and remediation.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.compiled_at IS 'UTC timestamp when compilation completed.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.compiled_by IS 'HQ user or service identity that compiled this artifact.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.created_at IS 'UTC timestamp when the immutable artifact record was inserted.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.created_by IS 'Actor that inserted the immutable artifact record.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.created_info IS 'Optional request or source context for artifact creation audit.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.updated_at IS 'Reserved audit field; immutable artifacts must not be updated.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.updated_by IS 'Reserved audit field; immutable artifacts must not be updated.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.updated_info IS 'Reserved audit field; immutable artifacts must not be updated.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.rec_status IS 'Standard record lifecycle status retained for audit; immutable artifacts are never soft-mutated.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.rec_order IS 'Optional administrative ordering value retained for platform audit convention.';
COMMENT ON COLUMN public.sys_wf_prof_ver_artifact_cf.rec_notes IS 'Auditable HQ notes about this compiler result.';
COMMENT ON CONSTRAINT uq_wf_prof_art_revision ON public.sys_wf_prof_ver_artifact_cf IS
  'Allows one immutable compiler result for each profile version and policy revision.';
COMMENT ON CONSTRAINT uq_wf_prof_art_snapshot ON public.sys_wf_prof_ver_artifact_cf IS
  'Supports composite foreign keys that bind orders to one exact artifact identity and metadata.';
COMMENT ON CONSTRAINT chk_wf_prof_art_revision ON public.sys_wf_prof_ver_artifact_cf IS
  'Requires a positive policy revision.';
COMMENT ON CONSTRAINT chk_wf_prof_art_schema ON public.sys_wf_prof_ver_artifact_cf IS
  'Requires a positive artifact serialization schema version.';
COMMENT ON CONSTRAINT chk_wf_prof_art_state ON public.sys_wf_prof_ver_artifact_cf IS
  'Restricts compiler output to the supported VALID or INVALID states.';
COMMENT ON CONSTRAINT chk_wf_prof_art_body ON public.sys_wf_prof_ver_artifact_cf IS
  'Requires canonical compiler output to be a JSON object.';
COMMENT ON CONSTRAINT chk_wf_prof_art_report ON public.sys_wf_prof_ver_artifact_cf IS
  'Requires compiler diagnostics to be a JSON object.';
COMMENT ON INDEX public.idx_wf_prof_art_version IS
  'Supports latest-artifact lookup and historical compiler audit by profile version.';

ALTER TABLE public.sys_wf_profile_ver_mst
  DROP CONSTRAINT IF EXISTS fk_wf_prof_ver_artifact,
  ADD CONSTRAINT fk_wf_prof_ver_artifact
    FOREIGN KEY (current_artifact_id)
    REFERENCES public.sys_wf_prof_ver_artifact_cf (artifact_id)
    ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_wf_prof_ver_artifact ON public.sys_wf_profile_ver_mst IS
  'References the current valid immutable artifact while preserving historical order snapshots.';

-- ---------------------------------------------------------------------------
-- 4) Exact semantic policy snapshot on new orders. Existing P0 orders remain
--    compatible until the planned no-legacy cutover; future runtime code must
--    populate all semantic fields together and use the composite FK below.
-- ---------------------------------------------------------------------------
-- No-legacy cutover is deliberately a separate forward migration immediately
-- after the HQ compiler and tenant semantic runtime pass their contract tests.
-- It cannot be safely done here: this migration creates the artifact/snapshot
-- storage but cannot yet guarantee that order creation, stage actions,
-- Workboard, fulfilment, and integrations use it as their only runtime source.
-- The cutover migration will first prove there are no unsnapshotted new-order
-- writers, classify historical test orders, validate this constraint, then
-- remove the P0 runtime path before any real-tenant onboarding.

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS wf_profile_version_id UUID,
  ADD COLUMN IF NOT EXISTS wf_profile_artifact_id UUID,
  ADD COLUMN IF NOT EXISTS wf_profile_revision INTEGER,
  ADD COLUMN IF NOT EXISTS wf_profile_checksum TEXT,
  ADD COLUMN IF NOT EXISTS wf_profile_schema_version INTEGER;

ALTER TABLE public.org_orders_mst
  DROP CONSTRAINT IF EXISTS fk_ord_wf_prof_ver_scope,
  ADD CONSTRAINT fk_ord_wf_prof_ver_scope
    FOREIGN KEY (wf_profile_version_id, wf_profile_id, wf_version_no)
    REFERENCES public.sys_wf_profile_ver_mst (version_id, profile_id, version_no)
    ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS fk_ord_wf_prof_artifact,
  ADD CONSTRAINT fk_ord_wf_prof_artifact
    FOREIGN KEY (
      wf_profile_artifact_id,
      wf_profile_version_id,
      wf_profile_revision,
      wf_profile_schema_version,
      wf_profile_checksum
    ) REFERENCES public.sys_wf_prof_ver_artifact_cf (
      artifact_id,
      version_id,
      policy_revision,
      artifact_schema_version,
      artifact_checksum
    ) ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS chk_ord_wf_sem_snapshot,
  ADD CONSTRAINT chk_ord_wf_sem_snapshot CHECK (
    (
      wf_profile_version_id IS NULL
      AND wf_profile_artifact_id IS NULL
      AND wf_profile_revision IS NULL
      AND wf_profile_checksum IS NULL
      AND wf_profile_schema_version IS NULL
    ) OR (
      wf_profile_version_id IS NOT NULL
      AND wf_profile_artifact_id IS NOT NULL
      AND wf_profile_revision IS NOT NULL
      AND wf_profile_checksum IS NOT NULL
      AND wf_profile_schema_version IS NOT NULL
    )
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_ord_wf_prof_art
  ON public.org_orders_mst (tenant_org_id, wf_profile_version_id, wf_profile_artifact_id)
  WHERE wf_profile_artifact_id IS NOT NULL;

COMMENT ON COLUMN public.org_orders_mst.wf_profile_artifact_id IS
  'Exact immutable semantic workflow artifact selected at order creation.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_version_id IS
  'Exact workflow profile-version row selected at order creation.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_revision IS
  'Compiled semantic policy revision selected at order creation.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_checksum IS
  'Checksum of the exact semantic workflow artifact selected at order creation.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_schema_version IS
  'Schema version needed to safely deserialize the semantic workflow artifact.';
COMMENT ON CONSTRAINT fk_ord_wf_prof_ver_scope ON public.org_orders_mst IS
  'Ensures the order snapshot version belongs to the selected profile and version number.';
COMMENT ON CONSTRAINT fk_ord_wf_prof_artifact ON public.org_orders_mst IS
  'Ensures every artifact snapshot references one exact immutable compiler output.';
COMMENT ON CONSTRAINT chk_ord_wf_sem_snapshot ON public.org_orders_mst IS
  'Requires all semantic snapshot fields together; NOT VALID preserves historical P0 orders until cutover.';
COMMENT ON INDEX public.idx_ord_wf_prof_art IS
  'Supports tenant-scoped lookup and audit of orders by their immutable semantic workflow artifact.';

-- ---------------------------------------------------------------------------
-- 5) Guards. PUBLISHED/RETIRED content cannot change; Draft/Pilot edits
--    invalidate the current artifact and advance the policy revision.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_artifact_valid BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.version_status IN ('PILOT', 'PUBLISHED', 'RETIRED') THEN
      RAISE EXCEPTION
        'sys_wf_profile_ver_mst: cannot delete % version %',
        OLD.version_status,
        OLD.version_no;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.version_status = 'RETIRED' THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: RETIRED version % is immutable',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'PUBLISHED' THEN
    IF NEW.version_status = 'RETIRED'
       AND (to_jsonb(NEW) - ARRAY['version_status', 'retired_at', 'retired_by', 'updated_at', 'updated_by'])
         = (to_jsonb(OLD) - ARRAY['version_status', 'retired_at', 'retired_by', 'updated_at', 'updated_by'])
    THEN
      NEW.retired_at := COALESCE(NEW.retired_at, CURRENT_TIMESTAMP);
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PUBLISHED version % is immutable; clone a Draft/Pilot version instead',
      OLD.version_no;
  END IF;

  IF NEW.version_status NOT IN ('DRAFT', 'PILOT', 'PUBLISHED') THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: invalid lifecycle transition from % to %',
      OLD.version_status,
      NEW.version_status;
  END IF;

  IF OLD.version_status = 'PILOT' AND NEW.version_status = 'DRAFT' THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PILOT cannot return to DRAFT; continue the candidate or clone a new Draft',
      OLD.version_no;
  END IF;

  IF NEW.version_status = 'PILOT' THEN
    NEW.pilot_started_at := COALESCE(NEW.pilot_started_at, CURRENT_TIMESTAMP);
  END IF;

  IF NEW.version_status = 'PUBLISHED' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_artifact_cf AS artifact
      WHERE artifact.artifact_id = NEW.current_artifact_id
        AND artifact.version_id = NEW.version_id
        AND artifact.policy_revision = NEW.policy_revision
        AND artifact.artifact_schema_version = NEW.compiled_schema_version
        AND artifact.artifact_checksum = NEW.compiled_checksum
        AND artifact.compile_state = 'VALID'
        AND COALESCE(artifact.rec_status, 1) = 1
    ) INTO v_artifact_valid;

    IF NOT v_artifact_valid THEN
      RAISE EXCEPTION
        'sys_wf_profile_ver_mst: PUBLISHED version % requires a current VALID artifact for revision %',
        NEW.version_no,
        NEW.policy_revision;
    END IF;

    NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sys_wf_prof_cfg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_id UUID;
  v_status TEXT;
BEGIN
  v_version_id := COALESCE(NEW.version_id, OLD.version_id);

  SELECT version_status
  INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_version_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Workflow profile version % does not exist', v_version_id;
  END IF;

  IF v_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION
      'Workflow profile config for % version % is immutable',
      v_status,
      v_version_id;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET
    policy_revision = policy_revision + 1,
    current_artifact_id = NULL,
    compiled_schema_version = NULL,
    compiled_checksum = NULL,
    compiled_at = NULL,
    compiled_by = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE version_id = v_version_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sys_wf_prof_art_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_artifact_cf: compiled artifacts are immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_ver_guard() IS
  'Enforces Draft to Pilot to Published to Retired lifecycle, published immutability, and valid-artifact publication.';
COMMENT ON FUNCTION public.sys_wf_prof_cfg_guard() IS
  'Blocks published or retired policy edits and invalidates the current compiled artifact after Draft or Pilot edits.';
COMMENT ON FUNCTION public.sys_wf_prof_art_guard() IS
  'Makes compiler artifacts append-only so an order snapshot can always be reproduced exactly.';
COMMENT ON TRIGGER trg_sys_wf_prof_ver_immut ON public.sys_wf_profile_ver_mst IS
  'Invokes semantic profile-version lifecycle and immutability enforcement before updates or deletes.';

DROP TRIGGER IF EXISTS trg_wf_prof_mod_guard ON public.sys_wf_prof_ver_module_cf;
CREATE TRIGGER trg_wf_prof_mod_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_module_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_mod_st_guard ON public.sys_wf_prof_ver_mod_st_cf;
CREATE TRIGGER trg_wf_prof_mod_st_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_mod_st_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_policy_guard ON public.sys_wf_prof_ver_policy_cf;
CREATE TRIGGER trg_wf_prof_policy_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_policy_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_exec_guard ON public.sys_wf_prof_ver_exec_cf;
CREATE TRIGGER trg_wf_prof_exec_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_exec_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_exec_ch_guard ON public.sys_wf_prof_ver_exec_ch_cf;
CREATE TRIGGER trg_wf_prof_exec_ch_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_exec_ch_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_exec_gate_guard ON public.sys_wf_prof_ver_exec_gate_cf;
CREATE TRIGGER trg_wf_prof_exec_gate_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_exec_gate_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_init_guard ON public.sys_wf_prof_ver_init_cf;
CREATE TRIGGER trg_wf_prof_init_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_init_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_evidence_guard ON public.sys_wf_prof_ver_evidence_cf;
CREATE TRIGGER trg_wf_prof_evidence_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_evidence_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_cfg_guard();

DROP TRIGGER IF EXISTS trg_wf_prof_art_guard ON public.sys_wf_prof_ver_artifact_cf;
CREATE TRIGGER trg_wf_prof_art_guard
  BEFORE UPDATE OR DELETE ON public.sys_wf_prof_ver_artifact_cf
  FOR EACH ROW EXECUTE FUNCTION public.sys_wf_prof_art_guard();

-- ---------------------------------------------------------------------------
-- 6) Assignment governance. A PILOT can be assigned only by HQ to an explicit
--    test/demo tenant. Runtime behavior remains identical after assignment.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_wf_prof_asg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_is_test_demo BOOLEAN;
  v_artifact_valid BOOLEAN;
BEGIN
  IF COALESCE(NEW.is_active, true) = false
     OR COALESCE(NEW.rec_status, 1) <> 1
     OR NEW.wf_version_no IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT profile_version.version_status,
    EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_artifact_cf AS artifact
      WHERE artifact.artifact_id = profile_version.current_artifact_id
        AND artifact.version_id = profile_version.version_id
        AND artifact.policy_revision = profile_version.policy_revision
        AND artifact.artifact_schema_version = profile_version.compiled_schema_version
        AND artifact.artifact_checksum = profile_version.compiled_checksum
        AND artifact.compile_state = 'VALID'
        AND COALESCE(artifact.rec_status, 1) = 1
    )
  INTO v_status, v_artifact_valid
  FROM public.sys_wf_profile_ver_mst AS profile_version
  WHERE profile_version.profile_id = NEW.wf_profile_id
    AND profile_version.version_no = NEW.wf_version_no;

  IF v_status IS NULL THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: workflow profile version % does not exist for profile %',
      NEW.wf_version_no,
      NEW.wf_profile_id;
  END IF;

  IF v_status = 'PILOT' THEN
    SELECT COALESCE(is_hq_test_demo, false)
    INTO v_is_test_demo
    FROM public.org_tenants_mst
    WHERE id = NEW.tenant_org_id;

    IF COALESCE(v_is_test_demo, false) = false THEN
      RAISE EXCEPTION
        'org_wf_profile_assign_cf: PILOT versions may be assigned only to HQ test/demo tenants';
    END IF;
  ELSIF v_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: active assignments require a PILOT or PUBLISHED profile version';
  END IF;

  IF v_artifact_valid IS NOT TRUE THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: active assignments require a current compiled artifact';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_wf_prof_asg_guard ON public.org_wf_profile_assign_cf;
CREATE TRIGGER trg_org_wf_prof_asg_guard
  BEFORE INSERT OR UPDATE ON public.org_wf_profile_assign_cf
  FOR EACH ROW EXECUTE FUNCTION public.org_wf_prof_asg_guard();

COMMENT ON FUNCTION public.org_wf_prof_asg_guard() IS
  'Allows active assignments only to a current valid PILOT or PUBLISHED artifact; PILOT requires an HQ test/demo tenant.';
COMMENT ON TRIGGER trg_wf_prof_mod_guard ON public.sys_wf_prof_ver_module_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after module policy changes.';
COMMENT ON TRIGGER trg_wf_prof_mod_st_guard ON public.sys_wf_prof_ver_mod_st_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after module-status policy changes.';
COMMENT ON TRIGGER trg_wf_prof_policy_guard ON public.sys_wf_prof_ver_policy_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after policy switch changes.';
COMMENT ON TRIGGER trg_wf_prof_exec_guard ON public.sys_wf_prof_ver_exec_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after executable transition changes.';
COMMENT ON TRIGGER trg_wf_prof_exec_ch_guard ON public.sys_wf_prof_ver_exec_ch_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after command-channel policy changes.';
COMMENT ON TRIGGER trg_wf_prof_exec_gate_guard ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after gate policy changes.';
COMMENT ON TRIGGER trg_wf_prof_init_guard ON public.sys_wf_prof_ver_init_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after initial-rule policy changes.';
COMMENT ON TRIGGER trg_wf_prof_evidence_guard ON public.sys_wf_prof_ver_evidence_cf IS
  'Invalidates the compiled artifact and enforces lifecycle immutability after evidence policy changes.';
COMMENT ON TRIGGER trg_wf_prof_art_guard ON public.sys_wf_prof_ver_artifact_cf IS
  'Prevents updates or deletes of compiler output after it becomes an immutable audit artifact.';
COMMENT ON TRIGGER trg_org_wf_prof_asg_guard ON public.org_wf_profile_assign_cf IS
  'Enforces lifecycle, artifact freshness, and HQ test/demo eligibility for active profile assignments.';

COMMIT;
