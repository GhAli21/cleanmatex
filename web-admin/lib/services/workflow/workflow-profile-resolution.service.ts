import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';

/** Persisted workflow profile/version snapshot for a newly created order. */
export interface ResolvedWorkflowProfileBinding {
  profileId: string;
  versionNo: number;
  basedOnTemplateId: string | null;
  versionId: string;
  artifactId: string;
  policyRevision: number;
  artifactSchemaVersion: number;
  artifactChecksum: string;
  initialRules: ResolvedWorkflowInitialRule[];
}

/** Minimal safe subset of the immutable artifact required during order creation. */
export interface ResolvedWorkflowInitialRule {
  rule_code: string;
  order_source_code: string | null;
  order_type_id: string | null;
  is_retail: boolean | null;
  is_quick_drop: boolean | null;
  initial_status: string;
  priority: number;
}

/** Safe configuration failure exposed by order creation adapters. */
export class WorkflowProfileResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowProfileResolutionError';
  }
}

interface AssignmentRow {
  wf_profile_id: string;
  wf_version_no: number | null;
  branch_id: string | null;
  service_code: string | null;
  is_default: boolean;
  created_at: string;
}

interface VersionRow {
  version_id: string;
  profile_id: string;
  version_no: number;
  based_on_template_id: string | null;
  version_status: 'PILOT' | 'PUBLISHED';
  policy_revision: number;
  compiled_schema_version: number | null;
  compiled_checksum: string | null;
  current_artifact_id: string | null;
}

interface ArtifactRow {
  artifact_id: string;
  version_id: string;
  policy_revision: number;
  artifact_schema_version: number;
  artifact_checksum: string;
  compiled_artifact: unknown;
}

function assignmentMatches(
  assignment: AssignmentRow,
  branchId: string | undefined,
  serviceCode: string | undefined,
): boolean {
  return (!assignment.branch_id || assignment.branch_id === branchId)
    && (!assignment.service_code || assignment.service_code === serviceCode);
}

function assignmentRank(
  assignment: AssignmentRow,
  branchId: string | undefined,
  serviceCode: string | undefined,
): number {
  return Number(assignment.branch_id === branchId && !!branchId)
    + Number(assignment.service_code === serviceCode && !!serviceCode);
}

/**
 * Chooses the most-specific active assignment. An assignment with a service
 * scope is never applied when the caller cannot identify that service.
 */
function chooseAssignment(
  assignments: AssignmentRow[],
  branchId: string | undefined,
  serviceCode: string | undefined,
): AssignmentRow | null {
  return assignments
    .filter((assignment) => assignmentMatches(assignment, branchId, serviceCode))
    .sort((left, right) => {
      const rankDifference = assignmentRank(right, branchId, serviceCode) - assignmentRank(left, branchId, serviceCode);
      if (rankDifference !== 0) return rankDifference;
      if (left.is_default !== right.is_default) return left.is_default ? -1 : 1;
      return left.created_at.localeCompare(right.created_at);
    })[0] ?? null;
}

function chooseExecutableVersion(
  assignment: AssignmentRow,
  versions: VersionRow[],
  isHqTestDemo: boolean,
): VersionRow {
  const version = assignment.wf_version_no === null
    ? versions
      .filter((candidate) => candidate.version_status === 'PUBLISHED')
      .sort((left, right) => right.version_no - left.version_no)[0]
    : versions.find((candidate) => candidate.version_no === assignment.wf_version_no
      && (candidate.version_status === 'PUBLISHED'
        || (candidate.version_status === 'PILOT' && isHqTestDemo)));

  if (!version) {
    throw new WorkflowProfileResolutionError(
      'The assigned workflow profile has no executable published version or eligible Pilot candidate. Contact your platform administrator.',
    );
  }

  return version;
}

