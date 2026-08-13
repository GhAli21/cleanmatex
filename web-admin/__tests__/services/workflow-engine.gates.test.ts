/**
 * WorkflowEngine gate evaluation unit tests (pure helpers via module surface).
 * Full executeAction requires DB catalogs from migration 0427.
 */

import {
  WORKFLOW_ACTIONS,
  WORKFLOW_OUTBOX_EVENT_TYPE,
  WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
} from '@/lib/constants/workflow-actions';

describe('workflow-actions constants', () => {
  it('mirrors V1.0 action catalog codes', () => {
    expect(WORKFLOW_ACTIONS.COMPLETE_PREPARATION).toBe('COMPLETE_PREPARATION');
    expect(WORKFLOW_ACTIONS.CONFIRM_DELIVERY).toBe('CONFIRM_DELIVERY');
    expect(WORKFLOW_OUTBOX_EVENT_TYPE).toBe('ORDER_WORKFLOW_TRANSITIONED');
    expect(WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE).toBe('workflow_action');
  });

  it('does not include sorting as an action', () => {
    const values = Object.values(WORKFLOW_ACTIONS);
    expect(values.some((v) => v.toLowerCase().includes('sorting'))).toBe(false);
  });
});

describe('isWorkflowEngineV2Enabled', () => {
  const original = process.env.WORKFLOW_ENGINE_V2;
  const originalPublic = process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2;

  afterEach(() => {
    if (original === undefined) delete process.env.WORKFLOW_ENGINE_V2;
    else process.env.WORKFLOW_ENGINE_V2 = original;
    if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2;
    else process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2 = originalPublic;
    jest.resetModules();
  });

  it('is on by default', async () => {
    delete process.env.WORKFLOW_ENGINE_V2;
    delete process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_V2;
    const { isWorkflowEngineV2Enabled } = await import('@/lib/config/features');
    expect(isWorkflowEngineV2Enabled()).toBe(true);
  });

  it('turns on with WORKFLOW_ENGINE_V2=true', async () => {
    process.env.WORKFLOW_ENGINE_V2 = 'true';
    const { isWorkflowEngineV2Enabled } = await import('@/lib/config/features');
    expect(isWorkflowEngineV2Enabled()).toBe(true);
  });

  it('turns off with WORKFLOW_ENGINE_V2=false', async () => {
    process.env.WORKFLOW_ENGINE_V2 = 'false';
    const { isWorkflowEngineV2Enabled } = await import('@/lib/config/features');
    expect(isWorkflowEngineV2Enabled()).toBe(false);
  });
});
