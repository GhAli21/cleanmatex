-- ============================================================================
-- 0462_workflow_gate_decision_contract.sql
-- ============================================================================
-- Purpose:
--   Establishes the schema contract for audited non-hard workflow gate
--   decisions. The later tenant command runtime will use this ledger only
--   after locking and re-evaluating an order's immutable compiled artifact.
--
-- Safety:
--   * keeps hard-block behavior as the only executable mode today;
--   * records no raw customer, payment, address, or proof facts;
--   * uses a composite tenant/order foreign key to prevent cross-tenant links;
--   * preserves idempotency and outbox correlation for exactly-once commands;
--   * applies tenant RLS while requiring service-layer tenant filters too.
--
-- Rollout:
--   This migration does not enable warning acknowledgement or overrides. The
--   tenant evaluator/challenge/atomic-command service and its tests must land
--   before compiler support for non-hard gate modes is enabled.
-- ============================================================================

BEGIN;

-- Gate definitions declare the current version of their trusted evaluator
-- input contract. Existing catalog rows use version one until a registered
-- evaluator capability supplies a later compatible contract.
ALTER TABLE public.sys_wf_gate_defs_cd
  ADD COLUMN IF NOT EXISTS input_schema_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.sys_wf_gate_defs_cd.input_schema_version IS
  'Positive version of the trusted evaluator input contract; profile bindings and runtime decisions must name the same version.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_wf_gate_def_input_ver'
      AND conrelid = 'public.sys_wf_gate_defs_cd'::regclass
  ) THEN
    ALTER TABLE public.sys_wf_gate_defs_cd
      ADD CONSTRAINT chk_wf_gate_def_input_ver
      CHECK (input_schema_version >= 1);
  END IF;
END;
$$;

COMMENT ON CONSTRAINT chk_wf_gate_def_input_ver ON public.sys_wf_gate_defs_cd IS
  'Rejects zero or negative evaluator input-schema versions in the global gate grammar.';

-- A profile binding freezes both evaluator code and input contract versions so
-- the immutable artifact can never silently reinterpret gate parameters.
ALTER TABLE public.sys_wf_prof_ver_exec_gate_cf
  ADD COLUMN IF NOT EXISTS input_schema_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.sys_wf_prof_ver_exec_gate_cf.input_schema_version IS
  'Evaluator input-schema version selected by this executable gate binding and copied into compiled artifacts.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_wf_prof_gate_input_ver'
      AND conrelid = 'public.sys_wf_prof_ver_exec_gate_cf'::regclass
  ) THEN
    ALTER TABLE public.sys_wf_prof_ver_exec_gate_cf
      ADD CONSTRAINT chk_wf_prof_gate_input_ver
      CHECK (input_schema_version >= 1);
  END IF;
END;
$$;

COMMENT ON CONSTRAINT chk_wf_prof_gate_input_ver ON public.sys_wf_prof_ver_exec_gate_cf IS
  'Rejects executable gate bindings that omit a positive evaluator input-schema version.';

