import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import type { WorkflowActionDto } from '@/lib/hooks/use-workflow-actions';
import { isOnlyRackBlocked } from '@features/workflow/lib/rack-gate-helpers';

/**
 * Actions that must never steal the usual-path slot when a forward
 * floor action is also visible (hold/stop/fail vs confirm/complete).
 */
export const WORKFLOW_EXCEPTION_ACTION_CODES: ReadonlySet<string> = new Set([
  WORKFLOW_ACTIONS.HOLD_ORDER_WORK,
  WORKFLOW_ACTIONS.RESUME_ORDER_WORK,
  WORKFLOW_ACTIONS.STOP_ORDER_WORK,
  WORKFLOW_ACTIONS.CANCEL_ORDER,
  WORKFLOW_ACTIONS.RETURN_ORDER,
  WORKFLOW_ACTIONS.FAIL_QA,
  WORKFLOW_ACTIONS.FAIL_HOME_COLLECTION,
]);

export type WorkflowActionBarLayoutMode = 'next-step' | 'action-list';

export interface WorkflowActionBarLayout {
  /** One visible action uses the command strip; two or more use the list. */
  mode: WorkflowActionBarLayoutMode;
  primary: WorkflowActionDto | null;
  rest: WorkflowActionDto[];
}

/**
 * True when the operator can still press the action (including rack-only blocks
 * that open the rack modal instead of staying disabled).
 */
export function isWorkflowActionClickable(action: WorkflowActionDto): boolean {
  return action.enabled || isOnlyRackBlocked(action);
}

/**
 * True for hold/stop/fail-style actions that should lose the usual-path slot.
 */
export function isWorkflowExceptionAction(actionCode: string): boolean {
  return WORKFLOW_EXCEPTION_ACTION_CODES.has(actionCode);
}

/**
 * Prefer the first clickable forward action; fall back to any clickable, then
 * the first visible row so a lone blocked action still has a command.
 */
export function pickWorkflowActionBarPrimary(
  actions: readonly WorkflowActionDto[],
): WorkflowActionDto | null {
  if (actions.length === 0) return null;
  const clickable = actions.filter(isWorkflowActionClickable);
  const usual = clickable.find((action) => !isWorkflowExceptionAction(action.actionCode));
  return usual ?? clickable[0] ?? actions[0] ?? null;
}

/**
 * Choose next-step vs action-list from visible count, and split primary/rest
 * without changing engine order of the remaining actions.
 */
export function workflowActionBarLayout(
  visible: readonly WorkflowActionDto[],
): WorkflowActionBarLayout {
  const primary = pickWorkflowActionBarPrimary(visible);
  const rest = primary
    ? visible.filter(
        (action) =>
          `${action.actionCode}:${action.toStatus ?? ''}` !==
          `${primary.actionCode}:${primary.toStatus ?? ''}`,
      )
    : [...visible];
  return {
    // Two or more visible actions need a list so hold/stop do not share one command strip.
    mode: visible.length >= 2 ? 'action-list' : 'next-step',
    primary,
    rest,
  };
}
