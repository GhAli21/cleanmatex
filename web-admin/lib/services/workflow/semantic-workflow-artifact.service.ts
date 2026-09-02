import 'server-only';

import { z } from 'zod';
import {
  clearLiveWorkflowPolicyCache,
  loadLiveWorkflowPolicyForOrder,
  SemanticWorkflowArtifactError,
} from '@/lib/services/workflow/workflow-policy-resolver.service';

export { SemanticWorkflowArtifactError } from '@/lib/services/workflow/workflow-policy-resolver.service';

const semanticInitialRuleSchema = z.object({
  rule_code: z.string().min(1),
  order_source_code: z.string().nullable(),
  order_type_id: z.string().nullable(),
  is_retail: z.boolean().nullable(),
  is_quick_drop: z.boolean().nullable(),
  initial_status: z.string().min(1),
  priority: z.number().int(),
}).passthrough();

const semanticModuleSchema = z.object({
  screen_key: z.string().min(1),
  module_mode: z.enum(['primary_owner', 'observer', 'cross_cutting_command']),
  is_enabled: z.boolean(),
  display_order: z.number().int(),
}).passthrough();

const semanticModuleStatusSchema = z.object({
  screen_key: z.string().min(1),
  status_code: z.string().min(1),
  visibility_mode: z.enum(['owner', 'observer']),
  display_order: z.number().int(),
}).passthrough();

const semanticExecutionChannelSchema = z.object({
  channel_code: z.enum(['staff_web', 'mobile', 'api', 'integration', 'public_web', 'pos']),
}).passthrough();

const semanticExecutionGateSchema = z.object({
  gate_code: z.string().min(1),
  evaluator_version: z.number().int().positive(),
  input_schema_version: z.number().int().positive(),
  blocking_mode: z.enum(['hard_block', 'soft_warning', 'override_allowed']),
  parameters_json: z.record(z.string(), z.unknown()),
  display_order: z.number().int(),
}).passthrough();

const semanticExecutionSchema = z.object({
  exec_id: z.string().uuid(),
  screen_key: z.string().min(1),
  action_code: z.string().min(1),
  from_status: z.string().min(1),
  to_status: z.string().min(1),
  transition_kind: z.enum(['fixed', 'resume_from_hold']),
  requires_expected_version: z.boolean(),
  requires_idempotency: z.boolean(),
  requires_reason: z.boolean(),
  min_reason_length: z.number().int().nonnegative(),
  requires_evidence: z.boolean(),
  display_order: z.number().int(),
  channels: z.array(semanticExecutionChannelSchema).min(1),
  gates: z.array(semanticExecutionGateSchema),
}).passthrough();

const semanticEvidenceSchema = z.object({
  fulfilment_channel: z.enum(['pickup', 'delivery']),
  evidence_method_code: z.string().min(1),
  is_required: z.boolean(),
  minimum_count: z.number().int().nonnegative(),
  display_order: z.number().int(),
}).passthrough();

const semanticArtifactSchema = z.object({
  artifact_schema_version: z.number().int().positive(),
  profile_id: z.string().uuid(),
  profile_version_id: z.string().uuid(),
  profile_version_no: z.number().int().positive(),
  policy_revision: z.number().int().positive(),
  policy_schema_version: z.number().int().positive(),
  allow_direct_counter_pickup: z.boolean(),
  initial_rules: z.array(semanticInitialRuleSchema),
  modules: z.array(semanticModuleSchema),
  module_statuses: z.array(semanticModuleStatusSchema),
  executions: z.array(semanticExecutionSchema),
  evidence: z.array(semanticEvidenceSchema),
}).passthrough();

/** Live normalized policy projection consumed by tenant runtime services. */
export type SemanticWorkflowArtifact = z.infer<typeof semanticArtifactSchema>;

/** Exact command channels supported by profile-version executable bindings. */
export type SemanticWorkflowCommandChannel = z.infer<typeof semanticExecutionChannelSchema>['channel_code'];

/** Explicit executable transition from live profile-version rows. */
export type SemanticWorkflowExecution = z.infer<typeof semanticExecutionSchema>;

export interface SemanticWorkflowOrderSnapshot {
  wf_profile_id: string | null;
  wf_version_no: number | null;
  wf_profile_version_id: string | null;
  wf_profile_artifact_id: string | null;
  wf_profile_revision: number | null;
  wf_profile_checksum: string | null;
  wf_profile_schema_version: number | null;
}

/**
 * Loads live normalized policy for a tenant-locked order binding.
 * Artifact id/checksum are historical audit only and are not required.
 */
export async function loadSemanticWorkflowArtifactForOrder(
  snapshot: SemanticWorkflowOrderSnapshot,
): Promise<SemanticWorkflowArtifact | null> {
  const policy = await loadLiveWorkflowPolicyForOrder(snapshot);
  if (!policy) return null;

  const parsed = semanticArtifactSchema.safeParse(policy);
  if (!parsed.success) {
    throw new SemanticWorkflowArtifactError(
      'PROFILE_ARTIFACT_INVALID',
      'The live workflow policy failed projection validation.',
    );
  }
  return parsed.data;
}

/** Test-only cache reset for the live Published policy cache. */
export function clearSemanticWorkflowArtifactCache(): void {
  clearLiveWorkflowPolicyCache();
}
