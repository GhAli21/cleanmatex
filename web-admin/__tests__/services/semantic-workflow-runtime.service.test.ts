import {
  isSemanticScreenStatusCommandEnabled,
  isSemanticScreenStatusMember,
  loadSemanticActionTransitions,
} from '@/lib/services/workflow/semantic-workflow-runtime.service';
import type { SemanticWorkflowArtifact } from '@/lib/services/workflow/semantic-workflow-artifact.service';

const artifact: SemanticWorkflowArtifact = {
  artifact_schema_version: 1,
  profile_id: 'a1000000-0000-4000-8000-000000000001',
  profile_version_id: 'b1000000-0000-4000-8000-000000000001',
  profile_version_no: 1,
  policy_revision: 1,
  policy_schema_version: 1,
  policy: null,
  modules: [
    { screen_key: 'ready_release', module_mode: 'primary_owner', is_enabled: true, display_order: 10 },
    { screen_key: 'workboard', module_mode: 'observer', is_enabled: true, display_order: 20 },
    { screen_key: 'disabled_screen', module_mode: 'primary_owner', is_enabled: false, display_order: 30 },
    { screen_key: 'public_tracking', module_mode: 'cross_cutting_command', is_enabled: true, display_order: 40 },
  ],
  module_statuses: [
    { screen_key: 'ready_release', status_code: 'ready', visibility_mode: 'owner', display_order: 10 },
    { screen_key: 'workboard', status_code: 'ready', visibility_mode: 'observer', display_order: 20 },
    { screen_key: 'disabled_screen', status_code: 'ready', visibility_mode: 'owner', display_order: 30 },
    { screen_key: 'public_tracking', status_code: 'ready', visibility_mode: 'observer', display_order: 40 },
  ],
  executions: [
    {
      exec_id: 'd1000000-0000-4000-8000-000000000001',
      screen_key: 'ready_release',
      action_code: 'RELEASE_FOR_PICKUP',
      from_status: 'ready',
      to_status: 'ready_for_pickup',
      transition_kind: 'fixed',
      requires_expected_version: true,
      requires_idempotency: true,
      requires_reason: true,
      min_reason_length: 10,
      requires_evidence: false,
      display_order: 20,
      channels: [{ channel_code: 'staff_web' }, { channel_code: 'pos' }],
      gates: [{
        gate_code: 'rack_required',
        evaluator_version: 1,
        input_schema_version: 1,
        blocking_mode: 'hard_block',
        parameters_json: {},
        display_order: 1,
      }],
    },
    {
      exec_id: 'd1000000-0000-4000-8000-000000000002',
      screen_key: 'ready_release',
      action_code: 'RELEASE_FOR_DELIVERY',
      from_status: 'ready',
      to_status: 'out_for_delivery',
      transition_kind: 'fixed',
      requires_expected_version: true,
      requires_idempotency: true,
      requires_reason: false,
      min_reason_length: 0,
      requires_evidence: false,
      display_order: 10,
      channels: [{ channel_code: 'staff_web' }],
      gates: [{
        gate_code: 'fin_release_eligible',
        evaluator_version: 1,
        input_schema_version: 1,
        blocking_mode: 'soft_warning',
        parameters_json: {},
        display_order: 1,
      }],
    },
    {
      // Deliberately malformed policy input: an observer must remain read-only
      // even if an upstream compiler or migration accidentally emits an edge.
      exec_id: 'd1000000-0000-4000-8000-000000000003',
      screen_key: 'workboard',
      action_code: 'RELEASE_FOR_PICKUP',
      from_status: 'ready',
      to_status: 'ready_for_pickup',
      transition_kind: 'fixed',
      requires_expected_version: true,
      requires_idempotency: true,
      requires_reason: false,
      min_reason_length: 0,
      requires_evidence: false,
      display_order: 30,
      channels: [{ channel_code: 'staff_web' }],
      gates: [],
    },
    {
      exec_id: 'd1000000-0000-4000-8000-000000000004',
      screen_key: 'public_tracking',
      action_code: 'CONFIRM_DELIVERY',
      from_status: 'ready',
      to_status: 'delivered',
      transition_kind: 'fixed',
      requires_expected_version: true,
      requires_idempotency: true,
      requires_reason: false,
      min_reason_length: 0,
      requires_evidence: false,
      display_order: 40,
      channels: [{ channel_code: 'public_web' }],
      gates: [],
    },
  ],
  initial_rules: [],
  evidence: [],
};

