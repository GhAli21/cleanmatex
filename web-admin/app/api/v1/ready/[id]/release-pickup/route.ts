/**
 * POST /api/v1/ready/:id/release-pickup
 *
 * Versioned adapter for RELEASE_FOR_PICKUP. This marks the order available at
 * the counter; it does not confirm the physical handover.
 */

import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'ready_release',
  actionCode: WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP,
});
