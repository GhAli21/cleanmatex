/**
 * @jest-environment node
 */
import { resolveEditControlCapability, resolveEditControlGroup } from '@features/orders/order-change/edit-control-capability';
import type { OrderChangeEditPolicyInfo } from '@/lib/types/order-change';

const POLICY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function policy(rules: OrderChangeEditPolicyInfo['rules']): OrderChangeEditPolicyInfo {
  return {
    status: 'READY',
    workflowStatus: 'processing',
    editPolicyId: POLICY_ID,
    policyRevision: 3,
    assignment: {
      tenantOrgId: '11111111-1111-1111-1111-111111111111',
      assignmentId: null,
      profileId: null,
      profileCode: 'WF_V2_STANDARD',
      profileVersionId: null,
      versionNo: null,
      versionStatus: null,
      editPolicyId: POLICY_ID,
      policyCode: null,
      policyName: null,
      policyName2: null,
      lifecycleStatus: null,
    },
    rules,
  };
}

describe('resolveEditControlCapability', () => {
  it('keeps New Order open when no policy is loaded', () => {
    expect(resolveEditControlCapability(null, 'ADD_ITEM')).toEqual({ state: 'CREATE', interactive: true, reasonKey: null });
  });

  it('denies a missing policy and a missing rule', () => {
    const missing: OrderChangeEditPolicyInfo = { status: 'MISSING', workflowStatus: 'processing', editPolicyId: null, policyRevision: null, assignment: { tenantOrgId: '11111111-1111-1111-1111-111111111111', assignmentId: null, profileId: null, profileCode: null, profileVersionId: null, versionNo: null, versionStatus: null, editPolicyId: null, policyCode: null, policyName: null, policyName2: null, lifecycleStatus: null }, rules: [] };
    expect(resolveEditControlCapability(missing, 'CHANGE_ORDER_NOTES').state).toBe('DENIED');
    expect(resolveEditControlCapability(policy([]), 'CHANGE_ORDER_NOTES')).toMatchObject({ state: 'DENIED', reasonKey: 'deny', interactive: false });
  });

  it('keeps an allowed note and an allowed preference open while editing', () => {
    const loaded = policy([
      { operationCode: 'CHANGE_ORDER_NOTES', targetType: 'ORDER', decision: 'ALLOW', requiresReason: false },
      { operationCode: 'ADD_PREFERENCE', targetType: 'PIECE', decision: 'ALLOW', requiresReason: false },
      { operationCode: 'ADD_ITEM', targetType: 'ORDER', decision: 'ALLOW_WITH_WARNING', requiresReason: false },
    ]);
    expect(resolveEditControlCapability(loaded, 'CHANGE_ORDER_NOTES')).toMatchObject({ state: 'OPEN', interactive: true });
    expect(resolveEditControlCapability(loaded, 'ADD_PREFERENCE')).toMatchObject({ state: 'OPEN', interactive: true, reasonKey: null });
    expect(resolveEditControlCapability(loaded, 'ADD_ITEM')).toMatchObject({ state: 'WARNING', interactive: true, reasonKey: 'warning' });
  });

  it('keeps unshipped catalog controls closed even with ALLOW cells', () => {
    const loaded = policy([{ operationCode: 'CHANGE_ITEM_PRICE', targetType: 'ITEM', decision: 'ALLOW', requiresReason: false }]);
    expect(resolveEditControlCapability(loaded, 'CHANGE_ITEM_PRICE')).toEqual({ state: 'NOT_AVAILABLE_YET', interactive: false, reasonKey: 'notAvailable' });
  });

  it('uses the strictest decision and locks customer details in this version', () => {
    const loaded = policy([
      { operationCode: 'CHANGE_ORDER_NOTES', targetType: 'ORDER', decision: 'ALLOW', requiresReason: false },
      { operationCode: 'CHANGE_ORDER_NOTES', targetType: 'ORDER', decision: 'DENY', requiresReason: false },
      { operationCode: 'CHANGE_CUSTOMER_SNAPSHOT', targetType: 'ORDER', decision: 'ALLOW', requiresReason: false },
      { operationCode: 'CHANGE_SERVICE_SPEED', targetType: 'ORDER', decision: 'ALLOW_WITH_WARNING', requiresReason: false },
      { operationCode: 'CHANGE_READY_BY', targetType: 'ORDER', decision: 'REQUIRE_OVERRIDE', requiresReason: true },
    ]);
    expect(resolveEditControlCapability(loaded, 'CHANGE_ORDER_NOTES').state).toBe('DENIED');
    expect(resolveEditControlCapability(loaded, 'CHANGE_CUSTOMER_SNAPSHOT')).toMatchObject({ state: 'LOCKED', interactive: false });
    expect(resolveEditControlCapability(loaded, 'CHANGE_SERVICE_SPEED')).toMatchObject({ state: 'WARNING', interactive: true, reasonKey: 'warning' });
    expect(resolveEditControlCapability(loaded, 'CHANGE_READY_BY')).toMatchObject({ state: 'OVERRIDE', interactive: true });
    expect(resolveEditControlGroup(loaded, ['ADD_ITEM', 'CHANGE_ORDER_NOTES']).state).toBe('DENIED');
  });
});
