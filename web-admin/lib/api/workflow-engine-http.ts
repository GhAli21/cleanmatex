import type { WorkflowEngineErrorCode } from '@/lib/services/workflow/workflow-engine.service';

const PROFILE_INTEGRITY_CODES: ReadonlySet<WorkflowEngineErrorCode> = new Set([
  'PROFILE_SNAPSHOT_INCOMPLETE',
  'PROFILE_ARTIFACT_UNAVAILABLE',
  'PROFILE_ARTIFACT_INVALID',
  'PROFILE_EXECUTION_INVALID',
]);

/**
 * Maps a workflow engine failure onto the HTTP status used by stage and
 * compatibility adapters. Snapshot-integrity codes are 409 so clients retry
 * only after the order snapshot is repaired, not as a validation typo.
 *
 * @param code Typed engine failure from list/execute.
 */
export function httpStatusForWorkflowEngineError(code: WorkflowEngineErrorCode): number {
  if (code === 'NOT_FOUND') return 404;
  if (
    code === 'VERSION_CONFLICT'
    || code === 'IDEMPOTENCY_CONFLICT'
    || PROFILE_INTEGRITY_CODES.has(code)
  ) {
    return 409;
  }
  if (code === 'WF_GATE_OVERRIDE_FORBIDDEN') return 403;
  if (code === 'WF_GATE_EVALUATION_STALE') return 409;
  if (code === 'GATE_FAILED' || code.startsWith('WF_GATE_')) return 422;
  if (code === 'ACTION_NOT_ALLOWED') return 403;
  return 400;
}
