import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

/** Minimum audit-note length required by hold and permanent-stop actions. */
export const MIN_ORDER_CONTROL_NOTE_LENGTH = 10;

/** Successful state mutation resolved for an order-control action. */
export interface OrderControlTransitionResolution {
  ok: true;
  toStatus: string;
  nextHoldFromStatus: string | null;
  clearHoldFromStatus: boolean;
}

/** Validation failure resolved before an order-control write is attempted. */
export interface OrderControlTransitionRejection {
  ok: false;
  message: string;
}

/** Result of resolving an optional order-control action. */
export type OrderControlTransitionResult =
  | OrderControlTransitionResolution
  | OrderControlTransitionRejection
  | null;

/**
 * Resolves hold, resume, and permanent-stop state fields without touching money.
 * Returning `null` keeps non-control workflow actions on their configured edge.
 *
 * @param input Action and current order-control state.
 * @returns A control-state resolution, rejection, or `null` for other actions.
 * @example
 * resolveOrderControlTransition({
 *   actionCode: 'HOLD_ORDER_WORK',
 *   currentStatus: 'processing',
 *   holdFromStatus: null,
 *   note: 'Machine maintenance',
 * });
 */
export function resolveOrderControlTransition(input: {
  actionCode: string;
  currentStatus: string;
  holdFromStatus: string | null;
  note: string;
}): OrderControlTransitionResult {
  const isHold = input.actionCode === WORKFLOW_ACTIONS.HOLD_ORDER_WORK;
  const isResume = input.actionCode === WORKFLOW_ACTIONS.RESUME_ORDER_WORK;
  const isStop = input.actionCode === WORKFLOW_ACTIONS.STOP_ORDER_WORK;

  if (!isHold && !isResume && !isStop) return null;

  if ((isHold || isStop) && input.note.trim().length < MIN_ORDER_CONTROL_NOTE_LENGTH) {
    return {
      ok: false,
      message: `Reason/notes must be at least ${MIN_ORDER_CONTROL_NOTE_LENGTH} characters for hold/stop.`,
    };
  }

  if (isHold) {
    return {
      ok: true,
      toStatus: 'on_hold',
      nextHoldFromStatus: input.currentStatus,
      clearHoldFromStatus: false,
    };
  }

  if (isResume) {
    const resumeTo = input.holdFromStatus?.trim().toLowerCase() ?? '';
    if (!resumeTo) {
      return {
        ok: false,
        message: 'Cannot resume: hold_from_status is missing on this order.',
      };
    }

    return {
      ok: true,
      toStatus: resumeTo,
      nextHoldFromStatus: null,
      clearHoldFromStatus: true,
    };
  }

  return {
    ok: true,
    toStatus: 'stopped',
    nextHoldFromStatus: null,
    clearHoldFromStatus: true,
  };
}
