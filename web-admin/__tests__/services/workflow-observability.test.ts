/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { logger } from '@/lib/utils/logger';
import {
  WORKFLOW_OBSERVE_EVENT,
  classifyWorkflowCommandError,
  getWorkflowObserveMetrics,
  observePublicConfirmRejected,
  observeWorkflowCommand,
  observeWorkflowPolicy,
  resetWorkflowObserveMetrics,
  toWorkflowObserveContext,
} from '@/lib/services/workflow/workflow-observability';

describe('workflow observability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWorkflowObserveMetrics();
  });

  it('drops tracking tokens, notes, money, and proof keys instead of logging them', () => {
    const safe = toWorkflowObserveContext({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      publicTrackingToken: 'opaque-secret-token',
      handoverNotes: 'customer name and phone',
      outstandingAmount: '12.5000',
      signatureObjectKey: 'tenant/proof.jpeg',
      channel: 'public_web',
    });

    expect(safe).toEqual({
      feature: 'workflow',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      channel: 'public_web',
    });
  });

  it('counts fail-closed policy loads and command denials', () => {
    observeWorkflowPolicy({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      profileVersionId: 'version-1',
      outcome: 'incomplete',
      latencyMs: 4,
    });
    observeWorkflowCommand({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      screen: 'pickup_handover',
      actionCode: 'CONFIRM_PICKUP',
      channel: 'staff_web',
      outcome: 'denied',
      errorCode: 'ACTION_NOT_ALLOWED',
      latencyMs: 9,
    });
    observePublicConfirmRejected({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      code: 'PROFILE_SNAPSHOT_INCOMPLETE',
      httpStatus: 409,
    });

    expect(getWorkflowObserveMetrics()).toEqual({
      [WORKFLOW_OBSERVE_EVENT.POLICY_INCOMPLETE]: 1,
      [WORKFLOW_OBSERVE_EVENT.COMMAND_DENIED]: 1,
      [WORKFLOW_OBSERVE_EVENT.PUBLIC_CONFIRM_REJECTED]: 1,
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('classifies engine codes without treating PROFILE_* as a validation typo', () => {
    expect(classifyWorkflowCommandError({ code: 'PROFILE_SNAPSHOT_INCOMPLETE' })).toBe('profile');
    expect(classifyWorkflowCommandError({ code: 'VERSION_CONFLICT' })).toBe('conflict');
    expect(classifyWorkflowCommandError({ code: 'ACTION_NOT_ALLOWED' })).toBe('denied');
    expect(classifyWorkflowCommandError({ code: 'GATE_FAILED' })).toBe('denied');
    expect(classifyWorkflowCommandError(new Error('boom'))).toBe('error');
  });

  it('does not import the workflow engine (avoids observe ↔ engine cycles)', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/services/workflow/workflow-observability.ts'),
      'utf8',
    );
    expect(source).not.toContain('workflow-engine.service');
  });
});
