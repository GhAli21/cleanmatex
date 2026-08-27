import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';

const ARTIFACT_CACHE_LIMIT = 256;

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
  initial_rules: z.array(semanticInitialRuleSchema),
  modules: z.array(semanticModuleSchema),
  module_statuses: z.array(semanticModuleStatusSchema),
  executions: z.array(semanticExecutionSchema),
  evidence: z.array(semanticEvidenceSchema),
}).passthrough();

/** Immutable compiler output shape that tenant runtime services are allowed to execute. */
export type SemanticWorkflowArtifact = z.infer<typeof semanticArtifactSchema>;

/** Exact command channels supported by the semantic profile compiler. */
export type SemanticWorkflowCommandChannel = z.infer<typeof semanticExecutionChannelSchema>['channel_code'];

/** Explicit executable transition emitted by the HQ semantic profile compiler. */
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

type ArtifactRow = {
  artifact_id: string;
  version_id: string;
  policy_revision: number;
  artifact_schema_version: number;
  artifact_checksum: string;
  compiled_artifact: unknown;
};

/** Typed error surface for callers that must reject unsafe semantic snapshots. */
export class SemanticWorkflowArtifactError extends Error {
  constructor(
    readonly code: 'PROFILE_SNAPSHOT_INCOMPLETE' | 'PROFILE_ARTIFACT_UNAVAILABLE' | 'PROFILE_ARTIFACT_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'SemanticWorkflowArtifactError';
  }
}

const artifactCache = new Map<string, SemanticWorkflowArtifact>();

function hasAnySemanticSnapshotValue(snapshot: SemanticWorkflowOrderSnapshot): boolean {
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

function cacheArtifact(cacheKey: string, artifact: SemanticWorkflowArtifact): void {
  artifactCache.set(cacheKey, artifact);
  if (artifactCache.size > ARTIFACT_CACHE_LIMIT) {
    const oldestKey = artifactCache.keys().next().value;
    if (oldestKey) artifactCache.delete(oldestKey);
  }
}

/**
 * Loads only the immutable artifact named by an already tenant-locked order
 * snapshot. It never resolves a current assignment or falls back to catalogs,
 * templates, or pinned graphs, so reassignment cannot alter an in-flight order.
 */
export async function loadSemanticWorkflowArtifactForOrder(
  snapshot: SemanticWorkflowOrderSnapshot,
): Promise<SemanticWorkflowArtifact | null> {
  if (!hasAnySemanticSnapshotValue(snapshot)) return null;

  if (
    !snapshot.wf_profile_id
    || snapshot.wf_version_no == null
    || !snapshot.wf_profile_version_id
    || !snapshot.wf_profile_artifact_id
    || snapshot.wf_profile_revision == null
    || !snapshot.wf_profile_checksum
    || snapshot.wf_profile_schema_version == null
  ) {
    throw new SemanticWorkflowArtifactError(
      'PROFILE_SNAPSHOT_INCOMPLETE',
      'The order has an incomplete semantic workflow snapshot.',
    );
  }

  const cacheKey = `${snapshot.wf_profile_artifact_id}:${snapshot.wf_profile_checksum}`;
  const cached = artifactCache.get(cacheKey);
  if (cached) return cached;

  // Artifacts are immutable compiler output: they have rec_status, not is_active.
  const rows = await prisma.$queryRaw<ArtifactRow[]>`
    SELECT
      artifact_id::text,
      version_id::text,
      policy_revision,
      artifact_schema_version,
      artifact_checksum,
      compiled_artifact
    FROM public.sys_wf_prof_ver_artifact_cf
    WHERE artifact_id = ${snapshot.wf_profile_artifact_id}::uuid
      AND version_id = ${snapshot.wf_profile_version_id}::uuid
      AND policy_revision = ${snapshot.wf_profile_revision}
      AND artifact_schema_version = ${snapshot.wf_profile_schema_version}
      AND artifact_checksum = ${snapshot.wf_profile_checksum}
      AND compile_state = 'VALID'
      AND rec_status = 1
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new SemanticWorkflowArtifactError(
      'PROFILE_ARTIFACT_UNAVAILABLE',
      'The order workflow artifact is unavailable or no longer matches its snapshot.',
    );
  }

  const parsed = semanticArtifactSchema.safeParse(row.compiled_artifact);
  if (
    !parsed.success
    || parsed.data.profile_id !== snapshot.wf_profile_id
    || parsed.data.profile_version_id !== snapshot.wf_profile_version_id
    || parsed.data.profile_version_no !== snapshot.wf_version_no
    || parsed.data.policy_revision !== snapshot.wf_profile_revision
    || parsed.data.artifact_schema_version !== snapshot.wf_profile_schema_version
  ) {
    throw new SemanticWorkflowArtifactError(
      'PROFILE_ARTIFACT_INVALID',
      'The order workflow artifact failed semantic snapshot validation.',
    );
  }

  cacheArtifact(cacheKey, parsed.data);
  return parsed.data;
}

/** Test-only cache reset; production artifacts are immutable and safe to cache by checksum. */
export function clearSemanticWorkflowArtifactCache(): void {
  artifactCache.clear();
}
