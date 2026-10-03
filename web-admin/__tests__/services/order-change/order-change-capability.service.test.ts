/** @jest-environment node */

import {
  OrderChangeReviewProofError,
  evaluateOrderChangeCapability,
  issueOrderChangeReviewProof,
  resolveOrderChangeCapabilityTarget,
  verifyOrderChangeReviewProof,
  type OrderChangeCapabilityBinding,
  type OrderChangeReviewProofBinding,
} from '@/lib/services/order-change/order-change-capability.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER = '22222222-2222-2222-2222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-03T10:00:00.000Z');

const baseBinding: OrderChangeCapabilityBinding = {
  profileVersionId: '44444444-4444-4444-8444-444444444444',
  policyRevision: 8,
  workflowStatus: 'PROCESSING',
  operationCode: 'REMOVE_PIECE',
  targetType: 'PIECE',
  decision: 'ALLOW',
  reasonCode: 'POLICY_ALLOWED',
  messageKey: 'orderChange.capability.allowed',
};

const reviewBinding: OrderChangeReviewProofBinding = {
  tenantId: TENANT,
  orderId: ORDER,
  actorUserId: ACTOR,
  expectedEditStateVersion: 3,
  expectedWfStateVersion: 5,
  sourceContext: 'staff_web',
  canonicalIntent: [{ seq: 1, code: 'REMOVE_PIECE', target: ORDER }],
  changeReason: 'Customer requested removal.',
  gateDecisions: [{ seq: 1, gateCode: 'PROCESSING_WARNING' }],
  policyIdentity: { profileVersionId: baseBinding.profileVersionId, policyRevision: baseBinding.policyRevision },
  policyFacts: { status: 'PROCESSING', fiscalMode: 'UNISSUED' },
  calculationFingerprint: 'calculation-fingerprint',
  settlementSourceFingerprint: 'settlement-source-fingerprint',
};

function capabilityInput(overrides: Partial<Parameters<typeof evaluateOrderChangeCapability>[0]> = {}) {
  return {
    facts: {
      featureEnabled: true,
      committedAt: new Date('2026-10-01T10:00:00.000Z'),
      editAccessStatus: 'OPEN',
      editBlockedUntil: null,
      workflowStatus: 'PROCESSING',
      editStateVersion: 3,
      wfStateVersion: 5,
    },
    actor: { actorUserId: ACTOR, canUsePermission: jest.fn().mockResolvedValue(true) },
    operation: { seq: 1, code: 'REMOVE_PIECE' as const, hasReason: true },
    bindings: [baseBinding],
    now: NOW,
    ...overrides,
  };
}

