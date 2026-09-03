import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type {
  SemanticWorkflowArtifact,
  SemanticWorkflowOrderSnapshot,
} from '@/lib/services/workflow/semantic-workflow-artifact.service';
import { observeWorkflowPolicy } from '@/lib/services/workflow/workflow-observability';
import { WORKFLOW_PROFILE_STAFF_EN } from './workflow-profile-error-catalog';

/**
 * Fail-closed policy loader errors. Codes stay on the existing PROFILE_*
 * HTTP mapping so floor clients do not treat a missing live policy as 500.
 */
export class SemanticWorkflowArtifactError extends Error {
  constructor(
    readonly code: 'PROFILE_SNAPSHOT_INCOMPLETE' | 'PROFILE_ARTIFACT_UNAVAILABLE' | 'PROFILE_ARTIFACT_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'SemanticWorkflowArtifactError';
  }
}

/** Prisma or an open command transaction. Policy reads must share the caller's lock. */
type PolicyQueryClient = Pick<typeof prisma, '$queryRaw'>;

const LIVE_PROJECTION_SCHEMA = 1;
const PUBLISHED_CACHE_LIMIT = 256;

type VersionRow = {
  version_id: string;
  profile_id: string;
  version_no: number;
  version_status: string;
  policy_revision: number;
  is_active: boolean;
  rec_status: number;
};

type PolicyRow = {
  policy_schema_version: number;
  allow_direct_counter_pickup: boolean;
};

type ModuleRow = {
  screen_key: string;
  module_mode: 'primary_owner' | 'observer' | 'cross_cutting_command';
  is_enabled: boolean;
  display_order: number;
};

type MembershipRow = {
  screen_key: string;
  status_code: string;
  visibility_mode: 'owner' | 'observer';
  display_order: number;
};

type ExecRow = {
  exec_id: string;
  screen_key: string;
  action_code: string;
  from_status: string;
  to_status: string;
  transition_kind: 'fixed' | 'resume_from_hold';
  requires_expected_version: boolean;
  requires_idempotency: boolean;
  requires_reason: boolean;
  min_reason_length: number;
  requires_evidence: boolean;
  display_order: number;
};

type ChannelRow = {
  exec_id: string;
  channel_code: 'staff_web' | 'mobile' | 'api' | 'integration' | 'public_web' | 'pos';
};

type GateRow = {
  exec_id: string;
  gate_code: string;
  evaluator_version: number;
  input_schema_version: number;
  blocking_mode: 'hard_block' | 'soft_warning' | 'override_allowed';
  parameters_json: Record<string, unknown> | null;
  display_order: number;
  message_key: string | null;
  override_permission_code: string | null;
  override_min_reason_length: number;
};

type InitRow = {
  rule_code: string;
  order_source_code: string | null;
  order_type_id: string | null;
  is_retail: boolean | null;
  is_quick_drop: boolean | null;
  initial_status: string;
  priority: number;
  create_preset_code: string | null;
};

type EvidenceRow = {
  fulfilment_channel: 'pickup' | 'delivery';
  evidence_method_code: string;
  is_required: boolean;
  minimum_count: number;
  display_order: number;
};

const publishedCache = new Map<string, SemanticWorkflowArtifact>();

function hasAnyBindingValue(snapshot: SemanticWorkflowOrderSnapshot): boolean {
  return Boolean(
    snapshot.wf_profile_id
    || snapshot.wf_version_no != null
    || snapshot.wf_profile_version_id
    || snapshot.wf_profile_artifact_id
    || snapshot.wf_profile_revision != null
    || snapshot.wf_profile_checksum
    || snapshot.wf_profile_schema_version != null,
  );
}

function cachePublished(cacheKey: string, policy: SemanticWorkflowArtifact): void {
  publishedCache.set(cacheKey, policy);
  if (publishedCache.size > PUBLISHED_CACHE_LIMIT) {
    const oldestKey = publishedCache.keys().next().value;
    if (oldestKey) publishedCache.delete(oldestKey);
  }
}

/** Duck-type tenant/order ids from a locked order row without importing engine types. */
function snapshotObserveScope(snapshot: SemanticWorkflowOrderSnapshot) {
  const row = snapshot as SemanticWorkflowOrderSnapshot & {
    tenant_org_id?: string | null;
    id?: string | null;
  };
  return {
    tenantId: typeof row.tenant_org_id === 'string' ? row.tenant_org_id : undefined,
    orderId: typeof row.id === 'string' ? row.id : undefined,
    profileId: snapshot.wf_profile_id,
    profileVersionId: snapshot.wf_profile_version_id,
    versionNo: snapshot.wf_version_no,
  };
}

/**
 * Test-only cache reset. Pilot rows are never cached; Published rows are
 * immutable and keyed by version id plus live policy revision.
 */
export function clearLiveWorkflowPolicyCache(): void {
  publishedCache.clear();
}

