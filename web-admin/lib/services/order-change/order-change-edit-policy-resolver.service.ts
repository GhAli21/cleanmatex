import 'server-only';

import type { OrderChangeEditPolicyDenyReason, OrderChangeEditPolicyResolutionLevel } from '@/lib/types/order-change';
import type { OrderChangeCapabilityBinding } from './order-change-capability.service';

/** SQL owns precedence; this row describes its chosen authority even when no status rules exist. */
type EditPolicyResolutionRow = {
  resolution_level: OrderChangeEditPolicyResolutionLevel;
  deny_reason: OrderChangeEditPolicyDenyReason;
  edit_policy_id: string | null;
  policy_revision: number | null;
  policy_code: string | null;
  workflow_status: string | null;
  operation_code: OrderChangeCapabilityBinding['operationCode'] | null;
  target_type: OrderChangeCapabilityBinding['targetType'] | null;
  decision: OrderChangeCapabilityBinding['decision'] | null;
  reason_code: string | null;
  message_key: string | null;
  requires_reason: boolean | null;
  required_permission_code: string | null;
  override_permission_code: string | null;
};

/** Authority metadata survives a status hole so display and review proof use the same selected policy. */
export interface OrderChangeEditPolicyResolution {
  resolutionLevel: OrderChangeEditPolicyResolutionLevel;
  denyReason: OrderChangeEditPolicyDenyReason;
  editPolicyId: string | null;
  policyRevision: number | null;
  policyCode: string | null;
  bindings: readonly OrderChangeCapabilityBinding[];
}

/**
 * Maps the shared SQL resolver without duplicating its precedence or falling through a denied authority.
 *
 * @param tx - Trusted server transaction; Apply must call again under its order lock.
 * @param input - Trusted order tenant and stamped profile/version/status; tenantId scopes every SQL authority read.
 * @returns Selected authority plus only its live status bindings; a status hole retains policy identity.
 * @throws Propagates SQL failures, including a missing function, to keep authorization closed.
 * @example
 * await resolveOrderChangePolicyBindings(tx, { tenantId, profileId, profileVersionId, workflowStatus: 'intake' });
 */
export async function resolveOrderChangePolicyBindings(
  tx: OrderChangePolicyQueryTx,
  input: { tenantId: string; profileId: string | null; profileVersionId: string | null; workflowStatus: string | null },
): Promise<OrderChangeEditPolicyResolution> {
  // The function applies tenant_org_id = tenantId to every organization authority query; never use browser claims.
  const rows = await tx.$queryRaw<EditPolicyResolutionRow[]>`
    SELECT * FROM public.sys_wf_resolve_edit_policy(
      ${input.tenantId}::uuid,
      ${input.profileId}::uuid,
      ${input.profileVersionId}::uuid,
      ${input.workflowStatus}::text
    )
  `;
  const header = rows[0];
  if (!header) throw new Error('EDIT_POLICY_RESOLUTION_EMPTY');
  if (rows.some((row) => row.resolution_level !== header.resolution_level
    || row.deny_reason !== header.deny_reason || row.edit_policy_id !== header.edit_policy_id
    || row.policy_revision !== header.policy_revision)) {
    throw new Error('EDIT_POLICY_RESOLUTION_INCONSISTENT');
  }
  const resolution: OrderChangeEditPolicyResolution = {
    resolutionLevel: header.resolution_level,
    denyReason: header.deny_reason,
    editPolicyId: header.edit_policy_id,
    policyRevision: header.policy_revision,
    policyCode: header.policy_code,
    bindings: [],
  };
  if (header.resolution_level === 'DENY' || header.deny_reason !== 'NONE'
    || !header.edit_policy_id || header.policy_revision == null) return resolution;

  const bindings: OrderChangeCapabilityBinding[] = [];
  for (const row of rows) {
    if (!row.operation_code || !row.target_type || !row.decision || !row.workflow_status
      || !row.reason_code || !row.message_key) throw new Error('EDIT_POLICY_RESOLUTION_RULE_INVALID');
    bindings.push({
      editPolicyId: header.edit_policy_id,
      // The order's stamped version binds proof; the reusable policy's authored-against version is historical only.
      profileVersionId: input.profileVersionId,
      policyRevision: header.policy_revision,
      workflowStatus: row.workflow_status,
      operationCode: row.operation_code,
      targetType: row.target_type,
      decision: row.decision,
      reasonCode: row.reason_code,
      messageKey: row.message_key,
      requiresReason: row.requires_reason === true,
      requiredPermissionCode: row.required_permission_code ?? undefined,
      overridePermissionCode: row.override_permission_code ?? undefined,
    });
  }
  return { ...resolution, bindings };
}

/** Query-only port usable by both Prisma transactions and the existing Apply transaction adapter. */
export interface OrderChangePolicyQueryTx {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}