function parseInitialRules(compiledArtifact: unknown): ResolvedWorkflowInitialRule[] {
  if (!compiledArtifact || typeof compiledArtifact !== 'object') {
    throw new WorkflowProfileResolutionError('The workflow artifact is malformed. Contact your platform administrator.');
  }
  const candidate = compiledArtifact as { initial_rules?: unknown };
  if (!Array.isArray(candidate.initial_rules)) {
    throw new WorkflowProfileResolutionError('The workflow artifact has no initial-rule contract. Contact your platform administrator.');
  }

  return candidate.initial_rules.map((rule) => {
    if (!rule || typeof rule !== 'object') {
      throw new WorkflowProfileResolutionError('The workflow artifact contains an invalid initial rule.');
    }
    const value = rule as Partial<ResolvedWorkflowInitialRule>;
    if (
      typeof value.rule_code !== 'string'
      || typeof value.initial_status !== 'string'
      || !Number.isInteger(value.priority)
    ) {
      throw new WorkflowProfileResolutionError('The workflow artifact contains an invalid initial-rule shape.');
    }
    return {
      rule_code: value.rule_code,
      order_source_code: typeof value.order_source_code === 'string' ? value.order_source_code : null,
      order_type_id: typeof value.order_type_id === 'string' ? value.order_type_id : null,
      is_retail: typeof value.is_retail === 'boolean' ? value.is_retail : null,
      is_quick_drop: typeof value.is_quick_drop === 'boolean' ? value.is_quick_drop : null,
      initial_status: value.initial_status,
      priority: value.priority,
    };
  });
}

function buildBinding(version: VersionRow, artifact: ArtifactRow): ResolvedWorkflowProfileBinding {
  if (
    !version.current_artifact_id
    || version.current_artifact_id !== artifact.artifact_id
    || version.version_id !== artifact.version_id
    || version.policy_revision !== artifact.policy_revision
    || version.compiled_schema_version !== artifact.artifact_schema_version
    || version.compiled_checksum !== artifact.artifact_checksum
  ) {
    throw new WorkflowProfileResolutionError(
      'The assigned workflow profile artifact does not match its version metadata. Contact your platform administrator.',
    );
  }

  return {
    profileId: version.profile_id,
    versionNo: version.version_no,
    basedOnTemplateId: version.based_on_template_id,
    versionId: version.version_id,
    artifactId: artifact.artifact_id,
    policyRevision: artifact.policy_revision,
    artifactSchemaVersion: artifact.artifact_schema_version,
    artifactChecksum: artifact.artifact_checksum,
    initialRules: parseInitialRules(artifact.compiled_artifact),
  };
}

/** Resolves a workflow profile snapshot through the tenant-scoped Supabase path. */
export async function resolveWorkflowProfileBindingWithSupabase(
  supabase: SupabaseClient,
  input: { tenantId: string; branchId?: string; serviceCode?: string },
): Promise<ResolvedWorkflowProfileBinding | null> {
  const { data: assignmentData, error: assignmentError } = await supabase
    .from('org_wf_profile_assign_cf')
    .select('wf_profile_id, wf_version_no, branch_id, service_code, is_default, created_at')
    .eq('tenant_org_id', input.tenantId)
    .eq('is_active', true)
    .eq('rec_status', 1);
  if (assignmentError) throw assignmentError;

  const assignment = chooseAssignment((assignmentData ?? []) as AssignmentRow[], input.branchId, input.serviceCode);
  if (!assignment) return null;

  const { data: tenantData, error: tenantError } = await supabase
    .from('org_tenants_mst')
    .select('is_hq_test_demo')
    .eq('id', input.tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;

  const { data: profileData, error: profileError } = await supabase
    .from('sys_wf_profiles_cd')
    .select('profile_id')
    .eq('profile_id', assignment.wf_profile_id)
    .eq('is_active', true)
    .eq('rec_status', 1)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profileData) {
    throw new WorkflowProfileResolutionError('The assigned workflow profile is no longer active.');
  }

  const { data: versionData, error: versionError } = await supabase
    .from('sys_wf_profile_ver_mst')
    .select('version_id, profile_id, version_no, based_on_template_id, version_status, policy_revision, compiled_schema_version, compiled_checksum, current_artifact_id')
    .eq('profile_id', assignment.wf_profile_id)
    .in('version_status', ['PILOT', 'PUBLISHED'])
    .eq('is_active', true)
    .eq('rec_status', 1)
    .order('version_no', { ascending: false });
  if (versionError) throw versionError;
  const version = chooseExecutableVersion(assignment, (versionData ?? []) as VersionRow[], Boolean(tenantData?.is_hq_test_demo));
  if (!version.current_artifact_id) {
    throw new WorkflowProfileResolutionError('The assigned workflow profile has no current compiled artifact.');
  }

  const { data: artifactData, error: artifactError } = await supabase
    .from('sys_wf_prof_ver_artifact_cf')
    .select('artifact_id, version_id, policy_revision, artifact_schema_version, artifact_checksum, compiled_artifact')
    .eq('artifact_id', version.current_artifact_id)
    .eq('version_id', version.version_id)
    .eq('compile_state', 'VALID')
    .eq('is_active', true)
    .eq('rec_status', 1)
    .maybeSingle();
  if (artifactError) throw artifactError;
  if (!artifactData) {
    throw new WorkflowProfileResolutionError('The assigned workflow profile artifact is unavailable.');
  }
  return buildBinding(version, artifactData as ArtifactRow);
}

