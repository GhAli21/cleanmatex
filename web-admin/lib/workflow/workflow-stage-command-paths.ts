import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

/** Maps a floor screen + action to its versioned stage-owned command path. */
export interface WorkflowStageCommandTarget {
  path: (orderId: string) => string;
  /** Fields copied from the generic execute input into the stage command body. */
  inputKeys?: readonly string[];
}

const STAGE_COMMANDS: Record<string, WorkflowStageCommandTarget> = {
  [`processing:${WORKFLOW_ACTIONS.COMPLETE_PROCESSING}`]: {
    path: (orderId) => `/api/v1/processing/${orderId}/complete`,
    inputKeys: ['rackLocation'],
  },
  [`assembly:${WORKFLOW_ACTIONS.COMPLETE_ASSEMBLY}`]: {
    path: (orderId) => `/api/v1/assembly/${orderId}/complete`,
    inputKeys: ['rackLocation'],
  },
  [`qa:${WORKFLOW_ACTIONS.PASS_QA}`]: {
    path: (orderId) => `/api/v1/qa/${orderId}/pass`,
    inputKeys: ['rackLocation'],
  },
  [`qa:${WORKFLOW_ACTIONS.FAIL_QA}`]: {
    path: (orderId) => `/api/v1/qa/${orderId}/fail`,
    inputKeys: ['reason', 'notes'],
  },
  [`packing:${WORKFLOW_ACTIONS.COMPLETE_PACKING}`]: {
    path: (orderId) => `/api/v1/packing/${orderId}/complete`,
    inputKeys: ['rackLocation'],
  },
  [`ready_release:${WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP}`]: {
    path: (orderId) => `/api/v1/ready/${orderId}/release-pickup`,
    inputKeys: ['rackLocation'],
  },
  [`ready_release:${WORKFLOW_ACTIONS.RELEASE_FOR_DELIVERY}`]: {
    path: (orderId) => `/api/v1/ready/${orderId}/release-delivery`,
    inputKeys: ['rackLocation'],
  },
};

/**
 * Resolves the versioned stage API for a screen/action pair. Unmapped commands
 * keep using the shared `/actions` engine adapter.
 *
 * @param screen workflow screen key
 * @param actionCode configured action code
 */
export function resolveWorkflowStageCommandTarget(
  screen: string,
  actionCode: string,
): WorkflowStageCommandTarget | null {
  return STAGE_COMMANDS[`${screen.trim().toLowerCase()}:${actionCode.trim()}`] ?? null;
}
