import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';

/** Persisted workflow profile/version snapshot for a newly created order. */
export interface ResolvedWorkflowProfileBinding {
  profileId: string;
  versionNo: number;
  basedOnTemplateId: string | null;
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
  profile_id: string;
  version_no: number;
  based_on_template_id: string | null;
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

function requirePublishedBinding(
  assignment: AssignmentRow,
  versions: VersionRow[],
): ResolvedWorkflowProfileBinding {
  const version = assignment.wf_version_no === null
    ? versions.sort((left, right) => right.version_no - left.version_no)[0]
    : versions.find((candidate) => candidate.version_no === assignment.wf_version_no);

  if (!version) {
    throw new WorkflowProfileResolutionError(
      'The assigned workflow profile has no active published version. Contact your platform administrator.',
    );
  }

  return {
    profileId: version.profile_id,
    versionNo: version.version_no,
    basedOnTemplateId: version.based_on_template_id,
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
    .select('profile_id, version_no, based_on_template_id')
    .eq('profile_id', assignment.wf_profile_id)
    .eq('version_status', 'PUBLISHED')
    .eq('is_active', true)
    .eq('rec_status', 1)
    .order('version_no', { ascending: false });
  if (versionError) throw versionError;

  return requirePublishedBinding(assignment, (versionData ?? []) as VersionRow[]);
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

  const versions = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
    SELECT v.profile_id::text, v.version_no, v.based_on_template_id::text
    FROM public.sys_wf_profile_ver_mst v
    INNER JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
    WHERE v.profile_id = ${assignment.wf_profile_id}::uuid
      AND v.version_status = 'PUBLISHED'
      AND v.is_active = true
      AND v.rec_status = 1
      AND p.is_active = true
      AND p.rec_status = 1
    ORDER BY v.version_no DESC
  `);
  return requirePublishedBinding(assignment, versions);
}