/**
 * Loads the order's live normalized profile-version policy. Artifact columns
 * are ignored. Pilot edits are visible immediately; Published policy may be
 * cached by version/revision only.
 *
 * @param snapshot - Tenant-locked order binding. Must already be scoped by tenant_org_id.
 * @param client - Optional command transaction so Pilot reads see locked rows.
 */
export async function loadLiveWorkflowPolicyForOrder(
  snapshot: SemanticWorkflowOrderSnapshot,
  client: PolicyQueryClient = prisma,
): Promise<SemanticWorkflowArtifact | null> {
  const startedAt = Date.now();
  const scope = snapshotObserveScope(snapshot);
  if (!hasAnyBindingValue(snapshot)) return null;

  if (
    !snapshot.wf_profile_id
    || snapshot.wf_version_no == null
    || !snapshot.wf_profile_version_id
  ) {
    observeWorkflowPolicy({
      ...scope,
      outcome: 'incomplete',
      latencyMs: Date.now() - startedAt,
    });
    throw new SemanticWorkflowArtifactError(
      'PROFILE_SNAPSHOT_INCOMPLETE',
      WORKFLOW_PROFILE_STAFF_EN.PROFILE_SNAPSHOT_INCOMPLETE,
    );
  }

  const versions = await client.$queryRaw<VersionRow[]>`
    SELECT
      version_id::text,
      profile_id::text,
      version_no,
      version_status,
      policy_revision,
      COALESCE(is_active, true) AS is_active,
      COALESCE(rec_status, 1) AS rec_status
    FROM public.sys_wf_profile_ver_mst
    WHERE version_id = ${snapshot.wf_profile_version_id}::uuid
    LIMIT 1
  `;
  const version = versions[0];
  if (
    !version
    || version.profile_id !== snapshot.wf_profile_id
    || version.version_no !== snapshot.wf_version_no
    || !version.is_active
    || version.rec_status !== 1
    || (version.version_status !== 'PILOT' && version.version_status !== 'PUBLISHED')
  ) {
    observeWorkflowPolicy({
      ...scope,
      outcome: 'unavailable',
      latencyMs: Date.now() - startedAt,
    });
    throw new SemanticWorkflowArtifactError(
      'PROFILE_ARTIFACT_UNAVAILABLE',
      WORKFLOW_PROFILE_STAFF_EN.PROFILE_ARTIFACT_UNAVAILABLE,
    );
  }

  if (version.version_status === 'PUBLISHED') {
    const cacheKey = `${version.version_id}:${version.policy_revision}`;
    const cached = publishedCache.get(cacheKey);
    if (cached) {
      observeWorkflowPolicy({
        ...scope,
        policyRevision: version.policy_revision,
        versionStatus: version.version_status,
        cacheHit: true,
        outcome: 'cache_hit',
        latencyMs: Date.now() - startedAt,
      });
      return cached;
    }
  }

  const policy = await assembleLivePolicy(client, version);
  if (version.version_status === 'PUBLISHED') {
    cachePublished(`${version.version_id}:${version.policy_revision}`, policy);
  }
  observeWorkflowPolicy({
    ...scope,
    policyRevision: version.policy_revision,
    versionStatus: version.version_status,
    cacheHit: false,
    outcome: 'loaded',
    latencyMs: Date.now() - startedAt,
  });
  return policy;
}