describe('semantic workflow runtime adapter', () => {
  it('uses only enabled owner or observer memberships for screen visibility', () => {
    expect(isSemanticScreenStatusMember(artifact, 'ready_release', 'ready')).toBe(true);
    expect(isSemanticScreenStatusMember(artifact, 'workboard', 'ready')).toBe(true);
    expect(isSemanticScreenStatusMember(artifact, 'disabled_screen', 'ready')).toBe(false);
  });

  it('filters actions by immutable screen, status, channel, and requested code', () => {
    expect(loadSemanticActionTransitions(artifact, {
      screen: 'ready_release',
      fromStatus: 'ready',
      channel: 'pos',
    })).toEqual([expect.objectContaining({ actionCode: 'RELEASE_FOR_PICKUP' })]);

    expect(loadSemanticActionTransitions(artifact, {
      screen: 'ready_release',
      fromStatus: 'ready',
      channel: 'staff_web',
      actionCode: 'RELEASE_FOR_DELIVERY',
    })).toEqual([expect.objectContaining({
      actionCode: 'RELEASE_FOR_DELIVERY',
      hasUnsupportedGateMode: false,
      gates: [expect.objectContaining({ blocking_mode: 'soft_warning' })],
    })]);
  });

  it('keeps observer-only screen membership read-only even when an artifact contains an execution', () => {
    expect(isSemanticScreenStatusMember(artifact, 'workboard', 'ready')).toBe(true);
    expect(isSemanticScreenStatusCommandEnabled(artifact, 'workboard', 'ready')).toBe(false);
    expect(loadSemanticActionTransitions(artifact, {
      screen: 'workboard',
      fromStatus: 'ready',
      channel: 'staff_web',
    })).toEqual([]);
  });

  it('allows an explicitly configured cross-cutting command without granting ordinary observer authority', () => {
    expect(isSemanticScreenStatusCommandEnabled(artifact, 'public_tracking', 'ready')).toBe(true);
    expect(loadSemanticActionTransitions(artifact, {
      screen: 'public_tracking',
      fromStatus: 'ready',
      channel: 'public_web',
    })).toEqual([expect.objectContaining({ actionCode: 'CONFIRM_DELIVERY' })]);
  });

  it('rejects a forged staff channel for a public-only command', () => {
    expect(loadSemanticActionTransitions(artifact, {
      screen: 'public_tracking',
      fromStatus: 'ready',
      channel: 'staff_web',
      actionCode: 'CONFIRM_DELIVERY',
    })).toEqual([]);
  });

  it('rejects a forged screen that is not the compiled owner of the action', () => {
    expect(loadSemanticActionTransitions(artifact, {
      screen: 'processing',
      fromStatus: 'ready',
      channel: 'staff_web',
      actionCode: 'RELEASE_FOR_PICKUP',
    })).toEqual([]);
  });

  it('projects command requirements and hard-block gates without reading catalog configuration', () => {
    const [transition] = loadSemanticActionTransitions(artifact, {
      screen: 'ready_release',
      fromStatus: 'ready',
      channel: 'staff_web',
      actionCode: 'RELEASE_FOR_PICKUP',
    });

    expect(transition).toMatchObject({
      requiresReason: true,
      minReasonLength: 10,
      gateCodes: ['rack_required'],
      hasUnsupportedGateMode: false,
      gates: [expect.objectContaining({ gate_code: 'rack_required', blocking_mode: 'hard_block' })],
    });
  });
});