/** Resolves the same immutable profile snapshot inside a Prisma order transaction. */
export async function resolveWorkflowProfileBindingWithPrisma(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; branchId?: string; serviceCode?: string },
): Promise<ResolvedWorkflowProfileBinding | null> {
  const assignments = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
    SELECT
      wf_profile_id::text,
      wf_version_no,
      branch_id::text,
      service_code,
      is_default,
      created_at::text
    FROM public.org_wf_profile_assign_cf
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND is_active = true
      AND rec_status = 1
  `);
  const assignment = chooseAssignment(assignments, input.branchId, input.serviceCode);
  if (!assignment) return null;

  const tenantRows = await tx.$queryRaw<Array<{ is_hq_test_demo: boolean }>>(Prisma.sql`
    SELECT is_hq_test_demo
    FROM public.org_tenants_mst
    WHERE id = ${input.tenantId}::uuid
    LIMIT 1
  `);
  const isHqTestDemo = Boolean(tenantRows[0]?.is_hq_test_demo);

  const versions = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
    SELECT
      v.version_id::text,
      v.profile_id::text,
      v.version_no,
      v.based_on_template_id::text,
      v.version_status,
      v.policy_revision,
      v.compiled_schema_version,
      v.compiled_checksum,
      v.current_artifact_id::text
    FROM public.sys_wf_profile_ver_mst v
    INNER JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
    WHERE v.profile_id = ${assignment.wf_profile_id}::uuid
      AND v.version_status IN ('PILOT', 'PUBLISHED')
      AND v.is_active = true
      AND v.rec_status = 1
      AND p.is_active = true
      AND p.rec_status = 1
    ORDER BY v.version_no DESC
  `);
  const version = chooseExecutableVersion(assignment, versions, isHqTestDemo);
  if (!version.current_artifact_id) {
    throw new WorkflowProfileResolutionError('The assigned workflow profile has no current compiled artifact.');
  }
  const artifactRows = await tx.$queryRaw<ArtifactRow[]>(Prisma.sql`
    SELECT
      artifact_id::text,
      version_id::text,
      policy_revision,
      artifact_schema_version,
      artifact_checksum,
      compiled_artifact
    FROM public.sys_wf_prof_ver_artifact_cf
    WHERE artifact_id = ${version.current_artifact_id}::uuid
      AND version_id = ${version.version_id}::uuid
      AND compile_state = 'VALID'
      AND is_active = true
      AND rec_status = 1
    LIMIT 1
  `);
  if (!artifactRows[0]) {
    throw new WorkflowProfileResolutionError('The assigned workflow profile artifact is unavailable.');
  }
  return buildBinding(version, artifactRows[0]);
}
