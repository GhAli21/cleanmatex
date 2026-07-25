import { leaveActionForScreen } from '@/lib/constants/workflow-leave-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

/**
 * Derive Workflow Engine action_code from transition API body fields.
 */
export function resolveEngineActionCode(input: {
  actionCode?: unknown;
  screen?: unknown;
  toStatus?: unknown;
  to_status?: unknown;
}): string | null {
  if (typeof input.actionCode === 'string' && input.actionCode.trim()) {
    return input.actionCode.trim();
  }
  const screen = typeof input.screen === 'string' ? input.screen.trim().toLowerCase() : '';
  const to =
    typeof input.toStatus === 'string'
      ? input.toStatus.trim().toLowerCase()
      : typeof input.to_status === 'string'
        ? input.to_status.trim().toLowerCase()
        : '';
  if (screen === 'qa' && to === 'processing') {
    return WORKFLOW_ACTIONS.FAIL_QA;
  }
  return leaveActionForScreen(screen);
}
