import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const STAFF_HOME_COLLECTION_STAGE_COMMAND_ERROR = {
  success: false,
  ok: false,
  code: 'USE_HOME_COLLECTION_COMPLETE_COMMAND',
  error:
    'Staff home collection confirmation must use POST /api/v1/home-collection/orders/{orderId}/complete so intake stamps and workflow transition commit together.',
} as const;

export function isStaffHomeCollectionBypassAction(actionCode: string): boolean {
  return actionCode.trim() === WORKFLOW_ACTIONS.CONFIRM_HOME_COLLECTION;
}
