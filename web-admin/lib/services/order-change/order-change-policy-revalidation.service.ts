import 'server-only';

import type { OrderChangeReviewProofBinding } from './order-change-capability.service';
import { resolveOrderChangePolicyBindings, type OrderChangePolicyQueryTx } from './order-change-edit-policy-resolver.service';
import { OrderChangeMutationError } from './order-change-mutation.service';

/** Workflow identity reread while the caller holds the commercial order lock. */
interface LockedPolicyOrder {
  wf_profile_id: string | null;
  wf_profile_version_id: string | null;
  current_status: string | null;
}

/**
 * Rechecks policy freshness inside Apply's locked transaction, immediately before
 * its commercial reads and writes. Source-level changes are harmless when the
 * same policy identity and revision still win.
 *
 * @param tx - Existing Apply transaction; the caller must already hold its order lock.
 * @param input - Trusted tenant/order identity and the freshly verified review binding.
 * @throws {OrderChangeMutationError} When the order or reviewed policy is unavailable or stale.
 * @example
 * await revalidateLockedOrderChangePolicy(tx, { tenantId, orderId, binding });
 */
export async function revalidateLockedOrderChangePolicy(
  tx: OrderChangePolicyQueryTx,
  input: { tenantId: string; orderId: string; binding: Pick<OrderChangeReviewProofBinding, 'policyIdentity'> | null | undefined },
): Promise<void> {
  const rows = await tx.$queryRaw<LockedPolicyOrder[]>`
    SELECT wf_profile_id, wf_profile_version_id, current_status
    FROM public.org_orders_mst
    WHERE id = ${input.orderId}::uuid AND tenant_org_id = ${input.tenantId}::uuid
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) throw new OrderChangeMutationError('ORDER_NOT_FOUND');
  const resolution = await resolveOrderChangePolicyBindings(tx, {
    tenantId: input.tenantId,
    profileId: order.wf_profile_id,
    profileVersionId: order.wf_profile_version_id,
    workflowStatus: order.current_status,
  });
  const reviewed = input.binding?.policyIdentity;
  if (!reviewed || resolution.editPolicyId !== reviewed.editPolicyId
    || resolution.policyRevision !== reviewed.policyRevision) {
    throw new OrderChangeMutationError('POLICY_CHANGED_REVIEW_REQUIRED');
  }
  // Rule changes advance the aggregate revision. A broken/empty authority still
  // fails closed even when a malformed binding happens to match its identity.
  if (resolution.denyReason !== 'NONE' || resolution.bindings.length === 0) {
    throw new OrderChangeMutationError('CAPABILITY_POLICY_BINDING_MISSING');
  }
}
