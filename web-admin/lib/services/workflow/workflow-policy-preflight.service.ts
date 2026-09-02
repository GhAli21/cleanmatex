import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  resolveWorkflowProfileBindingWithPrisma,
  WorkflowProfileResolutionError,
} from '@/lib/services/workflow/workflow-profile-resolution.service';

/** Read-only Gate 2/3 evidence for whether a tenant can create and operate live-policy orders. */
export interface WorkflowPolicyPreflightInput {
  /** Authenticated tenant. Never accepted from another tenant's payload. */
  tenantId: string;
  branchId?: string;
  serviceCode?: string;
  /** Optional explicit version to check without requiring an assignment winner. */
  versionId?: string;
}

/** Assignment winner that would apply to a new order in this scope. */
export interface WorkflowPolicyPreflightAssignment {
  profileId: string;
  versionNo: number | null;
  versionId: string;
  policyRevision: number;
}

/** Live integrity result from `sys_wf_prof_ver_validate_live`. */
export interface WorkflowPolicyPreflightValidation {
  ok: boolean;
  error: string | null;
}

/** Count of active live-policy rows for the selected version. */
export interface WorkflowPolicyPreflightSections {
  modules: number;
  statuses: number;
  executions: number;
  channels: number;
  gates: number;
  initialRules: number;
  evidence: number;
}

/** Tenant-scoped preflight report. Contains no other tenant's assignment or order data. */
export interface WorkflowPolicyPreflightReport {
  tenantId: string;
  tenantFound: boolean;
  isHqTestDemo: boolean;
  assignment: WorkflowPolicyPreflightAssignment | null;
  assignmentErrorCode: string | null;
  versionId: string | null;
  versionStatus: string | null;
  profileCode: string | null;
  liveValidation: WorkflowPolicyPreflightValidation;
  sections: WorkflowPolicyPreflightSections;
  readyForNewOrders: boolean;
}

const EMPTY_SECTIONS: WorkflowPolicyPreflightSections = {
  modules: 0,
  statuses: 0,
  executions: 0,
  channels: 0,
  gates: 0,
  initialRules: 0,
  evidence: 0,
};

/**
 * Reports whether a tenant's live profile assignment and selected version are
 * executable. It never mutates data and never reads another tenant's rows.
 *
 * @param input Tenant plus optional branch/service/version scope.
 * @returns A fail-closed report. Missing tenant or policy is `readyForNewOrders: false`.
 */
