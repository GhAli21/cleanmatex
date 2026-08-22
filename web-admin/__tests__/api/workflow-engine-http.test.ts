import { httpStatusForWorkflowEngineError } from '@/lib/api/workflow-engine-http';

describe('workflow engine HTTP mapping', () => {
  it('maps snapshot integrity failures as conflicts, not client typos', () => {
    expect(httpStatusForWorkflowEngineError('PROFILE_SNAPSHOT_INCOMPLETE')).toBe(409);
    expect(httpStatusForWorkflowEngineError('PROFILE_ARTIFACT_UNAVAILABLE')).toBe(409);
    expect(httpStatusForWorkflowEngineError('PROFILE_ARTIFACT_INVALID')).toBe(409);
    expect(httpStatusForWorkflowEngineError('PROFILE_EXECUTION_INVALID')).toBe(409);
  });

  it('keeps existing command retry and gate statuses', () => {
    expect(httpStatusForWorkflowEngineError('NOT_FOUND')).toBe(404);
    expect(httpStatusForWorkflowEngineError('VERSION_CONFLICT')).toBe(409);
    expect(httpStatusForWorkflowEngineError('IDEMPOTENCY_CONFLICT')).toBe(409);
    expect(httpStatusForWorkflowEngineError('GATE_FAILED')).toBe(422);
    expect(httpStatusForWorkflowEngineError('ACTION_NOT_ALLOWED')).toBe(403);
    expect(httpStatusForWorkflowEngineError('REASON_REQUIRED')).toBe(400);
    expect(httpStatusForWorkflowEngineError('WF_GATE_OVERRIDE_FORBIDDEN')).toBe(403);
    expect(httpStatusForWorkflowEngineError('WF_GATE_EVALUATION_STALE')).toBe(409);
    expect(httpStatusForWorkflowEngineError('WF_GATE_ACK_REQUIRED')).toBe(422);
    expect(httpStatusForWorkflowEngineError('WF_GATE_HARD_BLOCKED')).toBe(422);
  });
});