-- This append-only tenant ledger stores only accepted warning acknowledgements
-- and authorized overrides. A hard-block rejection never reaches this table.
CREATE TABLE public.org_wf_gate_decision_mst (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  profile_artifact_id UUID NOT NULL,
  workflow_action_code TEXT NOT NULL,
  workflow_screen_key TEXT NOT NULL,
  gate_code TEXT NOT NULL,
  evaluator_version INTEGER NOT NULL,
  input_schema_version INTEGER NOT NULL,
  decision_mode TEXT NOT NULL,
  channel_code TEXT NOT NULL,
  actor_user_id UUID,
  actor_subject TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_correlation_id TEXT NOT NULL,
  evaluation_fingerprint TEXT NOT NULL,
  ack_challenge_hash TEXT,
  override_reason TEXT,
  override_reason_min_length SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wfgd_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_wfgd_order_tenant FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES public.org_orders_mst (id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_wfgd_artifact FOREIGN KEY (profile_artifact_id)
    REFERENCES public.sys_wf_prof_ver_artifact_cf (artifact_id) ON DELETE RESTRICT,
  CONSTRAINT fk_wfgd_action FOREIGN KEY (workflow_action_code)
    REFERENCES public.sys_wf_actions_cd (action_code) ON DELETE RESTRICT,
  CONSTRAINT fk_wfgd_screen FOREIGN KEY (workflow_screen_key)
    REFERENCES public.sys_wf_screens_cd (screen_key) ON DELETE RESTRICT,
  CONSTRAINT fk_wfgd_gate FOREIGN KEY (gate_code)
    REFERENCES public.sys_wf_gate_defs_cd (gate_code) ON DELETE RESTRICT,
  CONSTRAINT uq_wfgd_idempotency UNIQUE (
    tenant_org_id,
    order_id,
    workflow_action_code,
    gate_code,
    idempotency_key
  ),
  CONSTRAINT chk_wfgd_versions CHECK (
    evaluator_version >= 1
    AND input_schema_version >= 1
  ),
  CONSTRAINT chk_wfgd_mode CHECK (
    decision_mode IN ('soft_warning_acknowledged', 'override_authorized')
  ),
  CONSTRAINT chk_wfgd_channel CHECK (
    channel_code IN ('staff_web', 'mobile', 'api', 'integration', 'pos')
  ),
  CONSTRAINT chk_wfgd_actor CHECK (
    NULLIF(BTRIM(actor_subject), '') IS NOT NULL
    AND CHAR_LENGTH(actor_subject) <= 255
  ),
  CONSTRAINT chk_wfgd_idem_key CHECK (
    NULLIF(BTRIM(idempotency_key), '') IS NOT NULL
    AND CHAR_LENGTH(idempotency_key) <= 255
  ),
  CONSTRAINT chk_wfgd_request_id CHECK (
    NULLIF(BTRIM(request_correlation_id), '') IS NOT NULL
    AND CHAR_LENGTH(request_correlation_id) <= 255
  ),
  CONSTRAINT chk_wfgd_fingerprint CHECK (
    evaluation_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT chk_wfgd_decision CHECK (
    (
      decision_mode = 'soft_warning_acknowledged'
      AND ack_challenge_hash ~ '^[0-9a-f]{64}$'
      AND override_reason IS NULL
      AND override_reason_min_length = 0
    ) OR (
      decision_mode = 'override_authorized'
      AND ack_challenge_hash IS NULL
      AND NULLIF(BTRIM(override_reason), '') IS NOT NULL
      AND override_reason_min_length >= 10
      AND CHAR_LENGTH(BTRIM(override_reason)) >= override_reason_min_length
    )
  )
);

COMMENT ON TABLE public.org_wf_gate_decision_mst IS
  'Append-only tenant evidence for accepted workflow warning acknowledgements and authorized overrides; actions must re-evaluate live facts before inserting a row.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.decision_id IS 'Stable immutable decision identifier and outbox aggregate reference.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.tenant_org_id IS 'Tenant boundary enforced by composite order foreign key and row-level security.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.order_id IS 'Order whose action required an accepted non-hard gate decision.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.profile_artifact_id IS 'Exact immutable compiled workflow artifact used during the locked command evaluation.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.workflow_action_code IS 'Configured workflow action executed after the accepted gate decision.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.workflow_screen_key IS 'Workflow screen context declared by the compiled executable binding.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.gate_code IS 'Global gate evaluator selected by the compiled executable binding.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.evaluator_version IS 'Exact trusted gate evaluator code contract used for this decision.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.input_schema_version IS 'Exact trusted evaluator input-schema contract used for this decision.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.decision_mode IS 'Accepted non-hard decision: acknowledgement of a warning or authorized override.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.channel_code IS 'Authenticated command channel; public_web is intentionally excluded.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.actor_user_id IS 'Optional authenticated internal user identifier when the channel has a user principal.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.actor_subject IS 'Non-sensitive authenticated actor reference such as a user, POS device, or integration subject.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.idempotency_key IS 'Stable client command key used to prevent duplicate accepted decisions on retries.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.request_correlation_id IS 'Non-sensitive request or trace correlation reference for audit and outbox investigation.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.evaluation_fingerprint IS 'Server-generated SHA-256 fingerprint of canonical safe facts; raw gate facts are never persisted here.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.ack_challenge_hash IS 'SHA-256 hash of the consumed opaque acknowledgement challenge; populated only for warning acknowledgement.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.override_reason IS 'Human operational reason accepted for an authorized override; never populated for acknowledgement.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.override_reason_min_length IS 'Compiled minimum reason length applied at command time; zero for warning acknowledgement.';
COMMENT ON COLUMN public.org_wf_gate_decision_mst.created_at IS 'UTC timestamp when the final locked command accepted the decision.';
COMMENT ON CONSTRAINT fk_wfgd_tenant ON public.org_wf_gate_decision_mst IS 'Prevents decisions from naming a non-existent tenant.';
COMMENT ON CONSTRAINT fk_wfgd_order_tenant ON public.org_wf_gate_decision_mst IS 'Prevents an order ID from being paired with another tenant.';
COMMENT ON CONSTRAINT fk_wfgd_artifact ON public.org_wf_gate_decision_mst IS 'Preserves the exact immutable compiled artifact used to authorize the action.';
COMMENT ON CONSTRAINT fk_wfgd_action ON public.org_wf_gate_decision_mst IS 'Requires the decision to name a registered workflow action.';
COMMENT ON CONSTRAINT fk_wfgd_screen ON public.org_wf_gate_decision_mst IS 'Requires the decision to name a registered workflow screen.';
COMMENT ON CONSTRAINT fk_wfgd_gate ON public.org_wf_gate_decision_mst IS 'Requires the decision to name a registered gate evaluator.';
COMMENT ON CONSTRAINT uq_wfgd_idempotency ON public.org_wf_gate_decision_mst IS 'Prevents duplicate accepted decisions for the same tenant order action gate and retry key.';
COMMENT ON CONSTRAINT chk_wfgd_versions ON public.org_wf_gate_decision_mst IS 'Requires positive evaluator and evaluator-input contract versions.';
COMMENT ON CONSTRAINT chk_wfgd_mode ON public.org_wf_gate_decision_mst IS 'Restricts persisted decisions to the two explicit non-hard gate outcomes.';
COMMENT ON CONSTRAINT chk_wfgd_channel ON public.org_wf_gate_decision_mst IS 'Allows only authenticated operational channels and excludes public tracking from bypass decisions.';
COMMENT ON CONSTRAINT chk_wfgd_actor ON public.org_wf_gate_decision_mst IS 'Requires a bounded non-empty authenticated actor subject for every accepted decision.';
COMMENT ON CONSTRAINT chk_wfgd_idem_key ON public.org_wf_gate_decision_mst IS 'Requires a bounded non-empty idempotency key for retry-safe commands.';
COMMENT ON CONSTRAINT chk_wfgd_request_id ON public.org_wf_gate_decision_mst IS 'Requires a bounded non-empty correlation reference without storing request payloads.';
COMMENT ON CONSTRAINT chk_wfgd_fingerprint ON public.org_wf_gate_decision_mst IS 'Restricts the stored evaluation fingerprint to a lowercase SHA-256 digest.';
COMMENT ON CONSTRAINT chk_wfgd_decision ON public.org_wf_gate_decision_mst IS 'Enforces mode-specific challenge/reason evidence and the minimum authorized override reason length.';

-- Operators investigate an order's accepted gate decisions newest first. The
-- tenant key remains leading so this index never weakens tenant isolation.
CREATE INDEX idx_wfgd_order_created
  ON public.org_wf_gate_decision_mst (tenant_org_id, order_id, created_at DESC);

COMMENT ON INDEX public.idx_wfgd_order_created IS
  'Supports tenant-scoped order history and audit views without a full ledger scan.';

-- This lookup supports command retry diagnostics while the unique constraint
-- remains the authoritative duplicate-prevention mechanism.
CREATE INDEX idx_wfgd_idempotency
  ON public.org_wf_gate_decision_mst (tenant_org_id, idempotency_key, created_at DESC);

COMMENT ON INDEX public.idx_wfgd_idempotency IS
  'Supports tenant-scoped idempotency investigation for accepted gate decisions.';

ALTER TABLE public.org_wf_gate_decision_mst ENABLE ROW LEVEL SECURITY;

-- Tenant callers can access only their own immutable decision evidence. Server
-- services still must pass tenant_org_id explicitly and never rely on RLS alone.
CREATE POLICY pol_wf_gate_decision_tenant
  ON public.org_wf_gate_decision_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