export async function runWorkflowPolicyPreflight(
  input: WorkflowPolicyPreflightInput,
): Promise<WorkflowPolicyPreflightReport> {
  const tenantRows = await prisma.$queryRaw<Array<{ is_hq_test_demo: boolean }>>`
    SELECT COALESCE(is_hq_test_demo, false) AS is_hq_test_demo
    FROM public.org_tenants_mst
    WHERE id = ${input.tenantId}::uuid
    LIMIT 1
  `;
  const tenant = tenantRows[0];
  if (!tenant) {
    return {
      tenantId: input.tenantId,
      tenantFound: false,
      isHqTestDemo: false,
      assignment: null,
      assignmentErrorCode: 'TENANT_NOT_FOUND',
      versionId: input.versionId ?? null,
      versionStatus: null,
      profileCode: null,
      liveValidation: { ok: false, error: 'Tenant was not found.' },
      sections: EMPTY_SECTIONS,
      readyForNewOrders: false,
    };
  }

  let assignment: WorkflowPolicyPreflightAssignment | null = null;
  let assignmentErrorCode: string | null = null;
  if (!input.versionId) {
    try {
      const binding = await resolveWorkflowProfileBindingWithPrisma(prisma, {
        tenantId: input.tenantId,
        branchId: input.branchId,
        serviceCode: input.serviceCode,
      });
      assignment = {
        profileId: binding.profileId,
        versionNo: binding.versionNo,
        versionId: binding.versionId,
        policyRevision: binding.policyRevision,
      };
    } catch (error) {
      if (error instanceof WorkflowProfileResolutionError) {
        assignmentErrorCode = error.code;
      } else {
        throw error;
      }
    }
  }

  const versionId = input.versionId ?? assignment?.versionId ?? null;
  if (!versionId) {
    return {
      tenantId: input.tenantId,
      tenantFound: true,
      isHqTestDemo: tenant.is_hq_test_demo,
      assignment,
      assignmentErrorCode: assignmentErrorCode ?? 'PROFILE_ASSIGNMENT_REQUIRED',
      versionId: null,
      versionStatus: null,
      profileCode: null,
      liveValidation: { ok: false, error: 'No executable profile version is assigned.' },
      sections: EMPTY_SECTIONS,
      readyForNewOrders: false,
    };
  }

  const versionRows = await prisma.$queryRaw<Array<{
    version_status: string;
    profile_code: string;
  }>>`
    SELECT version_row.version_status, profile_row.profile_code
    FROM public.sys_wf_profile_ver_mst AS version_row
    INNER JOIN public.sys_wf_profiles_cd AS profile_row
      ON profile_row.profile_id = version_row.profile_id
    WHERE version_row.version_id = ${versionId}::uuid
      AND version_row.is_active = true
      AND version_row.rec_status = 1
    LIMIT 1
  `;
  const version = versionRows[0];
  const sections = await loadSectionCounts(versionId);
  const liveValidation = await validateLiveVersion(versionId);
  const lifecycleOk = version?.version_status === 'PUBLISHED'
    || (version?.version_status === 'PILOT' && tenant.is_hq_test_demo);
  const readyForNewOrders = Boolean(
    version
    && lifecycleOk
    && liveValidation.ok
    && (assignment !== null || Boolean(input.versionId))
    && (input.versionId || assignmentErrorCode === null),
  );

  return {
    tenantId: input.tenantId,
    tenantFound: true,
    isHqTestDemo: tenant.is_hq_test_demo,
    assignment,
    assignmentErrorCode,
    versionId,
    versionStatus: version?.version_status ?? null,
    profileCode: version?.profile_code ?? null,
    liveValidation,
    sections,
    readyForNewOrders,
  };
}

async function validateLiveVersion(versionId: string): Promise<WorkflowPolicyPreflightValidation> {
  try {
    await prisma.$executeRaw`SELECT public.sys_wf_prof_ver_validate_live(${versionId}::uuid)`;
    return { ok: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live policy validation failed.';
    return { ok: false, error: message };
  }
}

async function loadSectionCounts(versionId: string): Promise<WorkflowPolicyPreflightSections> {
  const rows = await prisma.$queryRaw<Array<{
    modules: number;
    statuses: number;
    executions: number;
    channels: number;
    gates: number;
    initial_rules: number;
    evidence: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_module_cf
        WHERE version_id = ${versionId}::uuid AND is_active = true AND rec_status = 1) AS modules,
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_mod_st_cf
        WHERE version_id = ${versionId}::uuid AND is_active = true AND rec_status = 1) AS statuses,
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_exec_cf
        WHERE version_id = ${versionId}::uuid AND is_active = true AND rec_status = 1) AS executions,
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_exec_ch_cf AS channel_row
        INNER JOIN public.sys_wf_prof_ver_exec_cf AS executable
          ON executable.exec_id = channel_row.exec_id
        WHERE executable.version_id = ${versionId}::uuid
          AND channel_row.is_active = true) AS channels,
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_exec_gate_cf AS gate_row
        INNER JOIN public.sys_wf_prof_ver_exec_cf AS executable
          ON executable.exec_id = gate_row.exec_id
        WHERE executable.version_id = ${versionId}::uuid
          AND gate_row.is_active = true) AS gates,
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_init_cf
        WHERE version_id = ${versionId}::uuid AND is_active = true AND rec_status = 1) AS initial_rules,
      (SELECT count(*)::int FROM public.sys_wf_prof_ver_evidence_cf
        WHERE version_id = ${versionId}::uuid AND is_active = true AND rec_status = 1) AS evidence
  `;
  const row = rows[0];
  return {
    modules: row?.modules ?? 0,
    statuses: row?.statuses ?? 0,
    executions: row?.executions ?? 0,
    channels: row?.channels ?? 0,
    gates: row?.gates ?? 0,
    initialRules: row?.initial_rules ?? 0,
    evidence: row?.evidence ?? 0,
  };
}