async function assembleLivePolicy(
  client: PolicyQueryClient,
  version: VersionRow,
): Promise<SemanticWorkflowArtifact> {
  const [policyRows, modules, memberships, executions, channels, gates, initialRules, evidence] =
    await Promise.all([
      client.$queryRaw<PolicyRow[]>`
        SELECT policy_schema_version, allow_direct_counter_pickup
        FROM public.sys_wf_prof_ver_policy_cf
        WHERE version_id = ${version.version_id}::uuid
          AND is_active = true
          AND rec_status = 1
        LIMIT 1
      `,
      client.$queryRaw<ModuleRow[]>`
        SELECT screen_key, module_mode, is_enabled, display_order
        FROM public.sys_wf_prof_ver_module_cf
        WHERE version_id = ${version.version_id}::uuid
          AND is_active = true
          AND rec_status = 1
        ORDER BY display_order, screen_key
      `,
      client.$queryRaw<MembershipRow[]>`
        SELECT screen_key, status_code, visibility_mode, display_order
        FROM public.sys_wf_prof_ver_mod_st_cf
        WHERE version_id = ${version.version_id}::uuid
          AND is_active = true
          AND rec_status = 1
        ORDER BY display_order, screen_key, status_code
      `,
      client.$queryRaw<ExecRow[]>`
        SELECT
          exec_id::text,
          screen_key,
          action_code,
          from_status,
          to_status,
          transition_kind,
          requires_expected_version,
          requires_idempotency,
          requires_reason,
          min_reason_length,
          requires_evidence,
          display_order
        FROM public.sys_wf_prof_ver_exec_cf
        WHERE version_id = ${version.version_id}::uuid
          AND is_active = true
          AND rec_status = 1
        ORDER BY display_order, action_code, from_status, to_status
      `,
      client.$queryRaw<ChannelRow[]>`
        SELECT channel.exec_id::text, channel.channel_code
        FROM public.sys_wf_prof_ver_exec_ch_cf AS channel
        INNER JOIN public.sys_wf_prof_ver_exec_cf AS executable
          ON executable.exec_id = channel.exec_id
        WHERE executable.version_id = ${version.version_id}::uuid
          AND channel.is_active = true
          AND channel.rec_status = 1
          AND executable.is_active = true
          AND executable.rec_status = 1
      `,
      client.$queryRaw<GateRow[]>`
        SELECT
          gate.exec_id::text,
          gate.gate_code,
          gate.evaluator_version,
          gate.input_schema_version,
          gate.blocking_mode,
          gate.parameters_json,
          gate.display_order,
          gate.message_key,
          gate.override_permission_code,
          gate.override_min_reason_length
        FROM public.sys_wf_prof_ver_exec_gate_cf AS gate
        INNER JOIN public.sys_wf_prof_ver_exec_cf AS executable
          ON executable.exec_id = gate.exec_id
        WHERE executable.version_id = ${version.version_id}::uuid
          AND gate.is_active = true
          AND gate.rec_status = 1
          AND executable.is_active = true
          AND executable.rec_status = 1
        ORDER BY gate.display_order, gate.gate_code
      `,
      client.$queryRaw<InitRow[]>`
        SELECT
          rule_code,
          order_source_code,
          order_type_id,
          is_retail,
          is_quick_drop,
          initial_status,
          priority,
          create_preset_code
        FROM public.sys_wf_prof_ver_init_cf
        WHERE version_id = ${version.version_id}::uuid
          AND is_active = true
          AND rec_status = 1
        ORDER BY priority, rule_code
      `,
      client.$queryRaw<EvidenceRow[]>`
        SELECT
          fulfilment_channel,
          evidence_method_code,
          is_required,
          minimum_count,
          display_order
        FROM public.sys_wf_prof_ver_evidence_cf
        WHERE version_id = ${version.version_id}::uuid
          AND is_active = true
          AND rec_status = 1
        ORDER BY display_order, fulfilment_channel, evidence_method_code
      `,
    ]);

  const policyRow = policyRows[0];
  if (!policyRow || modules.length === 0 || initialRules.length === 0) {
    throw new SemanticWorkflowArtifactError(
      'PROFILE_ARTIFACT_INVALID',
      WORKFLOW_PROFILE_STAFF_EN.PROFILE_ARTIFACT_INVALID,
    );
  }

  const channelsByExec = new Map<string, ChannelRow['channel_code'][]>();
  for (const channel of channels) {
    const list = channelsByExec.get(channel.exec_id) ?? [];
    list.push(channel.channel_code);
    channelsByExec.set(channel.exec_id, list);
  }

  const gatesByExec = new Map<string, GateRow[]>();
  for (const gate of gates) {
    const list = gatesByExec.get(gate.exec_id) ?? [];
    list.push(gate);
    gatesByExec.set(gate.exec_id, list);
  }

  const projectedExecutions = executions.map((execution) => {
    const execChannels = [...new Set(channelsByExec.get(execution.exec_id) ?? [])]
      .sort((left, right) => left.localeCompare(right));
    if (execChannels.length === 0) {
      throw new SemanticWorkflowArtifactError(
        'PROFILE_ARTIFACT_INVALID',
        WORKFLOW_PROFILE_STAFF_EN.PROFILE_ARTIFACT_INVALID,
      );
    }
    return {
      exec_id: execution.exec_id,
      screen_key: execution.screen_key,
      action_code: execution.action_code,
      from_status: execution.from_status,
      to_status: execution.to_status,
      transition_kind: execution.transition_kind,
      requires_expected_version: execution.requires_expected_version,
      requires_idempotency: execution.requires_idempotency,
      requires_reason: execution.requires_reason,
      min_reason_length: execution.min_reason_length,
      requires_evidence: execution.requires_evidence,
      display_order: execution.display_order,
      channels: execChannels.map((channel_code) => ({ channel_code })),
      gates: (gatesByExec.get(execution.exec_id) ?? []).map((gate) => ({
        gate_code: gate.gate_code,
        evaluator_version: gate.evaluator_version,
        input_schema_version: gate.input_schema_version,
        blocking_mode: gate.blocking_mode,
        parameters_json: gate.parameters_json ?? {},
        display_order: gate.display_order,
        message_key: gate.message_key,
        override_permission_code: gate.override_permission_code,
        override_min_reason_length: gate.override_min_reason_length,
      })),
    };
  });

  return {
    artifact_schema_version: LIVE_PROJECTION_SCHEMA,
    profile_id: version.profile_id,
    profile_version_id: version.version_id,
    profile_version_no: version.version_no,
    policy_revision: version.policy_revision,
    policy_schema_version: policyRow.policy_schema_version,
    allow_direct_counter_pickup: Boolean(policyRow.allow_direct_counter_pickup),
    initial_rules: initialRules,
    modules,
    module_statuses: memberships,
    executions: projectedExecutions,
    evidence,
  };
}
