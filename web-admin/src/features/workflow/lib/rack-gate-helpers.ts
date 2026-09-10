import type { WorkflowActionDto } from '@/lib/hooks/use-workflow-actions';

export const GATE_RACK_REQUIRED = 'GATE_RACK_REQUIRED';

/** True when an action is blocked solely by the rack-required gate (no other blockers). */
export function isOnlyRackBlocked(action: WorkflowActionDto): boolean {
  return (
    !action.enabled &&
    action.blockedReasons.length > 0 &&
    action.blockedReasons.every((r) => r.code === GATE_RACK_REQUIRED)
  );
}