describe('order change capability policy', () => {
  it('derives policy target classes from frozen operations', () => {
    expect(resolveOrderChangeCapabilityTarget('ADD_ITEM')).toBe('ITEM');
    expect(resolveOrderChangeCapabilityTarget('REMOVE_PIECE')).toBe('PIECE');
    expect(resolveOrderChangeCapabilityTarget('CHANGE_PREFERENCE')).toBe('PREFERENCE');
    expect(resolveOrderChangeCapabilityTarget('CHANGE_PRIORITY')).toBe('ORDER');
  });

  it('allows only an explicit profile binding after server-side permission validation', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput())).resolves.toMatchObject({ decision: 'ALLOW', policyIdentity: { policyRevision: 8 } });
  });

  it('fails closed when a profile does not bind the operation', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput({ bindings: [] }))).resolves.toMatchObject({ decision: 'DENY', reasonCode: 'CAPABILITY_POLICY_BINDING_MISSING' });
  });

  it('does not treat an enabled-looking policy binding as feature authorization', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput({ facts: { ...capabilityInput().facts, featureEnabled: false } }))).resolves.toMatchObject({ decision: 'DENY', reasonCode: 'FEATURE_DISABLED' });
  });

  it('returns a warning only from an explicit warning binding', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput({
      bindings: [{ ...baseBinding, decision: 'ALLOW_WITH_WARNING', reasonCode: 'PROCESSING_WARNING' }],
    }))).resolves.toMatchObject({ decision: 'ALLOW_WITH_WARNING', requiresAcknowledgement: true });
  });

  it('requires a reason where the explicit policy demands one', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput({
      operation: { seq: 1, code: 'REMOVE_PIECE', hasReason: false },
      bindings: [{ ...baseBinding, requiresReason: true }],
    }))).resolves.toMatchObject({ decision: 'DENY', reasonCode: 'CHANGE_REASON_REQUIRED' });
  });

  it.each([
    ['PERMANENTLY_BLOCKED', null],
    ['TEMPORARILY_BLOCKED', new Date('2026-10-03T11:00:00.000Z')],
  ])('does not let an override bypass %s order access', async (editAccessStatus, editBlockedUntil) => {
    await expect(evaluateOrderChangeCapability(capabilityInput({ facts: { ...capabilityInput().facts, editAccessStatus, editBlockedUntil } }))).resolves.toMatchObject({ decision: 'DENY', reasonCode: 'EDIT_ACCESS_BLOCKED' });
  });

  it('treats an elapsed temporary block as eligible for explicit policy evaluation', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput({ facts: { ...capabilityInput().facts, editAccessStatus: 'TEMPORARILY_BLOCKED', editBlockedUntil: new Date('2026-10-03T09:59:59.000Z') } }))).resolves.toMatchObject({ decision: 'ALLOW' });
  });

  it('requires the configured specialized override permission', async () => {
    const actor = { actorUserId: ACTOR, canUsePermission: jest.fn().mockImplementation(async (code: string) => code === 'orders:edit') };
    await expect(evaluateOrderChangeCapability(capabilityInput({
      actor,
      bindings: [{ ...baseBinding, decision: 'REQUIRE_OVERRIDE', overridePermissionCode: 'orders:sensitive_edit' }],
    }))).resolves.toMatchObject({ decision: 'DENY', reasonCode: 'OVERRIDE_FORBIDDEN' });
  });

  it('returns an override requirement only to an authorized actor', async () => {
    await expect(evaluateOrderChangeCapability(capabilityInput({
      bindings: [{ ...baseBinding, decision: 'REQUIRE_OVERRIDE', overridePermissionCode: 'orders:edit_override' }],
    }))).resolves.toMatchObject({ decision: 'REQUIRE_OVERRIDE', overridePermissionCode: 'orders:edit_override' });
  });
});

describe('order change review proof', () => {
  const key = { keyId: 'review-key-2026-10', secret: 'test-only-order-change-proof-secret' };

  it('binds both versions, actor, policy, facts, intent, and settlement source', () => {
    const proof = issueOrderChangeReviewProof({ key, binding: reviewBinding, now: NOW });
    expect(() => verifyOrderChangeReviewProof({ proof, keys: [key], expected: reviewBinding, now: NOW })).not.toThrow();
  });

  it.each([
    ['operation', { ...reviewBinding, canonicalIntent: [{ seq: 1, code: 'ADD_PIECE' }] }],
    ['actor', { ...reviewBinding, actorUserId: '55555555-5555-4555-8555-555555555555' }],
    ['edit revision', { ...reviewBinding, expectedEditStateVersion: 4 }],
    ['policy facts', { ...reviewBinding, policyFacts: { status: 'READY' } }],
  ])('rejects a changed %s review binding', (_name, expected) => {
    const proof = issueOrderChangeReviewProof({ key, binding: reviewBinding, now: NOW });
    expect(() => verifyOrderChangeReviewProof({ proof, keys: [key], expected, now: NOW })).toThrow(expect.objectContaining({ code: 'ORDER_CHANGE_REVIEW_PROOF_STALE' }));
  });

  it('rejects tampering, expiry, and an unavailable key ring', () => {
    const proof = issueOrderChangeReviewProof({ key, binding: reviewBinding, now: NOW });
    const tampered = `${proof.slice(0, -1)}${proof.endsWith('a') ? 'b' : 'a'}`;
    expect(() => verifyOrderChangeReviewProof({ proof: tampered, keys: [key], expected: reviewBinding, now: NOW })).toThrow(OrderChangeReviewProofError);
    expect(() => verifyOrderChangeReviewProof({ proof, keys: [key], expected: reviewBinding, now: new Date('2026-10-03T10:05:01.000Z') })).toThrow(expect.objectContaining({ code: 'ORDER_CHANGE_REVIEW_PROOF_STALE' }));
    expect(() => verifyOrderChangeReviewProof({ proof, keys: [], expected: reviewBinding, now: NOW })).toThrow(expect.objectContaining({ code: 'ORDER_CHANGE_REVIEW_PROOF_SIGNER_UNAVAILABLE' }));
  });
});
