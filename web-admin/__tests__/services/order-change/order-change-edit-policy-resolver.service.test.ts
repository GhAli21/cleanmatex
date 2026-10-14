/** @jest-environment node */

jest.mock('server-only', () => ({}));

import { evaluateOrderChangeCapability } from '@/lib/services/order-change/order-change-capability.service';
import { resolveOrderChangePolicyBindings } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const PROFILE = 'a1000000-0000-4000-8000-000000000076';
const POLICY = '346dc050-cbbd-48e3-9e86-afebe126f531';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function ruleRow(operationCode: 'REMOVE_PIECE' | 'ADD_ITEM') {
  return {
    edit_policy_id: POLICY,
    profile_version_id: PROFILE,
    policy_revision: 3,
    workflow_status: 'processing',
    operation_code: operationCode,
    target_type: operationCode === 'ADD_ITEM' ? 'ORDER' : 'PIECE',
    decision: 'ALLOW',
    reason_code: 'CAPABILITY_POLICY_ALLOWED',
    message_key: 'orderChange.policy.allowed',
    requires_reason: false,
    required_permission_code: null,
    override_permission_code: null,
  };
}

function fakeTx(rows: ReturnType<typeof ruleRow>[]) {
  const query = jest.fn(async () => rows);
  return { tx: { $queryRaw: query } as never, query };
}

function capabilityInput(bindings: Awaited<ReturnType<typeof resolveOrderChangePolicyBindings>>, code: 'REMOVE_PIECE' | 'ADD_ITEM') {
  return {
    facts: {
      featureEnabled: true,
      committedAt: new Date('2026-10-01T10:00:00.000Z'),
      editAccessStatus: 'OPEN',
      editBlockedUntil: null,
      workflowStatus: 'processing',
      editStateVersion: 3,
      wfStateVersion: 5,
    },
    actor: { actorUserId: ACTOR, canUsePermission: jest.fn().mockResolvedValue(true) },
    operation: { seq: 1, code, hasReason: true },
    bindings,
    now: new Date('2026-10-03T10:00:00.000Z'),
  };
}

describe('order change edit policy resolver', () => {
  it('denies one missing operation while the same Pilot policy allows a present operation', async () => {
    const { tx, query } = fakeTx([ruleRow('REMOVE_PIECE')]);
    const bindings = await resolveOrderChangePolicyBindings(tx, {
      tenantId: TENANT,
      profileVersionId: PROFILE,
      workflowStatus: 'processing',
    });

    const sql = (query.mock.calls[0][0] as TemplateStringsArray).join(' ');
    expect(sql).toContain('assignment.tenant_org_id');
    expect(query.mock.calls[0][1]).toBe(TENANT);
    expect(bindings).toEqual([expect.objectContaining({
      editPolicyId: POLICY,
      operationCode: 'REMOVE_PIECE',
      policyRevision: 3,
    })]);

    await expect(evaluateOrderChangeCapability(capabilityInput(bindings, 'ADD_ITEM'))).resolves.toMatchObject({
      decision: 'DENY',
      reasonCode: 'CAPABILITY_POLICY_BINDING_MISSING',
      messageKey: 'orderChange.capability.policyBindingMissing',
    });
    await expect(evaluateOrderChangeCapability(capabilityInput(bindings, 'REMOVE_PIECE'))).resolves.toMatchObject({
      decision: 'ALLOW',
      policyIdentity: { editPolicyId: POLICY, policyRevision: 3 },
    });
  });

  it('denies when the organization has no single live Pilot or Published policy', async () => {
    const { tx } = fakeTx([]);
    const bindings = await resolveOrderChangePolicyBindings(tx, {
      tenantId: TENANT,
      profileVersionId: PROFILE,
      workflowStatus: 'processing',
    });

    expect(bindings).toEqual([]);
    await expect(evaluateOrderChangeCapability(capabilityInput(bindings, 'REMOVE_PIECE'))).resolves.toMatchObject({
      decision: 'DENY',
      reasonCode: 'CAPABILITY_POLICY_BINDING_MISSING',
    });
  });
});
