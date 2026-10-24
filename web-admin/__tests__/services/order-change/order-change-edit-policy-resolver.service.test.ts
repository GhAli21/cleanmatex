/** @jest-environment node */
jest.mock('server-only', () => ({}));

import { evaluateOrderChangeCapability } from '@/lib/services/order-change/order-change-capability.service';
import { resolveOrderChangePolicyBindings } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';
import type { OrderChangeEditPolicyDenyReason, OrderChangeEditPolicyResolutionLevel } from '@/lib/types/order-change';

const TENANT = '11111111-1111-1111-1111-111111111111';
const PROFILE = 'a1000000-0000-4000-8000-000000000076';
const VERSION = 'b1000000-0000-4000-8000-000000000076';
const POLICY = '346dc050-cbbd-48e3-9e86-afebe126f531';
const input = { tenantId: TENANT, profileId: PROFILE, profileVersionId: VERSION, workflowStatus: 'processing' };

/** SQL-shaped output tests mapping without reimplementing database precedence. */
function ruleRow(level: OrderChangeEditPolicyResolutionLevel = 'ORGANIZATION', reason: OrderChangeEditPolicyDenyReason = 'NONE') {
  return {
    resolution_level: level, deny_reason: reason,
    edit_policy_id: level === 'DENY' ? null : POLICY, policy_revision: level === 'DENY' ? null : 3,
    policy_code: level === 'DENY' ? null : 'STRICT', workflow_status: 'processing',
    operation_code: reason === 'NONE' ? 'REMOVE_PIECE' : null, target_type: reason === 'NONE' ? 'PIECE' : null,
    decision: reason === 'NONE' ? 'ALLOW' : null, reason_code: reason === 'NONE' ? 'POLICY_ALLOWED' : null,
    message_key: reason === 'NONE' ? 'orderChange.policy.allowed' : null,
    requires_reason: false, required_permission_code: null, override_permission_code: null,
  };
}
function fakeTx(rows: ReturnType<typeof ruleRow>[]) {
  const query = jest.fn(async (..._args: unknown[]) => rows);
  return { tx: { $queryRaw: query } as never, query };
}

describe('order change shared Edit Policy resolver mapper', () => {
  it.each(['ORGANIZATION', 'PROFILE', 'VERSION_DEFAULT'] as const)('preserves SQL-selected %s authority', async (resolutionLevel) => {
    const { tx, query } = fakeTx([ruleRow(resolutionLevel)]);
    const resolution = await resolveOrderChangePolicyBindings(tx, input);
    expect(resolution).toMatchObject({ resolutionLevel, denyReason: 'NONE', editPolicyId: POLICY, policyRevision: 3 });
    expect(resolution.bindings).toEqual([expect.objectContaining({ editPolicyId: POLICY, profileVersionId: VERSION, operationCode: 'REMOVE_PIECE', policyRevision: 3 })]);
    const sql = (query.mock.calls[0][0] as TemplateStringsArray).join(' ');
    expect(sql).toContain('public.sys_oc_resolve_edit_policy');
    expect(sql).not.toContain('org_oc_edit_policy_asg_cf');
    expect(query.mock.calls[0].slice(1)).toEqual([TENANT, PROFILE, VERSION, 'processing']);
  });
  it('retains status-hole identity while capability denies all catalog operations', async () => {
    const resolution = await resolveOrderChangePolicyBindings(fakeTx([ruleRow('VERSION_DEFAULT', 'STATUS_NOT_COVERED')]).tx, input);
    expect(resolution).toMatchObject({ denyReason: 'STATUS_NOT_COVERED', editPolicyId: POLICY, policyRevision: 3, bindings: [] });
    await expect(evaluateOrderChangeCapability({
      facts: { featureEnabled: true, committedAt: new Date(), editAccessStatus: 'OPEN', editBlockedUntil: null, workflowStatus: 'processing', editStateVersion: 1, wfStateVersion: 1 },
      actor: { actorUserId: TENANT, canUsePermission: async () => true },
      operation: { seq: 1, code: 'CHANGE_UNLISTED', hasReason: true }, bindings: resolution.bindings,
    })).resolves.toMatchObject({ decision: 'DENY', reasonCode: 'CAPABILITY_POLICY_BINDING_MISSING' });
  });
  it.each(['AMBIGUOUS_ORGANIZATION', 'AMBIGUOUS_PROFILE', 'AMBIGUOUS_DEFAULT', 'POLICY_NOT_USABLE', 'NO_AUTHORITY'] as const)('maps %s without fallback', async (reason) => {
    await expect(resolveOrderChangePolicyBindings(fakeTx([ruleRow('DENY', reason)]).tx, input)).resolves.toMatchObject({ resolutionLevel: 'DENY', denyReason: reason, editPolicyId: null, bindings: [] });
  });
  it('passes a null profile unchanged and preserves the SQL version default', async () => {
    const { tx, query } = fakeTx([ruleRow('VERSION_DEFAULT')]);
    await expect(resolveOrderChangePolicyBindings(tx, { ...input, profileId: null })).resolves.toMatchObject({ resolutionLevel: 'VERSION_DEFAULT' });
    expect(query.mock.calls[0][2]).toBeNull();
  });
  it('preserves organization bindings when stamped profile identifiers are null', async () => {
    const resolution = await resolveOrderChangePolicyBindings(fakeTx([ruleRow()]).tx, { ...input, profileId: null, profileVersionId: null });
    expect(resolution.bindings[0]).toMatchObject({ profileVersionId: null, operationCode: 'REMOVE_PIECE' });
  });
  it('passes another trusted organization into the SQL tenant predicate', async () => {
    const { tx, query } = fakeTx([ruleRow('DENY', 'NO_AUTHORITY')]);
    const otherTenant = '22222222-2222-4222-8222-222222222222';
    await resolveOrderChangePolicyBindings(tx, { ...input, tenantId: otherTenant });
    expect(query.mock.calls[0][1]).toBe(otherTenant);
  });
  it('propagates function failures and rejects empty or mixed authority output', async () => {
    const tx = { $queryRaw: jest.fn().mockRejectedValue(new Error('function unavailable')) } as never;
    await expect(resolveOrderChangePolicyBindings(tx, input)).rejects.toThrow('function unavailable');
    await expect(resolveOrderChangePolicyBindings(fakeTx([]).tx, input)).rejects.toThrow('EDIT_POLICY_RESOLUTION_EMPTY');
    await expect(resolveOrderChangePolicyBindings(fakeTx([ruleRow(), ruleRow('PROFILE')]).tx, input)).rejects.toThrow('EDIT_POLICY_RESOLUTION_INCONSISTENT');
  });
});
