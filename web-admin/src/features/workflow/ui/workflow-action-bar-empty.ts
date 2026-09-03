/**
 * Empty-bar outcome after available-actions has settled.
 * `redirect` is reserved for a true engine miss. Hidden leave-actions
 * (stage-owned surfaces such as delivery handover) must not bounce the operator.
 */
export type WorkflowActionBarEmptyMode = 'ready' | 'redirect' | 'hide' | 'empty';

/** Inputs that decide whether the floor action bar stays, hides, or bounces. */
export interface WorkflowActionBarEmptyInput {
  visibleCount: number;
  engineActionCount: number;
  hasSupplementalActions: boolean;
  hideWhenEmpty: boolean;
  hasEmptyBackHref: boolean;
}

/**
 * Decide empty-bar UX without treating hidden leave-actions as "this order
 * does not belong on this screen."
 *
 * @param input settled action counts and empty-bar flags
 * @returns render/redirect mode for the action bar
 */
export function workflowActionBarEmptyMode(
  input: WorkflowActionBarEmptyInput,
): WorkflowActionBarEmptyMode {
  if (input.hasSupplementalActions || input.visibleCount > 0) {
    return 'ready';
  }
  if (input.engineActionCount > 0) {
    return 'hide';
  }
  if (input.hasEmptyBackHref) {
    return 'redirect';
  }
  if (input.hideWhenEmpty) {
    return 'hide';
  }
  return 'empty';
}
