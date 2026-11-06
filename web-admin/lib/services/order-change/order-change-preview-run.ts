import 'server-only';

import type { z } from 'zod';

import { getOrderChangeContext } from '@/lib/services/order-change/order-change-context.service';
import { loadOrderChangePreviewFacts } from '@/lib/services/order-change/order-change-preview-reads';
import { previewOrderChange } from '@/lib/services/order-change/order-change-preview.service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

/**
 * One Order Edit preview, the way the Preview and Quote routes both run it:
 * current context → preview facts → the shared calculation. Read-only.
 *
 * `issueProof: false` (the live card's quote, PLAN §6.4 / P4-08) passes no
 * signing key, so no review proof is issued; the calculation, policy decisions
 * and financial result are exactly the Review's.
 * @param input - preview inputs
 * @param input.tenantId - session tenant
 * @param input.actorUserId - session user
 * @param input.orderId - order being edited
 * @param input.request - the validated change request
 * @param input.issueProof - false for the quote
 * @returns the preview result (success or structured rejection)
 * @throws OrderChangeContextError, OrderChangePreviewReadError (mapped by the routes)
 */
export async function runOrderChangePreview(input: {
  tenantId: string;
  actorUserId: string;
  orderId: string;
  request: z.infer<typeof orderChangeRequestSchema>;
  issueProof: boolean;
}): ReturnType<typeof previewOrderChange> {
  const context = await getOrderChangeContext({ tenantId: input.tenantId, orderId: input.orderId });
  const facts = await loadOrderChangePreviewFacts({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    context,
    operations: input.request.operations,
  });
  return previewOrderChange({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    featureEnabled: facts.featureEnabled,
    canUsePermission: (permission) => hasPermissionServer(permission),
    context,
    request: input.request,
    bindings: facts.bindings,
    policyResolution: facts.policyResolution,
    priceEdit: facts.priceEdit,
    catalog: facts.catalog,
    payments: facts.payments,
    credits: facts.credits,
    refunds: facts.refunds,
    appliedDispositions: facts.appliedDispositions,
    settlementFingerprint: facts.settlementFingerprint,
    persistedTaxAmount: facts.persistedTaxAmount,
    auditFacts: facts.auditFacts,
    proofKey: input.issueProof ? facts.proofKey : null,
  });
}
