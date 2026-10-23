import type { Prisma } from '@prisma/client';
import { revalidateLockedOrderChangePolicy } from '@/lib/services/order-change/order-change-policy-revalidation.service';
import { resolveOrderChangePolicyBindings } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/services/order-change/order-change-edit-policy-resolver.service', () => ({ resolveOrderChangePolicyBindings: jest.fn() }));

const mockResolve = jest.mocked(resolveOrderChangePolicyBindings);
const tenantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const profileId = '33333333-3333-4333-8333-333333333333';
const versionId = '44444444-4444-4444-8444-444444444444';
const policyId = '55555555-5555-4555-8555-555555555555';
const binding = { policyIdentity: { editPolicyId: policyId, profileVersionId: versionId, policyRevision: 3 } };

describe('locked Edit Policy revalidation', () => {
  const query = jest.fn();
  const tx = { $queryRaw: query } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
  beforeEach(() => {
    jest.resetAllMocks();
    query.mockResolvedValue([{ wf_profile_id: profileId, wf_profile_version_id: versionId, current_status: 'intake' }]);
    mockResolve.mockResolvedValue({
      resolutionLevel: 'ORGANIZATION', denyReason: 'NONE', editPolicyId: policyId, policyRevision: 3, policyCode: 'STRICT',
      bindings: [{ editPolicyId: policyId, profileVersionId: versionId, policyRevision: 3,
        workflowStatus: 'intake', operationCode: 'CHANGE_ORDER_NOTES', targetType: 'ORDER',
        decision: 'ALLOW', reasonCode: 'ALLOW', messageKey: 'orders.edit.policyInfo.title', requiresReason: false }],
    });
  });

  it('uses the trusted tenant and locked stamped workflow identity', async () => {
    await expect(revalidateLockedOrderChangePolicy(tx, { tenantId, orderId, binding })).resolves.toBeUndefined();
    expect(mockResolve).toHaveBeenCalledWith(tx, { tenantId, profileId, profileVersionId: versionId, workflowStatus: 'intake' });
    const [sql, ...parameters] = query.mock.calls[0];
    expect(sql.join('?')).toContain('tenant_org_id = ?::uuid');
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(parameters).toEqual([orderId, tenantId]);
  });

  it('keeps a review valid when only the winning level changes', async () => {
    const current = await mockResolve(tx, { tenantId, profileId, profileVersionId: versionId, workflowStatus: 'intake' });
    mockResolve.mockResolvedValue({ ...current, resolutionLevel: 'VERSION_DEFAULT' });
    // The reviewed identity deliberately has no source level: removing a higher
    // link to the same policy cannot invalidate unchanged id/revision evidence.
    await expect(revalidateLockedOrderChangePolicy(tx, { tenantId, orderId, binding })).resolves.toBeUndefined();
  });

  it('rejects a revision replacement before commercial reads or writes', async () => {
    await expect(revalidateLockedOrderChangePolicy(tx, { tenantId, orderId,
      binding: { policyIdentity: { ...binding.policyIdentity, policyRevision: 2 } },
    })).rejects.toMatchObject({ code: 'POLICY_CHANGED_REVIEW_REQUIRED' });
  });

  it('rejects a broken or uncovered authority even if its identity still matches', async () => {
    mockResolve.mockResolvedValue({ resolutionLevel: 'ORGANIZATION', denyReason: 'STATUS_NOT_COVERED',
      editPolicyId: policyId, policyRevision: 3, policyCode: 'STRICT', bindings: [] });
    await expect(revalidateLockedOrderChangePolicy(tx, { tenantId, orderId, binding }))
      .rejects.toMatchObject({ code: 'CAPABILITY_POLICY_BINDING_MISSING' });
  });

  it('rejects an order that is absent from the authenticated tenant', async () => {
    query.mockResolvedValue([]);
    await expect(revalidateLockedOrderChangePolicy(tx, { tenantId, orderId, binding })).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
