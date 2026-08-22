/** @jest-environment node */

import type { WorkflowGateOrderFacts } from '@/lib/services/workflow/workflow-gate-evaluator.service';
import {
  WorkflowGateDecisionError,
  assertAndRecordSemanticGateDecisions,
  buildAvailableGateDecisions,
  classifySemanticGateFailures,
  fingerprintSafeGateFacts,
  issueAcknowledgementChallenge,
  verifyAcknowledgementChallenge,
  type SemanticGateBinding,
} from '@/lib/services/workflow/workflow-gate-decision.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER = '22222222-2222-2222-2222-222222222222';
const ARTIFACT = '33333333-3333-4333-8333-333333333333';
const ACTOR = '44444444-4444-4444-8444-444444444444';

const missingRack: WorkflowGateOrderFacts = {
  preparationStatus: 'completed',
  rackLocation: null,
  paymentTypeCode: 'PAY_IN_ADVANCE',
  outstandingAmount: '0',
  currentStatus: 'ready',
};

const warningBinding: SemanticGateBinding = {
  gate_code: 'rack_required',
  blocking_mode: 'soft_warning',
  evaluator_version: 1,
  input_schema_version: 1,
  message_key: 'workflow.gates.rack.warning',
};

const overrideBinding: SemanticGateBinding = {
  ...warningBinding,
  blocking_mode: 'override_allowed',
  override_permission_code: 'orders:override_gate',
  override_min_reason_length: 10,
};

const hardBinding: SemanticGateBinding = {
  ...warningBinding,
  blocking_mode: 'hard_block',
};

function challengeContext() {
  return {
    tenantId: TENANT,
    orderId: ORDER,
    artifactId: ARTIFACT,
    actionCode: 'RELEASE_FOR_PICKUP',
    screen: 'ready_release',
    gateCode: 'rack_required',
    channel: 'staff_web' as const,
    actorUserId: ACTOR,
    stateVersion: 4,
    fingerprint: fingerprintSafeGateFacts(missingRack, ['rack_required']),
  };
}

