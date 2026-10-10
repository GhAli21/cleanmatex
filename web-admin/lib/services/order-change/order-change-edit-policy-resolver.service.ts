import 'server-only';

import type { Prisma } from '@prisma/client';
import {
  type OrderChangeCapabilityBinding,
  type OrderChangeCapabilityDecisionKind,
  type OrderChangeCapabilityTargetType,
} from './order-change-capability.service';

/** Raw row shape kept local because policy resolution is intentionally transaction-bound. */
type EditPolicyRuleRow = {
  edit_policy_id: string;
  profile_version_id: string;
  policy_revision: number;
  workflow_status: string;
  operation_code: OrderChangeCapabilityBinding['operationCode'];
  target_type: OrderChangeCapabilityTargetType;
  decision: OrderChangeCapabilityDecisionKind;
  reason_code: string;
  message_key: string;
  requires_reason: boolean;
  required_permission_code: string | null;
  override_permission_code: string | null;
};

/**
 * Resolves the one active Edit Policy matrix for a tenant/order workflow snapshot.
 *
 * @param tx - Existing commercial transaction; callers must re-resolve under their Apply lock.
 * @param input - Trusted tenant, stamped workflow profile version, and current workflow status.
 * @returns Explicit active policy bindings, or an empty array when no single valid authority exists.
 * @example
 * await resolveOrderChangePolicyBindings(tx, { tenantId, profileVersionId, workflowStatus: 'intake' });
 */
export async function resolveOrderChangePolicyBindings(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; profileVersionId: string | null; workflowStatus: string | null },
): Promise<readonly OrderChangeCapabilityBinding[]> {
  if (!input.profileVersionId || !input.workflowStatus) return [];

  // Tenant is included on the assignment predicate even though the transaction also uses tenant RLS.
  const rows = await tx.$queryRaw<EditPolicyRuleRow[]>`
    SELECT
      policy.id::text AS edit_policy_id,
      policy.workflow_profile_version_id::text AS profile_version_id,
      policy.policy_revision,
      rule.workflow_status,
      rule.operation_code,
      rule.target_type,
      rule.decision,
      rule.reason_code,
      rule.message_key,
      rule.requires_reason,
      rule.required_permission_code,
      rule.override_permission_code
    FROM public.org_wf_edit_policy_asg_cf AS assignment
    INNER JOIN public.sys_wf_edit_policy_mst AS policy
      ON policy.id = assignment.edit_policy_id
     AND policy.workflow_profile_version_id = assignment.workflow_profile_version_id
    INNER JOIN public.sys_wf_edit_policy_rule_dtl AS rule
      ON rule.edit_policy_id = policy.id
    WHERE assignment.tenant_org_id = ${input.tenantId}::uuid
      AND assignment.workflow_profile_version_id = ${input.profileVersionId}::uuid
      AND assignment.rec_status = 1
      AND assignment.is_active = true
      AND policy.lifecycle_status IN ('PILOT', 'PUBLISHED')
      AND policy.rec_status = 1
      AND policy.is_active = true
      AND rule.workflow_status = ${input.workflowStatus}
      AND rule.rec_status = 1
      AND rule.is_active = true
    ORDER BY policy.id, rule.operation_code, rule.target_type
  `;

  const policyIds = new Set(rows.map((row) => row.edit_policy_id));
  if (policyIds.size !== 1) return [];

  return rows.map((row) => ({
    editPolicyId: row.edit_policy_id,
    profileVersionId: row.profile_version_id,
    policyRevision: row.policy_revision,
    workflowStatus: row.workflow_status,
    operationCode: row.operation_code,
    targetType: row.target_type,
    decision: row.decision,
    reasonCode: row.reason_code,
    messageKey: row.message_key,
    requiresReason: row.requires_reason,
    requiredPermissionCode: row.required_permission_code ?? undefined,
    overridePermissionCode: row.override_permission_code ?? undefined,
  }));
}
