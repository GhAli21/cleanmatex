import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

/**
 * Stable rejection when a staff caller tries to confirm delivery without the
 * atomic delivery stage command.
 */
export const STAFF_DELIVERY_STAGE_COMMAND_ERROR = {
  success: false,
  ok: false,
  code: 'USE_DELIVERY_COMPLETE_COMMAND',
  error:
    'Staff delivery confirmation must use POST /api/v1/delivery/orders/{orderId}/complete or POST /api/v1/delivery/stops/{stopId}/complete so POD, payment, and workflow gates commit together.',
} as const;

/**
 * Staff HTTP adapters must not run CONFIRM_DELIVERY. That action skips POD
 * and payment writers. Use the floor order-complete or stop-complete command.
 * Public confirm-received uses its own service and never reaches these routes.
 *
 * @param actionCode engine action from the request
 * @returns true when the caller must use the delivery stage command instead
 */
export function isStaffDeliveryBypassAction(actionCode: string): boolean {
  return actionCode.trim() === WORKFLOW_ACTIONS.CONFIRM_DELIVERY;
}