describe('workflow gate decision runtime', () => {
  const originalSecret = process.env.WORKFLOW_GATE_CHALLENGE_SECRET;

  beforeAll(() => {
    process.env.WORKFLOW_GATE_CHALLENGE_SECRET = 'test-gate-challenge-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.WORKFLOW_GATE_CHALLENGE_SECRET;
    else process.env.WORKFLOW_GATE_CHALLENGE_SECRET = originalSecret;
  });

  it('fingerprints only non-PII operational facts', () => {
    const digest = fingerprintSafeGateFacts(missingRack, ['rack_required']);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(fingerprintSafeGateFacts({
      ...missingRack,
      rackLocation: '   ',
    }, ['RACK_REQUIRED']));
  });

  it('issues and verifies a bound acknowledgement challenge', () => {
    const token = issueAcknowledgementChallenge(challengeContext());
    expect(() => verifyAcknowledgementChallenge(token, challengeContext())).not.toThrow();
  });

  it('rejects a stale fingerprint as WF_GATE_EVALUATION_STALE', () => {
    const token = issueAcknowledgementChallenge(challengeContext());
    try {
      verifyAcknowledgementChallenge(token, {
        ...challengeContext(),
        fingerprint: fingerprintSafeGateFacts({
          ...missingRack,
          rackLocation: 'R-1',
        }, ['rack_required']),
      });
      throw new Error('expected stale challenge to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'WF_GATE_EVALUATION_STALE' });
    }
  });

  it('forces public-channel failures to hard-block even when the binding is a warning', () => {
    const classified = classifySemanticGateFailures({
      bindings: [warningBinding],
      facts: missingRack,
      runtimeMode: 'semantic',
      channel: 'public_web',
    });
    expect(classified.hardReasons.length).toBeGreaterThan(0);
    expect(buildAvailableGateDecisions({
      ...challengeContext(),
      channel: 'public_web',
      facts: missingRack,
      failedBindings: classified.failedBindings,
    })).toEqual([]);
  });

  it('exposes a warning challenge for staff discovery', () => {
    const classified = classifySemanticGateFailures({
      bindings: [warningBinding],
      facts: missingRack,
      runtimeMode: 'semantic',
      channel: 'staff_web',
    });
    expect(classified.hardReasons).toEqual([]);
    const decisions = buildAvailableGateDecisions({
      ...challengeContext(),
      facts: missingRack,
      failedBindings: classified.failedBindings,
    });
    expect(decisions).toEqual([
      expect.objectContaining({
        gateCode: 'rack_required',
        result: 'WARNING',
        acknowledgementChallenge: expect.any(String),
      }),
    ]);
  });

  it('still hard-blocks a failed hard_block gate', async () => {
    await expect(assertAndRecordSemanticGateDecisions({
      tx: {} as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'RELEASE_FOR_PICKUP',
      screen: 'ready_release',
      channel: 'staff_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-1',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [hardBinding],
      submitted: [],
    })).rejects.toMatchObject({ code: 'WF_GATE_HARD_BLOCKED' });
  });

  it('requires acknowledgement before a warning can proceed', async () => {
    await expect(assertAndRecordSemanticGateDecisions({
      tx: {} as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'RELEASE_FOR_PICKUP',
      screen: 'ready_release',
      channel: 'staff_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-2',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [warningBinding],
      submitted: [],
    })).rejects.toMatchObject({ code: 'WF_GATE_ACK_REQUIRED' });
  });

  it('records an acknowledged warning and outbox event in the same transaction', async () => {
    const token = issueAcknowledgementChallenge(challengeContext());
    const queryRaw = jest.fn().mockResolvedValue([{ decision_id: '55555555-5555-4555-8555-555555555555' }]);
    const createOutbox = jest.fn().mockResolvedValue({});
    await assertAndRecordSemanticGateDecisions({
      tx: {
        $queryRaw: queryRaw,
        org_domain_events_outbox: { create: createOutbox },
      } as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'RELEASE_FOR_PICKUP',
      screen: 'ready_release',
      channel: 'staff_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-3',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [warningBinding],
      submitted: [{ gateCode: 'rack_required', acknowledgementChallenge: token }],
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(createOutbox).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        event_type: 'WORKFLOW_GATE_DECISION_ACCEPTED',
        aggregate_type: 'workflow_gate_decision',
      }),
    }));
  });

  it('rejects an override without permission', async () => {
    await expect(assertAndRecordSemanticGateDecisions({
      tx: {} as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'RELEASE_FOR_PICKUP',
      screen: 'ready_release',
      channel: 'staff_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-4',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [overrideBinding],
      submitted: [{ gateCode: 'rack_required', overrideReason: 'Supervisor approved rack exception' }],
      canOverridePermission: async () => false,
    })).rejects.toMatchObject({ code: 'WF_GATE_OVERRIDE_FORBIDDEN' });
  });

  it('rejects an override reason shorter than the compiled minimum', async () => {
    await expect(assertAndRecordSemanticGateDecisions({
      tx: {} as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'RELEASE_FOR_PICKUP',
      screen: 'ready_release',
      channel: 'staff_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-5',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [overrideBinding],
      submitted: [{ gateCode: 'rack_required', overrideReason: 'too short' }],
      canOverridePermission: async () => true,
    })).rejects.toMatchObject({ code: 'WF_GATE_OVERRIDE_REASON_INVALID' });
  });

  it('records an authorized override when permission and reason are valid', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ decision_id: '66666666-6666-4666-8666-666666666666' }]);
    const createOutbox = jest.fn().mockResolvedValue({});
    await assertAndRecordSemanticGateDecisions({
      tx: {
        $queryRaw: queryRaw,
        org_domain_events_outbox: { create: createOutbox },
      } as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'RELEASE_FOR_PICKUP',
      screen: 'ready_release',
      channel: 'staff_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-6',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [overrideBinding],
      submitted: [{ gateCode: 'rack_required', overrideReason: 'Supervisor approved rack exception' }],
      canOverridePermission: async () => true,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(createOutbox).toHaveBeenCalledTimes(1);
  });

  it('never records a public-channel acknowledgement even with a valid token', async () => {
    const token = issueAcknowledgementChallenge({
      ...challengeContext(),
      channel: 'public_web',
    });
    await expect(assertAndRecordSemanticGateDecisions({
      tx: {} as never,
      tenantId: TENANT,
      orderId: ORDER,
      artifactId: ARTIFACT,
      actionCode: 'CONFIRM_DELIVERY',
      screen: 'public_tracking',
      channel: 'public_web',
      actorUserId: ACTOR,
      idempotencyKey: 'idem-7',
      stateVersion: 4,
      facts: missingRack,
      runtimeMode: 'semantic',
      bindings: [warningBinding],
      submitted: [{ gateCode: 'rack_required', acknowledgementChallenge: token }],
    })).rejects.toBeInstanceOf(WorkflowGateDecisionError);
  });
});
