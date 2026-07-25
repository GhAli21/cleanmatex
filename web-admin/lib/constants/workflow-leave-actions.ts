import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

/**
 * Default leave action for a floor screen when completing work.
 * Destination is chosen by template flags (preferredToStatus), not by this map.
 */
export const WORKFLOW_SCREEN_LEAVE_ACTION: Record<string, string> = {
  preparation: WORKFLOW_ACTIONS.COMPLETE_PREPARATION,
  processing: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
  assembly: WORKFLOW_ACTIONS.COMPLETE_ASSEMBLY,
  qa: WORKFLOW_ACTIONS.PASS_QA,
  packing: WORKFLOW_ACTIONS.COMPLETE_PACKING,
  ready_release: WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP,
  driver_delivery: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
  canceling: WORKFLOW_ACTIONS.CANCEL_ORDER,
  returning: WORKFLOW_ACTIONS.RETURN_ORDER,
};

export function leaveActionForScreen(screen: string): string | null {
  return WORKFLOW_SCREEN_LEAVE_ACTION[screen.trim().toLowerCase()] ?? null;
}
